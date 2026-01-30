import httpx
import re
import logging
from typing import List, Dict, Optional, Tuple
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class WikiPage(BaseModel):
    title: str
    extract: str
    links: List[str]
    mapping: Dict[str, str] = {}  # CONCEPT_XX -> Wiki Title

class WikipediaClient:
    BASE_URL = "https://en.wikipedia.org/w/api.php"

    def __init__(self, timeout: float = 30.0, user_agent: Optional[str] = None):
        """
        Initialize Wikipedia client.
        
        Args:
            timeout: Request timeout in seconds
            user_agent: Custom user agent string
        """
        if user_agent is None:
            user_agent = "ThinkOnWikiBenchmark/1.0 (Educational Project; https://github.com/MaloLM/ThinkOnWikiBenchmark)"
        
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": user_agent}
        )
        self._page_cache: Dict[str, WikiPage] = {}  # Simple in-memory cache

    async def fetch_page(self, title: str, use_cache: bool = True) -> WikiPage:
        """
        Fetch page content and links.
        
        Args:
            title: Wikipedia page title
            use_cache: Whether to use cached results
            
        Returns:
            WikiPage object with content and links
            
        Raises:
            ValueError: If page not found or API error
        """
        # Check cache first
        if use_cache and title in self._page_cache:
            logger.info(f"Using cached page: {title}")
            return self._page_cache[title]
        
        logger.info(f"Fetching Wikipedia page: {title}")
        
        # 1. Get extract
        params_extract = {
            "action": "query",
            "format": "json",
            "prop": "extracts",
            "titles": title,
            "explaintext": True,
            "exsectionformat": "plain",
        }
        
        try:
            resp = await self.client.get(self.BASE_URL, params=params_extract)
            resp.raise_for_status()  # Raise exception for HTTP errors
            
            if not resp.text:
                raise ValueError(f"Empty response from Wikipedia API for page: {title}")
            
            try:
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to parse JSON response for page '{title}': {resp.text[:200]}")
                raise ValueError(f"Invalid JSON response from Wikipedia API: {str(e)}")
            
            pages = data.get("query", {}).get("pages", {})
            
            if not pages:
                raise ValueError(f"No pages found in Wikipedia response for: {title}")
            
            page_id = next(iter(pages))
            page_data = pages[page_id]
            
            # Check if page exists (missing pages have pageid = -1)
            if page_id == "-1" or "missing" in page_data:
                raise ValueError(f"Wikipedia page not found: {title}")
            
            extract = page_data.get("extract", "")
            
            if not extract:
                logger.warning(f"Empty extract for page: {title}")
                
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching page '{title}': {str(e)}")
            raise ValueError(f"Failed to fetch Wikipedia page '{title}': {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching page '{title}': {str(e)}")
            raise

        # 2. Get links (with continuation)
        links = await self._fetch_all_links(title)
        
        # 3. Preprocess and Anonymize
        clean_extract, mapping = self._preprocess_and_anonymize(extract, links)
        
        page = WikiPage(
            title=title,
            extract=clean_extract,
            links=links,
            mapping=mapping
        )
        
        # Cache the result
        if use_cache:
            self._page_cache[title] = page
        
        return page

    async def _fetch_all_links(self, title: str) -> List[str]:
        links = []
        params = {
            "action": "query",
            "format": "json",
            "prop": "links",
            "titles": title,
            "pllimit": "max",
            "plnamespace": 0,  # Only Namespace 0 (Articles)
        }
        
        try:
            while True:
                resp = await self.client.get(self.BASE_URL, params=params)
                resp.raise_for_status()
                
                if not resp.text:
                    logger.warning(f"Empty response when fetching links for: {title}")
                    break
                
                try:
                    data = resp.json()
                except Exception as e:
                    logger.error(f"Failed to parse JSON when fetching links for '{title}': {resp.text[:200]}")
                    break
                
                pages = data.get("query", {}).get("pages", {})
                
                if not pages:
                    break
                
                page_id = next(iter(pages))
                page_data = pages[page_id]
                
                # Check if page exists
                if page_id == "-1" or "missing" in page_data:
                    logger.warning(f"Page not found when fetching links: {title}")
                    break
                
                page_links = page_data.get("links", [])
                links.extend([link["title"] for link in page_links])
                
                if "continue" in data:
                    params.update(data["continue"])
                else:
                    break
                    
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching links for '{title}': {str(e)}")
            # Don't raise, just return what we have so far
        except Exception as e:
            logger.error(f"Unexpected error fetching links for '{title}': {str(e)}")
            # Don't raise, just return what we have so far
            
        logger.info(f"Fetched {len(links)} links for page: {title}")
        return links

    def _preprocess_and_anonymize(self, extract: str, links: List[str]) -> Tuple[str, Dict[str, str]]:
        """
        Clean sections and replace links with CONCEPT_XX.
        Deduplicates links so each unique page gets only one CONCEPT_ID.
        
        Args:
            extract: Raw Wikipedia page extract
            links: List of link titles (may contain duplicates)
            
        Returns:
            Tuple of (anonymized_text, concept_mapping)
        """
        # Clean sections (References, External links, etc.)
        # Pre-compile regex patterns for better performance
        sections_to_remove = ["References", "External links", "Further reading", "See also", "Notes"]
        for section in sections_to_remove:
            pattern = rf"== {section} ==.*"
            extract = re.sub(pattern, "", extract, flags=re.DOTALL | re.IGNORECASE)

        mapping = {}
        anonymized_text = extract
        
        # Efficient deduplication using dict (preserves insertion order in Python 3.7+)
        unique_links = list(dict.fromkeys(links))
        
        logger.info(f"Deduplicated links: {len(links)} -> {len(unique_links)} unique links")
        
        # Sort unique links by length descending to avoid partial replacements
        sorted_links = sorted(unique_links, key=len, reverse=True)
        
        # Pre-compile all regex patterns for better performance
        patterns = []
        for i, link_title in enumerate(sorted_links):
            concept_id = f"CONCEPT_{i:02d}"
            mapping[concept_id] = link_title
            patterns.append((
                concept_id,
                link_title,
                re.compile(rf"\b{re.escape(link_title)}\b", re.IGNORECASE)
            ))
        
        # Apply all replacements
        for concept_id, link_title, pattern in patterns:
            anonymized_text = pattern.sub(f"[{concept_id}: {link_title}]", anonymized_text)

        return anonymized_text, mapping

    async def close(self):
        await self.client.aclose()
