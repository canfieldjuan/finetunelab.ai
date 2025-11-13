# FineTune Lab - Local Training Package

This package contains everything you need to fine-tune LLM models locally.

## System Requirements

### Hardware Requirements by Model Size

This package uses **4-bit quantization (QLoRA)** to dramatically reduce memory requirements while maintaining quality.

#### Small Models (0.5B - 3B parameters)
**Examples:** Qwen2.5-0.5B, Qwen2.5-1.5B, Phi-2, StableLM-3B

| GPU | VRAM | Performance | Notes |
|-----|------|-------------|-------|
| **RTX 4060 Ti** | 8GB | ✅ Excellent | Recommended for beginners |
| **RTX 3060** | 12GB | ✅ Excellent | More headroom for batch size |
| **RTX 3090** | 24GB | ✅ Excellent | Can train multiple models simultaneously |
| **A100** | 40GB/80GB | ✅ Excellent | Fastest training, supports larger batches |

**Training Time (1000 samples):** 30-60 minutes
**Recommended Batch Size:** 4-8
**System RAM:** 16GB minimum, 32GB recommended

#### Medium Models (7B - 13B parameters)
**Examples:** Llama-3-8B, Mistral-7B, Qwen2.5-7B, Llama-2-13B

| GPU | VRAM | 4-bit QLoRA | Full Fine-Tune | Notes |
|-----|------|-------------|----------------|-------|
| **RTX 4060 Ti** | 8GB | ✅ Yes | ❌ No | Works great with batch_size=2-4 |
| **RTX 3090** | 24GB | ✅ Yes | ⚠️ Limited | QLoRA recommended, batch_size=8+ |
| **RTX 4090** | 24GB | ✅ Yes | ⚠️ Limited | Faster than 3090, batch_size=8+ |
| **A100** | 40GB | ✅ Yes | ✅ Yes | Can do full fine-tune with small batches |
| **A100** | 80GB | ✅ Yes | ✅ Yes | Full fine-tune with batch_size=4+ |

**Training Time (1000 samples):**
- RTX 4060 Ti: 2-3 hours
- RTX 3090/4090: 1-2 hours
- A100: 45-90 minutes

**Recommended Config for RTX 4060 Ti (8GB):**
```json
{
  "training": {
    "batch_size": 2,
    "gradient_accumulation_steps": 4,
    "use_lora": true,
    "lora_r": 8,
    "max_length": 2048
  }
}
```

**System RAM:** 32GB minimum, 64GB recommended

#### Large Models (30B - 70B parameters)
**Examples:** Llama-3-70B, Qwen2.5-72B, Mixtral-8x7B

| GPU Configuration | Total VRAM | 4-bit QLoRA | Notes |
|-------------------|------------|-------------|-------|
| **Single A100** | 80GB | ✅ Yes | Batch size 1-2, slow but works |
| **2x RTX 3090** | 48GB | ✅ Yes | Requires model parallelism |
| **2x A100** | 160GB | ✅ Yes | Good performance, batch_size=4+ |
| **4x A100** | 320GB | ✅ Yes | Excellent performance, batch_size=8+ |

**Training Time (1000 samples):** 4-12 hours depending on hardware
**System RAM:** 64GB minimum, 128GB+ recommended
**Advanced:** Requires distributed training setup (multi-GPU)

### General System Requirements

#### Operating System
- **Linux**: Ubuntu 20.04+ (recommended), Debian 11+, CentOS 8+
- **Windows**: Windows 10/11 with WSL2 (Ubuntu 22.04 recommended)
- **macOS**: Limited support (M1/M2 Macs use MPS, slower than CUDA)

#### Python Environment
- **Python Version**: 3.9, 3.10, or 3.11
- **Package Manager**: pip (included) or conda
- **Virtual Environment**: Recommended to avoid conflicts

#### CUDA & GPU Drivers
- **CUDA Toolkit**: 11.8 or 12.1
- **cuDNN**: 8.9+ (usually bundled with PyTorch)
- **NVIDIA Drivers**:
  - RTX 40-series: Driver 525+
  - RTX 30-series: Driver 470+
  - A100/H100: Driver 470+

**Check your setup:**
```bash
nvidia-smi  # Check driver version and available GPUs
nvcc --version  # Check CUDA version
python -c "import torch; print(torch.cuda.is_available())"  # Check PyTorch CUDA
```

#### Storage Requirements
- **Base Requirements**: 20GB for dependencies and model cache
- **Per Training Run**:
  - Small models: 5-10GB (checkpoints + output)
  - Medium models: 15-30GB (checkpoints + output)
  - Large models: 50-100GB (checkpoints + output)
- **HuggingFace Cache**: 10-50GB (models download to `~/.cache/huggingface`)

**Recommended:**
- SSD for model storage (10x faster than HDD)
- Separate drive for checkpoints if training multiple models

