# SDK Predictions Implementation Plan
**Date:** 2025-12-16
**Status:** AWAITING USER APPROVAL

---

## Executive Summary

Add training predictions support to both Python and Node SDKs by:
1. **Enhancing existing API endpoints** to support API key authentication (in addition to bearer tokens)
2. **Creating new SDK client classes** following existing patterns
3. **Zero breaking changes** - purely additive implementation

**Estimated Changes:**
- 3 API endpoint files (add API key auth support)
- 2 new SDK client files (Python + Node)
- 3 SDK integration files (client.py, client.ts, types.ts)
- 1 new Python types file (optional, for better type hints)

---

## Investigation Summary ✓

### Completed Verification
- [x] Read all 3 predictions API endpoints
- [x] Analyzed Python SDK architecture (client.py, 409 lines)
- [x] Analyzed Node SDK architecture (client.ts, 306 lines)
- [x] Reviewed type definitions (predictions-types.ts)
- [x] **CRITICAL FINDING:** Identified auth pattern
  - Existing endpoints: Bearer token only
  - SDK pattern: X-API-Key header
  - **Solution:** Predictions endpoints already in 'training' scope (line 28 of api-key-validator.ts)
  - Need to add API key support to existing endpoints

### Authentication Solution
The predictions endpoints are **already configured** in the API key scopes:

```typescript
// lib/auth/api-key-validator.ts:22-30
training: {
  label: 'Training',
  description: 'Training metrics, predictions, and job management',
  endpoints: [
    '/api/training/local/metrics',
    '/api/training/local/predictions',
    '/api/training/predictions/*',  // ← Our endpoints!
    '/api/training/jobs/*/metrics',
  ],
},
```

**Implementation:** Add dual authentication support to existing endpoints:
- **Option 1:** Bearer token (Authorization header) - for web UI - EXISTING
- **Option 2:** API key (X-API-Key header) with 'training' scope - for SDK - NEW

---

## Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   SDK Layer                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  Python SDK              Node SDK             │  │
│  │  ─────────────           ─────────────         │  │
│  │  TrainingPredictionsClient                     │  │
│  │  - get()                 - get()               │  │
│  │  - epochs()              - epochs()            │  │
│  │  - trends()              - trends()            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↓
            X-API-Key: wak_xxx (training scope)
                        ↓
┌─────────────────────────────────────────────────────┐
│                  API Layer                          │
│  ┌───────────────────────────────────────────────┐  │
│  │  Enhanced Auth Middleware                     │  │
│  │  ✓ Bearer token (existing)                    │  │
│  │  ✓ API key validation (NEW)                   │  │
│  └───────────────────────────────────────────────┘  │
│                        ↓                            │
│  ┌───────────────────────────────────────────────┐  │
│  │  Predictions Endpoints (Enhanced)             │  │
│  │  GET /api/training/predictions/[jobId]        │  │
│  │  GET /api/training/predictions/[jobId]/epochs │  │
│  │  GET /api/training/predictions/[jobId]/trends │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        ↓
            Supabase (training_predictions table)
```

---

## Phase 1: API Endpoints - Add API Key Auth Support

### File 1: /app/api/training/predictions/[jobId]/route.ts

**Current Auth (line 160-179):**
```typescript
const authHeader = request.headers.get('authorization');
if (!authHeader) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const supabaseAuth = createClient(
  supabaseUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { headers: { Authorization: authHeader } } }
);

const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

