# Checkpoint Scoring Optimization

**Date:** 2025-12-08
**Status:** In Progress
**Priority:** High (Performance Fix)

---

## Problem Statement

Terminal logs in the training monitor were being flooded with repeated `CheckpointScorer` messages:
```
[CheckpointScorer] Checkpoint score: 1.216165 (eval=1.157830 + gap=0.007677 + perp=0.050658 + bonus=0.000000)
```

These messages appeared every ~2 seconds with identical values, filling up the log display and obscuring important training information.

---

## Root Cause Analysis

### Issue 1: Logging Level Too Verbose
- `checkpoint_scorer.py` was using `logger.info()` for every score calculation
- Should be `logger.debug()` for routine calculations

**Status:** FIXED (2025-12-08)

### Issue 2: Redundant Calculations in Trainer
**File:** `lib/training/standalone_trainer.py`

**Flow:**
1. `on_step_end()` is called after every training step
2. It calls `_write_progress()` with `self.last_logs` (which contains cached `eval_loss`)
3. `_write_progress()` calls `_update_best_model()` whenever `eval_loss` is present
4. `_update_best_model()` calls `calculate_checkpoint_score()` twice (current + previous best)

**Result:** After an eval step, the same checkpoint score is recalculated on every subsequent training step until the next logging step overwrites `last_logs`.

### Issue 3: Redundant Calculations in Training Server
**File:** `lib/training/training_server.py`

**Flow:**
1. UI polls `/api/training/checkpoints/{job_id}` endpoint
2. Endpoint scans all checkpoint directories on disk
3. For each checkpoint, it recalculates the score from `trainer_state.json`
4. This happens on every API call, even when checkpoints haven't changed

---

## Implementation Plan

### Phase 1: Fix Logging Level (COMPLETED)
**File:** `lib/training/checkpoint_scorer.py`

Changed `logger.info()` to `logger.debug()` at:
- Line 138-142: Main score calculation log
- Line 177: Module initialization log

### Phase 2: Guard Redundant Trainer Calculations
**File:** `lib/training/standalone_trainer.py`

**Changes Required:**

1. Add tracking variable in `__init__`:
```python
self._last_scored_eval_loss = None
```

2. Guard the `_update_best_model()` call (line ~753):
```python
# Before:
if eval_loss is not None:
    self._update_best_model(...)

# After:
if eval_loss is not None and eval_loss != self._last_scored_eval_loss:
    self._update_best_model(...)
    self._last_scored_eval_loss = eval_loss
```

**Risk:** Low - Only affects when scoring happens, not the scoring logic itself

### Phase 3: Cache Checkpoint Scores in Server (DEFERRED)
**File:** `lib/training/training_server.py`

Add in-memory cache for checkpoint scores keyed by `(checkpoint_path, mtime)`.
Only recalculate if checkpoint file has been modified.

**Deferred:** Can be implemented later as a further optimization.

---

## Files Modified

| File | Change | Status |
|------|--------|--------|
| `lib/training/checkpoint_scorer.py` | INFO -> DEBUG logging | COMPLETED |
| `lib/training/standalone_trainer.py` | Guard redundant scoring | COMPLETED |
| `lib/training/training_server.py` | Cache scores | DEFERRED |

## Implementation Details

### Phase 2 Changes (standalone_trainer.py)

**Line 410:** Added tracking variable
```python
self._last_scored_eval_loss = None
```

**Lines 755-764:** Added guard to prevent redundant scoring
```python
# Update best model tracking - only score when we have a NEW eval_loss
# This prevents redundant scoring on every step after an eval
if eval_loss is not None and eval_loss != self._last_scored_eval_loss:
    # Use most recent train_loss if current logs don't have it (happens during eval)
    train_loss_for_scoring = train_loss
    if train_loss_for_scoring is None and len(self.recent_losses) > 0:
        train_loss_for_scoring = self.recent_losses[-1]

    self._update_best_model(eval_loss, current_epoch, state.global_step, train_loss_for_scoring)
    self._last_scored_eval_loss = eval_loss
```

---

## Testing Plan

1. Start a new training run
2. Verify terminal logs no longer show repeated `CheckpointScorer` messages
3. Verify scoring still works correctly:
   - New best checkpoint is detected and logged
   - Best checkpoint info appears in UI
4. Monitor for any regressions in checkpoint selection

---

## Session Context

This fix was identified while improving the Terminal Monitor page:
- Increased terminal log fetch limit from 20 to 100 entries
- Noticed log spam from checkpoint scorer
- Traced back to redundant calculations on every training step

Related changes in same session:
- Fixed BFloat16 dtype mismatch in `predictions_generator.py`
- Reorganized Terminal Monitor card layout
- Added dataset name/ID display in terminal header

---

## Completion Checklist

- [x] Phase 1: Fix logging level in `checkpoint_scorer.py`
- [x] Phase 2: Guard redundant calculations in `standalone_trainer.py`
- [ ] Phase 3: Cache scores in training server (DEFERRED)
- [ ] Verify fix with new training run
- [ ] Update this log with results
