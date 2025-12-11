# Model Names Display - Analysis & Proposal
**Date**: November 28, 2025
**Component**: Model Performance Table (Analytics Dashboard)
**Issue**: Model column shows IDs instead of human-readable names

---

## Current Situation

### Model Performance Table Location
**File**: `/components/analytics/ModelPerformanceTable.tsx`
**Lines**: 139-148 (Model column rendering)

### Current Display (Lines 139-148)
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

**Current Behavior**:
- Shows: `model.modelName` (which is actually the model ID)
- Sub-text shows: `provider • trainingMethod`
- Example display:
  ```
  meta-llama/Llama-3.2-3B-Instruct
  runpod • fine-tuned
  ```

### Root Cause (useAnalytics.ts:946)
```typescript
modelMetrics.push({
  modelId,
  modelName: modelId, // ← ISSUE: Using model_id as name
  provider,
  baseModel: null,
  trainingMethod: null,
  // ... other metrics
});
```

**Problem**: Line 946 sets `modelName: modelId` - using the technical ID as the display name.

---

## Available Data

### From `llm_models` Table (Already Fetched!)
**Query** (useAnalytics.ts:281-284):
```typescript
const { data: llmModels } = await supabase
  .from('llm_models')
  .select('id, model_id, name, provider, training_method, base_model, ...')
  .eq('user_id', userId);
```

**Data Structure** (`LLMModelRow` type, lines 37-46):
```typescript
type LLMModelRow = {
  id: string;
  model_id?: string;        // Technical ID (e.g., "meta-llama/Llama-3.2-3B")
  name?: string;            // Human-readable name (e.g., "Llama 3.2 3B Custom")
  provider?: string;        // e.g., "runpod"
  training_method?: string; // e.g., "fine-tuned"
  base_model?: string | null;
  training_dataset?: unknown;
  evaluation_metrics?: unknown;
};
```

**Key Fields**:
- `model_id`: Technical identifier (e.g., `meta-llama/Llama-3.2-3B-Instruct`, `gpt-4-turbo`)
- `name`: User-friendly name (e.g., `Llama 3.2 Custom`, `GPT-4 Turbo`)

**Data Already Available**: The `llmModels` array is already fetched and stored in `rawData.llmModels` (line 300).

---

## Display Options Discussion

### Option 1: Name with ID on Hover (RECOMMENDED)
**Display**:
```
┌─────────────────────────────────────┐
│ Llama 3.2 Custom                   │ ← model.name (or fallback to modelId)
│ runpod • fine-tuned                 │ ← provider • trainingMethod
└─────────────────────────────────────┘
  ↑ Hover shows tooltip: "meta-llama/Llama-3.2-3B-Instruct"
```

**Pros**:
- ✅ Clean, readable display (human names)
- ✅ Full ID available on hover for debugging
- ✅ Doesn't clutter the table
- ✅ Works well with long model IDs
- ✅ Follows common UI patterns (GitHub, Vercel, etc.)

**Cons**:
- ⚠️ Requires user to hover to see full ID
- ⚠️ Not copy-pasteable without hovering

**Implementation**:
- Add `title` attribute to show ID on hover
- Display `name` if available, fallback to `modelId`

---

### Option 2: Name and ID in Same Column
**Display**:
```
┌─────────────────────────────────────┐
│ Llama 3.2 Custom                   │ ← model.name
│ meta-llama/Llama-3.2-3B-Instruct   │ ← model_id in smaller text
│ runpod • fine-tuned                 │ ← provider • trainingMethod
└─────────────────────────────────────┘
```

**Pros**:
- ✅ All information visible at once
- ✅ No interaction needed (no hover)
- ✅ Easy to copy-paste ID
- ✅ Clear distinction between name and ID

**Cons**:
- ⚠️ Takes more vertical space (3 lines per row)
- ⚠️ Table becomes taller with many models
- ⚠️ Long IDs can wrap awkwardly
- ⚠️ More visual clutter

**Implementation**:
- Add third line showing `modelId` in small gray text
- Truncate with ellipsis if too long

---

### Option 3: Name with ID Abbreviation
**Display**:
```
┌─────────────────────────────────────┐
│ Llama 3.2 Custom (meta-llama/...)  │ ← name + abbreviated ID
│ runpod • fine-tuned                 │ ← provider • trainingMethod
└─────────────────────────────────────┘
  ↑ Hover shows full ID
```

**Pros**:
- ✅ Compact (2 lines)
- ✅ Shows some ID context
- ✅ Hints at full ID without taking space

**Cons**:
- ⚠️ Abbreviated IDs may be ambiguous
- ⚠️ Harder to debug (need to hover)
- ⚠️ Complex truncation logic needed

**Implementation**:
- Show first 15-20 chars of ID with "..."
- Full ID on hover

---

### Option 4: Keep ID, Show Name on Hover (Status Quo Alternative)
**Display**:
```
┌─────────────────────────────────────┐
│ meta-llama/Llama-3.2-3B-Instruct   │ ← modelId
│ runpod • fine-tuned                 │ ← provider • trainingMethod
└─────────────────────────────────────┘
  ↑ Hover shows: "Llama 3.2 Custom"
```

