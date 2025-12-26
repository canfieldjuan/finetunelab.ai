"""
Training job models and state management
"""
from enum import Enum
from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Training job status"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingMetrics(BaseModel):
    """Metrics collected during training"""
    step: int
    epoch: int
    train_loss: Optional[float] = None
    eval_loss: Optional[float] = None
    learning_rate: Optional[float] = None
    grad_norm: Optional[float] = None

    # GPU Metrics
    gpu_memory_allocated_gb: Optional[float] = None
    gpu_memory_reserved_gb: Optional[float] = None
    gpu_utilization_percent: Optional[float] = None

    # Performance Metrics
    samples_per_second: Optional[float] = None
    tokens_per_second: Optional[float] = None

    # Quality Metrics
    train_perplexity: Optional[float] = None
    eval_perplexity: Optional[float] = None

    timestamp: datetime = Field(default_factory=datetime.utcnow)


class TrainingConfig(BaseModel):
    """Training configuration matching backend schema"""
    model: Dict[str, Any]
    tokenizer: Dict[str, Any]
    training: Dict[str, Any]
    data: Dict[str, Any]
    provider: Optional[Dict[str, Any]] = None
    tools: Optional[List[Dict[str, Any]]] = None
    evaluation: Optional[Dict[str, Any]] = None
    tensorboard: Optional[Dict[str, Any]] = None
    predictions: Optional[Dict[str, Any]] = None
    seed: Optional[int] = None


class TrainingJobRequest(BaseModel):
    """Request to start a training job"""
    config: TrainingConfig
    dataset_path: str
    execution_id: str
    name: str
    user_id: str
    access_token: str
    job_token: Optional[str] = None  # Token for metrics reporting to backend


class TrainingJobStatus(BaseModel):
    """Current status of a training job"""
    job_id: str
    status: JobStatus

    # Progress
    current_step: int = 0
    current_epoch: int = 0
    total_steps: int = 0
    total_epochs: int = 0
    progress: float = 0.0  # 0-100

    # Latest metrics
    loss: Optional[float] = None
    eval_loss: Optional[float] = None
    learning_rate: Optional[float] = None

    # GPU metrics
    gpu_memory_allocated_gb: Optional[float] = None
    gpu_utilization_percent: Optional[float] = None

    # Timestamps
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Error info
    error: Optional[str] = None


class TrainingJobState(BaseModel):
    """Internal state of a training job"""
    job_id: str
    status: JobStatus
    config: TrainingConfig
    dataset_path: str
    user_id: str
    access_token: str
    job_token: Optional[str] = None

    # Process management
    process_id: Optional[int] = None
    pause_requested: bool = False
    cancel_requested: bool = False

    # Checkpoints
    checkpoint_path: Optional[str] = None
    resume_from_checkpoint: Optional[str] = None

    # Progress tracking
    current_step: int = 0
    current_epoch: int = 0
    total_steps: int = 0
    total_epochs: int = 0

    # Latest metrics
    latest_metrics: Optional[TrainingMetrics] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Error tracking
    error: Optional[str] = None
    error_traceback: Optional[str] = None

    # Logs
    logs: List[str] = Field(default_factory=list)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ControlCommand(BaseModel):
    """Command to control a training job"""
    action: str  # pause, resume, cancel
    checkpoint_path: Optional[str] = None
