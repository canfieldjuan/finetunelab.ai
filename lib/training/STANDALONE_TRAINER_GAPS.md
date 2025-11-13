# Standalone Trainer vs Training Server - Gap Analysis

## Current State

**standalone_trainer.py**: CLI-based training execution script
**training_server.py**: FastAPI server that wraps standalone_trainer.py

## What standalone_trainer.py IS Good At

✅ **Core Training Logic**
- SFT, DPO training methods
- Model loading (quantization, LoRA)
- Dataset loading and preprocessing
- Metrics tracking (TrainingMetricsCallback)
- Progress file generation (progress.json)
- GPU monitoring (pynvml)
- Checkpointing
- TensorBoard logging

✅ **Robustness**
- Error handling
- Clean logging
- Resource cleanup
- Argument parsing

## Critical Gaps for a Proper Training Server

### 1. ❌ **No API Interface**
- standalone_trainer.py is CLI-only
- Cannot receive requests over HTTP
- No REST endpoints
- No way to submit jobs programmatically

**What's needed:**
- FastAPI server wrapper (already exists in training_server.py)
- POST /api/training/execute
- GET /api/training/status/{job_id}
- POST /api/training/cancel/{job_id}

### 2. ❌ **No Job Queue Management**
- Runs one training at a time
- Cannot handle concurrent job submissions
- No queue system for multiple users

**What's needed:**
- Job queue (FIFO)
- Job status tracking (queued → running → completed/failed)
- Concurrent job handling (1 active + N queued)

### 3. ❌ **No Job Cancellation**
- Cannot stop a running training
- No graceful termination
- No cleanup on cancel

**What's needed:**
- Cancellation endpoint
- Process termination (SIGTERM → SIGKILL)
- Cleanup of partial outputs
- Update job status to "cancelled"

### 4. ❌ **No Pause/Resume from Checkpoint**
- Can resume from checkpoint via CLI arg
- But no API to trigger pause
- No mid-training checkpoint saving (only at save_steps)
- No state preservation for resume

**What's needed:**
- Pause endpoint (trigger checkpoint save + stop)
- Resume endpoint (find latest checkpoint + restart)
- Better checkpoint management

### 5. ❌ **No Multi-Job Status Tracking**
- Only tracks current job
- No history of previous jobs
- No job persistence across restarts

**What's needed:**
- Job database (or JSON file store)
- GET /api/jobs (list all jobs)
- Job history with filters (status, user, date)
- Persistent storage (survives server restart)

### 6. ❌ **No Real-Time Progress Streaming**
- Progress.json is file-based polling
- No WebSocket/SSE for live updates
- UI must poll progress.json

**What's needed:**
- WebSocket endpoint for live metrics
- Server-Sent Events (SSE) alternative
- Real-time loss/GPU/throughput streaming

### 7. ❌ **No Authentication/Authorization**
- No user identification
- Anyone can submit/cancel jobs
- No per-user job isolation

**What's needed:**
- JWT/session token validation
- User ID tracking per job
- User-only job visibility (users see only their jobs)

### 8. ❌ **No Resource Management**
- No GPU allocation tracking
- Cannot limit concurrent GPU usage
- No memory/compute quotas

**What's needed:**
- GPU availability check before starting
- Resource reservation system
- Queue based on GPU availability

### 9. ❌ **No Job Artifacts Management**
- Outputs scattered in logs/job_{id}/
- No centralized artifact storage
- No download endpoint for models

**What's needed:**
- GET /api/training/{job_id}/model (download trained model)
- GET /api/training/{job_id}/logs (download logs)
- Artifact cleanup policies

### 10. ❌ **No Health/Status Endpoint**
- Cannot check if server is running
- No system health metrics

**What's needed:**
- GET /health (alive check)
- GET /api/system/status (GPU, queue, resources)

## What training_server.py Already Provides

✅ FastAPI app with CORS
✅ Job queue worker (sequential processing)
✅ Job status tracking (JobStatus dataclass)
✅ /api/training/execute endpoint
✅ /api/training/status/{job_id} endpoint
✅ /api/training/cancel/{job_id} endpoint
✅ Process spawning (subprocess.Popen)
✅ Progress monitoring (reads progress.json)
✅ Database persistence via callbacks
✅ /health endpoint

## What training_server.py is MISSING

❌ **Pause/Resume** - No pause endpoint, basic resume exists
❌ **WebSocket/SSE** - Still file-based polling for progress
❌ **Authentication** - No token validation (relies on caller)
❌ **Resource Quotas** - No limits on job count/GPU usage
❌ **Artifact Download** - No model/log download endpoints
❌ **Job History Filters** - GET /api/jobs exists but limited filters
❌ **Better Error Recovery** - Jobs can get stuck in "running" state
❌ **Checkpoint Management** - No automatic checkpoint cleanup/rotation

## Priority Improvements

### High Priority
1. **Pause/Resume Training**
   - Add pause endpoint
   - Trigger checkpoint save
   - Stop process gracefully
   - Resume from latest checkpoint

2. **Better Job Status Updates**
   - Handle stuck "running" jobs (timeout detection)
   - Auto-mark failed jobs when process dies
   - Cleanup zombie processes

3. **WebSocket Progress Streaming**
   - Replace progress.json polling
   - Real-time metrics to UI
   - Better UX, less latency

### Medium Priority
4. **Model Download Endpoint**
   - GET /api/training/{job_id}/model
   - Stream trained model file
   - Support checkpoint downloads

5. **Job Artifacts Management**
   - List checkpoints for job
   - Download specific checkpoint
   - Cleanup old artifacts

6. **Resource Management**
   - GPU availability check
   - Queue cap (max 10 queued jobs)
   - Auto-reject if no resources

### Low Priority
7. **Advanced Filters**
   - Search jobs by model name
   - Filter by date range
   - Sort by duration/loss

8. **Job Templates**
   - Save successful configs as templates
   - Quick-start from template

## Conclusion

**standalone_trainer.py** is excellent as a training executor but lacks server capabilities.

**training_server.py** wraps it well but needs:
- Pause/Resume functionality
- WebSocket streaming
- Better error recovery
- Artifact management

The current architecture (server → spawns → standalone trainer) is solid. Just needs feature additions, not redesign.
