# Job Queue Implementation Plan

**Date**: November 1, 2025  
**Feature**: Sequential Job Queue for Single-GPU Training  
**Status**: Planning Phase

---

## Executive Summary

Add job queueing system to prevent GPU conflicts when multiple training jobs are submitted. Currently, starting a second job while one is running causes GPU memory conflicts and crashes both jobs.

**Goal**: Allow users to queue multiple training jobs that execute sequentially, one at a time.

---

## Current System Analysis (VERIFIED)

### Architecture Overview

- **Server**: FastAPI (training_server.py) on port 8000
- **Training Execution**: Subprocess (standalone_trainer.py)
- **Job Storage**: In-memory dict `jobs: Dict[str, JobStatus]`
- **Monitoring**: Background asyncio task per job
- **GPU**: Single RTX 4060 Ti (8GB VRAM) - **can only run ONE job at a time**

### Current Flow

1. POST `/api/training/execute` → Creates JobStatus
2. Immediately calls `spawn_training_process()` → Starts subprocess
3. Creates monitor task → Watches progress.json
4. No check for running jobs → **PROBLEM: Multiple jobs conflict**

### Current Job States

```python
class JobStatusEnum(str, Enum):
    PENDING = "pending"    # Job created but not started
    RUNNING = "running"    # Subprocess executing
    COMPLETED = "completed"  # Successfully finished
    FAILED = "failed"      # Error or crash
```

### Files Requiring Changes

1. **lib/training/training_server.py** (Line 163: `jobs` dict, Line 812: `/execute` endpoint)
2. **components/training/LocalPackageDownloader.tsx** (UI - show queue position)

---

## Phase 2: Design - Queue Architecture

### Queue Design Decisions

**Option A: Simple FIFO Queue** ✅ CHOSEN

- Single queue: `job_queue: asyncio.Queue[str]`
- One worker loop checks for running jobs
- If GPU free → dequeue and start
- **Pros**: Simple, reliable, predictable
- **Cons**: No prioritization

**Option B: Priority Queue**

- Jobs have priority levels
- **Pros**: VIP jobs run first
- **Cons**: More complex, user confusion

**Decision**: Start with Option A (FIFO) for simplicity and reliability.

### New Job States

```python
class JobStatusEnum(str, Enum):
    QUEUED = "queued"      # NEW: Waiting in queue
    PENDING = "pending"    # Job dequeued, preparing to start
    RUNNING = "running"    # Subprocess executing
    COMPLETED = "completed"
    FAILED = "failed"
```

### Queue Flow

```
User clicks "Run Now"
  ↓
POST /api/training/execute
  ↓
Create JobStatus(status=QUEUED)
  ↓
Add job_id to queue
  ↓
Return immediately (job_id + position)
  ↓
Queue worker loop (separate task)
  ↓
Check if any job RUNNING → wait
  ↓
If GPU free → dequeue job_id
  ↓
Set status=PENDING → spawn_training_process()
  ↓
Set status=RUNNING → monitor as usual
  ↓
On completion/failure → queue worker picks next
```

---

## Phase 3: Implementation Steps

### Step 1: Add Queue Infrastructure ✅

**File**: `lib/training/training_server.py`

**Changes**:

1. Add import: `from asyncio import Queue`
2. Add global queue: `job_queue: Queue[str] = Queue()`
3. Add helper function: `get_running_jobs() -> List[str]`
4. Add new status: `JobStatusEnum.QUEUED`

**Verification**:

- Import works
- Queue initializes
- No existing code broken

---

### Step 2: Create Queue Worker ✅

**File**: `lib/training/training_server.py`

**New Function**:

```python
async def queue_worker():
    """Process queued jobs one at a time"""
    while True:
        try:
            # Check if GPU is free
            running = get_running_jobs()
            if len(running) == 0:
                # Get next job (non-blocking with timeout)
                job_id = await asyncio.wait_for(
                    job_queue.get(), 
                    timeout=5.0
                )
                await start_queued_job(job_id)
            else:
                await asyncio.sleep(5)  # Check again in 5 seconds
        except asyncio.TimeoutError:
            continue  # No jobs in queue
        except Exception as e:
            logger.error(f"[QueueWorker] Error: {e}")
            await asyncio.sleep(5)
```

