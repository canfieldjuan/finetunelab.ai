# LLM-as-a-Judge Fixes - Implementation Plan

**Date Created:** 2025-12-04
**Status:** PENDING APPROVAL
**Risk Level:** LOW
**Estimated Time:** 2-3 hours

---

## Summary

Audit identified 3 issues in LLM-as-a-Judge implementation:
1. **CRITICAL:** Batch error handling uses `Promise.all` (fails entire batch on single error)
2. **CRITICAL:** Missing API key validation (cryptic runtime errors)
3. **MEDIUM:** Redundant nested database query (performance issue)

All fixes are isolated to 2 files with no breaking changes.

---

## Phase 1: Batch Error Handling Fix

### Current Code Location
**File:** `lib/evaluation/llm-judge.ts`
**Lines:** 296-317
**Method:** `async batchJudge()`

### Current Implementation
```typescript
async batchJudge(requests: LLMJudgmentRequest[]): Promise<Map<string, LLMJudgmentResult[]>> {
  const results = new Map<string, LLMJudgmentResult[]>();
  const concurrencyLimit = 5;
  const chunks = this.chunkArray(requests, concurrencyLimit);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map((req) => this.judgeMessage(req))  // ❌ Fails entire batch on error
    );

    chunk.forEach((req, idx) => {
      results.set(req.message_id, chunkResults[idx]);
    });
  }

  return results;
}
```

### Problem
- `Promise.all` rejects if ANY promise in chunk fails
- Partial results are lost
- All-or-nothing behavior not acceptable for evaluations

### Proposed Fix
Replace `Promise.all` with `Promise.allSettled`:

```typescript
async batchJudge(requests: LLMJudgmentRequest[]): Promise<Map<string, LLMJudgmentResult[]>> {
  const results = new Map<string, LLMJudgmentResult[]>();
  const concurrencyLimit = 5;
  const chunks = this.chunkArray(requests, concurrencyLimit);

  for (const chunk of chunks) {
    // Use Promise.allSettled to handle partial failures
    const chunkResults = await Promise.allSettled(
      chunk.map((req) => this.judgeMessage(req))
    );

    chunk.forEach((req, idx) => {
      const result = chunkResults[idx];

      if (result.status === 'fulfilled') {
        results.set(req.message_id, result.value);
      } else {
        // Log error but return error judgments instead of failing
        console.error(`[LLMJudge] Failed evaluation for ${req.message_id}:`, result.reason);

        // Return error judgments for all criteria
        const errorJudgments: LLMJudgmentResult[] = req.criteria.map(criterion => ({
          message_id: req.message_id,
          criterion: criterion.name,
          score: 0,
          passed: false,
          reasoning: `Evaluation failed: ${result.reason}`,
          judge_model: req.judge_model || this.defaultModel,
          confidence: 0,
          evidence: {
            positive_aspects: [],
            negative_aspects: ['Evaluation system error'],
            improvement_suggestions: ['Retry evaluation or check API configuration']
          }
        }));

        results.set(req.message_id, errorJudgments);
      }
    });
  }

  return results;
}
```

### Verification Steps
1. ✅ Read current code (lines 296-317)
2. ✅ Verify `judgeMessage()` returns `Promise<LLMJudgmentResult[]>`
3. ✅ Check that `req.criteria` is available in scope
4. ✅ Verify no other code depends on Promise.all behavior
5. ⏳ Test with mock: 10 requests, simulate 3 failures, expect 7 success + 3 errors
6. ⏳ Verify error judgments have correct structure

### Files Affected
- **ONLY:** `lib/evaluation/llm-judge.ts` (lines 296-317)
- **Callers:** `app/api/evaluation/judge/route.ts:193` (already handles Map correctly)

### Breaking Changes
**NONE** - Return type unchanged, just graceful degradation

---

## Phase 2: API Key Validation

### Current Code Location
**File:** `lib/evaluation/llm-judge.ts`
**Lines:** 48-56 (constructor), 121-156 (judgeSingleCriterion)

### Current Implementation
```typescript
constructor(defaultModel: string = 'gpt-4-turbo') {
  this.defaultModel = defaultModel;
  this.openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,  // ❌ No validation
  });
  this.anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,  // ❌ No validation
  });
}

private async judgeSingleCriterion(..., model: string): Promise<...> {
  // No validation before using SDK
  if (model.startsWith('gpt-')) {
    const response = await this.openaiClient.chat.completions.create({...});
    // ❌ Fails here if OPENAI_API_KEY missing
  }
}
```

### Problem
- Missing API keys cause cryptic SDK errors
- No early validation
- Poor user experience

### Proposed Fix

