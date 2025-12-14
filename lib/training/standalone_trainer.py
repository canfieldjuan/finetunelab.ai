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

# Add project root to Python path for imports
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import torch

# Initialize logger EARLY before any imports that might use it
# Check for local rank to suppress logs from worker processes (fixes duplicate logs in multi-process training)
local_rank = int(os.environ.get("LOCAL_RANK", "0"))
log_level = logging.INFO if local_rank == 0 else logging.WARNING

logging.basicConfig(
    level=log_level,
    format='[%(asctime)s] [%(name)s] [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Suppress tqdm progress bars in logs (they create 100+ lines of noise)
# os.environ['TQDM_DISABLE'] = '1'  # Commented out to debug hanging issues

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
    AutoConfig,
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
from huggingface_hub import HfApi

# --- Patch for TRL 0.25.1 PolicyAndValueWrapper bug ---
# PolicyAndValueWrapper is missing gradient_checkpointing methods required by unwrap_model_for_generation
try:
    from trl.trainer.ppo_trainer import PolicyAndValueWrapper
    
    if not hasattr(PolicyAndValueWrapper, "gradient_checkpointing_disable"):
        def gradient_checkpointing_disable(self):
            if hasattr(self.policy, "gradient_checkpointing_disable"):
                self.policy.gradient_checkpointing_disable()
        
        PolicyAndValueWrapper.gradient_checkpointing_disable = gradient_checkpointing_disable
        logger.info("[Patch] Added gradient_checkpointing_disable to PolicyAndValueWrapper")

    if not hasattr(PolicyAndValueWrapper, "gradient_checkpointing_enable"):
        def gradient_checkpointing_enable(self, gradient_checkpointing_kwargs=None):
            if hasattr(self.policy, "gradient_checkpointing_enable"):
                self.policy.gradient_checkpointing_enable(gradient_checkpointing_kwargs=gradient_checkpointing_kwargs)
        
        PolicyAndValueWrapper.gradient_checkpointing_enable = gradient_checkpointing_enable
        logger.info("[Patch] Added gradient_checkpointing_enable to PolicyAndValueWrapper")

    # Also patch generate if missing, as PPOTrainer might call it on the wrapper
    if not hasattr(PolicyAndValueWrapper, "generate"):
        def generate(self, *args, **kwargs):
            return self.policy.generate(*args, **kwargs)
        PolicyAndValueWrapper.generate = generate
        logger.info("[Patch] Added generate to PolicyAndValueWrapper")

    # Forward config access with setter
    if not hasattr(PolicyAndValueWrapper, "config"):
        # Store the value in a private attribute
        def _get_config(self):
            return getattr(self, '_config', None) or self.policy.config

        def _set_config(self, value):
            self._config = value

        PolicyAndValueWrapper.config = property(_get_config, _set_config)
        logger.info("[Patch] Added config property to PolicyAndValueWrapper")

    # Ensure is_gradient_checkpointing behaves like transformers models
    existing_attr = getattr(PolicyAndValueWrapper, "is_gradient_checkpointing", None)
    needs_patch = not isinstance(existing_attr, property) or existing_attr.fset is None

    if needs_patch:
        def _get_is_gradient_checkpointing(self):
            if hasattr(self.policy, "is_gradient_checkpointing"):
                try:
                    return self.policy.is_gradient_checkpointing
                except Exception:
                    pass
            return getattr(self, "_is_gradient_checkpointing", False)

        def _set_is_gradient_checkpointing(self, value):
            self._is_gradient_checkpointing = value
            if hasattr(self.policy, "is_gradient_checkpointing"):
                try:
                    self.policy.is_gradient_checkpointing = value
                except Exception:
                    # Some models expose read-only property; ignore
                    pass

        PolicyAndValueWrapper.is_gradient_checkpointing = property(
            _get_is_gradient_checkpointing,
            _set_is_gradient_checkpointing
        )
        logger.info("[Patch] Added writable is_gradient_checkpointing property to PolicyAndValueWrapper")

except ImportError:
    logger.warning("[Patch] Could not import PolicyAndValueWrapper for patching (this is expected if TRL version changed)")
except Exception as e:
    logger.warning(f"[Patch] Failed to patch PolicyAndValueWrapper: {e}")
# ------------------------------------------------------

try:
    # Try local package import first (when running as downloaded package)
    from predictions_callback import TrainingPredictionsCallback
    PREDICTIONS_AVAILABLE = True
    logger.info('[Imports] TrainingPredictionsCallback imported (local package)')
except ImportError:
    try:
        # Fall back to full path import (when running from web-ui project)
        from lib.training.predictions_callback import TrainingPredictionsCallback
        PREDICTIONS_AVAILABLE = True
        logger.info('[Imports] TrainingPredictionsCallback imported (project structure)')
    except ImportError:
        PREDICTIONS_AVAILABLE = False
        logger.warning('[Imports] TrainingPredictionsCallback not available')

# HTTP timeout for API requests (configurable via environment)
HTTP_REQUEST_TIMEOUT = int(os.getenv("HTTP_REQUEST_TIMEOUT", "10"))

# File operation retry count (for Windows file locking issues)
FILE_OPERATION_MAX_RETRIES = int(os.getenv("FILE_OPERATION_MAX_RETRIES", "3"))

# Console log throttling interval in seconds
CONSOLE_LOG_INTERVAL = int(os.getenv("CONSOLE_LOG_INTERVAL", "5"))  # Reduced to 5s for debugging

# Runtime parameter update check interval in seconds
PARAM_UPDATE_CHECK_INTERVAL = int(os.getenv("PARAM_UPDATE_CHECK_INTERVAL", "10"))

# Training hyperparameter defaults
DEFAULT_EVAL_SPLIT = float(os.getenv("DEFAULT_EVAL_SPLIT", "0.2"))
DEFAULT_LORA_R = int(os.getenv("DEFAULT_LORA_R", "16"))
DEFAULT_LORA_ALPHA = int(os.getenv("DEFAULT_LORA_ALPHA", "32"))
DEFAULT_LORA_DROPOUT = float(os.getenv("DEFAULT_LORA_DROPOUT", "0.1"))
DEFAULT_MAX_GRAD_NORM_SFT = float(os.getenv("DEFAULT_MAX_GRAD_NORM_SFT", "1.0"))
DEFAULT_MAX_GRAD_NORM_DPO = float(os.getenv("DEFAULT_MAX_GRAD_NORM_DPO", "0.3"))
DEFAULT_MAX_LENGTH_SFT = int(os.getenv("DEFAULT_MAX_LENGTH_SFT", "2048"))
DEFAULT_MAX_LENGTH_DPO = int(os.getenv("DEFAULT_MAX_LENGTH_DPO", "512"))
DEFAULT_MAX_LENGTH_PPO = int(os.getenv("DEFAULT_MAX_LENGTH_PPO", "1024"))
DEFAULT_MAX_PROMPT_LENGTH = int(os.getenv("DEFAULT_MAX_PROMPT_LENGTH", "512"))
LOSS_IMPROVEMENT_THRESHOLD = float(os.getenv("LOSS_IMPROVEMENT_THRESHOLD", "0.01"))
TOKEN_SAMPLE_SIZE = int(os.getenv("TOKEN_SAMPLE_SIZE", "1000"))
DEFAULT_AVG_TOKENS_PER_SAMPLE = int(os.getenv("DEFAULT_AVG_TOKENS_PER_SAMPLE", "206"))
FILE_RETRY_SLEEP = float(os.getenv("FILE_RETRY_SLEEP", "0.1"))

# Training configuration defaults
DEFAULT_NUM_EPOCHS = int(os.getenv("DEFAULT_NUM_EPOCHS", "3"))
DEFAULT_BATCH_SIZE = int(os.getenv("DEFAULT_BATCH_SIZE", "4"))
DEFAULT_EVAL_BATCH_SIZE = int(os.getenv("DEFAULT_EVAL_BATCH_SIZE", "4"))
DEFAULT_GRADIENT_ACCUMULATION_STEPS = int(os.getenv("DEFAULT_GRADIENT_ACCUMULATION_STEPS", "1"))
DEFAULT_SAVE_STEPS = int(os.getenv("DEFAULT_SAVE_STEPS", "500"))
DEFAULT_SAVE_STEPS_DPO = int(os.getenv("DEFAULT_SAVE_STEPS_DPO", "100"))
DEFAULT_EVAL_STEPS = int(os.getenv("DEFAULT_EVAL_STEPS", "50"))  # Evaluate every 50 steps to track train/eval divergence
DEFAULT_SAVE_TOTAL_LIMIT = int(os.getenv("DEFAULT_SAVE_TOTAL_LIMIT", "3"))
DEFAULT_WARMUP_STEPS = int(os.getenv("DEFAULT_WARMUP_STEPS", "100"))
DEFAULT_LOGGING_STEPS = int(os.getenv("DEFAULT_LOGGING_STEPS", "10"))  # Log train loss every 10 steps for granular tracking

# Optimizer defaults
DEFAULT_LEARNING_RATE_SFT = float(os.getenv("DEFAULT_LEARNING_RATE_SFT", "5e-5"))
DEFAULT_LEARNING_RATE_DPO = float(os.getenv("DEFAULT_LEARNING_RATE_DPO", "5e-6"))
DEFAULT_LEARNING_RATE_PPO = float(os.getenv("DEFAULT_LEARNING_RATE_PPO", "1e-5"))
DEFAULT_LEARNING_RATE_ORPO = float(os.getenv("DEFAULT_LEARNING_RATE_ORPO", "8e-6"))
DEFAULT_WEIGHT_DECAY = float(os.getenv("DEFAULT_WEIGHT_DECAY", "0.01"))
DEFAULT_BETA = float(os.getenv("DEFAULT_BETA", "0.1"))

# Model configuration defaults
DEFAULT_TORCH_DTYPE = os.getenv("DEFAULT_TORCH_DTYPE", "float16")
DEFAULT_DEVICE_MAP = os.getenv("DEFAULT_DEVICE_MAP", "auto")
DEFAULT_BNB_4BIT_QUANT_TYPE = os.getenv("DEFAULT_BNB_4BIT_QUANT_TYPE", "nf4")
DEFAULT_BNB_4BIT_COMPUTE_DTYPE = os.getenv("DEFAULT_BNB_4BIT_COMPUTE_DTYPE", "bfloat16")

# Boolean training flags
DEFAULT_USE_LORA = os.getenv("DEFAULT_USE_LORA", "true").lower() == "true"
DEFAULT_BF16 = os.getenv("DEFAULT_BF16", "false").lower() == "true"
DEFAULT_FP16_SFT = os.getenv("DEFAULT_FP16_SFT", "false").lower() == "true"
DEFAULT_FP16_DPO = os.getenv("DEFAULT_FP16_DPO", "true").lower() == "true"
DEFAULT_GRADIENT_CHECKPOINTING = os.getenv("DEFAULT_GRADIENT_CHECKPOINTING", "false").lower() == "true"
DEFAULT_PACKING = os.getenv("DEFAULT_PACKING", "false").lower() == "true"
DEFAULT_DATALOADER_PIN_MEMORY = os.getenv("DEFAULT_DATALOADER_PIN_MEMORY", "true").lower() == "true"
DEFAULT_GROUP_BY_LENGTH = os.getenv("DEFAULT_GROUP_BY_LENGTH", "false").lower() == "true"
DEFAULT_TRUST_REMOTE_CODE = os.getenv("DEFAULT_TRUST_REMOTE_CODE", "false").lower() == "true"
DEFAULT_PRETOKENIZE = os.getenv("DEFAULT_PRETOKENIZE", "false").lower() == "true"
DEFAULT_USE_STREAMING = os.getenv("DEFAULT_USE_STREAMING", "false").lower() == "true"
DEFAULT_TENSORBOARD_ENABLED = os.getenv("DEFAULT_TENSORBOARD_ENABLED", "false").lower() == "true"
DEFAULT_DISABLE_DROPOUT = os.getenv("DEFAULT_DISABLE_DROPOUT", "true").lower() == "true"

# Quantization defaults
DEFAULT_LOAD_IN_4BIT = os.getenv("DEFAULT_LOAD_IN_4BIT", "true").lower() == "true"
DEFAULT_LOAD_IN_8BIT = os.getenv("DEFAULT_LOAD_IN_8BIT", "false").lower() == "true"
DEFAULT_BNB_4BIT_USE_DOUBLE_QUANT = os.getenv("DEFAULT_BNB_4BIT_USE_DOUBLE_QUANT", "true").lower() == "true"

# Optimizer and scheduler defaults
DEFAULT_OPTIM_SFT = os.getenv("DEFAULT_OPTIM_SFT", "adamw_torch")
DEFAULT_OPTIM_DPO = os.getenv("DEFAULT_OPTIM_DPO", "paged_adamw_8bit")
DEFAULT_LR_SCHEDULER_TYPE = os.getenv("DEFAULT_LR_SCHEDULER_TYPE", "cosine")
DEFAULT_EVALUATION_STRATEGY_SFT = os.getenv("DEFAULT_EVALUATION_STRATEGY_SFT", "steps")
DEFAULT_EVALUATION_STRATEGY_DPO = os.getenv("DEFAULT_EVALUATION_STRATEGY_DPO", "no")

# PPO and dataset configuration
PPO_MINI_BATCH_DIVISOR = int(os.getenv("PPO_MINI_BATCH_DIVISOR", "2"))  # batch_size // divisor
MAX_LENGTH_QUERY_DIVISOR = int(os.getenv("MAX_LENGTH_QUERY_DIVISOR", "2"))  # For query/response splits
DATASET_SAMPLE_INSPECTION_SIZE = int(os.getenv("DATASET_SAMPLE_INSPECTION_SIZE", "100"))

# PPO-specific hyperparameters
DEFAULT_PPO_EPOCHS = int(os.getenv("DEFAULT_PPO_EPOCHS", "4"))
DEFAULT_CLIP_RANGE = float(os.getenv("DEFAULT_CLIP_RANGE", "0.2"))
DEFAULT_CLIP_RANGE_VALUE = float(os.getenv("DEFAULT_CLIP_RANGE_VALUE", "0.2"))
DEFAULT_VF_COEF = float(os.getenv("DEFAULT_VF_COEF", "0.1"))

# Generation parameters
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", "50"))
DEFAULT_TOP_P = float(os.getenv("DEFAULT_TOP_P", "0.95"))
DEFAULT_TEMPERATURE = float(os.getenv("DEFAULT_TEMPERATURE", "1.0"))

# Filename defaults
PROGRESS_FILENAME = os.getenv("PROGRESS_FILENAME", "progress.json")

# Loss trend analysis threshold
MIN_LOSSES_FOR_TREND_ANALYSIS = int(os.getenv("MIN_LOSSES_FOR_TREND_ANALYSIS", "3"))

# Dataloader configuration defaults
DEFAULT_DATALOADER_NUM_WORKERS = int(os.getenv("DEFAULT_DATALOADER_NUM_WORKERS", "0"))
DEFAULT_DATALOADER_PREFETCH_FACTOR = os.getenv("DEFAULT_DATALOADER_PREFETCH_FACTOR")  # None by default

# Loss tracking configuration
RECENT_LOSSES_MAX_LENGTH = int(os.getenv("RECENT_LOSSES_MAX_LENGTH", "10"))


def detect_architecture_params(model_name: str, local_files_only: bool = False) -> Dict[str, Any]:
    """
    Auto-detect model architecture and return appropriate training parameters.

    Args:
        model_name: HuggingFace model name or path
        local_files_only: Whether to only use local files

    Returns:
        Dictionary containing target_modules and other architecture-specific params
    """
    try:
        config = AutoConfig.from_pretrained(
            model_name,
            trust_remote_code=True,
            local_files_only=local_files_only
        )

        model_type = getattr(config, 'model_type', '').lower()
        architectures = getattr(config, 'architectures', [])
        arch_name = architectures[0].lower() if architectures else ''

        logger.info(f"[Architecture] Detected model_type: {model_type}")
        logger.info(f"[Architecture] Detected architectures: {architectures}")

        if 'llama' in model_type or 'llama' in arch_name:
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'modules_to_save': None
            }
        elif 'qwen' in model_type or 'qwen' in arch_name:
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'modules_to_save': None
            }
        elif 'mistral' in model_type or 'mistral' in arch_name:
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'modules_to_save': None
            }
        elif 'gpt2' in model_type or 'gpt' in arch_name:
            return {
                'target_modules': ['c_attn', 'c_proj'],
                'modules_to_save': None
            }
        elif 'bert' in model_type or 'bert' in arch_name:
            return {
                'target_modules': ['query', 'key', 'value'],
                'modules_to_save': None
            }
        elif 't5' in model_type or 't5' in arch_name:
            return {
                'target_modules': ['q', 'k', 'v', 'o', 'wi', 'wo'],
                'modules_to_save': None
            }
        elif 'phi' in model_type or 'phi' in arch_name:
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'dense', 'fc1', 'fc2'],
                'modules_to_save': None
            }
        elif 'gemma' in model_type or 'gemma' in arch_name:
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'modules_to_save': None
            }
        else:
            logger.warning(f"[Architecture] Unknown architecture: {model_type}, using LLaMA-style defaults")
            return {
                'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
                'modules_to_save': None
            }

    except Exception as e:
        logger.warning(f"[Architecture] Failed to detect architecture: {e}, using defaults")
        return {
            'target_modules': ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
            'modules_to_save': None
        }


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

        self.job_id = os.getenv('JOB_ID')
        self.job_token = os.getenv('JOB_TOKEN')
        self.metrics_api_url = os.getenv('METRICS_API_URL')

        self.is_cloud = bool(self.job_token and self.metrics_api_url)

        if self.is_cloud:
            logger.info(f"[MetricsCallback] Cloud mode enabled - will POST to {self.metrics_api_url}")
        else:
            logger.info("[MetricsCallback] Local mode - will only write to progress.json")

        self.start_time = None
        self.last_log_time = None
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

        # Track previous eval for recent improvement detection
        self.last_eval_loss = None

        # Track last scored eval_loss to avoid redundant scoring on every step
        self._last_scored_eval_loss = None

        # Dataset statistics (set during training)
        self.total_samples = 0
        self.train_samples = 0
        self.val_samples = 0
        self.total_tokens_processed = 0

        # Training parameters (set during on_train_begin)
        self.batch_size = None
        self.gradient_accumulation_steps = None

        # Loss trend tracking
        self.recent_losses = deque(maxlen=RECENT_LOSSES_MAX_LENGTH)

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

        # Capture training parameters from args for progress reporting
        self.batch_size = args.per_device_train_batch_size
        self.gradient_accumulation_steps = args.gradient_accumulation_steps

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
        should_log_console = (now - self.last_log_time).total_seconds() >= CONSOLE_LOG_INTERVAL
        
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

    def _update_best_model(self, eval_loss: float, current_epoch: int, current_step: int, train_loss: Optional[float] = None):
        """Track best model using multi-metric scoring."""
        from lib.training.checkpoint_scorer import calculate_checkpoint_score

        # Calculate multi-metric score for current checkpoint
        current_checkpoint_data = {
            'eval_loss': eval_loss,
            'train_loss': train_loss,
            'epochs_without_improvement': self.epochs_without_improvement
        }
        current_score = calculate_checkpoint_score(current_checkpoint_data)

        # Calculate score for previous best (for comparison)
        if self.best_eval_loss != float('inf'):
            previous_best_data = {
                'eval_loss': self.best_eval_loss,
                'train_loss': None,  # Don't have historical train_loss
                'epochs_without_improvement': 1  # Assume previous best has no recent improvement
            }
            previous_best_score = calculate_checkpoint_score(previous_best_data)
        else:
            previous_best_score = float('inf')  # First checkpoint

        # Update if current score is better (lower)
        if current_score < previous_best_score:
            logger.info(
                f"[MetricsCallback] New best checkpoint! "
                f"Score: {current_score:.6f} (previous: {previous_best_score:.6f}) "
                f"Eval Loss: {eval_loss:.6f} at Epoch {current_epoch}, Step {current_step}"
            )
            logger.debug(
                f"[MetricsCallback] Score breakdown - "
                f"eval_loss: {eval_loss}, train_loss: {train_loss}, "
                f"epochs_without_improvement: {self.epochs_without_improvement}"
            )

            self.best_eval_loss = eval_loss
            self.best_epoch = current_epoch
            self.best_step = current_step
        else:
            logger.debug(
                f"[MetricsCallback] Current checkpoint score ({current_score:.6f}) "
                f"not better than best ({previous_best_score:.6f})"
            )

        # Check if current eval improved compared to the PREVIOUS eval (not all-time best)
        # This gives a binary indicator: did the last eval show improvement?
        if self.last_eval_loss is not None:
            if eval_loss < self.last_eval_loss:
                self.epochs_without_improvement = 0  # Recent improvement
                logger.debug(f"[MetricsCallback] Recent improvement: {self.last_eval_loss:.6f} → {eval_loss:.6f}")
            else:
                self.epochs_without_improvement = 1  # No recent improvement
                logger.debug(f"[MetricsCallback] No recent improvement: {self.last_eval_loss:.6f} → {eval_loss:.6f}")
        else:
            # First eval, consider it as improvement
            self.epochs_without_improvement = 0
            logger.debug(f"[MetricsCallback] First evaluation: {eval_loss:.6f}")

        # Update last eval for next comparison
        self.last_eval_loss = eval_loss

    def _analyze_loss_trend(self) -> str:
        """Analyze recent loss trend. Returns 'improving', 'degrading', or 'stable'."""
        if len(self.recent_losses) < MIN_LOSSES_FOR_TREND_ANALYSIS:
            return "insufficient_data"

        losses = list(self.recent_losses)
        first_half_avg = sum(losses[:len(losses)//2]) / (len(losses)//2)
        second_half_avg = sum(losses[len(losses)//2:]) / (len(losses) - len(losses)//2)

        diff = first_half_avg - second_half_avg

        if diff > LOSS_IMPROVEMENT_THRESHOLD:
            return "improving"
        elif diff < -LOSS_IMPROVEMENT_THRESHOLD:
            return "degrading"
        else:
            return "stable"

    def set_dataset_info(self, train_dataset: Dataset, eval_dataset: Optional[Dataset]):
        """
        Calculate dataset statistics including average tokens per sample.
        Call this after datasets are loaded.

        Args:
            train_dataset: Training dataset
            eval_dataset: Evaluation dataset or None
        """
        # Handle both Dataset and IterableDataset
        if isinstance(train_dataset, IterableDataset):
            # Streaming datasets don't have len()
            self.train_samples = None
            if eval_dataset is None:
                self.val_samples = None
            elif isinstance(eval_dataset, IterableDataset):
                self.val_samples = None
            else:
                self.val_samples = len(eval_dataset)
            self.total_samples = None
            logger.info("[MetricsCallback] Streaming mode: dataset sizes unknown")
            logger.info("[MetricsCallback] Token calculation disabled for streaming datasets")
            self.avg_tokens_per_sample = DEFAULT_AVG_TOKENS_PER_SAMPLE
            return
        else:
            self.train_samples = len(train_dataset)
            if eval_dataset is None:
                self.val_samples = None
            elif isinstance(eval_dataset, IterableDataset):
                self.val_samples = None
            else:
                self.val_samples = len(eval_dataset)
            self.total_samples = self.train_samples + (self.val_samples or 0)

            logger.info(f"[MetricsCallback] Total samples: {self.total_samples}")
            logger.info(f"[MetricsCallback] Train samples: {self.train_samples}")
            logger.info(f"[MetricsCallback] Eval samples: {self.val_samples}")

        # Calculate average sequence length from training dataset
        try:
            if 'input_ids' in train_dataset.features:
                # Sample up to TOKEN_SAMPLE_SIZE examples to estimate average
                sample_size = min(TOKEN_SAMPLE_SIZE, len(train_dataset))
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

            # Update best model tracking - only score when we have a NEW eval_loss
            # This prevents redundant scoring on every step after an eval
            if eval_loss is not None and eval_loss != self._last_scored_eval_loss:
                # Use most recent train_loss if current logs don't have it (happens during eval)
                train_loss_for_scoring = train_loss
                if train_loss_for_scoring is None and len(self.recent_losses) > 0:
                    train_loss_for_scoring = self.recent_losses[-1]

                self._update_best_model(eval_loss, current_epoch, state.global_step, train_loss_for_scoring)
                self._last_scored_eval_loss = eval_loss

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
                "batch_size": self.batch_size,
                "gradient_accumulation_steps": self.gradient_accumulation_steps,
                "metrics_history": list(self.metrics_history)
            }
            
            self.progress_file.parent.mkdir(parents=True, exist_ok=True)
            
            temp_file = self.progress_file.with_suffix('.tmp')
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(progress_data, f, indent=2)
            
            # Windows file locking workaround: retry replace operation
            for attempt in range(FILE_OPERATION_MAX_RETRIES):
                try:
                    temp_file.replace(self.progress_file)
                    break
                except PermissionError as perm_err:
                    if attempt < FILE_OPERATION_MAX_RETRIES - 1:
                        time.sleep(FILE_RETRY_SLEEP)
                        continue
                    else:
                        logger.warning(f"[MetricsCallback] Could not replace progress file after {FILE_OPERATION_MAX_RETRIES} attempts: {perm_err}")
                        # Keep temp file as backup
                        logger.info(f"[MetricsCallback] Progress saved to temporary file: {temp_file}")
            
            logger.debug(
                f"[MetricsCallback] Progress updated: "
                f"Step {state.global_step}/{state.max_steps}, "
                f"Progress {progress_percent:.1f}%"
            )

            if self.is_cloud:
                self._post_metrics_to_api(progress_data)

        except Exception as e:
            logger.error(f"[MetricsCallback] Failed to write progress: {e}", exc_info=True)

    def _post_metrics_to_api(self, progress_data: Dict[str, Any]):
        """POST metrics to API endpoint for cloud training."""
        try:
            import requests

            # API expects: POST /api/training/local/metrics with body { job_id, metrics: [] }
            api_url = self.metrics_api_url

            metric_point = {
                "step": progress_data.get("current_step"),
                "epoch": progress_data.get("current_epoch"),
                "train_loss": progress_data.get("train_loss"),
                "eval_loss": progress_data.get("eval_loss"),
                "learning_rate": progress_data.get("learning_rate"),
                "grad_norm": progress_data.get("grad_norm"),
                "samples_per_second": progress_data.get("samples_per_second"),
                "gpu_memory_allocated_gb": progress_data.get("gpu_memory_allocated_gb"),
                "gpu_memory_reserved_gb": progress_data.get("gpu_memory_reserved_gb"),
                "gpu_utilization_percent": progress_data.get("gpu_utilization_percent"),
                "perplexity": progress_data.get("perplexity"),
                "train_perplexity": progress_data.get("train_perplexity"),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }

            # Wrap in correct API format
            payload = {
                "job_id": self.job_id,
                "metrics": [metric_point]
            }

            response = requests.post(
                api_url,
                json=payload,
                headers={"Authorization": f"Bearer {self.job_token}"},
                timeout=HTTP_REQUEST_TIMEOUT
            )

            if response.status_code != 200:
                logger.warning(f"[MetricsCallback] API POST failed: {response.status_code} - {response.text}")

        except Exception as e:
            logger.warning(f"[MetricsCallback] Failed to POST metrics to API: {e}")


class RuntimeParameterUpdateCallback(TrainerCallback):
    """
    Callback to check for and apply runtime parameter updates during training.
    Polls the database every N steps to see if user has requested parameter changes.
    
    Supports updating:
    - Learning rate
    - Gradient accumulation steps (future)
    - Warmup ratio (future)
    """
    
    def __init__(self, job_id: str, check_interval: int = None):
        """
        Initialize runtime parameter update callback.

        Args:
            job_id: Training job ID to monitor
            check_interval: Check for updates every N steps (default: PARAM_UPDATE_CHECK_INTERVAL)
        """
        self.job_id = job_id
        self.check_interval = check_interval if check_interval is not None else PARAM_UPDATE_CHECK_INTERVAL
        self.last_applied_update = None
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        # Validate environment variables
        if not self.supabase_url or not self.supabase_key:
            logger.warning(
                "[RuntimeParamCallback] Supabase credentials not found. "
                "Runtime parameter updates disabled."
            )
            self.enabled = False
        else:
            self.enabled = True
            logger.info(
                f"[RuntimeParamCallback] Initialized for job {job_id}, "
                f"checking every {check_interval} steps"
            )
    
    def on_step_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Check for parameter updates after every N training steps."""
        if not self.enabled:
            return
        
        # Only check every N steps to reduce database load
        if state.global_step % self.check_interval != 0:
            return
        
        logger.debug(f"[RuntimeParamCallback] Checking for updates at step {state.global_step}")
        
        try:
            updates = self._check_for_parameter_updates()
            if updates:
                self._apply_parameter_updates(updates, kwargs.get('optimizer'))
        except Exception as e:
            logger.error(f"[RuntimeParamCallback] Error processing updates: {e}")
    
    def _check_for_parameter_updates(self) -> Optional[Dict[str, Any]]:
        """
        Poll database for parameter updates.
        
        Returns:
            Dict with updated parameters if new updates exist, None otherwise
        """
        try:
            import requests
            
            # Query training job for parameter updates
            response = requests.get(
                f"{self.supabase_url}/rest/v1/local_training_jobs",
                params={"id": f"eq.{self.job_id}", "select": "parameter_updates,last_parameter_update_at"},
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}"
                },
                timeout=HTTP_REQUEST_TIMEOUT
            )
            
            if response.status_code != 200:
                logger.warning(f"[RuntimeParamCallback] Database query failed: {response.status_code}")
                return None
            
            data = response.json()
            if not data or len(data) == 0:
                logger.warning(f"[RuntimeParamCallback] Job {self.job_id} not found in database")
                return None
            
            job_data = data[0]
            parameter_updates = job_data.get('parameter_updates')
            
            if not parameter_updates or len(parameter_updates) == 0:
                return None
            
            # Get most recent update
            latest_update = parameter_updates[-1]
            update_timestamp = latest_update.get('requested_at')
            
            # Check if we've already applied this update
            if self.last_applied_update and self.last_applied_update == update_timestamp:
                return None
            
            logger.info(
                f"[RuntimeParamCallback] New parameter update found: {latest_update}"
            )
            
            # Mark as processing
            self.last_applied_update = update_timestamp
            
            return latest_update
            
        except Exception as e:
            logger.error(f"[RuntimeParamCallback] Failed to check for updates: {e}")
            return None
    
    def _apply_parameter_updates(self, updates: Dict[str, Any], optimizer):
        """
        Apply parameter updates to the running training process.
        
        Args:
            updates: Dict containing parameter updates
            optimizer: Trainer's optimizer instance
        """
        applied_changes = []
        
        try:
            # Update learning rate
            if 'learning_rate' in updates and optimizer:
                new_lr = float(updates['learning_rate'])
                old_lr = optimizer.param_groups[0]['lr']
                
                # Update all parameter groups
                for param_group in optimizer.param_groups:
                    param_group['lr'] = new_lr
                
                applied_changes.append(f"learning_rate: {old_lr:.2e} → {new_lr:.2e}")
                logger.info(f"[RuntimeParamCallback] ✅ Applied learning rate update: {old_lr:.2e} → {new_lr:.2e}")
            
            # Future: Add support for other parameters
            # - gradient_accumulation_steps (requires trainer.args modification)
            # - warmup_ratio (requires scheduler reinit)
            # - eval_steps (requires trainer.args modification)
            
            if applied_changes:
                logger.info(
                    f"[RuntimeParamCallback] Successfully applied {len(applied_changes)} parameter updates: "
                    f"{', '.join(applied_changes)}"
                )
            else:
                logger.warning("[RuntimeParamCallback] No applicable parameters found in update")
                
        except Exception as e:
            logger.error(f"[RuntimeParamCallback] Failed to apply parameter updates: {e}")


class IntegerDtypeCollator:
    """
    Data collator that ensures input_ids, labels, and attention_mask remain as integers.

    This fixes a bug in TRL 0.26+ where pre-tokenized data can be cast to FloatTensor,
    causing "Expected tensor for argument #1 'indices' to have scalar type Long/Int" errors.

    GitHub issue: https://github.com/huggingface/trl/issues/4103
    """

    def __init__(self, tokenizer, pad_to_multiple_of: int = None):
        from transformers import DataCollatorForSeq2Seq
        self.base_collator = DataCollatorForSeq2Seq(
            tokenizer=tokenizer,
            padding=True,
            pad_to_multiple_of=pad_to_multiple_of
        )

    def __call__(self, features: list) -> dict:
        # Use base collator for padding
        batch = self.base_collator(features)

        # Ensure integer dtypes for embedding-related tensors
        # This fixes TRL bug where tensors get cast to float
        integer_keys = ['input_ids', 'labels', 'attention_mask']
        for key in integer_keys:
            if key in batch and hasattr(batch[key], 'dtype'):
                if batch[key].dtype not in (torch.long, torch.int, torch.int32, torch.int64):
                    batch[key] = batch[key].long()

        return batch


class ResponseMaskingCollator:
    """
    Custom data collator that masks prompt tokens for SFT training.

    Only response tokens are used for training (labels != -100).
    Prompt tokens are masked (labels = -100) to prevent the model from learning to repeat prompts.
    """

    def __init__(self, tokenizer, response_template: str):
        """
        Initialize the response masking collator.

        Args:
            tokenizer: HuggingFace tokenizer
            response_template: String marker where assistant response begins
                              (e.g., "<|im_start|>assistant\n" for ChatML)
        """
        self.tokenizer = tokenizer
        self.response_template = response_template
        self.response_template_ids = tokenizer.encode(response_template, add_special_tokens=False)

    def __call__(self, features):
        """
        Apply response masking to a batch of features.

        Args:
            features: List of dicts with 'input_ids' key

        Returns:
            Dict with collated and padded tensors, including masked labels
        """
        # Apply masking to each feature
        for feature in features:
            if "input_ids" in feature and "labels" not in feature:
                input_ids = feature["input_ids"]
                labels = list(input_ids)

                # Find response start position
                response_start_idx = None
                for i in range(len(input_ids) - len(self.response_template_ids) + 1):
                    if input_ids[i:i+len(self.response_template_ids)] == self.response_template_ids:
                        response_start_idx = i + len(self.response_template_ids)
                        break

                # Mask prompt tokens (set to -100 so they're ignored in loss)
                if response_start_idx is not None:
                    for i in range(response_start_idx):
                        labels[i] = -100

                feature["labels"] = labels

        # Use default collator for padding and tensor conversion
        from transformers import default_data_collator
        return default_data_collator(features)


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
        eval_dataset: Optional[Dataset],
        output_dir: Path
    ):
        """
        Initialize the trainer.

        Args:
            config: Training configuration dictionary
            train_dataset: Training dataset (HuggingFace Dataset)
            eval_dataset: Evaluation dataset (HuggingFace Dataset) or None
            output_dir: Directory to save model checkpoints
        """
        logger.info("[Trainer] Initializing ToolTrainer")
        logger.info(f"[Trainer] Output directory: {output_dir}")

        # Handle both Dataset and IterableDataset (streaming doesn't support len())
        if isinstance(train_dataset, IterableDataset):
            logger.info("[Trainer] Training dataset: IterableDataset (streaming mode, size unknown)")
        else:
            logger.info(f"[Trainer] Training dataset size: {len(train_dataset)}")

        if eval_dataset is None:
            logger.info("[Trainer] No evaluation dataset provided - evaluation disabled")
        elif isinstance(eval_dataset, IterableDataset):
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
        if self.config.get("tensorboard", {}).get("enabled", DEFAULT_TENSORBOARD_ENABLED):
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
        pretokenize_enabled = config.get("training", {}).get("pretokenize", DEFAULT_PRETOKENIZE)
        use_streaming = config.get("training", {}).get("use_streaming", DEFAULT_USE_STREAMING)

        # Auto-enable pretokenization for chat templates if not explicitly disabled
        # This ensures proper response masking for SFT training
        if not pretokenize_enabled and self.training_method == 'sft':
            if hasattr(self.tokenizer, 'chat_template') and self.tokenizer.chat_template:
                logger.info(
                    "[Trainer] Chat template detected. Auto-enabling pretokenization for proper response masking. "
                    "Set 'pretokenize: false' explicitly to disable (not recommended for chat models)."
                )
                pretokenize_enabled = True
        
        # Streaming and pretokenization are mutually exclusive
        if use_streaming and pretokenize_enabled:
            logger.warning(
                "[Trainer] Streaming mode enabled - pretokenization automatically disabled "
                "(streaming datasets use on-the-fly tokenization)"
            )
            pretokenize_enabled = False
        
        # Skip pre-tokenization for DPO/ORPO/RLHF - they need raw text fields
        if self.training_method in ['dpo', 'orpo', 'rlhf']:
            logger.info(
                f"[Trainer] Pre-tokenization skipped for {self.training_method.upper()} "
                "(requires raw dataset with prompt/chosen/rejected or messages fields)"
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
        # Get supported model prefixes from environment or use defaults
        model_prefixes_env = os.getenv("MODEL_PREFIXES", "Qwen-,Meta-,mistral,Llama-,llama-,gemma-,phi-")
        supported_prefixes = [prefix.strip() for prefix in model_prefixes_env.split(",")]

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
            ]

            # Add custom AI_MODELS_DIR from environment if set
            ai_models_dir = os.getenv("AI_MODELS_DIR")
            if ai_models_dir:
                possible_paths.append(Path(ai_models_dir) / model_name)

            # Add common default locations as fallbacks
            home_dir = Path.home()
            possible_paths.extend([
                home_dir / "AI_Models" / model_name,
                home_dir / "Desktop" / "AI_Models" / model_name,
            ])
            
            # Try each possible path
            for try_path in possible_paths:
                if try_path.exists():
                    logger.debug(f"[Model] Found local model at: {try_path}")

                    # Check if this is a HuggingFace cache directory (has snapshots/ subdirectory)
                    # even if "snapshots" is in the model_name, the path might still be the cache root
                    if try_path.is_dir():
                        snapshots_dir = try_path / "snapshots"
                        if snapshots_dir.exists() and snapshots_dir.is_dir():
                            # Find the latest snapshot
                            snapshot_dirs = sorted(snapshots_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                            if snapshot_dirs:
                                actual_model_path = snapshot_dirs[0]
                                logger.debug(f"[Model] Detected HF cache structure, using snapshot: {actual_model_path}")
                                logger.debug(f"[Model] Using local_files_only=True")
                                return str(actual_model_path), True

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
                # Check for HuggingFace cache format: models--{namespace}--{model}
                if part.startswith("models--"):
                    # Extract namespace and model from cache format
                    cache_parts = part.replace("models--", "").split("--", 1)
                    if len(cache_parts) == 2:
                        model_id = f"{cache_parts[0]}/{cache_parts[1]}"
                        logger.warning(f"[Model] Extracted from HF cache format: {model_id}")
                        return model_id, False

                # Fallback: old format (Qwen-Qwen3-1.7B, Meta-Llama-3, etc.)
                if any(part.startswith(prefix) for prefix in supported_prefixes):
                    # Found model name, convert to HF format
                    model_id = part.replace("-", "/", 1)
                    logger.warning(f"[Model] Falling back to HuggingFace download: {model_id}")
                    return model_id, False

            logger.warning(f"[Model] Could not parse model path, using as-is: {model_name}")
            return model_name, False
        
        # Define possible local model directories (used for both formats)
        ai_models_dir = os.getenv("AI_MODELS_DIR")
        home_dir = Path.home()
        
        possible_local_dirs = [
            Path(__file__).parent.parent.parent / "AI_Models" / "huggingface_models",
            home_dir / "AI_Models" / "huggingface_models",
            home_dir / "Desktop" / "AI_Models" / "huggingface_models",
        ]
        
        if ai_models_dir:
            possible_local_dirs.insert(0, Path(ai_models_dir) / "huggingface_models")
        
        # Check if this is a HuggingFace model ID (org/model format with slash)
        # Look for local models before attempting to download
        if "/" in model_name:
            logger.info(f"[Model] Checking for local model: {model_name}")
            
            # Try to find local model with dash naming (legacy format)
            # e.g., "meta-llama/Llama-3.2-1B-Instruct" -> "meta-llama-Llama-3.2-1B-Instruct"
            dash_model_name = model_name.replace("/", "-")
            
            # Check each possible directory for the model
            for local_dir in possible_local_dirs:
                local_model_path = local_dir / dash_model_name
                if local_model_path.exists() and local_model_path.is_dir():
                    logger.info(f"[Model] Found local model at: {local_model_path}")

                    # Check if this is a HuggingFace cache directory (has snapshots/ subdirectory)
                    snapshots_dir = local_model_path / "snapshots"
                    if snapshots_dir.exists() and snapshots_dir.is_dir():
                        # Find the latest snapshot
                        snapshot_dirs = sorted(snapshots_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                        if snapshot_dirs:
                            actual_model_path = snapshot_dirs[0]
                            logger.info(f"[Model] Detected HF cache structure, using snapshot: {actual_model_path}")
                            logger.info(f"[Model] Using local_files_only=True")
                            return str(actual_model_path), True

                    logger.info(f"[Model] Using local_files_only=True")
                    return str(local_model_path), True
            
            logger.info(f"[Model] Local model not found, will download from HuggingFace: {model_name}")
        
        # Check if this might be a corrupted model name (dash instead of slash)
        # e.g., "meta-llama-Llama-3.2-1B-Instruct" (legacy corrupted format)
        elif "-" in model_name:
            logger.info(f"[Model] Checking if this is a local model with dash naming: {model_name}")

            # Check if this exact name exists locally
            for local_dir in possible_local_dirs:
                local_model_path = local_dir / model_name
                if local_model_path.exists() and local_model_path.is_dir():
                    logger.info(f"[Model] Found local model at: {local_model_path}")

                    # Check if this is a HuggingFace cache directory (has snapshots/ subdirectory)
                    snapshots_dir = local_model_path / "snapshots"
                    if snapshots_dir.exists() and snapshots_dir.is_dir():
                        # Find the latest snapshot
                        snapshot_dirs = sorted(snapshots_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                        if snapshot_dirs:
                            actual_model_path = snapshot_dirs[0]
                            logger.info(f"[Model] Detected HF cache structure, using snapshot: {actual_model_path}")
                            logger.info(f"[Model] Using local_files_only=True")
                            return str(actual_model_path), True

                    logger.info(f"[Model] Using local_files_only=True")
                    return str(local_model_path), True

            # Try to convert to proper HuggingFace format and check again
            # e.g., "meta-llama-Llama-3.2-1B-Instruct" -> "meta-llama/Llama-3.2-1B-Instruct"
            # Find the first capital letter after initial lowercase prefix
            proper_model_name = None
            for i, char in enumerate(model_name):
                if i > 0 and char.isupper() and model_name[i-1] == '-':
                    # Split at this dash before the capital letter
                    proper_model_name = model_name[:i-1] + "/" + model_name[i:]
                    logger.info(f"[Model] Converted to proper format: {proper_model_name}")

                    # Check if the converted name exists locally
                    dash_converted = proper_model_name.replace("/", "-")
                    for local_dir in possible_local_dirs:
                        local_model_path = local_dir / dash_converted
                        if local_model_path.exists() and local_model_path.is_dir():
                            logger.info(f"[Model] Found local model at: {local_model_path}")

                            # Check if this is a HuggingFace cache directory (has snapshots/ subdirectory)
                            snapshots_dir = local_model_path / "snapshots"
                            if snapshots_dir.exists() and snapshots_dir.is_dir():
                                # Find the latest snapshot
                                snapshot_dirs = sorted(snapshots_dir.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True)
                                if snapshot_dirs:
                                    actual_model_path = snapshot_dirs[0]
                                    logger.info(f"[Model] Detected HF cache structure, using snapshot: {actual_model_path}")
                                    logger.info(f"[Model] Using local_files_only=True")
                                    return str(actual_model_path), True

                            logger.info(f"[Model] Using local_files_only=True")
                            return str(local_model_path), True
                    break

            logger.info(f"[Model] Local model not found for: {model_name}")

            # If we converted the name but didn't find it locally, use the converted name for HuggingFace
            if proper_model_name:
                logger.info(f"[Model] Using converted HuggingFace model ID: {proper_model_name}")
                return proper_model_name, False

        # Regular HuggingFace model ID (not found locally)
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
            trust_remote_code=self.config["model"].get("trust_remote_code", DEFAULT_TRUST_REMOTE_CODE),
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
        use_lora = self.config["training"].get("use_lora", DEFAULT_USE_LORA)

        logger.info(f"[Model] Loading {model_name}")
        logger.info(f"[Model] Using LoRA: {use_lora}")
        
        # Normalize model path
        normalized_path, local_files_only = self._normalize_model_path(model_name)
        logger.debug(f"[Model] Normalized path: {normalized_path}, local_files_only={local_files_only}")

        if use_lora:
            # Configure quantization - UI configurable (4-bit or 8-bit)
            quant_config = self.config["training"].get("quantization", {})
            load_in_4bit = quant_config.get("load_in_4bit", DEFAULT_LOAD_IN_4BIT)
            load_in_8bit = quant_config.get("load_in_8bit", DEFAULT_LOAD_IN_8BIT)

            # Store training dtype for merge preservation
            training_dtype = model_config.get("torch_dtype", DEFAULT_TORCH_DTYPE)
            self._training_dtype = training_dtype

            # Store quantization flags for merge handling
            self._using_quantization = load_in_8bit or load_in_4bit
            self._load_in_8bit = load_in_8bit
            self._load_in_4bit = load_in_4bit

            # 8-bit takes precedence if both are somehow enabled
            if load_in_8bit:
                logger.info("[Model] Configuring 8-bit quantization (LoRA)")
                logger.info(f"[Model] Quantization config: {quant_config}")
                bnb_config = BitsAndBytesConfig(
                    load_in_8bit=True,
                    llm_int8_threshold=quant_config.get("llm_int8_threshold", 6.0),
                )
            else:
                logger.info("[Model] Configuring 4-bit quantization (QLoRA)")
                logger.info(f"[Model] Quantization config: {quant_config}")
                bnb_config = BitsAndBytesConfig(
                    load_in_4bit=load_in_4bit,
                    bnb_4bit_quant_type=quant_config.get("bnb_4bit_quant_type", DEFAULT_BNB_4BIT_QUANT_TYPE),
                    bnb_4bit_use_double_quant=quant_config.get("bnb_4bit_use_double_quant", DEFAULT_BNB_4BIT_USE_DOUBLE_QUANT),
                    bnb_4bit_compute_dtype=quant_config.get("bnb_4bit_compute_dtype", DEFAULT_BNB_4BIT_COMPUTE_DTYPE)
                )

            # Load base model with quantization
            model = AutoModelForCausalLM.from_pretrained(
                normalized_path,
                trust_remote_code=model_config.get("trust_remote_code", False),
                torch_dtype=getattr(torch, training_dtype),
                device_map=model_config.get("device_map", DEFAULT_DEVICE_MAP),
                quantization_config=bnb_config,
                local_files_only=local_files_only,
            )

            # Prepare model for k-bit training
            logger.info("[Model] Preparing model for k-bit training")
            model = prepare_model_for_kbit_training(model)

            # Auto-detect architecture-specific parameters
            arch_params = detect_architecture_params(normalized_path, local_files_only)
            default_target_modules = arch_params['target_modules']

            # Configure LoRA - UI configurable
            # Support both config.lora and config.training.lora_config paths
            lora_config_section = self.config.get("lora", self.config["training"].get("lora_config", {}))
            lora_r = lora_config_section.get("r", DEFAULT_LORA_R)
            lora_alpha = lora_config_section.get("lora_alpha", lora_config_section.get("alpha", DEFAULT_LORA_ALPHA))
            lora_dropout = lora_config_section.get("lora_dropout", lora_config_section.get("dropout", DEFAULT_LORA_DROPOUT))
            target_modules = lora_config_section.get("target_modules", default_target_modules)

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
                torch_dtype=getattr(torch, model_config.get("torch_dtype", DEFAULT_TORCH_DTYPE)),
                device_map=model_config.get("device_map", DEFAULT_DEVICE_MAP),
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
        num_epochs = self.config["training"].get("num_epochs", DEFAULT_NUM_EPOCHS)
        batch_size = self.config["training"].get("batch_size", DEFAULT_BATCH_SIZE)
        learning_rate = self.config["training"].get("learning_rate", DEFAULT_LEARNING_RATE_SFT)
        
        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = self.config["training"].get("lr_scheduler_type", DEFAULT_LR_SCHEDULER_TYPE)
        warmup_ratio = self.config["training"].get("warmup_ratio")  # Optional, None means use warmup_steps
        save_steps = self.config["training"].get("save_steps", DEFAULT_SAVE_STEPS)
        save_total_limit = self.config["training"].get("save_total_limit", DEFAULT_SAVE_TOTAL_LIMIT)
        evaluation_strategy = self.config["training"].get("evaluation_strategy", DEFAULT_EVALUATION_STRATEGY_SFT)
        eval_steps = self.config["training"].get("eval_steps", DEFAULT_EVAL_STEPS)
        packing = self.config["training"].get("packing", DEFAULT_PACKING)
        
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
        
        progress_file = self.output_dir / PROGRESS_FILENAME
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        # Set dataset info for tokens/sec calculation (Phase 3)
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[SFT] Progress tracking enabled: {progress_file}")

        # Runtime parameter updates callback
        job_id = os.getenv('JOB_ID')
        param_update_callback = None
        if job_id:
            param_update_callback = RuntimeParameterUpdateCallback(
                job_id=job_id,
                check_interval=PARAM_UPDATE_CHECK_INTERVAL
            )
            logger.info(f"[SFT] Runtime parameter updates enabled for job {job_id}")
        else:
            logger.warning("[SFT] No JOB_ID found, runtime parameter updates disabled")

        # Predictions callback - comprehensive debug logging
        predictions_callback = None
        logger.info(f"[SFT] === PREDICTIONS INIT DEBUG ===")
        logger.info(f"[SFT] PREDICTIONS_AVAILABLE: {PREDICTIONS_AVAILABLE}")
        logger.info(f"[SFT] job_id: {job_id}")
        logger.info(f"[SFT] JOB_USER_ID env: {os.getenv('JOB_USER_ID', 'NOT SET')}")
        logger.info(f"[SFT] JOB_TOKEN env: {'SET' if os.getenv('JOB_TOKEN') else 'NOT SET'}")
        logger.info(f"[SFT] METRICS_API_URL env: {os.getenv('METRICS_API_URL', 'NOT SET')}")
        predictions_config = self.config.get("predictions", {})
        dataset_path = self.config.get("dataset_path") or self.config.get("data", {}).get("dataset_path")
        samples_path = predictions_config.get('samples_path')
        logger.info(f"[SFT] predictions config: {predictions_config}")
        logger.info(f"[SFT] predictions.enabled: {predictions_config.get('enabled', False)}")
        logger.info(f"[SFT] dataset_path resolved: {dataset_path or 'NOT SET'}")
        if samples_path:
            logger.info(f"[SFT] predictions.samples_path: {samples_path}")
        logger.info(f"[SFT] ================================")

        # Warn early if eval-frequency predictions are requested but eval is disabled or empty
        if predictions_config.get("enabled", False) and predictions_config.get("sample_frequency") == "eval":
            eval_size = None
            if self.eval_dataset is not None and not isinstance(self.eval_dataset, IterableDataset):
                try:
                    eval_size = len(self.eval_dataset)
                except Exception:
                    eval_size = None

            if evaluation_strategy == "no":
                logger.warning("[SFT] Predictions frequency set to eval but evaluation_strategy is 'no' — predictions will not run")
            if eval_size == 0:
                logger.warning("[SFT] Predictions frequency set to eval but eval dataset is empty — predictions will not run")

        if PREDICTIONS_AVAILABLE and job_id:
            if predictions_config.get("enabled", False):
                user_id = os.getenv('JOB_USER_ID')

                if user_id and (dataset_path or samples_path):
                    try:
                        predictions_callback = TrainingPredictionsCallback(
                            dataset_path=dataset_path or samples_path,
                            job_id=job_id,
                            user_id=user_id,
                            config=predictions_config
                        )
                        logger.info("[SFT] Predictions tracking enabled successfully!")
                    except Exception as e:
                        logger.warning(f"[SFT] Predictions init failed: {e}")
                else:
                    logger.warning(
                        f"[SFT] Predictions disabled: missing user_id={bool(user_id)}, "
                        f"dataset_path={bool(dataset_path)}, samples_path={bool(samples_path)}"
                    )
            else:
                logger.info("[SFT] Predictions disabled in config (predictions.enabled=false)")
        else:
            if not PREDICTIONS_AVAILABLE:
                logger.warning("[SFT] Predictions skipped: TrainingPredictionsCallback not available")
            if not job_id:
                logger.warning("[SFT] Predictions skipped: no job_id")

        # Build SFTConfig with ALL UI-configurable parameters
        training_args = SFTConfig(
            output_dir=str(self.output_dir),
            overwrite_output_dir=True,
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=self.config["training"].get("eval_batch_size", DEFAULT_EVAL_BATCH_SIZE),
            gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", DEFAULT_GRADIENT_ACCUMULATION_STEPS),
            learning_rate=learning_rate,
            warmup_steps=self.config["training"].get("warmup_steps", DEFAULT_WARMUP_STEPS),
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,

            # Logging and evaluation - UI configurable
            logging_steps=self.config["training"].get("logging_steps", DEFAULT_LOGGING_STEPS),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,
            eval_accumulation_steps=10,  # Accumulate eval outputs to reduce memory peaks

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True if evaluation_strategy != "no" else False,
            metric_for_best_model="eval_loss" if evaluation_strategy != "no" else None,
            greater_is_better=False,

            # Precision and optimization - UI configurable
            bf16=self.config["training"].get("bf16", DEFAULT_BF16),
            fp16=self.config["training"].get("fp16", DEFAULT_FP16_SFT),
            optim=self.config["training"].get("optim", DEFAULT_OPTIM_SFT),
            max_grad_norm=self.config["training"].get("max_grad_norm", DEFAULT_MAX_GRAD_NORM_SFT),
            weight_decay=self.config["training"].get("weight_decay", DEFAULT_WEIGHT_DECAY),

            # Memory optimization - UI configurable
            gradient_checkpointing=self.config["training"].get("gradient_checkpointing", DEFAULT_GRADIENT_CHECKPOINTING),
            torch_empty_cache_steps=500,  # Clear cache at eval steps to reduce fragmentation

            # Data loading - UI configurable
            dataloader_num_workers=self.config["training"].get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS),
            dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", DEFAULT_DATALOADER_PREFETCH_FACTOR) if self.config["training"].get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS) > 0 else None,
            dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", DEFAULT_DATALOADER_PIN_MEMORY),
            group_by_length=self.config["training"].get("group_by_length", DEFAULT_GROUP_BY_LENGTH),

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

        max_seq_length = self.config["training"].get("max_length", DEFAULT_MAX_LENGTH_SFT)
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

            # Check if labels column exists (masking-aware pretokenization)
            if "labels" in dataset_columns:
                logger.info("[SFT] Dataset has 'labels' column - response masking already applied during pretokenization")
                logger.info("[SFT] Skipping formatting_func (using pre-masked labels with DataCollatorForSeq2Seq)")
            else:
                logger.warning("[SFT] Dataset missing 'labels' column - old cache format detected")
                logger.warning("[SFT] Training will be on FULL SEQUENCES (not masked) - consider clearing tokenized_cache/")

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

        # Prepare callbacks list
        callbacks = [metrics_callback]
        if param_update_callback:
            callbacks.append(param_update_callback)
        if predictions_callback:
            callbacks.append(predictions_callback)

        # Use custom collator to fix TRL bug where input_ids get cast to float
        # https://github.com/huggingface/trl/issues/4103
        data_collator = IntegerDtypeCollator(tokenizer=self.tokenizer)
        logger.info("[SFT] Using IntegerDtypeCollator to fix TRL dtype bug")

        logger.info("[SFT] Creating SFT trainer")
        trainer = SFTTrainer(
            model=self.model,
            train_dataset=self.train_dataset,
            eval_dataset=self.eval_dataset,
            args=training_args,
            processing_class=self.tokenizer,
            formatting_func=formatting_func,
            data_collator=data_collator,
            callbacks=callbacks
        )

        logger.info("[SFT] Starting training loop")
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        # Check if model uses LoRA (PEFT model)
        use_lora = self.config["training"].get("use_lora", DEFAULT_USE_LORA)

        # CRITICAL: Save LoRA adapters BEFORE merge_and_unload() which destroys them
        # Save LoRA adapters (or full model if no LoRA)
        logger.info("[SFT] Saving final model")
        trainer.save_model()
        self.tokenizer.save_pretrained(self.output_dir)
        if use_lora:
            logger.info(f"[SFT] LoRA adapters saved to {self.output_dir}")
        else:
            logger.info(f"[SFT] Full model saved to {self.output_dir}")

        if use_lora:
            # Merge LoRA adapters with base model for deployment
            # NOTE: This must happen AFTER saving adapters since merge_and_unload() destroys them
            logger.info("[SFT] Training complete, merging LoRA adapters with base model")
            
            try:
                # Move to CPU to avoid VRAM OOM during merge
                logger.info("[SFT] Moving model to CPU for merging...")
                trainer.model.to('cpu')
                
                merged_model = trainer.model.merge_and_unload()

                # Cast to training dtype to preserve precision
                # NOTE: Cannot cast bitsandbytes quantized models - they must be saved/loaded with target dtype
                using_quantization = getattr(self, '_using_quantization', False)
                training_dtype = getattr(self, '_training_dtype', DEFAULT_TORCH_DTYPE)

                if using_quantization:
                    logger.info(f"[SFT] Skipping dtype cast for quantized model - merged model will be saved in its current format")
                    logger.info(f"[SFT] To load with specific dtype, use torch_dtype parameter in from_pretrained()")
                else:
                    target_dtype = getattr(torch, training_dtype)
                    logger.info(f"[SFT] Casting merged model to {training_dtype} for precision preservation")
                    merged_model = merged_model.to(target_dtype)

                # Save merged model to separate directory
                merged_output_dir = self.output_dir / "merged_model"
                merged_output_dir.mkdir(exist_ok=True)
                logger.info(f"[SFT] Saving merged model to {merged_output_dir}")
                merged_model.save_pretrained(str(merged_output_dir), safe_serialization=True)
                self.tokenizer.save_pretrained(str(merged_output_dir))
                if using_quantization:
                    logger.info(f"[SFT] Merged model saved successfully (quantized model - dtype preserved from base)")
                else:
                    logger.info(f"[SFT] Merged model saved successfully with dtype={training_dtype}")

                # Upload merged model to HuggingFace Hub
                hf_token = os.getenv('HF_TOKEN')
                hf_repo_name = os.getenv('HF_REPO_NAME')

                if hf_token and hf_repo_name:
                    try:
                        logger.info(f"[SFT] Uploading merged model to Hugging Face: {hf_repo_name}")
                        api = HfApi()

                        # Create repo if it doesn't exist
                        try:
                            api.create_repo(repo_id=hf_repo_name, token=hf_token, repo_type="model", exist_ok=True)
                        except Exception as repo_err:
                            logger.info(f"[SFT] Repo create note: {repo_err}")

                        # Upload folder to Hub
                        api.upload_folder(
                            folder_path=str(merged_output_dir),
                            repo_id=hf_repo_name,
                            token=hf_token,
                            repo_type="model"
                        )
                        logger.info(f"[SFT] Model successfully uploaded to https://huggingface.co/{hf_repo_name}")
                    except Exception as e:
                        logger.warning(f"[SFT] Failed to upload to HF Hub: {e}")
                else:
                    logger.info("[SFT] Skipping HF Hub upload (no HF_TOKEN or HF_REPO_NAME)")
            
            except Exception as e:
                logger.error(f"[SFT] Failed to merge model: {e}")
                logger.warning("[SFT] Only adapter weights have been saved (in the main output directory)")

    def _train_dpo(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using DPO (Direct Preference Optimization)."""
        logger.info("[DPO] Configuring DPO training")

        use_lora = self.config["training"].get("use_lora", DEFAULT_USE_LORA)
        if not use_lora:
            logger.warning(
                "[DPO] WARNING: Running DPO without LoRA may cause NaN values. "
                "Consider enabling LoRA with 'use_lora': true in your config."
            )

        logger.info("[DPO] Creating preference datasets")
        train_preference_dataset = self._create_preference_dataset(self.train_dataset, "train")
        eval_preference_dataset = self._create_preference_dataset(self.eval_dataset, "eval")
        logger.info(f"[DPO] Train preference dataset size: {len(train_preference_dataset)}")
        logger.info(f"[DPO] Eval preference dataset size: {len(eval_preference_dataset)}")

        # Setup training arguments with gradient clipping
        num_epochs = self.config["training"].get("num_epochs", DEFAULT_NUM_EPOCHS)
        batch_size = self.config["training"].get("batch_size", DEFAULT_BATCH_SIZE)
        learning_rate = self.config["training"].get("learning_rate", DEFAULT_LEARNING_RATE_DPO)

        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = self.config["training"].get("lr_scheduler_type", DEFAULT_LR_SCHEDULER_TYPE)
        warmup_ratio = self.config["training"].get("warmup_ratio")  # Optional, None means use warmup_steps
        save_steps = self.config["training"].get("save_steps", DEFAULT_SAVE_STEPS_DPO)
        save_total_limit = self.config["training"].get("save_total_limit", DEFAULT_SAVE_TOTAL_LIMIT)
        evaluation_strategy = self.config["training"].get("evaluation_strategy", DEFAULT_EVALUATION_STRATEGY_DPO)  # DPO typically doesn't use eval
        eval_steps = self.config["training"].get("eval_steps", DEFAULT_EVAL_STEPS)
        packing = self.config["training"].get("packing", DEFAULT_PACKING)
        
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
        
        progress_file = self.output_dir / PROGRESS_FILENAME
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        # Set dataset info for tokens/sec calculation (Phase 3)
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[DPO] Progress tracking enabled: {progress_file}")

        # Runtime parameter updates callback
        job_id = os.getenv('JOB_ID')
        param_update_callback = None
        if job_id:
            param_update_callback = RuntimeParameterUpdateCallback(
                job_id=job_id,
                check_interval=PARAM_UPDATE_CHECK_INTERVAL
            )
            logger.info(f"[DPO] Runtime parameter updates enabled for job {job_id}")
        else:
            logger.warning("[DPO] No JOB_ID found, runtime parameter updates disabled")

        # Predictions callback (optional)
        predictions_callback = None
        predictions_config = self.config.get("predictions", {})
        dataset_path = self.config.get("dataset_path") or self.config.get("data", {}).get("dataset_path")
        samples_path = predictions_config.get('samples_path')
        logger.info(f"[DPO] predictions config: {predictions_config}")
        logger.info(f"[DPO] predictions.enabled: {predictions_config.get('enabled', False)}")
        logger.info(f"[DPO] dataset_path resolved: {dataset_path or 'NOT SET'}")
        if samples_path:
            logger.info(f"[DPO] predictions.samples_path: {samples_path}")

        if predictions_config.get("enabled", False):
            if predictions_config.get("sample_frequency") == "eval":
                if evaluation_strategy == "no":
                    logger.warning("[DPO] Predictions frequency set to eval but evaluation_strategy is 'no' — predictions will not run")
                if isinstance(eval_preference_dataset, Dataset) and len(eval_preference_dataset) == 0:
                    logger.warning("[DPO] Predictions frequency set to eval but eval dataset is empty — predictions will not run")

            if PREDICTIONS_AVAILABLE and job_id and (dataset_path or samples_path):
                user_id = os.getenv('JOB_USER_ID')
                if user_id:
                    try:
                        predictions_callback = TrainingPredictionsCallback(
                            dataset_path=dataset_path or samples_path,
                            job_id=job_id,
                            user_id=user_id,
                            config=predictions_config
                        )
                        logger.info("[DPO] Predictions tracking enabled")
                    except Exception as e:
                        logger.warning(f"[DPO] Predictions init failed: {e}")
                else:
                    logger.warning("[DPO] Predictions disabled: JOB_USER_ID not set")
            else:
                if not PREDICTIONS_AVAILABLE:
                    logger.warning("[DPO] Predictions skipped: TrainingPredictionsCallback not available")
                if not job_id:
                    logger.warning("[DPO] Predictions skipped: no job_id")
                if not dataset_path and not samples_path:
                    logger.warning("[DPO] Predictions skipped: dataset_path and predictions.samples_path not set")

        # Build DPOConfig with ALL UI-configurable parameters
        training_args = DPOConfig(
            output_dir=str(self.output_dir),
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=self.config["training"].get("eval_batch_size", DEFAULT_EVAL_BATCH_SIZE),
            gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", DEFAULT_GRADIENT_ACCUMULATION_STEPS),
            learning_rate=learning_rate,
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,
            warmup_steps=self.config["training"].get("warmup_steps", DEFAULT_WARMUP_STEPS),

            # Logging and evaluation - UI configurable
            logging_steps=self.config["training"].get("logging_steps", DEFAULT_LOGGING_STEPS),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True if evaluation_strategy != "no" else False,
            metric_for_best_model="eval_loss" if evaluation_strategy != "no" else None,
            greater_is_better=False,

            # Precision and optimization - UI configurable
            optim=self.config["training"].get("optim", DEFAULT_OPTIM_DPO),
            bf16=self.config["training"].get("bf16", DEFAULT_BF16),
            fp16=self.config["training"].get("fp16", DEFAULT_FP16_DPO),
            max_grad_norm=self.config["training"].get("max_grad_norm", DEFAULT_MAX_GRAD_NORM_DPO),
            weight_decay=self.config["training"].get("weight_decay", DEFAULT_WEIGHT_DECAY),

            # Memory optimization - UI configurable
            gradient_checkpointing=self.config["training"].get("gradient_checkpointing", DEFAULT_GRADIENT_CHECKPOINTING),

            # Data loading - UI configurable
            dataloader_num_workers=self.config["training"].get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS),
            dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", DEFAULT_DATALOADER_PREFETCH_FACTOR) if self.config["training"].get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS) > 0 else None,
            dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", DEFAULT_DATALOADER_PIN_MEMORY),
            # DPO uses raw text format (not pre-tokenized), so group_by_length is not supported
            group_by_length=False,

            # DPO-specific
            max_length=self.config["training"].get("max_length", DEFAULT_MAX_LENGTH_DPO),
            remove_unused_columns=False,
            beta=self.config["training"].get("beta", DEFAULT_BETA),

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

        # Prepare callbacks list
        callbacks = [metrics_callback]
        if param_update_callback:
            callbacks.append(param_update_callback)
        if predictions_callback:
            callbacks.append(predictions_callback)

        logger.info("[DPO] Creating DPO trainer")
        trainer = DPOTrainer(
            model=self.model,
            ref_model=None,
            args=training_args,
            train_dataset=train_preference_dataset,
            eval_dataset=eval_preference_dataset,
            processing_class=self.tokenizer,
            callbacks=callbacks
        )

        # Add gradient checkpointing for memory efficiency
        if hasattr(self.model, "gradient_checkpointing_enable"):
            logger.info("[DPO] Enabling gradient checkpointing")
            self.model.gradient_checkpointing_enable()

        logger.info("[DPO] Starting training loop")
        trainer.train(resume_from_checkpoint=resume_from_checkpoint)

        # Check if model uses LoRA (PEFT model)
        use_lora = self.config["training"].get("use_lora", DEFAULT_USE_LORA)

        # CRITICAL: Save LoRA adapters BEFORE merge_and_unload() which destroys them
        # Save LoRA adapters (or full model if no LoRA) to dpo_model directory
        logger.info("[DPO] Saving final model")
        dpo_output_dir = self.output_dir / "dpo_model"
        trainer.save_model(dpo_output_dir)
        if use_lora:
            logger.info(f"[DPO] LoRA adapters saved to {dpo_output_dir}")
        else:
            logger.info(f"[DPO] Full model saved to {dpo_output_dir}")

        if use_lora:
            # Merge LoRA adapters with base model for deployment
            # NOTE: This must happen AFTER saving adapters since merge_and_unload() destroys them
            logger.info("[DPO] Training complete, merging LoRA adapters with base model")
            merged_model = trainer.model.merge_and_unload()

            # Cast to training dtype to preserve precision
            # NOTE: Cannot cast bitsandbytes quantized models - they must be saved/loaded with target dtype
            using_quantization = getattr(self, '_using_quantization', False)
            training_dtype = getattr(self, '_training_dtype', DEFAULT_TORCH_DTYPE)

            if using_quantization:
                logger.info(f"[DPO] Skipping dtype cast for quantized model - merged model will be saved in its current format")
                logger.info(f"[DPO] To load with specific dtype, use torch_dtype parameter in from_pretrained()")
            else:
                target_dtype = getattr(torch, training_dtype)
                logger.info(f"[DPO] Casting merged model to {training_dtype} for precision preservation")
                merged_model = merged_model.to(target_dtype)

            # Save merged model to separate directory
            merged_output_dir = self.output_dir / "dpo_model" / "merged_model"
            merged_output_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"[DPO] Saving merged model to {merged_output_dir}")
            merged_model.save_pretrained(str(merged_output_dir), safe_serialization=True)
            self.tokenizer.save_pretrained(str(merged_output_dir))
            if using_quantization:
                logger.info(f"[DPO] Merged model saved successfully (quantized model - dtype preserved from base)")
            else:
                logger.info(f"[DPO] Merged model saved successfully with dtype={training_dtype}")

            # Upload merged model to HuggingFace Hub
            hf_token = os.getenv('HF_TOKEN')
            hf_repo_name = os.getenv('HF_REPO_NAME')

            if hf_token and hf_repo_name:
                try:
                    logger.info(f"[DPO] Uploading merged model to Hugging Face: {hf_repo_name}")
                    api = HfApi()

                    # Create repo if it doesn't exist
                    try:
                        api.create_repo(repo_id=hf_repo_name, token=hf_token, repo_type="model", exist_ok=True)
                    except Exception as repo_err:
                        logger.info(f"[DPO] Repo create note: {repo_err}")

                    # Upload folder to Hub
                    api.upload_folder(
                        folder_path=str(merged_output_dir),
                        repo_id=hf_repo_name,
                        token=hf_token,
                        repo_type="model"
                    )
                    logger.info(f"[DPO] Model successfully uploaded to https://huggingface.co/{hf_repo_name}")
                except Exception as e:
                    logger.warning(f"[DPO] Failed to upload to HF Hub: {e}")
            else:
                logger.info("[DPO] Skipping HF Hub upload (no HF_TOKEN or HF_REPO_NAME)")

    def _train_rlhf(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using RLHF (Reinforcement Learning from Human Feedback) with PPO."""
        logger.info("[RLHF] Configuring RLHF training with PPO")

        # Extract training configuration
        training_config = self.config["training"]
        num_epochs = training_config.get("num_epochs", DEFAULT_NUM_EPOCHS)
        batch_size = training_config.get("batch_size", DEFAULT_BATCH_SIZE)
        learning_rate = training_config.get("learning_rate", DEFAULT_LEARNING_RATE_PPO)  # Lower LR for PPO stability
        gradient_accumulation_steps = training_config.get("gradient_accumulation_steps", DEFAULT_GRADIENT_ACCUMULATION_STEPS)
        max_length = training_config.get("max_length", DEFAULT_MAX_LENGTH_DPO)

        logger.info(
            f"[RLHF] Config: epochs={num_epochs}, batch={batch_size}, lr={learning_rate}, "
            f"max_length={max_length}"
        )

        # RLHF requires raw text data, not pre-tokenized data
        # Load the original untokenized dataset (local to this method only)
        logger.info("[RLHF] Loading raw untokenized dataset for PPO training")
        dataset_path = self.config.get("dataset_path")
        if not dataset_path:
            raise ValueError("[RLHF] dataset_path not found in config")

        logger.info(f"[RLHF] Loading from: {dataset_path}")
        with open(dataset_path, 'r', encoding='utf-8') as f:
            if dataset_path.endswith('.jsonl'):
                data = [json.loads(line) for line in f if line.strip()]
            else:
                data = json.load(f)

        # Create local raw dataset (does NOT modify self.train_dataset)
        rlhf_raw_dataset = Dataset.from_list(data if isinstance(data, list) else [data])
        logger.info(f"[RLHF] Loaded {len(rlhf_raw_dataset)} raw examples")

        # Setup progress tracking
        progress_file = self.output_dir / PROGRESS_FILENAME
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[RLHF] Progress tracking enabled: {progress_file}")

        # Runtime parameter updates callback
        job_id = os.getenv('JOB_ID')
        param_update_callback = None
        if job_id:
            param_update_callback = RuntimeParameterUpdateCallback(
                job_id=job_id,
                check_interval=PARAM_UPDATE_CHECK_INTERVAL
            )
            logger.info(f"[RLHF] Runtime parameter updates enabled for job {job_id}")
        else:
            logger.warning("[RLHF] No JOB_ID found, runtime parameter updates disabled")

        # Load reward model (same architecture as policy model, but used for scoring)
        model_name = self.config["model"]["name"]
        logger.info(f"[RLHF] Loading reward model: {model_name}")

        # Normalize model path
        normalized_path, local_files_only = self._normalize_model_path(model_name)

        # Use existing model as reward model for MVP (can be replaced with separate model later)
        # In production, you'd load a separately trained reward model here
        reward_model = AutoModelForSequenceClassification.from_pretrained(
            normalized_path,
            num_labels=1,
            torch_dtype=torch.float16 if training_config.get("fp16", DEFAULT_FP16_SFT) else torch.bfloat16 if training_config.get("bf16", DEFAULT_BF16) else torch.float32,
            device_map="auto",
            local_files_only=local_files_only
        )
        reward_model.eval()  # Freeze reward model during PPO training
        logger.info("[RLHF] Reward model loaded and frozen")

        # Load policy model (causal LM for generation)
        logger.info("[RLHF] Loading policy model for PPO")
        model_name = self.config["model"]["name"]
        policy_model = self.model  # Use already loaded model
        logger.info("[RLHF] Policy model loaded")

        # Set tokenizer padding side to left for decoder-only models (required for batch generation)
        original_padding_side = self.tokenizer.padding_side
        self.tokenizer.padding_side = 'left'
        logger.info(f"[RLHF] Set tokenizer padding_side to 'left' (was: {original_padding_side})")

        # Explicitly disable gradient checkpointing on the model to prevent PolicyAndValueWrapper issues
        # TRL's unwrap_model_for_generation checks is_gradient_checkpointing and tries to call
        # gradient_checkpointing_disable() on the wrapper, which doesn't have this method
        if hasattr(policy_model, 'is_gradient_checkpointing') and policy_model.is_gradient_checkpointing:
            logger.info("[RLHF] Model has gradient checkpointing enabled, disabling it for PPO compatibility")
            if hasattr(policy_model, 'gradient_checkpointing_disable'):
                policy_model.gradient_checkpointing_disable()
                logger.info("[RLHF] Gradient checkpointing disabled on policy model")
            else:
                logger.warning("[RLHF] Model doesn't have gradient_checkpointing_disable method")

        # torch.compile already disabled at function start via environment variables

        # Load value model (sequence classification for value estimation)
        logger.info("[RLHF] Loading value model for PPO")
        value_model = AutoModelForSequenceClassification.from_pretrained(
            normalized_path,
            num_labels=1,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
            local_files_only=local_files_only
        )
        logger.info("[RLHF] Value model loaded")

        # Configure PPO parameters
        # Calculate total batches: (dataset_size // batch_size) * num_epochs
        # This will be calculated after we know the dataset size

        ppo_config = PPOConfig(
            output_dir=str(self.output_dir / "rlhf_checkpoints"),
            learning_rate=learning_rate,
            batch_size=batch_size,
            mini_batch_size=max(1, batch_size // PPO_MINI_BATCH_DIVISOR),  # PPO mini-batch size
            gradient_accumulation_steps=gradient_accumulation_steps,
            num_ppo_epochs=training_config.get("ppo_epochs", DEFAULT_PPO_EPOCHS),  # PPO optimization steps
            cliprange=training_config.get("clip_range", DEFAULT_CLIP_RANGE),  # PPO clipping parameter
            cliprange_value=training_config.get("clip_range_value", DEFAULT_CLIP_RANGE_VALUE),  # Value function clipping
            vf_coef=training_config.get("vf_coef", DEFAULT_VF_COEF),  # Value function coefficient
            response_length=training_config.get("response_length", max_length),  # User-configurable response length
            num_total_batches=None,  # Will be set after dataset is prepared
            local_rollout_forward_batch_size=training_config.get("local_rollout_forward_batch_size", batch_size),  # User-configurable generation batch size
            temperature=DEFAULT_TEMPERATURE,
            logging_steps=10,
            save_steps=100,
            gradient_checkpointing=False,  # Disable to prevent PolicyAndValueWrapper issues
        )

        logger.info(
            f"[RLHF] PPO config: num_ppo_epochs={ppo_config.num_ppo_epochs}, "
            f"cliprange={ppo_config.cliprange}, mini_batch_size={ppo_config.mini_batch_size}"
        )

        # Prepare RLHF dataset
        # Expected format: {"prompt": str, "response": str, "reward": float (optional)}
        logger.info("[RLHF] Preparing RLHF dataset for PPO training")
        logger.info(f"[RLHF] Source dataset size: {len(rlhf_raw_dataset)}")
        rlhf_examples = []

        # Convert HuggingFace Dataset to list of examples
        for idx, example in enumerate(rlhf_raw_dataset):
            # Debug: Log first example to understand structure
            if idx == 0:
                logger.info(f"[RLHF] First example keys: {list(example.keys())}")
                logger.info(f"[RLHF] First example: {example}")

            # Handle different dataset formats
            if "prompt" in example and "response" in example:
                # Direct RLHF format
                rlhf_examples.append({
                    "query": example["prompt"],
                    "response": example.get("response", ""),
                    "reward": example.get("reward", 0.0)
                })
            elif "messages" in example and isinstance(example["messages"], list):
                # Normalized messages format - extract prompt and response
                messages = example["messages"]
                prompt = ""
                response = ""

                for msg in messages:
                    if msg.get("role") == "user":
                        prompt = msg.get("content", "")
                    elif msg.get("role") == "assistant":
                        response = msg.get("content", "")

                if prompt:  # Only add if we have at least a prompt
                    rlhf_examples.append({
                        "query": prompt,
                        "response": response,
                        "reward": example.get("reward", 0.0)
                    })
            elif "text" in example:
                # Fallback for text-based datasets
                rlhf_examples.append({
                    "query": example["text"][:max_length // MAX_LENGTH_QUERY_DIVISOR],  # First half as query
                    "response": "",  # Will be generated
                    "reward": 0.0
                })

        logger.info(f"[RLHF] Prepared {len(rlhf_examples)} examples for training")

        # Debug: Log first prepared example
        if rlhf_examples:
            logger.info(f"[RLHF] First prepared example: {rlhf_examples[0]}")
            logger.info(f"[RLHF] Query type: {type(rlhf_examples[0].get('query'))}")

        # Create dataset for PPO
        rlhf_dataset = Dataset.from_list(rlhf_examples)

        # Tokenize queries
        def tokenize_query(example):
            query = example["query"]

            # Ensure query is a string (convert if needed)
            if isinstance(query, list):
                # If it's a list, join it or take first element
                query = " ".join(query) if all(isinstance(q, str) for q in query) else str(query[0]) if query else ""
            elif not isinstance(query, str):
                query = str(query)

            return self.tokenizer(
                query,
                truncation=True,
                max_length=max_length // MAX_LENGTH_QUERY_DIVISOR,  # Reserve space for response
                padding=False
            )

        rlhf_dataset = rlhf_dataset.map(tokenize_query, batched=False)

        # Remove text fields - PPO dataloader only needs tokenized input_ids
        # Keep only: input_ids, attention_mask (remove query, response, reward as they're text)
        columns_to_remove = ["query", "response", "reward"]
        existing_columns = [col for col in columns_to_remove if col in rlhf_dataset.column_names]
        if existing_columns:
            rlhf_dataset = rlhf_dataset.remove_columns(existing_columns)
            logger.info(f"[RLHF] Removed text columns: {existing_columns}")

        logger.info(f"[RLHF] Final dataset columns: {rlhf_dataset.column_names}")

        # Calculate total batches now that we know the dataset size
        total_batches = (len(rlhf_dataset) // batch_size) * num_epochs
        ppo_config.num_total_batches = total_batches
        logger.info(f"[RLHF] Calculated num_total_batches: {total_batches} (dataset_size={len(rlhf_dataset)}, batch_size={batch_size}, epochs={num_epochs})")

        # Initialize PPO Trainer
        logger.info("[RLHF] Creating PPO trainer")
        ppo_trainer = PPOTrainer(
            args=ppo_config,
            processing_class=self.tokenizer,
            model=policy_model,
            ref_model=None,  # Optional: reference model for KL divergence
            reward_model=reward_model,
            train_dataset=rlhf_dataset,
            value_model=value_model,
        )

        # Let PPOTrainer handle the training loop
        # PPOConfig controls generation parameters via response_length, temperature, etc.
        logger.info(f"[RLHF] Starting PPO training")
        logger.info(f"[RLHF] Total batches: {ppo_config.num_total_batches}")
        logger.info(f"[RLHF] Response length: {ppo_config.response_length}")
        logger.info(f"[RLHF] Generation batch size: {ppo_config.local_rollout_forward_batch_size}")
        logger.info(f"[RLHF] Temperature: {ppo_config.temperature}")

        # Run PPO training (handles generation, reward computation, and PPO updates internally)
        ppo_trainer.train()

        # Save trained model
        logger.info("[RLHF] Saving final model")
        rlhf_output_dir = self.output_dir / "rlhf_model"
        ppo_trainer.save_model(str(rlhf_output_dir))
        self.tokenizer.save_pretrained(str(rlhf_output_dir))
        logger.info(f"[RLHF] Model saved to {rlhf_output_dir}")

    def _train_orpo(self, resume_from_checkpoint: Optional[str] = None):
        """Train the model using ORPO (Odds Ratio Preference Optimization)."""
        logger.info("[ORPO] Configuring ORPO training")
        logger.info("[ORPO] ORPO combines SFT + preference alignment in one step (no reference model needed)")

        # Extract training configuration
        training_config = self.config["training"]
        use_lora = training_config.get("use_lora", DEFAULT_USE_LORA)
        num_epochs = training_config.get("num_epochs", DEFAULT_NUM_EPOCHS)
        batch_size = training_config.get("batch_size", DEFAULT_BATCH_SIZE)
        learning_rate = training_config.get("learning_rate", DEFAULT_LEARNING_RATE_ORPO)  # Slightly lower than DPO
        gradient_accumulation_steps = training_config.get("gradient_accumulation_steps", DEFAULT_GRADIENT_ACCUMULATION_STEPS)
        max_length = training_config.get("max_length", DEFAULT_MAX_LENGTH_PPO)
        max_prompt_length = training_config.get("max_prompt_length", DEFAULT_MAX_PROMPT_LENGTH)

        # ORPO-specific parameters
        beta = training_config.get("beta", DEFAULT_BETA)  # Controls relative ratio loss weight
        disable_dropout = training_config.get("disable_dropout", DEFAULT_DISABLE_DROPOUT)

        # NEW PARAMETERS - Read from UI config
        lr_scheduler_type = training_config.get("lr_scheduler_type", DEFAULT_LR_SCHEDULER_TYPE)
        warmup_ratio = training_config.get("warmup_ratio")
        save_steps = training_config.get("save_steps", DEFAULT_SAVE_STEPS_DPO)
        save_total_limit = training_config.get("save_total_limit", DEFAULT_SAVE_TOTAL_LIMIT)
        evaluation_strategy = training_config.get("evaluation_strategy", DEFAULT_EVALUATION_STRATEGY_DPO)
        eval_steps = training_config.get("eval_steps", DEFAULT_EVAL_STEPS)

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
        progress_file = self.output_dir / PROGRESS_FILENAME
        metrics_callback = TrainingMetricsCallback(
            progress_file=progress_file,
            total_epochs=num_epochs
        )
        metrics_callback.set_dataset_info(self.train_dataset, self.eval_dataset)
        logger.info(f"[ORPO] Progress tracking enabled: {progress_file}")

        # Runtime parameter updates callback
        job_id = os.getenv('JOB_ID')
        param_update_callback = None
        if job_id:
            param_update_callback = RuntimeParameterUpdateCallback(
                job_id=job_id,
                check_interval=PARAM_UPDATE_CHECK_INTERVAL
            )
            logger.info(f"[ORPO] Runtime parameter updates enabled for job {job_id}")
        else:
            logger.warning("[ORPO] No JOB_ID found, runtime parameter updates disabled")

        # Predictions callback (optional)
        predictions_callback = None
        predictions_config = self.config.get("predictions", {})
        dataset_path = self.config.get("dataset_path") or self.config.get("data", {}).get("dataset_path")
        samples_path = predictions_config.get('samples_path')
        logger.info(f"[ORPO] predictions config: {predictions_config}")
        logger.info(f"[ORPO] predictions.enabled: {predictions_config.get('enabled', False)}")
        logger.info(f"[ORPO] dataset_path resolved: {dataset_path or 'NOT SET'}")
        if samples_path:
            logger.info(f"[ORPO] predictions.samples_path: {samples_path}")

        if predictions_config.get("enabled", False):
            if predictions_config.get("sample_frequency") == "eval":
                if evaluation_strategy == "no":
                    logger.warning("[ORPO] Predictions frequency set to eval but evaluation_strategy is 'no' — predictions will not run")
                if isinstance(eval_preference_dataset, Dataset) and len(eval_preference_dataset) == 0:
                    logger.warning("[ORPO] Predictions frequency set to eval but eval dataset is empty — predictions will not run")

            if PREDICTIONS_AVAILABLE and job_id and (dataset_path or samples_path):
                user_id = os.getenv('JOB_USER_ID')
                if user_id:
                    try:
                        predictions_callback = TrainingPredictionsCallback(
                            dataset_path=dataset_path or samples_path,
                            job_id=job_id,
                            user_id=user_id,
                            config=predictions_config
                        )
                        logger.info("[ORPO] Predictions tracking enabled")
                    except Exception as e:
                        logger.warning(f"[ORPO] Predictions init failed: {e}")
                else:
                    logger.warning("[ORPO] Predictions disabled: JOB_USER_ID not set")
            else:
                if not PREDICTIONS_AVAILABLE:
                    logger.warning("[ORPO] Predictions skipped: TrainingPredictionsCallback not available")
                if not job_id:
                    logger.warning("[ORPO] Predictions skipped: no job_id")
                if not dataset_path and not samples_path:
                    logger.warning("[ORPO] Predictions skipped: dataset_path and predictions.samples_path not set")

        # Prepare ORPO dataset (same format as DPO: prompt, chosen, rejected)
        logger.info("[ORPO] Creating preference datasets")
        train_preference_dataset = self._create_preference_dataset(self.train_dataset, "train")
        eval_preference_dataset = self._create_preference_dataset(self.eval_dataset, "eval")
        logger.info(f"[ORPO] Train preference dataset size: {len(train_preference_dataset)}")
        logger.info(f"[ORPO] Eval preference dataset size: {len(eval_preference_dataset)}")

        # Build ORPOConfig
        training_args = ORPOConfig(
            output_dir=str(self.output_dir),
            num_train_epochs=num_epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=training_config.get("eval_batch_size", DEFAULT_EVAL_BATCH_SIZE),
            gradient_accumulation_steps=gradient_accumulation_steps,
            learning_rate=learning_rate,
            warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,
            warmup_steps=training_config.get("warmup_steps", DEFAULT_WARMUP_STEPS),

            # Logging and evaluation
            logging_steps=training_config.get("logging_steps", DEFAULT_LOGGING_STEPS),
            eval_strategy=evaluation_strategy,
            eval_steps=eval_steps,

            # Checkpointing
            save_strategy="steps",
            save_steps=save_steps,
            save_total_limit=save_total_limit,
            load_best_model_at_end=True if evaluation_strategy != "no" else False,
            metric_for_best_model="eval_loss" if evaluation_strategy != "no" else None,
            greater_is_better=False,

            # Precision and optimization
            optim=training_config.get("optim", DEFAULT_OPTIM_DPO),
            bf16=training_config.get("bf16", DEFAULT_BF16),
            fp16=training_config.get("fp16", DEFAULT_FP16_DPO),
            max_grad_norm=training_config.get("max_grad_norm", DEFAULT_MAX_GRAD_NORM_SFT),
            weight_decay=training_config.get("weight_decay", DEFAULT_WEIGHT_DECAY),

            # Memory optimization
            gradient_checkpointing=training_config.get("gradient_checkpointing", DEFAULT_GRADIENT_CHECKPOINTING),

            # Data loading
            dataloader_num_workers=training_config.get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS),
            dataloader_prefetch_factor=training_config.get("dataloader_prefetch_factor", DEFAULT_DATALOADER_PREFETCH_FACTOR) if training_config.get("dataloader_num_workers", DEFAULT_DATALOADER_NUM_WORKERS) > 0 else None,
            dataloader_pin_memory=training_config.get("dataloader_pin_memory", DEFAULT_DATALOADER_PIN_MEMORY),
            # ORPO uses raw text format (not pre-tokenized), so group_by_length is not supported
            group_by_length=False,

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

        # Prepare callbacks list
        callbacks = [metrics_callback]
        if param_update_callback:
            callbacks.append(param_update_callback)
        if predictions_callback:
            callbacks.append(predictions_callback)

        logger.info("[ORPO] Creating ORPO trainer")
        trainer = ORPOTrainer(
            model=self.model,
            args=training_args,
            train_dataset=train_preference_dataset,
            eval_dataset=eval_preference_dataset,
            processing_class=self.tokenizer,
            callbacks=callbacks
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

    def _create_preference_dataset(self, dataset, split_name="train") -> Dataset:
        """
        Create preference dataset for DPO/ORPO.

        Supports two modes:
        1. Real DPO format: Uses datasets with prompt/chosen/rejected fields directly
        2. Synthetic generation: Creates preference pairs from text data (legacy)

        Args:
            dataset: The dataset to process (train or eval)
            split_name: Name of the split for logging ("train" or "eval")
        """
        logger.info(f"[DPO] Creating preference dataset for {split_name} split")

        preference_data = []

        # Handle both Dataset and IterableDataset
        if isinstance(dataset, IterableDataset):
            logger.warning(f"[DPO] Streaming datasets not supported for DPO preference creation ({split_name})")
            logger.warning("[DPO] DPO requires random access to dataset, cannot use streaming mode")
            raise ValueError(
                "DPO training does not support streaming datasets. "
                "Please disable use_streaming for DPO training method."
            )

        if len(dataset) == 0:
            raise ValueError(f"[DPO] {split_name.capitalize()} dataset is empty, cannot create preference pairs")

        # Detect dataset format from first example
        first_example = dataset[0]
        dataset_keys = set(first_example.keys())

        # Real DPO format: prompt, chosen, rejected
        has_dpo_format = {'prompt', 'chosen', 'rejected'}.issubset(dataset_keys)
        # Text format for synthetic generation
        has_text_format = 'text' in dataset_keys

        if has_dpo_format:
            logger.info(f"[DPO] Detected REAL DPO format (prompt/chosen/rejected fields) in {split_name} split")
            logger.info("[DPO] Using preference pairs directly from dataset")

            num_samples = len(dataset)  # Use all samples

            for i, example in enumerate(dataset.select(range(num_samples))):
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
            logger.info(f"[DPO] Detected TEXT format in {split_name} split - using SYNTHETIC preference generation")
            logger.warning("[DPO] This is legacy behavior. Consider using real DPO format datasets.")

            num_samples = min(DATASET_SAMPLE_INSPECTION_SIZE, len(dataset))

            for i, example in enumerate(dataset.select(range(num_samples))):
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


def load_config_from_args():
    """
    Load configuration from command-line arguments.
    Only called when script is invoked by training server.
    
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
    logger.info(f"[Config] Loading from: {args.config}")
    try:
        with open(args.config, 'r') as f:
            config = json.load(f)
        logger.info(f"[Config] Loaded successfully")
    except Exception as e:
        logger.error(f"[Config] Failed to load: {str(e)}")
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


    # Split into train and eval
    split_ratio = config.get('eval_split', DEFAULT_EVAL_SPLIT)
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

    For SFT training, this function automatically detects the chat template
    and applies response masking to ensure the model only learns to generate
    responses (not prompts). Prompt tokens are masked with -100 in the labels.

    Args:
        dataset: Raw HuggingFace Dataset with text data
        tokenizer: Tokenizer instance for the model
        formatting_func: Function to format examples to text
        model_name: Model identifier for cache directory naming
        config: Training configuration dictionary
        dataset_type: Type of dataset ('train' or 'eval')

    Returns:
        Dataset: Pre-tokenized dataset with input_ids, attention_mask, and labels columns
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
        "max_length": config.get("training", {}).get("max_length", DEFAULT_MAX_LENGTH_PPO),
        "dataset_path": config.get("dataset_path", ""),
        "masking_version": "v1",  # Invalidate old caches without response masking
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
    max_length = config.get("training", {}).get("max_length", DEFAULT_MAX_LENGTH_PPO)
    logger.info(f"[PreTokenize] Max length: {max_length}")

    # Detect response template for masking (same logic as SFT training)
    response_template = config.get("training", {}).get("response_template")
    
    if not response_template and hasattr(tokenizer, 'chat_template') and tokenizer.chat_template:
        template_str = str(tokenizer.chat_template)
        if "<|start_header_id|>assistant<|end_header_id|>" in template_str:
            response_template = "<|start_header_id|>assistant<|end_header_id|>\n\n"
            logger.info("[PreTokenize] Detected Llama 3 template, will apply response masking")
        elif "<|im_start|>assistant" in template_str:
            response_template = "<|im_start|>assistant\n"
            logger.info("[PreTokenize] Detected ChatML template, will apply response masking")
        elif "[/INST]" in template_str:
            # NOTE: Use without spaces - spaces get absorbed into adjacent tokens during tokenization
            response_template = "[/INST]"
            logger.info("[PreTokenize] Detected Mistral template, will apply response masking")
        elif "<start_of_turn>model" in template_str:
            response_template = "<start_of_turn>model\n"
            logger.info("[PreTokenize] Detected Gemma template, will apply response masking")
        elif "<|assistant|>" in template_str:
            response_template = "<|assistant|>\n"
            logger.info("[PreTokenize] Detected Phi-3/Zephyr template, will apply response masking")
        elif "<|CHATBOT_TOKEN|>" in template_str:
            response_template = "<|CHATBOT_TOKEN|>"
            logger.info("[PreTokenize] Detected Command-R template, will apply response masking")
        elif "### Response:" in template_str:
            response_template = "### Response:"
            logger.info("[PreTokenize] Detected Alpaca/Instruction template, will apply response masking")
        elif "Assistant:" in template_str:
            response_template = "Assistant:"
            logger.info("[PreTokenize] Detected Generic Assistant template, will apply response masking")

    # Check if tokenizer has a chat template
    has_chat_template = hasattr(tokenizer, 'chat_template') and tokenizer.chat_template

    # If no response template and no chat template, use our fallback format's template
    if not response_template and not has_chat_template:
        response_template = "Assistant:"
        logger.info("[PreTokenize] No chat template - using fallback 'Assistant:' response template for masking")

    if response_template:
        logger.info(f"[PreTokenize] Response masking enabled with template: {repr(response_template)}")
    else:
        logger.warning("[PreTokenize] No response template detected - training will be on full sequences")

    def tokenize_example(example):
        """Tokenize a single example and apply response masking if template detected."""
        try:
            # Format the example to text
            if "messages" in example:
                messages = example["messages"]

                if has_chat_template:
                    # Use native chat template
                    result = tokenizer.apply_chat_template(
                        messages,
                        tokenize=True,
                        add_generation_prompt=False,
                        return_dict=True,
                        max_length=max_length,
                        truncation=True
                    )
                else:
                    # Fallback: manually format messages for base models without chat template
                    # Use a simple format: "User: {user_msg}\nAssistant: {assistant_msg}"
                    formatted_text = ""
                    for msg in messages:
                        role = msg.get("role", "user")
                        content = msg.get("content", "")
                        if role == "system":
                            formatted_text += f"System: {content}\n\n"
                        elif role == "user":
                            formatted_text += f"User: {content}\n\n"
                        elif role == "assistant":
                            formatted_text += f"Assistant: {content}\n\n"
                        else:
                            formatted_text += f"{role}: {content}\n\n"

                    result = tokenizer(
                        formatted_text.strip(),
                        max_length=max_length,
                        truncation=True,
                        padding=False,
                        return_tensors=None
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

            # Apply response masking if template detected
            if response_template:
                input_ids = result['input_ids']
                labels = list(input_ids)  # Copy input_ids

                # Encode response template to get token sequence
                response_template_ids = tokenizer.encode(
                    response_template,
                    add_special_tokens=False
                )

                # Search for response template in input_ids
                response_start_idx = None
                n = len(response_template_ids)
                
                # Try exact match
                for i in range(len(input_ids) - n + 1):
                    if input_ids[i:i+n] == response_template_ids:
                        response_start_idx = i + n
                        break
                
                # Fallback: Try matching without the first token (sometimes tokenizer merge issues cause the first token to change)
                if response_start_idx is None and n > 1:
                     for i in range(len(input_ids) - (n-1) + 1):
                        if input_ids[i:i+(n-1)] == response_template_ids[1:]:
                            response_start_idx = i + (n-1)
                            break

                # Mask prompt tokens (set to -100)
                if response_start_idx is not None:
                    for i in range(response_start_idx):
                        labels[i] = -100
                else:
                    # Fallback: no masking if template not found
                    # Training on full sequences is better than zero training signal
                    logger.warning(
                        f"[PreTokenize] Response template not found in tokenized sequence. "
                        f"Training will use FULL SEQUENCE (prompt + response). "
                        f"This may cause model to learn prompt patterns. "
                        f"Template searched: {repr(response_template)}"
                    )
                    labels = list(input_ids)

                result['labels'] = labels
            else:
                # No masking - labels = input_ids (trains on full sequence)
                result['labels'] = list(result['input_ids'])

            return result

        except Exception as e:
            logger.error(f"[PreTokenize] Error tokenizing example: {e}")
            return {"input_ids": [], "attention_mask": [], "labels": []}
    
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
    # CRITICAL: Disable torch.compile BEFORE any torch operations to prevent hanging in RLHF
    import os
    os.environ["TORCH_COMPILE_DISABLE"] = "1"
    os.environ["TORCHDYNAMO_DISABLE"] = "1"

    logger.info("=" * 60)
    logger.info("FineTune Lab Standalone Trainer - Starting")
    logger.info("=" * 60)
    logger.info("[Main] Torch compile disabled via environment variables")
    
    # Load config from command-line arguments (provided by training server)
    config = load_config_from_args()
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

        # Check if resuming from checkpoint
        resume_checkpoint = config.get('resume_from_checkpoint')
        if resume_checkpoint:
            logger.info(f"[Main] Resuming {method.upper()} training from checkpoint: {resume_checkpoint}")
        else:
            logger.info(f"[Main] Starting {method.upper()} training from scratch...")

        # Use the unified train() method with optional checkpoint resume
        trainer.train(resume_from_checkpoint=resume_checkpoint)
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

