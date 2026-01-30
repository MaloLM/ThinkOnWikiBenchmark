import re
import logging
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field, ValidationError
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger(__name__)


class WikiNavigationChoice(BaseModel):
    """Structured output schema for LLM navigation choice."""
    intuition: str = Field(
        description="A short 1-2 sentence intuition/justification for your choice. This helps understand your decision at a glance."
    )
    chosen_concept_id: str = Field(
        description="The CONCEPT_ID you want to click next (e.g., CONCEPT_12). Must be from the available list.",
        pattern="^CONCEPT_\\d+$"
    )
    confidence: float = Field(
        description="Your confidence level in this choice (0.0 to 1.0)",
        ge=0.0,
        le=1.0,
        default=0.5
    )


class LangChainLLMResponse(BaseModel):
    """Response from LangChain LLM client."""
    content: str  # The chosen CONCEPT_ID
    intuition: Optional[str] = None  # Short justification/intuition from the model
    confidence: Optional[float] = None
    model: str
    usage: Dict[str, Any] = {}
    structured_parsing_success: bool = False
    parsing_method: str = "unknown"


class LangChainLLMClient:
    """
    LangChain-based LLM client with structured output parsing.
    Falls back to regex extraction if structured parsing fails.
    """
    
    def __init__(
        self, 
        api_key: str, 
        base_url: str = "https://nano-gpt.com/api/v1",
        temperature: float = 0.0,
        max_tokens: int = 500
    ):
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = temperature
        self.max_tokens = max_tokens
        
        logger.info(f"Initializing LangChain LLM client with base_url: {self.base_url}")
        
        # Initialize the parser
        self.parser = PydanticOutputParser(pydantic_object=WikiNavigationChoice)
        
        # We'll create the ChatOpenAI instance per request with the specific model
        
    def _create_llm(self, model: str) -> ChatOpenAI:
        """Create a ChatOpenAI instance for a specific model."""
        return ChatOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            model=model,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            timeout=300.0,  # Long timeout for reasoning models
        )
    
    def _build_enhanced_prompt(
        self, 
        original_content: str, 
        available_concepts: Dict[str, str],
        format_instructions: str
    ) -> str:
        """
        Build an enhanced prompt with:
        - Original content
        - Explicit list of available concepts
        - Format instructions for structured output
        """
        concepts_list = "\n".join([
            f"- {concept_id}: {title}" 
            for concept_id, title in sorted(available_concepts.items())
        ])
        
        enhanced_prompt = f"""{original_content}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE CONCEPTS (You MUST choose ONE from this list):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{concepts_list}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE FORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{format_instructions}

IMPORTANT: Your chosen_concept_id MUST be one of the CONCEPT_IDs listed above. Do not invent or hallucinate concept IDs.
"""
        return enhanced_prompt
    
    async def chat_completion_structured(
        self, 
        model: str, 
        messages: List[Dict[str, str]],
        available_concepts: Dict[str, str]
    ) -> LangChainLLMResponse:
        """
        Send a chat completion request with structured output parsing.
        
        Args:
            model: The model name to use
            messages: List of message dicts with 'role' and 'content'
            available_concepts: Dict mapping CONCEPT_ID -> Wikipedia title
            
        Returns:
            LangChainLLMResponse with parsing metadata
        """
        logger.info(f"Sending structured chat completion to model: {model}")
        logger.info(f"Available concepts: {len(available_concepts)}")
        
        # Get format instructions from parser
        format_instructions = self.parser.get_format_instructions()
        
        # Enhance the last user message with available concepts and format instructions
        enhanced_messages = messages[:-1].copy() if len(messages) > 1 else []
        last_message = messages[-1]["content"]
        enhanced_content = self._build_enhanced_prompt(
            last_message,
            available_concepts,
            format_instructions
        )
        
        # Convert to LangChain message format
        lc_messages = []
        for msg in enhanced_messages:
            if msg["role"] == "system":
                lc_messages.append(SystemMessage(content=msg["content"]))
            elif msg["role"] == "user":
                lc_messages.append(HumanMessage(content=msg["content"]))
        
        # Add the enhanced last message
        lc_messages.append(HumanMessage(content=enhanced_content))
        
        # Create LLM instance
        llm = self._create_llm(model)
        
        try:
            # Invoke the LLM
            response = await llm.ainvoke(lc_messages)
            raw_content = response.content
            
            logger.info(f"Received response from {model}: {raw_content[:200]}...")
            
            # Try to parse as structured output
            try:
                parsed = self.parser.parse(raw_content)
                
                # Validate that the chosen concept exists in available concepts
                if parsed.chosen_concept_id not in available_concepts:
                    logger.warning(
                        f"Model chose invalid concept: {parsed.chosen_concept_id}. "
                        f"Not in available concepts. Falling back to regex."
                    )
                    raise ValidationError(f"Invalid concept ID: {parsed.chosen_concept_id}")
                
                logger.info(
                    f"✅ Structured parsing SUCCESS: {parsed.chosen_concept_id} "
                    f"(confidence: {parsed.confidence})"
                )
                
                return LangChainLLMResponse(
                    content=parsed.chosen_concept_id,
                    intuition=parsed.intuition,
                    confidence=parsed.confidence,
                    model=model,
                    usage=self._extract_usage(response),
                    structured_parsing_success=True,
                    parsing_method="structured"
                )
                
            except (ValidationError, Exception) as parse_error:
                logger.warning(
                    f"⚠️ Structured parsing FAILED: {parse_error}. "
                    f"Falling back to regex extraction."
                )
                
                # Fallback: Extract CONCEPT_ID with regex
                concept_id = self._extract_concept_id_regex(raw_content, available_concepts)
                
                if concept_id:
                    logger.info(f"✅ Regex extraction SUCCESS: {concept_id}")
                    return LangChainLLMResponse(
                        content=concept_id,
                        intuition=None,
                        confidence=None,
                        model=model,
                        usage=self._extract_usage(response),
                        structured_parsing_success=False,
                        parsing_method="regex"
                    )
                else:
                    logger.error(f"❌ Both structured and regex parsing FAILED")
                    return LangChainLLMResponse(
                        content="PARSING_FAILED",
                        intuition=None,
                        confidence=None,
                        model=model,
                        usage=self._extract_usage(response),
                        structured_parsing_success=False,
                        parsing_method="failed"
                    )
                    
        except Exception as e:
            logger.error(f"Error in chat completion: {str(e)}")
            raise ValueError(f"Failed to get response from LLM: {str(e)}")
    
    def _extract_concept_id_regex(
        self, 
        content: str, 
        available_concepts: Dict[str, str]
    ) -> Optional[str]:
        """
        Fallback regex extraction with validation.
        Only returns a concept ID if it exists in available_concepts.
        """
        # Find all CONCEPT_XX patterns
        matches = re.findall(r"CONCEPT_\d+", content)
        
        # Return the first valid one
        for match in matches:
            if match in available_concepts:
                return match
        
        return None
    
    def _extract_usage(self, response) -> Dict[str, Any]:
        """Extract usage information from LangChain response."""
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            return {
                "prompt_tokens": response.usage_metadata.get("input_tokens", 0),
                "completion_tokens": response.usage_metadata.get("output_tokens", 0),
                "total_tokens": response.usage_metadata.get("total_tokens", 0)
            }
        return {}
    
    async def get_models(self) -> List[Dict[str, Any]]:
        """
        Fetch available models.
        Note: LangChain doesn't have a direct method for this,
        so we'll use httpx directly (same as original client).
        """
        import httpx
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                resp.raise_for_status()
                data = resp.json()
                logger.info(f"Successfully fetched models")
                return data
        except Exception as e:
            logger.error(f"Error fetching models: {str(e)}")
            raise ValueError(f"Failed to fetch models: {str(e)}")
