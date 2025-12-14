# Training Endpoints API Key Authentication

**Date:** 2025-12-13
**Status:** IN PROGRESS
**Goal:** Add API key authentication to training endpoints so SDK users can GET their training jobs/metrics

---

## Problem Statement

Currently, training endpoints support two authentication methods:
1. **Job token auth** - Used by the Python training server to PUSH metrics
2. **Session auth** - Used by the UI to view jobs (requires browser session)

**Gap:** SDK users cannot programmatically fetch their training jobs/metrics using API keys.

---

## Current State Analysis

### Database Verification (2025-12-13)

**Batch Test Runs:** 5 completed tests found
- Using model `d26dc7cb-a304-4162-a59f-6080113c1bd1`
- Prompts: 25, 10, 10, 5, 10

**Training Jobs:** 5 jobs found
- `f31b34ac...` - Qwen3-1.7B-Base - running (30.62%)
- `a48ce385...` - Qwen3-1.7B-Base - cancelled (11.43%)
- `00460e26...` - Mistral-7B-Instruct - failed (15.58%)
- `66c68427...` - Qwen3-1.7B-Base - completed (100%)
- `7fd36d6d...` - Qwen3-1.7B-Base - failed (0%)

**Test Suites:** 3 suites found
- validation_questions_only (50 prompts)
- validation_set_Atlas_50_Qs (50 prompts)
- validation_set_25_fron_1166_atlas (25 prompts)

### Existing Training Endpoints

| Endpoint | Method | Current Auth | SDK Access |
|----------|--------|--------------|------------|
| `/api/training/local/jobs` | POST | User ID in body | No (PUSH only) |
| `/api/training/local/[jobId]/status` | GET | Session token | No |
| `/api/training/local/metrics` | POST | Job token | No (PUSH only) |
| `/api/training/jobs/[jobId]/metrics` | POST | Job token | No (PUSH only) |
| `/api/training/local/predictions` | POST | Job token | No (PUSH only) |

### API Key Validator (`lib/auth/api-key-validator.ts`)

Already supports `training` scope with these endpoints:
```typescript
training: {
  label: 'Training',
  description: 'Training metrics, predictions, and job management',
  endpoints: [
    '/api/training/local/metrics',
    '/api/training/local/predictions',
    '/api/training/predictions/*',
    '/api/training/jobs/*/metrics',
  ],
},
```

### Reference Pattern: Batch Testing Status

The pattern for dual auth (session + API key) is implemented in:
`app/api/batch-testing/status/[id]/route.ts`

Key function: `authenticateBatchTesting()` which:
1. Checks for API key in headers (`x-api-key`, `x-workspace-api-key`, `Authorization: Bearer wak_...`)
2. If API key found, validates with `validateRequestWithScope(req.headers, 'testing')`
3. Falls back to session auth if no API key

---

## Phased Implementation Plan

### Phase 1: Add GET handler to `/api/training/local/[jobId]/status`

**File:** `app/api/training/local/[jobId]/status/route.ts`

**Changes:**
1. Create `authenticateTraining()` function (similar to batch testing pattern)
2. Modify existing GET handler to use new auth function
3. Support both session auth and API key auth with `training` scope

**Insertion Points:**
- Line 1-10: Add new imports for API key validation
- Line 156-158: Add auth helper function before GET handler
- Line 204-246: Replace current auth logic in GET handler

**Non-Breaking:** Yes - Session auth still works, API key auth is additive

### Phase 2: Add GET handler to list training jobs

**File:** `app/api/training/local/jobs/route.ts` (modify existing)

**Changes:**
1. Add GET handler to list user's training jobs
2. Use same `authenticateTraining()` pattern

**Insertion Points:**
- Add GET export after existing POST handler

**Non-Breaking:** Yes - POST handler unchanged

### Phase 3: Add GET handler for training metrics

**File:** `app/api/training/local/metrics/route.ts` (modify existing)

**Changes:**
1. Add GET handler to fetch metrics for a job
2. Accept `job_id` as query parameter
3. Validate user owns the job

**Insertion Points:**
- Add GET export after existing POST handler

**Non-Breaking:** Yes - POST handler unchanged

### Phase 4: Test and Verify

1. Test with existing API key (scope: training)
2. Verify batch testing still works
3. Verify training server push endpoints still work
4. Test SDK integration

---

## Files to Modify

| File | Change Type | Risk Level |
|------|-------------|------------|
| `app/api/training/local/[jobId]/status/route.ts` | Add dual auth | Low |
| `app/api/training/local/jobs/route.ts` | Add GET handler | Low |
| `app/api/training/local/metrics/route.ts` | Add GET handler | Low |

---

## Implementation Progress

- [x] Phase 1: Add API key auth to job status endpoint (COMPLETED)
- [x] Phase 2: Add GET handler for jobs list (COMPLETED)
- [x] Phase 3: Add GET handler for metrics (COMPLETED)
- [ ] Phase 4: Test and verify (IN PROGRESS)
- [ ] Batch testing verification with real data

---

## Files Created/Modified

### New Files

1. **`lib/auth/training-auth.ts`** - Shared training authentication helper
   - `authenticateTraining()` function supporting both session and API key auth
   - Validates API key with `training` scope

### Modified Files

1. **`app/api/training/local/[jobId]/status/route.ts`**
   - Added import for `authenticateTraining`
   - Replaced session-only auth with dual auth (session + API key)
   - Non-breaking: Session auth still works

2. **`app/api/training/local/jobs/route.ts`**
   - Added import for `authenticateTraining`
   - Added GET handler to list user's training jobs
   - Query params: `status`, `limit`, `offset`
   - Non-breaking: POST handler unchanged

3. **`app/api/training/local/metrics/route.ts`**
   - Added import for `authenticateTraining`
   - Added GET handler to fetch metrics for a job
   - Query params: `job_id` (required), `limit`, `offset`
   - Non-breaking: POST handler unchanged

---

## Testing Commands

After starting the dev server (`npm run dev`), use these commands to verify:

### Test Jobs List (with API key)
```bash
curl -s http://localhost:3000/api/training/local/jobs \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Test Job Status (with API key)
```bash
curl -s http://localhost:3000/api/training/local/JOB_ID/status \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Test Metrics (with API key)
```bash
curl -s "http://localhost:3000/api/training/local/metrics?job_id=JOB_ID&limit=10" \
  -H "X-API-Key: YOUR_API_KEY" | jq
```

### Test with Wrong Scope (should return 403)
Use an API key with `production` scope only - should be rejected.

---

## Testing Checklist

- [ ] Existing session auth still works for status endpoint
- [ ] API key with `training` scope can fetch job status
- [ ] API key with `production` scope is rejected (403)
- [ ] Training server POST endpoints still work with job tokens
- [ ] Batch testing endpoints still work
- [ ] SDK can fetch training jobs/metrics programmatically

---

## Available Test Data

**Training Jobs with user_id:**
- `f31b34ac...` - Qwen3-1.7B-Base - running (34.11%) - 3784 metrics
- `a48ce385...` - Qwen3-1.7B-Base - cancelled (11.43%)
- `00460e26...` - Mistral-7B-Instruct - failed (15.58%)
- `66c68427...` - Qwen3-1.7B-Base - completed (100%)

**Batch Test Runs (for comparison testing):**
- `781f422c...` - 25/25 prompts - completed
- `f4541000...` - 10/10 prompts - completed
- `4bbce0c3...` - 10/10 prompts - completed
