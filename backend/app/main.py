import asyncio
import uuid
import logging
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
import shutil
import os

from .services.wiki_client import WikipediaClient
from .services.wikiroute_client import WikiRouteClient
from .services.llm_client import LLMClient
from .services.archive_manager import ArchiveManager
from .services.orchestrator import BenchmarkOrchestrator, RunConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Wikikig Benchmark API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency injection (simplified for this task)
from .config import settings
wiki_client = WikipediaClient()
wikiroute_client = WikiRouteClient()
llm_client = LLMClient(api_key=settings.nanogpt_api_key)
archive_manager = ArchiveManager()

# WebSocket connection manager
class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Track connection readiness per run_id
        self.connection_ready: Dict[str, asyncio.Event] = {}

    async def connect(self, run_id: str, websocket: WebSocket) -> None:
        """
        Accept and register a new WebSocket connection.
        
        Args:
            run_id: Unique identifier for the benchmark run
            websocket: WebSocket connection to register
        """
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)
        # Signal that at least one connection is ready
        if run_id not in self.connection_ready:
            self.connection_ready[run_id] = asyncio.Event()
        self.connection_ready[run_id].set()
        logger.info(f"WebSocket connected for run {run_id}, total connections: {len(self.active_connections[run_id])}")

    def disconnect(self, run_id: str, websocket: WebSocket) -> None:
        """
        Unregister a WebSocket connection.
        
        Args:
            run_id: Unique identifier for the benchmark run
            websocket: WebSocket connection to unregister
        """
        if run_id in self.active_connections:
            if websocket in self.active_connections[run_id]:
                self.active_connections[run_id].remove(websocket)
            logger.info(f"WebSocket disconnected for run {run_id}, remaining connections: {len(self.active_connections[run_id])}")

    async def broadcast(self, run_id: str, message: Dict[str, Any]) -> None:
        """
        Broadcast a message to all connected clients for a run.
        Uses concurrent sending for better performance.
        
        Args:
            run_id: Unique identifier for the benchmark run
            message: Message dictionary to broadcast
        """
        if run_id not in self.active_connections:
            return
            
        connections = self.active_connections[run_id]
        if not connections:
            return
        
        # Send to all connections concurrently
        async def send_to_connection(conn: WebSocket) -> Optional[WebSocket]:
            try:
                await conn.send_json(message)
                return None
            except Exception as e:
                logger.warning(f"Failed to send message to WebSocket: {e}")
                return conn  # Return failed connection for cleanup
        
        # Gather all send operations
        results = await asyncio.gather(
            *[send_to_connection(conn) for conn in connections],
            return_exceptions=True
        )
        
        # Clean up disconnected clients
        disconnected = [r for r in results if isinstance(r, WebSocket)]
        for conn in disconnected:
            if conn in self.active_connections[run_id]:
                self.active_connections[run_id].remove(conn)

    async def wait_for_connection(self, run_id: str, timeout: float = 10.0) -> bool:
        """
        Wait for at least one WebSocket connection to be established.
        
        Args:
            run_id: Unique identifier for the benchmark run
            timeout: Maximum time to wait in seconds
            
        Returns:
            True if connection established, False if timeout
        """
        if run_id not in self.connection_ready:
            self.connection_ready[run_id] = asyncio.Event()
        try:
            await asyncio.wait_for(self.connection_ready[run_id].wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            logger.warning(f"Timeout waiting for WebSocket connection for run {run_id}")
            return False

manager = ConnectionManager()

# Store active orchestrators by run_id
active_orchestrators: Dict[str, BenchmarkOrchestrator] = {}

@app.get("/models")
async def get_models():
    if not llm_client.api_key:
        raise HTTPException(
            status_code=401, 
            detail="NanoGPT API key is not configured on the server. Please check the .env file."
        )
    try:
        return await llm_client.get_models()
    except Exception as e:
        logger.error(f"Error fetching models: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {str(e)}")

@app.get("/wiki/validate")
async def validate_wiki_page(url: str):
    """Validate a Wikipedia URL and check if the page exists."""
    try:
        title = wiki_client.parse_wikipedia_url(url)
        await wiki_client.fetch_page(title)
        return {"valid": True, "title": title}
    except ValueError as e:
        return {"valid": False, "error": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wiki/path")
async def get_wiki_path(source_url: str, dest_url: str):
    """Get the shortest path between two Wikipedia pages using WikiRoute."""
    try:
        path = await wikiroute_client.get_path_from_urls(source_url, dest_url)
        if path:
            return {
                "found": True,
                "path": path,
                "length": len(path) - 1
            }
        else:
            return {"found": False, "error": "No path found between these pages"}
    except ValueError as e:
        return {"found": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Error in /wiki/path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/wiki/random")
async def get_random_wiki_page():
    """Fetch a random Wikipedia page URL and title."""
    try:
        return await wiki_client.get_random_page()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/runs")
async def start_run(config: RunConfig):
    run_id = str(uuid.uuid4())

    # Ensure API key is present if not provided by frontend
    if not config.api_key:
        config.api_key = settings.nanogpt_api_key
    
    logger.info(f"Creating benchmark run {run_id} with models: {config.models}")
    if config.pairs:
        first_pair = config.pairs[0]
        logger.info(f"First Path: {first_pair.start_page} -> {first_pair.target_page} (Total pairs: {len(config.pairs)})")
    
    # Create a new LLM client with the provided API key
    run_llm_client = LLMClient(api_key=config.api_key) if config.api_key else llm_client
    
    # We run the benchmark in the background
    orchestrator = BenchmarkOrchestrator(
        wiki_client, 
        run_llm_client, 
        archive_manager,
        event_callback=lambda event: manager.broadcast(event["run_id"], event),
        wikiroute_client=wikiroute_client
    )
    
    # Store orchestrator for stop functionality
    active_orchestrators[run_id] = orchestrator
    
    # Start benchmark as a background task with error handling
    async def run_with_error_handling():
        try:
            # Wait for WebSocket connection to be established
            logger.info(f"[Run {run_id}] Waiting for WebSocket connection...")
            
            # Use first pair for initial broadcast info
            start_page = config.pairs[0].start_page if config.pairs else "N/A"
            target_page = config.pairs[0].target_page if config.pairs else "N/A"
            
            await manager.broadcast(run_id, {
                "type": "run_created",
                "run_id": run_id,
                "message": "Benchmark created, waiting for frontend connection...",
                "start_page": start_page,
                "target_page": target_page,
                "total_models": len(config.models),
                "total_pairs": len(config.pairs)
            })
            
            # Wait for at least one connection (with timeout)
            connection_ready = await manager.wait_for_connection(run_id, timeout=10.0)
            
            if connection_ready:
                logger.info(f"[Run {run_id}] WebSocket connected, starting benchmark")
                # Small delay to ensure frontend is ready to receive events
                await asyncio.sleep(0.5)
            else:
                logger.warning(f"[Run {run_id}] No WebSocket connection received, proceeding anyway")
            
            # Signal that benchmark is about to start
            await manager.broadcast(run_id, {
                "type": "ready_to_start",
                "run_id": run_id,
                "message": "All systems ready, starting benchmark..."
            })
            
            await orchestrator.run_benchmark(config, run_id=run_id)
        except Exception as e:
            logger.error(f"Error in benchmark {run_id}: {str(e)}", exc_info=True)
            # The orchestrator already broadcasts an "error" event if it catches one,
            # but we ensure a final error message is sent if something escaped or
            # if we want to guarantee the frontend receives the error state.
            await manager.broadcast(run_id, {
                "type": "error",
                "run_id": run_id,
                "error": str(e)
            })
        finally:
            # Clean up orchestrator after completion
            if run_id in active_orchestrators:
                del active_orchestrators[run_id]
    
    asyncio.create_task(run_with_error_handling())
    
    return {"message": "Benchmark started", "run_id": run_id}

@app.post("/runs/{run_id}/stop")
async def stop_run(run_id: str):
    """Stop a running benchmark."""
    if run_id not in active_orchestrators:
        raise HTTPException(status_code=404, detail="Run not found or already completed")
    
    orchestrator = active_orchestrators[run_id]
    orchestrator.request_stop()
    
    logger.info(f"Stop requested for benchmark run {run_id}")
    
    # Send stop event to frontend
    await manager.broadcast(run_id, {
        "type": "stop_requested",
        "run_id": run_id,
        "message": "Stop request received, benchmark will stop after current step"
    })
    
    return {"message": "Stop request sent", "run_id": run_id}

@app.get("/archives")
async def list_archives():
    return archive_manager.list_archives()

@app.get("/archives/{run_id}")
async def get_archive(run_id: str):
    details = archive_manager.get_archive_details(run_id)
    if not details:
        raise HTTPException(status_code=404, detail="Archive not found")
    return details

@app.get("/archives/{run_id}/analysis/{analysis_type}")
async def get_analysis(run_id: str, analysis_type: str):
    """Get cached analysis results."""
    analysis = archive_manager.get_analysis(run_id, analysis_type)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis

@app.post("/archives/{run_id}/analysis/{analysis_type}")
async def compute_analysis(run_id: str, analysis_type: str):
    """Compute and cache analysis results."""
    details = archive_manager.get_archive_details(run_id)
    if not details:
        raise HTTPException(status_code=404, detail="Archive not found")

    if analysis_type == "model_comparison":
        # Logic for model comparison chart
        config = details.get("config", {})
        pairs_config = config.get("pairs", [])
        models = config.get("models", [])
        
        # Structure: { model_id: [ { pair_index, steps, status, shortest_path }, ... ] }
        results = []
        
        # 1. Add "Shortest Path" as a separate group (First position)
        shortest_path_results = []
        for pair_idx, pair_conf in enumerate(pairs_config):
            shortest_path_results.append({
                "pair_index": pair_idx,
                "pair_name": f"{pair_conf.get('start_page')} → {pair_conf.get('target_page')}",
                "steps": pair_conf.get("shortest_path_length", 0),
                "status": "shortest",
                "shortest_path": pair_conf.get("shortest_path_length", 0)
            })
        
        results.append({
            "model_id": "Shortest Path",
            "results": shortest_path_results
        })

        # 2. Add Models results
        for model_id in models:
            model_results = []
            for pair_idx, pair_conf in enumerate(pairs_config):
                # Find model data for this pair
                # Note: details["pairs"] keys are integers in get_archive_details, 
                # but might be strings if loaded from JSON.
                pair_data = details.get("pairs", {}).get(pair_idx) or details.get("pairs", {}).get(str(pair_idx), {})
                model_data = pair_data.get("models", {}).get(model_id, {})
                metrics = model_data.get("metrics", {})
                
                # Determine status: check explicit status or if target was reached in steps
                status = metrics.get("status")
                steps = model_data.get("steps", [])
                
                # If status is missing or "failed", double check steps for success
                if status != "success":
                    if steps and any(s.get("is_final_target") for s in steps):
                        status = "success"
                    else:
                        status = "failed"

                model_results.append({
                    "pair_index": pair_idx,
                    "pair_name": f"{pair_conf.get('start_page')} → {pair_conf.get('target_page')}",
                    "steps": metrics.get("total_steps", 0),
                    "status": status,
                    "shortest_path": pair_conf.get("shortest_path_length", 0)
                })
            
            results.append({
                "model_id": model_id,
                "results": model_results
            })

        
        analysis_data = {
            "type": "model_comparison",
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "data": results
        }
        
        archive_manager.save_analysis(run_id, analysis_type, analysis_data)
        return analysis_data
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported analysis type: {analysis_type}")

@app.post("/archives/{run_id}/retry")
async def retry_run(run_id: str):
    """Retry a benchmark run using the configuration from an archive."""
    details = archive_manager.get_archive_details(run_id)
    if not details or "config" not in details:
        raise HTTPException(status_code=404, detail="Archive or configuration not found")
    
    config_dict = details["config"]
    
    # Always use the server's default API key for retries, 
    # as the archived one might be missing or expired.
    config_dict["api_key"] = settings.nanogpt_api_key
    
    try:
        config = RunConfig(**config_dict)
    except Exception as e:
        logger.error(f"Failed to parse archived config for retry: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid archived configuration: {str(e)}")
    
    # Reuse the start_run logic
    return await start_run(config)

@app.delete("/archives/{run_id}")
async def delete_archive(run_id: str):
    """Delete an archive."""
    # Check if the run is currently active
    if run_id in active_orchestrators:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete an archive for a benchmark that is currently running. Please stop it first."
        )
        
    success = archive_manager.delete_archive(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Archive not found")
    return {"message": "Archive deleted successfully", "run_id": run_id}

@app.get("/archives/{run_id}/download")
async def download_archive(run_id: str, background_tasks: BackgroundTasks):
    """Download an archive as a ZIP file."""
    run_path = archive_manager.base_path / run_id
    if not run_path.is_dir():
        raise HTTPException(status_code=404, detail="Archive not found")
    
    zip_filename = f"{run_id}"
    zip_path = archive_manager.base_path / f"{zip_filename}.zip"
    
    # Create zip file
    # shutil.make_archive adds .zip extension automatically
    archive_base_name = str(archive_manager.base_path / zip_filename)
    shutil.make_archive(archive_base_name, 'zip', run_path)
    
    # Add cleanup task to delete the zip file after sending
    background_tasks.add_task(lambda: os.remove(zip_path) if os.path.exists(zip_path) else None)
    
    return FileResponse(
        path=zip_path,
        filename=f"benchmark_{run_id}.zip",
        media_type="application/zip"
    )

@app.websocket("/live/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection alive
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)

@app.on_event("shutdown")
async def shutdown_event():
    await wiki_client.close()
    await wikiroute_client.close()
    await llm_client.close()
