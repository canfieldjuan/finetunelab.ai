#!/bin/bash
# Development server startup script with hot reload
# Automatically restarts when training_server.py changes

cd "$(dirname "$0")"

echo "Starting training server in development mode with hot reload..."
echo "Server will automatically restart when code changes are detected"
echo "Press Ctrl+C to stop"
echo ""

./trainer_venv/bin/python3 -m uvicorn training_server:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --reload-include "*.py"
