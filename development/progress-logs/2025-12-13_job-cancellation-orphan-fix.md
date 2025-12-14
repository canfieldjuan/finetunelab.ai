# Job Cancellation Orphan Process Fix

**Date:** 2025-12-13
**Status:** IMPLEMENTED
**Goal:** Fix job cancellation failing to kill training processes after server restart

---

## Problem Statement

When a training job is cancelled via the UI, the actual training process sometimes continues running as an orphan, consuming GPU memory.

**Symptoms:**
- User clicks "Cancel" on a running job
- UI shows job as "Cancelled"
- GPU memory remains in use
- `nvidia-smi` shows training processes still running
- Manual `kill` required to stop the process

---

## Root Cause Analysis

### The Bug

When the training server **reconnects** to a running job (e.g., after restart), it recreates the `JobStatus` object with `process=None` (line 1386).

When cancel is called later on a reconnected job:

1. Line 1633 checks `if job.process:` → **False** because process is None
2. Line 1651 logs warning "No process found" but continues
3. Lines 1661-1671 mark job as CANCELLED and return **success: True**
4. **The actual training subprocess is NEVER killed**

### Code Path (Before Fix)

```python
# In cancel_job() - lines 1630-1651
if job.process:
    # This branch NEVER executes for reconnected jobs
    terminated = terminate_process_gracefully(job.process, ...)
else:
    # Just logs a warning, does nothing!
    logger.warning(f"[Cancel] No process found for job {job_id}")

# Job is marked cancelled even though process is still running
job.status = JobStatusEnum.CANCELLED
return {"success": True, ...}
```

---

## Solution

### 1. Added `process_pid` Field to JobStatus

**File:** `lib/training/training_server.py` (line 280)

```python
# Process tracking for cancellation after server restart
process_pid: Optional[int] = None  # Store PID separately for orphan cleanup
```

### 2. Store PID When Process Spawns

**File:** `lib/training/training_server.py` (line 1462)

```python
process = await spawn_training_process(job_id, ...)
job.process = process
job.process_pid = process.pid  # NEW: Store PID separately
```

### 3. Enhanced Cancel Logic with Three Fallbacks

**File:** `lib/training/training_server.py` (lines 1630-1659)

```python
# Terminate the subprocess
if job.process:
    # Path 1: Normal cancellation (process object available)
    terminated = terminate_process_gracefully(job.process, ...)
elif job.process_pid:
    # Path 2: Reconnected job (no process object, but have PID)
    terminated = await kill_process_by_pid(job.process_pid, job_id)
else:
    # Path 3: Last resort (search by job_id in command line)
    terminated = await kill_process_by_job_id(job_id)
```

### 4. Added Helper Functions

**`kill_process_by_pid(pid, job_id)`** (lines 783-840)
- Kills process and process group by PID
- Handles graceful SIGTERM then force SIGKILL
- Used for reconnected jobs with stored PID

**`kill_process_by_job_id(job_id)`** (lines 843-901)
- Uses `pgrep -f` to find processes by job_id in command line
- Fallback when neither process object nor PID available

### 5. Reconnect Logic Finds and Stores PID

**File:** `lib/training/training_server.py` (lines 1365-1405)

```python
# Try to find the PID for this specific job
job_pid = None
try:
    pid_result = subprocess.run(['pgrep', '-f', f'job_{job_id}'], ...)
    if pid_result.returncode == 0:
        job_pid = int(pid_result.stdout.strip().split('\n')[0])
        logger.info(f"[Reconnect] Found PID {job_pid} for job {job_id}")
except Exception:
    pass

# Store in JobStatus
job = JobStatus(
    ...
    process_pid=job_pid,  # Now stored for cancellation
    ...
)
```

---

## Files Modified

| File | Changes |
|------|---------|
| `lib/training/training_server.py` | Added `process_pid` field, `kill_process_by_pid()`, `kill_process_by_job_id()`, enhanced cancel logic, enhanced reconnect logic |

---

## Verification

- Python syntax: PASSED (`python3 -m py_compile`)
- Logic review: Covers all three scenarios (normal, reconnected with PID, fallback search)

---

## Testing Notes

To test the fix:

1. **Normal Cancellation:**
   - Start a training job
   - Cancel it immediately
   - Verify GPU memory is released

2. **Reconnected Job Cancellation:**
   - Start a training job
   - Restart the training server
   - Cancel the job
   - Verify GPU memory is released

3. **Orphan Cleanup:**
   - Start a training job
   - Kill the training server without cancelling
   - Start the server again
   - Cancel the job
   - Verify the orphaned process is killed

---

## Cancellation Flow After Fix

```
Cancel Request
      │
      ▼
┌─────────────────────────────────────┐
│  Is job.process available?          │
│  (Normal case - job started in      │
│   current server session)           │
└────────────────┬────────────────────┘
                 │
      ┌──────────┴──────────┐
      │ Yes                 │ No
      ▼                     ▼
┌─────────────────┐   ┌─────────────────────────┐
│ terminate_      │   │ Is job.process_pid      │
│ process_        │   │ available?              │
│ gracefully()    │   │ (Reconnected job with   │
│                 │   │  stored PID)            │
└─────────────────┘   └────────────┬────────────┘
                                   │
                      ┌────────────┴────────────┐
                      │ Yes                     │ No
                      ▼                         ▼
               ┌─────────────────┐   ┌─────────────────────┐
               │ kill_process_   │   │ kill_process_       │
               │ by_pid()        │   │ by_job_id()         │
               │ (Kill by PID)   │   │ (Search & kill by   │
               │                 │   │  job_id in cmdline) │
               └─────────────────┘   └─────────────────────┘
                      │                         │
                      └────────────┬────────────┘
                                   ▼
                      ┌─────────────────────────┐
                      │ Update job status to    │
                      │ CANCELLED               │
                      │ Clear GPU cache         │
                      │ Return success          │
                      └─────────────────────────┘
```
