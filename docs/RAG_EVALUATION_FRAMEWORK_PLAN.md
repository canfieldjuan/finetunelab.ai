# RAG Evaluation Framework - Implementation Plan

**Date:** October 14, 2025
**Status:** Planning Complete - Ready for Implementation
**Priority:** HIGH - Foundation for grounding, governance, and retrieval quality

---

## 🎯 Overview

This framework shifts evaluation focus from simple ratings to **grounding, governance, and retrieval quality**. It establishes:

- **Source of truth** via documents table
- **Citation tracking** with correctness validation
- **Structured output contracts** (JSON schemas per domain)
- **Rule-based validators** (fast, deterministic gates)
- **GraphRAG integration** for relationship analysis
- **Domain registry pattern** for multi-use-case support

---

## 📊 Core Principles

### 1. Ground Truth First
SQL (Supabase) = write-ahead log and ground truth
Neo4j (GraphRAG) = relationship traversal and provenance

### 2. Structured Output Contract
Force LLM to emit machine-readable blocks every time. Validators stay dumb and fast.

### 3. Rule-Based Gates
Fast, deterministic checks run immediately. LLM-as-judge and human eval are optional enrichments.

### 4. Domain Abstraction
Each domain (company expert, PC expert, etc.) defines:
- `extract(message)` → content_json
- `validate(message, context)` → judgments[]
- `aggregate(run_id)` → metrics_json

---

## 🗄️ New Database Schema

### Documents Table (Source of Truth)

```sql
CREATE TABLE documents (
  doc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  uri TEXT NOT NULL, -- file path, URL, or identifier
  checksum TEXT NOT NULL, -- SHA-256 for version tracking
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal', 'restricted')),
  owner UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tags TEXT[],
  metadata JSONB, -- domain-specific fields
  UNIQUE(uri, checksum)
);

CREATE INDEX idx_documents_visibility ON documents(visibility);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_updated_at ON documents(updated_at);
```

**Purpose:** Central registry of all knowledge sources with versioning and access control.

**Key Features:**
- Checksum-based versioning
- Visibility levels (public/internal/restricted)
- Tag-based categorization
- Owner tracking for governance

---

### Chunks Table (Optional - For Vector Search)

```sql
CREATE TABLE chunks (
  chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding_vector vector(1536), -- pgvector extension required
  page INTEGER,
  section TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_doc_id ON chunks(doc_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding_vector vector_cosine_ops);
```

**Purpose:** Granular retrieval units with embeddings for semantic search.

**When to use:**
- Semantic search over keyword search
- Long documents need chunking
- Using pgvector extension

---

### Retriever Logs Table

```sql
CREATE TABLE retriever_logs (
  ret_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  query TEXT NOT NULL, -- User's question or reformulated query
  topk INTEGER NOT NULL DEFAULT 5,
  retrieved_doc_ids UUID[] NOT NULL, -- Array of doc_ids
  retrieved_scores NUMERIC[], -- Similarity scores
  latency_ms INTEGER,
  retriever_type TEXT, -- 'semantic', 'keyword', 'hybrid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_retriever_logs_msg_id ON retriever_logs(msg_id);
CREATE INDEX idx_retriever_logs_doc_ids ON retriever_logs USING GIN(retrieved_doc_ids);
```

**Purpose:** Audit trail of what was fetched for each question.

**Key Features:**
- Query tracking (original or reformulated)
- Top-K document IDs and scores
- Retriever type (semantic/keyword/hybrid)
- Latency tracking

---

### Citations Table

```sql
CREATE TABLE citations (
  citation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  msg_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  doc_id UUID NOT NULL REFERENCES documents(id),
  correctness BOOLEAN, -- Validated by human/LLM
  span_start INTEGER, -- Character offset in answer
  span_end INTEGER,
  section TEXT, -- "§4 PTO Policy", "Chapter 3"
  note TEXT, -- Validator comments
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_citations_msg_id ON citations(msg_id);
CREATE INDEX idx_citations_doc_id ON citations(doc_id);
CREATE INDEX idx_citations_correctness ON citations(correctness) WHERE correctness IS NOT NULL;
```

**Purpose:** Link answer spans to source documents with correctness tracking.

**Key Features:**
- Span-level attribution (start/end character offsets)
- Section references (§4, Chapter 3, etc.)
- Correctness validation (Boolean flag)
- Notes for manual review

---

### Enhanced Messages Table

