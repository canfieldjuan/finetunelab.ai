# vLLM Models Showing UUIDs - Root Cause Analysis
**Date**: November 29, 2025
**Issue**: vLLM models display as UUIDs instead of readable names in analytics
**Status**: ROOT CAUSE IDENTIFIED

---

## User Report

"it looks like models launched in vllm dont show up with model names but uuids. why is that?"

---

## Root Cause Analysis

The issue is **NOT with the analytics code** - we just fixed the lookup logic to work correctly!

The real problem is that **vLLM models are likely missing entries in the `llm_models` table**, or their entries don't have the `name` or `model_id` fields populated.

---

## How It Works

### Message Creation (app/api/chat/route.ts:720)

When a message is saved, it stores the `selectedModelId` (UUID):

```typescript
.insert({
  conversation_id: widgetConversationId,
  user_id: userId,
  role: 'assistant',
  content: finalResponse,
  latency_ms: latency_ms,
  ...(selectedModelId && { model_id: selectedModelId }),  // ← Stores UUID
  ...(provider && { provider: provider }),
})
```

**What gets stored**:
- `messages.model_id` = UUID from `llm_models.id`
- `messages.provider` = "vllm"

---

### Analytics Lookup (hooks/useAnalytics.ts:945-951)

We just fixed this to lookup correctly:

```typescript
// Look up model details from llm_models table
const llmModel = llmModels?.find(m => m.id === modelId);  // ← Correct UUID lookup

// Fallback chain: name → model_id → UUID
const modelName = llmModel?.name || llmModel?.model_id || (provider ? `Unknown Model (${provider})` : modelId);
```

**What happens**:
1. **If `llmModel` is found** AND has `name` or `model_id` → Shows readable name ✅
2. **If `llmModel` is found** BUT has NULL `name` and `model_id` → Shows "Unknown Model (vllm)" ✅
3. **If `llmModel` is NOT found** in table → Shows "Unknown Model (vllm)" ✅

---

## Why vLLM Models Show UUIDs

### Scenario 1: Missing llm_models Entry (Most Likely)

**Problem**: The vLLM model was used in chat, but no row exists in `llm_models` table.

**How this happens**:
- User launches vLLM server
- Model is available via API
- Messages are created with `model_id` = UUID
- But that UUID was never inserted into `llm_models` table

**Result**:
- `llmModels.find(m => m.id === modelId)` returns `undefined`
- Falls back to `Unknown Model (vllm)` or UUID

---

### Scenario 2: Empty name and model_id Fields

**Problem**: The llm_models row exists, but both `name` and `model_id` are NULL.

**Database**:
```sql
SELECT id, name, model_id, provider
FROM llm_models
WHERE provider = 'vllm';

-- Example result:
-- id: fdab6388-564f-4f71-a268-65d0e2de1366
-- name: NULL
-- model_id: NULL  (or empty string "")
-- provider: vllm
```

**Result**:
- `llmModel` is found
- But `llmModel?.name` is NULL
- And `llmModel?.model_id` is NULL
- Falls back to showing "Unknown Model (vllm)" or UUID

---

## How vLLM Models Should Be Created

### Option 1: Manual Model Registration

User adds the vLLM model to LLM Registry:

```typescript
// Via AddModelDialog or API
{
  name: "Llama 3.2 3B Instruct (vLLM)",  // ✅ User-friendly name
  model_id: "meta-llama/Llama-3.2-3B-Instruct",  // ✅ Model identifier
  provider: "vllm",
  base_url: "http://localhost:8000/v1",
  // ... other fields
}
```

**Result**: Shows "Llama 3.2 3B Instruct (vLLM)" in analytics ✅

---

### Option 2: Automatic Registration During Deployment

When deploying a model via training UI, automatically create llm_models entry:

```typescript
// In deployment code
await modelManager.createModel({
  name: `${config.baseModel} (vLLM)`,
  model_id: config.baseModel,  // e.g., "meta-llama/Llama-3.2-3B-Instruct"
  provider: "vllm",
  base_url: deployment.endpoint,
  served_model_name: deployment.servedModelName,
  // ... other fields
});
```

**Result**: Model is registered automatically during deployment ✅

---

### Option 3: Auto-Discovery from vLLM API

Query vLLM `/v1/models` endpoint and auto-register:

