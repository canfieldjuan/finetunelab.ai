# FineTuneLab Training Worker

Run LLM fine-tuning jobs on your local GPU from the FineTuneLab cloud platform.

## 🚀 Quick Start

### Prerequisites

1. **NVIDIA GPU** with CUDA support (RTX 3060 or better recommended)
2. **Docker** installed ([Get Docker](https://docs.docker.com/get-docker/))
3. **NVIDIA Container Toolkit** ([Installation Guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html))
4. **FineTuneLab Account** with API credentials

### Installation

**1. Download this folder** or clone the repository:
```bash
git clone https://github.com/canfieldjuan/finetunelab.ai.git
cd finetunelab.ai/lib/training
```

**2. Configure your environment**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
- `NEXT_PUBLIC_BASE_URL` - Your FineTuneLab deployment URL (usually https://finetunelab.ai)
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

Get these from your FineTuneLab dashboard → Settings → API Keys

**3. Build and start the worker**:
```bash
docker-compose up -d
```

**4. Verify it's running**:
```bash
docker-compose logs -f
```

You should see:
```
[Persistence] Configured endpoints: jobs=https://finetunelab.ai/api/training/local/jobs
[INFO] Application startup complete
```

## 📋 Usage

### Start Training Worker
```bash
docker-compose up -d
```

### View Logs
```bash
docker-compose logs -f
```

### Stop Worker
```bash
docker-compose down
```

### Restart Worker
```bash
docker-compose restart
```

### Check Worker Status
```bash
curl http://localhost:8000/health
```

## 🔧 Configuration

### GPU Selection

Edit `.env` to choose which GPU(s) to use:

```bash
# Use first GPU (default)
CUDA_VISIBLE_DEVICES=0

# Use second GPU
CUDA_VISIBLE_DEVICES=1

# Use multiple GPUs
CUDA_VISIBLE_DEVICES=0,1

# Use all GPUs
CUDA_VISIBLE_DEVICES=all
```

### Multiple Workers

To run multiple workers on different GPUs:

```bash
# Worker 1 (GPU 0)
CUDA_VISIBLE_DEVICES=0 docker-compose -p worker1 up -d

# Worker 2 (GPU 1)
CUDA_VISIBLE_DEVICES=1 docker-compose -p worker2 -f docker-compose.yml up -d
```

### Resource Limits

Edit `docker-compose.yml` to limit GPU memory:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          device_ids: ['0']  # Specific GPU
          capabilities: [gpu]
    limits:
      memory: 24G  # Limit RAM
```

## 📁 File Structure

```
lib/training/
├── Dockerfile              # Docker image definition
├── docker-compose.yml      # Docker Compose configuration
├── .env.example           # Environment variables template
├── README_WORKER.md       # This file
├── training_server.py     # Training orchestration server
├── standalone_trainer.py  # Training execution logic
├── config_validator.py    # Training config validation
├── alert_trigger.py       # Alert system integration
├── error_extractor.py     # Error parsing utilities
├── requirements.txt       # Python dependencies
├── outputs/               # Training outputs (models, checkpoints)
├── logs/                  # Training logs
└── datasets/              # Local datasets (optional)
```

## 🐛 Troubleshooting

### Worker won't start

**Check Docker is running**:
```bash
docker info
```

**Check NVIDIA Container Toolkit**:
```bash
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

**Check logs for errors**:
```bash
docker-compose logs
```

### "No GPU available" error

1. Verify NVIDIA drivers installed:
   ```bash
   nvidia-smi
   ```

2. Verify NVIDIA Container Toolkit installed:
   ```bash
   docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
   ```

3. Check Docker Compose GPU configuration in `docker-compose.yml`

### Connection errors to FineTuneLab

1. Verify `NEXT_PUBLIC_BASE_URL` is correct in `.env`
2. Check firewall allows outbound HTTPS (port 443)
3. Verify Supabase credentials are correct
4. Check worker logs: `docker-compose logs -f`

### Out of Memory errors

1. Reduce batch size in training config
2. Enable gradient checkpointing
3. Use 4-bit quantization (QLoRA)
4. Limit GPU memory in docker-compose.yml

## 🔐 Security

- **API Keys**: Keep your `.env` file secure and never commit it to git
- **Network**: Worker makes outbound connections only (no incoming ports except 8000 for local API)
- **Isolation**: Docker provides process isolation from your system
- **Updates**: Pull latest image regularly for security patches

## 📊 Monitoring

### View Training Metrics

Worker reports metrics to FineTuneLab dashboard in real-time:
- Training loss
- GPU utilization
- Memory usage
- Tokens per second
- Estimated time remaining

Access at: https://finetunelab.ai/training

### Local Metrics

Training logs and TensorBoard files are saved to `./outputs/`:
```bash
# View TensorBoard
docker run -p 6006:6006 -v $(pwd)/outputs:/logs \
  tensorflow/tensorflow tensorboard --logdir=/logs --host=0.0.0.0
```

Open http://localhost:6006 in your browser.

## 🆘 Support

- **Documentation**: https://docs.finetunelab.ai
- **Issues**: https://github.com/canfieldjuan/finetunelab.ai/issues
- **Discord**: https://discord.gg/finetunelab

## 📝 License

Copyright © 2025 FineTuneLab. All rights reserved.
