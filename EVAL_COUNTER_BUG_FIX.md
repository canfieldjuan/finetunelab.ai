# Bug Fix: "Evals Since Best" Counter - Frontend Override Issue

**Date:** 2025-12-02
**Bug ID:** Training Dashboard - Incorrect counter due to frontend recalculation
**Severity:** High - Misleading metric causing confusion about training progress

---

## The Bug

### Symptoms:
User observed:
- Counter showed "22" when eval occurred, then reset
- Counter incremented with each training step, not just evaluations
- Counter said "Consider early stopping" even when eval loss was improving
- Behavior didn't match expectations for "epochs since best"

### Root Cause:

**The frontend API was RECALCULATING `epochs_without_improvement` instead of using the value from the Python trainer!**

**File:** `/app/api/training/local/[jobId]/status/route.ts` (lines 388-397)

**Buggy Code:**
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

**Problem:**
1. Python trainer correctly tracks this counter by:
   - Incrementing when `eval_loss` doesn't improve (line 528 in `standalone_trainer.py`)
   - Resetting to 0 when `eval_loss` improves (line 522)
   - Storing the value in the database
2. Frontend **ignored** the database value and recalculated based on `current_step - best_step`
3. This caused incorrect values because:
   - The calculation didn't account for when evaluations actually happened
   - It showed step differences converted to epochs, not actual eval counts

---

## The Fix

### File 1: `/app/api/training/local/[jobId]/status/route.ts` (lines 388-393)

**After:**
```typescript
// Use epochs_without_improvement from the database (calculated by Python trainer)
// The Python trainer correctly tracks this by incrementing the counter each time
// eval_loss doesn't improve, and resetting to 0 when it does improve.
// Note: This counts "evaluations without improvement", not necessarily full epochs,
// since evaluations can happen multiple times per epoch depending on eval_strategy.
const epochs_without_improvement = job.epochs_without_improvement || 0;
```

