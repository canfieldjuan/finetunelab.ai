# Trace Data Implementation Plan
**Date**: 2025-11-29
**Status**: Planning - Awaiting Approval
**Priority**: Medium - Analytics Enhancement

## Executive Summary

This plan addresses the implementation of **LLM trace data capture** to enable debugging, performance monitoring, and quality analysis through the existing TraceView UI component. Currently, the trace infrastructure exists but no traces are being captured.

**Current State**:
- ✅ Trace API exists (`/api/analytics/traces`)
- ✅ TraceView UI component implemented
- ✅ Database schema ready (`llm_traces` table)
- ✅ "View Trace" button in Quality Issues table
- ❌ **Zero traces being captured** (no instrumentation)

**Goal**: Implement automatic trace capture for all LLM operations to provide visibility into request flows, performance, costs, and errors.

---

## Problem Statement

### Current Issue
When users click "View Trace" in the Quality Issues - Detailed View:
```
No trace data available for this message.
Traces are only captured when the trace API is enabled.
```

### Root Cause
The application does not instrument LLM calls with trace capture. Messages are saved to the database, but no corresponding trace records are created in `llm_traces` table.

### Verification Results
```bash
# Database query results (verified 2025-11-29):
Total traces in llm_traces table: 0
Total messages in messages table: 296
Total evaluations in message_evaluations: 8
```

**Gap**: 296 messages exist, but 0 traces captured.

---

## Technical Architecture

### Current Message Flow (Without Tracing)
```
User Input → /api/chat → LLM Provider → Response → Save Message → Return to User
                                                        ↓
                                                  messages table
```

### Proposed Message Flow (With Tracing)
```
User Input → /api/chat → Start Trace → LLM Provider → End Trace → Save Message → Return
                            ↓                             ↓            ↓
                       llm_traces              llm_traces (update)  messages + trace_id
```

### Database Schema (Existing)

**`llm_traces` table** (already created):
```sql
- id: UUID (PK)
- user_id: UUID (FK to auth.users)
- conversation_id: UUID (FK to conversations)
- message_id: UUID (FK to messages)
- trace_id: TEXT (logical trace identifier)
- parent_trace_id: TEXT (for nested operations)
- span_id: TEXT (unique span identifier)
- span_name: TEXT (e.g., "llm.completion", "tool.web_search")
- start_time: TIMESTAMPTZ
- end_time: TIMESTAMPTZ
- duration_ms: NUMERIC
- operation_type: TEXT (e.g., "llm_call", "tool_call", "retrieval")
- model_name: TEXT
- model_provider: TEXT
- status: TEXT (pending, running, completed, failed, cancelled)
- error_message: TEXT
- input_tokens: INTEGER
- output_tokens: INTEGER
- total_tokens: INTEGER
- cost_usd: NUMERIC
- input_data: JSONB
- output_data: JSONB
- metadata: JSONB
- created_at: TIMESTAMPTZ
```

---

## Phased Implementation Plan

### Phase 1: Foundation & Core Infrastructure (Week 1)
**Goal**: Create reusable trace capture service
**Risk**: Low
**Breaking Changes**: None

#### 1.1 Create Trace Service Module
**File**: `/lib/tracing/trace.service.ts` (NEW)

**Purpose**: Centralized service for trace lifecycle management

**Functions to implement**:
```typescript
- startTrace(params: StartTraceParams): Promise<TraceContext>
- endTrace(context: TraceContext, result: TraceResult): Promise<void>
- captureError(context: TraceContext, error: Error): Promise<void>
- createChildSpan(parent: TraceContext, name: string): Promise<TraceContext>
```

**Key features**:
- Generate unique trace_id and span_id
- Handle trace hierarchy (parent/child relationships)
- Calculate durations automatically
- Batch trace writes for performance
- Graceful degradation (never block main flow)

**Dependencies**:
- Existing `/api/analytics/traces` endpoint
- Supabase client for auth

**Testing**:
- Unit tests for ID generation
- Unit tests for duration calculation
- Integration test with traces API

