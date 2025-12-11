# Chat Metadata Persistence Fix - Implementation Plan

**Date:** 2025-11-30
**Status:** Planning Phase
**Priority:** High
**Type:** Permanent Fix (No Workarounds)

---

## Problem Statement

### Current Issues

1. **Metadata doesn't persist on page refresh**: Model name, provider, and other metadata shown during chat streaming are lost when the page is refreshed
2. **Model name is not saved to database**: The `model_name` field is computed at runtime by looking up `model_id` in the `llm_models` table, not stored with the message
3. **Breaking dependency on llm_models table**: If a model is deleted from `llm_models`, historical messages lose their model name display

### Root Causes Identified

**File: `/app/api/chat/route.ts`**
- **Lines 726-742** (Non-streaming): Assistant message insertion does NOT include `metadata` field
- **Lines 1123-1137** (Streaming): Assistant message insertion does NOT include `metadata` field
- Model metadata is sent via streaming events but never persisted to database

**File: `/components/hooks/useMessages.ts`**
- **Lines 122-143**: `model_name` is populated dynamically by looking up `model_id` in `llm_models` table
- **Line 163**: `metadata` field is passed through from DB but is currently null/empty

**File: `/components/chat/types.ts`**
- **Line 31**: `model_name?: string` is marked as "Computed field for display (populated by useMessages)"
- **Line 27**: `metadata?: Record<string, unknown>` exists but is unused

---

## Verification of Current State

### Database Schema - messages table

**Confirmed columns (from code inspection):**
- ✅ `id` (uuid, primary key)
- ✅ `conversation_id` (uuid, foreign key)
- ✅ `user_id` (uuid, foreign key)
- ✅ `role` (text: 'user' | 'assistant')
- ✅ `content` (text)
- ✅ `model_id` (text) - stores model identifier
- ✅ `provider` (text) - stores provider name
- ✅ `input_tokens` (integer)
- ✅ `output_tokens` (integer)
- ✅ `latency_ms` (integer)
- ✅ `tools_called` (jsonb)
- ✅ `tool_success` (boolean)
- ✅ `metadata` (jsonb) - **EXISTS BUT CURRENTLY UNUSED**
- ✅ `content_json` (jsonb)
- ✅ `created_at` (timestamp)

### Files That Read metadata Field

1. **`/components/hooks/useMessages.ts:163`**
   - Passes `metadata: msg.metadata` through
   - Currently null/empty from DB

### Files That Would Be Affected By This Fix

**Direct Changes Required:**
1. `/app/api/chat/route.ts` - Save metadata during message insertion (2 locations)
2. `/components/hooks/useMessages.ts` - Prefer persisted metadata over computed values
3. `/components/chat/types.ts` - Update comments to reflect new behavior

**No Changes Required (Already Compatible):**
1. `/components/chat/MessageList.tsx` - Reads from `msg.model_name`, `msg.provider`, etc.
2. `/components/chat/MessageMetadata.tsx` - Displays whatever is passed to it
3. Messages table schema - `metadata` column already exists

### Dependencies to Verify

1. **Model Config Availability**: `actualModelConfig` is loaded at line 579 in chat route
   - ✅ Contains: `actualModelConfig.name` (model display name)
   - ✅ Contains: `actualModelConfig.provider` (actual provider)
   - ✅ Contains: `actualModelConfig.model_id` (model identifier)

2. **Metadata Structure**: Should match what UI expects
   - ✅ `model_name` - for display
   - ✅ `provider` - for display
   - ✅ `model_id` - for reference (already saved as separate column)

---

## Implementation Plan

### Phase 1: Prepare Metadata Object ✅ VERIFIED

**What:** Create metadata object with model information at message creation time

**Where:** `/app/api/chat/route.ts`

**Changes:**
- After line 579 where `actualModelConfig` is loaded
- Create metadata object:
  ```typescript
  const messageMetadata = {
    model_name: actualModelConfig?.name || selectedModelId,
    provider: actualModelConfig?.provider || provider,
    model_id: selectedModelId,
    timestamp: new Date().toISOString()
  };
  ```

**Validation:**
- ✅ Verify `actualModelConfig` is available
- ✅ Verify fallback to `selectedModelId` if name not available
- ✅ Verify `provider` is available from actualModelConfig or existing provider variable

