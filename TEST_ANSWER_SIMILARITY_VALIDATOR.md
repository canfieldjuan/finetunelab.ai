# Answer Similarity Validator - Test Plan

## Test Date: December 3, 2025

## Purpose
Verify the answer_similarity validator works correctly and integrates with the validation system.

---

## Prerequisites

1. **Run SQL Migration** (CRITICAL - DO THIS FIRST!)
   ```
   Go to Supabase Dashboard -> SQL Editor
   Paste contents of: MIGRATION_ADD_EXPECTED_ANSWERS.sql
   Click RUN
   Expected result: "Migration successful: expected_answers column added to test_suites"
   ```

2. **Verify Files Modified**
   - ✅ `lib/evaluation/validators/validator-context.ts` - Created
   - ✅ `lib/evaluation/validators/rule-validators.ts` - Added answerSimilarity() and VALIDATORS_V2.answer_similarity
   - ✅ `lib/evaluation/validators/executor.ts` - Added 'answer_similarity' to VALIDATOR_MAP
   - ✅ `lib/batch-testing/types.ts` - Added TestSuite interface with expected_answers
   - ✅ `app/api/test-suites/route.ts` - Updated POST to accept expected_answers

---

## Test 1: Unit Test - answerSimilarity Function

### Test Cases

#### 1.1 Exact Match (After Normalization)
```typescript
const result = answerSimilarity(
  "MLflow setup takes 50 engineering hours.",
  "mlflow setup takes 50 engineering hours",
  0.7
);

Expected:
- passed: true
- score: 1.0
- message: "Exact match with expected answer"
- evidence.matchType: "exact"
```

#### 1.2 High Similarity (Above Threshold)
```typescript
const result = answerSimilarity(
  "MLflow setup reportedly takes about 50 engineering hours to configure",
  "MLflow setup takes 50 engineering hours",
  0.7
);

Expected:
- passed: true
- score: >= 0.7
- message: "Answer similarity: XX.X%"
- evidence.matchType: "token_overlap"
```

#### 1.3 Low Similarity (Below Threshold)
```typescript
const result = answerSimilarity(
  "FineTune Lab is much faster to set up",
  "MLflow setup takes 50 engineering hours",
  0.7
);

Expected:
- passed: false
- score: < 0.7
- message: "Low answer similarity: XX.X% (threshold: 70%)"
```

#### 1.4 No Expected Answer
```typescript
const result = answerSimilarity(
  "Any response text",
  "",
  0.7
);

Expected:
- passed: true
- score: 1.0
- message: "No expected answer provided - skipping validation"
- evidence.hasExpectedAnswer: false
```

---

## Test 2: Integration Test - Validator Context

### Test Case 2.1: Via VALIDATORS_V2 API

```typescript
import { VALIDATORS_V2 } from '@/lib/evaluation/validators/rule-validators';
import type { ValidatorContext } from '@/lib/evaluation/validators/validator-context';

const context: ValidatorContext = {
  responseContent: "MLflow setup takes about 50 hours",
  contentJson: {},
  userId: "test-user-123",
  messageId: "msg-123",
  expectedAnswer: "MLflow setup takes 50 engineering hours",
  validatorConfig: {
    answer_similarity: { threshold: 0.7 }
  }
};

const result = VALIDATORS_V2.answer_similarity(context);

Expected:
- passed: true (or false depending on similarity)
- score: number between 0-1
- evidence: { matchType, jaccardSimilarity, overlapPercentage, ... }
```

---

## Test 3: Database Integration

### Test Case 3.1: Create Test Suite with Expected Answers

```bash
# Using curl or Postman:
POST /api/test-suites
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "name": "Atlas Validation Set",
  "description": "25 questions with expected answers",
  "prompts": [
    "How long does it take to set up FineTune Lab vs MLflow?",
    "Does FineTune Lab work for teams already using Databricks?"
  ],
  "expected_answers": [
    "MLflow setup reportedly takes '50 engineering hours'...",
    "If your organization is deeply invested in Databricks..."
  ]
}
```

Expected Response:
```json
{
  "success": true,
  "testSuite": {
    "id": "uuid",
    "name": "Atlas Validation Set",
    "prompt_count": 2,
    "has_expected_answers": true,
    "created_at": "..."
  }
}
```

### Test Case 3.2: Verify Data in Supabase

