# RLS Policy Issue - Training Metrics Not Showing

## Root Cause
The metrics aren't showing because of **Row Level Security (RLS) policies**, not token expiration.

### Evidence
1. **3,541 metrics exist in database** - persistence is working
2. **Jobs with `user_id` set show metrics** - Job `7c8a36b6` has 41 metrics ✅
3. **Jobs with `user_id = NULL` show 0 metrics** - Most recent jobs ❌

### The Problem
RLS policies require:
```sql
-- SELECT policy on local_training_metrics
(job_id IN (
  SELECT id FROM local_training_jobs  
  WHERE user_id = auth.uid() OR user_id IS NULL
))
```

When you're logged in and viewing the UI:
- `auth.uid()` = your user ID (e.g., `38c85707-1fc5-40c6-84be-c017b3b8e750`)
- Jobs with `user_id = NULL` pass the RLS check for INSERT
- But the **Realtime subscription** in the frontend filters by `user_id = auth.uid()`
- So NULL user_id jobs are **invisible** to logged-in users

## Solutions

### Option 1: Ensure user_id Is Always Set (RECOMMENDED)
The training server should extract `user_id` from the JWT and set it when creating jobs.

**Check current code:**
```bash
grep -n "user_id" lib/training/training_server.py
```

The `/api/training/execute` endpoint should decode the JWT to get `user_id` and pass it to the training server.

### Option 2: Update RLS Policies (Quick Fix)
Allow all authenticated users to see all local training jobs:

```sql
-- Drop existing restrictive policy
DROP POLICY "Users can view metrics for own jobs" ON local_training_metrics;

-- Create permissive policy  
CREATE POLICY "Authenticated users can view all metrics"
ON local_training_metrics
FOR SELECT
TO authenticated
USING (true);

-- Same for local_training_jobs
DROP POLICY IF EXISTS "Users can view own jobs" ON local_training_jobs;

CREATE POLICY "Authenticated users can view all jobs"
ON local_training_jobs
FOR SELECT
TO authenticated
USING (true);
```

### Option 3: Update Frontend Realtime Subscription
Modify the Realtime subscription to not filter by `user_id`:

```typescript
// Instead of:
.eq('user_id', user.id)

// Use:
// No filter, rely on RLS
```

## Recommended Action Plan

1. **Immediate Fix**: Apply Option 2 (update RLS policies) via Supabase SQL Editor
2. **Long-term Fix**: Ensure `user_id` is extracted from JWT and set when jobs are created
3. **Token Refresh**: Keep the TokenRefreshManager implementation (it's still good for long-running jobs)

## SQL Migration to Apply

Run this in Supabase SQL Editor:

```sql
-- Fix local_training_metrics RLS
DROP POLICY IF EXISTS "Users can view metrics for own jobs" ON local_training_metrics;
DROP POLICY IF EXISTS "Users can insert metrics for own jobs" ON local_training_metrics;

CREATE POLICY "Authenticated users can view all metrics"
ON local_training_metrics
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert metrics"
ON local_training_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix local_training_jobs RLS
DROP POLICY IF EXISTS "Users can view own jobs" ON local_training_jobs;
DROP POLICY IF EXISTS "Users can insert own jobs" ON local_training_jobs;
DROP POLICY IF EXISTS "Users can update own jobs" ON local_training_jobs;

CREATE POLICY "Authenticated users can view all jobs"
ON local_training_jobs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert jobs"
ON local_training_jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update jobs"
ON local_training_jobs
FOR UPDATE
TO authenticated
USING (true);
```

## Verification

After applying the fix:
1. Refresh the Training Monitor page
2. Metrics should appear immediately (no restart needed)
3. All 3,541 existing metrics will become visible

## Why Token Refresh Is Still Needed

Even with fixed RLS policies, the TokenRefreshManager is still valuable because:
- Training jobs can run for hours
- JWT tokens expire after 60 minutes
- Without refresh, metrics persistence will fail after token expires
- The RLS fix makes metrics VISIBLE, token refresh ensures they PERSIST

Keep both fixes in place for a complete solution.
