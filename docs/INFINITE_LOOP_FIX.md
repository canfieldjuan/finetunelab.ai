# Infinite Loop Bug Fix

## Problem Identified

### Symptoms

- `TypeError: Failed to fetch` errors
- `ERR_INSUFFICIENT_RESOURCES` in browser console
- **5,224+ network requests** made in seconds
- Page becomes unresponsive
- Browser runs out of memory

### Root Cause

The `Chat.tsx` component had an **infinite re-render loop** caused by incorrect `useEffect` dependencies.

**Location**: `/home/juanc/Desktop/claude_desktop/web-ui/components/Chat.tsx` (Line 70)

**The Bug**:

```typescript
useEffect(() => {
  const fetchConversations = async () => {
    // ... fetch conversations ...
    if (data && data.length > 0) {
      setConversations(data);
      if (!activeId) {
        setActiveId(data[0].id);  // ❌ This sets activeId
      }
    }
  };
  fetchConversations();
}, [user, activeId]);  // ❌ activeId is in dependencies!
```

**Why It Caused an Infinite Loop**:

1. Component renders → `useEffect` runs
2. `fetchConversations` sets `activeId` via `setActiveId(data[0].id)`
3. Setting `activeId` triggers the `useEffect` again (because `activeId` is in dependencies)
4. Goes back to step 2 → **INFINITE LOOP**

### Evidence from Chrome DevTools

- **Console logs**: Thousands of repeated `[Chat] Fetching conversations` messages
- **Network tab**: 5,224 requests to Supabase endpoints
- **Error**: `Failed to load resource: net::ERR_INSUFFICIENT_RESOURCES`

## Solution

**Fixed Code**:

```typescript
useEffect(() => {
  const fetchConversations = async () => {
    // ... fetch conversations ...
    if (data && data.length > 0) {
      setConversations(data);
      if (!activeId) {
        setActiveId(data[0].id);  // ✅ Can safely set activeId now
      }
    }
  };
  fetchConversations();
}, [user]); // eslint-disable-line react-hooks/exhaustive-deps
// NOTE: activeId is intentionally excluded to prevent infinite loop
```

**Change**: Removed `activeId` from the dependency array

**Why This Works**:

- The effect now only runs when `user` changes
- Setting `activeId` inside the effect no longer triggers a re-render loop
- The `activeId` check `if (!activeId)` still works correctly

## Files Changed

### Modified

1. `/home/juanc/Desktop/claude_desktop/web-ui/components/Chat.tsx`
   - Line 70: Removed `activeId` from `useEffect` dependencies
   - Added eslint-disable comment and explanation

## Testing

After this fix:

- ✅ No more infinite loop
- ✅ Conversations load once on mount
- ✅ No ERR_INSUFFICIENT_RESOURCES errors
- ✅ Normal number of network requests
- ✅ Page remains responsive

## Related Issues Fixed

This also resolves the original error you reported:

```text
[Chat] Error fetching conversations: {}
```

The empty error object was actually a side effect of the browser running out of resources due to the infinite loop, not an RLS policy issue.

## Lessons Learned

1. **Always verify dependency arrays** in `useEffect` hooks
2. **Be careful when setting state** that's also in the dependencies
3. **Use Chrome DevTools Network tab** to catch infinite request loops
4. **Monitor console logs** for repeated patterns

## Additional Notes

The RLS policies we created earlier (`docs/FIX_RLS_POLICIES.sql`) are still valuable for proper data security, but they were not the cause of this specific error.
