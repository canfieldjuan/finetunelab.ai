# RunPod Training Deployment Failure Analysis

**Date**: November 24, 2025  
**Status**: Critical Issues Identified - Requires Phased Fix  
**Impact**: Training deployments fail silently, incur costs without results

---

## Executive Summary

RunPod training deployment has **5 critical failure points** that prevent successful training execution. The primary issue is that dataset files are stored locally but the training script expects publicly accessible URLs. Additional issues include missing dependencies in Docker images, lack of error handling, and authentication gaps.

---

## Critical Issues Identified

### **Issue #1: Dataset Path Resolution Failure** 🔴 CRITICAL
**Severity**: CRITICAL - Training cannot start  
**File**: `app/api/training/deploy/runpod/route.ts`  
**Lines**: 260-270 (training script generation)

**Problem**:
```typescript
// Line 260 - generates training script with dataset path
const trainingScript = runPodService.generateTrainingScript(
  trainingConfig.model_name,
  trainingConfig.dataset_path || '',  // ❌ This is a LOCAL file path
  trainingConfig.config || {}
);
```

The generated script (line 272 in runpod-service.ts) attempts:
```bash
wget -O data/training_data.json "${datasetPath}"
```

**Root Cause**:
- `trainingConfig.dataset_path` contains local file paths like:
  - `/home/user/uploads/dataset.jsonl`
  - `/uploads/abc123/training_data.json`
  - `data/my-dataset.jsonl`
- `wget` cannot fetch local file paths
- Training pod has no access to application server's filesystem

**Evidence**:
- Database schema shows `training_configs.dataset_path` as TEXT (not URL)
- No URL generation code exists in deployment flow
- No file upload/hosting mechanism for training data

**Impact**:
- Training fails immediately when script executes
- Pod stays running (burning money) even though training never started
- No error feedback to user (pod appears "running")
- Estimated cost: $1-5/hour for idle pod

---

### **Issue #2: Metrics API Authentication Gap** 🟡 MEDIUM
**Severity**: MEDIUM - Training works but no visibility  
**File**: `app/api/training/deploy/runpod/route.ts`  
**Lines**: 263-267

**Problem**:
```typescript
environment_variables: {
  ...environment_variables,
  JOB_ID: jobId,
  JOB_TOKEN: jobToken,  // ❌ Token format may not match API auth
  METRICS_API_URL: `${appUrl}/api/training/jobs`
}
```

Training script POSTs metrics to:
```python
api_url = f"{METRICS_API_URL}/{JOB_ID}/metrics"
response = requests.post(
    api_url,
    json=payload,
    headers={"Authorization": f"Bearer {JOB_TOKEN}"},  # ❌ May not be accepted
    timeout=5
)
```

**Root Cause**:
- `/api/training/jobs/:id/metrics` likely requires JWT authentication
- `JOB_TOKEN` is a random base64 string, not a JWT
- API middleware may reject requests with invalid token format

**Evidence**:
- Line 247 in route.ts: `jobToken = crypto.randomBytes(32).toString('base64url')`
- No JWT signing/verification code visible
- Standard Next.js auth expects JWT format

**Impact**:
- Metrics not reported during training
- No progress visibility in UI
- User cannot monitor training status
- Non-critical: Training still completes, just no telemetry

---

### **Issue #3: Docker Image Missing Dependencies** 🟡 MEDIUM
**Severity**: MEDIUM - Training may fail early  
**File**: `lib/training/runpod-service.ts`  
**Line**: 137

**Problem**:
```typescript
imageName: request.docker_image || 'nvidia/cuda:12.1.0-devel-ubuntu22.04'
```

**Root Cause**:
- Default image is bare CUDA toolkit (no Python runtime)
- Training script starts with: `pip install -q transformers datasets...`
- If `pip` or `python` not in PATH, script fails immediately

**Evidence**:
- nvidia/cuda images are minimal base images
- No Python version specified in image tag
- Training script assumes Python 3.x environment

**Impact**:
- Pod may fail during dependency installation
- Long startup time (5-10 min) to install all packages
- Potential version conflicts with CUDA/PyTorch
- Estimated additional cost: $0.50-2.00 per deployment

---

