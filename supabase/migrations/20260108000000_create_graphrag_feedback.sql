-- GraphRAG User Feedback Table
-- Stores user ratings on retrieved context chunks for relevance scoring

CREATE TABLE IF NOT EXISTS graphrag_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID,
  message_id UUID,
  source_id TEXT NOT NULL,
  fact_content TEXT,
  helpful BOOLEAN NOT NULL,
  feedback_text TEXT,
  confidence_score NUMERIC(4,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user queries
CREATE INDEX idx_graphrag_feedback_user_id ON graphrag_feedback(user_id);

-- Index for conversation-based lookups
CREATE INDEX idx_graphrag_feedback_conversation ON graphrag_feedback(conversation_id);

-- Index for source-based aggregations
CREATE INDEX idx_graphrag_feedback_source ON graphrag_feedback(source_id);

-- Index for helpful filtering
CREATE INDEX idx_graphrag_feedback_helpful ON graphrag_feedback(helpful);

-- Row Level Security
ALTER TABLE graphrag_feedback ENABLE ROW LEVEL SECURITY;

-- Users can only see their own feedback
CREATE POLICY "Users can view own feedback"
  ON graphrag_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON graphrag_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
  ON graphrag_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete own feedback"
  ON graphrag_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON graphrag_feedback TO authenticated;
