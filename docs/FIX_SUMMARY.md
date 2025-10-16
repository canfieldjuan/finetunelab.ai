# Fix for Supabase "Failed to fetch" Error

## Root Cause

The `conversations`, `messages`, `feedback`, and `session_logs` tables have Row Level Security (RLS) enabled but **no policies defined**. This causes all queries to be blocked by default, resulting in the empty error object `{}`.

## Solution Steps

### Step 1: Run the RLS Policy Migration

1. Go to your Supabase project dashboard:
   <https://supabase.com/dashboard/project/tkizlemssfmrfluychsn>

2. Click on "SQL Editor" in the left sidebar

3. Click "New Query"

4. Copy and paste the contents of `docs/FIX_RLS_POLICIES.sql`

5. Click "Run" to execute the SQL

6. You should see a success message indicating the policies were created

### Step 2: Verify the Fix

After running the SQL, verify that RLS policies are in place:

```sql
-- Run this in the SQL Editor to check
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('conversations', 'messages', 'feedback', 'session_logs')
ORDER BY tablename, policyname;
```

You should see policies for each table.

### Step 3: Test the Application

1. Restart your Next.js development server (if running)
2. Navigate to the chat interface
3. The error should be gone and conversations should load

## What Changed

### Before

- Tables had RLS enabled but no policies
- All queries were blocked by default
- Error: `{}`  (empty object because RLS silently blocks)

### After

- Each table has proper RLS policies
- Users can only access their own data
- Queries work correctly

## Files Modified

1. `/home/juanc/Desktop/claude_desktop/web-ui/.env` - Added server-side Supabase credentials
2. `/home/juanc/Desktop/claude_desktop/web-ui/app/api/graphrag/documents/route.ts` - Uses supabaseAdmin
3. `/home/juanc/Desktop/claude_desktop/web-ui/app/api/graphrag/delete/[id]/route.ts` - Uses supabaseAdmin
4. `/home/juanc/Desktop/claude_desktop/web-ui/docs/FIX_RLS_POLICIES.sql` - RLS policies for all tables

## Summary

The issue was a combination of:

1. ✅ Missing server-side environment variables (FIXED)
2. ✅ API routes using wrong Supabase client (FIXED)
3. ❌ **Missing RLS policies on conversation/message tables (NEEDS SQL MIGRATION)**

Run the SQL migration in Supabase to complete the fix.
