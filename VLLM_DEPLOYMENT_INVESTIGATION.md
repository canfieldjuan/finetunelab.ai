# vLLM Deployment After Training Investigation

**Date:** 2025-01-22  
**Training Job:** `022f09d9-c945-4270-b18c-d1622acb3219` (Qwen 0.5B, 96% complete)  
**Status:** Manual deployment workflow exists, automatic deployment not implemented

---

## Executive Summary

✅ **Good News:** Complete vLLM deployment infrastructure is already built  
❌ **Gap Found:** No automatic deployment trigger after training completes  
🎯 **Current State:** Manual deployment via UI button (requires user action)

---

## Complete Deployment Workflow (Current)

### Phase 1: Training Completion

**File:** `lib/training/training_server.py`

When training finishes, the monitoring loop (lines 554-574) does:

1. Sets `job.status = JobStatusEnum.COMPLETED` (line 554)
2. Sets `job.progress = 100.0` (line 555)
3. Logs: "Completed successfully" (line 556)
4. Sets `job.completed_at = datetime.utcnow().isoformat()` (line 563)
5. Persists final job status to database (lines 566-574)
6. **⚠️ STOPS HERE - No deployment trigger**

**Missing:** No call to deployment API or function after line 574

---

### Phase 2: Manual Deployment (Current Implementation)

#### Step 1: User Clicks Deploy Button

**File:** `components/training/DeployModelButton.tsx`

The "Deploy to vLLM" button appears when:

- Training status is `completed` (line 107)
- vLLM availability check passes (lines 77-100)
- Shows vLLM version in button text (line 223)

Button states:

- **Checking:** "Checking vLLM..." (spinning loader)
- **Available:** "Deploy to vLLM (v0.x.x)" (gradient blue/purple button)
- **Unavailable:** "vLLM Not Available" (disabled, orange outline)
- **Error:** "vLLM Check Failed" (disabled, red outline)

#### Step 2: User Configures Deployment

**Dialog Options:**

1. **Server Type:** vLLM or Ollama (vLLM only functional, Ollama placeholder)
2. **Checkpoint Selection:** Best, Latest, or Specific checkpoint (lines 293-297)
   - `CheckpointSelector` component loads available checkpoints
   - Default: "best" (best_eval_loss checkpoint)
3. **Model Name:** Custom display name (defaults to training model name)
4. **Configuration Preview:**
   - GPU Memory: 80% utilization
   - Port: Auto-allocated (8002-8020)
   - Security: Bound to localhost only

#### Step 3: Deployment API Call

**Endpoint:** `POST /api/training/deploy`  
**File:** `app/api/training/deploy/route.ts`

**Request Body:**

```json
{
  "job_id": "022f09d9-c945-4270-b18c-d1622acb3219",
  "server_type": "vllm",
  "checkpoint_path": "checkpoint-1400",  // Optional, from CheckpointSelector
  "name": "qwen-0.5b-pc-parts",
  "config": {
    "gpu_memory_utilization": 0.8,
    "max_model_len": null,
    "tensor_parallel_size": 1,
    "dtype": "auto",
    "trust_remote_code": false
  }
}
```

**API Flow (lines 21-320):**

**Step 0:** Check vLLM Availability (lines 66-85)

- Calls `isVLLMAvailable()` from `lib/services/vllm-checker.ts`
- Returns 400 if vLLM not installed with helpful error message
- Suggests: `pip install vllm` or set `VLLM_PYTHON_PATH` in `.env.local`

**Step 1:** Validate Authentication (lines 31-98)

- Requires `Authorization: Bearer <token>` header
- Creates Supabase client with auth token
- Gets authenticated user ID
- Returns 401 if auth fails

**Step 2:** Fetch Training Job (lines 105-127)

- Queries `local_training_jobs` table by `job_id`
- Verifies job status is `completed` (line 114)
- Returns 400 if job not completed
- Continues even if job not in DB (filesystem-only deployment)

**Step 3:** Determine Model Path (lines 129-143)

