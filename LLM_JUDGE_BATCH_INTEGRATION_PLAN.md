# LLM-as-Judge Batch Testing Integration - Implementation Plan

**Issue:** Batch testing only uses rule-based validators, missing LLM-powered evaluation capabilities
**Date:** 2025-12-02
**Status:** Planning Phase - Awaiting Approval

---

## Executive Summary

Currently, batch tests evaluate responses using:

1. **Basic quality checker** - Simple heuristics (length, structure, keywords)
2. **Domain validators** - Rule-based checks (citations, format, policy scope)

Missing: **LLM-as-Judge** - AI-powered evaluation using GPT-4/Claude to assess quality dimensions like helpfulness, accuracy, clarity, safety, and completeness.

The LLM-Judge infrastructure exists (`lib/evaluation/llm-judge.ts`) with a working API endpoint (`/api/evaluation/judge`), but it's not integrated into the batch testing flow.

---

## Root Cause Analysis

### Current Architecture

**Batch Testing Flow:**

1. `POST /api/batch-testing/run` - Creates batch test run
2. `processBackgroundBatch()` - Processes prompts sequentially
3. `processSinglePrompt()` - Sends each prompt to `/api/chat`
4. `/api/chat` saves message, then calls `saveBasicJudgment()`
5. `saveBasicJudgment()` in `lib/batch-testing/evaluation-integration.ts`:
   - Runs basic quality heuristics → `judge_type: 'rule'`
   - If benchmark linked, runs domain validators → `judge_type: 'rule'`
   - Saves all judgments to database
6. **MISSING:** No LLM judge invocation

**LLM-Judge Infrastructure (Existing but Unused):**

- `lib/evaluation/llm-judge.ts` - Core evaluation logic
  - `LLMJudge` class with OpenAI + Anthropic clients
  - `judgeMessage()` - Evaluates single message
  - `batchJudge()` - Evaluates multiple messages with concurrency limit
  - `STANDARD_CRITERIA` - 5 evaluation dimensions (helpfulness, accuracy, clarity, safety, completeness)
- `app/api/evaluation/judge/route.ts` - REST API endpoint
  - Supports single + batch evaluation
  - Saves results with `judge_type: 'llm'`
  - Already tested and functional

### Why Integration is Needed

**Benefits:**

1. **Richer evaluation** - Goes beyond simple heuristics to assess semantic quality
2. **Competitive parity** - Matches LangSmith's AI evaluation capabilities
3. **Actionable insights** - Provides reasoning, positive/negative aspects, improvement suggestions
4. **Confidence scores** - LLM self-reports confidence level for each judgment
5. **Multi-dimensional assessment** - Evaluates 5+ criteria per response

**Use Cases:**

- Evaluate model quality across training checkpoints
- Compare fine-tuned models against base models
- Identify failure modes in production datasets
- Generate human-readable evaluation reports

---

## Design Decisions

### Decision 1: Integration Point

**Options:**

- **A. Add to `saveBasicJudgment()`** - Run LLM judge alongside rule validators
- **B. Separate post-processing step** - Run LLM judge after batch completes
- **C. Optional flag in config** - User chooses whether to enable LLM judge

**Recommendation:** **Option C (Optional flag)** because:

- ✅ Allows users to control cost (LLM judge uses paid APIs)
- ✅ Maintains backward compatibility
- ✅ Enables A/B testing (rule-only vs rule+LLM)
- ✅ Simple implementation (single config flag)

### Decision 2: When to Run LLM Judge

**Options:**

- **A. Inline during batch** - Evaluate each response as it's generated
- **B. Parallel processing** - Collect all responses, then evaluate in parallel
- **C. Post-batch processing** - Run after batch completes

**Recommendation:** **Option A (Inline during batch)** because:

- ✅ Natural integration point (already in evaluation flow)
- ✅ Progress tracking (see evaluations as batch progresses)
- ✅ Fail-fast (detect issues early)
- ✅ Consistent with existing architecture
- ❌ Slower batch runtime (sequential LLM calls) - **Acceptable tradeoff**

### Decision 3: Criteria Selection

**Options:**

- **A. All standard criteria** - Always evaluate all 5 dimensions
- **B. Configurable criteria** - User selects which criteria to evaluate
- **C. Benchmark-specific criteria** - Link criteria to benchmark requirements

**Recommendation:** **Option A (All standard criteria)** for Phase 1, **Option B** for Phase 2 because:

