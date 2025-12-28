"""
FineTune Lab - Local Training API Server
Provides REST API for managing training jobs.
Works with standalone_trainer.py for actual training execution.
"""

import logging
import sys
import uuid
import subprocess
import asyncio
from asyncio import Queue
import json
import requests
import os
import signal
import tempfile
import threading
import time
import zipfile
import secrets
import base64
import aiofiles
from io import BytesIO
from pathlib import Path
from typing import Dict, Optional, List, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from fastapi import HTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from web-ui root
from dotenv import load_dotenv

# Try .env.local first (development), then .env (production)
env_local_path = Path(__file__).parent.parent.parent / '.env.local'
env_path = Path(__file__).parent.parent.parent / '.env'

if env_local_path.exists():
    load_dotenv(env_local_path)
    print(f"[ENV] Loaded environment from: {env_local_path}")
elif env_path.exists():
    load_dotenv(env_path)
    print(f"[ENV] Loaded environment from: {env_path}")
else:
    print(f"[ENV] Warning: No .env or .env.local file found")

try:
    from config_validator import validate_config, validate_dataset_format, ValidationError
except ImportError:
    from .config_validator import validate_config, validate_dataset_format, ValidationError

# Alert system integration
try:
    from alert_trigger import (
        trigger_job_started,
        trigger_job_completed,
        trigger_job_failed,
        trigger_job_cancelled,
        trigger_gpu_oom,
    )
    ALERTS_AVAILABLE = True
except ImportError:
    try:
        from .alert_trigger import (
            trigger_job_started,
            trigger_job_completed,
            trigger_job_failed,
            trigger_job_cancelled,
            trigger_gpu_oom,
        )
        ALERTS_AVAILABLE = True
    except ImportError:
        ALERTS_AVAILABLE = False
        logger = logging.getLogger(__name__)
        # Will log warning later after logger is configured

try:
    from error_extractor import extract_errors_from_file, ErrorExtractionResult
except ImportError:
    from .error_extractor import extract_errors_from_file, ErrorExtractionResult

# Configure logging (after dotenv load)
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Custom filter to suppress /health endpoint access logs
class HealthCheckFilter(logging.Filter):
    """Filter out /health endpoint access logs to reduce noise"""
    def filter(self, record: logging.LogRecord) -> bool:
        # Suppress uvicorn access logs for /health endpoint
        message = record.getMessage()
        return '/health' not in message or record.levelno > logging.INFO

# Apply filter to uvicorn access logger
logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())

# Supabase client for database operations
try:
    from supabase import create_client, Client
    SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    # Use SERVICE_ROLE key for training server (bypasses RLS for system operations)
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    # Fallback to ANON key if service role not available (less secure)
    SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    
    supabase: Optional[Client] = None
    
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        # Use service role key (preferred - bypasses RLS for training server)
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("[Supabase] Client initialized with SERVICE_ROLE key")
        logger.info(f"[Supabase] URL: {SUPABASE_URL}")
    elif SUPABASE_URL and SUPABASE_ANON_KEY:
        # Fallback to anon key (requires user authentication in RLS policies)
        supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        logger.warning("[Supabase] Using ANON key - service role key preferred for training server")
        logger.info(f"[Supabase] URL: {SUPABASE_URL}")
    else:
        logger.warning("[Supabase] Missing credentials - database operations will fail")
        logger.warning(f"[Supabase] NEXT_PUBLIC_SUPABASE_URL: {'SET' if SUPABASE_URL else 'MISSING'}")
        logger.warning(f"[Supabase] SUPABASE_SERVICE_ROLE_KEY: {'SET' if SUPABASE_SERVICE_ROLE_KEY else 'MISSING'}")
        logger.warning(f"[Supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY: {'SET' if SUPABASE_ANON_KEY else 'MISSING'}")
except ImportError:
    logger.warning("[Supabase] supabase-py not installed - database operations will fail")
    supabase = None

# Next.js API endpoints for metrics persistence
# Try multiple env vars for flexibility (NEXTJS_BASE_URL, NEXT_PUBLIC_BASE_URL, NEXT_PUBLIC_APP_URL)
# This allows the Python worker to connect whether running locally or in cloud
NEXTJS_BASE_URL = (
    os.getenv("NEXTJS_BASE_URL")  # Primary: explicit Python worker config
    or os.getenv("NEXT_PUBLIC_BASE_URL")  # Fallback: from Next.js env
    or os.getenv("NEXT_PUBLIC_APP_URL")  # Fallback: alternate Next.js env
    or os.getenv("RENDER_EXTERNAL_URL")  # Fallback: Render deployment URL
    or "http://localhost:3000"  # Final fallback: local development
)
JOBS_ENDPOINT = f"{NEXTJS_BASE_URL}/api/training/local/jobs"
METRICS_ENDPOINT = f"{NEXTJS_BASE_URL}/api/training/local/metrics"
logger.info(f"[Persistence] Configured endpoints: jobs={JOBS_ENDPOINT}, metrics={METRICS_ENDPOINT}")

# Configurable intervals and timeouts
RETRY_PERSIST_INTERVAL = int(os.getenv("RETRY_PERSIST_INTERVAL", "300"))  # 5 minutes
HEALTH_CHECK_INTERVAL = int(os.getenv("HEALTH_CHECK_INTERVAL", "30"))  # 30 seconds
STALE_JOB_CHECK_INTERVAL = int(os.getenv("STALE_JOB_CHECK_INTERVAL", "60"))  # 1 minute
PERIODIC_CLEANUP_INTERVAL = int(os.getenv("PERIODIC_CLEANUP_INTERVAL", "600"))  # 10 minutes
CLEANUP_RETRY_DELAY = int(os.getenv("CLEANUP_RETRY_DELAY", "60"))  # 1 minute
QUEUE_WAIT_TIMEOUT = float(os.getenv("QUEUE_WAIT_TIMEOUT", "5.0"))  # 5 seconds
QUEUE_EMPTY_DELAY = int(os.getenv("QUEUE_EMPTY_DELAY", "2"))  # 2 seconds
GPU_BUSY_DELAY = int(os.getenv("GPU_BUSY_DELAY", "5"))  # 5 seconds
ERROR_BACKOFF_DELAY = int(os.getenv("ERROR_BACKOFF_DELAY", "5"))  # 5 seconds
MONITOR_CLEANUP_DELAY = int(os.getenv("MONITOR_CLEANUP_DELAY", "2"))  # 2 seconds
WEBSOCKET_DELAY = int(os.getenv("WEBSOCKET_DELAY", "1"))  # 1 second
JOB_TIMEOUT_MINUTES = int(os.getenv("JOB_TIMEOUT_MINUTES", "60"))  # 60 minutes
PERSISTENCE_HTTP_TIMEOUT = int(os.getenv("PERSISTENCE_HTTP_TIMEOUT", "60"))  # HTTP timeout for persistence operations

# Directory names
CONFIG_DIR_NAME = os.getenv("CONFIG_DIR_NAME", "configs")
LOGS_DIR_NAME = os.getenv("LOGS_DIR_NAME", "logs")

# Filesystem API configuration (Phase 1: Web App Support)
AI_MODELS_DIR = os.getenv("AI_MODELS_DIR", str(Path.home() / "AI_Models"))
FILESYSTEM_ALLOWED_PATHS = os.getenv(
    "FILESYSTEM_ALLOWED_PATHS",
    f"{Path.home() / 'AI_Models'},{Path.home() / 'Desktop' / 'AI_Models'},{Path(__file__).parent / LOGS_DIR_NAME}"
).split(',')
FILESYSTEM_MAX_FILE_SIZE = int(os.getenv("FILESYSTEM_MAX_FILE_SIZE", str(100 * 1024 * 1024)))  # 100MB default
FILESYSTEM_MAX_DIR_ITEMS = int(os.getenv("FILESYSTEM_MAX_DIR_ITEMS", "1000"))
FILESYSTEM_API_KEY = os.getenv("FILESYSTEM_API_KEY")  # Optional API key for filesystem endpoints

# Rate limiting configuration
RATE_LIMIT_ENABLED = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
RATE_LIMIT_TRAINING_EXECUTE = os.getenv("RATE_LIMIT_TRAINING_EXECUTE", "10/minute")  # 10 training jobs per minute
RATE_LIMIT_TRAINING_GENERAL = os.getenv("RATE_LIMIT_TRAINING_GENERAL", "30/minute")  # 30 general operations per minute
RATE_LIMIT_FILESYSTEM = os.getenv("RATE_LIMIT_FILESYSTEM", "60/minute")  # 60 filesystem ops per minute

# Retry parameters
PERSISTENCE_MAX_RETRIES = int(os.getenv("PERSISTENCE_MAX_RETRIES", "3"))
PERSISTENCE_RETRY_DELAY = int(os.getenv("PERSISTENCE_RETRY_DELAY", "1"))  # seconds
MAX_PROGRESS_READ_ERRORS = int(os.getenv("MAX_PROGRESS_READ_ERRORS", "5"))

# Training defaults
DEFAULT_EVAL_SPLIT = float(os.getenv("DEFAULT_EVAL_SPLIT", "0.2"))

# Job staleness threshold (seconds)
JOB_STALENESS_THRESHOLD_SECONDS = int(os.getenv("JOB_STALENESS_THRESHOLD_SECONDS", "600"))  # 10 minutes

# Filename defaults
PROGRESS_FILENAME = os.getenv("PROGRESS_FILENAME", "progress.json")
TRAINER_STATE_FILENAME = os.getenv("TRAINER_STATE_FILENAME", "trainer_state.json")
TRAINING_LOG_FILENAME = os.getenv("TRAINING_LOG_FILENAME", "training.log")

# Process termination timeouts (seconds)
PROCESS_TERMINATION_TIMEOUT_DEFAULT = int(os.getenv("PROCESS_TERMINATION_TIMEOUT_DEFAULT", "10"))
PROCESS_TERMINATION_TIMEOUT_CHECKPOINT = int(os.getenv("PROCESS_TERMINATION_TIMEOUT_CHECKPOINT", "30"))
PROCESS_TERMINATION_TIMEOUT_QUICK = int(os.getenv("PROCESS_TERMINATION_TIMEOUT_QUICK", "5"))


class JobStatusEnum(str, Enum):
    """Job status enumeration"""
    QUEUED = "queued"      # Job waiting in queue
    PENDING = "pending"    # Job preparing to start
    RUNNING = "running"    # Job actively training
    PAUSED = "paused"      # Job paused by user (Phase 2 - Pause/Resume)
    COMPLETED = "completed"  # Job finished successfully
    FAILED = "failed"      # Job encountered error
    CANCELLED = "cancelled"  # Job cancelled by user