```sql
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS content_json JSONB;

CREATE INDEX idx_messages_content_json ON messages USING GIN(content_json);

COMMENT ON COLUMN messages.content_json IS 'Structured output: answer, citations, policy_scope, confidentiality';
```

**Purpose:** Store structured LLM output for fast querying.

**Schema Examples:**

**Company Expert:**
```json
{
  "answer": "PTO accrues at 15 days per year...",
  "citations": [
    {"doc_id": "HR_123", "sections": ["PTO Policy §4"]}
  ],
  "policy_scope": ["HR", "Benefits"],
  "confidentiality": "internal"
}
```

**PC Expert:**
```json
{
  "parts_list": [
    {"sku": "RTX4090", "qty": 1, "tdp": 450}
  ],
  "power_calc": {
    "estimated_watts": 750,
    "recommended_psu": 850,
    "headroom_pct": 13
  }
}
```

---

## 🔍 Structured Output Contracts

### Domain-Specific Schemas

Each domain MUST define a JSON schema that the LLM is forced to emit.

### Company Expert Schema

```typescript
// lib/evaluation/schemas/company-expert.schema.ts
import { z } from 'zod';

export const CompanyExpertSchema = z.object({
  answer: z.string().min(1, 'Answer cannot be empty'),
  citations: z.array(
    z.object({
      doc_id: z.string().uuid('Invalid document ID'),
      sections: z.array(z.string()).optional(),
    })
  ).min(1, 'At least one citation required for factual claims'),
  policy_scope: z.array(z.string()), // ['HR', 'Benefits']
  confidentiality: z.enum(['public', 'internal', 'restricted']),
  assumptions: z.array(z.string()).optional(),
});

export type CompanyExpertOutput = z.infer<typeof CompanyExpertSchema>;
```

### PC Expert Schema

```typescript
// lib/evaluation/schemas/pc-expert.schema.ts
export const PCExpertSchema = z.object({
  parts_list: z.array(
    z.object({
      sku: z.string(),
      qty: z.number().int().positive(),
      tdp: z.number().positive().optional(),
      connectors: z.record(z.unknown()).optional(),
    })
  ).min(1, 'At least one part required'),
  power_calc: z.object({
    estimated_watts: z.number().positive(),
    recommended_psu: z.number().positive(),
    headroom_pct: z.number().min(0).max(100),
  }),
  assumptions: z.array(z.string()).optional(),
  compatibility_checks: z.array(
    z.object({
      check: z.string(),
      passed: z.boolean(),
      note: z.string().optional(),
    })
  ).optional(),
});

export type PCExpertOutput = z.infer<typeof PCExpertSchema>;
```

---

## ✅ Rule-Based Validators

Fast, deterministic checks that run immediately on every response.

### 1. must_cite_if_claims
**Purpose:** Fail if factual claims present but citations missing
**Gate:** 100% pass required
**Logic:**
- Detect factual claims using heuristics (statements about policies, procedures, facts)
- Check if citations array is non-empty
- Fail if claims detected without citations

### 2. citation_exists
**Purpose:** Every cited doc_id must exist and be visible to requester
**Gate:** 100% pass required
**Logic:**
- Query documents table for all cited doc_ids
- Check visibility permissions for user
- Fail if any doc missing or access denied

### 3. retrieval_relevance@k
**Purpose:** Simple overlap metric between question and retrieved docs
**Gate:** Baseline quality check (not a hard gate)
**Logic:**
- Extract terms from user query
- Compare with titles/tags of top-K retrieved docs
- Calculate term overlap percentage

### 4. policy_scope_allowed
**Purpose:** Requester role must have access to policy scopes
**Gate:** 100% pass required
**Logic:**
- Get user's roles/permissions
- Check if user authorized for each policy_scope in response
- Fail if any scope is unauthorized

### 5. freshness_ok
**Purpose:** Cited docs must be recent for time-sensitive topics
**Gate:** ≥90% pass required
**Logic:**
- Check updated_at timestamp for each cited document
- Flag stale docs (e.g., >90 days old for HR policies)
- Calculate percentage of fresh citations

### 6. format_ok
**Purpose:** Answer not empty, JSON valid, no PII echoes
**Gate:** 100% pass required
**Logic:**
- Validate JSON structure against domain schema
- Check for empty answer field
- Scan for common PII patterns (SSN, credit cards)

---

## 🎭 Optional LLM-Judge & Human Metrics