#### Memory (RAM) Guidelines
- **Minimum**: 16GB (small models only)
- **Recommended**: 32GB (handles most workflows)
- **Professional**: 64GB+ (large models, multiple experiments)
- **Enterprise**: 128GB+ (70B+ models, heavy preprocessing)

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 2. Run Training

```bash
python train.py
```

That's it! The training script will:
1. Load the configuration from `config.json`
2. Load training and evaluation datasets
3. Initialize the model with LoRA adapters
4. Run the training process
5. Save checkpoints and final model to `./output/`

## Configuration

The training is configured via `config.json`. Key parameters:

### Model Configuration
```json
{
  "model": {
    "name": "Qwen/Qwen2.5-0.5B",
    "trust_remote_code": true,
    "torch_dtype": "float16",
    "device_map": "auto"
  }
}
```

### Training Configuration
```json
{
  "training": {
    "method": "sft",              // sft, dpo, or teacher_mode
    "num_epochs": 3,
    "learning_rate": 5e-5,
    "batch_size": 4,
    "use_lora": true,             // Recommended for memory efficiency
    "lora_r": 16,
    "lora_alpha": 32,
    "max_length": 2048
  }
}
```

### Data Configuration
```json
{
  "data": {
    "strategy": "custom",
    "generation_type": "synthetic",
    "max_samples": 1000,
    "train_split": 0.9
  }
}
```

## Training Methods

### SFT (Supervised Fine-Tuning)
Best for: Teaching the model new tasks with labeled examples
```json
{"training": {"method": "sft"}}
```

### DPO (Direct Preference Optimization)
Best for: Aligning model outputs with human preferences
```json
{"training": {"method": "dpo"}}
```

### Teacher Mode
Best for: Self-supervised learning from generated examples
```json
{"training": {"method": "teacher_mode"}}
```

## Monitoring Training

### TensorBoard
If enabled in config, view training metrics in real-time:

```bash
# In a separate terminal
tensorboard --logdir=./output/runs

# Open in browser: http://localhost:6006
```

### Console Logs
Training progress is logged to console with detailed information:
- Model loading status
- Training configuration
- Epoch progress
- Loss values
- Checkpoint saves

## Output Files

After training completes, you'll find:

```
output/
├── checkpoint-500/          # Training checkpoints
├── checkpoint-1000/
├── final_model/             # Final trained model
│   ├── adapter_config.json  # LoRA configuration
│   ├── adapter_model.bin    # LoRA weights
│   └── ...
├── runs/                    # TensorBoard logs
└── trainer_state.json       # Training state
```

## Troubleshooting

### Out of Memory (OOM) Errors

#### For RTX 4060 Ti (8GB) - Most Common

**Error:** `CUDA out of memory. Tried to allocate X GiB`

**Quick Fixes (try in order):**

1. **Reduce batch size to 1**
```json
{
  "training": {
    "batch_size": 1,
    "gradient_accumulation_steps": 8
  }
}
```
This simulates batch_size=8 while using 1/8th the memory.

2. **Lower LoRA rank**
```json
{
  "training": {
    "lora_r": 4,        // Down from 8 or 16
    "lora_alpha": 16    // Keep ratio at 4:1
  }
}
```

3. **Reduce sequence length**
```json
{
  "training": {
    "max_length": 1024  // Down from 2048
  }
}
```

4. **Use smaller model**
- Instead of 7B, try 3B or 1.5B models
- Qwen2.5-0.5B or Qwen2.5-1.5B work great on 8GB

**Ultimate config for limited VRAM:**
```json
{
  "model": {
    "name": "Qwen/Qwen2.5-1.5B"
  },
  "training": {
    "batch_size": 1,
    "gradient_accumulation_steps": 8,
    "use_lora": true,
    "lora_r": 4,
    "lora_alpha": 16,
    "max_length": 1024
  }
}
```

#### For RTX 3090/4090 (24GB)

**You shouldn't see OOM errors with 7B models.** If you do:

1. **Check for other processes using VRAM**
```bash
nvidia-smi  # Look for other Python/CUDA processes
kill -9 <PID>  # Kill them if needed
```

2. **Use smaller batch size for larger models**
```json
{
  "training": {
    "batch_size": 4,  // Instead of 8
    "gradient_accumulation_steps": 2
  }
}
```

#### For A100 (40GB/80GB)

**Rare, but if you hit OOM with large models:**

1. **Check model parallelism settings**
```json
{
  "model": {
    "device_map": "auto"  // Let accelerate handle distribution
  }
}
```

2. **For 70B+ models, reduce batch size**
```json
{
  "training": {
    "batch_size": 1,
    "gradient_accumulation_steps": 16
  }
}
```

### CUDA Not Available

#### Verify CUDA Installation

