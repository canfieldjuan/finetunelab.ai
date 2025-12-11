# Batch Testing: Session Tagging + Assistant Judge Integration - IMPLEMENTED ✅

**Date:** 2025-12-03
**Status:** Complete - Ready for Testing
**Feature:** Session tagging and LLM-as-judge integration for batch testing

---

## Summary

Implemented full integration of session tagging and assistant-as-judge features into the batch testing system. Users can now:
- **Tag batch tests** with session IDs for analytics tracking (auto-generate or manual)
- **Enable LLM judge** to automatically evaluate response quality in real-time
- **Track and compare** batch tests in the analytics dashboard using session-based A/B testing
- **Future-proof architecture** designed for enhanced judge capabilities (tools, custom criteria, etc.)

---

## Features Implemented

### 1. Session Tagging for Analytics ✅

**UI Components:**
- Checkbox to enable/disable session tagging
- Toggle for auto-generate vs manual entry
- Preview of auto-generated session tags
- Manual input fields for session_id and experiment_name

**Functionality:**
- Auto-generates session tags in format: `batch-{model}-{timestamp}`
- Auto-generates experiment names: `batch-testing-{model}`
- Manual override available for custom naming
- Session tags stored in `conversations` table for analytics tracking

**Code Locations:**
- UI: `components/training/BatchTesting.tsx` lines 826-904
- API: `app/api/batch-testing/run/route.ts` lines 228, 470-471
- Types: `lib/batch-testing/types.ts` lines 24-27, 52

### 2. Assistant as Judge (LLM Evaluation) ✅

**UI Components:**
- Checkbox to enable/disable LLM judge evaluation
- Judge model selection dropdown (GPT-4 Turbo, Claude 3.5 Sonnet, GPT-4o Mini)
- Multi-select checkboxes for evaluation criteria
- Real-time cost estimate display

**Evaluation Criteria Available:**
- helpfulness
- accuracy
- clarity
- safety
- completeness

**Functionality:**
- Evaluates each response after it's generated
- Saves judgments to `judgments` table with scores 1-10
- Non-blocking - test continues even if judge fails
- Cost-transparent with upfront estimates

**Code Locations:**
- UI: `components/training/BatchTesting.tsx` lines 906-983
- API Processing: `app/api/batch-testing/run/route.ts` lines 626-659
- Types: `lib/batch-testing/types.ts` lines 32-36, 53

### 3. Backend Integration ✅

**Session Tag Flow:**
1. Frontend prepares session_tag object
2. Sent to `/api/batch-testing/run` in config
3. Stored in BatchTestConfig
4. Applied to conversation during creation
5. Available in analytics for comparison

**Judge Evaluation Flow:**
1. Frontend prepares judge_config object
2. Sent to `/api/batch-testing/run` in config
3. Passed to `processSinglePrompt` function
4. After each chat response, fetches message ID
5. Calls `/api/evaluation/judge` with message ID and criteria
6. Judge evaluates and saves to `judgments` table
7. Logs average score per prompt

**Code Locations:**
- Config preparation: `components/training/BatchTesting.tsx` lines 549-574
- API handling: `app/api/batch-testing/run/route.ts` lines 221-230
- Conversation creation: `app/api/batch-testing/run/route.ts` lines 469-471
- Judge execution: `app/api/batch-testing/run/route.ts` lines 626-659

---

## Architecture

### Data Flow

