# RAG Evaluation Framework - Files Summary

**Created:** October 14, 2025
**Purpose:** Quick reference for all affected files

---

## Files to CREATE (17 new files)

### Database & Migrations

1. **`docs/migrations/003_rag_evaluation_schema.sql`**
   - Creates 8 new tables: runs, documents, chunks, retriever_logs, citations, judgments, tool_calls, errors
   - Alters messages table to add content_json column
   - Creates indexes for performance

### TypeScript Schemas (Zod)

2. **`lib/evaluation/schemas/company-expert.schema.ts`**
   - Zod schema for company expert domain
   - Validates: answer, citations, policy_scope, confidentiality

3. **`lib/evaluation/schemas/pc-expert.schema.ts`**
   - Zod schema for PC expert domain
   - Validates: parts_list, power_calculation, assumptions

### Validators

4. **`lib/evaluation/validators/structured-output.validator.ts`**
   - Validates JSON output against Zod schemas
   - Extracts JSON from markdown code blocks

5. **`lib/evaluation/validators/rule-validators.ts`**
   - 6 core validators:
     1. mustCiteIfClaims - Fails if factual claims without citations
     2. citationExists - Verifies all cited doc_ids exist
     3. retrievalRelevanceAtK - Term overlap metric
     4. policyScopeAllowed - Authorization check
     5. freshnessOk - Document age validation
     6. formatOk - JSON validation + PII scanning

### Domain Registry

6. **`lib/evaluation/domains/registry.ts`**
   - Maps domains to validators
   - Executes domain-specific validation pipelines
   - Defines pass/fail gates

### Services

7. **`lib/evaluation/citations.service.ts`**
   - Extracts citations from structured output
   - Saves to citations table
   - Links to retriever logs

8. **`lib/evaluation/retriever-logs.service.ts`**
   - Logs retrieval operations
   - Tracks: query, topk, retrieved_doc_ids, scores, latency

9. **`lib/evaluation/judgments.service.ts`**
   - Saves rule-based judgments
   - Supports batch operations
   - Unified table for rule/human/llm judges

10. **`lib/graphrag/sync.service.ts`**
    - Syncs evaluation data to Neo4j
    - Event-driven with idempotency
    - Handles citations, judgments, errors

### Types

11. **`lib/evaluation/types.ts`**
    - Centralized type definitions
    - MessageWithEvaluation, Citation, Judgment, ToolCall, Error, Run

### API Routes

12. **`app/api/evaluate-message/route.ts`**
    - POST endpoint for message evaluation
    - Validates structured output
    - Executes domain validators
    - Saves citations and judgments

### UI Components (Optional - Phase 6)

13. **`components/evaluation/CitationValidator.tsx`** (optional)
    - UI for validating citation correctness
    - Inline with message display

14. **`components/evaluation/GroundednessIndicator.tsx`** (optional)
    - Visual indicator for groundedness score
    - Color-coded (red/yellow/green)

### Documentation

15. ✅ **`docs/RAG_EVALUATION_FRAMEWORK_PLAN.md`** (ALREADY CREATED)
    - Comprehensive plan (850+ lines)
    - SQL schemas, TypeScript schemas, implementation phases

16. ✅ **`docs/RAG_EVALUATION_INSERTION_POINTS.md`** (ALREADY CREATED)
    - Detailed insertion points with line numbers
    - Before/after code examples
    - Implementation order

17. ✅ **`docs/RAG_EVALUATION_FILES_SUMMARY.md`** (THIS FILE)
    - Quick reference for all files

---

## Files to MODIFY (6 existing files)

### 1. `/app/api/chat/route.ts` - Main chat endpoint

**Changes:**

- **Line 10:** Add imports for validators, services
- **Line 87-93:** Log retriever operation to retriever_logs table
- **Line 197:** Add structured output validation after LLM response
- **Line 197:** Execute domain validators
- **Line 407:** Save citations and judgments to database

**Key Insertion Points:**

```typescript
// After line 10: Add imports
import { structuredOutputValidator } from '@/lib/evaluation/validators/structured-output.validator';
import { executeDomainValidation } from '@/lib/evaluation/domains/registry';
import { citationsService } from '@/lib/evaluation/citations.service';
import { retrieverLogsService } from '@/lib/evaluation/retriever-logs.service';
import { judgmentsService } from '@/lib/evaluation/judgments.service';

// After line 87: Log retriever operation
const retrievalStartTime = Date.now();
// ... existing graphragService.enhancePrompt call
const retrievalLatency = Date.now() - retrievalStartTime;
await retrieverLogsService.saveRetrieverLog({...});

// After line 197: Validate structured output
const validation = structuredOutputValidator.validate(finalResponse, domain);
if (validation.valid) {
  const validationResults = await executeDomainValidation(domain, {...});
  // Save citations and judgments
}
```

### 2. `/lib/llm/openai.ts` - OpenAI provider

**Changes:**

- **Line 147:** Add `response_format: { type: 'json_object' }` to force JSON output

**Before:**

