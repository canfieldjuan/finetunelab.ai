# vLLM Model ID Fix - Implementation Plan
**Date**: November 29, 2025
**Status**: AWAITING USER APPROVAL
**Risk Level**: LOW (metadata.model_path already in use)

---

## Verification Complete ✅

### What I Verified

1. **How model_id is used in inference** (lib/llm/adapters/openai-adapter.ts:68-70):
   ```typescript
   const modelName = (config.provider === 'vllm' || ...)
     ? (config.served_model_name || config.model_id)
     : config.model_id;
   ```
   - vLLM uses `served_model_name` FIRST, then falls back to `model_id`
   - ✅ Safe to change `model_id` as long as `served_model_name` is set

2. **How vLLM servers are started** (lib/services/inference-server-manager.ts:182):
   ```typescript
   '--model', actualModelPath,  // Uses config.modelPath from deployment
   '--served-model-name', config.modelName,
   ```
   - vLLM receives `modelPath` directly from deployment config
   - NOT from `model_id` field in database
   - ✅ Safe to change `model_id` field

3. **How servers are redeployed** (components/models/ModelCard.tsx:139, 153):
   ```typescript
   if (!metadata?.model_path) {
     toast.error('No model path found...');
   }
   config: {
     model_path: metadata.model_path,  // Already using metadata!
   }
   ```
   - **Already using `metadata.model_path` for redeployment**
   - ✅ Our plan is already compatible with existing code!

---

## Changes Required

### File: `/app/api/training/deploy/route.ts`

#### Change 1: Add Helper Function (Insert BEFORE line 771)

**Location**: After line 770 (right before the INSERT block)

**Code to INSERT**:
```typescript
    // ========================================================================
    // Helper: Determine readable model_id for analytics display
    // ========================================================================
    function getDisplayModelId(
      modelPath: string,
      job: any,
      config: any
    ): string {
      // Priority 1: Training job's base model (best for analytics)
      if (job?.model_name) {
        return job.model_name;  // e.g., "meta-llama/Llama-3.2-3B-Instruct"
      }

      // Priority 2: HuggingFace model ID from config (non-file-path)
      if (config?.model_path && !config.model_path.startsWith('/')) {
        return config.model_path;  // e.g., "Qwen/Qwen2.5-0.5B"
      }

      // Priority 3: Extract name from path (for local models)
      const pathParts = modelPath.split('/');
      const lastPart = pathParts[pathParts.length - 1];

      // Skip checkpoint folders, use parent instead
      if (lastPart && !lastPart.startsWith('checkpoint-') && !lastPart.startsWith('merged')) {
        return lastPart;
      }

      // If checkpoint or merged, try parent folder
      if (pathParts.length >= 2) {
        const parentPart = pathParts[pathParts.length - 2];
        if (parentPart && parentPart.startsWith('job_')) {
          // Job folder - extract base model from job or use folder name
          return job?.model_name || parentPart;
        }
        return parentPart;
      }

      // Last resort
      return 'local-model';
    }
```

**Why BEFORE line 771**: We need this function defined before both INSERT and UPDATE blocks use it.

---

#### Change 2: Use Helper in INSERT Block (Line 779)

**Current Code** (line 779):
```typescript
          model_id: modelPath,
```

**New Code** (line 779):
```typescript
          model_id: getDisplayModelId(modelPath, job, config),
```

---

#### Change 3: Use Helper in UPDATE Block (Line 744)

**Current Code** (line 744):
```typescript
          model_id: modelPath,
```

**New Code** (line 744):
```typescript
          model_id: getDisplayModelId(modelPath, job, config),
```

---

## Why This is Safe

### 1. vLLM Inference Uses `served_model_name`

The OpenAI adapter (used by vLLM) prioritizes `served_model_name`:
```typescript
const modelName = config.served_model_name || config.model_id;
```

Since deployment already sets `served_model_name` to `config.modelName`, changing `model_id` won't affect inference.

---

### 2. Server Loading Uses `metadata.model_path`

