# FineTune Lab API Client
# Date: 2025-12-12
# Purpose: API key authenticated client for inference, batch testing, and analytics

import os
import json
import requests
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass

from .training_predictions import TrainingPredictionsClient


@dataclass
class PredictResponse:
    """Response from predict endpoint."""
    id: str
    model: str
    content: str
    usage: Optional[Dict[str, int]]
    finish_reason: Optional[str]
    raw: Dict[str, Any]


@dataclass
class BatchTestRun:
    """Batch test run information."""
    test_id: str
    status: str
    total_prompts: int
    completed: int
    failed: int
    raw: Dict[str, Any]


class BatchTestClient:
    """Client for batch testing endpoints (testing scope)."""

    def __init__(self, parent: "FinetuneLabClient"):
        self._parent = parent

    def run(
        self,
        model_id: str,
        test_suite_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
        source_path: Optional[str] = None,
        prompt_limit: int = 25,
        concurrency: int = 3,
        delay_ms: int = 1000,
        name: Optional[str] = None,
    ) -> BatchTestRun:
        """
        Run a batch test.

        Args:
            model_id: Model ID from your registered models
            test_suite_id: ID of test suite with prompts (recommended)
            dataset_id: ID of saved dataset (alternative)
            source_path: File path to prompts (alternative)
            prompt_limit: Maximum prompts to test (default 25)
            concurrency: Concurrent requests (default 3)
            delay_ms: Delay between requests in ms (default 1000)
            name: Optional name for the test run

        Returns:
            BatchTestRun with test_id and initial status
        """
        if not any([test_suite_id, dataset_id, source_path]):
            raise ValueError(
                "One of test_suite_id, dataset_id, or source_path is required"
            )

        config = {
            "model_id": model_id,
            "prompt_limit": prompt_limit,
            "concurrency": concurrency,
            "delay_ms": delay_ms,
        }

        if test_suite_id:
            config["test_suite_id"] = test_suite_id
        if dataset_id:
            config["dataset_id"] = dataset_id
        if source_path:
            config["source_path"] = source_path
        if name:
            config["name"] = name

        response = self._parent._request(
            "POST",
            "/api/batch-testing/run",
            json={"config": config},
        )

        return BatchTestRun(
            test_id=response.get("test_id", ""),
            status=response.get("status", "unknown"),
            total_prompts=response.get("results", {}).get("total_prompts", 0),
            completed=response.get("results", {}).get("successful", 0),
            failed=response.get("results", {}).get("failed", 0),
            raw=response,
        )

    def status(self, test_id: str) -> BatchTestRun:
        """
        Get status of a batch test run.

        Args:
            test_id: The test run ID

        Returns:
            BatchTestRun with current status
        """
        response = self._parent._request(
            "GET",
            f"/api/batch-testing/status/{test_id}",
        )

        return BatchTestRun(
            test_id=test_id,
            status=response.get("status", "unknown"),
            total_prompts=response.get("total_prompts", 0),
            completed=response.get("completed_prompts", 0),
            failed=response.get("failed_prompts", 0),
            raw=response,
        )

    def cancel(self, test_id: str) -> Dict[str, Any]:
        """
        Cancel a running batch test.

        Args:
            test_id: The test run ID to cancel

        Returns:
            Cancellation response
        """
        return self._parent._request(
            "POST",
            "/api/batch-testing/cancel",
            json={"test_id": test_id},
        )