#### 1.2 Create Type Definitions
**File**: `/lib/tracing/types.ts` (NEW)

```typescript
export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  startTime: Date;
}

export interface StartTraceParams {
  spanName: string;
  operationType: 'llm_call' | 'tool_call' | 'retrieval' | 'embedding';
  modelName?: string;
  modelProvider?: string;
  conversationId?: string;
  messageId?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceResult {
  endTime: Date;
  status: 'completed' | 'failed' | 'cancelled';
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  inputData?: unknown;
  outputData?: unknown;
  errorMessage?: string;
}
```

**Affected files**: None (new file)

#### 1.3 Environment Configuration
**File**: `.env.example` (UPDATE)

Add optional feature flag:
```bash
# Tracing (optional - defaults to true in production)
ENABLE_TRACING=true
```

**File**: `/lib/config/tracing.config.ts` (NEW)
```typescript
export const tracingConfig = {
  enabled: process.env.ENABLE_TRACING !== 'false',
  batchSize: 10,
  batchIntervalMs: 1000,
};
```

**Breaking changes**: None (additive only)

---

### Phase 2: Chat API Integration (Week 2)
**Goal**: Instrument main chat endpoint
**Risk**: Medium
**Breaking Changes**: Potential (requires careful testing)

#### 2.1 Identify Instrumentation Points
**File**: `/app/api/chat/route.ts`

**Lines to instrument** (verified from code review):

1. **Line 693-720**: Widget mode - assistant message insert
   - Instrument: Full LLM call trace
   - Capture: Model, tokens, latency, tools

2. **Line 1086-1096**: Widget mode streaming - assistant message insert
   - Instrument: Streaming LLM trace
   - Capture: Estimated tokens, latency

**Search pattern used**:
```bash
grep -n "\.insert({" app/api/chat/route.ts | grep messages
```

**Verification needed**: Non-widget mode message saves (client-side?)

#### 2.2 Implementation Strategy

**Approach**: Wrapper pattern (non-invasive)

```typescript
// Before (current code - line 708):
const { data: assistantMsgData, error: assistantMsgError} = await supabaseAdmin!
  .from('messages')
  .insert({
    conversation_id: widgetConversationId,
    user_id: userId,
    role: 'assistant',
    content: finalResponse,
    latency_ms: latency_ms,
    // ... rest of fields
  });

// After (with tracing):
import { traceService } from '@/lib/tracing/trace.service';

// Start trace before LLM call
const traceContext = await traceService.startTrace({
  spanName: 'llm.completion',
  operationType: 'llm_call',
  modelName: selectedModelId || undefined,
  modelProvider: provider || undefined,
  conversationId: widgetConversationId,
});

// ... existing LLM call ...

// End trace after message saved
if (assistantMsgData?.id) {
  await traceService.endTrace(traceContext, {
    endTime: new Date(),
    status: 'completed',
    inputTokens: tokenUsage?.input_tokens,
    outputTokens: tokenUsage?.output_tokens,
    costUsd: calculateCost(tokenUsage, selectedModelId),
    messageId: assistantMsgData.id,
  });
}
```

**Error handling**:
```typescript
try {
  // LLM call
} catch (error) {
  await traceService.captureError(traceContext, error);
  throw error; // Re-throw to preserve existing error handling
}
```

#### 2.3 Testing Requirements

**Critical tests**:
1. Verify message still saves correctly (regression test)
2. Verify trace is created with correct message_id link
3. Verify error in trace doesn't break message save
4. Verify streaming mode works correctly
5. Verify non-widget mode still works

**Test file**: `/tests/api/chat-tracing.test.ts` (NEW)

#### 2.4 Files Affected

| File | Change Type | Lines | Risk | Validation |
|------|-------------|-------|------|------------|
| `/app/api/chat/route.ts` | Modify | 693-720, 1086-1096 | Medium | Full integration test |
| `/lib/tracing/trace.service.ts` | Create | N/A | Low | Unit tests |
| `/lib/tracing/types.ts` | Create | N/A | None | Type checking |

