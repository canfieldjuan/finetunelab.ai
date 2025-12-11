# Validator Troubleshooting Guide
**Date:** December 3, 2025
**Issue:** Validators not running / Judgments not appearing

---

## 🔴 CRITICAL ISSUES FOUND

### Issue #1: Unauthenticated Supabase Client ❌

**Problem:**
```typescript
// executor.ts line 11
import { supabase } from '@/lib/supabaseClient';

// line 164
const { error: insertError } = await supabase
  .from('judgments')
  .insert(judgments);
```

**Why this fails:**
- `supabase` from `@/lib/supabaseClient` is the **unauthenticated** client
- Judgments table has RLS policies requiring authentication
- INSERT will fail with: "new row violates row-level security policy"

**Solution Required:**
The executor needs an **authenticated** Supabase client, not the global one.

---

### Issue #2: No Benchmarks Configured (Probably)

**Problem:**
Validators only run if:
```typescript
// chat/route.ts line 840
if (benchmarkId && assistantMsgData && userId) {
  executeValidators(...)
}
```

**Check Required:**
1. Is `benchmarkId` being passed in chat requests?
2. Do benchmarks have `pass_criteria.required_validators` configured?

**Example benchmark configuration needed:**
```json
{
  "id": "benchmark-123",
  "name": "My Benchmark",
  "pass_criteria": {
    "required_validators": ["must_cite_if_claims", "format_ok"],
    "custom_rules": {}
  }
}
```

---

## 🔍 DIAGNOSTIC STEPS

### Step 1: Check if Validators Are Running

**Add console logging:**
```typescript
// In chat API around line 840
console.log('[DEBUG] Validator conditions:', {
  benchmarkId: benchmarkId,
  hasAssistantMsg: !!assistantMsgData,
  userId: userId,
  willRun: !!(benchmarkId && assistantMsgData && userId)
});
```

**Check browser console or server logs for:**
- `[API] ✅ Executing benchmark validators:` - Validators started
- `[ValidatorExecutor] Executing validators for benchmark:` - Executor running
- `[ValidatorExecutor] Running validators:` - Which validators
- `[ValidatorExecutor] Validator executed:` - Each validator result
- `[ValidatorExecutor] Saving judgments:` - Attempting to save
- `[ValidatorExecutor] Saved X judgments` - Success
- `[ValidatorExecutor] Failed to save judgments:` - Error (likely RLS)

---

### Step 2: Check Judgments Table Exists

**Run in Supabase SQL Editor:**
```sql
-- Check table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'judgments'
);

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'judgments'
ORDER BY ordinal_position;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'judgments';

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'judgments';
```

**Expected columns:**
- id (uuid)
- message_id (uuid)
- judge_type (text)
- judge_name (text)
- criterion (text)
- score (numeric)
- passed (boolean)
- evidence_json (jsonb)
- notes (text)
- created_at (timestamp)

---

### Step 3: Check Benchmark Configuration

**Run in Supabase SQL Editor:**
```sql
-- List all benchmarks
SELECT id, name, pass_criteria
FROM benchmarks
LIMIT 10;

-- Check if any have validators configured
SELECT
  id,
  name,
  pass_criteria->'required_validators' as required_validators,
  pass_criteria->'custom_rules' as custom_rules
FROM benchmarks
WHERE pass_criteria ? 'required_validators';
```

**If no results:** No benchmarks have validators configured!

---

### Step 4: Test Validator Manually

**Create test file: `test-validator-manual.mjs`**
```javascript
import { supabase } from './lib/supabaseClient.js';

async function testJudgmentInsert() {
  console.log('Testing judgment insert...');

  const testJudgment = {
    message_id: 'test-message-id',
    judge_type: 'rule',
    judge_name: 'Test Validator',
    criterion: 'test',
    score: 1.0,
    passed: true,
    evidence_json: { test: true },
    notes: 'Manual test'
  };

  const { data, error } = await supabase
    .from('judgments')
    .insert(testJudgment)
    .select();

  if (error) {
    console.error('❌ INSERT FAILED:', error);
    console.error('Error code:', error.code);
    console.error('Error details:', error.details);
  } else {
    console.log('✅ INSERT SUCCESS:', data);
  }
}

testJudgmentInsert();
```

**Expected error:**
```
❌ INSERT FAILED: {
  code: "42501",
  message: "new row violates row-level security policy for table \"judgments\""
}
```

---

## 🔧 FIXES REQUIRED

### Fix #1: Pass Authenticated Client to Executor

**Option A: Modify executor to accept Supabase client**

