Param(
  [string]$InstallDir = "$env:LOCALAPPDATA\FineTuneLab\training-agent"
)

$ErrorActionPreference = 'Stop'

function Log($msg) { Write-Host "[install] $msg" }

# Resolve repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir

# Python detection
$Python = "py"
if (-not (Get-Command $Python -ErrorAction SilentlyContinue)) {
  $Python = "python"
}
if (-not (Get-Command $Python -ErrorAction SilentlyContinue)) {
  Write-Error "Python 3 is required but not found on PATH"
}

Log "Installing to $InstallDir"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Log "Copying project files"
# /MIR mirrors, excluding venv and git; robocopy returns 1 on success-with-differences
$robocopyArgs = @(
  $RepoRoot, $InstallDir, '/MIR', '/XD', '.git', 'venv', '__pycache__'
)
$rc = robocopy @robocopyArgs
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with code $LASTEXITCODE" }

Log "Creating virtual environment"
& $Python -3 -m venv "$InstallDir\venv"
& "$InstallDir\venv\Scripts\pip.exe" install --upgrade pip
& "$InstallDir\venv\Scripts\pip.exe" install -r "$InstallDir\requirements.txt"

if (-not (Test-Path "$InstallDir\.env")) {
  Copy-Item "$InstallDir\.env.example" "$InstallDir\.env"
  Log "Created $InstallDir\.env (edit BACKEND_URL and API_KEY)"
}

# helper runner
$runCmd = "@echo off`r`ncd /d `"$InstallDir`"`r`n`"$InstallDir\venv\Scripts\python.exe`" -m src.main`r`n"
Set-Content -Path "$InstallDir\run-agent.cmd" -Value $runCmd -Encoding ASCII

# Scheduled Task
$taskName = "FineTuneLabTrainingAgent"
schtasks /Delete /TN $taskName /F 2>$null | Out-Null
$taskArgs = @(
  '/Create', '/TN', $taskName,
  '/SC', 'ONLOGON',
  '/RL', 'HIGHEST',
  '/TR', "`"$InstallDir\run-agent.cmd`"",
  '/F'
)
schtasks @taskArgs | Out-Null

Log "Task '$taskName' created. It will start on user logon."
Log "To start now: schtasks /Run /TN $taskName"
Log "Edit $InstallDir\.env and re-run the task if needed."