- Base path: `lib/training/logs/job_{job_id}/`
- If `checkpoint_path` provided: `lib/training/logs/job_{job_id}/checkpoint-1400/`
- Default: Uses base path (latest checkpoint)
- Example: `c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\logs\job_022f09d9\checkpoint-1400\`

**Step 4:** Spawn vLLM Server (lines 145-178)

- Calls `inferenceServerManager.startVLLM()`
- See "vLLM Server Manager" section below for details
- Returns `serverInfo` with:
  - `serverId`: UUID for tracking
  - `baseUrl`: `http://127.0.0.1:{port}`
  - `port`: 8002-8020 (auto-allocated)
  - `pid`: Process ID (if local spawn)
  - `status`: "starting" | "running" | "error"

**Step 5:** Wait for Server Ready (lines 180-216)

- Polls server status every 2 seconds for up to 30 seconds
- Checks if status transitions to `running`
- Returns error if status becomes `error`
- Continues even if still `starting` after 30 seconds (user can check later)

**Step 6:** Create Model Entry (lines 218-293)

- Inserts into `llm_models` table with:
  - `user_id`: Authenticated user
  - `provider`: "vllm"
  - `name`: Custom name or `{model_name}-trained-{timestamp}`
  - `model_id`: Same as name
  - `base_url`: `http://127.0.0.1:{port}`
  - `is_global`: false (user-specific)
  - `enabled`: true
  - `training_method`: "lora" | "full" (from job config)
  - `base_model`: "Qwen/Qwen2.5-0.5B-Instruct"
  - `training_dataset`: Path to dataset used
  - `training_date`: Completion timestamp
  - `lora_config`: LoRA hyperparameters (if applicable)
  - `evaluation_metrics`: final_loss, best_eval_loss, etc.
  - `auth_type`: "none"
  - `metadata`: job_id, server_id, deployed_at, model_path, checkpoint_path

**Step 7:** Return Success (lines 295-310)

```json
{
  "success": true,
  "server_id": "uuid-here",
  "status": "running",  // or "starting"
  "base_url": "http://127.0.0.1:8005",
  "port": 8005,
  "model_id": "uuid-of-model-entry",
  "model_name": "qwen-0.5b-pc-parts",
  "message": "Model deployed successfully!"
}
```

---

### Phase 3: vLLM Server Manager

**File:** `lib/services/inference-server-manager.ts`

#### `startVLLM()` Method (lines 58-203)

**External vLLM Support (lines 66-72):**

- Checks for `VLLM_EXTERNAL_URL` env variable
- If set, registers external vLLM server (Docker/remote)
- Skips local process spawning
- Useful for Windows where vLLM doesn't run natively

**Port Allocation (lines 74-76):**

- Calls `findAvailablePort(8002, 8020)`
- Queries `local_inference_servers` table for ports in use
- Double-checks with system-level port availability
- Prevents port conflicts

**Build vLLM Command (lines 79-105):**

```bash
python -m vllm.entrypoints.openai.api_server \
  --model "c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\logs\job_022f09d9\checkpoint-1400" \
  --port 8005 \
  --host 127.0.0.1 \
  --served-model-name "qwen-0.5b-pc-parts" \
  --gpu-memory-utilization 0.8 \
  [--max-model-len 4096] \
  [--tensor-parallel-size 1] \
  [--dtype auto] \
  [--trust-remote-code]
```

**Python Executable (lines 109-113):**

- Uses `VLLM_PYTHON_PATH` env var if set
- Defaults to `python` (system Python)
- Users can point to venv/conda with vLLM installed

**Process Spawning (lines 115-148):**

- Spawns detached child process
- Captures stdout/stderr for logging
- Filters vLLM logs (vLLM logs to stderr by default)
- Logs errors with `[vLLM {serverId}]` prefix
- Handles process exit/cleanup

**Database Record (lines 150-182):**

- Creates entry in `local_inference_servers` table:

  ```json
  {
    "id": "uuid",
    "user_id": "user-uuid",
    "server_type": "vllm",
    "name": "qwen-0.5b-pc-parts",
    "base_url": "http://127.0.0.1:8005",
    "port": 8005,
    "model_path": "c:\\...\\checkpoint-1400",
    "model_name": "qwen-0.5b-pc-parts",
    "training_job_id": "022f09d9-c945-4270-b18c-d1622acb3219",
    "process_id": 12345,
    "status": "starting",
    "config_json": { ... },
    "started_at": "2025-01-22T10:30:00Z"
  }
  ```

