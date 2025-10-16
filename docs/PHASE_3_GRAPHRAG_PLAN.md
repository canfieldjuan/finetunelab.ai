# ⚠️ DEPRECATED - Phase 3: GraphRAG with Graphiti & Neo4j - Simplified Implementation Plan

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This GraphRAG plan has been fully implemented and superseded by the completion document.
>
> **SUPERSEDED BY:**
> - `PHASE_3_MASTER_COMPLETE.md` (complete GraphRAG implementation)
>
> **DO NOT USE THIS PLAN** - Implementation is complete. See completion document for actual implementation details.

---

# Phase 3: GraphRAG with Graphiti & Neo4j - Simplified Implementation Plan

## 🎯 Why Graphiti is WAY Better

**Traditional RAG (Our Old Plan):** 45 files, 2,600 lines, manual chunking, static embeddings
**Graphiti GraphRAG:** ~15 files, ~800 lines, automatic relationships, temporal awareness, self-updating

### Key Advantages

✅ **Automatic Relationship Building** - Graphiti extracts entities and relationships automatically
✅ **Temporal Awareness** - Tracks when data was added, handles contradictions over time  
✅ **Self-Updating** - Updates existing nodes when new info arrives, keeps diffs
✅ **No Manual Chunking** - Just feed it text, it handles the rest
✅ **Graph Traversal** - Find connections traditional RAG misses
✅ **Hybrid Search** - Semantic + keyword + graph traversal combined
✅ **Incremental Updates** - No batch reprocessing needed

## 🏗️ Simplified Architecture

```
User Upload Document
        │
        ▼
Extract Text (PDF/DOCX/TXT)
        │
        ▼
┌────────────────────────┐
│   Graphiti Service     │ ← The magic happens here
│   - Add Episode        │    (Graphiti does everything)
│   - Auto Extract       │
│   - Auto Entities      │
│   - Auto Relations     │
│   - Auto Embeddings    │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│      Neo4j Graph       │ ← Knowledge graph with temporal data
│   - Entities (nodes)   │
│   - Relations (edges)  │
│   - Embeddings         │
│   - Timestamps         │
└────────┬───────────────┘
         │
         ▼
┌────────────────────────┐
│   Graphiti Search      │ ← Hybrid semantic + graph search
│   - Find relevant      │
│   - Build context      │
│   - Return sources     │
└────────┬───────────────┘
         │
         ▼
Inject into Chat Context with Citations
```

## 📊 Database Schema - SIMPLE

**Neo4j handles everything!** Graphiti creates these automatically:

### Node Type: `Entity`

```cypher
// Automatically created by Graphiti
{
  uuid: string,
  name: string,
  labels: [string],  // e.g., ["Person", "Engineer"]
  summary: string,
  created_at: timestamp,
  embedding: vector
}
```

### Edge Type: `Relation`

```cypher
// Automatically created by Graphiti
{
  uuid: string,
  name: string,       // e.g., "WORKS_AT", "KNOWS"
  fact: string,       // e.g., "Kendra works at Acme Corp"
  episodes: [uuid],   // Track which episodes mentioned this
  created_at: timestamp,
  expired_at: timestamp?  // Handles contradictions temporally
}
```

### Supabase Tables (Just for File Management)

We still use Supabase for:

1. File upload tracking
2. Document metadata
3. User permissions (RLS)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  upload_path TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  neo4j_episode_ids TEXT[] DEFAULT '{}',  -- Track episodes in Neo4j
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- RLS policies
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own documents"
  ON documents FOR ALL
  USING (auth.uid() = user_id);
