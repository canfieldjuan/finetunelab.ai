# ================================================================
# PyTorch CUDA Installation Script
# Uninstall CPU version and install CUDA-enabled PyTorch
# Date: 2025-10-25
# ================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  PyTorch CUDA Installation" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

$pythonPath = "lib\training\trainer_venv\Scripts\python.exe"
$pipPath = "lib\training\trainer_venv\Scripts\pip.exe"

# Step 1: Check current PyTorch version
Write-Host "[1/4] Checking current PyTorch installation..." -ForegroundColor Yellow
$currentVersion = & $pythonPath -c "import torch; print(torch.__version__); print('CUDA:', torch.cuda.is_available())" 2>&1
Write-Host "  Current: $currentVersion" -ForegroundColor Cyan

# Step 2: Uninstall CPU version
Write-Host "`n[2/4] Uninstalling CPU-only PyTorch..." -ForegroundColor Yellow
& $pipPath uninstall torch torchvision torchaudio -y
if ($LASTEXITCODE -eq 0) {
    Write-Host "  CPU version uninstalled successfully" -ForegroundColor Green
} else {
    Write-Host "  Warning: Uninstall had issues, continuing..." -ForegroundColor Yellow
}

# Step 3: Install CUDA version
Write-Host "`n[3/4] Installing PyTorch with CUDA 12.1 support..." -ForegroundColor Yellow
Write-Host "  This may take several minutes..." -ForegroundColor Cyan
Write-Host "  Downloading from PyTorch stable channel..." -ForegroundColor Cyan

# PyTorch 2.1.0+ with CUDA 12.1 for Windows
& $pipPath install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n  PyTorch with CUDA installed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n  ERROR: Failed to install PyTorch with CUDA" -ForegroundColor Red
    exit 1
}

# Step 4: Verify CUDA installation
Write-Host "`n[4/4] Verifying CUDA installation..." -ForegroundColor Yellow
$verifyScript = @"
import torch
print('=' * 60)
print('PyTorch Installation Verification')
print('=' * 60)
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'CUDA version: {torch.version.cuda}')
    print(f'cuDNN version: {torch.backends.cudnn.version()}')
    print(f'GPU count: {torch.cuda.device_count()}')
    print(f'GPU 0 name: {torch.cuda.get_device_name(0)}')
    print(f'GPU 0 memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB')
    
    # Test CUDA with a simple tensor operation
    print('\nTesting CUDA tensor operations...')
    x = torch.randn(100, 100).cuda()
    y = torch.randn(100, 100).cuda()
    z = x @ y
    print(f'CUDA tensor test: SUCCESS (device={z.device})')
else:
    print('WARNING: CUDA is not available!')
    print('Possible reasons:')
    print('  - NVIDIA GPU not detected')
    print('  - CUDA drivers not installed')
    print('  - Wrong PyTorch build')
print('=' * 60)
"@

$verifyScript | & $pythonPath -

Write-Host "`n================================================================" -ForegroundColor Cyan
if ($LASTEXITCODE -eq 0) {
    Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host "================================================================`n" -ForegroundColor Cyan
    Write-Host "PyTorch with CUDA 12.1 is ready for GPU training!`n" -ForegroundColor Green
} else {
    Write-Host "  VERIFICATION FAILED" -ForegroundColor White -BackgroundColor Red
    Write-Host "================================================================`n" -ForegroundColor Cyan
    Write-Host "PyTorch installed but CUDA verification failed.`n" -ForegroundColor Yellow
    Write-Host "Check that NVIDIA drivers are up to date.`n" -ForegroundColor Yellow
}
