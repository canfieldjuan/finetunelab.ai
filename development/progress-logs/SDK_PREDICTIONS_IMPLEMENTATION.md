# SDK Predictions Implementation Progress Log

**Created:** 2025-12-16
**Status:** Planning
**Goal:** Add training predictions support to Python and Node SDKs

---

## Overview

Add support for training predictions API endpoints to both Python and Node/TypeScript SDKs. This enables users to retrieve model predictions generated during training for quality analysis and visualization (similar to Weights & Biases).

## Context

### Current State
- Training predictions system is fully implemented in backend
- 3 API endpoints exist and are functional:
  - GET `/api/training/predictions/[jobId]` - Retrieve predictions with pagination
  - GET `/api/training/predictions/[jobId]/epochs` - Get epoch summaries
  - GET `/api/training/predictions/[jobId]/trends` - Get quality trends over time
- Python SDK v0.2.0 has inference, batch testing, and analytics support
- Node SDK v0.2.0 has inference, batch testing, and analytics support
- **Predictions endpoints NOT exposed in either SDK**

### Why This Work Is Needed
Users cannot programmatically access training predictions from SDK - must use direct API calls. This limits automation, analysis workflows, and integration with external tools.

---

## API Endpoints Analysis

### 1. GET /api/training/predictions/[jobId]
**Purpose:** Retrieve model predictions with pagination and filtering

**Parameters:**
- Path: `jobId` (string, required) - Training job ID
- Query: `epoch` (integer, optional) - Filter by specific epoch
- Query: `limit` (integer, optional, default: 50) - Max predictions to return
- Query: `offset` (integer, optional, default: 0) - Pagination offset

**Authentication:** Bearer token (Authorization header)

**Response Schema:**
```typescript
{
  job_id: string;
  predictions: TrainingPrediction[];
  total_count: number;
  epoch_count: number;
}
```

**TrainingPrediction Fields:**
- id, job_id, user_id, epoch, step, sample_index
- prompt, ground_truth, prediction, created_at
- Quality metrics: exact_match, char_error_rate, length_ratio, word_overlap
- Validation: validation_pass, validation_kind, validation_errors
- Generation metadata: prompt_tokens, completion_tokens, latency_ms

**Location:** `/home/juan-canfield/Desktop/web-ui/app/api/training/predictions/[jobId]/route.ts`

---

### 2. GET /api/training/predictions/[jobId]/epochs
**Purpose:** Get epoch summaries with prediction counts

**Parameters:**
- Path: `jobId` (string, required) - Training job ID

**Authentication:** Bearer token (Authorization header)

**Response Schema:**
```typescript
{
  job_id: string;
  epochs: Array<{
    epoch: number;
    prediction_count: number;
    latest_step: number;
  }>;
}
```

**Use Cases:**
- Build epoch dropdown selectors in UI
- Show prediction coverage across epochs
- Validate prediction data availability

**Location:** `/home/juan-canfield/Desktop/web-ui/app/api/training/predictions/[jobId]/epochs/route.ts`

---

### 3. GET /api/training/predictions/[jobId]/trends
**Purpose:** Get aggregated quality metrics across epochs

**Parameters:**
- Path: `jobId` (string, required) - Training job ID

**Authentication:** Bearer token (Authorization header)

**Response Schema:**
```typescript
{
  job_id: string;
  trends: Array<{
    epoch: number;
    step: number;
    sample_count: number;
    avg_exact_match: number | null;
    avg_char_error_rate: number | null;
    avg_length_ratio: number | null;
    avg_word_overlap: number | null;
    min_char_error_rate: number | null;
    max_char_error_rate: number | null;
    validation_pass_rate: number | null;
  }>;
  overall_improvement: number | null; // % improvement from first to last epoch
}
```

**Use Cases:**
- Visualize quality improvement over training
- Detect training degradation early
- Compare model quality across checkpoints
- Track learning velocity

**Location:** `/home/juan-canfield/Desktop/web-ui/app/api/training/predictions/[jobId]/trends/route.ts`

---

## Existing SDK Architecture

### Python SDK (`python-package/finetune_lab/client.py`)
**Structure:**
- Main class: `FinetuneLabClient`
- Sub-clients: `BatchTestClient`, `AnalyticsClient`
- HTTP client: `requests` library with Session
- Authentication: `X-API-Key` header
- Error handling: `FinetuneLabError` exception class
- Response patterns: Dataclasses (`@dataclass`)

**Key Methods:**
- `_request(method, endpoint, params=None, json=None)` - Internal request helper
- `predict(model, messages, ...)` - Inference endpoint
- `batch_test.run(...)` - Run batch tests
- `analytics.traces(...)` - Get analytics traces
- `analytics.data(...)` - Get aggregated analytics

**File:** `/home/juan-canfield/Desktop/web-ui/python-package/finetune_lab/client.py` (409 lines)

---

### Node SDK (`packages/finetune-lab-sdk/src/client.ts`)
**Structure:**
- Main class: `FinetuneLabClient`
- Sub-clients: `BatchTestClient`, `AnalyticsClient`
- HTTP client: `fetch` API with AbortController for timeout
- Authentication: `X-API-Key` header
- Error handling: `FinetuneLabError` class
- Response patterns: TypeScript interfaces

**Key Methods:**
- `request<T>(method, endpoint, body?)` - Internal request helper
- `predict(request)` - Inference endpoint
- `batchTest.run(config)` - Run batch tests
- `analytics.traces(filters)` - Get analytics traces
- `analytics.data(filters)` - Get aggregated analytics

