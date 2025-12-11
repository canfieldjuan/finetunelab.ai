-- Migration: Add neo4j_episode_ids column to validation_sets
-- Date: 2025-11-29
-- Purpose: Track Neo4j episode IDs for each validation test case

-- Add neo4j_episode_ids column to store array of episode IDs
-- Each element corresponds to a test case in the test_cases JSONB array
ALTER TABLE validation_sets
ADD COLUMN IF NOT EXISTS neo4j_episode_ids TEXT[] DEFAULT '{}';

-- Add index for efficient querying by episode IDs
CREATE INDEX IF NOT EXISTS idx_validation_sets_neo4j_episode_ids
ON validation_sets USING GIN (neo4j_episode_ids);

-- Add comment explaining the column
COMMENT ON COLUMN validation_sets.neo4j_episode_ids IS
'Array of Neo4j/Graphiti episode IDs created for each test case. Index corresponds to test_cases array index.';
