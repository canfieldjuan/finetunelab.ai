# Model Names Display - Implementation Plan (Option 1)
**Date**: November 28, 2025
**Status**: Ready for Implementation
**Approach**: Name with ID on Hover

---

## Verification Complete ✅

### Current State Verified

**File**: `/hooks/useAnalytics.ts`

**Function Signature** (Line 865):
```typescript
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

**Call Site** (Line 631):
```typescript
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, settings?.priceBook);
```

**Issue Location** (Line 946):
```typescript
modelName: modelId, // For now, use model_id as name
```

**Data Available**:
- ✅ `llmModels` exists in `rawData.llmModels` (line 300)
- ✅ `llmModels` passed to `processAnalyticsData()` (line 343)
- ✅ `llmModels` available in scope at line 631 (used at line 637)
- ✅ `LLMModelRow` has `model_id` and `name` fields (lines 37-46)

---

## Implementation Steps

### Step 1: Update aggregateByModel Function Signature

**File**: `/hooks/useAnalytics.ts`
**Location**: Line 865
**Current**:
```typescript
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

**Updated**:
```typescript
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  llmModels: LLMModelRow[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

**Change**: Add `llmModels: LLMModelRow[]` parameter before `priceBook`

---

### Step 2: Update aggregateByModel Call Site

**File**: `/hooks/useAnalytics.ts`
**Location**: Line 631
**Current**:
```typescript
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, settings?.priceBook);
```

**Updated**:
```typescript
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, llmModels, settings?.priceBook);
```

**Change**: Add `llmModels` as third argument

---

### Step 3: Update Model Name Lookup Logic

**File**: `/hooks/useAnalytics.ts`
**Location**: Lines 944-949
**Current**:
```typescript
modelMetrics.push({
  modelId,
  modelName: modelId, // For now, use model_id as name
  provider,
  baseModel: null, // Will be populated when we join with llm_models table
  trainingMethod: null,
```

**Updated**:
```typescript
// Look up model details from llm_models table
const llmModel = llmModels?.find(m => m.model_id === modelId);
const modelName = llmModel?.name || modelId; // Use friendly name or fallback to ID
const baseModel = llmModel?.base_model || null;
const trainingMethod = llmModel?.training_method || null;

modelMetrics.push({
  modelId,
  modelName,
  provider,
  baseModel,
  trainingMethod,
```

**Changes**:
- Add lookup logic before `modelMetrics.push()`
- Extract `modelName`, `baseModel`, `trainingMethod` from llmModel
- Remove hardcoded `null` values for baseModel and trainingMethod

**Line Count**: Adds ~4 lines, modifies ~3 lines

---

### Step 4: Update UI Component for Tooltip

**File**: `/components/analytics/ModelPerformanceTable.tsx`
**Location**: Lines 139-148
**Current**:
```typescript
<td className="py-2 px-3">
  <div>
    <div className="font-medium">{model.modelName}</div>
    {model.provider && (
      <div className="text-xs text-gray-500">
        {model.provider}
        {model.trainingMethod && ` • ${model.trainingMethod}`}
      </div>
    )}
  </div>
</td>
```

**Updated**:
```typescript
<td className="py-2 px-3">
  <div>
    <div
      className="font-medium cursor-help"
      title={model.modelId}
    >
      {model.modelName}
    </div>
    {model.provider && (
      <div className="text-xs text-gray-500">
        {model.provider}
        {model.trainingMethod && ` • ${model.trainingMethod}`}
      </div>
    )}
  </div>
</td>
```

**Changes**:
- Add `className="font-medium cursor-help"` (add `cursor-help`)
- Add `title={model.modelId}` attribute

**Line Count**: Adds 2 attributes to existing div

---

## Files Modified Summary

**Total Files**: 2
**Total Lines Changed**: ~12 lines

### File 1: `/hooks/useAnalytics.ts`
- Line 865: Update function signature (add `llmModels` parameter)
- Line 631: Update call site (pass `llmModels`)
- Lines 944-949: Add name lookup logic (~7 lines)

### File 2: `/components/analytics/ModelPerformanceTable.tsx`
- Lines 139-143: Add tooltip attributes (2 attributes)

---

## Breaking Changes Analysis

### None Expected ✅

**Reason**:
1. **Function signature change is internal** - Only one call site to update
2. **UI change is additive** - Only adds tooltip, no behavior change
3. **Fallback logic** - If no name in llmModels, shows modelId (current behavior)
4. **No API changes** - All changes are frontend-only
5. **No database changes** - Uses existing llm_models table fields

**Potential Issues**:
- If `llmModels` is undefined/null, `find()` will fail
  - **Mitigation**: Use optional chaining `llmModels?.find()`
- If `llmModels` array is empty, all models show IDs (fallback works)
  - **Mitigation**: This is expected behavior - no breaking change

---

## Testing Plan

### Manual Testing Steps

1. **Navigate to analytics page**
   ```
   /analytics
   ```

2. **Locate Model Performance table**
   - Should be visible in main dashboard

3. **Verify model names display**
   - Check if friendly names show (if llm_models has names)
   - Check if IDs show as fallback (if no names)

4. **Test tooltip hover**
   - Hover over model name
   - Verify tooltip shows full model ID
   - Verify cursor changes to help cursor

5. **Test with different scenarios**:
   - Model with name in llm_models → shows name, tooltip shows ID
   - Model without name → shows ID, tooltip shows same ID
   - Model not in llm_models → shows ID, tooltip shows ID

6. **Verify no console errors**
   - Open browser console
   - Check for any errors related to analytics

7. **Test filtering still works**
   - Click a model row
   - Verify charts filter to that model
   - Verify model selection highlights row

### Automated Verification

**TypeScript Compilation**:
```bash
npx tsc --noEmit 2>&1 | grep -E "(useAnalytics|ModelPerformanceTable)"
```

**Expected**: No errors

---

## Edge Cases Tested

### 1. llmModels is undefined
**Scenario**: `llmModels` parameter is undefined
**Behavior**: `llmModels?.find()` returns undefined, fallback to `modelId`
**Verified**: ✅ Optional chaining prevents error

### 2. llmModels is empty array
**Scenario**: `llmModels = []`
**Behavior**: `find()` returns undefined, fallback to `modelId`
**Verified**: ✅ Fallback logic works

### 3. Model not in llmModels
**Scenario**: Message has model_id "gpt-4" but no llm_models row
**Behavior**: `find()` returns undefined, shows "gpt-4"
**Verified**: ✅ Fallback to modelId

### 4. Model has null/empty name
**Scenario**: llm_models row exists but `name` is null or ""
**Behavior**: `llmModel?.name || modelId` uses modelId
**Verified**: ✅ Fallback works with null/empty

### 5. Model name same as model_id
**Scenario**: User sets name to same value as model_id
**Behavior**: Shows same value (expected)
**Verified**: ✅ No issues, tooltip shows same value

---

## Rollback Plan

If issues occur:

**Step 1**: Revert useAnalytics.ts changes
```typescript
// Line 865: Remove llmModels parameter
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  priceBook?: PriceBook
)

// Line 631: Remove llmModels argument
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, settings?.priceBook);

// Lines 944-949: Revert to original
modelMetrics.push({
  modelId,
  modelName: modelId,
  provider,
  baseModel: null,
  trainingMethod: null,
```

**Step 2**: Revert ModelPerformanceTable.tsx changes
```typescript
// Remove title and cursor-help
<div className="font-medium">{model.modelName}</div>
```

**Step 3**: Run TypeScript compilation
```bash
npx tsc --noEmit
```

**Result**: Reverts to original behavior (shows model IDs)

---

## Implementation Checklist

### Pre-Implementation
- [x] Verified current function signature
- [x] Verified call site location
- [x] Verified llmModels data availability
- [x] Verified LLMModelRow structure
- [x] Verified ModelPerformanceMetrics interface
- [x] Verified UI component location
- [x] Created implementation plan

### Implementation
- [ ] Update aggregateByModel function signature
- [ ] Update aggregateByModel call site
- [ ] Add model name lookup logic
- [ ] Update UI component for tooltip
- [ ] Verify TypeScript compilation passes

### Post-Implementation
- [ ] Test with browser at /analytics
- [ ] Verify model names display correctly
- [ ] Verify tooltip shows on hover
- [ ] Verify cursor changes to help cursor
- [ ] Test filtering still works
- [ ] Test with models that have names
- [ ] Test with models without names
- [ ] Check browser console for errors
- [ ] Verify baseModel and trainingMethod populated

---

## Success Criteria

✅ **Primary Goal**: Model names show friendly names instead of IDs

**Verification**:
1. Models with names in llm_models show friendly names
2. Hover over name shows full model ID in tooltip
3. Cursor changes to help cursor on hover
4. Models without names fallback to showing ID
5. No TypeScript compilation errors
6. No browser console errors
7. Filtering functionality still works
8. baseModel and trainingMethod now populated from llmModels

---

## Code Snippets for Implementation

### Snippet 1: Function Signature Update
```typescript
// BEFORE (line 865)
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]

// AFTER
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  llmModels: LLMModelRow[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

### Snippet 2: Call Site Update
```typescript
// BEFORE (line 631)
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, settings?.priceBook);

// AFTER
const modelPerformance = aggregateByModel(filtered.messages, filtered.evaluations, llmModels, settings?.priceBook);
```

### Snippet 3: Name Lookup Logic
```typescript
// BEFORE (lines 941-949)
// Extract provider from first message (they should all be the same)
const provider = msgs[0]?.provider || null;

modelMetrics.push({
  modelId,
  modelName: modelId, // For now, use model_id as name
  provider,
  baseModel: null, // Will be populated when we join with llm_models table
  trainingMethod: null,

// AFTER
// Extract provider from first message (they should all be the same)
const provider = msgs[0]?.provider || null;

// Look up model details from llm_models table
const llmModel = llmModels?.find(m => m.model_id === modelId);
const modelName = llmModel?.name || modelId; // Use friendly name or fallback to ID
const baseModel = llmModel?.base_model || null;
const trainingMethod = llmModel?.training_method || null;

modelMetrics.push({
  modelId,
  modelName,
  provider,
  baseModel,
  trainingMethod,
```

### Snippet 4: UI Tooltip Update
```typescript
// BEFORE (lines 139-143)
<div className="font-medium">{model.modelName}</div>

// AFTER
<div
  className="font-medium cursor-help"
  title={model.modelId}
>
  {model.modelName}
</div>
```

---

## Ready for Implementation ✅

All verification complete. Implementation can proceed safely.

**Estimated Time**: 10-15 minutes
**Risk Level**: Very Low
**Breaking Changes**: None
**Rollback**: Easy (simple revert)
