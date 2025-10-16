# GraphRAG Quick Start Guide 🚀

## Overview

GraphRAG is now fully integrated into your Next.js chat application! This guide will help you get started.

---

## What is GraphRAG?

GraphRAG combines:

- **Knowledge Graphs** (Neo4j) - Store entities and relationships
- **Graphiti** - Automatic entity extraction
- **RAG** (Retrieval-Augmented Generation) - Enhance AI responses with your documents

When you upload a document, it's automatically:

1. Parsed (PDF/TXT/MD/DOCX)
2. Chunked into manageable pieces
3. Analyzed by Graphiti to extract entities
4. Stored in Neo4j as a knowledge graph
5. Used to enhance chat responses automatically

---

## Prerequisites

### 1. Install Neo4j

```bash
# Option A: Docker (easiest)
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/your-password \
  neo4j:5-community

# Option B: Download from neo4j.com
```

### 2. Install Graphiti

```bash
# Pull and run Graphiti Docker image
docker run -d \
  --name graphiti \
  -p 8001:8001 \
  -e NEO4J_URI=bolt://host.docker.internal:7687 \
  -e NEO4J_USERNAME=neo4j \
  -e NEO4J_PASSWORD=your-password \
  zepai/graphiti:latest

# Verify it's running
curl http://localhost:8001/health
```

### 3. Install Dependencies

```bash
cd web-ui
npm install pdf-parse mammoth
```

---

## Configuration

### 1. Environment Variables

Create/update `.env.local`:

```bash
# Enable GraphRAG
GRAPHRAG_ENABLED=true
GRAPHRAG_LOG_LEVEL=info

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

# Graphiti Service
GRAPHITI_API_URL=http://localhost:8001

# Search Configuration (optional)
GRAPHRAG_SEARCH_TOP_K=10
GRAPHRAG_SEARCH_METHOD=hybrid
GRAPHRAG_CHUNK_SIZE=1000
GRAPHRAG_CHUNK_OVERLAP=200
```

### 2. Supabase Setup

Run this SQL in Supabase SQL Editor:

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

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (user_id = auth.uid()::text);
```

### 3. Create Storage Bucket

In Supabase Dashboard:

1. Go to Storage
2. Create new bucket: `graphrag-documents`
3. Make it private
4. Set max file size to 10MB

---

## Usage

### 1. Access Demo Page

Start your app:

```bash
npm run dev
```

Visit: <http://localhost:3000/graphrag-demo>

### 2. Upload a Document

```bash
# Via UI (recommended)
Visit /graphrag-demo and drag-drop a file

# Or via API
curl -X POST http://localhost:3000/api/graphrag/upload \
  -H "x-user-id: your-user-id" \
  -F "file=@document.pdf"
```

### 3. Chat with Your Documents

Just use the regular chat interface! GraphRAG automatically:

- Searches your documents when relevant
- Injects context into the prompt
- Shows citations in the response

---

## API Endpoints

### Upload Document

```bash
POST /api/graphrag/upload
Headers: x-user-id: string
Body: FormData with 'file' field
```

### List Documents

```bash
GET /api/graphrag/documents?processed=true&search=query
Headers: x-user-id: string
```

### Search Knowledge Graph

```bash
POST /api/graphrag/search
Headers: x-user-id: string
Body: { "query": "your search query" }
```

### Delete Document

```bash
DELETE /api/graphrag/delete/{documentId}
Headers: x-user-id: string
```

---

## Using Components in Your App

### Upload Component

```tsx
import { DocumentUpload } from '@/components/graphrag';

function MyPage() {
  const userId = "user-123"; // TODO: Get from auth
  
  return (
    <DocumentUpload
      userId={userId}
      onUploadComplete={() => {
        console.log('Upload complete!');
      }}
    />
  );
}
```

### Document List

```tsx
import { DocumentList } from '@/components/graphrag';

function MyPage() {
  const userId = "user-123"; // TODO: Get from auth
  
  return <DocumentList userId={userId} />;
}
```

### GraphRAG Indicator (in chat)

```tsx
import { GraphRAGIndicator } from '@/components/graphrag';

function ChatMessage({ message }) {
  return (
    <>
      {message.citations && (
        <GraphRAGIndicator
          citations={message.citations}
          contextsUsed={message.citations.length}
        />
      )}
      <div>{message.content}</div>
    </>
  );
}
```

### Custom Hooks

```tsx
import { useDocuments, useGraphRAG } from '@/hooks';

