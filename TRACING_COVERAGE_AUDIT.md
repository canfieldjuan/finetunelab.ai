# Tracing Coverage Audit
**Date**: December 19, 2025  
**Status**: Phase 1 Complete (LLM Calls Only) | Phases 2-4 Pending

## Executive Summary

**Current Coverage**: ~10-15% of billable operations  
**What We Trace**: LLM inference calls only  
**What We DON'T Trace**: Tool calls, GraphRAG retrieval, embeddings, prompt generation

---

## 1. What We Currently Trace ✅

### 1.1 LLM Completion Calls
**Location**: `app/api/chat/route.ts` (line ~735)

```typescript
traceContext = await traceService.startTrace({
  spanName: 'llm.completion',
  operationType: 'llm_call',
  modelName: selectedModelId,
  modelProvider: actualModelConfig?.provider || provider || undefined,
  conversationId: widgetConversationId || undefined,
});
```

**What Gets Captured**:
- Model name and provider
- Input/output tokens
- Cost (if available)
- Duration
- Input/output data (full prompt and response)
- Error messages (if failed)

**Usage Metering**: ✅ YES - Root traces recorded to `usage_meters` table

---

### 1.2 LLM Streaming Calls
**Location**: `app/api/chat/route.ts` (line ~1296)

```typescript
traceContext = await traceService.startTrace({
  spanName: 'llm.completion.stream',
  operationType: 'llm_call',
  modelName: selectedModelId || model || undefined,
  modelProvider: actualModelConfig?.provider || provider || undefined,
  conversationId: widgetConversationId || undefined,
});
```

**What Gets Captured**:
- Same as non-streaming, but with streaming-specific metadata
- Chunks accumulated into full response for metering

**Usage Metering**: ✅ YES - Root traces recorded with full payload size

---

### 1.3 Usage Metering Integration
**Service**: `lib/billing/usage-meter.service.ts`

**Process**:
1. `TraceService.endTrace()` checks if trace is root (no parent)
2. If root + status=success → calls `recordRootTraceUsage()`
3. Payload calculated: `input_data + output_data + metadata` (gzip compressed)
4. Database function `increment_root_trace_count()` atomically updates `usage_meters` table

**Current Period Tracking**:
- Traces are metered per billing period (month/year)
- Compressed payload stored in bytes
- Non-blocking (errors logged but not thrown)

---

## 2. What We DON'T Trace ❌

### 2.1 Tool Calls
**Problem**: Tool executions (web search, calculator, code execution) are NOT traced

**Impact**: 
- Missing 20-30% of compute operations
- No visibility into tool performance
- Tool failures don't appear in traces
- Tool latency not measured

**Where Tools Are Called**:
- `app/api/chat/route.ts` - `toolCallHandler` function (line ~400-600)
- Various tool implementations in `lib/tools/`

**What Should Be Traced**:
```typescript
// MISSING - Need to add
const toolContext = await startTrace({
  spanName: 'tool.web_search',
  operationType: 'tool_call',
  parentContext: mainTraceContext,
  metadata: { query: searchQuery, tool: 'tavily' }
});
```

---

### 2.2 GraphRAG Retrieval Operations
**Problem**: Document retrieval from Neo4j knowledge graph is NOT traced

**Impact**:
- Missing 10-15% of operations for RAG users
- No metrics on retrieval quality
- Graph query performance invisible
- Can't correlate retrieval with response quality

**Where GraphRAG Is Used**:
- `lib/services/graphrag*.ts` - Multiple retrieval methods
- Hybrid search combining vector + graph
- Multi-hop reasoning queries

**What Should Be Traced**:
```typescript
// MISSING - Need to add
const retrievalContext = await startTrace({
  spanName: 'graphrag.retrieve',
  operationType: 'retrieval',
  parentContext: mainTraceContext,
  metadata: { 
    query: userQuery,
    method: 'hybrid_search',
    nodesRetrieved: results.length,
    graphUsed: graphName
  }
});
```

**Retrieval Metrics Needed**:
- Nodes retrieved count
- Query execution time
- Relevance scores
- Context chunks used
- Graph name/ID

---

### 2.3 Embedding Generation
**Problem**: Vector embeddings for retrieval/search are NOT traced

**Impact**:
- Missing embedding API costs
- No visibility into embedding latency
- Can't track embedding model usage
- Difficult to debug retrieval issues

**Where Embeddings Are Generated**:
- Document ingestion pipelines
- Query embedding for semantic search
- GraphRAG hybrid search
- Possibly `lib/services/embedding*.ts` (need to verify)

