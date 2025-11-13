# Production Inference Deployment - Investigation Report
**Date:** 2025-11-12
**Status:** INVESTIGATION COMPLETE - READY FOR PLANNING
**Purpose:** Close the training-to-production loop with RunPod Serverless inference deployment

---

## EXECUTIVE SUMMARY

**Gap Identified:** Users can train models but cannot deploy them to production inference endpoints automatically.

**Current State:** Training ends with checkpoints stored locally or in Supabase Storage, with no automated path to serving those models to end users.

**Proposed Solution:** Add production inference deployment to RunPod Serverless (initially) with manual deployment controls and budget safeguards.

---

## INVESTIGATION FINDINGS

### 1. CHECKPOINT STORAGE ARCHITECTURE ✅

**Finding:** Multiple checkpoint storage mechanisms exist

#### A. Cloud Deployments Table
**File:** `/supabase/migrations/20251031000001_create_cloud_deployments.sql`
**Line 47:** `checkpoint_urls TEXT[]` - Array of checkpoint URLs

**Purpose:** Stores URLs to checkpoints from cloud training (Kaggle, RunPod, HF, Colab)
**Status:** ✅ VERIFIED - Table exists and has checkpoint tracking

#### B. Artifact Store Service
**File:** `/lib/services/artifact-store.ts`
**Key Lines:**
- Line 27: `ArtifactType` includes `'checkpoint'`
- Line 68: Base path: `lib/training/artifacts`
- Line 64: Supabase Storage bucket: `'dag-artifacts'`
- Line 166: `registerArtifact()` - Uploads to Supabase Storage
- Line 285: `downloadArtifact()` - Downloads from Supabase Storage

**Purpose:** Manages artifact storage (models, datasets, checkpoints) in Supabase Storage
**Status:** ✅ VERIFIED - Service exists and functional

**Storage Table:** `dag_artifacts`
**Columns:**
- `execution_id`
- `job_id`
- `artifact_type` (includes 'checkpoint')
- `storage_path`
- `storage_backend` ('supabase_storage', 'local', 's3')
- `size_bytes`
- `checksum`
- `metadata`
- `pinned` (for retention)
- `expires_at` (default 30 days)

#### C. Checkpoint Types
**File:** `/lib/training/checkpoint.types.ts`
**Lines 10-40:** `TrainingCheckpoint` interface

**Fields:**
- `path` - Checkpoint directory name
- `epoch`, `step` - Training progress
- `eval_loss`, `train_loss` - Metrics
- `size_bytes` - File size
- `created_at` - Timestamp
- `is_best`, `is_latest` - Flags

#### D. Checkpoint List API
**File:** `/app/api/training/checkpoints/list/route.ts`
**Line 35:** Forwards requests to `http://localhost:8000` (local training server)

**Observation:** Checkpoints from LOCAL training are managed by a local Python server

---

### 2. EXISTING INFERENCE INFRASTRUCTURE ✅

#### Local Inference Servers Table
**File:** `/supabase/migrations/20251028000002_create_local_inference_servers.sql`

**Table:** `local_inference_servers`
**Purpose:** Track locally deployed inference servers (vLLM, Ollama)
**Line 14:** `server_type IN ('vllm', 'ollama')` - Only LOCAL servers

**Key Columns:**
- `user_id` - Owner
- `server_type` - 'vllm' or 'ollama'
- `name` - Display name
- `base_url`, `port` - Connection details
- `model_path` - Path to model on disk
- `model_name` - Display name
- `training_job_id` - Link to training job
- `status` - 'starting', 'running', 'stopped', 'error'
- `config_json` - vLLM/Ollama config

**Observation:** This table only handles LOCAL inference, not cloud deployments

---

### 3. RUNPOD INTEGRATION STATUS ✅

#### A. Secrets Vault
**File:** `/app/secrets/page.tsx`
**Line 139:** `runpod: { name: 'RunPod', description: 'RunPod API key for serverless GPU deployment' }`

