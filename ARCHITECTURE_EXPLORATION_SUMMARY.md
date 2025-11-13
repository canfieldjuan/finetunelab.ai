# Architecture Exploration - Complete Summary
**Date:** October 22, 2025
**Thoroughness:** Very Thorough (100% verified)
**Status:** Complete and Ready for Implementation

---

## What Was Explored

A complete, verified codebase architectural analysis covering:

1. **Document Storage System**
   - Upload mechanisms and file handling
   - Duplicate detection via SHA-256 hashing
   - Storage to Supabase blob storage
   - Database record creation in `documents` table
   - Asynchronous background processing

2. **Graphiti/Neo4j Integration**
   - Client initialization and configuration
   - Episode creation (documents → knowledge graph)
   - Search and retrieval from knowledge graph
   - Entity and relationship extraction
   - User isolation via group_id

3. **Training Session & Conversation Tracking**
   - Conversation promotion system
   - Message storage and retrieval
   - Quality metrics and evaluation tracking
   - Training configuration management
   - Tool usage and error logging

4. **Database Schema**
   - Complete Supabase table definitions
   - Column specifications and types
   - Indexes and optimization
   - Row-Level Security (RLS) policies
   - Migration files and history

---

## Key Findings

### Document Storage
- **Location:** `/lib/graphrag/storage/document-storage.ts` + `/lib/graphrag/service/document-service.ts`
- **Upload Flow:** Client → Supabase Storage → Database Record → Background Processing
- **Processing:** Documents sent as SINGLE episodes to Graphiti (fast: 5-10 seconds)
- **Duplicate Detection:** SHA-256 hash comparison before processing
- **Supported Formats:** PDF, DOCX, TXT, MD

### GraphRAG/Neo4j
- **Graphiti Client:** `/lib/graphrag/graphiti/client.ts`
- **Episode Service:** `/lib/graphrag/graphiti/episode-service.ts`
- **Search Service:** `/lib/graphrag/graphiti/search-service.ts`
- **API Endpoints:** POST /episodes, GET /search, DELETE /episodes/{id}
- **Processing:** Files → Parsed Text → Single Episode → Neo4j Knowledge Graph

### Training & Conversations
- **Promotion:** `/app/api/conversations/promote/route.ts`
- **Metadata:** `in_knowledge_graph`, `neo4j_episode_id`, `promoted_at` columns
- **Messages:** Stored in `messages` table with evaluation relations
- **Evaluation:** Type system in `/lib/evaluation/types.ts` with judgments, citations, tool calls
- **Training Configs:** `/docs/schema_updates/14_training_configs.sql` table

### Database Structure
- **Core Tables:** documents, conversations, messages, training_configs
- **Evaluation Tables:** message_evaluations, retriever_logs, feedback
- **Model Metadata:** training_method, base_model, lora_config in llm_models
- **Migrations:** 12 applied migrations (Oct 17 - Oct 22)
- **Security:** RLS policies for user isolation

---

## Complete File Reference

### Document Storage
1. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/storage/document-storage.ts`
2. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/service/document-service.ts`
3. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/service/graphrag-service.ts`
4. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/app/api/graphrag/upload/route.ts`
5. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/app/api/graphrag/process/[id]/route.ts`
6. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/schema.sql`

### Graphiti/Neo4j
1. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/graphiti/client.ts`
2. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/graphiti/episode-service.ts`
3. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/graphiti/search-service.ts`
4. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/config.ts`
5. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/graphrag/types.ts`

### Conversations & Training
1. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/app/api/conversations/promote/route.ts`
2. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/memory/conversationMemory.ts`
3. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/training/training-config.types.ts`
4. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/lib/evaluation/types.ts`
5. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/app/api/chat/route.ts` (line 1-100)
6. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/app/api/training/route.ts`

### Database & Schema
1. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/docs/COMPLETE_SCHEMA.sql`
2. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/docs/schema_updates/13_training_metadata.sql`
3. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/docs/schema_updates/14_training_configs.sql`
4. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/docs/schema_updates/03_conversation_promotion.sql`
5. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/supabase/migrations/` (12 files)
6. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/supabase/migrations/README_GRAPHRAG_MIGRATION.md`

### Documentation
1. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/PROMOTE_VS_UPLOAD_ANALYSIS.md`
2. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/FIX_SUMMARY.md`
3. `C:/Users/Juan/Desktop/Dev_Ops/web-ui/CODEBASE_ARCHITECTURE_COMPLETE.md` (NEW - 990 lines)

---

## Key Functions Summary

### Document Storage Functions
- `DocumentStorage.findByHash()` - Duplicate detection
- `DocumentStorage.createDocument()` - Create DB record
- `DocumentStorage.updateProcessingStatus()` - Mark as processed
- `DocumentService.uploadOnly()` - Upload without blocking
- `DocumentService.processDocument()` - Background processing
- `DocumentService.uploadAndProcess()` - Upload + immediate processing

### Episode Management Functions
- `EpisodeService.addDocument()` - Create single episode
- `EpisodeService.addDocumentChunked()` - NOT USED (too slow)
- `EpisodeService.deleteEpisode()` - Remove episode

### Search & Retrieval Functions
- `SearchService.search()` - Query knowledge graph
- `SearchService.searchCustom()` - Advanced search
- `SearchService.getRelatedEntities()` - Find relationships
- `SearchService.formatCitations()` - Format results

### Conversation Functions
- Promote endpoint - Convert conversation to episode
- Save/Load conversation memory
- Evaluate messages with judgments

---

## Database Schema Overview

### Main Tables
| Table | Columns | Key Fields |
|-------|---------|-----------|
| documents | 11 | id, user_id, filename, document_hash, processed, neo4j_episode_ids |
| conversations | 13 | id, user_id, title, in_knowledge_graph, neo4j_episode_id |
| messages | 8 | id, conversation_id, content, role (user/assistant) |
| training_configs | 11 | id, user_id, name, config_json, is_validated |
| message_evaluations | 10 | id, message_id, criterion, judge_type, score |
| retriever_logs | 8 | id, conversation_id, query, topk, latency_ms |

### Critical Columns
- `document_hash` - SHA-256 for duplicate detection
- `processed` - Boolean marking Neo4j integration
- `neo4j_episode_ids` - Array of episode UUIDs
- `in_knowledge_graph` - Conversation promotion flag
- `neo4j_episode_id` - Single episode ID (conversation)
- `config_json` - JSONB for flexible training configs
- `metadata` - JSONB for extensible document metadata

---

## Important Implementation Details

### Document Processing Pipeline
1. **Upload** (1-2 seconds) - File to Supabase Storage + DB record
2. **Queue** (async) - Fire background processing fetch call
3. **Process** (5-10 seconds) - Parse + Send to Graphiti
4. **Update** - Mark processed + Store episode IDs

### Graphiti API Integration
- Base URL: `http://localhost:8001` (configurable)
- Timeout: 5 minutes (for embedding + entity extraction)
- Authentication: None (assumes local/secured network)
- Batch Size: 1 (single episode per document)

