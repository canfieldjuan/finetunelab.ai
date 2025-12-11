# Test Training Server Flow
# This simulates what LocalPackageDownloader sends to the training server

Write-Host "Testing Training Server API Flow" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check training server health
Write-Host "1. Checking training server health (port 8000)..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
    Write-Host "   ✓ Training server is healthy" -ForegroundColor Green
    Write-Host "   GPU: $($health.gpu_info)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Training server is not running!" -ForegroundColor Red
    Write-Host "   Please start it with: cd lib\training && .\trainer_venv\Scripts\Activate.ps1 && python -m uvicorn training_server:app --host 0.0.0.0 --port 8000" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 2: Test the execute endpoint with minimal data
Write-Host "2. Testing /api/training/execute endpoint..." -ForegroundColor Yellow

$testRequest = @{
    config = @{
        model = @{
            name = "test-model"
        }
        training = @{
            method = "sft"
            num_epochs = 1
        }
        data = @{
            strategy = "standard"
        }
    }
    dataset_content = '{"conversations": [{"from": "human", "value": "test"}]}'
    execution_id = [guid]::NewGuid().ToString()
    name = "Test Training Job"
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/training/execute" `
        -Method Post `
        -ContentType "application/json" `
        -Body $testRequest
    
    Write-Host "   ✓ Training job created successfully!" -ForegroundColor Green
    Write-Host "   Job ID: $($response.job_id)" -ForegroundColor Gray
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    
    $jobId = $response.job_id
    
    # Step 3: Check job status
    Write-Host ""
    Write-Host "3. Checking job status..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/training/status/$jobId" -Method Get
    Write-Host "   Status: $($status.status)" -ForegroundColor Gray
    Write-Host "   Progress: $($status.progress)%" -ForegroundColor Gray
    if ($status.error) {
        Write-Host "   Error: $($status.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "   ✗ Failed to create training job" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Cyan