**Status:** ✅ RunPod API key already supported in secrets vault

#### B. RunPod Training Service
**File:** `/lib/training/runpod-service.ts`

**API Used:** GraphQL API at `https://api.runpod.io/graphql` (line 48)
**Purpose:** Create on-demand training PODS (not serverless endpoints)
**Methods:**
- `createPod()` - Creates training pod using `podFindAndDeployOnDemand` mutation
- `getPodStatus()` - Gets pod status
- `stopPod()` - Stops pod
- `mapGPUType()` - Maps GPU types

**Observation:** Existing service is for TRAINING pods, NOT for serverless inference endpoints

#### C. RunPod Serverless vs Pods
**Key Difference:**
- **Pods (current):** On-demand instances for training - pay per hour, always running
- **Serverless (needed):** Auto-scaling inference endpoints - pay per request, scale to zero

**API Differences:**
- Pods: GraphQL API (`/graphql`)
- Serverless: REST API (`/v2/{endpoint_id}/run`, `/runsync`)

---

### 4. RUNPOD SERVERLESS API RESEARCH ✅

**Documentation:** docs.runpod.io/serverless/endpoints/overview

**Key Capabilities:**
- Auto-scaling serverless workers
- Sub-250ms cold start times
- Automatic scaling from 0 to hundreds of workers
- Customizable min/max worker counts
- Webhook support for job completion

**API Endpoints:**
- `/run` - Asynchronous job submission
- `/runsync` - Synchronous execution
- `/status/{job_id}` - Job status check
- `/cancel/{job_id}` - Cancel job

**Authentication:** API key in Authorization header

**Pricing Model:** Pay-per-execution (not per-hour like pods)

**Model Deployment:**
- Docker container-based
- Models can be bundled in container or loaded from HuggingFace Hub
- LoRA adapters can be loaded dynamically

---

### 5. MODEL ARTIFACT REQUIREMENTS ✅

**What We Need to Deploy:**

#### Option A: LoRA Adapter Only (Simplest)
- **Size:** ~100-500MB
- **Upload:** Direct to HuggingFace Hub or include in Docker
- **Base Model:** Load from HF Hub at runtime
- **Merge:** Not required, use PEFT at inference time

#### Option B: Merged Model (Full Model)
- **Size:** ~7-13GB (for 7B models)
- **Upload:** HuggingFace Hub or S3
- **Merge Process:** Merge adapter + base model before deployment
- **Storage:** Requires more space but faster inference

#### Option C: Quantized Model (Optimized)
- **Size:** ~4-8GB (for 7B models)
- **Quantization:** 4-bit or 8-bit
- **Upload:** HuggingFace Hub
- **Benefit:** Faster inference, lower GPU memory

**Recommendation:** Start with Option A (LoRA adapters) for MVP

---

### 6. BUDGET CONTROL REQUIREMENTS ✅

**User Requirement:** "budget is always a concern" - manual deployment with strict controls

**Required Controls:**
1. **Manual Approval:** No auto-deployment
2. **Cost Estimation:** Show estimated cost before deployment
3. **Budget Limits:** Set max spend per endpoint
4. **Usage Alerts:** Warn at thresholds (50%, 80%, 100%)
5. **Auto-Stop:** Stop endpoint at budget limit
6. **Cost Tracking:** Real-time cost monitoring

---

## FILES REQUIRING MODIFICATION/CREATION

### NEW FILES TO CREATE (9 files)

#### 1. `/supabase/migrations/20251112000002_create_inference_deployments.sql`
**Purpose:** New table for cloud inference deployments
**Estimated Lines:** ~150 lines

