# GraphRAG-Enhanced Q&A Validation - Implementation Plan

**Date Created:** 2025-12-05
**Status:** PENDING APPROVAL
**Risk Level:** MEDIUM
**Estimated Time:** 2-3 weeks (phased)

---

## Executive Summary

Enhance LLM Judge to validate Q&A pairs against expected answers retrieved from GraphRAG knowledge base. This creates an automated ground truth validation system that combines:
1. **GraphRAG search** - Retrieves expected answers from knowledge base
2. **Answer similarity** - Token-based comparison (existing)
3. **LLM Judge** - Semantic evaluation of factual alignment
4. **Batch testing integration** - Validates training data Q&A pairs

**Key Benefit:** Automated validation of Q&A training data against knowledge base without manual annotation.

---

## Current State Verification

### ✅ Existing Components

**1. GraphRAG Search Service**
- **File:** `lib/graphrag/graphiti/search-service.ts`
- **Capabilities:**
  - `search(query, userId)` - Hybrid search returning context + sources
  - `searchCustom(query, userId, options)` - Custom topK and threshold
- **Returns:** `{ context: string, sources: SearchSource[], metadata }`
- **Status:** PRODUCTION READY

**2. Answer Similarity Validator**
- **File:** `lib/evaluation/validators/rule-validators.ts:374-439`
- **Function:** `answerSimilarity(response, expectedAnswer, threshold)`
- **Method:** Token overlap (Jaccard similarity)
- **Integrated:** Yes, in `VALIDATORS_V2.answer_similarity`
- **Status:** PRODUCTION READY

**3. LLM Judge**
- **File:** `lib/evaluation/llm-judge.ts`
- **Capabilities:**
  - Custom criteria creation
  - Single/batch evaluation
  - Context-aware prompts
- **Status:** PRODUCTION READY (fixes verified)

**4. Test Suites with Expected Answers**
- **Table:** `test_suites.expected_answers` (JSONB array)
- **Migration:** `MIGRATION_ADD_EXPECTED_ANSWERS.sql` (already exists)
- **API:** `/api/test-suites` accepts `expected_answers` field
- **Status:** DATABASE READY

**5. Batch Testing Integration**
- **File:** `app/api/batch-testing/run/route.ts`
- **Current:** Supports LLM judge with criteria selection
- **Integration Point:** Lines 629-658 (judge evaluation)
- **Status:** READY FOR ENHANCEMENT

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Training Data Q&A Pair                                       │
│ Q: "How long does MLflow setup take?"                       │
│ A: <model generates answer>                                 │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: GraphRAG Answer Retrieval                          │
│ - Query knowledge graph with question                       │
│ - Retrieve expected answer + sources                        │
│ - Calculate confidence score                                │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│ Phase 2: Multi-Layer Validation                             │
│                                                              │
│ Layer 1: Token Similarity (Fast)                           │
│ → answerSimilarity() - Jaccard index                       │
│                                                              │
│ Layer 2: LLM Judge (Semantic)                              │
│ → qa_factual_alignment - Semantic comparison               │
│ → accuracy - Fact checking                                  │
│ → helpfulness - Quality assessment                          │
└────────────────────┬─────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────────────────┐
│ Phase 3: Comprehensive Results Storage                      │
│ - judgments table (all criteria scores)                     │
│ - validation_metadata table (graphrag context)              │
│ - Sources and confidence tracking                           │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1: GraphRAG Answer Retrieval Service

### Objective
Create a service that queries GraphRAG for expected answers to validation questions.

### Files to Create

#### 1.1 GraphRAG Answer Retrieval Service

**File:** `lib/evaluation/graphrag-answer-retrieval.ts` (NEW)

**Dependencies:**
- `lib/graphrag/graphiti/search-service.ts` (existing)
- `lib/graphrag/types.ts` (existing)

**Functionality:**
```typescript
export interface ExpectedAnswerResult {
  question: string;
  expectedAnswer: string;
  confidence: number;
  sources: SourceReference[];
  graphragMetadata: {
    resultsCount: number;
    queryTime: number;
    searchMethod: string;
  };
}

export interface SourceReference {
  title?: string;
  content: string;
  uuid: string;
  score?: number;
}

export async function getExpectedAnswerFromGraphRAG(
  question: string,
  userId: string,
  options?: { topK?: number; minConfidence?: number }
): Promise<ExpectedAnswerResult | null>
```

