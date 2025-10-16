# GraphRAG Integration - Detailed Modular Plan

## Design Principles

1. **Modularity** - Each component is independent and replaceable
2. **Configurability** - Everything controlled via environment variables
3. **Optional** - GraphRAG can be disabled without breaking the app
4. **No Hardcoding** - All settings in config files
5. **Clean Separation** - Supabase ↔ Neo4j bridge is explicit

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Chat UI      │  │ Document UI  │  │ Settings UI      │  │
│  │ (existing)   │  │ (new)        │  │ (config toggle)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                  │                                 │
└─────────┼──────────────────┼─────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Routes Layer                       │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ /api/chat        │  │ /api/graphrag/*                  │ │
│  │ (enhanced)       │  │ (new endpoints)                  │ │
│  └────────┬─────────┘  └──────────────────────────────────┘ │
└───────────┼──────────────────────────────────────────────────┘
            │                         │
            ▼                         ▼
┌───────────────────────┐  ┌──────────────────────────────────┐
│  GraphRAG Service     │  │  Document Service                │
│  (Chat Integration)   │  │  (Upload/Process)                │
│  ┌─────────────────┐  │  │  ┌────────────────────────────┐ │
│  │ enhancePrompt() │  │  │  │ uploadAndProcess()         │ │
│  │ - Check if      │  │  │  │ - Upload to Supabase       │ │
│  │   enabled       │  │  │  │ - Parse file               │ │
│  │ - Search graph  │  │  │  │ - Send to Graphiti         │ │
│  │ - Inject context│  │  │  │ - Update status            │ │
│  │ - Format cites  │  │  │  └────────────────────────────┘ │
│  └─────────────────┘  │  └──────────────────────────────────┘
└───────────┬───────────┘              │
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage & Services Layer                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Search       │  │ Episode      │  │ Document         │  │
│  │ Service      │  │ Service      │  │ Storage          │  │
│  │ (Neo4j read) │  │ (Neo4j write)│  │ (Supabase CRUD)  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼──────────────────┼─────────────────────┼───────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
│   Graphiti       │  │   Graphiti       │  │   Supabase      │
│   REST API       │  │   REST API       │  │   PostgreSQL    │
│   (Search)       │  │   (Add Episodes) │  │   (Metadata)    │
│   Docker:8001    │  │   Docker:8001    │  │   Cloud         │
└────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘
         │                     │                      │
         ▼                     ▼                      │
┌─────────────────────────────────────────────┐      │
│          Neo4j Graph Database               │      │
│          (Knowledge Graph)                  │      │
│          Docker: 7474, 7687                 │      │
└─────────────────────────────────────────────┘      │
                                                      │
                                              ┌───────▼────────┐
                                              │ Supabase       │
                                              │ Storage        │
                                              │ (File Buckets) │
                                              └────────────────┘
```

---

## Phase 3.6: GraphRAG Chat Service (~30 min)

### Purpose

Integrate GraphRAG context injection into existing chat workflow

### Files to Create

#### 1. `lib/graphrag/service/graphrag-service.ts` (~150 lines)

**Responsibilities:**

- Check if GraphRAG is enabled (config)
- Search knowledge graph for relevant context
- Format context for LLM prompt injection
- Handle citations and sources
- Respect token budget

**Key Methods:**

```typescript
class GraphRAGService {
  private config = graphragConfig;
  private searchService = searchService;
  
  /**
   * Main method: Enhance user prompt with document context
   */
  async enhancePrompt(
    userId: string,
    userMessage: string,
    conversationHistory?: Message[],
    options?: EnhanceOptions
  ): Promise<EnhancedPrompt> {
    // 1. Check if enabled
    if (!this.config.enabled) {
      return { 
        prompt: userMessage, 
        contextsUsed: false 
      };
    }
    
    // 2. Search knowledge graph
    const searchResults = await this.searchService.search(
      userMessage,
      userId,
      { topK: options?.maxSources || 5 }
    );
    
    // 3. Format context
    const context = this.formatContext(searchResults);
    
    // 4. Inject into prompt
    const enhancedPrompt = this.injectContext(
      userMessage, 
      context
    );
    
    // 5. Return with metadata
    return {
      prompt: enhancedPrompt,
      contextUsed: true,
      sources: searchResults.sources,
      metadata: searchResults.metadata
    };
  }
  
  /**
   * Format search results into LLM-friendly context
   */
  private formatContext(results: SearchResult): string {
    // Format with proper structure
    // Include source attribution
    // Respect token limits
  }
  
  /**
   * Inject context into user prompt
   */
  private injectContext(
    userMessage: string, 
    context: string
  ): string {
    return `You have access to the user's documents. Use this context to answer their question.

CONTEXT FROM USER'S DOCUMENTS:
${context}

USER'S QUESTION:
${userMessage}

Please answer based on the provided context. If the context doesn't contain relevant information, say so.`;
  }
  
  /**
   * Format citations for display
   */
  formatCitations(sources: SearchSource[]): Citation[] {
    // Convert to user-friendly format
    // Group by document
    // Include confidence scores
  }
  
  /**
   * Check if GraphRAG should be used for this query
   */
  shouldUseGraphRAG(message: string): boolean {
    // Heuristics: question words, document references, etc.
    // Configurable keywords
    // Can be disabled per-conversation
  }
}
```

**Configuration:**

```typescript
interface EnhanceOptions {
  maxSources?: number;        // Max documents to include
  minConfidence?: number;     // Filter low-confidence results
  maxTokens?: number;         // Context token budget
  includeMetadata?: boolean;  // Include doc metadata
  format?: 'structured' | 'narrative'; // Context format
}
```

**Modularity:**

- ✅ Can be disabled via `graphragConfig.enabled`
- ✅ Fallback to normal chat if disabled
- ✅ Injectable configuration
- ✅ Independent of chat API

---

## Phase 3.7: API Routes (~45 min)

### Purpose

RESTful endpoints for GraphRAG operations

### Files to Create

#### 1. `app/api/graphrag/upload/route.ts` (~80 lines)

**Endpoint:** `POST /api/graphrag/upload`

**Responsibilities:**

- Handle file upload
- Validate file type/size
- Call documentService
- Return upload status

**Flow:**

```typescript
export async function POST(request: Request) {
  // 1. Auth check (use existing pattern)
  const user = await getUser(request);
  if (!user) return unauthorized();
  
  // 2. Parse multipart form data
  const formData = await request.formData();
  const file = formData.get('file') as File;
  
  // 3. Validate
  if (!file) return badRequest('No file provided');
  if (file.size > MAX_FILE_SIZE) return badRequest('File too large');
  
  // 4. Upload and process
  const result = await documentService.uploadAndProcess({
    userId: user.id,
    file,
    metadata: {
      uploadedAt: new Date().toISOString(),
      tags: formData.get('tags')?.toString().split(',') || []
    }
  });
  
  // 5. Return result
  return NextResponse.json(result);
}
```

**Configuration:**

- File size limits from config
- Allowed file types from config
- Optional auto-processing toggle

---

#### 2. `app/api/graphrag/documents/route.ts` (~60 lines)

**Endpoint:** `GET /api/graphrag/documents`

**Responsibilities:**

- List user's documents
- Support pagination
- Support filtering

**Flow:**

```typescript
export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  
  // Parse query params
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const fileType = searchParams.get('type') as DocumentFileType;
  const processed = searchParams.get('processed') === 'true';
  
  // Get documents
  let documents = await documentStorage.getUserDocuments(user.id);
  
  // Filter if needed
  if (fileType) {
    documents = documents.filter(d => d.fileType === fileType);
  }
  if (processed !== undefined) {
    documents = documents.filter(d => d.processed === processed);
  }
  
  // Paginate
  const start = (page - 1) * limit;
  const paginatedDocs = documents.slice(start, start + limit);
  
  return NextResponse.json({
    documents: paginatedDocs,
    total: documents.length,
    page,
    limit
  });
}
```

---

#### 3. `app/api/graphrag/search/route.ts` (~70 lines)

**Endpoint:** `POST /api/graphrag/search`

**Responsibilities:**

- Search knowledge graph
- Return formatted results
- Support different search modes

**Flow:**

```typescript
export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  
  const { query, options } = await request.json();
  
  // Search
  const results = await searchService.search(
    query,
    user.id,
    options
  );
  
  return NextResponse.json(results);
}
```

---

#### 4. `app/api/graphrag/delete/[id]/route.ts` (~50 lines)

**Endpoint:** `DELETE /api/graphrag/delete/:id`

**Responsibilities:**

- Delete document
- Optional cleanup (storage + Neo4j)
- Verify ownership

**Flow:**

```typescript
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getUser(request);
  if (!user) return unauthorized();
  
  const documentId = params.id;
  const { searchParams } = new URL(request.url);
  const cleanupStorage = searchParams.get('storage') === 'true';
  const cleanupNeo4j = searchParams.get('neo4j') === 'true';
  
  // Verify ownership
  const doc = await documentStorage.getDocument(documentId);
  if (!doc || doc.userId !== user.id) {
    return forbidden();
  }
  
  // Delete
  await documentService.deleteDocument(documentId, {
    deleteFromStorage: cleanupStorage,
    deleteFromNeo4j: cleanupNeo4j
  });
  
  return NextResponse.json({ success: true });
}
```

**Configuration:**

- Default cleanup behavior from config
- Soft delete vs hard delete option

---

#### 5. `app/api/chat/route.ts` (MODIFY EXISTING)

**Changes:**

- Integrate GraphRAG service
- Check if GraphRAG enabled
- Enhance prompt before LLM call

**Modification:**

```typescript
export async function POST(request: Request) {
  const user = await getUser(request);
  const { messages } = await request.json();
  
  const userMessage = messages[messages.length - 1].content;
  
  // ✨ NEW: GraphRAG enhancement
  let enhancedPrompt = userMessage;
  let graphRAGMetadata = null;
  
  if (graphragConfig.enabled && user) {
    const enhanced = await graphragService.enhancePrompt(
      user.id,
      userMessage,
      messages.slice(0, -1) // conversation history
    );
    
    if (enhanced.contextUsed) {
      enhancedPrompt = enhanced.prompt;
      graphRAGMetadata = {
        sources: enhanced.sources,
        metadata: enhanced.metadata
      };
    }
  }
  
  // Continue with existing chat logic...
  const response = await callLLM(enhancedPrompt, ...);
  
  // Include GraphRAG metadata in response
  return NextResponse.json({
    response,
    graphRAG: graphRAGMetadata
  });
}
```

**Modularity:**

- ✅ Only runs if enabled
- ✅ Doesn't break if GraphRAG fails
- ✅ Falls back to normal chat

---

## Phase 3.8: React Components (~2 hours)

### Purpose

User interface for document management and GraphRAG features

### Files to Create

#### 1. `components/graphrag/DocumentUpload.tsx` (~120 lines)

**Responsibilities:**

- Drag-and-drop file upload
- File type validation
- Upload progress
- Success/error feedback

**Features:**

```tsx
export function DocumentUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleDrop = async (files: File[]) => {
    for (const file of files) {
      // Validate
      if (!isValidFileType(file)) {
        toast.error(`${file.name}: Unsupported type`);
        continue;
      }
      
      // Upload
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/graphrag/upload', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        toast.success(`${file.name} uploaded successfully!`);
      } catch (error) {
        toast.error(`Failed to upload ${file.name}`);
      } finally {
        setUploading(false);
      }
    }
  };
  
  return (
    <div 
      onDrop={handleDrop}
      className="border-2 border-dashed p-8"
    >
      {uploading ? (
        <ProgressBar value={progress} />
      ) : (
        <div>Drop files here or click to browse</div>
      )}
    </div>
  );
}
```

**Configuration:**

- Accepted file types from config
- Max file size from config
- Auto-process toggle

---

#### 2. `components/graphrag/DocumentList.tsx` (~150 lines)

**Responsibilities:**

- Display uploaded documents
- Show processing status
- Delete/reprocess actions
- Search/filter

**Features:**

```tsx
export function DocumentList() {
  const { user } = useAuth();
  const { documents, loading, refresh } = useDocuments(user?.id);
  const [filter, setFilter] = useState<'all' | 'processed' | 'pending'>('all');
  
  const filteredDocs = documents.filter(doc => {
    if (filter === 'processed') return doc.processed;
    if (filter === 'pending') return !doc.processed;
    return true;
  });
  
  return (
    <div>
      <DocumentFilters 
        filter={filter} 
        onChange={setFilter} 
      />
      
      <div className="space-y-2">
        {filteredDocs.map(doc => (
          <DocumentCard 
            key={doc.id}
            document={doc}
            onDelete={() => handleDelete(doc.id)}
            onReprocess={() => handleReprocess(doc.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

---

#### 3. `components/graphrag/GraphRAGIndicator.tsx` (~60 lines)

**Responsibilities:**

- Show when GraphRAG is active
- Display sources used
- Toggle GraphRAG on/off

**Features:**

```tsx
export function GraphRAGIndicator({ 
  sources, 
  enabled, 
  onToggle 
}: GraphRAGIndicatorProps) {
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-blue-500">
        🔗 Using {sources.length} document sources
      </span>
      
      <button onClick={() => setShowSources(!showSources)}>
        View sources
      </button>
      
      {showSources && (
        <SourcesList sources={sources} />
      )}
      
      <Switch 
        checked={enabled} 
        onChange={onToggle}
        label="Use documents"
      />
    </div>
  );
}
```

---

#### 4. `hooks/useDocuments.ts` (~100 lines)

**Responsibilities:**

- Fetch user documents
- Handle upload
- Handle delete
- Real-time updates

**Implementation:**

```typescript
export function useDocuments(userId?: string) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  
  const fetchDocuments = async () => {
    if (!userId) return;
    
    const response = await fetch('/api/graphrag/documents');
    const data = await response.json();
    setDocuments(data.documents);
    setLoading(false);
  };
  
  const uploadDocument = async (file: File, metadata?: any) => {
    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }
    
    const response = await fetch('/api/graphrag/upload', {
      method: 'POST',
      body: formData
    });
    
    await fetchDocuments(); // Refresh list
    return response.json();
  };
  
  const deleteDocument = async (documentId: string) => {
    await fetch(`/api/graphrag/delete/${documentId}`, {
      method: 'DELETE'
    });
    
    await fetchDocuments(); // Refresh list
  };
  
  useEffect(() => {
    fetchDocuments();
  }, [userId]);
  
  return {
    documents,
    loading,
    uploadDocument,
    deleteDocument,
    refresh: fetchDocuments
  };
}
```

---

#### 5. `hooks/useGraphRAG.ts` (~80 lines)

**Responsibilities:**

- Enable/disable GraphRAG
- Search documents
- Get status

**Implementation:**

```typescript
export function useGraphRAG(userId?: string) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem('graphrag-enabled') === 'true'
  );
  
  const toggleGraphRAG = (value: boolean) => {
    setEnabled(value);
    localStorage.setItem('graphrag-enabled', String(value));
  };
  
  const searchDocuments = async (query: string, options?: SearchOptions) => {
    const response = await fetch('/api/graphrag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, options })
    });
    
    return response.json();
  };
  
  return {
    enabled,
    toggleGraphRAG,
    searchDocuments
  };
}
```

---

## Configuration System

### Environment Variables (`.env.local`)

```bash
# GraphRAG Enable/Disable
NEXT_PUBLIC_GRAPHRAG_ENABLED=true

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
NEO4J_DATABASE=neo4j

# Graphiti API
GRAPHITI_API_URL=http://localhost:8001
GRAPHITI_API_TIMEOUT=30000

# Document Processing
GRAPHRAG_MAX_FILE_SIZE=10485760  # 10MB
GRAPHRAG_CHUNK_SIZE=2000
GRAPHRAG_MAX_RETRIES=3
GRAPHRAG_SUPPORTED_TYPES=pdf,docx,txt,md

# Search Configuration
GRAPHRAG_SEARCH_TOP_K=5
GRAPHRAG_SEARCH_METHOD=hybrid  # semantic | keyword | hybrid
GRAPHRAG_SEARCH_THRESHOLD=0.7
```

### Runtime Config (`lib/graphrag/config.ts`)

Already created! Uses env vars with fallbacks.

---

## Modularity Checklist

### ✅ Independent Components

- Each service can work standalone
- No tight coupling between layers
- Clear interfaces between components

### ✅ Configuration Driven

- All settings in environment variables
- No hardcoded values
- Runtime configuration validation

### ✅ Optional Features

- GraphRAG can be completely disabled
- App works normally without it
- Graceful degradation if services fail

### ✅ Replaceable Parts

- Supabase → Could swap for another DB
- Neo4j → Could swap for another graph DB
- Graphiti → Could swap for custom implementation
- Parsers → Can add new file types easily

### ✅ Clean Separation

- UI → API → Services → Storage
- Each layer has clear responsibilities
- No direct database access from UI

---

## Testing Strategy

### Unit Tests

- Each service method independently
- Mock external dependencies
- Test error handling

### Integration Tests

- Upload → Process → Search workflow
- API endpoints with test user
- Database operations

### E2E Tests

- Full user journey
- Upload document via UI
- Search and get results
- Delete document

---

## Deployment Checklist

### 1. Environment Setup

```bash
# Copy and configure
cp .env.example .env.local

# Set all required variables
# Especially: NEO4J_*, GRAPHITI_API_URL
```

### 2. Database Setup

```bash
# Run Supabase migrations
supabase db push

# Start Neo4j + Graphiti
docker-compose -f docker-compose.graphrag.yml up -d
```

### 3. Verify Services

```bash
# Check Neo4j
curl http://localhost:7474

# Check Graphiti
curl http://localhost:8001/health
```

### 4. Test Upload

- Upload a test document
- Verify it appears in Supabase
- Verify episodes created in Neo4j
- Test search functionality

---

## Rollout Strategy

### Phase 1: Backend Only

- Deploy Phase 3.6-3.7 (services + API)
- Test with API calls
- Verify data flow

### Phase 2: Basic UI

- Deploy DocumentUpload component
- Deploy DocumentList component
- Test upload workflow

### Phase 3: Chat Integration

- Enable GraphRAG in chat
- Add indicator to show when active
- Gather user feedback

### Phase 4: Full Features

- Add advanced search UI
- Add document management features
- Optimize performance

---

## Success Metrics

### Technical

- ✅ 0 TypeScript errors
- ✅ All API endpoints return 200
- ✅ Documents successfully processed
- ✅ Search returns relevant results
- ✅ <500ms average response time

### User Experience

- ✅ Upload succeeds in <10 seconds
- ✅ Chat responses include document context
- ✅ Sources are correctly cited
- ✅ UI is responsive and intuitive

---

**This plan ensures:**

1. **Modularity** - Each piece can be developed/tested/deployed independently
2. **Configurability** - Everything controlled via env vars and config
3. **Maintainability** - Clear separation of concerns
4. **Scalability** - Can add features without rewriting
5. **Reliability** - Graceful degradation and error handling

Ready to execute whenever you are! 🚀