```
USER (Batch Testing UI)
 │
 ├─► Enables Session Tagging
 │    ├─ Auto-generate: ✓
 │    └─ Preview: "batch-gpt4-20251203T143052"
 │
 ├─► Enables Assistant Judge
 │    ├─ Model: Claude 3.5 Sonnet
 │    ├─ Criteria: [helpfulness, accuracy, clarity]
 │    └─ Cost: ~$0.40 for 50 prompts
 │
 ▼
BATCH TEST API (/api/batch-testing/run)
 │
 ├─► Creates conversation with session tags
 │    ├─ session_id: "batch-gpt4-20251203T143052"
 │    └─ experiment_name: "batch-testing-gpt4"
 │
 ▼
FOR EACH PROMPT (processSinglePrompt)
 │
 ├─► Send to CHAT API (/api/chat)
 │    ├─ Creates user message
 │    ├─ Assistant responds
 │    └─ Creates assistant message in DB
 │
 ├─► Fetch message ID from database
 │    └─ Query: latest assistant message in conversation
 │
 ├─► If judge enabled → JUDGE API (/api/evaluation/judge)
 │    ├─ Input: message_id, criteria, judge_model
 │    ├─ LLM evaluates response
 │    ├─ Returns: scores (1-10), evidence, reasoning
 │    └─ Saves to judgments table
 │
 └─► Log progress and continue
 │
 ▼
COMPLETE
 │
 └─► All messages tagged with session_id
 └─► All judgments linked to message_ids
 └─► Available in Analytics for comparison
```

---

## Type Definitions

### SessionTag Interface
```typescript
interface SessionTag {
  session_id: string;
  experiment_name?: string;
}
```

### JudgeConfig Interface
```typescript
interface JudgeConfig {
  enabled: boolean;
  model: string;  // 'gpt-4-turbo' | 'claude-3-5-sonnet' | 'gpt-4o-mini'
  criteria: string[];  // ['helpfulness', 'accuracy', 'clarity', 'safety', 'completeness']
}
```

### BatchTestConfig (Updated)
```typescript
interface BatchTestConfig {
  model_name: string;
  prompt_limit: number;
  concurrency: number;
  delay_ms: number;
  source_path: string;
  benchmark_id?: string;
  test_run_name?: string;
  session_tag?: SessionTag;      // NEW
  judge_config?: JudgeConfig;    // NEW
}
```

---

## UI Components

### Session Tagging Section

**Location:** `components/training/BatchTesting.tsx` lines 826-904

**Features:**
- Collapsible section with bg-muted/30 background
- Checkbox to enable feature
- Auto-generate toggle (default: ON)
- Manual input fields (shown when auto-generate OFF)
- Live preview of auto-generated tags
- Clear helper text

**States:**
- `useSessionTag`: boolean - Enable/disable feature
- `autoGenerateTag`: boolean - Auto vs manual
- `sessionId`: string - Manual session ID
- `experimentName`: string - Manual experiment name

**Helper Functions:**
- `generateSessionTag(modelId)`: Generates session tag from model ID and timestamp

### Assistant Judge Section

**Location:** `components/training/BatchTesting.tsx` lines 906-983

**Features:**
- Collapsible section with bg-muted/30 background
- Checkbox to enable feature
- Judge model dropdown with cost indicators
- Criteria checkboxes in 2-column grid
- Cost estimate with yellow warning background
- Real-time cost calculation based on prompt limit

**States:**
- `useAssistantJudge`: boolean - Enable/disable feature
- `judgeModel`: 'gpt-4-turbo' | 'claude-3-5-sonnet' | 'gpt-4o-mini'
- `judgeCriteria`: string[] - Selected criteria

**Helper Functions:**
- `getJudgeCostEstimate()`: Calculates estimated cost based on model, criteria count, and prompt limit

**Cost Estimates (per message):**
- GPT-4 Turbo: ~$0.015
- Claude 3.5 Sonnet: ~$0.008 (recommended)
- GPT-4o Mini: ~$0.003

---

## API Implementation

### Request Body (Enhanced)

```typescript
POST /api/batch-testing/run

{
  config: {
    model_id: string;
    test_suite_id: string;
    prompt_limit: number;
    concurrency: number;
    delay_ms: number;
    benchmark_id?: string;
    test_run_name?: string;

    // NEW FIELDS
    session_tag?: {
      session_id: string;
      experiment_name?: string;
    };
    judge_config?: {
      enabled: boolean;
      model: string;
      criteria: string[];
    };
  }
}
```