**Verification**:

- Worker starts on server startup
- Doesn't crash on empty queue
- Logs activity properly

---

### Step 3: Modify Execute Endpoint ✅

**File**: `lib/training/training_server.py`  
**Function**: `execute_training()` (Line 812)

**Changes**:

```python
# OLD CODE (Line 957):
process = await spawn_training_process(job_id, training_config)
job.process = process

# NEW CODE:
# Don't start immediately - add to queue
job.status = JobStatusEnum.QUEUED
await job_queue.put(job_id)
queue_position = job_queue.qsize()
logger.info(f"[Execute] Job {job_id} queued at position {queue_position}")
```

**Verification**:

- Job created with QUEUED status
- Added to queue successfully
- Returns queue position to user
- No subprocess started yet

---

### Step 4: Create Job Starter Function ✅

**File**: `lib/training/training_server.py`

**New Function**:

```python
async def start_queued_job(job_id: str):
    """Start a queued job"""
    if job_id not in jobs:
        logger.error(f"[QueueWorker] Job {job_id} not found")
        return
    
    job = jobs[job_id]
    
    # Check if already running/completed (safety check)
    if job.status in [JobStatusEnum.RUNNING, JobStatusEnum.COMPLETED]:
        logger.warning(f"[QueueWorker] Job {job_id} already {job.status}")
        return
    
    logger.info(f"[QueueWorker] Starting job {job_id}")
    job.status = JobStatusEnum.PENDING
    
    # Get config from job (stored during execute)
    training_config = job.training_config
    
    try:
        process = await spawn_training_process(job_id, training_config)
        job.process = process
        job.status = JobStatusEnum.RUNNING
        logger.info(f"[QueueWorker] Job {job_id} now RUNNING")
        
        # Start monitor
        asyncio.create_task(monitor_job(job_id))
        
    except Exception as e:
        logger.error(f"[QueueWorker] Failed to start job {job_id}: {e}")
        job.status = JobStatusEnum.FAILED
        job.error = str(e)
```

**Verification**:

- Job transitions QUEUED → PENDING → RUNNING
- Subprocess spawns successfully
- Monitor task starts
- Errors handled gracefully

---

### Step 5: Start Queue Worker on Startup ✅

**File**: `lib/training/training_server.py`

**Add to startup**:

```python
@app.on_event("startup")
async def startup_event():
    """Initialize queue worker on server start"""
    logger.info("[Startup] Starting job queue worker...")
    asyncio.create_task(queue_worker())
    logger.info("[Startup] Queue worker started")
```

**Verification**:

- Worker starts when server starts
- Logs confirm startup
- Doesn't block server initialization

---

### Step 6: Update JobStatus Dataclass ✅

**File**: `lib/training/training_server.py`  
**Dataclass**: `JobStatus` (Line 84)

**Add field**:

```python
@dataclass
class JobStatus:
    # ... existing fields ...
    training_config: Optional[dict] = None  # NEW: Store config for deferred start
    queue_position: Optional[int] = None    # NEW: Position in queue
```

**Verification**:

- Dataclass still works
- Config stored correctly
- Position updates properly

---

### Step 7: Update UI to Show Queue ✅

**File**: `components/training/LocalPackageDownloader.tsx`

**Changes**:

1. Show queue position when status=QUEUED
2. Update status badge colors
3. Display estimated start time (optional)

**Verification**:

- UI shows "Queued (position: 2)"
- Status updates in real-time
- User understands job will run later

---

### Step 8: Add Queue Status Endpoint ✅

**File**: `lib/training/training_server.py`

**New Endpoint**:

```python
@app.get("/api/training/queue")
async def get_queue_status():
    """Get current queue status"""
    running_jobs = get_running_jobs()
    queued_jobs = [
        {
            "job_id": jid,
            "name": jobs[jid].name,
            "position": i + 1
        }
        for i, jid in enumerate(job_queue._queue)
        if jid in jobs
    ]
    
    return {
        "running": len(running_jobs),
        "queued": len(queued_jobs),
        "jobs": queued_jobs
    }
```

