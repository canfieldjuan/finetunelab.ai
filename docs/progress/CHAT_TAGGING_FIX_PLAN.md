# Chat Tagging Fix - Implementation Plan
**Date**: November 28, 2025
**Issue**: Session tags persist across conversation switches (should be per-conversation)

---

## Problem Analysis

### Current Behavior (BROKEN):
1. User tags Chat A with session "test-1"
2. Tag badge shows in header
3. User switches to Chat B
4. Tag badge STILL shows "test-1" (wrong!)
5. User can only tag once per session

### Root Cause:

**Session state is NOT synced with active conversation**:

**File**: `/components/hooks/useSessionState.ts`
- Uses standalone `useState` for `sessionId` and `experimentName`
- State is global to the Chat component
- **No logic to sync with activeId changes**

**File**: `/components/Chat.tsx:292-298`
```typescript
const {
  sessionId,       // ← Local state, not tied to conversation
  setSessionId,
  experimentName,  // ← Local state, not tied to conversation
  setExperimentName,
} = useSessionState();
```

**File**: `/components/hooks/useConversationActions.ts:172-184`
```typescript
const handleSessionChange = async (sessionId: string, experimentName: string) => {
  // ✅ Correctly updates database for activeId
  await supabase.from('conversations')
    .update({ session_id: sessionId, experiment_name: experimentName })
    .eq('id', activeId);

  // ✅ Refetches conversations from DB
  await fetchConversations();

  // ❌ BUT: UI state (sessionId, experimentName) NOT updated from DB
}
```

**Missing Logic**:
- No `useEffect` to sync UI state when `activeId` changes
- No reading of `conversations.session_id` when switching chats
- UI shows stale values from previous conversation

---

## Expected Behavior:

1. User tags Chat A with "test-1" → badge shows "test-1"
2. User switches to Chat B → badge disappears (no tag)
3. User tags Chat B with "test-2" → badge shows "test-2"
4. User switches back to Chat A → badge shows "test-1" (restored)
5. Each conversation has independent tags

---

## Solution Design

### Approach: Sync UI state from conversations array

When `activeId` changes:
1. Find the active conversation in `conversations` array
2. Read `conversation.session_id` and `conversation.experiment_name`
3. Update local state: `setSessionId()` and `setExperimentName()`

### Files to Modify:

**1. `/components/Chat.tsx`** (ADD)
- Add `useEffect` to sync session state when `activeId` or `conversations` changes
- Location: After line 298 (after `useSessionState` hook)

**2. `/components/hooks/useSessionState.ts`** (OPTIONAL - for clarity)
- Add JSDoc comment explaining this is UI state only
- State gets synced from conversations in Chat.tsx

---

## Implementation Plan

### Phase 1: Verification (No changes)

**Step 1.1**: Verify current state
- ✅ Read `/components/Chat.tsx` lines 290-300
- ✅ Read `/components/hooks/useSessionState.ts` (all 19 lines)
- ✅ Read `/components/hooks/useConversationActions.ts` lines 172-198
- ✅ Confirm no existing `useEffect` syncs session state

**Step 1.2**: Verify conversations structure
- ✅ Check `conversations` array has `session_id` and `experiment_name` fields
- ✅ Grep for conversation type definition

**Step 1.3**: Impact analysis
- ✅ Check all usages of `sessionId` and `experimentName` state
- ✅ Verify SessionManager component receives these as props
- ✅ Confirm no breaking changes

---

### Phase 2: Implementation

**Step 2.1**: Add sync effect in Chat.tsx

**File**: `/components/Chat.tsx`
**Location**: After line 298 (after `useSessionState` hook call)

**Code Block** (30 lines max):
```typescript
// Sync session state from active conversation
useEffect(() => {
  if (!activeId || !conversations.length) {
    // No active conversation - clear session state
    setSessionId(null);
    setExperimentName(null);
    return;
  }

  // Find active conversation
  const activeConversation = conversations.find(c => c.id === activeId);

  if (!activeConversation) {
    // Active conversation not found - clear session state
    setSessionId(null);
    setExperimentName(null);
    return;
  }

  // Sync UI state from conversation data
  const dbSessionId = activeConversation.session_id || null;
  const dbExperimentName = activeConversation.experiment_name || null;

  // Only update if different to avoid unnecessary re-renders
  if (sessionId !== dbSessionId) {
    setSessionId(dbSessionId);
  }
  if (experimentName !== dbExperimentName) {
    setExperimentName(dbExperimentName);
  }

  console.log('[Chat] Synced session state from conversation:', {
    conversationId: activeId,
    sessionId: dbSessionId,
    experimentName: dbExperimentName
  });
}, [activeId, conversations, sessionId, experimentName, setSessionId, setExperimentName]);
```

**Why this works**:
1. Runs whenever `activeId` or `conversations` changes (conversation switch or DB update)
2. Finds the active conversation in the array
3. Reads `session_id` and `experiment_name` from database data
4. Updates local UI state to match
5. Prevents unnecessary re-renders with equality check

**Step 2.2**: Add JSDoc to useSessionState (optional)

**File**: `/components/hooks/useSessionState.ts`
**Location**: Lines 3-7 (update existing comment)

**Updated Comment**:
```typescript
/**
 * Hook for managing A/B testing session state (UI state only).
 * Handles session tagging for analytics and model comparison.
 *
 * NOTE: This state is synced from the active conversation in Chat.tsx.
 * When activeId changes, the Chat component reads session_id and experiment_name
 * from the conversations array and updates this state via setSessionId/setExperimentName.
 *
 * Actual database persistence is handled in useConversationActions.handleSessionChange().
 */
```

---

### Phase 3: Validation

