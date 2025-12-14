"""
Training Predictions Callback

Generates model predictions on sample prompts during training.
Integrates with HuggingFace Trainer via TrainerCallback.
"""
import os
import logging
from pathlib import Path
from transformers import TrainerCallback, TrainerControl, TrainerState
from transformers.training_args import TrainingArguments

logger = logging.getLogger(__name__)


class TrainingPredictionsCallback(TrainerCallback):
    """Callback to generate and save predictions during training"""

    def __init__(self, dataset_path, job_id, user_id, config):
        """
        Initialize predictions callback

        Args:
            dataset_path: Path to training dataset
            job_id: Training job ID
            user_id: User ID
            config: Predictions configuration dict
        """
        self.dataset_path = dataset_path
        self.job_id = job_id
        self.user_id = user_id
        self.config = config

        self.enabled = config.get('enabled', False)
        if not self.enabled:
            logger.info('[PredictionsCallback] Disabled - skipping')
            return

        self.sample_count = config.get('sample_count', 5)
        self.frequency = config.get('sample_frequency', 'epoch')
        self.step_interval = config.get('step_interval', 10)

        self.samples = None
        self.sampler = None
        self.generator = None
        self.writer = None
        self.model = None
        self.tokenizer = None

        logger.info(
            f'[PredictionsCallback] Initialized: {self.sample_count} samples, '
            f'frequency={self.frequency}'
        )

    def on_train_begin(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Load samples when training begins"""
        logger.info(f'[PredictionsCallback] on_train_begin called - enabled: {self.enabled}')

        if not self.enabled:
            logger.info('[PredictionsCallback] on_train_begin - skipping (disabled)')
            return

        try:
            # Store model and tokenizer references
            # HuggingFace passes 'processing_class' (tokenizer) not 'tokenizer'
            self.model = kwargs.get('model')
            self.tokenizer = kwargs.get('processing_class') or kwargs.get('tokenizer')

            logger.info(f'[PredictionsCallback] on_train_begin - model: {bool(self.model)}, tokenizer: {bool(self.tokenizer)}')
            logger.info(f'[PredictionsCallback] on_train_begin - available kwargs: {list(kwargs.keys())}')

            from lib.training.predictions_sampler import PredictionsSampler
            from lib.training.predictions_generator import PredictionsGenerator
            from lib.training.predictions_writer import PredictionsWriter

            self.sampler = PredictionsSampler(random_seed=42)
            samples_path = self.config.get('samples_path') or self.dataset_path
            sample_source = 'prediction_set' if self.config.get('samples_path') else 'dataset'
            samples = self.sampler.load_samples(
                samples_path,
                self.sample_count,
                sample_source=sample_source,
                sample_source_id=os.path.basename(samples_path) if samples_path else None
            )

            if not samples:
                logger.warning('[PredictionsCallback] No samples loaded')
                self.enabled = False
                return

            self.samples = samples
            # Attach config for optional validators (kept out of DB prompt_id)
            try:
                for s in self.samples:
                    if isinstance(s, dict):
                        s['predictions_config'] = self.config
            except Exception:
                pass
            self.generator = PredictionsGenerator()
            self.writer = PredictionsWriter()

            logger.info(
                f'[PredictionsCallback] Loaded {len(samples)} samples'
            )

        except Exception as e:
            logger.error(f'[PredictionsCallback] Init failed: {e}')
            self.enabled = False

    def on_epoch_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Generate predictions at end of each epoch"""
        logger.info(f'[PredictionsCallback] on_epoch_end called - enabled={self.enabled}, frequency={self.frequency}')
        if not self.enabled or self.frequency != 'epoch':
            logger.info(f'[PredictionsCallback] on_epoch_end skipped (frequency={self.frequency}, need "epoch")')
            return

        self._generate_predictions(state, **kwargs)

    def on_evaluate(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Generate predictions during evaluation steps"""
        logger.info(f'[PredictionsCallback] on_evaluate called - enabled={self.enabled}, frequency={self.frequency}')
        if not self.enabled or self.frequency != 'eval':
            logger.info(f'[PredictionsCallback] on_evaluate skipped (frequency={self.frequency}, need "eval")')
            return

        logger.info(f'[PredictionsCallback] on_evaluate generating predictions, kwargs keys: {list(kwargs.keys())}')
        self._generate_predictions(state, **kwargs)

    def on_step_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs
    ):
        """Generate predictions at specific step intervals"""
        if not self.enabled or self.frequency != 'steps':
            return

        if state.global_step % self.step_interval == 0:
            logger.info(f'[PredictionsCallback] on_step_end generating at step {state.global_step}')
            self._generate_predictions(state, **kwargs)

    def _generate_predictions(self, state: TrainerState, **kwargs):
        """Generate and save predictions"""
        if not self.samples or not self.generator or not self.writer:
            return

        try:
            # Try to get model/tokenizer from kwargs first (for eval callbacks)
            # Fall back to stored references if not in kwargs
            # HuggingFace passes 'processing_class' not 'tokenizer'
            model = kwargs.get('model') or self.model
            tokenizer = kwargs.get('processing_class') or kwargs.get('tokenizer') or self.tokenizer

            if not model or not tokenizer:
                logger.warning('[PredictionsCallback] Model/tokenizer missing')
                logger.debug(f'[PredictionsCallback] Debug: model={bool(model)}, tokenizer={bool(tokenizer)}, '
                            f'kwargs_model={bool(kwargs.get("model"))}, '
                            f'stored_model={bool(self.model)}')
                return

            current_epoch = int(state.epoch) if state.epoch else 0
            current_step = state.global_step

            logger.info(
                f'[PredictionsCallback] Generating {len(self.samples)} '
                f'predictions at epoch {current_epoch}, step {current_step}'
            )

            predictions = self.generator.generate_predictions(
                model,
                tokenizer,
                self.samples,
                current_epoch,
                current_step
            )

            if predictions:
                success, errors = self.writer.write_predictions(
                    predictions,
                    self.job_id,
                    self.user_id
                )
                logger.info(
                    f'[PredictionsCallback] Saved {success} predictions '
                    f'({errors} errors)'
                )

        except Exception as e:
            logger.error(f'[PredictionsCallback] Generation failed: {e}')
