# Job State Management Fix - Implementation Plan
**Created**: 2025-11-14
**Priority**: CRITICAL
**Status**: Pending Approval

## Executive Summary

This plan addresses critical job state management issues causing:
- Queued jobs that cannot be started
- Jobs showing "running" but not actually running
- Pending jobs stuck with "already resumed" messages
- State desynchronization between database and backend server

## Root Cause Analysis

### Current Architecture Issues

1. **State Mismatch Between Systems**
   - Database uses: `pending`, `queued`, `running`, `failed`, `cancelled`, `completed`
   - Backend memory (`jobs` dict) only tracks jobs it created
   - Frontend creates jobs with `pending` status that backend doesn't recognize

2. **No State Reconciliation on Server Restart**
   - Backend reconnects only to `running` jobs (line 719 in training_server.py)
   - `queued` jobs lost (only in memory, not persisted to queue)
   - `pending` jobs ignored completely

3. **No Recovery UI for Jobs Without Checkpoints**
   - CheckpointResumeCard requires checkpoints to show controls
   - Queued/pending jobs have no checkpoints
   - No way to manually start/cancel stuck jobs

4. **No Health Monitoring**
   - Jobs can stay "running" in DB even when process is dead
   - No periodic reconciliation between process state and DB state

## Affected Files Inventory

### Backend Files
1. `/lib/training/training_server.py`
   - Lines 99-108: JobStatusEnum definition
   - Lines 648-869: Reconnection logic
   - Lines 1294-1323: Queue worker
   - Lines 2171-2220: Job creation endpoint
   - **Impact**: Medium - Core state management logic

2. `/lib/training/trainer.py` (potential)
   - **Impact**: Low - May need status reporting updates

### Frontend API Routes
3. `/app/api/training/local/[jobId]/resume/route.ts`
   - Lines 114-124: Status validation
   - Lines 263-276: Job creation with `pending` status
   - **Impact**: High - Creates state mismatch

4. `/app/api/training/local/route.ts` (if exists)
   - **Impact**: Medium - Job submission logic

### Frontend Components
5. `/components/training/CheckpointResumeCard.tsx`
   - Lines 66-101: Checkpoint fetching
   - Lines 238-271: Error/no-checkpoint states
   - **Impact**: High - Needs fallback UI for jobs without checkpoints

6. `/app/training/monitor/page.tsx`
   - Lines 584-591: CheckpointResumeCard rendering logic
   - **Impact**: Medium - May need additional controls

### Database Schema (verification only)
7. Supabase `local_training_jobs` table
   - Status column constraints
   - **Impact**: Low - Schema should support all statuses

## Phased Implementation Plan

---

## **PHASE 1: State Reconciliation & Recovery (Week 1)**

### Objective
Fix backend to properly handle all job states and recover from crashes

### Tasks

#### 1.1 Backend State Reconciliation on Startup
**File**: `/lib/training/training_server.py`
**Location**: `async def reconnect_orphaned_training_jobs()` (line 648)

**Changes**:
```python
# Current: Only reconnects to 'running' jobs
if status != "running":
    continue

# New: Handle all incomplete job states
RECOVERABLE_STATUSES = ['running', 'pending', 'queued']
if status not in RECOVERABLE_STATUSES:
    continue

# Add logic:
if status == 'running':
    # Existing reconnection logic
    pass
elif status == 'queued':
    # Re-add to job queue
    await job_queue.put(job_id)
elif status == 'pending':
    # Mark as failed or re-queue based on age
    # If > 5 minutes old, mark failed
    # If recent, try to start
    pass
```

**Validation**:
- Restart backend with jobs in each state
- Verify jobs are recovered or marked appropriately
- Check logs for proper state transitions

**Risk**: Medium - Could auto-start jobs user didn't intend

---

#### 1.2 Add Health Check Endpoint
**File**: `/lib/training/training_server.py`
**Location**: New endpoint after line 2220

