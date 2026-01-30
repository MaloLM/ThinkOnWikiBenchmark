import asyncio
import time
import uuid
import re
from collections import deque
from typing import List, Dict, Any, Optional, Callable, Coroutine, Deque
from pydantic import BaseModel
from .wiki_client import WikipediaClient, WikiPage
from .llm_client import LLMClient, LLMResponse
from .langchain_llm_client import LangChainLLMClient, LangChainLLMResponse
from .archive_manager import ArchiveManager

class RunConfig(BaseModel):
    models: List[str]  # Changed from single model to list of models
    start_page: str
    target_page: str
    max_steps: int = 20
    max_loops: int = 3
    max_hallucination_retries: int = 3  # Max consecutive hallucinations before failing
    api_key: Optional[str] = None  # API key for LLM client
    use_langchain: bool = True  # Use LangChain with structured output by default

class BenchmarkOrchestrator:
    def __init__(
        self, 
        wiki_client: WikipediaClient, 
        llm_client: LLMClient, 
        archive_manager: ArchiveManager,
        event_callback: Optional[Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]] = None
    ):
        self.wiki_client = wiki_client
        self.llm_client = llm_client
        self.archive_manager = archive_manager
        self.event_callback = event_callback
        self.stop_requested = False  # Flag to stop the benchmark

    def request_stop(self):
        """Request to stop the current benchmark run."""
        self.stop_requested = True

    async def run_benchmark(self, config: RunConfig, run_id: Optional[str] = None) -> Dict[str, Any]:
        if not run_id:
            run_id = str(uuid.uuid4())
        
        # Reset stop flag at the start of a new run
        self.stop_requested = False
        
        # Save global config
        self.archive_manager.save_config(run_id, config.model_dump())
        
        # Notify run start
        if self.event_callback:
            await self.event_callback({
                "type": "run_start",
                "run_id": run_id,
                "total_models": len(config.models),
                "start_page": config.start_page,
                "target_page": config.target_page
            })
        
        # Run benchmark for each model sequentially
        all_results = {}
        
        for model_idx, model_name in enumerate(config.models):
            # Check if stop was requested
            if self.stop_requested:
                if self.event_callback:
                    await self.event_callback({
                        "type": "run_stopped",
                        "run_id": run_id,
                        "message": f"Benchmark stopped by user after {model_idx} model(s) completed",
                        "completed_models": list(all_results.keys())
                    })
                break
            
            # Add a small delay before first model to ensure frontend is ready
            if model_idx == 0:
                await asyncio.sleep(0.3)
            
            # Notify model start - ensure this is sent before any step events
            if self.event_callback:
                await self.event_callback({
                    "type": "model_start",
                    "run_id": run_id,
                    "model_id": model_name,
                    "model_index": model_idx,
                    "total_models": len(config.models),
                    "start_page": config.start_page
                })
                
            # Small delay to ensure model_start is processed before steps
            await asyncio.sleep(0.1)
            
            # Run benchmark for this model
            result = await self._run_single_model_benchmark(
                config, run_id, model_name, model_idx
            )
            all_results[model_name] = result
            
            # Notify model completion
            if self.event_callback:
                await self.event_callback({
                    "type": "model_complete",
                    "run_id": run_id,
                    "model_id": model_name,
                    "data": result,
                    "model_index": model_idx,
                    "total_models": len(config.models)
                })
        
        # Save summary
        summary = {
            "run_id": run_id,
            "total_models": len(config.models),
            "models": list(all_results.keys()),
            "completed": sum(1 for r in all_results.values() if r["metrics"]["status"] == "success"),
            "failed": sum(1 for r in all_results.values() if r["metrics"]["status"] == "failed")
        }
        self.archive_manager.save_summary(run_id, summary)
        
        # Notify run completion
        if self.event_callback:
            await self.event_callback({
                "type": "run_completed",
                "run_id": run_id,
                "summary": summary,
                "message": f"Benchmark completed: {summary['completed']} succeeded, {summary['failed']} failed"
            })
        
        return {"run_id": run_id, "results": all_results, "summary": summary}

    async def _run_single_model_benchmark(
        self, config: RunConfig, run_id: str, model_name: str, model_idx: int
    ) -> Dict[str, Any]:
        """
        Run benchmark for a single model.
        
        Args:
            config: Run configuration
            run_id: Unique run identifier
            model_name: Name of the model to benchmark
            model_idx: Index of the model in the list
            
        Returns:
            Dictionary with model results, metrics, and steps
        """
        current_page_title = config.start_page
        # Use deque for efficient O(1) operations on both ends
        history: Deque[WikiPage] = deque(maxlen=5)
        steps = []
        
        start_time = time.time()
        
        status = "running"
        reason = ""
        consecutive_hallucinations = 0  # Track consecutive hallucinations
        total_retries = 0  # Track total retry attempts
        
        # Create LangChain client if needed
        langchain_client = None
        if config.use_langchain and config.api_key:
            langchain_client = LangChainLLMClient(
                api_key=config.api_key,
                base_url=self.llm_client.base_url if hasattr(self.llm_client, 'base_url') else "https://nano-gpt.com/api/v1"
            )
        
        for step_idx in range(config.max_steps):
            # Check if stop was requested
            if self.stop_requested:
                status = "stopped"
                reason = "Benchmark stopped by user"
                if self.event_callback:
                    await self.event_callback({
                        "type": "model_stopped",
                        "run_id": run_id,
                        "model_id": model_name,
                        "message": f"Model {model_name} stopped at step {step_idx}"
                    })
                break
            
            # 1. Fetch Wiki page
            page = await self.wiki_client.fetch_page(current_page_title)
            history.append(page)  # deque automatically maintains maxlen=5
            
            # Check if target reached
            if current_page_title.lower() == config.target_page.lower():
                status = "success"
                reason = "Target reached"
                break

            # 2. Prepare LLM Prompt
            messages = self._prepare_messages(config, history)
            
            # 3. Send to LLM (with LangChain or legacy client)
            llm_start = time.time()
            
            if config.use_langchain and langchain_client:
                # Use LangChain with structured output
                lc_response = await langchain_client.chat_completion_structured(
                    model=model_name,
                    messages=messages,
                    available_concepts=page.mapping
                )
                llm_duration = time.time() - llm_start
                next_concept_id = lc_response.content
                
                # Get the concept title for logging (instead of just CONCEPT_ID)
                raw_response_concept_title = page.mapping.get(next_concept_id, next_concept_id)
                
                step_data = {
                    "step": step_idx,
                    "page_title": current_page_title,
                    "sent_prompt": messages,  # Log the full prompt sent to LLM
                    "llm_response": lc_response.model_dump(),
                    "raw_response_concept_title": raw_response_concept_title,  # Log concept title instead of ID
                    "llm_duration": llm_duration,
                    "next_concept_id": next_concept_id,
                    "mapping": page.mapping,
                    "timestamp": time.time(),
                    "structured_parsing_success": lc_response.structured_parsing_success,
                    "parsing_method": lc_response.parsing_method,
                    "confidence": lc_response.confidence,
                    "intuition": lc_response.intuition  # Log the short intuition
                }
            else:
                # Use legacy client
                llm_response = await self.llm_client.chat_completion(model_name, messages)
                llm_duration = time.time() - llm_start
                next_concept_id = self._extract_concept_id(llm_response.content)
                
                # Get the concept title for logging (instead of just CONCEPT_ID)
                if next_concept_id and next_concept_id in page.mapping:
                    raw_response_concept_title = page.mapping[next_concept_id]
                else:
                    raw_response_concept_title = next_concept_id  # Keep the invalid ID or None
                
                step_data = {
                    "step": step_idx,
                    "page_title": current_page_title,
                    "sent_prompt": messages,  # Log the full prompt sent to LLM
                    "llm_response": llm_response.model_dump(),
                    "raw_response_concept_title": raw_response_concept_title,  # Log concept title instead of ID
                    "llm_duration": llm_duration,
                    "next_concept_id": next_concept_id,
                    "mapping": page.mapping,
                    "timestamp": time.time(),
                    "structured_parsing_success": False,
                    "parsing_method": "legacy_regex",
                    "intuition": None  # No intuition in legacy mode
                }
            
            # 4. Validate response and handle hallucinations
            is_hallucination = not next_concept_id or next_concept_id not in page.mapping
            
            if is_hallucination:
                consecutive_hallucinations += 1
                total_retries += 1
                step_data["is_retry"] = True
                step_data["retry_number"] = consecutive_hallucinations
                
                # Send specific hallucination event
                if self.event_callback:
                    await self.event_callback({
                        "type": "hallucination",
                        "run_id": run_id,
                        "model_id": model_name,
                        "data": {
                            "step": step_idx,
                            "page_title": current_page_title,
                            "invalid_concept_id": next_concept_id,
                            "available_concepts": list(page.mapping.keys())[:5],  # First 5 for brevity
                            "retry_number": consecutive_hallucinations,
                            "max_retries": config.max_hallucination_retries
                        }
                    })
                
                # Check if we've exceeded max retries
                if consecutive_hallucinations >= config.max_hallucination_retries:
                    status = "failed"
                    reason = f"Max hallucination retries reached ({config.max_hallucination_retries}). Invalid concept ID: {next_concept_id}"
                    steps.append(step_data)
                    self.archive_manager.save_model_step(run_id, model_name, step_idx, step_data)
                    break
                
                # Save the failed attempt but continue (retry)
                steps.append(step_data)
                self.archive_manager.save_model_step(run_id, model_name, step_idx, step_data)
                
                # Stream event for the failed attempt
                if self.event_callback:
                    await self.event_callback({
                        "type": "step",
                        "run_id": run_id,
                        "model_id": model_name,
                        "data": {
                            **step_data,
                            "is_hallucination": True,
                            "available_concepts_count": len(page.mapping),
                            "use_langchain": config.use_langchain
                        }
                    })
                
                # Continue to next iteration (retry on same page)
                continue
            
            # Valid concept - reset consecutive hallucinations counter
            consecutive_hallucinations = 0
            current_page_title = page.mapping[next_concept_id]
            step_data["next_page_title"] = current_page_title
            step_data["is_retry"] = False
            
            steps.append(step_data)
            self.archive_manager.save_model_step(run_id, model_name, step_idx, step_data)
            
            # Stream event with model_id and enriched data
            if self.event_callback:
                await self.event_callback({
                    "type": "step",
                    "run_id": run_id,
                    "model_id": model_name,
                    "data": {
                        **step_data,
                        "is_hallucination": False,
                        "available_concepts_count": len(page.mapping),
                        "use_langchain": config.use_langchain
                    }
                })

            # Check for loops
            loop_count = sum(1 for h in history if h.title.lower() == current_page_title.lower())
            if loop_count >= config.max_loops:
                status = "failed"
                reason = f"Loop detected: {current_page_title} visited {loop_count} times"
                break

        if status == "running":
            status = "failed"
            reason = "Max steps reached"
        
        # If stopped, ensure status reflects that
        if self.stop_requested and status == "running":
            status = "stopped"
            reason = "Benchmark stopped by user"

        # Si succès, créer un step final pour la page cible
        if status == "success" and steps:
            last_step = steps[-1]
            if "next_page_title" in last_step:
                final_step = {
                    "step": len(steps),
                    "page_title": last_step["next_page_title"],
                    "llm_response": None,
                    "llm_duration": 0,
                    "next_concept_id": None,
                    "mapping": {},
                    "timestamp": time.time(),
                    "is_final_target": True,
                    "structured_parsing_success": False,
                    "parsing_method": "none"
                }
                steps.append(final_step)
                self.archive_manager.save_model_step(run_id, model_name, len(steps)-1, final_step)

        total_duration = time.time() - start_time
        
        # Calculate metrics
        hallucinations = sum(1 for s in steps if s.get("next_concept_id") and s["next_concept_id"] not in s["mapping"])
        hallucination_rate = hallucinations / len(steps) if steps else 0
        
        # Calculate structured parsing success rate (new metric)
        structured_success_count = sum(1 for s in steps if s.get("structured_parsing_success", False))
        structured_success_rate = structured_success_count / len(steps) if steps else 0

        # Construire le path complet incluant toutes les pages visitées
        path = [s["page_title"] for s in steps]

        metrics = {
            "status": status,
            "reason": reason,
            "model": model_name,
            "total_steps": len(steps),
            "total_duration": total_duration,
            "avg_llm_duration": sum(s["llm_duration"] for s in steps) / len(steps) if steps else 0,
            "hallucination_rate": hallucination_rate,
            "hallucination_count": hallucinations,
            "total_retries": total_retries,
            "structured_parsing_success_rate": structured_success_rate,
            "structured_parsing_success_count": structured_success_count,
            "used_langchain": config.use_langchain,
            "path": path
        }
        
        self.archive_manager.save_model_metrics(run_id, model_name, metrics)
        
        if self.event_callback:
            await self.event_callback({
                "type": "model_final",
                "run_id": run_id,
                "model_id": model_name,
                "data": metrics
            })
            
        return {"model": model_name, "metrics": metrics, "steps": steps}

    def _prepare_messages(self, config: RunConfig, history: Deque[WikiPage]) -> List[Dict[str, str]]:
        """
        Prepare messages for LLM prompt.
        
        Args:
            config: Run configuration
            history: Deque of recently visited pages
            
        Returns:
            List of message dictionaries for LLM
        """
        system_prompt = (
            "You are playing the Wikipedia Game. Your goal is to reach the target page by clicking on links.\n"
            f"Target Page: {config.target_page}\n\n"
            "Rules:\n"
            "1. You will be provided with the content of the current Wikipedia page.\n"
            "2. You will also see the list of previously visited pages (if any).\n"
            "3. Links are anonymized as [CONCEPT_XX: Original Name].\n"
            "4. You must respond with the CONCEPT_ID of the link you want to click next.\n"
            "5. Your response must contain the CONCEPT_ID in the format: NEXT_CLICK: CONCEPT_XX\n\n"
            "Navigation strategy:\n"
            "- Try to avoid revisiting pages unless you realize you took a wrong path and need to backtrack.\n"
            "- If you're stuck or went in the wrong direction, it's okay to go back to a previously visited page.\n\n"
            "When providing your structured response, include:\n"
            "- 'intuition': A brief gut feeling or first impression about why this link seems promising (1-2 sentences max). "
            "This is your immediate instinct about the connection between this concept and the target page.\n"
            "- 'chosen_concept_id': The exact CONCEPT_ID from the available list (e.g., CONCEPT_12).\n"
            "- 'confidence': Your confidence level in this decision (0.0 = very uncertain, 0.5 = moderate, 1.0 = very confident). "
            "Base this on how direct the connection seems and how well it aligns with your navigation strategy."
        )
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add navigation history (titles only) if exists
        if len(history) > 1:
            previous_titles = [page.title for page in history[:-1]]
            history_text = "Previously visited pages (in order):\n" + " → ".join(previous_titles)
            messages.append({
                "role": "system",
                "content": history_text
            })
        
        # Add current page content (last page in history)
        current_page = history[-1]
        messages.append({
            "role": "user",
            "content": f"Current Page: {current_page.title}\n\nContent:\n{current_page.extract}"
        })
            
        return messages

    # Pre-compile regex patterns for better performance
    _CONCEPT_PATTERN_STRICT = re.compile(r"NEXT_CLICK:\s*(CONCEPT_\d+)")
    _CONCEPT_PATTERN_FALLBACK = re.compile(r"CONCEPT_\d+")
    
    def _extract_concept_id(self, content: str) -> Optional[str]:
        """
        Extract concept ID from LLM response.
        
        Args:
            content: Raw LLM response content
            
        Returns:
            Extracted concept ID or None if not found
        """
        match = self._CONCEPT_PATTERN_STRICT.search(content)
        if match:
            return match.group(1)
        # Fallback: just look for CONCEPT_XX if the format is not strictly followed
        match = self._CONCEPT_PATTERN_FALLBACK.search(content)
        if match:
            return match.group(0)
        return None