```typescript
const completion = await client.chat.completions.create({
  model,
  messages: currentMessages as ChatCompletionMessageParam[],
  temperature,
  max_tokens: maxTokens,
  ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
});
```

**After:**

```typescript
const completion = await client.chat.completions.create({
  model,
  messages: currentMessages as ChatCompletionMessageParam[],
  temperature,
  max_tokens: maxTokens,
  response_format: { type: 'json_object' }, // FORCE JSON
  ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
});
```

**IMPORTANT:** Must add system prompt instructing JSON output

### 3. `/lib/llm/anthropic.ts` - Anthropic provider

**Changes:**

- **Line 141:** Add `system` parameter with JSON schema instructions

**Before:**

```typescript
let response = await anthropic.messages.create({
  model,
  max_tokens: maxTokens,
  temperature,
  messages: anthropicMessages,
  ...(mappedTools ? { tools: mappedTools } : {}),
});
```

**After:**

```typescript
let response = await anthropic.messages.create({
  model,
  max_tokens: maxTokens,
  temperature,
  system: `You MUST respond with valid JSON matching this schema: {...}`,
  messages: anthropicMessages,
  ...(mappedTools ? { tools: mappedTools } : {}),
});
```

### 4. `/components/Chat.tsx` - Main chat UI

**Changes:**

- **Line 427:** Call `/api/evaluate-message` endpoint after message saved

**Insertion Point:**

```typescript
// After line 427 (after message saved to DB)
if (aiMsg && graphragCitations && graphragCitations.length > 0) {
  fetch('/api/evaluate-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messageId: aiMsg.id,
      domain: 'company_expert',
      retrievedSources: graphragCitations.map(c => ({ text: c.content })),
    }),
  })
    .then(res => res.json())
    .then(result => console.log('[Chat] Evaluation completed:', result))
    .catch(err => console.error('[Chat] Evaluation error:', err));
}
```

### 5. `/components/evaluation/EvaluationModal.tsx` - Evaluation UI

**Changes:**

- **Line 30:** Add state variables: `citationCorrectness`, `groundedness`, `message`
- **Line 38:** Fetch message with `content_json` in useEffect
- **Line 196:** Add citation validation UI section
- **Line 196:** Add groundedness slider

**New UI Sections:**

- Citation correctness checkboxes (per citation)
- Groundedness slider (0-100%)
- Display structured output data

### 6. `/package.json` - Dependencies

**Changes:**

- **Line 31:** Add `"zod": "^3.22.4"` to dependencies

**After modification, run:**

```bash
npm install
```

---

## Database Changes

### New Tables (8 tables)

1. **`runs`** - Experiment tracking
   - Columns: id, name, model_name, model_version, prompt_version, dataset_version, git_sha, config_json, started_at, completed_at
   - Purpose: A/B testing, version control

2. **`documents`** - Source of truth for documents
   - Columns: id, user_id, title, uri, content, checksum, visibility, owner, tags, created_at, updated_at
   - Purpose: Document management, access control

3. **`chunks`** - Document chunks with embeddings
   - Columns: id, document_id, text, embedding_vector (pgvector), page, section, metadata_json
   - Purpose: Semantic search, retrieval

4. **`retriever_logs`** - Audit trail of retrieval operations
   - Columns: id, conversation_id, user_id, query, topk, retrieved_doc_ids[], scores[], latency_ms, created_at
   - Purpose: Retrieval quality analysis, debugging

5. **`citations`** - Answer-to-document links
   - Columns: id, message_id, document_id, span_start, span_end, quote, correctness, retriever_log_id
   - Purpose: Grounding validation, citation tracking

6. **`judgments`** - Unified evaluation table
   - Columns: id, message_id, judge_type (rule/human/llm), judge_name, criterion, score, passed, evidence_json, notes, created_at
   - Purpose: Multi-judge evaluation, experiment tracking

7. **`tool_calls`** - Normalized tool execution tracking
   - Columns: id, message_id, tool_name, input_json, output_json, success, duration_ms, error_message
   - Purpose: Tool performance analysis

8. **`errors`** - Normalized error tracking
   - Columns: id, message_id, conversation_id, error_type, error_message, stack_trace, severity, created_at
   - Purpose: Error analysis, debugging

### Modified Tables (1 table)

1. **`messages`** - Add `content_json` column
   - New column: `content_json JSONB` - Stores structured output from LLM
   - Purpose: Machine-readable responses, structured data

### Indexes (7 indexes)

- `idx_citations_message_id`
- `idx_citations_document_id`
- `idx_judgments_message_id`
- `idx_judgments_criterion`
- `idx_retriever_logs_conversation_id`
- `idx_chunks_embedding` (IVFFlat for vector search)
- `idx_messages_content_json` (GIN index for JSONB)

---

## Dependencies to Install

### NPM Packages

```bash
npm install zod
```

### Supabase Extensions (verify enabled)

