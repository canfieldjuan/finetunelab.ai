# Validation Tables - Unified Approach for Human & LLM Evaluations
**Date**: November 29, 2025
**Purpose**: Reuse existing validation tables for both human and LLM-as-judge evaluations
**Status**: ANALYSIS COMPLETE - Ready for implementation discussion

---

## Current State: TWO Separate Systems ✅

### System 1: `message_evaluations` Table (Human Feedback)

**Purpose**: Manual validation from chat UI (thumbs up/down, star rating)

**Location**:
- UI: `components/chat/MessageList.tsx:148-182` (thumbs/star buttons)
- API: `app/api/evaluate/route.ts`
- Usage: `lib/tools/evaluation-metrics/metrics.service.ts`

**Schema** (inferred from code):
```sql
message_evaluations:
  - message_id (UUID, FK to messages)
  - evaluator_id (UUID, FK to auth.users)
  - rating (number, e.g., 1-5 stars)
  - success (boolean, thumbs up/down)
  - failure_tags (string[], categories of failure)
  - notes (text, human notes)
  - expected_behavior (text, what should have happened)
  - actual_behavior (text, what actually happened)
  - created_at (timestamp)
  - updated_at (timestamp)
  - conversation_id (UUID) -- Used for filtering
```

**UI Elements**:
- **Thumbs Up/Down** (lines 148-173): Sets `success` boolean
- **Star Button** (lines 174-182): Opens detailed evaluation modal
- **Evaluation Modal** (from `/api/evaluate/route.ts`): Sets rating, notes, expected/actual behavior

**Current Behavior**:
```typescript
// User clicks thumbs up
onFeedback(msg.id, 1)  // success = true

// User clicks thumbs down
onFeedback(msg.id, -1)  // success = false

// User clicks star
onEvaluate(msg.id)  // Opens modal for detailed feedback
```

**Used in Analytics**:
- Evaluation metrics service queries this table
- Tracks rating trends, failure patterns
- Filters by user, conversation, date range

---

### System 2: `judgments` Table (Rule/Human/LLM)

**Purpose**: Unified evaluation system supporting multiple judge types

**Location**:
- Core: `lib/evaluation/llm-judge.ts` (LLM judge)
- Service: `lib/evaluation/judgments.service.ts`
- API: `app/api/evaluation/judge/route.ts`
- Types: `lib/evaluation/types.ts:58-69`

**Schema** (from types and service):
```sql
judgments:
  - id (UUID, primary key)
  - message_id (UUID, FK to messages)
  - user_id (UUID, FK to auth.users) -- Who owns the message
  - judge_type ('rule' | 'human' | 'llm')
  - judge_name (text, e.g., 'gpt-4-turbo', 'must_cite_if_claims', 'john_doe')
  - criterion (text, e.g., 'helpfulness', 'accuracy', 'citation_required')
  - score (number, 0-10 for LLM, 0-1 for rules)
  - passed (boolean)
  - evidence_json (JSONB, structured evidence)
  - notes (text)
  - created_at (timestamp)
```

**RLS Policies** (`20251127_fix_judgments_rls.sql`):
- Users can INSERT/SELECT/UPDATE/DELETE judgments for their own messages
- Enforced via messages.user_id = auth.uid()

**Judge Types**:
1. **'rule'**: Automated validators (e.g., citation checkers)
2. **'human'**: Manual evaluations (NOT CURRENTLY USED IN UI!)
3. **'llm'**: LLM-as-judge evaluations (GPT-4, Claude)

**LLM-as-Judge Criteria** (5 standard):
- `helpfulness` (1-10, passing: 7)
- `accuracy` (1-10, passing: 7)
- `clarity` (1-10, passing: 7)
- `safety` (1-10, passing: 8)
- `completeness` (1-10, passing: 7)

**Evidence JSON Structure**:
```json
{
  "reasoning": "The response clearly addresses...",
  "confidence": 0.85,
  "positive_aspects": ["Clear explanation", "Provided examples"],
  "negative_aspects": ["Could be more concise"],
  "suggestions": ["Add code examples"]
}
```

---

## The Problem: Disconnected Systems ❌

### Issue 1: Human Feedback Split Across Two Tables

**Current**:
- Thumbs up/down → `message_evaluations.success`
- Star ratings → `message_evaluations.rating`
- **NOT** saving to `judgments` table!

**Problem**: Analytics can't compare human vs LLM evaluations in one place

---

### Issue 2: No Unified Human/LLM Comparison

**User's goal**: Compare human ratings with LLM-as-judge scores

**Current**: Would require JOIN across two tables:
```sql
-- Awkward query to compare human vs LLM
SELECT
  me.message_id,
  me.success AS human_success,
  me.rating AS human_rating,
  j.score AS llm_score,
  j.passed AS llm_passed
FROM message_evaluations me
LEFT JOIN judgments j ON j.message_id = me.message_id AND j.judge_type = 'llm'
```