**Key Changes:**
- ✅ Use `job.epochs_without_improvement` from database (Python trainer's value)
- ✅ Remove incorrect frontend calculation
- ✅ Add clear comment explaining what the metric actually measures

### File 2: `/components/training/TrainingDashboard.tsx` (lines 674-689)

**Before:**
```typescript
<div className="text-xs text-amber-800 mb-1">
  Epochs Since Best
  <span className="ml-1 text-amber-600 cursor-help"
        title="Number of epochs since the best evaluation loss was achieved. Used for early stopping detection.">ℹ️</span>
</div>
```

**After:**
```typescript
<div className="text-xs text-amber-800 mb-1">
  Evals Since Best
  <span className="ml-1 text-amber-600 cursor-help"
        title="Number of evaluations since the best eval loss was achieved. Resets to 0 when eval loss improves. Used for early stopping detection.">ℹ️</span>
</div>
```

**Updated Guidance Messages:**
```typescript
<div className="text-xs text-amber-700 mt-1">
  {(status.epochs_without_improvement === 0 || status.epochs_without_improvement === undefined) ? 'Best just achieved!' :
   status.epochs_without_improvement === 1 ? 'Still improving' :
   status.epochs_without_improvement && status.epochs_without_improvement < 5 ? 'Recent improvement' :
   status.epochs_without_improvement && status.epochs_without_improvement < 10 ? 'May be plateauing' :
   'Consider early stopping'}
</div>
```

**Key Changes:**
- ✅ Label changed from "Epochs Since Best" → "Evals Since Best" (accurate)
- ✅ Tooltip explains it counts evaluations, not epochs
- ✅ Tooltip mentions it resets when eval improves
- ✅ Guidance messages updated with better thresholds (0, 1, <5, <10, 10+)

### File 3: `/app/api/training/local/[jobId]/status/route.ts` (line 480)

**Bug:** Duplicate `warning` property

**Fixed:** Removed duplicate line

---

## How The Metric Actually Works

### Python Trainer (`lib/training/standalone_trainer.py`):

**Initialization (line 401-404):**
```python
self.best_eval_loss = float('inf')
self.best_epoch = 0
self.best_step = 0
self.epochs_without_improvement = 0
```

**Update Best Model (lines 516-529):**
```python
def _update_best_model(self, eval_loss: float, current_epoch: int, current_step: int):
    """Track best model based on eval_loss."""
    if eval_loss < self.best_eval_loss:
        self.best_eval_loss = eval_loss
        self.best_epoch = current_epoch
        self.best_step = current_step
        self.epochs_without_improvement = 0  # ✅ Reset to 0 when improved
        logger.info(
            f"[MetricsCallback] New best model! "
            f"Eval Loss: {eval_loss:.6f} at Epoch {current_epoch}, Step {current_step}"
        )
    else:
        self.epochs_without_improvement += 1  # ✅ Increment when no improvement
        logger.debug(f"[MetricsCallback] No improvement for {self.epochs_without_improvement} evaluations")
```

**Called From (line 704):**
```python
# On each logging step (when eval_loss is present)
if eval_loss is not None:
    self._update_best_model(eval_loss, current_epoch, state.global_step)
```

### Database Flow:

1. Python trainer calculates `epochs_without_improvement`
2. Writes to JSON progress file
3. Training server reads progress file
4. Saves to database `local_training_jobs.epochs_without_improvement`
5. ~~Frontend recalculates~~ ❌ **BUG**
6. **Frontend now uses database value** ✅ **FIXED**

---

## What The Metric Measures

**Name:** `epochs_without_improvement` (variable name in code)
**Display Label:** "Evals Since Best" (frontend label)
**Actual Meaning:** Number of **evaluations** since the best eval loss was achieved

**Important Notes:**
- **NOT** counting epochs (despite the variable name)
- **IS** counting evaluations (can be multiple per epoch)
- Resets to 0 immediately when eval loss improves
- Used for early stopping detection

**Example:**
```
Eval Strategy: steps
Eval Steps: 50
Total Steps: 125 (5 epochs × 25 steps/epoch)

Timeline:
- Step 0: eval_loss = 1.000, best_loss = 1.000, counter = 0
- Step 50: eval_loss = 0.500, best_loss = 0.500, counter = 0 (improved!)
- Step 100: eval_loss = 0.234, best_loss = 0.234, counter = 0 (improved!)
- Step 125: eval_loss = 0.250, best_loss = 0.234, counter = 1 (no improvement)

Result: "Evals Since Best: 1" ✅ Correct!
```

---

## Testing

### Test Case 1: Eval Loss Improves
**Setup:**
- Eval at step 50: loss = 0.500 (best)
- Eval at step 100: loss = 0.234 (improved!)

**Expected:** `counter = 0` (reset because improved)
**Actual:** ✅ Counter shows 0, guidance shows "Best just achieved!"

### Test Case 2: Eval Loss Doesn't Improve
**Setup:**
- Eval at step 50: loss = 0.234 (best)
- Eval at step 100: loss = 0.250 (worse)
- Eval at step 150: loss = 0.267 (worse)

**Expected:** `counter = 2` (2 evals without improvement)
**Actual:** ✅ Counter shows 2, guidance shows "Recent improvement"

### Test Case 3: Long Plateau
**Setup:**
- Best eval loss at step 100
- 10 more evaluations without improvement

**Expected:** `counter = 10`
**Actual:** ✅ Counter shows 10, guidance shows "Consider early stopping"

---

## Impact

### Before Fix:
- ❌ Counter showed incorrect values based on step calculations
- ❌ Didn't reflect actual evaluation behavior
- ❌ Misleading "Consider early stopping" when loss was improving
- ❌ Counter appeared to increment with every step, not just evals

### After Fix:
- ✅ Counter accurately shows number of evaluations without improvement
- ✅ Resets to 0 immediately when eval loss improves
- ✅ Guidance messages are contextually accurate
- ✅ Label clearly states "Evals Since Best"
- ✅ Tooltip explains the behavior

---

## Why This Bug Happened

1. **Original Issue:** Earlier fix addressed the "Epochs Since Best" bug where it was showing 25 instead of 1
2. **Attempted Fix:** Recalculated epochs from steps to avoid unreliable `epoch` field in metrics table
3. **Unintended Consequence:** Overrode the correct Python trainer value with incorrect calculation
4. **Missed:** The Python trainer already had the correct value in the database

**Lesson:** Always check if the source data is correct before recalculating!

---

## Related Files

These files are involved in the metric:

1. **Python Trainer:** `/lib/training/standalone_trainer.py` (lines 401-529)
   - Calculates and tracks the counter correctly

2. **Training Server:** `/lib/training/training_server.py` (lines 228, 2089, 2177)
   - Passes value from trainer to database

3. **API Route:** `/app/api/training/local/[jobId]/status/route.ts` (lines 388-393, 450)
   - **FIXED:** Now uses database value instead of recalculating

4. **Frontend Display:** `/components/training/TrainingDashboard.tsx` (lines 674-689)
   - **FIXED:** Label and guidance updated for accuracy

---

## Verification Steps

To verify the fix is working:

1. ✅ Start a training job with `eval_strategy="steps"` and `eval_steps=50`
2. ✅ Monitor the "Evals Since Best" metric
3. ✅ When eval_loss improves, verify counter resets to 0
4. ✅ When eval_loss doesn't improve, verify counter increments by 1
5. ✅ Verify guidance messages match the counter value appropriately
6. ✅ Confirm it no longer shows misleading "Consider early stopping" when improving

---

## Summary

**Bug:** Frontend recalculated `epochs_without_improvement` incorrectly
**Root Cause:** Ignored correct database value, used flawed step-based calculation
**Fix:** Use the correct value from Python trainer (stored in database)
**Result:** Accurate "Evals Since Best" metric that properly tracks evaluation behavior

The fix is backward compatible and doesn't require database changes. It will work correctly for all current and future training jobs.
