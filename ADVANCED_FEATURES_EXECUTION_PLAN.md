# Advanced Training Features - Execution Plan

**Date:** 2025-11-04
**Status:** Ready for Execution
**Context:** Database columns exist but cause realtime binding mismatch

---

## 🎯 DISCOVERY: What Happened

### The Half-Implemented Feature

Someone started implementing 3 advanced training features on **2025-11-02**:

1. **Checkpoint Resume** - Resume failed/stopped training from last checkpoint
2. **Runtime Parameter Modification** - Adjust learning rate, batch size during training
3. **Multi-GPU Training** - DeepSpeed, FSDP, DDP support

### What Was Completed

✅ **Phase 0: Database & Types** (100% DONE)
- Database migration applied: `20251102000001_add_advanced_training_features.sql`
- Added 5 columns to `local_training_jobs`:
  - `resume_from_checkpoint` TEXT
  - `num_gpus` INTEGER
  - `distributed_strategy` TEXT
  - `parameter_updates` JSONB
  - `last_parameter_update_at` TIMESTAMPTZ
- Type definitions created:
  - `lib/training/distributed-training.types.ts`
  - `lib/training/checkpoint-resume.types.ts`
  - Extended `lib/training/training-config.types.ts`

✅ **Phase 1: API Endpoints** (100% DONE)
- Created `app/api/training/local/[jobId]/resume/route.ts`
- Created `app/api/training/local/[jobId]/update-params/route.ts`

✅ **Phase 2: UI Components** (100% DONE)
- Created `components/training/CheckpointResumeCard.tsx`
- Created `components/training/RuntimeParameterControls.tsx`
- Created `components/training/DistributedTrainingConfig.tsx`

✅ **Phase 3: UI Integration** (100% DONE)
- Modified `app/training/monitor/page.tsx`
- Modified `components/training/ConfigEditor.tsx`

### What's MISSING (Root Cause of Error)

❌ **Training Server Implementation**
- Training server (`lib/training/training_server.py`) does NOT send these fields
- Verified in code lines 865-1006: persist_job() does NOT include:
  - `resume_from_checkpoint`
  - `num_gpus`
  - `distributed_strategy`
  - `parameter_updates`
  - `last_parameter_update_at`

❌ **TypeScript Interface** (useTrainingJobsRealtime.ts)
- Does NOT expect these fields
- Supabase realtime tries to sync them → **BINDING MISMATCH ERROR**

---

## 🔥 THE PROBLEM

**Current State:**
```
Database (53 + 5 columns)
    ↓
Supabase Realtime (tries to send all 58 columns)
    ↓
TypeScript Client (expects only 53 columns)
    ↓
❌ ERROR: "mismatch between server and client bindings for postgres changes"
```

**The database has columns that:**
1. Training server doesn't populate
2. TypeScript doesn't expect
3. Cause realtime subscription errors

---

## 🎯 SOLUTION OPTIONS

### Option 1: Complete the Implementation (RECOMMENDED)

**Pros:**
- Get pause/resume training functionality
- Get runtime parameter modification
- Get multi-GPU training support
- Use all the work already done

**Cons:**
- Requires backend Python work
- More complex
- Takes longer

**Steps:**
1. Fix training server to send all 5 fields
2. Update TypeScript interface to expect them
3. Test all 3 features end-to-end

### Option 2: Rollback to Clean State (QUICK FIX)

**Pros:**
- Fixes error immediately
- No new code needed
- Rollback migration exists

**Cons:**
- Loses all implementation work
- Features not available
- Wasted effort

**Steps:**
1. Apply rollback migration `20251102000002_rollback_advanced_training_features.sql`
2. Remove unused type files
3. Remove unused API endpoints
4. Remove unused UI components

---

## ✅ RECOMMENDED: Complete the Implementation

### Phase 4: Fix Training Server (Python)

**File:** `lib/training/training_server.py`

**Current `persist_job()` calls (lines 865-1006):**
```python
persist_job(job_id, {
    "job_id": job_id,
    "model_name": job.model_name,
    "dataset_path": job.dataset_path,
    "status": job.status.value,
    "progress": job.progress,
    # ... existing 30+ fields ...
    # MISSING FIELDS BELOW
})
```

**Add to JobStatus dataclass (around line 86):**
```python
@dataclass
class JobStatus:
    # ... existing fields ...

    # Advanced features (Phase 4)
    resume_from_checkpoint: Optional[str] = None
    num_gpus: int = 1
    distributed_strategy: str = "none"
    parameter_updates: list = field(default_factory=list)
    last_parameter_update_at: Optional[str] = None
```

**Add to `to_dict()` method (around line 134):**
```python
def to_dict(self) -> dict:
    return {
        # ... existing fields ...

        # Advanced features (Phase 4)
        "resume_from_checkpoint": self.resume_from_checkpoint,
        "num_gpus": self.num_gpus,
        "distributed_strategy": self.distributed_strategy,
        "parameter_updates": self.parameter_updates,
        "last_parameter_update_at": self.last_parameter_update_at,
    }
```

**Add to all `persist_job()` calls (3 locations):**

**Location 1: Progress update (line 865):**
```python
persist_job(job_id, {
    # ... existing fields ...
    "resume_from_checkpoint": job.resume_from_checkpoint,
    "num_gpus": job.num_gpus,
    "distributed_strategy": job.distributed_strategy,
    "parameter_updates": job.parameter_updates,
    "last_parameter_update_at": job.last_parameter_update_at,
})
```

**Location 2: Status change to RUNNING (line 952):**
```python
persist_job(job_id, {
    # ... existing fields ...
    "resume_from_checkpoint": job.resume_from_checkpoint,
    "num_gpus": job.num_gpus,
    "distributed_strategy": job.distributed_strategy,
})
```

