import httpx
import logging
from typing import List, Dict, Optional
from urllib.parse import unquote, urlparse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class WikiRouteResponse(BaseModel):
    sources: List[str]
    destinations: List[str]
    route: Optional[Dict[str, List[str]]] = None
    error: Optional[str] = None

class WikiRouteClient:
    BASE_URL = "https://wikiroute.revig.nl/wikiroute"

    def __init__(self, timeout: float = 30.0):
        self.client = httpx.AsyncClient(timeout=timeout)

    def wiki_url_to_title(self, url: str) -> Dict[str, str]:
        """Extract title and language from a Wikipedia URL."""
        parsed = urlparse(url)
        # hostname is like 'en.wikipedia.org'
        lang = parsed.hostname.split(".")[0]
        # path is like '/wiki/Title'
        title = unquote(parsed.path.replace("/wiki/", "")).replace("_", " ")
        return {"title": title, "lang": lang}

    async def get_path_from_urls(self, source_url: str, dest_url: str) -> Optional[List[str]]:
        """Get the shortest path between two Wikipedia URLs."""
        source = self.wiki_url_to_title(source_url)
        dest = self.wiki_url_to_title(dest_url)

        if source["lang"] != dest["lang"]:
            raise ValueError("Source and destination must be in the same language")

        params = {
            "source": source["title"],
            "dest": dest["title"],
            "lang": source["lang"],
            "fuzzy": "1"
        }

        try:
            response = await self.client.get(self.BASE_URL, params=params)
            response.raise_for_status()
            data = WikiRouteResponse(**response.json())

            if data.error:
                raise ValueError(data.error)

            if not data.route:
                return None

            return self._extract_path(source["title"], dest["title"], data.route)
        except Exception as e:
            logger.error(f"WikiRoute API error: {str(e)}")
            raise

    def _extract_path(self, source: str, dest: str, route: Dict[str, List[str]]) -> List[str]:
        """Reconstruct a linear path from the graph structure."""
        path = [source]
        current = source
        
        # Limit iterations to avoid infinite loops if API returns circular route
        max_steps = 100 
        steps = 0
        
        while current != dest and steps < max_steps:
            next_nodes = route.get(current)
            if not next_nodes:
                # Try case-insensitive match if exact match fails
                current_lower = current.lower()
                found = False
                for k, v in route.items():
                    if k.lower() == current_lower:
                        next_nodes = v
                        found = True
                        break
                if not found:
                    break
            
            next_node = next_nodes[0]
            path.append(next_node)
            current = next_node
            steps += 1

        return path

    async def close(self):
        await self.client.aclose()