**Verification**:

- Returns queue length
- Shows job positions
- Updates in real-time

---

## Phase 4: Testing Plan

### Test 1: Single Job (Baseline)

1. Start server
2. Submit one training job
3. **Expected**: Job starts immediately (QUEUED → PENDING → RUNNING)
4. **Verify**: Training executes normally

### Test 2: Sequential Jobs

1. Submit Job A
2. Wait for RUNNING status
3. Submit Job B
4. **Expected**: Job B status=QUEUED
5. **Verify**: Job B waits until Job A completes
6. **Verify**: Job B starts automatically after Job A

### Test 3: Multiple Queued Jobs

1. Submit Jobs A, B, C rapidly
2. **Expected**: A=RUNNING, B=QUEUED (pos 1), C=QUEUED (pos 2)
3. **Verify**: Jobs execute in order A → B → C
4. **Verify**: No GPU conflicts

### Test 4: Job Failure Recovery

1. Submit Job A (will fail)
2. Submit Job B
3. Job A fails
4. **Expected**: Job B starts automatically
5. **Verify**: Queue continues processing

### Test 5: Server Restart

1. Submit 3 jobs (1 running, 2 queued)
2. Restart server
3. **Expected**: Queue clears (in-memory, acceptable for v1)
4. **Future**: Persist queue to database

---

## Phase 5: Rollback Plan

### If Implementation Fails

1. **Git revert** to previous commit
2. **Remove** queue worker startup
3. **Restore** original `/execute` endpoint
4. **Keep** model path normalization (unrelated fix)

### Safety Measures

- Commit after each step
- Test each change independently
- Keep old code commented for 24 hours

---

## Phase 6: Future Enhancements

### After v1 Works

1. **Persistent Queue**: Save queue to database (survive restarts)
2. **Priority Levels**: VIP/Normal/Low priority jobs
3. **Job Cancellation**: Remove job from queue
4. **Queue Reordering**: Admin can reorder jobs
5. **Multi-GPU Support**: Run N jobs in parallel
6. **Estimated Wait Time**: Show "~15 min wait"
7. **Email Notifications**: Alert when job starts/completes

---

## Implementation Checklist

- [ ] Step 1: Add queue infrastructure
- [ ] Step 2: Create queue worker
- [ ] Step 3: Modify execute endpoint
- [ ] Step 4: Create job starter function
- [ ] Step 5: Start worker on startup
- [ ] Step 6: Update JobStatus dataclass
- [ ] Step 7: Update UI
- [ ] Step 8: Add queue status endpoint
- [ ] Test 1: Single job
- [ ] Test 2: Sequential jobs
- [ ] Test 3: Multiple queued jobs
- [ ] Test 4: Failure recovery
- [ ] Test 5: Server restart
- [ ] Documentation update
- [ ] User guide created

---

## Success Criteria

✅ **Must Have**:

- Multiple jobs can be submitted without GPU conflicts
- Jobs execute in FIFO order
- Queue status visible in logs
- No crashes or memory leaks

✅ **Should Have**:

- UI shows queue position
- Queue status endpoint works
- Clean error handling

✅ **Nice to Have**:

- Estimated wait time
- Job cancellation
- Queue persistence

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Queue worker crashes | Medium | High | Extensive error handling, auto-restart |
| Race conditions | Low | Medium | Proper async locks, sequential processing |
| Memory leaks | Low | Medium | Periodic cleanup of completed jobs |
| UI confusion | Medium | Low | Clear status messages, documentation |

---

## Notes & Decisions

- **Queue Library**: Using asyncio.Queue (built-in, reliable)
- **Storage**: In-memory for v1 (fast, simple)
- **Worker Pattern**: Single worker loop (prevents race conditions)
- **Status Updates**: Real-time via existing monitor system
- **Backward Compatibility**: Maintained (single jobs work same as before)

---

**Next Action**: Begin Step 1 - Add Queue Infrastructure