```sql
SELECT
  id,
  name,
  prompt_count,
  jsonb_array_length(prompts) as prompts_length,
  jsonb_array_length(expected_answers) as answers_length
FROM test_suites
WHERE name = 'Atlas Validation Set';
```

Expected:
- prompts_length = 2
- answers_length = 2

---

## Test 4: End-to-End Validation Flow

### Setup
1. Create a benchmark that uses `answer_similarity` validator
2. Configure benchmark `pass_criteria`:
```json
{
  "required_validators": ["answer_similarity"],
  "custom_rules": {
    "answer_similarity": { "threshold": 0.7 }
  }
}
```

### Test Case 4.1: Run Chat with Validation

```typescript
// In chat API (app/api/chat/route.ts), after getting response:

executeValidators(
  benchmarkId,
  messageId,
  llmResponse,  // e.g., "MLflow takes about 50 hours to set up"
  null,
  userId
);
```

**Expected Flow:**
1. Executor fetches benchmark config
2. Sees `answer_similarity` in required_validators
3. Builds ValidatorContext with:
   - responseContent: LLM response
   - expectedAnswer: (fetched from test_suite)
   - threshold: 0.7 (from custom_rules)
4. Calls VALIDATORS_V2.answer_similarity(context)
5. Saves judgment to database

**Verify in judgments table:**
```sql
SELECT
  message_id,
  judge_type,
  judge_name,
  criterion,
  score,
  passed,
  evidence_json,
  notes
FROM judgments
WHERE message_id = 'your-message-id'
  AND criterion = 'answer_similarity';
```

Expected record:
```
judge_type: 'rule'
judge_name: 'Answer Similarity'
criterion: 'answer_similarity'
score: 0.XX (between 0-1)
passed: true/false
evidence_json: { matchType, jaccardSimilarity, ... }
notes: "Answer similarity: XX.X%"
```

---

## Test 5: Error Handling

### Test Case 5.1: Mismatched Array Lengths

```bash
POST /api/test-suites
{
  "name": "Bad Suite",
  "prompts": ["Q1", "Q2", "Q3"],
  "expected_answers": ["A1", "A2"]  // Only 2 answers for 3 prompts
}
```

Expected Response:
```json
{
  "error": "Expected answers count (2) must match prompts count (3)"
}
```
Status: 400

---

## Success Criteria

✅ All unit tests pass
✅ Validator integrates with VALIDATORS_V2 API
✅ Test suite API accepts expected_answers
✅ Database stores expected_answers correctly
✅ Executor passes expectedAnswer in context
✅ Judgments are saved with correct scores
✅ Error handling works for invalid inputs

---

## Manual Testing Steps

1. **Run SQL migration** in Supabase Dashboard
2. **Create a simple Node script** to test answerSimilarity:
   ```typescript
   import { answerSimilarity } from '@/lib/evaluation/validators/rule-validators';

   console.log('Test 1: Exact match');
   console.log(answerSimilarity("test", "test", 0.7));

   console.log('\nTest 2: Similar');
   console.log(answerSimilarity(
     "MLflow takes 50 hours",
     "MLflow setup takes 50 engineering hours",
     0.7
   ));

   console.log('\nTest 3: Different');
   console.log(answerSimilarity(
     "FineTune Lab is fast",
     "MLflow takes 50 hours",
     0.7
   ));
   ```

3. **Create test suite via API** (use Postman/curl)
4. **Verify in Supabase** that expected_answers column exists and has data
5. **Run a chat request** with validation enabled
6. **Check judgments table** for answer_similarity records

---

## Rollback Instructions

If something goes wrong:

1. **Remove expected_answers column:**
   ```sql
   ALTER TABLE test_suites DROP COLUMN IF EXISTS expected_answers;
   ```

2. **Remove answer_similarity from VALIDATOR_MAP** in executor.ts

3. **Git revert** the changes:
   ```bash
   git diff HEAD lib/evaluation/validators/
   git diff HEAD lib/batch-testing/types.ts
   git diff HEAD app/api/test-suites/route.ts
   ```

---

## Notes

- The answer_similarity validator uses **token overlap** for fast, deterministic comparison
- It's NOT using semantic embeddings (yet) - this can be added later with Graphiti
- Threshold of 0.7 means 70% token overlap required to pass
- The validator uses the HIGHER of Jaccard similarity and overlap percentage for leniency
- Empty/missing expected_answers will PASS validation (skipped, not failed)