```bash
# Check if CUDA is detected
python -c "import torch; print(torch.cuda.is_available())"
# Should print: True

# Check CUDA version
python -c "import torch; print(torch.version.cuda)"
# Should print: 11.8 or 12.1

# Check GPU details
nvidia-smi
```

#### Fix: PyTorch Not Built with CUDA

**Uninstall CPU version:**
```bash
pip uninstall torch torchvision torchaudio
```

**Install CUDA version:**
```bash
# For CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For CUDA 12.1
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

#### Fix: CUDA Driver Issues (Windows)

1. Update NVIDIA drivers from [nvidia.com/drivers](https://www.nvidia.com/drivers)
2. Restart computer
3. Verify: `nvidia-smi` shows driver version

#### Fix: WSL2 CUDA Issues (Windows)

**Make sure you're using WSL2, not WSL1:**
```bash
wsl --list --verbose
# Should show VERSION 2
```

**Update WSL kernel:**
```bash
wsl --update
```

**Install NVIDIA drivers on Windows (NOT inside WSL):**
- Download from [nvidia.com](https://www.nvidia.com/drivers)
- CUDA toolkit will be available in WSL automatically

### Import Errors

#### Error: `ModuleNotFoundError: No module named 'peft'`

**Solution:**
```bash
pip install -r requirements.txt --upgrade
```

#### Error: `ImportError: cannot import name 'BitsAndBytesConfig'`

**Solution - Update transformers:**
```bash
pip install transformers>=4.36.0 --upgrade
```

#### Error: `ImportError: libnvidia-ml.so.1: cannot open shared object file`

**Solution - Reinstall NVIDIA drivers:**
```bash
# Ubuntu/Debian
sudo apt-get install --reinstall nvidia-driver-525

# Or update to latest
sudo ubuntu-drivers autoinstall
```

### Training Loss Not Decreasing

#### Diagnosis: Check Learning Rate

**Too high:** Loss explodes or stays constant
```json
{"training": {"learning_rate": 1e-5}}  // Lower from 5e-5
```

**Too low:** Loss decreases very slowly
```json
{"training": {"learning_rate": 1e-4}}  // Increase from 5e-5
```

#### Diagnosis: Check Dataset Quality

```bash
# View first 5 examples
head -n 5 train_dataset.jsonl | jq .

# Check dataset size
wc -l train_dataset.jsonl
# Should be at least 100 examples for good results
```

**Common issues:**
- **Too few samples:** Need 500+ for good fine-tuning
- **Malformed JSON:** Use `jq` to validate each line
- **Wrong format:** Check that dataset matches expected schema

#### Diagnosis: Model Not Learning

**Try these configs:**

**For better convergence:**
```json
{
  "training": {
    "num_epochs": 5,           // More epochs
    "warmup_steps": 500,        // Longer warmup
    "learning_rate": 2e-5,      // Slightly lower LR
    "max_length": 512           // Shorter sequences = faster learning
  }
}
```

### bitsandbytes Errors (Windows)

#### Error: `The operator 'aten::_histc.out' is not currently implemented for the MPS device`

**Solution - Windows doesn't support MPS, use CUDA:**
```json
{
  "model": {
    "device_map": "cuda"  // Explicit CUDA device
  }
}
```

#### Error: `Couldn't find libbitsandbytes_cpu.so`

**Solution - Reinstall bitsandbytes:**
```bash
pip uninstall bitsandbytes
pip install bitsandbytes>=0.41.0 --no-cache-dir
```

**If still failing (Windows-specific):**
```bash
# Use pre-compiled wheels
pip install bitsandbytes-windows
```

### Performance Issues

#### Training is Very Slow

**Expected speeds (7B model, 1000 samples):**
- RTX 4060 Ti (8GB): 2-3 hours
- RTX 3090 (24GB): 1-2 hours
- A100 (80GB): 45-90 minutes

**If much slower:**

1. **Check GPU utilization**
```bash
watch -n 1 nvidia-smi
# GPU-Util should be 90-100% during training
```

2. **Verify you're using GPU, not CPU**
```bash
# During training, check logs for:
# [Model] Loading ... device_map=auto
# Should NOT say "device_map=cpu"
```

3. **Check dataloader bottleneck**
```json
{
  "training": {
    "dataloader_num_workers": 4  // Add this if missing
  }
}
```

4. **Disable TensorBoard if enabled**
```json
{
  "tensorboard": {
    "enabled": false  // Saves 5-10% training time
  }
}
```

#### Checkpoints Taking Too Long to Save

**Solution - Reduce checkpoint frequency:**
```json
{
  "training": {
    "save_steps": 1000,      // Instead of 500
    "save_total_limit": 2    // Keep fewer checkpoints
  }
}
```

### Multi-GPU Issues

#### GPUs Not Detected

