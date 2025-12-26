"""
HTTP client for communicating with FineTune Lab backend
"""
import httpx
from typing import Optional, Dict, Any
from loguru import logger

from src.config import settings
from src.models.training import TrainingMetrics


class BackendClient:
    """Client for interacting with FineTune Lab backend APIs"""

    def __init__(self):
        self.base_url = settings.backend_url
        self.timeout = httpx.Timeout(30.0, connect=10.0)

    async def report_metrics(
        self,
        job_id: str,
        job_token: str,
        metrics: TrainingMetrics
    ) -> bool:
        """
        Report training metrics to backend

        Args:
            job_id: Training job ID
            job_token: Secure token for this job
            metrics: Metrics to report

        Returns:
            True if successful
        """
        url = f"{self.base_url}/api/training/local/{job_id}/metrics"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {job_token}",
        }

        payload = {
            "step": metrics.step,
            "epoch": metrics.epoch,
            "train_loss": metrics.train_loss,
            "eval_loss": metrics.eval_loss,
            "learning_rate": metrics.learning_rate,
            "grad_norm": metrics.grad_norm,
            "gpu_memory_allocated_gb": metrics.gpu_memory_allocated_gb,
            "gpu_memory_reserved_gb": metrics.gpu_memory_reserved_gb,
            "gpu_utilization_percent": metrics.gpu_utilization_percent,
            "samples_per_second": metrics.samples_per_second,
            "tokens_per_second": metrics.tokens_per_second,
            "train_perplexity": metrics.train_perplexity,
            "eval_perplexity": metrics.eval_perplexity,
        }

        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.put(url, headers=headers, json=payload)
                response.raise_for_status()

                logger.debug(f"Metrics reported for job {job_id}, step {metrics.step}")
                return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to report metrics: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error reporting metrics: {e}")
            return False

    async def update_job_status(
        self,
        job_id: str,
        job_token: str,
        status: str,
        error: Optional[str] = None
    ) -> bool:
        """
        Update job status in backend

        Args:
            job_id: Training job ID
            job_token: Secure token for this job
            status: New status
            error: Error message if failed

        Returns:
            True if successful
        """
        url = f"{self.base_url}/api/training/local/{job_id}/status"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {job_token}",
        }

        payload = {"status": status}
        if error:
            payload["error"] = error

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.patch(url, headers=headers, json=payload)
                response.raise_for_status()

                logger.debug(f"Status updated for job {job_id}: {status}")
                return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to update status: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error updating status: {e}")
            return False

    async def send_logs(
        self,
        job_id: str,
        job_token: str,
        logs: list[str]
    ) -> bool:
        """
        Send training logs to backend

        Args:
            job_id: Training job ID
            job_token: Secure token for this job
            logs: Log lines to send

        Returns:
            True if successful
        """
        url = f"{self.base_url}/api/training/local/{job_id}/logs"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {job_token}",
        }

        payload = {"logs": logs}

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

                logger.debug(f"Logs sent for job {job_id}: {len(logs)} lines")
                return True

        except httpx.HTTPError as e:
            logger.error(f"Failed to send logs: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending logs: {e}")
            return False


# Global backend client instance
backend_client = BackendClient()