---

### Phase 3: Tool Call Tracing (Week 3)
**Goal**: Trace tool executions with parent-child relationships
**Risk**: Low
**Breaking Changes**: None

#### 3.1 Instrumentation Points

**File**: `/app/api/chat/route.ts`

**Search pattern**:
```typescript
grep -n "executeTool" app/api/chat/route.ts
```

**Tool calls to trace**:
- Web search
- GraphRAG retrieval
- Custom tools

**Implementation**:
```typescript
// Create child span for tool call
const toolTraceContext = await traceService.createChildSpan(
  parentTraceContext,
  `tool.${toolName}`
);

const toolResult = await executeTool(...);

await traceService.endTrace(toolTraceContext, {
  endTime: new Date(),
  status: toolResult.success ? 'completed' : 'failed',
  outputData: toolResult,
});
```

#### 3.2 Hierarchy Visualization

```
📦 llm.completion (trace_abc123) - 2500ms
├─ 🔍 retrieval (span_1) - 300ms
│  └─ graphrag.search (span_1a) - 280ms
├─ 🤖 llm_call (span_2) - 2100ms
└─ 🔧 tool.web_search (span_3) - 400ms
```

**Benefit**: Users can see which tool call caused slow performance or errors

---

### Phase 4: UI Enhancements (Week 4)
**Goal**: Improve trace viewer with filtering and export
**Risk**: Low
**Breaking Changes**: None

#### 4.1 Empty State Improvement

**File**: `/components/analytics/JudgmentsTable.tsx` (lines 285-294)

**Current**:
```
No trace data available for this message.
Traces are only captured when the trace API is enabled.
```

**Proposed** (after Phase 2):
```
No trace data available for this message.

This message was created before trace capture was enabled (Date: {messageDate}).
Newer messages will have trace data automatically captured.
```

#### 4.2 Trace Filters

**File**: `/components/analytics/TraceView.tsx`

**Add filters**:
- Operation type (llm_call, tool_call, retrieval)
- Status (completed, failed)
- Model provider (OpenAI, Anthropic, etc.)
- Duration range (>1s, >5s, etc.)

#### 4.3 Export Functionality

**Feature**: Export trace as JSON for external analysis

**Button**: "Export Trace" in TraceView modal

---

## Rollout Strategy

### Development Environment
1. Enable `ENABLE_TRACING=true` in dev `.env`
2. Run full test suite
3. Manual testing with Quality Issues flow
4. Verify traces appear in database

### Staging Environment
1. Deploy Phase 1 (service only, no instrumentation)
2. Monitor for errors (should be none)
3. Deploy Phase 2 (chat API instrumentation)
4. Test with real traffic
5. Verify trace data quality

### Production Rollout
1. **Week 1**: Deploy Phase 1 (foundation) - Zero risk
2. **Week 2**: Deploy Phase 2 (chat tracing) - Feature flag enabled
3. **Week 3**: Monitor trace data quality, fix issues
4. **Week 4**: Deploy Phases 3-4 (tools + UI)

### Rollback Plan
If issues arise:
1. Set `ENABLE_TRACING=false` in environment
2. Trace service will no-op, no traces captured
3. Application continues working normally
4. No database cleanup needed (traces are additive)

---

## Risk Assessment

### High Risk Items
None identified.

### Medium Risk Items
1. **Chat API instrumentation** (Phase 2.2)
   - **Risk**: Could break message saving if trace fails
   - **Mitigation**: Wrap in try-catch, never block main flow
   - **Testing**: Comprehensive integration tests

### Low Risk Items
1. **Trace service creation** (Phase 1.1)
   - **Risk**: Minimal, new isolated code
   - **Mitigation**: Unit tests, no integration initially

---

## Success Metrics

### Technical Metrics
- ✅ 100% of LLM calls create trace records
- ✅ Trace-to-message linking: 100% accuracy
- ✅ Trace capture latency: <50ms overhead
- ✅ Zero trace-related errors in production