**Step 3.1**: TypeScript compilation
```bash
npx tsc --noEmit
```
- Verify no new errors in Chat.tsx
- Check dependencies are correct

**Step 3.2**: Test scenarios

**Test 1: Tag single conversation**
1. Open Chat A
2. Click "Tag Session"
3. Enter session ID "test-1", experiment "Baseline"
4. Click Save
5. ✅ Badge should show "test-1 (Baseline)"

**Test 2: Switch conversations (main test)**
1. Continuing from Test 1 (Chat A tagged)
2. Click Chat B in sidebar
3. ✅ Badge should DISAPPEAR (no tag on Chat B)
4. Click back to Chat A
5. ✅ Badge should REAPPEAR showing "test-1 (Baseline)"

**Test 3: Tag multiple conversations**
1. Tag Chat A with "control"
2. Switch to Chat B
3. Tag Chat B with "variant"
4. Switch back to Chat A
5. ✅ Should show "control"
6. Switch back to Chat B
7. ✅ Should show "variant"

**Test 4: Clear tag**
1. Tag Chat A with "test"
2. Click X button to clear
3. ✅ Badge should disappear
4. Switch to Chat B and back
5. ✅ Badge should NOT reappear (cleared in DB)

**Test 5: New conversation**
1. Create new conversation
2. ✅ Badge should NOT show (new conversations have no tags)
3. Tag new conversation
4. ✅ Badge should show

---

## Breaking Changes Analysis

### Potential Issues:

**Issue 1**: Infinite re-render loop
- **Risk**: `useEffect` dependencies include `sessionId` and `experimentName`
- **Mitigation**: Only call setters if values actually changed (equality check)
- **Verification**: Check console for render loops

**Issue 2**: Race condition with fetchConversations
- **Risk**: Effect runs before conversations array is updated
- **Mitigation**: Effect depends on `conversations` array - will run after update
- **Verification**: Log sequence of events

**Issue 3**: Widget mode impact
- **Risk**: Widget mode might use session state differently
- **Mitigation**: Check `widgetConfig` usage in Chat.tsx
- **Verification**: Test widget mode if applicable

### No Breaking Changes Expected:

✅ **Function signatures unchanged**: All props/hooks return same types
✅ **Database schema unchanged**: No migration needed
✅ **API unchanged**: No API modifications
✅ **Component props unchanged**: SessionManager props stay the same
✅ **Backward compatible**: Old behavior (first tag works) still works, plus fixes multi-conversation case

---

## Files Modified Summary

**Modified** (1 file):
1. `/components/Chat.tsx` - Add ~35 lines (useEffect + comments)

**Updated** (1 file - optional):
2. `/components/hooks/useSessionState.ts` - Update JSDoc comment (~8 lines)

**Total lines added**: ~43 lines
**Total files modified**: 1-2 files

---

## Verification Checklist

### Pre-Implementation:
- [x] Located all relevant files
- [x] Identified exact insertion point (line 298 in Chat.tsx)
- [x] Verified conversations array structure
- [x] Checked for existing sync logic (none found)
- [x] Analyzed dependencies (activeId, conversations, sessionId, experimentName)

### During Implementation:
- [ ] Add useEffect after line 298 in Chat.tsx
- [ ] Add console.log for debugging
- [ ] Update JSDoc in useSessionState.ts (optional)
- [ ] Verify TypeScript compilation passes
- [ ] Check for hard-coded values (none)
- [ ] Verify no Unicode characters

### Post-Implementation:
- [ ] Run TypeScript compiler
- [ ] Test scenario 1: Tag single conversation
- [ ] Test scenario 2: Switch conversations (main test)
- [ ] Test scenario 3: Tag multiple conversations
- [ ] Test scenario 4: Clear tag
- [ ] Test scenario 5: New conversation
- [ ] Verify no console errors
- [ ] Verify no infinite re-renders
- [ ] Check analytics page shows correct session grouping

---

## Success Criteria

✅ **Primary Goal**: Tags are conversation-specific, not global
✅ **Test 1**: Can tag Chat A, switch to Chat B, tag stays with Chat A only
✅ **Test 2**: Can tag multiple conversations independently
✅ **Test 3**: Switching conversations loads correct tag from database
✅ **Test 4**: No console errors or warnings
✅ **Test 5**: No infinite re-render loops
✅ **Test 6**: Analytics page correctly groups by session_id

---

## Rollback Plan

If issues occur:

**Step 1**: Remove the useEffect from Chat.tsx (lines ~299-335)
**Step 2**: Revert JSDoc comment in useSessionState.ts
**Step 3**: Restart Next.js dev server
**Result**: Reverts to original behavior (tag sticks globally)

---

## Next Steps After Implementation

1. **Test in development** - All 5 test scenarios
2. **Verify analytics** - Check `/analytics` shows correct session grouping
3. **Document usage** - Update user docs if needed
4. **Consider enhancements**:
   - Auto-suggest previous session IDs
   - Bulk tag multiple conversations
   - Session presets/templates

---

## Related Files Reference

**UI Components**:
- `/components/chat/SessionManager.tsx` - Tag input UI
- `/components/chat/ChatHeader.tsx` - Renders SessionManager

**State Management**:
- `/components/hooks/useSessionState.ts` - UI state (19 lines)
- `/components/hooks/useConversationActions.ts` - DB persistence (line 172-198)

**Main Component**:
- `/components/Chat.tsx` - Orchestrates all hooks (line 292-298, 348-368)

**Analytics**:
- `/components/analytics/AnalyticsDashboard.tsx` - Displays session metrics
- `/hooks/useAnalytics.ts` - Aggregates by session_id (line 976-1093)