```

**That's it!** One table instead of three. Neo4j handles the rest.

## 📁 File Structure - MUCH SIMPLER

```
lib/
├── graphrag/
│   ├── types.ts                    # Shared interfaces (~50 lines)
│   ├── config.ts                   # Configuration (~80 lines)
│   ├── index.ts                    # Main exports (~30 lines)
│   │
│   ├── parsers/                    # Same as before (reuse from old plan)
│   │   ├── pdf-parser.ts           # PDF → Text
│   │   ├── text-parser.ts          # TXT/MD → Text  
│   │   ├── docx-parser.ts          # DOCX → Text
│   │   └── index.ts
│   │
│   ├── graphiti/                   # Graphiti integration
│   │   ├── client.ts               # Graphiti client setup (~100 lines)
│   │   ├── episode-service.ts      # Add episodes to graph (~120 lines)
│   │   ├── search-service.ts       # Search & retrieve (~150 lines)
│   │   └── index.ts
│   │
│   ├── storage/                    # Simple Supabase file tracking
│   │   ├── document-storage.ts     # documents table CRUD (~100 lines)
│   │   └── index.ts
│   │
│   └── service/                    # High-level orchestration
│       ├── document-service.ts     # Upload → Parse → Graphiti (~150 lines)
│       └── graphrag-service.ts     # Search & integrate with chat (~120 lines)
│
components/
├── graphrag/
│   ├── DocumentUpload.tsx          # Drag-drop upload (~80 lines)
│   ├── DocumentList.tsx            # List documents (~100 lines)
│   └── GraphRAGIndicator.tsx       # Show when active (~50 lines)
│
hooks/
├── useDocuments.ts                 # Document management (~80 lines)
└── useGraphRAG.ts                  # GraphRAG operations (~100 lines)
│
app/
└── api/
    └── graphrag/
        ├── upload/route.ts         # POST /api/graphrag/upload
        ├── documents/route.ts      # GET /api/graphrag/documents
        ├── search/route.ts         # POST /api/graphrag/search
        └── delete/[id]/route.ts    # DELETE /api/graphrag/delete/:id
```

**Total:** ~15 files instead of 45! 🎉

## 🔧 Implementation Phases - STREAMLINED

### **Phase 3.1: Setup & Configuration** (~120 lines, 20 min)

**Dependencies to Install:**

```bash
# Graphiti + Neo4j
npm install graphiti-core neo4j-driver

# Document parsing (same as before)
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

**Files to Create:**

1. `lib/graphrag/types.ts` - Core interfaces
2. `lib/graphrag/config.ts` - All configuration
3. `lib/graphrag/index.ts` - Exports

**Configuration (.env.local):**

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# OpenAI for Graphiti (it uses OpenAI by default)
OPENAI_API_KEY=your_openai_key

# GraphRAG Settings
GRAPHRAG_ENABLED=true
GRAPHRAG_TOP_K=5
GRAPHRAG_SEARCH_METHOD=hybrid  # semantic | keyword | hybrid
```

**Setup Neo4j:**

```bash
# Option 1: Neo4j Desktop (recommended for development)
# Download from https://neo4j.com/download/

# Option 2: Docker
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

**Verification:**

- [ ] Neo4j running and accessible
- [ ] Graphiti npm package installed
- [ ] Config file with env vars only
- [ ] TypeScript compiles

---

### **Phase 3.2: Document Parsers** (~150 lines, 30 min)

**Reuse from old plan!** Same parser files:

1. `lib/graphrag/parsers/pdf-parser.ts`
2. `lib/graphrag/parsers/text-parser.ts`
3. `lib/graphrag/parsers/docx-parser.ts`
4. `lib/graphrag/parsers/index.ts`

**Key Point:** We still need to extract text from files. But after that, Graphiti handles everything!

**Verification:**

- [ ] PDF parsing works
- [ ] DOCX parsing works
- [ ] TXT/MD files handled
- [ ] No TypeScript errors

---

### **Phase 3.3: Graphiti Client Setup** (~100 lines, 30 min)

**File:** `lib/graphrag/graphiti/client.ts`

```typescript
import { Graphiti } from 'graphiti-core';
import { graphragConfig } from '../config';

class GraphitiClient {
  private graphiti: Graphiti | null = null;

  async initialize() {
    if (this.graphiti) return this.graphiti;

    this.graphiti = new Graphiti({
      neo4j_uri: graphragConfig.neo4j.uri,
      neo4j_user: graphragConfig.neo4j.user,
      neo4j_password: graphragConfig.neo4j.password,
      // Graphiti uses OpenAI by default (reads OPENAI_API_KEY from env)
    });

    // Initialize indices and constraints
    await this.graphiti.build_indices_and_constraints();

    return this.graphiti;
  }

  async close() {
    if (this.graphiti) {
      await this.graphiti.close();
      this.graphiti = null;
    }
  }
}

export const graphitiClient = new GraphitiClient();
```

**That's it!** Graphiti handles:

- Entity extraction
- Relationship detection
- Embedding generation
- Temporal tracking
- Graph storage

**Verification:**

- [ ] Graphiti client connects to Neo4j
- [ ] Indices and constraints created
- [ ] No connection errors
- [ ] Client singleton works

---

### **Phase 3.4: Episode Service** (~120 lines, 30 min)

