# Tools Loading Diagnostic

## Issue
Trace cards show empty `toolDefinitions` and empty `conversationHistory` in input data after context injection fix.

## Investigation Steps

### 1. Check Browser Console

Open browser DevTools Console (F12) and look for:

```
[Chat] Loaded tools, count: <number>
```

**Expected:** Count should be 11 (number of enabled tools)
**If 0:** Tools failed to load - check for errors above this log

### 2. Check Network Tab

1. Open DevTools Network tab
2. Send a chat message
3. Find the request to `/api/chat`
4. Check the Request Payload
5. Look for `tools` array in the payload

**Expected:** `tools: [{type: "function", function: {name: "web_search", ...}}, ...]`
**If empty array:** Tools are not being passed from client to server

### 3. Check Tools Table

Run this to verify tools exist in database:
```bash
node check-tools-schema.mjs
```

### 4. Check Chat Component State

Add this temporary logging to `/components/Chat.tsx` line 598:
```typescript
setTools(apiTools);
console.log('[Chat DEBUG] Tools set in state:', apiTools.length, apiTools.map(t => t.function.name));
log.debug('Chat', 'Loaded tools', { count: apiTools.length });
```

### 5. Check if Tools are Passed to useChat

Add logging in `/components/Chat.tsx` where useChat is called (around line 291):
```typescript
console.log('[Chat DEBUG] Passing tools to useChat:', tools.length);
```

## Possible Causes

### Cause 1: Tools Not Loading from Database
- `getEnabledTools()` returning error or empty array
- Check browser console for error logs
- Verify database connection

### Cause 2: Race Condition
- Chat message sent before tools finish loading
- Tools state is empty `[]` when message is sent
- useEffect hasn't completed yet

### Cause 3: Tools Not Passed in Request
- Chat component has tools but doesn't pass them to API
- Check `useChatActions` hook parameters
- Verify `modifiedTools` is being created correctly

### Cause 4: Context Injection Side Effect
- Something in context injection changes is affecting the flow
- Check if `contextInjectionEnabled` value is causing issues
- Verify no unintended side effects from our changes

## Quick Fix to Test

If it's a race condition, the tools might load after the first message. Try:

1. Reload the page
2. Wait 2-3 seconds
3. Send a message
4. Check if tools appear in that trace

If tools appear after waiting, it's a race condition and we need to:
- Add loading state for tools
- Prevent sending messages until tools are loaded
- Or handle gracefully if tools aren't loaded yet

## Files to Check

1. `/components/Chat.tsx` - Where tools are loaded and passed
2. `/components/hooks/useChat Actions.ts` - Where tools are used in requests
3. `/lib/tools/toolManager.ts` - Where `getEnabledTools()` is defined
4. `/app/api/chat/route.ts` - Where tools are received and used

## Recent Changes That Could Affect This

We modified:
1. `/components/hooks/useContextInjection.ts` - ❓ Unlikely to affect tools
2. `/app/api/user/context-preference/route.ts` - ❓ Unlikely to affect tools
3. `/app/api/batch-testing/run/route.ts` - ✅ This shouldn't affect regular chat

**None of these should affect tools loading in regular chat!**

## Next Steps

1. Check browser console for tool loading logs
2. Check network request payload for tools array
3. Report back with findings
4. We'll identify the root cause based on what's missing
