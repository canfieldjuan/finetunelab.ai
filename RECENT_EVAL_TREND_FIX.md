# Fix: Recent Eval Trend Metric (Binary Comparison)

**Date:** 2025-12-02
**Issue:** Metric was cumulatively counting all non-improving evals, showing values like "25" when only 10 total evals occurred
**Fix:** Changed to binary comparison (0 or 1) between most recent eval and previous eval

---

## The Problem

### Old Behavior (WRONG):
```python
# Compared EVERY eval to the ALL-TIME best
if eval_loss < self.best_eval_loss:
    self.epochs_without_improvement = 0
else:
    self.epochs_without_improvement += 1  # Kept incrementing!
```

**Result:** With 10 evals total, counter could show "25" because it counted every non-best eval since training started.

**Example:**
```
Eval 1: loss=1.0 → best=1.0, counter=0
Eval 2: loss=0.5 → best=0.5, counter=0 (improved!)
Eval 3: loss=0.6 → best=0.5, counter=1 (worse than best)
Eval 4: loss=0.7 → best=0.5, counter=2 (worse than best)
...
Eval 10: loss=0.55 → best=0.5, counter=9 (worse than best, but better than Eval 9!)
```

### New Behavior (CORRECT):
```python
# Compare current eval to PREVIOUS eval only
if self.last_eval_loss is not None:
    if eval_loss < self.last_eval_loss:
        self.epochs_without_improvement = 0  # Recent improvement
    else:
        self.epochs_without_improvement = 1  # No recent improvement

# Update for next comparison
self.last_eval_loss = eval_loss
```

**Result:** Binary indicator (0 or 1) showing if the most recent eval improved compared to the previous one.

**Example:**
```
Eval 1: loss=1.0 → previous=None, counter=0
Eval 2: loss=0.5 → previous=1.0, improved=Yes, counter=0
Eval 3: loss=0.6 → previous=0.5, improved=No, counter=1
Eval 4: loss=0.7 → previous=0.6, improved=No, counter=1
Eval 5: loss=0.55 → previous=0.7, improved=Yes, counter=0
```

---

## Changes Made

### File 1: `/lib/training/standalone_trainer.py`

#### Change 1: Added tracking for previous eval (lines 406-407)
```python
# Track previous eval for recent improvement detection
self.last_eval_loss = None
```

#### Change 2: Updated comparison logic (lines 519-546)
```python
def _update_best_model(self, eval_loss: float, current_epoch: int, current_step: int):
    """Track best model based on eval_loss."""
    # Update all-time best model (still track this for checkpoint selection)
    if eval_loss < self.best_eval_loss:
        self.best_eval_loss = eval_loss
        self.best_epoch = current_epoch
        self.best_step = current_step
        logger.info(
            f"[MetricsCallback] New best model! "
            f"Eval Loss: {eval_loss:.6f} at Epoch {current_epoch}, Step {current_step}"
        )

    # Check if current eval improved compared to the PREVIOUS eval (not all-time best)
    # This gives a binary indicator: did the last eval show improvement?
    if self.last_eval_loss is not None:
        if eval_loss < self.last_eval_loss:
            self.epochs_without_improvement = 0  # Recent improvement
            logger.debug(f"[MetricsCallback] Recent improvement: {self.last_eval_loss:.6f} → {eval_loss:.6f}")
        else:
            self.epochs_without_improvement = 1  # No recent improvement
            logger.debug(f"[MetricsCallback] No recent improvement: {self.last_eval_loss:.6f} → {eval_loss:.6f}")
    else:
        # First eval, consider it as improvement
        self.epochs_without_improvement = 0
        logger.debug(f"[MetricsCallback] First evaluation: {eval_loss:.6f}")

    # Update last eval for next comparison
    self.last_eval_loss = eval_loss
```

**Key Points:**
- Still tracks `best_eval_loss` (all-time best) for checkpoint selection
- Now also tracks `last_eval_loss` (previous eval) for trend detection
- Binary output: 0 = improved, 1 = didn't improve

### File 2: `/components/training/TrainingDashboard.tsx`

#### Updated display (lines 674-685)
```typescript
<div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
  <div className="text-xs text-amber-800 mb-1">
    Recent Eval Trend
    <span className="ml-1 text-amber-600 cursor-help"
          title="Compares the most recent eval loss to the previous eval. Shows whether the last evaluation improved or not.">
      ℹ️
    </span>
  </div>
  <div className="text-lg font-semibold text-amber-900">
    {(status.epochs_without_improvement === 0 || status.epochs_without_improvement === undefined)
      ? '↓ Improving'
      : '↑ Not Improving'}
  </div>
  <div className="text-xs text-amber-700 mt-1">
    {(status.epochs_without_improvement === 0 || status.epochs_without_improvement === undefined)
      ? 'Last eval was better than previous'
      : 'Last eval was worse than previous'}
  </div>
</div>
```

