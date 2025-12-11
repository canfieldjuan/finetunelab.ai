# DEFINITIVE TRAINING CONFIGURATION

**DO NOT MODIFY THIS CONFIG WITHOUT EXPLICIT APPROVAL**

This document defines the EXACT configuration that must be used for training.
Any deviation from these settings must be documented and approved.

---

## EXACT Model Configuration

### Model
```
Qwen/Qwen3-0.6B
```
**DO NOT CHANGE THE MODEL**

### Dataset
```
C:/Users/Juan/Desktop/Dev_Ops/finetune-lab/hybrid_training_1k_test.jsonl
```
**DO NOT CHANGE THE DATASET PATH**

---

## Complete Training Configuration

**File:** `lib/training/test_1k_payload.json`

```json
{
  "execution_id": "qwen3-1k-final-run",
  "dataset_path": "C:/Users/Juan/Desktop/Dev_Ops/finetune-lab/hybrid_training_1k_test.jsonl",
  "config": {
    "model": {
      "name": "Qwen/Qwen3-0.6B"
    },
    "lora": {
      "r": 8,
      "alpha": 16,
      "dropout": 0.05,
      "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"]
    },
    "data": {
      "strategy": "chat"
    },
    "training": {
      "method": "sft",
      "num_epochs": 1,
      "batch_size": 4,
      "learning_rate": 0.0002,
      "warmup_steps": 25,
      "logging_steps": 50
    }
  }
}
```

---

## Submit Training Job

**ONLY use this command:**

```bash
curl -s http://localhost:8000/api/training/execute \
  -X POST \
  -H "Content-Type: application/json" \
  -d @lib/training/test_1k_payload.json
```

---

## Expected Behavior

### Dataset
- **Total examples:** 1,000
- **Train examples:** 800
- **Eval examples:** 200

### Training Steps
- **Total steps:** 200 (800 examples / 4 batch size = 200)
- **Logging every:** 50 steps
- **Expected metric points:** ~5 (steps 50, 100, 150, 200, plus eval)

### Metrics Persistence
With the fixed code, you should see these logs:

```
[Persistence] Found X new metrics (total: Y, persisted: Z)
[Persistence] Successfully persisted metrics N-M
```

### Final Verification
```bash
# Count metrics in progress.json
python -c "import json; d=json.load(open('lib/training/logs/job_JOBID/progress.json')); print(f'Metrics: {len(d.get(\"metrics_history\", []))}')"
```

---

## What Changed (Metrics Persistence Fix)

### File: `lib/training/training_server.py`

**Line 321:**
```python
last_persisted_count = 0  # Track count of persisted metrics
```

**Lines 391-401:** Incremental persistence during monitoring
```python
# Persist new metrics incrementally
metrics_history = progress_data.get("metrics_history", [])
total_metrics = len(metrics_history)
if total_metrics > last_persisted_count:
    new_metrics = metrics_history[last_persisted_count:]
    logger.info(f"[Persistence] Found {len(new_metrics)} new metrics (total: {total_metrics}, persisted: {last_persisted_count})")
    if persist_metrics(job_id, new_metrics):
        last_persisted_count = total_metrics
        logger.info(f"[Persistence] Successfully persisted metrics {last_persisted_count - len(new_metrics) + 1}-{last_persisted_count}")
else:
    logger.debug(f"[Persistence] No new metrics to persist (total: {total_metrics})")
```

**Lines 477-493:** Final persistence check
```python
# Wait for training process to finalize progress.json, then persist any remaining metrics
logger.info(f"[Monitor] Job {job_id}: Checking for final metrics...")
await asyncio.sleep(2)

if progress_file.exists():
    try:
        with open(progress_file, 'r', encoding='utf-8') as f:
            final_progress_data = json.load(f)

        final_metrics_history = final_progress_data.get("metrics_history", [])
        total_final_metrics = len(final_metrics_history)
        logger.info(f"[Persistence] Final metrics check: {total_final_metrics} total, {last_persisted_count} already persisted")

        if total_final_metrics > last_persisted_count:
            remaining_metrics = final_metrics_history[last_persisted_count:]
            logger.info(f"[Persistence] Persisting {len(remaining_metrics)} remaining final metrics for job {job_id}")
            if persist_metrics(job_id, remaining_metrics):
                logger.info(f"[Persistence] All {total_final_metrics} metrics persisted successfully")
```

---

## Monitoring Logs

### Check Persistence Logs
```bash
# View persistence activity
type lib\training\logs\job_JOBID.log | findstr "Persistence"
```

### Expected Log Output
```
[Persistence] Found 1 new metrics (total: 1, persisted: 0)
[Persistence] Successfully persisted metrics 1-1
[Persistence] Found 1 new metrics (total: 2, persisted: 1)
[Persistence] Successfully persisted metrics 2-2
...
[Persistence] Final metrics check: 5 total, 5 already persisted
[Persistence] All metrics already persisted during monitoring
```

---

## DO NOT

❌ **DO NOT** change the model name
❌ **DO NOT** change the dataset path
❌ **DO NOT** change logging_steps without verification
❌ **DO NOT** modify test_1k_payload.json directly
❌ **DO NOT** create new test configs

---

## If You Need To Test

1. **Copy the payload file first:**
   ```bash
   cp lib/training/test_1k_payload.json lib/training/test_YOURNAME.json
   ```

2. **Make changes to the COPY**

3. **Document what you changed and WHY**

4. **Test with the copy:**
   ```bash
   curl -s http://localhost:8000/api/training/execute \
     -X POST \
     -H "Content-Type: application/json" \
     -d @lib/training/test_YOURNAME.json
   ```

5. **DO NOT commit the test file**

---

**Last Updated:** 2025-10-27
**Status:** PRODUCTION - DO NOT MODIFY