```typescript
// executor.ts
export async function executeValidators(
  benchmarkId: string,
  messageId: string,
  responseContent: string,
  contentJson: any,
  userId: string,
  supabaseClient: SupabaseClient  // ADD THIS PARAMETER
): Promise<ExecutorResult[]> {
  // Use supabaseClient instead of global supabase
  const { data: benchmark } = await supabaseClient
    .from('benchmarks')
    .select('id, name, pass_criteria')
    .eq('id', benchmarkId)
    .single();

  // ... rest of code ...

  const { error } = await supabaseClient  // Use passed client
    .from('judgments')
    .insert(judgments);
}
```

**Then update chat API:**
```typescript
// chat/route.ts line 846
executeValidators(
  benchmarkId,
  assistantMsgData.id,
  finalResponse,
  null,
  userId,
  supabase  // Pass authenticated client from chat handler
).catch(err => {
  console.error('[API] Validator execution error:', err);
});
```

**Option B: Create authenticated client in executor**

```typescript
// executor.ts
import { createClient } from '@supabase/supabase-js';

export async function executeValidators(
  benchmarkId: string,
  messageId: string,
  responseContent: string,
  contentJson: any,
  userId: string,
  authToken?: string  // ADD THIS PARAMETER
): Promise<ExecutorResult[]> {
  // Create authenticated client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = authToken
    ? createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${authToken}` } }
      })
    : await import('@/lib/supabaseClient').then(m => m.supabase);

  // Use this client for all operations
}
```

---

### Fix #2: Configure Benchmark with Validators

**Via UI (if available):**
1. Go to Benchmarks page
2. Edit a benchmark
3. Add `required_validators` to pass_criteria

**Via SQL:**
```sql
UPDATE benchmarks
SET pass_criteria = jsonb_set(
  COALESCE(pass_criteria, '{}'::jsonb),
  '{required_validators}',
  '["must_cite_if_claims", "format_ok"]'::jsonb
)
WHERE id = 'your-benchmark-id';
```

**Or create new benchmark:**
```sql
INSERT INTO benchmarks (user_id, name, description, pass_criteria)
VALUES (
  'your-user-id',
  'Test Benchmark with Validators',
  'Tests validators',
  '{
    "required_validators": ["must_cite_if_claims", "format_ok"],
    "custom_rules": {}
  }'::jsonb
);
```

---

## 🧪 TESTING PROCEDURE

### Test 1: Verify Judgments Table
```sql
-- Should return 'true'
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'judgments'
);
```

### Test 2: Check RLS Policies
```sql
-- Should show 2 policies
SELECT policyname FROM pg_policies WHERE tablename = 'judgments';
-- Expected:
-- 1. "Users can view their own judgments"
-- 2. "Users can insert judgments for their messages"
```

### Test 3: Create Benchmark with Validators
```sql
-- Get your user_id first
SELECT id FROM auth.users LIMIT 1;

-- Create test benchmark
INSERT INTO benchmarks (user_id, name, pass_criteria)
VALUES (
  '<your-user-id>',
  'Validator Test Benchmark',
  '{"required_validators": ["format_ok"]}'::jsonb
)
RETURNING id;
```

### Test 4: Send Chat Message with Benchmark
```javascript
// In chat request
POST /api/chat
{
  "conversationId": "...",
  "message": "Test message",
  "benchmarkId": "<benchmark-id-from-step-3>"
}
```

### Test 5: Check Logs
Look for:
- `[API] ✅ Executing benchmark validators:`
- `[ValidatorExecutor] Running validators: ["format_ok"]`
- `[ValidatorExecutor] Validator executed: format_ok passed=true`
- `[ValidatorExecutor] Saving judgments: 1`

**If you see error:**
- `[ValidatorExecutor] Failed to save judgments:` → RLS policy issue

### Test 6: Check Judgments Saved
```sql
SELECT * FROM judgments
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📋 CHECKLIST

Before validators will work, verify:

- [ ] Judgments table exists in database
- [ ] RLS policies exist on judgments table
- [ ] At least one benchmark has `required_validators` configured
- [ ] Executor uses authenticated Supabase client (FIX REQUIRED)
- [ ] Chat requests include `benchmarkId`
- [ ] Console logs show validators running
- [ ] No RLS policy errors in logs

---

## 🚨 IMMEDIATE ACTION REQUIRED

**The executor.ts MUST be fixed to use an authenticated Supabase client.**

Without this fix, validators will run but judgments will **never** be saved due to RLS policies.

**Recommendation:** Pass the authenticated Supabase client from chat API to executor.
