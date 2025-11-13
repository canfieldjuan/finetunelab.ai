# Start Training Server
# The training_server.py now automatically loads environment variables from web-ui/.env using python-dotenv
# No need to manually load them here!

Write-Host "Starting FineTune Lab Training Server..." -ForegroundColor Cyan
Write-Host "Environment variables will be loaded from: web-ui/.env" -ForegroundColor Gray
Write-Host ""

# Navigate to training directory
Set-Location "C:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training"

# Activate virtual environment
& ".\trainer_venv\Scripts\Activate.ps1"

Write-Host "Starting server on port 8000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Start server with auto-reload for development
python -m uvicorn training_server:app --host 0.0.0.0 --port 8000 --reload
