# ⚠️ DEPRECATED - Phase 3: RAG System - Implementation Plan

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This RAG system plan has been fully implemented and superseded by the GraphRAG implementation.
>
> **SUPERSEDED BY:**
> - `PHASE_3_MASTER_COMPLETE.md` (complete GraphRAG implementation)
> - `PHASE_3_GRAPHRAG_PLAN.md` (evolved into GraphRAG approach)
>
> **DO NOT USE THIS PLAN** - Use GraphRAG implementation instead.

---

# Phase 3: RAG System - Implementation Plan

## 🎯 Objectives

Implement a complete RAG (Retrieval-Augmented Generation) system that allows users to:

1. **Upload Documents** - PDF, TXT, MD, DOCX files
2. **Process & Embed** - Extract text, chunk intelligently, generate embeddings
3. **Store Vectors** - Save to Supabase vector store (pgvector)
4. **Semantic Search** - Find relevant document chunks for context
5. **Chat Integration** - Automatically inject relevant context into AI responses

## 🏗️ Architecture Overview

```
┌─────────────────┐
│  User Uploads   │
│   Document      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Document Parser │  ← Extracts text from PDF/DOCX/etc
│  - PDF Parser   │
│  - Text Parser  │
│  - DOCX Parser  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Text Chunker    │  ← Intelligent chunking with overlap
│  - Recursive    │
│  - Semantic     │
│  - Token-aware  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Embedding Gen   │  ← OpenAI text-embedding-3-small
│  - Batch API    │
│  - Rate Limit   │
│  - Retry Logic  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Store    │  ← Supabase pgvector
│  - documents    │
│  - chunks       │
│  - metadata     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Semantic Search │  ← Query → Relevant chunks
│  - Similarity   │
│  - Re-ranking   │
│  - Context      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Chat System    │  ← Inject context into prompts
│  - Auto RAG     │
│  - Citations    │
│  - Fallback     │
└─────────────────┘
```

## 📊 Database Schema (Supabase)

### Table: `documents`

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf', 'txt', 'md', 'docx'
  upload_path TEXT NOT NULL, -- Supabase Storage path
  total_chunks INTEGER DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}', -- author, title, tags, etc.
  
  -- Indexes
  INDEX idx_documents_user_id ON documents(user_id),
  INDEX idx_documents_created_at ON documents(created_at DESC)
);
```

### Table: `document_chunks`

```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_length INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}', -- page, section, headers, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_chunks_document_id ON document_chunks(document_id),
  INDEX idx_chunks_document_chunk ON document_chunks(document_id, chunk_index),
  
  -- Vector similarity search index
  INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
);
```

### Table: `rag_queries`

```sql
CREATE TABLE rag_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_embedding VECTOR(1536),
  matched_chunks UUID[] DEFAULT '{}', -- Array of chunk IDs
  retrieval_count INTEGER DEFAULT 0,
  retrieval_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_queries_user_id ON rag_queries(user_id),
  INDEX idx_queries_created_at ON rag_queries(created_at DESC)
);
```

### Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### RLS Policies

```sql
-- Documents: Users can only access their own documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON documents FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid() = user_id);

-- Document Chunks: Access via documents
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks of their documents"
  ON document_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- RAG Queries: Users can only access their own queries
ALTER TABLE rag_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own queries"
  ON rag_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own queries"
  ON rag_queries FOR SELECT
  USING (auth.uid() = user_id);