The ModelCard component already reads from `metadata.model_path`:
```typescript
if (!metadata?.model_path) {
  toast.error('No model path found. This model cannot be deployed.');
}
```

This field is ALREADY populated in the deployment code (line 758 and 795), so redeployment will continue to work.

---

### 3. Analytics Will Benefit

Current analytics fallback:
```typescript
const modelName = llmModel?.name || llmModel?.model_id || "Unknown Model (vllm)";
```

**Before fix**:
- `llmModel.name` = "Llama-3.2-3B-Instruct-trained-1732901234"
- `llmModel.model_id` = "/home/.../checkpoint-100" ❌

**After fix**:
- `llmModel.name` = "Llama-3.2-3B-Instruct-trained-1732901234"
- `llmModel.model_id` = "meta-llama/Llama-3.2-3B-Instruct" ✅

---

## Testing Plan

### Phase 1: Verify Code Compilation ✅
```bash
npx tsc --noEmit
```
Expected: No new TypeScript errors

---

### Phase 2: Test New Deployment

1. **Deploy a training checkpoint**:
   ```bash
   # Via UI: Deploy a trained model from /training page
   ```

2. **Check database**:
   ```sql
   SELECT id, name, model_id, served_model_name, metadata->>'model_path' as model_path
   FROM llm_models
   WHERE provider = 'vllm'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

3. **Expected result**:
   - `name`: "Llama-3.2-3B-Instruct-trained-..."
   - `model_id`: "meta-llama/Llama-3.2-3B-Instruct" ✅ (NOT a file path!)
   - `served_model_name`: Same as name
   - `metadata.model_path`: "/path/to/checkpoint-100" ✅ (preserved)

---

### Phase 3: Test Inference

1. **Start chat with deployed model**
2. **Send a message**
3. **Verify response works**

Expected: Should work normally (using `served_model_name`)

---

### Phase 4: Test Redeployment

1. **Stop the vLLM server**
2. **Click "Start Server" on model card**
3. **Verify server starts**

Expected: Should work (using `metadata.model_path`)

---

### Phase 5: Test Analytics

1. **Go to `/analytics`**
2. **Check Model Performance table**
3. **Verify model name display**

Expected: Should show "meta-llama/Llama-3.2-3B-Instruct" instead of file path

---

## Rollback Plan

If anything breaks:

### Step 1: Identify the Issue
- Does inference fail? → Check if `served_model_name` is being set
- Does redeployment fail? → Check if `metadata.model_path` is being saved
- Do analytics break? → Revert changes to `model_id` assignment

### Step 2: Quick Rollback
Revert the 3 changes:
1. Remove helper function
2. Change line 779 back to `model_id: modelPath`
3. Change line 744 back to `model_id: modelPath`

### Step 3: Verify Rollback
```bash
npx tsc --noEmit
git diff app/api/training/deploy/route.ts
```

---

## Summary

### What Changes
- `model_id` field in `llm_models` table will store **readable model identifier** instead of file path

### What Stays the Same
- `metadata.model_path` continues to store the actual file path
- vLLM servers use `served_model_name` (already set correctly)
- Redeployment uses `metadata.model_path` (already implemented)

### Why It's Safe
1. ✅ Inference prioritizes `served_model_name` over `model_id`
2. ✅ Server loading uses `metadata.model_path`, not `model_id`
3. ✅ Redeployment already uses `metadata.model_path`
4. ✅ Only analytics display is affected (which is the goal!)

### Risk Assessment
- **Breaking inference**: LOW (uses `served_model_name`)
- **Breaking server loading**: NONE (`metadata.model_path` already in use)
- **Breaking redeployment**: NONE (`metadata.model_path` already in use)
- **Analytics improvement**: HIGH (will show readable names)

**Overall Risk**: LOW ✅

---

## Files Modified

1. `/app/api/training/deploy/route.ts`:
   - Add `getDisplayModelId()` helper function
   - Line 744: Use helper for UPDATE
   - Line 779: Use helper for INSERT

**Total lines changed**: 3 (plus ~40 lines for helper function)

---

## Ready for Approval

All verification complete. Awaiting user approval to proceed with implementation.
