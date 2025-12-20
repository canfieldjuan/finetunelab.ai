# Auto-Session-Tagging Testing Guide

**Date**: December 19, 2025  
**Purpose**: Step-by-step testing instructions for the auto-session-tagging implementation

---

## Prerequisites

### 1. Apply Database Migration

Run this in Supabase SQL Editor:

```sql
-- Add session_tag column to llm_traces
ALTER TABLE public.llm_traces
ADD COLUMN IF NOT EXISTS session_tag TEXT;

-- Create index for fast session_tag lookups
CREATE INDEX IF NOT EXISTS idx_llm_traces_session_tag
  ON public.llm_traces(session_tag)
  WHERE session_tag IS NOT NULL;

-- Create composite index for user + session_tag queries
CREATE INDEX IF NOT EXISTS idx_llm_traces_user_session
  ON public.llm_traces(user_id, session_tag)
  WHERE session_tag IS NOT NULL;

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'llm_traces' AND column_name = 'session_tag';
```

Expected result: One row showing `session_tag | text`

### 2. Verify Conversations Schema

Run this in Supabase SQL Editor:

```sql
-- Check if conversations has required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
  AND column_name IN ('session_id', 'experiment_name', 'llm_model_id')
ORDER BY column_name;
```

Expected result: Three rows showing session_id, experiment_name, and llm_model_id columns

### 3. Verify llm_models Has Data

```sql
-- Check models in registry
SELECT id, model_id, name, provider, user_id
FROM llm_models
ORDER BY created_at DESC
LIMIT 5;
```

Expected result: At least one model row with valid UUID id and model_id

---

## Test 1: Session Tag Generator Function

### Test Manually (TypeScript Playground or Node)

```typescript
import { generateSessionTag } from '@/lib/session-tagging/generator';

// Replace with real user_id and model_id from your database
const userId = 'your-user-uuid-here';
const modelId = 'gpt-4-turbo'; // Or any model_id from llm_models table

const tag = await generateSessionTag(userId, modelId);
console.log('Generated tag:', tag);
```

**Expected Output:**
```json
{
  "session_id": "chat_model_abc123_001",
  "experiment_name": "Model Display Name",
  "counter": 1,
  "model_id": "gpt-4-turbo",
  "model_name": "Model Display Name"
}
```

**Test Cases:**
1. ✅ Model exists in llm_models → Returns valid tag
2. ✅ Model doesn't exist → Returns null
3. ✅ userId is null → Returns null
4. ✅ modelId is null → Returns null
5. ✅ Second call with same model → Counter increments to 002

---

## Test 2: Trace Storage (Manual API Call)

### Using cURL or Postman

```bash
# Get your auth token first
# Then POST to traces API

curl -X POST http://localhost:3000/api/analytics/traces \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trace_id": "trace_test_001",
    "span_id": "span_test_001",
    "span_name": "test.manual",
    "operation_type": "llm_call",
    "start_time": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "session_tag": "chat_model_abc123_001",
    "status": "completed"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "trace_id": "trace_test_001",
    "session_tag": "chat_model_abc123_001",
    ...
  }
}
```

**Verify in Database:**
```sql
SELECT trace_id, session_tag, span_name
FROM llm_traces
WHERE trace_id = 'trace_test_001';
```

---

## Test 3: End-to-End Chat Flow

### Step 1: Create a Model in Models Page

1. Go to `/models` page
2. Add a new model (or use existing)
3. Note the model_id (e.g., "my-finetuned-model")

### Step 2: Manually Tag a Conversation

```sql
-- Create test conversation with session tag
INSERT INTO conversations (user_id, title, llm_model_id, session_id, experiment_name)
VALUES (
  'your-user-uuid',
  'Test Session Tag',
  'my-finetuned-model',
  'chat_model_abc123_001',
  'My Model v1'
);
```

### Step 3: Send a Message

1. Open the conversation in chat
2. Send any message
3. Wait for response

### Step 4: Check Trace Created

```sql
-- Verify trace has session_tag
SELECT 
  trace_id,
  session_tag,
  span_name,
  conversation_id,
  created_at
FROM llm_traces
WHERE conversation_id = 'your-conversation-uuid'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:**
- session_tag should be: `chat_model_abc123_001`
- Should match conversation.session_id

---

## Test 4: Counter Increment

### Scenario: Multiple Conversations with Same Model

```sql
-- Create 3 conversations with same model
-- They should get counters 001, 002, 003

-- Check counter generation
WITH numbered_convs AS (
  SELECT 
    id,
    session_id,
    created_at,
    ROW_NUMBER() OVER (ORDER BY created_at) as expected_counter
  FROM conversations
  WHERE user_id = 'your-user-uuid'
    AND llm_model_id = 'my-finetuned-model'
    AND session_id LIKE 'chat_model_%'
  ORDER BY created_at
)
SELECT 
  id,
  session_id,
  expected_counter,
  CASE 
    WHEN session_id LIKE '%_00' || expected_counter THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as validation
