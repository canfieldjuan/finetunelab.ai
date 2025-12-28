# Trace Tools Empty - Root Cause Analysis

## Problem Statement

Traces from batch testing show **empty message and tool arrays in the inputs section**. Expected behavior:
- **Input section**: Should contain the tools that were available/loaded for the LLM
- **Output section**: Should contain the tools that were actually used/called by the LLM

## Root Cause

**Batch testing does NOT pass the `tools` parameter when calling `/api/chat`**, while the regular chat UI does.

### Evidence

**1. Chat UI Request** (`/components/hooks/useChatActions.ts:304-312`)
```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: conversationMessages,
    tools: modifiedTools,              // ✅ TOOLS INCLUDED
    conversationId: activeId,
    modelId: selectedModelId === '__default__' ? null : selectedModelId
  }),
  signal: controller.signal
});
```

**2. Batch Testing Request** (`/app/api/batch-testing/run/route.ts:859-869`)
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
    // ❌ NO TOOLS PARAMETER
  })
});
```

## How Traces Record Tool Data

### Input Data Flow

**Step 1:** `/api/chat/route.ts:163` - Parse tools from request body
```typescript
let tools = Array.isArray(rawTools) ? rawTools.filter(isToolDefinition) : [];
```

**Step 2:** `/api/chat/route.ts:175` - Store for trace logging
```typescript
const toolsForTrace = tools;  // Empty array if not passed in request
```

**Step 3:** `/api/chat/route.ts:1267-1279` - Pass to trace completion
```typescript
await completeTraceWithFullData({
  traceContext,
  finalResponse,
  enhancedMessages,
  tokenUsage: tokenUsage ?? undefined,
  selectedModelId,
  temperature,
  maxTokens,
  tools: toolsForTrace,  // ❌ EMPTY for batch testing
  toolsCalled: toolsCalled ?? undefined,
  reasoning,
  latencyMs: latency_ms,
});
```

**Step 4:** `/app/api/chat/trace-completion-helper.ts:82-85` - Record in trace
```typescript
const llmInputData = {
  systemPrompt: systemPrompt ? truncateString(String(systemPrompt), 5000) : undefined,
  userMessage: lastUserMessage ? truncateString(String(lastUserMessage), 5000) : undefined,
  conversationHistory: enhancedMessages
    .filter(m => m.role !== 'system')
    .slice(0, -1)
    .slice(-5)
    .map(m => ({
      role: m.role,
      content: truncateString(String(m.content || ''), 500),
    })),
  parameters: {
    temperature,
    maxTokens,
  },
  toolDefinitions: tools?.map(t => ({  // ❌ EMPTY array for batch testing
    name: t.function.name,
    description: t.function.description,
  })),
};
```

**Step 5:** `/app/api/chat/trace-completion-helper.ts:132` - Store in database
```typescript
await traceService.endTrace(traceContext, {
  endTime: new Date(),
  status: 'completed',
  inputTokens: tokenUsage?.input_tokens,
  outputTokens: tokenUsage?.output_tokens,
  cacheCreationInputTokens: tokenUsage?.cache_creation_input_tokens,
  cacheReadInputTokens: tokenUsage?.cache_read_input_tokens,
  costUsd,
  tokensPerSecond,
  ttftMs,
  inputData: llmInputData,  // Contains empty toolDefinitions
  outputData: llmOutputData,
});
```

### Output Data Flow

**Tools called ARE being captured** from the LLM response:

**Step 1:** `/api/chat/route.ts:1146` - Extract from LLM response
```typescript
toolsCalled = (llmResponse as { toolsCalled?: Array<{name: string; success: boolean; error?: string}> }).toolsCalled || null;
```

**Step 2:** `/app/api/chat/trace-completion-helper.ts:95-98` - Record in output
```typescript
const llmOutputData = {
  content: truncateString(finalResponse, 10000),
  reasoning: reasoning ? truncateString(reasoning, 10000) : undefined,
  stopReason: 'stop',
  toolCallsMade: toolsCalled?.map(t => ({  // ✅ Works if LLM calls tools
    name: t.name,
    success: t.success,
  })),
};
```

## Why This Matters

### Current State
- **Chat UI traces**: Have full tool information (inputs show available tools, outputs show called tools)
- **Batch testing traces**: Have NO tool input information (can't see what tools were available)
  - If tools are called, output MAY show them (depends on LLM response)
  - But input toolDefinitions is always empty

### Impact
1. **Incomplete trace data**: Can't analyze what tools were available for batch tests
2. **Inconsistent analytics**: Batch tests vs chat UI have different trace schemas
3. **Missing context**: Can't distinguish between "no tools available" vs "tools available but not used"

## Solution

Batch testing needs to fetch and pass available tools when calling `/api/chat`.

### Required Changes

**File:** `/app/api/batch-testing/run/route.ts`

**Option 1: Fetch default tools for user**
```typescript
// Around line 688 (before calling processSinglePrompt)
// Fetch user's tools once before processing prompts
const { data: userTools } = await supabaseAdmin
  .from('tools')
  .select('*')
  .eq('user_id', auth.userId)
  .eq('enabled', true);