**What Should Be Traced**:
```typescript
// MISSING - Need to add
const embeddingContext = await startTrace({
  spanName: 'embedding.generate',
  operationType: 'embedding',
  parentContext: retrievalContext,
  metadata: {
    model: 'text-embedding-ada-002',
    textLength: text.length,
    dimensions: 1536
  }
});
```

---

### 2.4 Prompt Generation / Enhancement
**Problem**: Prompt building logic is NOT traced

**Impact**:
- Can't measure time spent constructing prompts
- GraphRAG context injection invisible
- System message modifications not tracked
- Can't debug prompt-related issues

**Where Prompts Are Built**:
- `app/api/chat/route.ts` - Message enhancement with GraphRAG context
- System message injection
- Few-shot example addition
- Context window management

**What Should Be Traced**:
```typescript
// MISSING - Need to add
const promptContext = await startTrace({
  spanName: 'prompt.build',
  operationType: 'preprocessing',
  parentContext: mainTraceContext,
  metadata: {
    messagesCount: messages.length,
    graphragEnabled: !!graphRAGMetadata,
    contextsAdded: graphRAGMetadata?.sources?.length || 0
  }
});
```

---

### 2.5 Agent Loops / Multi-Turn Tool Use
**Problem**: Agentic workflows with multiple tool calls are NOT traced hierarchically

**Impact**:
- Can't see full agent reasoning chain
- Tool dependencies not visible
- Multi-turn conversations appear as disconnected traces
- Difficult to debug agent failures

**What Should Be Traced**:
- Parent "agent loop" span
- Child spans for each tool call
- Child spans for each LLM call
- Final aggregation span

---

## 3. Tracing Architecture

### 3.1 Current Implementation
```
User Request
  ↓
[ROOT TRACE: llm.completion] ← ✅ METERED
  - Input: Full prompt
  - Output: Full response
  - Tokens, cost, duration
  - Status: success/failed
```

### 3.2 Desired Implementation
```
User Request
  ↓
[ROOT TRACE: chat.request] ← ✅ METERED (top-level operation)
  ↓
  ├─ [CHILD: prompt.build] ← Prompt construction
  │   └─ [CHILD: graphrag.retrieve] ← Document retrieval
  │       └─ [CHILD: embedding.generate] ← Query embedding
  │
  ├─ [CHILD: llm.completion] ← Model inference
  │
  └─ [CHILD: tool.web_search] ← Tool execution (if needed)
      └─ [CHILD: llm.completion] ← Tool result processing
```

**Key Insight**: Only the ROOT trace (top-level `chat.request`) should be metered for billing. Child spans are for observability only.

---

## 4. Coverage Estimates

### 4.1 By Operation Type

| Operation Type | Currently Traced? | % of Total Operations | Estimated User Impact |
|---------------|-------------------|----------------------|----------------------|
| LLM Calls | ✅ Yes | 40-50% | High - Core functionality |
| Tool Calls | ❌ No | 20-30% | Medium - Power users |
| GraphRAG Retrieval | ❌ No | 10-15% | Medium - RAG users |
| Embeddings | ❌ No | 5-10% | Low - Background ops |
| Prompt Building | ❌ No | ~5% | Low - Fast operation |
| Agent Loops | ❌ No | 5-10% | Medium - Agentic workflows |

**Total Current Coverage**: ~40-50% of operations (LLM calls only)  
**Total Desired Coverage**: ~95-100% (all user-facing operations)

---

### 4.2 By User Segment

| User Type | What They Use | Current Coverage | Gap |
|-----------|---------------|------------------|-----|
| Basic Chat Users | LLM calls only | ✅ 100% | None |
| RAG Power Users | LLM + GraphRAG + embeddings | ⚠️ 50% | Missing retrieval |
| Tool Users | LLM + web search + calculators | ⚠️ 40% | Missing tools |
| Agent Users | LLM + multi-turn tools + reasoning | ⚠️ 30% | Missing most workflow |

---

## 5. Billing Impact Analysis

### 5.1 What We're Metering Now
```
METERED:
- Root LLM completion traces
- Input + output payload (compressed)
- Token counts (if available)
```

### 5.2 What We're Missing
```
NOT METERED:
- Tool call overhead (API costs, latency)
- GraphRAG query execution (Neo4j compute)
- Embedding generation (OpenAI/other costs)
- Multi-turn agent conversations (full context window usage)
```

### 5.3 Revenue Leakage Estimate

