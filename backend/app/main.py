import asyncio
import json
import uuid
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

from .services.wiki_client import WikipediaClient
from .services.llm_client import LLMClient
from .services.archive_manager import ArchiveManager
from .services.orchestrator import BenchmarkOrchestrator, RunConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="ThinkOnWikiBenchmark API")

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
    
    logger.info(f"Creating benchmark run {run_id} with models: {config.models}")
    logger.info(f"Path: {config.start_page} -> {config.target_page}")
    
    # Create a new LLM client with the provided API key
    run_llm_client = LLMClient(api_key=config.api_key) if config.api_key else llm_client
    
    # We run the benchmark in the background
    orchestrator = BenchmarkOrchestrator(
        wiki_client, 
        run_llm_client, 
        archive_manager,
        event_callback=lambda event: manager.broadcast(event["run_id"], event)
    )
    
    # Store orchestrator for stop functionality
    active_orchestrators[run_id] = orchestrator
    
    # Start benchmark as a background task with error handling
    async def run_with_error_handling():
        try:
            # Wait for WebSocket connection to be established
            logger.info(f"[Run {run_id}] Waiting for WebSocket connection...")
            await manager.broadcast(run_id, {
                "type": "run_created",
                "run_id": run_id,
                "message": "Benchmark created, waiting for frontend connection...",
                "start_page": config.start_page,
                "target_page": config.target_page,
                "total_models": len(config.models)
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
    await llm_client.close()
