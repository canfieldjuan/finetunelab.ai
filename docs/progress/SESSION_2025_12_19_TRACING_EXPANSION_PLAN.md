# Tracing Expansion Implementation Plan
**Date**: December 19, 2025  
**Session**: Tracing Coverage Expansion (Phase 2-6)  
**Status**: PLANNING - Awaiting Approval

## Session Context

**Previous Work**:
- ✅ Phase 1: LLM tracing complete (llm.completion, llm.completion.stream)
- ✅ Usage metering integrated (recordRootTraceUsage)
- ✅ Phase 3 (Pricing UI): UsageHistoryChart + InvoiceHistoryTable integrated into account page

**Current Goal**: Expand tracing coverage from 10-15% to 95%+ by adding traces for tool calls, GraphRAG retrieval, embeddings, and prompt building.

**Audit Reference**: See `TRACING_COVERAGE_AUDIT.md` for full analysis

---

## Phase 2: Tool Call Tracing (HIGH Priority)

### Impact
- **Coverage Gap**: 20-30% of operations
- **Affected Users**: Power users with web search, calculators, code execution
- **Revenue Leakage**: External API costs not tracked
- **Estimated Time**: 4-6 hours

### Implementation Details

#### 2.1 File to Modify
**Path**: `app/api/chat/route.ts`  
**Function**: `toolCallHandler` (lines 604-645)

#### 2.2 Current Code (VERIFIED)
```typescript
const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
  // Use conversationId if available, else empty string
  const convId = conversationId || '';

  // Enforce deep research toggle server-side.
  if (toolName === 'web_search' && !allowDeepResearch) {
    const wantsResearch = args.research === true || args.deepResearchConfirmed === true;
    if (wantsResearch) {
      args = {
        ...args,
        research: false,
        deepResearchConfirmed: false,
      };
    }
  }

  const result = await executeTool(toolName, args, convId, undefined, userId || undefined);
  // Capture web_search results for SSE previews
  try {
    if (toolName === 'web_search' && isWebSearchToolPayload(result.data)) {
      const { results, status, jobId } = result.data;
      if (Array.isArray(results)) {
        lastWebSearchDocs = results;
      }
      if ((status === 'deep_research_started' || status === 'research_started') && jobId) {
        lastDeepResearchJobId = String(jobId);
        if (typeof args.query === 'string') {
          lastDeepResearchQuery = args.query;
        }
        console.log('[API] Captured deep research job id from tool result:', lastDeepResearchJobId);
      }
    }
  } catch (capErr) {
    console.log('[API] Could not capture web_search results for SSE:', capErr);
  }
  if (result.error) return { error: result.error };
  return result.data;
};
```

#### 2.3 Proposed Changes

**Add at top of function** (after line 606):
```typescript
const toolCallHandler = async (toolName: string, args: Record<string, unknown>) => {
  // Use conversationId if available, else empty string
  const convId = conversationId || '';

  // ========================================================================
  // TRACE: Start tool call span
  // ========================================================================
  let toolTraceContext: TraceContext | undefined;
  
  // Only trace if we have a parent trace context (from LLM call)
  if (traceContext) {
    try {
      toolTraceContext = await traceService.createChildSpan(
        traceContext,
        `tool.${toolName}`,
        'tool_call'
      );
      console.log(`[Trace] Started tool call trace: ${toolName}`);
    } catch (traceErr) {
      // Log but don't block - tracing failures should never break functionality
      console.error('[Trace] Failed to start tool trace:', traceErr);
    }
  }

  // Enforce deep research toggle server-side.
  // ... (rest of existing code)
```

