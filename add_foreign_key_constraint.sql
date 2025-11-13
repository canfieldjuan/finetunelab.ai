-- Add foreign key constraint between messages.conversation_id and conversations.id
-- This enables Supabase to recognize the relationship for queries like "*, messages(count)"

-- First, check if any orphaned messages exist (messages without valid conversation_id)
SELECT COUNT(*) as orphaned_messages
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE m.conversation_id IS NOT NULL AND c.id IS NULL;

-- If orphaned messages exist, you can either:
-- 1. Delete them: DELETE FROM messages WHERE conversation_id NOT IN (SELECT id FROM conversations);
-- 2. Set them to NULL: UPDATE messages SET conversation_id = NULL WHERE conversation_id NOT IN (SELECT id FROM conversations);

-- Add the foreign key constraint
ALTER TABLE messages
ADD CONSTRAINT messages_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES conversations(id)
ON DELETE CASCADE;

-- Verify the constraint was added
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'messages'
  AND kcu.column_name = 'conversation_id';