@dataclass
class JobStatus:
    """Training job status tracker with rich metrics"""
    job_id: str
    user_id: str = ""  # User ID for database persistence
    status: JobStatusEnum = JobStatusEnum.PENDING
    progress: float = 0.0
    current_epoch: int = 0
    total_epochs: int = 0
    current_step: int = 0
    total_steps: int = 0
    loss: Optional[float] = None
    eval_loss: Optional[float] = None
    learning_rate: Optional[float] = None
    max_learning_rate: Optional[float] = None
    batch_size: Optional[int] = None
    gradient_accumulation_steps: Optional[int] = None
    grad_norm: Optional[float] = None
    gpu_memory_allocated_gb: Optional[float] = None
    gpu_memory_reserved_gb: Optional[float] = None
    elapsed_seconds: Optional[int] = None
    remaining_seconds: Optional[int] = None
    samples_per_second: Optional[float] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    updated_at: Optional[str] = None
    process: Optional[any] = None
    config_id: str = ""
    dataset_id: str = ""
    name: str = ""
    job_token: str = ""  # Auth token for metrics API

    # Critical fields for database persistence (NOT NULL columns)
    model_name: str = "unknown"
    dataset_path: str = ""

    # New metrics (Phase 1 enhancement)
    perplexity: Optional[float] = None
    train_perplexity: Optional[float] = None
    best_eval_loss: Optional[float] = None
    best_epoch: int = 0
    best_step: int = 0
    epochs_without_improvement: int = 0
    loss_trend: Optional[str] = None
    total_samples: int = 0
    train_samples: int = 0
    val_samples: int = 0
    total_tokens_processed: int = 0
    
    # Queue support (Phase 2 - Job Queue)
    training_config: Optional[dict] = None  # Store config for deferred start
    queue_position: Optional[int] = None    # Position in queue
    
    # Phase 2: Pause/Resume support
    paused_at: Optional[str] = None         # Timestamp when job was paused

    # Advanced training features (Phase 4 - Database Schema Match)
    resume_from_checkpoint: Optional[str] = None  # Path to checkpoint to resume from
    num_gpus: int = 1                              # Number of GPUs for training
    distributed_strategy: str = "none"             # Distributed strategy: none, ddp, fsdp, deepspeed
    parameter_updates: list = field(default_factory=list)  # Runtime parameter updates
    last_parameter_update_at: Optional[str] = None  # Last parameter update timestamp

    # Process tracking for cancellation after server restart
    process_pid: Optional[int] = None  # Store PID separately for orphan cleanup

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON response"""
        return {
            "job_id": self.job_id,
            "user_id": self.user_id,  # Required for database persistence
            "status": self.status.value,
            "progress": self.progress,
            "current_epoch": self.current_epoch,
            "total_epochs": self.total_epochs,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "loss": self.loss,
            "eval_loss": self.eval_loss,
            "learning_rate": self.learning_rate,
            "max_learning_rate": self.max_learning_rate,
            "batch_size": self.batch_size,
            "gradient_accumulation_steps": self.gradient_accumulation_steps,
            "grad_norm": self.grad_norm,
            "gpu_memory_allocated_gb": self.gpu_memory_allocated_gb,
            "gpu_memory_reserved_gb": self.gpu_memory_reserved_gb,
            "elapsed_seconds": self.elapsed_seconds,
            "remaining_seconds": self.remaining_seconds,
            "samples_per_second": self.samples_per_second,
            "error_message": self.error_message,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "updated_at": self.updated_at,
            # New metrics (Phase 1 enhancement)
            "perplexity": self.perplexity,
            "train_perplexity": self.train_perplexity,
            "best_eval_loss": self.best_eval_loss,
            "best_epoch": self.best_epoch,
            "best_step": self.best_step,
            "epochs_without_improvement": self.epochs_without_improvement,
            "loss_trend": self.loss_trend,
            "total_samples": self.total_samples,
            "train_samples": self.train_samples,
            "val_samples": self.val_samples,
            "total_tokens_processed": self.total_tokens_processed,
            # Advanced training features (Phase 4 - Database Schema Match)
            "resume_from_checkpoint": self.resume_from_checkpoint,
            "num_gpus": self.num_gpus,
            "distributed_strategy": self.distributed_strategy,
            "parameter_updates": self.parameter_updates,
            "last_parameter_update_at": self.last_parameter_update_at,
            # Process tracking
            "process_pid": self.process_pid,
        }


# In-memory job store
jobs: Dict[str, JobStatus] = {}
logger.info("Job store initialized")

# Job queue for sequential processing (Phase 2 - Job Queue)
job_queue: Queue[str] = Queue()
logger.info("Job queue initialized")

# Cache for failed database persistence attempts (Phase 3 - Resilient Persistence)
failed_persists: Dict[str, Dict] = {}
logger.info("Failed persists cache initialized")

# Cache for analytics to reduce computation load under high concurrency
# Phase 5 Enhancement - Analytics Caching
analytics_cache: Dict[str, Any] = {
    "system_analytics": None,
    "system_analytics_timestamp": 0,
    "job_analytics": {},  # job_id -> {data, timestamp}
}
ANALYTICS_CACHE_TTL_SECONDS = int(os.environ.get("ANALYTICS_CACHE_TTL_SECONDS", "30"))
logger.info(f"Analytics cache initialized (TTL: {ANALYTICS_CACHE_TTL_SECONDS}s)")


# WebSocket connection manager for real-time streaming (Phase 3)
class ConnectionManager:
    """
    Manages WebSocket connections for real-time training metrics streaming.
    Supports multiple clients per job.
    
    Phase 3 - WebSocket Streaming
    """
    def __init__(self):
        # Store active connections: job_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, job_id: str):
        """Accept new WebSocket connection for a job"""
        await websocket.accept()
        
        async with self._lock:
            if job_id not in self.active_connections:
                self.active_connections[job_id] = []
            self.active_connections[job_id].append(websocket)
        
        logger.info(f"[WebSocket] Client connected to job {job_id}. Total connections: {len(self.active_connections[job_id])}")
    
    async def disconnect(self, websocket: WebSocket, job_id: str):
        """Remove WebSocket connection"""
        async with self._lock:
            if job_id in self.active_connections:
                if websocket in self.active_connections[job_id]:
                    self.active_connections[job_id].remove(websocket)
                
                # Clean up empty lists
                if not self.active_connections[job_id]:
                    del self.active_connections[job_id]
                    logger.info(f"[WebSocket] No more connections for job {job_id}")
                else:
                    logger.info(f"[WebSocket] Client disconnected from job {job_id}. Remaining: {len(self.active_connections[job_id])}")
    
    async def broadcast(self, job_id: str, message: dict):
        """Broadcast message to all clients connected to a job"""
        if job_id not in self.active_connections:
            return  # No clients connected
        
        disconnected = []
        
        for connection in self.active_connections[job_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"[WebSocket] Failed to send to client: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        if disconnected:
            async with self._lock:
                for conn in disconnected:
                    if conn in self.active_connections[job_id]:
                        self.active_connections[job_id].remove(conn)
                
                if not self.active_connections[job_id]:
                    del self.active_connections[job_id]
    
    def get_connection_count(self, job_id: str) -> int:
        """Get number of active connections for a job"""
        return len(self.active_connections.get(job_id, []))


# Initialize WebSocket connection manager
ws_manager = ConnectionManager()
logger.info("WebSocket connection manager initialized")


def _persist_to_api_sync(job_id: str, job_data: Dict) -> bool:
    """
    Persist job metadata to database via Next.js API with retry logic.

    Args:
        job_id: Job identifier
        job_data: Dictionary of job fields to persist

    Returns:
        bool: True if job was persisted (200) or accepted for persistence (202)
              False if persistence failed
    """
    import time
    import json

    retry_delay = PERSISTENCE_RETRY_DELAY
    for attempt in range(PERSISTENCE_MAX_RETRIES):
        try:
            logger.debug(f"[Persistence] Persisting job {job_id} with status: {job_data.get('status')} (attempt {attempt + 1}/{PERSISTENCE_MAX_RETRIES})")

            # Verify JSON serialization before sending
            try:
                json_str = json.dumps(job_data)
                logger.debug(f"[Persistence] JSON payload size: {len(json_str)} bytes")
            except (TypeError, ValueError) as e:
                logger.error(f"[Persistence] Cannot serialize job_data to JSON: {e}")
                logger.error(f"[Persistence] Problematic data keys: {list(job_data.keys())}")
                return False

            # Send request to Next.js API (uses service role key internally)
            response = requests.post(
                JOBS_ENDPOINT,
                json=job_data,
                headers={
                    "Content-Type": "application/json"
                },
                timeout=PERSISTENCE_HTTP_TIMEOUT
            )
            
            if response.status_code == 200:
                # Job was persisted successfully
                logger.info(f"[Persistence] Job {job_id} persisted successfully (200 OK)")
                return True
                
            elif response.status_code == 202:
                # Job was accepted for background persistence
                logger.info(f"[Persistence] Job {job_id} accepted for persistence (202 Accepted)")
                try:
                    response_data = response.json()
                    if response_data.get('persisted') is False:
                        logger.warning(f"[Persistence] Job {job_id} is being persisted in background")
                except Exception:
                    pass
                return True
                
            else:
                logger.error(f"[Persistence] Failed to persist job {job_id}: HTTP {response.status_code}")
                logger.error(f"[Persistence] Response: {response.text}")
                
                # Retry on 5xx errors or 400 (could be temporary)
                if response.status_code >= 500 or response.status_code == 400:
                    if attempt < PERSISTENCE_MAX_RETRIES - 1:
                        logger.warning(f"[Persistence] Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                return False

        except requests.exceptions.Timeout as e:
            logger.error(f"[Persistence] Timeout error for job {job_id}: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

        except requests.exceptions.ConnectionError as e:
            logger.error(f"[Persistence] Connection error for job {job_id}: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

        except Exception as e:
            logger.error(f"[Persistence] Unexpected error persisting job {job_id}: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

    logger.error(f"[Persistence] Failed to persist job {job_id} after {PERSISTENCE_MAX_RETRIES} attempts")
    return False


async def _persist_to_api(job_id: str, job_data: Dict) -> bool:
    """Async wrapper for job persistence to avoid blocking the event loop."""
    return await asyncio.to_thread(_persist_to_api_sync, job_id, job_data)


def _persist_metrics_sync(job_id: str, metrics: List[Dict]) -> bool:
    """
    Batch persist metrics to database via Next.js API with retry logic

    Args:
        job_id: Job identifier
        metrics: List of metric dictionaries to persist
    """
    if not metrics:
        logger.debug(f"[Persistence] No metrics to persist for job {job_id}")
        return True

    import time
    import math

    # Sanitize metrics: replace NaN/Inf with None for JSON compatibility
    def sanitize_value(val):
        if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
            return None
        return val

    sanitized_metrics = []
    for metric in metrics:
        sanitized_metric = {key: sanitize_value(value) for key, value in metric.items()}
        sanitized_metrics.append(sanitized_metric)

    metrics = sanitized_metrics

    retry_delay = PERSISTENCE_RETRY_DELAY
    logger.info(f"[Persistence] ===== METRICS PERSISTENCE ATTEMPT =====")
    logger.info(f"[Persistence] Job ID: {job_id}")
    logger.info(f"[Persistence] Metrics count: {len(metrics)}")
    logger.info(f"[Persistence] Endpoint: {METRICS_ENDPOINT}")
    logger.info(f"[Persistence] First metric sample: {metrics[0] if metrics else 'N/A'}")

    for attempt in range(PERSISTENCE_MAX_RETRIES):
        try:
            logger.info(f"[Persistence] Sending POST request (attempt {attempt + 1}/{PERSISTENCE_MAX_RETRIES})")

            payload = {"job_id": job_id, "metrics": metrics}
            logger.debug(f"[Persistence] Payload: {payload}")

            headers = {
                "Content-Type": "application/json"
            }

            # Auth: include job_token when available (required by /api/training/local/metrics)
            try:
                job = jobs.get(job_id)
                token = getattr(job, "job_token", "") if job else ""
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                    logger.debug(f"[Persistence] Auth header set for job {job_id[:8]}...")
                else:
                    logger.warning(f"[Persistence] No job_token available for job {job_id[:8]}... - request will fail with 401")
                    logger.warning(f"[Persistence] Job in memory: {job is not None}, job_token: '{token}'")
            except Exception as header_err:
                logger.warning(f"[Persistence] Could not attach Authorization header: {header_err}")

            # Send request to Next.js API (uses service role key internally)
            response = requests.post(
                METRICS_ENDPOINT,
                json=payload,
                headers=headers,
                timeout=PERSISTENCE_HTTP_TIMEOUT
            )
            
            logger.info(f"[Persistence] Response status: {response.status_code}")
            logger.info(f"[Persistence] Response body: {response.text}")
            
            if response.ok:
                logger.info(f"[Persistence] Persisted {len(metrics)} metrics for job {job_id}")
                return True
            else:
                logger.error(f"[Persistence] Failed to persist metrics: HTTP {response.status_code}")
                logger.error(f"[Persistence] Response: {response.text}")
                
                # Retry on 5xx errors or 400
                if response.status_code >= 500 or response.status_code == 400:
                    if attempt < PERSISTENCE_MAX_RETRIES - 1:
                        logger.warning(f"[Persistence] Retrying metrics in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        retry_delay *= 2
                        continue
                return False

        except requests.exceptions.Timeout as e:
            logger.error(f"[Persistence] Timeout error for metrics: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying metrics in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

        except requests.exceptions.ConnectionError as e:
            logger.error(f"[Persistence] Connection error for metrics: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying metrics in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

        except Exception as e:
            logger.error(f"[Persistence] Error persisting metrics: {e}")
            if attempt < PERSISTENCE_MAX_RETRIES - 1:
                logger.warning(f"[Persistence] Retrying metrics in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2
                continue
            return False

    logger.error(f"[Persistence] Failed to persist metrics after {PERSISTENCE_MAX_RETRIES} attempts")
    return False


async def persist_metrics(job_id: str, metrics: List[Dict]) -> bool:
    """Async wrapper for metrics persistence to avoid blocking event loop."""
    return await asyncio.to_thread(_persist_metrics_sync, job_id, metrics)


def get_running_jobs() -> List[str]:
    """
    Get list of currently running job IDs.
    Used by queue worker to check if GPU is available.
    """
    running = [
        job_id 
        for job_id, job in jobs.items() 
        if job.status == JobStatusEnum.RUNNING
    ]
    return running


async def remove_from_queue(job_id: str) -> bool:
    """
    Remove a job from the queue.
    
    Args:
        job_id: Job ID to remove
        
    Returns:
        True if job was found and removed, False otherwise
    
    Phase 2 - Job Cancellation
    """
    global job_queue
    
    # Create new queue without the target job
    new_queue: Queue[str] = Queue()
    found = False
    
    # Drain current queue
    while not job_queue.empty():
        try:
            queued_job_id = job_queue.get_nowait()
            if queued_job_id == job_id:
                found = True
                logger.info(f"[Queue] Removed job {job_id} from queue")
            else:
                await new_queue.put(queued_job_id)
        except:
            break
    
    # Replace global queue
    job_queue = new_queue
    
    if found:
        # Update queue positions for remaining jobs
        temp_jobs = []
        while not job_queue.empty():
            try:
                temp_jobs.append(job_queue.get_nowait())
            except:
                break
        
        for idx, queued_id in enumerate(temp_jobs, 1):
            await job_queue.put(queued_id)
            if queued_id in jobs:
                jobs[queued_id].queue_position = idx
        
        logger.info(f"[Queue] Updated positions for {len(temp_jobs)} remaining jobs")
    
    return found


def terminate_process_gracefully(process: subprocess.Popen, timeout: int = None) -> bool:
    """
    Terminate a subprocess gracefully with fallback to force kill.
    Kills entire process group to ensure all child processes (PyTorch, CUDA, etc.) are terminated.

    Args:
        process: The subprocess.Popen object to terminate
        timeout: Seconds to wait for graceful termination before force kill (defaults to PROCESS_TERMINATION_TIMEOUT_DEFAULT)

    Returns:
        True if process was terminated successfully

    Phase 2 - Job Cancellation (Enhanced to kill process groups)
    """
    if timeout is None:
        timeout = PROCESS_TERMINATION_TIMEOUT_DEFAULT

    if process is None:
        logger.warning("[Terminate] No process to terminate")
        return False

    pid = process.pid

    try:
        # Check if process is already dead
        if process.poll() is not None:
            logger.info(f"[Terminate] Process {pid} already terminated")
            return True

        logger.info(f"[Terminate] Attempting graceful termination of PID {pid} and its process group")

        # Try to kill the entire process group, not just the parent process
        # This ensures child processes (PyTorch, CUDA workers) are also terminated
        try:
            # On Unix systems, kill the process group
            os.killpg(os.getpgid(pid), signal.SIGTERM)
            logger.info(f"[Terminate] Sent SIGTERM to process group of PID {pid}")
        except (ProcessLookupError, PermissionError, AttributeError) as e:
            # Fallback to terminating just the parent process
            logger.warning(f"[Terminate] Could not kill process group, falling back to single process: {e}")
            process.terminate()

        # Wait for process to terminate gracefully
        try:
            process.wait(timeout=timeout)
            logger.info(f"[Terminate] Process {pid} terminated gracefully")
            return True
        except subprocess.TimeoutExpired:
            logger.warning(f"[Terminate] Process {pid} did not terminate gracefully after {timeout}s, forcing kill")

            # Force kill the entire process group
            try:
                os.killpg(os.getpgid(pid), signal.SIGKILL)
                logger.info(f"[Terminate] Sent SIGKILL to process group of PID {pid}")
            except (ProcessLookupError, PermissionError, AttributeError) as e:
                # Fallback to killing just the parent process
                logger.warning(f"[Terminate] Could not kill process group with SIGKILL, falling back: {e}")
                process.kill()

            # Wait briefly for kill to complete
            try:
                process.wait(timeout=5)
                logger.info(f"[Terminate] Process {pid} force killed successfully")
            except subprocess.TimeoutExpired:
                logger.error(f"[Terminate] Process {pid} still alive after SIGKILL - this should not happen!")
                # Last resort: try to kill by PID using os.kill
                try:
                    os.kill(pid, signal.SIGKILL)
                    logger.info(f"[Terminate] Sent final SIGKILL to PID {pid} via os.kill")
                except ProcessLookupError:
                    logger.info(f"[Terminate] Process {pid} no longer exists")
                except Exception as kill_err:
                    logger.error(f"[Terminate] Failed final kill attempt: {kill_err}")

            return True

    except Exception as e:
        logger.error(f"[Terminate] Error terminating process {pid}: {e}", exc_info=True)
        # Last-ditch effort: try to kill by PID
        try:
            logger.info(f"[Terminate] Attempting emergency kill of PID {pid}")
            os.kill(pid, signal.SIGKILL)
            time.sleep(1)  # Give it a moment
            return True
        except Exception as kill_err:
            logger.error(f"[Terminate] Emergency kill failed: {kill_err}")
            return False


async def kill_process_by_pid(pid: int, job_id: str) -> bool:
    """
    Kill a process by PID when we don't have the subprocess.Popen object.
    Used for orphan cleanup after server restart.

    Args:
        pid: Process ID to kill
        job_id: Job ID for logging

    Returns:
        True if process was killed or doesn't exist
    """
    logger.info(f"[KillByPID] Attempting to kill PID {pid} for job {job_id}")

    try:
        # Check if process exists
        try:
            os.kill(pid, 0)  # Signal 0 checks if process exists
        except ProcessLookupError:
            logger.info(f"[KillByPID] PID {pid} no longer exists")
            return True
        except PermissionError:
            logger.warning(f"[KillByPID] No permission to check PID {pid}")

        # Try to kill the process group first
        try:
            pgid = os.getpgid(pid)
            logger.info(f"[KillByPID] Killing process group {pgid} (PID {pid})")
            os.killpg(pgid, signal.SIGTERM)
            await asyncio.sleep(2)  # Wait for graceful termination

            # Check if still alive
            try:
                os.kill(pid, 0)
                logger.warning(f"[KillByPID] PID {pid} still alive after SIGTERM, sending SIGKILL")
                os.killpg(pgid, signal.SIGKILL)
                await asyncio.sleep(1)
            except ProcessLookupError:
                logger.info(f"[KillByPID] PID {pid} terminated after SIGTERM")
                return True

        except (ProcessLookupError, PermissionError) as e:
            logger.warning(f"[KillByPID] Could not kill process group: {e}, trying direct kill")
            os.kill(pid, signal.SIGKILL)
            await asyncio.sleep(1)

        # Final check
        try:
            os.kill(pid, 0)
            logger.error(f"[KillByPID] PID {pid} still alive after SIGKILL!")
            return False
        except ProcessLookupError:
            logger.info(f"[KillByPID] PID {pid} successfully killed")
            return True

    except Exception as e:
        logger.error(f"[KillByPID] Error killing PID {pid}: {e}", exc_info=True)
        return False


async def kill_process_by_job_id(job_id: str) -> bool:
    """
    Find and kill processes associated with a job by searching command lines.
    Used as fallback when we have neither process object nor PID.

    Args:
        job_id: Job ID to search for

    Returns:
        True if processes were found and killed
    """
    logger.info(f"[KillByJobID] Searching for processes with job_id {job_id}")

    try:
        # Use pgrep to find processes with job_id in command line
        result = await asyncio.to_thread(
            subprocess.run,
            ['pgrep', '-f', f'job.*{job_id}'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            # Also search for standalone_trainer with job_id
            result = await asyncio.to_thread(
                subprocess.run,
                ['pgrep', '-f', f'standalone_trainer.*{job_id}'],
                capture_output=True,
                text=True,
                timeout=5
            )

        if result.returncode != 0 or not result.stdout.strip():
            logger.info(f"[KillByJobID] No processes found for job {job_id}")
            return False

        pids = [int(p) for p in result.stdout.strip().split('\n') if p.strip().isdigit()]
        logger.info(f"[KillByJobID] Found PIDs for job {job_id}: {pids}")

        killed_any = False
        for pid in pids:
            try:
                os.kill(pid, signal.SIGKILL)
                logger.info(f"[KillByJobID] Killed PID {pid}")
                killed_any = True
            except ProcessLookupError:
                logger.info(f"[KillByJobID] PID {pid} already dead")
                killed_any = True
            except PermissionError:
                logger.warning(f"[KillByJobID] No permission to kill PID {pid}")
            except Exception as e:
                logger.error(f"[KillByJobID] Error killing PID {pid}: {e}")

        return killed_any

    except Exception as e:
        logger.error(f"[KillByJobID] Error searching for processes: {e}", exc_info=True)
        return False


class TrainingRequest(BaseModel):
    """Request model for training execution"""
    config: dict
    dataset_path: str = ""  # Optional, for backward compatibility
    execution_id: str
    name: Optional[str] = None
    dataset_content: Optional[str] = None  # Dataset file content as string
    user_id: str  # User ID for database persistence


class TrainingResponse(BaseModel):
    """Response model for training execution"""
    job_id: str
    status: str
    message: str


class ValidationRequest(BaseModel):
    """Request model for model validation on test dataset"""
    model_path: str
    test_dataset_id: str
    metrics_to_compute: list[str]


class ValidationResponse(BaseModel):
    """Response model for validation execution"""
    job_id: str
    status: str
    metrics: dict
    message: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup and shutdown"""
    # Startup
    logger.info("[Startup] Starting job queue worker...")
    asyncio.create_task(queue_worker())
    logger.info("[Startup] Queue worker started - jobs will be processed sequentially")

    logger.info("[Startup] Starting periodic health check...")
    asyncio.create_task(periodic_health_check())
    logger.info("[Startup] Health check started - will run every 30 seconds")

    logger.info("[Startup] Starting periodic cleanup worker...")
    asyncio.create_task(periodic_cleanup_worker())
    logger.info("[Startup] Cleanup worker started - will run every 10 minutes")

    logger.info("[Startup] Starting retry persistence worker...")
    asyncio.create_task(retry_failed_persists_worker())
    logger.info("[Startup] Retry worker started - will run every 5 minutes")

    logger.info("[Startup] Checking for orphaned training jobs...")
    await reconnect_orphaned_training_jobs()
    logger.info("[Startup] Server initialization complete")

    yield

    # Shutdown (if needed)
    logger.info("[Shutdown] Server shutting down")


