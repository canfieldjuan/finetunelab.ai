# Phase 1 Implementation - Pre-Implementation Verification

**Date:** 2025-11-06  
**Status:** VERIFICATION IN PROGRESS  
**Implementer:** AI Assistant  

---

## Critical Requirements (User Mandate)

✅ **NEVER ASSUME** - Always verify before making changes  
✅ **VERIFY CODE** - Check existing code before updating  
✅ **FIND EXACT INSERTION POINTS** - Locate precise line numbers  
✅ **VERIFY CHANGES WORK** - Test all modifications  
✅ **VALIDATE NO BREAKING CHANGES** - Check affected files  

---

## Phase 1 Goals

### 1.1 Job Timeout & Auto-Recovery

**Problem:** Jobs can get stuck in "running" state if training process dies unexpectedly  
**Solution:** Add timeout detection in `monitor_job()` function  

### 1.2 Graceful Cancellation with GPU Cleanup

**Problem:** Current cancellation may leave GPU memory allocated  
**Solution:** Add GPU cache clearing after process termination  

---

## File Analysis

### Target File: `lib/training/training_server.py`

**Current State:**

- **Total Lines:** 1,931
- **Last Modified:** Unknown (need to verify)
- **Function to Modify:** `monitor_job()` (line 837)
- **Function to Enhance:** `cancel_job()` (line 634)

---

## Verification Checklist

### ✅ Step 1: Verify File Structure

**File:** `lib/training/training_server.py`

**Key Functions Located:**

- ✅ `monitor_job(job_id: str)` - Line 837
- ✅ `cancel_job(job_id: str)` - Line 634
- ✅ `terminate_process_gracefully()` - Line 572
- ✅ `JobStatus` dataclass - Line 117
- ✅ `JobStatusEnum` - Line 107

**Imports Present:**

```python
import logging
import sys
import uuid
import subprocess
import asyncio
from asyncio import Queue
import json
import requests
import os
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
```

**Missing Imports Needed:**

- None for Phase 1.1 (uses existing time module)
- Torch import is conditional (try/except in health check), need to add for GPU cleanup

---

### ✅ Step 2: Analyze `monitor_job()` Function

**Function Location:** Line 837  
**Function Signature:** `async def monitor_job(job_id: str)`  

**Current Flow:**

1. Initialize monitoring variables
2. Enter infinite loop (while True)
3. Sleep 2 seconds
4. Check if progress file exists
5. Read progress data from JSON
6. Update job status
7. Check for process completion
8. Break on completion/failure

**Variables in Scope:**

- `job_id: str` - Job identifier
- `job: JobStatus` - Job object from global `jobs` dict
- `progress_file: Path` - Path to progress.json
- `consecutive_read_errors: int` - Error counter (max 5)
- `last_progress_log: Optional[str]` - Last logged progress
- `last_persisted_count: int` - Metrics persistence tracker

**Insertion Point for Timeout Detection:**

- **Location:** After reading progress data, before checking process.poll()
- **Line Range:** Around line 1020 (after progress file reading, before process check)

**Current Process Checking Logic (Line ~1020):**

```python
if job.process is None:
    logger.warning(f"[Monitor] Job {job_id}: No process attached, stopping monitor")
    break

poll_result = job.process.poll()

if poll_result is None:
    # Process still running
    if job.status == JobStatusEnum.PENDING:
        job.status = JobStatusEnum.RUNNING
        job.started_at = datetime.utcnow().isoformat()
else:
    # Process exited
    if poll_result == 0:
        job.status = JobStatusEnum.COMPLETED
    else:
        job.status = JobStatusEnum.FAILED
```

---

### ✅ Step 3: Analyze `cancel_job()` Function

**Function Location:** Line 634  
**Function Signature:** `async def cancel_job(job_id: str) -> dict`  

**Current Flow:**

1. Check if job exists
2. Check current job status
3. Handle already-finished jobs (return false)
4. Handle QUEUED jobs (remove from queue)
5. Handle PENDING/RUNNING jobs (terminate subprocess)
6. Update job status to CANCELLED
7. Persist cancellation
8. Return result dict

**Current Termination Logic:**

```python
if job.process:
    logger.info(f"[Cancel] Terminating process PID {job.process.pid}")
    terminated = terminate_process_gracefully(job.process, timeout=10)
    
    if terminated:
        logger.info(f"[Cancel] Process terminated successfully")
    else:
        logger.warning(f"[Cancel] Process termination may have failed")
```

**Insertion Point for GPU Cleanup:**

- **Location:** After `terminate_process_gracefully()` call
- **Line:** Immediately after process termination confirmation
- **Before:** Job status update to CANCELLED

---

### ✅ Step 4: Check Dependencies and Imports

**Current Health Check GPU Logic (Line ~1622):**

