-- Quick verification queries for Plugin System
-- Run these to verify everything is set up correctly

-- 1. Check if tools table exists and has data
SELECT 
    name, 
    description, 
    is_enabled, 
    is_builtin 
FROM tools 
ORDER BY name;

-- Expected output: 3 tools (calculator, datetime, web_search)

-- 2. Check specific datetime tool
SELECT * FROM tools WHERE name = 'datetime';

-- 3. Check tool_executions table exists
SELECT COUNT(*) FROM tool_executions;

-- 4. Enable all built-in tools (in case they were disabled)
UPDATE tools 
SET is_enabled = true 
WHERE is_builtin = true;

-- 5. Verify enabled tools
SELECT name, is_enabled FROM tools WHERE is_enabled = true;