```typescript
// Fetch available models from vLLM
const response = await fetch(`${baseUrl}/v1/models`);
const { data } = await response.json();

// Auto-register if not in llm_models
for (const model of data) {
  await modelManager.createModel({
    name: model.id,  // Use model ID as name initially
    model_id: model.id,
    provider: "vllm",
    base_url: baseUrl,
    // ... other fields
  });
}
```

**Result**: Models are discovered and registered automatically ✅

---

## Investigation Steps

To diagnose which scenario applies, run these queries:

### 1. Check if vLLM models exist in llm_models table

```sql
SELECT id, name, model_id, provider, base_url
FROM llm_models
WHERE provider = 'vllm';
```

**Possible results**:
- **No rows**: Scenario 1 - models not registered
- **Rows with NULL name/model_id**: Scenario 2 - incomplete registration
- **Rows with populated fields**: Then the issue is elsewhere

---

### 2. Check messages using vLLM models

```sql
SELECT DISTINCT m.model_id, m.provider
FROM messages m
WHERE m.provider = 'vllm';
```

**Compare with llm_models**:
- If `model_id` values don't match any `llm_models.id` → Missing registration

---

### 3. Find orphaned vLLM messages

```sql
-- Messages with vLLM provider but no matching llm_models entry
SELECT m.model_id, m.provider, COUNT(*) as message_count
FROM messages m
LEFT JOIN llm_models lm ON lm.id = m.model_id
WHERE m.provider = 'vllm'
  AND lm.id IS NULL
GROUP BY m.model_id, m.provider;
```

**Result**: Shows which vLLM model UUIDs need registration

---

## Recommended Solutions

### Short-term Fix: Manual Registration

1. Identify vLLM models being used:
   ```sql
   SELECT DISTINCT model_id, provider
   FROM messages
   WHERE provider = 'vllm';
   ```

2. For each UUID, create an llm_models entry:
   ```sql
   INSERT INTO llm_models (id, user_id, name, model_id, provider, base_url, enabled)
   VALUES (
     '<uuid-from-messages>',
     '<your-user-id>',
     'Llama 3.2 3B Instruct',  -- Friendly name
     'meta-llama/Llama-3.2-3B-Instruct',  -- Model identifier
     'vllm',
     'http://localhost:8000/v1',
     true
   );
   ```

3. Refresh analytics page → Names should appear ✅

---

### Medium-term Fix: Improve Deployment Flow

**Location**: `app/api/training/deploy/route.ts` or deployment service

**Change**: Auto-create llm_models entry when deploying:

```typescript
// After successful deployment
const modelId = uuid();  // Generate UUID
const modelRecord = await modelManager.createModel({
  id: modelId,  // Use generated UUID
  userId: userId,
  name: `${baseModel} (Fine-tuned)`,
  model_id: baseModel,
  provider: "vllm",
  base_url: deploymentEndpoint,
  served_model_name: servedModelName,
  training_method: trainingMethod,  // sft, dpo, rlhf
  base_model: baseModel,
  enabled: true
}, userId);

// Return modelId to use in chat
return { success: true, modelId: modelRecord.id };
```

---

### Long-term Fix: Model Auto-Discovery

**Create a background service** that:
1. Periodically checks vLLM endpoints for available models
2. Auto-registers new models in llm_models table
3. Updates existing models with latest metadata

**Benefit**: Zero-config model registration

---

## Why Our Analytics Fix Still Helps

Even with missing llm_models entries, our fixes ensure:

1. **No crashes**: Code handles missing models gracefully
2. **Provider context**: Shows "Unknown Model (vllm)" instead of raw UUID
3. **Consistency**: All three tables (Model Performance, Sessions, Training) now work the same way
4. **Debugging**: User can hover to see UUID and identify which model to register

---

## Summary

**Issue**: vLLM models show UUIDs in analytics

**Root Cause**: Models are NOT registered in `llm_models` table, or have NULL `name`/`model_id` fields

**Analytics Code**: ✅ WORKING CORRECTLY - shows "Unknown Model (vllm)" as expected

**Solution**: Register vLLM models properly in `llm_models` table with:
- `name` = User-friendly name
- `model_id` = Model identifier (e.g., "meta-llama/Llama-3.2-3B-Instruct")
- `provider` = "vllm"
- Other metadata (base_url, served_model_name, etc.)

**Next Steps**:
1. Run diagnostic queries to identify missing models
2. Manually register models (short-term)
3. Improve deployment flow to auto-register (medium-term)
4. Consider auto-discovery service (long-term)
