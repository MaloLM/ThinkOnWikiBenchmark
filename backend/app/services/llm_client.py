import httpx
import os
import time
import asyncio
import logging
from typing import List, Dict, Optional, Any, Union
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class TokenDetails(BaseModel):
    """Details about token usage breakdown."""
    cached_tokens: Optional[int] = 0
    text_tokens: Optional[int] = 0
    audio_tokens: Optional[int] = 0
    image_tokens: Optional[int] = 0
    reasoning_tokens: Optional[int] = 0

class Usage(BaseModel):
    """Token usage information from the API."""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    prompt_tokens_details: Optional[Union[TokenDetails, Dict[str, Any]]] = None
    completion_tokens_details: Optional[Union[TokenDetails, Dict[str, Any]]] = None
    input_tokens_details: Optional[Union[TokenDetails, Dict[str, Any]]] = None

class LLMResponse(BaseModel):
    content: str
    thinking: Optional[str] = None
    model: str
    usage: Usage

class LLMClient:
    def __init__(
        self, 
        api_key: Optional[str] = None, 
        base_url: str = "https://nano-gpt.com/api/v1",
        rate_limit_per_minute: Optional[int] = None,
        ssl_verify: bool = True,
        timeout: float = 120.0,
        read_timeout: float = 300.0
    ):
        """
        Initialize LLM client.
        
        Args:
            api_key: API key for authentication
            base_url: Base URL for the API
            rate_limit_per_minute: Optional rate limiting
            ssl_verify: Whether to verify SSL certificates (disable only for development)
            timeout: Default timeout in seconds
            read_timeout: Read timeout for long-running requests
        """
        self.api_key = api_key or os.getenv("NANOGPT_API_KEY")
        self.base_url = base_url
        
        logger.info(f"Initializing LLM client with base_url: {self.base_url}")
        
        # SSL verification warning
        if not ssl_verify:
            logger.warning(
                "⚠️  SSL verification is DISABLED. This should only be used in development. "
                "Your connection is vulnerable to man-in-the-middle attacks."
            )
        
        # Configure transport based on SSL settings
        if ssl_verify:
            transport = None  # Use default secure transport
        else:
            # Only disable SSL verification if explicitly requested
            import ssl
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            transport = httpx.AsyncHTTPTransport(verify=ssl_context)
        
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "ThinkOnWikiBenchmark/1.0"
            },
            timeout=httpx.Timeout(timeout, read=read_timeout),
            transport=transport,
            follow_redirects=True
        )
        self.rate_limit = rate_limit_per_minute
        self.last_request_time = 0.0
        self.min_interval = 60.0 / rate_limit_per_minute if rate_limit_per_minute else 0.0

    async def get_models(self) -> List[Dict[str, Any]]:
        """
        Fetch available models from the API.
        
        Returns:
            List of available models with metadata
            
        Raises:
            ValueError: If API request fails
        """
        try:
            logger.info(f"Fetching models from {self.base_url}/models")
            resp = await self.client.get(f"{self.base_url}/models")
            resp.raise_for_status()
            data = resp.json()
            models = data.get("data", [])
            logger.info(f"Successfully fetched {len(models)} models")
            return data
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching models: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to fetch models from API: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching models: {str(e)}", exc_info=True)
            raise

    async def chat_completion(self, model: str, messages: List[Dict[str, str]], temperature: float = 0.0) -> LLMResponse:
        """
        Send a chat completion request.
        
        Args:
            model: Model identifier
            messages: List of message dictionaries with 'role' and 'content'
            temperature: Sampling temperature
            
        Returns:
            LLMResponse with content and usage information
            
        Raises:
            ValueError: If API request fails or response is invalid
        """
        logger.info(f"Sending chat completion request to model: {model}")
        
        # Optional Rate Limiting
        if self.rate_limit:
            now = time.time()
            elapsed = now - self.last_request_time
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self.last_request_time = time.time()

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        
        try:
            resp = await self.client.post(f"{self.base_url}/chat/completions", json=payload)
            resp.raise_for_status()
            
            if not resp.text:
                raise ValueError(f"Empty response from LLM API for model: {model}")
            
            try:
                data = resp.json()
            except Exception as e:
                logger.error(f"Failed to parse JSON response from LLM: {resp.text[:200]}")
                raise ValueError(f"Invalid JSON response from LLM API: {str(e)}")
            
            if "choices" not in data or not data["choices"]:
                raise ValueError(f"No choices in LLM response: {data}")
            
            choice = data["choices"][0]
            message = choice.get("message", {})
            
            if "content" not in message:
                raise ValueError(f"No content in LLM message: {message}")
            
            # Handle thinking/reasoning if present in the response (specific to some models)
            thinking = message.get("reasoning_content") or message.get("thinking")
            
            logger.info(f"Successfully received response from model: {model}")
            
            return LLMResponse(
                content=message["content"],
                thinking=thinking,
                model=model,
                usage=data.get("usage", {})
            )
            
        except httpx.ConnectError as e:
            logger.error(f"Connection error to LLM API: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to connect to API. Please check your internet connection and API URL: {str(e)}")
        except httpx.HTTPError as e:
            logger.error(f"HTTP error from LLM API: {str(e)}", exc_info=True)
            raise ValueError(f"HTTP error from API: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in chat completion: {str(e)}", exc_info=True)
            raise

    async def close(self):
        await self.client.aclose()