**Step 1:** Add validation method
```typescript
// Add after line 56 (after constructor)
/**
 * Validate that required API keys are configured for the model
 */
private validateApiKey(model: string): void {
  if (model.startsWith('gpt-')) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY environment variable is not configured. ' +
        'Add it to your .env file to use GPT models for evaluation.'
      );
    }
  } else if (model.startsWith('claude-')) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY environment variable is not configured. ' +
        'Add it to your .env file to use Claude models for evaluation.'
      );
    }
  } else {
    throw new Error(`Unsupported judge model: ${model}`);
  }
}
```

**Step 2:** Call validation in `judgeSingleCriterion` (before line 116)
```typescript
private async judgeSingleCriterion(
  message: string,
  context: string | undefined,
  criterion: LLMJudgeCriterion,
  model: string
): Promise<Omit<LLMJudgmentResult, 'message_id'>> {

  // Validate API key before making request
  this.validateApiKey(model);

  // Build evaluation prompt...
  const prompt = this.buildEvaluationPrompt(message, context, criterion);
  // ... rest of method
}
```

### Verification Steps
1. ✅ Read current constructor (lines 48-56)
2. ✅ Read `judgeSingleCriterion` method (lines 108-170)
3. ✅ Verify insertion point (after line 113, before line 116)
4. ⏳ Test: Unset OPENAI_API_KEY, call with gpt-4, expect clear error
5. ⏳ Test: Unset ANTHROPIC_API_KEY, call with claude-3-opus, expect clear error
6. ⏳ Test: Valid keys, verify no regression

### Files Affected
- **ONLY:** `lib/evaluation/llm-judge.ts`
  - Add new method after line 56
  - Call method at line 113 (before prompt building)

### Breaking Changes
**NONE** - Just throws earlier with better message

---

## Phase 3: Database Query Optimization

### Current Code Location
**File:** `app/api/batch-testing/run/route.ts`
**Lines:** 629-640

### Current Implementation
```typescript
// Step 2: If judge is enabled, fetch the message ID and evaluate
if (judgeConfig?.enabled && judgeConfig.criteria.length > 0) {
  // Fetch the most recent assistant message from this conversation
  const { data: recentMessage } = await createClient(supabaseUrl, supabaseServiceKey)
    .from('messages')
    .select('id')
    .eq('conversation_id', (await createClient(supabaseUrl, supabaseServiceKey)
      .from('conversations')
      .select('id')
      .eq('widget_session_id', widgetSessionId)
      .single()).data?.id)  // ❌ Nested query is redundant!
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
```

### Problem
- Line 489 already has `conversation.id` available
- Nested query adds extra DB roundtrip per evaluation
- Performance penalty at scale

### Context Verification
Looking at parent scope (processPrompt function):
- Line 459-474: Conversation is pre-created
- Line 489: `conversation.id` is logged (available in scope)
- Line 632-636: This query runs inside same function

**BUT WAIT** - Let me check the function signature:

**Line 588-593:**
```typescript
async function processPrompt(
  prompt: string,
  promptIndex: number,
  modelId: string,
  authHeader: string,
  runId: string,
  testRunId: string,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  judgeConfig?: { enabled: boolean; model: string; criteria: string[] }
): Promise<boolean>
```

The function does NOT receive `conversation.id` as parameter!
It's created in parent scope (runBatchTestInBackground) but not passed down.

### Revised Analysis
Actually, the nested query IS necessary because:
1. `processPrompt()` doesn't have access to `conversation.id`
2. Only has `widgetSessionId` to work with
3. Must query conversations table to get conversation_id

### Alternative Fix
**Option A:** Pass `conversation.id` as parameter (BREAKING)
**Option B:** Keep current implementation (NOT BROKEN)
**Option C:** Simplify query (BETTER)

### Proposed Fix (Option C)
The nested query can be simplified to a JOIN or two separate queries:

```typescript
// CURRENT: Nested query (lines 632-636)
.eq('conversation_id', (await createClient(supabaseUrl, supabaseServiceKey)
  .from('conversations')
  .select('id')
  .eq('widget_session_id', widgetSessionId)
  .single()).data?.id)

// PROPOSED: Separate query with better error handling
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// First, get conversation ID
const { data: conv } = await supabase
  .from('conversations')
  .select('id')
  .eq('widget_session_id', widgetSessionId)
  .single();

if (!conv) {
  console.error(`[Process Prompt] ${promptIndex + 1}: Conversation not found for session ${widgetSessionId}`);
  return true; // Don't fail prompt
}

// Then get message
const { data: recentMessage } = await supabase
  .from('messages')
  .select('id')
  .eq('conversation_id', conv.id)
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

**Actually, even better:** The function signature SHOULD receive conversation.id

### REVISED Proposed Fix (Pass conversation.id)

**Change 1:** Update function signature (line 588)
```typescript
async function processPrompt(
  prompt: string,
  promptIndex: number,
  modelId: string,
  authHeader: string,
  runId: string,
  testRunId: string,
  benchmarkId: string | undefined,
  widgetSessionId: string,
  conversationId: string,  // ADD THIS
  judgeConfig?: { enabled: boolean; model: string; criteria: string[] }
): Promise<boolean>
```

**Change 2:** Update function call (line 507)
```typescript
const success = await processPrompt(
  prompt,
  i,
  config.model_name,
  authHeader,
  runId,
  testRunId,
  config.benchmark_id,
  widgetSessionId,
  conversation.id,  // ADD THIS
  config.judge_config
);
```

**Change 3:** Simplify query (lines 629-640)
```typescript
const { data: recentMessage } = await createClient(supabaseUrl, supabaseServiceKey)
  .from('messages')
  .select('id')
  .eq('conversation_id', conversationId)  // USE PARAMETER
  .eq('role', 'assistant')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