**Add before return statements** (replace lines 644-645):
```typescript
  // Capture web_search results for SSE previews
  try {
    if (toolName === 'web_search' && isWebSearchToolPayload(result.data)) {
      const { results, status, jobId } = result.data;
      if (Array.isArray(results)) {
        lastWebSearchDocs = results;
      }
      if ((status === 'deep_research_started' || status === 'research_started') && jobId) {
        lastDeepResearchJobId = String(jobId);
        if (typeof args.query === 'string') {
          lastDeepResearchQuery = args.query;
        }
        console.log('[API] Captured deep research job id from tool result:', lastDeepResearchJobId);
      }
    }
  } catch (capErr) {
    console.log('[API] Could not capture web_search results for SSE:', capErr);
  }
  
  // ========================================================================
  // TRACE: End tool call span
  // ========================================================================
  if (toolTraceContext) {
    try {
      if (result.error) {
        // Tool call failed
        await traceService.endTrace(toolTraceContext, {
          endTime: new Date(),
          status: 'failed',
          errorMessage: String(result.error),
          errorType: 'ToolExecutionError',
          metadata: {
            toolName,
            args: JSON.stringify(args),
          },
        });
      } else {
        // Tool call succeeded
        await traceService.endTrace(toolTraceContext, {
          endTime: new Date(),
          status: 'success',
          outputData: result.data,
          metadata: {
            toolName,
            args: JSON.stringify(args),
            resultType: typeof result.data,
          },
        });
      }
      console.log(`[Trace] Ended tool call trace: ${toolName}`);
    } catch (traceErr) {
      console.error('[Trace] Failed to end tool trace:', traceErr);
    }
  }
  
  if (result.error) return { error: result.error };
  return result.data;
};
```

#### 2.4 Dependencies Check
- ✅ `traceService` already imported (line 28): `import { traceService } from '@/lib/tracing/trace.service';`
- ✅ `TraceContext` type already imported (line 29): `import type { TraceContext } from '@/lib/tracing/types';`
- ✅ `traceContext` variable already declared in scope (line ~733)
- ✅ `createChildSpan()` exists in trace.service.ts (line 227-243)

#### 2.5 Breaking Changes Analysis
**Risk Level**: LOW

**Potential Issues**:
- None - all changes are additive (try/catch blocks prevent failures)
- Tracing is non-blocking (errors logged, not thrown)
- Parent trace context may be undefined (handled with conditional check)

**Files NOT Affected**:
- `lib/tools/toolManager.ts` - No changes needed (executeTool stays the same)
- Individual tool implementations - No changes needed
- Database schema - Uses existing llm_traces table

#### 2.6 Testing Plan
1. Test tool call without parent trace (should skip gracefully)
2. Test tool call with parent trace (should create child span)
3. Test tool call failure (should record error in trace)
4. Test tool call success (should record result in trace)
5. Verify traces appear in llm_traces table with correct parent_trace_id
6. Verify tool calls are NOT metered as root traces (only parent LLM call is metered)

---

## Phase 3: GraphRAG Retrieval Tracing (MEDIUM Priority)

### Impact
- **Coverage Gap**: 10-15% of operations
- **Affected Users**: RAG power users
- **Visibility**: Graph query performance, relevance scores
- **Estimated Time**: 6-8 hours

### Implementation Details

#### 3.1 Files to Modify

**Primary File**: `lib/graphrag/service/graphrag-service.ts`  
**Secondary File**: `lib/graphrag/graphiti/search-service.ts`

#### 3.2 Current Code Analysis

**File**: `lib/graphrag/service/graphrag-service.ts`  
**Function**: `enhancePrompt()` (lines 42-150)

**Key retrieval point** (line 107):
```typescript
// Search knowledge graph for relevant context
console.log('[GraphRAG] Query classification:', {
  query: userMessage.slice(0, 50),
  isToolSpecific: classification.isToolSpecific,
  action: 'SEARCH',
});
const searchResult = await searchService.search(userMessage, userId);
```

**File**: `lib/graphrag/graphiti/search-service.ts`  
**Function**: `search()` (lines 19-72)

**Key search point** (line 32):
```typescript
const graphitiResult = await this.client.search(params);
```

#### 3.3 Proposed Changes

**Location**: `lib/graphrag/graphiti/search-service.ts`

**Import additions** (after line 8):
```typescript
import { traceService } from '@/lib/tracing/trace.service';
import type { TraceContext } from '@/lib/tracing/types';
```

**Modify search() function signature** (line 19):
```typescript
async search(
  query: string, 
  userId: string,
  parentTraceContext?: TraceContext  // NEW: Optional parent trace
): Promise<SearchResult> {
```

