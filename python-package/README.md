# FineTune Lab SDK

Python SDK for FineTune Lab - Training, inference, batch testing, and analytics for LLMs.

## Installation

```bash
# API client only (lightweight)
pip install finetune-lab

# With training dependencies (requires GPU)
pip install finetune-lab[training]
```

## Quick Start - API Client

```python
from finetune_lab import FinetuneLabClient

client = FinetuneLabClient(api_key="wak_your_api_key_here")
# Or set FINETUNE_LAB_API_KEY environment variable

# Inference
response = client.predict(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.content)

# Batch Testing
test = client.batch_test.run(
    model_id="gpt-4",
    test_suite_id="suite_abc123"
)
print(f"Test started: {test.test_id}")

# Check status
status = client.batch_test.status(test.test_id)
print(f"Progress: {status.completed}/{status.total_prompts}")
```

## Training (Requires GPU)

### Supervised Fine-Tuning (SFT)

```python
from finetune_lab import train_sft

# Just paste your config ID
train_sft("train_abc123")
```

### Direct Preference Optimization (DPO)

```python
from finetune_lab import train_dpo

train_dpo("train_xyz456")
```

### RLHF Training

```python
from finetune_lab import train_rlhf

train_rlhf("train_def789")
```

## How It Works

1. Upload your dataset in FineTune Lab
2. Configure training parameters (or use templates)
3. Click "Generate Training Package"
4. Get your config ID (e.g., `train_abc123`)
5. Paste the 2-line snippet in HF Spaces/Colab/Kaggle
6. Training starts automatically!

## Features

- Automatic config and dataset loading from public API
- Pre-built training scripts for SFT, DPO, and RLHF
- Support for ChatML and ShareGPT dataset formats
- LoRA-enabled parameter-efficient fine-tuning
- Compatible with HuggingFace Transformers ecosystem

## API Key Scopes

Your API key must have the appropriate scope for each operation:

| Operation | Required Scope |
|-----------|---------------|
| `predict()` | `production` or `all` |
| `batch_test.*` | `testing` or `all` |
| `analytics.*` | `production` or `all` |

## Requirements

**API Client only (lightweight):**
- Python 3.8+
- requests

**Training (full dependencies):**
- Python 3.8+
- PyTorch 2.0+
- HuggingFace Transformers
- CUDA-capable GPU (recommended)

## License

MIT License
