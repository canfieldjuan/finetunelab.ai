-- Check if there are any active subscriptions registered in Realtime
SELECT 
  id,
  subscription_id,
  entity,
  filters,
  claims_role,
  created_at
FROM realtime.subscription
ORDER BY created_at DESC
LIMIT 20;

-- Also check the schema for realtime.messages (where broadcasts go)
SELECT COUNT(*) as message_count
FROM realtime.messages
WHERE inserted_at > NOW() - INTERVAL '1 hour';