**Add tracing** (after line 20, before params construction):
```typescript
async search(
  query: string, 
  userId: string,
  parentTraceContext?: TraceContext
): Promise<SearchResult> {
  const startTime = Date.now();
  
  // ========================================================================
  // TRACE: Start GraphRAG retrieval span
  // ========================================================================
  let retrievalTraceContext: TraceContext | undefined;
  
  if (parentTraceContext) {
    try {
      retrievalTraceContext = await traceService.createChildSpan(
        parentTraceContext,
        'graphrag.retrieve',
        'retrieval'
      );
      console.log('[Trace] Started GraphRAG retrieval trace');
    } catch (traceErr) {
      console.error('[Trace] Failed to start retrieval trace:', traceErr);
    }
  }

  const params: GraphitiSearchParams = {
    query,
    group_ids: [userId],
    num_results: graphragConfig.search.topK,
  };

  console.log('[SearchService] Calling Graphiti with params:', params);

  try {
    const graphitiResult = await this.client.search(params);
    
    console.log('[SearchService] Graphiti returned:', {
      edgesCount: graphitiResult.edges?.length || 0,
      firstEdge: graphitiResult.edges?.[0] ? {
        fact: graphitiResult.edges[0].fact?.slice(0, 100),
        score: graphitiResult.edges[0].score
      } : null
    });

    // Build context and sources from results
    const context = this.buildContext(graphitiResult);
    const sources = this.extractSources(graphitiResult);

    console.log('[SearchService] Extracted sources:', sources.length);

    // Calculate relevance score from edges
    const relevanceScores = graphitiResult.edges.map(e => e.score || 0);
    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
      : 0;

    const queryTime = Date.now() - startTime;
    
    // ========================================================================
    // TRACE: End GraphRAG retrieval span (SUCCESS)
    // ========================================================================
    if (retrievalTraceContext) {
      try {
        await traceService.endTrace(retrievalTraceContext, {
          endTime: new Date(),
          status: 'success',
          metadata: {
            searchMethod: graphragConfig.search.searchMethod,
            nodesRetrieved: graphitiResult.edges.length,
            sourcesExtracted: sources.length,
            queryTimeMs: queryTime,
            avgRelevance: avgRelevance.toFixed(3),
            topKRequested: graphragConfig.search.topK,
            query: query.slice(0, 100), // First 100 chars
          },
        });
        console.log('[Trace] Ended GraphRAG retrieval trace (success)');
      } catch (traceErr) {
        console.error('[Trace] Failed to end retrieval trace:', traceErr);
      }
    }

    return {
      context,
      sources,
      metadata: {
        searchMethod: graphragConfig.search.searchMethod,
        resultsCount: graphitiResult.edges.length,
        queryTime,
        graph_used: graphitiResult.edges.length > 0,
        nodes_retrieved: graphitiResult.edges.length,
        context_chunks_used: sources.length,
        retrieval_time_ms: queryTime,
        context_relevance_score: avgRelevance,
        answer_grounded_in_graph: sources.length > 0,
      } as GraphRAGRetrievalMetadata,
    };
  } catch (error) {
    // ========================================================================
    // TRACE: End GraphRAG retrieval span (FAILED)
    // ========================================================================
    if (retrievalTraceContext) {
      try {
        await traceService.endTrace(retrievalTraceContext, {
          endTime: new Date(),
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          errorType: 'GraphRAGRetrievalError',
          metadata: {
            query: query.slice(0, 100),
            topKRequested: graphragConfig.search.topK,
          },
        });
        console.log('[Trace] Ended GraphRAG retrieval trace (failed)');
      } catch (traceErr) {
        console.error('[Trace] Failed to end retrieval trace:', traceErr);
      }
    }
    
    throw error; // Re-throw to maintain error handling
  }
}
```

#### 3.4 Upstream Integration

**File**: `lib/graphrag/service/graphrag-service.ts`  
**Function**: `enhancePrompt()` (line 107)

**Change search call** (from line 107):
```typescript
// BEFORE
const searchResult = await searchService.search(userMessage, userId);

// AFTER - Pass parent trace context (if available from chat route)
const searchResult = await searchService.search(
  userMessage, 
  userId,
  parentTraceContext  // NEW: Pass trace context down
);
```

**Add parameter to enhancePrompt()** (line 42):
```typescript
// BEFORE
async enhancePrompt(
  userId: string,
  userMessage: string,
  options: EnhanceOptions = {}
): Promise<EnhancedPrompt> {

// AFTER
async enhancePrompt(
  userId: string,
  userMessage: string,
  options: EnhanceOptions = {},
  parentTraceContext?: TraceContext  // NEW: Optional parent trace
): Promise<EnhancedPrompt> {
```

**Update EnhanceOptions type** (add to imports in chat route):
```typescript
// In app/api/chat/route.ts, when calling graphragService.enhancePrompt()
// Pass traceContext as 4th parameter (around line 680-690 where GraphRAG is used)
```