- ✅ Simple to implement (no UI changes needed)
- ✅ Comprehensive evaluation by default
- ✅ Can add configurability later without breaking changes
- ❌ Higher cost (5 criteria per message) - **Document cost clearly**

### Decision 4: Error Handling

**Options:**

- **A. Fail entire batch** - Stop if LLM judge fails
- **B. Skip LLM judgments** - Continue with rule-based only
- **C. Retry with backoff** - Attempt LLM judge 3 times before skipping

**Recommendation:** **Option B (Skip LLM judgments)** because:

- ✅ Non-blocking (batch completes even if LLM judge fails)
- ✅ Graceful degradation (rule-based judgments still saved)
- ✅ Clear logging (warn user LLM judge failed)
- ❌ Silent failure possible - **Mitigate with status tracking**

---

## Implementation Plan - 4 Phases

### Phase 1: Configuration & Feature Flag (2 hours)

**Goal:** Add configuration option to enable LLM judge in batch tests
**Risk:** Low (config changes only, no behavior changes)

#### Changes Required

**File 1:** `lib/batch-testing/types.ts`
**Location:** Lines 24-36 (BatchTestConfig interface)

**Action:** Add optional LLM judge configuration fields

```typescript
/**
 * Configuration for batch test execution
 */
export interface BatchTestConfig {
  model_name: string;
  huggingface_api_key?: string;  // Optional: For HuggingFace adapter fallback
  prompt_limit: number;
  concurrency: number;
  delay_ms: number;
  source_path: string;
  benchmark_id?: string;  // Optional: Link to benchmark for task-specific evaluation
  test_run_name?: string;  // Optional: Custom name for the test run
  test_suite_name?: string;  // Automatically populated from test suite
  custom_name?: string;  // Generated or custom name stored in database
  
  // NEW: LLM-Judge Configuration
  llm_judge?: {
    enabled: boolean;
    judge_model?: 'gpt-4' | 'gpt-4-turbo' | 'claude-3-opus' | 'claude-3-sonnet';
    criteria?: string[];  // Optional: Specific criteria names from STANDARD_CRITERIA
    on_error?: 'skip' | 'retry' | 'fail';  // Default: 'skip'
    max_retries?: number;  // Default: 3 (if on_error='retry')
  };
}
```

**Verification:**

- TypeScript compilation succeeds
- Existing batch tests still work (llm_judge is optional)
- No breaking changes to API contracts

---

### Phase 2: Integration into Evaluation Flow (3 hours)

**Goal:** Call LLM judge during batch evaluation when enabled
**Risk:** Medium (modifies evaluation flow, needs careful error handling)

#### Changes Required

**File 1:** `lib/batch-testing/evaluation-integration.ts`
**Location:** Lines 1-120 (entire file)

**Action:** Add LLM judge invocation to `saveBasicJudgment()`

