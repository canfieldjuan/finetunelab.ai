# Context Injection Toggle Fix

**Date:** 2025-12-03
**Issue:** Context injection toggle turns back on after sending a message
**Status:** Analysis Complete - Ready for Implementation

---

## Problem Description

User reports that the context injection toggle on the chat page turns back on after sending a message, even though they toggled it off.

### Current Behavior:
1. User clicks context injection toggle (User icon button) to turn it OFF
2. Toggle button changes appearance (gray instead of green)
3. User sends a message
4. **BUG:** Context injection is still applied to the message
5. Toggle remains in OFF state visually, but doesn't actually work

### Root Cause:

The toggle state is stored locally in the frontend, but the **API route does not check the user's preference** before injecting context.

---

## Technical Analysis

### Files Involved:

1. **Frontend Toggle:** `components/hooks/useContextInjection.ts`
   - Manages toggle state (`enabled`)
   - Stores preference in database via `/api/user/context-preference`
   - Works correctly ✅

2. **Frontend Chat:** `components/Chat.tsx` (line 223-227)
   - Uses `useContextInjection()` hook
   - Displays toggle button correctly ✅
   - **Missing:** Does not pass `contextInjectionEnabled` to API

3. **Frontend Send:** `components/hooks/useChat.ts` (line 468-548)
   - `handleSendMessage()` sends messages to `/api/chat`
   - **Missing:** Does not include context injection preference in request body

4. **Backend API:** `app/api/chat/route.ts` (line 383-412)
   - **BUG:** Unconditionally calls `gatherConversationContext()` whenever `userId` exists
   - Does not check user's preference in `user_context_profiles` table
   - Always injects context regardless of toggle state ❌

---

## Code Analysis

### Current API Implementation (BROKEN)

```typescript
// app/api/chat/route.ts:383-412
// Context Provider - inject user context before GraphRAG
let contextInjection: ContextInjectionResult | null = null;
if (userId) {  // ❌ PROBLEM: Always runs if user is logged in
  try {
    const userMessage = messages[messages.length - 1]?.content;
    if (userMessage && typeof userMessage === 'string') {
      console.log('[API] Gathering conversation context...');

      contextInjection = await gatherConversationContext(
        userId,
        userMessage,
        {
          maxTokens: 500,
        }
      );

      console.log('[API] Context types:', contextInjection.contextTypes);
      console.log('[API] Estimated tokens:', contextInjection.estimatedTokens);

      // Inject as system message at start
      enhancedMessages = [
        { role: 'system', content: contextInjection.systemMessage },
        ...enhancedMessages
      ];
    }
  } catch (error) {
    console.error('[API] Error gathering context:', error);
    // Continue without context on error
  }
}
```

### Database Schema

The preference is stored correctly:

```sql
-- user_context_profiles table
CREATE TABLE user_context_profiles (
  user_id UUID PRIMARY KEY,
  enable_context_injection BOOLEAN DEFAULT true,
  ...
);
```

---

## Solution

We need to check the user's preference before injecting context. There are **two approaches**:

### Option A: Pass preference in request body (RECOMMENDED)

**Pros:**
- No extra database query per message
- Preference already loaded in frontend
- Faster response time

**Changes needed:**
1. Update `useChat.ts` to pass `contextInjectionEnabled` in request body
2. Update API route to check request body for preference
3. Only call `gatherConversationContext()` if enabled

**Implementation:**
```typescript
// components/hooks/useChat.ts
const handleSendMessage = async (input: string, contextInjectionEnabled: boolean) => {
  // ...existing code...

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: conversationMessages,
      tools: modifiedTools,
      conversationId: activeId,
      modelId: selectedModelId === '__default__' ? null : selectedModelId,
      userId: user?.id,
      contextInjectionEnabled // ✅ ADD THIS
    }),
    signal: controller.signal
  });
}

// app/api/chat/route.ts
const { messages, tools, conversationId, modelId, userId, contextInjectionEnabled } = await request.json();

// Context Provider - inject user context before GraphRAG
let contextInjection: ContextInjectionResult | null = null;
if (userId && contextInjectionEnabled !== false) { // ✅ CHECK PREFERENCE
  // ...existing context injection code...
}
```

