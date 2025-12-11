#!/bin/bash

echo "=== METRICS DEBUGGING SCRIPT ==="
echo ""

echo "1. Check Training Server Status"
echo "================================"
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""

echo "2. Check for Active Training Processes"
echo "======================================"
ps aux | grep -E "python.*trainer|transformers|accelerate" | grep -v grep || echo "No training processes found"
echo ""

echo "3. Check Training Server Process"
echo "================================"
ps aux | grep "training_server" | grep -v grep
echo ""

echo "4. Check Next.js Server Status"
echo "=============================="
curl -s http://localhost:3000 > /dev/null 2>&1 && echo "✓ Next.js server is responding" || echo "✗ Next.js server not responding"
echo ""

echo "5. Check if Port 3000 is Available"
echo "=================================="
lsof -ti:3000 >/dev/null 2>&1 && echo "Port 3000 is in use" || echo "Port 3000 is free"
echo ""

echo "6. Check Metrics API Endpoint"
echo "============================="
curl -X POST http://localhost:3000/api/training/local/metrics \
  -H "Content-Type: application/json" \
  -d '{"job_id":"test","metrics":[]}' 2>&1 | head -5
echo ""

echo "7. Summary"
echo "=========="
echo "- Training server: $(curl -s http://localhost:8000/health | grep -o '"status":"[^"]*"' || echo 'Not running')"
echo "- Active training jobs: $(ps aux | grep -E "python.*trainer" | grep -v grep | wc -l)"
echo "- Next.js server: $(curl -s http://localhost:3000 > /dev/null 2>&1 && echo 'Running' || echo 'Not running')"
echo ""
echo "If no training processes are found, that's why you're not seeing metrics!"
echo "The monitor page will only show metrics when training is actively running."