```typescript
import { createClient } from '@supabase/supabase-js';
import { runBenchmarkValidators, type JudgmentRecord } from '../benchmarks/validator-orchestrator';
import type { Benchmark } from '../benchmarks/types';
import { LLMJudge, STANDARD_CRITERIA, LLMJudgmentResult } from '../evaluation/llm-judge';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface EvaluationContext {
  messageId: string;
  conversationId: string;
  userId: string;
  prompt: string;
  response: string;
  modelId: string;
  provider: string;
  benchmarkId?: string;  // Optional: Link judgment to benchmark
  llmJudgeConfig?: {     // NEW: LLM judge configuration
    enabled: boolean;
    judge_model?: 'gpt-4' | 'gpt-4-turbo' | 'claude-3-opus' | 'claude-3-sonnet';
    criteria?: string[];
    on_error?: 'skip' | 'retry' | 'fail';
    max_retries?: number;
  };
}

/**
 * Save basic quality judgment for response
 * If benchmark provided, also runs domain validators
 * If LLM judge enabled, runs AI-powered evaluation
 */
export async function saveBasicJudgment(context: EvaluationContext) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Evaluation] Starting evaluation for message:', context.messageId);

  // Array to collect all judgment records
  const judgments: JudgmentRecord[] = [];

  // 1. Always run basic quality heuristics
  const score = calculateBasicQualityScore(context.response);
  const passed = score >= 0.6;

  judgments.push({
    message_id: context.messageId,
    judge_type: 'rule',
    judge_name: 'basic-quality-checker',
    criterion: 'response_quality',
    score: score,
    passed: passed,
    benchmark_id: context.benchmarkId || null,
    evidence_json: {
      response_length: context.response.length,
      has_code_block: context.response.includes('```'),
      has_list: context.response.includes('\n-') || context.response.includes('\n*')
    }
  });

  // 2. If benchmark provided, fetch it and run validators
  if (context.benchmarkId) {
    console.log('[Evaluation] Fetching benchmark:', context.benchmarkId);

    const { data: benchmark, error: benchmarkError } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('id', context.benchmarkId)
      .single();

    if (benchmarkError || !benchmark) {
      console.error('[Evaluation] Failed to fetch benchmark:', benchmarkError);
    } else {
      console.log('[Evaluation] Running validators for benchmark:', benchmark.name);

      // Run domain validators
      const validatorJudgments = await runBenchmarkValidators(
        context,
        benchmark as Benchmark
      );

      judgments.push(...validatorJudgments);
    }
  }

  // 3. NEW: If LLM judge enabled, run AI-powered evaluation
  if (context.llmJudgeConfig?.enabled) {
    console.log('[Evaluation] LLM judge enabled, running AI evaluation');
    
    try {
      const llmJudgments = await runLLMJudge(context);
      judgments.push(...llmJudgments);
      console.log('[Evaluation] LLM judge completed:', llmJudgments.length, 'judgments');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Evaluation] LLM judge failed:', errorMsg);
      
      // Handle error based on configuration
      const errorStrategy = context.llmJudgeConfig.on_error || 'skip';
      
      if (errorStrategy === 'fail') {
        throw new Error(`LLM judge failed: ${errorMsg}`);
      } else if (errorStrategy === 'retry') {
        // Retry logic handled in runLLMJudge()
        console.warn('[Evaluation] LLM judge failed, continuing with rule-based only');
      } else {
        // 'skip' - continue without LLM judgments
        console.warn('[Evaluation] LLM judge failed, continuing with rule-based only');
      }
    }
  }

  // 4. Save all judgments
  console.log('[Evaluation] Saving', judgments.length, 'judgment records');

  const { error } = await supabase.from('judgments').insert(judgments);

  if (error) {
    console.error('[Evaluation] Failed to save judgments:', error);
  } else {
    console.log('[Evaluation] Saved', judgments.length, 'judgments successfully');
  }
}

/**
 * NEW: Run LLM judge evaluation
 * Returns judgment records compatible with database schema
 */
