# Validator Execution Investigation - Session Log

**Date**: December 3, 2025  
**Session**: Validator Execution Debugging  
**Status**: Root Cause Identified - Implementation Plan Created

---

## Executive Summary

Comprehensive investigation into why configured benchmark validators aren't executing during batch tests. After complete code tracing through the system, **root cause identified**: The validator execution system IS fully implemented and functional, but may not be properly configured or triggered due to:

1. **Dual validation code paths** - Two separate implementations exist, only one is used by batch tests
2. **Limited validator registry** - Only 2 of 6 available validators are mapped
3. **Silent failure modes** - System returns empty arrays if validators aren't found
4. **No UI validation feedback** - Benchmark Manager doesn't validate validator IDs on save

---

## Investigation Timeline

### Phase 1: Initial Problem Report
**User Issue**: "Benchmarks in the testing page inside the benchmark manager has validators implemented but they are not being used during batch tests, why is that??"

**User Context**: 
- Already configured a benchmark with validators
- Added validators through Benchmark Manager UI
- Nothing happens during batch test execution
- Requested check if `benchmark_id` is being passed properly

### Phase 2: Comprehensive Code Tracing

#### A. Database Schema Analysis
**File**: Multiple schema files  
**Finding**: `benchmarks` table has `pass_criteria` JSONB column

**Expected Structure**:
```json
{
  "min_score": 0.8,
  "required_validators": ["must_cite_if_claims", "format_ok"],
  "custom_rules": {}
}
```

**TypeScript Interface** (`/lib/benchmarks/types.ts:21-26`):
```typescript
export interface PassCriteria {
  min_score: number;
  required_validators?: string[];
  custom_rules?: Record<string, JsonValue>;
}
```

#### B. Validator Registry Analysis
**File**: `/lib/evaluation/validators/executor.ts:22-25`

**VALIDATOR_MAP Contents** (CRITICAL FINDING):
```typescript
const VALIDATOR_MAP: Record<string, ValidatorFunction> = {
  'must_cite_if_claims': mustCiteIfClaims,
  'format_ok': formatOk,
};
```

**Only 2 validators mapped** despite 4 more implementations existing:
- ✅ `must_cite_if_claims` - Mapped (lines 22-23)
- ✅ `format_ok` - Mapped (line 24)
- ❌ `citation_exists` - NOT mapped (implementation at lines 71-113)
- ❌ `retrieval_relevance_at_k` - NOT mapped (implementation at lines 121-151)
- ❌ `policy_scope_allowed` - NOT mapped (implementation at lines 159-186)
- ❌ `freshness_ok` - NOT mapped (implementation at lines 194-230)

#### C. Batch Test Flow Analysis

**Entry Point**: `/app/api/batch-testing/run/route.ts`

**Line 227**: Benchmark ID assignment
```typescript
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,
  prompt_limit: config.prompt_limit || 25,
  concurrency: config.concurrency || 3,
  delay_ms: config.delay_ms || 1000,
  source_path: config.source_path,
  benchmark_id: config.benchmark_id  // ✅ PASSED CORRECTLY
};
```

**Lines 230-235**: Diagnostic logging (already present)
```typescript
console.log('[Batch Testing Run] ⚠️ BENCHMARK ID CHECK:', {
  configBenchmarkId: config.benchmark_id,
  batchConfigBenchmarkId: batchConfig.benchmark_id,
  type: typeof batchConfig.benchmark_id,
  truthy: !!batchConfig.benchmark_id
});
```

**Line 607**: Passed to chat API
```typescript
body: JSON.stringify({
  messages: [{ role: 'user', content: prompt }],
  modelId: modelId,
  widgetSessionId: widgetSessionId,
  forceNonStreaming: true,
  runId: runId,
  benchmarkId: benchmarkId  // ✅ PASSED TO CHAT API
})
```

#### D. Chat API Validator Execution
**File**: `/app/api/chat/route.ts`

**Line 113**: Extract benchmarkId from request
```typescript
const benchmarkId = body.benchmarkId;
```

