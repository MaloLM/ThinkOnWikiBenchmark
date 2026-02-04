"""
Centralized configuration for the backend application.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # API Configuration
    nanogpt_api_key: Optional[str] = Field(None, alias="NANOGPT_API_KEY")
    nanogpt_base_url: str = "https://nano-gpt.com/api/v1"
    
    # Security
    ssl_verify: bool = True  # Set to False only for development/testing
    
    # CORS
    cors_origins: list[str] = ["*"]
    
    # Rate Limiting
    rate_limit_per_minute: Optional[int] = None
    
    # Timeouts (in seconds)
    http_timeout: float = 30.0
    llm_timeout: float = 120.0
    llm_read_timeout: float = 300.0
    websocket_connection_timeout: float = 10.0
    
    # Benchmark Configuration
    max_steps: int = 20
    max_loops: int = 3
    max_hallucination_retries: int = 3
    history_size: int = 5
    
    # Archive Configuration
    archive_base_path: str = "archives"
    
    # Logging
    log_level: str = "INFO"
    
    # Wikipedia API
    wikipedia_user_agent: str = "WikikigBenchmark/1.0 (Educational Project; https://github.com/MaloLM/WikikigBenchmark)"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


# Global settings instance
settings = Settings()