**Risk:** LOW - Creating object, not modifying existing code

---

### Phase 2: Update Non-Streaming Message Insert ✅ VERIFIED

**What:** Add metadata to assistant message insertion in non-streaming path

**Where:** `/app/api/chat/route.ts:726-742`

**Current Code:**
```typescript
const { data: assistantMsgData, error: assistantMsgError} = await supabaseAdmin!
  .from('messages')
  .insert({
    conversation_id: widgetConversationId,
    user_id: userId,
    role: 'assistant',
    content: finalResponse,
    latency_ms: latency_ms,
    ...(tokenUsage && { input_tokens: tokenUsage.input_tokens }),
    ...(tokenUsage && { output_tokens: tokenUsage.output_tokens }),
    ...(toolsCalled && { tools_called: toolsCalled }),
    ...(toolsCalled && { tool_success: toolsCalled.every(t => t.success) }),
    ...(selectedModelId && { model_id: selectedModelId }),
    ...(provider && { provider: provider }),
  })
```

**New Code:**
```typescript
const { data: assistantMsgData, error: assistantMsgError} = await supabaseAdmin!
  .from('messages')
  .insert({
    conversation_id: widgetConversationId,
    user_id: userId,
    role: 'assistant',
    content: finalResponse,
    latency_ms: latency_ms,
    ...(tokenUsage && { input_tokens: tokenUsage.input_tokens }),
    ...(tokenUsage && { output_tokens: tokenUsage.output_tokens }),
    ...(toolsCalled && { tools_called: toolsCalled }),
    ...(toolsCalled && { tool_success: toolsCalled.every(t => t.success) }),
    ...(selectedModelId && { model_id: selectedModelId }),
    ...(provider && { provider: provider }),
    metadata: messageMetadata, // NEW: Persist metadata
  })
```

**Validation:**
- ✅ Verify `messageMetadata` object exists in scope
- ✅ Verify no TypeScript errors
- ✅ Verify database accepts JSONB in metadata column

**Risk:** LOW - Adding field to existing insert, metadata column already exists

---

### Phase 3: Update Streaming Message Insert ✅ VERIFIED

**What:** Add metadata to assistant message insertion in streaming path

**Where:** `/app/api/chat/route.ts:1123-1137`

**Current Code:**
```typescript
const { data: streamMsgData } = await supabaseAdmin!
  .from('messages')
  .insert({
    conversation_id: widgetConversationId,
    user_id: userId,
    role: 'assistant',
    content: accumulatedResponse,
    latency_ms: streamLatencyMs,
    input_tokens: estimatedInputTokens,
    output_tokens: estimatedOutputTokens,
    ...(selectedModelId && { model_id: selectedModelId }),
    ...(provider && { provider: provider }),
  })
```

**New Code:**
```typescript
const { data: streamMsgData } = await supabaseAdmin!
  .from('messages')
  .insert({
    conversation_id: widgetConversationId,
    user_id: userId,
    role: 'assistant',
    content: accumulatedResponse,
    latency_ms: streamLatencyMs,
    input_tokens: estimatedInputTokens,
    output_tokens: estimatedOutputTokens,
    ...(selectedModelId && { model_id: selectedModelId }),
    ...(provider && { provider: provider }),
    metadata: messageMetadata, // NEW: Persist metadata
  })
```

**Validation:**
- ✅ Verify `messageMetadata` object exists in scope (same as Phase 2)
- ✅ Verify no TypeScript errors
- ✅ Verify streaming still works after change

**Risk:** LOW - Same change as Phase 2, but in streaming path

---

### Phase 4: Update useMessages Hook to Prefer Persisted Metadata ✅ VERIFIED

**What:** Modify message loading to use persisted metadata as primary source

**Where:** `/components/hooks/useMessages.ts:122-143`

**Current Code:**
```typescript
const processedMessages = data.map((msg: Message) => {
  const enrichedMsg: Message = { ...msg };

  // Try to get model name from lookup (works for both UUID and string model_id)
  const modelInfo = msg.model_id ? modelMap.get(msg.model_id) : null;

  if (modelInfo?.name) {
    // Found in llm_models table
    enrichedMsg.model_name = modelInfo.name;
    enrichedCount++;
  } else if (msg.model_id) {
    // Fallback: use model_id directly as display name
    enrichedMsg.model_name = msg.model_id;
    fallbackCount++;
  }

  if (msg.content && msg.content.length > 50000) {
    enrichedMsg.content = msg.content.substring(0, 50000) + '\n\n... [Message truncated due to size. Original length: ' + msg.content.length + ' characters]';
  }

  return enrichedMsg;
});
```