```python
try:
    import torch
    if torch.cuda.is_available():
        gpu_available = True
        gpu_count = torch.cuda.device_count()
        gpu_name = torch.cuda.get_device_name(0) if gpu_count > 0 else "Unknown"
        gpu_info = f"{gpu_count}x {gpu_name}"
        logger.info(f"GPU detected: {gpu_info}")
except Exception as e:
    logger.warning(f"GPU check failed: {e}")
```

**GPU Cleanup Pattern to Use:**

```python
try:
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        logger.info(f"[Cancel] GPU cache cleared for job {job_id}")
except Exception as e:
    logger.warning(f"[Cancel] Could not clear GPU cache: {e}")
```

**Analysis:**

- ✅ Torch import is already used (health check)
- ✅ Pattern: Try/except wrapper for optional GPU cleanup
- ✅ No breaking changes - GPU cleanup is optional enhancement
- ✅ If torch not available, cleanup is skipped gracefully

---

### ✅ Step 5: Identify All Files That Call These Functions

**Files That Call `cancel_job()`:**

**Search Results:**

```bash
grep -r "cancel_job" lib/ app/
```

**Expected Callers:**

1. `lib/training/training_server.py` - API endpoint `/api/training/cancel/{job_id}`
2. Potentially frontend API routes in `app/api/training/`

Let me verify...

---

### ✅ Step 6: Check for Existing Tests

**Test Files Found:**

- `lib/training/test_hardcoded_training.py` - Direct training test
- `lib/training/test_server_validation.py` - Server validation tests
- `lib/training/test_progress_tracking.py` - Progress tracking tests
- `lib/training/test_integration.py` - Integration tests
- `lib/training/test_final_verification.py` - Final verification

**Need to Check:**

- Do any tests rely on specific cancellation behavior?
- Do any tests mock `monitor_job()` function?

---

## Implementation Plan

### Change 1.1: Add Timeout Detection to `monitor_job()`

**File:** `lib/training/training_server.py`  
**Function:** `monitor_job()` (Line 837)  

**New Variables to Add (at function start):**

```python
last_progress_update = time.time()  # Track last progress update time
TIMEOUT_MINUTES = 10  # Configurable timeout threshold
last_updated_at = None  # Track last updated_at timestamp from progress file
```

**Logic to Add (after reading progress data):**

```python
# Update last progress timestamp if progress changed
current_updated_at = progress_data.get("updated_at")
if current_updated_at != last_updated_at:
    last_progress_update = time.time()
    last_updated_at = current_updated_at

# Check for timeout (no progress updates for TIMEOUT_MINUTES)
time_since_update = time.time() - last_progress_update
if time_since_update > (TIMEOUT_MINUTES * 60):
    logger.error(
        f"[Monitor] Job {job_id} timed out - no progress for "
        f"{TIMEOUT_MINUTES} minutes (last update: {time_since_update:.0f}s ago)"
    )
    job.status = JobStatusEnum.FAILED
    job.error = f"Training timed out - no progress for {TIMEOUT_MINUTES} minutes"
    job.completed_at = datetime.utcnow().isoformat()
    
    # Terminate stuck process
    if job.process and job.process.poll() is None:
        logger.info(f"[Monitor] Terminating timed-out process PID {job.process.pid}")
        terminate_process_gracefully(job.process, timeout=5)
    
    # Persist failure
    persist_job(job_id, {
        "job_id": job_id,
        "user_id": job.user_id,
        "model_name": job.model_name,
        "dataset_path": job.dataset_path,
        "status": "failed",
        "error": job.error,
        "completed_at": job.completed_at + "Z" if not job.completed_at.endswith("Z") else job.completed_at
    })
    
    break  # Exit monitor loop
```

**Insertion Point:**

- After line ~1020 (after progress file reading)
- Before existing `if job.process is None:` check

---

### Change 1.2: Add GPU Cleanup to `cancel_job()`

**File:** `lib/training/training_server.py`  
**Function:** `cancel_job()` (Line 634)  

**Code to Add (after process termination):**

```python
# Clear GPU cache after process termination (Phase 1.2)
try:
    import torch
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        logger.info(f"[Cancel] GPU cache cleared for job {job_id}")
except Exception as e:
    logger.warning(f"[Cancel] Could not clear GPU cache: {e}")
```

**Insertion Point:**

- After `terminate_process_gracefully()` call
- Before `job.status = JobStatusEnum.CANCELLED`
- Exact location: After line ~685 (where termination is confirmed)

---

## Breaking Change Analysis

### Potential Risks

**Risk 1: Timeout False Positives**

- **Scenario:** Long evaluation steps might appear as "no progress"
- **Mitigation:** 10-minute timeout is conservative (longer than any eval)
- **Mitigation:** Only triggers if `updated_at` field doesn't change
- **Breaking:** LOW - Training updates progress every 2-5 seconds normally

