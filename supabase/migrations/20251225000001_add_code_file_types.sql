-- ============================================================================
-- Add Code File Types to GraphRAG Documents
-- Enables upload and processing of TypeScript, JavaScript, and Python files
-- ============================================================================

-- Drop the existing file_type check constraint
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_file_type_check;

-- Add new check constraint with code file types
ALTER TABLE documents ADD CONSTRAINT documents_file_type_check
  CHECK (file_type IN ('pdf', 'txt', 'md', 'docx', 'ts', 'tsx', 'js', 'jsx', 'py'));

-- Update any comments
COMMENT ON COLUMN documents.file_type IS 'Supported file types: pdf, txt, md, docx, ts, tsx, js, jsx, py';