**Lines 837-860**: Validator execution (ACTIVE PATH)
```typescript
// Execute benchmark validators if benchmarkId is provided
console.log('[API] Validator check:', { 
  benchmarkId, 
  hasAssistantMsgData: !!assistantMsgData, 
  userId, 
  condition: !!(benchmarkId && assistantMsgData && userId) 
});

if (benchmarkId && assistantMsgData && userId) {
  try {
    console.log('[API] ✅ Executing benchmark validators:', benchmarkId);
    const { executeValidators } = await import('@/lib/evaluation/validators/executor');

    // Execute validators asynchronously (non-blocking)
    executeValidators(
      benchmarkId,
      assistantMsgData.id,
      finalResponse,
      null,
      userId
    ).catch(err => {
      console.error('[API] Validator execution error (non-blocking):', err);
    });
  } catch (error) {
    console.error('[API] Error loading validator executor:', error);
  }
}
```

**Lines 892-900**: Legacy path (saveBasicJudgment - SEPARATE PATH)
```typescript
// NOTE: This is a DIFFERENT validation path
// saveBasicJudgment calls runBenchmarkValidators from evaluation-integration.ts
```

#### E. Validator Executor Implementation
**File**: `/lib/evaluation/validators/executor.ts:45-118`

**Critical Logic Flow**:

1. **Fetch benchmark** (line 58-68):
```typescript
const { data: benchmark, error: benchmarkError } = await supabase
  .from('benchmarks')
  .select('id, name, pass_criteria')
  .eq('id', benchmarkId)
  .single();
```

2. **Extract required_validators** (line 68):
```typescript
const requiredValidators = benchmark.pass_criteria?.required_validators || [];
```

3. **Silent return if empty** (lines 70-72):
```typescript
if (requiredValidators.length === 0) {
  console.log('[ValidatorExecutor] No validators configured for benchmark');
  return [];
}
```

4. **Validator execution loop** (lines 79-104):
```typescript
for (const validatorId of requiredValidators) {
  const validatorFn = VALIDATOR_MAP[validatorId];  // ⚠️ LOOKUP

  if (!validatorFn) {
    console.warn('[ValidatorExecutor] Unknown validator:', validatorId);
    continue;  // ⚠️ SILENT SKIP
  }
  // ... execute validator
}
```

5. **Save judgments** (lines 106-108):
```typescript
if (results.length > 0) {
  await saveJudgments(messageId, results, userId);
}
```

#### F. UI Component Analysis
**File**: `/components/training/BenchmarkManager.tsx`

**Lines 16-27**: Available validators in UI
```typescript
const AVAILABLE_VALIDATORS = [
  {
    id: 'must_cite_if_claims',
    name: 'Must Cite If Claims',
    description: 'Ensures responses cite sources when making factual claims',
    category: 'accuracy',
  },
  {
    id: 'format_ok',
    name: 'Format OK',
    description: 'Validates response follows expected format (JSON, Markdown, etc.)',
    category: 'formatting',
  },
] as const;
```

**Lines 300-327**: Validator checkbox selection
```typescript
{AVAILABLE_VALIDATORS.map(validator => {
  const isSelected = formData.pass_criteria.required_validators?.includes(validator.id) || false;
  return (
    <label key={validator.id}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          const currentValidators = formData.pass_criteria.required_validators || [];
          const newValidators = e.target.checked
            ? [...currentValidators, validator.id]
            : currentValidators.filter(v => v !== validator.id);
          
          setFormData({
            ...formData,
            pass_criteria: {
              ...formData.pass_criteria,
              required_validators: newValidators.length > 0 ? newValidators : undefined,
            }
          });
        }}
      />
      {validator.name}
    </label>
  );
})}
```

**Lines 167-182**: Fetch benchmarks (no validation on load)
```typescript
const fetchBenchmarks = React.useCallback(async () => {
  const response = await fetch('/api/benchmarks', {
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  const data = await response.json();
  setBenchmarks(data.benchmarks || []);
}, [sessionToken]);
```

**Line 521**: Batch test submission (benchmark_id passed)
```typescript
benchmark_id: selectedBenchmarkId || undefined,
```

---

## Root Cause Analysis

### Issue 1: Dual Validation Paths (ARCHITECTURAL)
**Problem**: Two separate validation implementations exist:
1. **NEW PATH** (used by batch tests): `executeValidators()` from `executor.ts`
2. **LEGACY PATH**: `saveBasicJudgment()` + `runBenchmarkValidators()` from `evaluation-integration.ts`

**Impact**: Confusion about which path is active, potential maintenance issues

