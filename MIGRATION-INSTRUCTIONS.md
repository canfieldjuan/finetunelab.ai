# Migration Instructions - Add Token Columns

**Status:** Ready to apply
**Date:** 2026-01-01
**Phase:** 1 - Fix Token Storage Bug

---

## What This Migration Does

Adds `input_tokens` and `output_tokens` columns to the `demo_batch_test_results` table to fix the bug where batch test results fail to store token usage data, resulting in zero metrics.

---

## Option 1: Apply via Supabase Dashboard (RECOMMENDED)

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste Migration SQL**
   - Copy the contents of: `supabase/migrations/20260101000001_add_token_columns_to_demo_results.sql`
   - Paste into the SQL Editor

4. **Execute Migration**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for "Success" message

5. **Verify Migration**
   - Run this verification query:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'demo_batch_test_results'
   AND column_name IN ('input_tokens', 'output_tokens');
   ```

   - Expected output:
   ```
   column_name    | data_type | is_nullable
   ---------------+-----------+-------------
   input_tokens   | integer   | YES
   output_tokens  | integer   | YES
   ```

---

## Option 2: Apply via Supabase CLI

### Prerequisites:
```bash
npm install -g supabase
supabase link --project-ref <your-project-ref>
```

### Steps:
```bash
# Push migration to Supabase
npx supabase db push

# Verify
npx supabase db execute --file - <<SQL
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'demo_batch_test_results'
AND column_name IN ('input_tokens', 'output_tokens');
SQL
```

---

## Option 3: Apply via Direct SQL (psql)

### Prerequisites:
- PostgreSQL client (`psql`) installed
- DATABASE_URL from Supabase settings

### Steps:
```bash
# Get DATABASE_URL from Supabase Dashboard → Settings → Database
# Look for "Connection string" under "Connection pooling"

# Execute migration
psql "$DATABASE_URL" -f supabase/migrations/20260101000001_add_token_columns_to_demo_results.sql

# Verify
psql "$DATABASE_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'demo_batch_test_results'
AND column_name IN ('input_tokens', 'output_tokens');
"
```

---

## Testing After Migration

### 1. Start Demo Page
```bash
npm run dev
```

### 2. Run a Batch Test
- Navigate to: http://localhost:3000/demo/test-model
- Complete steps 1-4 (Welcome → Domain → Config → Batch Test)
- Let all 10 prompts complete

### 3. Verify Data Storage
Run this query in Supabase SQL Editor:
```sql
SELECT
  id,
  prompt,
  latency_ms,
  input_tokens,
  output_tokens,
  success,
  created_at
FROM demo_batch_test_results
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:**
- ✅ All 10 results should be present
- ✅ `input_tokens` should have values (not NULL)
- ✅ `output_tokens` should have values (not NULL)
- ✅ `latency_ms` should have values

### 4. Verify Metrics Display
- On demo page Step 5, check metrics show:
  - ✅ Success Rate: Actual percentage (not 0%)
  - ✅ Average Latency: Actual ms (not 0 ms)
  - ✅ Total Tokens: Actual count (not 0)

---

## Rollback (if needed)

If something goes wrong, you can rollback with:

```sql
ALTER TABLE demo_batch_test_results
  DROP COLUMN IF EXISTS input_tokens,
  DROP COLUMN IF EXISTS output_tokens;
```

---

## Files Modified by This Migration

### Database:
- ✅ `demo_batch_test_results` table (2 new columns added)

### Code (already updated):
- ✅ `/lib/demo/types.ts` - TypeScript interface updated
- ✅ `/app/api/demo/v2/batch-test/route.ts` - INSERT statement (no changes needed - already tries to insert these)
- ✅ `/lib/demo/demo-analytics.service.ts` - Metrics calculation (no changes needed - already handles optional tokens)

---

## Success Criteria

- [ ] Migration executed without errors
- [ ] Verification query returns 2 rows (input_tokens, output_tokens)
- [ ] New batch test stores token data
- [ ] Metrics page shows non-zero values
- [ ] No errors in browser console or server logs

---

## Need Help?

If you encounter errors:
1. Check Supabase Dashboard → Logs for detailed error messages
2. Verify your database credentials are correct
3. Ensure no other migrations are running
4. Check table permissions (should be owner/postgres role)
