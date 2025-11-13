"""
FineTune Lab - Standalone Training Module
Standalone trainer for local execution of LLM fine-tuning.
Supports SFT, DPO, and Teacher Mode training methods.

This module can be packaged and distributed independently.
"""

import logging
import sys
import json
import os
import time
import warnings
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
from collections import deque

import torch

# Suppress tqdm progress bars in logs (they create 100+ lines of noise)
os.environ['TQDM_DISABLE'] = '1'

# Suppress known warnings that cannot be fixed
warnings.filterwarnings('ignore', message='.*use_reentrant.*')
warnings.filterwarnings('ignore', message='.*flash attention.*')
warnings.filterwarnings('ignore', message='.*Padding-free training.*')
warnings.filterwarnings('ignore', message='.*packing.*attention.*')

# GPU utilization monitoring (Phase 2.1)
try:
    import pynvml
    PYNVML_AVAILABLE = True
except ImportError:
    PYNVML_AVAILABLE = False
    logging.warning("[Trainer] pynvml not available, GPU utilization tracking disabled")

from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    AutoModelForSequenceClassification,
    BitsAndBytesConfig,
    TrainerCallback,
    TrainerState,
    TrainerControl,
    TrainingArguments
)
from datasets import Dataset, IterableDataset
from peft import (
    LoraConfig,
    get_peft_model,
    TaskType,
    prepare_model_for_kbit_training
)
from trl import DPOTrainer, SFTTrainer, DPOConfig, SFTConfig, PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead, ORPOTrainer, ORPOConfig
from torch.utils.tensorboard import SummaryWriter


logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class TrainingMetricsCallback(TrainerCallback):
    """
    Callback to track and persist training metrics for real-time monitoring.
    Writes metrics to progress.json file for external consumption (UI, monitoring).
    
    Tracks:
    - Loss (train and eval)
    - Learning rate
    - Progress (epoch, step, percentage)
    - Timing (elapsed, ETA, throughput)
    - GPU memory (if available)
    - Gradient norm
    """
    
    def __init__(self, progress_file: Path, total_epochs: int, max_history: int = None):
        """
        Initialize metrics callback.
        
        Args:
            progress_file: Path to write progress.json
            total_epochs: Total number of training epochs
            max_history: Maximum number of historical points to keep (None = unlimited)
        """
        self.progress_file = Path(progress_file)
        self.total_epochs = total_epochs
        self.max_history = max_history
        
        self.start_time = None
        self.last_log_time = None
        # Use list instead of deque when no limit, or deque with maxlen when limited
        if max_history is None:
            self.metrics_history: list = []
        else:
            self.metrics_history: deque = deque(maxlen=max_history)

        # Store last known logs for reuse in on_step_end
        self.last_logs = {}

        # Best model tracking
        self.best_eval_loss = float('inf')
        self.best_epoch = 0
        self.best_step = 0
        self.epochs_without_improvement = 0

        # Dataset statistics (set during training)
        self.total_samples = 0
        self.train_samples = 0
        self.val_samples = 0
        self.total_tokens_processed = 0

        # Loss trend tracking
        self.recent_losses = deque(maxlen=10)

        logger.info(
            f"[MetricsCallback] Initialized: {total_epochs} epochs, "
            f"max_history={max_history}, progress_file={progress_file.name}"
        )
    
    def on_train_begin(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Initialize tracking when training starts."""
        self.start_time = datetime.utcnow()
        self.last_log_time = self.start_time
        
        logger.info("[MetricsCallback] Training started")
        logger.info(f"[MetricsCallback] Total steps: {state.max_steps}")
        
        self._write_progress(
            state=state,
            current_epoch=0,
            logs=None,
            status="running"
        )
    
    def on_log(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        logs: Optional[Dict[str, float]] = None,
        **kwargs
    ):
        """Update metrics on each logging step."""
        if not logs:
            logger.debug("[MetricsCallback] on_log called with no logs, skipping")
            return

        # Store logs for reuse in on_step_end
        self.last_logs = logs.copy()

        current_epoch = int(state.epoch) if state.epoch else 0
        
        now = datetime.utcnow()
        should_log_console = (now - self.last_log_time).total_seconds() >= 30
        
        if should_log_console:
            loss = logs.get('loss') or logs.get('train_loss')
            lr = logs.get('learning_rate')
            loss_str = f"{loss:.4f}" if loss is not None else "N/A"
            lr_str = f"{lr:.2e}" if lr is not None else "N/A"
            logger.info(
                f"[Progress] Epoch {current_epoch}/{self.total_epochs} | "
                f"Step {state.global_step}/{state.max_steps} | "
                f"Loss {loss_str} | "
                f"LR {lr_str}"
            )
            self.last_log_time = now
        
        self._write_progress(
            state=state,
            current_epoch=current_epoch,
            logs=logs,
            status="running"
        )

    def on_step_end(self, args, state, control, **kwargs):
        """Called after every training step to update progress in real-time."""
        current_epoch = int(state.epoch) if state.epoch else 0

        # Update progress on every step for real-time UI updates
        # Use last known logs to preserve metrics between logging steps
        self._write_progress(
            state=state,
            current_epoch=current_epoch,
            logs=self.last_logs if self.last_logs else None,
            status="running"
        )
        
        logger.debug(f"[MetricsCallback] Step {state.global_step} progress updated")

    def _calculate_perplexity(self, loss: float) -> float:
        """Calculate perplexity from loss. Returns exp(loss)."""
        try:
            import math
            perplexity = math.exp(loss)
            logger.debug(f"[MetricsCallback] Calculated perplexity: {perplexity:.4f} from loss: {loss:.4f}")
            return perplexity
        except (ValueError, OverflowError) as e:
            logger.warning(f"[MetricsCallback] Perplexity calculation failed for loss={loss}: {e}")
            return None

    def _update_best_model(self, eval_loss: float, current_epoch: int, current_step: int):
        """Track best model based on eval_loss."""
        if eval_loss < self.best_eval_loss:
            self.best_eval_loss = eval_loss
            self.best_epoch = current_epoch
            self.best_step = current_step
            self.epochs_without_improvement = 0
            logger.info(
                f"[MetricsCallback] New best model! "
                f"Eval Loss: {eval_loss:.6f} at Epoch {current_epoch}, Step {current_step}"
            )
        else:
            self.epochs_without_improvement += 1
            logger.debug(f"[MetricsCallback] No improvement for {self.epochs_without_improvement} evaluations")

    def _analyze_loss_trend(self) -> str:
        """Analyze recent loss trend. Returns 'improving', 'degrading', or 'stable'."""
        if len(self.recent_losses) < 3:
            return "insufficient_data"

        losses = list(self.recent_losses)
        first_half_avg = sum(losses[:len(losses)//2]) / (len(losses)//2)
        second_half_avg = sum(losses[len(losses)//2:]) / (len(losses) - len(losses)//2)

        diff = first_half_avg - second_half_avg
        threshold = 0.01

        if diff > threshold:
            return "improving"
        elif diff < -threshold:
            return "degrading"
        else:
            return "stable"

    def set_dataset_info(self, train_dataset: Dataset, eval_dataset: Dataset):
        """
        Calculate dataset statistics including average tokens per sample.
        Call this after datasets are loaded.

        Args:
            train_dataset: Training dataset
            eval_dataset: Evaluation dataset
        """
        # Handle both Dataset and IterableDataset
        if isinstance(train_dataset, IterableDataset):
            # Streaming datasets don't have len()
            self.train_samples = None
            self.val_samples = None if isinstance(eval_dataset, IterableDataset) else len(eval_dataset)
            self.total_samples = None
            logger.info("[MetricsCallback] Streaming mode: dataset sizes unknown")
            logger.info("[MetricsCallback] Token calculation disabled for streaming datasets")
            self.avg_tokens_per_sample = 206  # Use reasonable default
            return
        else:
            self.train_samples = len(train_dataset)
            self.val_samples = len(eval_dataset) if not isinstance(eval_dataset, IterableDataset) else None
            self.total_samples = self.train_samples + (self.val_samples or 0)

            logger.info(f"[MetricsCallback] Total samples: {self.total_samples}")
            logger.info(f"[MetricsCallback] Train samples: {self.train_samples}")
            logger.info(f"[MetricsCallback] Eval samples: {self.val_samples}")

        # Calculate average sequence length from training dataset
        try:
            if 'input_ids' in train_dataset.features:
                # Sample up to 1000 examples to estimate average
                sample_size = min(1000, len(train_dataset))
                sample_step = max(1, len(train_dataset) // sample_size)

                total_tokens = 0
                count = 0
                for idx in range(0, len(train_dataset), sample_step):
                    if count >= sample_size:
                        break
                    tokens = len(train_dataset[idx]['input_ids'])
                    total_tokens += tokens
                    count += 1

                self.avg_tokens_per_sample = total_tokens / count if count > 0 else 0
                logger.info(f"[MetricsCallback] Average tokens per sample: {self.avg_tokens_per_sample:.0f}")
                logger.info(f"[MetricsCallback] Sampled {count} examples for token calculation")
            else:
                self.avg_tokens_per_sample = 0
                logger.warning("[MetricsCallback] Dataset does not have 'input_ids' field, cannot calculate tokens per sample")
        except Exception as e:
            self.avg_tokens_per_sample = 0
            logger.warning(f"[MetricsCallback] Could not calculate tokens per sample: {e}")

    def on_train_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Mark training as complete."""
        logger.info("[MetricsCallback] Training ended")
        
        self._write_progress(
            state=state,
            current_epoch=self.total_epochs,
            logs=None,
            status="completed"
        )
    
    def _write_progress(
        self,
        state: TrainerState,
        current_epoch: int,
        logs: Optional[Dict[str, float]],
        status: str
    ):
        """
        Write current progress and metrics to JSON file.
        Uses atomic write (temp file + rename) to prevent corruption.
        """
        try:
            progress_percent = (state.global_step / state.max_steps * 100) if state.max_steps > 0 else 0.0
            
            elapsed = (datetime.utcnow() - self.start_time).total_seconds() if self.start_time else 0
            
            if progress_percent > 0 and elapsed > 0:
                total_estimated = elapsed / (progress_percent / 100)
                remaining = max(0, total_estimated - elapsed)
            else:
                remaining = None
            
            samples_per_sec = state.global_step / elapsed if elapsed > 0 else 0

            # Calculate tokens per second (Phase 3)
            tokens_per_sec = None
            if hasattr(self, 'avg_tokens_per_sample') and self.avg_tokens_per_sample > 0:
                tokens_per_sec = samples_per_sec * self.avg_tokens_per_sample
                logger.debug(f"[MetricsCallback] Tokens/sec: {tokens_per_sec:.0f}")

            train_loss = None
            eval_loss = None
            learning_rate = None
            grad_norm = None
            
            if logs:
                train_loss = logs.get('loss') or logs.get('train_loss')
                eval_loss = logs.get('eval_loss')
                learning_rate = logs.get('learning_rate')
                grad_norm = logs.get('grad_norm')
            
            gpu_mem_allocated = None
            gpu_mem_reserved = None
            
            try:
                if torch.cuda.is_available():
                    gpu_mem_allocated = torch.cuda.memory_allocated() / (1024 ** 3)
                    gpu_mem_reserved = torch.cuda.memory_reserved() / (1024 ** 3)
            except Exception as e:
                logger.debug(f"[MetricsCallback] Could not get GPU memory: {e}")

            # Collect GPU utilization percentage (Phase 2.1)
            gpu_utilization_percent = None
            try:
                if PYNVML_AVAILABLE and torch.cuda.is_available():
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    gpu_utilization_percent = util.gpu
                    pynvml.nvmlShutdown()
                    logger.debug(f"[MetricsCallback] GPU utilization: {gpu_utilization_percent}%")
            except Exception as e:
                logger.debug(f"[MetricsCallback] Could not get GPU utilization: {e}")

            # Calculate new metrics
            perplexity = None
            train_perplexity = None
            if eval_loss is not None:
                perplexity = self._calculate_perplexity(eval_loss)
            if train_loss is not None:
                train_perplexity = self._calculate_perplexity(train_loss)

            # Update best model tracking
            if eval_loss is not None:
                self._update_best_model(eval_loss, current_epoch, state.global_step)

            # Track recent losses for trend analysis
            if train_loss is not None:
                self.recent_losses.append(train_loss)

            # Analyze loss trend
            loss_trend = self._analyze_loss_trend()

            timestamp = datetime.utcnow().isoformat() + "Z"
            
            current_metrics = {
                "step": state.global_step,
                "epoch": current_epoch,
                "train_loss": round(train_loss, 6) if train_loss is not None else None,
                "eval_loss": round(eval_loss, 6) if eval_loss is not None else None,
                "learning_rate": learning_rate,
                "grad_norm": round(grad_norm, 6) if grad_norm is not None else None,
                "gpu_memory_allocated_gb": round(gpu_mem_allocated, 2) if gpu_mem_allocated is not None else None,
                "gpu_memory_reserved_gb": round(gpu_mem_reserved, 2) if gpu_mem_reserved is not None else None,
                "gpu_utilization_percent": gpu_utilization_percent,
                "perplexity": round(perplexity, 4) if perplexity is not None else None,
                "train_perplexity": round(train_perplexity, 4) if train_perplexity is not None else None,
                "samples_per_second": round(samples_per_sec, 2),
                "tokens_per_second": round(tokens_per_sec, 2) if tokens_per_sec is not None else None,
                "timestamp": timestamp
            }
            
            # Check if we already have a metric entry for this step (happens during evaluation)
            # If so, merge the new data instead of creating a duplicate row
            existing_metric_idx = None
            search_start = len(self.metrics_history) - 1
            search_end = max(-1, len(self.metrics_history) - 10 - 1)  # Search last 10 entries or to start
            for idx in range(search_start, search_end, -1):
                if self.metrics_history[idx].get("step") == state.global_step:
                    existing_metric_idx = idx
                    break
            
            if existing_metric_idx is not None:
                # Merge new data into existing metric (evaluation data merges with training data)
                existing = self.metrics_history[existing_metric_idx]
                for key, value in current_metrics.items():
                    if value is not None:  # Only update non-null values
                        existing[key] = value
                logger.debug(f"[MetricsCallback] Merged metrics for step {state.global_step}")
            else:
                # New step - append metrics
                self.metrics_history.append(current_metrics)
                logger.debug(f"[MetricsCallback] Appended new metrics for step {state.global_step}")
            
            progress_data = {
                "status": status,
                "current_epoch": current_epoch,
                "total_epochs": self.total_epochs,
                "current_step": state.global_step,
                "total_steps": state.max_steps,
                "progress_percent": round(progress_percent, 2),
                "train_loss": round(train_loss, 6) if train_loss is not None else None,
                "eval_loss": round(eval_loss, 6) if eval_loss is not None else None,
                "learning_rate": learning_rate,
                "grad_norm": round(grad_norm, 6) if grad_norm is not None else None,
                "gpu_memory_allocated_gb": round(gpu_mem_allocated, 2) if gpu_mem_allocated is not None else None,
                "gpu_memory_reserved_gb": round(gpu_mem_reserved, 2) if gpu_mem_reserved is not None else None,
                "gpu_utilization_percent": gpu_utilization_percent,
                "elapsed_seconds": int(elapsed),
                "remaining_seconds": int(remaining) if remaining is not None else None,
                "samples_per_second": round(samples_per_sec, 2),
                "updated_at": timestamp,
                "perplexity": round(perplexity, 4) if perplexity is not None else None,
                "train_perplexity": round(train_perplexity, 4) if train_perplexity is not None else None,
                "best_eval_loss": round(self.best_eval_loss, 6) if self.best_eval_loss != float('inf') else None,
                "best_epoch": self.best_epoch,
                "best_step": self.best_step,
                "epochs_without_improvement": self.epochs_without_improvement,
                "loss_trend": loss_trend,
                "total_samples": self.total_samples,
                "train_samples": self.train_samples,
                "val_samples": self.val_samples,
                "total_tokens_processed": self.total_tokens_processed,
                "metrics_history": list(self.metrics_history)
            }
            
            self.progress_file.parent.mkdir(parents=True, exist_ok=True)
            
            temp_file = self.progress_file.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, indent=2)
            
            # Windows file locking workaround: retry replace operation
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    temp_file.replace(self.progress_file)
                    break
                except PermissionError as perm_err:
                    if attempt < max_retries - 1:
                        time.sleep(0.1)
                        continue
                    else:
                        logger.warning(f"[MetricsCallback] Could not replace progress file after {max_retries} attempts: {perm_err}")
                        # Keep temp file as backup
                        logger.info(f"[MetricsCallback] Progress saved to temporary file: {temp_file}")
            
            logger.debug(
                f"[MetricsCallback] Progress updated: "
                f"Step {state.global_step}/{state.max_steps}, "
                f"Progress {progress_percent:.1f}%"
            )
            
        except Exception as e:
            logger.error(f"[MetricsCallback] Failed to write progress: {e}", exc_info=True)


