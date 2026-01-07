# FineTune Lab Training Agent

A Python-based local training agent that runs AI model fine-tuning jobs on users' local GPUs and reports metrics to the FineTune Lab platform.

## Features

- ✅ Poll-based job dispatch (works behind firewalls/NAT)
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

# Agent Authentication (create API key with 'training' scope in Settings > API Keys)
API_KEY=wak_your_training_api_key_here
AGENT_ID=  # Optional: auto-generated if empty

# Job Polling
POLL_ENABLED=true
POLL_INTERVAL_SECONDS=10

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

### API Key Setup

1. Log in to FineTune Lab at https://app.finetunelab.ai
2. Go to Settings > API Keys
3. Create a new API key with the `training` scope
4. Copy the key (starts with `wak_`) into your `.env` file

## Usage

### Start the Agent

```bash
python -m src.main
```

The agent will:
1. Start on `http://localhost:8000`
2. Begin polling the FineTune Lab backend for pending jobs
3. Automatically claim and execute jobs when available
4. Report metrics and status back to the platform

### Health Check

```bash
curl http://localhost:8000/health
```

### Run Training (via Web UI)

1. Ensure your agent is running with a valid API key
2. Go to FineTune Lab web interface
3. Create a training configuration
4. Select "Local Training" deployment
5. Click "Start Training"
6. The agent will automatically pick up the job within seconds
7. Monitor progress in real-time

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
│   ├── services/         # Job polling and backend communication
│   ├── training/         # Training execution
│   ├── monitoring/       # GPU and metrics monitoring
│   ├── models/           # Data models
│   ├── config.py         # Configuration management
│   └── main.py           # Application entry point
├── tests/
├── requirements.txt
└── README.md
```

## How It Works

The agent uses a poll-based architecture that works behind firewalls and NAT:

1. **Polling**: Agent polls `GET /api/training/agent/poll` every 10 seconds
2. **Claiming**: When a job is available, agent claims it via `POST /api/training/agent/claim/{jobId}`
3. **Execution**: Agent downloads dataset and runs training locally
4. **Reporting**: Metrics are reported via `PUT /api/training/local/{jobId}/metrics`
5. **Completion**: Status updated via `PATCH /api/training/local/{jobId}/status`

## Supported Frameworks

- HuggingFace Transformers
- PyTorch
- Axolotl (planned)
- Unsloth (planned)

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

## License

MIT License - see LICENSE file for details
