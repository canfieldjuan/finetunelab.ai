"""
FastAPI routes for training agent
"""
from fastapi import APIRouter, HTTPException, status
from typing import List
from loguru import logger

from src.models.training import (
    TrainingJobRequest,
    TrainingJobStatus,
    TrainingJobState,
    ControlCommand,
    JobStatus,
)
from src.training.executor import training_executor
from src.monitoring.gpu_monitor import gpu_monitor

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    gpu_info = gpu_monitor.get_gpu_info()

    return {
        "status": "ok",
        "gpu_available": gpu_monitor.has_cuda,
        "gpu_info": gpu_info,
        "active_jobs": len(training_executor.jobs),
    }


@router.post("/api/training/execute")
async def execute_training(request: TrainingJobRequest):
    """
    Start a new training job

    Args:
        request: Training job configuration

    Returns:
        Job ID and success status
    """
    try:
        logger.info(f"Received training request: {request.execution_id}")

        # Create job state
        job_state = TrainingJobState(
            job_id=request.execution_id,
            status=JobStatus.PENDING,
            config=request.config,
            dataset_path=request.dataset_path,
            user_id=request.user_id,
            access_token=request.access_token,
            job_token=request.job_token,  # Pass job_token for metrics reporting
        )

        # Start training
        success = await training_executor.start_training(job_state)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to start training job"
            )

        return {
            "job_id": request.execution_id,
            "success": True,
        }

    except Exception as e:
        logger.error(f"Error starting training: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/api/training/status/{job_id}", response_model=TrainingJobStatus)
async def get_job_status(job_id: str):
    """
    Get current status of a training job

    Args:
        job_id: Training job ID

    Returns:
        Current job status
    """
    status_info = training_executor.get_job_status(job_id)

    if not status_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )

    return status_info


@router.post("/api/training/pause/{job_id}")
async def pause_training(job_id: str):
    """
    Pause a running training job

    Args:
        job_id: Training job ID

    Returns:
        Success status
    """
    success = await training_executor.pause_training(job_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to pause training job"
        )

    return {"success": True, "message": "Training pause requested"}


@router.post("/api/training/resume/{job_id}")
async def resume_training(job_id: str, command: ControlCommand = None):
    """
    Resume a paused training job

    Args:
        job_id: Training job ID
        command: Optional control command with checkpoint path

    Returns:
        Success status
    """
    checkpoint_path = command.checkpoint_path if command else None
    success = await training_executor.resume_training(job_id, checkpoint_path)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to resume training job"
        )

    return {"success": True, "message": "Training resumed"}


@router.post("/api/training/cancel/{job_id}")
async def cancel_training(job_id: str):
    """
    Cancel a training job

    Args:
        job_id: Training job ID

    Returns:
        Success status
    """
    success = await training_executor.cancel_training(job_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to cancel training job"
        )

    return {"success": True, "message": "Training cancellation requested"}


@router.get("/api/training/logs/{job_id}")
async def get_training_logs(job_id: str, limit: int = 100, offset: int = 0):
    """
    Get training logs for a job

    Args:
        job_id: Training job ID
        limit: Maximum number of log lines to return
        offset: Number of lines to skip from the beginning

    Returns:
        List of log lines
    """
    job_state = training_executor.jobs.get(job_id)

    if not job_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}"
        )

    # Get logs with pagination
    logs = job_state.logs[offset:offset + limit]

    return {"logs": logs}


@router.get("/api/training/jobs")
async def list_jobs():
    """
    List all training jobs

    Returns:
        List of job IDs and their statuses
    """
    jobs = []
    for job_id, job_state in training_executor.jobs.items():
        jobs.append({
            "job_id": job_id,
            "status": job_state.status,
            "started_at": job_state.started_at,
            "current_step": job_state.current_step,
            "total_steps": job_state.total_steps,
        })

    return {"jobs": jobs}
