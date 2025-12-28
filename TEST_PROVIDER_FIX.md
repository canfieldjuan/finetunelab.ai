# Provider Attribution Fix - Testing Guide

## What We Fixed

**Problem:** Traces created with user-specific models (like Qwen HuggingFace) were incorrectly recorded with `provider='openai'` instead of the correct provider.

**Root Cause:** `getModelConfig()` fell back to ANON key when `supabaseAdmin` was null, RLS blocked access to user models, query returned null, trace used fallback `provider='openai'`.

**Fix:** Pass `supabaseAdmin` client explicitly to `getModelConfig()` to bypass RLS.

---

## Current State (Verified)

✅ **Qwen HuggingFace Model Found:**
- Model ID: `302ffdb4-d89f-4296-834d-eefb5cf2db14`
- Model Name: `Qwen/Qwen3-235B-A22B-Thinking-2507`
- Provider: `huggingface`
- is_global: `false` (user-specific)
- User ID: `38c85707-1fc5-40c6-84be-c017b3b8e750`

✅ **Backfilled Traces (from earlier session):**
- 2 existing traces now have correct `provider='huggingface'`
- Created: 2025-12-21 01:44 and 01:45

✅ **Current Provider Distribution:**
- openai: 63 traces
- anthropic: 9 traces
- huggingface: 2 traces

---

## Testing Instructions

### Test 1: Send a New Message with Qwen Model

1. **Start the dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Open the app** in your browser

3. **Select the Qwen HuggingFace model** from the model dropdown:
   - Look for: "Qwen/Qwen3-235B-A22B-Thinking-2507"

4. **Send a test message:**
   - Message: "Hello, please respond with a short greeting"
   - This should create a new trace

5. **Wait for response** to complete

### Test 2: Verify the New Trace

Run the verification script:

```bash
node verify-provider-fix.mjs
```

**Expected Output:**
- Should show 3 HuggingFace traces (2 old + 1 new)
- The new trace should have `model_provider='huggingface'` ✅
- Provider distribution should show:
  - openai: 63
  - anthropic: 9
  - huggingface: 3 ← **Should increase by 1**

### Test 3: Check Provider Comparison View

1. **Open Analytics Dashboard** in the app
2. **Scroll to "Performance & SLA Metrics"** section
3. **Find the "Provider Comparison" card**
4. **Verify HuggingFace appears** with:
   - Total calls: 3
   - Success rate: 100%
   - Average latency, cost, etc.

---

## Detailed Trace Inspection (Optional)

If you want to inspect the exact trace data:

```bash
node check-hf-traces.mjs
```

This will show:
- All HuggingFace traces with full details
- Verify new trace has correct provider from creation (not backfilled)

---

## Success Criteria

✅ **Test Passes If:**
1. New trace is created with `model_provider='huggingface'` immediately
2. No fallback to 'openai' occurs
3. Provider comparison view shows HuggingFace with updated count
4. Console logs show: `[API] Model config loaded - actual provider: huggingface`

❌ **Test Fails If:**
1. New trace has `model_provider='openai'`
2. Console logs show: `Model not found` or `actualModelConfig` is null
3. Provider comparison doesn't show HuggingFace or count doesn't increase

---

## Debugging Failed Test

If the test fails, check the server logs for:

```
[API] Model config loaded - actual provider: huggingface
```

If you see:
```
[ModelManager] Model not found: 302ffdb4-d89f-4296-834d-eefb5cf2db14
```

This means `supabaseAdmin` is still null. Check:
1. `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
2. Server was restarted after environment variable changes
3. Check `check-service-key.ts` to verify service key is loaded

---

## Alternative Test: Use API Directly

If you don't want to use the UI, you can test via API:

```bash
# Get session token first (from browser dev tools → Application → Cookies → sb-access-token)
export SESSION_TOKEN="your-session-token-here"

# Send test message
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "useUnifiedClient": true,
    "selectedModelId": "302ffdb4-d89f-4296-834d-eefb5cf2db14"
  }'
```

Then run verification script to check the trace.

---

## What the Fix Changed

**Files Modified:**
1. `lib/models/model-manager.service.ts:292`
   - Added `client?: SupabaseClient` parameter
   - Uses provided client instead of module-level `supabaseAdmin`

2. `app/api/chat/route.ts` (3 locations)
   - Line 900: Pass `supabaseAdmin` to `getModelConfig()`
   - Line 996: Pass `supabaseAdmin` to `getModelConfig()`
   - Line 1086: Pass `supabaseAdmin` to `getModelConfig()`

**Commit:**
```
80edac3 - fix: pass supabase admin client to getModelConfig to prevent provider misattribution
```
