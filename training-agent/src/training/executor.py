"""
Training job executor with pause/resume/cancel support
"""
import asyncio
import sys
import traceback
from pathlib import Path
from typing import Optional, Dict, List
from datetime import datetime
from loguru import logger

import torch
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    TrainerCallback,
    TrainerState,
    TrainerControl,
)
from datasets import load_from_disk

from src.models.training import (
    TrainingJobState,
    TrainingJobStatus,
    TrainingMetrics,
    JobStatus,
)
from src.monitoring.gpu_monitor import gpu_monitor
from src.config import settings


class LogCapture:
    """Captures stdout/stderr to both console and list"""

    def __init__(self, log_list: List[str], max_lines: int = 10000):
        self.log_list = log_list
        self.max_lines = max_lines
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr

    def write(self, text: str):
        """Write to both original stream and capture list"""
        self.original_stdout.write(text)
        self.original_stdout.flush()

        if text.strip():
            timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
            line = f"[{timestamp}] {text.strip()}"
            self.log_list.append(line)

            if len(self.log_list) > self.max_lines:
                self.log_list.pop(0)

    def flush(self):
        self.original_stdout.flush()


class PauseResumeCallback(TrainerCallback):
    """Custom callback to handle pause/resume/cancel during training"""

    def __init__(self, job_state: TrainingJobState, executor: 'TrainingExecutor'):
        self.job_state = job_state
        self.executor = executor
        self.last_metrics_step = 0

    def on_step_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Called at the end of each training step"""

        # Update progress
        self.job_state.current_step = state.global_step
        self.job_state.current_epoch = int(state.epoch) if state.epoch else 0

        # Check for pause request
        if self.job_state.pause_requested:
            logger.info(f"Pause requested for job {self.job_state.job_id}")
            control.should_training_stop = True
            self.job_state.status = JobStatus.PAUSED
            self.job_state.paused_at = datetime.utcnow()
            return control

        # Check for cancel request
        if self.job_state.cancel_requested:
            logger.info(f"Cancel requested for job {self.job_state.job_id}")
            control.should_training_stop = True
            self.job_state.status = JobStatus.CANCELLED
            self.job_state.completed_at = datetime.utcnow()
            return control

        # Collect and report metrics periodically
        if state.global_step - self.last_metrics_step >= settings.metrics_report_interval_steps:
            metrics = self._collect_metrics(state, kwargs.get("model"))
            if metrics:
                # Store latest metrics
                self.job_state.latest_metrics = metrics

                # Report to backend asynchronously
                asyncio.create_task(self.executor.report_metrics(self.job_state.job_id, metrics))

            self.last_metrics_step = state.global_step

        return control

    def _collect_metrics(self, state: TrainerState, model) -> Optional[TrainingMetrics]:
        """Collect current training metrics"""
        try:
            # Get GPU metrics
            gpu_metrics = gpu_monitor.get_gpu_metrics()

            # Extract training metrics from state
            metrics = TrainingMetrics(
                step=state.global_step,
                epoch=int(state.epoch) if state.epoch else 0,
                learning_rate=state.log_history[-1].get("learning_rate") if state.log_history else None,
                **gpu_metrics
            )

            # Get loss from latest log
            if state.log_history:
                latest_log = state.log_history[-1]
                metrics.train_loss = latest_log.get("loss")
                metrics.eval_loss = latest_log.get("eval_loss")

                # Calculate perplexity if loss available
                if metrics.train_loss:
                    metrics.train_perplexity = torch.exp(torch.tensor(metrics.train_loss)).item()
                if metrics.eval_loss:
                    metrics.eval_perplexity = torch.exp(torch.tensor(metrics.eval_loss)).item()

            return metrics

        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return None


class TrainingExecutor:
    """Manages training job execution with pause/resume/cancel support"""

    def __init__(self):
        self.jobs: Dict[str, TrainingJobState] = {}
        self.trainers: Dict[str, Trainer] = {}
        self.training_tasks: Dict[str, asyncio.Task] = {}

    async def start_training(self, job_state: TrainingJobState) -> bool:
        """
        Start a training job

        Args:
            job_state: Training job state

        Returns:
            True if started successfully
        """
        try:
            logger.info(f"Starting training job {job_state.job_id}")

            running_jobs = sum(1 for j in self.jobs.values() if j.status == JobStatus.RUNNING)
            if running_jobs >= settings.max_concurrent_jobs:
                logger.error(
                    f"Cannot start job {job_state.job_id}: "
                    f"Already running {running_jobs}/{settings.max_concurrent_jobs} jobs"
                )
                job_state.status = JobStatus.FAILED
                job_state.error = f"Concurrent job limit reached ({settings.max_concurrent_jobs})"
                return False

            # Store job state
            self.jobs[job_state.job_id] = job_state

            # Update status
            job_state.status = JobStatus.RUNNING
            job_state.started_at = datetime.utcnow()

            # Report RUNNING status to backend
            await self._update_backend_status(job_state.job_id, job_state.job_token, "running")

            # Run training in background task
            task = asyncio.create_task(self._run_training(job_state))
            self.training_tasks[job_state.job_id] = task

            return True

        except Exception as e:
            logger.error(f"Failed to start training: {e}")
            job_state.status = JobStatus.FAILED
            job_state.error = str(e)
            job_state.error_traceback = traceback.format_exc()
            return False

    async def _run_training(self, job_state: TrainingJobState):
        """Execute the actual training (runs in background)"""
        log_capture = LogCapture(job_state.logs)
        sys.stdout = log_capture
        sys.stderr = log_capture

        try:
            # Load model and tokenizer
            logger.info(f"Loading model: {job_state.config.model.get('name')}")
            model = self._load_model(job_state.config.model)
            tokenizer = self._load_tokenizer(job_state.config.tokenizer)

            # Load dataset
            logger.info(f"Loading dataset from: {job_state.dataset_path}")
            dataset = self._load_dataset_flexible(job_state.dataset_path)

            # Tokenize dataset
            def tokenize_function(examples):
                text_field = job_state.config.data.get("text_field", "text") if job_state.config.data else "text"
                max_length = job_state.config.data.get("max_seq_length", 512) if job_state.config.data else 512
                result = tokenizer(
                    examples[text_field],
                    truncation=True,
                    max_length=max_length,
                    padding="max_length",
                )
                # For causal LM, labels are the same as input_ids
                result["labels"] = result["input_ids"].copy()
                return result

            logger.info("Tokenizing dataset...")
            dataset = dataset.map(tokenize_function, batched=True, remove_columns=dataset.column_names)

            # Create training arguments
            training_args = self._create_training_args(job_state)

            # Prepare datasets (handle both Dataset and DatasetDict)
            from datasets import Dataset as HFDataset, DatasetDict

            if isinstance(dataset, DatasetDict):
                train_dataset = dataset.get("train")
                eval_dataset = dataset.get("validation") or dataset.get("test")
            elif isinstance(dataset, HFDataset):
                # Single dataset - use 80% for train, 20% for eval
                split = dataset.train_test_split(test_size=0.2, seed=42)
                train_dataset = split["train"]
                eval_dataset = split["test"]
            else:
                train_dataset = dataset
                eval_dataset = None

            # Create trainer with pause/resume callback
            trainer = Trainer(
                model=model,
                args=training_args,
                train_dataset=train_dataset,
                eval_dataset=eval_dataset,
                tokenizer=tokenizer,
                callbacks=[PauseResumeCallback(job_state, self)],
            )

            # Store trainer for control operations
            self.trainers[job_state.job_id] = trainer

            # Calculate total steps
            job_state.total_steps = len(trainer.get_train_dataloader()) * training_args.num_train_epochs
            job_state.total_epochs = training_args.num_train_epochs

            # Resume from checkpoint if specified
            resume_from = job_state.resume_from_checkpoint

            # Train
            logger.info(f"Starting training for job {job_state.job_id}")
            trainer.train(resume_from_checkpoint=resume_from)

            # Check if paused or cancelled
            if job_state.status == JobStatus.PAUSED:
                # Save checkpoint for resume
                checkpoint_path = settings.checkpoints_dir / job_state.job_id / f"checkpoint-{job_state.current_step}"
                trainer.save_model(str(checkpoint_path))
                job_state.checkpoint_path = str(checkpoint_path)
                logger.info(f"Job paused, checkpoint saved to: {checkpoint_path}")

            elif job_state.status == JobStatus.CANCELLED:
                logger.info(f"Job cancelled: {job_state.job_id}")

            else:
                # Training completed successfully
                job_state.status = JobStatus.COMPLETED
                job_state.completed_at = datetime.utcnow()

                # Save final model
                output_dir = settings.checkpoints_dir / job_state.job_id / "final"
                trainer.save_model(str(output_dir))
                job_state.checkpoint_path = str(output_dir)

                logger.info(f"Training completed successfully: {job_state.job_id}")

                # Report COMPLETED status to backend
                await self._update_backend_status(job_state.job_id, job_state.job_token, "completed")

        except Exception as e:
            logger.error(f"Training failed for job {job_state.job_id}: {e}")
            logger.error(traceback.format_exc())

            job_state.status = JobStatus.FAILED
            job_state.error = str(e)
            job_state.error_traceback = traceback.format_exc()
            job_state.completed_at = datetime.utcnow()

            # Report FAILED status to backend
            await self._update_backend_status(job_state.job_id, job_state.job_token, "failed", error=str(e))

        finally:
            # Restore original streams
            sys.stdout = log_capture.original_stdout
            sys.stderr = log_capture.original_stderr

            # Send final logs to backend
            if job_state.job_token and len(job_state.logs) > 0:
                try:
                    await self._send_logs_to_backend(
                        job_state.job_id,
                        job_state.job_token,
                        job_state.logs
                    )
                except Exception as e:
                    logger.error(f"Failed to send final logs: {e}")

            # Cleanup
            if job_state.job_id in self.trainers:
                del self.trainers[job_state.job_id]

            if job_state.job_id in self.training_tasks:
                del self.training_tasks[job_state.job_id]

            # Clear GPU cache
            gpu_monitor.clear_cache()

    def _load_model(self, model_config: Dict) -> AutoModelForCausalLM:
        """Load model from config"""
        model_name = model_config.get("name")
        kwargs = {}

        # Handle quantization
        if model_config.get("quantization"):
            kwargs["load_in_8bit"] = True

        # Load model
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if settings.enable_mixed_precision else torch.float32,
            device_map="auto",
            **kwargs
        )

        return model

    def _load_tokenizer(self, tokenizer_config: Dict) -> AutoTokenizer:
        """Load tokenizer from config"""
        tokenizer_name = tokenizer_config.get("name")
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)

        # Set pad token if not set
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        return tokenizer

    def _create_training_args(self, job_state: TrainingJobState) -> TrainingArguments:
        """Create TrainingArguments from config"""
        config = job_state.config.training

        output_dir = settings.checkpoints_dir / job_state.job_id

        args = TrainingArguments(
            output_dir=str(output_dir),
            num_train_epochs=config.get("num_train_epochs", 3),
            per_device_train_batch_size=config.get("per_device_train_batch_size", 4),
            per_device_eval_batch_size=config.get("per_device_eval_batch_size", 4),
            learning_rate=config.get("learning_rate", 2e-5),
            warmup_steps=config.get("warmup_steps", 500),
            logging_steps=settings.metrics_report_interval_steps,
            save_steps=settings.checkpoint_interval_steps,
            eval_steps=config.get("eval_steps", 500),
            eval_strategy="steps" if config.get("eval_steps") else "no",
            save_strategy="steps",
            load_best_model_at_end=False,  # Disabled to avoid validation errors
            fp16=settings.enable_mixed_precision,  # Re-enabled for production
            report_to="none",  # Disable default reporting
        )

        return args

    def _load_dataset_flexible(self, dataset_path: str):
        """Load dataset from various formats"""
        from pathlib import Path
        import pandas as pd
        from datasets import Dataset, load_dataset

        path = Path(dataset_path)

        if path.is_dir() and (path / "dataset_info.json").exists():
            logger.info(f"Loading HuggingFace dataset from: {dataset_path}")
            return load_from_disk(dataset_path)

        if path.is_file():
            suffix = path.suffix.lower()

            if suffix == '.csv':
                logger.info(f"Loading CSV dataset: {dataset_path}")
                df = pd.read_csv(dataset_path)
                return Dataset.from_pandas(df)

            elif suffix in ['.json', '.jsonl']:
                logger.info(f"Loading JSON dataset: {dataset_path}")
                df = pd.read_json(dataset_path, lines=(suffix == '.jsonl'))
                return Dataset.from_pandas(df)

            elif suffix == '.parquet':
                logger.info(f"Loading Parquet dataset: {dataset_path}")
                df = pd.read_parquet(dataset_path)
                return Dataset.from_pandas(df)

        if dataset_path.startswith(('http://', 'https://', 's3://', 'hf://')):
            logger.info(f"Loading dataset from URL: {dataset_path}")
            return load_dataset(dataset_path, split='train')

        raise ValueError(
            f"Unsupported dataset format: {dataset_path}\n"
            f"Supported formats: HuggingFace (directory), CSV, JSON, JSONL, Parquet, URLs"
        )

    async def pause_training(self, job_id: str) -> bool:
        """Request pause for a training job"""
        job_state = self.jobs.get(job_id)
        if not job_state:
            logger.warning(f"Job not found: {job_id}")
            return False

        if job_state.status != JobStatus.RUNNING:
            logger.warning(f"Job is not running: {job_id}")
            return False

        logger.info(f"Requesting pause for job: {job_id}")
        job_state.pause_requested = True
        return True

    async def resume_training(self, job_id: str, checkpoint_path: Optional[str] = None) -> bool:
        """Resume a paused training job"""
        job_state = self.jobs.get(job_id)
        if not job_state:
            logger.warning(f"Job not found: {job_id}")
            return False

        if job_state.status != JobStatus.PAUSED:
            logger.warning(f"Job is not paused: {job_id}")
            return False

        checkpoint = checkpoint_path or job_state.checkpoint_path
        if not checkpoint or not Path(checkpoint).exists():
            logger.error(f"No valid checkpoint found for resume: {checkpoint}")
            return False

        logger.info(f"Resuming job {job_id} from checkpoint: {checkpoint}")

        job_state.resume_from_checkpoint = checkpoint
        job_state.pause_requested = False
        job_state.paused_at = None
        job_state.status = JobStatus.RUNNING

        await self._update_backend_status(job_state.job_id, job_state.job_token, "running")

        task = asyncio.create_task(self._run_training(job_state))
        self.training_tasks[job_state.job_id] = task

        return True

    async def cancel_training(self, job_id: str) -> bool:
        """Cancel a training job"""
        job_state = self.jobs.get(job_id)
        if not job_state:
            logger.warning(f"Job not found: {job_id}")
            return False

        if job_state.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED]:
            logger.warning(f"Job already finished: {job_id}")
            return False

        logger.info(f"Requesting cancel for job: {job_id}")
        job_state.cancel_requested = True

        if job_id in self.training_tasks:
            task = self.training_tasks[job_id]
            if not task.done():
                logger.warning(f"Forcefully cancelling hung training task: {job_id}")
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    logger.info(f"Task cancelled successfully: {job_id}")
                finally:
                    del self.training_tasks[job_id]

        await self._update_backend_status(job_state.job_id, job_state.job_token, "cancelled")

        return True

    def get_job_status(self, job_id: str) -> Optional[TrainingJobStatus]:
        """Get current status of a job"""
        job_state = self.jobs.get(job_id)
        if not job_state:
            return None

        # Calculate progress
        progress = 0.0
        if job_state.total_steps > 0:
            progress = (job_state.current_step / job_state.total_steps) * 100

        # Build status response
        status = TrainingJobStatus(
            job_id=job_id,
            status=job_state.status,
            current_step=job_state.current_step,
            current_epoch=job_state.current_epoch,
            total_steps=job_state.total_steps,
            total_epochs=job_state.total_epochs,
            progress=round(progress, 2),
            started_at=job_state.started_at,
            completed_at=job_state.completed_at,
            error=job_state.error,
        )

        # Add latest metrics if available
        if job_state.latest_metrics:
            status.loss = job_state.latest_metrics.train_loss
            status.eval_loss = job_state.latest_metrics.eval_loss
            status.learning_rate = job_state.latest_metrics.learning_rate
            status.gpu_memory_allocated_gb = job_state.latest_metrics.gpu_memory_allocated_gb
            status.gpu_utilization_percent = job_state.latest_metrics.gpu_utilization_percent

        return status

    async def report_metrics(self, job_id: str, metrics: TrainingMetrics):
        """Report metrics to backend"""
        from src.api.backend_client import backend_client

        job_state = self.jobs.get(job_id)
        if not job_state or not job_state.job_token:
            logger.warning(f"Cannot report metrics - job_token not set for {job_id}")
            return

        # Send metrics to backend
        await backend_client.report_metrics(job_id, job_state.job_token, metrics)

    async def _update_backend_status(
        self,
        job_id: str,
        job_token: Optional[str],
        status: str,
        error: Optional[str] = None
    ):
        """Update job status in backend"""
        from src.api.backend_client import backend_client

        if not job_token:
            logger.warning(f"Cannot update status - job_token not set for {job_id}")
            return

        try:
            await backend_client.update_job_status(job_id, job_token, status, error)
            logger.info(f"Backend status updated: {job_id} -> {status}")
        except Exception as e:
            logger.error(f"Failed to update backend status: {e}")

    async def _send_logs_to_backend(
        self,
        job_id: str,
        job_token: str,
        logs: List[str],
        batch_size: int = 100
    ):
        """Send logs to backend in batches"""
        from src.api.backend_client import backend_client

        for i in range(0, len(logs), batch_size):
            batch = logs[i:i + batch_size]
            try:
                await backend_client.send_logs(job_id, job_token, batch)
                logger.debug(f"Sent {len(batch)} log lines to backend")
            except Exception as e:
                logger.error(f"Failed to send log batch: {e}")


# Global executor instance
training_executor = TrainingExecutor()
