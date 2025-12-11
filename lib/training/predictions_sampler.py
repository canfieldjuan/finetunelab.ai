"""
Predictions Dataset Sampler

Randomly samples prompts from training dataset for prediction tracking.
Samples are stored for consistency across epochs.
"""
import random
import json
import gzip


class PredictionsSampler:
    """Handles sampling of prompts for predictions"""

    def __init__(self, random_seed=None):
        """
        Initialize sampler

        Args:
            random_seed: Optional seed for reproducibility
        """
        self.samples = []
        self.random_seed = random_seed
        if random_seed is not None:
            random.seed(random_seed)

    def load_samples(self, dataset_path, sample_count):
        """
        Load random samples from dataset

        Args:
            dataset_path: Path to training dataset
            sample_count: Number of samples to select

        Returns:
            list: Sampled prompts with ground truth
        """
        samples = []

        try:
            # Handle gzip compressed files
            if dataset_path.endswith('.gz'):
                file_opener = lambda p: gzip.open(p, 'rt', encoding='utf-8')
            else:
                file_opener = lambda p: open(p, 'r', encoding='utf-8')

            with file_opener(dataset_path) as f:
                # Detect format: JSON array vs JSONL
                first_char = f.read(1)
                while first_char and first_char.isspace():
                    first_char = f.read(1)
                f.seek(0)

                if first_char == '[':
                    # JSON array
                    try:
                        data = json.load(f)
                    except json.JSONDecodeError as e:
                        print(f'Error loading JSON array dataset: {e}')
                        return []

                    if not isinstance(data, list):
                        print('Error loading dataset: expected list in JSON array file')
                        return []

                    if len(data) < sample_count:
                        sample_count = len(data)

                    sampled_items = random.sample(data, sample_count) if data else []

                    for idx, item in enumerate(sampled_items):
                        sample = {
                            'index': idx,
                            'prompt': self._extract_prompt(item),
                            'ground_truth': self._extract_ground_truth(item),
                            'messages': item.get('messages') if 'messages' in item else None
                        }
                        samples.append(sample)
                else:
                    # JSONL
                    lines = f.readlines()

                    if len(lines) < sample_count:
                        sample_count = len(lines)

                    sampled_lines = random.sample(lines, sample_count) if lines else []

                    for idx, line in enumerate(sampled_lines):
                        try:
                            data = json.loads(line.strip())
                            sample = {
                                'index': idx,
                                'prompt': self._extract_prompt(data),
                                'ground_truth': self._extract_ground_truth(data),
                                'messages': data.get('messages') if 'messages' in data else None
                            }
                            samples.append(sample)
                        except (json.JSONDecodeError, KeyError):
                            continue

        except (IOError, FileNotFoundError) as e:
            print(f'Error loading dataset: {e}')
            return []

        self.samples = samples
        return samples

    def _extract_prompt(self, data):
        """Extract prompt from dataset entry"""
        if 'messages' in data and len(data['messages']) > 0:
            return data['messages'][0].get('content', '')

        if 'prompt' in data:
            return data['prompt']

        if 'input' in data:
            return data['input']

        return str(data)

    def _extract_ground_truth(self, data):
        """Extract expected output from dataset entry"""
        if 'messages' in data and len(data['messages']) > 1:
            return data['messages'][-1].get('content', '')

        if 'completion' in data:
            return data['completion']

        if 'output' in data:
            return data['output']

        if 'response' in data:
            return data['response']

        return None

    def get_samples(self):
        """Return loaded samples"""
        return self.samples
