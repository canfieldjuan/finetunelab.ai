# Root Cause Analysis: Batch Test Trace Model Mismatch

## Executive Summary

**Issue**: One specific batch test (at 06:01:52 UTC on 2025-12-22) recorded traces with the WRONG model ID, while all other batch tests worked correctly.

**Impact**:
- Batch test configured for GPT-5 Mini (model ID: `d700335c-50ed-4f6a-9257-2ec5075c4819`)
- Traces incorrectly recorded Qwen model ID (`3d086d4a-f0d3-41dd-88e7-cd24bffaa760`)
- Provider was CORRECT (`openai`), only the model_name was wrong
- API calls succeeded (both traces show `status: completed`)

**Root Cause**: **NOT YET IDENTIFIED** - This requires further investigation of the chat API code execution flow.

---

## Investigation Findings

### 1. Timeline Analysis

```
04:06-04:15 UTC - Multiple batch tests with various models - ALL CORRECT ✓
05:13 UTC       - Batch test with GPT-5 Mini - CORRECT ✓
06:01 UTC       - Batch test with GPT-5 Mini - BROKEN ❌ (traces show Qwen ID)
06:14-06:25 UTC - Batch tests with Qwen model - ALL CORRECT ✓
07:05 UTC       - Qwen model updated via fix-model-id.mjs
```

**Key Finding**: Only ONE batch test out of 10 recent tests has this issue. The issue is NOT systematic.

### 2. Data Verification

**Batch Test Configuration** (`batch_test_runs` table):
```json
{
  "model_name": "d700335c-50ed-4f6a-9257-2ec5075c4819",  // GPT-5 Mini ✓
  "delay_ms": 1,
  "concurrency": 1,
  "prompt_limit": 25
}
```

**Conversation Record**:
```
conversation_id: 97d38df4-8078-481c-b475-9659dbfcc3c1
llm_model_id: d700335c-50ed-4f6a-9257-2ec5075c4819  // GPT-5 Mini ✓
```

**Traces** (2 total):
```
model_name: 3d086d4a-f0d3-41dd-88e7-cd24bffaa760  // Qwen ❌
model_provider: openai  // CORRECT ✓
status: completed  // Both succeeded ✓
```

**Messages Metadata**:
```json
{
  "model_id": "3d086d4a-f0d3-41dd-88e7-cd24bffaa760",  // Qwen ❌
  "model_name": "3d086d4a-f0d3-41dd-88e7-cd24bffaa760",  // Qwen ❌
  "provider": "openai"  // CORRECT ✓
}
```

### 3. Code Flow Analysis

**Batch Testing → Chat API Flow**:

1. **Batch testing sends request** (`/app/api/batch-testing/run/route.ts:864`):
   ```typescript
   modelId: modelId,  // d700335c-... (GPT-5 Mini)
   ```

2. **Chat API receives request** (`/app/api/chat/route.ts:125`):
   ```typescript
   modelId,  // Should be d700335c-...
   ```

3. **Model selection logic** (`/app/api/chat/route.ts:596-600`):
   ```typescript
   if (modelId) {
     selectedModelId = modelId;  // Should set to d700335c-...
   }
   ```

4. **Trace started** (`/app/api/chat/route.ts:947-955`):
   ```typescript
   traceContext = await traceService.startTrace({
     modelName: selectedModelId,  // WRONG VALUE: 3d086d4a-...
     modelProvider: actualModelConfig?.provider || provider,  // CORRECT: 'openai'
   });
   ```

5. **Message metadata set** (`/app/api/chat/route.ts:904-907`):
   ```typescript
   messageMetadata = {
     model_id: selectedModelId,  // WRONG VALUE: 3d086d4a-...
     provider: actualModelConfig?.provider || provider,  // CORRECT: 'openai'
   };
   ```

### 4. Key Observations

**What's Correct**:
- ✓ Batch test configuration has correct model ID
- ✓ Conversation record has correct llm_model_id
- ✓ Provider is correct in traces and messages (`openai`)
- ✓ API calls succeeded (traces show `completed`)
- ✓ The 05:13 batch test with THE SAME MODEL worked correctly

