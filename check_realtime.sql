-- Check if tables are in the realtime publication
SELECT 
    schemaname,
    tablename,
    'In supabase_realtime publication' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
AND tablename IN ('local_training_jobs', 'local_training_metrics')
ORDER BY tablename;

-- Check REPLICA IDENTITY setting
SELECT 
    c.relname as table_name,
    CASE c.relreplident
        WHEN 'd' THEN 'DEFAULT (primary key)'
        WHEN 'n' THEN 'NOTHING'
        WHEN 'f' THEN 'FULL (all columns)'
        WHEN 'i' THEN 'INDEX'
    END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('local_training_jobs', 'local_training_metrics')
AND n.nspname = 'public'
ORDER BY c.relname;

-- Check if the publication exists
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';