---

### Issue 3: Batch Test Tagging Not Supported

**User's request**: "tag each batch test as human or model feedback"

**Current**: Neither table has `source` or `batch_test_id` field to distinguish:
- Manual chat feedback
- Batch test human validation
- Batch test LLM validation

---

## Proposed Solution: Unified Approach

### Option A: Migrate to Single Table (judgments) ✅ RECOMMENDED

**Approach**: Use `judgments` table for EVERYTHING, deprecate `message_evaluations`

**Why**:
- ✅ Single source of truth
- ✅ Already has judge_type field ('human', 'llm', 'rule')
- ✅ Supports structured evidence
- ✅ Easy comparison across judge types
- ✅ RLS policies already in place

**Changes needed**:

#### 1. Add `source` Field to judgments

```sql
ALTER TABLE judgments ADD COLUMN source TEXT DEFAULT 'manual';
-- Values: 'manual' (chat UI), 'batch_test', 'automated'
```

#### 2. Add `batch_test_id` Field (optional)

```sql
ALTER TABLE judgments ADD COLUMN batch_test_id UUID REFERENCES batch_test_runs(id);
```

#### 3. Map Chat UI Feedback to judgments

**Current chat UI**:
```typescript
// Thumbs up/down
onFeedback(messageId, 1)  // or -1

// Star rating
onEvaluate(messageId)  // Opens modal
```

**New behavior**:
```typescript
// Thumbs up/down → Save as human judgment
async function handleThumbsUp(messageId: string) {
  await fetch('/api/evaluation/judge', {
    method: 'POST',
    body: JSON.stringify({
      message_id: messageId,
      judge_type: 'human',
      criterion: 'overall_satisfaction',
      score: 10,  // Thumbs up = 10/10
      passed: true,
      source: 'manual',
      notes: 'User thumbs up'
    })
  });
}

async function handleThumbsDown(messageId: string) {
  await fetch('/api/evaluation/judge', {
    method: 'POST',
    body: JSON.stringify({
      message_id: messageId,
      judge_type: 'human',
      criterion: 'overall_satisfaction',
      score: 0,  // Thumbs down = 0/10
      passed: false,
      source: 'manual',
      notes: 'User thumbs down'
    })
  });
}

// Star rating → Open modal with criteria selection
async function handleStarRating(messageId: string, rating: number, notes: string) {
  await fetch('/api/evaluation/judge', {
    method: 'POST',
    body: JSON.stringify({
      message_id: messageId,
      judge_type: 'human',
      criterion: 'quality_rating',
      score: rating,  // 1-10
      passed: rating >= 7,
      source: 'manual',
      notes: notes
    })
  });
}
```

#### 4. Analytics Chat Tool: `evaluate_messages`

**Add to analytics assistant tools** (`app/api/analytics/chat/route.ts`):

```typescript
{
  type: 'function',
  function: {
    name: 'evaluate_messages',
    description: 'Evaluate message quality using LLM-as-judge. Returns scores for helpfulness, accuracy, clarity, safety, and completeness.',
    parameters: {
      type: 'object',
      properties: {
        message_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of message IDs to evaluate'
        },
        criteria: {
          type: 'array',
          items: { type: 'string', enum: ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness'] },
          description: 'Which criteria to evaluate (default: all)',
          default: ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness']
        },
        judge_model: {
          type: 'string',
          enum: ['gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'],
          description: 'Which LLM to use as judge (default: claude-3-sonnet)',
          default: 'claude-3-sonnet'
        }
      },
      required: ['message_ids']
    }
  }
}
```

**Tool implementation**:
```typescript
case 'evaluate_messages': {
  const { message_ids, criteria, judge_model } = tool_call.function.arguments;

  // Call existing /api/evaluation/judge endpoint
  const response = await fetch('http://localhost:3000/api/evaluation/judge', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message_ids: message_ids,  // Batch evaluation
      criteria: criteria || ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness'],
      judge_model: judge_model || 'claude-3-sonnet',
      save_to_db: true,  // Auto-save to judgments table
      source: 'analytics_assistant'  // Tag as assistant-initiated
    })
  });

  const data = await response.json();

  // Return summary for assistant
  return {
    evaluated: data.evaluations.length,
    average_scores: {
      helpfulness: avg(data.evaluations.map(e => e.score)),
      accuracy: avg(...),
      // etc.
    },
    pass_rate: data.evaluations.filter(e => e.passed).length / data.evaluations.length,
    details: data.evaluations  // Full results
  };
}
```

**Example conversation**:
```
User: "Evaluate the quality of all responses in this session"