#### 3.5 Dependencies Check
- ❌ Need to import `traceService` in search-service.ts
- ❌ Need to import `TraceContext` type in search-service.ts
- ✅ `createChildSpan()` already exists
- ⚠️ Need to update function signatures (breaking change for internal API)

#### 3.6 Breaking Changes Analysis
**Risk Level**: MEDIUM

**Potential Issues**:
- Function signature changes require updates to all call sites
- Must update `graphrag-service.ts` to pass trace context
- Must update `app/api/chat/route.ts` to pass trace context to GraphRAG
- SearchService is used in multiple places (need to audit all usages)

**Mitigation**:
- Make `parentTraceContext` optional (backward compatible)
- If undefined, tracing is skipped (graceful degradation)
- Test all GraphRAG entry points

**Files Potentially Affected**:
- `lib/graphrag/service/graphrag-service.ts` (signature change)
- `app/api/chat/route.ts` (call site update)
- Any other files calling searchService.search() (need to audit)

#### 3.7 Testing Plan
1. Test GraphRAG retrieval without parent trace (should skip gracefully)
2. Test GraphRAG retrieval with parent trace (should create child span)
3. Test GraphRAG retrieval failure (should record error)
4. Test GraphRAG retrieval success (should record metadata)
5. Verify traces show nodes_retrieved, queryTimeMs, avgRelevance
6. Verify GraphRAG traces are NOT metered as root traces

---

## Phase 4: Embedding Tracing (LOW Priority)

### Impact
- **Coverage Gap**: 5-10% of operations
- **Affected Users**: All RAG users (background ops)
- **Visibility**: Embedding API costs, latency
- **Estimated Time**: 3-4 hours

### Implementation Details

#### 4.1 Problem: No Dedicated Embedding Service Found

**Observation**: 
- No `lib/services/embedding*.ts` files found
- Embeddings likely handled by Graphiti client internally
- May not need separate tracing if embedded in GraphRAG traces

#### 4.2 Investigation Needed
1. Search for where embeddings are generated:
   - Document ingestion pipelines
   - Query embedding for search
   - Graphiti client internals
2. Determine if embeddings are already captured in GraphRAG retrieval traces
3. If separate API calls exist, add child spans

#### 4.3 Proposed Approach (if separate service found)

**If found in** `lib/graphrag/graphiti/client.ts` or similar:

```typescript
// Add child span for embedding generation
const embeddingContext = await traceService.createChildSpan(
  parentContext,
  'embedding.generate',
  'embedding'
);

try {
  const embedding = await generateEmbedding(text);
  
  await traceService.endTrace(embeddingContext, {
    endTime: new Date(),
    status: 'success',
    metadata: {
      model: embeddingModel,
      textLength: text.length,
      dimensions: embedding.length,
    },
  });
  
  return embedding;
} catch (error) {
  await traceService.captureError(embeddingContext, error as Error);
  throw error;
}
```

#### 4.4 Decision Point
**DEFER** until GraphRAG tracing (Phase 3) is complete. Re-evaluate if separate embedding traces are needed or if GraphRAG metadata is sufficient.

---

## Phase 5: Prompt Building Tracing (LOW Priority)

### Impact
- **Coverage Gap**: ~5% of operations
- **Affected Users**: All users (fast operation)
- **Visibility**: Prompt construction time, GraphRAG context injection
- **Estimated Time**: 2-3 hours

### Implementation Details

#### 5.1 File to Modify
**Path**: `app/api/chat/route.ts`  
**Location**: Around lines 680-700 (where messages are enhanced with GraphRAG)

#### 5.2 Current Code (Need to Locate Exact Section)

**Search for**: GraphRAG enhancement in chat route
- Look for `graphragService.enhancePrompt()` calls
- Look for message array construction
- Look for system message injection

#### 5.3 Proposed Changes