class AnalyticsClient:
    """Client for analytics endpoints (production scope)."""

    def __init__(self, parent: "FinetuneLabClient"):
        self._parent = parent

    def traces(
        self,
        limit: int = 50,
        offset: int = 0,
        conversation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get traces from analytics.

        Args:
            limit: Max traces to return (default 50)
            offset: Pagination offset
            conversation_id: Filter by conversation
            trace_id: Filter by specific trace

        Returns:
            Dict with traces array and metadata
        """
        params = {"limit": limit, "offset": offset}
        if conversation_id:
            params["conversation_id"] = conversation_id
        if trace_id:
            params["trace_id"] = trace_id

        return self._parent._request("GET", "/api/analytics/traces", params=params)

    def create_trace(self, trace: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new trace.

        Args:
            trace: Trace data including trace_id, span_id, span_name, etc.

        Returns:
            Created trace response
        """
        return self._parent._request("POST", "/api/analytics/traces", json=trace)

    def data(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        granularity: str = "day",
    ) -> Dict[str, Any]:
        """
        Get aggregated analytics data.

        Args:
            start_date: Start date (ISO format)
            end_date: End date (ISO format)
            granularity: Data granularity (hour, day, week)

        Returns:
            Aggregated analytics data
        """
        params = {"granularity": granularity}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date

        return self._parent._request("GET", "/api/analytics/data", params=params)

    def create_trace(
        self,
        span_name: str,
        operation_type: str,
        model_name: Optional[str] = None,
        duration_ms: Optional[int] = None,
        conversation_id: Optional[str] = None,
        input_data: Optional[Dict[str, Any]] = None,
        output_data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a trace for production monitoring.

        Args:
            span_name: Name of the span (e.g., "llm.completion")
            operation_type: Type of operation (e.g., "llm_call", "embedding", "tool_call")
            model_name: Model identifier (optional)
            duration_ms: Duration in milliseconds (optional)
            conversation_id: Conversation/request ID (optional)
            input_data: Input data (optional)
            output_data: Output data (optional)
            metadata: Additional metadata (optional)
            trace_id: Trace ID (auto-generated if not provided)
            span_id: Span ID (auto-generated if not provided)

        Returns:
            Created trace response

        Example:
            >>> client.analytics.create_trace(
            ...     span_name="llm.completion",
            ...     operation_type="llm_call",
            ...     model_name="gpt-4",
            ...     duration_ms=245,
            ...     input_data={"prompt": "Hello"},
            ...     output_data={"response": "Hi there!"}
            ... )
        """
        import uuid

        # Auto-generate IDs if not provided
        final_trace_id = trace_id or str(uuid.uuid4())
        final_span_id = span_id or str(uuid.uuid4())

        payload = {
            "trace_id": final_trace_id,
            "span_id": final_span_id,
            "span_name": span_name,
            "operation_type": operation_type,
        }

        # Add optional fields only if provided
        if conversation_id is not None:
            payload["conversation_id"] = conversation_id
        if model_name is not None:
            payload["model_name"] = model_name
        if duration_ms is not None:
            payload["duration_ms"] = duration_ms
        if input_data is not None:
            payload["input_data"] = input_data
        if output_data is not None:
            payload["output_data"] = output_data
        if metadata is not None:
            payload["metadata"] = metadata

        return self._parent._request("POST", "/api/analytics/traces", json=payload)


class TrainingClient:
    """Client for training job management (training scope)."""

    def __init__(self, parent: "FinetuneLabClient"):
        self._parent = parent

    def create_job(
        self,
        job_id: str,
        model_name: Optional[str] = None,
        dataset_path: Optional[str] = None,
        status: str = "running",
        config: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Create or update a training job record.

        This creates a job record in the platform and returns a job_token
        that you'll use to send training predictions.

        Args:
            job_id: Unique identifier for this training job
            model_name: Name of the model being trained (optional)
            dataset_path: Path to training dataset (optional)
            status: Job status (default: "running")
            config: Training configuration dict (optional)

        Returns:
            Job record with job_token for authentication

        Example:
            >>> job = client.training.create_job(
            ...     job_id="local_training_001",
            ...     model_name="llama-3-8b-tool-use",
            ...     dataset_path="./data/tiny_tool_use.jsonl",
            ...     config={"epochs": 3, "batch_size": 4}
            ... )
            >>> print(f"Job token: {job['job_token']}")
        """
        payload = {
            "job_id": job_id,
            "status": status,
        }

        if model_name is not None:
            payload["model_name"] = model_name
        if dataset_path is not None:
            payload["dataset_path"] = dataset_path
        if config is not None:
            payload["config"] = config

        return self._parent._request("POST", "/api/training/local/jobs", json=payload)

    def list_jobs(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List all training jobs for the authenticated user.

        Args:
            limit: Maximum number of jobs to return (default 50)
            offset: Offset for pagination (default 0)

        Returns:
            Dict with 'jobs' array and pagination info

        Example:
            >>> jobs = client.training.list_jobs(limit=10)
            >>> for job in jobs['jobs']:
            ...     print(f"{job['id']}: {job['status']}")
        """
        params = {"limit": str(limit), "offset": str(offset)}
        return self._parent._request("GET", "/api/training/jobs", params=params)

    def get_metrics(self, job_id: str) -> Dict[str, Any]:
        """
        Get complete training metrics history for a job.

        Returns all metric points including:
        - Loss metrics (train_loss, eval_loss)
        - GPU metrics (memory, utilization)
        - Performance (samples/sec, tokens/sec)
        - Training params (learning_rate, grad_norm)

        Args:
            job_id: Training job ID

        Returns:
            Dict with 'job_id' and 'metrics' array

        Example:
            >>> metrics = client.training.get_metrics("job_abc123")
            >>> for point in metrics['metrics']:
            ...     print(f"Step {point['step']}: Loss {point['train_loss']}")
        """
        return self._parent._request("GET", f"/api/training/local/{job_id}/metrics")

    def get_logs(
        self,
        job_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get training logs for debugging and monitoring.

        Access raw console output including:
        - Model initialization logs
        - Training progress messages
        - Warnings and errors
        - Checkpoint notifications

        Args:
            job_id: Training job ID
            limit: Max log lines to return (default 100)
            offset: Line offset for pagination (default 0)

        Returns:
            Dict with 'logs' array, 'total_lines', 'offset', 'limit'

        Example:
            >>> logs = client.training.get_logs("job_abc123", limit=50)
            >>> for line in logs['logs']:
            ...     print(line)
            >>>
            >>> # Get next page
            >>> more_logs = client.training.get_logs("job_abc123", limit=50, offset=50)
        """
        params = {"limit": str(limit), "offset": str(offset)}
        return self._parent._request(
            "GET",
            f"/api/training/local/{job_id}/logs",
            params=params,
        )

    def get_errors(self, job_id: str) -> Dict[str, Any]:
        """
        Get structured error information from training logs.

        Returns:
        - Deduplicated error messages with counts
        - Full traceback with parsed frames
        - Error classification and phase info

        Args:
            job_id: Training job ID

        Returns:
            Dict with unique errors, counts, and tracebacks

        Example:
            >>> errors = client.training.get_errors("job_abc123")
            >>> print(f"Found {errors['unique_error_count']} unique errors")
            >>> for error in errors['errors']:
            ...     print(f"{error['message']} (count: {error['count']})")
            ...     if error['traceback']:
            ...         print(error['traceback'])
        """
        return self._parent._request("GET", f"/api/training/local/{job_id}/errors")


class FinetuneLabClient:
    """
    FineTune Lab API Client.

    Authenticated client for inference, batch testing, and analytics.
    Requires an API key with appropriate scopes.

    Example:
        >>> from finetune_lab import FinetuneLabClient
        >>> client = FinetuneLabClient(api_key="wak_xxx")
        >>> response = client.predict("gpt-4", [{"role": "user", "content": "Hello"}])
        >>> print(response.content)
    """

    DEFAULT_BASE_URL = "https://finetunelab.ai"

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 60,
    ):
        """
        Initialize the client.

        Args:
            api_key: API key (or set FINETUNE_LAB_API_KEY env var)
            base_url: API base URL (or set FINETUNE_LAB_API_URL env var)
            timeout: Request timeout in seconds (default 60)
        """
        self.api_key = api_key or os.getenv("FINETUNE_LAB_API_KEY")
        if not self.api_key:
            raise FinetuneLabError(
                "API key required. Pass api_key parameter or set "
                "FINETUNE_LAB_API_KEY environment variable.",
                status_code=400
            )

        self.base_url = (
            base_url
            or os.getenv("FINETUNE_LAB_API_URL")
            or self.DEFAULT_BASE_URL
        ).rstrip("/")

        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers.update({
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "finetune-lab-python/0.6.0",
        })

        # Sub-clients
        self.batch_test = BatchTestClient(self)
        self.analytics = AnalyticsClient(self)
        self.training = TrainingClient(self)
        self.training_predictions = TrainingPredictionsClient(self)

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """Make an authenticated request."""
        url = f"{self.base_url}{endpoint}"

        try:
            response = self._session.request(
                method=method,
                url=url,
                params=params,
                json=json,
                timeout=self.timeout,
            )

            # Handle error responses
            if not response.ok:
                error_data = {}
                try:
                    error_data = response.json()
                except Exception:
                    pass

                error_msg = error_data.get("error", {})
                if isinstance(error_msg, dict):
                    error_msg = error_msg.get("message", response.text)
                elif isinstance(error_msg, str):
                    pass
                else:
                    error_msg = response.text

                raise FinetuneLabError(
                    message=str(error_msg),
                    status_code=response.status_code,
                    response=error_data,
                )

            return response.json()

        except requests.exceptions.Timeout:
            raise FinetuneLabError(
                message=f"Request timed out after {self.timeout}s",
                status_code=408,
            )
        except requests.exceptions.ConnectionError as e:
            raise FinetuneLabError(
                message=f"Connection error: {e}",
                status_code=0,
            )

    def predict(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ) -> PredictResponse:
        """
        Run inference on a model.

        Args:
            model: Model ID (e.g., "gpt-4", "claude-3-sonnet")
            messages: List of message dicts with role and content
            temperature: Sampling temperature (0-2)
            max_tokens: Maximum tokens to generate
            stream: Whether to stream response (not yet supported)

        Returns:
            PredictResponse with model output

        Example:
            >>> response = client.predict(
            ...     model="gpt-4",
            ...     messages=[{"role": "user", "content": "Hello!"}],
            ...     temperature=0.7,
            ... )
            >>> print(response.content)
        """
        if stream:
            raise NotImplementedError("Streaming not yet supported in Python SDK")

        payload: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
        }

        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        response = self._request("POST", "/api/v1/predict", json=payload)

        # Parse OpenAI-compatible response
        choices = response.get("choices", [])
        content = ""
        finish_reason = None

        if choices:
            choice = choices[0]
            message = choice.get("message", {})
            content = message.get("content", "")
            finish_reason = choice.get("finish_reason")

        return PredictResponse(
            id=response.get("id", ""),
            model=response.get("model", model),
            content=content,
            usage=response.get("usage"),
            finish_reason=finish_reason,
            raw=response,
        )


class FinetuneLabError(Exception):
    """Exception raised for API errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 0,
        response: Optional[Dict] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.response = response or {}
        super().__init__(self.message)

    def __str__(self):
        if self.status_code:
            return f"[{self.status_code}] {self.message}"
        return self.message
