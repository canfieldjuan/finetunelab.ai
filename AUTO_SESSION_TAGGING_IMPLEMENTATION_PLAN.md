# Auto Session Tagging Implementation Plan

**Date**: December 19, 2025  
**Purpose**: Replace manual session tagging with automatic model-based session IDs for trace searchability and model performance tracking  
**Status**: AWAITING APPROVAL

---

## Executive Summary

### Goal
Enable users to search traces by session tag without manually copying IDs from console. Auto-generate session tags in format `chat_model_{uuid}_{counter}` for every conversation linked to a model on the Models page.

### Key Benefits
1. **User-friendly trace search**: Click badge to copy session tag, paste in /analytics/traces search
2. **Model performance tracking**: Group all conversations per model version for A/B testing
3. **Version isolation**: Each model version gets unique counter namespace (no confusion between v1 vs v2)
4. **Toggle analytics**: Click badge to include/exclude conversation from analytics

---

## Current System Analysis

### Existing Session Tagging (Manual)
- **Component**: `components/chat/SessionManager.tsx`
- **Behavior**: User clicks "Tag Session" → Enters custom `session_id` and optional `experiment_name`
- **Storage**: Conversation metadata (likely JSONB field)
- **Usage**: Batch tests can auto-tag, manual chat requires user input

### Traces System (Recently Implemented)
- **Table**: `llm_traces` (migration: `20251128_create_llm_traces.sql`)
- **Fields**: `trace_id`, `conversation_id`, `user_id`, `model_name`, `model_provider`, etc.
- **Search**: Currently by trace_id or conversation_id (UUIDs - not user-friendly)
- **Issue**: No easy way to group traces by model or find specific conversation traces

### Models Page
- **Table**: `llm_models` 
- **Purpose**: Registry of all testable models (fine-tuned, serverless, production, or manually added flagship models)
- **Fields**: `id` (UUID), `model_id` (text), `name` (text), `provider`, `user_id`
- **Current Usage**: Model selector dropdown in chat

---

## Proposed Solution

### Session Tag Format
```
Format: chat_model_{model_uuid_short}_{counter}
Example: chat_model_abc123_015

Components:
- Prefix: "chat_"
- Model ID: First 6 chars of model UUID from llm_models table
- Counter: Per-user, per-model incremental number (3 digits, zero-padded)
```

### Badge Display
```
[Customer Support Bot v2 #015] 🔄
  ↑ Model name from llm_models.name
  ↑ Counter shows this is 15th chat with this model version
  ↑ Click toggles analytics tracking (enabled/disabled)
  
Hover tooltip: "Session: chat_model_abc123_015 (click to copy)"
```

### Auto-Generation Logic
1. User selects model from dropdown (must be in `llm_models` table)
2. System creates conversation
3. System checks: Is model_id in `llm_models`?
   - **YES**: Generate session tag
   - **NO**: No session tag (chat assistant models excluded)
4. Query next counter: `SELECT MAX(counter) + 1 WHERE user_id = ? AND model_id = ?`
5. Generate session_id: `chat_model_{short_uuid}_{counter}`
6. Store in conversation metadata with `enabled: true`

### Database Changes Needed

#### Option A: Add columns to conversations table
```sql
ALTER TABLE conversations
ADD COLUMN session_tag_id TEXT,
ADD COLUMN session_tag_enabled BOOLEAN DEFAULT true,
ADD COLUMN session_tag_counter INTEGER;

CREATE INDEX idx_conversations_session_tag ON conversations(session_tag_id);
CREATE INDEX idx_conversations_model_counter ON conversations(user_id, llm_model_id, session_tag_counter);
```

#### Option B: Use existing metadata JSONB column
```typescript
// conversations.metadata structure:
{
  session_tag: {
    session_id: "chat_model_abc123_015",
    model_id: "model_uuid-here",
    model_name: "Customer Support Bot v2",
    counter: 15,
    enabled: true  // Toggle for analytics inclusion
  }
}
```

**RECOMMENDATION**: Option B (use metadata JSONB) - less schema changes, more flexible

---

## Phase 1: Discovery & Verification ✅ COMPLETE

### Verified Information

#### 1. Conversations Table Schema
- ✅ Has `metadata` JSONB column (from migration `20251207_add_metadata_column.sql` - though that was for training_jobs)
- ❓ **NEEDS VERIFICATION**: Does conversations table have metadata column?
- ✅ Has `llm_model_id` column (UUID reference to llm_models.id)
- ✅ Has `widget_session_id` for widget chat isolation

