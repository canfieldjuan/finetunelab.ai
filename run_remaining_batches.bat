@echo off
echo ========================================
echo Running Remaining Tier 3 Batches (2, 3, 4)
echo ========================================
echo.

echo [*] Starting Batch 2: Motherboard + GPU (1,000 examples)
echo [*] Started at %TIME%
python generate_batch_async.py "output/batches_for_deepseek/tier3/tier3_batch_002_mobo_gpu.jsonl" "output/tier3_batch_002_COMPLETE.jsonl" 1000 15
echo [*] Batch 2 completed at %TIME%
echo.

echo [*] Starting Batch 3: PSU + Cooling (1,000 examples)
echo [*] Started at %TIME%
python generate_batch_async.py "output/batches_for_deepseek/tier3/tier3_batch_003_psu_cooling.jsonl" "output/tier3_batch_003_COMPLETE.jsonl" 1000 15
echo [*] Batch 3 completed at %TIME%
echo.

echo [*] Starting Batch 4: RAM + CPU (1,000 examples)
echo [*] Started at %TIME%
python generate_batch_async.py "output/batches_for_deepseek/tier3/tier3_batch_004_ram_cpu.jsonl" "output/tier3_batch_004_COMPLETE.jsonl" 1000 15
echo [*] Batch 4 completed at %TIME%
echo.

echo ========================================
echo All batches complete!
echo ========================================
pause