**Changes**:
```python
@app.get("/api/training/health")
async def health_check():
    """
    Check health of all running jobs
    Returns jobs that claim to be running but have no active process
    """
    running_jobs_db = get_jobs_from_db_with_status(['running'])
    running_jobs_memory = get_running_jobs()

    orphaned = []
    for db_job in running_jobs_db:
        if db_job['id'] not in [j.job_id for j in running_jobs_memory]:
            orphaned.append(db_job['id'])

    return {
        "healthy": len(orphaned) == 0,
        "orphaned_jobs": orphaned,
        "total_running_db": len(running_jobs_db),
        "total_running_memory": len(running_jobs_memory)
    }
```

**Validation**:
- Call endpoint and verify it detects orphaned jobs
- Kill a training process and verify it appears in orphaned list

**Risk**: Low - Read-only endpoint

---

#### 1.3 Add Job Force-Start Endpoint
**File**: `/lib/training/training_server.py`
**Location**: New endpoint after health check

**Changes**:
```python
@app.post("/api/training/{job_id}/force-start")
async def force_start_job(job_id: str):
    """
    Force-start a stuck job regardless of current state
    Used for recovery of pending/queued jobs
    """
    # Fetch job from DB
    job_data = get_job_from_db(job_id)

    if not job_data:
        raise HTTPException(404, "Job not found")

    # Create JobStatus from DB data
    job = create_job_from_db_data(job_data)
    jobs[job_id] = job

    # Add to queue
    await job_queue.put(job_id)
    queue_position = job_queue.qsize()

    return {
        "success": True,
        "job_id": job_id,
        "queue_position": queue_position
    }
```

**Validation**:
- Create job in DB with `pending` status
- Call force-start endpoint
- Verify job enters queue and starts training

**Risk**: Medium - Could start jobs multiple times if called repeatedly

---

## **PHASE 2: Frontend Recovery UI (Week 1-2)**

### Objective
Provide UI controls for stuck jobs regardless of checkpoint availability

### Tasks

#### 2.1 Create JobRecoveryCard Component
**File**: `/components/training/JobRecoveryCard.tsx` (NEW)

**Purpose**: Show controls for stuck/orphaned jobs without requiring checkpoints

**Features**:
- Display job state mismatch warnings
- "Force Start" button for pending/queued jobs
- "Mark as Failed" button for stuck jobs
- Job health status indicator

**Validation**:
- Test with pending job - shows "Force Start"
- Test with orphaned running job - shows health warning
- Verify API calls work correctly

**Risk**: Low - New component, no existing code modified

---

#### 2.2 Update Monitor Page Logic
**File**: `/app/training/monitor/page.tsx`
**Location**: Around line 584

**Changes**:
```typescript
// Current: Only show CheckpointResumeCard for failed/cancelled/pending
{currentStatus && (currentStatus.status === 'failed' || currentStatus.status === 'cancelled' || currentStatus.status === 'pending') && (
  <CheckpointResumeCard ... />
)}

// New: Add JobRecoveryCard for jobs without checkpoints or in bad state
{currentStatus && showRecoveryCard(currentStatus) && (
  <JobRecoveryCard
    jobId={jobId}
    currentStatus={currentStatus}
    onForceStart={handleForceStart}
    onMarkFailed={handleMarkFailed}
  />
)}

// Helper function
function showRecoveryCard(status) {
  // Show for: pending with no checkpoints, queued, or orphaned running
  return (
    status.status === 'pending' ||
    status.status === 'queued' ||
    isOrphaned(status)
  )
}
```

**Validation**:
- View pending job - shows recovery card
- View queued job - shows recovery card
- View normal running job - no recovery card

**Risk**: Low - Additional UI, doesn't remove existing

---

#### 2.3 Update CheckpointResumeCard Fallback
**File**: `/components/training/CheckpointResumeCard.tsx`
**Location**: Lines 262-271 (no checkpoints state)

