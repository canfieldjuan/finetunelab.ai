# Test standalone trainer CLI
# This script tests the CLI argument parsing and help output

Write-Host "=== Testing Standalone Trainer CLI ===" -ForegroundColor Cyan
Write-Host ""

# Paths
$venvPath = "lib\training\trainer_venv\Scripts\python.exe"
$trainerPath = "lib\training\standalone_trainer.py"
$testConfigPath = "lib\training\test_config.json"

# Test 1: Show help
Write-Host "[Test 1] Testing help output..." -ForegroundColor Yellow
& $venvPath $trainerPath --help
Write-Host ""

# Test 2: Missing required arguments
Write-Host "[Test 2] Testing missing arguments (should fail)..." -ForegroundColor Yellow
& $venvPath $trainerPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    Write-Host "Correctly failed with exit code $exitCode" -ForegroundColor Green
} else {
    Write-Host "Should have failed but did not" -ForegroundColor Red
}
Write-Host ""

# Test 3: Valid arguments (dry run - will fail at data loading, but CLI parsing should work)
Write-Host "[Test 3] Testing valid arguments..." -ForegroundColor Yellow
Write-Host "Config file: $testConfigPath" -ForegroundColor Gray
Write-Host "Execution ID: test-execution-123" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected: CLI should parse arguments and start initialization" -ForegroundColor Gray
Write-Host "Will fail at data loading (no actual dataset), but that is OK - we are testing CLI parsing" -ForegroundColor Gray
Write-Host ""

& $venvPath $trainerPath --config $testConfigPath --execution-id "test-execution-123"
$exitCode = $LASTEXITCODE
Write-Host ""
Write-Host "Exit code: $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "=== CLI Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "- Help output: Should show argument documentation" -ForegroundColor Gray
Write-Host "- Missing args: Should fail with usage error" -ForegroundColor Gray
Write-Host "- Valid args: Should parse and start training initialization" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: Full training will fail without actual dataset data," -ForegroundColor Yellow
Write-Host "but CLI argument parsing is what we are testing here." -ForegroundColor Yellow