```sql
-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Enable if needed
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Implementation Phases (7 weeks)

### Phase 1: Database Setup (Week 1) ✅ PLANNING COMPLETE

- [x] Create plan document
- [x] Create insertion points document
- [x] Create files summary
- [ ] Create SQL migration file
- [ ] Run migration in Supabase
- [ ] Install zod package

### Phase 2: Structured Output (Week 2)

- [ ] Create Zod schemas (company-expert, pc-expert)
- [ ] Create structured output validator
- [ ] Modify LLM providers (OpenAI, Anthropic)
- [ ] Test structured output

### Phase 3: Rule Validators (Week 3)

- [ ] Create rule validators (6 validators)
- [ ] Create domain registry
- [ ] Create evaluation types
- [ ] Test validators individually

### Phase 4: Services (Week 4)

- [ ] Create citations service
- [ ] Create retriever logs service
- [ ] Create judgments service
- [ ] Test services with mock data

### Phase 5: Integration (Week 5)

- [ ] Create evaluate-message endpoint
- [ ] Modify chat route
- [ ] Modify Chat component
- [ ] Test end-to-end flow

### Phase 6: UI Enhancements (Week 6)

- [ ] Modify EvaluationModal
- [ ] Add citation validation UI
- [ ] Add groundedness slider
- [ ] Test human evaluation flow

### Phase 7: GraphRAG Sync (Week 7)

- [ ] Create graph sync service
- [ ] Integrate with judgments service
- [ ] Test Neo4j relationships
- [ ] Add monitoring

---

## Quick Reference: What Changes Where

### Backend Changes

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `app/api/chat/route.ts` | ~100 lines added | Structured output validation, evaluation integration |
| `lib/llm/openai.ts` | 1 line | Force JSON output |
| `lib/llm/anthropic.ts` | 5 lines | Force JSON output via system prompt |

### Frontend Changes

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `components/Chat.tsx` | ~20 lines added | Call evaluation endpoint |
| `components/evaluation/EvaluationModal.tsx` | ~60 lines added | Citation validation UI, groundedness slider |

### New Backend Files

| File | Lines | Purpose |
|------|-------|---------|
| `lib/evaluation/validators/structured-output.validator.ts` | ~70 lines | JSON validation |
| `lib/evaluation/validators/rule-validators.ts` | ~250 lines | 6 core validators |
| `lib/evaluation/domains/registry.ts` | ~100 lines | Domain configuration |
| `lib/evaluation/citations.service.ts` | ~60 lines | Citations management |
| `lib/evaluation/retriever-logs.service.ts` | ~40 lines | Retrieval logging |
| `lib/evaluation/judgments.service.ts` | ~80 lines | Judgments management |
| `lib/graphrag/sync.service.ts` | ~100 lines | Neo4j sync |
| `lib/evaluation/types.ts` | ~100 lines | Type definitions |
| `app/api/evaluate-message/route.ts` | ~80 lines | Evaluation endpoint |

### New Frontend Files (Optional)

| File | Lines | Purpose |
|------|-------|---------|
| `components/evaluation/CitationValidator.tsx` | ~100 lines | Citation validation component |
| `components/evaluation/GroundednessIndicator.tsx` | ~50 lines | Groundedness display |

---

## Testing Strategy

### Unit Tests

- Zod schema validation
- Structured output validator
- Each rule validator (6 tests)
- Domain registry

### Integration Tests

- LLM JSON output
- Citations saved correctly
- Judgments saved correctly
- Retriever logs captured
- GraphRAG sync events

### End-to-End Tests

1. User sends message with GraphRAG
2. Documents retrieved (logged)
3. LLM responds with JSON
4. Validators execute (all pass)
5. Citations/judgments saved
6. UI displays results
7. Human validates citations

---

## Success Metrics

### Code Quality

- [ ] All TypeScript types defined
- [ ] No `any` types used
- [ ] All validators return results < 100ms
- [ ] All database queries indexed

### Functionality

- [ ] Structured output validated 100% of time
- [ ] Citations tracked for all responses
- [ ] Judgments saved for all messages
- [ ] Retriever logs captured
- [ ] GraphRAG relationships created

### User Experience

- [ ] No latency impact on chat response
- [ ] Human can validate citations
- [ ] Groundedness displayed
- [ ] Analytics dashboard works

---

## Rollback Plan

### If structured output breaks

1. Remove `response_format` from OpenAI
2. Revert system prompts
3. Fall back to plain text

### If database migration fails

1. Restore from backup
2. Fix SQL errors
3. Re-run migration

### If GraphRAG sync breaks

1. Disable sync service
2. Continue SQL-only
3. Debug Neo4j
4. Re-enable when fixed

---

## Next Steps

1. **Review this summary** - Ensure all files are accounted for
2. **Create SQL migration** - `003_rag_evaluation_schema.sql`
3. **Run migration** - In Supabase SQL Editor
4. **Install zod** - `npm install zod`
5. **Start Phase 2** - Create Zod schemas and validators

---

**Total Files to Create:** 17 files
**Total Files to Modify:** 6 files
**Total Lines of Code:** ~1,500-2,000 lines
**Estimated Time:** 7 weeks (1 week per phase)

**Status:** ✅ Planning Complete - Ready for Implementation
