import asyncio
import json
import uuid
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

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
wiki_client = WikipediaClient()
llm_client = LLMClient()
archive_manager = ArchiveManager()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)

    def disconnect(self, run_id: str, websocket: WebSocket):
        if run_id in self.active_connections:
            self.active_connections[run_id].remove(websocket)

    async def broadcast(self, run_id: str, message: Dict[str, Any]):
        if run_id in self.active_connections:
            for connection in self.active_connections[run_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# Store active orchestrators by run_id
active_orchestrators: Dict[str, BenchmarkOrchestrator] = {}

@app.get("/models")
async def get_models():
    try:
        return await llm_client.get_models()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/runs")
async def start_run(config: RunConfig):
    run_id = str(uuid.uuid4())
    
    logger.info(f"Starting benchmark run {run_id} with models: {config.models}")
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
            await orchestrator.run_benchmark(config, run_id=run_id)
        except Exception as e:
            logger.error(f"Error in benchmark {run_id}: {str(e)}", exc_info=True)
            # Send error event to frontend
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
