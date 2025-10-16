-- Enable Web Search Tool in Supabase
-- Date: October 12, 2025
-- Purpose: Fix web search tool not working issue
-- Run this in Supabase SQL Editor

-- ============================================
-- ENABLE WEB_SEARCH TOOL
-- ============================================

UPDATE tools
SET is_enabled = true
WHERE name = 'web_search';

-- ============================================
-- VERIFY THE CHANGE
-- ============================================

SELECT
  name,
  description,
  is_enabled,
  is_builtin,
  created_at
FROM tools
WHERE name = 'web_search';

-- Expected output:
-- name        | description                    | is_enabled | is_builtin | created_at
-- ------------|--------------------------------|------------|------------|------------
-- web_search  | Search the web for current...  | true       | true       | [timestamp]

-- ============================================
-- OPTIONAL: ENABLE ALL BUILTIN TOOLS
-- ============================================

-- Uncomment below to enable all builtin tools at once
-- UPDATE tools
-- SET is_enabled = true
-- WHERE is_builtin = true;

-- ============================================
-- CHECK ALL TOOLS STATUS
-- ============================================

SELECT
  name,
  is_enabled,
  is_builtin
FROM tools
ORDER BY name;