**Pros**:
- ✅ Technical accuracy (shows exact ID)
- ✅ Good for debugging/developers
- ✅ No ambiguity about which model

**Cons**:
- ❌ Not user-friendly for non-technical users
- ❌ Long IDs hard to read
- ❌ Defeats purpose of having friendly names

**Implementation**:
- Minimal change - just add tooltip with name

---

## Recommendation: Option 1 (Name with ID on Hover)

### Why Option 1 is Best

1. **User-Friendly**: Shows human-readable names by default
2. **Clean UI**: Doesn't clutter the table with long IDs
3. **Debuggable**: Full ID still accessible via hover
4. **Scalable**: Works well with many models
5. **Industry Standard**: Common pattern in modern UIs

### Example Transformation

**Before**:
```
Model                              Provider  Avg Rating
─────────────────────────────────────────────────────────
meta-llama/Llama-3.2-3B-Instruct  runpod    4.5 ⭐
gpt-4-turbo-2024-04-09            openai    4.8 ⭐
claude-3-opus-20240229            anthropic 4.7 ⭐
```

**After (Option 1)**:
```
Model                     Provider  Avg Rating
───────────────────────────────────────────────
Llama 3.2 Custom         runpod    4.5 ⭐
GPT-4 Turbo              openai    4.8 ⭐
Claude 3 Opus            anthropic 4.7 ⭐
```
*Hover over "Llama 3.2 Custom" shows: "meta-llama/Llama-3.2-3B-Instruct"*

---

## Implementation Plan - Option 1

### File 1: `/hooks/useAnalytics.ts`
**Function**: `aggregateByModel()` (around line 946)

**Current Code** (line 946):
```typescript
modelName: modelId, // For now, use model_id as name
```

**Updated Code**:
```typescript
// Look up friendly name from llm_models table
const llmModel = llmModels?.find(m => m.model_id === modelId);
const modelName = llmModel?.name || modelId; // Fallback to ID if no name
```

**Full Context Update** (lines 940-950):
```typescript
// Extract provider from first message (they should all be the same)
const provider = msgs[0]?.provider || null;

// Look up model details from llm_models table
const llmModel = llmModels?.find(m => m.model_id === modelId);
const modelName = llmModel?.name || modelId; // Use friendly name or fallback to ID
const baseModel = llmModel?.base_model || null;
const trainingMethod = llmModel?.training_method || null;

modelMetrics.push({
  modelId, // Keep original ID for filtering/identification
  modelName, // Now uses friendly name!
  provider,
  baseModel,
  trainingMethod,
  avgRating,
  // ... rest of metrics
});
```

**Why This Works**:
- `llmModels` is already available in the function scope (passed as parameter)
- Simple lookup: `llmModels.find(m => m.model_id === modelId)`
- Fallback to `modelId` if no matching row in `llm_models` table
- No breaking changes - just better display name

---

### File 2: `/components/analytics/ModelPerformanceTable.tsx`
**Location**: Lines 139-148 (Model column rendering)

**Current Code**:
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

**Updated Code (Option 1)**:
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
- Added `title={model.modelId}` - shows full ID on hover
- Added `cursor-help` class - shows help cursor on hover (indicates tooltip available)
- No other changes needed!

**Minimal, Non-Breaking Change**: Only 2 attributes added.

---

## Alternative Implementation - Option 2 (For Discussion)

If you prefer showing both name AND ID visibly:

**Updated Code (Option 2)**:
```typescript
<td className="py-2 px-3">
  <div>
    <div className="font-medium">{model.modelName}</div>
    {model.modelName !== model.modelId && (
      <div className="text-xs text-gray-400 font-mono truncate max-w-xs">
        {model.modelId}
      </div>
    )}
    {model.provider && (
      <div className="text-xs text-gray-500">
        {model.provider}
        {model.trainingMethod && ` • ${model.trainingMethod}`}
      </div>
    )}
  </div>
</td>
```

**Features**:
- Shows both name and ID
- Only shows ID line if name is different from ID (prevents duplication)
- ID in monospace font with gray color
- Truncates long IDs with `truncate` class
- Max width of `max-w-xs` (320px) to prevent wrapping

---

## Data Flow Verification

### Step 1: llm_models Fetched (useAnalytics.ts:281-284) ✅
```typescript
const { data: llmModels } = await supabase.from('llm_models').select(...);
```

### Step 2: Stored in rawData (useAnalytics.ts:300) ✅
```typescript
llmModels: (llmModels || []) as LLMModelRow[]
```

### Step 3: Passed to aggregateByModel (useAnalytics.ts:~620) ✅
```typescript
const modelMetrics = useMemo(() => {
  return aggregateByModel(
    rawData.messages,
    rawData.evaluations,
    rawData.conversations,
    rawData.llmModels, // ← Passed here!
    settings?.priceBook
  );
}, [rawData, settings?.priceBook]);
```