**Add before message enhancement**:
```typescript
// ========================================================================
// TRACE: Start prompt building span
// ========================================================================
let promptBuildContext: TraceContext | undefined;

if (traceContext) {
  try {
    promptBuildContext = await traceService.createChildSpan(
      traceContext,
      'prompt.build',
      'preprocessing'
    );
    console.log('[Trace] Started prompt building trace');
  } catch (traceErr) {
    console.error('[Trace] Failed to start prompt build trace:', traceErr);
  }
}

// Existing message enhancement code...
const enhancedMessages = [...messages];

// GraphRAG context injection
if (graphRAGEnabled) {
  const graphragResult = await graphragService.enhancePrompt(
    userId,
    userMessage,
    { maxSources: 5, minConfidence: 0.7 },
    traceContext  // Pass parent trace
  );
  
  if (graphragResult.contextUsed) {
    // Inject context into messages
    enhancedMessages[enhancedMessages.length - 1].content = graphragResult.prompt;
  }
}

// ========================================================================
// TRACE: End prompt building span
// ========================================================================
if (promptBuildContext) {
  try {
    await traceService.endTrace(promptBuildContext, {
      endTime: new Date(),
      status: 'success',
      metadata: {
        messagesCount: enhancedMessages.length,
        graphragEnabled: graphRAGEnabled,
        contextsAdded: graphragResult?.sources?.length || 0,
        totalPromptLength: JSON.stringify(enhancedMessages).length,
      },
    });
    console.log('[Trace] Ended prompt building trace');
  } catch (traceErr) {
    console.error('[Trace] Failed to end prompt build trace:', traceErr);
  }
}
```

#### 5.4 Dependencies Check
- ✅ `traceService` already imported
- ✅ `TraceContext` type already imported
- ✅ `createChildSpan()` exists
- ⚠️ Need to verify exact location of message enhancement code

#### 5.5 Breaking Changes Analysis
**Risk Level**: LOW

**Potential Issues**:
- None - all changes are additive
- Prompt building is synchronous (no async issues)

#### 5.6 Testing Plan
1. Test prompt building with GraphRAG (should show context injection)
2. Test prompt building without GraphRAG (should show basic stats)
3. Verify prompt build traces are children of main LLM trace
4. Verify traces show messagesCount, contextsAdded, totalPromptLength

---

## Phase 6: Agent Loop Tracing (MEDIUM Priority)

### Impact
- **Coverage Gap**: 5-10% of operations (complex workflows)
- **Affected Users**: Agentic workflow users
- **Visibility**: Full reasoning chain, multi-turn tool use
- **Estimated Time**: 8-12 hours

### Implementation Details

#### 6.1 Scope
**Current**: Flat trace structure (each tool call independent)  
**Desired**: Hierarchical agent loop with all sub-operations nested

#### 6.2 Architecture Changes

**New Root Span**: `agent.loop`  
**Child Spans**: 
- `tool.web_search` (from Phase 2)
- `llm.completion` (existing)
- `graphrag.retrieve` (from Phase 3)
- `tool.calculator`, `tool.code_exec`, etc.

#### 6.3 Implementation Strategy

**Option A**: Wrap existing chat route in agent span
```typescript
// Start agent loop trace
const agentLoopContext = await traceService.startTrace({
  spanName: 'agent.loop',
  operationType: 'agent_workflow',
  conversationId: widgetConversationId,
});

// All subsequent operations become children
// ... (existing chat logic)

// End agent loop trace
await traceService.endTrace(agentLoopContext, {
  endTime: new Date(),
  status: 'success',
  metadata: {
    toolCallsCount: toolCallsMade,
    llmCallsCount: llmCallsMade,
    totalDurationMs: Date.now() - startTime,
  },
});
```

**Option B**: Only create agent span for multi-turn tool use (conditional)
```typescript
// Detect if this is an agentic workflow (multiple tool calls)
const isAgenticWorkflow = tools && tools.length > 0;

let agentLoopContext: TraceContext | undefined;
if (isAgenticWorkflow) {
  agentLoopContext = await traceService.startTrace({...});
}

// Use agentLoopContext as parent if available, otherwise use traceContext
const parentContext = agentLoopContext || traceContext;
```

#### 6.4 Decision Point
**RECOMMEND**: Start with Option B (conditional agent spans)  
**Reason**: Less invasive, only adds overhead for agentic workflows

#### 6.5 Testing Plan
1. Test single LLM call (no agent span)
2. Test LLM + 1 tool call (should create agent span)
3. Test LLM + multiple tool calls (should nest all under agent span)
4. Test nested tool calls (tool calls another tool)
5. Verify trace hierarchy in database (parent_trace_id relationships)
6. Verify only root agent span is metered (not individual tools/LLM calls)

---

## Implementation Order & Timeline

### Recommended Sequence

1. **Phase 2 - Tool Tracing** (Week 1: Days 1-2)
   - Highest impact (20-30% coverage gain)
   - Relatively simple (single file, existing patterns)
   - Foundation for Phase 6