These augment rule-based validators but are NOT required for gates.

### LLM-as-Judge Criteria

**groundedness (0-1):**
- Prompt: "Does the answer match the cited documents?"
- Use GPT-4 to compare answer against retrieved doc texts
- Store score in judgments table

**helpfulness (1-5 Likert):**
- Prompt: "How helpful is this answer?"
- Store alongside human ratings

**non-fabrication:**
- Prompt: "Detect hallucination level: none/minor/major"
- Map to: none=1.0, minor=0.5, major=0.0

### Human Evaluation (Enhanced)

Keep existing EvaluationModal but add:
- Groundedness slider (0-100%)
- Citation correctness toggles (per citation)
- Hallucination severity dropdown

---

## 🎯 Domain Gates (Company Expert Example)

Gates define success/failure thresholds. All gates must pass.

```typescript
const companyExpertGates = [
  { criterion: 'must_cite_if_claims', threshold: 1.0, operator: '==', required: true },
  { criterion: 'citation_exists', threshold: 1.0, operator: '==', required: true },
  { criterion: 'policy_scope_allowed', threshold: 1.0, operator: '==', required: true },
  { criterion: 'freshness_ok', threshold: 0.9, operator: '>=', required: true },
  { criterion: 'grounded_claim_rate', threshold: 0.95, operator: '>=', required: true },
  { criterion: 'hallucination_rate', threshold: 0.02, operator: '<=', required: true },
];
```

**Interpretation:**
- 100% of responses must have citations for factual claims
- 100% of citations must exist and be accessible
- 100% of policy scopes must be authorized
- 90%+ of citations must be fresh
- 95%+ of claims must be grounded in cited docs
- ≤2% hallucination rate across all responses

---

## 🏗️ Architecture Components

### 1. Domain Registry

```typescript
// lib/evaluation/domains/registry.ts

interface DomainConfig {
  name: string;
  schema: z.ZodSchema;
  validators: RuleValidator[];
  gates: GateConfig[];
}

class DomainRegistry {
  static extract(domain: string, content: string): ValidationResult;
  static validate(domain: string, messageId: string, contentJson: unknown): Promise<RuleJudgment[]>;
  static aggregate(runId: string): Promise<{ metrics: Record<string, number>; gates_passed: boolean }>;
}
```

### 2. Structured Output Validator

```typescript
// lib/evaluation/validators/structured-output.validator.ts

export async function validateStructuredOutput(
  content: string,
  domain: 'company_expert' | 'pc_expert'
): Promise<ValidationResult> {
  // 1. Extract JSON block
  // 2. Validate against domain schema
  // 3. Return parsed data + judgments
}
```

### 3. Rule Validators

```typescript
// lib/evaluation/validators/rule-validators.ts

export async function validateCitationRequired(content: string, contentJson: CompanyExpertOutput): Promise<RuleJudgment>;
export async function validateCitationExists(citations: Array<{doc_id: string}>, userId: string): Promise<RuleJudgment>;
export async function validateRetrievalRelevance(query: string, retrievedDocIds: string[]): Promise<RuleJudgment>;
export async function validatePolicyScope(policyScopes: string[], userId: string): Promise<RuleJudgment>;
export async function validateFreshness(citations: Array<{doc_id: string}>, maxAgeDays: number): Promise<RuleJudgment>;
```

### 4. GraphRAG Sync Service

```typescript
// lib/graphrag/sync.service.ts

// Write to Supabase first (ground truth)
export async function recordCitation(data: { msgId: string; docId: string; section?: string }): Promise<void>;

// Emit event for graph sync
export async function emitGraphEvent(event: GraphEvent): Promise<void>;

// Graph ingester processes events
export async function ingestToGraph(event: GraphEvent): Promise<void>;
```

---

## 🔗 GraphRAG Integration

### Node Types

```cypher
(:Run) - Experiment runs
(:Conversation) - Chat sessions
(:Message) - Individual responses
(:Document) - Source documents
(:Chunk) - Document fragments
(:Citation) - Answer → Document links
(:Judgment) - Evaluation records
(:User) - Users with roles
(:Policy) - Policy categories
```

### Relationship Types

