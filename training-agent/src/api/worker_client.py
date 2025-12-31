"""
Worker registration and lifecycle management
Handles communication with platform for worker registration, heartbeat, and status
"""
import platform
import socket
import httpx
from loguru import logger
from typing import Optional, Dict, Any

from src.config import settings


class WorkerClient:
    """Handles worker registration and heartbeat with platform"""

    def __init__(self):
        self.base_url = settings.backend_url
        self.api_key = settings.api_key
        self.worker_id: Optional[str] = None
        self.heartbeat_interval = 30
        self.max_concurrency = 1
        self.timeout = httpx.Timeout(10.0)

    def get_hostname(self) -> str:
        """
        Get machine hostname
        Uses settings override if provided, otherwise auto-detects
        """
        if settings.worker_hostname:
            return settings.worker_hostname
        return socket.gethostname()

    def get_platform(self) -> str:
        """
        Detect platform: linux, darwin, windows
        Uses settings override if provided, otherwise auto-detects
        """
        if settings.worker_platform:
            return settings.worker_platform

        sys_platform = platform.system().lower()
        if 'linux' in sys_platform:
            return 'linux'
        elif 'darwin' in sys_platform:
            return 'darwin'
        elif 'windows' in sys_platform:
            return 'windows'
        return 'linux'  # Default fallback

    async def register(self) -> bool:
        """
        Register worker with platform

        Sends POST request to /api/workers/register with:
        - api_key: Worker API key
        - hostname: Machine hostname
        - platform: Operating system (linux/darwin/windows)
        - version: Worker version
        - capabilities: What this worker can do (training, etc.)

        Returns:
            True if registration successful, False otherwise
        """
        url = f"{self.base_url}/api/workers/register"

        payload = {
            "api_key": self.api_key,
            "hostname": self.get_hostname(),
            "platform": self.get_platform(),
            "version": settings.worker_version,
            "capabilities": settings.worker_capabilities,
            "metadata": {
                "python_version": platform.python_version(),
                "cpu_count": platform.machine(),
            }
        }

        try:
            logger.info(f"Registering worker with platform at {url}")
            logger.info(f"Hostname: {payload['hostname']}")
            logger.info(f"Platform: {payload['platform']}")
            logger.info(f"Version: {payload['version']}")

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()

                data = response.json()
                self.worker_id = data["worker_id"]
                self.heartbeat_interval = data.get("heartbeat_interval_seconds", 30)
                self.max_concurrency = data.get("max_concurrency", 1)

                logger.info("=" * 60)
                logger.info("Worker Registration Successful")
                logger.info("=" * 60)
                logger.info(f"Worker ID: {self.worker_id}")
                logger.info(f"Heartbeat Interval: {self.heartbeat_interval}s")
                logger.info(f"Max Concurrency: {self.max_concurrency}")
                logger.info("=" * 60)
                return True

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error during registration: {e.response.status_code}")
            logger.error(f"Response: {e.response.text}")
            return False
        except httpx.RequestError as e:
            logger.error(f"Request error during registration: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during registration: {e}")
            return False

    async def send_heartbeat(
        self,
        current_load: int = 0,
        metrics: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Send heartbeat to platform

        Sends POST request to /api/workers/{workerId}/heartbeat with:
        - status: Worker status (online/error)
        - current_load: Number of active jobs
        - metrics: System metrics (CPU, memory, etc.)

        Returns:
            True if heartbeat sent successfully, False otherwise
        """
        if not self.worker_id:
            logger.error("Cannot send heartbeat: worker not registered")
            return False

        url = f"{self.base_url}/api/workers/{self.worker_id}/heartbeat"

        headers = {
            "X-API-Key": self.api_key,
        }

        payload = {
            "status": "online",
            "current_load": current_load,
        }

        if metrics:
            payload["metrics"] = metrics

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

                data = response.json()

                # Log pending commands if any
                pending_commands = data.get("pending_commands", [])
                if pending_commands:
                    logger.info(f"Received {len(pending_commands)} pending command(s)")
                    for cmd in pending_commands:
                        logger.info(f"  - {cmd['command_type']} (ID: {cmd['id']})")

                logger.debug(f"Heartbeat sent successfully (load: {current_load})")
                return True

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error during heartbeat: {e.response.status_code}")
            logger.error(f"Response: {e.response.text}")
            return False
        except httpx.RequestError as e:
            logger.warning(f"Request error during heartbeat: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error during heartbeat: {e}")
            return False


# Global worker client instance
worker_client = WorkerClient()