**Logic:**
1. Call `SearchService.search(question, userId)`
2. If `context.length < 50` → return null (no good match)
3. Calculate confidence based on:
   - Results count
   - Search scores
   - Context length
4. Build `ExpectedAnswerResult` with sources
5. Return result or null

**Confidence Calculation:**
```
confidence = min(
  (resultsCount / topK) * 0.3,
  (avgScore) * 0.4,
  (contextLength / 500) * 0.3
)
```

**Edge Cases:**
- No results found → return null
- Low confidence (<0.5) → return null
- Empty context → return null
- GraphRAG API error → log + return null

**Testing:**
- Unit test with mock SearchService
- Integration test with real GraphRAG
- Test confidence calculation edge cases

---

## Phase 2: Enhanced LLM Judge Criterion

### Objective
Add Q&A-specific validation criterion that compares model responses against expected answers semantically.

### Files to Modify

#### 2.1 Add Q&A Factual Alignment Criterion

**File:** `lib/evaluation/llm-judge.ts` (MODIFY)
**Location:** After line 460 (after `STANDARD_CRITERIA`)

**Addition:**
```typescript
/**
 * Q&A Validation Criterion
 * Evaluates factual alignment between model response and expected answer
 */
export const QA_FACTUAL_ALIGNMENT_CRITERION: LLMJudgeCriterion = {
  name: 'qa_factual_alignment',
  description: 'Does the model response align factually with the expected answer from the knowledge base?',
  scoring_guide: `
**Context:** You will be given:
1. The user's question
2. The expected answer from our knowledge base (ground truth)
3. The model's actual response

**Your Task:** Compare the model's response against the expected answer for factual alignment.

**Scoring Guide:**
1-2: Factually contradicts the expected answer or is completely incorrect
3-4: Some correct information but significant factual gaps or major errors
5-6: Mostly aligned but missing key factual details or has minor inaccuracies
7-8: Well-aligned with expected answer, captures key facts correctly
9-10: Perfectly aligned, may add appropriate context without contradicting facts

**Important Guidelines:**
- The model response does NOT need to match word-for-word
- It's OK if the model adds helpful context, examples, or explanations
- It's NOT OK if the model contradicts factual information from the expected answer
- Missing key numerical facts (like "50 hours") is a significant error (-2 to -3 points)
- Adding incorrect information is worse than missing information
- Paraphrasing is acceptable if facts are preserved
  `.trim(),
  min_score: 1,
  max_score: 10,
  passing_score: 7,
};

// Export in STANDARD_CRITERIA or separate export
export const QA_VALIDATION_CRITERIA = [
  QA_FACTUAL_ALIGNMENT_CRITERION,
  ...STANDARD_CRITERIA
];
```

**Verification:**
- Read lines 460-479 to confirm insertion point
- Verify no breaking changes to existing exports
- Check `createCustomCriterion` function signature (line 465-479)

---

## Phase 3: GraphRAG-Enhanced Judge Service

### Objective
Create a service that combines GraphRAG answer retrieval with LLM Judge evaluation.

### Files to Create

#### 3.1 GraphRAG Judge Service

**File:** `lib/evaluation/graphrag-judge.ts` (NEW)

**Dependencies:**
- `lib/evaluation/llm-judge.ts` (existing)
- `lib/evaluation/graphrag-answer-retrieval.ts` (Phase 1)
- `lib/evaluation/llm-judge.ts` (QA criterion from Phase 2)

**Functionality:**
```typescript
export interface GraphRAGJudgmentRequest {
  question: string;
  modelResponse: string;
  userId: string;
  messageId: string;
  criteria?: string[];
  judgeModel?: string;
  graphragOptions?: {
    topK?: number;
    minConfidence?: number;
    fallbackToStandard?: boolean;
  };
}

export interface GraphRAGJudgmentResult {
  judgments: LLMJudgmentResult[];
  expectedAnswer: string | null;
  graphragConfidence: number;
  sources: SourceReference[];
  usedGraphRAG: boolean;
  metadata: {
    graphragQueryTime: number;
    judgeEvaluationTime: number;
    totalTime: number;
  };
}

export async function judgeWithGraphRAG(
  request: GraphRAGJudgmentRequest
): Promise<GraphRAGJudgmentResult>
```