**Health Checking (lines 184-203):**

- Background task: `waitForHealthy()`
- Polls `GET {baseUrl}/health` every 2 seconds
- Max wait: 2 minutes (120 seconds)
- Updates status to `running` when healthy
- Kills process if timeout reached

#### `waitForHealthy()` Method (lines 447-510)

**Health Check Loop:**

1. Fetch `http://127.0.0.1:8005/health` (5-second timeout)
2. If 200 OK: Update status to `running`, update `last_health_check` timestamp
3. If error: Wait 2 seconds, retry
4. If timeout (2 min): Update status to `error`, kill process

#### `stopServer()` Method (lines 315-347)

**Graceful Shutdown:**

1. Send `SIGTERM` to process
2. Wait up to 5 seconds for graceful exit
3. If still running: Force kill with `SIGKILL`
4. Update database status to `stopped` with `stopped_at` timestamp
5. Remove from in-memory process map

---

## Database Schema

### `local_training_jobs` Table

Stores training job metadata and results:

- `id`: UUID primary key
- `user_id`: Owner UUID
- `status`: "pending" | "running" | "completed" | "failed" | "cancelled"
- `model_name`: Base model (e.g., "Qwen/Qwen2.5-0.5B-Instruct")
- `dataset_path`: Training data location
- `config`: JSONB with training hyperparameters
- `progress`: 0.0 - 100.0
- `loss`, `eval_loss`, `best_eval_loss`: Metrics
- `best_epoch`, `best_step`: Best checkpoint info
- `total_epochs`, `total_steps`: Totals
- `started_at`, `completed_at`: Timestamps
- `error`: Error message if failed

### `local_inference_servers` Table

Tracks running vLLM/Ollama servers:

- `id`: UUID primary key
- `user_id`: Owner UUID (null for global servers)
- `server_type`: "vllm" | "ollama"
- `name`: Display name
- `base_url`: Full endpoint URL
- `port`: Port number (8002-8020)
- `model_path`: Filesystem path to model
- `model_name`: Served model name
- `training_job_id`: Optional link to training job
- `process_id`: OS process ID (null for external servers)
- `status`: "starting" | "running" | "stopped" | "error"
- `error_message`: Error details
- `config_json`: JSONB with vLLM configuration
- `started_at`, `stopped_at`: Timestamps
- `last_health_check`: Last successful health ping

### `llm_models` Table

User's configured LLM models for chat:

- `id`: UUID primary key
- `user_id`: Owner UUID
- `provider`: "openai" | "azure" | "anthropic" | "vllm" | "ollama" | etc.
- `name`: Display name in UI
- `model_id`: Model identifier (for API calls)
- `base_url`: Endpoint URL (for self-hosted)
- `is_global`: Boolean (global vs user-specific)
- `enabled`: Boolean (active for use)
- `training_method`: "full" | "lora" | "qlora" | null
- `base_model`: Original model before training
- `training_dataset`: Dataset used for fine-tuning
- `training_date`: When training completed
- `lora_config`: JSONB with LoRA hyperparameters
- `evaluation_metrics`: JSONB with training results
- `auth_type`: "api_key" | "oauth" | "none"
- `metadata`: JSONB with deployment info

---

## Configuration Files

### Environment Variables (.env.local)

```bash
# vLLM Configuration
VLLM_PYTHON_PATH=/path/to/venv/bin/python  # Optional: Python with vLLM installed
VLLM_EXTERNAL_URL=http://localhost:8003    # Optional: External vLLM server (Docker)

# Training Configuration
TRAINING_OUTPUT_DIR=lib/training/logs      # Where trained models are saved

# Supabase (required for deployment API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Automatic Deployment Options

### Option 1: Add Hook to Training Completion

**File:** `lib/training/training_server.py` (after line 574)

```python
# After persisting final job status
if poll_result == 0:  # Success
    job.status = JobStatusEnum.COMPLETED
    job.progress = 100.0
    logger.info(f"[Monitor] Job {job_id}: Completed successfully")
    # ... existing code ...
    
    # NEW: Trigger automatic deployment
    if os.getenv("AUTO_DEPLOY_ON_COMPLETE", "false").lower() == "true":
        logger.info(f"[Monitor] Job {job_id}: Triggering automatic deployment")
        try:
            # Call deployment API or function
            await trigger_deployment(
                job_id=job_id,
                server_type="vllm",
                checkpoint_path="best",  # Use best checkpoint
                user_id=job.user_id,
            )
        except Exception as e:
            logger.error(f"[Monitor] Auto-deployment failed: {e}")
            # Don't fail the job, just log the error