2. **Phase 3 - GraphRAG Tracing** (Week 1: Days 3-4)
   - Medium impact (10-15% coverage gain)
   - More complex (multiple files, signature changes)
   - Requires careful testing of call sites

3. **Phase 5 - Prompt Building** (Week 1: Day 5)
   - Low impact but easy (5% coverage gain, 2-3 hours)
   - Completes the "standard request" trace coverage
   - Can be done in parallel with Phase 3

4. **Phase 4 - Embedding Tracing** (Week 2: Day 1)
   - Low priority (may not be needed)
   - Re-evaluate after Phase 3 complete
   - Could be skipped if GraphRAG metadata sufficient

5. **Phase 6 - Agent Loop Tracing** (Week 2: Days 2-4)
   - Medium impact but high complexity
   - Requires Phases 2-3 complete first
   - Optional enhancement (can defer to Phase 7)

### Timeline Estimate

**Conservative**: 3-4 weeks (including testing, bug fixes, monitoring)  
**Aggressive**: 2 weeks (if no major issues, good test coverage)

**Breakdown**:
- Phase 2: 6-8 hours (1 day)
- Phase 3: 8-10 hours (1.5 days)
- Phase 5: 3-4 hours (0.5 days)
- Phase 4: 4-6 hours (0.5 days, if needed)
- Phase 6: 12-16 hours (2 days, optional)
- Testing & Integration: 2-3 days
- Monitoring & Bug Fixes: 1-2 days

**Total**: 8-13 days of development

---

## Risk Assessment

### High-Risk Areas

1. **GraphRAG Signature Changes** (Phase 3)
   - Multiple call sites need updates
   - Breaking internal API changes
   - **Mitigation**: Make parameters optional, test all call sites

2. **Trace Hierarchy Correctness** (Phase 6)
   - Complex parent-child relationships
   - Risk of orphaned spans or circular references
   - **Mitigation**: Extensive testing, validation logic

3. **Performance Impact**
   - Adding 5-10 new traces per request
   - Database write load increases
   - **Mitigation**: Existing batch writes, non-blocking traces, consider sampling

### Medium-Risk Areas

1. **Embedding Service Location** (Phase 4)
   - May not exist as separate service
   - Could be embedded in Graphiti client
   - **Mitigation**: Thorough investigation before implementation

2. **Error Handling**
   - Must ensure trace failures never break main flow
   - Try/catch blocks everywhere
   - **Mitigation**: Follow existing pattern (graceful degradation)

### Low-Risk Areas

1. **Tool Call Tracing** (Phase 2)
   - Single file change
   - Well-defined insertion points
   - Follows existing LLM trace pattern

2. **Prompt Building Tracing** (Phase 5)
   - Simple additive change
   - Fast operation (minimal overhead)

---

## Testing Strategy

### Unit Tests (Per Phase)
- Test trace creation without parent (should skip)
- Test trace creation with parent (should nest)
- Test trace on success (should record metadata)
- Test trace on failure (should record error)

