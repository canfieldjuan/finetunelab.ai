-- Check message counts for user's conversations
SELECT
  c.id as conversation_id,
  c.title,
  c.created_at,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
FROM conversations c
WHERE c.user_id = '38c85707-1fc5-40c6-84be-c017b3b8e750'
AND c.archived = false
ORDER BY message_count DESC;
