# Fine-Tune Labs

**Self-hosted AI model fine-tuning platform with GPU acceleration**

Fine-Tune Labs is a complete solution for fine-tuning and deploying language models on your own hardware. Train models with Unsloth, deploy with vLLM or Ollama, and monitor training in real-time - all from an intuitive web interface.

## Features

### Core Training
- **GPU-Accelerated Training**: Fine-tune models using Unsloth with CUDA support
- **Real-time Monitoring**: Live training metrics, loss curves, and job status
- **Dataset Management**: Upload, validate, and manage training datasets
- **Template Library**: Pre-configured training templates for common use cases
- **Training History**: Track all training jobs with logs and artifacts

### Deployment
- **vLLM Integration**: Deploy trained models with optimized inference
- **Ollama Support**: Local model serving with Ollama
- **Docker Deployment**: One-command setup with GPU passthrough
- **Native Linux**: Direct Python execution without containers

### Additional Features
- **Multi-Provider LLM Support**: OpenAI, Anthropic Claude, Ollama
- **GraphRAG Integration**: Knowledge graph context with Neo4j and Graphiti
- **Persistent Storage**: Supabase backend for users and data
- **Authentication**: Secure login with session management

## System Requirements

### Required
- **Operating System**: Linux, macOS, or Windows (WSL)
- **Node.js**: v20 or higher
- **Python**: 3.10 or higher
- **Supabase Account**: For authentication and data storage

### Optional (Recommended for Training)
- **NVIDIA GPU**: CUDA-capable GPU for fast training
- **Docker**: For containerized deployment
- **CUDA Toolkit**: 11.8+ (for native training)
- **nvidia-docker**: For GPU passthrough in containers

## Quick Start

### Option 1: Automated Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/fine-tune-labs.git
cd fine-tune-labs

# Run installer (checks dependencies, installs packages)
chmod +x install.sh
./install.sh

# Edit .env.local with your Supabase credentials
nano .env.local

# Start both training server and web UI
./start.sh
```

The installer will:
- Verify Node.js, Python, and GPU availability
- Install all dependencies (npm + pip)
- Create `.env.local` from template
- Check Docker and nvidia-docker (optional)

### Option 2: Docker Compose (One Command)

```bash
# Clone repository
git clone https://github.com/yourusername/fine-tune-labs.git
cd fine-tune-labs

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start everything with GPU support
docker-compose up
```

Services will be available at:
- **Web UI**: http://localhost:3000
- **Training Server**: http://localhost:8000

### Option 3: Manual Setup

```bash
# 1. Install Node.js dependencies
npm install

# 2. Install Python dependencies
pip3 install -r lib/training/requirements.txt

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Start training server (terminal 1)
python3 lib/training/training_server.py

# 5. Start web UI (terminal 2)
npm run dev
```

## Environment Configuration

Required environment variables in `.env.local`:

```bash
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Training Backend
NEXT_PUBLIC_TRAINING_BACKEND_URL=http://localhost:8000

# Feature Flags
NEXT_PUBLIC_ENABLE_VLLM=true
NEXT_PUBLIC_ENABLE_LOCAL_TRAINING=true

# LLM Provider (openai, anthropic, ollama)
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here

# Neo4j (Optional - for GraphRAG)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

See `.env.example` for complete configuration options.

## Usage

### Training a Model

1. Navigate to **Training** page
2. Select or create a training configuration
3. Upload your dataset (JSONL format)
4. Click **Start Training**
5. Monitor progress in real-time

### Deploying Models

After training completes:
1. Click **Deploy to vLLM** in training monitor
2. Choose deployment platform:
   - **Local vLLM**: Run on your machine with Docker
   - **Ollama**: Convert and serve locally
   - **Cloud**: Deploy to Kaggle, RunPod, or HuggingFace Spaces
3. Access deployed model via inference API

### Dataset Format

Training datasets should be in JSONL format:

```jsonl
{"messages": [{"role": "user", "content": "Question?"}, {"role": "assistant", "content": "Answer."}]}
{"messages": [{"role": "user", "content": "Another question?"}, {"role": "assistant", "content": "Another answer."}]}
```

## Project Structure