**Logic:**
1. **Query GraphRAG** for expected answer
   - If found with confidence >= minConfidence: proceed with Q&A validation
   - If not found: fallback to standard criteria (optional)

2. **Build Enhanced Context** for LLM Judge
   ```
   Question: [user's question]
   Expected Answer (Knowledge Base): [graphrag result]
   Sources: [source references]
   Model Response: [actual response to evaluate]
   ```

3. **Prepare Criteria**
   - If using GraphRAG: include 'qa_factual_alignment'
   - Always include other selected criteria (helpfulness, clarity, etc.)

4. **Call LLM Judge** with enhanced context

5. **Return Results** with metadata

**Edge Cases:**
- GraphRAG returns null → fallback to standard criteria
- Low confidence (<0.5) → log warning, optionally skip Q&A criterion
- LLM Judge fails → graceful error handling (Phase 1 fixes)
- Sources empty → still proceed with context

**Error Handling:**
- GraphRAG API timeout → return standard evaluation
- Invalid question format → log + continue
- Missing userId → return error

**Testing:**
- Unit tests with mocked dependencies
- Integration tests with real GraphRAG + LLM Judge
- Test fallback scenarios
- Test error handling paths

---

## Phase 4: Batch Testing Integration

### Objective
Integrate GraphRAG-enhanced validation into batch testing workflow.

### Files to Modify

#### 4.1 Update Batch Testing Types

**File:** `lib/batch-testing/types.ts` (MODIFY)
**Location:** Lines 48-52 (JudgeConfig interface)

**Current:**
```typescript
export interface JudgeConfig {
  enabled: boolean;
  model: string;
  criteria: string[];
}
```

**Proposed Addition:**
```typescript
export interface JudgeConfig {
  enabled: boolean;
  model: string;
  criteria: string[];
  use_graphrag?: boolean;  // ADD: Enable GraphRAG-enhanced validation
  graphrag_options?: {     // ADD: GraphRAG configuration
    topK?: number;
    minConfidence?: number;
    fallbackToStandard?: boolean;
  };
}
```

**Impact Analysis:**
- **Breaking Change:** NO (fields are optional with `?`)
- **Affected Files:**
  - `components/training/BatchTesting.tsx` (judge config creation)
  - `app/api/batch-testing/run/route.ts` (judge config usage)
- **Migration Required:** NO (backward compatible)

#### 4.2 Update Batch Testing API Route

**File:** `app/api/batch-testing/run/route.ts` (MODIFY)
**Location:** Lines 629-658 (judge evaluation section)

**Current Code (lines 629-658):**
```typescript
if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
  const { data: recentMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Call LLM Judge API
  const judgeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/evaluation/judge`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message_ids: [recentMessage.id],
      criteria: judgeConfig.criteria,
      judge_model: judgeConfig.model,
      save_to_db: true
    })
  });
}
```

**Proposed Enhancement:**
```typescript
if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
  // Fetch both user question and assistant response
  const [{ data: userMessage }, { data: assistantMessage }] = await Promise.all([
    supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversationId)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('messages')
      .select('id, content')
      .eq('conversation_id', conversationId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
  ]);

  // Determine which evaluation endpoint to use
  const useGraphRAG = judgeConfig.use_graphrag === true;

  if (useGraphRAG && userMessage?.content) {
    // Use GraphRAG-enhanced evaluation
    const graphragResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/evaluation/judge/graphrag`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: userMessage.content,
        model_response: assistantMessage.content,
        message_id: assistantMessage.id,
        criteria: judgeConfig.criteria,
        judge_model: judgeConfig.model,
        graphrag_options: judgeConfig.graphrag_options || {},
        save_to_db: true
      })
    });

    if (!graphragResponse.ok) {
      console.error(`[Process Prompt] ${promptIndex + 1}: GraphRAG judge failed, falling back to standard judge`);
      // Fall back to standard judge (existing code)
    }
  } else {
    // Use standard LLM Judge (existing code)
    const judgeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/evaluation/judge`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_ids: [assistantMessage.id],
        criteria: judgeConfig.criteria,
        judge_model: judgeConfig.model,
        save_to_db: true
      })
    });
  }
}
```

**Verification Steps:**
1. Read lines 629-658 to confirm current implementation
2. Verify `conversationId` is available in scope
3. Check error handling pattern in surrounding code
4. Verify `authHeader` is in scope
5. Test fallback logic when GraphRAG fails

**Impact:**
- **Lines Modified:** 629-658 (~30 lines)
- **Breaking Changes:** NONE (existing flow preserved)
- **New Dependencies:** `/api/evaluation/judge/graphrag` endpoint (Phase 5)

---

## Phase 5: GraphRAG Judge API Endpoint

### Objective
Create API endpoint for GraphRAG-enhanced evaluation.

### Files to Create

#### 5.1 GraphRAG Judge API Route

**File:** `app/api/evaluation/judge/graphrag/route.ts` (NEW)

**Dependencies:**
- `lib/evaluation/graphrag-judge.ts` (Phase 3)
- `app/api/evaluation/judge/route.ts` (existing - for auth pattern)

**Functionality:**
```typescript
export const runtime = 'nodejs';