```bash
# Check all GPUs are visible
nvidia-smi --list-gpus

# Set which GPUs to use
export CUDA_VISIBLE_DEVICES=0,1  # Use GPUs 0 and 1
python train.py
```

#### Unbalanced GPU Usage

**Solution - Use accelerate:**
```bash
pip install accelerate -U

# Configure multi-GPU
accelerate config

# Run with accelerate
accelerate launch train.py
```

## Infrastructure Options

### Local Training (This Package)

**Pros:**
- ✅ Full control over hardware and configs
- ✅ No ongoing costs (one-time GPU purchase)
- ✅ Privacy - data never leaves your machine
- ✅ Fast iteration - no upload/download delays
- ✅ Can train offline

**Cons:**
- ❌ Upfront hardware cost ($400-$2000+)
- ❌ Limited by single machine resources
- ❌ Maintenance and setup required
- ❌ Electricity costs

**Best For:**
- Frequent training runs
- Sensitive data
- Experimentation and iteration
- Learning and development

**Recommended Setup:**
| Budget | GPU | Use Case |
|--------|-----|----------|
| **Entry ($500)** | RTX 4060 Ti 8GB | Small models (0.5B-3B), learning |
| **Mid ($800)** | RTX 4070 Ti 12GB | Medium models (7B), prototyping |
| **Pro ($1500)** | RTX 4090 24GB | Medium-large models, production |
| **Enterprise ($5000+)** | A100 40GB/80GB | Large models, heavy workloads |

### Cloud Training (Alternative)

#### Google Colab

**Free Tier:**
- GPU: T4 (16GB VRAM)
- Runtime: 12 hours max
- Cost: Free
- Best for: Small models, quick tests

**Colab Pro ($10/month):**
- GPU: T4/V100/A100 (varies)
- Runtime: 24 hours max
- Cost: $10/month
- Best for: Medium models, frequent use

**Colab Pro+ ($50/month):**
- GPU: V100/A100 guaranteed
- Runtime: Longer sessions
- Cost: $50/month
- Best for: Large models, serious work

```python
# Use with cloud mode in web UI
# Click "Cloud Training" tab instead of "Local Training"
```

#### Vast.ai / RunPod / Lambda Labs

**On-Demand GPU Rental:**
- RTX 4090: $0.30-0.50/hour
- A100 40GB: $1.00-1.50/hour
- A100 80GB: $2.00-3.00/hour

**Cost Comparison (1000 samples):**
| GPU | Training Time | Cost |
|-----|---------------|------|
| RTX 4090 | 1 hour | $0.40 |
| A100 40GB | 45 min | $1.00 |
| Own RTX 4060 Ti | 2 hours | $0.20 electricity |

**Best For:**
- Occasional training
- Large models beyond your hardware
- Testing before buying GPU

#### AWS/Azure/GCP

**Enterprise Cloud Options:**
- AWS: EC2 g5.xlarge (A10G), p4d (A100)
- Azure: NC-series (V100/A100)
- GCP: A2-series (A100)

**Cost:** $1-10+ per hour depending on instance

**Best For:**
- Enterprise deployments
- Integration with existing cloud infrastructure
- Compliance requirements

### Hybrid Approach (Recommended)

**Strategy:** Own a mid-tier GPU for most work, rent high-end for large models

**Example Setup:**
- **Local:** RTX 4060 Ti ($400) for 90% of training (small-medium models)
- **Cloud:** Rent A100 for occasional large model training
- **Total Cost:** Much lower than owning A100 ($10,000+)

**Monthly Breakdown:**
- GPU purchase amortized: $20/month (24-month life)
- Electricity: $10/month (training 40 hours)
- Cloud rentals: $10/month (2-3 large model runs)
- **Total:** $40/month vs $50+ pure cloud

## Advanced Configuration

### Multi-GPU Training

Use `CUDA_VISIBLE_DEVICES` to select GPUs:
```bash
CUDA_VISIBLE_DEVICES=0,1 python train.py
```

### Resume from Checkpoint

Training automatically saves checkpoints. To resume:
```bash
# The train.py script will detect and resume from latest checkpoint
python train.py
```

### Custom Tokenizer

Modify tokenizer configuration:
```json
{
  "tokenizer": {
    "name": "Qwen/Qwen2.5-0.5B",
    "trust_remote_code": true,
    "padding_side": "left"
  }
}
```

## Performance Tips

1. **Use LoRA** - Reduces memory usage by 3-4x
2. **Enable bf16** - Faster training on Ampere GPUs (RTX 30xx, A100)
3. **Batch size** - Maximize without OOM for better GPU utilization
4. **Gradient accumulation** - Simulate larger batches with limited memory

## Support

For issues or questions:
- Documentation: https://finetune-lab.dev/docs
- GitHub Issues: https://github.com/finetune-lab/issues
- Community: https://discord.gg/finetune-lab

## License

MIT License - See LICENSE file for details
