# useChatState and useChatActions Hooks Created

**Date:** 2025-11-04
**Status:** ✅ COMPLETE - Hooks Created and Integrated
**Architecture:** Split State/Actions Pattern

---

## Summary

Successfully created the `useChatState` and `useChatActions` hooks that were planned in the refactoring document but never implemented. These hooks split the functionality of the original `useChat` hook into separate concerns: state management and actions.

---

## Files Created

### 1. useChatState Hook (`components/hooks/useChatState.ts`)

**Purpose:** Manages all chat-related state

**State Managed:**
- `input` - Current input text
- `loading` - Loading state during message send
- `messages` - Array of conversation messages
- `error` - Error state
- `abortController` - Controller for aborting requests
- `messagesEndRef` - Ref for scrolling to bottom
- `messagesContainerRef` - Ref for messages container

**Returns:**
```typescript
{
  input, setInput,
  loading, setLoading,
  messages, setMessages,
  error, setError,
  abortController, setAbortController,
  messagesEndRef,
  messagesContainerRef
}
```

**Size:** 36 lines
**Dependencies:** React (useState, useRef), Message type

---

### 2. useChatActions Hook (`components/hooks/useChatActions.ts`)

**Purpose:** Handles all chat actions (sending messages, streaming responses, etc.)

**Parameters:**
```typescript
interface UseChatActionsOptions {
  user: User | null;
  activeId: string;
  messages: Message[];
  setMessages: (messages: Message[]) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  tools: any[];
  enableDeepResearch: boolean;
  selectedModelId: string;
  contextTrackerRef: React.MutableRefObject<ContextTracker | null>;
  setContextUsage: (usage: ContextUsage | null) => void;
}
```

**Actions Provided:**
- `handleSendMessage` - Main function to send messages and handle responses

**Internal Functions:**
- `saveMessageToDatabase` - Saves assistant messages to database
- `streamAndProcessResponse` - Handles streaming responses from API
- `prepareAndSendMessage` - Prepares message data before sending

**Size:** 318 lines
**Dependencies:** React (useCallback), Supabase, logger, types

---

## Architecture Benefits

### Before (Monolithic)
```typescript
// useChat.ts - 250 lines
// Everything in one hook:
// - State management
// - Actions
// - Side effects
// - Database operations
// - Streaming logic
```

### After (Separated)
```typescript
// useChatState.ts - 36 lines
// Only state management

// useChatActions.ts - 318 lines
// Only actions and business logic

// Total: 354 lines (slightly more due to better organization)
```

### Advantages

1. **Separation of Concerns**
   - State in one place
   - Actions in another
   - Easier to understand and maintain

2. **Better Testability**
   - Can test state management independently
   - Can test actions with mocked state
   - Clearer test boundaries

3. **Reusability**
   - State hook can be used without actions if needed
   - Actions can be used with different state sources
   - More flexible composition

4. **Follows React Best Practices**
   - Single Responsibility Principle
   - Separation of data and behavior
   - Common pattern in large React applications

5. **Easier Code Navigation**
   - Want to change state? Go to useChatState.ts
   - Want to change message handling? Go to useChatActions.ts
   - No more searching through 250 lines

---

## Usage in Chat.tsx

### Before
```typescript
const {
  input, setInput, loading, messages, error,
  abortController, messagesEndRef, messagesContainerRef,
  handleSendMessage
} = useChat({
  user, activeId, tools, enableDeepResearch,
  selectedModelId, contextTrackerRef, setContextUsage
});
```

### After
```typescript
// Step 1: Get state
const {
  input, setInput,
  loading, setLoading,
  messages, setMessages,
  error: chatError, setError: setChatError,
  abortController, setAbortController,
  messagesEndRef, messagesContainerRef
} = useChatState();

// Step 2: Get actions (pass state setters)
const { handleSendMessage } = useChatActions({
  user, activeId,
  messages, setMessages,
  setError: setChatError,
  setLoading, setAbortController,
  tools, enableDeepResearch, selectedModelId,
  contextTrackerRef, setContextUsage
});
```

---

## Key Implementation Details

### useChatState

**Simple and Focused:**
- No side effects
- No complex logic
- Pure state management
- Easy to understand at a glance

**Example:**
```typescript
export function useChatState() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // ... more state

  return {
    input, setInput,
    loading, setLoading,
    messages, setMessages,
    // ... more getters/setters
  };
}
```

### useChatActions

**Complex but Organized:**
- Uses `useCallback` for performance
- All logic in one place
- Clear function names
- Well-structured

**Key Functions:**

1. **saveMessageToDatabase**
   - Saves assistant responses
   - Calculates token estimates
   - Handles errors gracefully

2. **streamAndProcessResponse**
   - Reads streaming response
   - Updates UI in real-time (throttled)
   - Handles GraphRAG citations
   - Tracks token usage
   - Updates context tracker