```cypher
// Hierarchical
(Run)-[:CONTAINS]->(Conversation)
(Conversation)-[:HAS_MESSAGE]->(Message)
(Document)-[:HAS_CHUNK]->(Chunk)

// Citations & Grounding
(Message)-[:CITES]->(Document)
(Message)-[:SUPPORTED_BY {correctness}]->(Document)
(Citation)-[:REFERENCES {section}]->(Document)

// Evaluation
(Message)-[:JUDGED_BY]->(Judgment)
(Judgment)-[:EVALUATES_CRITERION]->(Criterion)

// Causality
(Message)-[:RETRIEVED]->(Document) // via retriever_logs
(Message)-[:FAILED_GATE]->(Judgment {criterion})
(Document)-[:CAUSED_FAILURE {reason}]->(Message)

// Patterns
(Message)-[:EXHIBITS]->(SuccessPattern)
(Message)-[:EXHIBITS]->(FailurePattern)
(FailurePattern)-[:CAUSED_BY]->(RootCause)
```

### Key Queries

```cypher
// What docs are most frequently cited correctly?
MATCH (m:Message)-[c:CITES {correctness: true}]->(d:Document)
RETURN d.title, count(c) as correct_citations
ORDER BY correct_citations DESC

// Which policy scopes have highest failure rates?
MATCH (m:Message)-[:FAILED_GATE]->(j:Judgment {criterion: 'policy_scope_allowed'})
RETURN j.evidence_json.disallowed_scopes as scope, count(*) as failures
ORDER BY failures DESC

// Citation cascade: which docs depend on which?
MATCH (d1:Document)-[:CITES]->(d2:Document)
RETURN d1, d2

// Failure pattern evolution over runs
MATCH (r:Run)-[:CONTAINS]->(c:Conversation)-[:HAS_MESSAGE]->(m:Message)-[:FAILED_GATE]->(j:Judgment)
RETURN r.started_at, j.criterion, count(*) as failure_count
ORDER BY r.started_at
```

---

## 📊 Implementation Phases

### Phase 1: Database Schema (Week 1)
**Deliverables:**
- [ ] SQL migration: documents, chunks, retriever_logs, citations tables
- [ ] ALTER messages ADD content_json column
- [ ] Create indexes
- [ ] Run in Supabase SQL Editor

**Files Created:**
- `docs/migrations/003_rag_evaluation_schema.sql`

---

### Phase 2: Structured Output (Week 2)
**Deliverables:**
- [ ] Zod schemas for company_expert and pc_expert domains
- [ ] Structured output validator with JSON extraction
- [ ] Update LLM system prompts to force JSON output
- [ ] Integration with chat route

**Files Created:**
- `lib/evaluation/schemas/company-expert.schema.ts`
- `lib/evaluation/schemas/pc-expert.schema.ts`
- `lib/evaluation/validators/structured-output.validator.ts`

**Files Modified:**
- `app/api/chat/route.ts` - Add structured output validation

---

### Phase 3: Rule Validators (Week 3)
**Deliverables:**
- [ ] Implement 6 core validators
- [ ] Hook validators into chat route
- [ ] Save judgments to database
- [ ] Create domain config registry

**Files Created:**
- `lib/evaluation/validators/rule-validators.ts`
- `lib/evaluation/domains/registry.ts`
- `lib/evaluation/types.ts`

**Files Modified:**
- `app/api/chat/route.ts` - Add validator execution

---

### Phase 4: Citation Tracking (Week 4)
**Deliverables:**
- [ ] Citation extractor from content_json
- [ ] Save citations to database
- [ ] Link citations to retriever_logs
- [ ] Citation validation UI

**Files Created:**
- `lib/evaluation/citations.service.ts`
- `components/evaluation/CitationValidator.tsx`

**Files Modified:**
- `app/api/chat/route.ts` - Save citations
- `components/Chat.tsx` - Display citation indicators

---

### Phase 5: GraphRAG Sync (Week 5)
**Deliverables:**
- [ ] Event emitter for Supabase changes
- [ ] Graph ingester service
- [ ] Neo4j relationship creation
- [ ] Replay mechanism for schema changes

**Files Created:**
- `lib/graphrag/sync.service.ts`
- `lib/graphrag/event-emitter.ts`
- `lib/graphrag/ingester.ts`
- `lib/graphrag/neo4j-client.ts`

---

### Phase 6: Domain Registry & Gates (Week 6)
**Deliverables:**
- [ ] Domain config definitions
- [ ] Gate evaluation logic
- [ ] Aggregate metrics calculation
- [ ] Run-level success/failure determination