### Conversation Creation (Updated)

**Location:** `app/api/batch-testing/run/route.ts` lines 458-474

```typescript
const { data: conversation } = await supabaseAdmin
  .from('conversations')
  .insert({
    user_id: userId,
    title: `Batch Test - ${new Date().toISOString()}`,
    widget_session_id: widgetSessionId,
    is_widget_session: true,
    llm_model_id: config.model_name,
    run_id: runId,
    batch_test_run_id: testRunId,
    // NEW: Session tagging
    session_id: config.session_tag?.session_id || null,
    experiment_name: config.session_tag?.experiment_name || null
  });
```

### processSinglePrompt (Enhanced)

**Location:** `app/api/batch-testing/run/route.ts` lines 583-676

**Signature:**
```typescript
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  authHeader: string,
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  judgeConfig?: JudgeConfig  // NEW
): Promise<boolean>
```

**Flow:**
1. Send prompt to `/api/chat`
2. Wait for response and consume stream
3. If judge enabled:
   - Fetch conversation ID from widget_session_id
   - Fetch latest assistant message ID
   - Call `/api/evaluation/judge` with message ID
   - Log average score
4. Return success/failure

**Judge Integration:**
```typescript
if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
  // Fetch message ID
  const { data: recentMessage } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Call judge API
  const judgeResponse = await fetch('/api/evaluation/judge', {
    method: 'POST',
    headers: { 'Authorization': authHeader },
    body: JSON.stringify({
      message_id: messageId,
      criteria: judgeConfig.criteria,
      judge_model: judgeConfig.model,
      save_to_db: true
    })
  });

  // Log results
  const avgScore = evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length;
  console.log(`Judge evaluation complete, avg score: ${avgScore.toFixed(1)}/10`);
}
```

---

## Database Schema

### No Changes Required! ✅

All existing tables support the new features:

**conversations table** (already has):
- `session_id` VARCHAR - For session tagging
- `experiment_name` VARCHAR - For experiment grouping
- `widget_session_id` VARCHAR - For batch test tracking
- `batch_test_run_id` UUID - Links to batch test run

**judgments table** (already has):
- `message_id` UUID - Links to evaluated message
- `judge_type` VARCHAR - 'llm'
- `judge_name` VARCHAR - 'gpt-4-turbo', 'claude-3-5-sonnet', etc.
- `criterion` VARCHAR - 'helpfulness', 'accuracy', etc.
- `score` INTEGER - 1-10
- `passed` BOOLEAN - Based on passing_score (7 for most criteria)
- `evidence_json` JSONB - Reasoning, confidence, suggestions

---

## Usage Examples

### Example 1: Simple Batch Test with Session Tagging

**Setup:**
1. Select model: GPT-4
2. Select test suite: "Customer Support 50Qs"
3. Enable "Session Tagging for Analytics" ✓
4. Keep "Auto-generate session tag" ✓
5. Start batch test

**Result:**
- Session ID: `batch-gpt4-20251203T143052`
- Experiment: `batch-testing-gpt4`
- All 50 conversations tagged
- Visible in Analytics dashboard
- Can compare with other sessions

### Example 2: A/B Test with Manual Session Tags

**Test 1 - GPT-4 Baseline:**
1. Model: GPT-4
2. Enable session tagging ✓
3. Disable auto-generate
4. Session ID: `baseline-gpt4`
5. Experiment: `model-comparison`
6. Start test

**Test 2 - Claude 3.5 Variant:**
1. Model: Claude 3.5 Sonnet
2. Enable session tagging ✓
3. Disable auto-generate
4. Session ID: `variant-claude`
5. Experiment: `model-comparison`
6. Start test

