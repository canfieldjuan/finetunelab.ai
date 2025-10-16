-- Fix session_logs table schema
-- Run this in your Supabase SQL Editor

-- Drop the existing table if you want to start fresh (CAREFUL: This deletes data!)
-- DROP TABLE IF EXISTS session_logs CASCADE;

-- Or, if you want to preserve existing data, alter the table:

-- 1. Drop the existing CHECK constraint
ALTER TABLE session_logs DROP CONSTRAINT IF EXISTS session_logs_event_check;

-- 2. Add the new CHECK constraint with all allowed events
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

-- 4. Verify the table structure
-- Run this to check:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'session_logs';