3. **prepareAndSendMessage**
   - Saves user message to DB
   - Updates conversation title
   - Prepares tools array
   - Adds deep research hints

4. **handleSendMessage**
   - Main entry point
   - Orchestrates the full flow
   - Error handling
   - Loading states

---

## Migration Notes

### Original useChat Hook

The original `useChat` hook is still present in `components/hooks/useChat.ts` for backward compatibility. It could be refactored to use the new split hooks internally:

```typescript
// Future refactor option
export function useChat(options: UseChatOptions) {
  const state = useChatState();
  const actions = useChatActions({
    ...options,
    messages: state.messages,
    setMessages: state.setMessages,
    setError: state.setError,
    setLoading: state.setLoading,
    setAbortController: state.setAbortController,
  });

  return {
    ...state,
    ...actions,
  };
}
```

This would keep backward compatibility while using the new architecture internally.

---

## Testing Strategy

### Unit Tests for useChatState

```typescript
describe('useChatState', () => {
  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useChatState());
    expect(result.current.input).toBe('');
    expect(result.current.messages).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('should update input', () => {
    const { result } = renderHook(() => useChatState());
    act(() => {
      result.current.setInput('Hello');
    });
    expect(result.current.input).toBe('Hello');
  });
});
```

### Unit Tests for useChatActions

```typescript
describe('useChatActions', () => {
  it('should send message successfully', async () => {
    const mockOptions = {
      user: { id: 'user-1' },
      activeId: 'conv-1',
      messages: [],
      setMessages: jest.fn(),
      // ... other mocks
    };

    const { result } = renderHook(() => useChatActions(mockOptions));
    await act(async () => {
      await result.current.handleSendMessage('Hello');
    });

    expect(mockOptions.setMessages).toHaveBeenCalled();
  });
});
```

---

## Performance Considerations

### useChatState
- **Minimal re-renders**: Each setter only updates its own state
- **No computed values**: All values are direct state
- **Fast execution**: No expensive operations

### useChatActions
- **useCallback everywhere**: All functions memoized
- **Throttled updates**: Streaming updates throttled to 500ms
- **Efficient state updates**: Uses functional updates `(prev) => ...`
- **Cleanup**: Clears timeouts properly

---

## Future Enhancements

### Potential Improvements

1. **Scroll Management in useChatState**
   - Add auto-scroll logic to the state hook
   - Keep scroll refs and scroll function together

2. **Better Type Safety in useChatActions**
   - Create more specific types for messages
   - Add runtime validation for API responses

3. **Retry Logic**
   - Add automatic retry for failed requests
   - Exponential backoff

4. **Optimistic Updates**
   - Show messages immediately
   - Rollback on error

5. **Message Queue**
   - Queue messages if offline
   - Send when connection restored

---

## Files Modified

| File | Changes | Lines Added |
|------|---------|-------------|
| `components/hooks/useChatState.ts` | Created | 36 |
| `components/hooks/useChatActions.ts` | Created | 318 |
| `components/hooks/index.ts` | Added exports | 2 |
| `components/Chat.tsx` | Updated to use split hooks | ~10 changed |

**Total:** 2 new files, 2 modified files, 366 lines added

---

## Verification Checklist

✅ **useChatState created** - 36 lines, clean state management
✅ **useChatActions created** - 318 lines, all actions extracted
✅ **Barrel exports updated** - Both hooks exported
✅ **Chat.tsx updated** - Using split hooks correctly
✅ **TypeScript compiles** - No type errors
✅ **Application runs** - No runtime errors
✅ **All features work** - Message sending, streaming, stop button
✅ **Architecture improved** - Better separation of concerns

---

## Documentation

### useChatState
- **Location:** `components/hooks/useChatState.ts`
- **Purpose:** Manage chat UI state
- **Usage:** `const state = useChatState();`
- **Returns:** State object with getters and setters

### useChatActions
- **Location:** `components/hooks/useChatActions.ts`
- **Purpose:** Handle chat message operations
- **Usage:** `const actions = useChatActions(options);`
- **Returns:** Object with `handleSendMessage` function

---

## Success Metrics

✅ **Code Organization:** Improved from monolithic to separated
✅ **Maintainability:** Each hook has single responsibility
✅ **Testability:** Can test state and actions independently
✅ **Functionality:** All features working as before
✅ **Type Safety:** Full TypeScript support
✅ **Performance:** No performance degradation

---

## Related Documents

- `components/REFACTORING_PLAN.md` - Original plan (now implemented)
- `components/IMPORT_ISSUES_REPORT.md` - Issues that led to this
- `components/FINAL_FIX_SUMMARY.md` - Previous fix summary
- `components/hooks/useChat.ts` - Original combined hook (still exists)

---

**Status:** ✅ **COMPLETE - HOOKS CREATED AND WORKING**

**Created:** 2025-11-04
**Author:** Claude Code
**Result:** Clean separation of state and actions, following React best practices
