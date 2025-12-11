# ================================================================
# Test: Verify Standalone Trainer Import
# Week 1 - Phase 1.1: Validation Test
# Date: 2025-10-25
# ================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Testing Standalone Trainer Import" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

$pythonPath = "lib\training\trainer_venv\Scripts\python.exe"

# Test 1: Basic import
Write-Host "[Test 1/2] Testing basic import..." -ForegroundColor Yellow
$testScript = @"
import sys
sys.path.insert(0, 'lib/training')

try:
    from standalone_trainer import ToolTrainer
    print('SUCCESS: ToolTrainer imported successfully')
except Exception as e:
    print(f'ERROR: {e}')
    sys.exit(1)
"@

$testScript | & $pythonPath -
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PASSED: ToolTrainer can be imported" -ForegroundColor Green
} else {
    Write-Host "  FAILED: Cannot import ToolTrainer" -ForegroundColor Red
    exit 1
}

# Test 2: Check GPU availability
Write-Host "`n[Test 2/2] Testing GPU availability in PyTorch..." -ForegroundColor Yellow
$gpuTest = @"
import torch
print(f'PyTorch version: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'CUDA version: {torch.version.cuda}')
    print(f'GPU count: {torch.cuda.device_count()}')
    print(f'GPU name: {torch.cuda.get_device_name(0)}')
else:
    print('No CUDA GPU detected - CPU training will be used')
"@

$gpuTest | & $pythonPath -

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  VALIDATION COMPLETE!" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "================================================================`n" -ForegroundColor Cyan
Write-Host "Python environment is ready for training execution!`n" -ForegroundColor Green
