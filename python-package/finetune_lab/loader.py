# Claude Training Loader - Config and Dataset Fetcher
# Date: 2025-10-16
# Purpose: Load training configs and datasets from public API

import os
import json
import requests
from typing import Dict, List, Any, Optional
from pathlib import Path

class TrainingLoader:
    """
    Load training configurations and datasets from Claude Desktop.

    Configuration:
        Set CLAUDE_TRAINING_API_URL environment variable to your deployed app URL.
        Example: export CLAUDE_TRAINING_API_URL=https://your-app.vercel.app

        Or pass base_url parameter when calling train functions:
        train_sft("config_id", base_url="https://your-app.vercel.app")
    """

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize loader with API base URL.

        Args:
            base_url: API base URL. Falls back to CLAUDE_TRAINING_API_URL env var.

        Raises:
            ValueError: If base_url is not provided and env var is not set.
        """
        self.base_url = base_url or os.getenv("CLAUDE_TRAINING_API_URL")

        if not self.base_url:
            raise ValueError(
                "API base URL not configured. "
                "Set CLAUDE_TRAINING_API_URL environment variable or "
                "pass base_url parameter when calling train functions."
            )

        print(f"[TrainingLoader] Initialized with base URL: {self.base_url}")

    def fetch_config(self, public_id: str) -> Dict[str, Any]:
        """Fetch training configuration from public API."""
        print(f"[TrainingLoader] Fetching config: {public_id}")

        url = f"{self.base_url}/api/training/public/{public_id}"

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()

            if "config" not in data:
                raise ValueError("Invalid response: missing config field")

            config = data["config"]
            print(f"[TrainingLoader] Config loaded: {config.get('name', 'unknown')}")
            return config

        except requests.exceptions.RequestException as e:
            print(f"[TrainingLoader] Error fetching config: {e}")
            raise RuntimeError(f"Failed to fetch config {public_id}: {e}")

    def fetch_datasets(self, public_id: str, output_dir: str = "./data") -> List[str]:
        """Fetch training datasets from public API."""
        print(f"[TrainingLoader] Fetching datasets for: {public_id}")

        url = f"{self.base_url}/api/training/public/{public_id}/dataset"

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()

            if "datasets" not in data:
                raise ValueError("Invalid response: missing datasets field")

            datasets = data["datasets"]
            print(f"[TrainingLoader] Found {len(datasets)} dataset(s)")

            Path(output_dir).mkdir(parents=True, exist_ok=True)
            downloaded_files = []

            for dataset in datasets:
                file_path = self._download_dataset(dataset, output_dir)
                downloaded_files.append(file_path)

            print(f"[TrainingLoader] Downloaded {len(downloaded_files)} file(s)")
            return downloaded_files

        except requests.exceptions.RequestException as e:
            print(f"[TrainingLoader] Error fetching datasets: {e}")
            raise RuntimeError(f"Failed to fetch datasets {public_id}: {e}")

    def _download_dataset(self, dataset: Dict[str, Any], output_dir: str) -> str:
        """Download a single dataset file from signed URL."""
        download_url = dataset.get("download_url")
        dataset_name = dataset.get("name", "dataset")
        dataset_id = dataset.get("id", "unknown")

        if not download_url:
            raise ValueError(f"Dataset {dataset_id} missing download_url")

        print(f"[TrainingLoader] Downloading: {dataset_name}")

        output_file = Path(output_dir) / f"{dataset_id}.jsonl"

        response = requests.get(download_url, timeout=120, stream=True)
        response.raise_for_status()

        with open(output_file, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"[TrainingLoader] Saved to: {output_file}")
        return str(output_file)

    def load_training_package(self, public_id: str, output_dir: str = "./data"):
        """Load complete training package (config + datasets)."""
        print(f"[TrainingLoader] Loading training package: {public_id}")

        config = self.fetch_config(public_id)
        dataset_files = self.fetch_datasets(public_id, output_dir)

        return {
            "config": config,
            "dataset_files": dataset_files,
            "public_id": public_id,
        }


print("[Loader] Training loader module loaded")