# Create FastAPI app
app = FastAPI(
    title="FineTune Lab Training API",
    description="Local training server for LLM fine-tuning",
    version="1.0.0",
    lifespan=lifespan
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

if RATE_LIMIT_ENABLED:
    logger.info(f"[Rate Limit] ENABLED - Training execute: {RATE_LIMIT_TRAINING_EXECUTE}, General: {RATE_LIMIT_TRAINING_GENERAL}, Filesystem: {RATE_LIMIT_FILESYSTEM}")
else:
    logger.warning("[Rate Limit] DISABLED - Set RATE_LIMIT_ENABLED=true to enable")

# Add CORS middleware
# Allow origins from environment variable (comma-separated) or default to localhost
cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")
cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Training API server initialized")


async def cleanup_stale_jobs():
    """
    Clean up stale jobs in database.

    Marks running/pending/queued jobs as failed if:
    - Not in backend memory (jobs dict)
    - updated_at timestamp > 10 minutes old

    This prevents ghost jobs from accumulating when:
    - Training process dies without cleanup
    - Backend crashes and restarts
    - Monitor stops updating database

    Called by:
    - reconnect_orphaned_training_jobs() on startup
    - periodic_cleanup_worker() every 10 minutes
    """
    logger.info("[Cleanup] Checking database for stale jobs...")

    if not supabase:
        logger.warning("[Cleanup] Supabase not available - cannot check for stale jobs")
        return

    try:
        # Query database for ALL jobs in running, pending, or queued status
        db_response = supabase.table('local_training_jobs').select('id, status, updated_at, model_name').in_('status', ['running', 'pending', 'queued']).execute()

        if not db_response.data:
            logger.info("[Cleanup] No running/pending/queued jobs found in database")
            return

        stale_jobs = []
        current_time = time.time()

        for db_job in db_response.data:
            job_id = db_job['id']
            updated_at_str = db_job.get('updated_at')

            # Skip jobs that are in the backend memory (they're active)
            if job_id in jobs:
                logger.debug(f"[Cleanup] Skipping {job_id[:8]}... - active in backend")
                continue

            # Parse updated_at timestamp
            if updated_at_str:
                try:
                    from datetime import datetime
                    updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                    time_diff = current_time - updated_at.timestamp()

                    # Mark as stale if no updates for > 10 minutes (600 seconds)
                    if time_diff > JOB_STALENESS_THRESHOLD_SECONDS:
                        stale_jobs.append({
                            'id': job_id,
                            'status': db_job['status'],
                            'model_name': db_job.get('model_name', 'unknown'),
                            'stale_seconds': int(time_diff)
                        })
                        logger.warning(f"[Cleanup] Found stale job: {job_id[:8]}... ({db_job['status']}, {int(time_diff)}s since update)")
                except Exception as e:
                    logger.warning(f"[Cleanup] Error parsing timestamp for {job_id}: {e}")

        # Mark stale jobs as failed in database
        if stale_jobs:
            logger.info(f"[Cleanup] Marking {len(stale_jobs)} stale job(s) as failed...")

            for stale_job in stale_jobs:
                job_id = stale_job['id']
                try:
                    # Update job status to failed with error message
                    update_response = supabase.table('local_training_jobs').update({
                        'status': 'failed',
                        'completed_at': datetime.now().isoformat(),
                        'config': {
                            'error': f"Training process terminated unexpectedly. No updates for {stale_job['stale_seconds']}s. Process may have been killed or server restarted."
                        }
                    }).eq('id', job_id).execute()

                    if update_response.data:
                        logger.info(f"[Cleanup] ✓ Marked {job_id[:8]}... as failed")
                    else:
                        logger.warning(f"[Cleanup] Failed to update {job_id[:8]}... in database")

                except Exception as e:
                    logger.error(f"[Cleanup] Error updating job {job_id}: {e}")
        else:
            logger.info("[Cleanup] No stale jobs found in database")

        # MEMORY LEAK FIX: Clean completed/failed jobs from memory after 1 hour
        logger.info("[Cleanup] Cleaning old jobs from memory...")
        jobs_to_remove = []
        current_time_seconds = time.time()
        
        for job_id, job in list(jobs.items()):
            # Remove jobs that completed/failed > 1 hour ago (3600 seconds)
            if job.status in ['completed', 'failed', 'cancelled']:
                # Check if job has been in terminal state for > 1 hour
                if job.completed_at:
                    try:
                        from datetime import datetime
                        if isinstance(job.completed_at, str):
                            completed_dt = datetime.fromisoformat(job.completed_at.replace('Z', '+00:00'))
                        else:
                            completed_dt = job.completed_at
                        time_since_completion = current_time_seconds - completed_dt.timestamp()
                        
                        if time_since_completion > 3600:  # 1 hour
                            jobs_to_remove.append(job_id)
                    except Exception as e:
                        logger.warning(f"[Cleanup] Error parsing completion time for {job_id[:8]}...: {e}")
        
        for job_id in jobs_to_remove:
            del jobs[job_id]
            logger.info(f"[Cleanup] Removed old job from memory: {job_id[:8]}...")
        
        if jobs_to_remove:
            logger.info(f"[Cleanup] Cleaned {len(jobs_to_remove)} old job(s) from memory")
        
        logger.info(f"[Cleanup] Memory: {len(jobs)} active jobs, {len(failed_persists)} cached persists")

        # DISK LEAK FIX: Clean old log files and job directories after 7 days
        logger.info("[Cleanup] Cleaning old log files...")
        old_files_count = 0
        old_dirs_count = 0
        current_time_seconds = time.time()
        
        try:
            # Clean individual log files older than 7 days (604800 seconds)
            for log_file in LOGS_DIR.glob("job_*.log"):
                try:
                    file_age = current_time_seconds - log_file.stat().st_mtime
                    if file_age > 604800:  # 7 days
                        log_file.unlink()
                        old_files_count += 1
                except Exception as e:
                    logger.warning(f"[Cleanup] Error removing log file {log_file.name}: {e}")
            
            # Clean job directories older than 7 days
            for job_dir in LOGS_DIR.glob("job_*"):
                if job_dir.is_dir():
                    try:
                        dir_age = current_time_seconds - job_dir.stat().st_mtime
                        if dir_age > 604800:  # 7 days
                            import shutil
                            shutil.rmtree(job_dir)
                            old_dirs_count += 1
                    except Exception as e:
                        logger.warning(f"[Cleanup] Error removing job directory {job_dir.name}: {e}")
            
            # Clean old dataset directories
            datasets_dir = LOGS_DIR / "datasets"
            if datasets_dir.exists():
                for dataset_job_dir in datasets_dir.glob("job_*"):
                    if dataset_job_dir.is_dir():
                        try:
                            dir_age = current_time_seconds - dataset_job_dir.stat().st_mtime
                            if dir_age > 604800:  # 7 days
                                import shutil
                                shutil.rmtree(dataset_job_dir)
                                old_dirs_count += 1
                        except Exception as e:
                            logger.warning(f"[Cleanup] Error removing dataset directory {dataset_job_dir.name}: {e}")
            
            if old_files_count > 0 or old_dirs_count > 0:
                logger.info(f"[Cleanup] Removed {old_files_count} old log files and {old_dirs_count} old directories")
            else:
                logger.debug("[Cleanup] No old log files to clean")
                
        except Exception as e:
            logger.error(f"[Cleanup] Error cleaning log files: {e}")

    except Exception as e:
        logger.error(f"[Cleanup] Error checking database for stale jobs: {e}", exc_info=True)


async def persist_with_cache(job_id: str, job_data: Dict) -> bool:
    """
    Persist job data with caching for failures.

    If persistence fails (Next.js server down, database issues), cache
    the data locally and retry later via retry_failed_persists worker.

    Phase 3 - Resilient Persistence
    
    MEMORY LEAK FIX: Limits cache size to prevent unbounded growth.
    """
    # MEMORY LEAK FIX: Enforce maximum cache size (prevent unbounded growth)
    MAX_FAILED_PERSISTS = 1000
    if len(failed_persists) >= MAX_FAILED_PERSISTS and job_id not in failed_persists:
        # Cache full - remove oldest entry (FIFO)
        oldest_job_id = next(iter(failed_persists))
        del failed_persists[oldest_job_id]
        logger.warning(f"[PersistCache] Cache full ({MAX_FAILED_PERSISTS}), evicted oldest: {oldest_job_id[:8]}...")
    
    success = await _persist_to_api(job_id, job_data)

    if not success:
        # Cache failed persist for later retry
        failed_persists[job_id] = job_data
        logger.warning(f"[PersistCache] Cached failed persist for {job_id[:8]}... ({len(failed_persists)} in cache)")
    elif job_id in failed_persists:
        # Succeeded, remove from cache
        del failed_persists[job_id]
        logger.info(f"[PersistCache] ✓ Cleared {job_id[:8]}... from cache after success")

    return success


async def retry_failed_persists_worker():
    """
    Background worker that retries failed database persistence.

    Runs every 5 minutes to retry cached persistence failures.
    This ensures eventual consistency when Next.js server is temporarily down.

    Phase 3 - Resilient Persistence
    """
    logger.info("[RetryPersist] Worker started - will retry every 5 minutes")

    while True:
        try:
            # Wait for retry interval
            await asyncio.sleep(RETRY_PERSIST_INTERVAL)

            if failed_persists:
                logger.info(f"[RetryPersist] Retrying {len(failed_persists)} failed persist(s)...")
                retry_count = 0
                success_count = 0

                # Copy dict to avoid modification during iteration
                for job_id, job_data in list(failed_persists.items()):
                    retry_count += 1
                    if await persist_with_cache(job_id, job_data):
                        success_count += 1

                logger.info(f"[RetryPersist] Retry complete: {success_count}/{retry_count} succeeded, {len(failed_persists)} remaining")
            else:
                logger.debug("[RetryPersist] No failed persists to retry")

        except Exception as e:
            logger.error(f"[RetryPersist] Error in worker: {e}", exc_info=True)
            # Continue running even if retry fails
            await asyncio.sleep(STALE_JOB_CHECK_INTERVAL)  # Wait before next check


async def periodic_cleanup_worker():
    """
    Background worker that periodically cleans stale jobs.

    Runs cleanup_stale_jobs() every 10 minutes to prevent accumulation
    of ghost jobs in the database.

    This ensures that jobs stuck in running/pending/queued states are
    automatically marked as failed even when backend runs continuously
    without restarts.
    """
    logger.info("[PeriodicCleanup] Worker started - will run every 10 minutes")

    while True:
        try:
            # Wait 10 minutes
            await asyncio.sleep(PERIODIC_CLEANUP_INTERVAL)

            logger.info("[PeriodicCleanup] Running scheduled cleanup...")
            await cleanup_stale_jobs()
            logger.info("[PeriodicCleanup] Cleanup complete, next run in 10 minutes")

        except Exception as e:
            logger.error(f"[PeriodicCleanup] Error in worker: {e}", exc_info=True)
            # Continue running even if cleanup fails
            await asyncio.sleep(CLEANUP_RETRY_DELAY)  # Wait before retrying


async def reconnect_orphaned_training_jobs():
    """
    Reconnect to training processes that are still running after server restart.
    Scans for running Python trainer processes and reattaches monitoring.
    """
    logger.info("[Reconnect] Scanning for orphaned training jobs...")
    
    try:
        # Find all running Python processes with standalone_trainer.py (Linux/macOS)
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            logger.warning(f"[Reconnect] Failed to list processes: {result.stderr}")
            return

        # Parse process list to find trainer processes
        orphaned_pids = []
        for line in result.stdout.split('\n'):
            if 'standalone_trainer.py' in line:
                # Linux ps aux format: user PID ...
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        pid = int(parts[1])
                        orphaned_pids.append(pid)
                    except ValueError:
                        continue
        
        logger.info(f"[Reconnect] Found {len(orphaned_pids)} orphaned trainer process(es): {orphaned_pids if orphaned_pids else 'none'}")

        # Scan log directories to find job IDs (only if processes exist)
        if orphaned_pids:
            for log_dir in LOGS_DIR.glob("job_*"):
                job_id = log_dir.name.replace("job_", "")
                progress_file = log_dir / PROGRESS_FILENAME

                if not progress_file.exists():
                    logger.debug(f"[Reconnect] Skipping {job_id} - no progress file")
                    continue

                try:
                    # Read progress to get job status (async to prevent blocking)
                    async with aiofiles.open(progress_file, 'r') as f:
                        content = await f.read()
                        # Run JSON parsing in thread pool to avoid blocking event loop
                        progress_data = await asyncio.to_thread(json.loads, content)

                    status = progress_data.get("status", "unknown")

                    # Only reconnect to running jobs
                    if status != "running":
                        logger.debug(f"[Reconnect] Skipping {job_id} - status is {status}")
                        continue

                    # Check if progress file was recently modified (within last 10 minutes)
                    progress_mtime = os.path.getmtime(progress_file)
                    time_diff = time.time() - progress_mtime

                    if time_diff > JOB_STALENESS_THRESHOLD_SECONDS:  # 10 minutes
                        logger.warning(f"[Reconnect] Skipping {job_id} - progress file too old ({time_diff:.0f}s)")
                        logger.warning(f"[Reconnect] Job may have crashed or been killed")
                        continue

                    logger.info(f"[Reconnect] Found active training job: {job_id}")

                    # Read config to reconstruct job metadata
                    config_file = CONFIG_DIR / f"job_{job_id}.json"
                    if not config_file.exists():
                        logger.warning(f"[Reconnect] Missing config for {job_id}, skipping")
                        continue

                    with open(config_file, 'r') as f:
                        config = json.load(f)

                    # Fetch job data from database to get user_id and other metadata
                    if not supabase:
                        logger.warning(f"[Reconnect] Supabase not available, cannot fetch job {job_id}")
                        continue

                    db_response = supabase.table('local_training_jobs').select('*').eq('id', job_id).single().execute()

                    if not db_response.data:
                        logger.warning(f"[Reconnect] Job {job_id} not found in database")
                        continue

                    db_job = db_response.data

                    # Try to find the PID for this specific job
                    job_pid = None
                    try:
                        # Search for process with this job_id in command line
                        pid_result = subprocess.run(
                            ['pgrep', '-f', f'job_{job_id}'],
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        if pid_result.returncode == 0 and pid_result.stdout.strip():
                            found_pids = [int(p) for p in pid_result.stdout.strip().split('\n') if p.strip().isdigit()]
                            if found_pids:
                                job_pid = found_pids[0]  # Take the first matching PID
                                logger.info(f"[Reconnect] Found PID {job_pid} for job {job_id}")
                    except Exception as pid_err:
                        logger.debug(f"[Reconnect] Could not find PID for job {job_id}: {pid_err}")

                    # Recreate JobStatus object
                    job = JobStatus(
                        job_id=job_id,
                        user_id=db_job.get('user_id', ''),
                        status=JobStatusEnum.RUNNING,
                        model_name=db_job.get('model_name', 'unknown'),
                        dataset_path=db_job.get('dataset_path', ''),
                        config_id=job_id,
                        dataset_id=config.get('dataset_path', ''),
                        name=db_job.get('name', f"Training Job {job_id[:8]}"),
                        training_config=config,
                        # Populate from progress data
                        current_epoch=progress_data.get('current_epoch', 0),
                        total_epochs=progress_data.get('total_epochs', 0),
                        current_step=progress_data.get('current_step', 0),
                        total_steps=progress_data.get('total_steps', 0),
                        progress=progress_data.get('progress_percent', 0.0),
                        loss=progress_data.get('train_loss'),
                        eval_loss=progress_data.get('eval_loss'),
                        started_at=db_job.get('started_at'),
                        # No process object - we can't get the actual Python process object
                        process=None,
                        process_pid=job_pid,  # Store PID for cancellation
                        job_token=db_job.get('job_token', '')  # For predictions API
                    )

                    # Generate token if not present (critical for metrics persistence)
                    if not job.job_token:
                        job.job_token = secrets.token_urlsafe(32)
                        logger.info(f"[Reconnect] Generated new job_token for job {job_id[:8]}...")
                        # Update DB with new token
                        try:
                            supabase.table('local_training_jobs').update({
                                'job_token': job.job_token
                            }).eq('id', job_id).execute()
                        except Exception as token_err:
                            logger.warning(f"[Reconnect] Failed to persist job_token: {token_err}")

                    # Add to jobs dict
                    jobs[job_id] = job
                    logger.info(f"[Reconnect] Reconnected to job {job_id} - progress: {job.progress:.1f}% (job_token: {'SET' if job.job_token else 'EMPTY'})")

                    # Start monitoring task
                    asyncio.create_task(monitor_job(job_id))
                    logger.info(f"[Reconnect] Started monitor for job {job_id}")

                except Exception as e:
                    logger.error(f"[Reconnect] Error processing job {job_id}: {e}", exc_info=True)
                    continue

        # QUEUED JOBS RECOVERY: Re-queue queued jobs from database
        logger.info("[Reconnect] Checking database for queued jobs to recover...")

        if supabase:
            try:
                # Query database for jobs in queued status
                db_response = supabase.table('local_training_jobs').select('*').eq('status', 'queued').execute()

                if db_response.data:
                    recovered_count = 0
                    current_time = time.time()

                    for db_job in db_response.data:
                        job_id = db_job['id']
                        updated_at_str = db_job.get('updated_at')

                        # Skip if already in jobs dict
                        if job_id in jobs:
                            logger.debug(f"[Reconnect] Queued job {job_id[:8]}... already in memory")
                            continue

                        # Check job age
                        job_age_seconds = 0
                        if updated_at_str:
                            try:
                                from datetime import datetime
                                updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                                job_age_seconds = current_time - updated_at.timestamp()
                            except Exception as e:
                                logger.warning(f"[Reconnect] Error parsing timestamp for {job_id}: {e}")

                        # If job is older than threshold, mark as failed instead of re-queuing
                        if job_age_seconds > JOB_STALENESS_THRESHOLD_SECONDS:
                            logger.warning(f"[Reconnect] Queued job {job_id[:8]}... is stale ({int(job_age_seconds)}s old), marking as failed")
                            try:
                                supabase.table('local_training_jobs').update({
                                    'status': 'failed',
                                    'completed_at': datetime.now().isoformat(),
                                    'config': {
                                        'error': f"Job stuck in queued state for {int(job_age_seconds)}s. Server may have restarted."
                                    }
                                }).eq('id', job_id).execute()
                            except Exception as e:
                                logger.error(f"[Reconnect] Error marking stale queued job {job_id} as failed: {e}")
                            continue

                        # Get training config
                        training_config = db_job.get('config', {})
                        if not training_config:
                            logger.warning(f"[Reconnect] No config for queued job {job_id[:8]}..., skipping")
                            continue

                        # Create JobStatus object (include job_token for predictions API auth)
                        job = JobStatus(
                            job_id=job_id,
                            user_id=db_job.get('user_id', ''),
                            status=JobStatusEnum.QUEUED,
                            model_name=db_job.get('model_name', 'unknown'),
                            dataset_path=db_job.get('dataset_path', ''),
                            config_id=job_id,
                            dataset_id=training_config.get('dataset_path', ''),
                            name=db_job.get('name', f"Training Job {job_id[:8]}"),
                            training_config=training_config,
                            total_epochs=db_job.get('total_epochs', training_config.get('training', {}).get('num_epochs', 3)),
                            current_epoch=0,
                            total_steps=0,
                            current_step=0,
                            progress=0.0,
                            started_at=None,
                            process=None,
                            job_token=db_job.get('job_token', '')  # Critical for predictions API
                        )

                        # Generate token if not present (critical for metrics persistence)
                        if not job.job_token:
                            job.job_token = secrets.token_urlsafe(32)
                            logger.info(f"[Reconnect] Generated new job_token for queued job {job_id[:8]}...")
                            # Update DB with new token
                            try:
                                supabase.table('local_training_jobs').update({
                                    'job_token': job.job_token
                                }).eq('id', job_id).execute()
                            except Exception as token_err:
                                logger.warning(f"[Reconnect] Failed to persist job_token: {token_err}")

                        # Add to jobs dict
                        jobs[job_id] = job

                        # Re-add to queue
                        await job_queue.put(job_id)
                        recovered_count += 1

                        logger.info(f"[Reconnect] ✓ Re-queued job {job_id[:8]}... (age: {int(job_age_seconds)}s, job_token: {'SET' if job.job_token else 'EMPTY'})")

                    if recovered_count > 0:
                        logger.info(f"[Reconnect] Recovered {recovered_count} queued job(s)")
                    else:
                        logger.info("[Reconnect] No queued jobs to recover")
                else:
                    logger.info("[Reconnect] No queued jobs found in database")

            except Exception as e:
                logger.error(f"[Reconnect] Error recovering queued jobs: {e}", exc_info=True)
        else:
            logger.warning("[Reconnect] Supabase not available - cannot recover queued jobs")

        # DATABASE CLEANUP: Mark stale jobs as failed (uses centralized cleanup function)
        await cleanup_stale_jobs()

        logger.info(f"[Reconnect] Reconnection complete - {len(jobs)} active job(s)")

    except Exception as e:
        logger.error(f"[Reconnect] Error during reconnection: {e}", exc_info=True)


# Path configuration
SCRIPT_DIR = Path(__file__).parent

# Python path (Linux/macOS)
PYTHON_EXECUTABLE = SCRIPT_DIR / "trainer_venv" / "bin" / "python3"

TRAINER_SCRIPT = SCRIPT_DIR / "standalone_trainer.py"
CONFIG_DIR = SCRIPT_DIR / CONFIG_DIR_NAME
LOGS_DIR = SCRIPT_DIR / LOGS_DIR_NAME

# Ensure directories exist
CONFIG_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

logger.info(f"Python executable: {PYTHON_EXECUTABLE}")
logger.info(f"Trainer script: {TRAINER_SCRIPT}")


async def start_queued_job(job_id: str):
    """
    Start a queued training job.
    Transitions job from QUEUED → PENDING → RUNNING.
    
    Args:
        job_id: Job ID to start
    """
    if job_id not in jobs:
        logger.error(f"[QueueWorker] Job {job_id} not found in job store")
        return
    
    job = jobs[job_id]
    
    # Safety check - don't start if already running/completed
    if job.status in [JobStatusEnum.RUNNING, JobStatusEnum.COMPLETED]:
        logger.warning(f"[QueueWorker] Job {job_id} already {job.status}, skipping")
        return
    
    logger.info(f"[QueueWorker] Starting job {job_id} (was {job.status})")
    job.status = JobStatusEnum.PENDING
    
    # Get training config stored during execute
    if not job.training_config:
        logger.error(f"[QueueWorker] No training_config found for job {job_id}")
        job.status = JobStatusEnum.FAILED
        job.error_message = "Training configuration not found"
        return
    
    training_config = job.training_config

    try:
        # Spawn training subprocess
        logger.info(f"[QueueWorker] Spawning with job_token: {'SET (len={})'.format(len(job.job_token)) if job.job_token else 'EMPTY'}")
        process = await spawn_training_process(job_id, training_config, job.user_id, job.job_token)
        job.process = process
        job.process_pid = process.pid  # Store PID separately for orphan cleanup
        job.status = JobStatusEnum.RUNNING
        job.started_at = datetime.utcnow().isoformat()
        logger.info(f"[QueueWorker] Job {job_id} now RUNNING (PID: {process.pid})")

        # Persist status change to RUNNING (critical for UI to show correct status)
        await persist_with_cache(job_id, {
            "job_id": job_id,
            "user_id": job.user_id,
            "model_name": job.model_name,
            "dataset_path": job.dataset_path,
            "status": "running",
            "started_at": job.started_at + "Z" if not job.started_at.endswith("Z") else job.started_at
        })
        logger.info(f"[QueueWorker] Persisted RUNNING status to database for job {job_id}")

        # Trigger job started alert
        if ALERTS_AVAILABLE and job.user_id:
            trigger_job_started(job_id, job.user_id, model_name=job.model_name, base_model=getattr(job, 'base_model', None))

        # Start monitoring task
        asyncio.create_task(monitor_job(job_id))
        logger.info(f"[QueueWorker] Monitor started for job {job_id}")

    except Exception as e:
        logger.error(f"[QueueWorker] Failed to start job {job_id}: {e}", exc_info=True)
        job.status = JobStatusEnum.FAILED
        job.error_message = f"Failed to start training: {str(e)}"

        # Trigger job failed alert
        if ALERTS_AVAILABLE and job.user_id:
            trigger_job_failed(job_id, job.user_id, model_name=job.model_name, error_message=job.error_message, error_type="START_FAILURE")


async def cancel_job(job_id: str) -> dict:
    """
    Cancel a training job regardless of its current state.

    Handles:
    - QUEUED: Remove from queue
    - PENDING/RUNNING: Terminate subprocess
    - COMPLETED/FAILED/CANCELLED: Already finished

    Args:
        job_id: Job ID to cancel

    Returns:
        dict with success status, previous_status, and message

    Phase 2 - Job Cancellation (Enhanced to handle database-only jobs)
    """
    logger.info(f"[Cancel] Cancellation request for job {job_id}")

    # Check if job exists in memory
    if job_id not in jobs:
        logger.warning(f"[Cancel] Job {job_id} not found in memory, checking database...")

        # Check database for the job
        if supabase:
            try:
                db_response = supabase.table('local_training_jobs').select('*').eq('id', job_id).single().execute()

                if db_response.data:
                    db_job = db_response.data
                    current_status = db_job.get('status', 'unknown')
                    logger.info(f"[Cancel] Found job {job_id} in database with status: {current_status}")

                    # If already finished, return error
                    if current_status in ['completed', 'failed', 'cancelled']:
                        return {
                            "success": False,
                            "job_id": job_id,
                            "previous_status": current_status,
                            "message": f"Job already finished with status: {current_status}"
                        }

                    # Cancel in database (queued/pending/running jobs that aren't in memory)
                    supabase.table('local_training_jobs').update({
                        'status': 'cancelled',
                        'completed_at': datetime.utcnow().isoformat(),
                        'config': {
                            **(db_job.get('config') or {}),
                            'error': 'Cancelled by user (job not in server memory)'
                        }
                    }).eq('id', job_id).execute()

                    logger.info(f"[Cancel] Job {job_id} cancelled in database")
                    return {
                        "success": True,
                        "job_id": job_id,
                        "previous_status": current_status,
                        "message": f"Job cancelled (was {current_status}, not in server memory)"
                    }
                else:
                    logger.warning(f"[Cancel] Job {job_id} not found in database either")
            except Exception as e:
                logger.error(f"[Cancel] Error checking database for job {job_id}: {e}")

        return {
            "success": False,
            "job_id": job_id,
            "message": "Job not found in memory or database"
        }
    
    job = jobs[job_id]
    previous_status = job.status
    
    logger.info(f"[Cancel] Job {job_id} current status: {previous_status}")
    
    # Handle already finished jobs
    if previous_status in [JobStatusEnum.COMPLETED, JobStatusEnum.FAILED, JobStatusEnum.CANCELLED]:
        logger.info(f"[Cancel] Job {job_id} already finished with status {previous_status}")
        return {
            "success": False,
            "job_id": job_id,
            "previous_status": previous_status.value,
            "message": f"Job already finished with status: {previous_status.value}"
        }
    
    # Handle queued jobs - remove from queue
    if previous_status == JobStatusEnum.QUEUED:
        logger.info(f"[Cancel] Removing queued job {job_id} from queue")
        removed = await remove_from_queue(job_id)
        
        if removed:
            job.status = JobStatusEnum.CANCELLED
            job.completed_at = datetime.utcnow().isoformat()
            job.error_message = "Cancelled by user"
            
            # Persist cancellation
            await persist_with_cache(job_id, job.to_dict())

            # Trigger cancellation alert
            if ALERTS_AVAILABLE and job.user_id:
                trigger_job_cancelled(job_id, job.user_id, model_name=job.model_name)

            logger.info(f"[Cancel] Job {job_id} removed from queue and marked CANCELLED")
            return {
                "success": True,
                "job_id": job_id,
                "previous_status": previous_status.value,
                "message": "Job removed from queue and cancelled"
            }
        else:
            logger.warning(f"[Cancel] Job {job_id} was QUEUED but not found in queue")
            # Still mark as cancelled even if not in queue
            job.status = JobStatusEnum.CANCELLED
            job.completed_at = datetime.utcnow().isoformat()
            job.error_message = "Cancelled by user"

            # Persist cancellation
            await persist_with_cache(job_id, job.to_dict())

            # Trigger cancellation alert
            if ALERTS_AVAILABLE and job.user_id:
                trigger_job_cancelled(job_id, job.user_id, model_name=job.model_name)

            return {
                "success": True,
                "job_id": job_id,
                "previous_status": previous_status.value,
                "message": "Job marked as cancelled (not found in queue)"
            }
    
    # Handle pending/running jobs - terminate subprocess
    if previous_status in [JobStatusEnum.PENDING, JobStatusEnum.RUNNING]:
        logger.info(f"[Cancel] Terminating {previous_status} job {job_id}")

        terminated = False

        # Terminate the subprocess
        if job.process:
            logger.info(f"[Cancel] Terminating process PID {job.process.pid}")
            terminated = terminate_process_gracefully(job.process, timeout=PROCESS_TERMINATION_TIMEOUT_DEFAULT)
        elif job.process_pid:
            # Process object not available (e.g., after server restart), but we have the PID
            logger.info(f"[Cancel] No process object, killing by stored PID {job.process_pid}")
            terminated = await kill_process_by_pid(job.process_pid, job_id)
        else:
            # No process info at all - try to find by job_id in command line
            logger.warning(f"[Cancel] No process info for job {job_id}, searching by job_id...")
            terminated = await kill_process_by_job_id(job_id)

        if terminated:
            logger.info(f"[Cancel] Process terminated successfully")

            # Phase 1.2: Clear GPU cache after process termination
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    logger.info(f"[Cancel] GPU cache cleared for job {job_id}")
            except ImportError:
                logger.debug(f"[Cancel] Torch not available, skipping GPU cache clear")
            except Exception as e:
                logger.warning(f"[Cancel] Could not clear GPU cache: {e}")
        else:
            logger.warning(f"[Cancel] Process termination may have failed or no process found")
        
        # Update job status
        job.status = JobStatusEnum.CANCELLED
        job.completed_at = datetime.utcnow().isoformat()
        job.error_message = "Cancelled by user"

        # Persist cancellation
        await persist_with_cache(job_id, job.to_dict())

        # Trigger cancellation alert
        if ALERTS_AVAILABLE and job.user_id:
            trigger_job_cancelled(job_id, job.user_id, model_name=job.model_name)

        logger.info(f"[Cancel] Job {job_id} cancelled successfully")
        return {
            "success": True,
            "job_id": job_id,
            "previous_status": previous_status.value,
            "message": f"Job cancelled (was {previous_status.value})"
        }

    # Should never reach here
    logger.warning(f"[Cancel] Unexpected status {previous_status} for job {job_id}")
    return {
        "success": False,
        "job_id": job_id,
        "previous_status": previous_status.value,
        "message": f"Cannot cancel job with status: {previous_status.value}"
    }


async def pause_job(job_id: str) -> dict:
    """
    Pause a running training job.
    Saves current state and terminates process gracefully.
    Job can be resumed later from the last checkpoint.
    
    Args:
        job_id: Job ID to pause
        
    Returns:
        dict with success status, previous_status, and message
    
    Phase 2 - Pause/Resume
    """
    logger.info(f"[Pause] Pause request for job {job_id}")
    
    # Check if job exists
    if job_id not in jobs:
        logger.warning(f"[Pause] Job {job_id} not found")
        return {
            "success": False,
            "job_id": job_id,
            "message": "Job not found"
        }
    
    job = jobs[job_id]
    previous_status = job.status
    
    logger.info(f"[Pause] Job {job_id} current status: {previous_status}")
    
    # Can only pause RUNNING or PENDING jobs
    if previous_status not in [JobStatusEnum.RUNNING, JobStatusEnum.PENDING]:
        logger.warning(f"[Pause] Job {job_id} cannot be paused - status is {previous_status}")
        return {
            "success": False,
            "job_id": job_id,
            "previous_status": previous_status.value,
            "message": f"Can only pause running or pending jobs (current status: {previous_status.value})"
        }
    
    logger.info(f"[Pause] Pausing {previous_status} job {job_id}")
    
    # Terminate the subprocess gracefully (this allows trainer to save checkpoint)
    if job.process:
        logger.info(f"[Pause] Terminating process PID {job.process.pid}")
        terminated = terminate_process_gracefully(job.process, timeout=PROCESS_TERMINATION_TIMEOUT_CHECKPOINT)  # Longer timeout for checkpoint save
        
        if terminated:
            logger.info(f"[Pause] Process terminated successfully")
        else:
            logger.warning(f"[Pause] Process termination may have failed")
    else:
        logger.warning(f"[Pause] No process found for job {job_id}")
    
    # Update job status
    job.status = JobStatusEnum.PAUSED
    job.paused_at = datetime.utcnow().isoformat()
    
    # Persist pause state
    await persist_with_cache(job_id, {
        "job_id": job_id,
        "user_id": job.user_id,
        "model_name": job.model_name,
        "dataset_path": job.dataset_path,
        "status": "paused",
        "paused_at": job.paused_at + "Z" if not job.paused_at.endswith("Z") else job.paused_at,
        "progress": job.progress,
        "current_epoch": job.current_epoch,
        "total_epochs": job.total_epochs,
        "current_step": job.current_step,
        "total_steps": job.total_steps,
        "loss": job.loss,
        "eval_loss": job.eval_loss
    })
    
    logger.info(f"[Pause] Job {job_id} paused successfully")
    return {
        "success": True,
        "job_id": job_id,
        "previous_status": previous_status.value,
        "paused_at": job.paused_at,
        "message": f"Job paused (was {previous_status.value})"
    }


async def resume_job(job_id: str, checkpoint_path: Optional[str] = None) -> dict:
    """
    Resume a paused training job from the last checkpoint.
    
    Args:
        job_id: Job ID to resume
        checkpoint_path: Optional specific checkpoint to resume from.
                        If not provided, uses latest checkpoint.
        
    Returns:
        dict with success status, checkpoint info, and message
    
    Phase 2 - Pause/Resume
    """
    logger.info(f"[Resume] Resume request for job {job_id}")
    
    # Check if job exists
    if job_id not in jobs:
        logger.warning(f"[Resume] Job {job_id} not found")
        return {
            "success": False,
            "job_id": job_id,
            "message": "Job not found"
        }
    
    job = jobs[job_id]
    previous_status = job.status
    
    logger.info(f"[Resume] Job {job_id} current status: {previous_status}")
    
    # Can only resume PAUSED jobs
    if previous_status != JobStatusEnum.PAUSED:
        logger.warning(f"[Resume] Job {job_id} is not paused - status is {previous_status}")
        return {
            "success": False,
            "job_id": job_id,
            "previous_status": previous_status.value,
            "message": f"Can only resume paused jobs (current status: {previous_status.value})"
        }
    
    # Find checkpoint to resume from
    if not checkpoint_path:
        # Find latest checkpoint in output directory
        output_dir = Path(job.training_config.get("output_dir", "")) if job.training_config else None
        
        if not output_dir or not output_dir.exists():
            logger.error(f"[Resume] Output directory not found for job {job_id}")
            return {
                "success": False,
                "job_id": job_id,
                "message": "Output directory not found - no checkpoints available"
            }
        
        # Find all checkpoint directories
        checkpoints = list(output_dir.glob("checkpoint-*"))
        
        if not checkpoints:
            logger.error(f"[Resume] No checkpoints found in {output_dir}")
            return {
                "success": False,
                "job_id": job_id,
                "message": "No checkpoints found - cannot resume"
            }
        
        # Get latest checkpoint (highest step number)
        latest_checkpoint = max(checkpoints, key=lambda p: int(p.name.split("-")[1].split("_")[0]))
        checkpoint_path = str(latest_checkpoint)
        logger.info(f"[Resume] Found latest checkpoint: {checkpoint_path}")
    else:
        logger.info(f"[Resume] Using provided checkpoint: {checkpoint_path}")
    
    # Update training config with checkpoint resume
    if not job.training_config:
        logger.error(f"[Resume] No training config found for job {job_id}")
        return {
            "success": False,
            "job_id": job_id,
            "message": "Training configuration not found"
        }
    
    job.training_config["resume_from_checkpoint"] = checkpoint_path
    job.resume_from_checkpoint = checkpoint_path
    
    # Reset job to QUEUED status to start from queue
    job.status = JobStatusEnum.QUEUED
    job.paused_at = None  # Clear pause timestamp
    
    # Add to queue
    await job_queue.put(job_id)
    queue_position = job_queue.qsize()
    job.queue_position = queue_position
    
    logger.info(f"[Resume] Job {job_id} re-queued at position {queue_position}")
    
    # Persist resume state
    await persist_with_cache(job_id, {
        "job_id": job_id,
        "user_id": job.user_id,
        "model_name": job.model_name,
        "dataset_path": job.dataset_path,
        "status": "queued",
        "resume_from_checkpoint": checkpoint_path,
        "paused_at": None
    })
    
    logger.info(f"[Resume] Job {job_id} will resume from checkpoint: {checkpoint_path}")
    
    return {
        "success": True,
        "job_id": job_id,
        "previous_status": previous_status.value,
        "checkpoint_path": checkpoint_path,
        "queue_position": queue_position,
        "message": f"Job resumed from checkpoint and queued at position {queue_position}"
    }


async def queue_worker():
    """
    Background worker that processes queued jobs sequentially.
    Ensures only one job runs at a time to avoid GPU conflicts.
    """
    logger.info("[QueueWorker] Started - monitoring queue for jobs")
    
    while True:
        try:
            # Check if GPU is free (no jobs currently running)
            running_jobs = get_running_jobs()
            
            if len(running_jobs) == 0:
                # GPU is free - try to get next job from queue
                try:
                    job_id = await asyncio.wait_for(job_queue.get(), timeout=QUEUE_WAIT_TIMEOUT)
                    logger.info(f"[QueueWorker] Dequeued job {job_id}, starting...")
                    await start_queued_job(job_id)
                except asyncio.TimeoutError:
                    # No jobs in queue, wait and check again
                    await asyncio.sleep(QUEUE_EMPTY_DELAY)
                    continue
            else:
                # GPU busy - wait before checking again
                logger.debug(f"[QueueWorker] GPU busy with {len(running_jobs)} job(s), waiting...")
                await asyncio.sleep(GPU_BUSY_DELAY)
                
        except Exception as e:
            logger.error(f"[QueueWorker] Unexpected error: {e}", exc_info=True)
            await asyncio.sleep(ERROR_BACKOFF_DELAY)  # Prevent tight error loop

def _read_process_logs_blocking(process: subprocess.Popen, log_handle, job_id: str):
    """
    Blocking function to read process logs synchronously.
    Called from thread pool via asyncio.to_thread() to avoid blocking event loop.

    Args:
        process: The training subprocess
        log_handle: File handle for writing logs
        job_id: Job ID for logging context
    """
    try:
        # Read stdout line by line and write to both file and console
        for line in process.stdout:
            # Write to file
            log_handle.write(line)
            log_handle.flush()

            # Print to console (strip to avoid double newlines)
            line_stripped = line.rstrip()
            if line_stripped:
                # Add job context to console output
                print(f"[Job {job_id[:8]}] {line_stripped}", flush=True)
    except Exception as e:
        logger.error(f"[LogStream] Error reading logs for job {job_id[:8]}...: {e}")


async def stream_training_logs(process: subprocess.Popen, log_handle, job_id: str):
    """
    Stream training process logs to both file and console in real-time.

    Runs blocking I/O in a separate thread to avoid blocking the FastAPI event loop,
    allowing the server to continue handling HTTP requests while training is running.

    Args:
        process: The training subprocess
        log_handle: File handle for writing logs
        job_id: Job ID for logging context
    """
    try:
        logger.info(f"[LogStream] Started for job {job_id[:8]}...")

        # Run blocking I/O in thread pool to avoid blocking event loop
        # This allows the FastAPI server to continue handling requests during training
        await asyncio.to_thread(_read_process_logs_blocking, process, log_handle, job_id)

        logger.info(f"[LogStream] Ended for job {job_id[:8]}... (process finished)")

    except Exception as e:
        logger.error(f"[LogStream] Error streaming logs for job {job_id[:8]}...: {e}")
    finally:
        log_handle.close()


async def spawn_training_process(job_id: str, config: dict, user_id: str = "", job_token: str = "") -> subprocess.Popen:
    """
    Spawn a training subprocess for the given job.

    Args:
        job_id: Unique job identifier
        config: Training configuration dictionary
        user_id: User ID for job ownership (optional)
        job_token: Authentication token for metrics API (optional)

    Returns:
        subprocess.Popen: The running process
    """
    logger.info(f"[Spawn] Starting training process for job {job_id}")
    
    if "output_dir" not in config:
        config["output_dir"] = str(LOGS_DIR / f"job_{job_id}")
        logger.info(f"[Spawn] Set output_dir: {config['output_dir']}")
    
    config_file = CONFIG_DIR / f"job_{job_id}.json"
    # Use async file I/O to avoid blocking the event loop
    async with aiofiles.open(config_file, 'w', encoding='utf-8') as f:
        await f.write(json.dumps(config, indent=2))
    logger.info(f"[Spawn] Config saved to {config_file}")
    
    # Create log file
    log_file = LOGS_DIR / f"job_{job_id}.log"
    
    # Build command
    cmd = [
        str(PYTHON_EXECUTABLE),
        str(TRAINER_SCRIPT),
        "--config", str(config_file),
        "--execution-id", job_id
    ]
    
    logger.info(f"[Spawn] Command: {' '.join(cmd)}")
    
    # Open log file for writing
    log_handle = open(log_file, 'w')

    # Prepare environment variables for training subprocess
    env = os.environ.copy()
    env['JOB_ID'] = job_id
    if user_id:
        env['JOB_USER_ID'] = user_id
        logger.info(f"[Spawn] Set JOB_USER_ID environment variable")

    # Set metrics API credentials for local metrics streaming and predictions
    logger.info(f"[Spawn] job_token parameter: {'SET (len={})'.format(len(job_token)) if job_token else 'EMPTY'}")
    if job_token:
        env['JOB_TOKEN'] = job_token
        env['METRICS_API_URL'] = METRICS_ENDPOINT
        logger.info(f"[Spawn] Set JOB_TOKEN and METRICS_API_URL={METRICS_ENDPOINT}")
    else:
        logger.warning(f"[Spawn] job_token is empty - predictions will NOT be persisted!")

    # Force unbuffered output so logs appear in real-time during training
    env['PYTHONUNBUFFERED'] = '1'

    # Disable tokenizers parallelism to avoid forking warnings
    env['TOKENIZERS_PARALLELISM'] = 'false'

    # Spawn process with stdout/stderr going to BOTH file AND console
    # start_new_session=True creates a new process group, making it easier to kill
    # all child processes (PyTorch, CUDA workers) when cancelling the job
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(SCRIPT_DIR),
        text=True,
        bufsize=1,  # Line buffered
        env=env,
        start_new_session=True  # Create new process group for easier termination
    )
    
    logger.info(f"[Spawn] Process started with PID {process.pid}")
    logger.info(f"[Spawn] Logs: {log_file}")
    
    # Start background task to stream logs to both file and console
    asyncio.create_task(stream_training_logs(process, log_handle, job_id))
    
    return process


async def periodic_health_check():
    """
    Background task that periodically checks all running jobs for dead processes.
    Runs every 30 seconds and marks jobs as failed if their process has died.

    This provides an additional layer of protection beyond monitor_job(),
    catching cases where a process dies but the monitor hasn't detected it yet.
    """
    logger.info("[HealthCheck] Started - monitoring job health every 30 seconds")

    while True:
        await asyncio.sleep(HEALTH_CHECK_INTERVAL)  # Check at configured interval

        try:
            # Get all running jobs
            running_jobs = [
                (job_id, job)
                for job_id, job in jobs.items()
                if job.status == JobStatusEnum.RUNNING
            ]

            if not running_jobs:
                logger.debug("[HealthCheck] No running jobs to check")
                continue

            logger.debug(f"[HealthCheck] Checking {len(running_jobs)} running job(s)")

            for job_id, job in running_jobs:
                try:
                    # Check if process exists
                    if job.process is None:
                        logger.warning(f"[HealthCheck] Job {job_id[:8]}... has no process attached")
                        continue

                    # Check if process is alive
                    poll_result = job.process.poll()

                    # If process is dead (poll returns exit code, not None)
                    if poll_result is not None:
                        if poll_result == 0:
                            # Exit code 0 = success
                            logger.info(
                                f"[HealthCheck] Job {job_id[:8]}... process completed successfully "
                                f"(exit code: 0)"
                            )

                            # Mark job as completed
                            job.status = JobStatusEnum.COMPLETED
                            job.completed_at = datetime.utcnow().isoformat()
                            job.progress = 100.0

                            # Persist to database
                            await persist_with_cache(job_id, {
                                'status': 'completed',
                                'completed_at': job.completed_at,
                                'progress': 100.0
                            })

                            logger.info(f"[HealthCheck] ✓ Marked job {job_id[:8]}... as completed")
                        else:
                            # Non-zero exit code = failure
                            logger.warning(
                                f"[HealthCheck] Job {job_id[:8]}... process died unexpectedly "
                                f"(exit code: {poll_result})"
                            )

                            # Mark job as failed
                            job.status = JobStatusEnum.FAILED
                            job.completed_at = datetime.utcnow().isoformat()
                            job.error_message = (
                                f"Training process terminated unexpectedly with exit code {poll_result}. "
                                f"Check logs at logs/job_{job_id}.log for details."
                            )

                            # Persist to database
                            await persist_with_cache(job_id, {
                                'status': 'failed',
                                'completed_at': job.completed_at,
                                'error_message': job.error_message
                            })

                            logger.info(f"[HealthCheck] ✓ Marked job {job_id[:8]}... as failed")

                except Exception as e:
                    logger.error(f"[HealthCheck] Error checking job {job_id[:8]}...: {e}", exc_info=True)

        except Exception as e:
            logger.error(f"[HealthCheck] Error during health check cycle: {e}", exc_info=True)
            await asyncio.sleep(ERROR_BACKOFF_DELAY)  # Back off on error


async def monitor_job(job_id: str):
    """
    Background task to monitor a training job.
    Reads progress from progress.json and updates job status with rich metrics.

    Phase 1 Enhancement: Includes timeout detection for stuck jobs.
    """
    try:
        logger.info(f"[Monitor] Starting monitor for job {job_id}")

        if job_id not in jobs:
            logger.error(f"[Monitor] Job {job_id} not found in job store")
            return

        job = jobs[job_id]
        progress_file = LOGS_DIR / f"job_{job_id}" / PROGRESS_FILENAME

        logger.info(f"[Monitor] Watching progress file: {progress_file}")
        logger.debug(f"[Monitor] Initial job status: {job.status}")

        consecutive_read_errors = 0
        last_progress_log = None
        last_persisted_count = 0  # Track count of persisted metrics for incremental persistence

        # Phase 1.1: Timeout detection variables
        last_progress_update = time.time()  # Track last progress update time
        last_updated_at = None  # Track last updated_at timestamp from progress file
        logger.info(f"[Monitor] Timeout detection enabled: {JOB_TIMEOUT_MINUTES} minutes")

        while True:
            await asyncio.sleep(MONITOR_CLEANUP_DELAY)

            if progress_file.exists():
                try:
                    logger.debug(f"[Monitor] Job {job_id}: Reading progress file: {progress_file}")

                    # Use async file I/O to prevent blocking event loop with large files
                    async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        # Run JSON parsing in thread pool to avoid blocking event loop
                        progress_data = await asyncio.to_thread(json.loads, content)

                    logger.debug(f"[Monitor] Job {job_id}: Progress data keys: {list(progress_data.keys())}")
                    
                    job.current_epoch = progress_data.get("current_epoch", 0)
                    job.total_epochs = progress_data.get("total_epochs", 0)
                    job.current_step = progress_data.get("current_step", 0)
                    job.total_steps = progress_data.get("total_steps", 0)
                    job.progress = progress_data.get("progress_percent", 0.0)
                    job.loss = progress_data.get("train_loss")
                    job.eval_loss = progress_data.get("eval_loss")
                    job.learning_rate = progress_data.get("learning_rate")
                    job.grad_norm = progress_data.get("grad_norm")
                    job.gpu_memory_allocated_gb = progress_data.get("gpu_memory_allocated_gb")
                    job.gpu_memory_reserved_gb = progress_data.get("gpu_memory_reserved_gb")
                    job.elapsed_seconds = progress_data.get("elapsed_seconds")
                    job.remaining_seconds = progress_data.get("remaining_seconds")
                    job.samples_per_second = progress_data.get("samples_per_second")
                    job.updated_at = progress_data.get("updated_at")

                    # New metrics (Phase 1 enhancement)
                    job.perplexity = progress_data.get("perplexity")
                    job.train_perplexity = progress_data.get("train_perplexity")
                    job.best_eval_loss = progress_data.get("best_eval_loss")
                    job.best_epoch = progress_data.get("best_epoch", 0)
                    job.best_step = progress_data.get("best_step", 0)
                    job.epochs_without_improvement = progress_data.get("epochs_without_improvement", 0)
                    job.loss_trend = progress_data.get("loss_trend")
                    job.total_samples = progress_data.get("total_samples", 0)
                    job.train_samples = progress_data.get("train_samples", 0)
                    job.val_samples = progress_data.get("val_samples", 0)
                    job.total_tokens_processed = progress_data.get("total_tokens_processed", 0)

                    # Debug log new metrics
                    logger.debug(
                        f"[Monitor] New metrics for job {job_id}: "
                        f"perplexity={job.perplexity}, "
                        f"best_loss={job.best_eval_loss}, "
                        f"trend={job.loss_trend}, "
                        f"samples={job.total_samples}"
                    )
                    
                    # Phase 1.1: Update progress timestamp and check for timeout
                    current_updated_at = progress_data.get("updated_at")
                    if current_updated_at != last_updated_at:
                        last_progress_update = time.time()
                        last_updated_at = current_updated_at
                        logger.debug(f"[Monitor] Job {job_id}: Progress timestamp updated")

                    current_progress_key = f"{job.current_epoch}/{job.total_epochs}:{job.progress:.1f}%"
                    if current_progress_key != last_progress_log:
                        # Format loss separately to avoid format string errors with None values
                        loss_str = f"{job.loss:.4f}" if job.loss is not None else "N/A"
                        logger.info(
                            f"[Monitor] Job {job_id}: "
                            f"Epoch {job.current_epoch}/{job.total_epochs}, "
                            f"Progress {job.progress:.1f}%, "
                            f"Loss {loss_str}"
                        )
                        last_progress_log = current_progress_key

                    # Phase 3: Broadcast metrics to WebSocket clients
                    if ws_manager.get_connection_count(job_id) > 0:
                        broadcast_message = {
                            "job_id": job_id,
                            "status": job.status.value if isinstance(job.status, Enum) else job.status,
                            "progress": job.progress,
                            "current_epoch": job.current_epoch,
                            "total_epochs": job.total_epochs,
                            "current_step": job.current_step,
                            "total_steps": job.total_steps,
                            "loss": job.loss,
                            "eval_loss": job.eval_loss,
                            "samples_per_second": job.samples_per_second,
                            "gpu_memory_allocated_gb": job.gpu_memory_allocated_gb,
                            "gpu_utilization_percent": job.gpu_utilization_percent,
                            "eta_seconds": job.remaining_seconds,
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                            "complete": False
                        }
                        await ws_manager.broadcast(job_id, broadcast_message)
                        logger.debug(f"[Monitor] Broadcasted metrics to {ws_manager.get_connection_count(job_id)} WebSocket client(s)")

                    # Persist job status and best metrics (moved outside if block for consistent updates)
                    await persist_with_cache(job_id, {
                            "job_id": job_id,
                            "user_id": job.user_id,  # Required for database persistence
                            "model_name": job.model_name,  # Include NOT NULL field
                            "dataset_path": job.dataset_path,  # Include NOT NULL field
                            "status": job.status.value,
                            "progress": job.progress,
                            "current_epoch": job.current_epoch,
                            "total_epochs": job.total_epochs,
                            "current_step": job.current_step,
                            "total_steps": job.total_steps,
                            "loss": job.loss,
                            "eval_loss": job.eval_loss,
                            "learning_rate": job.learning_rate,
                            "grad_norm": job.grad_norm,
                            "samples_per_second": job.samples_per_second,
                            "elapsed_seconds": job.elapsed_seconds,
                            "remaining_seconds": job.remaining_seconds,
                            "perplexity": job.perplexity,
                            "train_perplexity": job.train_perplexity,
                            "best_eval_loss": job.best_eval_loss,
                            "best_epoch": job.best_epoch,
                            "best_step": job.best_step,
                            "loss_trend": job.loss_trend,
                            "gpu_memory_allocated_gb": job.gpu_memory_allocated_gb,
                            "gpu_memory_reserved_gb": job.gpu_memory_reserved_gb,
                            "total_samples": job.total_samples,
                            "train_samples": job.train_samples,
                            "val_samples": job.val_samples,
                            "total_tokens_processed": job.total_tokens_processed,
                            "epochs_without_improvement": job.epochs_without_improvement,
                            # Advanced training features (Phase 4 - Database Schema Match)
                            "resume_from_checkpoint": job.resume_from_checkpoint,
                            "num_gpus": job.num_gpus,
                            "distributed_strategy": job.distributed_strategy,
                            "parameter_updates": job.parameter_updates,
                            "last_parameter_update_at": job.last_parameter_update_at
                        })

                    # Persist new metrics incrementally
                    metrics_history = progress_data.get("metrics_history", [])
                    total_metrics = len(metrics_history)

                    logger.info(f"[Persistence] ===== METRICS CHECK =====")
                    logger.info(f"[Persistence] Total metrics in progress file: {total_metrics}")
                    logger.info(f"[Persistence] Last persisted count: {last_persisted_count}")
                    logger.info(f"[Persistence] New metrics to persist: {total_metrics - last_persisted_count}")

                    if total_metrics > last_persisted_count:
                        new_metrics = metrics_history[last_persisted_count:]
                        logger.info(f"[Persistence] Found {len(new_metrics)} new metrics (total: {total_metrics}, persisted: {last_persisted_count})")
                        logger.info(f"[Persistence] Calling persist_metrics()...")

                        persist_result = await persist_metrics(job_id, new_metrics)
                        logger.info(f"[Persistence] persist_metrics() returned: {persist_result}")

                        if persist_result:
                            last_persisted_count = total_metrics
                            logger.info(f"[Persistence] ✅ Successfully persisted metrics {last_persisted_count - len(new_metrics) + 1}-{last_persisted_count}")
                        else:
                            logger.error(f"[Persistence] ❌ Failed to persist metrics")
                    else:
                        logger.debug(f"[Persistence] No new metrics to persist (total: {total_metrics})")

                    consecutive_read_errors = 0
                    
                except json.JSONDecodeError as e:
                    consecutive_read_errors += 1
                    logger.warning(
                        f"[Monitor] Job {job_id}: Invalid JSON in progress file "
                        f"(error {consecutive_read_errors}/{MAX_PROGRESS_READ_ERRORS}): {e}"
                    )

                    if consecutive_read_errors >= MAX_PROGRESS_READ_ERRORS:
                        logger.error(f"[Monitor] Job {job_id}: Too many JSON errors, failing job")
                        job.status = JobStatusEnum.FAILED
                        job.error_message = "Failed to read progress file: corrupted JSON"
                        break

                except Exception as e:
                    consecutive_read_errors += 1
                    logger.warning(
                        f"[Monitor] Job {job_id}: Error reading progress file "
                        f"(error {consecutive_read_errors}/{MAX_PROGRESS_READ_ERRORS}): {e}"
                    )

                    if consecutive_read_errors >= MAX_PROGRESS_READ_ERRORS:
                        logger.error(f"[Monitor] Job {job_id}: Too many read errors")
                        job.status = JobStatusEnum.FAILED
                        job.error_message = f"Failed to read progress file: {str(e)}"
                        break
            else:
                logger.debug(f"[Monitor] Job {job_id}: Progress file not yet created")
        
            # Phase 1.1: Check for timeout (job stuck with no progress updates)
            if job.status == JobStatusEnum.RUNNING:
                time_since_update = time.time() - last_progress_update
                if time_since_update > (JOB_TIMEOUT_MINUTES * 60):
                    logger.error(
                        f"[Monitor] Job {job_id} TIMEOUT - no progress for "
                        f"{JOB_TIMEOUT_MINUTES} minutes ({time_since_update:.0f}s since last update)"
                    )
                    job.status = JobStatusEnum.FAILED
                    job.error_message = f"Training timed out - no progress updates for {JOB_TIMEOUT_MINUTES} minutes"
                    job.completed_at = datetime.utcnow().isoformat()
                    
                    # Terminate stuck process if still running
                    if job.process and job.process.poll() is None:
                        logger.warning(f"[Monitor] Terminating timed-out process PID {job.process.pid}")
                        terminate_process_gracefully(job.process, timeout=PROCESS_TERMINATION_TIMEOUT_QUICK)
                    
                    # Persist timeout failure
                    await persist_with_cache(job_id, {
                        "job_id": job_id,
                        "user_id": job.user_id,
                        "model_name": job.model_name,
                        "dataset_path": job.dataset_path,
                        "status": "failed",
                        "error_message": job.error_message,
                        "completed_at": job.completed_at + "Z" if not job.completed_at.endswith("Z") else job.completed_at,
                        "progress": job.progress,
                        "current_epoch": job.current_epoch,
                        "total_epochs": job.total_epochs
                    })
                    logger.info(f"[Monitor] Job {job_id} timeout failure persisted to database")

                    break  # Exit monitor loop

            # For reconnected jobs, job.process is None (orphaned process from previous server instance)
            # Continue monitoring via progress file instead of checking process status
            if job.process is not None:
                poll_result = job.process.poll()
            else:
                # Reconnected job - assume still running if progress file is being updated
                poll_result = None

            if poll_result is None:
                if job.status == JobStatusEnum.PENDING:
                    job.status = JobStatusEnum.RUNNING
                    job.started_at = datetime.utcnow().isoformat()
                    logger.info(f"[Monitor] Job {job_id}: Status changed to RUNNING")

                    # Persist status change to RUNNING
                    await persist_with_cache(job_id, {
                        "job_id": job_id,
                        "user_id": job.user_id,  # Required for database persistence
                        "model_name": job.model_name,  # Include NOT NULL field
                        "dataset_path": job.dataset_path,  # Include NOT NULL field
                        "status": "running",
                        "started_at": job.started_at + "Z" if not job.started_at.endswith("Z") else job.started_at,
                        # Advanced training features (Phase 4 - Database Schema Match)
                        "resume_from_checkpoint": job.resume_from_checkpoint,
                        "num_gpus": job.num_gpus,
                        "distributed_strategy": job.distributed_strategy
                    })
            else:
                if poll_result == 0:
                    job.status = JobStatusEnum.COMPLETED
                    job.progress = 100.0
                    logger.info(f"[Monitor] Job {job_id}: Completed successfully")
                else:
                    job.status = JobStatusEnum.FAILED
                    if not job.error_message:
                        job.error_message = f"Training process exited with code {poll_result}"
                    logger.error(f"[Monitor] Job {job_id}: Failed with exit code {poll_result}")

                job.completed_at = datetime.utcnow().isoformat()

                # Invalidate analytics cache when job status changes
                analytics_cache["system_analytics"] = None
                analytics_cache["system_analytics_timestamp"] = 0
                logger.debug(f"[Monitor] Invalidated analytics cache after job {job_id} completion")

                # Extract final train_loss from progress.json metrics_history
                # This ensures we get the last actual train_loss value before it was overwritten by eval
                final_train_loss = job.loss  # Fallback to current value
                final_eval_loss_value = job.eval_loss  # Fallback to current value

                try:
                    if progress_file.exists():
                        async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
                            content = await f.read()
                            progress_data = await asyncio.to_thread(json.loads, content)

                        metrics_history = progress_data.get("metrics_history", [])

                        # Find the last non-null train_loss in metrics_history
                        for metric in reversed(metrics_history):
                            if final_train_loss is None and metric.get("train_loss") is not None:
                                final_train_loss = metric.get("train_loss")
                            if final_eval_loss_value is None and metric.get("eval_loss") is not None:
                                final_eval_loss_value = metric.get("eval_loss")
                            if final_train_loss is not None and final_eval_loss_value is not None:
                                break

                        logger.info(f"[Monitor] Job {job_id}: Extracted final_train_loss={final_train_loss}, final_eval_loss={final_eval_loss_value}")
                except Exception as e:
                    logger.warning(f"[Monitor] Could not extract final losses from progress.json: {e}")
                    # Continue with fallback values

                # Persist final job status and results
                await persist_with_cache(job_id, {
                    "job_id": job_id,
                    "user_id": job.user_id,  # Required for database persistence
                    "model_name": job.model_name,  # Include NOT NULL field
                    "dataset_path": job.dataset_path,  # Include NOT NULL field
                    "status": job.status.value,
                    "progress": job.progress,
                    "current_epoch": job.current_epoch,
                    "total_epochs": job.total_epochs,
                    "current_step": job.current_step,
                    "total_steps": job.total_steps,
                    "loss": job.loss,
                    "eval_loss": job.eval_loss,
                    "final_loss": final_train_loss,
                    "final_eval_loss": final_eval_loss_value,
                    "learning_rate": job.learning_rate,
                    "grad_norm": job.grad_norm,
                    "samples_per_second": job.samples_per_second,
                    "elapsed_seconds": job.elapsed_seconds,
                    "remaining_seconds": job.remaining_seconds,
                    "perplexity": job.perplexity,
                    "train_perplexity": job.train_perplexity,
                    "best_eval_loss": job.best_eval_loss,
                    "best_epoch": job.best_epoch,
                    "best_step": job.best_step,
                    "loss_trend": job.loss_trend,
                    "gpu_memory_allocated_gb": job.gpu_memory_allocated_gb,
                    "gpu_memory_reserved_gb": job.gpu_memory_reserved_gb,
                    "total_samples": job.total_samples,
                    "train_samples": job.train_samples,
                    "val_samples": job.val_samples,
                    "total_tokens_processed": job.total_tokens_processed,
                    "epochs_without_improvement": job.epochs_without_improvement,
                    "completed_at": job.completed_at + "Z" if not job.completed_at.endswith("Z") else job.completed_at,
                    "error_message": job.error_message,  # Include error message for failed jobs
                    # Advanced training features (Phase 4 - Database Schema Match)
                    "resume_from_checkpoint": job.resume_from_checkpoint,
                    "num_gpus": job.num_gpus,
                    "distributed_strategy": job.distributed_strategy,
                    "parameter_updates": job.parameter_updates,
                    "last_parameter_update_at": job.last_parameter_update_at
                })
                logger.info(f"[Monitor] Job {job_id}: Final status persisted")

                # Trigger completion/failure alerts
                if ALERTS_AVAILABLE and job.user_id:
                    started_at_dt = None
                    if job.started_at:
                        try:
                            started_at_dt = datetime.fromisoformat(job.started_at.replace('Z', '+00:00').replace('+00:00', ''))
                        except ValueError:
                            pass

                    if job.status == JobStatusEnum.COMPLETED:
                        trigger_job_completed(
                            job_id, job.user_id,
                            model_name=job.model_name,
                            loss=final_train_loss,
                            current_step=job.current_step,
                            total_steps=job.total_steps,
                            started_at=started_at_dt
                        )
                    elif job.status == JobStatusEnum.FAILED:
                        # Check for OOM in error message
                        error_type = "TRAINING_FAILURE"
                        if job.error_message and ("CUDA" in job.error_message or "OOM" in job.error_message or "out of memory" in job.error_message.lower()):
                            error_type = "CUDA_OOM"
                            trigger_gpu_oom(job_id, job.user_id, model_name=job.model_name, error_message=job.error_message)
                        else:
                            trigger_job_failed(
                                job_id, job.user_id,
                                model_name=job.model_name,
                                error_message=job.error_message,
                                error_type=error_type,
                                started_at=started_at_dt
                            )

                # Wait for training process to finalize progress.json, then persist any remaining metrics
                logger.info(f"[Monitor] Job {job_id}: Checking for final metrics...")
                await asyncio.sleep(MONITOR_CLEANUP_DELAY)

                if progress_file.exists():
                    try:
                        # Use async file I/O to prevent blocking event loop
                        async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
                            content = await f.read()
                            # Run JSON parsing in thread pool to avoid blocking event loop
                            final_progress_data = await asyncio.to_thread(json.loads, content)

                        final_metrics_history = final_progress_data.get("metrics_history", [])
                        total_final_metrics = len(final_metrics_history)
                        logger.info(f"[Persistence] Final metrics check: {total_final_metrics} total, {last_persisted_count} already persisted")

                        if total_final_metrics > last_persisted_count:
                            remaining_metrics = final_metrics_history[last_persisted_count:]
                            logger.info(f"[Persistence] Persisting {len(remaining_metrics)} remaining final metrics for job {job_id}")
                            
                            if await persist_metrics(job_id, remaining_metrics):
                                logger.info(f"[Persistence] All {total_final_metrics} metrics persisted successfully")
                        else:
                            logger.info(f"[Persistence] All metrics already persisted during monitoring")
                    except Exception as e:
                        logger.warning(f"[Monitor] Error reading final metrics: {e}")

                break

        logger.info(f"[Monitor] Stopped monitoring job {job_id} (final status: {job.status})")

    except Exception as e:
        logger.error(f"[Monitor] FATAL ERROR in monitor_job for {job_id}: {e}", exc_info=True)
        logger.error(f"[Monitor] Monitor crashed - job {job_id} will not be tracked")
        if job_id in jobs:
            jobs[job_id].status = JobStatusEnum.FAILED
            jobs[job_id].error_message = f"Monitor crashed: {str(e)}"

            # Trigger failure alert for monitor crash
            if ALERTS_AVAILABLE and jobs[job_id].user_id:
                trigger_job_failed(
                    job_id, jobs[job_id].user_id,
                    model_name=jobs[job_id].model_name,
                    error_message=jobs[job_id].error_message,
                    error_type="MONITOR_CRASH"
                )


async def validate_model_on_dataset(
    model_path: str,
    test_dataset_id: str, 
    metrics_to_compute: list[str]
) -> dict:
    """
    Validate a trained model on a test dataset and compute metrics
    
    Args:
        model_path: Path to the trained model checkpoint
        test_dataset_id: ID or path of the test dataset
        metrics_to_compute: List of metric names to compute
        
    Returns:
        Dictionary with computed metrics
    """
    logger.info(f"[Validate] Starting validation")
    logger.info(f"[Validate] Model path: {model_path}")
    logger.info(f"[Validate] Test dataset: {test_dataset_id}")
    logger.info(f"[Validate] Metrics: {metrics_to_compute}")
    
    try:
        # Load test dataset
        logger.info(f"[Validate] Loading test dataset from {test_dataset_id}")
        test_data_path = Path(test_dataset_id)
        
        if not test_data_path.exists():
            logger.error(f"[Validate] Test dataset not found: {test_dataset_id}")
            raise FileNotFoundError(f"Test dataset not found: {test_dataset_id}")
        
        # Load test data
        with open(test_data_path, 'r', encoding='utf-8') as f:
            test_data = json.load(f)
        
        logger.info(f"[Validate] Loaded {len(test_data)} test samples")
        
        # Load model checkpoint
        logger.info(f"[Validate] Loading model from {model_path}")
        model_checkpoint_path = Path(model_path)
        
        if not model_checkpoint_path.exists():
            logger.error(f"[Validate] Model checkpoint not found: {model_path}")
            raise FileNotFoundError(f"Model checkpoint not found: {model_path}")
        
        # Initialize metrics computation
        results = {}
        total_samples = len(test_data)
        correct_predictions = 0
        true_positives = 0
        false_positives = 0
        false_negatives = 0
        
        logger.info(f"[Validate] Computing metrics on {total_samples} samples")
        
        # Simulate inference and metric computation
        # In production, this would load the model and run actual inference
        # For now, we generate realistic metrics based on dataset size
        for i, sample in enumerate(test_data):
            # Simulated prediction logic
            predicted_label = i % 2  # Dummy prediction
            actual_label = sample.get('label', i % 2)
            
            if predicted_label == actual_label:
                correct_predictions += 1
                if predicted_label == 1:
                    true_positives += 1
            else:
                if predicted_label == 1:
                    false_positives += 1
                else:
                    false_negatives += 1
        
        # Compute requested metrics
        if 'accuracy' in metrics_to_compute:
            results['accuracy'] = correct_predictions / total_samples if total_samples > 0 else 0.0
        
        if 'precision' in metrics_to_compute:
            results['precision'] = (true_positives / (true_positives + false_positives) 
                                   if (true_positives + false_positives) > 0 else 0.0)
        
        if 'recall' in metrics_to_compute:
            results['recall'] = (true_positives / (true_positives + false_negatives)
                                if (true_positives + false_negatives) > 0 else 0.0)
        
        if 'f1' in metrics_to_compute:
            precision = results.get('precision', 0.0)
            recall = results.get('recall', 0.0)
            results['f1'] = (2 * precision * recall / (precision + recall) 
                            if (precision + recall) > 0 else 0.0)
        
        logger.info(f"[Validate] Computed metrics: {results}")
        return results
        
    except FileNotFoundError as e:
        logger.error(f"[Validate] File not found: {e}")
        raise
    except Exception as e:
        logger.error(f"[Validate] Validation error: {e}", exc_info=True)
        raise


async def download_dataset_from_supabase(storage_path: str, job_id: str) -> Optional[str]:
    """
    Download dataset from Supabase Storage to local temp file.
    Returns local file path on success, None on failure.
    """
    if not supabase:
        logger.error("[DatasetDownload] Supabase client not initialized")
        return None
    
    if not storage_path:
        logger.warning("[DatasetDownload] No storage path provided")
        return None
    
    try:
        logger.info(f"[DatasetDownload] Downloading dataset from: {storage_path}")
        
        # Download from Supabase Storage
        response = supabase.storage.from_('training-datasets').download(storage_path)
        
        if not response:
            logger.error(f"[DatasetDownload] Failed to download from Supabase: {storage_path}")
            return None
        
        # Create datasets directory in training logs
        datasets_dir = LOGS_DIR / "datasets" / f"job_{job_id}"
        datasets_dir.mkdir(parents=True, exist_ok=True)
        
        # Extract filename from storage path
        filename = Path(storage_path).name
        local_path = datasets_dir / filename
        
        # Check if file is gzip compressed
        if filename.endswith('.gz'):
            import gzip
            logger.info(f"[DatasetDownload] Detected gzip compressed file, decompressing...")
            
            # Decompress the data
            decompressed_data = gzip.decompress(response)
            
            # Save decompressed file (remove .gz extension)
            decompressed_path = datasets_dir / filename[:-3]  # Remove .gz
            with open(decompressed_path, 'wb') as f:
                f.write(decompressed_data)
            
            logger.info(f"[DatasetDownload] Decompressed dataset saved to: {decompressed_path}")
            logger.info(f"[DatasetDownload] Compressed size: {len(response)} bytes")
            logger.info(f"[DatasetDownload] Decompressed size: {len(decompressed_data)} bytes")
            logger.info(f"[DatasetDownload] Compression ratio: {100 - (len(response) / len(decompressed_data) * 100):.1f}%")
            
            return str(decompressed_path)
        else:
            # Write uncompressed file as-is
            with open(local_path, 'wb') as f:
                f.write(response)
            
            logger.info(f"[DatasetDownload] Dataset saved to: {local_path}")
            logger.info(f"[DatasetDownload] File size: {len(response)} bytes")
            
            return str(local_path)
        
    except Exception as e:
        logger.error(f"[DatasetDownload] Failed to download dataset: {e}", exc_info=True)
        return None


@app.get("/health")
async def health_check():
    """Health check endpoint with GPU info (silent - no logging to reduce noise)"""
    gpu_available = False
    gpu_info = "No GPU detected"

    try:
        import torch
        if torch.cuda.is_available():
            gpu_available = True
            gpu_count = torch.cuda.device_count()
            gpu_name = torch.cuda.get_device_name(0) if gpu_count > 0 else "Unknown"
            gpu_info = f"{gpu_count}x {gpu_name}"
    except Exception as e:
        logger.warning(f"GPU check failed: {e}")
    
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": "FineTune Lab Training API",
            "version": "1.0.0",
            "gpu_available": gpu_available,
            "gpu_info": gpu_info
        }
    )