```

## 📁 File Structure

```
lib/
├── rag/
│   ├── types.ts                    # Shared interfaces
│   ├── config.ts                   # RAG configuration (env vars)
│   ├── index.ts                    # Main exports
│   │
│   ├── parsers/                    # Document parsers
│   │   ├── index.ts
│   │   ├── pdf-parser.ts           # PDF → Text
│   │   ├── text-parser.ts          # TXT/MD → Text
│   │   ├── docx-parser.ts          # DOCX → Text
│   │   └── parser-factory.ts       # Factory pattern
│   │
│   ├── chunking/                   # Text chunking strategies
│   │   ├── index.ts
│   │   ├── recursive-chunker.ts    # Recursive text splitting
│   │   ├── semantic-chunker.ts     # Semantic-aware chunking
│   │   ├── token-chunker.ts        # Token-count-based chunking
│   │   └── chunker-factory.ts
│   │
│   ├── embeddings/                 # Embedding generation
│   │   ├── index.ts
│   │   ├── openai-embedder.ts      # OpenAI API
│   │   ├── batch-embedder.ts       # Batch processing
│   │   └── embedding-cache.ts      # Cache for repeated text
│   │
│   ├── storage/                    # Database operations
│   │   ├── index.ts
│   │   ├── document-storage.ts     # documents table
│   │   ├── chunk-storage.ts        # document_chunks table
│   │   ├── query-storage.ts        # rag_queries table
│   │   └── vector-search.ts        # Similarity search
│   │
│   ├── retrieval/                  # RAG retrieval logic
│   │   ├── index.ts
│   │   ├── retriever.ts            # Main retrieval
│   │   ├── re-ranker.ts            # Re-rank results
│   │   ├── context-builder.ts      # Build context string
│   │   └── hybrid-search.ts        # Vector + keyword
│   │
│   └── service/                    # High-level services
│       ├── index.ts
│       ├── document-service.ts     # Upload, process, delete
│       ├── rag-service.ts          # Query, retrieve, integrate
│       └── admin-service.ts        # Stats, maintenance
│
components/
├── rag/
│   ├── DocumentUpload.tsx          # Drag-drop upload
│   ├── DocumentList.tsx            # List user's documents
│   ├── DocumentViewer.tsx          # View document details
│   ├── RAGSettings.tsx             # Configure RAG
│   └── RAGIndicator.tsx            # Show when RAG is active
│
hooks/
├── useDocuments.ts                 # Document management
├── useRAG.ts                       # RAG operations
└── useFileUpload.ts                # File upload logic
│
app/
└── api/
    └── rag/
        ├── upload/
        │   └── route.ts            # POST /api/rag/upload
        ├── process/
        │   └── route.ts            # POST /api/rag/process/:id
        ├── documents/
        │   └── route.ts            # GET /api/rag/documents
        ├── search/
        │   └── route.ts            # POST /api/rag/search
        └── delete/
            └── route.ts            # DELETE /api/rag/delete/:id
```

## 🔧 Implementation Phases

### **Phase 3.1: Core Infrastructure** (~150 lines)

**Estimated Time:** 30 minutes

**Files to Create:**

1. `lib/rag/types.ts` - All interfaces
2. `lib/rag/config.ts` - Configuration with env vars
3. `lib/rag/index.ts` - Exports
4. Database schema SQL file

**Key Interfaces:**

```typescript
interface Document {
  id: string;
  userId: string;
  filename: string;
  fileSize: number;
  fileType: 'pdf' | 'txt' | 'md' | 'docx';
  uploadPath: string;
  totalChunks: number;
  processedAt?: Date;
  metadata: Record<string, unknown>;
}

interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentLength: number;
  tokenCount: number;
  embedding?: number[];
  metadata: Record<string, unknown>;
}

interface RAGConfig {
  enabled: boolean;
  chunkSize: number;
  chunkOverlap: number;
  maxDocumentSize: number;
  embeddingModel: string;
  topK: number;
}
```

**Verification:**

- [ ] All interfaces defined
- [ ] Config uses env vars only
- [ ] No hardcoded values
- [ ] TypeScript compiles

---

### **Phase 3.2: Document Parsers** (~200 lines)

**Estimated Time:** 45 minutes

**Files to Create:**

1. `lib/rag/parsers/pdf-parser.ts`
2. `lib/rag/parsers/text-parser.ts`
3. `lib/rag/parsers/docx-parser.ts`
4. `lib/rag/parsers/parser-factory.ts`
5. `lib/rag/parsers/index.ts`

**Dependencies to Install:**

```bash
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

**Key Features:**

