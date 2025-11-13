# Apply Training Persistence Migration

**Migration:** `supabase/migrations/20251027000001_create_local_training_persistence.sql`

---

## Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard
   ```

2. **Select your project**

3. **Go to SQL Editor** (left sidebar)

4. **Open the migration file in a text editor:**
   ```
   C:\Users\Juan\Desktop\Dev_Ops\web-ui\supabase\migrations\20251027000001_create_local_training_persistence.sql
   ```

5. **Copy the entire SQL content**

6. **Paste into Supabase SQL Editor**

7. **Click "Run"** (or press Ctrl+Enter)

8. **Verify tables created:**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name LIKE 'local_training%';
   ```

   Expected result:
   ```
   local_training_jobs
   local_training_metrics
   ```

---

## Option 2: Supabase CLI

**Prerequisites:**
- Supabase CLI installed
- Project linked

**Commands:**
```bash
# Link to remote project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations to remote
supabase db push

# Verify
supabase db diff
```

---

## Option 3: Direct SQL Connection

If you have the database connection string:

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" \
  -f supabase/migrations/20251027000001_create_local_training_persistence.sql
```

---

## Verify Migration Applied

### Check Tables Exist
```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('local_training_jobs', 'local_training_metrics');
```

### Check Table Structure
```sql
-- Jobs table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_jobs'
ORDER BY ordinal_position;

-- Metrics table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'local_training_metrics'
ORDER BY ordinal_position;
```

### Check RLS Policies
```sql
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('local_training_jobs', 'local_training_metrics');
```

---

## After Migration Applied

### Test Insert (via API)

1. **Submit a training job:**
   ```bash
   curl -s http://localhost:8000/api/training/execute \
     -X POST \
     -H "Content-Type: application/json" \
     -d @lib/training/test_1k_payload.json
   ```

2. **Wait for completion** (~2 minutes)

3. **Check database:**
   ```sql
   -- Count jobs
   SELECT COUNT(*) FROM local_training_jobs;

   -- Count metrics
   SELECT job_id, COUNT(*) as metric_count
   FROM local_training_metrics
   GROUP BY job_id;
   ```

   Expected: 23 metrics for the training job

---

## Troubleshooting

### Error: "relation already exists"
Tables already created. Migration was applied previously.

**Verify:**
```sql
SELECT COUNT(*) FROM local_training_jobs;
SELECT COUNT(*) FROM local_training_metrics;
```

### Error: "permission denied"
Ensure you're using the service role key, not anon key.

**Check environment:**
```bash
# .env.local should have:
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

### Error: "foreign key constraint"
RLS policies might be blocking. Check user_id is NULL or valid.

**Debug:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename LIKE 'local_training%';

-- Temporarily disable RLS (testing only!)
ALTER TABLE local_training_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE local_training_metrics DISABLE ROW LEVEL SECURITY;
```

---

## Migration File Contents Preview

```sql
-- Creates 2 tables
CREATE TABLE local_training_jobs (
  id TEXT PRIMARY KEY,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL,
  config JSONB NOT NULL,
  best_eval_loss NUMERIC,
  ...
);

CREATE TABLE local_training_metrics (
  id BIGSERIAL PRIMARY KEY,
  job_id TEXT REFERENCES local_training_jobs(id),
  step INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  train_loss NUMERIC,
  eval_loss NUMERIC,
  ...
);

-- + Indexes, RLS policies, triggers
```

---

## Next Steps After Migration

1. ✅ Migration applied
2. ✅ Tables verified
3. ✅ RLS policies active
4. Run training job to test end-to-end
5. Verify all 23 metrics persist to database
6. Check analytics dashboard shows historical data

---

**Migration Status:** Ready to apply
**Impact:** Low (creates new tables, no existing data affected)
**Rollback:** `DROP TABLE local_training_metrics; DROP TABLE local_training_jobs;`