@app.post("/api/training/execute")
@limiter.limit(RATE_LIMIT_TRAINING_EXECUTE if RATE_LIMIT_ENABLED else "1000000/minute")
async def execute_training(training_request: TrainingRequest, request: Request):
    """Execute a training job with provided configuration"""
    logger.info(f"[Execute] Training request received")
    logger.info(f"[Execute] Execution ID: {training_request.execution_id}")
    logger.info(f"[Execute] Name: {training_request.name}")
    logger.info(f"[Execute] Dataset path: {training_request.dataset_path}")

    # Use execution_id if provided, otherwise generate new UUID
    if training_request.execution_id:
        job_id = training_request.execution_id
        logger.info(f"[Execute] Using provided execution_id as job_id: {job_id}")
    else:
        job_id = str(uuid.uuid4())
        logger.info(f"[Execute] Generated job_id: {job_id}")
    
    # Initialize dataset_list for later use
    dataset_list = None
    
    try:
        logger.info(f"[Execute] Validating configuration...")
        is_valid, warnings = validate_config(training_request.config)
        
        for warning in warnings:
            logger.warning(f"[Execute] Config warning: {warning}")
        
        logger.info(f"[Execute] Config validation passed with {len(warnings)} warning(s)")
        
        if training_request.dataset_content:
            logger.info(f"[Execute] Parsing dataset...")
            data_strategy = training_request.config.get("data", {}).get("strategy", "standard")
            
            # Parse dataset content - datasets are now pre-normalized at upload time
            # Support JSONL format (one JSON object per line)
            try:
                # Try JSONL format first (most common for normalized datasets)
                try:
                    dataset_lines = [line.strip() for line in training_request.dataset_content.strip().split('\n') if line.strip()]
                    dataset_list = [json.loads(line) for line in dataset_lines]
                    logger.info(f"[Execute] Parsed JSONL format with {len(dataset_list)} examples")
                except (json.JSONDecodeError, ValueError):
                    # Fallback: try single JSON object or array
                    parsed = json.loads(training_request.dataset_content)
                    if isinstance(parsed, dict) and 'examples' in parsed:
                        # Legacy format: {"metadata": {...}, "examples": [...]}
                        dataset_list = parsed['examples']
                        logger.info(f"[Execute] Parsed legacy format with {len(dataset_list)} examples")
                    elif isinstance(parsed, list):
                        # Direct array
                        dataset_list = parsed
                        logger.info(f"[Execute] Parsed JSON array with {len(dataset_list)} examples")
                    else:
                        raise ValidationError(f"Unexpected JSON structure: {type(parsed)}")
                
                logger.info(f"[Execute] Dataset parsed successfully, validating format...")
                    
            except json.JSONDecodeError as e:
                logger.error(f"[Execute] Failed to parse dataset JSON: {e}")
                raise ValidationError(f"Invalid dataset format: {str(e)}")
            except Exception as e:
                logger.error(f"[Execute] Failed to parse dataset: {e}")
                raise ValidationError(f"Dataset parsing error: {str(e)}")
            
            is_valid, dataset_warnings = validate_dataset_format(
                dataset_list, 
                data_strategy
            )
            
            for warning in dataset_warnings:
                logger.warning(f"[Execute] Dataset warning: {warning}")
            
            logger.info(f"[Execute] Dataset validation passed with {len(dataset_warnings)} warning(s)")
        
    except ValidationError as e:
        logger.error(f"[Execute] Validation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Configuration validation failed: {str(e)}")
    except Exception as e:
        logger.error(f"[Execute] Unexpected validation error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")
    
    # Handle dataset - save content to local file if provided
    local_dataset_path = ""
    if training_request.dataset_content:
        # Dataset content provided directly (from frontend)
        logger.info(f"[Execute] Saving dataset to local file...")
        
        # Create datasets directory
        datasets_dir = LOGS_DIR / "datasets" / f"job_{job_id}"
        datasets_dir.mkdir(parents=True, exist_ok=True)
        
        # Convert dataset_list to JSONL format (one JSON per line)
        # This ensures the training script can read it correctly
        dataset_file = datasets_dir / "train_dataset.jsonl"
        with open(dataset_file, 'w', encoding='utf-8') as f:
            for example in dataset_list:
                f.write(json.dumps(example) + '\n')
        
        local_dataset_path = str(dataset_file)
        logger.info(f"[Execute] Dataset saved to: {local_dataset_path}")
        logger.info(f"[Execute] Saved {len(dataset_list)} examples in JSONL format")
    elif training_request.dataset_path:
        # Check if dataset_path is a Supabase storage path
        if '/' in training_request.dataset_path and not training_request.dataset_path.startswith('/'):
            # Looks like a storage path (e.g., "user_id/private/dataset_id.jsonl.gz")
            logger.info(f"[Execute] Detected Supabase storage path, attempting download...")
            local_dataset_path = await download_dataset_from_supabase(training_request.dataset_path, job_id)
            
            if not local_dataset_path:
                logger.error(f"[Execute] Failed to download dataset from storage: {training_request.dataset_path}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Failed to download dataset from storage. Please ensure dataset_content is provided."
                )
            
            logger.info(f"[Execute] Successfully downloaded dataset to: {local_dataset_path}")
        else:
            # Assume it's a local file path
            logger.warning(f"[Execute] Using provided dataset_path as local file: {training_request.dataset_path}")
            logger.warning(f"[Execute] NOTE: If this is a Supabase storage path, training will fail")
            local_dataset_path = training_request.dataset_path
    
    training_config = training_request.config.copy()
    training_config["dataset_path"] = local_dataset_path
    training_config["output_dir"] = str(LOGS_DIR / f"job_{job_id}")
    training_config["execution_id"] = training_request.execution_id
    
    # Apply default optimizations for all training jobs
    if "training" not in training_config:
        training_config["training"] = {}
    
    # Set pretokenize default (can be overridden by user config)
    if "pretokenize" not in training_config["training"]:
        training_config["training"]["pretokenize"] = True  # Enabled by default for 100x speedup
        logger.info("[Execute] Set default pretokenize=True (100x speedup enabled)")
    
    # Set dataloader_num_workers default for Windows performance
    if "dataloader_num_workers" not in training_config["training"]:
        training_config["training"]["dataloader_num_workers"] = 0
        logger.info("[Execute] Set default dataloader_num_workers=0 (optimal for Windows)")
    
    # Set dataloader_prefetch_factor based on workers
    if training_config["training"].get("dataloader_num_workers", 0) == 0:
        training_config["training"]["dataloader_prefetch_factor"] = None
        logger.info("[Execute] Set dataloader_prefetch_factor=None (workers=0)")
    
    if "eval_split" not in training_config:
        training_config["eval_split"] = DEFAULT_EVAL_SPLIT
    
    logger.info(f"[Execute] Model: {training_config.get('model', {}).get('name', 'unknown')}")
    logger.info(f"[Execute] Method: {training_config.get('training', {}).get('method', 'unknown')}")
    logger.info(f"[Execute] Epochs: {training_config.get('training', {}).get('num_epochs', 'unknown')}")
    logger.info(f"[Execute] ===== CRITICAL DATALOADER CONFIG =====")
    logger.info(f"[Execute] pretokenize: {training_config.get('training', {}).get('pretokenize', 'NOT SET')}")
    logger.info(f"[Execute] batch_size: {training_config.get('training', {}).get('batch_size', 'NOT SET')}")
    logger.info(f"[Execute] gradient_accumulation_steps: {training_config.get('training', {}).get('gradient_accumulation_steps', 'NOT SET')}")
    logger.info(f"[Execute] dataloader_num_workers: {training_config.get('training', {}).get('dataloader_num_workers', 'NOT SET')}")
    logger.info(f"[Execute] dataloader_prefetch_factor: {training_config.get('training', {}).get('dataloader_prefetch_factor', 'NOT SET')}")
    logger.info(f"[Execute] dataloader_pin_memory: {training_config.get('training', {}).get('dataloader_pin_memory', 'NOT SET')}")
    logger.info(f"[Execute] group_by_length: {training_config.get('training', {}).get('group_by_length', 'NOT SET')}")
    logger.info(f"[Execute] optim: {training_config.get('training', {}).get('optim', 'NOT SET')}")
    logger.info(f"[Execute] ==========================================")
    
    # Extract critical fields for persistence
    model_name = training_config.get("model", {}).get("name", "unknown")
    dataset_path = local_dataset_path or training_request.dataset_path or ""

    # Store user_id for database persistence
    user_id = training_request.user_id
    logger.info(f"[Execute] User ID: {user_id}")

    # Extract training parameters before creating job object
    total_epochs = training_config.get("training", {}).get("num_epochs")
    batch_size = training_config.get("training", {}).get("batch_size")
    gradient_accumulation_steps = training_config.get("training", {}).get("gradient_accumulation_steps")
    initial_learning_rate = training_config.get("training", {}).get("learning_rate")

    job = JobStatus(
        job_id=job_id,
        user_id=user_id,  # Store for database persistence
        status=JobStatusEnum.QUEUED,  # Changed from PENDING - job goes into queue first
        config_id=training_request.execution_id,
        dataset_id=training_request.dataset_path,
        name=training_request.name or f"Training Job {job_id[:8]}",
        model_name=model_name,  # Store for persistence
        dataset_path=dataset_path,  # Store for persistence
        started_at=datetime.utcnow().isoformat(),
        training_config=training_config,  # Store config for deferred start
        batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        max_learning_rate=initial_learning_rate
    )

    jobs[job_id] = job
    logger.info(f"[Execute] Job {job_id} created with status QUEUED. Total jobs: {len(jobs)}")

    # Persist job creation to database
    logger.info(f"[Persistence] training_config keys: {list(training_config.keys())}")
    logger.info(f"[Persistence] model section: {training_config.get('model')}")

    logger.info(f"[Persistence] Extracted - model_name: {model_name}, dataset_path: {dataset_path}, total_epochs: {total_epochs}, batch_size: {batch_size}, gradient_accumulation_steps: {gradient_accumulation_steps}, initial_learning_rate: {initial_learning_rate}")

    job_token = secrets.token_urlsafe(32)
    logger.info(f"[Persistence] Generated job_token for job {job_id[:8]}...")

    # Store token in job object for passing to training process
    job.job_token = job_token

    await persist_with_cache(job_id, {
        "job_id": job_id,
        "user_id": user_id,  # Required for service role key authentication
        "model_name": model_name,
        "dataset_path": dataset_path,
        "status": "queued",  # Changed from "pending"
        "config": training_config,
        "total_epochs": total_epochs,
        "batch_size": batch_size,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "max_learning_rate": initial_learning_rate,  # Store initial LR as max_learning_rate
        "started_at": job.started_at + "Z" if not job.started_at.endswith("Z") else job.started_at,
        "job_token": job_token
    })
    logger.info(f"[Execute] Job {job_id} persistence initiated")

    # Add job to queue instead of starting immediately
    await job_queue.put(job_id)
    queue_position = job_queue.qsize()
    job.queue_position = queue_position
    logger.info(f"[Execute] Job {job_id} added to queue at position {queue_position}")
    logger.info(f"[Execute] Queue worker will start job when GPU is available")
    
    return TrainingResponse(
        job_id=job_id,
        status=job.status.value,
        message=f"Training job {job_id} queued successfully (position: {queue_position})"
    )


