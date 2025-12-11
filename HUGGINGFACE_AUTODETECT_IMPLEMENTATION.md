# HuggingFace Adapter Auto-Detection Implementation

## Summary
Implemented intelligent endpoint auto-detection in the HuggingFace adapter to automatically route custom fine-tuned models to the correct API endpoint.

## Problem
- HuggingFace has TWO different APIs:
  1. **Router API** (`https://router.huggingface.co/v1`) - For official models hosted by third-party providers
  2. **Inference API** (`https://api-inference.huggingface.co/models`) - For custom fine-tuned models on HF servers
  
- User's custom model `Canfield/llama-3-2-3b-instruct-new-atlas-dataset` was configured to use Router
- Router returned: "The requested model is not supported by any provider you have enabled"
- This is because custom models aren't hosted by third-party providers

## Solution
Added two new private methods to `HuggingFaceAdapter`:

### 1. `isCustomModel(modelId: string): boolean`
Detects if a model is custom/fine-tuned vs official:
- Checks if model organization is in a list of known official orgs
- Known orgs: `meta-llama`, `mistralai`, `HuggingFaceH4`, `google`, etc.
- Custom models have username prefixes (e.g., `Canfield/...`)

### 2. `getBaseUrl(modelId: string, configuredBaseUrl: string): string`
Automatically selects the correct endpoint:
- **Custom model + Router URL** → Switches to Inference API ✅
- **Official model + Router URL** → Keeps Router (works correctly)
- **Custom model + Inference API** → Keeps Inference API (already correct)
- **Official model + Inference API** → Keeps Inference API (works, but logs suggestion)

## Changes Made

### File: `lib/llm/adapters/huggingface-adapter.ts`

**Added Methods (Lines 40-86):**
```typescript
private isCustomModel(modelId: string): boolean
private getBaseUrl(modelId: string, configuredBaseUrl: string): string
```

**Modified `formatRequest()` Method (Line 109):**
- Now calls `getBaseUrl()` to auto-detect correct endpoint
- Adds detailed logging about model type and endpoint selection
- Logs show: Model Type (Custom/Official) and Endpoint Type (Router/Inference API)

## Test Results

✅ **Test 1: Custom model with Router (USER'S CASE)**
- Model: `Canfield/llama-3-2-3b-instruct-new-atlas-dataset`
- Configured: `https://router.huggingface.co/v1`
- Result: Auto-switched to `https://api-inference.huggingface.co/models`

✅ **Test 2: Official model with Router**
- Model: `meta-llama/Meta-Llama-3.1-8B-Instruct`
- Configured: `https://router.huggingface.co/v1`
- Result: Kept Router (correct)

✅ **Test 3: Custom model with Inference API**
- Model: `john-doe/my-model`
- Configured: `https://api-inference.huggingface.co/models`
- Result: Kept Inference API (correct)

✅ **Test 4: Official model with Inference API**
- Model: `mistralai/Mistral-7B-Instruct-v0.3`
- Configured: `https://api-inference.huggingface.co/models`
- Result: Kept Inference API (works, logged suggestion)

## Validation
- ✅ No breaking changes to interface
- ✅ Backward compatible with existing configurations
- ✅ Works with UnifiedLLMClient without modifications
- ✅ All test scenarios pass
- ✅ Logic tested with standalone Node.js scripts

## Impact
- **User's model will now work** without manual configuration changes
- Future custom models will automatically use correct endpoint
- Official models continue working as before
- No database migrations needed
- No UI changes required

## Logs Output Example
```
[HuggingFaceAdapter] Auto-detected custom model: Canfield/llama-3-2-3b-instruct-new-atlas-dataset
[HuggingFaceAdapter] Switching endpoint: https://router.huggingface.co/v1 → https://api-inference.huggingface.co/models
[HuggingFaceAdapter] Model Type: Custom/Fine-tuned
[HuggingFaceAdapter] Endpoint Type: Inference API
[HuggingFaceAdapter] Configured Base URL: https://router.huggingface.co/v1
[HuggingFaceAdapter] Active Base URL: https://api-inference.huggingface.co/models
```

## Next Steps for User
1. Restart the development server (if running)
2. Try chatting with the model again
3. Check server logs to confirm auto-detection is working
4. The "model_not_supported" error should be resolved

## Known Official Organizations
The following organizations are recognized as official (will use Router):
- meta-llama
- mistralai
- HuggingFaceH4
- google
- microsoft
- facebook
- openai-community
- bigscience
- EleutherAI
- stabilityai
- databricks
- Qwen
- gpt2 (special case)

All other organizations/usernames are treated as custom models (will use Inference API).
