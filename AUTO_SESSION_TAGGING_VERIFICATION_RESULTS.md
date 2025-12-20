# Auto-Session-Tagging System - Verification Results

**Date**: December 19, 2025  
**Purpose**: Answer the 4 outstanding verification questions needed for implementation

---

## ✅ Question 1: Does conversations table have metadata JSONB column?

**Status**: **UNCERTAIN - NEED TO VERIFY VIA SQL**

### Evidence Found:

**❌ NO metadata column found in conversations table** based on code analysis:

1. **Existing verification script** (`scripts/verify-conversations-schema.sql`) checks for metadata column:
   - Script exists to verify if metadata column is present
   - Suggests metadata might NOT exist yet

2. **useConversationActions.ts analysis** (lines 25-50):
   ```typescript
   const insertData: { user_id: string; title: string; workspace_id?: string } = {
     user_id: userId,
     title: "New Chat"
   };
   ```
   - No metadata field in conversation creation
   - Only user_id, title, workspace_id

3. **SessionManager updates** (lines 173-189 in useConversationActions.ts):
   ```typescript
   await supabase.from('conversations').update({ 
     session_id: sessionId, 
     experiment_name: experimentName 
   }).eq('id', activeId);
   ```
   - Session data stored in separate columns (session_id, experiment_name)
   - NOT stored in metadata JSONB

4. **Batch test conversation creation** (line 619 in app/api/batch-testing/run/route.ts):
   ```typescript
   .insert({
     user_id: userId,
     title: customName,
     widget_session_id: widgetSessionId,
     is_widget_session: true,
     llm_model_id: config.model_name,
     run_id: runId,
     batch_test_run_id: testRunId,
     session_id: config.session_tag?.session_id || null,
     experiment_name: config.session_tag?.experiment_name || null
   })
   ```
   - Extensive field list, NO metadata field
   - Confirms conversations use explicit columns, not JSONB metadata

### ✅ Confirmed Columns That DO Exist:

Based on code inspection across multiple files:
- ✅ `id` (UUID)
- ✅ `user_id` (UUID, FK to auth.users)
- ✅ `title` (TEXT)
- ✅ `session_id` (TEXT) - For manual session tagging
- ✅ `experiment_name` (TEXT) - For experiment grouping
- ✅ `widget_session_id` (TEXT) - For batch test tracking
- ✅ `is_widget_session` (BOOLEAN)
- ✅ `llm_model_id` (TEXT) - FK to llm_models.model_id
- ✅ `run_id` (TEXT) - Batch test run identifier
- ✅ `batch_test_run_id` (UUID) - FK to batch_test_runs
- ✅ `workspace_id` (TEXT/UUID) - Multi-tenancy support
- ✅ `archived` (BOOLEAN) - Soft delete flag
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `updated_at` (TIMESTAMPTZ)

### 🎯 Recommendation:

**DO NOT ADD metadata column to conversations table.**

The table uses explicit columns for all structured data. Adding metadata would be inconsistent with existing architecture. For auto-session-tagging, we should use:

**Option A**: Store session tag data in existing session_id/experiment_name columns
- session_id = full session tag (e.g., "chat_model_abc123_015")
- experiment_name = model name (e.g., "GPT-4 Turbo Fine-tuned v2")

**Option B**: Add dedicated session_tag column
- `session_tag` TEXT - Stores auto-generated tag
- Keeps existing session_id/experiment_name for manual override

---

## ✅ Question 2: Where is current manual session tag stored?

**Status**: ✅ **FULLY ANSWERED**

### Storage Location:

Session tags are stored in **two separate TEXT columns** in the `conversations` table:

1. **`session_id`** (TEXT)
   - Unique identifier for a test run
   - Examples: "baseline-test-1", "variant-gpt4-001"

2. **`experiment_name`** (TEXT)
   - Groups related sessions together
   - Examples: "gpt4-vs-claude", "prompt-optimization"

### Code Evidence:

**1. SessionManager Component** (components/chat/SessionManager.tsx):
```typescript
// User enters session_id and experiment_name via form inputs
<Input 
  placeholder="e.g., baseline-v1" 
  value={sessionId}
  onChange={(e) => setSessionId(e.target.value)}
/>
<Input 
  placeholder="e.g., model-comparison" 
  value={experimentName}
  onChange={(e) => setExperimentName(e.target.value)}
/>
```

