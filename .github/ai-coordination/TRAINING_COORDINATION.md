# Training System Coordination

**Purpose:** Document training system implementation, RunPod deployments, and Python training scripts.

**Models Using This:** Primarily Claude (Python/backend), occasionally Copilot (UI for training features)

---

## 🚧 Current Work

### In Progress

**RunPod Template Testing**
- **Started:** 2025-12-19
- **Work:** Systematic testing of all training methods on RunPod
- **Tracking:** See `RUNPOD_TESTING.md`
- **Templates to test:**
  - ✅ SFT Standard (working)
  - ⏳ DPO Standard
  - ⏳ RLHF Standard (PPO)
  - ⏳ ORPO Standard
  - ⏳ CPT Standard
- **Goals:**
  1. Verify all templates work on RunPod
  2. Run outside dev tests + collect metrics via API
  3. Run batch tests programmatically
  4. Document limitations and gaps

### Recently Completed

**Alert Notifications Restoration**
- **Completed:** 2025-12-19
- **Branch:** Merged to main (commit f7fe3ab)
- **Work:** Restored alert notifications for RunPod training jobs
- **Files:**
  - `lib/training/standalone_trainer.py` (added trigger_alert function)
  - Alert triggers: job_started, job_completed, job_failed

**Metrics API URL Fix**
- **Completed:** 2025-12-19
- **Branch:** Merged to main (commit fdc9080)
- **Work:** Fixed METRICS_API_URL path (was incorrectly including jobId)
- **Impact:** Metrics now POST to correct endpoint

---

## 📋 Training System Architecture

### Components

```
Training System
├── Standalone Trainer (lib/training/standalone_trainer.py)
│   └── Downloaded by RunPod pods at runtime
│   └── Runs locally or in cloud
│
├── RunPod Service (lib/training/runpod-service.ts)
│   └── Generates bash scripts for pod deployment
│   └── Manages pod lifecycle
│
├── Alert Trigger (lib/training/alert_trigger.py)
│   └── DEPRECATED - logic moved to standalone_trainer.py
│   └── Keep for reference only
│
└── Training APIs (app/api/training/*)
    └── Deployment, status, metrics endpoints
```

### Data Flow

```
User submits job
    ↓
POST /api/training/deploy/runpod
    ↓
Create RunPod pod with env vars
    ↓
Pod downloads standalone_trainer.py
    ↓
Training starts → trigger_alert('job_started')
    ↓
Every N steps → POST metrics to /api/training/local/metrics
    ↓
Training completes → trigger_alert('job_completed')
OR
Training fails → trigger_alert('job_failed')
```

---

## 🔧 Environment Variables

### RunPod Pod Environment

**Set by:** `app/api/training/deploy/runpod/route.ts`

**Variables:**
```bash
JOB_ID                  # Unique job identifier
JOB_TOKEN               # Authentication token for API calls
USER_ID                 # User who owns this job
MODEL_NAME              # Model being trained
DATASET_URL             # Pre-signed URL for dataset download

# API Endpoints
METRICS_API_URL         # POST metrics here
ALERT_API_URL           # POST alerts here
INTERNAL_API_KEY        # API key for internal calls

# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY    # For RLS bypass

# HuggingFace (if provided)
HF_TOKEN                # For pushing to Hub
HF_REPO_NAME            # Target repository
```

**Usage in standalone_trainer.py:**
```python
JOB_ID = os.getenv('JOB_ID')
ALERT_API_URL = os.getenv('ALERT_API_URL')
METRICS_API_URL = os.getenv('METRICS_API_URL')
```

---

## 📡 API Contracts

### Metrics API

**Endpoint:** `POST /api/training/local/metrics`

**Headers:**
```
Authorization: Bearer {JOB_TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "job_id": "uuid",
  "metrics": [{
    "step": 100,
    "epoch": 1,
    "train_loss": 0.45,
    "eval_loss": 0.42,
    "learning_rate": 0.00005,
    "grad_norm": 0.512,
    "samples_per_second": 12.5,
    "gpu_memory_allocated_gb": 22.1,
    "gpu_utilization_percent": 97.5,
    "perplexity": 1.41,
    "timestamp": "2025-12-19T10:30:00.000Z"
  }]
}
```

### Alerts API

**Endpoint:** `POST /api/alerts/trigger`

**Headers:**
```
X-API-Key: {INTERNAL_API_KEY}
Content-Type: application/json
```

**Body:**
```json
{
  "type": "job_started" | "job_completed" | "job_failed" | "job_cancelled" | "gpu_oom" | "timeout_warning",
  "job_id": "uuid",
  "user_id": "uuid",
  "model_name": "meta-llama/Llama-2-7b",
  "status": "running" | "completed" | "failed",
  "progress": 50.0,
  "current_step": 500,
  "total_steps": 1000,
  "loss": 0.35,
  "duration": 3600000,
  "error_message": "CUDA out of memory",
  "error_type": "CUDA_OOM"
}
```

---

## 🎯 Critical Patterns

### 1. Alert Trigger Pattern

**When to trigger:**
- `job_started` - In `TrainingMetricsCallback.on_train_begin()`
- `job_completed` - In `main()` before `sys.exit(0)`
- `job_failed` - In `main()` exception handler before `sys.exit(1)`

**Implementation:**
```python
# Environment variables
ALERT_API_URL = os.getenv('ALERT_API_URL')
INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY', '')
JOB_ID = os.getenv('JOB_ID')
USER_ID = os.getenv('USER_ID')

def trigger_alert(alert_type, **kwargs):
    if not ALERT_API_URL or not JOB_ID or not USER_ID:
        return  # Skip if not configured

    payload = {
        'type': alert_type,
        'job_id': JOB_ID,
        'user_id': USER_ID,
        **kwargs
    }

    headers = {'Content-Type': 'application/json'}
    if INTERNAL_API_KEY:
        headers['X-API-Key'] = INTERNAL_API_KEY

    requests.post(ALERT_API_URL, json=payload, headers=headers, timeout=10)

# Usage
trigger_alert('job_started', total_steps=1000)
trigger_alert('job_completed', loss=0.25)
trigger_alert('job_failed', error_message=str(e))
```

