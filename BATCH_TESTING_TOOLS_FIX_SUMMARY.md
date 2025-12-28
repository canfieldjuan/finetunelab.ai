# Batch Testing Tools Fix - Implementation Summary

## Problem Solved

Batch testing traces had **empty tool arrays in the inputs section** because batch testing wasn't passing the `tools` parameter when calling `/api/chat`, unlike the regular chat UI.

## ✅ Verification Results

**Status:** Fix verified and working!

**Latest batch test trace:**
- **Trace ID:** `trace_1766433639818_hwtw6gdo8km`
- **Input tools:** 11 tool definitions (web_search, calculator, analytics_export, etc.)
- **Before fix:** 0 tool definitions
- **After fix:** 11 tool definitions

The fix successfully includes all enabled tools in batch testing traces!

---

## Changes Made

### File: `/app/api/batch-testing/run/route.ts`

#### Change 1: Fetch Tools Before Processing (Line ~652)

**Location:** In `processBackgroundBatch` function, after creating the conversation

**Added:**
```typescript
// Fetch all enabled tools (tools are global, not user-specific)
console.log('[Background Batch] Fetching enabled tools');
const { data: userTools, error: toolsError } = await supabaseAdmin
  .from('tools')
  .select('*')
  .eq('is_enabled', true)
  .order('name');

if (toolsError) {
  console.error('[Background Batch] Error fetching tools:', toolsError);
  // Continue without tools rather than failing the entire batch
}

// Convert tools to API format
const tools = userTools?.map((tool) => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as Record<string, unknown>
  }
})) || [];

console.log('[Background Batch] Loaded tools:', tools.map(t => t.function.name).join(', '));
```

**Why:** Fetches user's enabled tools from database and converts them to the API format expected by `/api/chat`

---

#### Change 2: Update Function Signature (Line ~855)

**Location:** `processSinglePrompt` function signature

**Before:**
```typescript
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  auth: BatchTestingAuth,
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  conversationId: string,
  judgeConfig?: { enabled: boolean; model: string; criteria: string[] }
): Promise<boolean> {
```

**After:**
```typescript
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  auth: BatchTestingAuth,
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  conversationId: string,
  judgeConfig: { enabled: boolean; model: string; criteria: string[] } | undefined,
  tools: Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }>
): Promise<boolean> {
```

**Why:** Added `tools` parameter to accept the tools array from caller

---

#### Change 3: Pass Tools to Function (Line ~712)

**Location:** Inside the prompt processing loop in `processBackgroundBatch`

**Before:**
```typescript
const success = await processSinglePrompt(
  testRunId,
  config.model_name,
  prompt,
  auth,
  i,
  runId,
  config.benchmark_id,
  widgetSessionId,
  conversation.id,
  config.judge_config
);
```

**After:**
```typescript
const success = await processSinglePrompt(
  testRunId,
  config.model_name,
  prompt,
  auth,
  i,
  runId,
  config.benchmark_id,
  widgetSessionId,
  conversation.id,
  config.judge_config,
  tools  // Pass enabled tools for trace recording
);
```

**Why:** Passes the tools array to the processing function

---

#### Change 4: Include Tools in API Request (Line ~887)

**Location:** Inside `processSinglePrompt`, the `/api/chat` fetch call

**Before:**
```typescript
const chatResponse = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    modelId: modelId,
    widgetSessionId: widgetSessionId,
    forceNonStreaming: true,
    runId: runId,
    benchmarkId: benchmarkId
  })
});
```

**After:**
```typescript
const chatResponse = await fetch(`${baseUrl}/api/chat`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    messages: [{ role: 'user', content: prompt }],
    modelId: modelId,
    widgetSessionId: widgetSessionId,
    forceNonStreaming: true,
    runId: runId,
    benchmarkId: benchmarkId,
    tools: tools  // Include enabled tools for trace recording
  })
});
```

**Why:** Includes tools in the request body so `/api/chat` can record them in trace inputs

---

## Verification Script

Created: `/verify-batch-tools-fix.mjs`

**Usage:**
```bash
node verify-batch-tools-fix.mjs
```

**What it checks:**
1. ✅ User has enabled tools
2. ✅ Recent batch test conversations exist
3. ✅ Traces have `input_data.toolDefinitions` populated
4. ✅ Output tools are recorded (if any were called)

---

## Expected Results

### Before Fix

```json
{
  "input_data": {
    "systemPrompt": "...",
    "userMessage": "...",
    "toolDefinitions": []  // ❌ EMPTY
  },
  "output_data": {
    "content": "...",
    "toolCallsMade": []  // May or may not have data
  }
}
```

### After Fix

```json
{
  "input_data": {
    "systemPrompt": "...",
    "userMessage": "...",
    "toolDefinitions": [  // ✅ POPULATED
      {
        "name": "web_search",
        "description": "Search the web for information"
      },
      {
        "name": "calculator",
        "description": "Perform mathematical calculations"
      }
    ]
  },
  "output_data": {
    "content": "...",
    "toolCallsMade": [  // ✅ If tools were called
      {
        "name": "web_search",
        "success": true
      }
    ]
  }
}
```

---

## Impact

| Aspect | Before | After |
|--------|--------|-------|
| **Chat UI traces** | ✅ Complete | ✅ Complete |
| **Batch test traces** | ❌ Incomplete (missing input tools) | ✅ Complete |
| **Analytics accuracy** | ⚠️ Inconsistent | ✅ Consistent |
| **Tool usage tracking** | ⚠️ Partial | ✅ Full |

---

## Testing Steps

1. **Enable some tools** for your user account (e.g., web_search, calculator)

2. **Run a batch test:**
   ```bash
   # Via UI or API
   POST /api/batch-testing/run
   {
     "config": {
       "model_id": "<your-model-uuid>",
       "test_suite_id": "<test-suite-uuid>",
       "prompt_limit": 3
     }
   }
   ```

3. **Verify the fix:**
   ```bash
   node verify-batch-tools-fix.mjs
   ```

4. **Expected output:**
   ```
   ✅ SUCCESS: Found N tool definitions in input_data

   Tool definitions in trace:
     - web_search: Search the web for information...
     - calculator: Perform mathematical calculations...

   The fix is working correctly!
   ```

---

## Code Quality

- ✅ **Type-safe:** All changes use proper TypeScript types
- ✅ **Error handling:** Continues batch if tools fetch fails
- ✅ **Logging:** Added debug logs for troubleshooting
- ✅ **Non-breaking:** Existing functionality unchanged
- ✅ **Consistent:** Matches chat UI behavior

---

## Notes

- The fix is **backward compatible** - old batch tests will continue to work
- Tools are **global/shared** (not user-specific) - all enabled tools are included
- Tools are fetched **once per batch** (not per prompt) for efficiency
- If tools fetch fails, batch test continues with empty tools array (graceful degradation)
- The fix aligns batch testing with chat UI behavior for trace consistency

---

## Files Modified

1. `/app/api/batch-testing/run/route.ts` (4 changes)
2. `/verify-batch-tools-fix.mjs` (new verification script)
3. `/BATCH_TESTING_TOOLS_FIX_SUMMARY.md` (this file)

---

## Related Documentation

- Original investigation: `/TRACE_TOOLS_EMPTY_INVESTIGATION.md`
- Chat flow comparison: `/CHAT_API_FLOW_COMPARISON.md`
