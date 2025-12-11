# RunPod Training Checkpoint Scoring Investigation

**Date**: 2025-12-06
**Status**: ⚠️ MULTI-METRIC SCORING NOT IMPLEMENTED IN RUNPOD
**Goal**: Determine if multi-metric checkpoint scoring works in RunPod training

---

## Investigation Summary

### Question:
Does the multi-metric checkpoint scoring implementation work for RunPod training?

### Answer:
**NO** - RunPod training uses a completely separate training callback and relies on HuggingFace Trainer's built-in checkpoint selection.

---

## Current Implementation Comparison

### Local Training (✅ Has Multi-Metric Scoring)

**File**: `lib/training/standalone_trainer.py`
**Callback**: `MetricsCallback` class (lines 354-830)
**Method**: `_update_best_model()` (lines 519-562)

**Features**:
- ✅ Multi-metric scoring (eval_loss + gap + perplexity + improvement bonus)
- ✅ Tracks `best_eval_loss`, `best_epoch`, `best_step`
- ✅ Calculates checkpoint scores
- ✅ Logs score breakdowns
- ✅ Uses `checkpoint_scorer.py` module

**Checkpoint Selection**:
```python
from lib.training.checkpoint_scorer import calculate_checkpoint_score

current_checkpoint_data = {
    'eval_loss': eval_loss,
    'train_loss': train_loss,
    'epochs_without_improvement': self.epochs_without_improvement
}
current_score = calculate_checkpoint_score(current_checkpoint_data)

if current_score < previous_best_score:
    self.best_eval_loss = eval_loss
    self.best_epoch = current_epoch
    self.best_step = current_step
```

---

### RunPod Training (❌ Does NOT Have Multi-Metric Scoring)

**File**: `lib/training/runpod-service.ts`
**Callback**: `TrainingMetricsCallback` class (embedded in training script, lines 733-883)

**Features**:
- ❌ NO multi-metric scoring
- ❌ NO `_update_best_model()` method
- ❌ NO checkpoint scoring
- ❌ Does NOT import `checkpoint_scorer.py`
- ✅ Only posts metrics to Supabase API

**Purpose**:
```python
class TrainingMetricsCallback(TrainerCallback):
    """Callback to POST training metrics to API during training."""

    def on_log(self, args, state, control, logs=None, **kwargs):
        # Extract metrics and POST to API
        metrics_payload = {
            "step": current_step,
            "loss": logs.get("loss"),
            "eval_loss": logs.get("eval_loss"),
            # ... more metrics
        }
        self._post_metrics(metrics_payload)
```

**Checkpoint Selection**:
RunPod relies on **HuggingFace Trainer's built-in checkpoint selection**:

```python
# Training arguments (line 1097)
load_best_model_at_end=True if eval_strategy != 'no' else False,
metric_for_best_model="${training?.metric_for_best_model || 'loss'}",
```

**Result**: Uses **only eval_loss** for checkpoint selection (HuggingFace default behavior)

---

## Why RunPod is Different

### Architecture Differences:

1. **Local Training**:
   - Runs `standalone_trainer.py` directly
   - Full control over training loop
   - Can use custom callbacks with complex logic
   - Checkpoints saved locally

2. **RunPod Training**:
   - Generates Python script as string (embedded in TypeScript)
   - Deployed to remote RunPod GPU pod
   - Cannot import local modules (`checkpoint_scorer.py` not available)
   - Checkpoints saved in RunPod environment
   - Relies on HuggingFace Trainer built-in features

### Key Constraint:
**RunPod training script cannot import `lib/training/checkpoint_scorer.py`** because:
- The script is generated dynamically as a string
- Deployed to remote RunPod environment
- Our local Python modules are not available there
- Would need to embed the scoring logic in the script string itself

---

## Impact Analysis

### What Works:
✅ **Local Training**: Multi-metric scoring fully functional
✅ **Local Checkpoint Listing**: Uses multi-metric scoring when scanning checkpoints
✅ **UI**: CheckpointSelector shows best checkpoint (works for both local and RunPod)

### What Doesn't Work:
❌ **RunPod Training**: Uses only eval_loss (HuggingFace default)
❌ **RunPod Checkpoint Selection**: No multi-metric scoring during training
❌ **RunPod Best Model Tracking**: Simple eval_loss comparison only

### User Impact:
- **Local training users**: ✅ Get multi-metric checkpoint selection
- **RunPod training users**: ❌ Still get simple eval_loss selection (may deploy overfitted models)

---

## Options to Fix RunPod Training

### Option 1: Embed Scoring Logic in Training Script ✅ RECOMMENDED
**Approach**: Copy the `calculate_checkpoint_score()` function into the RunPod training script string

**Pros**:
- No external dependencies
- Full multi-metric scoring in RunPod
- Consistent behavior between local and RunPod

**Cons**:
- Code duplication (scoring logic in 2 places)
- Must keep both implementations in sync

