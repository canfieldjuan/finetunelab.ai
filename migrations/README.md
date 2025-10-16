# Database Migrations

This directory contains SQL migration files for the web-ui project.

## How to Run Migrations

### Step 1: Access Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Navigate to: SQL Editor (left sidebar)
3. Click "New Query"

### Step 2: Execute Migrations in Order

**Migration 001: Add Metrics Columns**
- File: `001_add_metrics_columns.sql`
- Purpose: Add performance tracking columns to messages table
- Safe: All columns are nullable, non-breaking change
- Run: Copy entire file contents and paste into SQL Editor, click "Run"

**Migration 002: Create Evaluations Table**
- File: `002_create_evaluations_table.sql`
- Purpose: Create table for human evaluations
- Safe: New table, doesn't affect existing data
- Run: Copy entire file contents and paste into SQL Editor, click "Run"

### Step 3: Verify Migrations

After running each migration, verify success:

**For Migration 001:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'messages'
AND column_name IN ('latency_ms', 'input_tokens', 'output_tokens', 'tools_called', 'tool_success', 'fallback_used', 'error_type');
```

Expected: 7 rows showing all new columns

**For Migration 002:**
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'message_evaluations';
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'message_evaluations';
```

Expected: Table exists with RLS enabled

### Rollback (If Needed)

If something goes wrong, run this to undo changes:

```sql
-- Rollback migration 002
DROP TABLE IF EXISTS message_evaluations CASCADE;

-- Rollback migration 001
ALTER TABLE messages
DROP COLUMN IF EXISTS latency_ms,
DROP COLUMN IF EXISTS input_tokens,
DROP COLUMN IF EXISTS output_tokens,
DROP COLUMN IF EXISTS tools_called,
DROP COLUMN IF EXISTS tool_success,
DROP COLUMN IF EXISTS fallback_used,
DROP COLUMN IF EXISTS error_type;
```

## Migration Log

| Migration | Date | Status | Notes |
|-----------|------|--------|-------|
| 001 | 2025-10-13 | Pending | Add metrics columns |
| 002 | 2025-10-13 | Pending | Create evaluations table |

Update this table after running each migration.