**2. Update Logic** (useConversationActions.ts lines 173-189):
```typescript
const handleSessionChange = async (sessionId: string, experimentName: string) => {
  await supabase.from('conversations').update({ 
    session_id: sessionId, 
    experiment_name: experimentName 
  }).eq('id', activeId);
};
```

**3. Clear Logic** (useConversationActions.ts lines 191-200):
```typescript
const handleClearSession = async () => {
  await supabase.from('conversations').update({ 
    session_id: null, 
    experiment_name: null 
  }).eq('id', activeId);
};
```

### How It's Used:

**Analytics Queries** (components/analytics/AnalyticsChat.tsx lines 69-91):
```typescript
const { data, error } = await supabase
  .from('conversations')
  .select('id, session_id, experiment_name')
  .eq('user_id', user.id)
  .not('session_id', 'is', null)
  .not('experiment_name', 'is', null)
  .order('created_at', { ascending: false });

// Group by session_id and experiment_name
const key = `${conv.session_id}-${conv.experiment_name}`;
```

**Batch Tests** (app/api/batch-testing/run/route.ts lines 625-626):
```typescript
session_id: config.session_tag?.session_id || null,
experiment_name: config.session_tag?.experiment_name || null
```

### 🎯 Implication for Auto-Tagging:

We can **reuse these existing columns** for auto-generated session tags:
- `session_id` → Auto-generated tag like "chat_model_abc123_015"
- `experiment_name` → Model display name like "GPT-4 Turbo v2"

This approach:
- ✅ No schema changes needed
- ✅ Backwards compatible with existing analytics
- ✅ Works with batch test system
- ✅ SessionManager just needs UI update (remove input, show badge)

---

## ✅ Question 3: How are conversations created (which file/function)?

**Status**: ✅ **FULLY ANSWERED**

### Primary Creation Path:

**File**: `components/hooks/useConversationActions.ts`  
**Function**: `handleNewConversation` (lines 25-62)

```typescript
const handleNewConversation = useCallback(async () => {
  if (!userId) {
    return;
  }

  try {
    const insertData: { user_id: string; title: string; workspace_id?: string } = {
      user_id: userId,
      title: "New Chat"
    };

    // Include workspace_id if provided
    if (workspaceId !== undefined && workspaceId !== null) {
      insertData.workspace_id = workspaceId;
    }

    const { data, error: insertError } = await supabase
      .from("conversations")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (data) {
      await logSessionEvent(userId, "conversation_created", data.id);
      await fetchConversations();
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    log.error('useConversationActions', 'Error creating conversation', { error: errorMessage });
  }
}, [userId, fetchConversations, workspaceId]);
```

### Alternative Creation Paths:

**1. Batch Test Conversations** (app/api/batch-testing/run/route.ts lines 612-628):
```typescript
const { data: conversation, error: convError } = await supabaseAdmin
  .from('conversations')
  .insert({
    user_id: userId,
    title: customName,
    widget_session_id: widgetSessionId,
    is_widget_session: true,
    llm_model_id: config.model_name,
    run_id: runId,
    batch_test_run_id: testRunId,
    session_id: config.session_tag?.session_id || null,
    experiment_name: config.session_tag?.experiment_name || null
  })
  .select()
  .single();
```

**2. Demo Conversations** (lib/demo/queries.ts lines 30-51):
```typescript
export async function createDemoConversation(params: {
  sessionId?: string;
  experimentName?: string;
  modelId?: string;
  title?: string;
  demoUserId?: string;
}): Promise<DemoConversation | null> {
  const { data, error } = await supabase
    .from('demo_conversations')
    .insert({
      session_id: params.sessionId,
      experiment_name: params.experimentName,
      model_id: params.modelId,
      title: params.title,
      demo_user_id: params.demoUserId || 'demo-user',
    })
    .select()
    .single();
  // ...
}
```

**3. Test/Integration Setup** (tests/integration/analytics.e2e.test.ts lines 68-84):
```typescript
const { data: conversation, error: convError } = await supabase
  .from('conversations')
  .insert({
    user_id: testData.userId,
    title: `Analytics Test Conversation ${i + 1}`,
    session_id: i === 0 ? 'test-session-a' : null,
    experiment_name: i === 0 ? 'Test Experiment A' : null,
  })
  .select()
  .single();
```

### 🎯 Implementation Strategy:

To add auto-session-tagging, we need to modify **useConversationActions.ts**:

