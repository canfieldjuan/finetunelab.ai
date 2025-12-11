# vLLM Model ID Issue - Root Cause & Solution
**Date**: November 29, 2025
**Issue**: vLLM models show file paths or UUIDs instead of readable names
**Status**: ROOT CAUSE IDENTIFIED - Solution ready

---

## User Clarification

User confirmed: **"they get auto populated when launched"**

Models ARE being registered in `llm_models` table when deployed via vLLM. The issue is **WHAT gets populated in the `model_id` field**.

---

## Root Cause Found

### Deployment Code (app/api/training/deploy/route.ts:771-805)

When a vLLM model is deployed, the code creates an `llm_models` entry:

```typescript
.insert({
  user_id: userId,
  provider: server_type,  // "vllm"
  name: modelName,        // ✅ GOOD: "Llama-3.2-3B-Instruct-trained-1732901234"
  model_id: modelPath,    // ❌ PROBLEM: "/path/to/lib/training/logs/job_abc123/checkpoint-100"
  served_model_name: servedName,
  base_url: serverInfo.baseUrl,
  // ... other fields
})
```

**Line 779**: `model_id: modelPath`

---

## The Problem

### What `modelPath` contains:

**Scenario 1: Training deployment**
```javascript
modelPath = "/home/juan-canfield/Desktop/web-ui/lib/training/logs/job_cb10bbcb-2725-49ce-9586-a9baf57de3a4/checkpoint-1780"
```

**Scenario 2: HuggingFace model deployment**
```javascript
modelPath = "meta-llama/Llama-3.2-3B-Instruct"  // ✅ This one is OK!
```

**Scenario 3: Local model path**
```javascript
modelPath = "/models/my-custom-model"
```

---

### What Analytics Shows

**When model_id = file path**:
```
Model Performance Table:
────────────────────────────────────────────
Model Name: Llama-3.2-3B-Instruct-trained-1732901234
Sub-text:  /home/juan-canfield/.../checkpoint-1780  ← Unhelpful!
```

**When model_id = HuggingFace ID**:
```
Model Performance Table:
────────────────────────────────────────────
Model Name: Llama-3.2-3B-Instruct-trained-1732901234
Sub-text:  meta-llama/Llama-3.2-3B-Instruct  ← Better!
```

---

## Why This Happens

### The Fallback Chain (Our Fix)

Analytics uses this fallback:
```typescript
const modelName = llmModel?.name || llmModel?.model_id || "Unknown Model (vllm)";
```

**Flow**:
1. Check `llmModel.name` → Exists! Shows "Llama-3.2-3B-Instruct-trained-1732901234" ✅
2. (Fallback not needed for primary display)

**But for tooltips/sub-text**, `model_id` is shown, which contains the file path.

---

## What SHOULD Happen

The `model_id` field should contain a **human-readable model identifier**, not a filesystem path.

### Correct Values

| Scenario | Current `model_id` | Should be `model_id` |
|----------|-------------------|---------------------|
| Training deployment (checkpoint) | `/path/to/job_abc/checkpoint-100` | `meta-llama/Llama-3.2-3B-Instruct` (base model) |
| Training deployment (merged) | `/path/to/job_abc/merged_model` | `meta-llama/Llama-3.2-3B-Instruct` (base model) |
| HuggingFace model | `meta-llama/Llama-3.2-3B-Instruct` | ✅ Already correct |
| Local custom model | `/models/my-model` | Extract from path or use `name` |

---

## Solution

### Fix in app/api/training/deploy/route.ts

**Current Code (lines 771-805)**:
```typescript
.insert({
  user_id: userId,
  provider: server_type,
  name: modelName,
  model_id: modelPath,  // ← WRONG: File path or HF ID
  served_model_name: servedName,
  base_url: serverInfo.baseUrl,
  is_global: false,
  enabled: true,
  training_method: trainingMethod,
  base_model: job?.model_name || 'unknown',  // ← This has the base model!
  // ...
})
```

**Fixed Code**:
```typescript
// Determine proper model_id for analytics display
// Priority: base model > HF ID from path > filename
let displayModelId: string;

if (job?.model_name) {
  // Training deployment: use base model (e.g., "meta-llama/Llama-3.2-3B-Instruct")
  displayModelId = job.model_name;
} else if (config?.model_path && !config.model_path.startsWith('/')) {
  // HuggingFace ID (no leading slash)
  displayModelId = config.model_path;
} else {
  // Local path: extract model name from path
  const pathParts = modelPath.split('/');
  displayModelId = pathParts[pathParts.length - 1] || 'local-model';
}

.insert({
  user_id: userId,
  provider: server_type,
  name: modelName,
  model_id: displayModelId,  // ← FIXED: Readable identifier
  served_model_name: servedName,
  base_url: serverInfo.baseUrl,
  is_global: false,
  enabled: true,
  training_method: trainingMethod,
  base_model: job?.model_name || 'unknown',
  metadata: {
    training_job_id: job_id,
    server_id: serverInfo.serverId,
    deployed_at: new Date().toISOString(),
    model_path: modelPath,  // ← Keep original path in metadata
    display_name: modelName,
    checkpoint_path: checkpoint_path,
    ...storageInfo,
  },
})
```

