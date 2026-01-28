import httpx
import os
import time
import asyncio
import logging
import ssl
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
        rate_limit_per_minute: Optional[int] = None
    ):
        self.api_key = api_key or os.getenv("NANOGPT_API_KEY")
        self.base_url = base_url
        
        logger.info(f"Initializing LLM client with base_url: {self.base_url}")
        
        # Try HTTP instead of HTTPS to bypass SSL issues
        # If the URL is HTTPS and we're having SSL issues, suggest using HTTP
        if self.base_url.startswith("https://"):
            logger.warning("Using HTTPS may cause SSL issues. Consider using HTTP if available.")
        
        # Create custom SSL context to handle SNI issues
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        # Try to disable SNI
        try:
            ssl_context.options |= 0x4  # OP_LEGACY_SERVER_CONNECT
        except:
            pass
        
        # Create custom transport with SSL context
        transport = httpx.AsyncHTTPTransport(verify=ssl_context)
        
        self.client = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "User-Agent": "ThinkOnWikiBenchmark/1.0"
            },
            timeout=httpx.Timeout(120.0, read=300.0),  # Long timeout for reasoning models
            transport=transport,
            follow_redirects=True
        )
        self.rate_limit = rate_limit_per_minute
        self.last_request_time = 0.0
        self.min_interval = 60.0 / rate_limit_per_minute if rate_limit_per_minute else 0.0

    async def get_models(self) -> List[Dict[str, Any]]:
        """Fetch available models from NanoGPT."""
        try:
            logger.info(f"Fetching models from {self.base_url}/models")
            resp = await self.client.get(f"{self.base_url}/models")
            resp.raise_for_status()
            data = resp.json()
            models = data.get("data", [])
            logger.info(f"Successfully fetched {len(models)} models")
            return data
        except httpx.HTTPError as e:
            logger.error(f"HTTP error fetching models: {str(e)}")
            raise ValueError(f"Failed to fetch models from NanoGPT: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching models: {str(e)}")
            raise

    async def chat_completion(self, model: str, messages: List[Dict[str, str]]) -> LLMResponse:
        """Send a chat completion request."""
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
            logger.error(f"Connection error to LLM API: {str(e)}")
            raise ValueError(f"Failed to connect to NanoGPT API. Please check your internet connection and API URL: {str(e)}")
        except httpx.HTTPError as e:
            logger.error(f"HTTP error from LLM API: {str(e)}")
            raise ValueError(f"HTTP error from NanoGPT API: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error in chat completion: {str(e)}")
            raise

    async def close(self):
        await self.client.aclose()
