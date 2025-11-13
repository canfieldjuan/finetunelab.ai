# Job Cancellation Implementation Plan

## Objective
Allow users to cancel/stop training jobs at any stage (queued, pending, running) without killing the training server.

## Requirements
✅ Cancel jobs in any state (queued, pending, running)
✅ Graceful process termination (not kill -9)
✅ Remove from queue if queued
✅ Terminate subprocess if running
✅ Update job status to CANCELLED
✅ Clean up resources (GPU memory, file handles)
✅ Persist cancellation to database
✅ Don't affect other jobs or server stability

## Implementation Steps

### Step 1: Add CANCELLED Status
**File**: `lib/training/training_server.py`
**Location**: JobStatusEnum class (line ~77)
**Action**: Add `CANCELLED = "cancelled"` to enum
**Why**: Need new status to distinguish cancelled jobs from failed/completed

### Step 2: Add Cancel Job Function
**File**: `lib/training/training_server.py`
**Location**: After `start_queued_job()` function (line ~451)
**Action**: Create `async def cancel_job(job_id: str) -> dict`
**Logic**:
- Check if job exists
- Handle by status:
  - QUEUED: Remove from queue
  - PENDING/RUNNING: Terminate subprocess gracefully
  - COMPLETED/FAILED/CANCELLED: Return already finished
- Update status to CANCELLED
- Persist to database
- Clean up resources

### Step 3: Process Termination Helper
**File**: `lib/training/training_server.py`
**Location**: Before cancel_job function
**Action**: Create `def terminate_process_gracefully(process, timeout=10)`
**Logic**:
- Try process.terminate() first (SIGTERM on Unix, terminate on Windows)
- Wait up to timeout seconds
- If still running, use process.kill() (force kill)
- Log termination status

### Step 4: Queue Removal Helper
**File**: `lib/training/training_server.py`
**Location**: After get_running_jobs()
**Action**: Create `async def remove_from_queue(job_id: str) -> bool`
**Logic**:
- Create new queue
- Iterate through current queue
- Add all items except job_id to new queue
- Replace global queue
- Return True if found and removed

### Step 5: Cancel Endpoint
**File**: `lib/training/training_server.py`
**Location**: After `/api/training/queue` endpoint (line ~1325)
**Action**: Add `POST /api/training/cancel/{job_id}` endpoint
**Response**:
```json
{
  "success": true,
  "job_id": "xxx",
  "previous_status": "running",
  "message": "Job cancelled successfully"
}
```

### Step 6: Update Database Schema
**File**: `supabase/migrations/20251027000001_create_local_training_persistence.sql`
**Location**: Line 15 (CHECK constraint)
**Action**: Add 'cancelled' to allowed status values
**Current**: `('queued', 'pending', 'running', 'completed', 'failed')`
**New**: `('queued', 'pending', 'running', 'completed', 'failed', 'cancelled')`

### Step 7: UI Cancel Button
**File**: `components/training/LocalPackageDownloader.tsx`
**Location**: Job status display area
**Action**: Add "Cancel" button for queued/pending/running jobs
**API Call**: `POST /api/training/cancel/{job_id}`

### Step 8: Testing
**Tests**:
1. Cancel queued job → removes from queue, status CANCELLED
2. Cancel running job → terminates process, status CANCELLED, next job starts
3. Cancel already completed job → returns "already finished"
4. Multiple cancellations → idempotent (same result)
5. Cancel + new job → queue continues normally

## Edge Cases to Handle
- Job transitions from queued→running during cancellation
- Process already dead when cancel requested
- Multiple cancel requests for same job
- Cancel all queued jobs at once (future enhancement)

## Success Criteria
✅ Jobs can be cancelled at any stage
✅ Server remains stable after cancellations
✅ Queue continues processing after cancellation
✅ GPU resources freed immediately
✅ Database reflects cancelled status
✅ UI shows cancellation feedback

## Risk Assessment
**Low Risk**: Adding new status and endpoints
**Medium Risk**: Process termination (could hang)
**Mitigation**: Timeout + force kill fallback

## Rollback Plan
If issues occur:
1. Comment out cancel endpoint
2. Remove CANCELLED from status enum
3. Restart training server
4. Jobs continue with existing queue system
