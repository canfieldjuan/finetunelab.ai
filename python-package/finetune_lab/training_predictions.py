# FineTune Lab Training Predictions Client
# Date: 2025-12-16
# Purpose: Retrieve model predictions generated during training

from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class TrainingPrediction:
    """Single prediction record from training."""
    id: str
    job_id: str
    epoch: int
    step: int
    sample_index: int
    prompt: str
    prediction: str
    created_at: str
    ground_truth: Optional[str] = None
    exact_match: Optional[float] = None
    char_error_rate: Optional[float] = None
    length_ratio: Optional[float] = None
    word_overlap: Optional[float] = None
    validation_pass: Optional[bool] = None
    raw: Optional[Dict[str, Any]] = None


@dataclass
class PredictionsResponse:
    """Response from predictions endpoint."""
    job_id: str
    predictions: List[TrainingPrediction]
    total_count: int
    epoch_count: int


@dataclass
class EpochSummary:
    """Summary for a single epoch."""
    epoch: int
    prediction_count: int
    latest_step: int


@dataclass
class EpochsResponse:
    """Response from epochs endpoint."""
    job_id: str
    epochs: List[EpochSummary]


@dataclass
class EpochMetrics:
    """Aggregated metrics for a single epoch."""
    epoch: int
    step: int
    sample_count: int
    avg_exact_match: Optional[float]
    avg_char_error_rate: Optional[float]
    avg_length_ratio: Optional[float]
    avg_word_overlap: Optional[float]
    min_char_error_rate: Optional[float]
    max_char_error_rate: Optional[float]
    validation_pass_rate: Optional[float]


@dataclass
class TrendsResponse:
    """Response from trends endpoint."""
    job_id: str
    trends: List[EpochMetrics]
    overall_improvement: Optional[float]