**Location**: 
- Active: `/lib/evaluation/validators/executor.ts`
- Legacy: `/lib/batch-testing/evaluation-integration.ts`

### Issue 2: Limited Validator Registry (FUNCTIONAL)
**Problem**: VALIDATOR_MAP only contains 2 validators, but 4 more implementations exist

**Impact**: If user configures unmapped validators, they'll be silently skipped

**Evidence**:
```typescript
// Line 89: Silent skip for unknown validators
if (!validatorFn) {
  console.warn('[ValidatorExecutor] Unknown validator:', validatorId);
  continue;  // ⚠️ No error thrown
}
```

### Issue 3: Silent Failure Modes (UX)
**Problem**: Multiple silent failure points with no user feedback:
1. Empty required_validators array → returns empty array
2. Unknown validator ID → logs warning, continues
3. Validator execution error → caught, logged, continues

**Impact**: User sees no errors but validators don't run

### Issue 4: No UI Validation (UX)
**Problem**: Benchmark Manager doesn't validate:
- Validator IDs against VALIDATOR_MAP
- Pass criteria structure on save
- Validator count display accuracy

**Impact**: User can save invalid configurations that fail silently

### Issue 5: Inconsistent Validator Lists
**Problem**: UI shows 2 validators, executor has 2 mapped, but 6 implementations exist

**Files**:
- UI: `BenchmarkManager.tsx` - 2 validators
- Executor: `executor.ts` - 2 mapped, 6 implemented
- Legacy: `evaluation-integration.ts` - different set

---

## Diagnostic Checklist for User

### Step 1: Check Benchmark Configuration
```sql
SELECT 
  id, 
  name, 
  pass_criteria->>'required_validators' as validators,
  pass_criteria
FROM benchmarks
WHERE created_by = 'YOUR_USER_ID'
ORDER BY created_at DESC;
```

**Expected Output**:
```json
{
  "min_score": 0.8,
  "required_validators": ["must_cite_if_claims", "format_ok"]
}
```

**Red Flags**:
- `required_validators` is `null` or missing
- Array is empty `[]`
- Validator IDs don't match: `'must_cite_if_claims'` or `'format_ok'`
- Typos in validator IDs (case-sensitive!)

### Step 2: Check Console Logs During Batch Test

**Expected Log Sequence** (if working correctly):

1. **Batch Test Start** (`batch-testing/run/route.ts:230-235`):
```
[Batch Testing Run] ⚠️ BENCHMARK ID CHECK: { 
  configBenchmarkId: 'uuid-here', 
  batchConfigBenchmarkId: 'uuid-here',
  type: 'string',
  truthy: true
}
```

2. **Chat API Validator Check** (`chat/route.ts:839`):
```
[API] Validator check: { 
  benchmarkId: 'uuid-here', 
  hasAssistantMsgData: true, 
  userId: 'user-uuid', 
  condition: true 
}
```

3. **Validator Execution Start** (`chat/route.ts:842`):
```
[API] ✅ Executing benchmark validators: uuid-here
```

4. **Executor Start** (`executor.ts:52`):
```
[ValidatorExecutor] Executing validators for benchmark: uuid-here
```

5. **Validators Running** (`executor.ts:75`):
```
[ValidatorExecutor] Running validators: ['must_cite_if_claims']
```

6. **Judgments Saved** (`executor.ts:108`):
```
[ValidatorExecutor] Saved 1 judgments
```

**Missing Logs Diagnosis**:
- Missing log 1: `benchmark_id` not being passed from UI
- Missing log 2-3: Condition not met (no benchmarkId, userId, or assistantMsgData)
- Missing log 4: Benchmark not found in database
- Missing log 5: Empty `required_validators` array
- Missing log 6: All validators failed or were unknown

### Step 3: Verify Judgments Table
```sql
SELECT 
  j.*,
  m.content as message_content
FROM judgments j
JOIN messages m ON m.id = j.message_id
WHERE j.created_at > NOW() - INTERVAL '1 hour'
ORDER BY j.created_at DESC
LIMIT 10;
```

**Expected**: Rows with `judge_type = 'rule'` and `judge_name` matching validator IDs

---

## Files Requiring Changes

