"""
Predictions Dataset Sampler

Randomly samples prompts from training dataset for prediction tracking.
Samples are stored for consistency across epochs.
"""
import random
import json
import gzip
import hashlib


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

    def load_samples(self, dataset_path, sample_count, sample_source=None, sample_source_id=None):
        """
        Load random samples from dataset

        Args:
            dataset_path: Path to training dataset
            sample_count: Number of samples to select

        Returns:
            list: Sampled prompts with ground truth
        """
        samples = []

        if sample_source is None:
            sample_source = 'dataset'
        if sample_source_id is None and isinstance(dataset_path, str):
            try:
                sample_source_id = dataset_path.split('/')[-1]
            except Exception:
                sample_source_id = None

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

                    # Sample by original indices to preserve a stable source_index
                    sampled_indices = random.sample(range(len(data)), sample_count) if data else []

                    for idx, source_index in enumerate(sampled_indices):
                        item = data[source_index]
                        prompt = self._extract_prompt(item)
                        ground_truth = self._extract_ground_truth(item)
                        messages = item.get('messages') if 'messages' in item else None

                        sample = {
                            # sample_index for UI/ordering within this run
                            'index': idx,
                            # stable-ish identifier within the source dataset
                            'source_index': int(source_index),
                            'sample_source': sample_source,
                            'sample_source_id': sample_source_id,
                            'prompt': prompt,
                            'ground_truth': ground_truth,
                            'messages': messages,
                            # stable prompt identity for cross-run comparisons
                            'prompt_id': self._compute_prompt_id(prompt, messages)
                        }
                        samples.append(sample)
                else:
                    # JSONL
                    lines = f.readlines()

                    if len(lines) < sample_count:
                        sample_count = len(lines)

                    # Sample by line number to preserve stable source_index
                    sampled_indices = random.sample(range(len(lines)), sample_count) if lines else []

                    for idx, line_index in enumerate(sampled_indices):
                        try:
                            data = json.loads(lines[line_index].strip())
                            prompt = self._extract_prompt(data)
                            ground_truth = self._extract_ground_truth(data)
                            messages = data.get('messages') if 'messages' in data else None
                            sample = {
                                'index': idx,
                                'source_index': int(line_index),
                                'sample_source': sample_source,
                                'sample_source_id': sample_source_id,
                                'prompt': prompt,
                                'ground_truth': ground_truth,
                                'messages': messages,
                                'prompt_id': self._compute_prompt_id(prompt, messages)
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

    def _compute_prompt_id(self, prompt, messages):
        """Compute a stable prompt id for cross-run comparisons.

        Uses messages (if present) else prompt text. This intentionally excludes
        ground truth so the id reflects the prompt/question identity.
        """
        if messages is not None:
            try:
                canonical = json.dumps(messages, ensure_ascii=False, sort_keys=True)
            except Exception:
                canonical = str(messages)
        else:
            canonical = prompt or ''

        return hashlib.sha256(canonical.encode('utf-8', errors='ignore')).hexdigest()

    def get_samples(self):
        """Return loaded samples"""
        return self.samples
