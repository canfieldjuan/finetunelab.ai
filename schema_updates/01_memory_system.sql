-- Memory System Schema
-- Phase 1.1: Database tables for user preferences and conversation memory
-- Date: October 10, 2025

-- ============================================
-- USER PREFERENCES TABLE
-- Stores user-level preferences with persistence flag
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    is_persistent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_persistent ON user_preferences(is_persistent);

-- ============================================
-- CONVERSATION MEMORY TABLE
-- Stores conversation-specific context and memory
-- ============================================

CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    memory_key TEXT NOT NULL,
    memory_value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, memory_key)
);

CREATE INDEX IF NOT EXISTS idx_conversation_memory_conversation_id ON conversation_memory(conversation_id);
