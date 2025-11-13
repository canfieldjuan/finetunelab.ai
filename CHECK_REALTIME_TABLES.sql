-- Check if there's a realtime configuration table
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'realtime'
ORDER BY tablename;

-- Check if there are any realtime-related settings in extensions
SELECT 
  name,
  setting,
  unit,
  category,
  short_desc
FROM pg_settings
WHERE name LIKE '%realtime%' OR name LIKE '%logical%' OR name LIKE '%replication%'
ORDER BY name;