**File:** `lib/graphrag/graphiti/episode-service.ts`

```typescript
import { graphitiClient } from './client';

export class EpisodeService {
  async addDocument(content: string, metadata: DocumentMetadata) {
    const graphiti = await graphitiClient.initialize();

    // Graphiti automatically:
    // 1. Extracts entities (people, places, things)
    // 2. Identifies relationships between entities
    // 3. Generates embeddings
    // 4. Stores in Neo4j with temporal data
    // 5. Updates existing nodes if info changes
    // 6. Tracks contradictions over time
    
    const result = await graphiti.add_episode({
      name: metadata.documentName,
      episode_body: content,
      source_description: metadata.filename,
      reference_time: new Date(),
      group_id: metadata.userId,  // Isolate users' data
    });

    return {
      episodeId: result.episode_id,
      entities: result.entities_created,
      relations: result.relations_created,
    };
  }

  async addDocumentInChunks(content: string, metadata: DocumentMetadata) {
    // For large documents, split into logical sections
    const sections = this.splitIntoSections(content);
    const episodeIds: string[] = [];

    for (const [index, section] of sections.entries()) {
      const result = await this.addDocument(section, {
        ...metadata,
        documentName: `${metadata.documentName} - Part ${index + 1}`,
      });
      episodeIds.push(result.episodeId);
    }

    return episodeIds;
  }

  private splitIntoSections(content: string): string[] {
    // Simple section splitting (can be enhanced)
    // Split by double newlines or page markers
    return content.split(/\n\n+/).filter(s => s.trim().length > 100);
  }
}

export const episodeService = new EpisodeService();
```

**What Graphiti Does Automatically:**

- Extracts: "Kendra" (Person), "Adidas" (Company)
- Creates relationship: Kendra -[LOVES]-> Adidas shoes
- Embeds entities and relationships
- Stores in Neo4j with timestamps
- If new doc says "Kendra now loves Nike", it:
  - Updates the relationship
  - Marks old relation as expired
  - Keeps historical record

**Verification:**

- [ ] Episodes added to Neo4j
- [ ] Entities extracted automatically
- [ ] Relationships created
- [ ] Check Neo4j Browser to see graph
- [ ] User isolation works (group_id)

---

### **Phase 3.5: Search Service** (~150 lines, 45 min)

**File:** `lib/graphrag/graphiti/search-service.ts`

```typescript
import { graphitiClient } from './client';
import { graphragConfig } from '../config';

export interface SearchResult {
  context: string;
  sources: Array<{
    entity: string;
    relation: string;
    fact: string;
    confidence: number;
  }>;
  metadata: {
    searchMethod: string;
    resultsCount: number;
    queryTime: number;
  };
}

export class SearchService {
  async search(query: string, userId: string): Promise<SearchResult> {
    const graphiti = await graphitiClient.initialize();
    const startTime = Date.now();

    // Graphiti hybrid search:
    // 1. Semantic similarity on embeddings
    // 2. Keyword matching (BM25)
    // 3. Graph traversal for connected entities
    const searchResults = await graphiti.search({
      query,
      group_ids: [userId],  // Only search user's data
      num_results: graphragConfig.topK,
      // Graphiti automatically combines semantic + keyword + graph
    });

    // Build context from results
    const context = this.buildContext(searchResults);
    const sources = this.extractSources(searchResults);

    return {
      context,
      sources,
      metadata: {
        searchMethod: 'hybrid',
        resultsCount: searchResults.edges.length,
        queryTime: Date.now() - startTime,
      },
    };
  }

  private buildContext(searchResults: any): string {
    // Format search results into context string
    const facts = searchResults.edges.map((edge: any) => {
      return `${edge.fact} (Source: ${edge.source_description})`;
    });

    return `Relevant information from user's documents:\n\n${facts.join('\n\n')}`;
  }

  private extractSources(searchResults: any) {
    return searchResults.edges.map((edge: any) => ({
      entity: edge.source_node?.name || 'Unknown',
      relation: edge.name,
      fact: edge.fact,
      confidence: edge.score || 0,
    }));
  }

  async getRelatedEntities(entityName: string, userId: string) {
    const graphiti = await graphitiClient.initialize();

    // Find entities connected to the given entity
    // Useful for "tell me more about X" queries
    return await graphiti.get_entity_edges({
      entity_name: entityName,
      group_ids: [userId],
    });
  }
}