**File:** `/home/juan-canfield/Desktop/web-ui/packages/finetune-lab-sdk/src/client.ts` (306 lines)

---

## Type Definitions

**Location:** `/home/juan-canfield/Desktop/web-ui/lib/training/types/predictions-types.ts`

**Key Exports:**
- `PredictionsConfig` - Training predictions configuration
- `TrainingPrediction` - Single prediction record
- `PredictionsResponse` - Main endpoint response
- `PredictionsEpochSummary` - Epoch summary record
- `PredictionsEpochsResponse` - Epochs endpoint response
- `PredictionEpochMetrics` - Aggregated metrics for one epoch
- `PredictionsTrendsResponse` - Trends endpoint response

**Note:** These types are already defined and used by the API endpoints. Can be reused/adapted for SDK type definitions.

---

## Authentication Consideration

**CRITICAL ISSUE IDENTIFIED:**

The existing predictions API endpoints use **Bearer token authentication** (Authorization header):
```typescript
const authHeader = request.headers.get('authorization');
// ...
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
```

However, both SDKs use **API Key authentication** (X-API-Key header):
```python
self._session.headers.update({
    "X-API-Key": self.api_key,
    ...
})
```

**Questions for User:**
1. Do the predictions endpoints support API key authentication, or only bearer tokens?
2. Is there middleware that converts API keys to bearer tokens?
3. Should we modify the endpoints to support both auth methods?
4. Or should the SDK training client use bearer tokens instead of API keys?

**Impact:** This affects authentication strategy for the new TrainingPredictionsClient in both SDKs.

---

## Implementation Plan

### Phase 1: Investigation ✓
**Status:** COMPLETE
**Completion:** 2025-12-16

Tasks completed:
- [x] Read all 3 predictions API endpoint files
- [x] Analyze Python SDK architecture and patterns
- [x] Analyze Node SDK architecture and patterns
- [x] Review type definitions in predictions-types.ts
- [x] Identify authentication pattern mismatch
- [x] Document all findings in this progress log

---

### Phase 2: Design
**Status:** PENDING - WAITING FOR USER APPROVAL

**Proposed Design:**

#### Python SDK Changes
**New File:** `python-package/finetune_lab/training_predictions.py`
- TrainingPredictionsClient class
- Methods: `get(job_id, ...)`, `epochs(job_id)`, `trends(job_id)`
- Dataclasses: PredictionResponse, EpochSummary, TrendsResponse

**Modified File:** `python-package/finetune_lab/client.py`
- Import TrainingPredictionsClient
- Add `self.training_predictions = TrainingPredictionsClient(self)` in `__init__`
- No breaking changes to existing methods

#### Node SDK Changes
**New File:** `packages/finetune-lab-sdk/src/training-predictions.ts`
- TrainingPredictionsClient class
- Methods: `get(jobId, ...)`, `epochs(jobId)`, `trends(jobId)`
- TypeScript interfaces for responses

**Modified File:** `packages/finetune-lab-sdk/src/client.ts`
- Import TrainingPredictionsClient
- Add `public readonly trainingPredictions: TrainingPredictionsClient` property
- Initialize in constructor
- No breaking changes to existing methods

**Modified File:** `packages/finetune-lab-sdk/src/types.ts`
- Add prediction response type definitions
- Export new types

---

### Phase 3: Implementation
**Status:** NOT STARTED

Will be broken into 30-line blocks with exact insertion points for each file.

---

### Phase 4: Validation
**Status:** NOT STARTED

**Planned Tests:**
- Test each endpoint with real training job
- Verify pagination works correctly
- Test epoch filtering
- Confirm no breaking changes to existing SDK functionality
- Test error handling (404, 401, etc.)

---

### Phase 5: Documentation
**Status:** NOT STARTED

**Planned Updates:**
- Update SDK README with predictions examples
- Add code examples for each method
- Document authentication requirements
- Update API documentation

---

## Files to Modify

### Python SDK
1. **NEW:** `python-package/finetune_lab/training_predictions.py` - New TrainingPredictionsClient class
2. **MODIFY:** `python-package/finetune_lab/client.py` - Add training_predictions sub-client

### Node SDK
1. **NEW:** `packages/finetune-lab-sdk/src/training-predictions.ts` - New TrainingPredictionsClient class
2. **MODIFY:** `packages/finetune-lab-sdk/src/client.ts` - Add trainingPredictions sub-client
3. **MODIFY:** `packages/finetune-lab-sdk/src/types.ts` - Add prediction type definitions
4. **MODIFY:** `packages/finetune-lab-sdk/src/index.ts` - Export new types and client

---

## Potential Breaking Changes Analysis

**Python SDK:**
- ✓ No breaking changes - Only adding new sub-client
- ✓ Existing methods unchanged
- ✓ Constructor signature unchanged
- ✓ Backward compatible

**Node SDK:**
- ✓ No breaking changes - Only adding new sub-client
- ✓ Existing methods unchanged
- ✓ Constructor signature unchanged
- ✓ Backward compatible

---

## Next Steps

**WAITING FOR USER APPROVAL ON:**
1. Authentication strategy clarification (API key vs bearer token)
2. Design approval (sub-client pattern, method names, response types)
3. Confirmation to proceed with implementation

**Once Approved:**
1. Implement Python SDK changes (30-line blocks)
2. Implement Node SDK changes (30-line blocks)
3. Test all endpoints
4. Update documentation
5. Verify no breaking changes
