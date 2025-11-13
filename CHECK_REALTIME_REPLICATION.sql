-- Check if Realtime replication slot exists and is active
SELECT * FROM pg_replication_slots WHERE slot_name LIKE '%realtime%';

-- Check WAL level (must be 'logical' for realtime)
SHOW wal_level;

-- Check if tables are in the publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';

-- Check if there are any Realtime subscriptions registered
SELECT 
  n.nspname AS schema_name,
  c.relname AS table_name,
  a.attname AS column_name
FROM pg_catalog.pg_attribute a
JOIN pg_catalog.pg_class c ON a.attrelid = c.oid
JOIN pg_catalog.pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'realtime'
  AND c.relname = 'subscription'
ORDER BY c.relname, a.attname;

-- Check if logical replication is properly configured
SELECT name, setting 
FROM pg_settings 
WHERE name IN ('max_replication_slots', 'max_wal_senders', 'wal_level');