**Files Created:**
- `lib/evaluation/domains/company-expert.config.ts`
- `lib/evaluation/domains/pc-expert.config.ts`
- `lib/evaluation/gates.service.ts`

**Files Modified:**
- `lib/evaluation/domains/registry.ts` - Complete implementation

---

### Phase 7: Evaluation Dashboard (Week 7)
**Deliverables:**
- [ ] Run comparison UI
- [ ] Gate status visualization
- [ ] Citation correctness tracking
- [ ] Grounding metrics charts

**Files Created:**
- `app/evaluation/page.tsx`
- `components/evaluation/EvaluationDashboard.tsx`
- `components/evaluation/GateStatusCard.tsx`
- `components/evaluation/CitationAnalysis.tsx`
- `hooks/useEvaluationData.ts`

---

## 📈 Success Metrics

### Hard Gates (Must Pass 100%)
- [ ] `must_cite_if_claims` = 1.0
- [ ] `citation_exists` = 1.0
- [ ] `policy_scope_allowed` = 1.0
- [ ] `format_ok` = 1.0

### Quality Gates (Thresholds)
- [ ] `freshness_ok` ≥ 0.9
- [ ] `grounded_claim_rate` ≥ 0.95
- [ ] `hallucination_rate` ≤ 0.02
- [ ] `retrieval_relevance@5` ≥ 0.3

### System Health
- [ ] Validator latency < 100ms per rule
- [ ] Graph sync lag < 5 minutes
- [ ] Citation extraction success rate > 99%
- [ ] Schema validation success rate > 99%

---

## 🔒 Security & Governance

### Document Access Control
- Row-level security on documents table
- Visibility checks in citation_exists validator
- Policy scope validation per user role

### PII Protection
- PII scanning in format_ok validator
- Redaction before logging
- Confidentiality self-assessment by LLM

### Audit Trail
- Every citation tracked
- Every judgment recorded
- Every retrieval logged
- Immutable event log for GraphRAG

---

## 🚀 Quick Start Guide

### 1. Run Database Migrations
```bash
psql $DATABASE_URL < docs/migrations/003_rag_evaluation_schema.sql
```

### 2. Update LLM System Prompt
```typescript
const systemPrompt = `
You are a company expert. Always respond with a JSON block:

\`\`\`json
{
  "answer": "your answer here",
  "citations": [{"doc_id": "DOC123", "sections": ["§4"]}],
  "policy_scope": ["HR"],
  "confidentiality": "internal"
}
\`\`\`
`;
```

### 3. Enable Structured Output Validation
```typescript
// In chat route
const validation = await validateStructuredOutput(response, 'company_expert');
if (!validation.valid) {
  // Handle format error
}
```

### 4. Run Validators
```typescript
const judgments = await DomainRegistry.validate(
  'company_expert',
  messageId,
  validation.parsed,
  { userId, conversationId }
);
```

### 5. Check Gates
```typescript
const { gates_passed } = await DomainRegistry.aggregate(runId);
if (!gates_passed) {
  // Flag for review
}
```

---

## 📚 References

### Industry Standards
- **LLM Evaluation:** HELM, MMLU, TruthfulQA benchmarks
- **RAG Evaluation:** RAGAS (Retrieval-Augmented Generation Assessment)
- **Citation Standards:** ACL, IEEE citation formats
- **Grounding Metrics:** Attributable to Identified Sources (AIS)

### Internal Documentation
- `docs/EVALUATION_METRICS_TOOL_COMPLETE.md` - Current evaluation system
- `docs/PHASE_12_ANALYTICS_TOOLS_INTEGRATION_PLAN.md` - Analytics integration
- `docs/migrations/002_create_evaluations_table.sql` - Existing evaluations schema

---

## ✅ Completion Criteria

**Planning Phase:** ✅ COMPLETE
**Database Schema:** ⏳ Ready to implement
**Structured Output:** ⏳ Ready to implement
**Rule Validators:** ⏳ Ready to implement
**GraphRAG Sync:** ⏳ Ready to implement
**Domain Registry:** ⏳ Ready to implement
**Evaluation UI:** ⏳ Ready to implement

**Next Action:** Locate exact files and code insertion points for Phase 1 implementation.

---

**Document Status:** Planning Complete
**Ready for Implementation:** YES
**Risk Level:** MEDIUM (new tables, schema changes)
**Estimated Total Time:** 7 weeks
**First Milestone:** Database schema (1 week)