export const searchService = new SearchService();
```

**Graphiti Search Features:**

- Semantic: Find conceptually similar content
- Keyword: Traditional text matching
- Graph: Traverse relationships
- Temporal: Can query "what did I know at time X?"
- Re-ranking: Automatically ranks by relevance

**Verification:**

- [ ] Search returns relevant results
- [ ] Context properly formatted
- [ ] Sources include citations
- [ ] User isolation enforced
- [ ] Performance acceptable (<1s)

---

### **Phase 3.6: Document Storage (Supabase)** (~100 lines, 20 min)

**File:** `lib/graphrag/storage/document-storage.ts`

```typescript
import { supabaseClient } from '@/lib/supabase/client';

export class DocumentStorage {
  async createDocument(data: {
    userId: string;
    filename: string;
    fileType: string;
    uploadPath: string;
    metadata?: Record<string, unknown>;
  }) {
    const { data: doc, error } = await supabaseClient
      .from('documents')
      .insert({
        user_id: data.userId,
        filename: data.filename,
        file_type: data.fileType,
        upload_path: data.uploadPath,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return doc;
  }

  async updateProcessingStatus(
    documentId: string,
    processed: boolean,
    episodeIds: string[]
  ) {
    const { error } = await supabaseClient
      .from('documents')
      .update({
        processed,
        neo4j_episode_ids: episodeIds,
      })
      .eq('id', documentId);

    if (error) throw error;
  }

  async getUserDocuments(userId: string) {
    const { data, error } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async deleteDocument(documentId: string) {
    // Note: This only deletes from Supabase
    // Neo4j episodes persist (feature: historical context)
    const { error } = await supabaseClient
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  }
}

export const documentStorage = new DocumentStorage();
```

**Verification:**

- [ ] Documents tracked in Supabase
- [ ] RLS policies work
- [ ] Episode IDs stored
- [ ] User data isolated

---

### **Phase 3.7: High-Level Document Service** (~150 lines, 45 min)

**File:** `lib/graphrag/service/document-service.ts`

```typescript
import { parseDocument } from '../parsers';
import { episodeService } from '../graphiti/episode-service';
import { documentStorage } from '../storage/document-storage';
import { supabaseClient } from '@/lib/supabase/client';

export class DocumentService {
  async uploadAndProcess(file: File, userId: string) {
    // 1. Upload to Supabase Storage
    const uploadPath = `${userId}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(uploadPath, file);

    if (uploadError) throw uploadError;

    // 2. Create document record
    const document = await documentStorage.createDocument({
      userId,
      filename: file.name,
      fileType: file.type,
      uploadPath,
    });

    // 3. Background: Parse and process
    this.processDocumentAsync(document.id, uploadPath, userId, file.name);

    return document;
  }

  private async processDocumentAsync(
    documentId: string,
    uploadPath: string,
    userId: string,
    filename: string
  ) {
    try {
      // 1. Download file
      const { data: fileData } = await supabaseClient.storage
        .from('documents')
        .download(uploadPath);

      if (!fileData) throw new Error('File download failed');

      // 2. Parse document to text
      const text = await parseDocument(fileData, filename);

      // 3. Add to Graphiti (magic happens here!)
      const episodeIds = await episodeService.addDocumentInChunks(text, {
        userId,
        filename,
        documentName: filename,
      });

      // 4. Update document status
      await documentStorage.updateProcessingStatus(documentId, true, episodeIds);

      console.log(`✅ Document processed: ${filename}, Episodes: ${episodeIds.length}`);
    } catch (error) {
      console.error('❌ Document processing failed:', error);
      // Could update document with error status
    }
  }

  async getDocuments(userId: string) {
    return await documentStorage.getUserDocuments(userId);
  }

  async deleteDocument(documentId: string) {
    // Get document to find upload path
    const docs = await documentStorage.getUserDocuments('any'); // Need better query
    const doc = docs.find(d => d.id === documentId);

    if (doc) {
      // Delete from storage
      await supabaseClient.storage
        .from('documents')
        .remove([doc.upload_path]);
    }

    // Delete record
    await documentStorage.deleteDocument(documentId);
  }
}

export const documentService = new DocumentService();
```

**Verification:**

- [ ] Upload works end-to-end
- [ ] Parsing extracts text
- [ ] Graphiti processes successfully
- [ ] Status updates correctly
- [ ] Errors handled gracefully

---

### **Phase 3.8: GraphRAG Service** (~120 lines, 30 min)

**File:** `lib/graphrag/service/graphrag-service.ts`

```typescript
import { searchService } from '../graphiti/search-service';

export class GraphRAGService {
  async enhancePrompt(userMessage: string, userId: string) {
    // Search user's knowledge graph
    const searchResult = await searchService.search(userMessage, userId);

    if (!searchResult.sources.length) {
      return null; // No relevant context found
    }

    // Build enhanced system message
    const enhancedPrompt = `You are a helpful AI assistant with access to the user's personal knowledge graph.

Use the following information from the user's documents to provide informed answers:

${searchResult.context}

If the information above is relevant to the user's question, use it in your response and cite the sources. If not relevant, answer based on your general knowledge.`;

    return {
      systemMessage: enhancedPrompt,
      sources: searchResult.sources,
      metadata: searchResult.metadata,
    };
  }

  async exploreEntity(entityName: string, userId: string) {
    // Get all relationships for an entity
    return await searchService.getRelatedEntities(entityName, userId);
  }
}

export const graphragService = new GraphRAGService();
```

**Verification:**

- [ ] Prompts enhanced with context
- [ ] Sources returned for citation
- [ ] Entity exploration works

---

### **Phase 3.9: API Routes** (~200 lines, 45 min)

**Files:**

1. `app/api/graphrag/upload/route.ts`
2. `app/api/graphrag/documents/route.ts`
3. `app/api/graphrag/search/route.ts`
4. `app/api/graphrag/delete/[id]/route.ts`

**(Same structure as tool API routes, very straightforward)**

**Verification:**

- [ ] All endpoints work
- [ ] Auth middleware applied
- [ ] Error handling complete

---

### **Phase 3.10: React Components** (~230 lines, 60 min)

**Files:**

1. `components/graphrag/DocumentUpload.tsx` (~80 lines)
2. `components/graphrag/DocumentList.tsx` (~100 lines)
3. `components/graphrag/GraphRAGIndicator.tsx` (~50 lines)

**Verification:**

- [ ] Upload works
- [ ] Documents display
- [ ] Indicator shows in chat

---

### **Phase 3.11: React Hooks** (~180 lines, 30 min)

**Files:**

1. `hooks/useDocuments.ts` (~80 lines)
2. `hooks/useGraphRAG.ts` (~100 lines)

**Verification:**

- [ ] Hooks integrate with components
- [ ] State management correct

---

### **Phase 3.12: Chat Integration** (~100 lines, 30 min)

**Modify:**

1. `app/api/chat/route.ts` - Add GraphRAG enhancement

```typescript
// Before sending to OpenAI
if (graphragEnabled && userMessage) {
  const enhancement = await graphragService.enhancePrompt(userMessage, userId);
  
  if (enhancement) {
    systemMessage = enhancement.systemMessage;
    metadata.graphragSources = enhancement.sources;
  }
}
```

**Verification:**

- [ ] Context injected
- [ ] Citations shown
- [ ] Fallback works

---

## 🔢 Final Totals - MUCH BETTER

| Metric | Old Plan (pgvector) | New Plan (Graphiti) | Savings |
|--------|---------------------|---------------------|---------|
| **Files** | 45 | 15 | 67% fewer |
| **Lines of Code** | ~2,600 | ~800 | 69% less |
| **Estimated Time** | 10-12 hours | 5-6 hours | 50% faster |
| **Database Tables** | 3 (complex) | 1 (simple) | Much simpler |
| **Manual Work** | Chunking, embeddings, relationships | None! | Automated |
| **Features** | Basic RAG | GraphRAG + Temporal + Auto-update | Way more powerful |

## ✨ What You Get with Graphiti

1. **Automatic Entity Extraction**: "Kendra loves Adidas" → Creates Person(Kendra), Company(Adidas), LOVES relationship
2. **Temporal Tracking**: Knows when info was added, handles updates gracefully
3. **Contradiction Handling**: New info contradicting old? Graphiti marks old as expired, keeps both
4. **Graph Traversal**: "Who does Kendra work with?" → Finds connections through graph
5. **Hybrid Search**: Combines semantic, keyword, and graph - finds what simple RAG misses
6. **Incremental Updates**: No batch reprocessing - just add new documents
7. **Historical Queries**: "What did I know about X last month?" (advanced feature)

## 🚀 Ready to Start?

Confirm and we'll begin with **Phase 3.1: Setup & Configuration**!

This is going to be SO much cleaner than traditional RAG 🎉