async function runLLMJudge(context: EvaluationContext): Promise<JudgmentRecord[]> {
  // Validate API keys
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('LLM judge requires OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  const config = context.llmJudgeConfig!;
  const maxRetries = config.max_retries || 3;
  const shouldRetry = config.on_error === 'retry';

  // Prepare criteria
  let criteria = STANDARD_CRITERIA;
  if (config.criteria && config.criteria.length > 0) {
    criteria = STANDARD_CRITERIA.filter(c => config.criteria!.includes(c.name));
  }

  // Initialize judge
  const judgeModel = config.judge_model || 'gpt-4-turbo';
  const judge = new LLMJudge(judgeModel);

  // Attempt evaluation with retry logic
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[LLM Judge] Attempt ${attempt}/${maxRetries} for message ${context.messageId}`);

      // Call judge
      const results: LLMJudgmentResult[] = await judge.judgeMessage({
        message_id: context.messageId,
        message_content: context.response,
        context: `Prompt: ${context.prompt}`,
        criteria,
        judge_model: judgeModel
      });

      // Convert to judgment records
      const judgments: JudgmentRecord[] = results.map(result => ({
        message_id: context.messageId,
        judge_type: 'llm' as const,
        judge_name: result.judge_model,
        criterion: result.criterion,
        score: result.score / 10, // Normalize 1-10 to 0-1
        passed: result.passed,
        benchmark_id: context.benchmarkId || null,
        evidence_json: {
          reasoning: result.reasoning,
          confidence: result.confidence,
          positive_aspects: result.evidence.positive_aspects,
          negative_aspects: result.evidence.negative_aspects,
          improvement_suggestions: result.evidence.improvement_suggestions
        }
      }));

      console.log(`[LLM Judge] Success on attempt ${attempt}`);
      return judgments;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[LLM Judge] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (!shouldRetry || attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`[LLM Judge] Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  // All retries exhausted
  throw lastError || new Error('LLM judge failed after retries');
}

/**
 * Calculate basic quality score (0-1)
 * Based on heuristics like length, structure, etc.
 */
function calculateBasicQualityScore(response: string): number {
  let score = 0.5; // Start at neutral

  // Length check
  if (response.length > 50) score += 0.1;
  if (response.length > 200) score += 0.1;

  // Structure checks
  if (response.includes('\n')) score += 0.05; // Multi-line
  if (response.includes('```')) score += 0.1; // Code block
  if (response.match(/\n[-*•]/)) score += 0.05; // Lists

  // Content quality signals
  if (response.match(/\b(because|however|therefore|specifically)\b/i)) {
    score += 0.1; // Reasoning words
  }

  // Penalize very short responses
  if (response.length < 20) score -= 0.2;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}
```

**Verification:**

- Batch tests with `llm_judge: { enabled: false }` work unchanged
- Batch tests with `llm_judge: { enabled: true }` call LLM judge
- Judgments table receives `judge_type: 'llm'` records
- Error handling logs warnings and continues on LLM failure

---

### Phase 3: API Integration & Config Propagation (2 hours)

**Goal:** Pass LLM judge config from batch API to evaluation flow
**Risk:** Low (plumbing changes, no new logic)

#### Changes Required

**File 1:** `app/api/batch-testing/run/route.ts`
**Location:** Lines 430-646 (processBackgroundBatch and processSinglePrompt)

**Action:** Propagate llm_judge config to /api/chat endpoint

**Change 1:** Pass config to processSinglePrompt

```typescript
// In processBackgroundBatch() around line 495
const success = await processSinglePrompt(
  testRunId,
  config.model_name,
  prompt,
  authHeader,
  i,
  runId,
  config.benchmark_id,
  widgetSessionId,
  config.llm_judge  // NEW: Pass LLM judge config
);
```

**Change 2:** Update processSinglePrompt signature and payload

```typescript
// Around line 576
async function processSinglePrompt(
  testRunId: string,
  modelId: string,
  prompt: string,
  authHeader: string,
  promptIndex: number,
  runId: string | null,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  llmJudgeConfig?: {  // NEW: LLM judge configuration
    enabled: boolean;
    judge_model?: string;
    criteria?: string[];
    on_error?: string;
    max_retries?: number;
  }
): Promise<boolean> {
  console.log(`[Process Prompt] ${promptIndex + 1}: Sending to /api/chat`);

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        modelId: modelId,
        widgetSessionId: widgetSessionId,
        forceNonStreaming: true,
        runId: runId,
        benchmarkId: benchmarkId,
        llmJudgeConfig: llmJudgeConfig  // NEW: Pass to chat API
      })
    });
    // ... rest of function
  }
}
```

**File 2:** `app/api/chat/route.ts`
**Location:** Around line 890 (saveBasicJudgment call)

**Action:** Extract llmJudgeConfig from request and pass to saveBasicJudgment

```typescript
// Around line 20-30, add to request body extraction
const {
  messages,
  modelId: requestModelId,
  widgetSessionId,
  forceNonStreaming,
  runId,
  benchmarkId,
  llmJudgeConfig  // NEW: Extract from request
} = body;

// Around line 890, update saveBasicJudgment call
saveBasicJudgment({
  messageId: assistantMsgData.id,
  conversationId: widgetConversationId,
  userId: userId || 'unknown',
  prompt: userPrompt,
  response: finalResponse,
  modelId: selectedModelId || 'unknown',
  provider: provider || 'unknown',
  benchmarkId: benchmarkId || undefined,
  llmJudgeConfig: llmJudgeConfig  // NEW: Pass LLM judge config
}).catch(err => {
  console.error('[API] Evaluation error (non-blocking):', err);
});
```

**Verification:**

- Config flows from batch run → processSinglePrompt → /api/chat → saveBasicJudgment
- TypeScript compilation succeeds
- Existing batch tests without llm_judge continue working

---

### Phase 4: Documentation & Testing (3 hours)

**Goal:** Document feature, add tests, provide usage examples
**Risk:** Low (non-functional changes)

#### Changes Required

**File 1:** Create `LLM_JUDGE_BATCH_USAGE.md`

```markdown
# LLM-as-Judge in Batch Testing - Usage Guide

## Overview

