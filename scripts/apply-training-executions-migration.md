# Apply Training Executions Migration

**Migration File**: `supabase/migrations/20251024000008_create_training_executions.sql`

**Date**: 2025-10-24

---

## Option 1: Apply via Supabase Dashboard (Recommended)

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://app.supabase.com
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy Migration SQL**
   - Open file: `C:/Users/Juan/Desktop/Dev_Ops/web-ui/supabase/migrations/20251024000008_create_training_executions.sql`
   - Copy the entire contents

4. **Paste and Run**
   - Paste SQL into the editor
   - Click "Run" button
   - Wait for success message

5. **Verify**
   - Run this query:
   ```sql
   SELECT COUNT(*) FROM training_executions;
   ```
   - Should return: `0` (empty table, but exists)

---

## Option 2: Apply via Supabase CLI

### Prerequisites:
```bash
# Install Supabase CLI if not already installed
npm install -g supabase
```

### Steps:

1. **Link to Project** (if not already linked)
   ```bash
   supabase link --project-ref your-project-ref
   ```

2. **Apply Migration**
   ```bash
   supabase db push
   ```

3. **Verify**
   ```bash
   # Check if table exists
   psql $DATABASE_URL -c "\d training_executions"
   ```

---

## Option 3: Direct Database Connection

### If you have DATABASE_URL:

```bash
# Apply migration directly
psql $DATABASE_URL -f supabase/migrations/20251024000008_create_training_executions.sql

# Verify
psql $DATABASE_URL -c "SELECT tablename FROM pg_tables WHERE tablename = 'training_executions';"
```

---

## What This Migration Creates

### Table: `training_executions`

Tracks all training job executions across different providers (Colab, OpenAI, HuggingFace, Local).

**Columns:**
- `id` - Unique execution ID (exec_...)
- `user_id` - User who started the training
- `public_id` - Training config public ID
- `method` - Training method (sft, dpo, rlhf)
- `provider` - Execution provider (colab, huggingface, openai, local)
- `status` - Current status (pending, running, completed, failed, cancelled)
- `progress` - Progress percentage (0-100)
- `colab_url` - Colab notebook URL (if provider=colab)
- `huggingface_url` - HuggingFace URL (if provider=huggingface)
- `openai_job_id` - OpenAI job ID (if provider=openai)
- `callback_url` - Optional webhook callback
- `config` - Provider-specific configuration (JSONB)
- `logs` - Array of log messages
- `error` - Error message if failed
- `result` - Execution results (JSONB)
- `started_at` - Start timestamp
- `completed_at` - Completion timestamp
- `created_at` - Record creation
- `updated_at` - Last update

**Indexes:**
- `idx_training_executions_user_id` - Fast user queries
- `idx_training_executions_public_id` - Fast config queries
- `idx_training_executions_status` - Fast status filtering
- `idx_training_executions_provider` - Fast provider filtering
- `idx_training_executions_openai_job` - Fast OpenAI job lookups

**Security:**
- Row Level Security (RLS) enabled
- Users can only view/modify their own executions
- Policies enforce user isolation

**Triggers:**
- Auto-updates `updated_at` timestamp on every update

---

## Verification Queries

### After applying migration, run these to verify:

**1. Check table exists:**
```sql
SELECT tablename
FROM pg_tables
WHERE tablename = 'training_executions';
```

**2. Check columns:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'training_executions'
ORDER BY ordinal_position;
```

**3. Check indexes:**
```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'training_executions';
```

**4. Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'training_executions';
```
Should show: `rowsecurity = true`

**5. Check policies:**
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'training_executions';
```
Should show 4 policies: SELECT, INSERT, UPDATE, DELETE

---

## Expected Output

After successful migration, you should see:

```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE FUNCTION
CREATE TRIGGER
COMMENT
COMMENT
COMMENT
COMMENT
NOTICE:  === Training Executions Table Created ===
NOTICE:  Table: training_executions
NOTICE:  Providers: colab, huggingface, openai, local
NOTICE:  RLS: Enabled with user isolation
NOTICE:  OpenAI support: job_id tracking and hyperparameters
```

---

## Rollback (If Needed)

If you need to undo the migration:

```sql
-- Drop table and all dependencies
DROP TABLE IF EXISTS training_executions CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS update_training_executions_updated_at CASCADE;
```

---

## Common Issues

### Issue: "relation already exists"
**Cause**: Migration already applied
**Solution**: Table already exists, no action needed

### Issue: "permission denied"
**Cause**: Insufficient database permissions
**Solution**: Use Supabase Dashboard (has full permissions)

### Issue: "syntax error"
**Cause**: SQL copied incorrectly
**Solution**: Re-copy entire migration file contents

---

## Next Steps After Migration

1. ✅ Verify table exists
2. ✅ Test execution API: `POST /api/training/execute`
3. ✅ Test status API: `GET /api/training/execute/{id}/status`
4. ✅ Create first execution via DAG or direct API call
5. ✅ Verify execution record appears in database

---

## Support

If migration fails:
1. Check Supabase Dashboard for error messages
2. Verify you have admin permissions
3. Check database logs in Supabase
4. Try Option 1 (Dashboard) if CLI fails

