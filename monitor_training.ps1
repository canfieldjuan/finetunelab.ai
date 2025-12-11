# Monitor Training Progress
# Job ID: 0f8c4d92-9703-4e7e-88ae-f7a67f3bbdd1

$jobId = "0f8c4d92-9703-4e7e-88ae-f7a67f3bbdd1"

Write-Host "🚀 Monitoring Training Job: $jobId" -ForegroundColor Green
Write-Host "=" * 60

while ($true) {
    Clear-Host
    Write-Host "🚀 Training Monitor - Job: $jobId" -ForegroundColor Cyan
    Write-Host "=" * 60
    Write-Host ""

    # Get status
    $status = Invoke-RestMethod -Uri "http://localhost:8000/api/training/status/$jobId"

    Write-Host "📊 Status: $($status.status)" -ForegroundColor Yellow
    Write-Host "📈 Progress: $([math]::Round($status.progress, 2))%" -ForegroundColor Yellow
    Write-Host "📖 Epoch: $($status.current_epoch) / $($status.total_epochs)"
    Write-Host "🔢 Step: $($status.current_step) / $($status.total_steps)"
    Write-Host ""

    if ($status.loss) {
        Write-Host "📉 Train Loss: $([math]::Round($status.loss, 4))" -ForegroundColor Green
    }
    if ($status.eval_loss) {
        Write-Host "📉 Eval Loss: $([math]::Round($status.eval_loss, 4))" -ForegroundColor Green
    }
    if ($status.samples_per_second) {
        Write-Host "⚡ Speed: $([math]::Round($status.samples_per_second, 2)) samples/sec"
    }
    if ($status.gpu_memory_allocated_gb) {
        Write-Host "🎮 GPU Memory: $([math]::Round($status.gpu_memory_allocated_gb, 2)) GB"
    }
    Write-Host ""

    # Get latest logs
    $logs = Invoke-RestMethod -Uri "http://localhost:8000/api/training/logs/${jobId}?limit=10"

    Write-Host "📜 Latest Logs:" -ForegroundColor Cyan
    Write-Host "-" * 60
    foreach ($line in $logs.logs[-10..-1]) {
        if ($line) {
            # Highlight important lines
            if ($line -match "Target modules") {
                Write-Host $line -ForegroundColor Green
            }
            elseif ($line -match "Label smoothing") {
                Write-Host $line -ForegroundColor Green
            }
            elseif ($line -match "loss|Loss") {
                Write-Host $line -ForegroundColor Yellow
            }
            elseif ($line -match "ERROR|Error|error") {
                Write-Host $line -ForegroundColor Red
            }
            else {
                Write-Host $line
            }
        }
    }
    Write-Host ""
    Write-Host "-" * 60
    Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
    Write-Host "Refreshing in 10 seconds..." -ForegroundColor Gray

    if ($status.status -eq "completed") {
        Write-Host ""
        Write-Host "✅ Training Complete!" -ForegroundColor Green
        Write-Host "Final Train Loss: $([math]::Round($status.loss, 4))"
        Write-Host "Final Eval Loss: $([math]::Round($status.eval_loss, 4))"
        break
    }

    if ($status.status -eq "failed") {
        Write-Host ""
        Write-Host "❌ Training Failed!" -ForegroundColor Red
        Write-Host "Error: $($status.error)"
        break
    }

    Start-Sleep -Seconds 10
}