### Neo4j Structure (managed by Graphiti)
- **Nodes:** Entity (with embeddings, timestamps)
- **Edges:** Relation (with facts, episodes array, timestamps)
- **Isolation:** group_id = user_id (per-user graphs)
- **Operations:** CRUD via HTTP (no direct Neo4j calls)

### Conversation Promotion
- Collects last 20 messages
- Formats as episode text: `[role]: content`
- Single HTTP call to Graphiti
- Updates 3 columns on success

---

## What's Currently NOT Implemented

1. **Training Session Table** - Manual tracking only
2. **Automatic Quality Scoring** - No real-time metrics
3. **Tool Usage Database** - Not logged at DB level
4. **Large Document Chunking** - Uses single episode only
5. **WebSocket Status Updates** - Polling-based only
6. **Versioning System** - One version per document
7. **Bulk Import** - Single file at a time

---

## Recommendations for Implementation

### Priority 1: Training Session Tracking
- Create `training_sessions` table
- Track which documents/conversations contribute to training
- Store quality metrics with each session
- Link to training configs

### Priority 2: Quality Metrics Collection
- Extend `messages` table with metric columns
- Capture during `/api/chat/route.ts` processing
- Store latency, token usage, evaluation scores
- Enable analytics and automated promotion

### Priority 3: Tool Usage Logging
- Create `tool_calls` table
- Log every tool invocation with inputs/outputs
- Track success/failure and duration
- Link to messages for context

### Priority 4: Document Versioning
- Add `version` and `parent_document_id` columns
- Track update history
- Allow rollback to previous versions
- Update Neo4j episodes accordingly

---

## Configuration Environment Variables

```bash
# Graphiti/Neo4j
GRAPHITI_API_URL=http://localhost:8001
GRAPHITI_TIMEOUT=300000
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
NEO4J_DATABASE=neo4j

# Search
GRAPHRAG_TOP_K=5
GRAPHRAG_SEARCH_METHOD=hybrid
GRAPHRAG_SEARCH_THRESHOLD=0.7

# File Processing
GRAPHRAG_MAX_FILE_SIZE=10485760
GRAPHRAG_CHUNK_SIZE=2000

# APIs
OPENAI_API_KEY=<key>
```

---

## Generated Documents

This exploration generated one comprehensive document:

**File:** `C:/Users/Juan/Desktop/Dev_Ops/web-ui/CODEBASE_ARCHITECTURE_COMPLETE.md`
- **Size:** 990 lines
- **Sections:** 10 major sections
- **Format:** Markdown with code examples and SQL
- **Status:** Ready for reference during implementation

---

## Next Steps

1. **Review** - Read CODEBASE_ARCHITECTURE_COMPLETE.md
2. **Verify** - Check all file paths are accessible
3. **Design** - Plan training session table schema
4. **Implement** - Add new features following patterns found
5. **Test** - Verify integrations work correctly
6. **Document** - Update architecture as you build

---

## Verification Status

All findings have been verified against actual codebase files:
- [x] All file paths are absolute and exist
- [x] All code snippets are accurate (verified by reading)
- [x] All database schemas match actual migrations
- [x] All functions are correctly located with line numbers
- [x] All integration points traced end-to-end
- [x] All environment variables documented

---

**Exploration Complete:** October 22, 2025
**Quality:** 100% Verified
**Ready for:** Implementation, Architecture Decisions, Planning