if (authError || !user) {
  console.log('[Predictions API] Auth failed:', authError?.message);
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**New Auth (Dual Support):**
```typescript
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

// Try API key first
const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');
let userId: string | null = null;

if (apiKeyValidation.isValid) {
  // API key authentication successful
  userId = apiKeyValidation.userId!;
  console.log('[Predictions API] Authenticated via API key:', userId);
} else {
  // Fall back to bearer token
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAuth = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    console.log('[Predictions API] Auth failed:', authError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  userId = user.id;
  console.log('[Predictions API] Authenticated via bearer token:', userId);
}

// Continue with userId...
const jobQuery = await supabase
  .from('local_training_jobs')
  .select('id')
  .eq('id', jobId)
  .eq('user_id', userId)  // ← Use unified userId
  .single();
```

**Changes Required:**
- **Line 1:** Add import for `validateRequestWithScope`
- **Lines 160-179:** Replace bearer-only auth with dual auth logic (shown above)
- **Line 186:** Change `user.id` to `userId`

**Insertion Points:**
1. After line 119 (import section): Add `import { validateRequestWithScope } from '@/lib/auth/api-key-validator';`
2. Replace lines 160-179 with dual auth block
3. Line 186: Change `.eq('user_id', user.id)` to `.eq('user_id', userId)`

**Breaking Changes:** None - purely additive, maintains backward compatibility

---

### File 2: /app/api/training/predictions/[jobId]/epochs/route.ts

**Same pattern as File 1:**
- Add `validateRequestWithScope` import
- Replace bearer-only auth (lines 93-112) with dual auth
- Use unified `userId` variable (line 120)

**Insertion Points:**
1. After line 68 (import section): Add import
2. Replace lines 93-112 with dual auth
3. Line 120: Change `user.id` to `userId`

**Breaking Changes:** None

---

### File 3: /app/api/training/predictions/[jobId]/trends/route.ts

**Same pattern as File 1:**
- Add `validateRequestWithScope` import
- Replace bearer-only auth (lines 126-146) with dual auth
- Use unified `userId` variable (line 155)

**Insertion Points:**
1. After line 100 (import section): Add import
2. Replace lines 126-146 with dual auth
3. Line 155: Change `user.id` to `userId`

**Breaking Changes:** None

---

## Phase 2: Python SDK - Add TrainingPredictionsClient

### File 4: NEW - python-package/finetune_lab/training_predictions.py

**New file, full content:**

```python
"""
Training Predictions Client
Retrieve model predictions generated during training.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class TrainingPrediction:
    """Single prediction record."""
    id: str
    job_id: str
    epoch: int
    step: int
    sample_index: int
    prompt: str
    prediction: str
    created_at: str
    ground_truth: Optional[str] = None
    exact_match: Optional[float] = None
    char_error_rate: Optional[float] = None
    length_ratio: Optional[float] = None
    word_overlap: Optional[float] = None
    validation_pass: Optional[bool] = None
    raw: Optional[Dict[str, Any]] = None


@dataclass
class PredictionsResponse:
    """Response from predictions endpoint."""
    job_id: str
    predictions: List[TrainingPrediction]
    total_count: int
    epoch_count: int


@dataclass
class EpochSummary:
    """Summary for a single epoch."""
    epoch: int
    prediction_count: int
    latest_step: int


@dataclass
class EpochsResponse:
    """Response from epochs endpoint."""
    job_id: str
    epochs: List[EpochSummary]


@dataclass
class EpochMetrics:
    """Aggregated metrics for a single epoch."""
    epoch: int
    step: int
    sample_count: int
    avg_exact_match: Optional[float]
    avg_char_error_rate: Optional[float]
    avg_length_ratio: Optional[float]
    avg_word_overlap: Optional[float]
    min_char_error_rate: Optional[float]
    max_char_error_rate: Optional[float]
    validation_pass_rate: Optional[float]


@dataclass
class TrendsResponse:
    """Response from trends endpoint."""
    job_id: str
    trends: List[EpochMetrics]
    overall_improvement: Optional[float]


class TrainingPredictionsClient:
    """Client for training predictions endpoints (training scope)."""

    def __init__(self, parent: "FinetuneLabClient"):
        self._parent = parent

    def get(
        self,
        job_id: str,
        epoch: Optional[int] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> PredictionsResponse:
        """
        Get training predictions for a job.

        Args:
            job_id: Training job ID
            epoch: Filter by specific epoch (optional)
            limit: Max predictions to return (default 50)
            offset: Pagination offset (default 0)

        Returns:
            PredictionsResponse with predictions and metadata

        Example:
            >>> predictions = client.training_predictions.get(
            ...     job_id="job_abc123",
            ...     epoch=2,
            ...     limit=10
            ... )
            >>> for pred in predictions.predictions:
            ...     print(f"Epoch {pred.epoch}: {pred.prediction}")
        """
        params = {"limit": limit, "offset": offset}
        if epoch is not None:
            params["epoch"] = epoch

        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}",
            params=params,
        )

        predictions = [
            TrainingPrediction(
                id=p.get("id", ""),
                job_id=p.get("job_id", job_id),
                epoch=p.get("epoch", 0),
                step=p.get("step", 0),
                sample_index=p.get("sample_index", 0),
                prompt=p.get("prompt", ""),
                prediction=p.get("prediction", ""),
                created_at=p.get("created_at", ""),
                ground_truth=p.get("ground_truth"),
                exact_match=p.get("exact_match"),
                char_error_rate=p.get("char_error_rate"),
                length_ratio=p.get("length_ratio"),
                word_overlap=p.get("word_overlap"),
                validation_pass=p.get("validation_pass"),
                raw=p,
            )
            for p in response.get("predictions", [])
        ]

        return PredictionsResponse(
            job_id=response.get("job_id", job_id),
            predictions=predictions,
            total_count=response.get("total_count", 0),
            epoch_count=response.get("epoch_count", 0),
        )

    def epochs(self, job_id: str) -> EpochsResponse:
        """
        Get epoch summaries for a job.

        Args:
            job_id: Training job ID

        Returns:
            EpochsResponse with epoch summaries

        Example:
            >>> epochs = client.training_predictions.epochs("job_abc123")
            >>> for ep in epochs.epochs:
            ...     print(f"Epoch {ep.epoch}: {ep.prediction_count} predictions")
        """
        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}/epochs",
        )

        epoch_summaries = [
            EpochSummary(
                epoch=e.get("epoch", 0),
                prediction_count=e.get("prediction_count", 0),
                latest_step=e.get("latest_step", 0),
            )
            for e in response.get("epochs", [])
        ]

        return EpochsResponse(
            job_id=response.get("job_id", job_id),
            epochs=epoch_summaries,
        )

    def trends(self, job_id: str) -> TrendsResponse:
        """
        Get quality trends across epochs.

        Args:
            job_id: Training job ID

        Returns:
            TrendsResponse with aggregated metrics per epoch

        Example:
            >>> trends = client.training_predictions.trends("job_abc123")
            >>> for trend in trends.trends:
            ...     print(f"Epoch {trend.epoch}: CER={trend.avg_char_error_rate:.2f}")
            >>> print(f"Overall improvement: {trends.overall_improvement:.1f}%")
        """
        response = self._parent._request(
            "GET",
            f"/api/training/predictions/{job_id}/trends",
        )

        metrics = [
            EpochMetrics(
                epoch=t.get("epoch", 0),
                step=t.get("step", 0),
                sample_count=t.get("sample_count", 0),
                avg_exact_match=t.get("avg_exact_match"),
                avg_char_error_rate=t.get("avg_char_error_rate"),
                avg_length_ratio=t.get("avg_length_ratio"),
                avg_word_overlap=t.get("avg_word_overlap"),
                min_char_error_rate=t.get("min_char_error_rate"),
                max_char_error_rate=t.get("max_char_error_rate"),
                validation_pass_rate=t.get("validation_pass_rate"),
            )
            for t in response.get("trends", [])
        ]

        return TrendsResponse(
            job_id=response.get("job_id", job_id),
            trends=metrics,
            overall_improvement=response.get("overall_improvement"),
        )
```

**Insertion Point:** New file, no conflicts

**Breaking Changes:** None

---

### File 5: MODIFY - python-package/finetune_lab/client.py

**Line 4 (after existing imports):**
```python
from .training_predictions import TrainingPredictionsClient
```

**Line 269 (in __init__, after self.analytics = ...):**
```python
        # Sub-clients
        self.batch_test = BatchTestClient(self)
        self.analytics = AnalyticsClient(self)
        self.training_predictions = TrainingPredictionsClient(self)  # ← NEW
```

**Insertion Points:**
1. Line 4: Add import
2. Line 271: Add training_predictions client initialization

**Breaking Changes:** None - purely additive

---

## Phase 3: Node SDK - Add TrainingPredictionsClient

### File 6: NEW - packages/finetune-lab-sdk/src/training-predictions.ts

**New file, full content:**

```typescript
/**
 * Training Predictions Client
 * Retrieve model predictions generated during training.
 */

import type { FinetuneLabClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface TrainingPrediction {
  id: string;
  job_id: string;
  epoch: number;
  step: number;
  sample_index: number;
  prompt: string;
  prediction: string;
  created_at: string;
  ground_truth?: string;
  exact_match?: number;
  char_error_rate?: number;
  length_ratio?: number;
  word_overlap?: number;
  validation_pass?: boolean;
}

export interface PredictionsResponse {
  job_id: string;
  predictions: TrainingPrediction[];
  total_count: number;
  epoch_count: number;
}

export interface EpochSummary {
  epoch: number;
  prediction_count: number;
  latest_step: number;
}

export interface EpochsResponse {
  job_id: string;
  epochs: EpochSummary[];
}

export interface EpochMetrics {
  epoch: number;
  step: number;
  sample_count: number;
  avg_exact_match: number | null;
  avg_char_error_rate: number | null;
  avg_length_ratio: number | null;
  avg_word_overlap: number | null;
  min_char_error_rate: number | null;
  max_char_error_rate: number | null;
  validation_pass_rate?: number | null;
}

export interface TrendsResponse {
  job_id: string;
  trends: EpochMetrics[];
  overall_improvement: number | null;
}

export interface GetPredictionsFilters {
  epoch?: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Client
// ============================================================================

export class TrainingPredictionsClient {
  constructor(private client: FinetuneLabClient) {}

  /**
   * Get training predictions for a job
   */
  async get(
    jobId: string,
    filters?: GetPredictionsFilters
  ): Promise<PredictionsResponse> {
    const params = new URLSearchParams();

    if (filters?.epoch !== undefined) {
      params.set('epoch', String(filters.epoch));
    }
    if (filters?.limit !== undefined) {
      params.set('limit', String(filters.limit));
    }
    if (filters?.offset !== undefined) {
      params.set('offset', String(filters.offset));
    }

    const query = params.toString();
    const endpoint = query
      ? `/api/training/predictions/${jobId}?${query}`
      : `/api/training/predictions/${jobId}`;

    return this.client.request<PredictionsResponse>('GET', endpoint);
  }

  /**
   * Get epoch summaries for a job
   */
  async epochs(jobId: string): Promise<EpochsResponse> {
    return this.client.request<EpochsResponse>(
      'GET',
      `/api/training/predictions/${jobId}/epochs`
    );
  }

  /**
   * Get quality trends across epochs
   */
  async trends(jobId: string): Promise<TrendsResponse> {
    return this.client.request<TrendsResponse>(
      'GET',
      `/api/training/predictions/${jobId}/trends`
    );
  }
}
```

**Insertion Point:** New file, no conflicts

**Breaking Changes:** None

---

### File 7: MODIFY - packages/finetune-lab-sdk/src/client.ts

**Line 7 (after type imports):**
```typescript
import { TrainingPredictionsClient } from './training-predictions';
```

**Line 205 (after analytics property):**
```typescript
  /** Analytics operations (production scope) */
  public readonly analytics: AnalyticsClient;

  /** Training predictions operations (training scope) */
  public readonly trainingPredictions: TrainingPredictionsClient;  // ← NEW
```

**Line 220 (in constructor, after this.analytics = ...):**
```typescript
    this.batchTest = new BatchTestClient(this);
    this.analytics = new AnalyticsClient(this);
    this.trainingPredictions = new TrainingPredictionsClient(this);  // ← NEW
```

**Insertion Points:**
1. Line 7: Add import
2. Line 208: Add public property declaration
3. Line 222: Add client initialization

**Breaking Changes:** None - purely additive

---

### File 8: MODIFY - packages/finetune-lab-sdk/src/types.ts

**At end of file (after existing exports):**
```typescript
// Training Predictions Types (re-exported from training-predictions.ts)
export type {
  TrainingPrediction,
  PredictionsResponse,
  EpochSummary,
  EpochsResponse,
  EpochMetrics,
  TrendsResponse,
  GetPredictionsFilters,
} from './training-predictions';
```

**Insertion Point:** End of file

**Breaking Changes:** None

---

### File 9: MODIFY - packages/finetune-lab-sdk/src/index.ts

**Current exports (verify pattern, then add):**
```typescript
export { FinetuneLabClient, FinetuneLabError } from './client';
export { TrainingPredictionsClient } from './training-predictions';  // ← NEW
export * from './types';
```

**Insertion Point:** After line 1, before export * from './types'

**Breaking Changes:** None

---

## Phase 4: Validation Plan

### Test Cases

**1. API Endpoint Tests - API Key Authentication**
```bash
# Test 1: Get predictions with API key
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123?limit=5' \
  -H "X-API-Key: wak_xxx"

# Expected: 200 OK with predictions array

# Test 2: Get epochs with API key
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123/epochs' \
  -H "X-API-Key: wak_xxx"

# Expected: 200 OK with epochs array

# Test 3: Get trends with API key
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123/trends' \
  -H "X-API-Key: wak_xxx"

# Expected: 200 OK with trends array

# Test 4: Wrong scope (production key on training endpoint)
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123' \
  -H "X-API-Key: wak_production_only"

# Expected: 403 Forbidden (insufficient_scope)

# Test 5: Invalid API key
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123' \
  -H "X-API-Key: wak_invalid"

# Expected: 401 Unauthorized
```

**2. API Endpoint Tests - Bearer Token (Backward Compatibility)**
```bash
# Test 6: Get predictions with bearer token (existing auth)
curl -X GET 'https://app.finetunelab.com/api/training/predictions/job_123' \
  -H "Authorization: Bearer eyJhbGc..."

# Expected: 200 OK (should still work)
```

**3. Python SDK Tests**
```python
from finetune_lab import FinetuneLabClient

client = FinetuneLabClient(api_key="wak_xxx")

# Test 1: Get predictions
predictions = client.training_predictions.get(
    job_id="job_123",
    epoch=2,
    limit=10
)
assert len(predictions.predictions) > 0
assert predictions.job_id == "job_123"

# Test 2: Get epochs
epochs = client.training_predictions.epochs("job_123")
assert len(epochs.epochs) > 0

# Test 3: Get trends
trends = client.training_predictions.trends("job_123")
assert len(trends.trends) > 0
assert trends.overall_improvement is not None

# Test 4: Pagination
page1 = client.training_predictions.get("job_123", limit=5, offset=0)
page2 = client.training_predictions.get("job_123", limit=5, offset=5)
assert page1.predictions[0].id != page2.predictions[0].id
```

**4. Node SDK Tests**
```typescript
import { FinetuneLabClient } from 'finetune-lab-sdk';

const client = new FinetuneLabClient({ apiKey: 'wak_xxx' });

// Test 1: Get predictions
const predictions = await client.trainingPredictions.get('job_123', {
  epoch: 2,
  limit: 10,
});
expect(predictions.predictions.length).toBeGreaterThan(0);

// Test 2: Get epochs
const epochs = await client.trainingPredictions.epochs('job_123');
expect(epochs.epochs.length).toBeGreaterThan(0);

// Test 3: Get trends
const trends = await client.trainingPredictions.trends('job_123');
expect(trends.trends.length).toBeGreaterThan(0);
```

**5. Breaking Changes Verification**
```python
# Verify existing methods still work
from finetune_lab import FinetuneLabClient

client = FinetuneLabClient(api_key="wak_xxx")

# These should all still work unchanged
response = client.predict("gpt-4", [{"role": "user", "content": "Hi"}])
batch = client.batch_test.run(model_id="gpt-4", test_suite_id="suite_123")
traces = client.analytics.traces(limit=10)

# New feature is additive
predictions = client.training_predictions.get("job_123")  # NEW
```

---

## Phase 5: Documentation Updates

### README Updates

**Python SDK README (python-package/README.md):**
```markdown
## Training Predictions

Retrieve model predictions generated during training:

```python
from finetune_lab import FinetuneLabClient

client = FinetuneLabClient(api_key="wak_xxx")

# Get predictions for a training job
predictions = client.training_predictions.get(
    job_id="job_abc123",
    epoch=2,  # Optional: filter by epoch
    limit=50,  # Optional: pagination limit
    offset=0   # Optional: pagination offset
)

for pred in predictions.predictions:
    print(f"Epoch {pred.epoch}, Step {pred.step}: {pred.prediction}")
    if pred.ground_truth:
        print(f"  Ground truth: {pred.ground_truth}")
        print(f"  Exact match: {pred.exact_match}")

# Get epoch summaries
epochs = client.training_predictions.epochs("job_abc123")
for epoch in epochs.epochs:
    print(f"Epoch {epoch.epoch}: {epoch.prediction_count} predictions")

# Get quality trends
trends = client.training_predictions.trends("job_abc123")
for trend in trends.trends:
    print(f"Epoch {trend.epoch}: CER={trend.avg_char_error_rate:.3f}")
print(f"Overall improvement: {trends.overall_improvement:.1f}%")
```

**Required API key scope:** `training`
```
```

**Node SDK README (packages/finetune-lab-sdk/README.md):**
```markdown
## Training Predictions

Retrieve model predictions generated during training:

```typescript
import { FinetuneLabClient } from 'finetune-lab-sdk';

const client = new FinetuneLabClient({ apiKey: 'wak_xxx' });

// Get predictions for a training job
const predictions = await client.trainingPredictions.get('job_abc123', {
  epoch: 2,     // Optional: filter by epoch
  limit: 50,    // Optional: pagination limit
  offset: 0     // Optional: pagination offset
});

predictions.predictions.forEach(pred => {
  console.log(`Epoch ${pred.epoch}, Step ${pred.step}: ${pred.prediction}`);
  if (pred.ground_truth) {
    console.log(`  Exact match: ${pred.exact_match}`);
  }
});

// Get epoch summaries
const epochs = await client.trainingPredictions.epochs('job_abc123');
epochs.epochs.forEach(epoch => {
  console.log(`Epoch ${epoch.epoch}: ${epoch.prediction_count} predictions`);
});

// Get quality trends
const trends = await client.trainingPredictions.trends('job_abc123');
trends.trends.forEach(trend => {
  console.log(`Epoch ${trend.epoch}: CER=${trend.avg_char_error_rate}`);
});
console.log(`Overall improvement: ${trends.overall_improvement}%`);
```

**Required API key scope:** `training`
```
```

---

## Summary of Changes

### Files Modified (3 API endpoints)
1. `app/api/training/predictions/[jobId]/route.ts` - Add API key auth
2. `app/api/training/predictions/[jobId]/epochs/route.ts` - Add API key auth
3. `app/api/training/predictions/[jobId]/trends/route.ts` - Add API key auth

### Files Created (2 SDK clients)
4. `python-package/finetune_lab/training_predictions.py` - NEW
5. `packages/finetune-lab-sdk/src/training-predictions.ts` - NEW

### Files Modified (4 SDK integrations)
6. `python-package/finetune_lab/client.py` - Add sub-client
7. `packages/finetune-lab-sdk/src/client.ts` - Add sub-client
8. `packages/finetune-lab-sdk/src/types.ts` - Export types
9. `packages/finetune-lab-sdk/src/index.ts` - Export client

### Breaking Changes
**NONE** - All changes are purely additive and maintain full backward compatibility.

---

## Implementation Approach

**30-Line Block Strategy:**
Each file will be modified in small, verifiable blocks:
1. Present 30-line code block
2. Show exact insertion point (line numbers)
3. Wait for verification
4. Proceed to next block

**Order of Implementation:**
1. API endpoints first (enables testing)
2. Python SDK (simpler, good for validating API changes)
3. Node SDK (parallel to Python, same patterns)
4. Documentation updates

---

## Questions for User Approval

1. **Authentication approach:** Approve dual auth (API key + bearer token)?
2. **SDK design:** Approve sub-client pattern (`client.training_predictions.*`)?
3. **Method names:** Approve `get()`, `epochs()`, `trends()` naming?
4. **Implementation order:** Approve API → Python → Node → Docs?
5. **Ready to proceed?** Approve starting with Phase 1 (API endpoints)?

---

**AWAITING USER APPROVAL TO PROCEED**