### User Metrics
- ✅ "View Trace" shows data for 100% of new messages
- ✅ Users can identify slow operations from waterfall view
- ✅ Users can debug failed messages with trace data

### Data Quality Metrics
- ✅ Token counts match between message and trace
- ✅ Duration_ms matches latency_ms in messages table
- ✅ Cost calculations accurate to ±1%

---

## Testing Plan

### Unit Tests (Phase 1)
**File**: `/tests/lib/tracing/trace.service.test.ts`

```typescript
describe('TraceService', () => {
  test('generates unique trace IDs', async () => {
    const id1 = traceService.generateTraceId();
    const id2 = traceService.generateTraceId();
    expect(id1).not.toBe(id2);
  });

  test('calculates duration correctly', () => {
    const start = new Date('2025-01-01T00:00:00Z');
    const end = new Date('2025-01-01T00:00:02.5Z');
    const duration = traceService.calculateDuration(start, end);
    expect(duration).toBe(2500);
  });

  test('handles trace errors gracefully', async () => {
    // Simulate trace API failure
    const context = await traceService.startTrace({...});
    // Should not throw even if API fails
    await expect(traceService.endTrace(context, {...})).resolves.not.toThrow();
  });
});
```

### Integration Tests (Phase 2)
**File**: `/tests/api/chat-tracing.integration.test.ts`

```typescript
describe('Chat API Tracing', () => {
  test('creates trace for successful LLM call', async () => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [...] }),
    });

    expect(response.ok).toBe(true);

    // Verify message saved
    const message = await supabase.from('messages')...;
    expect(message).toBeDefined();

    // Verify trace created and linked
    const trace = await supabase.from('llm_traces')
      .select('*')
      .eq('message_id', message.id)
      .single();

    expect(trace).toBeDefined();
    expect(trace.status).toBe('completed');
    expect(trace.operation_type).toBe('llm_call');
  });

  test('captures trace on LLM failure', async () => {
    // Trigger LLM error (invalid API key, etc.)
    const response = await fetch('/api/chat', {...});

    // Verify trace captured with error
    const trace = await supabase.from('llm_traces')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(trace.error_message).toBeDefined();
    expect(trace.status).toBe('failed');
  });
});
```

### Manual Testing Checklist
- [ ] Send chat message in widget mode
- [ ] Verify message appears in chat
- [ ] Check database: message saved in `messages` table
- [ ] Check database: trace saved in `llm_traces` table
- [ ] Verify `message_id` matches between tables
- [ ] Go to Analytics → Quality Issues
- [ ] Create evaluation with failure tag
- [ ] Click "View examples"
- [ ] Click "View Trace" button
- [ ] Verify trace waterfall displays correctly
- [ ] Check trace shows correct model, tokens, duration
- [ ] Test with different models (OpenAI, Anthropic)
- [ ] Test with tool calls (web search)
- [ ] Verify child traces appear nested

---

## Files to Create/Modify

### New Files (7 total)
1. `/lib/tracing/trace.service.ts` - Core trace service
2. `/lib/tracing/types.ts` - Type definitions
3. `/lib/config/tracing.config.ts` - Configuration
4. `/tests/lib/tracing/trace.service.test.ts` - Unit tests
5. `/tests/api/chat-tracing.integration.test.ts` - Integration tests
6. `/docs/progress/TRACE_IMPLEMENTATION_PHASE_1_COMPLETE.md` - Phase 1 log
7. `/docs/progress/TRACE_IMPLEMENTATION_PHASE_2_COMPLETE.md` - Phase 2 log

### Modified Files (2 total)
1. `/app/api/chat/route.ts` - Add trace instrumentation (Phase 2)
2. `/components/analytics/JudgmentsTable.tsx` - Update empty state (Phase 4)

