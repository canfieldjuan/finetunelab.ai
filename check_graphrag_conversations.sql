-- Check conversations marked as in_knowledge_graph
SELECT
  c.id,
  c.title,
  c.in_knowledge_graph,
  c.neo4j_episode_id,
  c.created_at,
  (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
  (SELECT MAX(LENGTH(content)) FROM messages WHERE conversation_id = c.id) as max_message_size
FROM conversations c
WHERE c.user_id = '38c85707-1fc5-40c6-84be-c017b3b8e750'
AND c.in_knowledge_graph = true
ORDER BY c.created_at DESC
LIMIT 10;
