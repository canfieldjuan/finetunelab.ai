# ================================================================
# Python Virtual Environment Setup Script
# Week 1 - Phase 1.1: Create and Configure Python Environment
# Date: 2025-10-25
# ================================================================

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Creating Python Virtual Environment" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

$venvPath = "lib\training\trainer_venv"
$reqFile = "lib\training\requirements.txt"

# Step 1: Create virtual environment
Write-Host "[1/3] Creating virtual environment at $venvPath..." -ForegroundColor Yellow
if (Test-Path $venvPath) {
    Write-Host "  Virtual environment already exists. Skipping creation." -ForegroundColor Cyan
} else {
    python -m venv $venvPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Virtual environment created successfully!" -ForegroundColor Green
    } else {
        Write-Host "  ERROR: Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
}

# Step 2: Activate and upgrade pip
Write-Host "`n[2/3] Upgrading pip in virtual environment..." -ForegroundColor Yellow
& "$venvPath\Scripts\python.exe" -m pip install --upgrade pip --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Pip upgraded successfully!" -ForegroundColor Green
} else {
    Write-Host "  WARNING: Failed to upgrade pip, continuing..." -ForegroundColor Yellow
}

# Step 3: Install requirements
Write-Host "`n[3/3] Installing dependencies from $reqFile..." -ForegroundColor Yellow
Write-Host "  This may take several minutes..." -ForegroundColor Cyan

& "$venvPath\Scripts\python.exe" -m pip install -r $reqFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n  All dependencies installed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n  ERROR: Failed to install some dependencies" -ForegroundColor Red
    exit 1
}

# Verification
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  Verification" -ForegroundColor White
Write-Host "================================================================`n" -ForegroundColor Cyan

Write-Host "Installed packages:" -ForegroundColor Yellow
& "$venvPath\Scripts\python.exe" -m pip list | Select-String -Pattern "torch|transformers|peft|trl|datasets"

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE!" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "================================================================`n" -ForegroundColor Cyan
Write-Host "Virtual environment ready at: $venvPath" -ForegroundColor Green
Write-Host "To activate: .\$venvPath\Scripts\Activate.ps1`n" -ForegroundColor Cyan
