import json
import os
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel

class ArchiveManager:
    def __init__(self, base_path: str = "archives"):
        self.base_path = base_path
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path)

    def create_run_directory(self, run_id: str) -> str:
        run_path = os.path.join(self.base_path, run_id)
        os.makedirs(run_path, exist_ok=True)
        return run_path

    def save_config(self, run_id: str, config: Dict[str, Any]):
        run_path = self.create_run_directory(run_id)
        with open(os.path.join(run_path, "config.json"), "w") as f:
            json.dump(config, f, indent=4)

    def save_step(self, run_id: str, step_index: int, step_data: Dict[str, Any]):
        """Legacy method for backward compatibility."""
        run_path = self.create_run_directory(run_id)
        steps_path = os.path.join(run_path, "steps")
        os.makedirs(steps_path, exist_ok=True)
        with open(os.path.join(steps_path, f"step_{step_index:03d}.json"), "w") as f:
            json.dump(step_data, f, indent=4)

    def save_model_step(self, run_id: str, model_name: str, step_index: int, step_data: Dict[str, Any]):
        """Save a step for a specific model."""
        run_path = self.create_run_directory(run_id)
        # Sanitize model name for filesystem
        safe_model_name = model_name.replace("/", "_").replace(":", "_")
        model_path = os.path.join(run_path, f"model_{safe_model_name}")
        steps_path = os.path.join(model_path, "steps")
        os.makedirs(steps_path, exist_ok=True)
        with open(os.path.join(steps_path, f"step_{step_index:03d}.json"), "w") as f:
            json.dump(step_data, f, indent=4)

    def save_model_metrics(self, run_id: str, model_name: str, metrics: Dict[str, Any]):
        """Save metrics for a specific model."""
        run_path = self.create_run_directory(run_id)
        # Sanitize model name for filesystem
        safe_model_name = model_name.replace("/", "_").replace(":", "_")
        model_path = os.path.join(run_path, f"model_{safe_model_name}")
        os.makedirs(model_path, exist_ok=True)
        
        with open(os.path.join(model_path, "metrics.json"), "w") as f:
            json.dump(metrics, f, indent=4)
        
        # Also save path separately
        path_data = {"path": metrics.get("path", [])}
        with open(os.path.join(model_path, "path.json"), "w") as f:
            json.dump(path_data, f, indent=4)

    def save_summary(self, run_id: str, summary: Dict[str, Any]):
        """Save summary of the entire run (all models)."""
        run_path = self.create_run_directory(run_id)
        with open(os.path.join(run_path, "summary.json"), "w") as f:
            json.dump(summary, f, indent=4)

    def save_final_metrics(self, run_id: str, metrics: Dict[str, Any]):
        """Legacy method for backward compatibility."""
        run_path = self.create_run_directory(run_id)
        with open(os.path.join(run_path, "metrics_finales.json"), "w") as f:
            json.dump(metrics, f, indent=4)
        
        # Save model path as requested in PLAN_BACKEND.md
        model_name = metrics.get("model", "unknown")
        path_data = {"path": metrics.get("path", [])}
        with open(os.path.join(run_path, f"model_{model_name}_path.json"), "w") as f:
            json.dump(path_data, f, indent=4)

        # Also save to a global CSV for easy comparison
        csv_path = os.path.join(self.base_path, "all_runs_metrics.csv")
        file_exists = os.path.isfile(csv_path)
        
        with open(csv_path, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["run_id", "timestamp"] + list(metrics.keys()))
            if not file_exists:
                writer.writeheader()
            row = {"run_id": run_id, "timestamp": datetime.now().isoformat()}
            row.update(metrics)
            writer.writerow(row)

    def list_archives(self) -> List[Dict[str, Any]]:
        archives = []
        if not os.path.exists(self.base_path):
            return []
            
        for run_id in os.listdir(self.base_path):
            run_path = os.path.join(self.base_path, run_id)
            if os.path.isdir(run_path):
                config_path = os.path.join(run_path, "config.json")
                if os.path.exists(config_path):
                    with open(config_path, "r") as f:
                        config = json.load(f)
                    archives.append({
                        "run_id": run_id,
                        "config": config,
                        "timestamp": datetime.fromtimestamp(os.path.getctime(config_path)).isoformat()
                    })
        return sorted(archives, key=lambda x: x["timestamp"], reverse=True)

    def get_archive_details(self, run_id: str) -> Optional[Dict[str, Any]]:
        run_path = os.path.join(self.base_path, run_id)
        if not os.path.isdir(run_path):
            return None
            
        details = {}
        
        # Load config
        config_path = os.path.join(run_path, "config.json")
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                details["config"] = json.load(f)
        
        # Load summary
        summary_path = os.path.join(run_path, "summary.json")
        if os.path.exists(summary_path):
            with open(summary_path, "r") as f:
                details["summary"] = json.load(f)
        
        # Load per-model data
        details["models"] = {}
        for item in os.listdir(run_path):
            item_path = os.path.join(run_path, item)
            if os.path.isdir(item_path) and item.startswith("model_"):
                model_name = item.replace("model_", "").replace("_", "/", 1)  # Restore model name
                
                model_data = {}
                
                # Load metrics
                metrics_path = os.path.join(item_path, "metrics.json")
                if os.path.exists(metrics_path):
                    with open(metrics_path, "r") as f:
                        model_data["metrics"] = json.load(f)
                
                # Load steps
                steps_path = os.path.join(item_path, "steps")
                steps = []
                if os.path.exists(steps_path):
                    for step_file in sorted(os.listdir(steps_path)):
                        if step_file.endswith(".json"):
                            with open(os.path.join(steps_path, step_file), "r") as f:
                                steps.append(json.load(f))
                model_data["steps"] = steps
                
                details["models"][model_name] = model_data
        
        # Legacy support: Load old format if no model directories found
        if not details["models"]:
            metrics_path = os.path.join(run_path, "metrics_finales.json")
            if os.path.exists(metrics_path):
                with open(metrics_path, "r") as f:
                    details["metrics"] = json.load(f)
                    
            steps_path = os.path.join(run_path, "steps")
            steps = []
            if os.path.exists(steps_path):
                for step_file in sorted(os.listdir(steps_path)):
                    if step_file.endswith(".json"):
                        with open(os.path.join(steps_path, step_file), "r") as f:
                            steps.append(json.load(f))
            details["steps"] = steps
        
        return details
