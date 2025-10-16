# Progress Log: Stop Button & Stream Control Feature

**Date Started:** 2025-10-15
**Status:** Planning Phase
**Priority:** Critical (P1)

---

## Overview

Implement stream cancellation and error handling for chat interface to resolve:
1. **Issue 1:** No way to stop/cancel chat response once sent
2. **Issue 2:** Zombie loading states across tabs/page refreshes

---

## Requirements

### Must Have (P1 - Critical)
- ✅ Add Stop button with AbortController
- ✅ Add 30-second timeout with auto-abort
- ✅ Clean up temp messages on mount
- ✅ Show clear error states

### Explicitly NOT Implementing
- ❌ Saving partial messages
- ❌ Saving cancelled messages
- ❌ Cross-tab real-time sync (future enhancement)
- ❌ Retry mechanism (future enhancement)

---

## Implementation Plan

### Phase 1: Planning & Verification (Current)
1. ✅ Create phased implementation plan
2. ⏳ Read and verify Chat.tsx structure
3. ⏳ Identify exact code insertion points
4. ⏳ Document current handleSend flow
5. ⏳ Validate approach before coding

### Phase 2: AbortController Implementation
1. Add useRef for AbortController
2. Create AbortController in handleSend
3. Pass signal to fetch call
4. Create handleStop function
5. Test abort functionality

### Phase 3: Stop Button UI
1. Import Square icon from lucide-react
2. Modify Send button to conditionally show Stop
3. Style Stop button (destructive variant)
4. Test button toggle behavior

### Phase 4: Timeout Implementation
1. Add timeout constant (30 seconds)
2. Create setTimeout in handleSend
3. Auto-trigger handleStop on timeout
4. Show timeout error message
5. Clean up timeout on completion

### Phase 5: Cleanup Temp Messages
1. Add useEffect on mount
2. Filter out temp-* messages on load
3. Log cleanup actions
4. Test across page refreshes

### Phase 6: Error State Handling
1. Add error states for stopped/timeout
2. Update error banner to show cancellation
3. Add logging for all error scenarios
4. Test error display

### Phase 7: Testing & Validation
1. Test Stop button during streaming
2. Test timeout behavior
3. Test page refresh cleanup
4. Test duplicate tab behavior
5. Verify no breaking changes

---

## Files to Modify

### Primary File
- `/components/Chat.tsx` - Main chat component with handleSend logic

### Verified Structure
- ✅ Imports section (line 1-20) - Square icon needs adding at line 10
- ✅ State declarations (line 45-70) - AbortController ref goes after line 69
- ✅ handleSend function (line 215-507) - Multiple insertions needed
- ✅ Send button UI (line 1108-1121) - Conditional rendering needed

---

## Current Code Flow Analysis

### handleSend Function (Chat.tsx)
```
Line 215: handleSend function starts
Line 237: setLoading(true)
Line 280: fetch('/api/chat', {...})
Line 310: Create temp message (id: 'temp-' + Date.now())
Line 319: reader = response.body?.getReader()
Line 320-389: while(true) streaming loop
Line 506: setLoading(false) in finally block
```

### Exact Insertion Points (Verified)

**Insertion Point 1:** Line 10 (Import Square icon)
```typescript
// CURRENT (line 10):
import { Database, Paperclip, CheckCircle, MoreVertical, Trash2, Download, Archive, Settings, LogOut, Plus, Star, BarChart3 } from 'lucide-react';

// ADD Square to imports
```

**Insertion Point 2:** Line 69-70 (Add AbortController ref)
```typescript
// CURRENT (line 69-70):
const messagesContainerRef = useRef<HTMLDivElement>(null);
const { archive } = useArchive();

// INSERT BETWEEN: Add abortControllerRef
```

**Insertion Point 3:** Line 157-159 (Add cleanup useEffect)
```typescript
// CURRENT (line 157-159):
}, [user, activeId]);

// Close menu when clicking outside

// INSERT BETWEEN: Add temp message cleanup useEffect
```

**Insertion Point 4:** Line 213-215 (Add handleStop function)
```typescript
// CURRENT (line 213-215):
}
};

const handleSend = async () => {

// INSERT BETWEEN: Add handleStop function
```

