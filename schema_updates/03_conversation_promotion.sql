-- Conversation Promotion System
-- Adds tracking fields for promoting conversations to Neo4j knowledge graph
-- Created: 2025-10-11

-- Add promotion tracking columns to conversations table
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS in_knowledge_graph BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS neo4j_episode_id TEXT NULL,
ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ NULL;

-- Add index for querying promoted conversations efficiently
CREATE INDEX IF NOT EXISTS idx_conversations_promoted
ON conversations(user_id, in_knowledge_graph);

-- Add comment for documentation
COMMENT ON COLUMN conversations.in_knowledge_graph IS 'Whether this conversation has been promoted to the Neo4j knowledge graph';
COMMENT ON COLUMN conversations.neo4j_episode_id IS 'UUID of the episode in Neo4j (from Graphiti)';
COMMENT ON COLUMN conversations.promoted_at IS 'Timestamp when the conversation was promoted to knowledge graph';

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'conversations'
AND column_name IN ('in_knowledge_graph', 'neo4j_episode_id', 'promoted_at');