**Implementation**:
```typescript
// In runpod-service.ts, add before TrainingMetricsCallback class:
def calculate_checkpoint_score(checkpoint_data):
    """Multi-metric checkpoint scoring."""
    eval_loss = checkpoint_data.get('eval_loss')
    train_loss = checkpoint_data.get('train_loss')

    if eval_loss is None:
        return float('inf')

    # [... rest of scoring logic ...]
    return total_score

class TrainingMetricsCallback(TrainerCallback):
    def __init__(self, total_samples=None):
        self.start_time = time.time()
        # Add best model tracking
        self.best_eval_loss = float('inf')
        self.best_checkpoint_score = float('inf')
        self.best_epoch = 0
        self.best_step = 0
        self.epochs_without_improvement = 0
        self.last_eval_loss = None
        # ... existing code

    def _update_best_model(self, eval_loss, current_epoch, current_step, train_loss=None):
        """Track best model using multi-metric scoring."""
        checkpoint_data = {
            'eval_loss': eval_loss,
            'train_loss': train_loss,
            'epochs_without_improvement': self.epochs_without_improvement
        }
        current_score = calculate_checkpoint_score(checkpoint_data)

        if current_score < self.best_checkpoint_score:
            self.best_checkpoint_score = current_score
            self.best_eval_loss = eval_loss
            self.best_epoch = current_epoch
            self.best_step = current_step

    def on_log(self, args, state, control, logs=None, **kwargs):
        # ... existing metrics posting

        # Add best model tracking
        eval_loss = logs.get("eval_loss")
        if eval_loss is not None:
            train_loss = logs.get("loss")
            self._update_best_model(eval_loss, current_epoch, current_step, train_loss)

            # Update database with best checkpoint info
            supabase.table('local_training_jobs').update({
                'best_eval_loss': self.best_eval_loss,
                'best_epoch': self.best_epoch,
                'best_step': self.best_step,
            }).eq('id', JOB_ID).eq('job_token', JOB_TOKEN).execute()
```

---

### Option 2: Post-Training Checkpoint Scoring ⚠️ PARTIAL SOLUTION
**Approach**: After training completes, scan checkpoints using multi-metric scoring

**Pros**:
- No changes to RunPod training script
- Reuses existing `checkpoint_scorer.py`

**Cons**:
- Only works AFTER training completes
- Doesn't help during training
- User already has checkpoints, may have deleted some

**Implementation**: Already works! When user lists checkpoints via API, the scoring happens server-side.

---

### Option 3: Use HuggingFace Trainer with Custom Metric ⚠️ LIMITED
**Approach**: Define custom metric in TrainingArguments

**Pros**:
- Built-in HuggingFace feature
- No custom callbacks needed

**Cons**:
- HuggingFace only supports single metric for `metric_for_best_model`
- Cannot do multi-metric weighted scoring
- Would need to pre-compute combined score as single metric

---

## Recommendation

### Immediate Action: Implement Option 1 (Embed Scoring Logic)

**Why**:
1. Provides parity between local and RunPod training
2. Prevents RunPod users from wasting money on overfitted models
3. No external dependencies
4. Consistent user experience

**Trade-offs**:
- Code duplication: Scoring logic exists in 2 files
- Maintenance: Must update both if scoring algorithm changes

**Mitigation**:
- Add comment in both files referencing each other
- Create test to verify both implementations produce same scores
- Document in implementation guide

---

## Files to Modify

### File 1: `lib/training/runpod-service.ts`
**Changes**:
1. **Line ~730**: Add `calculate_checkpoint_score()` function before `TrainingMetricsCallback`
2. **Line ~736**: Add best model tracking fields to `__init__`
3. **Line ~764**: Add `_update_best_model()` method
4. **Line ~764**: Call `_update_best_model()` in `on_log()` when eval_loss available
5. **Line ~814**: Update Supabase with `best_eval_loss`, `best_epoch`, `best_step`

**Estimated Lines**: +100 lines (scoring function + tracking logic)

---

## Testing Plan

### Test 1: RunPod Training with Multi-Metric Scoring
1. Start RunPod training job
2. Monitor logs for score calculations
3. Verify `best_eval_loss`, `best_epoch`, `best_step` updated in database
4. Compare with local training behavior

### Test 2: Score Consistency
1. Create test with same checkpoint data
2. Run through local `checkpoint_scorer.py`
3. Run through RunPod embedded scoring function
4. Verify both produce identical scores

### Test 3: Checkpoint Listing
1. Complete RunPod training job
2. List checkpoints via API
3. Verify `is_best` flag matches multi-metric scoring
4. Verify deployment uses correct checkpoint

---

## Session Continuity Notes

### Previous Work:
- ✅ Implemented multi-metric scoring in local training
- ✅ Created `checkpoint_scorer.py` module
- ✅ Updated `standalone_trainer.py` with scoring
- ✅ Updated `training_server.py` checkpoint listing
- ✅ Tested with real training job (working perfectly)

### Current Discovery:
- ❌ RunPod training does NOT use multi-metric scoring
- ❌ RunPod uses HuggingFace default (eval_loss only)
- ⚠️ RunPod users may deploy overfitted models

### Next Steps:
1. Decide: Implement multi-metric scoring in RunPod?
2. If yes: Embed scoring logic in runpod-service.ts
3. Test with actual RunPod training job
4. Verify database updates work correctly

---

**Status**: ⏳ AWAITING DECISION
**Question for User**: Should we implement multi-metric scoring for RunPod training to prevent users from wasting money on overfitted models?