### Integration Tests
- Test full request flow with all traces enabled
- Verify trace hierarchy in database
- Verify only root traces are metered
- Verify non-blocking behavior (trace failures don't break requests)

### Performance Tests
- Measure overhead of new traces (<10ms per trace)
- Verify batch writes still work
- Test under load (100+ concurrent requests)

### Manual Testing
- Chat with tools → Verify tool traces appear
- Chat with GraphRAG → Verify retrieval traces appear
- Multi-turn agent workflow → Verify hierarchy correct
- Check traces in Supabase llm_traces table

---

## Rollout Plan

### Stage 1: Development (Phases 2-3)
- Implement Phase 2 (tool tracing)
- Test Phase 2 in dev environment
- Implement Phase 3 (GraphRAG tracing)
- Test Phase 3 in dev environment
- Integration testing Phases 2-3 together

### Stage 2: Staging Deployment
- Deploy Phases 2-3 to staging
- Monitor for errors, performance impact
- Run load tests
- Fix any issues

### Stage 3: Production Canary
- Deploy to 10% of users
- Monitor traces, error rates
- Compare metering accuracy before/after
- Rollback plan ready

### Stage 4: Full Production
- Deploy to 100% of users
- Monitor coverage metrics (should reach 70-80%)
- Collect feedback from usage dashboard

### Stage 5: Phases 4-6 (Optional)
- Evaluate need for embedding tracing
- Evaluate need for prompt building tracing
- Evaluate need for agent loop tracing
- Implement based on user feedback and business needs

---

## Success Metrics

### Coverage Metrics (Goal: 95%+)
- **Current**: 10-15% operations traced
- **After Phase 2**: 50-60% operations traced
- **After Phase 3**: 70-80% operations traced
- **After Phases 4-5**: 80-90% operations traced
- **After Phase 6**: 95-100% operations traced

### Quality Metrics
- **Trace Failures**: <1% of requests
- **Performance Overhead**: <10ms per trace
- **Metering Accuracy**: 100% of root traces captured
- **Data Loss**: <0.1% of traces

### Business Metrics
- **Revenue Leakage**: Reduce from 10-20% to <5%
- **Cost Visibility**: Per-operation cost breakdown available
- **Debugging Time**: Reduce by 50% (full request visibility)
- **User Insights**: Understand tool usage patterns, RAG effectiveness

---

## Monitoring & Observability

### What to Monitor

1. **Trace Creation Rate**
   - Traces/second by operation type
   - Detect spikes or drops

2. **Trace Failure Rate**
   - % of traces that fail to create/end
   - Should be <1%

3. **Trace Hierarchy Correctness**
   - % of child traces with valid parent_trace_id
   - Should be 100%

4. **Metering Accuracy**
   - Root traces vs. child traces ratio
   - Only root traces should be metered

5. **Performance Impact**
   - p95/p99 latency before/after tracing expansion
   - Should increase <5%

### Dashboards to Create

1. **Trace Coverage Dashboard**
   - Pie chart: Operation types traced vs. not traced
   - Time series: Trace creation rate
   - Table: Top 10 most traced operations

2. **Trace Health Dashboard**
   - Failure rate by operation type
   - Orphaned spans (no parent)
   - Average trace depth (hierarchy depth)

3. **Cost Attribution Dashboard**
   - Cost by operation type (LLM vs. tools vs. RAG)
   - Cost by user (heavy users)
   - Cost trends over time

---

## Documentation Updates Needed

### User-Facing Documentation
- Update "Usage & Billing" docs with new metering details
- Add "Understanding Your Traces" guide
- Create "Debugging with Traces" tutorial

### Developer Documentation
- Update `TRACING_COVERAGE_AUDIT.md` with new coverage stats
- Document trace hierarchy patterns
- Add examples for creating child spans

### API Documentation
- Document trace metadata fields
- Document operation types (llm_call, tool_call, retrieval, embedding, preprocessing)
- Document trace status values (success, failed)

---

## Open Questions

### Q1: Should we sample high-volume operations?
**Context**: Some operations (e.g., embeddings) may be very frequent  
**Options**:
- A) Trace everything (full visibility)
- B) Sample 1 in 10 operations (reduce overhead)
- C) Trace only on errors (minimal overhead)

**Recommendation**: Start with A (trace everything), implement B if overhead becomes issue

### Q2: How long should we retain traces?
**Context**: Traces table could grow large (100K+ traces/day)  
**Options**:
- A) Keep all traces forever (expensive)
- B) Retention policy: 30 days (balance cost/utility)
- C) Keep only failed traces + sampled success traces

**Recommendation**: B (30 days retention) with option to upgrade to longer retention for enterprise users

### Q3: Should we expose traces to users in UI?
**Context**: Traces could be valuable debugging tool for users  
**Options**:
- A) Admin-only (internal debugging)
- B) Power users (via opt-in flag)
- C) All users (full transparency)

**Recommendation**: Start with A (admin-only), expand to B in Phase 7 (Trace Visualization UI)

---

## Appendix A: File Locations Verified

### Core Tracing Files
- ✅ `lib/tracing/trace.service.ts` - Core tracing logic (370 lines)
- ✅ `lib/tracing/types.ts` - Type definitions
- ✅ `lib/billing/usage-meter.service.ts` - Metering integration (214 lines)

### Files to Modify (Phase 2)
- ✅ `app/api/chat/route.ts` - Tool call handler (lines 604-645)
  - Import traceService: Line 28 ✅
  - Import TraceContext: Line 29 ✅
  - toolCallHandler function: Lines 604-645 ✅