**What's Wrong**:
- ❌ Traces have wrong `model_name` (Qwen instead of GPT-5 Mini)
- ❌ Message metadata has wrong `model_id` (Qwen instead of GPT-5 Mini)
- ❌ Only affects THIS specific batch test at 06:01

**Critical Contradiction**:
- The `provider` field is `openai` (correct for GPT-5 Mini)
- But the `model_name` is the Qwen model ID (HuggingFace model)
- This means `actualModelConfig` was fetched correctly, but `selectedModelId` was wrong

### 5. Possible Explanations

**Hypothesis 1: `selectedModelId` was reassigned after model selection**
- Need to check if there's code between line 600 and line 950 that modifies `selectedModelId`
- Could be widget session logic, conversation lookup, or fallback logic

**Hypothesis 2: Request body `modelId` was already wrong**
- Batch testing might have passed the wrong value
- But this contradicts the batch test configuration which shows the correct model

**Hypothesis 3: Caching or session state**
- Widget session might be caching a previous model ID
- But the widget session only has ONE conversation

**Hypothesis 4: Race condition or async issue**
- Multiple batch requests running concurrently
- Shared state being modified

**Hypothesis 5: Database trigger or hook**
- A database trigger might be changing the model_name
- Unlikely since other batch tests work fine

---

## What Did NOT Cause the Issue

1. **✗ My fix-model-id.mjs script**: Qwen model was updated at 07:05, AFTER the broken batch test at 06:01

2. **✗ Model configuration**: The Qwen model's model_id field was correct at the time of the batch test

3. **✗ Batch testing code**: The batch test correctly passed `modelId: d700335c-...` to the chat API

4. **✗ Model manager**: No evidence of wrong model config being returned

5. **✗ Unified LLM client**: Doesn't modify the model ID, just uses what's passed

---

## Next Steps for Investigation

### Priority 1: Find where `selectedModelId` changes

1. Add comprehensive logging to the chat API:
   ```typescript
   console.log('[DEBUG] selectedModelId after model selection:', selectedModelId);
   console.log('[DEBUG] selectedModelId before trace start:', selectedModelId);
   ```

2. Check all code between line 600 and line 950 for ANY assignments to `selectedModelId`

3. Search for closures or callbacks that might modify `selectedModelId`

### Priority 2: Check for shared state or caching

1. Look for global variables or module-level caching
2. Check if Next.js has request-level state that could interfere
3. Verify no singleton patterns are caching model IDs

### Priority 3: Reproduce the issue

1. Run a batch test with GPT-5 Mini
2. Monitor the logs carefully
3. Try to identify what's different between the 05:13 (working) and 06:01 (broken) tests

---

## User's Concern

> "ive been batch fucken testing models for fucken weeks and suddenly its broken"

**Response**:
- The issue affected ONLY ONE batch test out of many
- The same model worked correctly in a batch test just 48 minutes earlier (05:13)
- This is NOT a systematic failure but an isolated incident
- The root cause requires deeper investigation of the chat API execution flow
- I apologize for initially applying a superficial fix instead of finding the root cause first

---

## Technical Details

### Model IDs
- **GPT-5 Mini**: `d700335c-50ed-4f6a-9257-2ec5075c4819` (provider: openai)
- **Qwen**: `3d086d4a-f0d3-41dd-88e7-cd24bffaa760` (provider: huggingface)

### Affected Records
- **Batch Test Run**: `a97019bf-63c5-4a58-99ac-c7d47656cc45`
- **Conversation**: `97d38df4-8078-481c-b475-9659dbfcc3c1`
- **Traces**: 2 total (both completed successfully)
- **Widget Session**: `batch_test_a97019bf-63c5-4a58-99ac-c7d47656cc45`

### Code Locations
- Batch testing: `/app/api/batch-testing/run/route.ts`
- Chat API: `/app/api/chat/route.ts`
- Trace service: `/lib/tracing/trace.service.ts`
- Model manager: `/lib/models/model-manager.service.ts`
- Unified LLM client: `/lib/llm/unified-client.ts`

---

**Status**: Investigation incomplete - root cause not yet identified
**Date**: 2025-12-22
**Investigator**: Claude Code