### **Issue #4: Training Script Error Handling** 🟡 MEDIUM
**Severity**: MEDIUM - Cost implications  
**File**: `lib/training/runpod-service.ts`  
**Lines**: 480-485

**Problem**:
```bash
# Run training
python train.py

# Keep pod alive for result download
echo "Training complete. Download results from /workspace/fine_tuned_model"
sleep 3600
```

**Root Cause**:
- No error checking after `python train.py`
- Pod sleeps for 1 hour regardless of training success/failure
- Failed training still incurs full hour of compute cost

**Evidence**:
- No `if` condition checking exit code
- No `set -e` flag to exit on error
- `sleep 3600` executes unconditionally

**Impact**:
- Failed training costs same as successful training
- No early termination on error
- User must manually check logs to detect failures
- Cost waste: Up to 1 hour of GPU time per failed job

---

### **Issue #5: Secrets Vault Dependency** 🟢 LOW
**Severity**: LOW - Clear error message  
**File**: `app/api/training/deploy/runpod/route.ts`  
**Lines**: 316-331

**Problem**:
```typescript
const secret = await secretsManager.getSecret(user.id, 'runpod', supabase);

if (!secret) {
  console.error('[RunPod API] No RunPod credentials found');
  return NextResponse.json(
    { error: 'RunPod API key not configured. Please add your RunPod credentials in the Secrets Vault.' },
    { status: 400 }
  );
}
```

**Root Cause**:
- Deployment requires user to manually configure RunPod API key
- No onboarding flow guides users to set this up
- Error message is clear but requires manual intervention

**Evidence**:
- Secrets stored in `provider_secrets` table
- No auto-provisioning or default credentials
- User must navigate to separate settings page

**Impact**:
- First-time users encounter immediate failure
- Requires manual configuration before deployment
- Not a bug, but UX friction point
- Impact: User confusion, support burden

---

## Failure Sequence Diagram

```
User clicks "Deploy to RunPod"
        ↓
[1] Check RunPod API key
        ↓ (if missing)
    ❌ Return 400 error ← Issue #5
        ↓ (if present)
[2] Create local_training_jobs record
        ↓
[3] Generate training script with LOCAL dataset path ← Issue #1
        ↓
[4] Call RunPod API to create pod
        ↓
[5] Pod starts with default CUDA image ← Issue #3
        ↓
[6] Training script executes:
    - pip install dependencies (slow)
    - wget dataset ❌ FAILS (local path) ← Issue #1
    - Training never starts
    - sleep 3600 (pod idles for 1 hour) ← Issue #4
        ↓
[7] Metrics callback tries to POST ← Issue #2
    - API rejects (invalid auth)
    - No progress updates
        ↓
[8] Pod terminates after 1 hour
    - No model artifacts
    - $1-5 wasted
```

---

## Verification Evidence

### **Database Schema Verification**

**training_configs table** (from RUNPOD_TRAINING_FLOW.md:826):
```sql
CREATE TABLE training_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  dataset_path TEXT,  -- ❌ Not a URL, just TEXT field
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**local_training_jobs table** (from RUNPOD_TRAINING_FLOW.md:846):
```sql
CREATE TABLE local_training_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  dataset_path TEXT,  -- ❌ Also TEXT, not URL
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  job_token TEXT NOT NULL,
  config JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Code Verification**

**Route.ts - Job Creation** (lines 247-265):
```typescript
const jobId = crypto.randomUUID();
const jobToken = crypto.randomBytes(32).toString('base64url');  // ❌ Not JWT

const { error: jobError } = await supabase
  .from('local_training_jobs')
  .insert({
    id: jobId,
    user_id: user.id,
    model_name: trainingConfig.model_name,
    dataset_path: trainingConfig.dataset_path,  // ❌ Local path stored
    status: 'pending',
    job_token: jobToken,
    config: trainingConfig.config,
    started_at: new Date().toISOString()
  });
```

**RunPod Service - Training Script** (lines 260-485):
```typescript
generateTrainingScript(
  modelName: string,
  datasetPath: string,  // ❌ Receives local path
  trainingConfig: Record<string, unknown>
): string {
  return `
