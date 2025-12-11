# ================================================================
# Python Environment Verification Script
# Week 1 - Phase 1.1: Verify Python Environment
# Date: 2025-10-25
# ================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  PHASE 1.1: Python Environment Verification" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

$errors = @()
$warnings = @()

# 1. Check Python version
Write-Host "[1/5] Checking Python version..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
    
    if ($pythonVersion -notmatch "Python 3\.(9|1[0-9])") {
        $warnings += "Python version should be 3.9 or higher for best compatibility"
    }
} catch {
    $errors += "Python not found in PATH"
    Write-Host "  ERROR: Python not found" -ForegroundColor Red
}

# 2. Check if venv exists
Write-Host "`n[2/5] Checking virtual environment..." -ForegroundColor Yellow
$venvPath = "lib\training\trainer_venv"
if (Test-Path $venvPath) {
    Write-Host "  Virtual environment exists: $venvPath" -ForegroundColor Green
} else {
    Write-Host "  Virtual environment not found (will be created)" -ForegroundColor Yellow
    $warnings += "Virtual environment needs to be created"
}

# 3. Check requirements.txt
Write-Host "`n[3/5] Checking requirements.txt..." -ForegroundColor Yellow
$reqFile = "lib\training\requirements.txt"
if (Test-Path $reqFile) {
    Write-Host "  Requirements file exists" -ForegroundColor Green
    $reqContent = Get-Content $reqFile
    $packages = @('torch', 'transformers', 'peft', 'trl', 'datasets')
    
    foreach ($pkg in $packages) {
        if ($reqContent -match $pkg) {
            Write-Host "    - $pkg found" -ForegroundColor Green
        } else {
            $errors += "Missing package in requirements.txt: $pkg"
        }
    }
} else {
    $errors += "requirements.txt not found at $reqFile"
}

# 4. Check standalone_trainer.py
Write-Host "`n[4/5] Checking standalone_trainer.py..." -ForegroundColor Yellow
$trainerFile = "lib\training\standalone_trainer.py"
if (Test-Path $trainerFile) {
    Write-Host "  Trainer file exists" -ForegroundColor Green
    $trainerContent = Get-Content $trainerFile -Raw
    
    # Check for key classes/functions
    if ($trainerContent -match "class ToolTrainer") {
        Write-Host "    - ToolTrainer class found" -ForegroundColor Green
    } else {
        $errors += "ToolTrainer class not found in standalone_trainer.py"
    }
    
    # Check file size (should be ~407 lines)
    $lineCount = (Get-Content $trainerFile | Measure-Object -Line).Lines
    Write-Host "    - File size: $lineCount lines" -ForegroundColor Cyan
} else {
    $errors += "standalone_trainer.py not found at $trainerFile"
}

# 5. Check CUDA availability (optional)
Write-Host "`n[5/5] Checking CUDA availability..." -ForegroundColor Yellow
try {
    $nvidiaSmi = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  GPU detected:" -ForegroundColor Green
        Write-Host "    $nvidiaSmi" -ForegroundColor Cyan
    } else {
        Write-Host "  No CUDA GPU detected (CPU training will be used)" -ForegroundColor Yellow
        $warnings += "No GPU available - training will be slower"
    }
} catch {
    Write-Host "  No CUDA GPU detected (CPU training will be used)" -ForegroundColor Yellow
    $warnings += "No GPU available - training will be slower"
}

# Summary
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  VERIFICATION SUMMARY" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "  STATUS: ALL CHECKS PASSED" -ForegroundColor Green -BackgroundColor DarkGreen
    Write-Host "`n  Ready to proceed with Python environment setup!`n" -ForegroundColor Green
    exit 0
} elseif ($errors.Count -eq 0) {
    Write-Host "  STATUS: PASSED WITH WARNINGS" -ForegroundColor Yellow
    Write-Host "`n  Warnings:" -ForegroundColor Yellow
    foreach ($warn in $warnings) {
        Write-Host "    - $warn" -ForegroundColor Yellow
    }
    Write-Host "`n  Can proceed, but review warnings above.`n" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "  STATUS: FAILED" -ForegroundColor Red -BackgroundColor DarkRed
    Write-Host "`n  Errors:" -ForegroundColor Red
    foreach ($err in $errors) {
        Write-Host "    - $err" -ForegroundColor Red
    }
    if ($warnings.Count -gt 0) {
        Write-Host "`n  Warnings:" -ForegroundColor Yellow
        foreach ($warn in $warnings) {
            Write-Host "    - $warn" -ForegroundColor Yellow
        }
    }
    Write-Host "`n  Fix errors before proceeding.`n" -ForegroundColor Red
    exit 1
}