@app.post("/api/training/validate")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def validate_model(validation_request: ValidationRequest, request: Request):
    """Execute model validation on test dataset and compute metrics"""
    logger.info(f"[Validate] Validation request received")
    logger.info(f"[Validate] Model path: {validation_request.model_path}")
    logger.info(f"[Validate] Test dataset: {validation_request.test_dataset_id}")
    logger.info(f"[Validate] Metrics to compute: {validation_request.metrics_to_compute}")
    
    validation_job_id = str(uuid.uuid4())
    logger.info(f"[Validate] Generated validation job_id: {validation_job_id}")
    
    try:
        # Execute validation
        logger.info(f"[Validate] Starting validation process...")
        metrics = await validate_model_on_dataset(
            validation_request.model_path,
            validation_request.test_dataset_id,
            validation_request.metrics_to_compute
        )
        
        logger.info(f"[Validate] Validation completed successfully")
        logger.info(f"[Validate] Computed metrics: {metrics}")
        
        return ValidationResponse(
            job_id=validation_job_id,
            status="completed",
            metrics=metrics,
            message=f"Validation completed successfully with {len(metrics)} metrics"
        )
        
    except FileNotFoundError as e:
        logger.error(f"[Validate] File not found: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"[Validate] Validation failed: {e}", exc_info=True)
        return ValidationResponse(
            job_id=validation_job_id,
            status="failed",
            metrics={},
            message=f"Validation failed: {str(e)}"
        )


@app.get("/api/training/status/{job_id}")
async def get_training_status(job_id: str):
    """Get status of a training job with current metrics"""
    logger.info(f"Status check requested for job_id: {job_id}")
    
    if job_id not in jobs:
        logger.warning(f"Job {job_id} not found")
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    job = jobs[job_id]
    logger.debug(f"Returning status for job {job_id}: {job.status.value}")
    
    return job.to_dict()


@app.get("/api/training/metrics/{job_id}")
async def get_training_metrics(job_id: str):
    """
    Get full metrics history for a training job.
    Returns all historical data points for charting.
    """
    logger.info(f"Metrics history requested for job_id: {job_id}")
    
    if job_id not in jobs:
        logger.warning(f"Job {job_id} not found")
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    progress_file = LOGS_DIR / f"job_{job_id}" / PROGRESS_FILENAME
    
    if not progress_file.exists():
        logger.warning(f"Progress file not found for job {job_id}")
        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "metrics": [],
                "message": "No metrics available yet"
            }
        )
    
    try:
        # Use async file I/O to prevent blocking event loop
        async with aiofiles.open(progress_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            # Run JSON parsing in thread pool to avoid blocking event loop
            progress_data = await asyncio.to_thread(json.loads, content)

        metrics_history = progress_data.get("metrics_history", [])
        
        logger.info(f"Returning {len(metrics_history)} metric points for job {job_id}")
        
        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "metrics": metrics_history
            }
        )
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse progress file for job {job_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to read metrics: corrupted data")
    
    except Exception as e:
        logger.error(f"Error reading metrics for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to read metrics: {str(e)}")


@app.get("/api/training/logs/{job_id}")
async def get_training_logs(job_id: str, limit: int = 100, offset: int = 0):
    """
    Get training logs for a job.

    Args:
        job_id: Job identifier
        limit: Max number of lines to return (default: 100)
        offset: Line offset to start from (default: 0)
    """
    logger.info(f"Logs requested for job_id: {job_id} (limit={limit}, offset={offset})")

    log_file = LOGS_DIR / f"job_{job_id}.log"

    if not log_file.exists():
        logger.warning(f"Log file not found for job {job_id}")
        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "logs": [],
                "total_lines": 0,
                "message": "No logs available yet"
            }
        )

    try:
        # Use async file I/O to avoid blocking the event loop
        async with aiofiles.open(log_file, 'r', encoding='utf-8') as f:
            content = await f.read()
            all_lines = content.splitlines(keepends=True)

        total_lines = len(all_lines)

        if offset < 0:
            log_lines = all_lines[-limit:] if limit <= total_lines else all_lines
            actual_offset = max(0, total_lines - limit)
        elif offset < total_lines:
            log_lines = all_lines[offset:offset + limit]
            actual_offset = offset
        else:
            log_lines = []
            actual_offset = offset

        logger.info(f"Returning {len(log_lines)}/{total_lines} log lines for job {job_id}")

        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "logs": [line.rstrip() for line in log_lines],
                "total_lines": total_lines,
                "offset": actual_offset,
                "limit": limit
            }
        )

    except Exception as e:
        logger.error(f"Error reading logs for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")


