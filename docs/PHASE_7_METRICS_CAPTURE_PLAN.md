# Phase 7: Enhanced Metrics Capture Implementation Plan

**Feature:** Metrics Capture for Model Training & Evaluation
**Estimated Time:** 2-3 hours
**Priority:** HIGH - Foundation for training pipeline
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [Database Changes](#database-changes)
4. [Implementation Phases](#implementation-phases)
5. [Verification Checklist](#verification-checklist)
6. [Rollback Plan](#rollback-plan)

---

## Overview

### Objective
Add comprehensive metrics capture to enable LLM training, evaluation, and fine-tuning workflows.

### Success Criteria
- ✅ All message inserts capture latency, tokens, tool calls
- ✅ Database schema supports metrics without breaking existing data
- ✅ Evaluation UI allows rating and tagging responses
- ✅ No breaking changes to current functionality
- ✅ All metrics are optional (nullable columns)

### Key Principle
**Never assume - always verify before implementing**

---

## Current State Analysis

### Database Schema (Verified)
**File:** `/docs/COMPLETE_SCHEMA.sql` (Lines 43-54)

**Current `messages` table:**
```sql
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_id UUID,
    streaming BOOLEAN DEFAULT false
);
```

### Message Insertion Points (Verified)

**File:** `/components/Chat.tsx`

**Location 1: User Message Insert (Lines 238-247)**
```typescript
const { data: msgData } = await supabase
  .from("messages")
  .insert({
    conversation_id: activeId,
    user_id: user.id,
    role: "user",
    content: userMessage,
  })
  .select()
  .single();
```

**Location 2: Assistant Message Insert (Lines 366-375)**
```typescript
const { data: aiMsg } = await supabase
  .from("messages")
  .insert({
    conversation_id: activeId,
    user_id: user.id,
    role: "assistant",
    content: assistantMessage,
  })
  .select()
  .single();
```

### API Streaming (Verified)
**File:** `/app/api/chat/route.ts`
- **Does NOT** save messages directly
- **Does** stream responses to frontend
- Frontend (Chat.tsx) handles all database writes
- **Metrics must be captured in frontend before database insert**

---

## Database Changes

### Phase B.1: Add Metrics Columns to Messages Table

**SQL Migration File:** `docs/migrations/001_add_metrics_columns.sql`

```sql
-- Migration: Add metrics capture columns to messages table
-- Date: 2025-10-13
-- Description: Adds performance and tool tracking columns for ML training

-- Add metrics columns (all nullable for backward compatibility)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS tools_called JSONB,
ADD COLUMN IF NOT EXISTS tool_success BOOLEAN,
ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN,
ADD COLUMN IF NOT EXISTS error_type TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_tool_success
ON messages(tool_success) WHERE tool_success IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_error_type
ON messages(error_type) WHERE error_type IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN messages.latency_ms IS 'Response latency in milliseconds';
COMMENT ON COLUMN messages.input_tokens IS 'Number of input tokens sent to LLM';
COMMENT ON COLUMN messages.output_tokens IS 'Number of output tokens from LLM';
COMMENT ON COLUMN messages.tools_called IS 'JSON array of tools/functions called';
COMMENT ON COLUMN messages.tool_success IS 'Whether tool calls succeeded';
COMMENT ON COLUMN messages.fallback_used IS 'Whether model fell back instead of using tool';
COMMENT ON COLUMN messages.error_type IS 'Type of error if one occurred';
```

**Verification Steps:**
1. Execute SQL in Supabase SQL Editor
2. Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'messages';`
3. Verify existing data intact: `SELECT COUNT(*) FROM messages;`
4. Test insert with new columns: `INSERT INTO messages (..., latency_ms) VALUES (..., 1200);`

---

### Phase B.2: Create Message Evaluations Table

**SQL Migration File:** `docs/migrations/002_create_evaluations_table.sql`

```sql
-- Migration: Create message evaluations table
-- Date: 2025-10-13
-- Description: Stores human evaluations for ML training

CREATE TABLE IF NOT EXISTS message_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  success BOOLEAN,
  failure_tags TEXT[],
  notes TEXT,
  expected_behavior TEXT,
  actual_behavior TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_evaluations_message_id
ON message_evaluations(message_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id
ON message_evaluations(evaluator_id);

CREATE INDEX IF NOT EXISTS idx_evaluations_success
ON message_evaluations(success) WHERE success IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evaluations_rating
ON message_evaluations(rating) WHERE rating IS NOT NULL;

-- RLS Policies
ALTER TABLE message_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evaluations"
ON message_evaluations FOR SELECT
USING (auth.uid() = evaluator_id);

CREATE POLICY "Users can insert their own evaluations"
ON message_evaluations FOR INSERT
WITH CHECK (auth.uid() = evaluator_id);

CREATE POLICY "Users can update their own evaluations"
ON message_evaluations FOR UPDATE
USING (auth.uid() = evaluator_id);

-- Comments
COMMENT ON TABLE message_evaluations IS 'Human evaluations of LLM responses for training';
COMMENT ON COLUMN message_evaluations.failure_tags IS 'Array of failure types: hallucination, wrong_tool, etc.';
```

**Verification Steps:**
1. Execute SQL in Supabase SQL Editor
2. Verify table exists: `SELECT * FROM information_schema.tables WHERE table_name = 'message_evaluations';`
3. Verify RLS enabled: `SELECT * FROM pg_tables WHERE tablename = 'message_evaluations';`
4. Test insert: `INSERT INTO message_evaluations (message_id, evaluator_id, rating, success) VALUES (...);`

---

## Implementation Phases

### Phase B.3: Capture Response Timing in Frontend

**File:** `/components/Chat.tsx`
**Insertion Point:** Line 258 (before fetch call)

**Change 1: Add timing variables at start of handleSend**
```typescript
// Line 258 - Add timing capture
try {
  const requestStartTime = Date.now(); // METRIC: Start timer

  // Prepare messages for OpenAI API
  const conversationMessages = [...messages, msgData].map(m => ({
```

**Change 2: Capture latency after streaming completes**
```typescript
// Line 363 - After streaming loop ends, calculate latency
      }
    }
  }

  // METRIC: Calculate response latency
  const latencyMs = Date.now() - requestStartTime;
  console.log('[Chat] Response latency:', latencyMs, 'ms');

  // Save final assistant message to database
```

**Change 3: Update assistant message insert with metrics**
```typescript
// Line 366-375 - Replace assistant message insert
const { data: aiMsg } = await supabase
  .from("messages")
  .insert({
    conversation_id: activeId,
    user_id: user.id,
    role: "assistant",
    content: assistantMessage,
    latency_ms: latencyMs, // NEW: Add latency
    // TODO: Add token counts in next phase
    // TODO: Add tool calls in next phase
  })
  .select()
  .single();
```

**Verification Steps:**
1. Read Chat.tsx lines 258-275 to verify current structure
2. Make changes in separate Edit calls (max 30 lines each)
3. Save file and check for TypeScript errors
4. Test in browser: Send message and check console for latency log
5. Verify database: `SELECT id, content, latency_ms FROM messages ORDER BY created_at DESC LIMIT 5;`
6. Confirm latency_ms is populated for new messages

---

### Phase B.4: Capture Token Usage from API Response

**Problem:** API doesn't currently return token counts
**Solution:** Add token metadata to streaming response

**File:** `/app/api/chat/route.ts`
**Insertion Point:** Lines 180-215 (non-streaming tool path)

**Change 1: Capture tokens from LLM providers**

For Anthropic (lines 142-147):
```typescript
// Anthropic returns usage in response
// Need to capture and pass through stream
```

For OpenAI (lines 148-154):
```typescript
// OpenAI returns usage in completion
// Need to capture and pass through stream
```

**Change 2: Add token metadata to stream**
```typescript
// After line 195 (GraphRAG metadata)
const metaData = `data: ${JSON.stringify({
  type: 'graphrag_metadata',
  citations,
  contextsUsed: graphRAGMetadata.sources?.length || 0
})}\n\n`;
controller.enqueue(encoder.encode(metaData));

// NEW: Add token usage metadata
const tokenData = `data: ${JSON.stringify({
  type: 'token_usage',
  input_tokens: inputTokens,
  output_tokens: outputTokens
})}\n\n`;
controller.enqueue(encoder.encode(tokenData));
```

**File:** `/components/Chat.tsx`
**Insertion Point:** Lines 320-340 (streaming chunk processing)

**Change 3: Capture token metadata in frontend**
```typescript
// Add variables at line 293
let graphragCitations: Citation[] | undefined;
let graphragContextsUsed: number | undefined;
let inputTokens: number | undefined;   // NEW
let outputTokens: number | undefined;  // NEW

// Add handler in streaming loop (after line 325)
// Capture token usage metadata
else if (parsed.type === 'token_usage') {
  inputTokens = parsed.input_tokens;
  outputTokens = parsed.output_tokens;
  console.log('[Chat] Token usage:', inputTokens, 'in,', outputTokens, 'out');
}
```

**Change 4: Update database insert with tokens**
```typescript
// Update line 366-375 insert
const { data: aiMsg } = await supabase
  .from("messages")
  .insert({
    conversation_id: activeId,
    user_id: user.id,
    role: "assistant",
    content: assistantMessage,
    latency_ms: latencyMs,
    input_tokens: inputTokens,    // NEW
    output_tokens: outputTokens,  // NEW
  })
  .select()
  .single();
```

**Verification Steps:**
1. Read current streaming logic in both files
2. Verify LLM providers return token usage
3. Update API route to emit token metadata
4. Update Chat.tsx to capture token metadata
5. Test in browser: Check console for token logs
6. Verify database: `SELECT id, input_tokens, output_tokens FROM messages ORDER BY created_at DESC LIMIT 5;`
7. Confirm token counts are populated

**⚠️ CRITICAL:** This phase requires verifying that the LLM SDK actually returns token usage. Must check Anthropic/OpenAI SDK docs first.

---

### Phase B.5: Capture Tool Call Information

**File:** `/lib/llm/openai.ts` or `/lib/llm/anthropic.ts`
**Need to verify:** Where tool calls are tracked

**Search Pattern:**
```bash
grep -n "tool_calls\|function_call\|toolCall" /home/juanc/Desktop/claude_desktop/web-ui/lib/llm/*.ts
```

**Approach:**
1. Find where `runLLMWithToolCalls` is implemented
2. Track which tools were called
3. Track success/failure of each tool
4. Return tool metadata alongside response
5. Pass tool metadata through stream (similar to tokens)
6. Capture in frontend and save to database

**Database Update:**
```typescript
// In Chat.tsx message insert
const { data: aiMsg } = await supabase
  .from("messages")
  .insert({
    conversation_id: activeId,
    user_id: user.id,
    role: "assistant",
    content: assistantMessage,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    tools_called: toolsMetadata,        // NEW: JSON array
    tool_success: allToolsSucceeded,    // NEW: Boolean
    fallback_used: fallbackDetected,    // NEW: Boolean
  })
  .select()
  .single();
```

**Verification Steps:**
1. Search for tool call implementation
2. Read tool execution code
3. Identify how to track tool usage
4. Implement tracking without breaking existing functionality
5. Test with tools enabled
6. Verify database: `SELECT id, tools_called, tool_success FROM messages WHERE tools_called IS NOT NULL LIMIT 5;`

**⚠️ NOTE:** This phase depends on understanding current tool implementation. Must read and verify before coding.

---

### Phase B.6: Add Error Tracking

**File:** `/components/Chat.tsx`
**Insertion Point:** Lines 392-398 (error handling)

**Current Error Handler:**
```typescript
} catch (error) {
  console.error("[Chat] Error getting AI response:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  setError(`Failed to get AI response: ${errorMessage}`);
  // Remove temporary message on error
  setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
}
```

**Enhanced Error Handler:**
```typescript
} catch (error) {
  console.error("[Chat] Error getting AI response:", error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  // METRIC: Capture error type
  let errorType = 'unknown_error';
  if (error instanceof Error) {
    if (error.message.includes('timeout')) errorType = 'timeout';
    else if (error.message.includes('rate limit')) errorType = 'rate_limit';
    else if (error.message.includes('context length')) errorType = 'context_length';
    else if (error.message.includes('API')) errorType = 'api_error';
  }

  // Save error message to database for analysis
  const errorLatency = Date.now() - requestStartTime;
  await supabase
    .from("messages")
    .insert({
      conversation_id: activeId,
      user_id: user.id,
      role: "assistant",
      content: `[ERROR] ${errorMessage}`,
      latency_ms: errorLatency,
      error_type: errorType, // NEW: Track error type
    })
    .select()
    .single()
    .catch(err => console.error('[Chat] Failed to save error message:', err));

  setError(`Failed to get AI response: ${errorMessage}`);
  // Remove temporary message on error
  setMessages((msgs) => msgs.filter(m => !m.id.startsWith('temp-')));
}
```

**Verification Steps:**
1. Test error scenarios (invalid API key, timeout, etc.)
2. Verify error messages saved to database
3. Check error_type is correctly categorized
4. Verify error messages don't break UI
5. Query: `SELECT id, content, error_type, latency_ms FROM messages WHERE error_type IS NOT NULL;`

---

### Phase B.7: Create Evaluation API Endpoint

**File:** `/app/api/evaluate/route.ts` (NEW FILE)

```typescript
// API endpoint for message evaluation
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { messageId, rating, success, failureTags, notes, expectedBehavior, actualBehavior } = await req.json();

    // Get user from auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Insert or update evaluation
    const { data, error } = await supabase
      .from('message_evaluations')
      .upsert({
        message_id: messageId,
        evaluator_id: user.id,
        rating,
        success,
        failure_tags: failureTags || [],
        notes,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Evaluation error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('[API] Evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Verification Steps:**
1. Create file at correct path
2. Test POST request with curl or Postman
3. Verify authentication works
4. Verify data saved to database
5. Test upsert behavior (update existing evaluation)

---

## Verification Checklist

### Database Verification
- [ ] Execute migration 001_add_metrics_columns.sql
- [ ] Execute migration 002_create_evaluations_table.sql
- [ ] Verify all columns exist: `\d messages` in psql
- [ ] Verify indexes created: `\di` in psql
- [ ] Test sample insert with all new columns
- [ ] Verify existing data not affected
- [ ] Verify RLS policies work

### Code Verification (Per Phase)
- [ ] Read target file before making changes
- [ ] Identify exact line numbers for insertion
- [ ] Make changes in max 30-line blocks
- [ ] Check for TypeScript compilation errors
- [ ] Test in development environment
- [ ] Verify console logs show metrics
- [ ] Verify database receives metrics
- [ ] Check no breaking changes to existing features

### Integration Testing
- [ ] Send message and verify latency captured
- [ ] Send message and verify tokens captured
- [ ] Send message with tools and verify tool tracking
- [ ] Trigger error and verify error type captured
- [ ] Rate a message and verify evaluation saved
- [ ] Check all metrics visible in database
- [ ] Verify GraphRAG still works
- [ ] Verify export functionality not broken

---

## Rollback Plan

### If Database Migration Fails
```sql
-- Rollback metrics columns
ALTER TABLE messages
DROP COLUMN IF EXISTS latency_ms,
DROP COLUMN IF EXISTS input_tokens,
DROP COLUMN IF EXISTS output_tokens,
DROP COLUMN IF EXISTS tools_called,
DROP COLUMN IF EXISTS tool_success,
DROP COLUMN IF EXISTS fallback_used,
DROP COLUMN IF EXISTS error_type;

-- Rollback evaluations table
DROP TABLE IF EXISTS message_evaluations CASCADE;
```

### If Code Changes Fail
1. Revert Chat.tsx to previous version
2. Revert API route changes
3. Remove new API endpoint
4. Clear .next cache: `rm -rf .next/`
5. Restart dev server: `npm run dev`

### If Partial Implementation
- All columns are nullable - can deploy partially
- Can implement phases incrementally
- Missing metrics won't break existing functionality
- Can always add remaining phases later

---

## Next Steps After Phase 7

1. **Phase 8: JSONL Export** - Export messages with metrics in training format
2. **Phase 9: Evaluation UI** - Add rating/tagging UI to messages
3. **Phase 10: Analytics Dashboard** - Visualize metrics and trends

---

**Document Version:** 1.0
**Created:** 2025-10-13
**Last Updated:** 2025-10-13
**Status:** Ready for User Approval → Implementation

