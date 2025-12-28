# FineTune Lab Training Agent

A Python-based local training agent that runs AI model fine-tuning jobs on users' local GPUs and reports metrics to the FineTune Lab platform.

## Features

- ✅ Start, pause, resume, and cancel training jobs
- ✅ Real-time GPU metrics monitoring (VRAM, utilization)
- ✅ Training metrics tracking (loss, perplexity, learning rate)
- ✅ Checkpoint management for pause/resume
- ✅ Secure metric reporting via job tokens
- ✅ HuggingFace Transformers integration
- ✅ Multi-GPU support (DDP)
- ✅ Log streaming
- ✅ Error handling and recovery

## Requirements

- Python 3.10+
- CUDA-compatible GPU (NVIDIA)
- 16GB+ RAM recommended
- 50GB+ free disk space (for models and checkpoints)

## Installation

```bash
# Clone the repository
git clone https://github.com/FineTune-Lab/training-agent.git
cd training-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### One-line install (recommended)

Use the packaged tar/zip from the latest release (includes installer + service setup):

**Linux (systemd user) / macOS (launchd)**

```bash
curl -sSL https://github.com/FineTune-Lab/training-agent/releases/latest/download/training-agent-linux-amd64.tar.gz \
	| tar -xz
cd training-agent
./scripts/install.sh
```

**Windows (Task Scheduler)**

```powershell
Invoke-WebRequest https://github.com/FineTune-Lab/training-agent/releases/latest/download/training-agent-windows-amd64.zip -OutFile agent.zip
Expand-Archive agent.zip -DestinationPath training-agent
cd training-agent\
scripts\install.ps1
```

After install, edit `~/.finetunelab/training-agent/.env` (Linux/macOS) or `%LOCALAPPDATA%\FineTuneLab\training-agent\.env` (Windows) to set `BACKEND_URL` and `API_KEY`, then restart the service (see `scripts/agentctl`).

## Configuration

Create a `.env` file:

```env
# FineTune Lab Backend
BACKEND_URL=https://app.finetunelab.ai
API_KEY=wak_your_worker_api_key_here

# Agent Server
HOST=0.0.0.0
PORT=8000

# Paths
MODELS_DIR=./models
DATASETS_DIR=./datasets
CHECKPOINTS_DIR=./checkpoints
LOGS_DIR=./logs

# GPU Settings
GPU_MEMORY_FRACTION=0.9
ENABLE_MIXED_PRECISION=true
```

## Usage

### Start the Agent

```bash
python -m src.main
```

The agent will start on `http://localhost:8000` and register with the FineTune Lab platform.

### Health Check

```bash
curl http://localhost:8000/health
```

### Run Training (via Web UI)

1. Go to FineTune Lab web interface
2. Create a training configuration
3. Select "Local Training" deployment
4. Click "Start Training"
5. Monitor progress in real-time

## API Endpoints

- `GET /health` - Health check
- `POST /api/training/execute` - Start training job
- `GET /api/training/status/{job_id}` - Get job status
- `POST /api/training/pause/{job_id}` - Pause training
- `POST /api/training/resume/{job_id}` - Resume training
- `POST /api/training/cancel/{job_id}` - Cancel training
- `GET /api/training/logs/{job_id}` - Get training logs

## Architecture

```
training-agent/
├── src/
│   ├── api/              # FastAPI endpoints
│   ├── training/         # Training execution
│   ├── monitoring/       # GPU and metrics monitoring
│   ├── models/           # Data models
│   └── main.py           # Application entry point
├── tests/
├── requirements.txt
└── README.md
```

## Supported Frameworks

- HuggingFace Transformers
- PyTorch
- Axolotl (planned)
- Unsloth (planned)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## License

MIT License - see LICENSE file for details
