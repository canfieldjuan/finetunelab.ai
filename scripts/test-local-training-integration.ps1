# Integration Test for Local Training
# Tests the complete flow: API → Subprocess → Database

Write-Host "=== Local Training Integration Test ===" -ForegroundColor Cyan
Write-Host ""

# Configuration
$apiUrl = "http://localhost:3000/api/training/execute"
$testConfig = @{
    provider = "local"
    config = @{
        model_name = "meta-llama/Llama-3.2-1B"
        dataset_id = "test-dataset-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        method = "sft"
        learning_rate = 0.0002
        num_epochs = 1
        batch_size = 2
        lora_r = 16
        lora_alpha = 32
        use_4bit = $true
        max_seq_length = 512
    }
}

# Step 1: Check if Next.js server is running
Write-Host "[Step 1] Checking if Next.js server is running..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Server is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Server is not running at http://localhost:3000" -ForegroundColor Red
    Write-Host "Please start the server with: npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 2: Test API endpoint with local provider
Write-Host "[Step 2] Sending test request to API..." -ForegroundColor Yellow
Write-Host "Endpoint: POST $apiUrl" -ForegroundColor Gray
Write-Host "Provider: local" -ForegroundColor Gray
Write-Host "Method: sft" -ForegroundColor Gray
Write-Host ""

$jsonBody = $testConfig | ConvertTo-Json -Depth 10

try {
    $apiResponse = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $jsonBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✓ API request successful" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    $apiResponse | ConvertTo-Json -Depth 5 | Write-Host
    Write-Host ""
    
    if ($apiResponse.success) {
        Write-Host "✓ Training started successfully" -ForegroundColor Green
        $executionId = $apiResponse.execution_id
        $processId = $apiResponse.pid
        Write-Host "Execution ID: $executionId" -ForegroundColor Cyan
        Write-Host "Process ID: $processId" -ForegroundColor Cyan
    } else {
        Write-Host "✗ Training failed to start" -ForegroundColor Red
        Write-Host "Error: $($apiResponse.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ API request failed" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Response body:" -ForegroundColor Yellow
    $_.ErrorDetails.Message | Write-Host
    exit 1
}
Write-Host ""

# Step 3: Check if Python process started
Write-Host "[Step 3] Checking if Python process started..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$pythonProcess = Get-Process -Id $processId -ErrorAction SilentlyContinue
if ($pythonProcess) {
    Write-Host "✓ Python process is running (PID: $processId)" -ForegroundColor Green
    Write-Host "Process name: $($pythonProcess.ProcessName)" -ForegroundColor Gray
    Write-Host "Start time: $($pythonProcess.StartTime)" -ForegroundColor Gray
} else {
    Write-Host "⚠ Python process not found (may have completed quickly)" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Check for config file
Write-Host "[Step 4] Checking for config file..." -ForegroundColor Yellow
$configPath = "lib\training\config_$executionId.json"
if (Test-Path $configPath) {
    Write-Host "✓ Config file created: $configPath" -ForegroundColor Green
    $configContent = Get-Content $configPath | ConvertFrom-Json
    Write-Host "Config preview:" -ForegroundColor Gray
    $configContent | ConvertTo-Json -Depth 3 | Write-Host
} else {
    Write-Host "⚠ Config file not found (may have been cleaned up)" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Monitor process for a few seconds
Write-Host "[Step 5] Monitoring training process..." -ForegroundColor Yellow
Write-Host "Waiting 10 seconds to check if process is still running..." -ForegroundColor Gray
for ($i = 1; $i -le 10; $i++) {
    Start-Sleep -Seconds 1
    $processStillRunning = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($processStillRunning) {
        Write-Host "." -NoNewline -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Process completed or exited" -ForegroundColor Yellow
        break
    }
}
Write-Host ""
Write-Host ""

# Step 6: Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Execution ID: $executionId" -ForegroundColor White
Write-Host "Process ID: $processId" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check the Next.js server console for [LocalTrainer] logs" -ForegroundColor Gray
Write-Host "2. Check database 'training_executions' table for execution record" -ForegroundColor Gray
Write-Host "3. Look for output in: outputs/test-dataset-*/checkpoint-*" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected behavior:" -ForegroundColor Yellow
Write-Host "- Process will fail at dataset loading (no real data)" -ForegroundColor Gray
Write-Host "- Database should show 'failed' status with error logs" -ForegroundColor Gray
Write-Host "- This is expected for this test - we're verifying the flow works" -ForegroundColor Gray
Write-Host ""
