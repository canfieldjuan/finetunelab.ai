# GraphRAG Supabase Setup Instructions

## Current Error

`column documents.user_id does not exist`

This means the `documents` table hasn't been created in your Supabase database yet.

---

## Fix Steps

### Step 1: Create the Documents Table

1. **Go to your Supabase Dashboard**
   - URL: <https://supabase.com/dashboard>

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "+ New Query"

3. **Copy and paste this SQL:**

```sql
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

-- Create indexes
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
```

4. **Click "Run" or press Cmd/Ctrl + Enter**

---

### Step 2: Set Up Row Level Security (RLS)

After creating the table, run this SQL:

```sql
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own documents
CREATE POLICY "Users can view their own documents"
  ON documents
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- Policy: Users can insert their own documents
CREATE POLICY "Users can insert their own documents"
  ON documents
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Policy: Users can update their own documents
CREATE POLICY "Users can update their own documents"
  ON documents
  FOR UPDATE
  USING (user_id = auth.uid()::text);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete their own documents"
  ON documents
  FOR DELETE
  USING (user_id = auth.uid()::text);
```

**Note:** If you're using demo mode without auth, temporarily use this instead:

```sql
-- FOR DEMO ONLY - Remove in production!
CREATE POLICY "Allow all for demo"
  ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

### Step 3: Create Storage Bucket

1. **Go to Storage in Supabase Dashboard**
   - Click "Storage" in left sidebar
   - Click "+ New Bucket"

2. **Create bucket:**
   - Name: `graphrag-documents`
   - Public: **No** (keep it private)
   - File size limit: 10MB

3. **Set up Storage Policy:**

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'graphrag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'graphrag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'graphrag-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

---

### Step 4: Verify Setup

Run this verification SQL:

```sql
-- Check table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'documents';

-- Check policies
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'documents';
```

Expected output:

- Table with all columns (id, user_id, filename, etc.)
- rowsecurity = true
- 4 policies listed (or 1 demo policy)

---

### Step 5: Refresh Your Page

After running the SQL:

1. Refresh <http://localhost:3003/graphrag-demo>
2. The error should be gone
3. You should see an empty document list

---

## Troubleshooting

### Still getting "column does not exist"?

- Make sure you ran the CREATE TABLE statement
- Check you're in the right Supabase project
- Verify table name is exactly `documents` (lowercase)

### RLS blocking access?

- If using demo mode, use the "Allow all for demo" policy
- For production, make sure auth.uid() matches your user_id format
- Check if user is authenticated

### Can't upload files?

- Verify storage bucket `graphrag-documents` exists
- Check storage policies are set
- Ensure bucket is private (not public)

---

## Quick Test

After setup, test with this SQL:

```sql
-- Insert test document
INSERT INTO documents (user_id, filename, file_type, upload_path)
VALUES ('demo-user', 'test.pdf', 'pdf', 'demo/test.pdf');

-- Query it back
SELECT * FROM documents WHERE user_id = 'demo-user';
```

If this works, your GraphRAG demo page will work too!

---

## Complete SQL File

The complete SQL is available at:
`/home/juanc/Desktop/claude_desktop/web-ui/docs/SUPABASE_SETUP.sql`

You can also run it all at once by copying the entire file.
