# Session Logs Table Fix

## Problem

The `session_logs` table is returning 400 errors because:

1. Missing `conversation_id` column
2. CHECK constraint doesn't include all event types being used ('signed_in', 'signed_out', 'user_updated')

## Solution

Run this SQL in your **Supabase SQL Editor** (<https://app.supabase.com/project/tkizlemssfmrfluychsn/sql/new>):

```sql
-- Fix session_logs table schema

-- 1. Drop the existing CHECK constraint
ALTER TABLE session_logs DROP CONSTRAINT IF EXISTS session_logs_event_check;

-- 2. Add the updated CHECK constraint with all allowed events
ALTER TABLE session_logs ADD CONSTRAINT session_logs_event_check 
  CHECK (event IN (
    'login', 
    'logout', 
    'signup', 
    'delete_account', 
    'message_sent', 
    'conversation_created', 
    'feedback_given',
    'signed_in',
    'signed_out',
    'user_updated'
  ));

-- 3. Add conversation_id column if it doesn't exist
ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

-- 4. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_session_logs_conversation_id ON session_logs(conversation_id);
```

## Verification

After running the SQL, verify it worked:

```sql
-- Check table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'session_logs'
ORDER BY ordinal_position;

-- Check constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'session_logs_event_check';
```

## Expected Result

The table should have these columns:

- `id` (uuid)
- `user_id` (uuid)
- `event` (text)
- `conversation_id` (uuid) ← **NEW**
- `timestamp` (timestamptz)
- `metadata` (jsonb)

And the event CHECK constraint should allow all these values:

- login
- logout
- signup
- delete_account
- message_sent
- conversation_created
- feedback_given
- signed_in ← **NEW**
- signed_out ← **NEW**
- user_updated ← **NEW**

## After Applying

Refresh your chat page and the 400 errors on session_logs should be gone!