interface GraphRAGJudgeRequest {
  question: string;
  model_response: string;
  message_id: string;
  criteria?: string[];
  judge_model?: string;
  graphrag_options?: {
    topK?: number;
    minConfidence?: number;
    fallbackToStandard?: boolean;
  };
  save_to_db?: boolean;
}

export async function POST(request: NextRequest)
```

**Logic:**
1. **Authentication** (copy from `app/api/evaluation/judge/route.ts:35-58`)
2. **Parse Request Body**
3. **Call GraphRAG Judge Service**
   ```typescript
   const result = await judgeWithGraphRAG({
     question: body.question,
     modelResponse: body.model_response,
     userId: user.id,
     messageId: body.message_id,
     criteria: body.criteria,
     judgeModel: body.judge_model,
     graphragOptions: body.graphrag_options
   });
   ```
4. **Save to Database** (if `save_to_db: true`)
   - Save judgments to `judgments` table
   - Save GraphRAG metadata to new table (Phase 6)
5. **Return Results**

**Response Format:**
```json
{
  "success": true,
  "message_id": "msg-123",
  "evaluations": [...],
  "graphrag": {
    "used": true,
    "expected_answer": "...",
    "confidence": 0.85,
    "sources": [...]
  },
  "summary": {
    "total_criteria": 5,
    "passed": 4,
    "failed": 1,
    "average_score": 0.78
  }
}
```

**Error Handling:**
- 401: Unauthorized
- 400: Invalid request body
- 500: Internal server error
- Graceful degradation if GraphRAG fails

**Verification:**
- Test auth flow
- Test with valid GraphRAG results
- Test with null GraphRAG results (fallback)
- Test database saves

---

## Phase 6: Database Schema Enhancement

### Objective
Store GraphRAG validation metadata separately for analysis.

### Files to Create

#### 6.1 Database Migration

**File:** `supabase/migrations/20251205_create_graphrag_validation_metadata.sql` (NEW)

**Content:**
```sql
-- ============================================================================
-- MIGRATION: Create graphrag_validation_metadata table
-- ============================================================================
-- Purpose: Store GraphRAG-enhanced validation metadata
-- Date: 2025-12-05
-- ============================================================================

CREATE TABLE IF NOT EXISTS graphrag_validation_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- GraphRAG results
  question TEXT NOT NULL,
  expected_answer TEXT,
  graphrag_confidence NUMERIC(3, 2) CHECK (graphrag_confidence >= 0 AND graphrag_confidence <= 1),
  sources JSONB DEFAULT '[]'::jsonb,

  -- GraphRAG metadata
  graphrag_query_time_ms INTEGER,
  graphrag_results_count INTEGER,
  graphrag_search_method TEXT,

  -- Validation metadata
  used_graphrag BOOLEAN DEFAULT false,
  fallback_reason TEXT,  -- Why GraphRAG wasn't used (if applicable)

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT unique_message_validation UNIQUE (message_id)
);

-- Indexes for queries
CREATE INDEX idx_graphrag_validation_user ON graphrag_validation_metadata(user_id);
CREATE INDEX idx_graphrag_validation_created ON graphrag_validation_metadata(created_at DESC);
CREATE INDEX idx_graphrag_validation_confidence ON graphrag_validation_metadata(graphrag_confidence DESC);

