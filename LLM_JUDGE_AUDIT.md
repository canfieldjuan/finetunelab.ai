# LLM-as-Judge Implementation Audit
**Date:** December 3, 2025
**Purpose:** Comprehensive audit of LLM judge implementation

---

## 📋 Executive Summary

The LLM-as-Judge system is implemented and functional, with integration points in:
1. **Batch Testing** - Optional post-response evaluation
2. **Analytics Assistant** - On-demand evaluation via tool calls
3. **Manual API** - Direct evaluation endpoint

### ⚠️ CRITICAL ISSUE FOUND
**Score Normalization Mismatch:**
- **LLM Judge scores:** 1-10 scale (stored as-is in database)
- **Rule validator scores:** 0-1 scale (normalized)
- **Result:** Inconsistent score interpretation across judgment types

---

## 🗂️ File Structure

### Core Implementation Files

#### 1. `lib/evaluation/llm-judge.ts` (426 lines)
**Purpose:** Core LLM judge class and logic

**Key Components:**
- `LLMJudge` class - Main evaluation engine
- `LLMJudgeCriterion` interface - Criterion definition
- `LLMJudgmentResult` interface - Result structure
- `STANDARD_CRITERIA` - 5 predefined criteria

**Supported Models:**
- `gpt-4`
- `gpt-4-turbo`
- `claude-3-opus`
- `claude-3-sonnet`

**Standard Criteria (all use 1-10 scale):**
1. **helpfulness** - Passing score: 7/10
2. **accuracy** - Passing score: 7/10
3. **clarity** - Passing score: 7/10
4. **safety** - Passing score: 8/10 (higher threshold)
5. **completeness** - Passing score: 7/10

**Evaluation Flow:**
```typescript
judgeMessage(request)
  → For each criterion:
    → judgeSingleCriterion()
      → buildEvaluationPrompt()
      → Call OpenAI or Anthropic SDK
      → parseJudgmentResponse()
      → Return structured result
```

---

#### 2. `app/api/evaluation/judge/route.ts` (297 lines)
**Purpose:** HTTP API for LLM judge

**Endpoints:**
- `POST /api/evaluation/judge` - Single or batch evaluation
- `GET /api/evaluation/judge` - Get available criteria

**Request Types:**

**Single Evaluation:**
```json
{
  "message_id": "msg-123",
  "message_content": "optional",
  "context": "optional",
  "criteria": ["helpfulness", "accuracy"],
  "judge_model": "gpt-4-turbo",
  "save_to_db": true
}
```

**Batch Evaluation:**
```json
{
  "message_ids": ["msg-1", "msg-2", "msg-3"],
  "criteria": ["helpfulness"],
  "judge_model": "claude-3-sonnet",
  "save_to_db": true
}
```

**Response Structure:**
```json
{
  "success": true,
  "evaluations": [
    {
      "message_id": "msg-123",
      "criterion": "helpfulness",
      "score": 8,
      "passed": true,
      "reasoning": "The response is...",
      "judge_model": "gpt-4-turbo",
      "confidence": 0.85,
      "evidence": {
        "positive_aspects": ["Clear", "Comprehensive"],
        "negative_aspects": [],
        "improvement_suggestions": []
      }
    }
  ],
  "summary": {
    "total_criteria": 2,
    "passed": 2,
    "failed": 0,
    "average_score": 8.5,
    "average_confidence": 0.87
  }
}
```

**Authentication:**
- Requires Bearer token in Authorization header
- Uses Supabase auth for user verification
- RLS policies enforced on judgments table

