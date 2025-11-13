# Bug Fix: 422 Error - Missing user_id Field

**Date:** 2025-11-10
**Issue:** Resume training fails with 422 Unprocessable Entity error
**Root Cause:** Missing `user_id` field in training request payload
**Status:** ✅ FIXED

---

## Problem

Resume training failed with backend validation error:

```
[LocalProvider] Training execution failed: Training failed with status 422
[ResumeTraining] Job submission failed: Training failed with status 422
POST /api/training/local/74801829.../resume 500 in 1121ms
```

HTTP 422 indicates the backend rejected the request due to validation failure.

---

## Root Cause

**Backend Expectation** (`lib/training/training_server.py:598`):
```python
class TrainingRequest(BaseModel):
    """Request model for training execution"""
    config: dict
    dataset_path: str = ""
    execution_id: str
    name: Optional[str] = None
    dataset_content: Optional[str] = None
    user_id: str  # ❌ REQUIRED field!
```

**What We Were Sending** (`app/api/training/local/[jobId]/resume/route.ts:226-231`):
```typescript
const trainingRequest = {
  config: resumeConfig,
  dataset_path: job.dataset_path,
  execution_id: newJobId,
  name: `${job.model_name || 'model'} (Resumed from ${jobId})`,
  // ❌ Missing user_id!
};
```

**Result:** Backend Pydantic validation rejected request with 422 error.

---

## Solution

### Fix 1: Add user_id to Resume Request

**File:** `app/api/training/local/[jobId]/resume/route.ts:231`

**Added:**
```typescript
const trainingRequest = {
  config: resumeConfig,
  dataset_path: job.dataset_path,
  execution_id: newJobId,
  name: `${job.model_name || 'model'} (Resumed from ${jobId})`,
  user_id: user.id,  // ✅ Now included
};
```

### Fix 2: Update TypeScript Interface

**File:** `lib/services/training-providers/local.provider.ts:19`

**Added:**
```typescript
export interface TrainingJobRequest {
  config: Record<string, unknown>;
  dataset_path: string;
  execution_id: string;
  name?: string;
  user_id?: string;  // ✅ Added to interface
  access_token?: string;
}
```

---

## Data Flow (Fixed)

```
Resume API
  ↓
Authenticates user → user.id available
  ↓
Creates training request with user_id: user.id
  ↓
LocalTrainingProvider.executeTraining(request)
  ↓
POST to backend: /api/training/execute
  ↓
Backend validates: user_id present ✓
  ↓
Training job accepted (200 OK)
  ↓
Job starts successfully
```

---

## Testing

✅ TypeScript compilation passed (framework warnings only)
✅ user_id field added to request payload
✅ Interface updated to include user_id

---

## Files Modified

1. **`app/api/training/local/[jobId]/resume/route.ts`** - Line 231
   - Added `user_id: user.id` to training request

2. **`lib/services/training-providers/local.provider.ts`** - Line 19
   - Added `user_id?: string` to TrainingJobRequest interface

**Lines Changed:** 2
**Breaking Changes:** ZERO (optional field in TypeScript, required in payload)

---

## Expected Behavior

**Before (422 Error):**
```
Resume → Missing user_id → Backend rejects → 422 Error → Resume fails
```

**After (Success):**
```
Resume → user_id included → Backend validates → Job created → Training starts
```

---

## Status: ✅ READY FOR TESTING

Resume should now succeed without 422 validation errors.

**Test Steps:**
1. Navigate to job 74801829
2. Select "Adjust Config"
3. Modify any training field
4. Click "Resume Training"
5. Verify success (no 422 error)
6. Check new job appears in training monitor