class TrainingPredictionsClient:
    """Client for training predictions endpoints (requires 'training' scope)."""

    def __init__(self, parent: "FinetuneLabClient"):
        self._parent = parent

    def get(
        self,
        job_id: str,
        epoch: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> PredictionsResponse:
        """
        Get training predictions for a job.

        Args:
            job_id: Training job ID
            epoch: Filter by specific epoch (optional)
            limit: Max predictions to return (default 50)
            offset: Pagination offset (default 0)

        Returns:
            PredictionsResponse with predictions and metadata

        Example:
            >>> predictions = client.training_predictions.get(
            ...     job_id="job_abc123",
            ...     epoch=2,
            ...     limit=10
            ... )
            >>> for pred in predictions.predictions:
            ...     print(f"Epoch {pred.epoch}: {pred.prediction}")
        """
        params = {"limit": limit, "offset": offset}
        if epoch is not None:
            params["epoch"] = epoch

        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}",
            params=params,
        )

        predictions = [
            TrainingPrediction(
                id=p.get("id", ""),
                job_id=p.get("job_id", job_id),
                epoch=p.get("epoch", 0),
                step=p.get("step", 0),
                sample_index=p.get("sample_index", 0),
                prompt=p.get("prompt", ""),
                prediction=p.get("prediction", ""),
                created_at=p.get("created_at", ""),
                ground_truth=p.get("ground_truth"),
                exact_match=p.get("exact_match"),
                char_error_rate=p.get("char_error_rate"),
                length_ratio=p.get("length_ratio"),
                word_overlap=p.get("word_overlap"),
                validation_pass=p.get("validation_pass"),
                raw=p,
            )
            for p in response.get("predictions", [])
        ]

        return PredictionsResponse(
            job_id=response.get("job_id", job_id),
            predictions=predictions,
            total_count=response.get("total_count", 0),
            epoch_count=response.get("epoch_count", 0),
        )

    def epochs(self, job_id: str) -> EpochsResponse:
        """
        Get epoch summaries for a job.

        Args:
            job_id: Training job ID

        Returns:
            EpochsResponse with epoch summaries

        Example:
            >>> epochs = client.training_predictions.epochs("job_abc123")
            >>> for ep in epochs.epochs:
            ...     print(f"Epoch {ep.epoch}: {ep.prediction_count} predictions")
        """
        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}/epochs",
        )

        epoch_summaries = [
            EpochSummary(
                epoch=e.get("epoch", 0),
                prediction_count=e.get("prediction_count", 0),
                latest_step=e.get("latest_step", 0),
            )
            for e in response.get("epochs", [])
        ]

        return EpochsResponse(
            job_id=response.get("job_id", job_id),
            epochs=epoch_summaries,
        )

    def trends(self, job_id: str) -> TrendsResponse:
        """
        Get quality trends across epochs.

        Args:
            job_id: Training job ID

        Returns:
            TrendsResponse with aggregated metrics per epoch

        Example:
            >>> trends = client.training_predictions.trends("job_abc123")
            >>> for trend in trends.trends:
            ...     print(f"Epoch {trend.epoch}: CER={trend.avg_char_error_rate:.2f}")
            >>> print(f"Overall improvement: {trends.overall_improvement:.1f}%")
        """
        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}/trends",
        )

        metrics = [
            EpochMetrics(
                epoch=t.get("epoch", 0),
                step=t.get("step", 0),
                sample_count=t.get("sample_count", 0),
                avg_exact_match=t.get("avg_exact_match"),
                avg_char_error_rate=t.get("avg_char_error_rate"),
                avg_length_ratio=t.get("avg_length_ratio"),
                avg_word_overlap=t.get("avg_word_overlap"),
                min_char_error_rate=t.get("min_char_error_rate"),
                max_char_error_rate=t.get("max_char_error_rate"),
                validation_pass_rate=t.get("validation_pass_rate"),
            )
            for t in response.get("trends", [])
        ]

        return TrendsResponse(
            job_id=response.get("job_id", job_id),
            trends=metrics,
            overall_improvement=response.get("overall_improvement"),
        )

    def create(
        self,
        job_id: str,
        job_token: str,
        predictions: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Send training predictions to the platform.

        Use this to send prediction data from local training to the platform
        for storage and analytics. Requires job_token from training.create_job().

        Args:
            job_id: Training job ID
            job_token: Job authentication token from create_job()
            predictions: List of prediction dicts with:
                - epoch: Epoch number (int)
                - step: Training step (int)
                - sample_index: Sample index in dataset (int)
                - prompt: Input prompt (str)
                - prediction: Model output (str)
                - ground_truth: Expected output (str, optional)
                - exact_match: Exact match score (float, optional)
                - char_error_rate: Character error rate (float, optional)
                - validation_pass: Whether validation passed (bool, optional)

        Returns:
            Response with success status and count

        Example:
            >>> job = client.training.create_job("job_123", ...)
            >>> client.training_predictions.create(
            ...     job_id="job_123",
            ...     job_token=job['job_token'],
            ...     predictions=[{
            ...         "epoch": 1,
            ...         "step": 100,
            ...         "sample_index": 0,
            ...         "prompt": "What is 2+2?",
            ...         "prediction": "4",
            ...         "ground_truth": "4"
            ...     }]
            ... )
        """
        # Make request with job_token authentication
        # Override the default session headers for this request
        import requests

        url = f"{self._parent.base_url}/api/training/local/predictions"
        headers = {
            "Authorization": f"Bearer {job_token}",
            "Content-Type": "application/json",
            "User-Agent": "finetune-lab-python/0.2.0",
        }

        payload = {
            "job_id": job_id,
            "predictions": predictions,
        }

        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=self._parent.timeout,
        )

        if not response.ok:
            error_data = {}
            try:
                error_data = response.json()
            except Exception:
                pass

            from finetune_lab.client import FinetuneLabError
            raise FinetuneLabError(
                error_data.get("error", f"HTTP {response.status_code}"),
                status_code=response.status_code,
                details=error_data,
            )

        return response.json()