**Analytics:**
- Both tests grouped under "model-comparison"
- Side-by-side comparison
- Statistical significance testing
- P-values and confidence intervals

### Example 3: Quality-Focused Test with Judge

**Setup:**
1. Model: GPT-4o Mini (testing if good enough)
2. Enable session tagging ✓ (auto)
3. Enable "Assistant as Judge" ✓
4. Judge model: Claude 3.5 Sonnet
5. Criteria: helpfulness, accuracy, clarity ✓
6. Start test (50 prompts, est. cost: $0.24)

**Result:**
- 50 prompts processed
- 50 judgments created (3 criteria each = 150 total scores)
- Average scores:
  - Helpfulness: 7.8/10
  - Accuracy: 8.2/10
  - Clarity: 8.5/10
- All saved to database
- Queryable in analytics

---

## Future Enhancements (Ready for Implementation)

The architecture is designed to support:

### 1. Enhanced Judge Capabilities ✅ Ready
- **Custom criteria**: Allow users to define their own evaluation criteria
- **Tool usage**: Give judge access to tools (code execution, web search, etc.)
- **Multi-turn evaluation**: Evaluate conversation context, not just single messages
- **Comparative judging**: Compare multiple model responses side-by-side

### 2. Real-time Observation ✅ Designed
- "Observe with Assistant" button for running tests
- Chat interface to ask questions about test progress
- Assistant has full context of batch test status
- Quick prompts: "How's it going?", "Any errors?", "Quality scores?"

### 3. Quality Score Display ✅ Schema Ready
- Show average scores inline in test run cards
- Expandable quality breakdown
- Pass/fail indicators
- Trend visualization

### 4. Advanced Analytics Integration ✅ Data Ready
- Session comparison with quality scores
- Quality trends over time
- Cost vs quality analysis
- Statistical significance on quality metrics

---

## Testing Checklist

### Basic Functionality
- [ ] Navigate to `/testing` page
- [ ] Verify UI sections are visible and styled correctly
- [ ] Check all checkboxes and inputs are functional

### Session Tagging
- [ ] Enable "Session Tagging for Analytics"
- [ ] Verify auto-generate preview shows correct format
- [ ] Disable auto-generate, enter manual session ID
- [ ] Verify manual input fields appear
- [ ] Start test, verify conversation has session_id in database

### Assistant Judge
- [ ] Enable "Assistant as Judge"
- [ ] Select different judge models, verify cost estimate updates
- [ ] Check/uncheck criteria, verify cost recalculates
- [ ] Verify cost estimate is accurate
- [ ] Start test with judge enabled
- [ ] Check console logs for judge evaluation messages
- [ ] Verify judgments table has new records after test completes

### Integration Testing
- [ ] Run batch test with BOTH session tag AND judge enabled
- [ ] Verify conversation created with session_id
- [ ] Verify judgments created for each message
- [ ] Check Analytics dashboard shows the session
- [ ] Verify session comparison works
- [ ] Check quality scores are queryable

### Error Handling
- [ ] Start test with judge but invalid auth → test continues, judge fails gracefully
- [ ] Start test with invalid session ID → should still work
- [ ] Cancel test mid-execution → verify judge stops cleanly

---

## Cost Analysis

### Scenario: 50-Prompt Batch Test

**Without Judge:**
- Model responses: 50 × $0.02 (GPT-4) = **$1.00**
- Total: **$1.00**

**With Judge (Claude 3.5 Sonnet, 3 criteria):**
- Model responses: 50 × $0.02 = **$1.00**
- Judge evaluations: 50 × $0.008 × (3/5) = **$0.24**
- Total: **$1.24** (+24% overhead)

**With Judge (GPT-4o Mini, 3 criteria):**
- Model responses: 50 × $0.02 = **$1.00**
- Judge evaluations: 50 × $0.003 × (3/5) = **$0.09**
- Total: **$1.09** (+9% overhead)