Batch tests can now use AI-powered evaluation (GPT-4/Claude) to assess response quality across multiple dimensions:
- **Helpfulness** - Does it address the user's request?
- **Accuracy** - Is the information correct?
- **Clarity** - Is it well-structured and easy to understand?
- **Safety** - Does it avoid harmful content?
- **Completeness** - Does it fully address all aspects?

## Configuration

### Enable LLM Judge in Batch Test

```json
{
  "model_name": "gpt-4",
  "prompt_limit": 50,
  "concurrency": 1,
  "delay_ms": 1000,
  "source_path": "datasets/test.jsonl",
  "llm_judge": {
    "enabled": true,
    "judge_model": "gpt-4-turbo",
    "criteria": ["helpfulness", "accuracy", "clarity"],
    "on_error": "skip",
    "max_retries": 3
  }
}
```

### Configuration Options

- `enabled` (boolean, required): Enable/disable LLM judge
- `judge_model` (string, optional): Judge model to use
  - Options: `gpt-4`, `gpt-4-turbo`, `claude-3-opus`, `claude-3-sonnet`
  - Default: `gpt-4-turbo`
- `criteria` (string[], optional): Which criteria to evaluate
  - Options: `helpfulness`, `accuracy`, `clarity`, `safety`, `completeness`
  - Default: All 5 criteria
- `on_error` (string, optional): Error handling strategy
  - `skip` (default): Continue without LLM judgments
  - `retry`: Retry up to max_retries times
  - `fail`: Stop batch if LLM judge fails
- `max_retries` (number, optional): Max retry attempts
  - Default: 3
  - Only used if `on_error: 'retry'`

## Cost Considerations

LLM judge uses paid APIs. Approximate costs per message:

- GPT-4-Turbo: ~$0.02 per message (5 criteria)
- GPT-4: ~$0.06 per message (5 criteria)
- Claude-3-Sonnet: ~$0.015 per message (5 criteria)
- Claude-3-Opus: ~$0.075 per message (5 criteria)

**Example:** 100 messages with 5 criteria using GPT-4-Turbo = ~$2.00

**Tip:** Test with small batches first, then scale up.

## API Requirements

Set environment variables:

```bash
OPENAI_API_KEY=sk-...           # Required for GPT models
ANTHROPIC_API_KEY=sk-ant-...    # Required for Claude models
```

## Querying Results

LLM judgments are saved with `judge_type: 'llm'`:

```sql
-- Get LLM judgments for a message
SELECT * FROM judgments
WHERE message_id = 'msg-123'
AND judge_type = 'llm';

-- Compare rule-based vs LLM judgments
SELECT 
  judge_type,
  AVG(score) as avg_score,
  COUNT(*) as total_judgments
FROM judgments
WHERE message_id IN (
  SELECT id FROM messages 
  WHERE conversation_id = 'conv-123'
)
GROUP BY judge_type;
```

## Examples

### Example 1: Full Evaluation

```json
{
  "llm_judge": {
    "enabled": true
  }
}
```

Evaluates all 5 criteria with default settings.

### Example 2: Custom Criteria

```json
{
  "llm_judge": {
    "enabled": true,
    "criteria": ["helpfulness", "accuracy"]
  }
}
```

Only evaluates helpfulness and accuracy (lower cost).

### Example 3: Production Settings

```json
{
  "llm_judge": {
    "enabled": true,
    "judge_model": "gpt-4-turbo",
    "on_error": "retry",
    "max_retries": 3
  }
}
```

Robust configuration with retry logic.

```

**File 2:** Update `PREDICTIONS_FEATURE_PROGRESS.md` with Session 3

**Action:** Append new session documenting LLM judge integration

**File 3:** Create integration tests

**Location:** `__tests__/lib/batch-testing/llm-judge-integration.test.ts`

```typescript
import { saveBasicJudgment } from '@/lib/batch-testing/evaluation-integration';
import { LLMJudge } from '@/lib/evaluation/llm-judge';

jest.mock('@/lib/evaluation/llm-judge');