**Changes**:
```typescript
// Current: Shows "No Checkpoints Available" message with no actions

// New: For pending jobs, show "Start Fresh" option
if (checkpoints.length === 0) {
  if (jobStatus === 'pending') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <h3 className="text-lg font-semibold">Start Training</h3>
          <p className="text-sm text-gray-600 mt-1">
            This job is pending. Start training from the beginning.
          </p>
        </div>
        <div className="p-6">
          <button onClick={handleForceStart} className="...">
            Start Training
          </button>
        </div>
      </div>
    )
  }

  // Keep existing no-checkpoints message for failed/cancelled
  return existing_no_checkpoints_ui;
}
```

**Validation**:
- Pending job with no checkpoints shows "Start Training" button
- Failed job with no checkpoints shows appropriate message
- Button click triggers force-start

**Risk**: Medium - Modifies existing component behavior

---

## **PHASE 3: Status Unification (Week 2)**

### Objective
Ensure frontend and backend use consistent status values

### Tasks

#### 3.1 Frontend Resume Route Fix
**File**: `/app/api/training/local/[jobId]/resume/route.ts`
**Location**: Line 270

**Changes**:
```typescript
// Current: Creates job with status 'pending'
status: 'pending',

// New: Use 'queued' to match backend
status: 'queued',
```

**Validation**:
- Create resumed job from frontend
- Verify it appears in backend queue
- Verify it starts automatically

**Risk**: Low - Simple status value change

---

#### 3.2 Create Status Constants File
**File**: `/lib/training/job-status-constants.ts` (NEW)

**Purpose**: Single source of truth for job statuses

```typescript
export const JOB_STATUS = {
  QUEUED: 'queued',
  PENDING: 'pending',  // Deprecated - use QUEUED
  RUNNING: 'running',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

// Status categories for UI logic
export const INCOMPLETE_STATUSES: JobStatus[] = [
  JOB_STATUS.QUEUED,
  JOB_STATUS.PENDING,
  JOB_STATUS.RUNNING,
  JOB_STATUS.PAUSED,
];

export const RECOVERABLE_STATUSES: JobStatus[] = [
  JOB_STATUS.QUEUED,
  JOB_STATUS.PENDING,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED,
];
```

**Validation**:
- Import in backend and frontend
- Replace hardcoded strings
- Verify TypeScript compilation

**Risk**: Low - Constants file, easy to rollback

---

## **PHASE 4: Monitoring & Cleanup (Week 2-3)**

### Objective
Add automated monitoring and cleanup of stuck jobs

### Tasks

#### 4.1 Periodic Health Check Worker
**File**: `/lib/training/training_server.py`
**Location**: New background task in startup_event

**Changes**:
```python
async def health_monitor_worker():
    """
    Periodically check for orphaned/stuck jobs and fix them
    Runs every 5 minutes
    """
    while True:
        try:
            await asyncio.sleep(300)  # 5 minutes

            # Check for orphaned running jobs
            orphaned = await find_orphaned_jobs()
            for job_id in orphaned:
                logger.warning(f"[HealthMonitor] Found orphaned job: {job_id}")
                await mark_job_failed(job_id, "Process terminated unexpectedly")

            # Check for old pending jobs (>10 minutes)
            old_pending = await find_old_pending_jobs(minutes=10)
            for job_id in old_pending:
                logger.warning(f"[HealthMonitor] Found stale pending job: {job_id}")
                await mark_job_failed(job_id, "Job stuck in pending state")

        except Exception as e:
            logger.error(f"[HealthMonitor] Error: {e}", exc_info=True)

@app.on_event("startup")
async def startup_event():
    # Existing queue worker
    asyncio.create_task(queue_worker())

    # New health monitor
    asyncio.create_task(health_monitor_worker())
```

**Validation**:
- Create stuck pending job
- Wait 10 minutes
- Verify it's auto-marked as failed

**Risk**: Medium - Auto-marks jobs as failed

---

#### 4.2 Add Manual Cleanup Endpoint
**File**: `/lib/training/training_server.py`

**Changes**:
```python
@app.post("/api/training/admin/cleanup")
async def cleanup_stuck_jobs(max_age_minutes: int = 30):
    """
    Admin endpoint to manually cleanup stuck jobs
    """
    results = {
        "orphaned_marked_failed": [],
        "old_pending_marked_failed": [],
        "old_queued_requeued": []
    }

    # Cleanup logic here

    return results
```