- PDF: Extract text with page metadata
- DOCX: Extract text preserving structure
- TXT/MD: Read raw text
- Factory: Auto-select parser by file type

**Verification:**

- [ ] PDF parsing works
- [ ] DOCX parsing works
- [ ] Text files handled
- [ ] Factory selects correct parser
- [ ] No errors on TypeScript compile

---

### **Phase 3.3: Text Chunking** (~250 lines)

**Estimated Time:** 60 minutes

**Files to Create:**

1. `lib/rag/chunking/recursive-chunker.ts`
2. `lib/rag/chunking/token-chunker.ts`
3. `lib/rag/chunking/chunker-factory.ts`
4. `lib/rag/chunking/index.ts`

**Dependencies to Install:**

```bash
npm install tiktoken
```

**Chunking Strategies:**

- **Recursive:** Split by paragraphs, then sentences, then characters
- **Token-based:** Split by token count with overlap
- **Smart overlap:** Preserve sentence boundaries

**Configuration:**

```typescript
{
  chunkSize: 500,        // tokens per chunk
  chunkOverlap: 50,      // overlap tokens
  separators: ['\n\n', '\n', '. ', ' '],
  preserveBoundaries: true
}
```

**Verification:**

- [ ] Chunks respect size limits
- [ ] Overlap works correctly
- [ ] Sentence boundaries preserved
- [ ] Token counting accurate
- [ ] No TypeScript errors

---

### **Phase 3.4: Embedding Generation** (~180 lines)

**Estimated Time:** 45 minutes

**Files to Create:**

1. `lib/rag/embeddings/openai-embedder.ts`
2. `lib/rag/embeddings/batch-embedder.ts`
3. `lib/rag/embeddings/embedding-cache.ts`
4. `lib/rag/embeddings/index.ts`

**OpenAI Configuration:**

- Model: `text-embedding-3-small` (1536 dimensions)
- Batch size: 100 chunks per request
- Rate limiting: 3000 RPM
- Retry logic: Exponential backoff

**Features:**

- Batch processing for efficiency
- Cache to avoid re-embedding identical text
- Progress tracking
- Error handling with retries

**Verification:**

- [ ] Embeddings generated correctly
- [ ] Batch processing works
- [ ] Rate limiting respected
- [ ] Cache prevents duplicates
- [ ] Errors handled gracefully

---

### **Phase 3.5: Vector Storage** (~300 lines)

**Estimated Time:** 60 minutes

**Files to Create:**

1. `lib/rag/storage/document-storage.ts`
2. `lib/rag/storage/chunk-storage.ts`
3. `lib/rag/storage/query-storage.ts`
4. `lib/rag/storage/vector-search.ts`
5. `lib/rag/storage/index.ts`

**Database Operations:**

- **document-storage:** CRUD for documents table
- **chunk-storage:** Insert chunks with embeddings
- **vector-search:** Cosine similarity search
- **query-storage:** Log RAG queries for analytics

**Vector Search Function:**

