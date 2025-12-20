# Streaming + Tool Calls Implementation Plan

## Problem Analysis

**Current Behavior:**

- Line 727: `if (tools.length > 0 || forceNonStreaming)` forces non-streaming mode when tools are present
- Result: Model calls tools but returns no text content → "No content was generated" error
- User sees nothing until all tools complete → poor UX

**Root Cause:**
OpenAI SDK supports streaming with tool calls, but our `streamOpenAIResponse` function (line 93-95) explicitly ignores tool call deltas and only yields text content.

## Solution: Implement True Streaming with Tool Calls

### Phase 1: Create Streaming Tool Call Handler

**New Function:** `streamOpenAIWithToolCalls()`

**Key Features:**

1. **Parse stream events** for both content and tool_calls
2. **Accumulate tool call deltas** across chunks (OpenAI streams tool calls incrementally)
3. **Execute tools in parallel** when tool_call_end detected
4. **Continue streaming** the model's response after tool results
5. **Yield text chunks** as they arrive

**Event Flow:**

```typescript
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  
  // Handle text content
  if (delta?.content) {
    yield { type: 'content', content: delta.content };
  }
  
  // Handle tool call deltas
  if (delta?.tool_calls) {
    // Accumulate: { id, name, arguments } built incrementally
    accumulateToolCallDelta(delta.tool_calls);
  }
  
  // Handle finish_reason
  if (chunk.choices[0]?.finish_reason === 'tool_calls') {
    // Execute all accumulated tools in parallel
    const results = await Promise.all(tools.map(executeToolHandler));
    
    // Send results back to model for next round
    // Continue streaming the model's new response
  }
}
```

### Phase 2: Update Chat API Route

**Changes to `/app/api/chat/route.ts`:**

1. **Remove the non-streaming fork** (line 727)
2. **Always use streaming** even with tools
3. **Handle stream events**:
   - `content` → stream to client
   - `tool_call` → execute and continue
   - `error` → send error event

**New Streaming Response Format:**

```typescript
// SSE events
data: {"type": "content", "content": "Let me check..."}
data: {"type": "tool_call_start", "tool": "web_search", "args": {...}}
data: {"type": "content", "content": "I found that..."}
data: {"type": "tool_call_end", "tool": "web_search", "result": {...}}
data: {"type": "content", "content": "the weather is 25°C"}
data: [DONE]
```

### Phase 3: Update Client to Handle Tool Events

**Changes to chat UI:**

- Display "Calling tool: web_search..." when tool_call_start received
- Show tool results in expandable section
- Continue streaming text normally

## Implementation Steps

### Step 1: Create `streamOpenAIWithToolCalls`

```typescript
export async function* streamOpenAIWithToolCalls(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools: ToolDefinition[],
  toolCallHandler: (name: string, args: Record<string, unknown>) => Promise<unknown>
): AsyncGenerator<StreamEvent, void, unknown> {
  // Implementation
}

type StreamEvent = 
  | { type: 'content'; content: string }
  | { type: 'tool_call_start'; tool: string; id: string; args: unknown }
  | { type: 'tool_call_end'; tool: string; id: string; result: unknown }
  | { type: 'error'; error: string };
```

### Step 2: Implement Tool Call Accumulation

OpenAI streams tool calls incrementally:

```typescript
// Chunk 1: { tool_calls: [{ index: 0, id: "call_123", function: { name: "web_search" } }] }
// Chunk 2: { tool_calls: [{ index: 0, function: { arguments: '{"qu' } }] }
// Chunk 3: { tool_calls: [{ index: 0, function: { arguments: 'ery": "' } }] }
// Chunk 4: { tool_calls: [{ index: 0, function: { arguments: 'Paris"}' } }] }

const toolCalls: Map<number, ToolCall> = new Map();

for (const toolCall of delta.tool_calls) {
  const existing = toolCalls.get(toolCall.index) || { id: '', name: '', arguments: '' };
  
  if (toolCall.id) existing.id = toolCall.id;
  if (toolCall.function?.name) existing.name = toolCall.function.name;
  if (toolCall.function?.arguments) existing.arguments += toolCall.function.arguments;
  
  toolCalls.set(toolCall.index, existing);
}
```

### Step 3: Handle finish_reason === 'tool_calls'

```typescript
if (chunk.choices[0]?.finish_reason === 'tool_calls') {
  // Execute all tools in parallel
  const toolPromises = Array.from(toolCalls.values()).map(async (call) => {
    const args = JSON.parse(call.arguments);
    yield { type: 'tool_call_start', tool: call.name, id: call.id, args };
    
    const result = await toolCallHandler(call.name, args);
    
    yield { type: 'tool_call_end', tool: call.name, id: call.id, result };
    
    return { role: 'tool', content: JSON.stringify(result), tool_call_id: call.id };
  });
  
  const toolResults = await Promise.all(toolPromises);
  
  // Add tool results to messages and continue conversation
  messages = [...messages, assistantMessage, ...toolResults];
  
  // Start new stream with updated messages
  const newStream = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });
  
  // Continue streaming from new response
  for await (const chunk of newStream) {
    // ...yield content...
  }
}
```

### Step 4: Update Chat API

```typescript
// Remove this:
// if (tools.length > 0 || forceNonStreaming) { ... }

// Replace with:
if (tools.length > 0) {
  // Use streaming with tool call support
  for await (const event of streamOpenAIWithToolCalls(...)) {
    if (event.type === 'content') {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: event.content })}\n\n`));
    } else if (event.type === 'tool_call_start') {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', ...event })}\n\n`));
    }
  }
} else {
  // Simple streaming without tools
  for await (const chunk of streamOpenAIResponse(...)) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`));
  }
}
```

## Benefits

1. **Better UX**: User sees "Checking weather..." immediately
2. **Progressive disclosure**: Text streams as it's generated
3. **Parallel tool execution**: Multiple tools run concurrently
4. **No "No content" errors**: Always has something to show
5. **Real-time feedback**: Tool status visible to user

## Risks & Mitigation

**Risk 1:** Increased complexity

- *Mitigation:* Thorough testing, clear documentation

**Risk 2:** OpenAI API rate limits

- *Mitigation:* Same as current (no change)

**Risk 3:** Tool execution failures

- *Mitigation:* Error events in stream, graceful degradation

## Testing Plan

1. **Simple streaming** (no tools) - should work as before
2. **Single tool call** - execute and continue streaming
3. **Multiple parallel tools** - all execute, results feed back
4. **Tool errors** - error event sent, stream continues
5. **Mixed content + tools** - interleaved correctly

## Timeline

- **Day 1**: Implement `streamOpenAIWithToolCalls`
- **Day 2**: Update chat API route
- **Day 3**: Test all scenarios
- **Day 4**: Deploy and monitor

## References

- OpenAI Streaming Guide: <https://platform.openai.com/docs/api-reference/streaming>
- OpenAI Function Calling: <https://platform.openai.com/docs/guides/function-calling>
- Current Implementation: `lib/llm/openai.ts` lines 69-104