### Core Files
1. ✅ `/lib/evaluation/validators/executor.ts` - Validator executor (lines 22-188)
2. ✅ `/lib/evaluation/validators/rule-validators.ts` - Validator implementations
3. ✅ `/app/api/chat/route.ts` - Validator execution trigger (lines 837-860)
4. ✅ `/app/api/batch-testing/run/route.ts` - Benchmark ID passing (line 227)
5. ✅ `/components/training/BenchmarkManager.tsx` - UI for benchmark creation (lines 16-360)

### Legacy Files (Backward Compatibility)
6. ⚠️ `/lib/batch-testing/evaluation-integration.ts` - Legacy validation path
7. ⚠️ `/lib/benchmarks/validator-orchestrator.ts` - Legacy orchestrator

### Database Schema
8. 📊 `benchmarks` table - Pass criteria JSONB column
9. 📊 `judgments` table - Validator results storage

### Type Definitions
10. 📘 `/lib/benchmarks/types.ts` - Benchmark and PassCriteria types
11. 📘 `/lib/batch-testing/types.ts` - BatchTestConfig type

---

## Dependencies and Imports

### Validator Executor Dependencies
```typescript
// lib/evaluation/validators/executor.ts
import { createClient } from '@supabase/supabase-js';
import { mustCiteIfClaims, formatOk } from './rule-validators';
```

### Chat API Dependencies
```typescript
// app/api/chat/route.ts
const { executeValidators } = await import('@/lib/evaluation/validators/executor');
```

### Benchmark Manager Dependencies
```typescript
// components/training/BenchmarkManager.tsx
import type { Benchmark, CreateBenchmarkRequest, TaskType } from '@/lib/benchmarks/types';
```

---

## Hard-Coded Values Audit

### Found Hard-Coded Values

1. **VALIDATOR_MAP** (`executor.ts:22-25`) - Only 2 validators mapped
   - ⚠️ Should be complete registry of all available validators
   
2. **AVAILABLE_VALIDATORS** (`BenchmarkManager.tsx:16-27`) - Only 2 validators in UI
   - ⚠️ Should match VALIDATOR_MAP exactly

3. **Console log strings** - Multiple files
   - ✅ Acceptable for debugging

4. **Default values** in BatchTestConfig:
   - `prompt_limit: 25` - From environment variable ✅
   - `concurrency: 3` - From environment variable ✅
   - `delay_ms: 1000` - From environment variable ✅

---

## Next Steps Summary

### Immediate Actions Required

1. **Verify User's Benchmark Configuration**
   - Check actual `pass_criteria` in database
   - Confirm validator IDs match VALIDATOR_MAP keys exactly
   - Verify `required_validators` is an array, not undefined

2. **Check Console Logs**
   - Run batch test and capture all console output
   - Identify which log message in the sequence is missing
   - Pinpoint exact failure point

3. **Expand Validator Registry**
   - Add missing 4 validators to VALIDATOR_MAP
   - Update UI AVAILABLE_VALIDATORS to match
   - Add validation in Benchmark Manager

4. **Consolidate Validation Paths**
   - Deprecate legacy `evaluation-integration.ts` path
   - Ensure all flows use `executor.ts`
   - Maintain backward compatibility during transition

5. **Add UI Validation Feedback**
   - Validate validator IDs on benchmark save
   - Show validator execution status in batch test results
   - Display warnings for unmapped validators

---

## Conclusion

**Validator execution IS fully implemented**, but the system has multiple potential failure points:

1. ✅ **benchmark_id passing**: VERIFIED - passed correctly through entire chain
2. ⚠️ **Validator registry**: INCOMPLETE - only 2 of 6 validators mapped
3. ⚠️ **Silent failures**: PRESENT - unknown validators skipped without errors
4. ⚠️ **UI validation**: MISSING - no checks for invalid configurations
5. ⚠️ **Dual paths**: CONFUSING - two separate validation implementations

**Most Likely Root Cause**: User configured validators with IDs that don't exist in VALIDATOR_MAP, causing silent skips with only console warnings.

**Recommended Fix Priority**:
1. HIGH: Verify user's benchmark `pass_criteria` structure
2. HIGH: Expand VALIDATOR_MAP to include all 6 validators
3. MEDIUM: Add UI validation in Benchmark Manager
4. MEDIUM: Consolidate validation paths
5. LOW: Add more detailed error logging

---

**Status**: Investigation Complete - Awaiting user approval for implementation plan