**Location 3: Final status (line 973):**
```python
persist_job(job_id, {
    # ... existing fields ...
    "resume_from_checkpoint": job.resume_from_checkpoint,
    "num_gpus": job.num_gpus,
    "distributed_strategy": job.distributed_strategy,
    "parameter_updates": job.parameter_updates,
    "last_parameter_update_at": job.last_parameter_update_at,
})
```

### Phase 5: Fix TypeScript Interface

**File:** `lib/hooks/useTrainingJobsRealtime.ts`

**Add to TrainingJob interface (after line 116):**
```typescript
export interface TrainingJob {
  // ... existing 53 fields ...

  // Advanced training features (Phase 5)
  resume_from_checkpoint: string | null;
  num_gpus: number | null;
  distributed_strategy: string | null;
  parameter_updates: Array<Record<string, unknown>> | null;
  last_parameter_update_at: string | null;

  // Forward compatibility clause (keep existing line 119)
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown>;
}
```

### Phase 6: Restart Training Server

```bash
# Kill current training server
taskkill /PID 21492 /F

# Restart with new code
python -m uvicorn lib.training.training_server:app --host 0.0.0.0 --port 8000
```

### Phase 7: Verify Fix

1. Open browser DevTools console
2. Navigate to `http://localhost:3000/training/monitor`
3. Check for realtime binding mismatch error
4. Should be GONE ✅

---

## 📋 IMPLEMENTATION TASKS

### Task 1: Update Training Server (Python)
- [ ] Add 5 fields to `JobStatus` dataclass
- [ ] Add 5 fields to `to_dict()` method
- [ ] Add fields to persist_job() call at line 865
- [ ] Add fields to persist_job() call at line 952
- [ ] Add fields to persist_job() call at line 973
- [ ] Test: Run `python lib/training/training_server.py` - no errors

### Task 2: Update TypeScript Interface
- [ ] Add 5 fields to `TrainingJob` interface
- [ ] Test: Run `npm run build` - no TypeScript errors

### Task 3: Restart Training Server
- [ ] Kill process on port 8000
- [ ] Start new training server
- [ ] Verify server running: `netstat -ano | findstr :8000`

### Task 4: Test Realtime Fix
- [ ] Open `/training/monitor` in browser
- [ ] Check console - no binding mismatch error
- [ ] Verify "Live updates" indicator works
- [ ] Start a training job - verify realtime updates work

### Task 5: Test New Features (Optional)
- [ ] Test checkpoint resume on failed job
- [ ] Test runtime parameter controls on running job
- [ ] Test multi-GPU config in training wizard

---

## 📊 IMPLEMENTATION PLAN FILES

All implementation documentation exists:

1. **`docs/training/ADVANCED_TRAINING_FEATURES_IMPLEMENTATION_PLAN.md`**
   - Complete 1,310-line phased plan
   - All 4 phases documented
   - Code examples for every feature

2. **`docs/training/PROGRESS_LOG_advanced_features.md`**
   - Session-by-session progress tracking
   - Shows Phases 0-3 complete
   - Phases 4+ need backend work

3. **`docs/training/GAP_ANALYSIS_advanced_features.md`**
   - Gap analysis vs implementation
   - Confirms all frontend work done
   - Identifies backend as missing piece

4. **`docs/CANCEL_TRAINING_IMPLEMENTATION.md`**
   - Related feature: Cancel training button
   - Already working in UI
   - Shows pattern for training controls

---

## 🎯 DECISION REQUIRED

**Question for User:**

Do you want to:

**A) Complete the Implementation** (Recommended)
- Fix training server to send 5 fields
- Fix TypeScript interface to expect them
- Get pause/resume, runtime params, multi-GPU features working
- Estimated time: 1-2 hours

**B) Rollback Everything**
- Apply rollback migration
- Remove all advanced feature code
- Fix error immediately but lose features
- Estimated time: 15 minutes

**C) Hybrid Approach**
- Apply rollback migration NOW (fix error)
- Keep all code files for future
- Re-implement when ready
- Estimated time: 15 min now + future work

---

## 🔧 QUICK FIX (If Choosing Option B or C)

Run this SQL in Supabase SQL Editor:

```sql
-- Rollback Advanced Training Features
DROP INDEX IF EXISTS idx_local_training_jobs_resume_checkpoint;
DROP INDEX IF EXISTS idx_local_training_jobs_resumed_from;
DROP INDEX IF EXISTS idx_local_training_jobs_distributed;
DROP INDEX IF EXISTS idx_local_training_jobs_parameter_updates;

ALTER TABLE local_training_jobs DROP COLUMN IF EXISTS resume_from_checkpoint;
ALTER TABLE local_training_jobs DROP COLUMN IF EXISTS num_gpus;
ALTER TABLE local_training_jobs DROP COLUMN IF EXISTS distributed_strategy;
ALTER TABLE local_training_jobs DROP COLUMN IF EXISTS parameter_updates;
ALTER TABLE local_training_jobs DROP COLUMN IF EXISTS last_parameter_update_at;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
  AND column_name IN ('resume_from_checkpoint', 'num_gpus', 'distributed_strategy', 'parameter_updates', 'last_parameter_update_at');
-- Should return 0 rows
```

Then restart training server.

---

## 📝 RECOMMENDATION

**Complete the Implementation (Option A)**

**Reasoning:**
1. **90% done** - Only backend fields missing
2. **High value** - Pause/resume is critical for long training runs
3. **Clean solution** - Fixes error AND adds features
4. **Low risk** - Just adding fields to existing code
5. **Work already done** - UI, API, migrations all complete

**Next immediate step after your decision:**
- If Option A: I'll provide exact code changes for training_server.py
- If Option B/C: I'll provide rollback SQL to run now

**What do you want to do?**
