"""
FineTune Lab Training Agent - Main Application
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from src.api.routes import router
from src.config import settings
from src.monitoring.gpu_monitor import gpu_monitor
from src.services.job_poller import job_poller, get_or_create_agent_id


# Configure logging
logger.remove()  # Remove default handler
logger.add(
    sys.stderr,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level=settings.log_level,
)
logger.add(
    settings.logs_dir / "agent.log",
    rotation="100 MB",
    retention="30 days",
    level=settings.log_level,
)


# Create FastAPI app
app = FastAPI(
    title="FineTune Lab Training Agent",
    description="Local training agent for AI model fine-tuning",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


@app.on_event("startup")
async def startup_event():
    """Run on application startup"""
    logger.info("=" * 60)
    logger.info("FineTune Lab Training Agent Starting")
    logger.info("=" * 60)

    # Log configuration
    logger.info(f"Backend URL: {settings.backend_url}")
    logger.info(f"Server: {settings.host}:{settings.port}")
    logger.info(f"Models Directory: {settings.models_dir}")
    logger.info(f"Datasets Directory: {settings.datasets_dir}")
    logger.info(f"Checkpoints Directory: {settings.checkpoints_dir}")
    logger.info(f"Logs Directory: {settings.logs_dir}")

    # Log GPU info
    gpu_info = gpu_monitor.get_gpu_info()
    if gpu_monitor.has_cuda:
        logger.info(f"GPU Available: {gpu_info['name']}")
        logger.info(f"Total GPU Memory: {gpu_info['total_memory_gb']} GB")
        logger.info(f"CUDA Version: {gpu_info['cuda_version']}")
        logger.info(f"Device Count: {gpu_info['device_count']}")
    else:
        logger.warning("No CUDA devices found - training will run on CPU")

    # Initialize agent ID if not configured
    if not settings.agent_id:
        settings.agent_id = get_or_create_agent_id()
        job_poller.agent_id = settings.agent_id
    logger.info(f"Agent ID: {settings.agent_id}")

    # Start job poller if enabled
    if settings.poll_enabled and settings.api_key:
        job_poller.agent_id = settings.agent_id
        job_poller.api_key = settings.api_key
        asyncio.create_task(job_poller.run())
        logger.info("Job poller started")
    elif not settings.api_key:
        logger.warning("No API key configured - job polling disabled")
    elif not settings.poll_enabled:
        logger.info("Job polling disabled by configuration")

    logger.info("=" * 60)
    logger.info("Training Agent Ready")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Training Agent Shutting Down")

    # Stop job poller
    if job_poller.is_running():
        job_poller.stop()
        logger.info("Job poller stopped")


def main():
    """Main entry point"""
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,  # Set to True during development
        log_level=settings.log_level.lower(),
    )


if __name__ == "__main__":
    main()