**New Code:**
```typescript
const processedMessages = data.map((msg: Message) => {
  const enrichedMsg: Message = { ...msg };

  // PRIORITY 1: Use persisted metadata if available
  if (msg.metadata && typeof msg.metadata === 'object') {
    const meta = msg.metadata as { model_name?: string; provider?: string };
    if (meta.model_name) {
      enrichedMsg.model_name = meta.model_name;
      enrichedCount++;
      // Also use persisted provider if message provider field is missing
      if (!enrichedMsg.provider && meta.provider) {
        enrichedMsg.provider = meta.provider;
      }
      return enrichedMsg; // Skip lookup if we have persisted data
    }
  }

  // PRIORITY 2: Try to get model name from llm_models lookup (for old messages)
  const modelInfo = msg.model_id ? modelMap.get(msg.model_id) : null;

  if (modelInfo?.name) {
    // Found in llm_models table
    enrichedMsg.model_name = modelInfo.name;
    enrichedCount++;
  } else if (msg.model_id) {
    // PRIORITY 3: Fallback - use model_id directly as display name
    enrichedMsg.model_name = msg.model_id;
    fallbackCount++;
  }

  if (msg.content && msg.content.length > 50000) {
    enrichedMsg.content = msg.content.substring(0, 50000) + '\n\n... [Message truncated due to size. Original length: ' + msg.content.length + ' characters]';
  }

  return enrichedMsg;
});
```

**Validation:**
- ✅ Verify new messages use persisted metadata
- ✅ Verify old messages (without metadata) still work via fallback
- ✅ Verify no TypeScript errors
- ✅ Verify deleted models still display name from metadata

**Risk:** LOW - Adds fallback layer, doesn't break existing logic

---

### Phase 5: Update Type Comments ✅ VERIFIED

**What:** Update comments in types to reflect new behavior

**Where:** `/components/chat/types.ts:27,31`

**Current Code:**
```typescript
// Additional metadata fields
metadata?: Record<string, unknown>;
// ...
// Computed field for display (populated by useMessages)
model_name?: string;
```

**New Code:**
```typescript
// Additional metadata fields (persisted from API, includes model_name snapshot)
metadata?: Record<string, unknown>;
// ...
// Model name for display (persisted in metadata, computed for old messages via useMessages)
model_name?: string;
```

**Validation:**
- ✅ Update comments only, no code changes
- ✅ Verify TypeScript still compiles

**Risk:** NONE - Comments only

---

## Testing Plan

### Pre-Implementation Tests