**Schema:**
```sql
CREATE TABLE inference_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Source model
  training_config_id UUID REFERENCES training_configs(id),
  training_job_id TEXT REFERENCES local_training_jobs(id),
  model_artifact_id UUID REFERENCES dag_artifacts(id), -- Link to checkpoint

  -- Deployment details
  provider TEXT NOT NULL CHECK (provider IN ('runpod-serverless', 'hf-endpoints', 'modal', 'replicate')),
  deployment_name TEXT NOT NULL,
  deployment_id TEXT NOT NULL, -- Provider's external ID
  endpoint_url TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('deploying', 'active', 'failed', 'stopped', 'scaling')),

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',

  -- Model details
  model_type TEXT, -- 'lora-adapter', 'merged-model', 'quantized'
  base_model TEXT, -- e.g., 'meta-llama/Llama-2-7b-hf'
  model_storage_url TEXT, -- HF Hub URL or S3 path

  -- Cost tracking
  cost_per_request DECIMAL(10, 6),
  budget_limit DECIMAL(10, 2),
  current_spend DECIMAL(10, 2) DEFAULT 0,
  request_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  error_message TEXT,
  metrics JSONB DEFAULT '{}',

  UNIQUE(provider, deployment_id)
);
```

**Indexes:**
- `idx_inference_deployments_user`
- `idx_inference_deployments_status`
- `idx_inference_deployments_provider`
- `idx_inference_deployments_training_config`

**RLS Policies:**
- Users can view own deployments
- Users can create own deployments
- Users can update own deployments
- Users can delete own deployments

---

#### 2. `/lib/inference/deployment.types.ts`
**Purpose:** TypeScript types for inference deployments
**Estimated Lines:** ~200 lines

**Types:**
```typescript
export type InferenceProvider =
  | 'runpod-serverless'
  | 'hf-endpoints'
  | 'modal'
  | 'replicate';

export type ModelType =
  | 'lora-adapter'
  | 'merged-model'
  | 'quantized';

export type InferenceStatus =
  | 'deploying'
  | 'active'
  | 'failed'
  | 'stopped'
  | 'scaling';

export interface RunPodServerlessConfig {
  gpu_type: string; // e.g., 'NVIDIA A40'
  max_workers: number;
  min_workers: number;
  idle_timeout_seconds: number;
  container_image: string;
}

export interface InferenceDeploymentRequest {
  training_config_id?: string;
  model_artifact_id: string;
  provider: InferenceProvider;
  deployment_name: string;
  model_type: ModelType;
  base_model: string;
  config: RunPodServerlessConfig; // Or other provider config
  budget_limit?: number;
}

export interface InferenceDeploymentResponse {
  deployment_id: string;
  endpoint_url: string;
  status: InferenceStatus;
  cost_per_request: number;
  created_at: string;
}

export interface InferenceDeploymentStatus {
  deployment_id: string;
  status: InferenceStatus;
  endpoint_url: string;
  request_count: number;
  current_spend: number;
  budget_limit?: number;
  error_message?: string;
}
```

---

#### 3. `/lib/inference/runpod-serverless-service.ts`
**Purpose:** RunPod Serverless API client for inference
**Estimated Lines:** ~400 lines
**Pattern:** Similar to `/lib/training/runpod-service.ts` but for serverless endpoints

**Key Methods:**
- `createEndpoint()` - Create serverless endpoint
- `getEndpointStatus()` - Get endpoint status
- `updateEndpoint()` - Scale/modify endpoint
- `stopEndpoint()` - Stop endpoint
- `getEndpointMetrics()` - Get usage metrics
- `estimateCost()` - Estimate deployment cost

**API Endpoints Used:**
- `POST https://api.runpod.io/v2/endpoints` - Create endpoint
- `GET https://api.runpod.io/v2/endpoints/{id}` - Get status
- `PATCH https://api.runpod.io/v2/endpoints/{id}` - Update
- `DELETE https://api.runpod.io/v2/endpoints/{id}` - Delete

---

#### 4. `/app/api/inference/deploy/route.ts`
**Purpose:** API route to create inference deployments
**Estimated Lines:** ~300 lines
**Pattern:** Similar to `/app/api/training/deploy/google-colab/route.ts`

