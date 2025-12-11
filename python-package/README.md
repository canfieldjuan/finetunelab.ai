# FineTune Lab Loader

Load training configurations and datasets from FineTune Lab for seamless LLM fine-tuning on HuggingFace Spaces, Google Colab, and Kaggle.

## Installation

```bash
pip install finetune-lab-loader
```

## Quick Start

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

## Requirements

- Python 3.8+
- PyTorch 2.0+
- HuggingFace Transformers
- CUDA-capable GPU (recommended)

## License

MIT License