**Validation**:
- Create various stuck jobs
- Call cleanup endpoint
- Verify appropriate actions taken

**Risk**: Low - Manual trigger only

---

## Dependencies & Prerequisites

### Technical Dependencies
- Backend must be running (training_server.py on port 8000)
- Database access (Supabase)
- Frontend dev server

### Code Dependencies
- Phase 2 depends on Phase 1 (needs force-start endpoint)
- Phase 3 can run parallel to Phase 1-2
- Phase 4 depends on Phase 1 (needs health check logic)

### Database Schema
- No schema changes required
- Existing `status` column supports all values
- May need index on `status` for performance

---

## Testing Strategy

### Unit Tests
1. Backend state reconciliation logic
2. Force-start endpoint with various job states
3. Health check accuracy

### Integration Tests
1. Full job lifecycle: create → queue → start → complete
2. Server restart recovery
3. Manual force-start from UI

### Manual Testing Scenarios
1. **Stuck Pending Job**:
   - Create job in DB with `pending` status
   - Verify JobRecoveryCard appears
   - Click "Force Start"
   - Verify training starts

2. **Orphaned Running Job**:
   - Start job normally
   - Kill training process (not via cancel)
   - Verify health check detects it
   - Verify auto-marked as failed

3. **Server Restart with Queued Jobs**:
   - Add 3 jobs to queue
   - Restart backend
   - Verify all 3 are recovered and re-queued

---

## Rollback Plan

### Phase 1 Rollback
- Revert reconnection logic changes
- Remove new endpoints (they won't be called)
- **Impact**: Low - backend restart cleans memory

### Phase 2 Rollback
- Hide/remove JobRecoveryCard component
- Revert monitor page changes
- **Impact**: Low - UI only changes

### Phase 3 Rollback
- Revert status value changes
- **Impact**: Medium - May leave jobs in inconsistent state

### Phase 4 Rollback
- Disable health monitor worker
- **Impact**: Low - No auto-cleanup only

---

## Success Criteria

### Phase 1
- [ ] Backend reconnects to queued jobs after restart
- [ ] Health endpoint correctly identifies orphaned jobs
- [ ] Force-start endpoint successfully starts pending jobs

### Phase 2
- [ ] JobRecoveryCard displays for appropriate job states
- [ ] Force-start button triggers backend endpoint
- [ ] No regression in existing CheckpointResumeCard

### Phase 3
- [ ] Frontend and backend use consistent status values
- [ ] No new jobs stuck in wrong state
- [ ] TypeScript compilation clean

### Phase 4
- [ ] Health monitor detects and fixes orphaned jobs within 5 min
- [ ] Old pending jobs auto-marked failed
- [ ] Manual cleanup endpoint works correctly

---

## Timeline Estimate

- **Phase 1**: 2-3 days (backend changes + testing)
- **Phase 2**: 2-3 days (UI components + integration)
- **Phase 3**: 1 day (simple changes + validation)
- **Phase 4**: 2 days (monitoring + testing)

**Total**: 7-9 days for complete implementation

---

## Risk Assessment

### High Risk Items
1. Auto-starting jobs on reconnect (could start wrong jobs)
2. Modifying CheckpointResumeCard (used in multiple places)

### Mitigation
1. Add confirmation flags for auto-start
2. Extensive testing of CheckpointResumeCard changes
3. Feature flags for new UI components

### Critical Path
Phase 1 → Phase 2 → Testing → Production deployment

---

## Open Questions

1. Should pending jobs older than X minutes be auto-marked failed or auto-started?
2. Should we deprecate `pending` status entirely in favor of `queued`?
3. Do we need user notification when jobs are auto-recovered?
4. Should health monitoring be opt-in or always-on?

---

## Approval Required

**Please review and approve:**
- [ ] Overall approach and phased plan
- [ ] Affected files and change scope
- [ ] Risk assessment and mitigation
- [ ] Timeline and resource requirements

**After approval, implementation will begin with Phase 1.**