**Risk 2: GPU Cache Clearing Side Effects**

- **Scenario:** GPU cleanup might affect other processes on same GPU
- **Mitigation:** `torch.cuda.empty_cache()` only releases unused cached memory
- **Mitigation:** Wrapped in try/except, gracefully skips if torch unavailable
- **Breaking:** NONE - This is a cleanup operation, doesn't affect other processes

**Risk 3: Monitor Loop Changes**

- **Scenario:** Timeout logic might interfere with normal completion
- **Mitigation:** Timeout only checked during RUNNING status
- **Mitigation:** Normal completion (poll_result != None) takes precedence
- **Breaking:** LOW - Timeout check happens before process poll check

---

### Files Affected

**Direct Changes:**

- ✅ `lib/training/training_server.py` - ONLY FILE MODIFIED

**Indirect Dependencies:**

- ✅ None - All changes are internal to training_server.py

**API Endpoints Affected:**

- ✅ None - No endpoint signatures changed
- ✅ `/api/training/cancel/{job_id}` - Same return type, enhanced behavior
- ✅ `/api/training/status/{job_id}` - May show "failed" for timed-out jobs (expected)

**Database Schema:**

- ✅ None - Uses existing "failed" status, existing error field

**Frontend:**

- ✅ None - Frontend already handles "failed" status
- ✅ Enhanced: Frontend will see timeout error message in job.error field

---

## Testing Plan

### Manual Tests

**Test 1.1a: Normal Training (No Timeout)**

```python
# Start a normal training job
# Verify: Completes successfully
# Verify: No timeout triggered
# Expected: Job completes normally, no false positives
```

**Test 1.1b: Stuck Job (Process Dies)**

```python
# Start a training job
# Kill the process manually (kill -9 PID)
# Wait 10+ minutes
# Verify: Job auto-fails with timeout error
# Verify: Process is terminated
# Verify: Database shows "failed" status
```

**Test 1.1c: Slow Evaluation (No False Timeout)**

```python
# Start a training job with large eval dataset
# Verify: Long eval steps don't trigger timeout
# Expected: Timeout only if updated_at doesn't change for 10min
```

**Test 1.2a: Cancellation with GPU Check**

```python
# Start a training job
# Cancel mid-training
# Check GPU memory with: nvidia-smi
# Verify: Memory released
# Verify: No GPU error messages
```

**Test 1.2b: Cancellation Without GPU**

```python
# Simulate: Remove torch or run on CPU-only system
# Start a training job
# Cancel mid-training
# Verify: Cancellation works (no crash)
# Verify: Warning logged about GPU cleanup skip
```

---

### Integration Tests

**Test: Queue + Timeout**

```python
# Queue 2 jobs
# Job 1: Kill process after start
# Verify: Job 1 times out after 10 minutes
# Verify: Job 2 starts from queue after Job 1 fails
```

**Test: Cancel + Queue**

```python
# Queue 3 jobs
# Cancel Job 2 (queued)
# Verify: Job 2 removed from queue
# Verify: Job 3 starts after Job 1 completes
```

---

## Rollback Plan

### If Changes Break Something

**Rollback Steps:**

1. Restore `training_server.py` from git:

   ```bash
   git checkout lib/training/training_server.py
   ```

2. Restart training server:

   ```bash
   pkill -f training_server.py
   python lib/training/training_server.py
   ```

3. Verify rollback:

   ```bash
   curl http://localhost:8000/health
   ```

**Affected Systems:**

- Training server only (single process)
- No database changes to revert
- No frontend changes to revert

---

## Pre-Implementation Checklist

Before making ANY changes:

- [ ] **Verify:** Read current `monitor_job()` function (line 837)
- [ ] **Verify:** Read current `cancel_job()` function (line 634)
- [ ] **Verify:** Check existing test files won't break
- [ ] **Verify:** No other files import/call modified functions directly
- [ ] **Verify:** Understand current error handling flow
- [ ] **Verify:** Backup file or commit current state

**User Approval Required:**

- [ ] Review this verification document
- [ ] Approve timeout threshold (10 minutes)
- [ ] Approve GPU cleanup approach
- [ ] Approve testing plan
- [ ] Give GO/NO-GO decision

---

## Next Steps

**IF APPROVED:**

1. ✅ Create backup of `training_server.py`
2. ✅ Implement Change 1.1 (Timeout Detection)
3. ✅ Test Change 1.1 manually
4. ✅ Implement Change 1.2 (GPU Cleanup)
5. ✅ Test Change 1.2 manually
6. ✅ Run integration tests
7. ✅ Update progress log
8. ✅ Proceed to Phase 2 (if approved)

**STATUS:** AWAITING USER APPROVAL ⏸️

---

*End of Verification Document*