# Download training data
cd /workspace
mkdir -p data
wget -O data/training_data.json "${datasetPath}"  // ❌ wget fails on local paths
...
python train.py  // ❌ No error checking
...
sleep 3600  // ❌ Always executes
`.trim();
}
```

---

## Cost Impact Analysis

### **Per Failed Deployment**
- GPU pod runtime: 1 hour minimum (sleep command)
- GPU type: NVIDIA RTX A4000 (default)
- Cost per hour: ~$0.45/hour
- **Wasted cost per failure**: $0.45 - $5.00 (depending on GPU type)

### **Monthly Impact (Conservative)**
Assumptions:
- 20 users attempting RunPod deployment
- 50% failure rate due to dataset path issue
- Average 2 attempts per user before giving up

**Monthly waste**: 20 users × 2 attempts × 0.5 failure × $2.50 avg = **$50/month minimum**

### **User Experience Impact**
- Average debugging time: 30-60 minutes per user
- Support ticket rate: High (requires manual intervention)
- User retention risk: Medium (training is core feature)

---

## Related Files Inventory

### **Primary Files Requiring Changes**
1. `app/api/training/deploy/runpod/route.ts` (493 lines)
   - POST handler for deployment
   - Job creation logic
   - Training script generation call

2. `lib/training/runpod-service.ts` (522 lines)
   - RunPod API integration
   - Training script template
   - Pod lifecycle management

3. `lib/training/deployment.types.ts` (328 lines)
   - Type definitions
   - May need new types for dataset URLs

### **New Files Needed**
1. `app/api/datasets/download/route.ts` (NEW)
   - Dataset download endpoint
   - Token-based authentication
   - File streaming

2. `lib/training/dataset-upload-service.ts` (NEW)
   - Dataset URL generation
   - Temporary token management
   - Cloud storage integration (optional)

3. `migrations/add_dataset_download_tokens.sql` (NEW)
   - Database table for download tokens
   - Expiration tracking

### **Supporting Files**
1. `lib/secrets/secrets-manager.service.ts` (239 lines)
   - Already verified working
   - No changes needed

2. `.env.local` (86+ lines)
   - Contains `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - Verified correct

---

## Dependencies and Constraints

### **Technical Constraints**
1. **No Direct File Access**: RunPod pods cannot access application server filesystem
2. **Authentication Required**: Download endpoint must validate user ownership
3. **Token Security**: Time-limited tokens required (prevent abuse)
4. **File Size Limits**: Large datasets (>1GB) may need chunked uploads

### **Existing Infrastructure**
1. ✅ Supabase database (working)
2. ✅ Secrets vault (working)
3. ✅ RunPod API integration (working)
4. ❌ Dataset hosting/download mechanism (missing)
5. ❌ Metrics API authentication (incomplete)

### **User Workflow Assumptions**
- Users upload datasets through web UI
- Datasets stored in local filesystem (not cloud storage)
- Users expect immediate deployment after configuration
- Users monitor training progress through UI

---

## Security Considerations

### **Dataset Download Tokens**
- Must be time-limited (1-2 hours max)
- Single-use or rate-limited
- Tied to specific user and dataset
- Cannot be reused across deployments

### **Metrics API Authentication**
- Job tokens must be cryptographically secure
- API must validate token ownership
- Prevent token replay attacks
- Rate limiting on metrics endpoints

### **RunPod API Key Storage**
- Already handled by secrets vault ✅
- Encrypted at rest ✅
- User-scoped access ✅

---

## Success Criteria

### **Functional Requirements**
- [ ] Training deployments complete successfully
- [ ] Datasets accessible from RunPod pods
- [ ] Metrics reported during training
- [ ] Failed trainings terminate immediately
- [ ] Error messages actionable

### **Performance Requirements**
- [ ] Dataset download < 2 minutes (for 100MB files)
- [ ] Training starts within 5 minutes of deployment
- [ ] Metrics update every 30 seconds
- [ ] Failed deployments cost < 10% of successful ones

### **User Experience Requirements**
- [ ] Clear error messages with resolution steps
- [ ] Progress visibility throughout deployment
- [ ] One-click retry mechanism
- [ ] Cost estimation before deployment

---

## Next Steps

See `RUNPOD_DEPLOYMENT_FIX_PLAN.md` for phased implementation approach.
