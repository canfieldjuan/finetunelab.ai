#!/bin/bash

# Fine-Tune Labs Installation Script
# Supports: Linux, macOS, Windows (WSL)

set -e

echo "🚀 Fine-Tune Labs - Installation"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*|MINGW*|MSYS*)    MACHINE=Windows;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo -e "${GREEN}✓${NC} Detected OS: $MACHINE"

# Check Node.js
echo ""
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION installed"
else
    echo -e "${RED}✗${NC} Node.js not found"
    echo "Install Node.js 20+ from: https://nodejs.org/"
    exit 1
fi

# Check Python
echo ""
echo "Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓${NC} $PYTHON_VERSION installed"
else
    echo -e "${RED}✗${NC} Python 3 not found"
    echo "Install Python 3.10+ from: https://www.python.org/"
    exit 1
fi

# Check GPU
echo ""
echo "Checking NVIDIA GPU..."
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo -e "${GREEN}✓${NC} GPU detected: $GPU_INFO"
    CUDA_VERSION=$(nvidia-smi | grep "CUDA Version" | awk '{print $9}')
    echo -e "${GREEN}✓${NC} CUDA Version: $CUDA_VERSION"
else
    echo -e "${YELLOW}⚠${NC}  No NVIDIA GPU detected"
    echo "Training will work on CPU (slow) or you can use cloud deployment"
fi

# Install Node dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install
echo -e "${GREEN}✓${NC} Node.js dependencies installed"

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
if [ -f "lib/training/requirements.txt" ]; then
    pip3 install -r lib/training/requirements.txt
    echo -e "${GREEN}✓${NC} Python dependencies installed"
else
    echo -e "${YELLOW}⚠${NC}  requirements.txt not found, skipping"
fi

# Create .env.local if not exists
echo ""
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local..."
    cp .env.example .env.local
    echo -e "${YELLOW}⚠${NC}  Please edit .env.local with your Supabase credentials"
else
    echo -e "${GREEN}✓${NC} .env.local already exists"
fi

# Check Docker (optional)
echo ""
echo "Checking Docker (optional for vLLM)..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓${NC} $DOCKER_VERSION installed"

    # Check nvidia-docker
    if docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
        echo -e "${GREEN}✓${NC} NVIDIA Docker runtime available"
    else
        echo -e "${YELLOW}⚠${NC}  NVIDIA Docker runtime not available"
        echo "For vLLM deployment, install nvidia-container-toolkit"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Docker not found (optional)"
    echo "Install from: https://docs.docker.com/get-docker/"
fi

# Success
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Installation complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your credentials"
echo "2. Run: ./start.sh"
echo "3. Visit: http://localhost:3000"
echo ""
echo "Documentation: README.md"
echo "Issues: https://github.com/yourusername/fine-tune-labs/issues"
