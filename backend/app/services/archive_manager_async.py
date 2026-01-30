"""
Async version of archive manager for better performance.
This is an optional enhancement - the sync version still works.
"""
import json
import os
import csv
import aiofiles
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path


class AsyncArchiveManager:
    """
    Async archive manager with non-blocking file I/O.
    Use this for better performance in async applications.
    """
    
    def __init__(self, base_path: str = "archives"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)

    def create_run_directory(self, run_id: str) -> Path:
        """Create directory for a run (sync operation, fast enough)."""
        run_path = self.base_path / run_id
        run_path.mkdir(exist_ok=True)
        return run_path

    async def save_config(self, run_id: str, config: Dict[str, Any]) -> None:
        """Save run configuration asynchronously."""
        run_path = self.create_run_directory(run_id)
        config_path = run_path / "config.json"
        async with aiofiles.open(config_path, "w") as f:
            await f.write(json.dumps(config, indent=4))

    async def save_model_step(
        self, run_id: str, model_name: str, step_index: int, step_data: Dict[str, Any]
    ) -> None:
        """Save a step for a specific model asynchronously."""
        run_path = self.create_run_directory(run_id)
        # Sanitize model name for filesystem
        safe_model_name = model_name.replace("/", "_").replace(":", "_")
        model_path = run_path / f"model_{safe_model_name}"
        steps_path = model_path / "steps"
        steps_path.mkdir(parents=True, exist_ok=True)
        
        step_file = steps_path / f"step_{step_index:03d}.json"
        async with aiofiles.open(step_file, "w") as f:
            await f.write(json.dumps(step_data, indent=4))

    async def save_model_metrics(
        self, run_id: str, model_name: str, metrics: Dict[str, Any]
    ) -> None:
        """Save metrics for a specific model asynchronously."""
        run_path = self.create_run_directory(run_id)
        # Sanitize model name for filesystem
        safe_model_name = model_name.replace("/", "_").replace(":", "_")
        model_path = run_path / f"model_{safe_model_name}"
        model_path.mkdir(exist_ok=True)
        
        # Save metrics
        metrics_file = model_path / "metrics.json"
        async with aiofiles.open(metrics_file, "w") as f:
            await f.write(json.dumps(metrics, indent=4))
        
        # Also save path separately
        path_data = {"path": metrics.get("path", [])}
        path_file = model_path / "path.json"
        async with aiofiles.open(path_file, "w") as f:
            await f.write(json.dumps(path_data, indent=4))

    async def save_summary(self, run_id: str, summary: Dict[str, Any]) -> None:
        """Save summary of the entire run asynchronously."""
        run_path = self.create_run_directory(run_id)
        summary_file = run_path / "summary.json"
        async with aiofiles.open(summary_file, "w") as f:
            await f.write(json.dumps(summary, indent=4))

    def list_archives(self) -> List[Dict[str, Any]]:
        """List all archives (sync operation for simplicity)."""
        archives = []
        if not self.base_path.exists():
            return []
            
        for run_dir in self.base_path.iterdir():
            if run_dir.is_dir():
                config_path = run_dir / "config.json"
                if config_path.exists():
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    archives.append({
                        "run_id": run_dir.name,
                        "config": config,
                        "timestamp": datetime.fromtimestamp(config_path.stat().st_ctime).isoformat()
                    })
        return sorted(archives, key=lambda x: x["timestamp"], reverse=True)

    def get_archive_details(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get archive details (sync operation for simplicity)."""
        run_path = self.base_path / run_id
        if not run_path.is_dir():
            return None
            
        details = {}
        
        # Load config
        config_path = run_path / "config.json"
        if config_path.exists():
            with open(config_path, "r") as f:
                details["config"] = json.load(f)
        
        # Load summary
        summary_path = run_path / "summary.json"
        if summary_path.exists():
            with open(summary_path, "r") as f:
                details["summary"] = json.load(f)
        
        # Load per-model data
        details["models"] = {}
        for item in run_path.iterdir():
            if item.is_dir() and item.name.startswith("model_"):
                model_name = item.name.replace("model_", "").replace("_", "/", 1)
                
                model_data = {}
                
                # Load metrics
                metrics_path = item / "metrics.json"
                if metrics_path.exists():
                    with open(metrics_path, "r") as f:
                        model_data["metrics"] = json.load(f)
                
                # Load steps
                steps_path = item / "steps"
                steps = []
                if steps_path.exists():
                    for step_file in sorted(steps_path.iterdir()):
                        if step_file.suffix == ".json":
                            with open(step_file, "r") as f:
                                steps.append(json.load(f))
                model_data["steps"] = steps
                
                details["models"][model_name] = model_data
        
        return details