### Step 4: Need to Accept Parameter ⚠️

**Current Function Signature** (useAnalytics.ts:~880):
```typescript
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  conversations: AnalyticsConversation[],
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

**Updated Function Signature** (REQUIRED):
```typescript
function aggregateByModel(
  messages: AnalyticsMessage[],
  evaluations: AnalyticsEvaluation[],
  conversations: AnalyticsConversation[],
  llmModels: LLMModelRow[], // ← ADD THIS
  priceBook?: PriceBook
): ModelPerformanceMetrics[]
```

**Update Call Site** (useAnalytics.ts:~620):
```typescript
const modelMetrics = useMemo(() => {
  return aggregateByModel(
    rawData.messages,
    rawData.evaluations,
    rawData.conversations,
    rawData.llmModels, // ← ADD THIS
    settings?.priceBook
  );
}, [rawData, settings?.priceBook]);
```

---

## Files to Modify Summary

### Option 1 (Recommended) - Name with ID on Hover

**File 1**: `/hooks/useAnalytics.ts`
- **Line ~880**: Update `aggregateByModel` function signature (add `llmModels` parameter)
- **Line ~620**: Update `aggregateByModel` call (pass `rawData.llmModels`)
- **Lines 940-950**: Update modelName assignment (lookup from llmModels)

**File 2**: `/components/analytics/ModelPerformanceTable.tsx`
- **Lines 139-148**: Add `title` and `cursor-help` to model name div

**Total Changes**: ~10 lines modified across 2 files

---

## Testing Checklist

After implementation:

- [ ] Navigate to `/analytics`
- [ ] Scroll to "Model Performance Comparison" table
- [ ] Verify model names show friendly names (not IDs)
- [ ] Hover over model name - verify tooltip shows full ID
- [ ] Verify models without friendly names show ID as fallback
- [ ] Verify provider and training method still display correctly
- [ ] Click model row - verify filtering still works
- [ ] Export CSV - verify modelId still exported correctly
- [ ] Check console for errors

---

## Edge Cases

### 1. Model not in llm_models table
**Scenario**: Message has `model_id` but no matching row in `llm_models`
**Behavior**: Falls back to showing `model_id` as name
**Implementation**: `llmModel?.name || modelId`

### 2. Model has name === model_id
**Scenario**: User set `name` field to same value as `model_id`
**Behavior**: Shows same value (expected)
**Note**: Option 2 would hide duplicate ID line

### 3. Empty/null name in llm_models
**Scenario**: llm_models row exists but `name` is null/empty
**Behavior**: Falls back to `model_id`
**Implementation**: `llmModel?.name || modelId`

### 4. Very long friendly names
**Scenario**: User sets name to 100+ characters
**Behavior**: May wrap or overflow
**Solution**: Add `truncate` class if needed

---

## Discussion Questions

1. **Which option do you prefer?**
   - Option 1: Name with ID on hover (clean, recommended)
   - Option 2: Name and ID both visible (more info, taller)
   - Option 3: Name with ID abbreviation (compact, complex)
   - Option 4: Keep ID, show name on hover (technical)

2. **Should we truncate very long names?**
   - Add `max-w-xs truncate` classes?
   - Or let them wrap naturally?

3. **What about CSV exports?**
   - Should CSV export show `modelName` or `modelId`?
   - Or add both columns (`Model Name` and `Model ID`)?

4. **Provider-specific formatting?**
   - Should we format provider-specific IDs differently?
   - E.g., OpenAI: `gpt-4-turbo` → `GPT-4 Turbo`
   - E.g., Anthropic: `claude-3-opus-20240229` → `Claude 3 Opus`

5. **Default names for common models?**
   - Should we provide fallback name formatting for common models?
   - E.g., `gpt-4-turbo-2024-04-09` → `GPT-4 Turbo (Apr 2024)`
   - Or require users to set names in llm_models table?

---

## Recommendation Summary

**Preferred Approach**: **Option 1** (Name with ID on hover)

**Why**:
- Clean, user-friendly display
- Full ID still accessible for debugging
- Minimal code changes
- Industry-standard pattern
- No breaking changes

**Implementation Effort**: Low (< 30 minutes)
- Update function signature
- Update call site
- Add name lookup logic
- Add tooltip to UI component

**User Impact**: High (much better UX)

**Risk**: Very Low (fallback to ID if no name)

---

## Next Steps

1. **Confirm preferred option** with user
2. **Verify llm_models table** has name field populated
3. **Implement changes** in useAnalytics.ts and ModelPerformanceTable.tsx
4. **Test with real data**
5. **Consider CSV export** column naming
6. **Optional**: Add default name formatting for common models

---

## Questions for User

1. Which display option do you prefer (1, 2, 3, or 4)?
2. Do you have friendly names already populated in the `llm_models` table?
3. Should we add smart formatting for common model IDs (gpt-4, claude-3, etc.)?
4. Any specific name format preferences?
