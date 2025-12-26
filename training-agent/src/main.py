"""
FineTune Lab Training Agent - Main Application
"""
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

    logger.info("=" * 60)
    logger.info("Training Agent Ready")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown"""
    logger.info("Training Agent Shutting Down")


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
