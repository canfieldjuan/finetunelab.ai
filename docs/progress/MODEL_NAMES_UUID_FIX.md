# Model Names UUID Fix
**Date**: November 28, 2025
**Status**: FIXED
**Issue**: Model lookup was matching wrong field (model_id vs id)

---

## Problem Discovered

### User Report
Model Performance table showing UUIDs instead of model names:
```
fdab6388-564f-4f71-a268-65d0e2de1366  ← UUID showing instead of name
c010253d-8e0e-45dd-b7cd-807fcfd6d329  ← UUID showing instead of name
```

### Root Cause

**Database Schema**:
```
llm_models table:
  - id (UUID)           ← Primary key
  - model_id (string)   ← Actual model identifier (e.g., "gpt-4-turbo")
  - name (string)       ← Friendly name (e.g., "GPT-4 Turbo")

messages table:
  - model_id (UUID)     ← Foreign key to llm_models.id (NOT llm_models.model_id!)
```

**Incorrect Lookup** (Line 946 - BEFORE):
```typescript
const llmModel = llmModels?.find(m => m.model_id === modelId);
```

**Problem**: Trying to match `llm_models.model_id` (string like "gpt-4-turbo") against `messages.model_id` (UUID like "fdab6388-..."). These never match!

**Result**: `llmModel` was always `undefined`, so it fell back to showing the UUID.

---

## Solution

### Fixed Lookup (Line 947)

**Before**:
```typescript
const llmModel = llmModels?.find(m => m.model_id === modelId);
const modelName = llmModel?.name || modelId;
```

**After**:
```typescript
const llmModel = llmModels?.find(m => m.id === modelId);
const modelName = llmModel?.name || llmModel?.model_id || modelId;
```

**Changes**:
1. Match on `m.id` instead of `m.model_id` (correct FK relationship)
2. Fallback chain: `name → model_id → UUID`

---

## Fallback Chain Explained

**Priority 1**: `llmModel?.name`
- If user has set a friendly name in llm_models table
- Example: "My Custom GPT-4"

**Priority 2**: `llmModel?.model_id`
- If no friendly name, use the model identifier
- Example: "gpt-4-turbo-2024-04-09"

**Priority 3**: `modelId`
- If model not found in llm_models table, show UUID
- Example: "fdab6388-564f-4f71-a268-65d0e2de1366"
- This should rarely happen (only if FK relationship broken)

---

## Expected Results After Fix

### Scenario 1: Model has friendly name
**Database**:
- `llm_models.id = "fdab6388-564f-4f71-a268-65d0e2de1366"`
- `llm_models.model_id = "meta-llama/Llama-3.2-3B-Instruct"`
- `llm_models.name = "Llama 3.2 Custom"`

**Display**: `Llama 3.2 Custom`
**Hover**: `fdab6388-564f-4f71-a268-65d0e2de1366`

### Scenario 2: Model has NO friendly name
**Database**:
- `llm_models.id = "c010253d-8e0e-45dd-b7cd-807fcfd6d329"`
- `llm_models.model_id = "gpt-4-turbo-2024-04-09"`
- `llm_models.name = null`

**Display**: `gpt-4-turbo-2024-04-09`
**Hover**: `c010253d-8e0e-45dd-b7cd-807fcfd6d329`

### Scenario 3: Model not in llm_models (orphaned FK)
**Database**:
- `messages.model_id = "19bef356-1854-4ba5-ba16-c91a561f7c13"`
- No matching row in llm_models

**Display**: `19bef356-1854-4ba5-ba16-c91a561f7c13` (UUID)
**Hover**: `19bef356-1854-4ba5-ba16-c91a561f7c13` (same)

---

## Files Modified

### `/hooks/useAnalytics.ts`
**Line 947**: Changed `m.model_id` to `m.id`
**Line 948**: Added fallback chain `name || model_id || modelId`

---

## Verification

### TypeScript Compilation ✅
```bash
npx tsc --noEmit 2>&1 | grep -E "aggregateByModel|modelName|llmModel"
```
**Result**: No errors

### Expected User Experience
**Before Fix**:
```
Model Performance Comparison
────────────────────────────────────────
fdab6388-564f-4f71-a268-65d0e2de1366  ← UUID (bad!)
c010253d-8e0e-45dd-b7cd-807fcfd6d329  ← UUID (bad!)
```

**After Fix**:
```
Model Performance Comparison
────────────────────────────────────────
Llama 3.2 Custom                      ← Friendly name (if set)
gpt-4-turbo-2024-04-09                ← Model ID (if no name)
GPT-4o Mini                           ← Friendly name (if set)
```

---

## Testing Checklist

- [ ] Refresh analytics page (`/analytics`)
- [ ] Verify model names now show friendly names OR model IDs (not UUIDs)
- [ ] Hover over model name - should show UUID in tooltip
- [ ] Check that all models display properly
- [ ] Verify no UUIDs showing in model column (unless orphaned)
- [ ] Check browser console for errors (should be none)

---

## Why This Happened

The original implementation assumed `messages.model_id` contained the actual model identifier string (like "gpt-4-turbo"), but the database schema actually uses UUIDs as foreign keys.

**Lesson**: Always verify the actual database schema and FK relationships before implementing lookups!

---

## Summary

**Issue**: Wrong field used in lookup (`model_id` instead of `id`)
**Fix**: Changed lookup to match on UUID (`m.id === modelId`)
**Benefit**: Enhanced fallback chain (name → model_id → UUID)
**Impact**: Model names now display correctly

**Status**: ✅ FIXED - Ready for user testing