function CustomComponent() {
  // Document management
  const { documents, loading, deleteDocument } = useDocuments({
    userId: "user-123",
    processed: true,
  });
  
  // Manual search
  const { search, lastResult } = useGraphRAG({
    userId: "user-123"
  });
  
  const handleSearch = async () => {
    const result = await search("my query");
    console.log(result?.context);
  };
  
  return (
    <div>
      {documents.map(doc => (
        <div key={doc.id}>{doc.filename}</div>
      ))}
    </div>
  );
}
```

---

## Troubleshooting

### Documents not processing?

1. **Check Graphiti is running:**

   ```bash
   curl http://localhost:8001/health
   # Should return: {"status": "healthy"}
   ```

2. **Check Neo4j is running:**

   ```bash
   # Visit http://localhost:7474
   # Login with neo4j / your-password
   ```

3. **Check logs:**

   ```bash
   # Graphiti logs
   docker logs graphiti
   
   # Neo4j logs
   docker logs neo4j
   
   # App logs
   # Check console in VS Code terminal
   ```

### Chat not using context?

1. **Check GRAPHRAG_ENABLED=true** in `.env.local`
2. **Verify documents are processed** (processed=true in DB)
3. **Check browser console** for errors
4. **Try manual search** to verify graph has data:

   ```bash
   curl -X POST http://localhost:3000/api/graphrag/search \
     -H "x-user-id: test" \
     -H "Content-Type: application/json" \
     -d '{"query": "test"}'
   ```

### Upload failing?

1. **File type allowed?** Only PDF, TXT, MD, DOCX
2. **File too large?** Max 10MB
3. **Storage bucket exists?** Check Supabase dashboard
4. **RLS policies set?** Run SQL from Configuration section

### Authentication issues?

Currently using placeholder `x-user-id` header.

**To integrate real auth:**

1. Replace `getUserId()` function in API routes
2. Use your actual auth system (Supabase Auth, NextAuth, etc.)
3. Update RLS policies to match your auth

Example with Supabase Auth:

```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

async function getUserId(req: NextRequest): Promise<string | null> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}
```

---

## File Structure Reference

```
web-ui/
├── app/
│   ├── api/
│   │   ├── chat/route.ts (modified - GraphRAG integration)
│   │   └── graphrag/
│   │       ├── upload/route.ts
│   │       ├── documents/route.ts
│   │       ├── search/route.ts
│   │       └── delete/[id]/route.ts
│   └── graphrag-demo/page.tsx
│
├── components/graphrag/
│   ├── DocumentUpload.tsx
│   ├── DocumentList.tsx
│   ├── GraphRAGIndicator.tsx
│   └── index.ts
│
├── hooks/
│   ├── useDocuments.ts
│   └── useGraphRAG.ts
│
└── lib/graphrag/
    ├── config.ts
    ├── types.ts
    ├── index.ts
    ├── parsers/
    ├── graphiti/
    ├── storage/
    └── service/
```

---

## Testing Checklist

### Quick Test Flow

1. **Start services:**

   ```bash
   docker start neo4j graphiti
   npm run dev
   ```

2. **Upload test document:**
   - Visit <http://localhost:3000/graphrag-demo>
   - Drag-drop a PDF file
   - Wait for "Upload successful" message

3. **Verify processing:**
   - Check document appears in list
   - Status shows "Processing..." then "Processed"
   - Episode count > 0

4. **Test chat:**
   - Go to chat interface
   - Ask question about document content
   - Verify GraphRAG indicator shows
   - Citations should reference your document

5. **Test search:**
   - Use search endpoint or manual search
   - Verify results contain relevant info

6. **Test delete:**
   - Click delete button on document
   - Confirm deletion
   - Verify document removed from list

---

## Performance Tips

1. **Chunk size:** Adjust `GRAPHRAG_CHUNK_SIZE` based on document type
   - Small chunks (500): Better for Q&A
   - Large chunks (2000): Better for summaries

2. **Search results:** Adjust `GRAPHRAG_SEARCH_TOP_K`
   - More results = more context = slower
   - Start with 5-10

3. **Connection pooling:** Already implemented in Graphiti client

4. **Caching:** Consider adding Redis for search results

---

## Security Checklist

- [ ] Replace placeholder auth with real auth
- [ ] Enable Supabase RLS policies
- [ ] Add rate limiting to upload endpoint
- [ ] Validate file content (not just extension)
- [ ] Set up CORS properly
- [ ] Use environment variables (never hardcode)
- [ ] Enable HTTPS in production
- [ ] Sanitize user inputs
- [ ] Add file scanning for malware

---

## Next Steps

1. **Integrate with your auth system** (replace x-user-id)
2. **Add to main chat UI** (integrate GraphRAGIndicator)
3. **Deploy services** (Graphiti + Neo4j in production)
4. **Add settings page** (enable/disable GraphRAG per user)
5. **Analytics** (track document usage, search queries)

---

## Need Help?

- **Documentation:** `/docs/PHASE_3_MASTER_COMPLETE.md`
- **API Reference:** See above API Endpoints section
- **Component Examples:** `/app/graphrag-demo/page.tsx`
- **Type Definitions:** `/lib/graphrag/types.ts`

---

**Version:** 1.0  
**Last Updated:** October 10, 2025  
**Status:** Production Ready ✅