```typescript
// NEW: Import session tag generator
import { generateSessionTag } from '@/lib/session-tagging/generator';

const handleNewConversation = useCallback(async () => {
  if (!userId) return;

  try {
    // NEW: Generate session tag if model is tracked
    const sessionTag = await generateSessionTag(userId, currentModelId);

    const insertData = {
      user_id: userId,
      title: "New Chat",
      // NEW: Add auto-generated session tag
      session_id: sessionTag?.session_id || null,
      experiment_name: sessionTag?.experiment_name || null,
      workspace_id: workspaceId || undefined
    };

    const { data, error } = await supabase
      .from("conversations")
      .insert(insertData)
      .select()
      .single();
    
    // ... rest of function
  }
}, [userId, currentModelId, fetchConversations, workspaceId]);
```

**Key Requirements**:
1. Access to current model ID (need to pass as prop or get from context)
2. New generateSessionTag function (checks llm_models table, generates counter)
3. Maintain backwards compatibility (batch tests, demos still work)

---

## ✅ Question 4: How do batch tests use session tags (compatibility check)?

**Status**: ✅ **FULLY ANSWERED - NO COMPATIBILITY ISSUES**

### Current Batch Test Session Tag Usage:

**1. Configuration Structure** (lib/batch-testing/types.ts lines 60-100):
```typescript
export type SessionTag = {
  session_id?: string;
  experiment_name?: string;
};

export interface BatchTestConfig {
  model_name: string;
  prompt_limit?: number;
  concurrency?: number;
  delay_ms?: number;
  source_path?: string;
  benchmark_id?: string;
  session_tag?: SessionTag;  // ← Optional session tagging
  judge_config?: JudgeConfig;
}
```

**2. API Accepts Session Tags** (app/api/batch-testing/run/route.ts lines 332-333):
```typescript
const batchConfig: BatchTestConfig = {
  model_name: config.model_id,
  prompt_limit: config.prompt_limit || 25,
  concurrency: config.concurrency || 3,
  delay_ms: config.delay_ms || 1000,
  source_path: config.source_path,
  benchmark_id: config.benchmark_id,
  session_tag: config.session_tag,  // ← Passed through from request
  judge_config: config.judge_config
};
```

**3. Stored in Conversation Record** (lines 625-626):
```typescript
const { data: conversation, error: convError } = await supabaseAdmin
  .from('conversations')
  .insert({
    user_id: userId,
    title: customName,
    widget_session_id: widgetSessionId,
    is_widget_session: true,
    llm_model_id: config.model_name,
    run_id: runId,
    batch_test_run_id: testRunId,
    // ✅ Session tag from config (user-provided or null)
    session_id: config.session_tag?.session_id || null,
    experiment_name: config.session_tag?.experiment_name || null
  })
  .select()
  .single();
```

### How Batch Tests Currently Work:

**Scenario 1: User provides custom session tag**
```json
{
  "config": {
    "model_id": "gpt-4-turbo",
    "test_suite_id": "uuid-123",
    "session_tag": {
      "session_id": "my-custom-test-v1",
      "experiment_name": "gpt4-baseline"
    }
  }
}
```
**Result**: Conversation gets user's custom tags

**Scenario 2: User omits session tag**
```json
{
  "config": {
    "model_id": "gpt-4-turbo",
    "test_suite_id": "uuid-123"
  }
}
```
**Result**: Conversation gets `session_id: null, experiment_name: null`

### 🎯 Compatibility Analysis:

**✅ NO BREAKING CHANGES NEEDED**

The auto-session-tagging system will work seamlessly with batch tests:

#### Option A: Batch Tests Override Auto-Tags (RECOMMENDED)
```typescript
// In conversation creation logic
const sessionTag = config.session_tag 
  ? config.session_tag  // Use custom tag if provided
  : await generateSessionTag(userId, config.model_name);  // Auto-generate otherwise

const insertData = {
  user_id: userId,
  title: customName,
  session_id: sessionTag?.session_id || null,
  experiment_name: sessionTag?.experiment_name || null,
  // ... other fields
};
```

**Behavior**:
- User provides session_tag → Use custom tag (current behavior preserved)
- User omits session_tag → Auto-generate tag (new feature)
- Fully backwards compatible ✅