**Insertion Point 5:** Line 237-239 (Create AbortController in handleSend)
```typescript
// CURRENT (line 237-239):
setError(null);
setLoading(true);

const userMessage = input;

// INSERT AFTER setLoading: Create AbortController and timeout
```

**Insertion Point 6:** Line 280-291 (Add signal to fetch)
```typescript
// CURRENT (line 280):
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({...}),
});

// ADD signal parameter to fetch options
```

**Insertion Point 7:** Line 504-507 (Clear timeout in finally)
```typescript
// CURRENT (line 504-507):
setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
}

setLoading(false);
};

// ADD timeout cleanup before setLoading
```

**Insertion Point 8:** Line 1108-1121 (Modify Send button UI)
```typescript
// CURRENT (line 1108-1121):
<Button
  onClick={handleSend}
  disabled={loading || !input.trim()}
  className="min-h-[44px] px-6"
>
  {loading ? (
    <div className="flex items-center space-x-2">
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Sending...</span>
    </div>
  ) : (
    "Send"
  )}
</Button>

// REPLACE with conditional Stop/Send button
```

---

## Implementation Guidelines

### Code Standards
- Write in 30-line blocks or complete logic blocks
- Add console.log at key points for debugging
- No stub/mock/TODO implementations
- Maintain backward compatibility
- Verify each change before proceeding

### Logging Strategy
```typescript
console.log('[Chat] AbortController created for message');
console.log('[Chat] Stop button clicked, aborting request');
console.log('[Chat] Request aborted by user');
console.log('[Chat] Timeout reached, auto-aborting');
console.log('[Chat] Cleaned up N temp messages on mount');
console.error('[Chat] Abort error:', error);
```

### Error Messages
- User stops: "[Request interrupted by user]"
- Timeout: "[Request timed out after 30 seconds]"
- Network abort: "[Request failed: connection interrupted]"

---

## Testing Checklist

### Scenario 1: Stop Button During Stream
- [ ] Click Stop button mid-stream
- [ ] Verify loading state stops
- [ ] Verify temp message removed
- [ ] Verify error message shown
- [ ] Verify can send new message

### Scenario 2: Timeout
- [ ] Send message that takes >30s
- [ ] Verify auto-stop after 30s
- [ ] Verify timeout error message
- [ ] Verify cleanup occurred

### Scenario 3: Page Refresh
- [ ] Start streaming response
- [ ] Refresh page mid-stream
- [ ] Verify no temp messages remain
- [ ] Verify no perpetual loading

### Scenario 4: Duplicate Tab
- [ ] Open chat in Tab A
- [ ] Send message in Tab A
- [ ] Open Tab B (duplicate)
- [ ] Verify Tab B not stuck loading

### Scenario 5: Error Handling
- [ ] Stop during streaming
- [ ] Stop with no active request (no-op)
- [ ] Network error during stream
- [ ] Verify all errors logged

---

## Progress Tracking

### Session 1: 2025-10-15
- ✅ Created implementation plan
- ✅ Verified Chat.tsx structure (1237 lines)
- ✅ Identified 8 exact insertion points
- ⏳ Next: Begin Phase 2 - Implement AbortController

---

## Notes & Decisions

### Decision Log
1. **No partial message saving** - User explicitly does not want cancelled/partial messages saved
2. **30-second timeout** - Standard timeout for streaming operations
3. **AbortController approach** - Native browser API, clean cancellation
4. **Temp message cleanup on mount** - Prevents zombie states across sessions

### Open Questions
- None yet

### Risks & Mitigation
- **Risk:** Breaking existing streaming logic
  - **Mitigation:** Verify each change, maintain backward compatibility
- **Risk:** AbortController not cleaning up resources
  - **Mitigation:** Add comprehensive logging, test abort scenarios
- **Risk:** Timeout conflicts with long legitimate responses
  - **Mitigation:** 30s is generous, can be tuned later if needed

---

## Next Steps

1. Read Chat.tsx lines 1-70 (imports, state, refs)
2. Read Chat.tsx lines 215-507 (handleSend function)
3. Read Chat.tsx lines 1073-1120 (Send button UI)
4. Document exact insertion points
5. Begin Phase 2 implementation

---

**Last Updated:** 2025-10-15
**Next Session:** Continue with Phase 1 verification
