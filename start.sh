#!/bin/bash

# Fine-Tune Labs - Start Script

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🚀 Starting Fine-Tune Labs..."
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠${NC}  .env.local not found"
    echo "Run ./install.sh first"
    exit 1
fi

# Start training server in background
echo "Starting training server on port 8000..."
python3 lib/training/training_server.py &
TRAINING_PID=$!
echo -e "${GREEN}✓${NC} Training server started (PID: $TRAINING_PID)"

# Wait for training server to be ready
sleep 3

# Start Next.js dev server
echo ""
echo "Starting web UI on port 3000..."
npm run dev &
WEB_PID=$!
echo -e "${GREEN}✓${NC} Web UI started (PID: $WEB_PID)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✓ Fine-Tune Labs is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Web UI:          http://localhost:3000"
echo "Training Server: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap Ctrl+C and cleanup
cleanup() {
    echo ""
    echo "Stopping services..."
    kill $WEB_PID $TRAINING_PID 2>/dev/null
    echo "Goodbye!"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