```
fine-tune-labs/
├── app/                        # Next.js App Router
│   ├── api/                   # API routes
│   │   ├── chat/             # Chat interface
│   │   └── training/         # Training management
│   ├── training/             # Training UI pages
│   └── page.tsx              # Main chat interface
├── components/
│   ├── training/             # Training UI components
│   └── Chat.tsx              # Chat component
├── lib/
│   ├── training/             # Python training server
│   │   ├── training_server.py
│   │   └── requirements.txt
│   ├── services/             # TypeScript services
│   │   └── inference-server-manager.ts
│   ├── graphrag/             # GraphRAG implementation
│   └── llm/                  # LLM provider integrations
├── hooks/                     # React hooks
│   └── useFreshToken.ts      # Token refresh utilities
├── contexts/                  # React contexts
│   └── AuthContext.tsx       # Authentication
├── docker-compose.yml         # Multi-service orchestration
├── Dockerfile.web            # Web UI container
├── Dockerfile.training       # Training server container
├── install.sh                # Installation script
└── start.sh                  # Startup script
```

## Architecture

### Self-Hosted Design

Fine-Tune Labs runs entirely on **your own hardware**:
- Each user runs their own instance with their own GPU
- No data leaves your machine unless you choose cloud deployment
- Full control over models, datasets, and configurations

### Technology Stack

- **Frontend**: Next.js 15.5.4 with TypeScript
- **Backend**: Python FastAPI (training server)
- **Training**: Unsloth + PyTorch with CUDA
- **Inference**: vLLM, Ollama
- **Database**: Supabase (PostgreSQL)
- **Containerization**: Docker + docker-compose
- **GPU**: NVIDIA CUDA 11.8+

## GPU Training

### CUDA Setup (Linux)

```bash
# Check GPU availability
nvidia-smi

# Verify CUDA version (11.8+ required)
nvcc --version

# Install CUDA toolkit if needed
# https://developer.nvidia.com/cuda-downloads
```

### Docker GPU Setup

```bash
# Install nvidia-container-toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Test GPU in Docker
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

## Troubleshooting

### Token Refresh Issues

If you're logged out after 25-30 minutes:
- Token refresh is automatic via `AuthContext`
- Components use `useFreshToken()` hook for stable token access
- Check browser console for auth errors

### Training Server Connection

If web UI can't connect to training server:
```bash
# Check if training server is running
curl http://localhost:8000/health

# Check firewall
sudo ufw allow 8000

# Restart training server
pkill -f training_server.py
python3 lib/training/training_server.py
```

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# Reinstall driver if needed
sudo ubuntu-drivers autoinstall
sudo reboot

# Verify CUDA in Python
python3 -c "import torch; print(torch.cuda.is_available())"
```

### Docker GPU Access

```bash
# Test GPU passthrough
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi

# If fails, check nvidia-docker installation
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

## Development

### Type Checking

```bash
npx tsc --noEmit
```

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

### Code Quality

```bash
# Linting
npm run lint

# Formatting
npm run format
```

## Documentation

- **Installation**: `install.sh`, this README
- **LLM Configuration**: `docs/LLM_CONFIGURATION_GUIDE.md`
- **GraphRAG Integration**: `docs/GRAPHRAG_UI_INTEGRATION.md`
- **Token Refresh**: `TOKEN_REFRESH_FIX_IMPLEMENTATION.md`
- **Deployment Analysis**: `VLLM_NATIVE_VS_DOCKER_ANALYSIS.md`

## Contributing

Fine-Tune Labs is designed for **self-hosted deployment**. Each user runs the full stack on their own machine with their own GPU. When contributing:

1. Keep all features enabled (vLLM, Ollama, local training)
2. Test with GPU when possible
3. Ensure Docker Compose setup works
4. Don't add unnecessary dependencies
5. Follow existing code patterns

## Support

- **Issues**: https://github.com/yourusername/fine-tune-labs/issues
- **Discussions**: https://github.com/yourusername/fine-tune-labs/discussions
- **Documentation**: See `docs/` directory

## License

MIT

## Acknowledgments

- **Unsloth**: Fast, memory-efficient fine-tuning
- **vLLM**: High-performance inference
- **Ollama**: Local model serving
- **Supabase**: Backend infrastructure
- **Next.js**: React framework
