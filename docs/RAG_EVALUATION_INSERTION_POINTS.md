# RAG Evaluation Framework - File Insertion Points
**Created:** October 14, 2025
**Purpose:** Detailed guide for implementing RAG evaluation framework with exact insertion points

---

## Table of Contents
1. [Files to Create (New Files)](#files-to-create-new-files)
2. [Files to Modify (Existing Files)](#files-to-modify-existing-files)
3. [Database Migrations](#database-migrations)
4. [Dependencies to Install](#dependencies-to-install)
5. [Implementation Order](#implementation-order)

---

## Files to Create (New Files)

### 1. Database Schema
**File:** `docs/migrations/003_rag_evaluation_schema.sql`
**Purpose:** Create all RAG evaluation tables
**Contents:** See full SQL schema in `RAG_EVALUATION_FRAMEWORK_PLAN.md` Section 3

**Tables to create:**
- `runs` - Experiment tracking
- `documents` - Source of truth for documents
- `chunks` - Document chunks with embeddings
- `retriever_logs` - Audit trail of retrieval operations
- `citations` - Answer-to-document links
- `judgments` - Unified evaluation table (replaces message_evaluations)
- `tool_calls` - Normalized tool execution tracking
- `errors` - Normalized error tracking
- ALTER `messages` table to add `content_json` JSONB column

---

### 2. TypeScript Schemas

#### `lib/evaluation/schemas/company-expert.schema.ts`
**Purpose:** Zod schema for company expert domain structured output

```typescript
import { z } from 'zod';

export const CompanyExpertSchema = z.object({
  answer: z.string().min(1, 'Answer is required'),
  citations: z.array(z.object({
    doc_id: z.string(),
    span_start: z.number().optional(),
    span_end: z.number().optional(),
    quote: z.string().optional(),
  })),
  policy_scope: z.enum(['public', 'internal', 'confidential', 'restricted']),
  confidentiality: z.enum(['low', 'medium', 'high', 'critical']),
  reasoning: z.string().optional(),
});

export type CompanyExpertOutput = z.infer<typeof CompanyExpertSchema>;
```

#### `lib/evaluation/schemas/pc-expert.schema.ts`
**Purpose:** Zod schema for PC expert domain structured output

```typescript
import { z } from 'zod';

export const PCExpertSchema = z.object({
  parts_list: z.array(z.object({
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive().optional(),
    url: z.string().url().optional(),
  })),
  power_calculation: z.object({
    total_watts: z.number().positive(),
    recommended_psu: z.number().positive(),
    breakdown: z.record(z.string(), z.number()),
  }),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
  total_price: z.number().positive().optional(),
});

export type PCExpertOutput = z.infer<typeof PCExpertSchema>;
```

---

### 3. Validators

#### `lib/evaluation/validators/structured-output.validator.ts`
**Purpose:** Validate structured JSON output from LLM

```typescript
import { z } from 'zod';
import { CompanyExpertSchema } from '../schemas/company-expert.schema';
import { PCExpertSchema } from '../schemas/pc-expert.schema';

export interface ValidationResult {
  valid: boolean;
  data?: any;
  errors?: string[];
}

export class StructuredOutputValidator {
  /**
   * Validate LLM response against domain schema
   */
  validate(response: string, domain: 'company_expert' | 'pc_expert'): ValidationResult {
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          valid: false,
          errors: ['No JSON found in response']
        };
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      // Validate against schema
      const schema = domain === 'company_expert' ? CompanyExpertSchema : PCExpertSchema;
      const result = schema.safeParse(parsed);

      if (result.success) {
        return {
          valid: true,
          data: result.data
        };
      } else {
        return {
          valid: false,
          errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }
}

export const structuredOutputValidator = new StructuredOutputValidator();
```

#### `lib/evaluation/validators/rule-validators.ts`
**Purpose:** Fast rule-based validators (6 core validators)

```typescript
import { supabase } from '@/lib/supabaseClient';

export interface ValidatorResult {
  passed: boolean;
  score?: number;
  message?: string;
  evidence?: any;
}

/**
 * Validator 1: must_cite_if_claims
 * Fail if factual claims without citations
 */
export async function mustCiteIfClaims(
  content: string,
  contentJson: any
): Promise<ValidatorResult> {
  // Check if response makes factual claims
  const claimPatterns = [
    /according to/i,
    /research shows/i,
    /studies indicate/i,
    /data suggests/i,
    /evidence shows/i
  ];

  const hasClaims = claimPatterns.some(pattern => pattern.test(content));

  if (!hasClaims) {
    return { passed: true, message: 'No factual claims detected' };
  }

  // Check if citations exist
  const hasCitations = contentJson?.citations && contentJson.citations.length > 0;

  return {
    passed: hasCitations,
    message: hasCitations
      ? `Found ${contentJson.citations.length} citations`
      : 'Factual claims without citations',
    evidence: { hasClaims, citationCount: contentJson?.citations?.length || 0 }
  };
}

/**
 * Validator 2: citation_exists
 * Verify all cited doc_ids exist and are accessible
 */
export async function citationExists(
  contentJson: any,
  userId: string
): Promise<ValidatorResult> {
  const citations = contentJson?.citations || [];

  if (citations.length === 0) {
    return { passed: true, message: 'No citations to validate' };
  }

  const docIds = citations.map((c: any) => c.doc_id);
  const uniqueDocIds = [...new Set(docIds)];

  // Query documents table
  const { data: docs, error } = await supabase
    .from('documents')
    .select('id')
    .in('id', uniqueDocIds)
    .eq('user_id', userId);

  if (error) {
    return { passed: false, message: `Database error: ${error.message}` };
  }

  const foundDocIds = new Set(docs?.map(d => d.id) || []);
  const missingDocIds = uniqueDocIds.filter(id => !foundDocIds.has(id));

  return {
    passed: missingDocIds.length === 0,
    score: foundDocIds.size / uniqueDocIds.length,
    message: missingDocIds.length === 0
      ? 'All citations valid'
      : `Missing docs: ${missingDocIds.join(', ')}`,
    evidence: { total: uniqueDocIds.length, found: foundDocIds.size, missing: missingDocIds }
  };
}

/**
 * Validator 3: retrieval_relevance_at_k
 * Calculate term overlap between query and retrieved docs
 */
export function retrievalRelevanceAtK(
  query: string,
  retrievedDocs: Array<{ text: string }>,
  k: number = 5
): ValidatorResult {
  const topK = retrievedDocs.slice(0, k);
  const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 3));

  let totalOverlap = 0;
  topK.forEach(doc => {
    const docTerms = new Set(doc.text.toLowerCase().split(/\s+/).filter(t => t.length > 3));
    const overlap = [...queryTerms].filter(term => docTerms.has(term)).length;
    totalOverlap += overlap;
  });

  const avgOverlap = topK.length > 0 ? totalOverlap / topK.length : 0;
  const maxPossible = queryTerms.size;
  const score = maxPossible > 0 ? avgOverlap / maxPossible : 0;

  return {
    passed: score >= 0.2, // 20% threshold
    score,
    message: `Avg term overlap: ${avgOverlap.toFixed(2)} terms`,
    evidence: { queryTerms: queryTerms.size, avgOverlap, score }
  };
}

/**
 * Validator 4: policy_scope_allowed
 * Check user authorization for policy scope
 */
export async function policyScopeAllowed(
  contentJson: any,
  userId: string
): Promise<ValidatorResult> {
  const policyScope = contentJson?.policy_scope;

  if (!policyScope) {
    return { passed: true, message: 'No policy scope specified' };
  }

  // Get user role from auth
  const { data: userData } = await supabase.auth.getUser();
  const userRole = userData?.user?.user_metadata?.role || 'user';

  // Define access matrix
  const accessMatrix: Record<string, string[]> = {
    public: ['user', 'internal', 'admin'],
    internal: ['internal', 'admin'],
    confidential: ['admin'],
    restricted: ['admin']
  };

  const allowed = accessMatrix[policyScope]?.includes(userRole) || false;

  return {
    passed: allowed,
    message: allowed
      ? `User ${userRole} authorized for ${policyScope}`
      : `User ${userRole} not authorized for ${policyScope}`,
    evidence: { policyScope, userRole, allowed }
  };
}

/**
 * Validator 5: freshness_ok
 * Check if cited documents are recent enough
 */
export async function freshnessOk(
  contentJson: any,
  maxAgeDays: number = 365
): Promise<ValidatorResult> {
  const citations = contentJson?.citations || [];

  if (citations.length === 0) {
    return { passed: true, message: 'No citations to check freshness' };
  }

  const docIds = citations.map((c: any) => c.doc_id);

  const { data: docs } = await supabase
    .from('documents')
    .select('id, created_at')
    .in('id', docIds);

  if (!docs || docs.length === 0) {
    return { passed: false, message: 'No documents found' };
  }

  const now = new Date();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  const staleDocIds = docs
    .filter(doc => {
      const age = now.getTime() - new Date(doc.created_at).getTime();
      return age > maxAgeMs;
    })
    .map(d => d.id);

  const freshnessScore = 1 - (staleDocIds.length / docs.length);

  return {
    passed: freshnessScore >= 0.9, // 90% threshold
    score: freshnessScore,
    message: staleDocIds.length === 0
      ? 'All documents fresh'
      : `${staleDocIds.length} stale documents`,
    evidence: { total: docs.length, stale: staleDocIds.length, staleIds: staleDocIds }
  };
}

/**
 * Validator 6: format_ok
 * Validate JSON format and check for PII
 */
export function formatOk(
  response: string,
  contentJson: any
): ValidatorResult {
  const errors: string[] = [];

  // Check JSON validity (already done by validator, but double-check)
  if (!contentJson) {
    errors.push('Invalid or missing JSON');
  }

  // Basic PII detection (SSN, credit cards, emails with sensitive domains)
  const piiPatterns = [
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, name: 'SSN' },
    { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, name: 'Credit Card' },
    { pattern: /@(?:ssn|tax|health|medical)\./, name: 'Sensitive email' }
  ];

  const piiFound = piiPatterns.filter(p => p.pattern.test(response));
  if (piiFound.length > 0) {
    errors.push(`PII detected: ${piiFound.map(p => p.name).join(', ')}`);
  }

  return {
    passed: errors.length === 0,
    message: errors.length === 0 ? 'Format valid, no PII detected' : errors.join('; '),
    evidence: { errors, piiFound: piiFound.map(p => p.name) }
  };
}
```

---

### 4. Domain Registry

#### `lib/evaluation/domains/registry.ts`
**Purpose:** Domain-specific validation and extraction logic

```typescript
import { structuredOutputValidator } from '../validators/structured-output.validator';
import {
  mustCiteIfClaims,
  citationExists,
  retrievalRelevanceAtK,
  policyScopeAllowed,
  freshnessOk,
  formatOk
} from '../validators/rule-validators';
import type { ValidatorResult } from '../validators/rule-validators';

export interface DomainConfig {
  name: string;
  schema: 'company_expert' | 'pc_expert';
  validators: Array<{
    name: string;
    criterion: string;
    executor: (params: any) => Promise<ValidatorResult>;
    gate: number; // Pass threshold (0-100)
  }>;
}

export const domainRegistry: Record<string, DomainConfig> = {
  company_expert: {
    name: 'Company Expert',
    schema: 'company_expert',
    validators: [
      {
        name: 'must_cite_if_claims',
        criterion: 'citation_required',
        executor: async ({ content, contentJson }) => mustCiteIfClaims(content, contentJson),
        gate: 100 // Must pass
      },
      {
        name: 'citation_exists',
        criterion: 'citation_valid',
        executor: async ({ contentJson, userId }) => citationExists(contentJson, userId),
        gate: 100 // Must pass
      },
      {
        name: 'policy_scope_allowed',
        criterion: 'authorization',
        executor: async ({ contentJson, userId }) => policyScopeAllowed(contentJson, userId),
        gate: 100 // Must pass
      },
      {
        name: 'freshness_ok',
        criterion: 'document_freshness',
        executor: async ({ contentJson }) => freshnessOk(contentJson, 365),
        gate: 90 // 90% threshold
      },
      {
        name: 'format_ok',
        criterion: 'format_compliance',
        executor: async ({ content, contentJson }) => formatOk(content, contentJson),
        gate: 100 // Must pass
      }
    ]
  },
  pc_expert: {
    name: 'PC Expert',
    schema: 'pc_expert',
    validators: [
      {
        name: 'format_ok',
        criterion: 'format_compliance',
        executor: async ({ content, contentJson }) => formatOk(content, contentJson),
        gate: 100 // Must pass
      }
    ]
  }
};

/**
 * Execute all validators for a domain
 */
export async function executeDomainValidation(
  domain: string,
  params: {
    content: string;
    contentJson: any;
    userId: string;
    retrievedDocs?: Array<{ text: string }>;
  }
): Promise<Array<{ validator: string; result: ValidatorResult; gate: number }>> {
  const config = domainRegistry[domain];
  if (!config) {
    throw new Error(`Unknown domain: ${domain}`);
  }

  const results = [];
  for (const validator of config.validators) {
    const result = await validator.executor(params);
    results.push({
      validator: validator.name,
      criterion: validator.criterion,
      result,
      gate: validator.gate
    });
  }

  return results;
}
```

---

### 5. Services

#### `lib/evaluation/citations.service.ts`
**Purpose:** Extract and save citations to database

```typescript
import { supabase } from '@/lib/supabaseClient';

export interface Citation {
  message_id: string;
  document_id: string;
  span_start?: number;
  span_end?: number;
  quote?: string;
  correctness?: boolean;
}

export class CitationsService {
  /**
   * Extract citations from structured output and save to DB
   */
  async saveCitations(
    messageId: string,
    contentJson: any
  ): Promise<void> {
    const citations = contentJson?.citations || [];

    if (citations.length === 0) {
      console.log('[Citations] No citations to save');
      return;
    }

    const citationRecords = citations.map((c: any) => ({
      message_id: messageId,
      document_id: c.doc_id,
      span_start: c.span_start,
      span_end: c.span_end,
      quote: c.quote,
      correctness: null, // Will be validated by human or LLM judge
    }));

    const { error } = await supabase
      .from('citations')
      .insert(citationRecords);

    if (error) {
      console.error('[Citations] Error saving citations:', error);
      throw error;
    }

    console.log(`[Citations] Saved ${citationRecords.length} citations for message ${messageId}`);
  }

  /**
   * Link retriever logs to citations
   */
  async linkRetrieverLog(
    messageId: string,
    retrieverLogId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('citations')
      .update({ retriever_log_id: retrieverLogId })
      .eq('message_id', messageId);

    if (error) {
      console.error('[Citations] Error linking retriever log:', error);
    }
  }
}

export const citationsService = new CitationsService();
```

#### `lib/evaluation/retriever-logs.service.ts`
**Purpose:** Log retrieval operations for audit trail

```typescript
import { supabase } from '@/lib/supabaseClient';

export interface RetrieverLog {
  conversation_id: string;
  user_id: string;
  query: string;
  topk: number;
  retrieved_doc_ids: string[];
  scores?: number[];
  latency_ms: number;
}

export class RetrieverLogsService {
  /**
   * Save retriever log to database
   */
  async saveRetrieverLog(log: RetrieverLog): Promise<string | null> {
    const { data, error } = await supabase
      .from('retriever_logs')
      .insert(log)
      .select('id')
      .single();

    if (error) {
      console.error('[RetrieverLogs] Error saving log:', error);
      return null;
    }

    console.log(`[RetrieverLogs] Saved log ${data.id} for query: ${log.query.slice(0, 50)}`);
    return data.id;
  }
}

export const retrieverLogsService = new RetrieverLogsService();
```

#### `lib/evaluation/judgments.service.ts`
**Purpose:** Save judgment records to unified table

```typescript
import { supabase } from '@/lib/supabaseClient';
import type { ValidatorResult } from '../validators/rule-validators';

export interface JudgmentRecord {
  message_id: string;
  judge_type: 'rule' | 'human' | 'llm';
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: any;
  judge_name?: string;
  notes?: string;
}

export class JudgmentsService {
  /**
   * Save rule-based judgment
   */
  async saveRuleJudgment(
    messageId: string,
    validatorName: string,
    criterion: string,
    result: ValidatorResult
  ): Promise<void> {
    const judgment: JudgmentRecord = {
      message_id: messageId,
      judge_type: 'rule',
      judge_name: validatorName,
      criterion,
      score: result.score || (result.passed ? 1 : 0),
      passed: result.passed,
      evidence_json: result.evidence,
      notes: result.message,
    };

    const { error } = await supabase
      .from('judgments')
      .insert(judgment);

    if (error) {
      console.error('[Judgments] Error saving judgment:', error);
      throw error;
    }

    console.log(`[Judgments] Saved ${criterion} judgment for message ${messageId}`);
  }

  /**
   * Save multiple judgments (batch)
   */
  async saveRuleJudgments(
    messageId: string,
    validationResults: Array<{ validator: string; criterion: string; result: ValidatorResult }>
  ): Promise<void> {
    const judgments = validationResults.map(vr => ({
      message_id: messageId,
      judge_type: 'rule' as const,
      judge_name: vr.validator,
      criterion: vr.criterion,
      score: vr.result.score || (vr.result.passed ? 1 : 0),
      passed: vr.result.passed,
      evidence_json: vr.result.evidence,
      notes: vr.result.message,
    }));

    const { error } = await supabase
      .from('judgments')
      .insert(judgments);

    if (error) {
      console.error('[Judgments] Error saving batch judgments:', error);
      throw error;
    }

    console.log(`[Judgments] Saved ${judgments.length} judgments for message ${messageId}`);
  }
}

export const judgmentsService = new JudgmentsService();
```

---

### 6. GraphRAG Sync Service

#### `lib/graphrag/sync.service.ts`
**Purpose:** Sync evaluation data to Neo4j knowledge graph

```typescript
import { graphitiClient } from './client';

export interface GraphSyncEvent {
  type: 'citation' | 'judgment' | 'error';
  messageId: string;
  data: any;
  idempotencyKey: string;
}

export class GraphSyncService {
  private processedKeys = new Set<string>();

  /**
   * Emit event for graph ingestion
   */
  emitEvent(event: GraphSyncEvent): void {
    // Check idempotency
    if (this.processedKeys.has(event.idempotencyKey)) {
      console.log(`[GraphSync] Skipping duplicate event: ${event.idempotencyKey}`);
      return;
    }

    // Mark as processed
    this.processedKeys.add(event.idempotencyKey);

    // Queue for async processing
    this.processEventAsync(event).catch(error => {
      console.error('[GraphSync] Error processing event:', error);
    });
  }

  /**
   * Process event asynchronously
   */
  private async processEventAsync(event: GraphSyncEvent): Promise<void> {
    console.log(`[GraphSync] Processing event: ${event.type} for message ${event.messageId}`);

    switch (event.type) {
      case 'citation':
        await this.syncCitation(event);
        break;
      case 'judgment':
        await this.syncJudgment(event);
        break;
      case 'error':
        await this.syncError(event);
        break;
    }
  }

  private async syncCitation(event: GraphSyncEvent): Promise<void> {
    // Create episode linking message -> document
    // Implementation depends on Graphiti API
    console.log('[GraphSync] Syncing citation to Neo4j');
  }

  private async syncJudgment(event: GraphSyncEvent): Promise<void> {
    // Create episode linking message -> judgment
    console.log('[GraphSync] Syncing judgment to Neo4j');
  }

  private async syncError(event: GraphSyncEvent): Promise<void> {
    // Create episode linking message -> error
    console.log('[GraphSync] Syncing error to Neo4j');
  }
}

export const graphSyncService = new GraphSyncService();
```

---

### 7. Types

#### `lib/evaluation/types.ts`
**Purpose:** Centralized type definitions

```typescript
export interface MessageWithEvaluation {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  content_json?: any;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;

  // Relations
  citations?: Citation[];
  judgments?: Judgment[];
  toolCalls?: ToolCall[];
  errors?: Error[];
}

export interface Citation {
  id: string;
  message_id: string;
  document_id: string;
  span_start?: number;
  span_end?: number;
  quote?: string;
  correctness?: boolean;
  retriever_log_id?: string;
}

export interface Judgment {
  id: string;
  message_id: string;
  judge_type: 'rule' | 'human' | 'llm';
  judge_name?: string;
  criterion: string;
  score: number;
  passed: boolean;
  evidence_json?: any;
  notes?: string;
  created_at: string;
}

export interface ToolCall {
  id: string;
  message_id: string;
  tool_name: string;
  input_json: any;
  output_json?: any;
  success: boolean;
  duration_ms?: number;
  error_message?: string;
}

export interface Error {
  id: string;
  message_id?: string;
  conversation_id: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Run {
  id: string;
  name: string;
  model_name: string;
  model_version: string;
  prompt_version: string;
  dataset_version?: string;
  git_sha?: string;
  config_json?: any;
  started_at: string;
  completed_at?: string;
}
```

---

## Files to Modify (Existing Files)

### 1. `/app/api/chat/route.ts`
**Purpose:** Integrate structured output validation and evaluation

#### Insertion Point 1: After line 10 - Add imports
```typescript
// EXISTING IMPORTS (lines 1-10)
import { NextRequest } from 'next/server';
import { streamOpenAIResponse, runOpenAIWithToolCalls } from '@/lib/llm/openai';
// ... other imports

// ADD THESE IMPORTS AFTER LINE 10:
import { structuredOutputValidator } from '@/lib/evaluation/validators/structured-output.validator';
import { executeDomainValidation } from '@/lib/evaluation/domains/registry';
import { citationsService } from '@/lib/evaluation/citations.service';
import { retrieverLogsService } from '@/lib/evaluation/retriever-logs.service';
import { judgmentsService } from '@/lib/evaluation/judgments.service';
```

#### Insertion Point 2: After line 87 - Log retriever operation
**Location:** Inside GraphRAG enhancement block (lines 77-118)

Replace lines 87-93 with:
```typescript
// EXISTING CODE (line 87-93):
const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
  userId,
  userMessage,
  {
    minConfidence: 0.7,
  }
);

// REPLACE WITH:
const retrievalStartTime = Date.now();
const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
  userId,
  userMessage,
  {
    minConfidence: 0.7,
  }
);
const retrievalLatency = Date.now() - retrievalStartTime;

// Log retriever operation
if (enhanced.contextUsed && enhanced.sources) {
  const retrieverLog = {
    conversation_id: conversationId || '',
    user_id: userId,
    query: userMessage,
    topk: enhanced.sources.length,
    retrieved_doc_ids: enhanced.sources.map(s => s.entity), // Assuming entity is doc_id
    scores: enhanced.sources.map(s => s.confidence),
    latency_ms: retrievalLatency,
  };

  // Save asynchronously (don't block response)
  retrieverLogsService.saveRetrieverLog(retrieverLog).catch(err =>
    console.error('[API] Error saving retriever log:', err)
  );
}
```

#### Insertion Point 3: After line 197 - Add structured output validation
**Location:** Non-streaming tool-enabled path, after response is received

Insert AFTER line 197 (after the else block that assigns finalResponse):
```typescript
// EXISTING CODE (line 197):
      } else {
        // Fallback for legacy string responses
        finalResponse = llmResponse as string;
      }

// INSERT THIS BLOCK AFTER LINE 197:
      // ====================
      // STRUCTURED OUTPUT VALIDATION & EVALUATION
      // ====================
      let contentJsonData: any = null;
      let validationResults: any[] = [];

      // Determine domain (can be from request params, conversation metadata, etc.)
      const domain = 'company_expert'; // TODO: Make this dynamic based on conversation type

      // 1. Validate structured output
      const validation = structuredOutputValidator.validate(finalResponse, domain);

      if (validation.valid) {
        contentJsonData = validation.data;
        console.log('[API] Structured output validation passed');

        // 2. Execute domain-specific rule validators
        try {
          validationResults = await executeDomainValidation(domain, {
            content: finalResponse,
            contentJson: contentJsonData,
            userId: userId || '',
            retrievedDocs: graphRAGMetadata?.sources?.map(s => ({ text: s.fact })) || [],
          });

          console.log('[API] Validation results:', validationResults.map(vr => ({
            validator: vr.validator,
            passed: vr.result.passed,
            score: vr.result.score,
          })));
        } catch (validationError) {
          console.error('[API] Domain validation error:', validationError);
        }
      } else {
        console.warn('[API] Structured output validation failed:', validation.errors);
      }
      // ====================
```

#### Insertion Point 4: After line 407 - Save citations and judgments
**Location:** In Chat.tsx where message is saved to database

**NOTE:** This needs to be done in the frontend after message is saved, OR we modify the chat route to return messageId so we can save citations server-side.

**Better approach:** Modify the chat route to save the message to DB itself, then save citations/judgments.

Insert AFTER the streaming completes (inside the non-streaming branch, after line 197):

```typescript
// After validation results are computed (from insertion point 3)

// Save message to database FIRST to get message ID
const { data: savedMessage, error: saveError } = await supabase
  .from('messages')
  .insert({
    conversation_id: conversationId || '',
    user_id: userId || '',
    role: 'assistant',
    content: finalResponse,
    content_json: contentJsonData, // Store structured output
    input_tokens: tokenUsage?.input_tokens,
    output_tokens: tokenUsage?.output_tokens,
    latency_ms: Date.now() - requestStartTime, // Track request start time
  })
  .select('id')
  .single();

if (saveError) {
  console.error('[API] Error saving message:', saveError);
} else if (savedMessage) {
  const messageId = savedMessage.id;

  // 3. Save citations asynchronously
  if (contentJsonData && contentJsonData.citations) {
    citationsService.saveCitations(messageId, contentJsonData).catch(err =>
      console.error('[API] Error saving citations:', err)
    );
  }

  // 4. Save judgments asynchronously
  if (validationResults.length > 0) {
    judgmentsService.saveRuleJudgments(messageId, validationResults).catch(err =>
      console.error('[API] Error saving judgments:', err)
    );
  }
}
```

**WARNING:** This changes the flow significantly. The message will be saved server-side instead of client-side. We need to return the message ID and saved data to the client so it can update the UI properly.

**Alternative approach (RECOMMENDED):** Keep client-side message saving, but add a separate API endpoint for post-processing:

Create new endpoint: `/app/api/evaluate-message/route.ts`

```typescript
// New file: app/api/evaluate-message/route.ts
import { NextRequest } from 'next/server';
import { structuredOutputValidator } from '@/lib/evaluation/validators/structured-output.validator';
import { executeDomainValidation } from '@/lib/evaluation/domains/registry';
import { citationsService } from '@/lib/evaluation/citations.service';
import { judgmentsService } from '@/lib/evaluation/judgments.service';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { messageId, domain, retrievedSources } = await req.json();

    // Get message from database
    const { data: message, error } = await supabase
      .from('messages')
      .select('id, content, user_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (error || !message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), { status: 404 });
    }

    // 1. Validate structured output
    const validation = structuredOutputValidator.validate(message.content, domain);

    if (!validation.valid) {
      return new Response(JSON.stringify({
        success: false,
        errors: validation.errors
      }), { status: 400 });
    }

    const contentJson = validation.data;

    // 2. Update message with content_json
    await supabase
      .from('messages')
      .update({ content_json: contentJson })
      .eq('id', messageId);

    // 3. Execute domain validators
    const validationResults = await executeDomainValidation(domain, {
      content: message.content,
      contentJson,
      userId: message.user_id,
      retrievedDocs: retrievedSources || [],
    });

    // 4. Save citations
    if (contentJson.citations) {
      await citationsService.saveCitations(messageId, contentJson);
    }

    // 5. Save judgments
    await judgmentsService.saveRuleJudgments(messageId, validationResults);

    return new Response(JSON.stringify({
      success: true,
      validationResults: validationResults.map(vr => ({
        validator: vr.validator,
        passed: vr.result.passed,
        score: vr.result.score,
        message: vr.result.message,
      }))
    }), { status: 200 });
  } catch (error) {
    console.error('[EvaluateMessage] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
```

---

### 2. `/components/Chat.tsx`
**Purpose:** Call evaluation endpoint after message is saved

#### Insertion Point: After line 427 - Call evaluation endpoint
**Location:** After replacing temp message with real one

Insert AFTER line 427 (after the message is saved to DB):
```typescript
// EXISTING CODE (line 427):
        );
      }

// INSERT AFTER LINE 427:
      // Trigger evaluation for structured output domains
      if (aiMsg && graphragCitations && graphragCitations.length > 0) {
        fetch('/api/evaluate-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: aiMsg.id,
            domain: 'company_expert', // TODO: Make dynamic
            retrievedSources: graphragCitations.map(c => ({ text: c.content })),
          }),
        })
          .then(res => res.json())
          .then(result => {
            console.log('[Chat] Evaluation completed:', result);
          })
          .catch(err => {
            console.error('[Chat] Evaluation error:', err);
          });
      }
```

---

### 3. `/lib/llm/openai.ts` and `/lib/llm/anthropic.ts`
**Purpose:** Force structured JSON output from LLM

#### OpenAI - Insertion Point: Line 147 - Add response_format
**Location:** Inside `runOpenAIWithToolCalls` function

Modify line 147-153 to add `response_format`:
```typescript
// EXISTING CODE (line 147-153):
    const completion = await client.chat.completions.create({
      model,
      messages: currentMessages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
      ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
    });

// REPLACE WITH:
    const completion = await client.chat.completions.create({
      model,
      messages: currentMessages as ChatCompletionMessageParam[],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }, // FORCE JSON OUTPUT
      ...(tools && tools.length > 0 ? { tools: tools as ChatCompletionTool[] } : {}),
    });
```

**IMPORTANT:** When using `response_format: { type: 'json_object' }`, you MUST include "JSON" in the system prompt. Modify the system prompt in the chat route to include:

```typescript
// In app/api/chat/route.ts, add system message:
const systemPrompt = {
  role: 'system',
  content: `You are a helpful assistant. Always respond with valid JSON matching this schema:
{
  "answer": "string",
  "citations": [{"doc_id": "string", "quote": "string"}],
  "policy_scope": "public|internal|confidential|restricted",
  "confidentiality": "low|medium|high|critical"
}`
};

// Add to messages array:
enhancedMessages = [systemPrompt, ...enhancedMessages];
```

#### Anthropic - Insertion Point: Line 141 - Add system prompt
**Location:** Inside `runAnthropicWithToolCalls` function

Anthropic doesn't have `response_format`, so we enforce JSON via system prompt:

Modify lines 141-146:
```typescript
// EXISTING CODE (line 141-146):
  let response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: anthropicMessages,
    ...(mappedTools ? { tools: mappedTools } : {}),
  });

// REPLACE WITH:
  let response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: `You are a helpful assistant. You MUST respond with valid JSON matching this schema:
{
  "answer": "string",
  "citations": [{"doc_id": "string", "quote": "string"}],
  "policy_scope": "public|internal|confidential|restricted",
  "confidentiality": "low|medium|high|critical"
}

Always wrap your response in a JSON code block.`,
    messages: anthropicMessages,
    ...(mappedTools ? { tools: mappedTools } : {}),
  });
```

---

### 4. `/components/evaluation/EvaluationModal.tsx`
**Purpose:** Add citation validation UI

#### Insertion Point: After line 196 - Add citation validation section

Insert AFTER line 196 (after failure tags section):
```typescript
// EXISTING CODE (line 196):
          </div>
        </div>
      )}

// INSERT AFTER LINE 196:
      {/* Citation Validation */}
      {message?.content_json?.citations && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Citation Correctness</label>
          <p className="text-sm text-muted-foreground mb-2">
            Verify that each citation accurately supports the answer
          </p>
          {message.content_json.citations.map((citation: any, index: number) => (
            <div key={index} className="flex items-center space-x-3 p-2 border rounded">
              <input
                type="checkbox"
                checked={citationCorrectness[citation.doc_id] || false}
                onChange={(e) => setCitationCorrectness({
                  ...citationCorrectness,
                  [citation.doc_id]: e.target.checked
                })}
              />
              <div className="flex-1">
                <p className="text-sm font-mono">{citation.doc_id}</p>
                {citation.quote && (
                  <p className="text-xs text-muted-foreground">"{citation.quote}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Groundedness Slider */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Groundedness (0-100%)
        </label>
        <p className="text-sm text-muted-foreground mb-2">
          How well is the answer grounded in the retrieved documents?
        </p>
        <input
          type="range"
          min="0"
          max="100"
          value={groundedness}
          onChange={(e) => setGroundedness(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="text-center text-sm font-semibold">{groundedness}%</div>
      </div>
```

#### Insertion Point: After line 23 - Add state variables

Insert AFTER line 30 (after existing state variables):
```typescript
// EXISTING CODE (line 23-30):
const [rating, setRating] = useState(3);
const [success, setSuccess] = useState<boolean | null>(null);
const [failureTags, setFailureTags] = useState<string[]>([]);
const [notes, setNotes] = useState('');
const [expectedBehavior, setExpectedBehavior] = useState('');
const [actualBehavior, setActualBehavior] = useState('');
const [loading, setLoading] = useState(false);

// ADD AFTER LINE 30:
const [citationCorrectness, setCitationCorrectness] = useState<Record<string, boolean>>({});
const [groundedness, setGroundedness] = useState<number>(50);
const [message, setMessage] = useState<any>(null);
```

#### Insertion Point: After line 38 - Fetch message data

Insert AFTER line 38 (inside useEffect):
```typescript
// EXISTING CODE (line 32-38):
useEffect(() => {
  if (!messageId) return;
  // Fetch any existing evaluation
  // ... existing code

// ADD BEFORE THE CLOSING OF useEffect:
  // Fetch message with content_json
  supabase
    .from('messages')
    .select('id, content, content_json')
    .eq('id', messageId)
    .single()
    .then(({ data }) => {
      if (data) setMessage(data);
    });
}, [messageId]);
```

---

### 5. `/package.json`
**Purpose:** Add zod dependency

#### Insertion Point: Line 31 - Add zod to dependencies

Modify dependencies section (around line 11-31):
```json
{
  "dependencies": {
    "react": "^19.1.0",
    "next": "^15.5.4",
    "...": "...",
    "zod": "^3.22.4"
  }
}
```

**After modifying package.json, run:**
```bash
npm install
```

---

## Database Migrations

### Step 1: Run SQL Migration
**File:** Create `docs/migrations/003_rag_evaluation_schema.sql`

**Contents:** Full SQL schema from `RAG_EVALUATION_FRAMEWORK_PLAN.md` Section 3

**Execution:**
1. Open Supabase Dashboard > SQL Editor
2. Paste contents of `003_rag_evaluation_schema.sql`
3. Execute
4. Verify tables created:
   - `runs`
   - `documents`
   - `chunks`
   - `retriever_logs`
   - `citations`
   - `judgments`
   - `tool_calls` (if not exists)
   - `errors`
   - ALTER `messages` to add `content_json` column

### Step 2: Verify pgvector Extension
```sql
-- Check if pgvector is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If not enabled:
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 3: Create Indexes
```sql
-- Performance indexes
CREATE INDEX idx_citations_message_id ON citations(message_id);
CREATE INDEX idx_citations_document_id ON citations(document_id);
CREATE INDEX idx_judgments_message_id ON judgments(message_id);
CREATE INDEX idx_judgments_criterion ON judgments(criterion);
CREATE INDEX idx_retriever_logs_conversation_id ON retriever_logs(conversation_id);
CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding_vector vector_cosine_ops);
```

---

## Dependencies to Install

### 1. NPM Packages
```bash
npm install zod
```

### 2. Supabase Extensions
- `pgvector` - Already installed (verify in dashboard)

---

## Implementation Order

### Phase 1: Database Setup (Week 1)
1. ✅ Plan created: `RAG_EVALUATION_FRAMEWORK_PLAN.md`
2. ✅ Insertion points documented: `RAG_EVALUATION_INSERTION_POINTS.md`
3. Create SQL migration: `003_rag_evaluation_schema.sql`
4. Run migration in Supabase SQL Editor
5. Verify all tables and indexes created
6. Install zod: `npm install zod`

### Phase 2: Structured Output (Week 2)
1. Create Zod schemas: `company-expert.schema.ts`, `pc-expert.schema.ts`
2. Create structured output validator: `structured-output.validator.ts`
3. Modify LLM providers: `lib/llm/openai.ts`, `lib/llm/anthropic.ts`
   - Add JSON response format enforcement
   - Update system prompts
4. Test structured output with simple queries

### Phase 3: Rule Validators (Week 3)
1. Create rule validators: `rule-validators.ts` (6 validators)
2. Create domain registry: `domains/registry.ts`
3. Test validators individually
4. Create evaluation types: `evaluation/types.ts`

### Phase 4: Services (Week 4)
1. Create citations service: `citations.service.ts`
2. Create retriever logs service: `retriever-logs.service.ts`
3. Create judgments service: `judgments.service.ts`
4. Test services with mock data

### Phase 5: Integration (Week 5)
1. Create evaluate-message endpoint: `app/api/evaluate-message/route.ts`
2. Modify chat route: `app/api/chat/route.ts`
   - Add imports
   - Log retriever operations
   - Call evaluation endpoint
3. Modify Chat component: `components/Chat.tsx`
   - Call evaluation endpoint after message saved
4. Test end-to-end flow

### Phase 6: UI Enhancements (Week 6)
1. Modify EvaluationModal: `components/evaluation/EvaluationModal.tsx`
   - Add citation correctness toggles
   - Add groundedness slider
   - Fetch message with content_json
2. Create CitationValidator component (optional)
3. Create GroundednessIndicator component (optional)

### Phase 7: GraphRAG Sync (Week 7)
1. Create graph sync service: `graphrag/sync.service.ts`
2. Integrate with judgments service
3. Test Neo4j relationship creation
4. Add monitoring and error handling

---

## Testing Checklist

### Unit Tests
- [ ] Zod schema validation (company_expert, pc_expert)
- [ ] Structured output validator
- [ ] Each rule validator (6 validators)
- [ ] Domain registry

### Integration Tests
- [ ] LLM returns valid JSON
- [ ] Citations saved to database
- [ ] Judgments saved to database
- [ ] Retriever logs saved to database
- [ ] GraphRAG sync events emitted

### End-to-End Tests
- [ ] User sends message
- [ ] GraphRAG retrieves documents
- [ ] LLM responds with structured output
- [ ] Validators execute
- [ ] Citations/judgments saved
- [ ] UI displays evaluation results
- [ ] Human can validate citations

---

## Rollback Plan

### If structured output breaks:
1. Remove `response_format` from OpenAI calls
2. Revert system prompts
3. Fall back to plain text responses

### If database migration fails:
1. Restore from backup
2. Review SQL errors
3. Fix schema issues
4. Re-run migration

### If GraphRAG sync breaks:
1. Disable sync service
2. Continue with SQL-only storage
3. Debug Neo4j connection
4. Re-enable when fixed

---

## Performance Considerations

### Async Operations
- Citations saved asynchronously (don't block response)
- Judgments saved asynchronously
- GraphRAG sync events queued

### Indexing
- All foreign keys indexed
- Vector embeddings indexed with IVFFlat
- Query performance monitored

### Caching
- Frequently accessed documents cached
- Validator results cached per message
- GraphRAG search results cached (15 min TTL)

---

## Success Criteria

### Phase 1-3 (Database + Validators)
- ✅ All tables created without errors
- ✅ Validators return results in < 100ms each
- ✅ Structured output validated successfully

### Phase 4-5 (Services + Integration)
- ✅ Citations saved to database
- ✅ Judgments saved to database
- ✅ Retriever logs captured
- ✅ End-to-end flow works

### Phase 6-7 (UI + GraphRAG)
- ✅ Human can validate citations in UI
- ✅ Groundedness displayed
- ✅ GraphRAG relationships created
- ✅ Analytics dashboard shows metrics

---

## Notes

- **Domain flexibility:** Currently hardcoded to `company_expert`, but registry supports multiple domains
- **LLM-as-judge:** Phase 8 (future) - Add LLM-based evaluation for criteria that can't be rule-based
- **Human-in-loop:** Evaluation modal allows human validation of citations and groundedness
- **Experiment tracking:** `runs` table ready for A/B testing different prompts/models
- **Audit trail:** Complete lineage from query → retrieval → response → validation → judgment

---

**End of Insertion Points Document**