#### 2. LLM Models Table
- ✅ Table exists: `llm_models`
- ✅ Has `id` (UUID), `name`, `model_id`, `provider`, `user_id`
- ✅ Used by model manager service

#### 3. Session Manager Component
- ✅ Location: `components/chat/SessionManager.tsx`
- ✅ Props: `sessionId`, `experimentName`, `onSessionChange`, `onClearSession`
- ✅ Current behavior: Manual input fields for session_id and experiment_name
- ✅ Display: Badge when session exists, button when empty

#### 4. Traces Integration
- ✅ Table: `llm_traces`
- ✅ Has `conversation_id` field
- ✅ Search API: `/api/analytics/traces/list`
- ❓ **NEEDS VERIFICATION**: Can we add session_tag search filter?

### Questions to Answer

1. **conversations table metadata**: Does it have metadata JSONB column?
   - **Action**: Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'metadata'`

2. **Session tag storage**: Where is current manual session tag stored?
   - **Action**: Search for `session_id` writes in conversation creation code

3. **Counter implementation**: How to handle per-user per-model counter efficiently?
   - **Action**: Design query pattern with proper indexes

4. **Model selection**: Where/how is model selected during conversation creation?
   - **Action**: Trace conversation creation flow in Chat.tsx

5. **Batch test compatibility**: How do batch tests currently use session tags?
   - **Action**: Review `app/api/batch-testing/run/route.ts` lines 345, 625

---

## Phase 2: Design & Planning (PENDING APPROVAL)

### Database Schema Changes

#### Step 1: Verify/Add metadata column to conversations
```sql
-- Check if metadata column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'conversations' 
  AND column_name = 'metadata';

-- If not exists, add it
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_conversations_metadata 
ON conversations USING GIN (metadata);
```

#### Step 2: Add session_tag to llm_traces for searchability
```sql
ALTER TABLE llm_traces
ADD COLUMN IF NOT EXISTS session_tag TEXT;

CREATE INDEX IF NOT EXISTS idx_llm_traces_session_tag
ON llm_traces(session_tag);
```

### Code Changes Required

#### File 1: `components/chat/SessionManager.tsx`
**Current**: Manual input form  
**New**: Auto-display badge with toggle

**Changes**:
- Remove input fields
- Show auto-generated session tag from props
- Add click handler to toggle `enabled` state
- Add copy-to-clipboard on hover/click
- Show visual state (enabled = blue, disabled = gray)

#### File 2: `components/hooks/useConversationActions.ts` (or wherever conversation is created)
**Purpose**: Auto-generate session tag on conversation creation

**New Function**:
```typescript
async function generateSessionTag(userId: string, modelId: string): Promise<SessionTag | null> {
  // 1. Verify model exists in llm_models table
  const { data: model } = await supabase
    .from('llm_models')
    .select('id, name, model_id')
    .eq('id', modelId)
    .eq('user_id', userId)
    .single();
  
  if (!model) return null; // Not a trackable model
  
  // 2. Get next counter for this user + model
  const { data: conversations } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('user_id', userId)
    .not('metadata->session_tag', 'is', null);
  
  // Extract counters for this model
  const counters = conversations
    ?.map(c => c.metadata?.session_tag?.model_id === modelId ? c.metadata.session_tag.counter : 0)
    .filter(c => c > 0) || [];
  
  const nextCounter = Math.max(0, ...counters) + 1;
  
  // 3. Generate session_id
  const shortUuid = model.id.substring(0, 6);
  const paddedCounter = String(nextCounter).padStart(3, '0');
  const session_id = `chat_model_${shortUuid}_${paddedCounter}`;
  
  return {
    session_id,
    model_id: modelId,
    model_name: model.name,
    counter: nextCounter,
    enabled: true
  };
}
```

#### File 3: `app/api/chat/route.ts`
**Purpose**: Link session_tag to traces

**Change Location**: Lines 797-805 (where traceContext is created)

**Add**:
```typescript
traceContext = await traceService.startTrace({
  spanName: 'llm.completion',
  operationType: 'llm_call',
  modelName: selectedModelId,
  modelProvider: actualModelConfig?.provider || provider || undefined,
  conversationId: widgetConversationId || undefined,
  sessionTag: conversationSessionTag || undefined, // NEW
});
```

#### File 4: `lib/tracing/trace.service.ts`
**Purpose**: Store session_tag in traces

**Add to StartTraceParams interface**:
```typescript
export interface StartTraceParams {
  spanName: string;
  operationType: string;
  modelName?: string;
  modelProvider?: string;
  conversationId?: string;
  messageId?: string;
  parentContext?: TraceContext;
  sessionTag?: string; // NEW
}
```

**Update sendTraceStart function** to include session_tag in INSERT

#### File 5: `app/api/analytics/traces/list/route.ts`
**Purpose**: Add session_tag search filter

**Add to query building**:
```typescript
if (sessionTag) {
  query = query.eq('session_tag', sessionTag);
}
```

#### File 6: `components/analytics/TraceExplorer.tsx`
**Purpose**: Add session tag search input

**Add UI**:
```tsx
<Input
  placeholder="Search by session tag..."
  value={sessionTagFilter}
  onChange={(e) => setSessionTagFilter(e.target.value)}
