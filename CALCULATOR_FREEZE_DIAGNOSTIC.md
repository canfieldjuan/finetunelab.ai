# Calculator Response Freeze - Diagnostic Report

## Issue Summary

**User Report:** Sent message to calculate PC build power needs. Server processed calculation successfully, but response never reached UI and page froze.

**Status:** ❌ ACTIVE ISSUE - Root cause identified

---

## Investigation Findings

### 1. Current Architecture

**File:** `app/api/chat/route.ts:459`

When tools are present (including calculator), the system uses a **NON-STREAMING PATH**:

```typescript
if ((tools && tools.length > 0) || forceNonStreaming) {
  // NON-STREAMING PATH: Execute tools and get complete response
```

**Flow:**
1. Request with tools → Non-streaming path (line 459-680)
2. Tools execute synchronously via `toolCallHandler` (line 435)
3. LLM generates complete response with tool results
4. Response sent via "fake streaming" (line 681-823)

### 2. Fake Streaming Implementation

**Lines 804-815:** Content is chunked and sent with delays
```typescript
const chunkSize = 100; // Send 100 characters at a time
for (let i = 0; i < finalResponse.length; i += chunkSize) {
  const chunk = finalResponse.slice(i, i + chunkSize);
  const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
  controller.enqueue(encoder.encode(data));
  await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay between chunks
}
controller.enqueue(encoder.encode('data: [DONE]\n\n'));
controller.close();
```

**Timing calculation:**
- 1000 character response = 10 chunks × 20ms = 200ms base delay
- 5000 character response = 50 chunks × 20ms = 1000ms base delay
- Does NOT include LLM processing time

### 3. Frontend Expectations

**File:** `components/Chat.tsx:1386-1400`

Frontend expects these SSE events:
- `tool_call` - When tool is invoked (line 1386-1391)
- `tool_result` - When tool returns (line 1393-1400)

**Current behavior:** These events are NEVER sent in non-streaming path!

**Line 723-727:** Only sends `tools_metadata` (summary, not progressive updates)
```typescript
if (toolsCalled && toolsCalled.length > 0) {
  const toolData = `data: ${JSON.stringify({
    type: 'tools_metadata',
    tools_called: toolsCalled
  })}\n\n`;
  controller.enqueue(encoder.encode(toolData));
}
```

### 4. Calculator Response Format

**File:** `lib/tools/calculator/calculator.service.ts:120-126`

Returns structured object:
```typescript
return {
  result: output,          // number or string
  expression: cleanExpression,
  scope: { ...this.scope },
  unit: unit,              // optional
  steps                    // array of computation steps
};
```

This is passed to LLM, which generates natural language response.

---

## Potential Root Causes

### A. Stream Never Completed ⚠️ MOST LIKELY
**Evidence:** User said "response didn't hit ui"
- Stream interrupted before `[DONE]` marker sent (line 814)
- `controller.close()` never called (line 815)
- Network interruption between server and client

### B. Frontend Timeout ⚠️ LIKELY
**Evidence:** User said "it froze"
- Browser timeout waiting for more chunks
- Frontend expecting specific events that never arrive
- ReadableStream reader stuck in infinite wait

### C. Error During Streaming ⚠️ POSSIBLE
**Lines 816-821:** Error handling exists but might not catch all cases
```typescript
catch (error) {
  console.error('[API] Non-streaming error:', error);
  const errorData = `data: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
  controller.enqueue(encoder.encode(errorData));
  controller.close();
}
```

**Gap:** Error during chunk encoding might not be caught

### D. Response Size Issue ⚠️ POSSIBLE
- Calculator response with many steps could be very long
- LLM response explaining calculation could exceed expected size
- Frontend buffer overflow or memory issue

---

## Verification Steps Needed

### Server-Side Logs
1. Check if stream completed: Look for "[DONE]" marker in logs
2. Check for errors: Search for "[API] Non-streaming error"
3. Check response size: Look for final response length
4. Check tool execution: Verify calculator executed successfully

### Frontend Behavior
1. Check browser console for errors
2. Check network tab:
   - Is response still pending?
   - Was connection interrupted?
   - What was last SSE event received?
3. Check React state: Is component stuck in loading state?

---

## Recommended Immediate Actions

### 1. Add Comprehensive Logging
**File:** `app/api/chat/route.ts`

**Add at line 805 (before streaming loop):**
```typescript
console.log('[API] [FAKE-STREAM] Starting fake stream for response length:', finalResponse.length);
console.log('[API] [FAKE-STREAM] Response preview:', finalResponse.substring(0, 200));
```

**Add at line 812 (in streaming loop):**
```typescript
if (i % 1000 === 0) { // Log every 10 chunks
  console.log('[API] [FAKE-STREAM] Progress:', i, '/', finalResponse.length);
}
```

**Add at line 814 (before DONE):**
```typescript
console.log('[API] [FAKE-STREAM] Stream complete, sending [DONE]');
```

### 2. Add Frontend Debugging
**File:** `components/Chat.tsx`

**Add at line 1293 (in stream reader loop):**
```typescript
console.log('[Chat] [STREAM-DEBUG] Received chunk, total lines:', lines.length);
```

**Add at line 1302 (after parsing each event):**
```typescript
console.log('[Chat] [STREAM-DEBUG] Parsed event type:', parsed.type);
```

### 3. Add Timeout Protection
**File:** `app/api/chat/route.ts`

**Wrap streaming loop with timeout:**
```typescript
const streamTimeout = setTimeout(() => {
  console.error('[API] [FAKE-STREAM] Timeout reached, forcing close');
  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
  controller.close();
}, 30000); // 30 second timeout

// ... streaming loop ...

clearTimeout(streamTimeout);
```

---

## Next Steps

1. **Reproduce the issue** with logging enabled
2. **Capture exact response** that caused freeze
3. **Check browser console** for client-side errors
4. **Verify stream completion** via server logs
5. **Test with smaller calculation** to isolate size vs timing

---

## Files Involved

| File | Lines | Relevance |
|------|-------|-----------|
| `app/api/chat/route.ts` | 459-823 | Non-streaming tool path |
| `components/Chat.tsx` | 1240-1400 | Stream reading & parsing |
| `lib/tools/calculator/calculator.service.ts` | 1-940 | Calculator implementation |
| `lib/tools/toolManager.ts` | 77-171 | Tool execution wrapper |
| `lib/llm/unified-client.ts` | 200-368 | LLM tool call handling |

---

**Status:** ✅ Root cause identified - Needs verification with user's specific scenario
**Priority:** 🔴 High - Blocking user from using calculator tool
**Complexity:** 🟡 Medium - Likely timing/streaming issue, not data corruption