### Optional Enhancements (3 total)
1. `/components/analytics/TraceView.tsx` - Add filters (Phase 4)
2. `/lib/llm/unified-client.ts` - Auto-trace all LLM calls (Future)
3. `.env.example` - Document ENABLE_TRACING flag

---

## Dependencies & Prerequisites

### Required
- ✅ Supabase connection (already configured)
- ✅ `llm_traces` table schema (already exists)
- ✅ `/api/analytics/traces` endpoint (already implemented)
- ✅ Authentication system (already working)

### Optional
- [ ] Cost calculation utility (for cost_usd field)
- [ ] Batching/queue system (for high-volume tracing)

---

## Cost & Performance Impact

### Database Storage
**Estimate**: ~2KB per trace record

**Monthly volume** (assuming 10,000 messages/month):
- Traces: 10,000 records × 2KB = 20MB/month
- Cost: Negligible on Supabase free tier

### API Latency
**Added overhead**: <50ms per request
- Trace ID generation: ~1ms
- Database insert: ~20-30ms (async, non-blocking)
- Total: ~30-50ms

**Mitigation**: Batch trace writes in background

### Network
**Impact**: Minimal
- Trace API calls are async
- No impact on user-facing response time

---

## Documentation Updates

### User Documentation
**File**: `/docs/TRACE_USER_GUIDE.md` (NEW)

**Topics**:
- What are traces?
- How to view traces for failed messages
- Understanding the waterfall view
- Identifying performance bottlenecks
- Debugging with trace data

### Developer Documentation
**File**: `/docs/TRACE_DEVELOPER_GUIDE.md` (NEW)

**Topics**:
- How to add tracing to new features
- Trace service API reference
- Creating child spans
- Best practices for trace capture

---

## Open Questions

### 1. Non-widget mode message saves
**Question**: Where are messages saved in non-widget mode?
**Action**: Need to search client-side code (components/Chat.tsx)
**Priority**: High (Phase 2 blocker)

### 2. Cost calculation
**Question**: Do we have a utility to calculate cost_usd from tokens + model?
**Current**: Token counts available, but no cost calculation
**Action**: Check if pricing data exists in model config
**Priority**: Medium (can be added later)

### 3. Batch vs real-time trace writes
**Question**: Should we batch trace writes for performance?
**Trade-off**: Latency vs real-time visibility
**Recommendation**: Start with real-time, optimize if needed
**Priority**: Low (optimization)

### 4. Trace retention policy
**Question**: How long should we keep trace data?
**Current**: No retention policy
**Recommendation**: 30 days (configurable)
**Priority**: Low (can be addressed post-launch)

---

## Next Steps (Awaiting Approval)

1. **Review this plan** - Verify technical approach
2. **Confirm scope** - Phase 1-2 only, or all phases?
3. **Identify unknowns** - Answer open questions above
4. **Get approval** - Confirm before implementation begins
5. **Create Phase 1 branch** - Start with foundation
6. **Write unit tests first** - TDD approach
7. **Implement trace service** - Core functionality
8. **Test in isolation** - Before chat API integration

---

## Timeline Estimate

| Phase | Duration | Dependencies | Risk |
|-------|----------|--------------|------|
| Phase 1: Foundation | 2-3 days | None | Low |
| Phase 2: Chat API | 3-4 days | Phase 1 | Medium |
| Phase 3: Tool Tracing | 2-3 days | Phase 2 | Low |
| Phase 4: UI Polish | 2 days | Phase 2 | Low |
| **Total** | **2-3 weeks** | - | **Medium** |

---

## Approval Checklist

Before proceeding, confirm:
- [ ] Technical approach is sound
- [ ] No breaking changes to existing functionality
- [ ] Risk mitigation strategies are acceptable
- [ ] Testing plan is comprehensive
- [ ] Rollout strategy is safe
- [ ] Timeline is reasonable
- [ ] All open questions answered

---

**Status**: ⏳ Awaiting approval to proceed with Phase 1 implementation

**Last Updated**: 2025-11-29
**Created By**: Claude Code (Assistant)
**Approved By**: [Pending]