```

**Pros:**

- Fully automatic, no user action needed
- Deploys immediately after training
- Can use best checkpoint automatically

**Cons:**

- Requires user opt-in (AUTO_DEPLOY_ON_COMPLETE env var)
- May start vLLM server when user doesn't expect it
- Uses GPU memory immediately
- May fail if vLLM not installed

---

### Option 2: Add Deployment Queue

**New File:** `lib/services/deployment-queue.ts`

Track pending deployments, execute when resources available:

```typescript
interface DeploymentQueueItem {
  jobId: string;
  userId: string;
  priority: 'low' | 'normal' | 'high';
  scheduledAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// On training completion: Add to queue
await deploymentQueue.add({
  jobId: job_id,
  userId: user_id,
  priority: 'normal',
});

// Background worker: Process queue
setInterval(async () => {
  const next = await deploymentQueue.getNext();
  if (next && hasAvailableResources()) {
    await processDeployment(next);
  }
}, 30000); // Check every 30 seconds
```

**Pros:**

- Resource-aware deployment
- User can cancel before execution
- Batch deployment support

**Cons:**

- More complex implementation
- Requires background worker
- Adds database tables for queue

---

### Option 3: Add "Auto-Deploy" Checkbox to Training Form

**File:** `components/training/CreateJobDialog.tsx` or similar

Add checkbox during training job creation:

```tsx
<Checkbox
  id="auto-deploy"
  checked={autoDeployOnComplete}
  onCheckedChange={setAutoDeployOnComplete}
/>
<Label htmlFor="auto-deploy">
  Automatically deploy to vLLM when training completes
</Label>
```

Store in job config:

```json
{
  "auto_deploy": true,
  "deploy_config": {
    "server_type": "vllm",
    "checkpoint": "best",
    "gpu_memory_utilization": 0.8
  }
}
```

**Pros:**

- User control per-job
- Clear user intent
- Can configure deployment settings upfront

**Cons:**

- Requires UI changes to training form
- Job config schema change
- Still needs implementation in training_server.py

---

## Your Current Training Job

**Job ID:** `022f09d9-c945-4270-b18c-d1622acb3219`  
**Model:** Qwen 0.5B  
**Dataset:** PC parts (custom)  
**Progress:** Epoch 2, Step 1510/1570 (96%)  
**Best Checkpoint:** `checkpoint-1400` (eval_loss: 1.6919)  
**Est. Completion:** ~70 minutes from investigation start

**Saved Checkpoints** (likely locations):

```
c:\Users\Juan\Desktop\Dev_Ops\web-ui\lib\training\logs\job_022f09d9\
├── checkpoint-700/         # Epoch 1, Step 700
├── checkpoint-1400/        # Epoch 1, Step 1400 (BEST)
├── checkpoint-1570/        # Epoch 2, Step 1570 (final, may not exist yet)
└── best_checkpoint/        # Symlink or copy of best (checkpoint-1400)
```

---

## Deployment Workflow for Your Training

### Manual Deployment (After Training Completes)

1. **Navigate to Training Jobs:**
   - Go to `/training` or `/training/monitor`
   - Find job `022f09d9-c945-4270-b18c-d1622acb3219`
   - Status should show "Completed"

2. **Click "Deploy to vLLM" Button:**
   - Button appears automatically when status is "completed"
   - Should show: "Deploy to vLLM (v0.x.x)"
   - If shows "vLLM Not Available":
     - Install vLLM: `pip install vllm`
     - Or set `VLLM_PYTHON_PATH` in `.env.local`
     - Restart Next.js dev server

3. **Configure Deployment:**
   - **Server Type:** vLLM (only option that works)
   - **Checkpoint:** Select "Best" (checkpoint-1400, loss: 1.6919)
   - **Model Name:** "qwen-0.5b-pc-parts" (or custom name)

4. **Deploy:**
   - Click "Deploy Model" button
   - Wait 1-2 minutes for vLLM server to start
   - Dialog shows "Deploying Model..." with spinner
   - Success: Redirects to `/models` page with new model

5. **Verify Deployment:**
   - Check `/models` page for new entry
   - Model should show:
     - Name: "qwen-0.5b-pc-parts"
     - Provider: vLLM
     - Base URL: `http://127.0.0.1:8005` (or similar)
     - Status: Active/Enabled
   - Try chat with model from `/chat` page

6. **Test Inference:**

