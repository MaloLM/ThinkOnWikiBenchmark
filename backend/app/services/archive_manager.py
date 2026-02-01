import json
import os
import csv
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class ArchiveManager:
    """
    Manages benchmark run archives with file-based storage.

    Note: For better async performance, consider using AsyncArchiveManager
    from archive_manager_async.py
    """

    def __init__(self, base_path: str = "archives"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)
        logger.info(
            f"Archive manager initialized with base path: {self.base_path}")

    def create_run_directory(self, run_id: str) -> Path:
        """
        Create directory for a benchmark run.

        Args:
            run_id: Unique run identifier

        Returns:
            Path object for the run directory
        """
        run_path = self.base_path / run_id
        run_path.mkdir(exist_ok=True)
        return run_path

    def save_config(self, run_id: str, config: Dict[str, Any]) -> None:
        """Save run configuration to disk."""
        run_path = self.create_run_directory(run_id)
        config_file = run_path / "config.json"
        try:
            with open(config_file, "w") as f:
                json.dump(config, f, indent=4)
            logger.debug(f"Saved config for run {run_id}")
        except Exception as e:
            logger.error(f"Failed to save config for run {run_id}: {e}")
            raise

    def save_step(self, run_id: str, step_index: int, step_data: Dict[str, Any]) -> None:
        """Legacy method for backward compatibility."""
        run_path = self.create_run_directory(run_id)
        steps_path = run_path / "steps"
        steps_path.mkdir(exist_ok=True)
        step_file = steps_path / f"step_{step_index:03d}.json"

        try:
            with open(step_file, "w") as f:
                json.dump(step_data, f, indent=4)
        except Exception as e:
            logger.error(
                f"Failed to save step {step_index} for run {run_id}: {e}")

    def save_model_step(
        self, run_id: str, model_name: str, step_index: int, step_data: Dict[str, Any], pair_idx: int = 0
    ) -> None:
        """
        Save a step for a specific model.

        Args:
            run_id: Unique run identifier
            model_name: Name of the model
            step_index: Step number
            step_data: Step data to save
            pair_idx: Index of the Wikipedia pair
        """
        run_path = self.create_run_directory(run_id)
        pair_path = run_path / f"pair_{pair_idx}"
        pair_path.mkdir(exist_ok=True)
        
        # Sanitize model name for filesystem
        safe_model_name = self._sanitize_model_name(model_name)
        model_path = pair_path / f"model_{safe_model_name}"
        steps_path = model_path / "steps"
        steps_path.mkdir(parents=True, exist_ok=True)

        step_file = steps_path / f"step_{step_index:03d}.json"
        try:
            with open(step_file, "w") as f:
                json.dump(step_data, f, indent=4)
        except Exception as e:
            logger.error(
                f"Failed to save step {step_index} for model {model_name}: {e}")

    def save_model_metrics(self, run_id: str, model_name: str, metrics: Dict[str, Any], pair_idx: int = 0) -> None:
        """
        Save metrics for a specific model.

        Args:
            run_id: Unique run identifier
            model_name: Name of the model
            metrics: Metrics dictionary to save
            pair_idx: Index of the Wikipedia pair
        """
        run_path = self.create_run_directory(run_id)
        pair_path = run_path / f"pair_{pair_idx}"
        pair_path.mkdir(exist_ok=True)
        
        # Sanitize model name for filesystem
        safe_model_name = self._sanitize_model_name(model_name)
        model_path = pair_path / f"model_{safe_model_name}"
        model_path.mkdir(exist_ok=True)

        try:
            # Save metrics
            metrics_file = model_path / "metrics.json"
            with open(metrics_file, "w") as f:
                json.dump(metrics, f, indent=4)

            # Also save path separately
            path_data = {"path": metrics.get("path", [])}
            path_file = model_path / "path.json"
            with open(path_file, "w") as f:
                json.dump(path_data, f, indent=4)

            logger.debug(
                f"Saved metrics for model {model_name} in run {run_id}")
        except Exception as e:
            logger.error(f"Failed to save metrics for model {model_name}: {e}")

    def save_summary(self, run_id: str, summary: Dict[str, Any]) -> None:
        """
        Save summary of the entire run (all models).

        Args:
            run_id: Unique run identifier
            summary: Summary dictionary to save
        """
        run_path = self.create_run_directory(run_id)
        summary_file = run_path / "summary.json"
        try:
            with open(summary_file, "w") as f:
                json.dump(summary, f, indent=4)
            logger.info(f"Saved summary for run {run_id}")
        except Exception as e:
            logger.error(f"Failed to save summary for run {run_id}: {e}")

    def save_final_metrics(self, run_id: str, metrics: Dict[str, Any]) -> None:
        """
        Legacy method for backward compatibility.

        Args:
            run_id: Unique run identifier
            metrics: Metrics dictionary to save
        """
        run_path = self.create_run_directory(run_id)

        try:
            # Save final metrics
            metrics_file = run_path / "metrics_finales.json"
            with open(metrics_file, "w") as f:
                json.dump(metrics, f, indent=4)

            # Save model path
            model_name = metrics.get("model", "unknown")
            path_data = {"path": metrics.get("path", [])}
            path_file = run_path / f"model_{model_name}_path.json"
            with open(path_file, "w") as f:
                json.dump(path_data, f, indent=4)

            # Also save to a global CSV for easy comparison
            csv_path = self.base_path / "all_runs_metrics.csv"
            file_exists = csv_path.exists()

            with open(csv_path, "a", newline="") as f:
                writer = csv.DictWriter(
                    f, fieldnames=["run_id", "timestamp"] + list(metrics.keys()))
                if not file_exists:
                    writer.writeheader()
                row = {"run_id": run_id, "timestamp": datetime.now().isoformat()}
                row.update(metrics)
                writer.writerow(row)

            logger.debug(f"Saved final metrics for run {run_id}")
        except Exception as e:
            logger.error(f"Failed to save final metrics for run {run_id}: {e}")

    def list_archives(self) -> List[Dict[str, Any]]:
        """
        List all archived benchmark runs.

        Returns:
            List of archive metadata dictionaries
        """
        archives = []
        if not self.base_path.exists():
            return []

        try:
            for run_dir in self.base_path.iterdir():
                if run_dir.is_dir():
                    config_path = run_dir / "config.json"
                    if config_path.exists():
                        try:
                            with open(config_path, "r") as f:
                                config = json.load(f)
                            archives.append({
                                "run_id": run_dir.name,
                                "config": config,
                                "timestamp": datetime.fromtimestamp(config_path.stat().st_ctime).isoformat()
                            })
                        except Exception as e:
                            logger.warning(
                                f"Failed to load archive {run_dir.name}: {e}")
        except Exception as e:
            logger.error(f"Failed to list archives: {e}")

        return sorted(archives, key=lambda x: x["timestamp"], reverse=True)

    def get_archive_details(self, run_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific archive.

        Args:
            run_id: Unique run identifier

        Returns:
            Dictionary with archive details or None if not found
        """
        run_path = self.base_path / run_id
        if not run_path.is_dir():
            return None

        details = {}

        try:
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

            # Load per-pair and per-model data
            details["pairs"] = {}
            
            # Check for pair directories
            pair_dirs = sorted([d for d in run_path.iterdir() if d.is_dir() and d.name.startswith("pair_")])
            
            if pair_dirs:
                for pair_dir in pair_dirs:
                    pair_idx = int(pair_dir.name.replace("pair_", ""))
                    pair_data = {"models": {}}
                    
                    for item in pair_dir.iterdir():
                        if item.is_dir() and item.name.startswith("model_"):
                            model_name = item.name.replace("model_", "").replace("_", "/", 1)
                            model_data = self._load_model_data(item)
                            pair_data["models"][model_name] = model_data
                    
                    details["pairs"][pair_idx] = pair_data
                
                # For backward compatibility with frontend that expects details["models"]
                # we provide the first pair's models at the top level
                if 0 in details["pairs"]:
                    details["models"] = details["pairs"][0]["models"]
            else:
                # Legacy support: Load old format (models at root of run_id)
                details["models"] = {}
                for item in run_path.iterdir():
                    if item.is_dir() and item.name.startswith("model_"):
                        model_name = item.name.replace("model_", "").replace("_", "/", 1)
                        details["models"][model_name] = self._load_model_data(item)
                
                # If we found legacy models, wrap them in pair 0
                if details["models"]:
                    details["pairs"][0] = {"models": details["models"]}

            # Legacy support: Load old format if no model directories found
            if not details.get("models") and not details.get("pairs"):
                metrics_path = run_path / "metrics_finales.json"
                if metrics_path.exists():
                    with open(metrics_path, "r") as f:
                        details["metrics"] = json.load(f)

                steps_path = run_path / "steps"
                steps = []
                if steps_path.exists():
                    for step_file in sorted(steps_path.iterdir()):
                        if step_file.suffix == ".json":
                            with open(step_file, "r") as f:
                                steps.append(json.load(f))
                details["steps"] = steps

            return details
        except Exception as e:
            logger.error(
                f"Failed to get archive details for run {run_id}: {e}")
            return None

    def _load_model_data(self, model_path: Path) -> Dict[str, Any]:
        """Helper to load metrics and steps for a model."""
        model_data = {}
        
        # Load metrics
        metrics_path = model_path / "metrics.json"
        if metrics_path.exists():
            with open(metrics_path, "r") as f:
                model_data["metrics"] = json.load(f)

        # Load steps
        steps_path = model_path / "steps"
        steps = []
        if steps_path.exists():
            for step_file in sorted(steps_path.iterdir()):
                if step_file.suffix == ".json":
                    with open(step_file, "r") as f:
                        steps.append(json.load(f))
        model_data["steps"] = steps
        
        return model_data

    @staticmethod
    def _sanitize_model_name(model_name: str) -> str:
        """
        Sanitize model name for use in filesystem paths.

        Args:
            model_name: Original model name

        Returns:
            Sanitized model name safe for filesystem
        """
        return model_name.replace("/", "_").replace(":", "_").replace("\\", "_")
