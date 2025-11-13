-- Step 1: Find all orphaned messages (messages without valid conversation_id)
SELECT
    m.id,
    m.conversation_id,
    m.role,
    m.created_at,
    LEFT(m.content, 50) as content_preview
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE m.conversation_id IS NOT NULL AND c.id IS NULL
ORDER BY m.created_at DESC
LIMIT 100;

-- Step 2: Count orphaned messages
SELECT COUNT(*) as total_orphaned_messages
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE m.conversation_id IS NOT NULL AND c.id IS NULL;

-- Step 3: Delete orphaned messages
-- UNCOMMENT THE LINE BELOW AFTER REVIEWING THE RESULTS ABOVE
-- DELETE FROM messages
-- WHERE conversation_id IN (
--   SELECT m.conversation_id
--   FROM messages m
--   LEFT JOIN conversations c ON m.conversation_id = c.id
--   WHERE m.conversation_id IS NOT NULL AND c.id IS NULL
-- );

-- Alternative Step 3: Set orphaned messages to NULL instead of deleting
-- UNCOMMENT THE LINE BELOW IF YOU PREFER THIS APPROACH
-- UPDATE messages
-- SET conversation_id = NULL
-- WHERE conversation_id IN (
--   SELECT m.conversation_id
--   FROM messages m
--   LEFT JOIN conversations c ON m.conversation_id = c.id
--   WHERE m.conversation_id IS NOT NULL AND c.id IS NULL
-- );

-- Step 4: After cleanup, add the foreign key constraint
-- Run this AFTER the cleanup is complete
ALTER TABLE messages
ADD CONSTRAINT messages_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES conversations(id)
ON DELETE CASCADE;

-- Step 5: Verify the constraint was added
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'messages'
  AND kcu.column_name = 'conversation_id';