class ToolTrainer:




    """
    Main trainer class for tool use models.

    Supports three training methods:
    - SFT (Supervised Fine-Tuning)
    - DPO (Direct Preference Optimization)
    - Teacher Mode (Self-supervised learning)
    """

    def __init__(
        self,
        config: Dict[str, Any],
        train_dataset: Dataset,
        eval_dataset: Dataset,
        output_dir: Path
    ):
        """
        Initialize the trainer.

        Args:
            config: Training configuration dictionary
            train_dataset: Training dataset (HuggingFace Dataset)
            eval_dataset: Evaluation dataset (HuggingFace Dataset)
            output_dir: Directory to save model checkpoints
        """
        logger.info("[Trainer] Initializing ToolTrainer")
        logger.info(f"[Trainer] Output directory: {output_dir}")
        
        # Handle both Dataset and IterableDataset (streaming doesn't support len())
        if isinstance(train_dataset, IterableDataset):
            logger.info("[Trainer] Training dataset: IterableDataset (streaming mode, size unknown)")
        else:
            logger.info(f"[Trainer] Training dataset size: {len(train_dataset)}")
            
        if isinstance(eval_dataset, IterableDataset):
            logger.info("[Trainer] Evaluation dataset: IterableDataset (streaming mode, size unknown)")
        else:
            logger.info(f"[Trainer] Evaluation dataset size: {len(eval_dataset)}")

        self.config = config
        self.train_dataset = train_dataset
        self.eval_dataset = eval_dataset
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Initialize TensorBoard logging
        self.writer = None
        if self.config.get("tensorboard", {}).get("enabled", False):
            log_dir = self.config.get("tensorboard", {}).get(
                "log_dir",
                str(self.output_dir / "runs")
            )
            logger.info(f"[Trainer] Enabling TensorBoard logging: {log_dir}")
            self.writer = SummaryWriter(log_dir=log_dir)

        # Training method
        self.training_method = config["training"]["method"]
        logger.info(f"[Trainer] Training method: {self.training_method}")

        # Initialize model and tokenizer
        logger.info("[Trainer] Loading tokenizer...")
        self.tokenizer = self._load_tokenizer()
        logger.info("[Trainer] Tokenizer loaded successfully")
        
        # Pre-tokenize datasets if enabled in config
        pretokenize_enabled = config.get("training", {}).get("pretokenize", False)
        use_streaming = config.get("training", {}).get("use_streaming", False)
        
        # Streaming and pretokenization are mutually exclusive
        if use_streaming and pretokenize_enabled:
            logger.warning(
                "[Trainer] Streaming mode enabled - pretokenization automatically disabled "
                "(streaming datasets use on-the-fly tokenization)"
            )
            pretokenize_enabled = False
        
        if pretokenize_enabled:
            # Check if datasets are IterableDataset (streaming mode)
            if isinstance(self.train_dataset, IterableDataset):
                logger.warning(
                    "[Trainer] Cannot pretokenize IterableDataset (streaming mode), "
                    "skipping pretokenization"
                )
            else:
                logger.info("[Trainer] Pre-tokenization enabled")
                model_name = config.get("model", {}).get("name", "unknown")
                formatting_func = self._get_formatting_function()
                
                logger.info("[Trainer] Pre-tokenizing training dataset...")
                self.train_dataset = _pretokenize_dataset(
                    dataset=self.train_dataset,
                    tokenizer=self.tokenizer,
                    formatting_func=formatting_func,
                    model_name=model_name,
                    config=config,
                    dataset_type="train"
                )
                
                logger.info("[Trainer] Pre-tokenizing evaluation dataset...")
                self.eval_dataset = _pretokenize_dataset(
                    dataset=self.eval_dataset,
                    tokenizer=self.tokenizer,
                    formatting_func=formatting_func,
                    model_name=model_name,
                    config=config,
                    dataset_type="eval"
                )
                
                logger.info("[Trainer] Pre-tokenization complete")
        else:
            logger.info(
                "[Trainer] Pre-tokenization disabled "
                "(set training.pretokenize=true to enable)"
            )

        logger.info("[Trainer] Loading model...")
        self.model = self._load_model()
        logger.info("[Trainer] Model loaded successfully")

        logger.info("[Trainer] Initialization complete")

    def _normalize_model_path(self, model_name: str) -> tuple[str, bool]:
        """
        Normalize model path for HuggingFace compatibility.
        
        Detects local snapshot paths and converts them to proper format:
        - Local paths with "snapshots/" -> use local_files_only=True
        - HuggingFace repo IDs -> use as-is
        
        Args:
            model_name: Model name or path from config
            
        Returns:
            tuple: (normalized_path, local_files_only)
        """
        # Check if this is a local snapshot path
        if "snapshots" in model_name and "/" in model_name:
            logger.info(f"[Model] Detected local snapshot path: {model_name}")
            
            # Convert to Path object
            model_path = Path(model_name)
            
            # Try multiple possible locations for the model
            possible_paths = [
                model_path,  # As-is (might be absolute)
                Path(__file__).parent / model_name,  # Relative to trainer script
                Path(__file__).parent.parent.parent / "AI_Models" / model_name,  # ../../../AI_Models/
                Path("C:/Users/Juan/Desktop/Dev_Ops/AI_Models") / model_name,  # Absolute AI_Models location
            ]
            
            # Try each possible path
            for try_path in possible_paths:
                if try_path.exists():
                    logger.debug(f"[Model] Found local model at: {try_path}")
                    logger.debug(f"[Model] Using local_files_only=True")
                    return str(try_path), True
            
            # If not found locally, extract HuggingFace ID from path
            logger.warning(f"[Model] Local model not found in any of these locations:")
            for try_path in possible_paths:
                logger.warning(f"[Model]   - {try_path}")
            
            # Extract the base model name from the path
            # Format: huggingface_models/Qwen-Qwen3-1.7B/snapshots/...
            # Extract: Qwen/Qwen3-1.7B
            parts = model_name.split("/")
            for i, part in enumerate(parts):
                if part.startswith("Qwen-") or part.startswith("Meta-") or part.startswith("mistral"):
                    # Found model name, convert to HF format
                    model_id = part.replace("-", "/", 1)  # Qwen-Qwen3-1.7B -> Qwen/Qwen3-1.7B
                    logger.warning(f"[Model] Falling back to HuggingFace download: {model_id}")
                    return model_id, False
            
            logger.warning(f"[Model] Could not parse model path, using as-is: {model_name}")
            return model_name, False
        
        # Regular HuggingFace model ID
        logger.info(f"[Model] Using HuggingFace model ID: {model_name}")
        return model_name, False

    def _load_tokenizer(self) -> AutoTokenizer:
        """Load and configure tokenizer."""
        model_name = self.config["model"]["name"]
        logger.info(f"[Tokenizer] Loading from: {model_name}")
        
        # Normalize model path
        normalized_path, local_files_only = self._normalize_model_path(model_name)
        logger.debug(f"[Tokenizer] Normalized path: {normalized_path}, local_files_only={local_files_only}")

        # Load base tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            normalized_path,
            trust_remote_code=self.config["model"].get("trust_remote_code", False),
            local_files_only=local_files_only,
        )

        # Add special tokens for tool calls (if not using toolbench strategy)
        if "toolbench" not in self.config["data"].get("strategy", "").lower():
            logger.info("[Tokenizer] Adding special tokens for tool calls")
            special_tokens = {
                "additional_special_tokens": [
                    "[TOOL_CALL]", "[/TOOL_CALL]",
                    "[RESULT]", "[/RESULT]"
                ]
            }
            num_added = tokenizer.add_special_tokens(special_tokens)
            logger.info(f"[Tokenizer] Added {num_added} special tokens")

        # Set pad token if not exists
        if tokenizer.pad_token is None:
            logger.info("[Tokenizer] Setting pad_token to eos_token")
            tokenizer.pad_token = tokenizer.eos_token

        logger.info(f"[Tokenizer] Vocabulary size: {len(tokenizer)}")
        return tokenizer

    def _load_model(self) -> AutoModelForCausalLM:
        """Load and prepare model with optional LoRA."""
        model_config = self.config["model"]
        model_name = model_config["name"]
        use_lora = self.config["training"].get("use_lora", True)

        logger.info(f"[Model] Loading {model_name}")
        logger.info(f"[Model] Using LoRA: {use_lora}")
        
        # Normalize model path
        normalized_path, local_files_only = self._normalize_model_path(model_name)
        logger.debug(f"[Model] Normalized path: {normalized_path}, local_files_only={local_files_only}")

        if use_lora:
            # Configure 4-bit quantization - UI configurable
            quant_config = self.config["training"].get("quantization", {})
            load_in_4bit = quant_config.get("load_in_4bit", True)

            logger.info("[Model] Configuring 4-bit quantization (QLoRA)")
            logger.info(f"[Model] Quantization config: {quant_config}")

            bnb_config = BitsAndBytesConfig(
                load_in_4bit=load_in_4bit,
                bnb_4bit_quant_type=quant_config.get("bnb_4bit_quant_type", "nf4"),
                bnb_4bit_use_double_quant=quant_config.get("bnb_4bit_use_double_quant", True),
                bnb_4bit_compute_dtype=quant_config.get("bnb_4bit_compute_dtype", "bfloat16")
            )

            # Load base model with quantization
            model = AutoModelForCausalLM.from_pretrained(
                normalized_path,
                trust_remote_code=model_config.get("trust_remote_code", False),
                torch_dtype=getattr(torch, model_config.get("torch_dtype", "float16")),
                device_map=model_config.get("device_map", "auto"),
                quantization_config=bnb_config,
                local_files_only=local_files_only,
            )

            # Prepare model for k-bit training
            logger.info("[Model] Preparing model for k-bit training")
            model = prepare_model_for_kbit_training(model)

            # Configure LoRA - UI configurable
            # Support both config.lora and config.training.lora_config paths
            lora_config_section = self.config.get("lora", self.config["training"].get("lora_config", {}))
            lora_r = lora_config_section.get("r", 16)
            lora_alpha = lora_config_section.get("lora_alpha", lora_config_section.get("alpha", 32))
            lora_dropout = lora_config_section.get("lora_dropout", lora_config_section.get("dropout", 0.1))
            target_modules = lora_config_section.get("target_modules", [
                "q_proj", "k_proj", "v_proj", "o_proj",  # Attention layers
                "gate_proj", "up_proj", "down_proj"      # MLP layers
            ])

            logger.info(f"[Model] LoRA config: r={lora_r}, alpha={lora_alpha}, dropout={lora_dropout}")
            logger.info(f"[Model] Target modules: {target_modules}")

            lora_config = LoraConfig(
                task_type=TaskType.CAUSAL_LM,
                inference_mode=False,
                r=lora_r,
                lora_alpha=lora_alpha,
                lora_dropout=lora_dropout,
                target_modules=target_modules
            )

            model = get_peft_model(model, lora_config)
            logger.info("[Model] LoRA adapters attached")
            model.print_trainable_parameters()

        else:
            # Load full model without quantization
            logger.info("[Model] Loading full model (no LoRA)")
            model = AutoModelForCausalLM.from_pretrained(
                normalized_path,
                trust_remote_code=model_config.get("trust_remote_code", False),
                torch_dtype=getattr(torch, model_config.get("torch_dtype", "float16")),
                device_map=model_config.get("device_map", "auto"),
                local_files_only=local_files_only,
            )

            # Resize embeddings for new tokens
            logger.info("[Model] Resizing token embeddings")
            model.resize_token_embeddings(len(self.tokenizer))

        return model

    def _format_chat_messages(self, example: Dict[str, Any]) -> str:
        """
        Format ChatML messages to training text.
        Handles normalized format: {"messages": [...]}

        Args:
            example: Dictionary containing 'messages' array

        Returns:
            Formatted string ready for training
        """
        if 'messages' not in example:
            logger.warning("[Formatter] No 'messages' field in example, returning empty string")
            return ""

        messages = example['messages']
        if not isinstance(messages, list):
            logger.warning("[Formatter] 'messages' field is not a list, returning empty string")
            return ""

        formatted_parts = []
        for msg in messages:
            if not isinstance(msg, dict):
                logger.warning("[Formatter] Message is not a dict, skipping")
                continue

            role = msg.get('role', 'user')
            content = msg.get('content', '')

            # Use ChatML-style formatting: <|role|>\ncontent\n
            formatted_parts.append(f"<|{role}|>\n{content}\n")

        result = "".join(formatted_parts)
        return result

    def _format_text(self, example: Dict[str, Any]) -> str:
        """
        Format standard text examples.
        Handles format: {"text": "..."}

        Args:
            example: Dictionary containing 'text' field

        Returns:
            Text content as string
        """
        if 'text' in example:
            return str(example['text'])

        logger.warning("[Formatter] No 'text' field found in example, returning empty string")
        return ""

    def _get_formatting_function(self):
        """
        Get appropriate formatting function based on dataset structure.
        Auto-detects format from first training example.

        Returns:
            Callable: The appropriate formatting function (_format_chat_messages or _format_text)
        """
        # Handle IterableDataset (streaming mode)
        if isinstance(self.train_dataset, IterableDataset):
            # For streaming, we can't check len() or access by index
            # Try to peek at first example using iterator
            try:
                first_example = next(iter(self.train_dataset))
                logger.info(f"[Formatter] Analyzing first example (streaming), keys: {list(first_example.keys())}")
                
                if 'messages' in first_example:
                    logger.info("[Formatter] Detected ChatML format (messages field), using chat formatter")
                    return self._format_chat_messages
                else:
                    logger.info("[Formatter] Detected text format, using text formatter")
                    return self._format_text
            except (StopIteration, Exception) as e:
                logger.warning(f"[Formatter] Could not peek at streaming dataset: {e}, using default text formatter")
                return self._format_text
        
        # Handle regular Dataset
        if len(self.train_dataset) == 0:
            logger.warning("[Formatter] Empty dataset, using default text formatter")
            return self._format_text

        # Check first example to determine format
        first_example = self.train_dataset[0]
        logger.info(f"[Formatter] Analyzing first example, keys: {list(first_example.keys())}")

        if 'messages' in first_example:
            logger.info("[Formatter] Detected ChatML format (messages field), using chat formatter")
            return self._format_chat_messages
        elif 'text' in first_example:
            logger.info("[Formatter] Detected text format (text field), using text formatter")
            return self._format_text
        else:
            logger.warning(f"[Formatter] Unknown format with keys: {list(first_example.keys())}")
            logger.warning("[Formatter] Falling back to text formatter")
            return self._format_text

    def train(self, resume_from_checkpoint: Optional[str] = None):
        """
        Train the model based on the specified method.

        Args:
            resume_from_checkpoint: Path to checkpoint to resume from (optional)
        """
        logger.info("=" * 80)
        logger.info(f"[Training] Starting {self.training_method.upper()} training")
        logger.info("=" * 80)

        if resume_from_checkpoint:
            logger.info(f"[Training] Resuming from checkpoint: {resume_from_checkpoint}")

        if self.training_method == "sft":
            self._train_sft(resume_from_checkpoint)
        elif self.training_method == "dpo":
            self._train_dpo(resume_from_checkpoint)
        elif self.training_method == "rlhf":
            self._train_rlhf(resume_from_checkpoint)
        elif self.training_method == "orpo":
            self._train_orpo(resume_from_checkpoint)
        elif self.training_method == "teacher_mode":
            self._train_teacher_mode(resume_from_checkpoint)
        else:
            raise ValueError(
                f"Unknown training method: {self.training_method}. "
                f"Supported methods: sft, dpo, rlhf, orpo, teacher_mode"
            )

        logger.info("=" * 80)
        logger.info("[Training] Training completed successfully!")
        logger.info("=" * 80)

    def _train_sft(self, resume_from_checkpoint: Optional[str] = None):
        """Supervised fine-tuning."""
        logger.info("[SFT] Configuring supervised fine-tuning")

        # Training arguments
        num_epochs = self.config["training"].get("num_epochs", 3)
        batch_size = self.config["training"].get("batch_size", 4)
        learning_rate = self.config["training"].get("learning_rate", 5e-5)
        
        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = self.config["training"].get("lr_scheduler_type", "cosine")
        warmup_ratio = self.config["training"].get("warmup_ratio")  # Optional, None means use warmup_steps
        save_steps = self.config["training"].get("save_steps", 500)
        save_total_limit = self.config["training"].get("save_total_limit", 3)
        evaluation_strategy = self.config["training"].get("evaluation_strategy", "steps")
        eval_steps = self.config["training"].get("eval_steps", 500)
        packing = self.config["training"].get("packing", False)
        
        # CRITICAL: When load_best_model_at_end=True, save_steps MUST be a multiple of eval_steps
        # Auto-adjust save_steps to nearest valid multiple to prevent training failures
        if evaluation_strategy == "steps" and save_steps % eval_steps != 0:
            original_save_steps = save_steps
            # Round save_steps to nearest multiple of eval_steps
            save_steps = max(eval_steps, (save_steps // eval_steps) * eval_steps)
            if save_steps == 0:
                save_steps = eval_steps
            logger.warning(
                f"[SFT] save_steps ({original_save_steps}) is not a multiple of eval_steps ({eval_steps}). "
                f"Auto-adjusted to {save_steps} to satisfy load_best_model_at_end requirement."
            )

        logger.info(
            f"[SFT] Config: epochs={num_epochs}, batch={batch_size}, lr={learning_rate}, "
            f"scheduler={lr_scheduler_type}, warmup_ratio={warmup_ratio or 'default'}, "
            f"save_steps={save_steps}, eval_steps={eval_steps}, eval_strategy={evaluation_strategy}, packing={packing}"
        )
        
        progress_file = self.output_dir / "progress.json"
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        # Set dataset info for tokens/sec calculation (Phase 3)
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[SFT] Progress tracking enabled: {progress_file}")

        # Build SFTConfig with ALL UI-configurable parameters
        training_args = SFTConfig(
            output_dir=str(self.output_dir),
            overwrite_output_dir=True,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=self.config["training"].get("eval_batch_size", 4),
            gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", 1),
            learning_rate=learning_rate,
            warmup_steps=self.config["training"].get("warmup_steps", 100),
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,

            # Logging and evaluation - UI configurable
            logging_steps=self.config["training"].get("logging_steps", 25),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,
            eval_accumulation_steps=10,  # Accumulate eval outputs to reduce memory peaks

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,

            # Precision and optimization - UI configurable
            bf16=self.config["training"].get("bf16", False),
            fp16=self.config["training"].get("fp16", False),
            optim=self.config["training"].get("optim", "adamw_torch"),
            max_grad_norm=self.config["training"].get("max_grad_norm", 1.0),
            weight_decay=self.config["training"].get("weight_decay", 0.01),

            # Memory optimization - UI configurable
            gradient_checkpointing=self.config["training"].get("gradient_checkpointing", False),
            torch_empty_cache_steps=500,  # Clear cache at eval steps to reduce fragmentation

            # Data loading - UI configurable
            dataloader_num_workers=self.config["training"].get("dataloader_num_workers", 0),
            dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", None) if self.config["training"].get("dataloader_num_workers", 0) > 0 else None,
            dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", True),
            group_by_length=self.config["training"].get("group_by_length", False),

            # SFT-specific
            packing=packing,

            # Scheduler
            lr_scheduler_type=lr_scheduler_type,

            # Reporting
            report_to="tensorboard" if self.config.get("tensorboard", {}).get("enabled") else None,
            label_names=["labels"],

            # Disable tqdm progress bars (already suppressed via environment variable, but set explicitly)
            disable_tqdm=True
        )

        max_seq_length = self.config["training"].get("max_length", 2048)
        logger.info(f"[SFT] Max sequence length: {max_seq_length}")

        # Check if dataset is already pre-tokenized
        # Handle both Dataset and IterableDataset
        if isinstance(self.train_dataset, IterableDataset):
            # IterableDataset doesn't have column_names, check by peeking at first example
            try:
                first_example = next(iter(self.train_dataset))
                is_pretokenized = "input_ids" in first_example
                dataset_columns = list(first_example.keys())
            except (StopIteration, Exception):
                logger.warning("[SFT] Could not peek at streaming dataset, assuming raw text format")
                is_pretokenized = False
                dataset_columns = []
        else:
            dataset_columns = self.train_dataset.column_names
            is_pretokenized = "input_ids" in dataset_columns
        
        if is_pretokenized:
            logger.info("[SFT] Detected pre-tokenized dataset (has 'input_ids' column)")
            logger.info(f"[SFT] Dataset columns: {dataset_columns}")
            logger.info("[SFT] Skipping formatting_func (using pre-tokenized data)")
            formatting_func = None
        else:
            logger.info("[SFT] Detected raw text dataset (no 'input_ids' column)")
            logger.info(f"[SFT] Dataset columns: {dataset_columns}")
            # Get appropriate formatting function based on dataset format
            formatting_func = self._get_formatting_function()
            logger.info(
                f"[SFT] Using formatting function: {formatting_func.__name__}"
            )

        # Diagnostic logging - calculate expected training steps
        # IterableDataset doesn't support len(), skip this for streaming
        if not isinstance(self.train_dataset, IterableDataset):
            expected_steps = (len(self.train_dataset) // batch_size) * num_epochs
            logger.info(f"[SFT] Dataset size: {len(self.train_dataset)}")
            logger.info(f"[SFT] Batch size: {batch_size}")
            logger.info(f"[SFT] Epochs: {num_epochs}")
            logger.info(f"[SFT] Expected training steps: ~{expected_steps}")
        else:
            logger.info("[SFT] Streaming mode: dataset size unknown, expected steps cannot be calculated")

        # Log first example for verification  
        if not isinstance(self.train_dataset, IterableDataset) and len(self.train_dataset) > 0:
            if is_pretokenized:
                first_example = self.train_dataset[0]
                logger.info("[SFT] First pre-tokenized example:")
                logger.info(
                    f"[SFT] input_ids length: {len(first_example['input_ids'])}"
                )
                logger.info(
                    f"[SFT] First 10 tokens: {first_example['input_ids'][:10]}"
                )
            else:
                first_formatted = formatting_func(self.train_dataset[0])
                logger.info(f"[SFT] First example formatted (first 200 chars):")
                logger.info(f"[SFT] {first_formatted[:200]}...")

        # Log final configuration (consolidated single line)
        logger.info(
            f"[SFT] Final config verified: optim={training_args.optim}, "
            f"gradient_checkpoint={training_args.gradient_checkpointing}, "
            f"workers={training_args.dataloader_num_workers}"
        )

        logger.info("[SFT] Creating SFT trainer")
        trainer = SFTTrainer(
            model=self.model,
            train_dataset=self.train_dataset,
            eval_dataset=self.eval_dataset,
            args=training_args,
            processing_class=self.tokenizer,
            formatting_func=formatting_func,
            callbacks=[metrics_callback]
        )

        logger.info("[SFT] Starting training loop")
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        logger.info("[SFT] Saving final model")
        trainer.save_model()
        self.tokenizer.save_pretrained(self.output_dir)
        logger.info(f"[SFT] Model saved to {self.output_dir}")

    def _train_dpo(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using DPO (Direct Preference Optimization)."""
        logger.info("[DPO] Configuring DPO training")

        use_lora = self.config["training"].get("use_lora", True)
        if not use_lora:
            logger.warning(
                "[DPO] WARNING: Running DPO without LoRA may cause NaN values. "
                "Consider enabling LoRA with 'use_lora': true in your config."
            )

        logger.info("[DPO] Creating preference dataset")
        preference_dataset = self._create_preference_dataset()
        logger.info(f"[DPO] Preference dataset size: {len(preference_dataset)}")

        # Setup training arguments with gradient clipping
        num_epochs = self.config["training"].get("num_epochs", 3)
        batch_size = self.config["training"].get("batch_size", 4)
        learning_rate = self.config["training"].get("learning_rate", 5e-6)
        
        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = self.config["training"].get("lr_scheduler_type", "cosine")
        warmup_ratio = self.config["training"].get("warmup_ratio")  # Optional, None means use warmup_steps
        save_steps = self.config["training"].get("save_steps", 100)
        save_total_limit = self.config["training"].get("save_total_limit", 3)
        evaluation_strategy = self.config["training"].get("evaluation_strategy", "no")  # DPO typically doesn't use eval
        eval_steps = self.config["training"].get("eval_steps", 500)
        packing = self.config["training"].get("packing", False)
        
        # CRITICAL: When load_best_model_at_end=True, save_steps MUST be a multiple of eval_steps
        # Auto-adjust save_steps to nearest valid multiple to prevent training failures
        if evaluation_strategy == "steps" and save_steps % eval_steps != 0:
            original_save_steps = save_steps
            # Round save_steps to nearest multiple of eval_steps
            save_steps = max(eval_steps, (save_steps // eval_steps) * eval_steps)
            if save_steps == 0:
                save_steps = eval_steps
            logger.warning(
                f"[DPO] save_steps ({original_save_steps}) is not a multiple of eval_steps ({eval_steps}). "
                f"Auto-adjusted to {save_steps} to satisfy load_best_model_at_end requirement."
            )

        logger.info(
            f"[DPO] Config: epochs={num_epochs}, batch={batch_size}, lr={learning_rate}, "
            f"scheduler={lr_scheduler_type}, warmup_ratio={warmup_ratio or 'default'}, "
            f"save_steps={save_steps}, eval_steps={eval_steps}, eval_strategy={evaluation_strategy}, packing={packing}"
        )
        
        progress_file = self.output_dir / "progress.json"
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        # Set dataset info for tokens/sec calculation (Phase 3)
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[DPO] Progress tracking enabled: {progress_file}")

        # Build DPOConfig with ALL UI-configurable parameters
        training_args = DPOConfig(
            output_dir=str(self.output_dir),
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=self.config["training"].get("eval_batch_size", 4),
            gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", 1),
            learning_rate=learning_rate,
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,
            warmup_steps=self.config["training"].get("warmup_steps", 100),

            # Logging and evaluation - UI configurable
            logging_steps=self.config["training"].get("logging_steps", 25),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,

            # Precision and optimization - UI configurable
            optim=self.config["training"].get("optim", "paged_adamw_8bit"),
            bf16=self.config["training"].get("bf16", False),
            fp16=self.config["training"].get("fp16", True),
            max_grad_norm=self.config["training"].get("max_grad_norm", 0.3),
            weight_decay=self.config["training"].get("weight_decay", 0.01),

            # Memory optimization - UI configurable
            gradient_checkpointing=self.config["training"].get("gradient_checkpointing", False),

            # Data loading - UI configurable
            dataloader_num_workers=self.config["training"].get("dataloader_num_workers", 0),
            dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", None) if self.config["training"].get("dataloader_num_workers", 0) > 0 else None,
            dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", True),
            group_by_length=self.config["training"].get("group_by_length", False),

            # DPO-specific
            max_length=self.config["training"].get("max_length", 512),
            remove_unused_columns=False,
            beta=self.config["training"].get("beta", 0.1),
            packing=packing,

            # Scheduler
            lr_scheduler_type=lr_scheduler_type,

            # Reporting
            report_to="tensorboard" if self.config.get("tensorboard", {}).get("enabled") else None,

            # Disable tqdm progress bars (already suppressed via environment variable, but set explicitly)
            disable_tqdm=True
        )

        # Log final configuration (consolidated single line)
        logger.info(
            f"[DPO] Final config verified: beta={training_args.beta}, "
            f"max_length={training_args.max_length}, "
            f"optim={training_args.optim}"
        )

        logger.info("[DPO] Creating DPO trainer")
        trainer = DPOTrainer(
            model=self.model,
            ref_model=None,
            args=training_args,
            train_dataset=preference_dataset,
            processing_class=self.tokenizer,
            callbacks=[metrics_callback]
        )

        # Add gradient checkpointing for memory efficiency
        if hasattr(self.model, "gradient_checkpointing_enable"):
            logger.info("[DPO] Enabling gradient checkpointing")
            self.model.gradient_checkpointing_enable()

        logger.info("[DPO] Starting training loop")
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        logger.info("[DPO] Saving final model")
        dpo_output_dir = self.output_dir / "dpo_model"
        trainer.save_model(dpo_output_dir)
        logger.info(f"[DPO] Model saved to {dpo_output_dir}")

    def _train_rlhf(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using RLHF (Reinforcement Learning from Human Feedback) with PPO."""
        logger.info("[RLHF] Configuring RLHF training with PPO")

        # Extract training configuration
        training_config = self.config["training"]
        num_epochs = training_config.get("num_epochs", 3)
        batch_size = training_config.get("batch_size", 4)
        learning_rate = training_config.get("learning_rate", 1e-5)  # Lower LR for PPO stability
        gradient_accumulation_steps = training_config.get("gradient_accumulation_steps", 4)
        max_length = training_config.get("max_length", 512)

        logger.info(
            f"[RLHF] Config: epochs={num_epochs}, batch={batch_size}, lr={learning_rate}, "
            f"max_length={max_length}"
        )

        # Setup progress tracking
        progress_file = self.output_dir / "progress.json"
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[RLHF] Progress tracking enabled: {progress_file}")

        # Load reward model (same architecture as policy model, but used for scoring)
        logger.info(f"[RLHF] Loading reward model: {self.config['model']['name']}")

        # Use existing model as reward model for MVP (can be replaced with separate model later)
        # In production, you'd load a separately trained reward model here
        reward_model = AutoModelForSequenceClassification.from_pretrained(
            self.config["model"]["name"],
            num_labels=1,
            torch_dtype=torch.float16 if training_config.get("fp16", False) else torch.bfloat16 if training_config.get("bf16", False) else torch.float32,
            device_map="auto"
        )
        reward_model.eval()  # Freeze reward model during PPO training
        logger.info("[RLHF] Reward model loaded and frozen")

        # Wrap model with value head (required for PPO)
        logger.info("[RLHF] Wrapping model with value head for PPO")
        model_with_value_head = AutoModelForCausalLMWithValueHead.from_pretrained(self.model)

        # Configure PPO parameters
        ppo_config = PPOConfig(
            model_name=self.config["model"]["name"],
            learning_rate=learning_rate,
            batch_size=batch_size,
            mini_batch_size=max(1, batch_size // 2),  # PPO mini-batch size
            gradient_accumulation_steps=gradient_accumulation_steps,
            ppo_epochs=training_config.get("ppo_epochs", 4),  # PPO optimization steps
            clip_range=training_config.get("clip_range", 0.2),  # PPO clipping parameter
            clip_range_value=training_config.get("clip_range_value", 0.2),  # Value function clipping
            vf_coef=training_config.get("vf_coef", 0.1),  # Value function coefficient
            optimize_cuda_cache=True,
            log_with="tensorboard" if self.config.get("tensorboard", {}).get("enabled") else None,
        )

        logger.info(
            f"[RLHF] PPO config: ppo_epochs={ppo_config.ppo_epochs}, "
            f"clip_range={ppo_config.clip_range}, mini_batch_size={ppo_config.mini_batch_size}"
        )

        # Prepare RLHF dataset
        # Expected format: {"prompt": str, "response": str, "reward": float (optional)}
        logger.info("[RLHF] Preparing RLHF dataset for PPO training")
        rlhf_examples = []

        # Convert HuggingFace Dataset to list of examples
        for example in self.train_dataset:
            # Handle different dataset formats
            if "prompt" in example and "response" in example:
                rlhf_examples.append({
                    "query": example["prompt"],
                    "response": example.get("response", ""),
                    "reward": example.get("reward", 0.0)
                })
            elif "text" in example:
                # Fallback for text-based datasets
                rlhf_examples.append({
                    "query": example["text"][:max_length // 2],  # First half as query
                    "response": "",  # Will be generated
                    "reward": 0.0
                })

        logger.info(f"[RLHF] Prepared {len(rlhf_examples)} examples for training")

        # Create dataset for PPO
        rlhf_dataset = Dataset.from_list(rlhf_examples)

        # Tokenize queries
        def tokenize_query(example):
            return self.tokenizer(
                example["query"],
                truncation=True,
                max_length=max_length // 2,  # Reserve space for response
                padding=False
            )

        rlhf_dataset = rlhf_dataset.map(tokenize_query, batched=False)

        # Initialize PPO Trainer
        logger.info("[RLHF] Creating PPO trainer")
        ppo_trainer = PPOTrainer(
            config=ppo_config,
            model=model_with_value_head,
            tokenizer=self.tokenizer,
            dataset=rlhf_dataset,
        )

        # Generation parameters for responses
        generation_kwargs = {
            "max_new_tokens": max_length // 2,
            "do_sample": True,
            "top_k": 50,
            "top_p": 0.95,
            "temperature": 1.0,
            "pad_token_id": self.tokenizer.pad_token_id,
        }

        # Training loop
        logger.info(f"[RLHF] Starting PPO training loop for {num_epochs} epoch(s)")

        for epoch in range(num_epochs):
            logger.info(f"[RLHF] Epoch {epoch + 1}/{num_epochs}")
            epoch_rewards = []

            for step, batch in enumerate(ppo_trainer.dataloader):
                query_tensors = batch["input_ids"]

                # Generate responses using policy model
                response_tensors = ppo_trainer.generate(
                    query_tensors,
                    return_prompt=False,
                    **generation_kwargs
                )

                # Compute rewards using reward model
                rewards = []
                for query, response in zip(query_tensors, response_tensors):
                    # Concatenate query and response
                    full_text = torch.cat([query, response])

                    # Get reward score from reward model
                    with torch.no_grad():
                        reward_inputs = full_text.unsqueeze(0).to(reward_model.device)
                        # Pad/truncate to max_length
                        if reward_inputs.shape[1] > max_length:
                            reward_inputs = reward_inputs[:, :max_length]

                        reward_output = reward_model(reward_inputs)
                        reward_score = reward_output.logits[0, 0].item()
                        rewards.append(torch.tensor(reward_score))

                # Convert rewards to tensor
                rewards = [r.to(query_tensors[0].device) for r in rewards]
                epoch_rewards.extend([r.item() for r in rewards])

                # PPO update step
                stats = ppo_trainer.step(query_tensors, response_tensors, rewards)

                # Log progress
                if step % 10 == 0:
                    mean_reward = sum([r.item() for r in rewards]) / len(rewards)
                    logger.info(
                        f"[RLHF] Epoch {epoch + 1}, Step {step}, "
                        f"Mean Reward: {mean_reward:.4f}"
                    )

            # Epoch summary
            mean_epoch_reward = sum(epoch_rewards) / len(epoch_rewards) if epoch_rewards else 0.0
            logger.info(
                f"[RLHF] Epoch {epoch + 1} complete. "
                f"Mean Reward: {mean_epoch_reward:.4f}"
            )

        # Save trained model
        logger.info("[RLHF] Saving final model")
        rlhf_output_dir = self.output_dir / "rlhf_model"
        ppo_trainer.save_pretrained(str(rlhf_output_dir))
        self.tokenizer.save_pretrained(str(rlhf_output_dir))
        logger.info(f"[RLHF] Model saved to {rlhf_output_dir}")

    def _train_orpo(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using ORPO (Odds Ratio Preference Optimization)."""
        logger.info("[ORPO] Configuring ORPO training")
        logger.info("[ORPO] ORPO combines SFT + preference alignment in one step (no reference model needed)")

        # Extract training configuration
        training_config = self.config["training"]
        use_lora = training_config.get("use_lora", True)
        num_epochs = training_config.get("num_epochs", 3)
        batch_size = training_config.get("batch_size", 4)
        learning_rate = training_config.get("learning_rate", 8e-6)  # Slightly lower than DPO
        gradient_accumulation_steps = training_config.get("gradient_accumulation_steps", 4)
        max_length = training_config.get("max_length", 1024)
        max_prompt_length = training_config.get("max_prompt_length", 512)

        # ORPO-specific parameters
        beta = training_config.get("beta", 0.1)  # Controls relative ratio loss weight
        disable_dropout = training_config.get("disable_dropout", True)

        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = training_config.get("lr_scheduler_type", "cosine")
        warmup_ratio = training_config.get("warmup_ratio")
        save_steps = training_config.get("save_steps", 100)
        save_total_limit = training_config.get("save_total_limit", 3)
        evaluation_strategy = training_config.get("evaluation_strategy", "no")
        eval_steps = training_config.get("eval_steps", 500)

        # CRITICAL: When load_best_model_at_end=True, save_steps MUST be a multiple of eval_steps
        if evaluation_strategy == "steps" and save_steps % eval_steps != 0:
            original_save_steps = save_steps
            save_steps = max(eval_steps, (save_steps // eval_steps) * eval_steps)
            if save_steps == 0:
                save_steps = eval_steps
            logger.warning(
                f"[ORPO] save_steps ({original_save_steps}) is not a multiple of eval_steps ({eval_steps}). "
                f"Auto-adjusted to {save_steps} to satisfy load_best_model_at_end requirement."
            )

        logger.info(
            f"[ORPO] Config: epochs={num_epochs}, batch={batch_size}, lr={learning_rate}, "
            f"beta={beta}, max_length={max_length}, max_prompt_length={max_prompt_length}"
        )

        # Setup progress tracking
        progress_file = self.output_dir / "progress.json"
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[ORPO] Progress tracking enabled: {progress_file}")

        # Prepare ORPO dataset (same format as DPO: prompt, chosen, rejected)
        logger.info("[ORPO] Creating preference dataset")
        preference_dataset = self._create_preference_dataset()
        logger.info(f"[ORPO] Preference dataset size: {len(preference_dataset)}")

        # Build ORPOConfig
        training_args = ORPOConfig(
            output_dir=str(self.output_dir),
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=training_config.get("eval_batch_size", 4),
            gradient_accumulation_steps=gradient_accumulation_steps,
            learning_rate=learning_rate,
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,
            warmup_steps=training_config.get("warmup_steps", 100),

            # Logging and evaluation
            logging_steps=training_config.get("logging_steps", 25),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True,
            metric_for_best_model="eval_loss",
            greater_is_better=False,

            # Precision and optimization
            optim=training_config.get("optim", "paged_adamw_8bit"),
            bf16=training_config.get("bf16", False),
            fp16=training_config.get("fp16", True),
            max_grad_norm=training_config.get("max_grad_norm", 1.0),
            weight_decay=training_config.get("weight_decay", 0.01),

            # Memory optimization
            gradient_checkpointing=training_config.get("gradient_checkpointing", False),

            # Data loading
            dataloader_num_workers=training_config.get("dataloader_num_workers", 0),
            dataloader_prefetch_factor=training_config.get("dataloader_prefetch_factor", None) if training_config.get("dataloader_num_workers", 0) > 0 else None,
            dataloader_pin_memory=training_config.get("dataloader_pin_memory", True),
            group_by_length=training_config.get("group_by_length", False),

            # ORPO-specific parameters
            max_length=max_length,
            max_prompt_length=max_prompt_length,
            beta=beta,
            disable_dropout=disable_dropout,
            remove_unused_columns=False,

            # Scheduler
            lr_scheduler_type=lr_scheduler_type,

            # Reporting
            report_to="tensorboard" if self.config.get("tensorboard", {}).get("enabled") else None,

            # Disable tqdm progress bars
            disable_tqdm=True
        )

        logger.info(
            f"[ORPO] Final config verified: beta={training_args.beta}, "
            f"max_length={training_args.max_length}, "
            f"disable_dropout={training_args.disable_dropout}"
        )

        logger.info("[ORPO] Creating ORPO trainer")
        trainer = ORPOTrainer(
            model=self.model,
            args=training_args,
            train_dataset=preference_dataset,
            processing_class=self.tokenizer,
            callbacks=[metrics_callback]
        )

        # Add gradient checkpointing for memory efficiency
        if hasattr(self.model, "gradient_checkpointing_enable"):
            logger.info("[ORPO] Enabling gradient checkpointing")
            self.model.gradient_checkpointing_enable()

        logger.info("[ORPO] Starting training loop")
        logger.info("[ORPO] Note: ORPO combines SFT + preference alignment, more efficient than DPO")
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        logger.info("[ORPO] Saving final model")
        orpo_output_dir = self.output_dir / "orpo_model"
        trainer.save_model(orpo_output_dir)
        logger.info(f"[ORPO] Model saved to {orpo_output_dir}")

    def _train_teacher_mode(self, resume_from_checkpoint: Optional[str] = None):
        """Teacher mode training (Toolformer-style)."""
        logger.info("[TeacherMode] Starting teacher mode training")
        logger.info("[TeacherMode] Using SFT with self-supervised data")

        # This combines SFT with self-supervised learning
        # The data generation already handles teacher mode data creation
        self._train_sft(resume_from_checkpoint)

    def _create_preference_dataset(self) -> Dataset:
        """
        Create preference dataset for DPO/ORPO.

        Supports two modes:
        1. Real DPO format: Uses datasets with prompt/chosen/rejected fields directly
        2. Synthetic generation: Creates preference pairs from text data (legacy)
        """
        logger.info("[DPO] Creating preference dataset")

        preference_data = []

        # Handle both Dataset and IterableDataset
        if isinstance(self.train_dataset, IterableDataset):
            logger.warning("[DPO] Streaming datasets not supported for DPO preference creation")
            logger.warning("[DPO] DPO requires random access to dataset, cannot use streaming mode")
            raise ValueError(
                "DPO training does not support streaming datasets. "
                "Please disable use_streaming for DPO training method."
            )

        if len(self.train_dataset) == 0:
            raise ValueError("[DPO] Dataset is empty, cannot create preference pairs")

        # Detect dataset format from first example
        first_example = self.train_dataset[0]
        dataset_keys = set(first_example.keys())

        # Real DPO format: prompt, chosen, rejected
        has_dpo_format = {'prompt', 'chosen', 'rejected'}.issubset(dataset_keys)
        # Text format for synthetic generation
        has_text_format = 'text' in dataset_keys

        if has_dpo_format:
            logger.info("[DPO] Detected REAL DPO format (prompt/chosen/rejected fields)")
            logger.info("[DPO] Using preference pairs directly from dataset")

            num_samples = min(len(self.train_dataset), len(self.train_dataset))  # Use all samples

            for i, example in enumerate(self.train_dataset.select(range(num_samples))):
                if i % 100 == 0:
                    logger.info(f"[DPO] Processing preference pair {i}/{num_samples}")

                try:
                    preference_data.append({
                        "prompt": str(example["prompt"]),
                        "chosen": str(example["chosen"]),
                        "rejected": str(example["rejected"])
                    })
                except KeyError as e:
                    logger.warning(f"[DPO] Skipping example {i}: missing field {e}")
                    continue

            logger.info(f"[DPO] Loaded {len(preference_data)} real preference pairs")

        elif has_text_format:
            logger.info("[DPO] Detected TEXT format - using SYNTHETIC preference generation")
            logger.warning("[DPO] This is legacy behavior. Consider using real DPO format datasets.")

            num_samples = min(100, len(self.train_dataset))

            for i, example in enumerate(self.train_dataset.select(range(num_samples))):
                if i % 10 == 0:
                    logger.info(f"[DPO] Generating synthetic pair {i}/{num_samples}")

                try:
                    # Create a "good" and "bad" version (legacy synthetic generation)
                    good_response = example["text"]

                    # Create a bad version by removing tool formatting
                    bad_response = good_response.replace("[TOOL_CALL]", "").replace("[/TOOL_CALL]", "")

                    # Extract prompt (everything before "Assistant:")
                    prompt = example["text"].split("Assistant:")[0] if "Assistant:" in example["text"] else ""

                    preference_data.append({
                        "prompt": prompt,
                        "chosen": good_response,
                        "rejected": bad_response
                    })
                except KeyError as e:
                    logger.warning(f"[DPO] Skipping example {i}: missing text field")
                    continue

            logger.info(f"[DPO] Generated {len(preference_data)} synthetic preference pairs")

        else:
            logger.error(f"[DPO] Unrecognized dataset format. Found fields: {list(dataset_keys)}")
            logger.error("[DPO] Expected either:")
            logger.error("[DPO]   - Real DPO format: 'prompt', 'chosen', 'rejected'")
            logger.error("[DPO]   - Text format: 'text' (for synthetic generation)")
            raise ValueError(
                f"Dataset format not compatible with DPO/ORPO training. "
                f"Found fields: {list(dataset_keys)}. "
                f"Expected: ['prompt', 'chosen', 'rejected'] for DPO format, "
                f"or ['text'] for synthetic generation."
            )

        if len(preference_data) == 0:
            raise ValueError("[DPO] No valid preference pairs created. Check dataset format.")

        logger.info(f"[DPO] Successfully created {len(preference_data)} preference pairs")
        return Dataset.from_list(preference_data)

    def cleanup(self):
        """Clean up resources."""
        if self.writer is not None:
            self.writer.close()
            logger.info("[Trainer] TensorBoard writer closed")


def parse_args():
    """
    Parse command-line arguments for standalone training execution.
    
    Returns:
        dict: Parsed configuration with execution_id and training parameters
    """
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description='FineTune Lab Standalone Trainer')
    parser.add_argument(
        '--config',
        type=str,
        required=True,
        help='Path to JSON configuration file'
    )
    parser.add_argument(
        '--execution-id',
        type=str,
        required=True,
        help='Unique execution ID for tracking'
    )
    
    args = parser.parse_args()
    
    # Load configuration from JSON file
    logger.info(f"[CLI] Loading config from: {args.config}")
    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
        logger.info(f"[CLI] Config loaded successfully")
    except Exception as e:
        logger.error(f"[CLI] Failed to load config: {str(e)}")
        sys.exit(1)
    
    # Add execution_id to config
    config['execution_id'] = args.execution_id
    
    return config


def load_datasets(config: Dict[str, Any]) -> tuple[Dataset, Dataset]:
    """
    Load training and evaluation datasets from config.
    
    Args:
        config: Training configuration with dataset_path
        
    Returns:
        tuple: (train_dataset, eval_dataset) as HuggingFace Dataset objects
    """
    import json
    
    dataset_path = config.get('dataset_path', 'sample_data.json')
    logger.info(f"[DataLoader] Loading dataset from: {dataset_path}")
    
    # Load JSON or JSONL data
    try:
        data = []
        with open(dataset_path, 'r', encoding='utf-8') as f:
            if dataset_path.endswith('.jsonl'):
                logger.info("[DataLoader] Detected JSONL format")
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line:
                        try:
                            data.append(json.loads(line))
                        except json.JSONDecodeError as je:
                            logger.error(f"[DataLoader] Invalid JSON at line {line_num}: {je}")
                            raise
            else:
                logger.info("[DataLoader] Detected JSON format")
                data = json.load(f)
        logger.info(f"[DataLoader] Loaded {len(data)} examples")
    except Exception as e:
        logger.error(f"[DataLoader] Failed to load dataset: {e}")
        raise
    
    # Convert to HuggingFace Dataset
    dataset = Dataset.from_list(data)
    logger.info(f"[DataLoader] Created Dataset with {len(dataset)} examples")
    
    # Apply max_samples filter if specified in data config
    # max_samples = 0, None, or undefined all mean "use full dataset"
    max_samples = config.get('data', {}).get('max_samples')
    if max_samples is not None and max_samples > 0:
        original_size = len(dataset)
        if max_samples < original_size:
            dataset = dataset.select(range(max_samples))
            logger.info(f"[DataLoader] Applied max_samples filter: {original_size} -> {len(dataset)} examples")
        else:
            logger.info(f"[DataLoader] max_samples ({max_samples}) >= dataset size ({original_size}), using full dataset")
    else:
        logger.info(f"[DataLoader] max_samples not set or = 0, using full dataset ({len(dataset)} examples)")
    
    # Split into train and eval (80/20 split)
    split_ratio = config.get('eval_split', 0.2)
    split_point = int(len(dataset) * (1 - split_ratio))
    
    train_dataset = dataset.select(range(split_point))
    eval_dataset = dataset.select(range(split_point, len(dataset)))
    
    logger.info(f"[DataLoader] Train dataset: {len(train_dataset)} examples")
    logger.info(f"[DataLoader] Eval dataset: {len(eval_dataset)} examples")
    
    # Enable streaming to GPU if configured
    use_streaming = config.get('training', {}).get('use_streaming', False)
    if use_streaming:
        logger.info("[DataLoader] Converting datasets to streaming mode (IterableDataset)")
        logger.warning("[DataLoader] Streaming mode enabled - pretokenization will be automatically disabled")
        
        # Convert to IterableDataset for memory-efficient streaming
        train_dataset = train_dataset.to_iterable_dataset(num_shards=1)
        eval_dataset = eval_dataset.to_iterable_dataset(num_shards=1)
        
        logger.info("[DataLoader] Datasets converted to streaming IterableDataset")
        logger.info("[DataLoader] Memory-efficient batch loading enabled")
    else:
        logger.info("[DataLoader] Standard loading mode (set training.use_streaming=true for streaming)")
    
    return train_dataset, eval_dataset


def _pretokenize_dataset(
    dataset: Dataset,
    tokenizer,
    formatting_func,
    model_name: str,
    config: Dict[str, Any],
    dataset_type: str = "train"
) -> Dataset:
    """
    Pre-tokenize dataset and cache results for faster training.
    
    This function tokenizes the entire dataset once before training starts,
    eliminating the need for on-the-fly tokenization during training.
    Results are cached to disk for reuse across training runs.
    
    Args:
        dataset: Raw HuggingFace Dataset with text data
        tokenizer: Tokenizer instance for the model
        formatting_func: Function to format examples to text
        model_name: Model identifier for cache directory naming
        config: Training configuration dictionary
        dataset_type: Type of dataset ('train' or 'eval')
        
    Returns:
        Dataset: Pre-tokenized dataset with input_ids and attention_mask columns
    """
    import hashlib
    
    logger.info(f"[PreTokenize] Starting pre-tokenization for {dataset_type} dataset")
    logger.info(f"[PreTokenize] Dataset size: {len(dataset)} examples")
    
    # Create cache directory based on model and config
    cache_base = Path("tokenized_cache")
    model_slug = model_name.replace("/", "_").replace("\\", "_")
    
    # Create hash of relevant config parameters
    config_params = {
        "model": model_name,
        "max_length": config.get("training", {}).get("max_length", 1024),
        "dataset_path": config.get("dataset_path", ""),
    }
    config_hash = hashlib.md5(
        json.dumps(config_params, sort_keys=True).encode()
    ).hexdigest()[:8]
    
    cache_dir = cache_base / f"{model_slug}_{config_hash}" / dataset_type
    logger.info(f"[PreTokenize] Cache directory: {cache_dir}")
    
    # Check if cache exists and is valid
    if cache_dir.exists():
        try:
            logger.info("[PreTokenize] Cache found, loading pre-tokenized dataset...")
            cached_dataset = Dataset.load_from_disk(str(cache_dir))
            
            if len(cached_dataset) == len(dataset):
                logger.info(
                    f"[PreTokenize] Cache hit! Loaded {len(cached_dataset)} "
                    f"pre-tokenized examples"
                )
                logger.info(
                    f"[PreTokenize] Columns: {cached_dataset.column_names}"
                )
                return cached_dataset
            else:
                logger.warning(
                    f"[PreTokenize] Cache size mismatch "
                    f"(cached: {len(cached_dataset)}, "
                    f"current: {len(dataset)}), regenerating..."
                )
        except Exception as e:
            logger.warning(
                f"[PreTokenize] Cache load failed: {e}, regenerating..."
            )
    else:
        logger.info("[PreTokenize] No cache found, tokenizing dataset...")
    
    # Tokenize the dataset
    max_length = config.get("training", {}).get("max_length", 1024)
    logger.info(f"[PreTokenize] Max length: {max_length}")
    
    def tokenize_example(example):
        """Tokenize a single example using formatting_func and tokenizer."""
        try:
            # Format the example to text
            if "messages" in example:
                messages = example["messages"]
                result = tokenizer.apply_chat_template(
                    messages,
                    tokenize=True,
                    add_generation_prompt=False,
                    return_dict=True,
                    max_length=max_length,
                    truncation=True
                )
            else:
                # Fallback to formatting_func for text-based data
                text = formatting_func(example)
                result = tokenizer(
                    text,
                    max_length=max_length,
                    truncation=True,
                    padding=False,
                    return_tensors=None
                )
            
            return result
            
        except Exception as e:
            logger.error(f"[PreTokenize] Error tokenizing example: {e}")
            return {"input_ids": [], "attention_mask": []}
    
    # Apply tokenization to entire dataset
    logger.info("[PreTokenize] Applying tokenization...")
    try:
        tokenized_dataset = dataset.map(
            tokenize_example,
            batched=False,
            desc=f"Tokenizing {dataset_type} dataset",
            remove_columns=dataset.column_names
        )
        
        logger.info(
            f"[PreTokenize] Tokenization complete! "
            f"{len(tokenized_dataset)} examples processed"
        )
        logger.info(
            f"[PreTokenize] Output columns: {tokenized_dataset.column_names}"
        )
        
    except Exception as e:
        logger.error(f"[PreTokenize] Tokenization failed: {e}")
        raise
    
    # Save to cache
    try:
        cache_dir.parent.mkdir(parents=True, exist_ok=True)
        tokenized_dataset.save_to_disk(str(cache_dir))
        logger.info(f"[PreTokenize] Cache saved to: {cache_dir}")
    except Exception as e:
        logger.warning(f"[PreTokenize] Failed to save cache: {e}")
    
    return tokenized_dataset


def main():
    """
    Main CLI entry point for standalone training.
    Executes training based on configuration and handles errors.
    """
    logger.info("=" * 60)
    logger.info("FineTune Lab Standalone Trainer - Starting")
    logger.info("=" * 60)
    
    # Parse arguments and load config
    config = parse_args()
    execution_id = config.get('execution_id', 'unknown')
    
    logger.info(f"[Main] Execution ID: {execution_id}")
    logger.info(f"[Main] Training method: {config.get('training', {}).get('method', 'unknown')}")
    logger.info(f"[Main] Model: {config.get('model', {}).get('name', 'unknown')}")
    
    try:
        # Load datasets
        logger.info("[Main] Loading datasets...")
        train_dataset, eval_dataset = load_datasets(config)
        logger.info("[Main] Datasets loaded successfully")
        
        # Create output directory
        output_dir = Path(config.get('output_dir', './output'))
        output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"[Main] Output directory: {output_dir}")
        
        # Initialize trainer with config, datasets, and output_dir
        logger.info("[Main] Initializing ToolTrainer...")
        trainer = ToolTrainer(
            config=config,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            output_dir=output_dir
        )
        
        # Execute training based on method
        method = config.get('training', {}).get('method', 'sft').lower()
        logger.info(f"[Main] Starting {method.upper()} training...")
        
        # Use the unified train() method
        trainer.train()
        logger.info(f"[Main] {method.upper()} training completed successfully")
        
        # Cleanup resources
        trainer.cleanup()
        
        logger.info("=" * 60)
        logger.info("Training completed successfully!")
        logger.info("=" * 60)
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"[Main] Training failed with error: {str(e)}")
        logger.exception("Full traceback:")
        sys.stderr.write(f"ERROR: Training failed: {str(e)}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()