### 2. Metrics Reporting Pattern

**When to report:**
- Every logging step (configured via `logging_steps` in config)
- On evaluation (if `do_eval=True`)
- On training completion

**Implementation:**
```python
def _post_metrics_to_api(self, progress_data):
    if not self.metrics_api_url:
        return  # Local mode, don't POST

    metric_point = {
        "step": progress_data.get("current_step"),
        "epoch": progress_data.get("current_epoch"),
        "train_loss": progress_data.get("train_loss"),
        # ... other metrics
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    payload = {
        "job_id": self.job_id,
        "metrics": [metric_point]
    }

    requests.post(
        self.metrics_api_url,
        json=payload,
        headers={"Authorization": f"Bearer {self.job_token}"},
        timeout=10
    )
```

### 3. RunPod Bash Script Pattern

**Script generation:** `lib/training/runpod-service.ts`

**Key sections:**
```bash
# 1. Download standalone_trainer.py from GitHub
curl -f -L -o /workspace/standalone_trainer.py \
  "https://raw.githubusercontent.com/canfieldjuan/finetunelab.ai/main/lib/training/standalone_trainer.py"

# 2. Set environment variables
export JOB_ID="${JOB_ID}"
export METRICS_API_URL="${METRICS_API_URL}"
export ALERT_API_URL="${ALERT_API_URL}"

# 3. Run training
python /workspace/standalone_trainer.py \
  --config /workspace/config.json \
  --execution-id ${JOB_ID}

# 4. Keep pod alive for model download (1 hour)
sleep 3600
```

---

## 📝 Decisions Log

### 2025-12-19: Metrics URL Path

**Decision:** Use `/api/training/local/metrics` (not `/api/training/local/{jobId}/metrics`)

**Rationale:**
- job_id is sent in POST body, not URL path
- GET endpoint has jobId in path, but POST doesn't
- Matches existing pattern for batch metrics upload

### 2025-12-19: Alert Integration

**Decision:** Embed alert logic in standalone_trainer.py (not separate alert_trigger.py)

**Rationale:**
- standalone_trainer.py is downloaded to RunPod pods
- alert_trigger.py was not being downloaded
- Simpler to have all logic in one file

### 2025-12-18: Standalone Trainer Download

**Decision:** Download standalone_trainer.py from GitHub at runtime

**Rationale:**
- Previously embedded in bash script (2000+ lines)
- Embedding made the script hard to maintain
- Downloading allows quick fixes without redeploying
- Single source of truth for training logic

---

## 🐛 Known Issues

### Fixed Issues

✅ **localhost in METRICS_API_URL** (Fixed 2025-12-19)
- Was using hardcoded localhost fallback
- Now uses NEXT_PUBLIC_APP_URL from environment

✅ **405 Method Not Allowed on metrics** (Fixed 2025-12-19)
- Was POSTing to wrong endpoint (/api/training/local/{jobId}/metrics)
- Now POSTs to correct endpoint (/api/training/local/metrics)

✅ **Missing alert notifications** (Fixed 2025-12-19)
- Alerts removed during standalone_trainer.py migration
- Restored trigger_alert() function and calls

### Open Issues

*No known training system issues*

---

## 🔜 Planned Improvements

### Priority: High
- [ ] Add retry logic for failed metric POSTs
- [ ] Implement checkpointing for long-running jobs
- [ ] Add real-time progress streaming via WebSockets

### Priority: Medium
- [ ] Support multiple dataset formats (CSV, Parquet)
- [ ] Add training pause/resume functionality
- [ ] Implement distributed training across multiple GPUs

### Priority: Low
- [ ] Add TensorBoard integration
- [ ] Support custom training callbacks
- [ ] Implement hyperparameter auto-tuning

---

## 📚 Related Files

**Python:**
- `lib/training/standalone_trainer.py` - Main training logic
- `lib/training/alert_trigger.py` - DEPRECATED (reference only)
- `lib/training/config_validator.py` - Config validation
- `lib/training/dataset-validator.ts` - Dataset validation

**TypeScript:**
- `app/api/training/deploy/runpod/route.ts` - RunPod deployment
- `lib/training/runpod-service.ts` - Bash script generation
- `app/api/training/local/metrics/route.ts` - Metrics endpoint
- `app/api/alerts/trigger/route.ts` - Alerts endpoint

**Documentation:**
- `.github/ai-coordination/API_COORDINATION.md` - API contracts
- `.github/ai-coordination/RUNPOD_TESTING.md` - Template testing tracking
- `LAUNCH_PLAN.md` - Overall training system architecture

---

## 💡 Tips for Working on Training System

1. **Always test locally first**
   ```bash
   python lib/training/standalone_trainer.py \
     --config test_config.json \
     --execution-id test-123
   ```

2. **Check environment variables**
   ```python
   logger.info(f"METRICS_API_URL: {os.getenv('METRICS_API_URL')}")
   logger.info(f"ALERT_API_URL: {os.getenv('ALERT_API_URL')}")
   ```

3. **Monitor RunPod logs in real-time**
   - Use RunPod dashboard console
   - Check for alert POST success/failure
   - Watch for metric POST errors

4. **Test integration with test branch**
   ```bash
   git checkout -b test/training-feature
   git merge claude/backend-changes
   # Deploy test job, verify alerts and metrics work
   ```

---

**Last Updated:** 2025-12-19
