#!/bin/bash
# Production server startup script (no hot reload)
# For stable production deployment

cd "$(dirname "$0")"

echo "Starting training server in production mode..."
echo "Press Ctrl+C to stop"
echo ""

./trainer_venv/bin/python3 -m uvicorn training_server:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1