**Database Saving (Line 252-278):**
```typescript
async function saveJudgmentsToDatabase(supabase, judgments) {
  const records = judgments.map(judgment => ({
    message_id: judgment.message_id,
    judge_type: 'llm',
    judge_name: judgment.judge_model,
    criterion: judgment.criterion,
    score: judgment.score,  // ⚠️ 1-10 scale, not normalized
    passed: judgment.passed,
    evidence_json: {
      reasoning: judgment.reasoning,
      confidence: judgment.confidence,
      positive_aspects: judgment.evidence.positive_aspects,
      negative_aspects: judgment.evidence.negative_aspects,
      improvement_suggestions: judgment.evidence.improvement_suggestions
    },
    notes: `AI evaluation with ${(judgment.confidence * 100).toFixed(0)}% confidence`
  }));

  await supabase.from('judgments').insert(records);
}
```

---

### Integration Points

#### 3. `components/training/BatchTesting.tsx`
**Lines:** 89-92, 552-558, 627-678

**UI State:**
```typescript
const [useAssistantJudge, setUseAssistantJudge] = useState(false);
const [judgeModel, setJudgeModel] = useState<'gpt-4-turbo' | 'claude-3-5-sonnet' | 'gpt-4o-mini'>('claude-3-5-sonnet');
const [judgeCriteria, setJudgeCriteria] = useState<string[]>(['helpfulness', 'accuracy', 'clarity']);
```

**Cost Estimation (Lines 139-147):**
```typescript
function getJudgeCostEstimate(): number {
  if (!useAssistantJudge) return 0;

  const costPerMessage =
    judgeModel === 'gpt-4-turbo' ? 0.015 :
    judgeModel === 'claude-3-5-sonnet' ? 0.008 :
    0.003; // gpt-4o-mini

  const criteriaMultiplier = judgeCriteria.length / 5; // Base is 5 criteria
  return promptLimit * costPerMessage * criteriaMultiplier;
}
```

**Config Sent to API (Lines 552-558):**
```typescript
let judgeConfig = null;
if (useAssistantJudge && judgeCriteria.length > 0) {
  judgeConfig = {
    enabled: true,
    model: judgeModel,
    criteria: judgeCriteria
  };
}
```

---

#### 4. `app/api/batch-testing/run/route.ts`
**Lines:** 627-678