FROM numbered_convs;
```

---

## Test 5: Trace Search (Future)

### Once TraceExplorer UI is updated

1. Go to `/analytics/traces`
2. Enter session tag in search: `chat_model_abc123_001`
3. Should see all traces for that model version

**SQL equivalent:**
```sql
SELECT 
  trace_id,
  span_name,
  duration_ms,
  status,
  created_at
FROM llm_traces
WHERE user_id = 'your-user-uuid'
  AND session_tag = 'chat_model_abc123_001'
ORDER BY created_at DESC;
```

---

## Troubleshooting

### Issue: session_tag is NULL in traces

**Check:**
1. Does conversation have session_id populated?
   ```sql
   SELECT id, session_id FROM conversations WHERE id = 'your-conv-id';
   ```
2. Check chat API logs for "Session tag:" message
3. Verify widgetSessionTag variable is set

**Fix:**
- Manually set session_id on conversation
- Restart development server
- Check for TypeScript errors

### Issue: Generator returns null

**Check:**
1. Does model exist in llm_models?
   ```sql
   SELECT * FROM llm_models WHERE model_id = 'your-model-id';
   ```
2. Does model belong to user?
   ```sql
   SELECT * FROM llm_models 
   WHERE model_id = 'your-model-id' AND user_id = 'your-user-id';
   ```

**Fix:**
- Add model to llm_models table via Models page
- Verify user_id matches

### Issue: Counter doesn't increment

**Check:**
1. Are multiple conversations getting same counter?
   ```sql
   SELECT session_id, COUNT(*) 
   FROM conversations 
   WHERE session_id LIKE 'chat_model_%'
   GROUP BY session_id 
   HAVING COUNT(*) > 1;
   ```

**Potential Causes:**
- Race condition (multiple conversations created simultaneously)
- Query not filtering correctly

**Fix:**
- Add transaction lock
- Use database sequence instead of MAX query

### Issue: TypeScript errors

**Common Errors:**
1. "Property 'sessionTag' does not exist"
   - Run: `npm run build` to regenerate types
2. "Type 'null' is not assignable"
   - Check all sessionTag parameters are marked optional with `?`

---

## Performance Testing

### Test Counter Query Performance

```sql
-- Simulate many conversations
EXPLAIN ANALYZE
SELECT 
  session_id,
  CAST(SUBSTRING(session_id FROM '[0-9]+$') AS INTEGER) as counter
FROM conversations
WHERE user_id = 'your-user-id'
  AND llm_model_id = 'your-model-id'
  AND session_id LIKE 'chat_model_abc123_%'
ORDER BY counter DESC
LIMIT 1;
```

**Good Performance:**
- Execution time < 10ms
- Uses index scan

**Bad Performance:**
- Execution time > 50ms
- Uses sequential scan

**Fix if slow:**
- Add composite index on (user_id, llm_model_id, session_id)

### Test Trace Query Performance

```sql
-- Test session_tag search
EXPLAIN ANALYZE
SELECT *
FROM llm_traces
WHERE session_tag = 'chat_model_abc123_001'
ORDER BY created_at DESC
LIMIT 50;
```

**Should use:** Index Scan using idx_llm_traces_session_tag

---

## Validation Checklist

Before marking complete:

- [ ] Database migration applied successfully
- [ ] session_tag column exists in llm_traces
- [ ] Indexes created on session_tag
- [ ] Generator function returns valid tags
- [ ] Generator function returns null for non-tracked models
- [ ] Counter increments correctly
- [ ] Traces stored with session_tag
- [ ] session_tag searchable in database
- [ ] No TypeScript compilation errors
- [ ] No breaking changes to existing features
- [ ] Chat still works without session tags (graceful degradation)

---

## Next: Implement Auto-Generation

Once core infrastructure is validated, implement automatic generation by adding this to chat API:

```typescript
// When conversation is created or first message sent
if (userId && llmModelIdForDb) {
  const sessionTag = await generateSessionTag(userId, llmModelIdForDb);
  if (sessionTag) {
    // Update conversation with generated session_id
    await supabaseAdmin.from('conversations')
      .update({
        session_id: sessionTag.session_id,
        experiment_name: sessionTag.experiment_name
      })
      .eq('id', conversationId);
    
    // Store for trace use
    widgetSessionTag = sessionTag.session_id;
  }
}
```

---

**TESTING STATUS**: Ready for Phase 1 testing (infrastructure)  
**NEXT PHASE**: Auto-generation implementation + UI updates