```sql
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE (filter_document_ids IS NULL OR document_id = ANY(filter_document_ids))
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Verification:**

- [ ] Documents stored correctly
- [ ] Chunks with embeddings inserted
- [ ] Vector search returns similar chunks
- [ ] RLS policies enforced
- [ ] No SQL errors

---

### **Phase 3.6: Document Service** (~250 lines)

**Estimated Time:** 60 minutes

**Files to Create:**

1. `lib/rag/service/document-service.ts`
2. `lib/rag/service/index.ts`

**High-Level Operations:**

```typescript
class DocumentService {
  async uploadDocument(file: File, userId: string): Promise<Document>
  async processDocument(documentId: string): Promise<void>
  async getDocuments(userId: string): Promise<Document[]>
  async deleteDocument(documentId: string): Promise<void>
  async getDocumentStatus(documentId: string): Promise<ProcessingStatus>
}
```

**Upload Flow:**

1. Validate file (type, size)
2. Upload to Supabase Storage
3. Create document record
4. Return document ID
5. Background: Parse → Chunk → Embed → Store

**Verification:**

- [ ] File upload works
- [ ] Storage integration correct
- [ ] Document records created
- [ ] Processing async
- [ ] Error handling complete

---

### **Phase 3.7: RAG Retrieval** (~280 lines)

**Estimated Time:** 60 minutes

**Files to Create:**

1. `lib/rag/retrieval/retriever.ts`
2. `lib/rag/retrieval/context-builder.ts`
3. `lib/rag/retrieval/re-ranker.ts`
4. `lib/rag/retrieval/index.ts`

**Retrieval Pipeline:**

```typescript
class RAGRetriever {
  async retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult> {
    // 1. Generate query embedding
    const queryEmbedding = await this.embedder.embed(query);
    
    // 2. Vector similarity search
    const chunks = await this.vectorSearch.search(queryEmbedding, {
      topK: options?.topK || 5,
      threshold: options?.threshold || 0.7,
    });
    
    // 3. Re-rank results (optional)
    const reranked = await this.reRanker.rerank(query, chunks);
    
    // 4. Build context string
    const context = this.contextBuilder.build(reranked);
    
    // 5. Log query
    await this.queryStorage.log(query, queryEmbedding, chunks);
    
    return { context, chunks, metadata };
  }
}
```

**Context Building:**

- Format chunks with source attribution
- Add metadata (filename, page number)
- Deduplicate overlapping content
- Stay within token limits

**Verification:**

- [ ] Retrieval returns relevant chunks
- [ ] Context properly formatted
- [ ] Token limits respected
- [ ] Citations included
- [ ] Queries logged

---

### **Phase 3.8: API Routes** (~200 lines)

**Estimated Time:** 45 minutes

**Files to Create:**

1. `app/api/rag/upload/route.ts`
2. `app/api/rag/process/[id]/route.ts`
3. `app/api/rag/documents/route.ts`
4. `app/api/rag/search/route.ts`
5. `app/api/rag/delete/[id]/route.ts`

**API Endpoints:**

**POST /api/rag/upload**

- Upload file
- Returns: `{ documentId, filename, status }`

**POST /api/rag/process/:id**

- Trigger processing
- Returns: `{ status, progress, chunks }`

**GET /api/rag/documents**

- List user's documents
- Returns: `{ documents: Document[] }`

**POST /api/rag/search**

- Semantic search
- Body: `{ query, topK?, threshold? }`
- Returns: `{ chunks, context, metadata }`

**DELETE /api/rag/delete/:id**

- Delete document + chunks
- Returns: `{ success: boolean }`

**Verification:**

- [ ] All endpoints work
- [ ] Auth middleware applied
- [ ] Error handling complete
- [ ] Response types correct

---

### **Phase 3.9: React Components** (~350 lines)

**Estimated Time:** 90 minutes

**Files to Create:**

1. `components/rag/DocumentUpload.tsx`
2. `components/rag/DocumentList.tsx`
3. `components/rag/DocumentViewer.tsx`
4. `components/rag/RAGSettings.tsx`
5. `components/rag/RAGIndicator.tsx`

**Component Features:**

**DocumentUpload:**

- Drag & drop zone
- File type validation
- Upload progress bar
- Success/error feedback

**DocumentList:**

- Table of documents
- Sort/filter options
- Status indicators (processing, ready)
- Delete confirmation

**DocumentViewer:**

- Show document metadata
- List chunks with preview
- Search within document
- Download original

**RAGSettings:**

- Enable/disable RAG
- Chunk size configuration
- Top-K results slider
- Similarity threshold

**RAGIndicator:**

- Show when RAG is active in chat
- Display sources used
- Confidence scores

**Verification:**

- [ ] Upload works end-to-end
- [ ] Document list displays
- [ ] Settings save correctly
- [ ] Indicator shows in chat
- [ ] No console errors

---

### **Phase 3.10: React Hooks** (~200 lines)

**Estimated Time:** 45 minutes

**Files to Create:**

1. `hooks/useDocuments.ts`
2. `hooks/useRAG.ts`
3. `hooks/useFileUpload.ts`

**Hook Features:**

**useDocuments:**

```typescript
const {
  documents,
  loading,
  uploadDocument,
  deleteDocument,
  refreshDocuments
} = useDocuments();
```

**useRAG:**

```typescript
const {
  search,
  results,
  context,
  searching,
  ragEnabled,
  toggleRAG
} = useRAG();
```

**useFileUpload:**

```typescript
const {
  upload,
  progress,
  error,
  reset
} = useFileUpload();
```

**Verification:**

- [ ] Hooks work with components
- [ ] State management correct
- [ ] Error handling complete
- [ ] Loading states work

---

### **Phase 3.11: Chat Integration** (~150 lines)

**Estimated Time:** 45 minutes

**Files to Modify:**

1. `app/api/chat/route.ts` - Add RAG context
2. `components/ChatInterface.tsx` - Show RAG indicator
3. `lib/chat/chatService.ts` - Integrate retrieval

**Integration Logic:**

```typescript
// Before sending to OpenAI
if (ragEnabled && userMessage) {
  const { context, chunks } = await ragRetriever.retrieve(userMessage);
  
  if (context) {
    // Inject context into system message
    systemMessage = `${baseSystemMessage}

Use the following context from the user's documents to answer questions:

${context}

If the context is relevant, cite the sources. If not relevant, answer normally.`;
    
    // Store chunks for citation
    metadata.ragChunks = chunks;
  }
}
```

**Verification:**

- [ ] RAG context injected
- [ ] Citations shown
- [ ] Indicator displays
- [ ] Fallback works without RAG
- [ ] No breaking changes

---

### **Phase 3.12: Testing & Documentation** (~100 lines)

**Estimated Time:** 30 minutes

**Files to Create:**

1. `tests/rag/chunking.test.ts`
2. `tests/rag/embeddings.test.ts`
3. `tests/rag/retrieval.test.ts`
4. `docs/RAG_USAGE.md`
5. `docs/RAG_ARCHITECTURE.md`

**Test Coverage:**

- Chunking with various inputs
- Embedding generation
- Vector search accuracy
- End-to-end upload flow

**Documentation:**

- User guide for uploading documents
- Configuration options
- Troubleshooting guide
- Architecture overview

**Verification:**

- [ ] All tests pass
- [ ] Documentation complete
- [ ] No TypeScript errors
- [ ] Ready for production

---

## 🔐 Security Considerations

1. **File Upload Security:**
   - Validate file types (whitelist)
   - Scan for malicious content
   - Limit file sizes
   - Sanitize filenames

2. **RLS Policies:**
   - Users can only access their documents
   - Enforce at database level
   - No data leakage between users

3. **API Security:**
   - Authentication required
   - Rate limiting
   - Input validation
   - CORS configuration

4. **Storage Security:**
   - Private Supabase Storage buckets
   - Signed URLs for file access
   - Automatic cleanup of deleted documents

---

## 📦 Dependencies to Install

```bash
# Document parsing
npm install pdf-parse mammoth

# Token counting
npm install tiktoken

# Type definitions
npm install --save-dev @types/pdf-parse
```

---

## 🔢 Estimated Totals

- **Total Files:** ~45 files
- **Total Lines:** ~2,600 lines
- **Total Time:** ~10-12 hours
- **Phases:** 12 phases

---

## ✅ Success Criteria

- [ ] Users can upload PDF, TXT, MD, DOCX files
- [ ] Documents are parsed and chunked correctly
- [ ] Embeddings generated and stored in pgvector
- [ ] Semantic search returns relevant chunks
- [ ] Chat system uses RAG context automatically
- [ ] Citations shown for document-based answers
- [ ] All features configurable via environment variables
- [ ] Zero hardcoded values
- [ ] Modular and extensible architecture
- [ ] Comprehensive error handling
- [ ] Full TypeScript type safety

---

## 🚀 Ready to Start?

Confirm and we'll begin with **Phase 3.1: Core Infrastructure**!