### Option B: Query database in API route

**Pros:**
- Preference is always accurate (can't be tampered with)
- No need to pass extra data from frontend

**Cons:**
- Extra database query per message
- Slightly slower

**Implementation:**
```typescript
// app/api/chat/route.ts
// Context Provider - inject user context before GraphRAG
let contextInjection: ContextInjectionResult | null = null;
if (userId) {
  // Check user preference first
  const { data: profile } = await supabase
    .from('user_context_profiles')
    .select('enable_context_injection')
    .eq('user_id', userId)
    .maybeSingle();

  const contextEnabled = profile?.enable_context_injection ?? true;

  if (contextEnabled) { // ✅ CHECK PREFERENCE
    // ...existing context injection code...
  }
}
```

---

## Recommended Implementation Plan

**Use Option A (pass in request body)** because:
1. Preference is already loaded in frontend
2. No extra database query needed
3. Faster response time
4. User is already authenticated, so tampering is not a concern

### Step-by-Step Changes:

#### Step 1: Update `useChat` hook signature

**File:** `components/hooks/useChat.ts`

**Current:**
```typescript
interface UseChatOptions {
  user: User | null;
  activeId: string;
  tools: Tool[];
  enableDeepResearch: boolean;
  selectedModelId: string;
  contextTrackerRef: React.MutableRefObject<ContextTracker | null>;
  setContextUsage: (usage: ContextUsage | null) => void;
  isStreamingRef: React.MutableRefObject<boolean>;
  researchProgress: ResearchProgress | null;
  setResearchProgress: (progress: ResearchProgress | null) => void;
  activeResearchJob: ActiveResearchJob | null;
  setActiveResearchJob: (job: ActiveResearchJob | null) => void;
}
```

**Change to:**
```typescript
interface UseChatOptions {
  user: User | null;
  activeId: string;
  tools: Tool[];
  enableDeepResearch: boolean;
  selectedModelId: string;
  contextTrackerRef: React.MutableRefObject<ContextTracker | null>;
  setContextUsage: (usage: ContextUsage | null) => void;
  isStreamingRef: React.MutableRefObject<boolean>;
  researchProgress: ResearchProgress | null;
  setResearchProgress: (progress: ResearchProgress | null) => void;
  activeResearchJob: ActiveResearchJob | null;
  setActiveResearchJob: (job: ActiveResearchJob | null) => void;
  contextInjectionEnabled: boolean; // ✅ ADD THIS
}
```

#### Step 2: Update `handleSendMessage` to pass preference

**File:** `components/hooks/useChat.ts:510`

**Current:**
```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: conversationMessages,
    tools: modifiedTools,
    conversationId: activeId,
    modelId: selectedModelId === '__default__' ? null : selectedModelId,
    userId: user?.id
  }),
  signal: controller.signal
});
```

**Change to:**
```typescript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: conversationMessages,
    tools: modifiedTools,
    conversationId: activeId,
    modelId: selectedModelId === '__default__' ? null : selectedModelId,
    userId: user?.id,
    contextInjectionEnabled // ✅ ADD THIS
  }),
  signal: controller.signal
});
```

#### Step 3: Update Chat component to pass preference

**File:** `components/Chat.tsx:236-263`

**Current:**
```typescript
const {
  input,
  setInput,
  loading,
  setLoading,
  messages,
  setMessages,
  error,
  setError,
  messagesEndRef,
  messagesContainerRef,
  handleSendMessage,
  handleStop,
} = useChat({
  user,
  activeId,
  tools,
  enableDeepResearch,
  selectedModelId,
  contextTrackerRef,
  setContextUsage,
  isStreamingRef,
  researchProgress,
  setResearchProgress,
  activeResearchJob,
  setActiveResearchJob,
});
```

**Change to:**
```typescript
const {
  input,
  setInput,
  loading,
  setLoading,
  messages,
  setMessages,
  error,
  setError,
  messagesEndRef,
  messagesContainerRef,
  handleSendMessage,
  handleStop,
} = useChat({
  user,
  activeId,
  tools,
  enableDeepResearch,
  selectedModelId,
  contextTrackerRef,
  setContextUsage,
  isStreamingRef,
  researchProgress,
  setResearchProgress,
  activeResearchJob,
  setActiveResearchJob,
  contextInjectionEnabled // ✅ ADD THIS
});
```

#### Step 4: Update API route to check preference

**File:** `app/api/chat/route.ts`

**Find line ~160-170 (where request body is parsed):**
```typescript
const { messages, tools, conversationId, modelId, userId } = await request.json();
```

**Change to:**
```typescript
const { messages, tools, conversationId, modelId, userId, contextInjectionEnabled } = await request.json();
```

**Find line 383-385 (context injection check):**
```typescript
// Context Provider - inject user context before GraphRAG
let contextInjection: ContextInjectionResult | null = null;
if (userId) {
```

**Change to:**
```typescript
// Context Provider - inject user context before GraphRAG
// Only inject if user has enabled it (default: true)
let contextInjection: ContextInjectionResult | null = null;
if (userId && contextInjectionEnabled !== false) {
```

---

## Testing Plan

### Before Fix:
1. ✅ Toggle context injection OFF (button goes gray)
2. ✅ Send message: "What projects am I working on?"
3. ❌ **BUG:** AI responds with context from user profile
4. ❌ Toggle stays OFF visually but doesn't work

### After Fix:
1. ✅ Toggle context injection OFF (button goes gray)
2. ✅ Send message: "What projects am I working on?"
3. ✅ **FIXED:** AI responds without user context (only knows message history)
4. ✅ Toggle stays OFF and works correctly

5. ✅ Toggle context injection ON (button goes green)
6. ✅ Send message: "What projects am I working on?"
7. ✅ AI responds with context from user profile
8. ✅ Toggle stays ON and works correctly

### Test Cases:

1. **Toggle OFF → Send Message**
   - Expected: No context injection
   - Check: Message does not include user context
   - Check: Console does not log "Gathering conversation context..."

2. **Toggle ON → Send Message**
   - Expected: Context injection applied
   - Check: Message includes user context
   - Check: Console logs "Gathering conversation context..."
   - Check: Console logs "Context types: [...]"

3. **Toggle OFF → Reload Page → Send Message**
   - Expected: Toggle loads as OFF, no context injection
   - Check: Preference persists across page reloads

4. **Multiple Messages**
   - Expected: Toggle state persists across multiple messages
   - Check: Toggle does not reset after each message

---

## Implementation Checklist

- [ ] Update `useChat` hook interface to include `contextInjectionEnabled`
- [ ] Update `useChat` hook function signature
- [ ] Update `handleSendMessage` fetch call to pass `contextInjectionEnabled`
- [ ] Update Chat component to pass `contextInjectionEnabled` to useChat
- [ ] Update API route to extract `contextInjectionEnabled` from request body
- [ ] Update API route to check preference before calling `gatherConversationContext()`
- [ ] Test toggle OFF → no context injection
- [ ] Test toggle ON → context injection works
- [ ] Test toggle persists across messages
- [ ] Test toggle persists across page reloads

---

## Expected Results

✅ **After Fix:**
- Toggle OFF: No context injection (faster, simpler responses)
- Toggle ON: Context injection works (personalized responses)
- Toggle state persists across messages
- Toggle state persists across page reloads
- Console logs clearly show when context is being injected

---

## Notes

- The preference is stored in `user_context_profiles.enable_context_injection`
- Default value is `true` (context enabled by default)
- The toggle button uses the User icon (lucide-react)
- The toggle button shows:
  - Green background when ON
  - Gray background when OFF

---

## Files to Modify

1. ✅ **Analysis Complete**
   - `components/hooks/useContextInjection.ts` (already works)
   - `components/Chat.tsx` (already has toggle button)

2. ⏳ **Changes Needed**
   - `components/hooks/useChat.ts` (add parameter, pass to API)
   - `components/Chat.tsx` (pass preference to useChat hook)
   - `app/api/chat/route.ts` (check preference before injecting)

---

**Ready for user approval before implementing changes.**
