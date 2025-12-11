# Install Cloud Platform SDKs for Training venv
# Run this script from the lib/training directory

Write-Host "Installing Cloud Platform SDKs..." -ForegroundColor Cyan

# Check if venv exists
if (-not (Test-Path "trainer_venv")) {
    Write-Host "ERROR: trainer_venv not found!" -ForegroundColor Red
    Write-Host "Please create the virtual environment first:" -ForegroundColor Yellow
    Write-Host "  python -m venv trainer_venv" -ForegroundColor Yellow
    exit 1
}

# Activate venv and install packages
Write-Host "Activating trainer_venv..." -ForegroundColor Green
& ".\trainer_venv\Scripts\Activate.ps1"

Write-Host "`nInstalling Kaggle SDK..." -ForegroundColor Green
python -m pip install kaggle>=1.6.0

Write-Host "`nInstalling RunPod SDK..." -ForegroundColor Green
python -m pip install runpod>=1.6.0

Write-Host "`nVerifying installations..." -ForegroundColor Green
python -c "import kaggle; print(f'✓ Kaggle SDK: {kaggle.__version__}')"
python -c "import runpod; print(f'✓ RunPod SDK: {runpod.__version__}')"

Write-Host "`n✅ Cloud SDKs installed successfully!" -ForegroundColor Green
Write-Host "`nYou can now use Kaggle and RunPod deployment features." -ForegroundColor Cyan
