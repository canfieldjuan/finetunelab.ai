"""
Configuration management for Training Agent
"""
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Backend Configuration
    backend_url: str = "http://localhost:3000"

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000

    # Paths
    models_dir: Path = Path("./models")
    datasets_dir: Path = Path("./datasets")
    checkpoints_dir: Path = Path("./checkpoints")
    logs_dir: Path = Path("./logs")

    # GPU Settings
    gpu_memory_fraction: float = 0.9
    enable_mixed_precision: bool = True

    # Training Settings
    max_concurrent_jobs: int = 1
    checkpoint_interval_steps: int = 500
    metrics_report_interval_steps: int = 10

    # Monitoring
    gpu_monitoring_interval_seconds: int = 5
    heartbeat_interval_seconds: int = 30

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create directories if they don't exist
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.datasets_dir.mkdir(parents=True, exist_ok=True)
        self.checkpoints_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
