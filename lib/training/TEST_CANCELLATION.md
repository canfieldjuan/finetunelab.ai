# Job Cancellation Testing Guide

## Prerequisites

1. Training server running on port 8000
2. Database migration applied (add 'cancelled' to status constraint)
3. At least one training job ready to submit

---

## Test 1: Cancel Queued Job

**Setup**:

1. Submit 2 training jobs quickly (both will queue)
2. First job will start, second will be queued

**Test**:

```bash
# Check queue status
curl http://localhost:8000/api/training/queue

# Cancel the queued job (use job_id from queue response)
curl -X POST http://localhost:8000/api/training/cancel/{queued_job_id}
```

**Expected Result**:

```json
{
  "success": true,
  "job_id": "xxx",
  "previous_status": "queued",
  "message": "Job removed from queue and cancelled"
}
```

**Verification**:

- Check queue status again - job should be gone
- Check job status - should show CANCELLED
- First job should continue running normally

---

## Test 2: Cancel Running Job

**Setup**:

1. Submit a training job
2. Wait for it to start running (status = RUNNING)

**Test**:

```bash
# Get job status
curl http://localhost:8000/api/training/status/{job_id}

# Cancel the running job
curl -X POST http://localhost:8000/api/training/cancel/{job_id}
```

**Expected Result**:

```json
{
  "success": true,
  "job_id": "xxx",
  "previous_status": "running",
  "message": "Job cancelled (was running)"
}
```

**Verification**:

- Check process list - training process should be terminated
- Check job status - should show CANCELLED
- GPU memory should be freed
- If another job was queued, it should start automatically

---

## Test 3: Cancel Completed Job

**Setup**:

1. Let a training job complete successfully

**Test**:

```bash
# Try to cancel completed job
curl -X POST http://localhost:8000/api/training/cancel/{completed_job_id}
```

**Expected Result**:

```json
{
  "success": false,
  "job_id": "xxx",
  "previous_status": "completed",
  "message": "Job already finished with status: completed"
}
```

**Verification**:

- Job status remains COMPLETED
- Error message clearly states job already finished

---

## Test 4: Cancel Non-Existent Job

**Test**:

```bash
# Try to cancel job that doesn't exist
curl -X POST http://localhost:8000/api/training/cancel/invalid-job-id
```

**Expected Result**:

```json
{
  "success": false,
  "job_id": "invalid-job-id",
  "message": "Job not found"
}
```

---

## Test 5: Multiple Cancellations (Idempotency)

**Setup**:

1. Start a training job
2. Cancel it
3. Try to cancel again

**Test**:

```bash
# Cancel once
curl -X POST http://localhost:8000/api/training/cancel/{job_id}

# Cancel again immediately
curl -X POST http://localhost:8000/api/training/cancel/{job_id}
```

**Expected Result**:
Second cancel should return:

```json
{
  "success": false,
  "job_id": "xxx",
  "previous_status": "cancelled",
  "message": "Job already finished with status: cancelled"
}
```

---

## Test 6: Queue Continues After Cancellation

**Setup**:

1. Submit 3 training jobs (Job A, B, C)
2. Job A starts running
3. Jobs B and C are queued

**Test**:

```bash
# Check queue
curl http://localhost:8000/api/training/queue
# Should show: running=1, queued=2

# Cancel Job A (running)
curl -X POST http://localhost:8000/api/training/cancel/{job_a_id}

# Wait 10 seconds

# Check queue again
curl http://localhost:8000/api/training/queue
# Should show: Job B now running, Job C queued
```

**Expected Result**:

- Job A terminates
- Job B automatically starts (queue worker picks it up)
- Job C moves to position 1 in queue
- Queue processing continues smoothly

---

## Test 7: Graceful vs Force Termination

**Test**:

```bash
# Start a job that will run for a while
# Cancel it and watch server logs

curl -X POST http://localhost:8000/api/training/cancel/{job_id}
```

**Check Server Logs**:

```
[Terminate] Attempting graceful termination of PID 12345
[Terminate] Process 12345 terminated gracefully
```

OR (if process hangs):

```
[Terminate] Attempting graceful termination of PID 12345
[Terminate] Process 12345 did not terminate gracefully, forcing kill
[Terminate] Process 12345 force killed
```

---

## Database Verification

**After cancelling jobs, check database**:

```sql
-- Via Supabase SQL Editor or psql
SELECT id, status, error, completed_at 
FROM local_training_jobs 
WHERE status = 'cancelled';
```

**Expected**:

- Cancelled jobs have status = 'cancelled'
- error field = "Cancelled by user"
- completed_at timestamp is set

---

## UI Testing (If Cancel Button Added)

**Manual UI Test**:

1. Go to training job list in UI
2. Submit a training job
3. Click "Cancel" button while job is running
4. Job status should update to "CANCELLED"
5. No errors in browser console
6. Server remains responsive

---

## Performance Testing

**Test server stability**:

```bash
# Submit and cancel 10 jobs rapidly
for i in {1..10}; do
  # Submit job (via UI or API)
  # Get job_id
  # Cancel immediately
  curl -X POST http://localhost:8000/api/training/cancel/{job_id}
done

# Check server is still responsive
curl http://localhost:8000/api/training/queue
```

**Expected**:

- All jobs cancelled successfully
- No memory leaks
- Server remains stable
- Queue continues to work

---

## Troubleshooting

### Job won't cancel

- Check server logs for errors
- Verify process is actually running (`ps aux | grep standalone_trainer`)
- Try force kill manually and investigate

### Database constraint error

- Verify migration applied: `status IN (..., 'cancelled')`
- Check Supabase dashboard for constraint definition

### Queue doesn't continue after cancellation

- Check queue worker is running (should start on server boot)
- Check server logs for queue worker errors
- Verify get_running_jobs() returns empty after cancellation

---

## Success Criteria

✅ All test cases pass
✅ Jobs can be cancelled in any state
✅ Queue continues processing after cancellation
✅ Server remains stable
✅ Database correctly stores cancellations
✅ No resource leaks (GPU memory, processes)