**Scenario**: User sends query requiring:
1. GraphRAG retrieval (3 nodes, 5KB context)
2. LLM call (10K input tokens + 2K output)
3. Web search tool call (external API $0.01)
4. Second LLM call processing tool result (3K input + 1K output)

**What We Meter**:
- ✅ First LLM call: 12K tokens + payload
- ✅ Second LLM call: 4K tokens + payload

**What We Miss**:
- ❌ GraphRAG retrieval overhead (~1-2 cents compute)
- ❌ Web search API cost ($0.01)
- ❌ Embedding generation for query (~$0.0001)

**Est. Revenue Leakage**: 10-20% for power users with tools/RAG

---

## 6. Implementation Roadmap

### Phase 1: LLM Tracing ✅ (COMPLETE)
- [x] Trace LLM completion calls
- [x] Trace streaming calls
- [x] Integrate usage metering
- [x] Store compressed payloads
- [x] Calculate costs

**Status**: 100% complete, in production

---

### Phase 2: Tool Tracing ❌ (PENDING)
**Priority**: HIGH (20-30% coverage gap)

**Tasks**:
1. Add `startTrace()` in `toolCallHandler` function
2. Create child spans for each tool execution
3. Capture tool-specific metadata:
   - Tool name (web_search, calculator, etc.)
   - Tool input parameters
   - Tool output
   - External API costs (if applicable)
4. End trace with success/error status

**Files to Modify**:
- `app/api/chat/route.ts` - toolCallHandler (line ~400-600)
- `lib/tools/*.ts` - Individual tool implementations

**Estimated Time**: 4-6 hours

---

### Phase 3: GraphRAG & Retrieval Tracing ❌ (PENDING)
**Priority**: MEDIUM (10-15% coverage gap)

**Tasks**:
1. Add `startTrace()` in GraphRAG service methods
2. Create spans for:
   - Hybrid search queries
   - Vector similarity search
   - Graph traversal
   - Context aggregation
3. Capture retrieval metadata:
   - Nodes retrieved count
   - Relevance scores
   - Query execution time
   - Graph name/ID
   - Context chunks used

**Files to Modify**:
- `lib/services/graphrag*.ts` - All retrieval methods
- `app/api/chat/route.ts` - GraphRAG integration point

**Estimated Time**: 6-8 hours

---

### Phase 4: Embedding Tracing ❌ (PENDING)
**Priority**: LOW (5-10% coverage gap)

**Tasks**:
1. Add `startTrace()` in embedding generation
2. Capture embedding metadata:
   - Model used
   - Text length
   - Dimensions
   - API cost (if external)
3. Track embedding usage for billing

**Files to Modify**:
- `lib/services/embedding*.ts` (need to locate files)
- Any document ingestion pipelines

**Estimated Time**: 3-4 hours

---

### Phase 5: Prompt Building Tracing ❌ (PENDING)
**Priority**: LOW (~5% coverage gap)

**Tasks**:
1. Add `startTrace()` for prompt construction
2. Capture prompt metadata:
   - Message count
   - GraphRAG context added
   - System message modifications
   - Total prompt length

**Files to Modify**:
- `app/api/chat/route.ts` - Message enhancement logic

**Estimated Time**: 2-3 hours

---

### Phase 6: Hierarchical Agent Tracing ❌ (PENDING)
**Priority**: MEDIUM (complex workflows, 5-10% gap)

**Tasks**:
1. Create parent "agent loop" trace
2. Nest all sub-operations (tools, LLM, retrieval)
3. Visualize full agent reasoning chain
4. Track multi-turn context window usage

**Files to Modify**:
- `app/api/chat/route.ts` - Agent loop handling
- Trace visualization UI (future)

**Estimated Time**: 8-12 hours

---

## 7. Immediate Next Steps

### Recommended Order:
1. **Phase 2 - Tool Tracing** (HIGH priority, 4-6 hours)
   - Biggest coverage gap (20-30%)
   - Affects power users most
   - Relatively easy to implement

2. **Phase 3 - GraphRAG Tracing** (MEDIUM priority, 6-8 hours)
   - Important for RAG users
   - Helps debug retrieval quality
   - Captures hidden compute costs

3. **Phase 4 - Embedding Tracing** (LOW priority, 3-4 hours)
   - Smaller gap but still valuable
   - External API costs tracking

4. **Phase 5 - Prompt Building** (LOW priority, 2-3 hours)
   - Nice-to-have for debugging
   - Fast operations, minimal impact

5. **Phase 6 - Agent Loops** (MEDIUM priority, 8-12 hours)
   - Complex but high value for agentic workflows
   - Requires UI work for visualization