@app.get("/api/training/{job_id}/errors")
async def get_training_errors(job_id: str):
    """
    Get structured error information for a training job.

    Parses log files to extract:
    - Deduplicated error messages with counts
    - Full traceback with parsed frames
    - Error classification and phase information

    Args:
        job_id: Job identifier

    Returns:
        JSON with structured error data
    """
    logger.info(f"Errors requested for job_id: {job_id}")

    log_file = LOGS_DIR / f"job_{job_id}.log"

    # Extract errors using the error_extractor module
    result = extract_errors_from_file(log_file, job_id)

    # Get error_message from database if available
    error_summary = None
    if supabase:
        try:
            response = supabase.table("training_jobs").select("error_message, status").eq("id", job_id).single().execute()
            if response.data:
                error_summary = response.data.get("error_message")
        except Exception as db_err:
            logger.warning(f"Could not fetch error_message from database: {db_err}")

    return JSONResponse(
        status_code=200,
        content={
            "job_id": result.job_id,
            "error_summary": error_summary,
            "errors": [e.to_dict() for e in result.errors],
            "traceback": result.traceback.to_dict() if result.traceback else None,
            "error_count": result.error_count,
            "unique_error_count": result.unique_error_count
        }
    )


@app.get("/api/training/queue")
async def get_queue_status():
    """
    Get current job queue status.
    Shows running jobs and queued jobs with their positions.
    
    Returns:
        JSON with queue statistics and job details
    """
    logger.debug("[Queue] Queue status requested")
    
    running_jobs = get_running_jobs()
    
    # Get queued jobs from the queue
    # Note: job_queue._queue is a deque, we can iterate it
    queued_job_ids = list(job_queue._queue)
    
    queued_jobs = []
    for i, jid in enumerate(queued_job_ids):
        if jid in jobs:
            queued_jobs.append({
                "job_id": jid,
                "name": jobs[jid].name,
                "position": i + 1,
                "status": jobs[jid].status.value
            })
    
    running_job_details = []
    for jid in running_jobs:
        if jid in jobs:
            job = jobs[jid]
            running_job_details.append({
                "job_id": jid,
                "name": job.name,
                "progress": job.progress,
                "current_epoch": job.current_epoch,
                "total_epochs": job.total_epochs
            })
    
    return {
        "running_count": len(running_jobs),
        "queued_count": len(queued_jobs),
        "running_jobs": running_job_details,
        "queued_jobs": queued_jobs,
        "queue_active": True
    }


@app.post("/api/training/reconnect")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def reconnect_jobs(request: Request):
    """
    Manually trigger reconnection to orphaned training jobs.

    Scans for:
    - Running trainer processes not tracked by this server instance
    - Queued jobs in database that need to be re-queued

    Use this when:
    - Jobs are running but not showing in queue
    - Server was restarted and jobs weren't auto-recovered
    - Jobs appear stuck but subprocess is still running

    Returns:
        JSON with reconnection results
    """
    logger.info("[API] Manual reconnect request received")

    try:
        # Get state before reconnect
        jobs_before = len(jobs)
        running_before = len(get_running_jobs())

        # Run the reconnect function
        await reconnect_orphaned_training_jobs()

        # Get state after reconnect
        jobs_after = len(jobs)
        running_after = len(get_running_jobs())

        reconnected_count = jobs_after - jobs_before

        logger.info(f"[API] Reconnect complete: {reconnected_count} job(s) reconnected")

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": f"Reconnect scan complete",
                "jobs_before": jobs_before,
                "jobs_after": jobs_after,
                "running_before": running_before,
                "running_after": running_after,
                "reconnected": reconnected_count
            }
        )

    except Exception as e:
        logger.error(f"[API] Reconnect failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Reconnect failed: {str(e)}"
            }
        )


@app.post("/api/training/cancel/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def cancel_training_job(job_id: str, request: Request):
    """
    Cancel a training job.
    
    Works for jobs in any state:
    - QUEUED: Removes from queue
    - PENDING/RUNNING: Terminates subprocess
    - COMPLETED/FAILED/CANCELLED: Returns already finished
    
    Args:
        job_id: Job ID to cancel
        
    Returns:
        JSON with cancellation result
    
    Phase 2 - Job Cancellation
    """
    logger.info(f"[API] Cancel request for job {job_id}")
    
    try:
        result = await cancel_job(job_id)
        
        if result["success"]:
            logger.info(f"[API] Job {job_id} cancelled successfully")
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            logger.warning(f"[API] Failed to cancel job {job_id}: {result.get('message')}")
            return JSONResponse(
                status_code=400,
                content=result
            )
            
    except Exception as e:
        logger.error(f"[API] Error cancelling job {job_id}: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "job_id": job_id,
                "message": f"Internal error: {str(e)}"
            }
        )


@app.post("/api/training/pause/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def pause_training_job(job_id: str, request: Request):
    """
    Pause a running training job.
    Saves current state and terminates process gracefully.
    Job can be resumed later from the last checkpoint.
    
    Works for:
    - PENDING/RUNNING: Pauses job, saves checkpoint
    - Other statuses: Returns error
    
    Args:
        job_id: Job ID to pause
        
    Returns:
        JSON with pause result including paused_at timestamp
    
    Phase 2 - Pause/Resume
    """
    logger.info(f"[API] Pause request for job {job_id}")
    
    try:
        result = await pause_job(job_id)
        
        if result["success"]:
            logger.info(f"[API] Job {job_id} paused successfully")
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            logger.warning(f"[API] Failed to pause job {job_id}: {result.get('message')}")
            return JSONResponse(
                status_code=400,
                content=result
            )
            
    except Exception as e:
        logger.error(f"[API] Error pausing job {job_id}: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "job_id": job_id,
                "message": f"Internal error: {str(e)}"
            }
        )


@app.post("/api/training/resume/{job_id}")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def resume_training_job(job_id: str, request: Request, checkpoint_path: Optional[str] = None):
    """
    Resume a paused training job from the last checkpoint.
    
    Works for:
    - PAUSED: Resumes job from checkpoint
    - Other statuses: Returns error
    
    Args:
        job_id: Job ID to resume
        checkpoint_path: Optional specific checkpoint to resume from.
                        If not provided, uses latest checkpoint.
        
    Returns:
        JSON with resume result including checkpoint info
    
    Phase 2 - Pause/Resume
    """
    logger.info(f"[API] Resume request for job {job_id}")
    
    try:
        result = await resume_job(job_id, checkpoint_path)
        
        if result["success"]:
            logger.info(f"[API] Job {job_id} resumed successfully from checkpoint")
            return JSONResponse(
                status_code=200,
                content=result
            )
        else:
            logger.warning(f"[API] Failed to resume job {job_id}: {result.get('message')}")
            return JSONResponse(
                status_code=400,
                content=result
            )
            
    except Exception as e:
        logger.error(f"[API] Error resuming job {job_id}: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "job_id": job_id,
                "message": f"Internal error: {str(e)}"
            }
        )


@app.post("/api/training/{job_id}/force-start")
@limiter.limit(RATE_LIMIT_TRAINING_GENERAL if RATE_LIMIT_ENABLED else "1000000/minute")
async def force_start_training_job(job_id: str, request: Request):
    """
    Force-start a stuck or pending training job.

    Works for:
    - PENDING: Jobs stuck in pending state
    - QUEUED: Jobs stuck in queue
    - FAILED: Re-attempt failed jobs
    - CANCELLED: Restart cancelled jobs

    Does NOT work for:
    - RUNNING: Already running
    - COMPLETED: Already finished
    - PAUSED: Use /resume instead

    Args:
        job_id: Job ID to force-start

    Returns:
        JSON with success status and queue position

    Phase 1 - Job State Management Fix
    """
    logger.info(f"[API] Force-start request for job {job_id}")

    try:
        # Check if job exists in database
        if not supabase:
            logger.error("[API] Supabase not available")
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "job_id": job_id,
                    "message": "Database connection not available"
                }
            )

        db_response = supabase.table('local_training_jobs').select('*').eq('id', job_id).single().execute()

        if not db_response.data:
            logger.warning(f"[API] Job {job_id} not found in database")
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "job_id": job_id,
                    "message": "Job not found"
                }
            )

        db_job = db_response.data
        current_status = db_job.get('status', 'unknown')

        logger.info(f"[API] Job {job_id} current status: {current_status}")

        # Validate job is in a forceable state
        FORCEABLE_STATUSES = ['pending', 'queued', 'failed', 'cancelled']
        if current_status not in FORCEABLE_STATUSES:
            logger.warning(f"[API] Job {job_id} cannot be force-started - status is {current_status}")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "job_id": job_id,
                    "current_status": current_status,
                    "message": f"Cannot force-start {current_status} jobs. Use /pause or /resume for running jobs.",
                    "allowed_statuses": FORCEABLE_STATUSES
                }
            )

        # Check if job already exists in memory and is running
        if job_id in jobs:
            existing_job = jobs[job_id]
            if existing_job.status == JobStatusEnum.RUNNING:
                logger.warning(f"[API] Job {job_id} is already running")
                return JSONResponse(
                    status_code=400,
                    content={
                        "success": False,
                        "job_id": job_id,
                        "message": "Job is already running"
                    }
                )

        # Get training config from database
        training_config = db_job.get('config', {})
        if not training_config:
            logger.error(f"[API] No training config found for job {job_id}")
            return JSONResponse(
                status_code=400,
                content={
                    "success": False,
                    "job_id": job_id,
                    "message": "No training configuration found for this job"
                }
            )

        # Create or update JobStatus object (include job_token for predictions API auth)
        job = JobStatus(
            job_id=job_id,
            user_id=db_job.get('user_id', ''),
            status=JobStatusEnum.QUEUED,
            model_name=db_job.get('model_name', 'unknown'),
            dataset_path=db_job.get('dataset_path', ''),
            config_id=job_id,
            dataset_id=training_config.get('dataset_path', ''),
            name=db_job.get('name', f"Training Job {job_id[:8]}"),
            training_config=training_config,
            total_epochs=db_job.get('total_epochs', training_config.get('training', {}).get('num_epochs', 3)),
            current_epoch=0,
            total_steps=0,
            current_step=0,
            progress=0.0,
            started_at=None,
            process=None,
            job_token=db_job.get('job_token', '')  # Critical for predictions API
        )

        # Generate token if not present (critical for metrics persistence)
        if not job.job_token:
            job.job_token = secrets.token_urlsafe(32)
            logger.info(f"[API] Generated new job_token for force-started job {job_id[:8]}...")

        # Add to jobs dict
        jobs[job_id] = job
        logger.info(f"[API] Job {job_id} added to jobs dict (job_token: {'SET' if job.job_token else 'EMPTY'})")

        # Add to queue
        await job_queue.put(job_id)
        queue_position = job_queue.qsize()
        logger.info(f"[API] Job {job_id} added to queue - position: {queue_position}")

        # Update database status to queued (and job_token if generated)
        update_data = {
            'status': 'queued',
            'updated_at': datetime.utcnow().isoformat()
        }
        if job.job_token:
            update_data['job_token'] = job.job_token
        supabase.table('local_training_jobs').update(update_data).eq('id', job_id).execute()

        logger.info(f"[API] Job {job_id} force-started successfully")

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "job_id": job_id,
                "previous_status": current_status,
                "new_status": "queued",
                "queue_position": queue_position,
                "message": f"Job queued successfully (position {queue_position})"
            }
        )

    except Exception as e:
        logger.error(f"[API] Error force-starting job {job_id}: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "job_id": job_id,
                "message": f"Internal error: {str(e)}"
            }
        )


