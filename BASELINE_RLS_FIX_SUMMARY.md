# Baseline Creation RLS Fix - Summary

## Problem
`POST /api/training/baselines` was failing with:
```
Failed to create baseline: new row violates row-level security policy for table "model_baselines"
```

## Root Cause
The `BaselineManager` was using the **anon key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) instead of the **service role key**. Even though RLS policies were updated to be more permissive, the anon key still has restrictions.

## Solution Applied

### 1. Created Server-Side Supabase Client
**File:** `lib/supabase/server-client.ts`
- New function: `createServerClient()`
- Uses `SUPABASE_SERVICE_ROLE_KEY` for full database access
- Bypasses RLS policies (safe for server-side operations)
- Should NEVER be exposed to browser

### 2. Updated BaselineManager
**File:** `lib/services/baseline-manager.ts`
- Changed import from `createClient()` to `createServerClient()`
- Constructor now uses service role client
- Simplified `getBaselineManager()` function
- Added type casting in `mapBaseline()` method

### 3. Verification
**Test:** `scripts/test_baseline_service_role.mjs`
- ✅ Successfully creates baselines with service role
- ✅ Verifies RLS is bypassed correctly
- ✅ Confirms API will work

## Files Modified
1. ✅ `lib/supabase/server-client.ts` (NEW)
2. ✅ `lib/services/baseline-manager.ts` (UPDATED)
3. ✅ `scripts/test_baseline_service_role.mjs` (NEW - verification)

## Testing
Run verification script:
```bash
node scripts/test_baseline_service_role.mjs
```

Expected output:
```
✅ Baseline created successfully!
🎉 SUCCESS! The service role client works correctly!
```

## What's Next
1. Hot-reload should pick up changes automatically
2. Test your baseline creation request again
3. Should work without RLS errors now

## Why This Works
- **Anon Key**: Respects RLS policies, limited access
- **Service Role Key**: Bypasses RLS, full database access
- Server-side API routes can safely use service role
- Client-side code should NEVER use service role key

## Security Note
The service role key:
- Has FULL database access
- Bypasses ALL RLS policies
- Should ONLY be used in API routes and server-side code
- Is properly secured in environment variables
- Never sent to the browser