**Endpoint:** `POST /api/inference/deploy`

**Flow:**
1. Authenticate user
2. Validate request (artifact exists, provider supported)
3. Get provider API key from secrets vault
4. Fetch model artifact metadata
5. Upload artifact to HuggingFace Hub (if not already there)
6. Call provider service to create endpoint
7. Store deployment record in `inference_deployments` table
8. Return deployment details

---

#### 5. `/app/api/inference/deployments/[id]/status/route.ts`
**Purpose:** Get deployment status
**Estimated Lines:** ~150 lines

**Endpoint:** `GET /api/inference/deployments/:id/status`

**Returns:**
- Current status
- Request count
- Current spend
- Budget remaining
- Endpoint URL
- Error messages (if any)

---

#### 6. `/app/api/inference/deployments/[id]/stop/route.ts`
**Purpose:** Stop/delete inference deployment
**Estimated Lines:** ~150 lines

**Endpoint:** `DELETE /api/inference/deployments/:id`

**Flow:**
1. Authenticate user
2. Verify ownership
3. Call provider API to stop endpoint
4. Update database status to 'stopped'
5. Return success

---

#### 7. `/components/inference/InferenceDeployButton.tsx`
**Purpose:** UI button to deploy trained model to inference
**Estimated Lines:** ~250 lines
**Location:** Training Dashboard

**Features:**
- Button shows "Deploy to Production"
- Opens modal with deployment configuration
- Provider selection (RunPod Serverless initially)
- GPU type selection
- Auto-scaling settings
- Budget limit input
- Cost estimation preview
- Deploy button with confirmation

---

#### 8. `/components/inference/InferenceDeploymentCard.tsx`
**Purpose:** Display inference deployment status
**Estimated Lines:** ~200 lines
**Location:** Deployments page

**Shows:**
- Deployment name
- Provider (RunPod Serverless)
- Status (deploying, active, stopped)
- Endpoint URL (copyable)
- Request count
- Current spend / Budget limit
- Actions: Stop, View Logs, Configure

---

#### 9. `/lib/inference/model-uploader.ts`
**Purpose:** Upload model artifacts to HuggingFace Hub
**Estimated Lines:** ~200 lines

**Methods:**
- `uploadLoRAAdapter()` - Upload LoRA adapter to HF Hub
- `uploadMergedModel()` - Upload full merged model
- `checkModelExists()` - Check if model already uploaded
- `getModelUrl()` - Get HF Hub URL

---

### FILES TO MODIFY (5 files)

#### 1. `/lib/training/deployment.types.ts`
**Modification:** Add exports for inference types (if shared)
**Line:** After line 302 (after Google Colab types)

**Addition:**
```typescript
// Re-export inference deployment types
export type { InferenceProvider, ModelType, InferenceStatus } from '@/lib/inference/deployment.types';
```

---

#### 2. `/lib/models/llm-model.types.ts`
**Line 9-20:** `ModelProvider` enum
**Modification:** Verify 'runpod' is included (it is at line 19)
**No changes needed** - already has 'runpod'

---

#### 3. `/components/training/TrainingDashboard.tsx`
**Purpose:** Add "Deploy to Production" button to completed training jobs
**Location:** Find where training job cards are rendered

**Insertion Point:** Need to find the exact component that renders job cards

**Addition:**
```typescript
import { InferenceDeployButton } from '@/components/inference/InferenceDeployButton';

// Inside training job card, after "View Logs" button:
{job.status === 'completed' && (
  <InferenceDeployButton
    trainingConfigId={job.config_id}
    trainingJobId={job.id}
    modelName={job.model_name}
  />
)}
```

---

#### 4. `/app/secrets/page.tsx`
**Line 139:** RunPod description
**Current:** `'RunPod API key for serverless GPU deployment'`
**Modification:** Update description to clarify it's for both training and inference

**New:**
```typescript
runpod: {
  name: 'RunPod',
  description: 'RunPod API key for training pods and serverless inference endpoints'
},
```

