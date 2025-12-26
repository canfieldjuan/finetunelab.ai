# Quick Start Guide

## Prerequisites

- Python 3.10 or higher
- NVIDIA GPU with CUDA support (recommended)
- 16GB+ RAM
- 50GB+ free disk space

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/finetunelab/training-agent.git
cd training-agent
```

### 2. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your settings
```

**Required Settings:**
- `BACKEND_URL`: Your FineTune Lab instance URL
- `API_KEY`: Worker API key (get from FineTune Lab dashboard)

### 5. Verify GPU (Optional but Recommended)

```bash
python -c "import torch; print(f'CUDA Available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')"
```

## Running the Agent

### Start the Agent

```bash
python -m src.main
```

You should see output like:
```
============================================================
FineTune Lab Training Agent Starting
============================================================
Backend URL: https://app.finetunelab.ai
Server: 0.0.0.0:8000
GPU Available: NVIDIA GeForce RTX 3090
Total GPU Memory: 24.0 GB
CUDA Version: 11.8
============================================================
Training Agent Ready
============================================================
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Verify Agent is Running

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "ok",
  "gpu_available": true,
  "gpu_info": {
    "name": "NVIDIA GeForce RTX 3090",
    "total_memory_gb": 24.0,
    "cuda_version": "11.8",
    "device_count": 1
  },
  "active_jobs": 0
}
```

## Using the Agent

### From FineTune Lab Web Interface

1. Go to your FineTune Lab dashboard
2. Navigate to **Training** section
3. Create a new training configuration
4. Select **Local Training** as deployment target
5. Ensure agent URL is `http://localhost:8000`
6. Click **Start Training**
7. Monitor progress in real-time

### Manual API Testing

#### Start a Training Job

```bash
curl -X POST http://localhost:8000/api/training/execute \
  -H "Content-Type: application/json" \
  -d '{
    "execution_id": "test-job-001",
    "name": "Test Training",
    "user_id": "user_123",
    "access_token": "your_token",
    "dataset_path": "/path/to/dataset",
    "config": {
      "model": {
        "name": "gpt2"
      },
      "tokenizer": {
        "name": "gpt2"
      },
      "training": {
        "num_train_epochs": 3,
        "per_device_train_batch_size": 4,
        "learning_rate": 2e-5
      },
      "data": {}
    }
  }'
```

#### Check Job Status

```bash
curl http://localhost:8000/api/training/status/test-job-001
```

#### Pause Training

```bash
curl -X POST http://localhost:8000/api/training/pause/test-job-001
```

#### Resume Training

```bash
curl -X POST http://localhost:8000/api/training/resume/test-job-001
```

#### Cancel Training

```bash
curl -X POST http://localhost:8000/api/training/cancel/test-job-001
```

## Troubleshooting

### GPU Not Detected

**Problem:** Agent shows "No CUDA devices found"

**Solutions:**
1. Verify NVIDIA drivers installed: `nvidia-smi`
2. Check PyTorch CUDA version matches your CUDA: `python -c "import torch; print(torch.version.cuda)"`
3. Reinstall PyTorch with CUDA support:
   ```bash
   pip install torch --index-url https://download.pytorch.org/whl/cu118
   ```

### Out of Memory Errors

**Problem:** Training fails with CUDA OOM error

**Solutions:**
1. Reduce batch size in training config
2. Enable gradient checkpointing
3. Reduce `GPU_MEMORY_FRACTION` in .env
4. Use smaller model or quantization

### Connection Refused

**Problem:** Cannot connect to agent at localhost:8000

**Solutions:**
1. Check agent is running: `ps aux | grep python`
2. Check port not in use: `lsof -i :8000`
3. Check firewall settings
4. Try different port in .env

### Import Errors

**Problem:** ModuleNotFoundError when starting agent

**Solutions:**
1. Ensure virtual environment is activated
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Check Python version >= 3.10

## Logs

Logs are saved to `./logs/agent.log`

View logs:
```bash
tail -f logs/agent.log
```

## Next Steps

- Check out the full [README.md](README.md) for detailed documentation
- See [DEVELOPMENT.md](DEVELOPMENT.md) for contributing guidelines
- Visit [FineTune Lab Documentation](https://docs.finetunelab.ai) for more info

## Support

- GitHub Issues: https://github.com/finetunelab/training-agent/issues
- Discord: https://discord.gg/finetunelab
- Email: support@finetunelab.ai
