"""
Predictions Configuration Loader

Loads configuration from environment variables for training predictions.
All values are configurable - no hardcoded defaults.
"""
import os


class PredictionsConfig:
    """Configuration for training predictions feature"""

    def __init__(self):
        """Load configuration from environment variables"""
        self.enabled = self._parse_bool(
            os.getenv('PREDICTIONS_ENABLED', 'false')
        )
        self.default_sample_count = self._parse_int(
            os.getenv('PREDICTIONS_DEFAULT_SAMPLE_COUNT', '5')
        )
        self.max_sample_count = self._parse_int(
            os.getenv('PREDICTIONS_MAX_SAMPLE_COUNT', '100')
        )
        self.default_frequency = os.getenv(
            'PREDICTIONS_DEFAULT_FREQUENCY',
            'epoch'
        )
        self.min_step_interval = self._parse_int(
            os.getenv('PREDICTIONS_MIN_STEP_INTERVAL', '10')
        )

    @staticmethod
    def _parse_bool(value):
        """Parse boolean from string"""
        return value.lower() in ('true', '1', 'yes')

    @staticmethod
    def _parse_int(value):
        """Parse integer from string"""
        try:
            return int(value)
        except (ValueError, TypeError):
            return 0

    def validate_user_config(self, user_config):
        """
        Validate user configuration against system limits

        Args:
            user_config: dict with user preferences

        Returns:
            tuple: (is_valid, errors, normalized_config)
        """
        errors = []

        if not isinstance(user_config, dict):
            return False, ['Configuration must be a dictionary'], None

        enabled = user_config.get('enabled', self.enabled)
        if not enabled:
            return True, [], {
                'enabled': False,
                'sample_count': 0,
                'sample_frequency': self.default_frequency
            }

        sample_count = user_config.get(
            'sample_count',
            self.default_sample_count
        )

        if not isinstance(sample_count, int) or sample_count < 1:
            errors.append('Sample count must be positive integer')

        if sample_count > self.max_sample_count:
            errors.append(
                f'Sample count exceeds limit of {self.max_sample_count}'
            )

        frequency = user_config.get(
            'sample_frequency',
            self.default_frequency
        )

        samples_path = user_config.get('samples_path')
        if samples_path is not None and not isinstance(samples_path, str):
            errors.append('samples_path must be a string when provided')

        validators = user_config.get('validators')
        if validators is not None and not isinstance(validators, dict):
            errors.append('validators must be a dictionary when provided')

        if frequency not in ('epoch', 'eval', 'steps'):
            errors.append('Frequency must be "epoch", "eval", or "steps"')

        step_interval = user_config.get('step_interval')
        if frequency == 'steps':
            if not isinstance(step_interval, int):
                errors.append('Step interval required for steps frequency')
            elif step_interval < self.min_step_interval:
                errors.append(
                    f'Step interval must be at least {self.min_step_interval}'
                )

        if errors:
            return False, errors, None

        config = {
            'enabled': True,
            'sample_count': sample_count,
            'sample_frequency': frequency
        }

        if isinstance(samples_path, str) and samples_path.strip():
            config['samples_path'] = samples_path

        if isinstance(validators, dict) and validators:
            v = {}
            if 'json_parse' in validators:
                v['json_parse'] = bool(validators.get('json_parse'))
            if 'json_schema_path' in validators and isinstance(validators.get('json_schema_path'), str) and validators.get('json_schema_path').strip():
                v['json_schema_path'] = validators.get('json_schema_path')
            if v:
                config['validators'] = v

        if frequency == 'steps' and step_interval:
            config['step_interval'] = step_interval

        return True, [], config
