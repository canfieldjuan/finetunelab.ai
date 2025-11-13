-- Find all tables
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name;

-- Find all columns in conversations table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
ORDER BY ordinal_position;

-- Find all columns in messages table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'messages'
ORDER BY ordinal_position;

-- Find foreign key relationships
SELECT
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
  AND (tc.table_name = 'conversations' OR tc.table_name = 'messages');

-- Find any views that might aggregate message counts
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND (table_name LIKE '%conversation%' OR table_name LIKE '%message%');

-- Check if there's a message_count column or computed field
SELECT *
FROM information_schema.columns
WHERE table_name = 'conversations'
  AND column_name LIKE '%count%';