**Judge Execution Flow:**
1. Chat response completes
2. Consume response stream
3. If judge enabled, fetch message ID from conversation
4. Call `/api/evaluation/judge` with message ID
5. Log results (don't fail prompt if judge fails)

**Implementation (Lines 627-678):**
```typescript
// Step 2: If judge is enabled, fetch the message ID and evaluate
if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
  // Fetch the most recent assistant message from this conversation
  const { data: recentMessage } = await createClient(supabaseUrl, supabaseServiceKey)
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const messageId = recentMessage?.id;

  if (!messageId) {
    console.warn(`Could not find message ID for judge evaluation`);
    return true;  // Don't fail the prompt
  }

  console.log(`Starting LLM judge evaluation with ${judgeConfig.criteria.length} criteria`);

  try {
    const judgeResponse = await fetch(`${baseUrl}/api/evaluation/judge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        message_id: messageId,
        criteria: judgeConfig.criteria,
        judge_model: judgeConfig.model,
        save_to_db: true  // Save judgments to database
      })
    });

    if (judgeResponse.ok) {
      const judgeData = await judgeResponse.json();
      const avgScore = judgeData.evaluations?.reduce((sum, e) => sum + (e.score || 0), 0) / (judgeData.evaluations?.length || 1);
      console.log(`Judge evaluation complete, avg score: ${avgScore.toFixed(1)}/10`);
    } else {
      const judgeError = await judgeResponse.text();
      console.error(`Judge evaluation failed:`, judgeError.substring(0, 200));
      // Don't fail the whole prompt if judge fails, just log the error
    }
  } catch (judgeError) {
    console.error(`Judge error:`, judgeError);
    // Don't fail the whole prompt if judge fails
  }
}
```

**Error Handling:**
- Judge failures are logged but don't fail the batch test
- Missing message IDs are warned but execution continues
- Non-blocking design ensures batch testing completes

---

#### 5. `app/api/analytics/chat/route.ts`
**Lines:** 247, 769-824

**Tool Definition (Lines 247-268):**
```typescript
{
  name: 'evaluate_messages',
  description: 'Evaluate message quality using LLM-as-judge. Analyzes assistant responses for helpfulness, accuracy, clarity, safety, and completeness. Use this when the user asks about response quality, wants to evaluate session messages, or compare quality across models. Returns detailed scores (0-10) with reasoning and evidence.',
  inputSchema: {
    type: 'object',
    properties: {
      message_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of message IDs to evaluate'
      },
      criteria: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness', 'all']
        },
        description: 'Criteria to evaluate. Use "all" for all 5 standard criteria. Default: all',
        default: ['all']
      },
      judge_model: {
        type: 'string',
        enum: ['claude-3-sonnet', 'gpt-4-turbo', 'gpt-4'],
        description: 'Which LLM to use as judge. Claude Sonnet is cheaper and fast (~$0.005/msg), GPT-4 Turbo is more accurate (~$0.015/msg). Default: claude-3-sonnet',
        default: 'claude-3-sonnet'
      }
    },
    required: ['message_ids']
  }
}
```

**Function (Lines 769-824):**
```typescript
async function evaluateMessages(
  messageIds: string[],
  criteria: string[] = ['all'],
  judgeModel: string = 'claude-3-sonnet',
  authHeader: string
) {
  console.log(`[AnalyticsAPI] Evaluating ${messageIds.length} messages with ${judgeModel}`);

  try {
    // Expand 'all' to full criteria list
    const actualCriteria = criteria.includes('all')
      ? ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness']
      : criteria;

    // Call the existing judge API
    const judgeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/evaluation/judge`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_ids: messageIds,
        criteria: actualCriteria,
        judge_model: judgeModel,
        save_to_db: true,
        source: 'analytics_assistant',  // Tag as assistant-initiated
      }),
    });

    // Parse and return summary statistics
    const judgeData = await judgeResponse.json();
    const evaluations = judgeData.evaluations || [];

    // Calculate per-criterion averages
    const criterionScores: Record<string, number[]> = {};
    evaluations.forEach((evaluation: any) => {
      if (!criterionScores[evaluation.criterion]) {
        criterionScores[evaluation.criterion] = [];
      }
      criterionScores[evaluation.criterion].push(evaluation.score);
    });

    return {
      totalEvaluations: evaluations.length,
      passRate: (passedCount / totalEvaluations) * 100,
      criterionAverages: Object.entries(criterionScores).map(([criterion, scores]) => ({
        criterion,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length
      }))
    };
  } catch (error) {
    return { error: true, message: error.message };
  }
}
```

---

## ⚠️ CRITICAL ISSUES FOUND

### Issue 1: Score Normalization Mismatch

**Problem:**
Different judgment types use different score scales, causing inconsistent data in the database.

**Evidence:**

**LLM Judge Scores (1-10 scale):**
```typescript
// lib/evaluation/llm-judge.ts:335-406
export const STANDARD_CRITERIA: LLMJudgeCriterion[] = [
  {
    name: 'helpfulness',
    min_score: 1,
    max_score: 10,
    passing_score: 7,
  },
  // ... all criteria use 1-10 scale
];

// app/api/evaluation/judge/route.ts:258
score: judgment.score,  // Saved directly to DB (1-10)
```

**Rule Validator Scores (0-1 scale):**
```typescript
// lib/evaluation/validators/rule-validators.ts:147
return {
  passed: score >= 0.2, // 20% threshold
  score,  // 0-1 scale
};

// lib/evaluation/validators/rule-validators.ts:355
return {
  passed: true,
  score: 1.0,  // 0-1 scale
};

// lib/evaluation/validators/executor.ts:169
score: result.score || (result.passed ? 1.0 : 0.0),  // 0-1 scale
```

**Human Judgment Scores (0-1 scale):**
```typescript
// lib/evaluation/judgments.service.ts:117
* @param score - Human-provided score (0-1)
```

**Impact:**
1. **Database inconsistency:** `judgments.score` column contains values on different scales
   - Rule validators: 0.0 to 1.0
   - Human judgments: 0.0 to 1.0
   - LLM judgments: 1 to 10

2. **Analytics broken:** Any aggregation or comparison of scores across judge types is incorrect
   - Average score calculations are wrong
   - Pass rate calculations may be misleading
   - Charts and visualizations show incorrect data

3. **UI display issues:** MessageJudgments component shows scores without knowing which scale
   ```typescript
   // components/chat/MessageJudgments.tsx:174
   Score: {(judgment.score * 100).toFixed(1)}%
   ```
   This assumes 0-1 scale, so LLM scores of 8/10 display as "800%"

**Example Database Records:**
```sql
SELECT judge_type, judge_name, criterion, score, passed
FROM judgments
WHERE message_id = 'msg-123';

-- Results show mixed scales:
| judge_type | judge_name            | criterion      | score | passed |
|------------|----------------------|----------------|-------|--------|
| rule       | must_cite_if_claims  | citation_req   | 1.0   | true   |
| rule       | answer_similarity    | similarity     | 0.85  | true   |
| llm        | gpt-4-turbo          | helpfulness    | 8.0   | true   |
| llm        | gpt-4-turbo          | accuracy       | 7.5   | true   |
```

---

### Issue 2: Incomplete Error Handling in Batch Testing

**Problem:**
Batch testing's judge integration has nested async database queries that could fail silently.

**Location:** `app/api/batch-testing/run/route.ts:629-640`

**Problematic Code:**
```typescript
const { data: recentMessage } = await createClient(supabaseUrl, supabaseServiceKey)
  .from('messages')
  .select('id')
  .eq('conversation_id', (await createClient(supabaseUrl, supabaseServiceKey)
    .from('conversations')
    .select('id')
    .eq('widget_session_id', widgetSessionId)
    .single()).data?.id)  // ⚠️ Could be undefined
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

**Issues:**
1. **Nested await in query parameter** - Hard to debug, poor error handling
2. **No null checks** - `.data?.id` could be undefined if conversation query fails
3. **Multiple Supabase client creations** - Inefficient

**Better Pattern:**
```typescript
// First fetch conversation
const { data: conversation, error: convError } = await supabase
  .from('conversations')
  .select('id')
  .eq('widget_session_id', widgetSessionId)
  .single();

if (convError || !conversation) {
  console.warn(`Could not find conversation for judge evaluation`);
  return true;
}

// Then fetch message
const { data: recentMessage, error: msgError } = await supabase
  .from('messages')
  .select('id')
  .eq('conversation_id', conversation.id)
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

---

### Issue 3: Model Name Inconsistency

**Problem:**
UI allows `claude-3-5-sonnet` but API expects `claude-3-sonnet`.

**UI State (components/training/BatchTesting.tsx:91):**
```typescript
const [judgeModel, setJudgeModel] = useState<
  'gpt-4-turbo' | 'claude-3-5-sonnet' | 'gpt-4o-mini'
>('claude-3-5-sonnet');
```

**API Accepted Models (lib/evaluation/llm-judge.ts:25):**
```typescript
judge_model?: 'gpt-4' | 'gpt-4-turbo' | 'claude-3-opus' | 'claude-3-sonnet';
```

**Impact:**
- UI sends `claude-3-5-sonnet`
- API may not recognize it (depends on Anthropic SDK handling)
- Could fail silently or use wrong model

---

### Issue 4: Missing Benchmark ID Linkage

**Problem:**
LLM judgments don't link to `benchmark_id` like rule validators do.

**Rule Validators (lib/evaluation/validators/executor.ts:162):**
```typescript
const judgment: JudgmentRecord = {
  message_id: messageId,
  judge_type: 'rule',
  judge_name: result.validatorName,
  criterion: result.validatorId,
  score: result.score || (result.passed ? 1.0 : 0.0),
  passed: result.passed,
  benchmark_id: benchmarkId,  // ✅ Links to benchmark
  evidence_json: result.evidence || null,
  notes: result.notes || null
};
```

**LLM Judge (app/api/evaluation/judge/route.ts:253-268):**
```typescript
const records = judgments.map((judgment) => ({
  message_id: judgment.message_id,
  judge_type: 'llm',
  judge_name: judgment.judge_model,
  criterion: judgment.criterion,
  score: judgment.score,
  passed: judgment.passed,
  evidence_json: { ... },
  notes: `AI evaluation with ${(judgment.confidence * 100).toFixed(0)}% confidence`
  // ❌ No benchmark_id
}));
```

**Impact:**
- Can't filter LLM judgments by benchmark
- Can't compare LLM vs rule validator performance on same benchmark
- Analytics queries require joins to get benchmark context

---

## ✅ What's Working Well

### 1. Clean Separation of Concerns
- Core logic in `lib/evaluation/llm-judge.ts`
- HTTP API in `app/api/evaluation/judge/route.ts`
- Integration points are well-documented

### 2. Flexible Criteria System
- Standard criteria provided
- Custom criteria can be created
- Can evaluate against subset of criteria

### 3. Batch Evaluation Support
- Efficient parallel processing with concurrency limit
- Single API call for multiple messages

### 4. Rich Evidence Collection
```typescript
evidence: {
  positive_aspects: string[];
  negative_aspects: string[];
  improvement_suggestions: string[];
}
```

### 5. Multiple Model Support
- OpenAI (GPT-4, GPT-4 Turbo)
- Anthropic (Claude 3 Opus, Claude 3 Sonnet)
- Easy to extend to new models

### 6. Error Recovery
- Parse failures don't crash evaluation
- Returns default judgment on LLM API errors
- Batch testing continues even if judge fails

### 7. Authentication & Security
- Bearer token required
- Supabase RLS enforced
- User ownership verified

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Judge Trigger Points                  │
└─────────────────────────────────────────────────────────────┘
           │                 │                     │
           │                 │                     │
    ┌──────▼──────┐   ┌─────▼─────┐   ┌──────────▼─────────┐
    │   Batch     │   │ Analytics │   │   Manual API Call   │
    │  Testing    │   │ Assistant │   │  (Direct Evaluation)│
    │   (UI)      │   │   Tool    │   │                     │
    └──────┬──────┘   └─────┬─────┘   └──────────┬─────────┘
           │                 │                     │
           │                 │                     │
    ┌──────▼─────────────────▼─────────────────────▼─────────┐
    │    POST /api/evaluation/judge                           │
    │    - Validates auth                                     │
    │    - Fetches message content if needed                  │
    │    - Prepares criteria                                  │
    └───────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │   LLMJudge.judgeMessage()│
                │   - For each criterion   │
                └───────────┬───────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  judgeSingleCriterion()      │
            │  - Build prompt              │
            │  - Call OpenAI or Anthropic  │
            │  - Parse JSON response       │
            └───────────────┬──────────────┘
                            │
                ┌───────────▼───────────┐
                │  Return LLMJudgmentResult│
                │  {                        │
                │    criterion: string      │
                │    score: 1-10           │
                │    passed: boolean        │
                │    reasoning: string      │
                │    confidence: 0-1        │
                │    evidence: {...}        │
                │  }                        │
                └───────────┬──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  saveJudgmentsToDatabase()   │
            │  - Map to JudgmentRecord     │
            │  - INSERT into judgments     │
            └───────────────┬──────────────┘
                            │
                ┌───────────▼───────────┐
                │   Database            │
                │   judgments table     │
                │   judge_type: 'llm'   │
                │   score: 1-10 ⚠️      │
                └───────────────────────┘
```

---

## 📝 Recommendations

### Priority 1 (CRITICAL): Fix Score Normalization

**Option A: Normalize LLM scores to 0-1 (Recommended)**

**Why:**
- Matches existing rule validators and human judgments
- Most statistical analysis assumes 0-1 range
- UI already displays scores as percentages

**Changes Required:**

1. **Normalize before saving** (`app/api/evaluation/judge/route.ts:258`)
```typescript
score: judgment.score / 10,  // Convert 1-10 to 0.1-1.0
```

2. **Update UI display logic** (`components/chat/MessageJudgments.tsx:174`)
```typescript
{judgment.judge_type === 'llm' ? (
  <div>Score: {judgment.score.toFixed(1)}/10</div>
) : (
  <div>Score: {(judgment.score * 100).toFixed(1)}%</div>
)}
```

3. **Document score ranges** in judgment interface
```typescript
export interface JudgmentRecord {
  score: number;  // 0-1 scale for all judge types
}
```

**Option B: Keep 1-10 scale but document clearly**

**Changes Required:**

1. Add `score_scale` field to judgments table
```sql
ALTER TABLE judgments ADD COLUMN score_scale VARCHAR(10) DEFAULT '0-1';
```

2. Set scale when saving
```typescript
score_scale: judgment.judge_type === 'llm' ? '1-10' : '0-1'
```

3. Update all analytics to normalize during queries
```sql
SELECT
  CASE
    WHEN judge_type = 'llm' THEN score / 10
    ELSE score
  END as normalized_score
FROM judgments;
```

---

### Priority 2: Fix Model Name Inconsistency

**Change UI to match API:**
```typescript
// components/training/BatchTesting.tsx:91
const [judgeModel, setJudgeModel] = useState<
  'gpt-4-turbo' | 'claude-3-sonnet' | 'gpt-4o-mini'
>('claude-3-sonnet');  // Changed from 'claude-3-5-sonnet'
```

**OR add model mapping:**
```typescript
const MODEL_MAP = {
  'claude-3-5-sonnet': 'claude-3-sonnet',
  'gpt-4-turbo': 'gpt-4-turbo',
  'gpt-4o-mini': 'gpt-4o-mini'
};
```

---

### Priority 3: Improve Batch Testing Error Handling

**Refactor nested queries:**
```typescript
// app/api/batch-testing/run/route.ts:627-640
// Replace nested query with sequential queries
const { data: conversation, error: convError } = await supabase
  .from('conversations')
  .select('id')
  .eq('widget_session_id', widgetSessionId)
  .single();

if (convError || !conversation) {
  console.warn(`[Process Prompt] ${promptIndex + 1}: Conversation not found, skipping judge`);
  return true;
}

const { data: recentMessage, error: msgError } = await supabase
  .from('messages')
  .select('id')
  .eq('conversation_id', conversation.id)
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

if (msgError || !recentMessage) {
  console.warn(`[Process Prompt] ${promptIndex + 1}: Message not found, skipping judge`);
  return true;
}
```

---

### Priority 4: Add Benchmark ID to LLM Judgments

**Modify API to accept benchmark_id:**
```typescript
// app/api/evaluation/judge/route.ts
interface EvaluationRequest {
  message_id: string;
  benchmark_id?: string;  // Add this
  // ... rest of fields
}

// In saveJudgmentsToDatabase:
const records = judgments.map((judgment) => ({
  // ... existing fields
  benchmark_id: benchmarkId || null,  // Add this
}));
```

**Update batch testing to pass benchmark_id:**
```typescript
// app/api/batch-testing/run/route.ts:657
body: JSON.stringify({
  message_id: messageId,
  benchmark_id: config.benchmark_id,  // Add this
  criteria: judgeConfig.criteria,
  judge_model: judgeConfig.model,
  save_to_db: true
})
```

---

### Priority 5: Add Score Migration Script

**Create migration to normalize existing LLM scores:**
```sql
-- Normalize existing LLM judge scores from 1-10 to 0-1
UPDATE judgments
SET score = score / 10
WHERE judge_type = 'llm'
  AND score > 1;  -- Only update if not already normalized
```

---

## 🧪 Testing Recommendations

### 1. Score Normalization Test
```sql
-- Before fix: Check for scores > 1
SELECT judge_type, COUNT(*), MIN(score), MAX(score), AVG(score)
FROM judgments
GROUP BY judge_type;

-- Expected after fix: All scores between 0 and 1
-- judge_type | count | min | max | avg
-- rule       | 1000  | 0.0 | 1.0 | 0.75
-- llm        | 500   | 0.1 | 1.0 | 0.78
-- human      | 50    | 0.0 | 1.0 | 0.82
```

### 2. UI Display Test
1. Run batch test with LLM judge enabled
2. Check MessageJudgments component
3. Verify scores display correctly (not as percentages > 100%)

### 3. Analytics Accuracy Test
```typescript
// Test that averages make sense across judge types
const avgScores = await supabase
  .from('judgments')
  .select('judge_type, score')
  .eq('message_id', 'test-message');

// All averages should be in 0-1 range
```

### 4. End-to-End Test
1. Create batch test with judge enabled
2. Run 5 prompts
3. Verify judgments saved with:
   - Correct judge_type: 'llm'
   - Scores in correct range (0-1)
   - benchmark_id populated (after fix)
   - Evidence JSON contains reasoning

---

## 📈 Usage Patterns

### Current Usage (Based on Code Analysis)

**1. Batch Testing (Most Common)**
- User enables "Assistant as Judge" checkbox
- Selects model and criteria
- Runs batch test
- Judge evaluates each response automatically
- Results saved to database

**2. Analytics Assistant (On-Demand)**
- User asks: "How good were responses in this session?"
- Assistant calls `evaluate_messages` tool
- Returns summary statistics with reasoning
- User can dig into specific failures

**3. Manual API (Advanced)**
- Direct API calls for custom workflows
- Integration testing
- Research and development

---

## 🎯 Summary

### System Status: ⚠️ **Functional with Critical Issue**

**Strengths:**
- ✅ Well-architected with clean separation
- ✅ Multiple integration points working
- ✅ Good error handling for LLM failures
- ✅ Rich evidence collection
- ✅ Flexible criteria system

**Critical Issue:**
- ❌ **Score normalization mismatch** - Different scales used by different judge types
- Impact: Breaks analytics, incorrect UI display, inconsistent database

**Medium Issues:**
- ⚠️ Model name inconsistency (UI vs API)
- ⚠️ Missing benchmark_id linkage
- ⚠️ Complex nested queries in batch testing

**Recommended Actions:**
1. **Immediate:** Fix score normalization (normalize to 0-1)
2. **Immediate:** Migrate existing LLM scores
3. **Soon:** Fix model name mapping
4. **Soon:** Add benchmark_id to LLM judgments
5. **Later:** Refactor batch testing error handling

---

## 📁 Complete File List

### Core Files (Must Review)
1. ✅ `lib/evaluation/llm-judge.ts` - Core logic
2. ✅ `app/api/evaluation/judge/route.ts` - HTTP API
3. ✅ `components/training/BatchTesting.tsx` - UI integration
4. ✅ `app/api/batch-testing/run/route.ts` - Batch integration
5. ✅ `app/api/analytics/chat/route.ts` - Analytics integration

### Supporting Files
6. `lib/evaluation/judgments.service.ts` - Database operations
7. `components/chat/MessageJudgments.tsx` - UI display
8. `lib/evaluation/types.ts` - Type definitions
9. `__tests__/api/evaluation/judge.test.ts` - Tests

---

**Audit Complete**
**Date:** December 3, 2025
**Status:** Ready for remediation
