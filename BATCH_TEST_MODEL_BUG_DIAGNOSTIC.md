# Batch Test Model Selection Bug - Diagnostic Steps

## Issue
User selects "PC Expert" (Qwen model) in batch test UI, but tests run with "moderator" model instead.

## Code Investigation Complete ✅

### Verified Flow:
1. ✅ Frontend sends correct `model_id` (BatchTesting.tsx:279)
2. ✅ Batch API receives and passes `modelId` (batch-testing/run/route.ts:355)
3. ✅ Chat API has correct priority logic (app/api/chat/route.ts:369-372)

### Model Selection Priority (Chat API lines 363-391):
```typescript
// Priority 1: Use modelId from request
if (modelId) {
  console.log('[API] Using model from request:', modelId);
  selectedModelId = modelId;
  useUnifiedClient = true;
}
// Priority 2: Get model from conversation
else if (conversationId && userId) {
  // ... loads conversation.llm_model_id
}
// Priority 3: Fall back to config default
```

## Root Cause Hypothesis

Since the code is correct, the issue must be:

### **Hypothesis A: Model ID Mismatch**
- The model displayed as "PC Expert" has a different UUID than expected
- OR "moderator" is actually the correct model and just has a misleading name

### **Hypothesis B: Model Lookup Failure**
- UnifiedLLMClient.getModelConfig() returns null for PC Expert UUID
- Error is caught and system falls back to default model
- Lines 485-503 handle model-not-found errors

## Diagnostic Steps

### Step 1: Check What Model ID Is Being Sent

**Run this in browser console while on Batch Testing page:**
```javascript
// After selecting PC Expert model
console.log('Selected Model ID:', document.querySelector('[id="model-select"]')?.getAttribute('data-value'));
```

**OR: Add temporary logging to BatchTesting.tsx at line 280:**
```typescript
body: JSON.stringify({
  config: {
    model_id: selectedModelId,  // ✅ Already here
    // ... rest of config
  }
})
// ADD THIS LINE RIGHT AFTER:
console.log('[BatchTesting] [DEBUG] Sending model_id:', selectedModelId);
```

### Step 2: Check Server Logs During Batch Test

Watch the server console when running a batch test. Look for these log messages:

**Expected logs if working:**
```
[Process Prompt] 0: Sending to /api/chat
[API] Widget mode: true API key present: true Session ID: batch_test_<uuid>
[API] Using model from request: <some-uuid>
[UnifiedLLMClient] Chat request for model: <some-uuid>
[ModelManager] Getting config for model: <some-uuid>
[ModelManager] Model loaded: PC Expert provider: vllm
```

**Expected logs if model not found:**
```
[API] Using model from request: <some-uuid>
[UnifiedLLMClient] Chat request for model: <some-uuid>
[ModelManager] Getting config for model: <some-uuid>
[ModelManager] Model not found: <some-uuid>
[UnifiedLLMClient] Model not found: <some-uuid>
[API] Model not found: <some-uuid>
```

**Expected logs if falling back to legacy:**
```
[API] Using legacy provider-specific path
```

### Step 3: Query Database to Compare Model IDs

Run this SQL query to see all models:

```sql
SELECT
  id,
  name,
  provider,
  model_id,
  enabled,
  is_global,
  created_at
FROM llm_models
WHERE enabled = true
  AND (name LIKE '%PC%' OR name LIKE '%Expert%' OR name LIKE '%moderator%' OR name LIKE '%Qwen%')
ORDER BY created_at DESC;
```

Compare the UUIDs with what's being logged in the browser console.

### Step 4: Check Recent Batch Test Conversations

```sql
SELECT
  c.id,
  c.title,
  c.llm_model_id,
  m.name as model_name,
  c.widget_session_id,
  c.created_at
FROM conversations c
LEFT JOIN llm_models m ON c.llm_model_id = m.id
WHERE c.widget_session_id LIKE 'batch_test_%'
ORDER BY c.created_at DESC
LIMIT 10;
```

This shows what `llm_model_id` was actually saved for recent batch tests.

## Expected Findings

**If Hypothesis A is correct:**
- Server logs will show `[API] Using model from request: <uuid>` with a specific UUID
- That UUID will match "moderator" model in database, not "PC Expert"
- Browser console will show that UUID was sent correctly
- **FIX**: The model selection in UI is using wrong model

**If Hypothesis B is correct:**
- Server logs will show `[ModelManager] Model not found: <uuid>`
- That UUID won't exist in llm_models table (or is disabled, or RLS blocks it)
- **FIX**: Model was deleted/disabled, or permissions issue

## Potential Fixes

### Fix for Hypothesis A: UI Selection Issue
If the wrong model ID is being selected, check:
- Model dropdown population at BatchTesting.tsx:167-170
- Verify `model.id` matches the expected PC Expert UUID

### Fix for Hypothesis B: Model Not Found
If model lookup is failing:
1. Verify PC Expert model exists and is enabled:
   ```sql
   SELECT * FROM llm_models WHERE name LIKE '%PC%Expert%' AND enabled = true;
   ```
2. Check RLS policies aren't blocking access
3. Verify model wasn't deleted after training

## Files Involved

| File | Lines | Purpose |
|------|-------|---------|
| `components/training/BatchTesting.tsx` | 508 | Model selection dropdown value |
| `components/training/BatchTesting.tsx` | 279 | Sends model_id to API |
| `app/api/batch-testing/run/route.ts` | 355 | Passes modelId to Chat API |
| `app/api/chat/route.ts` | 369-372 | Model selection Priority 1 |
| `app/api/chat/route.ts` | 471-503 | UnifiedLLMClient usage + error handling |
| `lib/llm/unified-client.ts` | 67-72 | Model lookup |
| `lib/models/model-manager.service.ts` | 290-369 | getModelConfig method |

## Next Steps

1. **Run Step 2** (check server logs) during next batch test
2. **Run Step 3** (database query) to see available models
3. **Report findings** - specifically:
   - What UUID was logged as "Using model from request"
   - Whether "Model not found" error appeared
   - What models exist in database with names containing "PC", "Expert", "Qwen", or "moderator"

---

**Status**: Investigation complete, awaiting diagnostic data from next test run
**Priority**: High - Blocking correct model selection in batch tests