**Key Changes**:
1. Add logic to determine proper `model_id` before insertion
2. Use `job.model_name` (base model) for training deployments
3. Use HuggingFace ID for HF models
4. Extract filename from local paths
5. **Keep original `modelPath` in `metadata.model_path`** for deployment needs

---

### Same Fix for UPDATE Path (lines 740-766)

The UPDATE path has the same issue on line 744:
```typescript
.update({
  provider: server_type,
  model_id: modelPath,  // ← WRONG: Same issue
  // ...
})
```

Apply the same fix there.

---

## Expected Results After Fix

### Before Fix

**Analytics Display**:
```
Model Performance Table
────────────────────────────────────────────────────────────────────
Model Name                                    Avg Rating  Success
────────────────────────────────────────────────────────────────────
Llama-3.2-3B-Instruct-trained-1732901234     4.5 ⭐      87.5%
  vllm
  [Hover: UUID or file path]
```

### After Fix

**Analytics Display**:
```
Model Performance Table
────────────────────────────────────────────────────────────────────
Model Name                                    Avg Rating  Success
────────────────────────────────────────────────────────────────────
Llama-3.2-3B-Instruct-trained-1732901234     4.5 ⭐      87.5%
  vllm
  [Hover: meta-llama/Llama-3.2-3B-Instruct]
```

**Much better!** Now the fallback shows the base model instead of a file path.

---

## Implementation Details

### Where to Apply Fix

**File**: `/app/api/training/deploy/route.ts`

**Lines to modify**:
1. **INSERT path**: Before line 773 (add model_id logic)
2. **INSERT statement**: Line 779 (change `model_id: modelPath` to `model_id: displayModelId`)
3. **UPDATE path**: Before line 740 (add same model_id logic)
4. **UPDATE statement**: Line 744 (change `model_id: modelPath` to `model_id: displayModelId`)

---

### Logic for `displayModelId`

```typescript
/**
 * Determine readable model identifier for analytics display
 * Priority: base model > HuggingFace ID > extracted name from path
 */
function getDisplayModelId(
  modelPath: string,
  job: any,
  config: any
): string {
  // Priority 1: Training job's base model (best option)
  if (job?.model_name) {
    return job.model_name;  // e.g., "meta-llama/Llama-3.2-3B-Instruct"
  }

  // Priority 2: HuggingFace model ID from config
  if (config?.model_path && !config.model_path.startsWith('/')) {
    return config.model_path;  // e.g., "Qwen/Qwen2.5-0.5B"
  }

  // Priority 3: Extract from path (last resort)
  const pathParts = modelPath.split('/');
  const lastPart = pathParts[pathParts.length - 1];

  // Filter out checkpoint folders
  if (lastPart && !lastPart.startsWith('checkpoint-')) {
    return lastPart;
  }

  // If it's a checkpoint, use the parent folder
  if (pathParts.length >= 2) {
    return pathParts[pathParts.length - 2];
  }

  return 'local-model';
}
```

---

## Testing Checklist

After applying fix:

1. **Deploy a training checkpoint**:
   - Check `llm_models` table
   - Verify `model_id` = base model (not file path)
   - Verify `metadata.model_path` = original file path

2. **Deploy a HuggingFace model**:
   - Check `llm_models` table
   - Verify `model_id` = HF model ID

3. **Check analytics**:
   - Refresh `/analytics`
   - Verify model names show correctly
   - Hover over model → should show base model, not file path

4. **Verify inference still works**:
   - vLLM should use `metadata.model_path` for loading
   - Chat should work normally

---

## Why `metadata.model_path` is Important

The deployment code and vLLM server launcher need the **actual filesystem path** to load the model. We can't just throw that away!

**Solution**: Store it in `metadata.model_path`

**vLLM launcher** should read from:
```typescript
const modelToLoad = llmModel.metadata?.model_path || llmModel.model_id;
```

This way:
- Analytics gets readable `model_id` for display ✅
- Deployment gets real `model_path` from metadata for loading ✅

---

## Summary

**Issue**: vLLM models show file paths in analytics

**Root Cause**: `model_id` field is populated with `modelPath` (filesystem path)

**Solution**:
1. Extract proper model identifier from `job.model_name` (base model)
2. Store it in `model_id` field for analytics
3. Keep original path in `metadata.model_path` for deployment

**Impact**: Analytics will now show:
- Base model identifier (e.g., "meta-llama/Llama-3.2-3B-Instruct")
- Instead of file paths (e.g., "/path/to/checkpoint-100")

**Files to modify**: `/app/api/training/deploy/route.ts` (lines 740-805)

**Status**: Ready for implementation