---

#### 5. Create new page: `/app/inference/page.tsx`
**Purpose:** Dedicated page for managing inference deployments
**Estimated Lines:** ~400 lines

**Features:**
- List all user's inference deployments
- Status cards for each deployment
- Create new deployment button
- Filter by provider/status
- Cost summary dashboard

---

## DETAILED IMPLEMENTATION PLAN

### Phase 1: Foundation (Days 1-2)

**Goal:** Database schema and type definitions

1. Create migration for `inference_deployments` table
2. Apply migration to database
3. Create TypeScript types in `/lib/inference/deployment.types.ts`
4. Verify types compile

**Verification:**
- Migration runs successfully
- Table created with correct schema
- Types import correctly in other files

---

### Phase 2: RunPod Serverless Service (Days 3-4)

**Goal:** API client for RunPod Serverless

1. Research RunPod Serverless API endpoints
2. Create `/lib/inference/runpod-serverless-service.ts`
3. Implement `createEndpoint()` method
4. Implement `getEndpointStatus()` method
5. Implement `stopEndpoint()` method
6. Test with $50 RunPod credits

**Verification:**
- Can create endpoint via API
- Can get endpoint status
- Can stop endpoint
- Costs track correctly

---

### Phase 3: Model Upload Integration (Day 5)

**Goal:** Upload trained models to HuggingFace Hub

1. Create `/lib/inference/model-uploader.ts`
2. Implement HuggingFace Hub API integration
3. Test uploading LoRA adapter
4. Verify adapter accessible from RunPod

**Verification:**
- Adapter uploads to HF Hub
- Adapter downloadable from HF Hub
- Adapter can be loaded in RunPod container

---

### Phase 4: API Routes (Days 6-7)

**Goal:** API endpoints for deployment management

1. Create `/app/api/inference/deploy/route.ts`
2. Create status/stop routes
3. Integrate with secrets vault
4. Test end-to-end deployment flow

**Verification:**
- Can deploy via API
- Can check status via API
- Can stop via API
- Database records created correctly

---

### Phase 5: UI Components (Days 8-9)

**Goal:** User interface for deployments

1. Create `InferenceDeployButton` component
2. Create `InferenceDeploymentCard` component
3. Add button to Training Dashboard
4. Create dedicated Inference Deployments page
5. Test UI workflow

**Verification:**
- Button appears on completed training jobs
- Modal opens with configuration options
- Deployment creates successfully
- Status updates in real-time

---

### Phase 6: Budget Controls (Day 10)

**Goal:** Cost monitoring and limits

1. Add cost estimation before deployment
2. Implement budget limit enforcement
3. Add usage alerts (50%, 80%, 100%)
4. Add auto-stop at budget limit
5. Test budget scenarios

**Verification:**
- Cost estimate shown before deploy
- Auto-stop triggers at limit
- Alerts sent at thresholds
- Costs track accurately

---

## CRITICAL QUESTIONS TO RESOLVE

### 1. Model Storage Location
**Question:** Where should we store uploaded models?
**Options:**
- HuggingFace Hub (free, public/private repos)
- S3 bucket (costs money, full control)
- RunPod's storage (check if available)

**Recommendation:** HuggingFace Hub for MVP

---

### 2. Docker Container Strategy
**Question:** How do we package models for RunPod Serverless?
**Options:**
- Pre-built container with model baked in (slower to deploy)
- Generic container that downloads model at startup (faster to deploy)
- Container that loads model from HF Hub (most flexible)

**Recommendation:** Generic container + HF Hub loading

---

### 3. LoRA vs Merged Models
**Question:** Should we merge LoRA adapters before deployment?
**Options:**
- Deploy LoRA adapters only (smaller, faster upload, requires PEFT at inference)
- Merge first (larger, slower upload, faster inference)
- Support both (more complex)

**Recommendation:** LoRA adapters only for MVP