**Recommendation:** Use Claude 3.5 Sonnet for balanced quality/cost, or GPT-4o Mini for budget-conscious testing.

---

## Console Logging

**Batch Test Start:**
```
[Batch Testing Run] Starting batch test with config {
  modelId: 'gpt-4-turbo',
  testSuiteId: '...',
  sessionTag: {
    session_id: 'batch-gpt4-turbo-20251203T143052',
    experiment_name: 'batch-testing-gpt4-turbo'
  },
  judgeConfig: {
    enabled: true,
    model: 'claude-3-5-sonnet',
    criteria: ['helpfulness', 'accuracy', 'clarity']
  }
}
```

**Per-Prompt Execution:**
```
[Process Prompt] 1: Sending to /api/chat
[Process Prompt] 1: Chat success
[Process Prompt] 1: Starting LLM judge evaluation with 3 criteria
[Process Prompt] 1: Judge evaluation complete, avg score: 8.3/10
[Background Batch] Progress: 1/50
```

**Test Completion:**
```
[Background Batch] Batch test run completed: {
  testRunId: '...',
  completed: 50,
  failed: 0
}
```

---

## Files Modified

### Frontend
1. **components/training/BatchTesting.tsx**
   - Added session tagging state (lines 97-101)
   - Added judge state (lines 103-106)
   - Added helper functions (lines 136-164)
   - Added session tagging UI (lines 826-904)
   - Added assistant judge UI (lines 906-983)
   - Updated handleStartTest to prepare configs (lines 549-600)

### Backend
2. **app/api/batch-testing/run/route.ts**
   - Updated batchConfig to include new fields (lines 221-230)
   - Added session tags to conversation creation (lines 469-471)
   - Updated processSinglePrompt signature (line 592)
   - Added judge evaluation logic (lines 626-659)
   - Updated function call to pass judge_config (line 509)

### Types
3. **lib/batch-testing/types.ts**
   - Added SessionTag interface (lines 24-27)
   - Added JudgeConfig interface (lines 32-36)
   - Updated BatchTestConfig interface (lines 52-53)

### Documentation
4. **docs/progress/BATCH_TESTING_SESSION_TAG_INTEGRATION.md**
   - Comprehensive architecture documentation
   - Planning document for the feature

5. **docs/progress/BATCH_TESTING_SESSION_TAG_JUDGE_IMPLEMENTATION.md** (this file)
   - Implementation documentation
   - Usage examples and testing guide

---

## Summary

✅ **Session Tagging** - Fully implemented and ready to use
✅ **Assistant Judge** - Fully integrated with real-time evaluation
✅ **Type-Safe** - All TypeScript types updated and verified
✅ **Non-Breaking** - Optional features, no existing functionality affected
✅ **Cost-Transparent** - Upfront cost estimates for judge usage
✅ **Future-Proof** - Designed for enhanced capabilities (tools, custom criteria, etc.)
✅ **Database-Ready** - No schema changes required, uses existing tables
✅ **Analytics-Ready** - Session tags integrate with existing A/B testing features

**Next Step:** End-to-end testing! 🚀

---

## Quick Start Guide

1. **Navigate to** `/testing` page
2. **Configure batch test** as usual (model, test suite, limits)
3. **Optional: Enable Session Tagging**
   - Check "Session Tagging for Analytics"
   - Keep auto-generate ON for automatic tags
   - OR disable auto-generate to enter custom session ID
4. **Optional: Enable Assistant Judge**
   - Check "Assistant as Judge (LLM Evaluation)"
   - Select judge model (Claude 3.5 Sonnet recommended)
   - Check criteria to evaluate
   - Review cost estimate
5. **Start Batch Test**
6. **View Results**
   - Check console logs for judge scores
   - Navigate to `/analytics` to see session comparison
   - Query `judgments` table for detailed scores

**That's it! Your batch test now has analytics tracking and automated quality evaluation.** 🎉