**Changes:**
- Label: "Evals Since Best" → "Recent Eval Trend"
- Display: Shows "↓ Improving" or "↑ Not Improving" instead of a count
- Tooltip: Explains it compares recent vs previous eval
- Message: Clear explanation of what happened

---

## How It Works Now

### Training Flow:
1. **First Eval** (step 75): loss=1.0
   - `last_eval_loss = None` → set to 0 (first eval)
   - `last_eval_loss = 1.0` (store for next time)
   - Display: "↓ Improving"

2. **Second Eval** (step 150): loss=0.5
   - `0.5 < 1.0` → set to 0 (improved!)
   - `last_eval_loss = 0.5` (store for next time)
   - Display: "↓ Improving"

3. **Third Eval** (step 225): loss=0.6
   - `0.6 > 0.5` → set to 1 (didn't improve)
   - `last_eval_loss = 0.6` (store for next time)
   - Display: "↑ Not Improving"

4. **Fourth Eval** (step 300): loss=0.55
   - `0.55 < 0.6` → set to 0 (improved!)
   - `last_eval_loss = 0.55` (store for next time)
   - Display: "↓ Improving"

---

## Important Notes

### For Existing Training Jobs:
**⚠️ The fix only applies to NEW training jobs started AFTER this code change.**

Existing running training jobs:
- Are using the old code (already loaded in memory)
- Will continue showing the old cumulative count
- Must be stopped and restarted to use new logic

Completed training jobs:
- Have old values stored in database
- Cannot be retroactively fixed
- New jobs will have correct values

### To Apply the Fix:
1. Stop any currently running training jobs
2. Start a new training job
3. The new job will use the updated logic
4. You'll see "↓ Improving" or "↑ Not Improving" instead of high numbers

---

## Testing

### Expected Behavior:
- Metric should only show "↓ Improving" (0) or "↑ Not Improving" (1)
- Should reset to "↓ Improving" whenever eval loss decreases compared to previous eval
- Should show "↑ Not Improving" whenever eval loss increases or stays same compared to previous eval
- Should never show numbers like 2, 5, 10, 25, etc.

### Test Cases:

**Case 1: Consistent Improvement**
```
Eval 1: 1.0 → "↓ Improving"
Eval 2: 0.8 → "↓ Improving"
Eval 3: 0.6 → "↓ Improving"
Eval 4: 0.5 → "↓ Improving"
```

**Case 2: Consistent Degradation**
```
Eval 1: 0.5 → "↓ Improving" (first eval)
Eval 2: 0.6 → "↑ Not Improving"
Eval 3: 0.7 → "↑ Not Improving"
Eval 4: 0.8 → "↑ Not Improving"
```

**Case 3: Oscillating**
```
Eval 1: 1.0 → "↓ Improving"
Eval 2: 0.5 → "↓ Improving"
Eval 3: 0.7 → "↑ Not Improving"
Eval 4: 0.6 → "↓ Improving"
Eval 5: 0.8 → "↑ Not Improving"
```

---

## Debugging

If the metric shows opposite of reality:

1. **Check Python logs** for debug messages:
   ```
   [MetricsCallback] Recent improvement: 0.600 → 0.500
   [MetricsCallback] No recent improvement: 0.500 → 0.600
   ```

2. **Check progress file**:
   ```bash
   jq '{eval_loss, epochs_without_improvement}' /tmp/training_progress_*.json
   ```

3. **Verify code is running**: Old training jobs use old code
   - Stop training
   - Restart training
   - Check it's using new logic

4. **Check actual eval loss values**: Confirm last eval really did improve
   ```bash
   jq '.metrics_history[] | select(.eval_loss != null) | {step, eval_loss}' /tmp/training_progress_*.json | tail -10
   ```

---

## Summary

**Old Behavior:**
- Cumulative count of all non-best evals
- Could show values >> total number of evals
- Confusing and misleading

**New Behavior:**
- Binary comparison: current eval vs previous eval
- Shows 0 (improving) or 1 (not improving)
- Clear visual indicator: ↓ Improving or ↑ Not Improving
- Accurate representation of recent training dynamics

**Impact:**
- ✅ More intuitive metric
- ✅ Easier to understand if model is making progress
- ✅ No more confusing high numbers
- ✅ Clear visual feedback