### Verification Steps
1. ✅ Read function signature (line 588-593)
2. ✅ Read function call site (line 499-510)
3. ✅ Verify `conversation.id` is available at call site (line 489)
4. ✅ Find all calls to `processPrompt()` (only one found)
5. ⏳ Test: Run batch test, verify conversation_id is correct
6. ⏳ Verify no regression in message fetching

### Files Affected
- **ONLY:** `app/api/batch-testing/run/route.ts`
  - Line 588: Add `conversationId: string` parameter
  - Line 507: Pass `conversation.id` argument
  - Lines 632-636: Replace nested query with simple param

### Breaking Changes
**NONE** - Internal function, no external API changes

---

## Impact Assessment

### Files Modified
1. `lib/evaluation/llm-judge.ts` (Phases 1 & 2)
2. `app/api/batch-testing/run/route.ts` (Phase 3)

### Callers of Modified Functions

**`batchJudge()`:** (Phase 1)
- Called only in: `app/api/evaluation/judge/route.ts:193`
- Impact: Returns same Map type, just handles errors better
- Breaking: NO

**`LLMJudge` constructor:** (Phase 2)
- Called in: `app/api/evaluation/judge/route.ts:123, 182`
- Impact: No signature change, just adds validation
- Breaking: NO

**`processPrompt()`:** (Phase 3)
- Called only in: `app/api/batch-testing/run/route.ts:499`
- Impact: Internal function, add one parameter
- Breaking: NO (internal only)

### Test Coverage Required

**Phase 1:** Batch error handling
- [ ] Test: All succeed (baseline)
- [ ] Test: 3/10 fail, verify 7 succeed + 3 error judgments
- [ ] Test: All fail, verify all return error judgments
- [ ] Test: Verify error judgment structure matches interface

**Phase 2:** API key validation
- [ ] Test: Missing OPENAI_API_KEY with gpt-4
- [ ] Test: Missing ANTHROPIC_API_KEY with claude-3
- [ ] Test: Both keys present (no regression)
- [ ] Test: Unsupported model name

**Phase 3:** Query optimization
- [ ] Test: Batch test completes successfully
- [ ] Test: Messages are evaluated correctly
- [ ] Test: No duplicate conversations created
- [ ] Test: Performance: measure query count (should reduce by 1 per eval)

---

## Implementation Order

### Step 1: Phase 2 (API Key Validation)
**Why first:** Safest, adds validation only, no logic changes

### Step 2: Phase 3 (Query Optimization)
**Why second:** Independent of Phase 1, improves performance

### Step 3: Phase 1 (Batch Error Handling)
**Why last:** Most complex, depends on understanding error cases

---

## Rollback Plan

Each phase is independent and can be reverted separately:

**Phase 1 Rollback:**
```bash
git revert <commit-hash>  # Reverts Promise.allSettled change
```

**Phase 2 Rollback:**
```bash
# Remove validateApiKey() method
# Remove validateApiKey() call
```

**Phase 3 Rollback:**
```bash
# Revert processPrompt signature
# Revert function call
# Restore nested query
```

---

## Success Criteria

- [ ] All existing tests pass
- [ ] New test coverage added for each phase
- [ ] No breaking changes to public APIs
- [ ] Performance improves (Phase 3)
- [ ] Error messages are clearer (Phase 2)
- [ ] Partial failures handled gracefully (Phase 1)
- [ ] Code review approved
- [ ] Changes documented in this file

---

## Post-Implementation

### Documentation Updates
- [ ] Update API docs with clearer error messages
- [ ] Add troubleshooting section for API key errors
- [ ] Document batch evaluation error handling

### Monitoring
- [ ] Add metrics for evaluation success/failure rates
- [ ] Track API key validation errors
- [ ] Monitor query performance improvements

---

## Approval

**Status:** PENDING

**Reviewers:**
- [ ] @user (Product Owner)
- [ ] @claude-code (Technical Review)

**Sign-off:**
- Date: __________
- Approver: __________
- Notes: __________
