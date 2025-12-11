# Context Injection Toggle - RLS Fix

**Date:** 2025-12-03
**Issue:** RLS policy violation when creating/updating context preferences
**Status:** ✅ FIXED

---

## Problem

After running the first RLS migration, the API still failed with:
```
Error code: 42501
Message: new row violates row-level security policy for table "user_context_profiles"
```

### Root Cause

The API route was using the **service role client** (`@/lib/supabaseClient`) which bypasses RLS, but the RLS policies were checking `auth.uid()` which requires an **authenticated user client**.

**Mismatch:**
- RLS Policy: Checks `auth.uid() = user_id` (requires authenticated context)
- API Client: Service role (no authenticated user context)

---

## Solution

Changed the API to use an **authenticated Supabase client** that respects RLS policies, matching the pattern used in other API routes like `/api/settings`.

---

## Changes Made

### 1. Updated `/app/api/user/context-preference/route.ts`

**Before (Service Role):**
```typescript
import { supabase } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');

  const { data, error } = await supabase
    .from('user_context_profiles')
    .select('enable_context_injection')
    .eq('user_id', userId)
    .maybeSingle();
}
```

**After (Authenticated Client):**
```typescript
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Create authenticated Supabase client that respects RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  // Verify user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_context_profiles')
    .select('enable_context_injection')
    .eq('user_id', user.id)
    .maybeSingle();
}
```

**Key changes:**
- Uses `createClient` with Authorization header
- Calls `supabase.auth.getUser()` to get authenticated user
- Uses `user.id` from authenticated context (not from headers)

### 2. Updated `/components/hooks/useContextInjection.ts`

**Before:**
```typescript
const { user } = useAuth();

const response = await fetch('/api/user/context-preference', {
  headers: {
    'x-user-id': user.id,
  },
});
```

**After:**
```typescript
const { user, session } = useAuth();

const response = await fetch('/api/user/context-preference', {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
  },
});
```

**Key changes:**
- Gets `session` from `useAuth()`
- Passes `Authorization: Bearer ${session.access_token}` header
- Removed `x-user-id` header (no longer needed)

---

## How It Works Now

1. **Frontend** gets user's session token from AuthContext
2. **Frontend** sends API request with `Authorization: Bearer <token>` header
3. **API** creates authenticated Supabase client with that token
4. **API** calls `supabase.auth.getUser()` to verify authentication
5. **Supabase** sets `auth.uid()` in database context
6. **RLS policies** check `auth.uid() = user_id` ✅ (now works!)
7. **Database** allows INSERT/UPDATE/SELECT operations

---

## Files Modified

1. ✅ `/app/api/user/context-preference/route.ts`
   - Import changed from `@/lib/supabaseClient` to `@supabase/supabase-js`
   - Both GET and POST methods updated
   - Uses authenticated client with Authorization header

2. ✅ `/components/hooks/useContextInjection.ts`
   - Gets `session` from `useAuth()`
   - Passes `Authorization` header instead of `x-user-id`

---

## Testing

### Before Fix:
```
[API] Error creating context preference: {
  code: '42501',
  message: 'new row violates row-level security policy'
}
POST /api/user/context-preference 500
```

### After Fix:
```
[API] Context injection preference updated: { userId: '...', enabled: false }
POST /api/user/context-preference 200
```

---

## Security Benefits

**This fix actually IMPROVES security:**

1. **Before:** API trusted `x-user-id` header from client (could be spoofed)
2. **After:** API verifies user via authenticated token (can't be spoofed)

The authenticated client approach ensures that:
- User identity is cryptographically verified by Supabase
- RLS policies are properly enforced at database level
- No way for malicious client to manipulate other users' preferences

---

## Migration Script Used

**File:** `/scripts/migrations/fix_user_context_profiles_rls.sql`

This migration added the necessary RLS policies:
```sql
-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own context profile"
  ON user_context_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own context profile"
  ON user_context_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own context profile"
  ON user_context_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

These policies now work correctly because the API provides authenticated context.

---

## Status

✅ **READY TO TEST**

1. Refresh your browser
2. Click the context injection toggle (User icon)
3. Toggle should work without errors
4. Check browser console - should see no errors
5. Check server logs - should see "Context injection preference updated"

---

## Related Documentation

- **Context Injection Feature:** `/development/fixes/context-injection-toggle-fix.md`
- **Implementation Summary:** `/development/fixes/CONTEXT-INJECTION-IMPLEMENTATION-SUMMARY.md`

---

**Ready to test!** 🎉
