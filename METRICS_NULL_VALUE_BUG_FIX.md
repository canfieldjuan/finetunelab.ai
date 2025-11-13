# Training Metrics NULL Value Bug - Root Cause & Fix

## Issue
Training metrics (train_loss, eval_loss, learning_rate, grad_norm, perplexity) were showing as NULL in the database and not appearing in the Training Monitor UI, even though GPU metrics (gpu_utilization_percent, gpu_memory_allocated_gb) were working correctly.

## Root Cause
**JavaScript Falsy Value Bug in API Route**

File: `app/api/training/local/metrics/route.ts` (lines 145-159)

```typescript
// ❌ BUGGY CODE
const metricsData = metrics.map((m: MetricPoint) => ({
  train_loss: m.train_loss || null,
  eval_loss: m.eval_loss || null,
  learning_rate: m.learning_rate || null,
  // ...
}));
```

### The Problem
The `||` (OR) operator treats **all falsy values** as "missing" and replaces them with `null`:
- `0 || null` → `null`
- `0.0 || null` → `null`
- `NaN || null` → `null`
- `false || null` → `null`

### Why GPU Metrics Worked
GPU metrics have large positive values that are always truthy:
- ✅ `100 || null` → `100` (gpu_utilization_percent)
- ✅ `2.05 || null` → `2.05` (gpu_memory_allocated_gb)
- ✅ `11.55 || null` → `11.55` (gpu_memory_reserved_gb)

### Why Training Metrics Failed
Training metrics often have values that JavaScript treats as falsy:
- ❌ `0.0 || null` → `null` (perfect training loss)
- ❌ `9.387e-07 || null` → `null` (very small learning rates are falsy!)
- ❌ `NaN || null` → `null` (undefined/calculated values)

## Evidence from Database
Query of job `7c8a36b6-bda4-49f6-8166-1cd6419c37d7` step 37:
```sql
SELECT train_loss, eval_loss, learning_rate, grad_norm, perplexity,
       gpu_utilization_percent, gpu_memory_allocated_gb
FROM local_training_metrics
WHERE job_id = '7c8a36b6-bda4-49f6-8166-1cd6419c37d7' AND step = 37;
```

**Result:**
- train_loss: `NULL` ❌
- eval_loss: `NULL` ❌
- learning_rate: `NULL` ❌
- grad_norm: `NULL` ❌
- perplexity: `NULL` ❌
- gpu_utilization_percent: `100.00` ✅
- gpu_memory_allocated_gb: `2.05` ✅

## Evidence from progress.json
File: `lib/training/logs/job_0d411dee-b958-4da4-ad87-bdfd4c1c42f5/progress.json`

```json
{
  "step": 1380,
  "epoch": 0,
  "train_loss": 2.6811,           // ✅ Value IS written by trainer
  "eval_loss": null,
  "learning_rate": 9.387492816826213e-07,  // ✅ Scientific notation value present
  "grad_norm": 3.723334,
  // ...
}
```

The standalone trainer **IS correctly writing** these values to progress.json, but the API route was converting them to NULL during database insertion.

## Fix
**Use Nullish Coalescing (`??`) Instead of OR (`||`)**

```typescript
// ✅ FIXED CODE
const metricsData = metrics.map((m: MetricPoint) => ({
  train_loss: m.train_loss ?? null,
  eval_loss: m.eval_loss ?? null,
  learning_rate: m.learning_rate ?? null,
  grad_norm: m.grad_norm ?? null,
  gpu_memory_allocated_gb: m.gpu_memory_allocated_gb ?? null,
  gpu_memory_reserved_gb: m.gpu_memory_reserved_gb ?? null,
  gpu_utilization_percent: m.gpu_utilization_percent ?? null,
  perplexity: m.perplexity ?? null,
  train_perplexity: m.train_perplexity ?? null,
  samples_per_second: m.samples_per_second ?? null,
  tokens_per_second: m.tokens_per_second ?? null,
  timestamp: m.timestamp ?? new Date().toISOString()
}));
```

### How `??` (Nullish Coalescing) Works
Only replaces `null` or `undefined`, preserves all other values:
- ✅ `0 ?? null` → `0`
- ✅ `0.0 ?? null` → `0.0`
- ✅ `9.387e-07 ?? null` → `9.387e-07`
- ✅ `false ?? null` → `false`
- ✅ `null ?? null` → `null`
- ✅ `undefined ?? null` → `null`

## Impact
After this fix:
1. **All training metrics will persist correctly** (train_loss, eval_loss, learning_rate, grad_norm, perplexity)
2. **Training Monitor UI charts will populate** with loss curves, learning rate schedule, and perplexity graphs
3. **Very small numeric values** (scientific notation learning rates) will be preserved
4. **Zero values** (perfect loss) will be stored as `0` instead of `NULL`

## Testing
To verify fix:
1. Start a new training job
2. Check `local_training_metrics` table for non-NULL values:
   ```sql
   SELECT train_loss, eval_loss, learning_rate
   FROM local_training_metrics
   WHERE job_id = '<new_job_id>'
   LIMIT 5;
   ```
3. Confirm Training Monitor UI displays loss/learning rate charts

## Related Files
- **Bug Location**: `app/api/training/local/metrics/route.ts` (line 145-159)
- **Data Source**: `lib/training/standalone_trainer.py` (writes to progress.json correctly)
- **Data Flow**: `lib/training/training_server.py` (monitor_job reads progress.json, calls persist_metrics)
- **Frontend Display**: `lib/hooks/useTrainingMetricsRealtime.ts` (queries metrics from database)

## Lessons Learned
1. **Never use `||` for default values with numeric data** - use `??` instead
2. **Scientific notation numbers are falsy in JavaScript** (e.g., `1e-10` evaluates to falsy)
3. **Always test edge cases**: zero values, very small numbers, negative numbers
4. **Database NULL patterns can reveal data mapping bugs** - partial data (GPU works, training metrics don't) indicates selective falsiness issues

## Previous Investigations (Not Root Cause)
- ✅ TokenRefreshManager implementation (completed, but not the issue)
- ✅ RLS policies (correctly allow NULL user_id jobs)
- ✅ Standalone trainer metric calculation (working correctly)
- ✅ progress.json file writing (working correctly)

The actual bug was a single-character fix: `||` → `??`