-- RLS Policies
ALTER TABLE graphrag_validation_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own validation metadata"
  ON graphrag_validation_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert validation metadata"
  ON graphrag_validation_metadata FOR INSERT
  WITH CHECK (true);  -- Service role bypasses this anyway

-- Comments
COMMENT ON TABLE graphrag_validation_metadata IS 'Stores GraphRAG-enhanced Q&A validation metadata';
COMMENT ON COLUMN graphrag_validation_metadata.expected_answer IS 'Expected answer retrieved from GraphRAG knowledge base';
COMMENT ON COLUMN graphrag_validation_metadata.graphrag_confidence IS 'Confidence score (0-1) of GraphRAG match quality';
COMMENT ON COLUMN graphrag_validation_metadata.sources IS 'Array of source references from knowledge graph';

-- Verify migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'graphrag_validation_metadata'
  ) THEN
    RAISE NOTICE 'Migration successful: graphrag_validation_metadata table created';
  ELSE
    RAISE EXCEPTION 'Migration failed: graphrag_validation_metadata table not found';
  END IF;
END $$;
```

**Rollback:**
```sql
DROP TABLE IF EXISTS graphrag_validation_metadata CASCADE;
```

**Verification:**
- Test table creation in development
- Verify RLS policies
- Test insert/select operations
- Verify foreign key constraints

---

## Phase 7: UI Integration

### Objective
Add GraphRAG validation toggle to batch testing UI.

### Files to Modify

#### 7.1 Update Batch Testing Component

**File:** `components/training/BatchTesting.tsx` (MODIFY)

**Location 1: State** (after line 92)
```typescript
// Current (line 92):
const [judgeCriteria, setJudgeCriteria] = useState<string[]>(['helpfulness', 'accuracy', 'clarity']);

// Add after line 92:
const [useGraphRAGValidation, setUseGraphRAGValidation] = useState(false);
const [graphRAGMinConfidence, setGraphRAGMinConfidence] = useState(0.7);
```

**Location 2: Judge Config** (lines 551-558)
```typescript
// Current:
if (useAssistantJudge && judgeCriteria.length > 0) {
  judgeConfig = {
    enabled: true,
    model: judgeModel,
    criteria: judgeCriteria
  };
}

// Enhanced:
if (useAssistantJudge && judgeCriteria.length > 0) {
  judgeConfig = {
    enabled: true,
    model: judgeModel,
    criteria: useGraphRAGValidation
      ? ['qa_factual_alignment', ...judgeCriteria]
      : judgeCriteria,
    use_graphrag: useGraphRAGValidation,
    graphrag_options: useGraphRAGValidation ? {
      topK: 5,
      minConfidence: graphRAGMinConfidence,
      fallbackToStandard: true
    } : undefined
  };
}
```

**Location 3: UI Elements** (after line 943 - after criteria checkboxes)
```typescript
{/* GraphRAG Validation Toggle */}
<div className="mt-4 space-y-3 pt-4 border-t border-border">
  <div className="flex items-start gap-2">
    <input
      type="checkbox"
      id="use-graphrag-validation"
      checked={useGraphRAGValidation}
      onChange={(e) => setUseGraphRAGValidation(e.target.checked)}
      disabled={starting}
      className="mt-1"
    />
    <div className="flex-1">
      <Label htmlFor="use-graphrag-validation" className="text-sm font-medium">
        Use Knowledge Base Validation
      </Label>
      <p className="text-xs text-muted-foreground mt-1">
        Queries GraphRAG to find expected answers and validates responses against knowledge base.
        Adds 'qa_factual_alignment' criterion automatically.
      </p>
    </div>
  </div>

  {useGraphRAGValidation && (
    <div className="ml-6 space-y-2">
      <Label className="text-xs text-muted-foreground">
        Minimum Confidence: {graphRAGMinConfidence.toFixed(1)}
      </Label>
      <input
        type="range"
        min="0.5"
        max="0.9"
        step="0.1"
        value={graphRAGMinConfidence}
        onChange={(e) => setGraphRAGMinConfidence(parseFloat(e.target.value))}
        disabled={starting}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground">
        Only use GraphRAG answers with confidence ≥ {(graphRAGMinConfidence * 100).toFixed(0)}%.
        Falls back to standard criteria if no match found.
      </p>
    </div>
  )}