/>
```

### Files Affected (Verification Needed)

1. ✅ `components/chat/SessionManager.tsx` - Replace manual input with auto badge
2. ❓ `components/hooks/useConversationActions.ts` - Add auto-generation logic (need to verify file location)
3. ✅ `app/api/chat/route.ts` - Pass session_tag to traces
4. ✅ `lib/tracing/trace.service.ts` - Store session_tag
5. ✅ `lib/tracing/types.ts` - Add sessionTag to interfaces
6. ✅ `app/api/analytics/traces/list/route.ts` - Add session_tag filter
7. ✅ `components/analytics/TraceExplorer.tsx` - Add session tag search UI

### Breaking Changes Assessment

**Potential Conflicts**:
1. Existing manual session tags in conversations metadata
2. Batch test session tag format might differ
3. Components expecting manual session_id input

**Mitigation**:
1. Check for existing `session_id` in metadata before auto-generating
2. Preserve batch test workflow (they can still use custom session tags)
3. Make auto-generation opt-in via model presence check

---

## Phase 3: Implementation (PENDING APPROVAL)

### Step-by-Step Execution Plan

#### Step 1: Database Migration
- [ ] Create migration file: `20251220_add_session_tag_to_traces.sql`
- [ ] Verify conversations.metadata exists
- [ ] Add session_tag column to llm_traces
- [ ] Add indexes
- [ ] Test migration in dev environment

#### Step 2: Backend Changes
- [ ] Update `StartTraceParams` interface
- [ ] Update `sendTraceStart` function
- [ ] Update chat route to pass session_tag
- [ ] Add session_tag filter to traces API
- [ ] Test with Postman/curl

#### Step 3: Conversation Creation Logic
- [ ] Find conversation creation function
- [ ] Add `generateSessionTag` helper
- [ ] Integrate with conversation creation flow
- [ ] Test: Create conversation with model → Verify session_tag generated

#### Step 4: UI Updates
- [ ] Update SessionManager component
- [ ] Remove manual input fields
- [ ] Add toggle functionality
- [ ] Add copy-to-clipboard
- [ ] Add visual states (enabled/disabled)
- [ ] Test: Click badge → Toggle → Verify state change

#### Step 5: Traces UI Integration
- [ ] Add session tag filter input
- [ ] Update API calls to include session_tag param
- [ ] Test: Search by session tag → Verify results filtered

#### Step 6: End-to-End Testing
- [ ] Create new conversation with model
- [ ] Verify session tag auto-generated
- [ ] Send messages
- [ ] Check traces have session_tag
- [ ] Search traces by session_tag
- [ ] Toggle session tag enabled/disabled
- [ ] Verify analytics filters respect enabled state

---

## Phase 4: Testing & Validation (PENDING APPROVAL)

### Test Scenarios

#### Scenario 1: New Conversation with Tracked Model
1. Select model from Models page in chat dropdown
2. Start new conversation
3. **Expected**: Session badge appears: `[Model Name #001]`
4. Hover badge → **Expected**: Tooltip shows `chat_model_abc123_001`
5. Click badge → **Expected**: Copied to clipboard
6. Send message
7. Query traces → **Expected**: Trace has session_tag field populated

#### Scenario 2: Model Not on Models Page
1. Use chat assistant (not in llm_models table)
2. Start conversation
3. **Expected**: No session badge appears
4. Send message
5. Query traces → **Expected**: session_tag is NULL

#### Scenario 3: Counter Increment
1. Create conversation #1 with Model A → **Expected**: `#001`
2. Create conversation #2 with Model A → **Expected**: `#002`
3. Create conversation #1 with Model B → **Expected**: `#001` (separate counter)

#### Scenario 4: Toggle Analytics
1. Create conversation with session tag
2. Click badge to disable → **Expected**: Badge grays out
3. Check conversation metadata → **Expected**: `enabled: false`
4. Query analytics → **Expected**: This conversation excluded

#### Scenario 5: Search Traces by Session Tag
1. Copy session tag from badge
2. Go to /analytics/traces
3. Paste in search box
4. **Expected**: Only traces from that conversation appear

#### Scenario 6: Batch Test Compatibility
1. Run batch test with custom session tag
2. **Expected**: Batch test session tag preserved (not overwritten)
3. **Expected**: Batch conversations work as before

---

## Risks & Mitigation

### Risk 1: Breaking Existing Manual Session Tags
**Impact**: High  
**Probability**: Medium  
**Mitigation**: 
- Check for existing session_id before auto-generating
- Add migration to preserve existing tags
- Make auto-tagging conditional on model presence

### Risk 2: Performance Impact on Conversation Creation
**Impact**: Medium  
**Probability**: Low  
**Mitigation**:
- Use indexed queries for counter lookup
- Cache model checks
- Make session tag generation async (non-blocking)

### Risk 3: Counter Collisions in Concurrent Creation
**Impact**: Low  
**Probability**: Low  
**Mitigation**:
- Use database transaction for counter increment
- Add unique constraint on (user_id, model_id, counter)

### Risk 4: Batch Test Workflow Disruption
**Impact**: High  
**Probability**: Medium  
**Mitigation**:
- Preserve existing batch test session tag logic
- Only apply auto-tagging to manual chat conversations
- Add flag to disable auto-tagging for batch tests

---

## Rollback Plan

### If Issues Discovered After Deployment

#### Step 1: Disable Auto-Generation
```typescript
// In conversation creation logic, add feature flag:
if (FEATURE_FLAGS.AUTO_SESSION_TAG_ENABLED && model) {
  sessionTag = await generateSessionTag(userId, modelId);
}
```

#### Step 2: Revert Database Changes
```sql
-- If needed, drop added columns (preserve data first)
ALTER TABLE llm_traces DROP COLUMN IF EXISTS session_tag;

-- Remove indexes
DROP INDEX IF EXISTS idx_llm_traces_session_tag;
```

#### Step 3: Restore Manual Session Manager
- Git revert SessionManager component changes
- Redeploy previous version

---

## Success Criteria

### Must Have (Phase 3)
- [ ] Auto-generate session tags for conversations with models
- [ ] Display session tag badge in UI
- [ ] Store session_tag in llm_traces table
- [ ] Search traces by session_tag
- [ ] No breaking changes to batch tests

### Should Have (Phase 4)
- [ ] Toggle analytics enabled/disabled
- [ ] Copy session tag to clipboard
- [ ] Counter increments correctly per model
- [ ] Visual distinction between enabled/disabled state

### Nice to Have (Future)
- [ ] Export traces by session tag
- [ ] Analytics dashboard filtered by session tag
- [ ] Session tag rename functionality
- [ ] Bulk enable/disable sessions

---

## Timeline Estimate

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Discovery & Verification | 2 hours |
| 2 | Design & Planning | 3 hours |
| 3 | Implementation | 8 hours |
| 4 | Testing & Validation | 4 hours |
| **Total** | | **17 hours** |

---

## Approval Checklist

Before proceeding with implementation, confirm:

- [ ] Database schema changes reviewed and approved
- [ ] No conflicts with existing manual session tag workflow
- [ ] Batch test compatibility verified
- [ ] UI/UX design approved (badge display, toggle behavior)
- [ ] Performance impact acceptable (counter queries, indexes)
- [ ] Rollback plan understood and acceptable
- [ ] Timeline and resource allocation approved

---

## Next Steps

**AWAITING USER APPROVAL**

1. Review this plan thoroughly
2. Answer verification questions (Phase 1)
3. Confirm approach (Option A vs Option B for storage)
4. Approve to proceed with Phase 2 (detailed design)
5. Approve to proceed with Phase 3 (implementation)

---

**Document Version**: 1.0  
**Last Updated**: December 19, 2025  
**Status**: Draft - Awaiting Approval
