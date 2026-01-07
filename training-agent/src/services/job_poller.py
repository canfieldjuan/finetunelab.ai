"""
Job Poller Service for Training Agent

Polls the FineTune Lab backend for pending training jobs and executes them.
This enables remote agents to receive jobs without requiring inbound connections.

Date: 2026-01-07
"""
import asyncio
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from loguru import logger
import httpx

from src.config import settings


class JobPoller:
    """
    Polls backend for pending training jobs and coordinates execution.

    Flow:
    1. Poll GET /api/training/agent/poll for pending jobs
    2. If job found, claim it via POST /api/training/agent/claim/{jobId}
    3. Execute the job using TrainingExecutor
    4. Report metrics and status back to backend
    """

    def __init__(self):
        self.backend_url = settings.backend_url
        self.api_key = settings.api_key
        self.agent_id = settings.agent_id
        self.poll_interval = settings.poll_interval_seconds
        self.timeout = httpx.Timeout(30.0, connect=10.0)
        self._running = False
        self._current_job_id: Optional[str] = None

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "X-Agent-ID": self.agent_id,
            "Content-Type": "application/json",
        }

    async def poll_for_job(self) -> Optional[Dict[str, Any]]:
        """
        Poll backend for next available job.

        Returns:
            Job dict if available, None otherwise
        """
        url = f"{self.backend_url}/api/training/agent/poll"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=self._get_headers())

                if response.status_code == 401:
                    logger.error("Authentication failed - check API key")
                    return None

                if response.status_code == 400:
                    error_data = response.json()
                    logger.error(f"Bad request: {error_data.get('error', 'Unknown')}")
                    return None

                response.raise_for_status()
                data = response.json()

                return data.get("job")

        except httpx.ConnectError:
            logger.warning(f"Cannot connect to backend at {self.backend_url}")
            return None
        except httpx.HTTPError as e:
            logger.error(f"HTTP error polling for jobs: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error polling for jobs: {e}")
            return None

    async def claim_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Claim a job for execution.

        Args:
            job_id: ID of the job to claim

        Returns:
            Dict with job_token and job details if successful, None otherwise
        """
        url = f"{self.backend_url}/api/training/agent/claim/{job_id}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, headers=self._get_headers())

                if response.status_code == 409:
                    logger.warning(f"Job {job_id} already claimed by another agent")
                    return None

                if response.status_code == 404:
                    logger.warning(f"Job {job_id} not found")
                    return None

                response.raise_for_status()
                data = response.json()

                if data.get("success"):
                    logger.info(f"Successfully claimed job {job_id}")
                    return data
                else:
                    logger.warning(f"Failed to claim job {job_id}")
                    return None

        except httpx.HTTPError as e:
            logger.error(f"HTTP error claiming job {job_id}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error claiming job {job_id}: {e}")
            return None

    async def execute_job(self, job: Dict[str, Any], job_token: str) -> bool:
        """
        Execute a training job.

        Args:
            job: Job configuration dict
            job_token: Token for metrics authentication

        Returns:
            True if job completed successfully, False otherwise
        """
        from src.training.executor import training_executor

        job_id = job["id"]
        self._current_job_id = job_id

        logger.info(f"Starting execution of job {job_id}")
        logger.info(f"Model: {job.get('model_name', 'Unknown')}")

        try:
            # Prepare job request
            job_request = {
                "execution_id": job_id,
                "job_token": job_token,
                "config": job.get("config", {}),
                "dataset_path": job.get("dataset_path"),
                "name": job.get("model_name"),
            }

            # Execute using existing executor
            result = await training_executor.start_training(job_request)

            if result.get("success"):
                logger.info(f"Job {job_id} started successfully")
                # Wait for job to complete
                await self._wait_for_job_completion(job_id)
                return True
            else:
                logger.error(f"Failed to start job {job_id}: {result.get('error')}")
                return False

        except Exception as e:
            logger.error(f"Error executing job {job_id}: {e}")
            return False
        finally:
            self._current_job_id = None

    async def _wait_for_job_completion(self, job_id: str):
        """Wait for a job to complete, checking status periodically"""
        from src.training.executor import training_executor

        while True:
            status = training_executor.get_job_status(job_id)
            if not status:
                logger.warning(f"Job {job_id} status not found")
                break

            if status.get("status") in ["completed", "failed", "cancelled"]:
                logger.info(f"Job {job_id} finished with status: {status.get('status')}")
                break

            await asyncio.sleep(5)

    async def run(self):
        """Main polling loop"""
        if not self.api_key:
            logger.warning("No API key configured - job polling disabled")
            return

        if not self.agent_id:
            logger.warning("No agent ID configured - job polling disabled")
            return

        self._running = True
        logger.info("Job poller started")
        logger.info(f"Backend URL: {self.backend_url}")
        logger.info(f"Agent ID: {self.agent_id}")
        logger.info(f"Poll interval: {self.poll_interval}s")

        consecutive_errors = 0
        max_consecutive_errors = 10

        while self._running:
            try:
                # Skip polling if already executing a job
                if self._current_job_id:
                    await asyncio.sleep(self.poll_interval)
                    continue

                # Poll for next job
                job = await self.poll_for_job()

                if job:
                    job_id = job.get("id")
                    logger.info(f"Found pending job: {job_id}")

                    # Claim the job
                    claim_result = await self.claim_job(job_id)

                    if claim_result:
                        job_token = claim_result.get("job_token")
                        job_details = claim_result.get("job", job)

                        # Execute the job
                        await self.execute_job(job_details, job_token)

                    consecutive_errors = 0
                else:
                    consecutive_errors = 0

            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Error in poll loop: {e}")

                if consecutive_errors >= max_consecutive_errors:
                    logger.error("Too many consecutive errors, backing off")
                    await asyncio.sleep(self.poll_interval * 5)
                    consecutive_errors = 0

            await asyncio.sleep(self.poll_interval)

        logger.info("Job poller stopped")

    def stop(self):
        """Stop the polling loop"""
        self._running = False
        logger.info("Job poller stop requested")

    def is_running(self) -> bool:
        """Check if poller is running"""
        return self._running

    def get_current_job_id(self) -> Optional[str]:
        """Get ID of currently executing job"""
        return self._current_job_id


def generate_agent_id() -> str:
    """Generate a unique agent ID"""
    return f"agent_{uuid.uuid4().hex[:16]}"


def get_or_create_agent_id() -> str:
    """
    Get existing agent ID from file or create a new one.

    Agent ID is stored in ~/.finetunelab/agent_id
    """
    agent_id_file = Path.home() / ".finetunelab" / "agent_id"

    if agent_id_file.exists():
        agent_id = agent_id_file.read_text().strip()
        if agent_id.startswith("agent_") and len(agent_id) >= 10:
            return agent_id

    # Create new agent ID
    agent_id = generate_agent_id()
    agent_id_file.parent.mkdir(parents=True, exist_ok=True)
    agent_id_file.write_text(agent_id)
    logger.info(f"Generated new agent ID: {agent_id}")

    return agent_id


# Global job poller instance
job_poller = JobPoller()