const formattedTools = userTools?.map(tool => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }
})) || [];

// Pass tools to processSinglePrompt
await processSinglePrompt(
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
  formattedTools  // NEW PARAMETER
);
```

**Then in processSinglePrompt (around line 862-869):**
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
    tools: tools  // NEW: Include tools in request
  })
});
```

**Option 2: Make batch config accept tools**
```typescript
// Add to BatchTestConfig interface
interface BatchTestConfig {
  model_name: string;
  prompt_limit: number;
  concurrency: number;
  delay_ms: number;
  source_path?: string;
  benchmark_id?: string;
  judge_config?: JudgeConfig;
  tools?: ToolDefinition[];  // NEW
}

// Allow tools to be passed in request body
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,
  prompt_limit: config.prompt_limit || parseInt(process.env.BATCH_TESTING_DEFAULT_PROMPT_LIMIT || '25', 10),
  concurrency: config.concurrency || parseInt(process.env.BATCH_TESTING_DEFAULT_CONCURRENCY || '3', 10),
  delay_ms: config.delay_ms || parseInt(process.env.BATCH_TESTING_DEFAULT_DELAY_MS || '1000', 10),
  source_path: config.source_path,
  benchmark_id: config.benchmark_id,
  judge_config: config.judge_config,
  tools: config.tools  // NEW: Accept tools from caller
};
```

## Verification Steps

After implementing the fix:

1. **Run a batch test** with tools enabled for the user
2. **Check the trace in database:**
   ```sql
   SELECT
     trace_id,
     input_data->'toolDefinitions' as input_tools,
     output_data->'toolCallsMade' as output_tools
   FROM llm_traces
   WHERE conversation_id = '<batch_test_conversation_id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. **Expected result:**
   - `input_tools`: Should be an array of tool definitions (not empty)
   - `output_tools`: Should show tools called (if any were called)

4. **Compare with chat UI trace:**
   ```sql
   SELECT
     trace_id,
     input_data->'toolDefinitions' as input_tools,
     output_data->'toolCallsMade' as output_tools
   FROM llm_traces
   WHERE conversation_id = '<regular_chat_conversation_id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - Both should have the same structure now

## Summary

| Aspect | Current State | After Fix |
|--------|---------------|-----------|
| **Chat UI - Input Tools** | ✅ Shows available tools | ✅ Shows available tools |
| **Chat UI - Output Tools** | ✅ Shows called tools | ✅ Shows called tools |
| **Batch Testing - Input Tools** | ❌ Empty array | ✅ Shows available tools |
| **Batch Testing - Output Tools** | ⚠️ Sometimes works | ✅ Shows called tools |

**Priority:** Medium-High - Affects trace data completeness and analytics accuracy

**Effort:** Small - Single file change, ~20 lines of code

**Risk:** Low - Only affects trace recording, doesn't change batch testing functionality