</div>
```

**Verification:**
- Read lines 92, 551-558, 926-943 to confirm insertion points
- Verify no state name collisions
- Check existing checkbox pattern for consistency
- Test UI rendering with different states

**Impact:**
- **Lines Added:** ~40 lines
- **Breaking Changes:** NONE
- **UI Changes:** New checkbox + slider in judge configuration section

---

## Testing Strategy

### Phase 1 Testing: GraphRAG Answer Retrieval

```typescript
// __tests__/lib/evaluation/graphrag-answer-retrieval.test.ts

describe('getExpectedAnswerFromGraphRAG', () => {
  it('should return expected answer for known question', async () => {
    const result = await getExpectedAnswerFromGraphRAG(
      'How long does MLflow setup take?',
      'test-user-id'
    );

    expect(result).toBeDefined();
    expect(result.expectedAnswer).toContain('50');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should return null for unknown question', async () => {
    const result = await getExpectedAnswerFromGraphRAG(
      'What is the capital of Mars?',
      'test-user-id'
    );

    expect(result).toBeNull();
  });

  it('should handle GraphRAG API errors gracefully', async () => {
    // Mock GraphRAG to throw error
    const result = await getExpectedAnswerFromGraphRAG(
      'Test question',
      'test-user-id'
    );

    expect(result).toBeNull();
  });
});
```

### Phase 3 Testing: GraphRAG Judge Service

```typescript
// __tests__/lib/evaluation/graphrag-judge.test.ts

describe('judgeWithGraphRAG', () => {
  it('should use GraphRAG when expected answer found', async () => {
    const result = await judgeWithGraphRAG({
      question: 'How long does MLflow setup take?',
      modelResponse: 'MLflow takes about 50 hours',
      userId: 'test-user',
      messageId: 'msg-123',
      criteria: ['qa_factual_alignment', 'helpfulness']
    });

    expect(result.usedGraphRAG).toBe(true);
    expect(result.expectedAnswer).toBeDefined();
    expect(result.judgments).toHaveLength(2);
  });

  it('should fallback to standard when GraphRAG fails', async () => {
    const result = await judgeWithGraphRAG({
      question: 'Unknown question',
      modelResponse: 'Some answer',
      userId: 'test-user',
      messageId: 'msg-123',
      criteria: ['helpfulness'],
      graphragOptions: { fallbackToStandard: true }
    });

    expect(result.usedGraphRAG).toBe(false);
    expect(result.judgments).toHaveLength(1);
  });
});
```

### Integration Testing

**Test Scenario:** End-to-end batch test with GraphRAG validation

1. **Setup:**
   - Upload training Q&A dataset to GraphRAG
   - Create test suite with prompts
   - Configure batch test with GraphRAG validation enabled

2. **Execute:**
   - Run batch test with 10 Q&A pairs
   - Monitor GraphRAG queries
   - Verify judgments saved correctly

3. **Verify:**
   - Check `judgments` table for all criteria
   - Check `graphrag_validation_metadata` for GraphRAG data
   - Verify confidence scores and sources
   - Confirm fallback for unknown questions

---

## Rollback Plan

### Phase-by-Phase Rollback

**Phase 1-3 (New Files):**
```bash
# Simply delete new files - no impact
rm lib/evaluation/graphrag-answer-retrieval.ts
rm lib/evaluation/graphrag-judge.ts
```

**Phase 2 (LLM Judge Criterion):**
```bash
# Remove QA_FACTUAL_ALIGNMENT_CRITERION export
# Edit lib/evaluation/llm-judge.ts to remove lines added after line 460
```

**Phase 4 (Batch Testing Integration):**
```bash
# Revert changes to lib/batch-testing/types.ts
git diff HEAD lib/batch-testing/types.ts
git checkout lib/batch-testing/types.ts

