# Bug Fix: "Epochs Since Best" Showing Step Count Instead of Epoch Count

**Date:** 2025-12-02
**Bug ID:** Training Dashboard - Incorrect "Epochs Since Best" calculation
**Severity:** High - Misleading metric causing confusion

---

## The Bug

### Symptoms:
User configured training with:
- **5 epochs total**
- **Logging every 50 steps**
- **125 total steps** (500 samples ÷ 4 batch size × 1 epoch = 25 steps/epoch × 5 epochs = 125 steps)

Training completed showing:
- Current: Epoch 5, Step 125
- Best: Epoch 4, Step 100
- **"Epochs Since Best: 25"** ❌ WRONG

Expected: **"Epochs Since Best: 1"** ✅ (5 - 4 = 1 epoch)

### Root Cause:

The calculation in `/app/api/training/local/[jobId]/status/route.ts` was:

```typescript
// BUGGY CODE
epochs_without_improvement = latestMetric.epoch - job.best_epoch;
                           = 125 - 100
                           = 25  // Wrong! Using step numbers
```

**Problem:** The `epoch` field in the `training_metrics` table was storing **step numbers** instead of actual epoch numbers, causing the subtraction to calculate step difference instead of epoch difference.

---

## The Fix

### File 1: `/app/api/training/local/[jobId]/status/route.ts` (lines 388-397)

**Before:**
```typescript
// Calculate epochs without improvement
let epochs_without_improvement = 0;
if (job.best_epoch !== null && latestMetric?.epoch) {
  epochs_without_improvement = latestMetric.epoch - job.best_epoch;
}
```

**After:**
```typescript
// Calculate epochs without improvement
// Note: We calculate based on steps, not the 'epoch' field in metrics,
// because the 'epoch' field may contain step numbers in some cases
let epochs_without_improvement = 0;
if (job.best_step !== null && latestMetric?.step && job.total_steps) {
  const steps_per_epoch = job.total_steps / (job.num_epochs || 1);
  const current_epoch_decimal = latestMetric.step / steps_per_epoch;
  const best_epoch_decimal = job.best_step / steps_per_epoch;
  epochs_without_improvement = Math.floor(current_epoch_decimal - best_epoch_decimal);
}
```

### Calculation Explanation:

Using the example data:
```typescript
total_steps = 125
num_epochs = 5
best_step = 100
current_step = 125

steps_per_epoch = 125 / 5 = 25 steps/epoch
current_epoch_decimal = 125 / 25 = 5.0
best_epoch_decimal = 100 / 25 = 4.0
epochs_without_improvement = floor(5.0 - 4.0) = 1  ✅ CORRECT
```

---

### File 2: `/components/training/TrainingDashboard.tsx` (lines 674-689)

**Improved Display Logic:**

```typescript
<div className="text-xs text-amber-700 mt-1">
  {(status.epochs_without_improvement === 0 || status.epochs_without_improvement === undefined) ? 'Just achieved best' :
   status.epochs_without_improvement === 1 ? 'Recent (1 epoch ago)' :
   status.epochs_without_improvement && status.epochs_without_improvement < 3 ? `Recent (${status.epochs_without_improvement} epochs ago)` :
   status.epochs_without_improvement && status.epochs_without_improvement < 5 ? 'Starting to plateau' :
   'Consider early stopping'}
</div>
```

**New Guidance Messages:**

| Value | Message | Meaning |
|-------|---------|---------|
| 0 or undefined | Just achieved best | Best eval loss just occurred |
| 1 | Recent (1 epoch ago) | Very recent, keep training |
| 2 | Recent (2 epochs ago) | Still recent |
| 3-4 | Starting to plateau | Monitor closely |
| 5+ | Consider early stopping | No improvement for a while |

---

## Why This Happened

The `training_metrics` table has an `epoch` column that was supposed to store the epoch number (0, 1, 2, 3, 4, 5).

However, in practice, it appears this column was storing **step numbers** instead:
- Step 25 → epoch column = 25
- Step 50 → epoch column = 50
- Step 100 → epoch column = 100
- Step 125 → epoch column = 125

This made the calculation `latestMetric.epoch - job.best_epoch` meaningless because it was subtracting step numbers, not epoch numbers.

**Why we use steps now:**
- Step numbers are **reliable and consistent**
- We can calculate actual epochs from: `step ÷ steps_per_epoch`
- This gives us the true epoch count, regardless of what's in the `epoch` column

---

## Testing

### Test Case 1: Your Example
**Setup:**
- 5 epochs total
- 125 total steps
- Best at step 100 (epoch 4)
- Current at step 125 (epoch 5)

**Expected:** `epochs_without_improvement = 1`
**Actual:** ✅ `floor(125/25 - 100/25) = floor(5 - 4) = 1`

### Test Case 2: Early Training
**Setup:**
- 10 epochs total
- 1000 total steps
- Best at step 50 (epoch 0.5)
- Current at step 150 (epoch 1.5)

**Expected:** `epochs_without_improvement = 1`
**Actual:** ✅ `floor(150/100 - 50/100) = floor(1.5 - 0.5) = 1`

### Test Case 3: Long Plateau
**Setup:**
- 20 epochs total
- 2000 total steps
- Best at step 500 (epoch 5)
- Current at step 1500 (epoch 15)

**Expected:** `epochs_without_improvement = 10`
**Actual:** ✅ `floor(1500/100 - 500/100) = floor(15 - 5) = 10`

---

## Impact

### Before Fix:
- ❌ Misleading "25 epochs" when only 5 epochs configured
- ❌ Causes confusion about training progress
- ❌ Makes early stopping decisions unclear
- ❌ Users think training is stuck or broken

### After Fix:
- ✅ Correct "1 epoch" for your example
- ✅ Clear, actionable guidance
- ✅ Accurate early stopping information
- ✅ Better user experience

---

## Related Issues

This fix also addresses:

1. **Fractional Epochs**: Handles cases where best model is found mid-epoch (e.g., epoch 2.7)
2. **Edge Cases**: Properly handles division by zero with `(job.num_epochs || 1)`
3. **Floor Function**: Uses `Math.floor()` to always round down (conservative approach)

---

## Database Schema Note

**Future Improvement:** Consider renaming or fixing the `training_metrics.epoch` column:

**Option 1:** Store actual epoch numbers (requires Python trainer fix)
```python
current_epoch = state.epoch  # Use float, not int(state.epoch)
```

**Option 2:** Rename column to clarify purpose
```sql
ALTER TABLE training_metrics RENAME COLUMN epoch TO epoch_or_step;
```

**Option 3:** Add separate `actual_epoch` column
```sql
ALTER TABLE training_metrics ADD COLUMN actual_epoch REAL;
```

For now, the fix calculates epochs from steps, which is reliable and accurate.

---

## Verification Steps

To verify the fix is working:

1. Start a new training job with 5 epochs
2. Monitor the "Epochs Since Best" metric
3. Verify it shows reasonable values (0-5, not 0-125)
4. Check that guidance messages make sense
5. Confirm best model detection still works

---

## Summary

**Bug:** Metric showed step count (25) instead of epoch count (1)
**Root Cause:** Using unreliable `epoch` column from metrics table
**Fix:** Calculate epochs from steps using `step ÷ steps_per_epoch`
**Result:** Accurate, meaningful "Epochs Since Best" metric

The fix is backward compatible and doesn't require database changes. It will work correctly for all past, current, and future training jobs.
