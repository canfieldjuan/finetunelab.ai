-- ============================================================================
-- GraphRAG Document Storage Setup
-- Run this SQL in your Supabase SQL Editor
-- ============================================================================

-- First, let's check what columns exist in the current table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- If the table has different column names, we need to alter it
-- Common issue: table might have userId instead of user_id

-- Option 1: Check if we need to rename columns
-- Uncomment and run if your table has different column names:

-- ALTER TABLE documents RENAME COLUMN "userId" TO user_id;
-- ALTER TABLE documents RENAME COLUMN "fileName" TO filename;
-- ALTER TABLE documents RENAME COLUMN "fileType" TO file_type;
-- ALTER TABLE documents RENAME COLUMN "uploadPath" TO upload_path;
-- ALTER TABLE documents RENAME COLUMN "createdAt" TO created_at;
-- ALTER TABLE documents RENAME COLUMN "updatedAt" TO updated_at;

-- Option 2: If you want to start fresh (WARNING: Deletes all data!)
-- Uncomment this to drop and recreate:
-- DROP TABLE IF EXISTS documents CASCADE;

-- Create documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt', 'md', 'docx')),
  upload_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  neo4j_episode_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better query performance
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_processed ON documents(processed);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX idx_documents_file_type ON documents(file_type);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
-- Note: Adjust these based on your auth setup

-- Allow users to view their own documents
CREATE POLICY "Users can view their own documents"
  ON documents
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Allow users to insert their own documents
CREATE POLICY "Users can insert their own documents"
  ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Allow users to update their own documents
CREATE POLICY "Users can update their own documents"
  ON documents
  FOR UPDATE
  USING (user_id = auth.uid()::text);

-- Allow users to delete their own documents
CREATE POLICY "Users can delete their own documents"
  ON documents
  FOR DELETE
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- For Development/Demo: Temporary bypass policy
-- REMOVE THIS IN PRODUCTION!
-- ============================================================================

-- Uncomment this for demo/development to allow any user_id
-- DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
-- DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
-- DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
-- DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- CREATE POLICY "Allow all for demo"
--   ON documents
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- ============================================================================
-- Verify Setup
-- ============================================================================

-- Check table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'documents';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'documents';