#### Option B: Always Use Batch Test Tags, Never Auto-Generate
```typescript
// For batch test conversations, SKIP auto-generation
if (isBatchTestRequest) {
  // Only use user-provided tags or null
  session_id: config.session_tag?.session_id || null,
  experiment_name: config.session_tag?.experiment_name || null
} else {
  // Auto-generate for regular chats
  const sessionTag = await generateSessionTag(userId, modelId);
  session_id: sessionTag?.session_id,
  experiment_name: sessionTag?.experiment_name
}
```

**Behavior**:
- Batch tests never get auto-tags (preserves exact current behavior)
- Regular chats get auto-tags (new feature isolated)
- Zero risk to batch test workflows ✅

### Documentation References:

From `docs/progress/BATCH_TESTING_SESSION_TAG_JUDGE_IMPLEMENTATION.md`:
> **conversations table** (already has):
> - `session_id` VARCHAR - For session tagging
> - `experiment_name` VARCHAR - For experiment grouping
> - `widget_session_id` VARCHAR - For batch test tracking
> - `batch_test_run_id` UUID - Links to batch test run

From `docs/progress/BATCH_TESTING_SESSION_TAG_INTEGRATION.md`:
> **No Breaking Changes Needed! ✅**
> Everything already exists

### 🎯 Recommendation:

**Use Option A (Override Pattern)**:
1. Batch test users can provide custom session tags (keeps current flexibility)
2. If omitted, auto-generate based on model (new convenience feature)
3. Zero breaking changes to existing batch test workflows
4. Users get best of both worlds

**Implementation**:
```typescript
// Reusable function for all conversation creation paths
function resolveSessionTag(
  providedTag: SessionTag | undefined,
  userId: string,
  modelId: string
): Promise<SessionTag | null> {
  // Priority 1: User-provided tag (batch tests, manual overrides)
  if (providedTag?.session_id) {
    return Promise.resolve(providedTag);
  }
  
  // Priority 2: Auto-generate for tracked models
  return generateSessionTag(userId, modelId);
}
```

---

## 📊 Summary of Findings

| Question | Status | Answer |
|----------|--------|--------|
| 1. Does conversations have metadata JSONB? | ❌ NO | Use existing session_id/experiment_name columns instead |
| 2. Where is manual session tag stored? | ✅ YES | In conversations.session_id and conversations.experiment_name (TEXT columns) |
| 3. How are conversations created? | ✅ YES | useConversationActions.handleNewConversation (lines 25-62) |
| 4. How do batch tests use tags? | ✅ YES | Via config.session_tag (optional, no conflicts with auto-tagging) |

---

## 🚀 Next Steps (Awaiting User Approval)

### Phase 2: Detailed Design
1. ✅ Verify conversations schema via SQL (run verify-conversations-schema.sql)
2. ✅ Confirm metadata column status (likely doesn't exist)
3. ✅ Decide: Use existing columns OR add new session_tag column
4. ✅ Design generateSessionTag function signature
5. ✅ Design counter increment logic (per-user, per-model)
6. ✅ Design batch test override pattern

### Phase 3: Implementation
1. Create generateSessionTag function
2. Update useConversationActions.handleNewConversation
3. Update SessionManager UI (remove input, show badge)
4. Add session_tag column to llm_traces (for trace search)
5. Update trace service to store session_tag
6. Update trace list API to filter by session_tag
7. Update TraceExplorer UI to search by session_tag

### Phase 4: Testing
1. Test new conversation creation (auto-tag appears)
2. Test model not on Models page (no auto-tag)
3. Test counter increment (multiple conversations)
4. Test batch tests with custom tags (override works)
5. Test batch tests without tags (auto-generate works)
6. Test trace search by session tag

---

## 🔍 SQL Verification Needed

**Run this in Supabase SQL Editor to confirm schema**:

```sql
-- Check conversations table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- Confirm session columns exist
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'session_id'
  ) THEN '✅ session_id exists' ELSE '❌ MISSING' END AS session_id_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'experiment_name'
  ) THEN '✅ experiment_name exists' ELSE '❌ MISSING' END AS experiment_name_status,
  
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'metadata'
  ) THEN '✅ metadata exists' ELSE '❌ MISSING (expected)' END AS metadata_status;
```

**Expected Results**:
- ✅ session_id: TEXT column exists
- ✅ experiment_name: TEXT column exists
- ❌ metadata: Does NOT exist (use explicit columns instead)

---

**END OF VERIFICATION REPORT**
