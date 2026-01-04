# Analytics Sessions Not Showing - Diagnosis & Fixes

## What I Found

✅ **Data EXISTS in Database**:
- 55 tagged sessions for user `canfieldjuan24@gmail.com`
- All sessions have both `session_id` AND `experiment_name` set correctly
- Batch tests are working and auto-tagging correctly

✅ **Code is Correct**:
- Session query logic is correct (lines 66-72 in `components/analytics/AnalyticsChat.tsx`)
- UI rendering is correct (lines 443-479)
- Session grouping logic is correct (lines 81-98)

❌ **Problem**: Sessions aren't appearing in the UI sidebar

---

## Most Likely Causes

### 1. **Wrong User Logged In**
The sessions belong to `canfieldjuan24@gmail.com`. If you're logged in as a different user, you won't see them.

**Check**: Open browser console on `/analytics/chat` and look for:
```
[AnalyticsChat] Fetching tagged sessions
[AnalyticsChat] Grouped sessions: X
```

If it says `Grouped sessions: 0`, you're logged in as the wrong user OR there's an RLS issue.

### 2. **RLS (Row Level Security) Blocking Access**
Supabase RLS might be preventing the anon client from fetching conversations.

**Check**: The query uses `.eq('user_id', user.id)` which requires RLS policies to allow users to read their own conversations.

### 3. **Client-Side Error**
JavaScript error preventing the sessions from loading.

**Check**: Browser console for errors when visiting `/analytics/chat`

---

## Diagnostic Steps

### Step 1: Check Browser Console

1. Open `/analytics/chat` page
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for logs starting with `[AnalyticsChat]`
5. Check for:
   - `Fetching tagged sessions`
   - `Grouped sessions: X` (should be 55 or close)
   - Any error messages

### Step 2: Check Current User

In browser console, run:
```javascript
// Get current Supabase session
const session = JSON.parse(localStorage.getItem('sb-gtwdktoqvgtxpvvscnwq-auth-token'));
console.log('Current user:', session?.user?.email);
console.log('User ID:', session?.user?.id);
```

Expected: `canfieldjuan24@gmail.com` with ID `38c85707-1fc5-40c6-84be-c017b3b8e750`

### Step 3: Manually Query Sessions

In browser console:
```javascript
const { createClient } = window.supabase;
const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

// Check current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user?.email, user?.id);

// Try to fetch sessions
const { data, error } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name')
  .eq('user_id', user.id)
  .not('session_id', 'is', null)
  .not('experiment_name', 'is', null)
  .order('created_at', { ascending: false });

console.log('Sessions found:', data?.length);
console.log('Error:', error);
console.log('Sessions:', data);
```

---

## Quick Fixes

### Fix 1: Add Console Logging

Add this to `components/analytics/AnalyticsChat.tsx` line 64 (right after `if (!user) return;`):

```typescript
console.log('[AnalyticsChat] Current user:', user.id, user.email);
```

And at line 100 (after groupedSessions):
```typescript
console.log('[AnalyticsChat] Sessions state before setSessions:', sessions);
console.log('[AnalyticsChat] Setting sessions to:', groupedSessions);
```

This will help see if sessions are being fetched but not set to state.

### Fix 2: Check RLS Policies

Run this SQL in Supabase SQL Editor:
```sql
SELECT * FROM pg_policies WHERE tablename = 'conversations';
```

You should see a policy like:
```
policyname: Users can view own conversations
cmd: SELECT
qual: (auth.uid() = user_id)
```

If missing, create it:
```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
ON conversations
FOR SELECT
USING (auth.uid() = user_id);
```

### Fix 3: Force Refresh Sessions

Add a refresh button to manually reload sessions. Add to `components/analytics/AnalyticsChat.tsx`:

```typescript
// Add this function after fetchSessions
const handleRefreshSessions = async () => {
  console.log('[AnalyticsChat] Manual refresh triggered');
  setSessions([]);
  await fetchSessions();
};

// Add this button in the sidebar (after line 421):
<Button
  onClick={handleRefreshSessions}
  variant="outline"
  size="sm"
  className="w-full mb-2"
>
  🔄 Refresh Sessions
</Button>
```

---

## Next Steps

1. **Run diagnostic steps** above and share the console output
2. **Check which user is logged in**
3. **Verify RLS policies** exist for conversations table
4. If sessions show in console but not UI, there's a React state issue
5. If sessions don't show in console, there's an RLS or query issue

---

## Tools Registry Issue

You also mentioned:
> "new tools we create need to added to database aswell"

Currently there's **NO tools table** in the database. The tools are defined in code only (in `app/api/analytics/chat/route.ts`).

**Do you want to**:
1. Create a `tools` table to store tool definitions?
2. Register tools dynamically from the database?
3. Add tool usage tracking to `analytics_tool_logs` (Phase 4)?

Let me know and I can create the migration and registration system.
