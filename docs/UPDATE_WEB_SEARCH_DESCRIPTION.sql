-- Update Web Search Tool Description
-- Date: October 12, 2025
-- Purpose: Improve LLM synthesis of search results
-- Run this in Supabase SQL Editor after restarting dev server

UPDATE tools
SET description = 'Search the web for CURRENT, UP-TO-DATE information, news, and answers. Use this for recent events, latest news, current facts, or anything requiring real-time data. YOU MUST read and synthesize the content from multiple search results to provide a comprehensive, informative answer. Do not just list snippets - analyze and explain the information found.'
WHERE name = 'web_search';

-- Verify the update
SELECT name, description FROM tools WHERE name = 'web_search';
