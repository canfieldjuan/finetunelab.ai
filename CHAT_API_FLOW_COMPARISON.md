# Chat API Flow Comparison: UI vs Batch Testing

## Executive Summary

**YES, they share a unified endpoint (`/api/chat`)**, but with different request body parameters and different paths through the same handler.

## Flow Comparison

### 1. Chat UI Flow

**Entry Point:** `/components/hooks/useChatActions.ts:304`

**Preparation:**
```typescript
// User selects model in UI or uses conversation default
const selectedModelId = /* UUID from dropdown or conversation.llm_model_id */
```

**Request to `/api/chat`:**
```typescript
{
  messages: conversationMessages,           // Full conversation history
  tools: modifiedTools,                     // Available tools for the model
  conversationId: activeId,                 // Existing conversation UUID
  modelId: selectedModelId === '__default__' ? null : selectedModelId  // UUID or null
}
```

**Key Characteristics:**
- Uses existing `conversationId` (loaded from database)
- Sends full conversation history (`messages` array)
- Passes tools configuration
- `modelId` can be `null` (uses conversation's default model)
- Streaming enabled (default)
- User-initiated via UI interaction

---

### 2. Batch Testing Flow

**Entry Point:** `/app/api/batch-testing/run/route.ts:339`

**Preparation:**
```typescript
// Line 339: Convert request model_id to model_name
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,  // UUID from llm_models table
  // ...
};

// Line 620: Pre-create conversation with model_id
const conversation = await supabaseAdmin
  .from('conversations')
  .insert({
    user_id: userId,
    title: customName,
    widget_session_id: widgetSessionId,
    is_widget_session: true,
    llm_model_id: config.model_name,  // UUID stored here
    run_id: runId,
    batch_test_run_id: testRunId
  });

// Line 688: Pass to processSinglePrompt
await processSinglePrompt(
  testRunId,
  config.model_name,  // UUID passed as modelId
  prompt,
  // ...
);
```

**Request to `/api/chat` (line 859-869):**
```typescript
{
  messages: [{ role: 'user', content: prompt }],  // Single prompt only
  modelId: modelId,                               // UUID (required)
  widgetSessionId: widgetSessionId,               // Batch test session
  forceNonStreaming: true,                        // Force metrics capture
  runId: runId,                                   // Link to experiment run
  benchmarkId: benchmarkId                        // Link to benchmark
}
```

**Key Characteristics:**
- Creates NEW `conversation` before calling chat API
- Sends single prompt per request (no conversation history)
- `modelId` is ALWAYS a UUID (required, never null)
- Forces non-streaming mode
- Includes `runId` and `benchmarkId` for tracking
- System-initiated via batch testing API

---

## Unified Chat API Handler (`/app/api/chat/route.ts`)

Both flows converge at the **same handler** with the following model selection logic:

### Model Selection Flow (with debug checkpoints)

```typescript
// Line 141-143: Log incoming request
console.log(`[API] [${requestId}] [DEBUG-REQUEST-BODY] modelId from request body:`, modelId);
console.log(`[API] [${requestId}] [DEBUG-REQUEST-BODY] conversationId from request body:`, conversationId);

// CHECKPOINT-1: Line 600-604
// If modelId provided in request (BATCH TESTING PATH)
if (modelId) {
  console.log(`[API] [${requestId}] ✓ Using model from request:`, modelId);
  selectedModelId = modelId;  // Use UUID directly
  useUnifiedClient = true;
  console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-1] selectedModelId set from request:`, selectedModelId);
}

// CHECKPOINT-2: Line 616-619
// If conversation exists (CHAT UI PATH or BATCH TESTING PATH)
if (conversation?.llm_model_id) {
  console.log(`[API] [${requestId}] Using model from conversation:`, conversation.llm_model_id);
  selectedModelId = conversation.llm_model_id;  // Use conversation's model
  useUnifiedClient = true;
  console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-2] selectedModelId set from conversation:`, selectedModelId);
}

// CHECKPOINT-3: Line 737-741
// Fallback to legacy config (OLD PATH)
if (!selectedModelId) {
  selectedModelId = model;  // From environment config
  console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-3] selectedModelId fallback to legacy config:`, selectedModelId);
}

// CHECKPOINT-4A/4B: Line 907-914
// Get model configuration from database
console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4A] Calling getModelConfig with selectedModelId:`, selectedModelId);
actualModelConfig = await modelManager.getModelConfig(selectedModelId, userId || undefined, supabaseAdmin || undefined);
console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4B] getModelConfig returned:`, {
  id: actualModelConfig.id,
  name: actualModelConfig.name,
  provider: actualModelConfig.provider,
  model_id: actualModelConfig.model_id
});