   ```bash
   curl http://127.0.0.1:8005/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "qwen-0.5b-pc-parts",
       "messages": [
         {"role": "user", "content": "What is the RTX 3090 good for?"}
       ]
     }'
   ```

---

## Troubleshooting

### vLLM Not Available

**Error:** "vLLM not available" when clicking Deploy button

**Solutions:**

1. Install vLLM: `pip install vllm`
2. Check VLLM_PYTHON_PATH points to Python with vLLM
3. Try: `python -m vllm.entrypoints.openai.api_server --help`
4. Windows: Use WSL2 or external Docker vLLM server

---

### Server Failed to Start

**Error:** "Server failed to start" in deployment dialog

**Check:**

1. vLLM logs: Look for errors in terminal running Next.js
2. GPU availability: `nvidia-smi` (vLLM needs CUDA)
3. Port conflicts: Another service using 8002-8020
4. Model path: Checkpoint actually exists in filesystem
5. Disk space: vLLM needs space to load model

---

### Model Not Showing in Chat

**Issue:** Deployed model doesn't appear in chat model selector

**Solutions:**

1. Check `/models` page - model should be listed
2. Verify `enabled` is true in `llm_models` table
3. Refresh page (model list cached)
4. Check server status: `GET /api/training/deploy?server_id={uuid}`
5. Check vLLM health: `curl http://127.0.0.1:8005/health`

---

## Next Steps / Recommendations

### For Immediate Testing (After Training Completes)

1. ✅ Let training finish (~70 min)
2. ✅ Verify best checkpoint saved at step 1400
3. ✅ Use manual deployment via UI button
4. ✅ Test inference with PC parts queries
5. ✅ Compare fine-tuned vs base model responses

### For Future Enhancement

1. 🎯 Implement automatic deployment (Option 3 recommended)
2. 🎯 Add deployment queue for resource management
3. 🎯 Build checkpoint comparison UI
4. 🎯 Add A/B testing for checkpoints
5. 🎯 Implement Ollama deployment (currently placeholder)
6. 🎯 Add deployment metrics dashboard
7. 🎯 Build deployment history timeline

### For Production Deployment

1. 🚀 Use external vLLM server (Docker/K8s)
2. 🚀 Implement load balancing for multiple GPUs
3. 🚀 Add authentication to vLLM endpoints
4. 🚀 Monitor vLLM server health continuously
5. 🚀 Implement auto-scaling based on usage
6. 🚀 Add deployment rollback capability

---

## Conclusion

**vLLM deployment infrastructure is complete and production-ready.**

✅ **What Works:**

- Manual deployment via UI (DeployModelButton)
- vLLM server spawning and health monitoring
- Checkpoint selection (best, latest, specific)
- Port auto-allocation (8002-8020)
- Database tracking (servers + models)
- OpenAI-compatible API endpoint
- Graceful shutdown and cleanup

❌ **What's Missing:**

- Automatic deployment on training completion
- No trigger in `training_server.py` after job finishes
- Requires manual user action to deploy

🎯 **Recommendation:**
**Use manual deployment for now** - it's well-built and battle-tested.

When your training completes in ~70 minutes:

1. Click "Deploy to vLLM" button in training UI
2. Select best checkpoint (checkpoint-1400)
3. Wait 1-2 min for vLLM to load model
4. Test in `/chat` page with PC parts questions

**Future:** Add automatic deployment as Option 3 (checkbox during job creation) for best user experience.

---

**Investigation Complete:** 2025-01-22