describe('LLM Judge Batch Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip LLM judge when disabled', async () => {
    const context = {
      messageId: 'msg-123',
      conversationId: 'conv-123',
      userId: 'user-123',
      prompt: 'Test prompt',
      response: 'Test response',
      modelId: 'gpt-4',
      provider: 'openai',
      llmJudgeConfig: { enabled: false }
    };

    await saveBasicJudgment(context);

    expect(LLMJudge).not.toHaveBeenCalled();
  });

  it('should call LLM judge when enabled', async () => {
    const mockJudge = {
      judgeMessage: jest.fn().mockResolvedValue([
        {
          message_id: 'msg-123',
          criterion: 'helpfulness',
          score: 8,
          passed: true,
          reasoning: 'Good response',
          judge_model: 'gpt-4-turbo',
          confidence: 0.85,
          evidence: {
            positive_aspects: ['Clear'],
            negative_aspects: [],
            improvement_suggestions: []
          }
        }
      ])
    };

    (LLMJudge as jest.Mock).mockImplementation(() => mockJudge);

    const context = {
      messageId: 'msg-123',
      conversationId: 'conv-123',
      userId: 'user-123',
      prompt: 'Test prompt',
      response: 'Test response',
      modelId: 'gpt-4',
      provider: 'openai',
      llmJudgeConfig: {
        enabled: true,
        judge_model: 'gpt-4-turbo'
      }
    };

    await saveBasicJudgment(context);

    expect(LLMJudge).toHaveBeenCalledWith('gpt-4-turbo');
    expect(mockJudge.judgeMessage).toHaveBeenCalled();
  });

  it('should handle LLM judge errors gracefully', async () => {
    const mockJudge = {
      judgeMessage: jest.fn().mockRejectedValue(new Error('API error'))
    };

    (LLMJudge as jest.Mock).mockImplementation(() => mockJudge);

    const context = {
      messageId: 'msg-123',
      conversationId: 'conv-123',
      userId: 'user-123',
      prompt: 'Test prompt',
      response: 'Test response',
      modelId: 'gpt-4',
      provider: 'openai',
      llmJudgeConfig: {
        enabled: true,
        on_error: 'skip'
      }
    };

    // Should not throw
    await expect(saveBasicJudgment(context)).resolves.not.toThrow();
  });
});
```

**Verification:**

- Documentation is clear and accurate
- Tests pass and cover main scenarios
- Usage examples work as documented

---

## Affected Files Summary

### Files Modified (6 files)

1. **`lib/batch-testing/types.ts`**
   - Add llm_judge config to BatchTestConfig interface
   - Lines 24-36
   - Risk: Low (type-only change)

2. **`lib/batch-testing/evaluation-integration.ts`**
   - Add llm_judge config to EvaluationContext interface
   - Implement runLLMJudge() function
   - Update saveBasicJudgment() to call LLM judge when enabled
   - Lines 1-120 (entire file)
   - Risk: Medium (core evaluation logic)

3. **`app/api/batch-testing/run/route.ts`**
   - Pass llm_judge config to processSinglePrompt()
   - Update processSinglePrompt() signature
   - Pass llm_judge config to /api/chat
   - Lines 430-646
   - Risk: Low (plumbing only)

4. **`app/api/chat/route.ts`**
   - Extract llmJudgeConfig from request body
   - Pass llmJudgeConfig to saveBasicJudgment()
   - Lines 20-30, 890
   - Risk: Low (parameter passing)

5. **`PREDICTIONS_FEATURE_PROGRESS.md`**
   - Add Session 3 documenting LLM judge integration
   - Append to end of file
   - Risk: None (documentation)

6. **`__tests__/lib/batch-testing/llm-judge-integration.test.ts`**
   - Create new test file
   - Risk: None (tests only)

### Files Read (No Changes)

- `lib/evaluation/llm-judge.ts` - Existing implementation (no changes needed)
- `app/api/evaluation/judge/route.ts` - Existing API (no changes needed)
- `lib/benchmarks/validator-orchestrator.ts` - Existing validators (no changes needed)

### New Files Created (2 files)

1. `LLM_JUDGE_BATCH_INTEGRATION_PLAN.md` - This implementation plan
2. `LLM_JUDGE_BATCH_USAGE.md` - User-facing documentation

---

## Breaking Changes Analysis

### ✅ No Breaking Changes

**Why:**

1. **Optional Config** - `llm_judge` is optional in BatchTestConfig
2. **Backward Compatible** - Existing tests without llm_judge work unchanged
3. **Non-Blocking** - LLM judge errors don't stop batch (default: skip)
4. **Additive** - Only adds new judgment records, doesn't modify existing ones
5. **Type-Safe** - TypeScript ensures all changes are valid

**Verification:**

- Existing batch tests run without modification
- API contracts remain unchanged (llm_judge is optional everywhere)
- Database schema unchanged (judgments table already supports judge_type: 'llm')

---

## Testing Strategy

### Phase 1 Testing

- TypeScript compilation succeeds
- Existing batch tests run without llm_judge config
- Config validation accepts llm_judge fields

### Phase 2 Testing

- Mock LLM judge in unit tests
- Verify judgment records have correct structure
- Test error handling (skip/retry/fail modes)
- Test with all standard criteria
- Test with subset of criteria

### Phase 3 Testing

- End-to-end batch test with LLM judge enabled
- Verify config flows from API → chat → evaluation
- Test with real GPT-4/Claude APIs (small batch)
- Verify judgments table receives records

### Phase 4 Testing

- Integration tests pass
- Documentation examples work
- Cost estimation is accurate

---

## Rollback Plan

### If Phase 2 Causes Issues

**Immediate Rollback:**

```bash
git revert <commit-hash>
```

**Graceful Degradation:**

- Set `on_error: 'skip'` by default
- LLM judge failures won't affect batch completion
- Rule-based judgments still saved

### If Performance is Unacceptable

**Mitigation Options:**

1. Reduce criteria count (use 2-3 instead of 5)
2. Use faster model (gpt-4-turbo instead of gpt-4)
3. Add Phase 2 Option B (parallel processing after batch)

---

## Cost Analysis

### Per-Message Cost (5 Criteria)

| Judge Model | Cost per Message | Cost per 100 Messages | Cost per 1000 Messages |
|------------|------------------|----------------------|----------------------|
| GPT-4-Turbo | $0.02 | $2.00 | $20.00 |
| GPT-4 | $0.06 | $6.00 | $60.00 |
| Claude-3-Sonnet | $0.015 | $1.50 | $15.00 |
| Claude-3-Opus | $0.075 | $7.50 | $75.00 |

### Reducing Costs

**Option 1:** Use fewer criteria (2-3 instead of 5)

- 3 criteria = ~60% of full cost
- Still provides meaningful evaluation

**Option 2:** Evaluate sample only (10-20% of responses)

- Get statistical signal without full coverage
- Useful for large batches (1000+ messages)

**Option 3:** Use Claude-3-Sonnet (cheapest quality option)

- 25% cheaper than GPT-4-Turbo
- Comparable quality for most use cases

---

## Success Criteria

### Phase 1 Complete

- ✅ BatchTestConfig interface updated with llm_judge field
- ✅ TypeScript compilation succeeds
- ✅ Existing tests run without modification

### Phase 2 Complete

- ✅ LLM judge called when enabled
- ✅ Judgments saved with judge_type: 'llm'
- ✅ Error handling works (skip/retry/fail modes)
- ✅ No performance regression for batches without LLM judge

### Phase 3 Complete

- ✅ Config flows from API to evaluation
- ✅ End-to-end batch test with LLM judge succeeds
- ✅ Judgments table populated correctly

### Phase 4 Complete

- ✅ Documentation clear and accurate
- ✅ Integration tests pass
- ✅ Usage examples work
- ✅ Cost estimation verified

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Config | 2 hours | None |
| Phase 2: Integration | 3 hours | Phase 1 |
| Phase 3: API Plumbing | 2 hours | Phase 2 |
| Phase 4: Documentation | 3 hours | Phase 3 |
| **Total** | **10 hours** | |

**Suggested Schedule:**

- Day 1 Morning: Phase 1 (Config)
- Day 1 Afternoon: Phase 2 (Integration)
- Day 2 Morning: Phase 3 (API Plumbing)
- Day 2 Afternoon: Phase 4 (Documentation & Testing)

---

## Questions for Approval

1. **Cost Control:** Do you want a cost estimator in the UI before running batch with LLM judge?

2. **Default Behavior:** Should LLM judge be opt-in (disabled by default) or opt-out (enabled by default)?

3. **Criteria Selection:** Phase 1 uses all 5 criteria. Should we implement configurable criteria immediately or in Phase 2?

4. **Error Strategy:** Is `on_error: 'skip'` the right default, or should we default to `'retry'`?

5. **Judge Model:** Should we default to `gpt-4-turbo` (faster, cheaper) or `claude-3-sonnet` (cheapest)?

6. **Sampling:** Should we add a `sample_rate` option to evaluate only X% of messages (cost optimization)?

**Awaiting your approval to proceed with implementation.**