// CHECKPOINT-5: Line 917-918
// Create message metadata
console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-5] Creating message metadata with selectedModelId:`, selectedModelId);

// CHECKPOINT-6: Line 962-964
// Start trace
console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4] About to start trace with selectedModelId:`, selectedModelId);
console.log(`[API] [${requestId}] [DEBUG-CHECKPOINT-4] Provider:`, actualModelConfig?.provider || provider);
```

### Path Differences

| Aspect | Chat UI | Batch Testing |
|--------|---------|---------------|
| **Model Selection** | CHECKPOINT-2 (from conversation) | CHECKPOINT-1 (from request) OR CHECKPOINT-2 (from conversation) |
| **Conversation** | Existing (loaded) | New (pre-created) |
| **Messages** | Full history | Single prompt |
| **Streaming** | Yes (default) | No (forced) |
| **Tools** | Included | Not included |
| **Tracking** | None | `runId`, `benchmarkId` |

---

## Unified Components

Both flows use the **SAME downstream logic**:

1. **Model Resolution:** `modelManager.getModelConfig(selectedModelId)` (line 907)
   - Takes UUID
   - Returns model config with `model_id` field (HuggingFace repo ID)

2. **Provider Adapter:** Based on `actualModelConfig.provider`
   ```typescript
   // Line 68 in /lib/llm/adapters/huggingface-adapter.ts
   const modelId = config.model_id;  // Uses model_id field from database

   // Line 92, 106: Sends to HuggingFace API
   model: modelId  // "Qwen/Qwen2.5-3B-Instruct" (NOT the UUID)
   ```

3. **Trace Recording:** `traceService.startTrace()` with `selectedModelId` (UUID)

4. **Message Storage:** `messages` table with `model_id` = UUID

---

## Critical Finding: Model Name vs Model ID Confusion

### The Problem

The root cause of the batch testing failure was **Model Name being too similar to Model ID**:

- **Model ID (database field `model_id`)**: `"Qwen/Qwen2.5-3B-Instruct"`
  - This is the HuggingFace repository ID
  - Used in API calls to HuggingFace

- **Model Name (database field `name`)**: `"Qwen/Qwen2.5-3B-Instruct\tAgentic Model"`
  - This is the display name in UI
  - Should be distinctly different

### Historical Issue

At some point, the `model_id` field in the database contained:
```
"Qwen/Qwen2.5-3B-Instruct - Agentic Tetst"
```

This caused HuggingFace API to reject the request:
```
Error: The requested model 'Qwen/Qwen2.5-3B-Instruct - Agentic Tetst' does not exist
```

### Why It Worked in Chat UI But Not Batch Testing

**Hypothesis:** The code has different code paths or string handling that may have masked the issue in the chat UI, but batch testing exposed it more clearly.

**Both flows ultimately use the same `modelManager.getModelConfig()`**, so the issue should affect both equally. The fact that it didn't suggests:

1. **Timing difference:** Batch testing was created/used while the model_id had the corrupted value
2. **Caching:** Chat UI may have had cached model configs
3. **Error handling:** Chat UI may have had fallback logic that masked the error

---

## Answer to User's Question

> "I want to investigate if batch testing and and chats in the portal share a unified way to send prompts?"

**YES**, they share a unified way:

### ✅ Unified (Same Code Path)

1. **Same endpoint:** Both call `POST /api/chat`
2. **Same model resolution:** Both use `modelManager.getModelConfig(selectedModelId)`
3. **Same provider adapters:** Both use HuggingFaceAdapter, OpenAIAdapter, etc.
4. **Same trace recording:** Both use `traceService.startTrace()`
5. **Same message storage:** Both write to `messages` table
6. **Same API calls:** Both ultimately send `model: config.model_id` to HuggingFace

### ⚠️ Different (Parameters and Flow)

1. **Request body structure:**
   - Chat UI: `{ messages, tools, conversationId, modelId? }`
   - Batch: `{ messages: [single], modelId, widgetSessionId, forceNonStreaming, runId, benchmarkId }`

2. **Model selection priority:**
   - Chat UI: Conversation's model → Request's modelId → Legacy fallback
   - Batch: Request's modelId → Conversation's model → Legacy fallback

3. **Conversation handling:**
   - Chat UI: Loads existing conversation
   - Batch: Creates new conversation before calling API

4. **Message handling:**
   - Chat UI: Sends full conversation history
   - Batch: Sends single prompt per request

---

## Best Practices Identified

1. **Model Name MUST be distinctly different from Model ID**
   - ✅ Good: Name = "My Qwen Test Model", ID = "Qwen/Qwen2.5-3B-Instruct"
   - ❌ Bad: Name = "Qwen/Qwen2.5-3B-Instruct - Tests", ID = "Qwen/Qwen2.5-3B-Instruct"

2. **Model ID must ONLY contain HuggingFace repo ID**
   - ✅ Good: `"Qwen/Qwen2.5-3B-Instruct"`
   - ❌ Bad: `"Qwen/Qwen2.5-3B-Instruct - Agentic Tetst"`

3. **Both flows rely on clean database values**
   - No code-level protection against corrupted model_id values
   - Validation should happen at model creation/editing time

---

## Debugging Insights

The debug logging added to `/app/api/chat/route.ts` shows the model selection flow clearly:

```
[API] [req_xxx] [DEBUG-CHECKPOINT-1] selectedModelId set from request: <UUID>
[API] [req_xxx] [DEBUG-CHECKPOINT-4A] Calling getModelConfig with selectedModelId: <UUID>
[API] [req_xxx] [DEBUG-CHECKPOINT-4B] getModelConfig returned: {
  id: '<UUID>',
  name: 'Display Name',
  provider: 'huggingface',
  model_id: 'Qwen/Qwen2.5-3B-Instruct'
}
```

This confirms both flows converge at the same model resolution logic.