# Revert changes to app/api/batch-testing/run/route.ts
git diff HEAD app/api/batch-testing/run/route.ts
git checkout app/api/batch-testing/run/route.ts
```

**Phase 5 (API Route):**
```bash
# Delete new API route
rm -rf app/api/evaluation/judge/graphrag/
```

**Phase 6 (Database):**
```sql
-- Run rollback migration
DROP TABLE IF EXISTS graphrag_validation_metadata CASCADE;
```

**Phase 7 (UI):**
```bash
# Revert UI changes
git diff HEAD components/training/BatchTesting.tsx
git checkout components/training/BatchTesting.tsx
```

---

## Success Criteria

### Phase 1
- ✅ GraphRAG answer retrieval returns expected results for known questions
- ✅ Returns null for unknown questions with confidence < threshold
- ✅ Handles errors gracefully without throwing
- ✅ Unit tests pass (>95% coverage)

### Phase 2
- ✅ QA criterion exports correctly
- ✅ No breaking changes to existing criteria
- ✅ Criterion prompt validates correctly with LLM

### Phase 3
- ✅ GraphRAG judge service integrates both components
- ✅ Fallback logic works when GraphRAG fails
- ✅ Returns comprehensive results with metadata
- ✅ Integration tests pass

### Phase 4
- ✅ Batch testing accepts new judge config fields
- ✅ Backward compatible (existing tests still work)
- ✅ GraphRAG validation triggers correctly
- ✅ Fallback to standard judge works

### Phase 5
- ✅ API endpoint authenticates correctly
- ✅ Handles GraphRAG-enhanced requests
- ✅ Saves results to database correctly
- ✅ Returns proper error responses

### Phase 6
- ✅ Migration runs successfully in dev/staging
- ✅ Table created with correct schema
- ✅ RLS policies work correctly
- ✅ Foreign keys enforce referential integrity

### Phase 7
- ✅ UI renders GraphRAG toggle correctly
- ✅ State management works properly
- ✅ Judge config includes GraphRAG options
- ✅ No UI regressions

---

## Risk Assessment

### HIGH RISK
**NONE** - All phases are additive, no destructive changes

### MEDIUM RISK
1. **GraphRAG API Dependency**
   - **Risk:** GraphRAG service unavailable during batch testing
   - **Mitigation:** Fallback to standard judge always available
   - **Severity:** Low (graceful degradation)

2. **LLM Judge Cost**
   - **Risk:** Adding qa_factual_alignment criterion increases API costs
   - **Mitigation:** Optional toggle, user controls when to enable
   - **Severity:** Medium (user controls cost)

### LOW RISK
1. **Database Performance**
   - **Risk:** Additional table adds query overhead
   - **Mitigation:** Indexed properly, separate from judgments table
   - **Severity:** Very Low (minimal impact)

2. **UI Complexity**
   - **Risk:** More UI controls may confuse users
   - **Mitigation:** Clear labels, help text, optional feature
   - **Severity:** Very Low (UX enhancement)

---

## Dependencies & Prerequisites

### External Dependencies
- ✅ GraphRAG service must be running (`GRAPHITI_API_URL` configured)
- ✅ OpenAI API key for LLM Judge (`OPENAI_API_KEY`)
- ✅ Anthropic API key for Claude Judge (`ANTHROPIC_API_KEY`)
- ✅ Supabase database access

### Internal Dependencies
- ✅ `lib/graphrag/graphiti/search-service.ts` (verified exists)
- ✅ `lib/evaluation/llm-judge.ts` (verified exists + fixes applied)
- ✅ `lib/evaluation/validators/rule-validators.ts` (verified has answerSimilarity)
- ✅ `test_suites.expected_answers` column (migration exists)

### Development Environment
- Node.js 18+
- TypeScript 5+
- Jest for testing
- Supabase CLI for migrations

---

## Timeline Estimate

### Phase 1: GraphRAG Answer Retrieval (2-3 days)
- Day 1: Implement service + unit tests
- Day 2: Integration testing with real GraphRAG
- Day 3: Edge case handling + documentation

### Phase 2: LLM Judge Criterion (1 day)
- Morning: Add criterion definition
- Afternoon: Test with real LLM, adjust scoring guide

### Phase 3: GraphRAG Judge Service (2-3 days)
- Day 1: Implement service logic
- Day 2: Integration testing
- Day 3: Error handling + edge cases

### Phase 4: Batch Testing Integration (2 days)
- Day 1: Update types + batch API route
- Day 2: Testing + verification

### Phase 5: API Endpoint (1-2 days)
- Day 1: Implement endpoint + auth
- Day 2: Testing + error handling

### Phase 6: Database Schema (1 day)
- Morning: Write migration
- Afternoon: Test + verify RLS

### Phase 7: UI Integration (1-2 days)
- Day 1: Implement UI components
- Day 2: Testing + polish

**Total: 10-14 days (2-3 weeks)**

---

## Affected Files Summary

### Files to CREATE (5 new files)
1. ✨ `lib/evaluation/graphrag-answer-retrieval.ts` (Phase 1)
2. ✨ `lib/evaluation/graphrag-judge.ts` (Phase 3)
3. ✨ `app/api/evaluation/judge/graphrag/route.ts` (Phase 5)
4. ✨ `supabase/migrations/20251205_create_graphrag_validation_metadata.sql` (Phase 6)
5. ✨ `__tests__/lib/evaluation/graphrag-*.test.ts` (Testing)

### Files to MODIFY (4 existing files)
1. 📝 `lib/evaluation/llm-judge.ts` - Add QA criterion (Phase 2)
   - **Lines:** After 460 (~30 lines added)
   - **Breaking:** NO

2. 📝 `lib/batch-testing/types.ts` - Extend JudgeConfig (Phase 4)
   - **Lines:** 48-52 (~5 lines added)
   - **Breaking:** NO (optional fields)

3. 📝 `app/api/batch-testing/run/route.ts` - Add GraphRAG judge call (Phase 4)
   - **Lines:** 629-658 (~40 lines modified)
   - **Breaking:** NO (existing flow preserved)

4. 📝 `components/training/BatchTesting.tsx` - Add UI toggle (Phase 7)
   - **Lines:** Multiple locations (~50 lines added)
   - **Breaking:** NO

### Files NOT MODIFIED (verified safe)
- ✅ `lib/graphrag/graphiti/search-service.ts` - Used as-is
- ✅ `lib/evaluation/validators/rule-validators.ts` - Used as-is
- ✅ `app/api/evaluation/judge/route.ts` - Pattern reference only
- ✅ Database tables (except new table)

---

## Approval Checklist

Before proceeding, confirm:

- [ ] **Architecture Reviewed** - Phased approach makes sense
- [ ] **No Breaking Changes** - All changes are additive and backward compatible
- [ ] **Rollback Plan Clear** - Can revert any phase independently
- [ ] **Testing Strategy Defined** - Unit + integration tests planned
- [ ] **Dependencies Verified** - All required services available
- [ ] **Timeline Acceptable** - 2-3 weeks for full implementation
- [ ] **Risk Assessment Reviewed** - Medium risk with clear mitigations
- [ ] **Cost Implications Understood** - GraphRAG + LLM Judge API costs
- [ ] **UI Changes Acceptable** - New controls are optional and clear

---

## Next Steps After Approval

1. **Create feature branch**
   ```bash
   git checkout -b feature/graphrag-qa-validation
   ```

2. **Implement Phase 1** (GraphRAG Answer Retrieval)
   - Create service file
   - Write unit tests
   - Test with real GraphRAG
   - Submit for review

3. **Sequential Phase Implementation**
   - Complete each phase
   - Test thoroughly
   - Get review approval
   - Move to next phase

4. **Final Integration Testing**
   - End-to-end test with real data
   - Performance testing
   - User acceptance testing

5. **Documentation & Deployment**
   - Update user documentation
   - Create migration guide
   - Deploy to staging → production

---

## Questions for Approval

1. **GraphRAG Dependency:** Are we comfortable depending on GraphRAG availability? Fallback ensures no failures, but reduces validation quality.

2. **Cost:** Adding qa_factual_alignment criterion increases LLM API costs. Is this acceptable given the validation benefits?

3. **Timeline:** 2-3 weeks for full implementation. Any constraints or priorities to adjust?

4. **Scope:** Should we include analytics/reporting for GraphRAG validation results in initial release or defer to Phase 8?

5. **Testing Data:** Do we need to seed GraphRAG with validation Q&A pairs before testing? If so, who provides the data?

---

## Status: AWAITING APPROVAL

**Created by:** Claude Code
**Date:** 2025-12-05
**Review Required:** Yes
**Estimated Effort:** 2-3 weeks (phased)
**Risk Level:** Medium (with mitigations)