### Files to Modify (Phase 3)
- ✅ `lib/graphrag/graphiti/search-service.ts` - Search service (233 lines)
  - search() function: Lines 19-72 ✅
  - Need to add imports: traceService, TraceContext ❌
  - Need to update signature: Add parentTraceContext parameter ❌

- ✅ `lib/graphrag/service/graphrag-service.ts` - Main GraphRAG service (233 lines)
  - enhancePrompt() function: Lines 42-150 ✅
  - Need to add parentTraceContext parameter ❌
  - Need to pass to search() call at line 107 ❌

### Files to Modify (Phase 5)
- ⚠️ `app/api/chat/route.ts` - Prompt building (need to locate exact section)
  - GraphRAG enhancement: Around lines 680-700 (need verification)
  - Message array construction: Need to locate
  - System message injection: Need to locate

### Files to Investigate (Phase 4)
- ⚠️ Embedding service location unknown (no dedicated file found)
  - May be embedded in Graphiti client
  - May be part of GraphRAG search flow
  - Need deeper investigation

---

## Appendix B: Database Schema (Existing)

### llm_traces Table (No Changes Needed)
```sql
CREATE TABLE llm_traces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trace_id TEXT NOT NULL,
  span_id TEXT NOT NULL,
  parent_trace_id TEXT,  -- For hierarchical traces
  user_id UUID NOT NULL,
  conversation_id UUID,
  message_id UUID,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  operation_type TEXT NOT NULL,  -- 'llm_call', 'tool_call', 'retrieval', 'embedding', 'preprocessing', 'agent_workflow'
  status TEXT NOT NULL,  -- 'success', 'failed'
  span_name TEXT,
  model_name TEXT,
  model_provider TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd DECIMAL(10, 6),
  error_message TEXT,
  error_type TEXT,
  input_data JSONB,
  output_data JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes (Existing)**:
- `idx_traces_user_id` on user_id
- `idx_traces_trace_id` on trace_id
- `idx_traces_parent_trace_id` on parent_trace_id
- `idx_traces_created_at` on created_at

---

## Appendix C: Trace Hierarchy Example

### Before (Current State)
```
User Request: "Search for AI papers and summarize"

[ROOT: llm.completion] trace_123
  - operation_type: llm_call
  - status: success
  - parent_trace_id: NULL  ← Metered for billing
```

### After Phase 2 (Tool Tracing)
```
User Request: "Search for AI papers and summarize"

[ROOT: llm.completion] trace_123  ← Metered for billing
  - operation_type: llm_call
  - status: success
  - parent_trace_id: NULL

  [CHILD: tool.web_search] span_456
    - operation_type: tool_call
    - status: success
    - parent_trace_id: trace_123  ← NOT metered (child)
```

### After Phase 3 (GraphRAG Tracing)
```
User Request: "What did we discuss about AI safety?"

[ROOT: llm.completion] trace_789  ← Metered for billing
  - operation_type: llm_call
  - status: success
  - parent_trace_id: NULL

  [CHILD: graphrag.retrieve] span_101
    - operation_type: retrieval
    - status: success
    - parent_trace_id: trace_789  ← NOT metered (child)
    - metadata: { nodesRetrieved: 5, queryTimeMs: 45 }
```

### After Phase 6 (Agent Loop)
```
User Request: "Research AI safety papers and create a summary"

[ROOT: agent.loop] trace_202  ← Metered for billing
  - operation_type: agent_workflow
  - status: success
  - parent_trace_id: NULL

  [CHILD: tool.web_search] span_303
    - operation_type: tool_call
    - status: success
    - parent_trace_id: trace_202

  [CHILD: llm.completion] span_404
    - operation_type: llm_call
    - status: success
    - parent_trace_id: trace_202

  [CHILD: graphrag.retrieve] span_505
    - operation_type: retrieval
    - status: success
    - parent_trace_id: trace_202

  [CHILD: llm.completion] span_606  ← Final summary
    - operation_type: llm_call
    - status: success
    - parent_trace_id: trace_202
```

---

**End of Implementation Plan**

## Next Steps

1. **Review this plan** - Verify all code locations, proposed changes
2. **Approve phases** - Which phases to implement first?
3. **Create branch** - `feature/tracing-expansion-phase-2`
4. **Implement Phase 2** - Tool call tracing (4-6 hours)
5. **Test Phase 2** - Verify traces appear, no breaking changes
6. **Proceed to Phase 3** - After Phase 2 verified working

**AWAITING YOUR APPROVAL TO PROCEED** ✋
