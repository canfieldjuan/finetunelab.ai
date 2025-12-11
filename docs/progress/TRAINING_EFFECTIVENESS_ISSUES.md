# Training Method Effectiveness - Issues Analysis
**Date**: November 29, 2025
**Component**: TrainingEffectivenessChart.tsx
**Data Source**: aggregateTrainingEffectiveness() in useAnalytics.ts

---

## User-Reported Issues

1. **Model column showing UUIDs** instead of readable names
2. **Base Model column is empty** when it should show base model names

---

## Root Cause Analysis

### Issue 1: Model Names Showing UUIDs

**Location**: `aggregateTrainingEffectiveness()` lines 1121-1127

**Current Logic**:
```typescript
// Create a map of model_id -> llm_model for quick lookup
const modelMap = new Map<string, LLMModelRow>();
llmModels.forEach(m => {
  if (m.model_id) {
    modelMap.set(m.model_id, m);  // ← WRONG! Using model_id as key
  }
});
```

**The Problem**:
- The map uses `llm_models.model_id` (string identifier like "gpt-4-turbo") as the key
- But `messages.model_id` contains UUIDs (FK to `llm_models.id`)
- When looking up: `modelMap.get(msg.model_id)` fails because UUID ≠ model_id string
- Result: `llmModel` is undefined, falls back to showing UUID

**Where it's used**:
```typescript
// Line 1135: Lookup fails
const llmModel = modelMap.get(msg.model_id as string);  // Returns undefined!

// Line 1228: Falls back to UUID
modelName: llmModel?.name || modelId,  // Shows UUID when llmModel is undefined
```

---

### Issue 2: Base Model Column Empty

**Location**: `aggregateTrainingEffectiveness()` line 1229

**Current Logic**:
```typescript
modelDetails.push({
  modelId,
  modelName: llmModel?.name || modelId,
  baseModel: llmModel?.base_model || null,  // ← Returns null because llmModel is undefined
  avgRating: modelAvgRating,
  successRate: modelSuccessRate
});
```

**The Problem**:
- Since `llmModel` is undefined (due to Issue 1), `llmModel?.base_model` is always undefined
- Falls back to `null`
- Display shows "-" in the Base Model column

---

## Database Schema (Reminder)

```
llm_models table:
  - id (UUID)           ← Primary key
  - model_id (string)   ← Model identifier (e.g., "gpt-4-turbo")
  - name (string)       ← Friendly name (e.g., "GPT-4 Turbo")
  - base_model (string) ← Base model identifier (e.g., "gpt-4")
  - training_method     ← Training method (base, sft, dpo, rlhf)

messages table:
  - model_id (UUID)     ← Foreign key to llm_models.id (NOT llm_models.model_id!)
```

---

## Comparison with Working Code

### Model Performance Table (FIXED)
In `aggregateByModel()` (lines 945-951), we already fixed this:

```typescript
// CORRECT: Match on llm_models.id (UUID)
const llmModel = llmModels?.find(m => m.id === modelId);

// Fallback chain works because llmModel is found
const modelName = llmModel?.name || llmModel?.model_id || (provider ? `Unknown Model (${provider})` : modelId);
```

---

## Solution

### Fix 1: Change Map Key from model_id to id

**Before** (lines 1121-1127):
```typescript
const modelMap = new Map<string, LLMModelRow>();
llmModels.forEach(m => {
  if (m.model_id) {
    modelMap.set(m.model_id, m);  // ← WRONG
  }
});
```

**After**:
```typescript
const modelMap = new Map<string, LLMModelRow>();
llmModels.forEach(m => {
  modelMap.set(m.id, m);  // ← CORRECT: Use UUID as key
});
```

**Impact**:
- Map key now matches `messages.model_id` (UUID)
- Lookups will succeed
- `llmModel` will be found correctly

---

### Fix 2: Enhanced Fallback for Model Name

**Before** (line 1228):
```typescript
modelName: llmModel?.name || modelId,
```

**After**:
```typescript
modelName: llmModel?.name || llmModel?.model_id || modelId,
```

**Fallback Priority**:
1. `llmModel.name` - Friendly name (e.g., "My Custom GPT-4")
2. `llmModel.model_id` - Model identifier (e.g., "gpt-4-turbo-2024-04-09")
3. `modelId` - UUID (last resort for orphaned records)

**Benefit**: Same pattern as Model Performance table

---

### Fix 3: Base Model Already Correct

Once Fix 1 is applied, `llmModel?.base_model` will work automatically because `llmModel` will no longer be undefined.

**No code change needed** - the existing line 1229 is correct:
```typescript
baseModel: llmModel?.base_model || null,
```

---

## Expected Results After Fix

### Before Fix

**Training Method Effectiveness Table**:
```
Training Method: Supervised Fine-Tuning (SFT)
Models: 2

Model Breakdown:
Model Name                               Base Model
────────────────────────────────────────────────────
fdab6388-564f-4f71-a268-65d0e2de1366    -
c010253d-8e0e-45dd-b7cd-807fcfd6d329    -
```

### After Fix

**Training Method Effectiveness Table**:
```
Training Method: Supervised Fine-Tuning (SFT)
Models: 2

Model Breakdown:
Model Name                               Base Model
────────────────────────────────────────────────────
Llama 3.2 3B Custom                     meta-llama/Llama-3.2-3B-Instruct
GPT-4 Turbo Fine-tuned                  gpt-4-turbo-2024-04-09
```

---

## Files to Modify

### `/hooks/useAnalytics.ts`

**Line 1123-1127**: Change map key from `model_id` to `id`
**Line 1228**: Add enhanced fallback chain

---

## Verification Steps

1. **TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   Should have no errors

2. **Test Cases**:
   - Models with `name` set → Show friendly name
   - Models without `name` but with `model_id` → Show model identifier
   - Models not in `llm_models` (orphaned) → Show UUID
   - Base model column → Show `base_model` from llm_models table

3. **User Experience**:
   - Refresh analytics page
   - Navigate to "Training Method Effectiveness" section
   - Verify model names are readable
   - Verify base model column is populated
   - Hover over model name should show UUID tooltip

---

## Related Fixes

This is the **same issue** we fixed in:
- Model Performance Table (MODEL_NAMES_UUID_FIX.md)
- Session A/B Testing already uses correct approach

**Pattern**: All analytics aggregation functions should:
1. Match on `llm_models.id` (UUID), not `llm_models.model_id` (string)
2. Use fallback chain: `name → model_id → UUID`
3. Trust that `base_model` and other fields will work once lookup succeeds

---

## Summary

**Root Cause**: Map key used `llm_models.model_id` (string) instead of `llm_models.id` (UUID)

**Impact**:
- Lookups failed
- Model names showed UUIDs
- Base model column empty

**Fix**:
1. Change map key to use `m.id` instead of `m.model_id`
2. Add enhanced fallback chain for model names

**Status**: Ready for implementation