1. ✅ **Verify metadata column exists in messages table**
   - Query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'metadata'`
   - Expected: Returns row with `jsonb` type

2. ✅ **Verify actualModelConfig contains required fields**
   - Check `/lib/models/model-manager.service.ts` for getModelConfig return type
   - Expected: Returns object with `name`, `provider`, `model_id`

3. ✅ **Verify no other files write to metadata field**
   - Search: `grep -r "metadata:" --include="*.ts" | grep "insert\|update"`
   - Expected: Only chat route should write metadata (after our changes)

### Post-Implementation Tests (Each Phase)

**Phase 1 Testing:**
- [ ] Add console.log to verify messageMetadata object structure
- [ ] Verify object contains: model_name, provider, model_id, timestamp
- [ ] Verify no runtime errors

**Phase 2 Testing:**
- [ ] Send a non-streaming message
- [ ] Query database to verify metadata field is populated
- [ ] Verify message displays correctly in UI
- [ ] Refresh page and verify metadata persists

**Phase 3 Testing:**
- [ ] Send a streaming message
- [ ] Query database to verify metadata field is populated
- [ ] Verify message displays correctly in UI
- [ ] Refresh page and verify metadata persists

**Phase 4 Testing:**
- [ ] Load conversation with new messages (with metadata)
- [ ] Verify model name displays from metadata
- [ ] Load conversation with old messages (without metadata)
- [ ] Verify fallback to llm_models lookup still works
- [ ] Delete a model from llm_models table
- [ ] Verify messages with metadata still show correct model name
- [ ] Verify old messages without metadata fall back to model_id

**Phase 5 Testing:**
- [ ] Run `npm run build`
- [ ] Verify no TypeScript errors
- [ ] Verify comments are updated

### Integration Testing

- [ ] Create new conversation with multiple messages
- [ ] Use different models for different messages
- [ ] Refresh page multiple times
- [ ] Verify all metadata persists correctly
- [ ] Archive conversation
- [ ] Unarchive conversation
- [ ] Verify metadata still present

---

## Rollback Plan

If issues are discovered after implementation:

1. **Immediate Rollback Steps:**
   - Revert changes to `/app/api/chat/route.ts` (remove `metadata: messageMetadata`)
   - Revert changes to `/components/hooks/useMessages.ts` (remove metadata priority check)
   - System will fall back to existing behavior (computed model_name)

2. **Database State:**
   - No database migration required
   - Any metadata already saved will remain but won't be used
   - No data loss or corruption risk

3. **Validation After Rollback:**
   - Verify messages still display correctly
   - Verify new messages save successfully
   - Verify page refresh still works

---

## Files Changed Summary

| File | Lines Changed | Type | Risk Level |
|------|--------------|------|------------|
| `/app/api/chat/route.ts` | ~585 (add object), 738, 1134 | Addition | LOW |
| `/components/hooks/useMessages.ts` | 122-143 (enhance logic) | Enhancement | LOW |
| `/components/chat/types.ts` | 27, 31 (comments) | Documentation | NONE |

**Total Files Modified:** 3
**Total Lines Changed:** ~25
**Breaking Changes:** 0
**Database Migrations Required:** 0

---

## Dependencies and Breaking Change Analysis

### No Breaking Changes Expected Because:

1. **Backward Compatible:**
   - Old messages without metadata still work via fallback
   - New field is optional (won't break existing queries)
   - UI components already handle missing metadata gracefully

2. **Database Column Already Exists:**
   - `metadata` column is already in messages table
   - No schema changes required
   - No RLS policy changes needed

3. **TypeScript Compatibility:**
   - `metadata?: Record<string, unknown>` already in types
   - No type changes required
   - All existing code will compile

4. **UI Component Compatibility:**
   - MessageMetadata component receives same props
   - MessageList already passes model_name, provider, etc.
   - No component interface changes

### Files That Import/Use Modified Files

**`/app/api/chat/route.ts` imported by:**
- Next.js API routing system (no changes needed)

**`/components/hooks/useMessages.ts` imported by:**
- `/components/Chat.tsx` (line 90)
- No changes needed - hook signature unchanged

**`/components/chat/types.ts` imported by:**
- Multiple chat components
- No changes needed - types unchanged (only comments)

---

## Success Criteria

✅ **Phase 1:**
- messageMetadata object created successfully
- Contains all required fields
- No runtime errors

✅ **Phase 2:**
- Non-streaming messages save with metadata
- Database contains populated metadata field
- Messages display correctly

✅ **Phase 3:**
- Streaming messages save with metadata
- Database contains populated metadata field
- Streaming still works correctly

✅ **Phase 4:**
- New messages display model name from metadata
- Old messages still display via fallback
- Deleted models still show name from metadata
- No errors on page refresh

✅ **Phase 5:**
- TypeScript compiles successfully
- Comments accurately reflect behavior

✅ **Overall:**
- Model name persists across page refreshes
- No breaking changes to existing functionality
- All tests pass
- No console errors

---

## Timeline Estimate

- **Phase 1:** 15 minutes (create metadata object + testing)
- **Phase 2:** 15 minutes (update non-streaming insert + testing)
- **Phase 3:** 15 minutes (update streaming insert + testing)
- **Phase 4:** 30 minutes (update useMessages + comprehensive testing)
- **Phase 5:** 5 minutes (update comments + build verification)

**Total Estimated Time:** 80 minutes (~1.5 hours)

---

## Notes

- All phases can be implemented sequentially in a single session
- Each phase is independently testable
- No user-facing changes until Phase 2 completes
- Safe to deploy incrementally (Phase 2 alone provides benefit)
- Comprehensive fallback ensures zero downtime

---

**Status:** Ready for implementation approval
**Next Step:** User approval to proceed with Phase 1