**Total Estimated Time**: 25-35 hours to reach 95%+ coverage

---

## 8. Technical Considerations

### 8.1 Metering Only Root Traces
**Current Behavior**: ✅ Correct
```typescript
// Only meter root traces (no parent)
if (!context.parentSpanId && result.status === 'success') {
  recordRootTraceUsage({...});
}
```

**Important**: Child spans (tools, retrieval, embeddings) should NOT be metered separately. Only the top-level operation counts for billing.

---

### 8.2 Span Relationships
**Current**: Flat structure (only LLM calls)
**Desired**: Hierarchical tree

```typescript
// Parent trace
const parentContext = await startTrace({
  spanName: 'chat.request',
  operationType: 'llm_call', // Root operation
});

// Child trace (tool call)
const childContext = await startTrace({
  spanName: 'tool.web_search',
  operationType: 'tool_call',
  parentContext: parentContext, // ← Link to parent
});
```

---

### 8.3 Performance Impact
**Concern**: Adding more traces could slow down requests

**Mitigation**:
- Tracing is already non-blocking (Promise.catch used)
- Batch writes to database (current implementation)
- Graceful degradation (errors don't break main flow)
- Consider sampling for high-volume operations (Phase 6)

---

## 9. Success Metrics

### Coverage Goals:
- **Phase 1**: 40-50% operations traced ✅ ACHIEVED
- **Phase 2**: 70-80% operations traced (after tool tracing)
- **Phase 3**: 85-90% operations traced (after GraphRAG tracing)
- **Phase 4-6**: 95-100% operations traced

### Quality Metrics:
- Zero trace failures blocking user requests
- <10ms overhead per trace operation
- 100% of root traces successfully metered
- <1% trace data loss rate

### Business Metrics:
- Reduce revenue leakage from 10-20% to <5%
- Enable per-operation cost analysis
- Support usage-based pricing with confidence
- Improve debugging time by 50% (visibility into full request lifecycle)

---

## 10. Questions & Decisions Needed

### Q1: Should We Meter Embeddings Separately?
**Context**: Embedding API calls have external costs (e.g., OpenAI $0.0001/1K tokens)

**Options**:
- A) Meter as separate root traces (separate line item in billing)
- B) Include in parent trace payload (bundled cost)
- C) Don't meter (treat as infrastructure cost)

**Recommendation**: Option B - Include in parent trace. Embeddings are part of retrieval overhead.

---

### Q2: Should Tool API Costs Be Passed to Users?
**Context**: Some tools make external API calls (web search, weather, etc.) with per-request costs

**Options**:
- A) Absorb costs (include in tier pricing)
- B) Pass through costs (itemized billing)
- C) Set usage limits per tier (e.g., 100 tool calls/month)

**Recommendation**: Option C initially, Option B for enterprise tier.

---

### Q3: How Deep Should Agent Loop Tracing Go?
**Context**: Agent workflows can have deeply nested tool calls (10+ levels)

**Options**:
- A) Trace everything (full visibility, high overhead)
- B) Sample deep traces (1 in 10 operations)
- C) Set max depth limit (e.g., 5 levels)

**Recommendation**: Option C - Max depth 5 levels. Deeper traces logged but not stored.

---

## 11. Appendix: Code References

### Tracing Service
- **Location**: `lib/tracing/trace.service.ts`
- **Key Functions**:
  - `startTrace()` - Begin trace span
  - `endTrace()` - Complete trace, trigger metering
  - `createChildSpan()` - Nest traces hierarchically

### Usage Metering Service
- **Location**: `lib/billing/usage-meter.service.ts`
- **Key Functions**:
  - `recordRootTraceUsage()` - Meter root traces
  - `getCurrentUsage()` - Fetch current period usage
  - `getEstimatedCost()` - Calculate estimated bill

### Database Functions
- **Location**: `supabase/migrations/20251218000004_create_usage_based_pricing.sql`
- **Key Functions**:
  - `increment_root_trace_count()` - Atomically update usage
  - `get_current_usage()` - Retrieve current period metrics
  - `calculate_estimated_cost()` - Compute estimated cost with overages

### Trace Storage
- **Table**: `llm_traces`
- **Columns**: trace_id, span_id, parent_trace_id, user_id, operation_type, duration_ms, input_tokens, output_tokens, cost_usd, status, input_data, output_data, metadata

### Usage Storage
- **Table**: `usage_meters`
- **Columns**: user_id, period_month, period_year, root_traces_count, total_payload_bytes, compressed_payload_bytes, retention_days

---

**End of Audit**