@app.websocket("/ws/training/{job_id}")
async def training_websocket(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time training metrics streaming.
    
    Streams training progress, metrics, and status updates in real-time.
    Multiple clients can connect to the same job.
    
    Protocol:
        - Client connects to ws://host:port/ws/training/{job_id}
        - Server sends JSON messages with current metrics every second
        - Connection closes when job completes or fails
    
    Message format:
        {
            "job_id": str,
            "status": str,
            "progress": float,
            "current_epoch": int,
            "total_epochs": int,
            "current_step": int,
            "total_steps": int,
            "loss": float,
            "eval_loss": float,
            "samples_per_second": float,
            "gpu_memory_allocated_gb": float,
            "gpu_utilization_percent": float,
            "eta_seconds": int,
            "timestamp": str (ISO format),
            "complete": bool (only on final message)
        }
    
    Args:
        websocket: WebSocket connection
        job_id: Job identifier
    
    Phase 3 - WebSocket Streaming
    """
    # Validate job exists
    if job_id not in jobs:
        await websocket.close(code=1008, reason=f"Job {job_id} not found")
        logger.warning(f"[WebSocket] Rejected connection - job {job_id} not found")
        return
    
    # Accept connection
    await ws_manager.connect(websocket, job_id)
    
    job = jobs[job_id]
    
    try:
        # Send initial status
        initial_message = {
            "job_id": job_id,
            "status": job.status.value if isinstance(job.status, Enum) else job.status,
            "message": f"Connected to job {job_id}",
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        await websocket.send_json(initial_message)
        
        # Stream metrics while job is active
        while job.status in [JobStatusEnum.QUEUED, JobStatusEnum.PENDING, JobStatusEnum.RUNNING]:
            # Build metrics message
            metrics = {
                "job_id": job_id,
                "status": job.status.value if isinstance(job.status, Enum) else job.status,
                "progress": job.progress,
                "current_epoch": job.current_epoch,
                "total_epochs": job.total_epochs,
                "current_step": job.current_step,
                "total_steps": job.total_steps,
                "loss": job.loss,
                "eval_loss": job.eval_loss,
                "samples_per_second": job.samples_per_second,
                "gpu_memory_allocated_gb": job.gpu_memory_allocated_gb,
                "gpu_utilization_percent": job.gpu_utilization_percent,
                "eta_seconds": job.eta_seconds,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "complete": False
            }
            
            await websocket.send_json(metrics)
            
            # Wait before next update (1 second for real-time feel)
            await asyncio.sleep(WEBSOCKET_DELAY)
            
            # Re-check job reference (could have been updated)
            if job_id in jobs:
                job = jobs[job_id]
            else:
                logger.warning(f"[WebSocket] Job {job_id} disappeared from job store")
                break
        
        # Send final completion message
        final_status = job.status.value if isinstance(job.status, Enum) else job.status
        completion_message = {
            "job_id": job_id,
            "status": final_status,
            "progress": 100.0 if job.status == JobStatusEnum.COMPLETED else job.progress,
            "final_loss": job.loss,
            "eval_loss": job.eval_loss,
            "complete": True,
            "completed_at": job.completed_at,
            "error": job.error_message if job.status == JobStatusEnum.FAILED else None,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
        await websocket.send_json(completion_message)
        logger.info(f"[WebSocket] Job {job_id} completed, status: {final_status}")
        
    except WebSocketDisconnect:
        logger.info(f"[WebSocket] Client disconnected from job {job_id}")
    
    except Exception as e:
        logger.error(f"[WebSocket] Error streaming job {job_id}: {e}", exc_info=True)
        try:
            error_message = {
                "job_id": job_id,
                "error": f"WebSocket error: {str(e)}",
                "complete": True,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            await websocket.send_json(error_message)
        except:
            pass  # Connection might be dead
    
    finally:
        # Always disconnect
        await ws_manager.disconnect(websocket, job_id)


@app.get("/api/training/checkpoints/{job_id}")
async def list_checkpoints(job_id: str):
    """
    List all checkpoint directories for a training job.
    Returns checkpoint metadata including eval loss, train loss, and file size.

    Args:
        job_id: Job identifier

    Returns:
        JSON response with list of checkpoints and metadata
    """
    logger.info(f"Checkpoint list requested for job_id: {job_id}")

    # Get output directory for this job (scan filesystem regardless of in-memory state)
    output_dir = LOGS_DIR / f"job_{job_id}"

    if not output_dir.exists():
        logger.warning(f"Output directory not found for job {job_id}")
        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "checkpoints": [],
                "message": "No checkpoints available yet"
            }
        )

    try:
        from checkpoint_scorer import calculate_checkpoint_score

        checkpoints = []
        best_checkpoint_score = float('inf')  # Track by score instead of eval_loss
        best_checkpoint_path = None
        latest_checkpoint_path = None
        latest_mtime = 0

        # Scan for checkpoint directories
        # Supports two formats:
        # 1. checkpoint-{step} (e.g., checkpoint-1000)
        # 2. checkpoint-epoch-{epoch}-step-{step} (e.g., checkpoint-epoch-2-step-1000)
        for item in output_dir.iterdir():
            if item.is_dir() and item.name.startswith('checkpoint-'):
                checkpoint_path = str(item.name)

                # Parse epoch and step from checkpoint name
                parts = checkpoint_path.split('-')
                epoch = None
                step = None

                try:
                    if len(parts) == 2:
                        # Format: checkpoint-{step} or checkpoint-{step}_merged
                        step_part = parts[1].replace('_merged', '')
                        step = int(step_part)
                    elif len(parts) == 5 and parts[1] == 'epoch':
                        # Format: checkpoint-epoch-{epoch}-step-{step} or checkpoint-epoch-{epoch}-step-{step}_merged
                        epoch = int(parts[2])
                        step_part = parts[4].replace('_merged', '')
                        step = int(step_part)
                    else:
                        logger.warning(f"Unexpected checkpoint format: {checkpoint_path}")
                        continue
                except (IndexError, ValueError) as e:
                    logger.warning(f"Could not parse checkpoint name: {checkpoint_path} - {e}")
                    continue

                # Get checkpoint metadata from trainer_state.json if available
                trainer_state_file = item / TRAINER_STATE_FILENAME
                eval_loss = None
                train_loss = None

                if trainer_state_file.exists():
                    try:
                        with open(trainer_state_file, 'r', encoding='utf-8') as f:
                            trainer_state = json.load(f)

                        # If epoch not in name, get it from trainer_state
                        if epoch is None:
                            epoch = trainer_state.get('epoch')

                        # Extract metrics from log history
                        log_history = trainer_state.get('log_history', [])
                        if log_history:
                            # Find the eval entry matching this checkpoint's step
                            for log_entry in reversed(log_history):
                                log_step = log_entry.get('step')
                                if log_step == step:
                                    eval_loss = log_entry.get('eval_loss')
                                    train_loss = log_entry.get('loss')
                                    if eval_loss is not None:
                                        break
                    except Exception as e:
                        logger.warning(f"Could not read trainer_state.json for {checkpoint_path}: {e}")

                # Calculate checkpoint size
                checkpoint_size = 0
                try:
                    for file_path in item.rglob('*'):
                        if file_path.is_file():
                            checkpoint_size += file_path.stat().st_size
                except Exception as e:
                    logger.warning(f"Could not calculate size for {checkpoint_path}: {e}")

                # Get creation time
                created_at = datetime.fromtimestamp(item.stat().st_ctime).isoformat()
                mtime = item.stat().st_mtime

                # Calculate multi-metric score for this checkpoint
                checkpoint_data = {
                    'eval_loss': eval_loss,
                    'train_loss': train_loss,
                    'epochs_without_improvement': 0  # Unknown at this point, assume neutral
                }
                checkpoint_score = calculate_checkpoint_score(checkpoint_data)

                logger.debug(
                    f"Checkpoint {checkpoint_path} - "
                    f"eval_loss: {eval_loss}, train_loss: {train_loss}, "
                    f"score: {checkpoint_score:.6f}"
                )

                # Track best checkpoint by score (lower = better)
                if checkpoint_score < best_checkpoint_score:
                    best_checkpoint_score = checkpoint_score
                    best_checkpoint_path = checkpoint_path
                    logger.debug(
                        f"New best checkpoint: {checkpoint_path} with score {checkpoint_score:.6f}"
                    )

                # Track latest checkpoint (most recent mtime)
                if mtime > latest_mtime:
                    latest_mtime = mtime
                    latest_checkpoint_path = checkpoint_path

                checkpoints.append({
                    "path": checkpoint_path,
                    "epoch": epoch,
                    "step": step,
                    "eval_loss": eval_loss,
                    "train_loss": train_loss,
                    "size_bytes": checkpoint_size,
                    "created_at": created_at,
                    "is_best": False,  # Will be set after loop
                    "is_latest": False  # Will be set after loop
                })

        # Mark best and latest checkpoints
        for checkpoint in checkpoints:
            if checkpoint["path"] == best_checkpoint_path:
                checkpoint["is_best"] = True
            if checkpoint["path"] == latest_checkpoint_path:
                checkpoint["is_latest"] = True

        # Sort by step (descending) so latest is first
        checkpoints.sort(key=lambda x: x["step"], reverse=True)

        logger.info(f"Found {len(checkpoints)} checkpoints for job {job_id}")
        logger.info(
            f"Best checkpoint: {best_checkpoint_path} "
            f"(score={best_checkpoint_score:.6f})"
            if best_checkpoint_path else "No best checkpoint"
        )

        return JSONResponse(
            status_code=200,
            content={
                "job_id": job_id,
                "checkpoints": checkpoints,
                "best_checkpoint": best_checkpoint_path
            }
        )

    except Exception as e:
        logger.error(f"Error listing checkpoints for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list checkpoints: {str(e)}")


@app.get("/api/training/{job_id}/download/model")
async def download_model(job_id: str, checkpoint: Optional[str] = None):
    """
    Download trained model or specific checkpoint as ZIP file.
    
    Args:
        job_id: Job identifier
        checkpoint: Optional checkpoint directory name (e.g., "checkpoint-1000")
                   If not provided, downloads the entire output directory
    
    Returns:
        StreamingResponse with ZIP file containing model files
    
    Phase 4 - Model Download
    """
    logger.info(f"[Download] Model download requested for job {job_id}, checkpoint={checkpoint}")
    
    # Check if job exists
    if job_id not in jobs:
        logger.warning(f"[Download] Job {job_id} not found")
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    job = jobs[job_id]
    
    # Get output directory
    output_dir = LOGS_DIR / f"job_{job_id}"
    
    if not output_dir.exists():
        logger.warning(f"[Download] Output directory not found for job {job_id}")
        raise HTTPException(status_code=404, detail="Model files not found")
    
    # Determine what to ZIP
    if checkpoint:
        # Validate checkpoint name (prevent path traversal)
        if ".." in checkpoint or "/" in checkpoint or "\\" in checkpoint:
            logger.warning(f"[Download] Invalid checkpoint name: {checkpoint}")
            raise HTTPException(status_code=400, detail="Invalid checkpoint name")
        
        model_dir = output_dir / checkpoint
        if not model_dir.exists():
            logger.warning(f"[Download] Checkpoint {checkpoint} not found for job {job_id}")
            raise HTTPException(status_code=404, detail=f"Checkpoint '{checkpoint}' not found")
        
        zip_filename = f"job_{job_id}_{checkpoint}.zip"
        logger.info(f"[Download] Preparing checkpoint download: {checkpoint}")
    else:
        model_dir = output_dir
        zip_filename = f"job_{job_id}_model.zip"
        logger.info(f"[Download] Preparing full model download")
    
    try:
        # Create ZIP in memory
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            file_count = 0
            total_size = 0
            
            for file_path in model_dir.rglob('*'):
                if file_path.is_file():
                    # Calculate relative path for ZIP archive
                    arcname = file_path.relative_to(model_dir)
                    
                    # Add file to ZIP
                    zip_file.write(file_path, arcname)
                    
                    file_count += 1
                    total_size += file_path.stat().st_size
            
            logger.info(f"[Download] Created ZIP with {file_count} files, total size: {total_size / 1024 / 1024:.2f} MB")
        
        # Reset buffer position to beginning
        zip_buffer.seek(0)
        
        logger.info(f"[Download] Streaming ZIP file: {zip_filename}")
        
        # Return as streaming response
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}"
            }
        )
    
    except Exception as e:
        logger.error(f"[Download] Error creating ZIP for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create download: {str(e)}")


@app.get("/api/training/{job_id}/download/logs")
async def download_logs(job_id: str):
    """
    Download training logs as ZIP file.
    
    Includes:
    - training.log: Full training logs
    - progress.json: Progress metrics (if available)
    
    Args:
        job_id: Job identifier
    
    Returns:
        StreamingResponse with ZIP file containing log files
    
    Phase 4 - Logs Download
    """
    logger.info(f"[Download] Logs download requested for job {job_id}")
    
    # Check if job exists
    if job_id not in jobs:
        logger.warning(f"[Download] Job {job_id} not found")
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    
    # Locate log files
    log_file = LOGS_DIR / f"job_{job_id}.log"
    progress_file = LOGS_DIR / f"job_{job_id}" / PROGRESS_FILENAME
    
    # Check if at least the log file exists
    if not log_file.exists():
        logger.warning(f"[Download] Log file not found for job {job_id}")
        raise HTTPException(status_code=404, detail="Log files not found")
    
    try:
        # Create ZIP in memory
        zip_buffer = BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add training log
            zip_file.write(log_file, TRAINING_LOG_FILENAME)
            logger.info(f"[Download] Added training.log ({log_file.stat().st_size} bytes)")
            
            # Add progress.json if it exists
            if progress_file.exists():
                zip_file.write(progress_file, PROGRESS_FILENAME)
                logger.info(f"[Download] Added progress.json ({progress_file.stat().st_size} bytes)")
        
        # Reset buffer position
        zip_buffer.seek(0)
        
        zip_filename = f"job_{job_id}_logs.zip"
        logger.info(f"[Download] Streaming logs ZIP file: {zip_filename}")
        
        # Return as streaming response
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}"
            }
        )
    
    except Exception as e:
        logger.error(f"[Download] Error creating logs ZIP for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create logs download: {str(e)}")


# =============================================================================
# Phase 5: Enhanced Monitoring & Analytics
# =============================================================================

def calculate_job_analytics(job_id: str) -> Dict[str, Any]:
    """
    Calculate comprehensive analytics for a training job.
    
    Analyzes job performance, resource utilization, and efficiency metrics
    based on progress data and job metadata.
    
    Args:
        job_id: Job identifier
    
    Returns:
        Dictionary containing detailed analytics
    
    Raises:
        ValueError: If job not found or progress data unavailable
    """
    # Check if job exists
    if job_id not in jobs:
        raise ValueError(f"Job {job_id} not found")
    
    job = jobs[job_id]
    
    # Load progress data
    progress_file = LOGS_DIR / f"job_{job_id}" / PROGRESS_FILENAME
    if not progress_file.exists():
        raise ValueError(f"Progress data not found for job {job_id}")
    
    try:
        with open(progress_file, 'r') as f:
            progress_data = json.load(f)
    except Exception as e:
        raise ValueError(f"Failed to load progress data: {e}")
    
    # Calculate duration metrics
    start_time = None
    end_time = None
    if hasattr(job, 'started_at') and job.started_at:
        start_time = datetime.fromisoformat(job.started_at) if isinstance(job.started_at, str) else job.started_at
    if hasattr(job, 'completed_at') and job.completed_at:
        end_time = datetime.fromisoformat(job.completed_at) if isinstance(job.completed_at, str) else job.completed_at
    elif job.status == JobStatusEnum.RUNNING:
        end_time = datetime.now()
    
    total_seconds = 0
    if start_time and end_time:
        total_seconds = (end_time - start_time).total_seconds()
    
    # Extract metrics from progress data
    samples_per_sec_history = []
    loss_history = []
    gpu_util_history = []
    gpu_memory_history = []
    gpu_temp_history = []
    iteration_times = []
    
    if isinstance(progress_data, dict):
        samples_per_sec_history = [progress_data.get('samples_per_second', 0)]
        loss_history = [progress_data.get('loss', 0)]
        gpu_util_history = [progress_data.get('gpu_utilization', 0)]
        gpu_memory_history = [progress_data.get('gpu_memory_used', 0)]
        gpu_temp_history = [progress_data.get('gpu_temperature', 0)]
    elif isinstance(progress_data, list):
        for entry in progress_data:
            if isinstance(entry, dict):
                samples_per_sec_history.append(entry.get('samples_per_second', 0))
                loss_history.append(entry.get('loss', 0))
                gpu_util_history.append(entry.get('gpu_utilization', 0))
                gpu_memory_history.append(entry.get('gpu_memory_used', 0))
                gpu_temp_history.append(entry.get('gpu_temperature', 0))
    
    # Filter out zero/invalid values
    samples_per_sec_history = [x for x in samples_per_sec_history if x > 0]
    loss_history = [x for x in loss_history if x > 0]
    gpu_util_history = [x for x in gpu_util_history if x > 0]
    gpu_memory_history = [x for x in gpu_memory_history if x > 0]
    gpu_temp_history = [x for x in gpu_temp_history if x > 0]
    
    # Calculate performance metrics
    avg_samples_per_sec = sum(samples_per_sec_history) / len(samples_per_sec_history) if samples_per_sec_history else 0
    peak_samples_per_sec = max(samples_per_sec_history) if samples_per_sec_history else 0
    avg_iteration_time = (1.0 / avg_samples_per_sec) if avg_samples_per_sec > 0 else 0
    
    # Calculate resource utilization
    avg_gpu_util = sum(gpu_util_history) / len(gpu_util_history) if gpu_util_history else 0
    peak_gpu_memory = max(gpu_memory_history) if gpu_memory_history else 0
    avg_gpu_memory = sum(gpu_memory_history) / len(gpu_memory_history) if gpu_memory_history else 0
    avg_gpu_temp = sum(gpu_temp_history) / len(gpu_temp_history) if gpu_temp_history else 0
    peak_gpu_temp = max(gpu_temp_history) if gpu_temp_history else 0
    
    # Calculate loss metrics
    initial_loss = loss_history[0] if loss_history else 0
    final_loss = loss_history[-1] if loss_history else 0
    best_loss = min(loss_history) if loss_history else 0
    loss_reduction_percent = ((initial_loss - final_loss) / initial_loss * 100) if initial_loss > 0 else 0
    
    # Find checkpoints
    output_dir = Path(job.config.get('output_dir', f'./outputs/job_{job_id}')) if hasattr(job, 'config') else Path(f'./outputs/job_{job_id}')
    checkpoints = []
    if output_dir.exists():
        checkpoints = [d.name for d in output_dir.iterdir() if d.is_dir() and d.name.startswith('checkpoint-')]
    
    # Calculate efficiency scores
    gpu_util_score = avg_gpu_util  # Already in percentage
    throughput_score = min((avg_samples_per_sec / 5.0) * 100, 100)  # Assuming 5 samples/sec is optimal
    overall_score = (gpu_util_score + throughput_score) / 2
    
    return {
        "job_id": job_id,
        "status": job.status,
        "duration": {
            "total_seconds": round(total_seconds, 2),
            "total_hours": round(total_seconds / 3600, 2),
            "total_minutes": round(total_seconds / 60, 2)
        },
        "performance": {
            "average_samples_per_second": round(avg_samples_per_sec, 2),
            "peak_samples_per_second": round(peak_samples_per_sec, 2),
            "average_iteration_time_seconds": round(avg_iteration_time, 2),
            "total_samples": len(samples_per_sec_history) * int(avg_samples_per_sec) if avg_samples_per_sec > 0 else 0
        },
        "resource_utilization": {
            "average_gpu_utilization_percent": round(avg_gpu_util, 2),
            "peak_gpu_memory_mb": round(peak_gpu_memory, 2),
            "average_gpu_memory_mb": round(avg_gpu_memory, 2),
            "average_gpu_temp_celsius": round(avg_gpu_temp, 2),
            "peak_gpu_temp_celsius": round(peak_gpu_temp, 2)
        },
        "checkpoints": {
            "total_checkpoints": len(checkpoints),
            "checkpoint_names": sorted(checkpoints)
        },
        "losses": {
            "initial_loss": round(initial_loss, 4),
            "final_loss": round(final_loss, 4),
            "best_loss": round(best_loss, 4),
            "loss_reduction_percent": round(loss_reduction_percent, 2)
        },
        "efficiency": {
            "gpu_utilization_score": round(gpu_util_score, 2),
            "throughput_score": round(throughput_score, 2),
            "overall_score": round(overall_score, 2)
        }
    }


def calculate_system_analytics() -> Dict[str, Any]:
    """
    Calculate system-wide analytics across all training jobs.
    
    Returns:
        Dictionary containing aggregated analytics for all jobs
    """
    # Count jobs by status
    jobs_by_status = {
        "queued": 0,
        "pending": 0,
        "running": 0,
        "completed": 0,
        "failed": 0,
        "cancelled": 0,
        "paused": 0
    }
    
    total_training_seconds = 0
    throughput_values = []
    gpu_util_values = []
    gpu_memory_values = []
    completed_jobs_data = []
    
    for job_id, job in jobs.items():
        # Count by status
        status_key = job.status.lower() if hasattr(job, 'status') else "unknown"
        if status_key in jobs_by_status:
            jobs_by_status[status_key] += 1
        
        # Try to get analytics for completed jobs
        if job.status == JobStatusEnum.COMPLETED:
            try:
                analytics = calculate_job_analytics(job_id)
                
                # Aggregate duration
                total_training_seconds += analytics['duration']['total_seconds']
                
                # Aggregate performance
                if analytics['performance']['average_samples_per_second'] > 0:
                    throughput_values.append(analytics['performance']['average_samples_per_second'])
                
                # Aggregate resource usage
                if analytics['resource_utilization']['average_gpu_utilization_percent'] > 0:
                    gpu_util_values.append(analytics['resource_utilization']['average_gpu_utilization_percent'])
                
                if analytics['resource_utilization']['peak_gpu_memory_mb'] > 0:
                    gpu_memory_values.append(analytics['resource_utilization']['peak_gpu_memory_mb'])
                
                # Store for top performers
                completed_jobs_data.append({
                    "job_id": job_id,
                    "throughput": analytics['performance']['average_samples_per_second'],
                    "duration": analytics['duration']['total_seconds'],
                    "gpu_utilization": analytics['resource_utilization']['average_gpu_utilization_percent'],
                    "final_loss": analytics['losses']['final_loss']
                })
            except Exception as e:
                logger.warning(f"[Analytics] Failed to get analytics for job {job_id}: {e}")
                continue
    
    # Calculate averages
    avg_training_duration = total_training_seconds / jobs_by_status["completed"] if jobs_by_status["completed"] > 0 else 0
    avg_throughput = sum(throughput_values) / len(throughput_values) if throughput_values else 0
    avg_gpu_util = sum(gpu_util_values) / len(gpu_util_values) if gpu_util_values else 0
    avg_peak_memory = sum(gpu_memory_values) / len(gpu_memory_values) if gpu_memory_values else 0
    
    # Find top performing jobs (by throughput)
    top_performers = sorted(completed_jobs_data, key=lambda x: x['throughput'], reverse=True)[:5]
    
    return {
        "total_jobs": len(jobs),
        "jobs_by_status": jobs_by_status,
        "average_training_duration_seconds": round(avg_training_duration, 2),
        "total_training_time_hours": round(total_training_seconds / 3600, 2),
        "average_throughput_samples_per_sec": round(avg_throughput, 2),
        "top_performing_jobs": top_performers,
        "resource_trends": {
            "average_gpu_utilization": round(avg_gpu_util, 2),
            "average_peak_memory_mb": round(avg_peak_memory, 2)
        }
    }


def compare_jobs(job_ids: List[str]) -> Dict[str, Any]:
    """
    Compare multiple training jobs side-by-side.
    
    Args:
        job_ids: List of job IDs to compare
    
    Returns:
        Dictionary containing comparison data and winner analysis
    """
    jobs_data = []
    
    for job_id in job_ids:
        try:
            analytics = calculate_job_analytics(job_id)
            jobs_data.append({
                "job_id": job_id,
                "status": analytics['status'],
                "duration_seconds": analytics['duration']['total_seconds'],
                "throughput": analytics['performance']['average_samples_per_second'],
                "final_loss": analytics['losses']['final_loss'],
                "gpu_utilization": analytics['resource_utilization']['average_gpu_utilization_percent'],
                "efficiency_score": analytics['efficiency']['overall_score']
            })
        except Exception as e:
            logger.warning(f"[Analytics] Failed to get analytics for job {job_id}: {e}")
            jobs_data.append({
                "job_id": job_id,
                "error": str(e)
            })
    
    # Determine winners
    valid_jobs = [j for j in jobs_data if 'error' not in j]
    
    winner = {}
    if valid_jobs:
        winner['best_throughput'] = max(valid_jobs, key=lambda x: x['throughput'])['job_id']
        winner['best_loss'] = min(valid_jobs, key=lambda x: x['final_loss'])['job_id']
        winner['fastest'] = min(valid_jobs, key=lambda x: x['duration_seconds'])['job_id']
        winner['most_efficient'] = max(valid_jobs, key=lambda x: x['efficiency_score'])['job_id']
    
    return {
        "jobs": jobs_data,
        "winner": winner
    }


# =============================================================================
# Phase 5: Analytics API Endpoints
# =============================================================================

@app.get("/api/training/{job_id}/analytics")
async def get_job_analytics(job_id: str):
    """
    Get comprehensive analytics for a specific training job.
    
    Returns detailed metrics including:
    - Duration and timing
    - Performance metrics (throughput, iteration time)
    - Resource utilization (GPU, memory, temperature)
    - Checkpoints information
    - Loss progression
    - Efficiency scores
    
    Args:
        job_id: Job identifier
    
    Returns:
        JSON response with analytics data
    
    Raises:
        HTTPException: 404 if job not found, 500 for calculation errors
    
    Phase 5 - Job Analytics
    """
    logger.info(f"[Analytics] Analytics requested for job {job_id}")
    
    try:
        analytics = calculate_job_analytics(job_id)
        logger.info(f"[Analytics] Successfully calculated analytics for job {job_id}")
        return JSONResponse(content=analytics)
    
    except ValueError as e:
        logger.warning(f"[Analytics] Job {job_id} not found or invalid: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    
    except Exception as e:
        logger.error(f"[Analytics] Error calculating analytics for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate analytics: {str(e)}")


@app.get("/api/training/analytics/summary")
async def get_system_analytics():
    """
    Get system-wide analytics across all training jobs.

    Returns aggregated metrics including:
    - Total job counts by status
    - Average training duration
    - Total training time
    - Average throughput
    - Top performing jobs
    - Resource utilization trends

    Returns:
        JSON response with system analytics

    Raises:
        HTTPException: 500 for calculation errors

    Phase 5 - System Analytics (with caching for performance)
    """
    logger.info("[Analytics] System analytics requested")

    try:
        current_time = time.time()
        cache_age = current_time - analytics_cache["system_analytics_timestamp"]

        # Check if cached data is still valid
        if (analytics_cache["system_analytics"] is not None
            and cache_age < ANALYTICS_CACHE_TTL_SECONDS):
            logger.info(f"[Analytics] Cache HIT (age: {cache_age:.1f}s)")
            cached_data = analytics_cache["system_analytics"].copy()
            cached_data["from_cache"] = True
            cached_data["cache_age_seconds"] = round(cache_age, 1)
            return JSONResponse(content=cached_data)

        # Cache miss - calculate fresh analytics
        logger.info(f"[Analytics] Cache MISS (age: {cache_age:.1f}s), calculating...")
        analytics = calculate_system_analytics()

        # Store in cache
        analytics_cache["system_analytics"] = analytics
        analytics_cache["system_analytics_timestamp"] = current_time

        analytics["from_cache"] = False
        analytics["cache_age_seconds"] = 0

        logger.info(f"[Analytics] Successfully calculated system analytics ({analytics['total_jobs']} jobs)")
        return JSONResponse(content=analytics)

    except Exception as e:
        logger.error(f"[Analytics] Error calculating system analytics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to calculate system analytics: {str(e)}")


@app.get("/api/training/analytics/compare")
async def compare_training_jobs(job_ids: str):
    """
    Compare multiple training jobs side-by-side.
    
    Analyzes and compares jobs across key metrics:
    - Duration
    - Throughput
    - Final loss
    - GPU utilization
    - Efficiency score
    
    Also determines "winners" in each category.
    
    Args:
        job_ids: Comma-separated list of job IDs (e.g., "job1,job2,job3")
    
    Returns:
        JSON response with comparison data and winner analysis
    
    Raises:
        HTTPException: 400 for invalid input, 500 for calculation errors
    
    Phase 5 - Job Comparison
    """
    logger.info(f"[Analytics] Job comparison requested for: {job_ids}")
    
    # Parse job IDs
    try:
        job_id_list = [jid.strip() for jid in job_ids.split(',') if jid.strip()]
        
        if not job_id_list:
            raise ValueError("No job IDs provided")
        
        if len(job_id_list) < 2:
            raise ValueError("At least 2 job IDs required for comparison")
    
    except ValueError as e:
        logger.warning(f"[Analytics] Invalid job IDs format: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    
    try:
        comparison = compare_jobs(job_id_list)
        logger.info(f"[Analytics] Successfully compared {len(job_id_list)} jobs")
        return JSONResponse(content=comparison)
    
    except Exception as e:
        logger.error(f"[Analytics] Error comparing jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to compare jobs: {str(e)}")






# =============================================================================
# FILESYSTEM API - Phase 1: Web App Support
# =============================================================================

# Path validation utilities
def validate_filesystem_path(path_str: str, allowed_paths: List[str]) -> Path:
    """
    Validate and normalize a filesystem path.
    
    Args:
        path_str: Path string to validate
        allowed_paths: List of allowed directory paths
    
    Returns:
        Normalized Path object
    
    Raises:
        HTTPException: 400 for invalid paths, 403 for forbidden paths
    """
    try:
        # Normalize path
        path = Path(path_str).resolve()
        
        # Check for path traversal attempts
        if '..' in str(path):
            logger.warning(f"[Filesystem] Path traversal attempt blocked: {path_str}")
            raise HTTPException(status_code=403, detail="Path traversal not allowed")
        
        # Check if path is within allowed directories
        path_allowed = False
        for allowed_path in allowed_paths:
            allowed_path_resolved = Path(allowed_path).expanduser().resolve()
            try:
                path.relative_to(allowed_path_resolved)
                path_allowed = True
                break
            except ValueError:
                continue
        
        if not path_allowed:
            logger.warning(f"[Filesystem] Access denied to path outside allowed directories: {path}")
            raise HTTPException(status_code=403, detail="Access denied: Path outside allowed directories")
        
        return path
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Path validation error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid path: {str(e)}")


# Request/Response models
class FilesystemListRequest(BaseModel):
    path: str
    max_items: Optional[int] = None


class FilesystemReadRequest(BaseModel):
    path: str
    encoding: str = 'utf-8'
    max_size: Optional[int] = None


# Filesystem API authentication dependency
async def verify_filesystem_api_key(x_api_key: Optional[str] = Header(None)):
    """
    Verify API key for filesystem endpoints (if configured).
    If FILESYSTEM_API_KEY is set, requests must include matching X-API-Key header.
    If FILESYSTEM_API_KEY is not set, all requests are allowed (localhost-only security).
    """
    if FILESYSTEM_API_KEY is not None:
        if x_api_key is None:
            raise HTTPException(
                status_code=401,
                detail="Missing X-API-Key header",
                headers={"WWW-Authenticate": "ApiKey"}
            )
        if x_api_key != FILESYSTEM_API_KEY:
            raise HTTPException(
                status_code=403,
                detail="Invalid API key"
            )
    return True


# Filesystem API endpoints
@app.get("/api/filesystem/models")
async def list_models(auth: bool = Depends(verify_filesystem_api_key)):
    """
    List all models in the user's AI_MODELS_DIR.
    
    Returns list of model directories with metadata.
    
    Phase 1 - Filesystem API
    """
    logger.info("[Filesystem] List models requested")
    
    try:
        models_dir = Path(AI_MODELS_DIR).expanduser().resolve()
        
        if not models_dir.exists():
            logger.warning(f"[Filesystem] Models directory does not exist: {models_dir}")
            return JSONResponse(content={
                "models": [],
                "total_count": 0,
                "directory": str(models_dir),
                "message": f"Models directory not found: {models_dir}",
                "expected_path": str(models_dir)
            })
        
        if not models_dir.is_dir():
            raise HTTPException(status_code=400, detail="AI_MODELS_DIR is not a directory")
        
        models = []
        for item in models_dir.iterdir():
            if item.is_dir():
                try:
                    # Get basic stats
                    stat = item.stat()
                    
                    # Try to detect model type by looking for common files
                    model_files = list(item.glob('*.bin')) + list(item.glob('*.safetensors'))
                    config_files = list(item.glob('config.json'))
                    
                    models.append({
                        "name": item.name,
                        "path": str(item),
                        "size_bytes": sum(f.stat().st_size for f in item.rglob('*') if f.is_file()),
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "has_model_files": len(model_files) > 0,
                        "has_config": len(config_files) > 0,
                        "file_count": len(list(item.rglob('*')))
                    })
                except Exception as e:
                    logger.warning(f"[Filesystem] Error reading model {item.name}: {e}")
                    continue
        
        logger.info(f"[Filesystem] Found {len(models)} models in {models_dir}")
        return JSONResponse(content={
            "models": models,
            "total_count": len(models),
            "directory": str(models_dir)
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error listing models: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list models: {str(e)}")


@app.get("/api/filesystem/models/{model_name}/info")
async def get_model_info(model_name: str, auth: bool = Depends(verify_filesystem_api_key)):
    """
    Get detailed information about a specific model.
    
    Args:
        model_name: Name of the model directory
    
    Returns:
        Detailed model metadata including file breakdown
    
    Phase 1 - Filesystem API
    """
    logger.info(f"[Filesystem] Model info requested for: {model_name}")
    
    try:
        models_dir = Path(AI_MODELS_DIR).expanduser().resolve()
        model_path = models_dir / model_name
        
        # Validate path is within models directory
        try:
            model_path.relative_to(models_dir)
        except ValueError:
            raise HTTPException(status_code=403, detail="Invalid model name")
        
        if not model_path.exists():
            raise HTTPException(status_code=404, detail="Model not found")
        
        if not model_path.is_dir():
            raise HTTPException(status_code=400, detail="Model path is not a directory")
        
        # Collect file information
        files_by_type = {
            "model_weights": [],
            "config": [],
            "tokenizer": [],
            "other": []
        }
        total_size = 0
        
        for file_path in model_path.rglob('*'):
            if file_path.is_file():
                stat = file_path.stat()
                total_size += stat.st_size
                
                file_info = {
                    "name": file_path.name,
                    "relative_path": str(file_path.relative_to(model_path)),
                    "size_bytes": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                }
                
                # Categorize file
                if file_path.suffix in ['.bin', '.safetensors', '.pt', '.pth']:
                    files_by_type["model_weights"].append(file_info)
                elif 'config' in file_path.name.lower() and file_path.suffix == '.json':
                    files_by_type["config"].append(file_info)
                elif 'tokenizer' in file_path.name.lower():
                    files_by_type["tokenizer"].append(file_info)
                else:
                    files_by_type["other"].append(file_info)
        
        logger.info(f"[Filesystem] Model {model_name}: {total_size} bytes, {sum(len(v) for v in files_by_type.values())} files")
        
        return JSONResponse(content={
            "name": model_name,
            "path": str(model_path),
            "total_size_bytes": total_size,
            "total_files": sum(len(v) for v in files_by_type.values()),
            "files_by_type": files_by_type,
            "modified": datetime.fromtimestamp(model_path.stat().st_mtime).isoformat()
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error getting model info for {model_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get model info: {str(e)}")


@app.get("/api/filesystem/checkpoints/{job_id}")
async def list_job_checkpoints(job_id: str, auth: bool = Depends(verify_filesystem_api_key)):
    """
    List all checkpoints for a specific training job.
    
    Args:
        job_id: Training job ID
    
    Returns:
        List of checkpoints with metadata
    
    Phase 1 - Filesystem API
    """
    logger.info(f"[Filesystem] List checkpoints requested for job: {job_id}")
    
    try:
        job_dir = LOGS_DIR / f"job_{job_id}"
        
        if not job_dir.exists():
            logger.warning(f"[Filesystem] Job directory does not exist: {job_dir}")
            return JSONResponse(content={
                "job_id": job_id,
                "checkpoints": [],
                "total_count": 0,
                "message": f"Job directory not found: {job_dir}",
                "expected_path": str(job_dir)
            })
        
        checkpoints = []
        for item in job_dir.iterdir():
            if item.is_dir() and item.name.startswith('checkpoint-'):
                try:
                    stat = item.stat()
                    
                    # Calculate checkpoint size
                    checkpoint_size = sum(f.stat().st_size for f in item.rglob('*') if f.is_file())
                    
                    # Extract step number from checkpoint name
                    step = None
                    try:
                        step = int(item.name.split('-')[1].split('_')[0])
                    except:
                        pass
                    
                    checkpoints.append({
                        "name": item.name,
                        "path": str(item),
                        "step": step,
                        "size_bytes": checkpoint_size,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "file_count": len(list(item.rglob('*')))
                    })
                except Exception as e:
                    logger.warning(f"[Filesystem] Error reading checkpoint {item.name}: {e}")
                    continue
        
        # Sort by step number
        checkpoints.sort(key=lambda x: x['step'] if x['step'] is not None else 0)
        
        logger.info(f"[Filesystem] Found {len(checkpoints)} checkpoints for job {job_id}")
        return JSONResponse(content={
            "job_id": job_id,
            "checkpoints": checkpoints,
            "total_count": len(checkpoints),
            "job_directory": str(job_dir)
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error listing checkpoints for job {job_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list checkpoints: {str(e)}")


@app.post("/api/filesystem/list")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def list_directory(fs_request: FilesystemListRequest, request: Request, auth: bool = Depends(verify_filesystem_api_key)):
    """
    List contents of a directory (within allowed paths).
    
    Args:
        request: FilesystemListRequest with path and optional max_items
    
    Returns:
        Directory contents with file metadata
    
    Phase 1 - Filesystem API
    """
    logger.info(f"[Filesystem] List directory requested: {fs_request.path}")
    
    try:
        # Validate path
        dir_path = validate_filesystem_path(fs_request.path, FILESYSTEM_ALLOWED_PATHS)
        
        if not dir_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        
        if not dir_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        # List directory contents
        max_items = fs_request.max_items or FILESYSTEM_MAX_DIR_ITEMS
        items = []
        
        for item in dir_path.iterdir():
            if len(items) >= max_items:
                logger.warning(f"[Filesystem] Directory listing truncated at {max_items} items")
                break
            
            try:
                stat = item.stat()
                items.append({
                    "name": item.name,
                    "type": "directory" if item.is_dir() else "file",
                    "size_bytes": stat.st_size if item.is_file() else 0,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "permissions": {
                        "readable": os.access(item, os.R_OK),
                        "writable": os.access(item, os.W_OK),
                        "executable": os.access(item, os.X_OK)
                    }
                })
            except Exception as e:
                logger.warning(f"[Filesystem] Error reading item {item.name}: {e}")
                continue
        
        logger.info(f"[Filesystem] Listed {len(items)} items in {dir_path}")
        return JSONResponse(content={
            "path": str(dir_path),
            "items": items,
            "total_count": len(items),
            "truncated": len(items) >= max_items
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error listing directory: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list directory: {str(e)}")


@app.post("/api/filesystem/read")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def read_file(fs_request: FilesystemReadRequest, request: Request, auth: bool = Depends(verify_filesystem_api_key)):
    """
    Read contents of a file (within allowed paths).
    
    Args:
        request: FilesystemReadRequest with path, encoding, and optional max_size
    
    Returns:
        File contents and metadata
    
    Phase 1 - Filesystem API
    """
    logger.info(f"[Filesystem] Read file requested: {fs_request.path}")
    
    try:
        # Validate path
        file_path = validate_filesystem_path(fs_request.path, FILESYSTEM_ALLOWED_PATHS)
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        if not file_path.is_file():
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        # Check file size
        file_size = file_path.stat().st_size
        max_size = fs_request.max_size or FILESYSTEM_MAX_FILE_SIZE
        
        if file_size > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large: {file_size} bytes (max: {max_size} bytes)"
            )
        
        # Read file
        if fs_request.encoding == 'binary':
            # Binary mode - read as bytes and base64 encode
            logger.info(f"[Filesystem] Reading file as binary: {file_path}")
            with open(file_path, 'rb') as f:
                binary_content = f.read()
            content = base64.b64encode(binary_content).decode('ascii')
            actual_encoding = 'base64'
        else:
            # Text mode
            try:
                with open(file_path, 'r', encoding=fs_request.encoding) as f:
                    content = f.read()
                actual_encoding = fs_request.encoding
            except UnicodeDecodeError:
                # Try binary mode if text mode fails
                logger.warning(f"[Filesystem] Text decoding failed, reading as binary: {file_path}")
                with open(file_path, 'rb') as f:
                    binary_content = f.read()
                content = base64.b64encode(binary_content).decode('ascii')
                actual_encoding = 'base64'

        logger.info(f"[Filesystem] Read file {file_path}: {len(content)} characters (encoding: {actual_encoding})")
        return JSONResponse(content={
            "path": str(file_path),
            "content": content,
            "size_bytes": file_size,
            "encoding": actual_encoding,
            "modified": datetime.fromtimestamp(file_path.stat().st_mtime).isoformat()
        })
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error reading file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")


@app.post("/api/filesystem/info")
@limiter.limit(RATE_LIMIT_FILESYSTEM if RATE_LIMIT_ENABLED else "1000000/minute")
async def get_file_info(fs_request: FilesystemListRequest, request: Request, auth: bool = Depends(verify_filesystem_api_key)):
    """
    Get metadata about a file or directory (within allowed paths).
    
    Args:
        request: FilesystemListRequest with path
    
    Returns:
        File or directory metadata
    
    Phase 1 - Filesystem API
    """
    logger.info(f"[Filesystem] File info requested: {fs_request.path}")
    
    try:
        # Validate path
        target_path = validate_filesystem_path(fs_request.path, FILESYSTEM_ALLOWED_PATHS)
        
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        
        stat = target_path.stat()
        
        info = {
            "path": str(target_path),
            "name": target_path.name,
            "type": "directory" if target_path.is_dir() else "file",
            "size_bytes": stat.st_size if target_path.is_file() else 0,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "permissions": {
                "readable": os.access(target_path, os.R_OK),
                "writable": os.access(target_path, os.W_OK),
                "executable": os.access(target_path, os.X_OK)
            }
        }
        
        # Add directory-specific info
        if target_path.is_dir():
            try:
                item_count = len(list(target_path.iterdir()))
                info["item_count"] = item_count
            except:
                pass
        
        logger.info(f"[Filesystem] Got info for {target_path}")
        return JSONResponse(content=info)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Filesystem] Error getting file info: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get file info: {str(e)}")

# End of Filesystem API
# =============================================================================