---

### 4. Checkpoint Selection
**Question:** Which checkpoint should be deployed?
**Options:**
- Always use "best" checkpoint (lowest eval_loss)
- Let user choose checkpoint
- Use latest checkpoint

**Recommendation:** Default to "best", allow user to override

---

### 5. Cost Estimation Accuracy
**Question:** How accurate can we make cost estimates?
**Challenge:** RunPod Serverless charges per request, but we don't know request volume

**Approach:**
- Estimate based on budget limit
- Show cost per 1k requests
- Let user set expected request volume
- Update estimates based on actual usage

---

## RISKS & MITIGATION

### Risk 1: RunPod Serverless API Changes
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Abstract provider interface
- Make provider-specific code swappable
- Document API version used

### Risk 2: Model Upload Failures
**Probability:** Medium
**Impact:** High
**Mitigation:**
- Retry logic with exponential backoff
- Progress indicators
- Validate uploads before deployment

### Risk 3: Budget Overruns
**Probability:** High (if no controls)
**Impact:** Critical
**Mitigation:**
- Strict budget limits enforced at API level
- Real-time cost tracking
- Auto-stop at 100% budget
- Alerts at 50%, 80%

### Risk 4: Cold Start Times
**Probability:** Low (RunPod claims <250ms)
**Impact:** Medium
**Mitigation:**
- Set min_workers > 0 for production endpoints
- Warn users about cold starts
- Show cold start metrics in dashboard

---

## COST ANALYSIS

### RunPod Serverless Pricing (Estimated)
- **GPU Type:** NVIDIA A40
- **Cost per hour:** ~$0.50-$1.00 (when active)
- **Cost per request:** ~$0.001-$0.01 (depends on GPU time)
- **Idle cost:** $0 (scales to zero)

### Storage Costs
- **HuggingFace Hub:** Free for public models, $9/mo for private
- **Supabase Storage:** $0.021/GB per month (for artifacts)

### Testing Budget
- **Available:** $50 RunPod credits
- **Estimated consumption:**
  - 10 test deployments × $0.10 startup = $1
  - 100 test requests × $0.01 = $1
  - Total: ~$2-5 for testing

**Safe to proceed with testing**

---

## SUCCESS CRITERIA

### MVP Launch Criteria
1. ✅ User can deploy trained LoRA adapter to RunPod Serverless
2. ✅ Endpoint URL is provided and accessible
3. ✅ Budget limits are enforced
4. ✅ Cost tracking is accurate to within 10%
5. ✅ User can stop deployment manually
6. ✅ Status updates in UI (deploying → active → stopped)

### Future Enhancements
- Support for HuggingFace Endpoints
- Support for merged models
- Auto-scaling based on load
- A/B testing between model versions
- Rollback to previous versions
- Multi-region deployment

---

## NEXT STEPS

### Immediate Actions Required:
1. **User Approval:** Get approval on approach and scope
2. **Docker Container:** Build or find generic vLLM container for RunPod
3. **HuggingFace Setup:** Set up HF Hub account for model storage
4. **RunPod Testing:** Verify $50 credits are available and accessible
5. **Create Migration:** Start with database schema

### Decision Points:
- [ ] Approve overall architecture
- [ ] Confirm RunPod Serverless as first provider
- [ ] Approve LoRA-only deployment for MVP
- [ ] Confirm HuggingFace Hub for model storage
- [ ] Approve manual deployment (no auto-deploy)
- [ ] Set cost limits per deployment (e.g., max $10/month)

---

## CONCLUSION

**Ready to Proceed:** YES, with user approval

**Estimated Implementation Time:** 10-12 days

**Risk Level:** MEDIUM (manageable with proper controls)

**Budget Impact:** LOW (testing within $50 credits)

**User Value:** HIGH (completes training-to-production loop)

---

**Report Date:** 2025-11-12
**Investigator:** Claude Code
**Status:** Investigation Complete - Awaiting User Approval
