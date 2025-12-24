# Traces Tool Implementation Plan

**Goal:** Give the AI assistant full access to execution trace data for viewing, filtering, and comparing traces across training runs and model performance.

---

## 1. Tool Specification

### Tool Definition (OpenAI/Anthropic Format)

```typescript
{
  type: 'function',
  function: {
    name: 'get_traces',
    description: `Retrieve and analyze execution traces of LLM operations. Traces provide detailed insights into:
    - Request/response cycles and latency
    - Tool calls and their execution
    - Model invocations and performance
    - RAG retrieval metrics and groundedness
    - Token usage and costs
    - Error information and debugging data

    Use this to:
    - Debug production issues
    - Compare model performance across runs
    - Track multi-step agent operations
    - Analyze RAG effectiveness
    - Audit model behavior
    - Investigate latency and performance`,
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: [
            'get_traces',           // Retrieve traces with filtering
            'get_trace_details',    // Get single trace with full hierarchy
            'compare_traces',       // Compare metrics across traces
            'get_trace_summary',    // Aggregate statistics
            'get_rag_metrics',      // RAG-specific metrics
            'get_performance_stats' // Performance analysis
          ],
          description: 'Operation to perform'
        },

        // Filtering parameters (for get_traces operation)
        conversation_id: {
          type: 'string',
          description: 'Filter traces by conversation ID'
        },
        trace_id: {
          type: 'string',
          description: 'Get specific trace (with hierarchy if operation is get_trace_details)'
        },
        message_id: {
          type: 'string',
          description: 'Filter traces by message ID'
        },
        session_tag: {
          type: 'string',
          description: 'Filter traces by session tag (experiment tracking)'
        },
        operation_type: {
          type: 'string',
          description: 'Filter by operation type (llm_call, tool_call, rag_query, etc.)'
        },
        model_name: {
          type: 'string',
          description: 'Filter by model name'
        },
        model_provider: {
          type: 'string',
          description: 'Filter by provider (openai, anthropic, etc.)'
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'error'],
          description: 'Filter by trace status'
        },

        // Time range filtering
        start_date: {
          type: 'string',
          description: 'Filter traces after this date (ISO 8601 format)'
        },
        end_date: {
          type: 'string',
          description: 'Filter traces before this date (ISO 8601 format)'
        },

        // Performance filtering
        min_duration_ms: {
          type: 'number',
          description: 'Minimum duration in milliseconds'
        },
        max_duration_ms: {
          type: 'number',
          description: 'Maximum duration in milliseconds'
        },
        min_cost_usd: {
          type: 'number',
          description: 'Minimum cost in USD'
        },
        streaming_only: {
          type: 'boolean',
          description: 'Only return streaming traces'
        },

        // RAG filtering
        rag_used: {
          type: 'boolean',
          description: 'Filter traces that used RAG'
        },
        min_groundedness_score: {
          type: 'number',
          description: 'Minimum groundedness score (0-1)'
        },

        // Comparison parameters (for compare_traces operation)
        trace_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of trace IDs to compare'
        },
        compare_by: {
          type: 'string',
          enum: ['duration', 'tokens', 'cost', 'quality', 'rag_performance'],
          description: 'Metric to compare traces by'
        },

        // Pagination
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of traces to return (1-500)'
        },
        offset: {
          type: 'number',
          default: 0,
          description: 'Number of traces to skip for pagination'
        },

        // Options
        include_hierarchy: {
          type: 'boolean',
          default: false,
          description: 'Include child traces in hierarchical structure'
        },
        include_quality_data: {
          type: 'boolean',
          default: true,
          description: 'Include judgments and user ratings'
        },
        include_input_output: {
          type: 'boolean',
          default: false,
          description: 'Include full input/output data (can be large)'
        }
      },
      required: ['operation']
    }
  }
}
```

---

## 2. Implementation Structure

### File Organization

```
lib/tools/analytics/
├── traces.handler.ts          (NEW - Main handler)
└── traces-comparison.ts       (NEW - Comparison utilities)

app/api/analytics/
└── traces/
    └── route.ts               (EXISTS - API endpoint, already functional)
```

### Integration Points

**Add to tool registry:** `/lib/tools/analytics/index.ts`
```typescript
export { executeGetTraces } from './traces.handler';
```

**Add to analytics chat route:** `/app/api/analytics/chat/route.ts`
```typescript
import { executeGetTraces } from '@/lib/tools/analytics/traces.handler';

// In tool handler switch statement (around line 950):
case 'get_traces':
  return await executeGetTraces(args, userId, authHeader, authClient);
```

**Add to tools config:** `/lib/config/toolsConfig.ts`
```typescript
{
  name: 'get_traces',
  enabled: true,
  requiresAuth: true,
  description: 'View and compare execution traces...'
}
```

---

## 3. Full Trace Data Schema

### Core Fields (Always Included)

```typescript
{
  // Identity
  id: string;                    // Database ID
  trace_id: string;              // Trace identifier
  span_id: string;               // Unique span identifier
  span_name: string;             // e.g., "llm.completion", "rag.retrieve"
  parent_trace_id: string | null;// Parent span for hierarchy

  // Context
  user_id: string;
  conversation_id: string | null;
  message_id: string | null;
  session_tag: string | null;    // Experiment/session tracking

  // Operation
  operation_type: string;        // llm_call, tool_call, rag_query, etc.
  status: 'pending' | 'completed' | 'error';

  // Timing
  start_time: string;            // ISO 8601
  end_time: string | null;       // ISO 8601
  duration_ms: number | null;
  ttft_ms: number | null;        // Time to first token (streaming)
  tokens_per_second: number | null;

  // Model
  model_name: string | null;
  model_provider: string | null;
  model_version: string | null;

  // Tokens & Cost
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | null;

  // Performance Metrics
  queue_time_ms: number | null;
  inference_time_ms: number | null;
  network_time_ms: number | null;
  streaming_enabled: boolean | null;
  chunk_usage: Record<string, unknown> | null;

  // Request Metadata
  api_endpoint: string | null;
  api_base_url: string | null;
  request_headers_sanitized: Record<string, unknown> | null;
  provider_request_id: string | null;

  // RAG Metrics
  context_tokens: number | null;
  retrieval_latency_ms: number | null;
  rag_graph_used: boolean | null;
  rag_nodes_retrieved: number | null;
  rag_chunks_used: number | null;
  rag_relevance_score: number | null;  // 0-1
  rag_answer_grounded: boolean | null;
  rag_retrieval_method: string | null;

  // Evaluation Metrics
  groundedness_score: number | null;   // 0-1
  response_quality_breakdown: Record<string, unknown> | null;
  warning_flags: string[] | null;
  reasoning: string | null;            // Extended thinking (Claude, Qwen, etc.)

  // Error Information
  error_message: string | null;
  error_type: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### Optional Enrichment (When `include_quality_data: true`)

```typescript
{
  // Quality Data (from enrichTracesWithQualityData)
  judgments?: Array<{
    id: string;
    trace_id: string;
    criterion: string;           // e.g., "helpfulness", "accuracy"
    score: number;               // 0-1
    passed: boolean;
    judge_type: 'llm' | 'rule' | 'human';
    judge_name: string;
    notes: string | null;
  }>;

  user_rating?: number;          // 1-5 stars
  user_notes?: string;
}
```

### Optional Full Data (When `include_input_output: true`)

```typescript
{
  // Full I/O Data (can be large)
  input_data: Record<string, unknown> | null;   // Prompts, parameters, context
  output_data: Record<string, unknown> | null;  // Responses, results, tool outputs
  metadata: Record<string, unknown> | null;     // Custom fields, tool context
}
```

### Hierarchical Structure (When `include_hierarchy: true` or `operation: 'get_trace_details'`)

```typescript
{
  ...traceFields,
  children: Array<TraceHierarchyEntry>;  // Nested child traces (recursive)
}
```

---

## 4. Handler Implementation (`lib/tools/analytics/traces.handler.ts`)

### Skeleton Structure

```typescript
/**
 * Traces Tool Handler
 *
 * Provides access to execution traces for debugging and performance analysis.
 * Operations:
 * - get_traces: Retrieve filtered traces
 * - get_trace_details: Single trace with full hierarchy
 * - compare_traces: Compare metrics across traces
 * - get_trace_summary: Aggregate statistics
 * - get_rag_metrics: RAG-specific analysis
 * - get_performance_stats: Performance profiling
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

interface GetTracesArgs {
  operation: 'get_traces' | 'get_trace_details' | 'compare_traces' |
             'get_trace_summary' | 'get_rag_metrics' | 'get_performance_stats';

  // Filtering
  conversation_id?: string;
  trace_id?: string;
  message_id?: string;
  session_tag?: string;
  operation_type?: string;
  model_name?: string;
  model_provider?: string;
  status?: 'pending' | 'completed' | 'error';

  // Time range
  start_date?: string;
  end_date?: string;

  // Performance filters
  min_duration_ms?: number;
  max_duration_ms?: number;
  min_cost_usd?: number;
  streaming_only?: boolean;

  // RAG filters
  rag_used?: boolean;
  min_groundedness_score?: number;

  // Comparison
  trace_ids?: string[];
  compare_by?: 'duration' | 'tokens' | 'cost' | 'quality' | 'rag_performance';

  // Pagination
  limit?: number;
  offset?: number;

  // Options
  include_hierarchy?: boolean;
  include_quality_data?: boolean;
  include_input_output?: boolean;
}

export async function executeGetTraces(
  args: Record<string, unknown>,
  userId: string,
  authHeader?: string,
  authClient?: any
): Promise<any> {
  console.log('[GetTraces] Executing:', args.operation);

  const typedArgs = args as unknown as GetTracesArgs;

  try {
    switch (typedArgs.operation) {
      case 'get_traces':
        return await getTraces(typedArgs, userId, authHeader!);

      case 'get_trace_details':
        return await getTraceDetails(typedArgs, userId, authHeader!);

      case 'compare_traces':
        return await compareTraces(typedArgs, userId, authHeader!);

      case 'get_trace_summary':
        return await getTraceSummary(typedArgs, userId, authHeader!);

      case 'get_rag_metrics':
        return await getRagMetrics(typedArgs, userId, authHeader!);

      case 'get_performance_stats':
        return await getPerformanceStats(typedArgs, userId, authHeader!);

      default:
        return { error: `Unknown operation: ${typedArgs.operation}` };
    }
  } catch (error) {
    console.error('[GetTraces] Error:', error);
    return {
      error: error instanceof Error ? error.message : 'Traces operation failed'
    };
  }
}
```

### Operation Functions

#### 1. `getTraces` - Retrieve Filtered Traces

```typescript
async function getTraces(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Fetching traces with filters:', {
    conversation_id: args.conversation_id,
    operation_type: args.operation_type,
    status: args.status
  });

  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (args.conversation_id) params.append('conversation_id', args.conversation_id);
    if (args.trace_id) params.append('trace_id', args.trace_id);
    if (args.message_id) params.append('message_id', args.message_id);
    if (args.operation_type) params.append('operation_type', args.operation_type);
    if (args.status) params.append('status', args.status);
    if (args.limit) params.append('limit', args.limit.toString());
    if (args.offset) params.append('offset', args.offset.toString());

    // Call existing traces API
    const url = `${appUrl}/api/analytics/traces?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Failed to fetch traces: ${response.status}`,
        details: errorText.slice(0, 200)
      };
    }

    const data = await response.json();
    const traces = data.data || [];

    // Additional filtering (not supported by API)
    let filteredTraces = traces;

    // Filter by session_tag
    if (args.session_tag) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.session_tag === args.session_tag
      );
    }

    // Filter by model
    if (args.model_name) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.model_name?.includes(args.model_name!)
      );
    }

    if (args.model_provider) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.model_provider === args.model_provider
      );
    }

    // Filter by time range
    if (args.start_date) {
      const startTime = new Date(args.start_date).getTime();
      filteredTraces = filteredTraces.filter((t: any) =>
        new Date(t.start_time).getTime() >= startTime
      );
    }

    if (args.end_date) {
      const endTime = new Date(args.end_date).getTime();
      filteredTraces = filteredTraces.filter((t: any) =>
        new Date(t.start_time).getTime() <= endTime
      );
    }

    // Filter by performance
    if (args.min_duration_ms !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.duration_ms && t.duration_ms >= args.min_duration_ms!
      );
    }

    if (args.max_duration_ms !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.duration_ms && t.duration_ms <= args.max_duration_ms!
      );
    }

    if (args.min_cost_usd !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.cost_usd && t.cost_usd >= args.min_cost_usd!
      );
    }

    if (args.streaming_only) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.streaming_enabled === true
      );
    }

    // Filter by RAG
    if (args.rag_used !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.rag_graph_used === args.rag_used
      );
    }

    if (args.min_groundedness_score !== undefined) {
      filteredTraces = filteredTraces.filter((t: any) =>
        t.groundedness_score && t.groundedness_score >= args.min_groundedness_score!
      );
    }

    // Format response for LLM
    const formattedTraces = filteredTraces.map((trace: any) => {
      const formatted: any = {
        trace_id: trace.trace_id,
        span_id: trace.span_id,
        span_name: trace.span_name,
        operation_type: trace.operation_type,
        status: trace.status,

        // Timing
        start_time: trace.start_time,
        duration_ms: trace.duration_ms,
        ttft_ms: trace.ttft_ms,

        // Model
        model_name: trace.model_name,
        model_provider: trace.model_provider,

        // Tokens & Cost
        input_tokens: trace.input_tokens,
        output_tokens: trace.output_tokens,
        total_tokens: trace.total_tokens,
        cost_usd: trace.cost_usd,

        // Context
        conversation_id: trace.conversation_id,
        message_id: trace.message_id,
        session_tag: trace.session_tag
      };

      // Add performance metrics if available
      if (trace.queue_time_ms || trace.inference_time_ms || trace.network_time_ms) {
        formatted.performance = {
          queue_time_ms: trace.queue_time_ms,
          inference_time_ms: trace.inference_time_ms,
          network_time_ms: trace.network_time_ms,
          tokens_per_second: trace.tokens_per_second,
          streaming_enabled: trace.streaming_enabled
        };
      }

      // Add RAG metrics if available
      if (trace.rag_graph_used) {
        formatted.rag_metrics = {
          rag_graph_used: trace.rag_graph_used,
          rag_nodes_retrieved: trace.rag_nodes_retrieved,
          rag_chunks_used: trace.rag_chunks_used,
          rag_relevance_score: trace.rag_relevance_score,
          rag_answer_grounded: trace.rag_answer_grounded,
          retrieval_latency_ms: trace.retrieval_latency_ms,
          context_tokens: trace.context_tokens
        };
      }

      // Add quality data if included
      if (args.include_quality_data !== false && (trace.judgments || trace.user_rating)) {
        formatted.quality = {
          judgments: trace.judgments,
          user_rating: trace.user_rating,
          user_notes: trace.user_notes,
          groundedness_score: trace.groundedness_score
        };
      }

      // Add error info if failed
      if (trace.status === 'error') {
        formatted.error = {
          error_message: trace.error_message,
          error_type: trace.error_type
        };
      }

      // Add I/O data if requested
      if (args.include_input_output && (trace.input_data || trace.output_data)) {
        formatted.input_data = trace.input_data;
        formatted.output_data = trace.output_data;
      }

      return formatted;
    });

    return {
      success: true,
      traces: formattedTraces,
      total_count: filteredTraces.length,
      filters_applied: {
        conversation_id: args.conversation_id,
        session_tag: args.session_tag,
        operation_type: args.operation_type,
        model_name: args.model_name,
        status: args.status,
        rag_used: args.rag_used
      },
      pagination: {
        limit: args.limit || 50,
        offset: args.offset || 0
      }
    };

  } catch (error) {
    console.error('[GetTraces] getTraces error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get traces'
    };
  }
}
```

#### 2. `getTraceDetails` - Single Trace with Hierarchy

```typescript
async function getTraceDetails(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting trace details:', args.trace_id);

  if (!args.trace_id) {
    return { error: 'trace_id is required for get_trace_details operation' };
  }

  try {
    // Call API with trace_id to get hierarchical structure
    const url = `${appUrl}/api/analytics/traces?trace_id=${args.trace_id}&limit=1000`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    if (!response.ok) {
      return { error: `Failed to fetch trace: ${response.status}` };
    }

    const data = await response.json();
    const traceHierarchy = data.data;

    if (!traceHierarchy || traceHierarchy.length === 0) {
      return { error: 'Trace not found' };
    }

    // API returns hierarchical structure when trace_id is provided
    const rootTrace = traceHierarchy[0];

    return {
      success: true,
      trace: rootTrace,
      summary: {
        total_spans: countSpans(rootTrace),
        total_duration_ms: rootTrace.duration_ms,
        total_tokens: rootTrace.total_tokens,
        total_cost_usd: rootTrace.cost_usd,
        has_errors: hasErrors(rootTrace),
        child_traces: rootTrace.children?.length || 0
      }
    };

  } catch (error) {
    console.error('[GetTraces] getTraceDetails error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get trace details'
    };
  }
}

// Helper: Count total spans in hierarchy
function countSpans(trace: any): number {
  let count = 1;
  if (trace.children) {
    for (const child of trace.children) {
      count += countSpans(child);
    }
  }
  return count;
}

// Helper: Check if hierarchy has errors
function hasErrors(trace: any): boolean {
  if (trace.status === 'error') return true;
  if (trace.children) {
    for (const child of trace.children) {
      if (hasErrors(child)) return true;
    }
  }
  return false;
}
```

#### 3. `compareTraces` - Compare Metrics

```typescript
async function compareTraces(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Comparing traces:', args.trace_ids);

  if (!args.trace_ids || args.trace_ids.length < 2) {
    return { error: 'At least 2 trace_ids required for comparison' };
  }

  if (args.trace_ids.length > 10) {
    return { error: 'Maximum 10 traces can be compared at once' };
  }

  try {
    // Fetch all traces
    const tracePromises = args.trace_ids.map(traceId =>
      fetch(`${appUrl}/api/analytics/traces?trace_id=${traceId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      }).then(res => res.json())
    );

    const results = await Promise.all(tracePromises);
    const traces = results
      .filter(r => r.success && r.data?.length > 0)
      .map(r => r.data[0]);

    if (traces.length < 2) {
      return { error: 'Could not find enough traces to compare' };
    }

    // Compare by specified metric
    const compareBy = args.compare_by || 'duration';

    let comparison: any = {
      traces_compared: traces.length,
      compare_by: compareBy,
      traces: []
    };

    switch (compareBy) {
      case 'duration':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          duration_ms: t.duration_ms,
          ttft_ms: t.ttft_ms,
          tokens_per_second: t.tokens_per_second,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.duration_ms || 0) - (a.duration_ms || 0));

        comparison.fastest = comparison.traces[comparison.traces.length - 1];
        comparison.slowest = comparison.traces[0];
        comparison.avg_duration_ms = average(traces.map((t: any) => t.duration_ms || 0));
        break;

      case 'tokens':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          input_tokens: t.input_tokens,
          output_tokens: t.output_tokens,
          total_tokens: t.total_tokens,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.total_tokens || 0) - (a.total_tokens || 0));

        comparison.total_tokens_sum = sum(traces.map((t: any) => t.total_tokens || 0));
        comparison.avg_tokens = average(traces.map((t: any) => t.total_tokens || 0));
        break;

      case 'cost':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          cost_usd: t.cost_usd,
          total_tokens: t.total_tokens,
          cost_per_1k_tokens: t.cost_usd && t.total_tokens
            ? (t.cost_usd / t.total_tokens) * 1000
            : null,
          model_name: t.model_name
        })).sort((a: any, b: any) => (b.cost_usd || 0) - (a.cost_usd || 0));

        comparison.total_cost_usd = sum(traces.map((t: any) => t.cost_usd || 0));
        comparison.avg_cost_usd = average(traces.map((t: any) => t.cost_usd || 0));
        comparison.most_expensive = comparison.traces[0];
        comparison.least_expensive = comparison.traces[comparison.traces.length - 1];
        break;

      case 'quality':
        comparison.traces = traces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          groundedness_score: t.groundedness_score,
          user_rating: t.user_rating,
          judgments_passed: t.judgments?.filter((j: any) => j.passed).length || 0,
          judgments_total: t.judgments?.length || 0,
          model_name: t.model_name
        }));

        comparison.avg_groundedness = average(
          traces.map((t: any) => t.groundedness_score).filter((s: any) => s !== null)
        );
        break;

      case 'rag_performance':
        const ragTraces = traces.filter((t: any) => t.rag_graph_used);
        comparison.traces = ragTraces.map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          rag_nodes_retrieved: t.rag_nodes_retrieved,
          rag_chunks_used: t.rag_chunks_used,
          rag_relevance_score: t.rag_relevance_score,
          retrieval_latency_ms: t.retrieval_latency_ms,
          groundedness_score: t.groundedness_score,
          model_name: t.model_name
        }));

        comparison.avg_retrieval_latency_ms = average(
          ragTraces.map((t: any) => t.retrieval_latency_ms || 0)
        );
        comparison.avg_relevance_score = average(
          ragTraces.map((t: any) => t.rag_relevance_score).filter((s: any) => s !== null)
        );
        break;
    }

    return {
      success: true,
      comparison
    };

  } catch (error) {
    console.error('[GetTraces] compareTraces error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to compare traces'
    };
  }
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}
```

#### 4. `getTraceSummary` - Aggregate Statistics

```typescript
async function getTraceSummary(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting trace summary');

  try {
    // Get traces with same filters as get_traces
    const tracesResult = await getTraces(args, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const traces = tracesResult.traces;

    if (traces.length === 0) {
      return {
        success: true,
        summary: {
          total_traces: 0,
          message: 'No traces found matching filters'
        }
      };
    }

    // Calculate aggregate statistics
    const summary = {
      total_traces: traces.length,

      // Status breakdown
      status_breakdown: {
        completed: traces.filter((t: any) => t.status === 'completed').length,
        pending: traces.filter((t: any) => t.status === 'pending').length,
        error: traces.filter((t: any) => t.status === 'error').length
      },

      // Operation types
      operation_types: groupBy(traces, 'operation_type'),

      // Model breakdown
      models_used: groupBy(traces, 'model_name'),

      // Timing statistics
      timing: {
        avg_duration_ms: average(traces.map((t: any) => t.duration_ms || 0)),
        min_duration_ms: Math.min(...traces.map((t: any) => t.duration_ms || 0)),
        max_duration_ms: Math.max(...traces.map((t: any) => t.duration_ms || 0)),
        avg_ttft_ms: average(
          traces.filter((t: any) => t.ttft_ms !== null).map((t: any) => t.ttft_ms)
        )
      },

      // Token statistics
      tokens: {
        total_input_tokens: sum(traces.map((t: any) => t.input_tokens || 0)),
        total_output_tokens: sum(traces.map((t: any) => t.output_tokens || 0)),
        total_tokens: sum(traces.map((t: any) => t.total_tokens || 0)),
        avg_tokens_per_trace: average(traces.map((t: any) => t.total_tokens || 0))
      },

      // Cost statistics
      cost: {
        total_cost_usd: sum(traces.map((t: any) => t.cost_usd || 0)),
        avg_cost_per_trace: average(traces.map((t: any) => t.cost_usd || 0)),
        cost_by_model: groupBySum(traces, 'model_name', 'cost_usd')
      },

      // RAG statistics
      rag: {
        traces_with_rag: traces.filter((t: any) => t.rag_metrics?.rag_graph_used).length,
        avg_rag_relevance: average(
          traces
            .filter((t: any) => t.rag_metrics?.rag_relevance_score !== null)
            .map((t: any) => t.rag_metrics.rag_relevance_score)
        ),
        avg_retrieval_latency_ms: average(
          traces
            .filter((t: any) => t.rag_metrics?.retrieval_latency_ms)
            .map((t: any) => t.rag_metrics.retrieval_latency_ms)
        )
      },

      // Performance
      performance: {
        streaming_traces: traces.filter((t: any) =>
          t.performance?.streaming_enabled === true
        ).length,
        avg_tokens_per_second: average(
          traces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        )
      },

      // Time range
      time_range: {
        earliest_trace: traces[traces.length - 1]?.start_time,
        latest_trace: traces[0]?.start_time
      }
    };

    return {
      success: true,
      summary,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getTraceSummary error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get trace summary'
    };
  }
}

function groupBy(items: any[], key: string): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const item of items) {
    const value = item[key] || 'unknown';
    groups[value] = (groups[value] || 0) + 1;
  }
  return groups;
}

function groupBySum(items: any[], groupKey: string, sumKey: string): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const item of items) {
    const group = item[groupKey] || 'unknown';
    const value = item[sumKey] || 0;
    groups[group] = (groups[group] || 0) + value;
  }
  return groups;
}
```

#### 5. `getRagMetrics` - RAG-Specific Analysis

```typescript
async function getRagMetrics(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting RAG metrics');

  try {
    // Get traces filtered for RAG usage
    const ragArgs = { ...args, rag_used: true };
    const tracesResult = await getTraces(ragArgs, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const ragTraces = tracesResult.traces.filter((t: any) => t.rag_metrics);

    if (ragTraces.length === 0) {
      return {
        success: true,
        rag_metrics: {
          total_rag_traces: 0,
          message: 'No traces with RAG found matching filters'
        }
      };
    }

    const ragMetrics = {
      total_rag_traces: ragTraces.length,

      // Retrieval statistics
      retrieval: {
        avg_nodes_retrieved: average(
          ragTraces.map((t: any) => t.rag_metrics.rag_nodes_retrieved || 0)
        ),
        avg_chunks_used: average(
          ragTraces.map((t: any) => t.rag_metrics.rag_chunks_used || 0)
        ),
        avg_retrieval_latency_ms: average(
          ragTraces.map((t: any) => t.rag_metrics.retrieval_latency_ms || 0)
        )
      },

      // Quality metrics
      quality: {
        avg_relevance_score: average(
          ragTraces
            .filter((t: any) => t.rag_metrics.rag_relevance_score !== null)
            .map((t: any) => t.rag_metrics.rag_relevance_score)
        ),
        avg_groundedness_score: average(
          ragTraces
            .filter((t: any) => t.quality?.groundedness_score !== null)
            .map((t: any) => t.quality.groundedness_score)
        ),
        grounded_answers: ragTraces.filter((t: any) =>
          t.rag_metrics.rag_answer_grounded === true
        ).length,
        grounded_percentage: (
          ragTraces.filter((t: any) =>
            t.rag_metrics.rag_answer_grounded === true
          ).length / ragTraces.length
        ) * 100
      },

      // Retrieval methods
      retrieval_methods: groupBy(
        ragTraces.filter((t: any) => t.rag_metrics.rag_retrieval_method),
        'rag_metrics.rag_retrieval_method'
      ),

      // Context usage
      context: {
        avg_context_tokens: average(
          ragTraces.map((t: any) => t.rag_metrics.context_tokens || 0)
        ),
        total_context_tokens: sum(
          ragTraces.map((t: any) => t.rag_metrics.context_tokens || 0)
        )
      },

      // Performance impact
      performance_impact: {
        avg_total_duration_ms: average(
          ragTraces.map((t: any) => t.duration_ms || 0)
        ),
        retrieval_latency_percentage: (
          average(ragTraces.map((t: any) => t.rag_metrics.retrieval_latency_ms || 0)) /
          average(ragTraces.map((t: any) => t.duration_ms || 1))
        ) * 100
      }
    };

    return {
      success: true,
      rag_metrics: ragMetrics,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getRagMetrics error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get RAG metrics'
    };
  }
}
```

#### 6. `getPerformanceStats` - Performance Profiling

```typescript
async function getPerformanceStats(args: GetTracesArgs, userId: string, authHeader: string): Promise<any> {
  console.log('[GetTraces] Getting performance stats');

  try {
    const tracesResult = await getTraces(args, userId, authHeader);

    if (!tracesResult.success) {
      return tracesResult;
    }

    const traces = tracesResult.traces;

    if (traces.length === 0) {
      return {
        success: true,
        performance_stats: {
          total_traces: 0,
          message: 'No traces found matching filters'
        }
      };
    }

    // Separate streaming vs non-streaming
    const streamingTraces = traces.filter((t: any) => t.performance?.streaming_enabled);
    const nonStreamingTraces = traces.filter((t: any) =>
      t.performance?.streaming_enabled === false || !t.performance?.streaming_enabled
    );

    const performanceStats = {
      total_traces: traces.length,

      // Overall timing
      timing: {
        avg_duration_ms: average(traces.map((t: any) => t.duration_ms || 0)),
        p50_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 50),
        p95_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 95),
        p99_duration_ms: percentile(traces.map((t: any) => t.duration_ms || 0), 99),
        min_duration_ms: Math.min(...traces.map((t: any) => t.duration_ms || 0)),
        max_duration_ms: Math.max(...traces.map((t: any) => t.duration_ms || 0))
      },

      // Streaming vs Non-streaming
      streaming_comparison: {
        streaming_count: streamingTraces.length,
        non_streaming_count: nonStreamingTraces.length,
        streaming_avg_duration_ms: average(
          streamingTraces.map((t: any) => t.duration_ms || 0)
        ),
        non_streaming_avg_duration_ms: average(
          nonStreamingTraces.map((t: any) => t.duration_ms || 0)
        ),
        streaming_avg_ttft_ms: average(
          streamingTraces.filter((t: any) => t.ttft_ms).map((t: any) => t.ttft_ms)
        ),
        streaming_avg_tokens_per_sec: average(
          streamingTraces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        )
      },

      // Latency breakdown
      latency_breakdown: {
        avg_queue_time_ms: average(
          traces
            .filter((t: any) => t.performance?.queue_time_ms)
            .map((t: any) => t.performance.queue_time_ms)
        ),
        avg_inference_time_ms: average(
          traces
            .filter((t: any) => t.performance?.inference_time_ms)
            .map((t: any) => t.performance.inference_time_ms)
        ),
        avg_network_time_ms: average(
          traces
            .filter((t: any) => t.performance?.network_time_ms)
            .map((t: any) => t.performance.network_time_ms)
        )
      },

      // Performance by model
      by_model: {},

      // Slowest traces
      slowest_traces: traces
        .sort((a: any, b: any) => (b.duration_ms || 0) - (a.duration_ms || 0))
        .slice(0, 5)
        .map((t: any) => ({
          trace_id: t.trace_id,
          span_name: t.span_name,
          duration_ms: t.duration_ms,
          model_name: t.model_name,
          total_tokens: t.total_tokens
        })),

      // Error rate
      errors: {
        total_errors: traces.filter((t: any) => t.status === 'error').length,
        error_rate: (
          traces.filter((t: any) => t.status === 'error').length / traces.length
        ) * 100
      }
    };

    // Group performance by model
    const modelGroups = groupBy(traces, 'model_name');
    for (const [model, count] of Object.entries(modelGroups)) {
      const modelTraces = traces.filter((t: any) => (t.model_name || 'unknown') === model);
      (performanceStats.by_model as any)[model] = {
        trace_count: count,
        avg_duration_ms: average(modelTraces.map((t: any) => t.duration_ms || 0)),
        avg_tokens_per_second: average(
          modelTraces
            .filter((t: any) => t.performance?.tokens_per_second)
            .map((t: any) => t.performance.tokens_per_second)
        ),
        avg_cost_usd: average(modelTraces.map((t: any) => t.cost_usd || 0))
      };
    }

    return {
      success: true,
      performance_stats: performanceStats,
      filters_applied: tracesResult.filters_applied
    };

  } catch (error) {
    console.error('[GetTraces] getPerformanceStats error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to get performance stats'
    };
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
```

---

## 5. Error Handling & Edge Cases

### Error Scenarios

1. **Authentication Failures**
   - Missing or invalid auth header
   - User doesn't have access to requested traces
   - Return: `{ error: 'Unauthorized', details: '...' }`

2. **Invalid Parameters**
   - Invalid trace_id format
   - Invalid date formats
   - Out of range values (limit > 500, etc.)
   - Return: `{ error: 'Invalid parameters', details: '...' }`

3. **Not Found**
   - Trace doesn't exist
   - Conversation has no traces
   - Return: `{ success: true, traces: [], total_count: 0 }`

4. **API Failures**
   - Traces API endpoint down
   - Database connection issues
   - Return: `{ error: 'Service unavailable', details: '...' }`

5. **Large Result Sets**
   - Enforce max limit of 500 traces
   - Warn if result set is large
   - Suggest using filters or pagination

### Validation Logic

```typescript
function validateArgs(args: GetTracesArgs): { valid: boolean; error?: string } {
  // Validate limit
  if (args.limit && (args.limit < 1 || args.limit > 500)) {
    return { valid: false, error: 'limit must be between 1 and 500' };
  }

  // Validate offset
  if (args.offset && args.offset < 0) {
    return { valid: false, error: 'offset must be >= 0' };
  }

  // Validate trace_ids for comparison
  if (args.operation === 'compare_traces') {
    if (!args.trace_ids || args.trace_ids.length < 2) {
      return { valid: false, error: 'At least 2 trace_ids required for comparison' };
    }
    if (args.trace_ids.length > 10) {
      return { valid: false, error: 'Maximum 10 traces can be compared' };
    }
  }

  // Validate trace_id for details
  if (args.operation === 'get_trace_details' && !args.trace_id) {
    return { valid: false, error: 'trace_id required for get_trace_details' };
  }

  // Validate date formats
  if (args.start_date && isNaN(Date.parse(args.start_date))) {
    return { valid: false, error: 'Invalid start_date format (use ISO 8601)' };
  }
  if (args.end_date && isNaN(Date.parse(args.end_date))) {
    return { valid: false, error: 'Invalid end_date format (use ISO 8601)' };
  }

  return { valid: true };
}
```

---

## 6. Testing Strategy

### Unit Tests

Create `/lib/tools/analytics/__tests__/traces.handler.test.ts`:

```typescript
describe('Traces Tool Handler', () => {
  describe('getTraces', () => {
    it('should fetch traces with conversation_id filter', async () => {
      // Test basic filtering
    });

    it('should apply client-side filters (session_tag, model_name)', async () => {
      // Test additional filtering
    });

    it('should respect pagination limits', async () => {
      // Test pagination
    });
  });

  describe('getTraceDetails', () => {
    it('should return hierarchical trace structure', async () => {
      // Test hierarchy
    });

    it('should count total spans correctly', async () => {
      // Test span counting
    });
  });

  describe('compareTraces', () => {
    it('should compare traces by duration', async () => {
      // Test duration comparison
    });

    it('should compare traces by cost', async () => {
      // Test cost comparison
    });

    it('should handle RAG performance comparison', async () => {
      // Test RAG comparison
    });
  });

  describe('getTraceSummary', () => {
    it('should calculate aggregate statistics', async () => {
      // Test aggregation
    });

    it('should group by operation type and model', async () => {
      // Test grouping
    });
  });

  describe('getRagMetrics', () => {
    it('should filter for RAG traces only', async () => {
      // Test RAG filtering
    });

    it('should calculate RAG quality metrics', async () => {
      // Test quality metrics
    });
  });

  describe('getPerformanceStats', () => {
    it('should calculate percentiles correctly', async () => {
      // Test percentiles
    });

    it('should separate streaming vs non-streaming', async () => {
      // Test separation
    });
  });
});
```

### Integration Tests

1. Test with real traces API
2. Test authentication (session token & API key)
3. Test filtering combinations
4. Test large result sets
5. Test error scenarios

### Manual Testing Checklist

- [ ] Assistant can retrieve traces by conversation
- [ ] Assistant can view single trace with hierarchy
- [ ] Assistant can compare 2+ traces
- [ ] Assistant can analyze RAG performance
- [ ] Assistant can identify performance bottlenecks
- [ ] Assistant provides meaningful insights to users
- [ ] Error messages are helpful
- [ ] Large datasets don't crash

---

## 7. Documentation

### Assistant Context (System Prompt Addition)

Add to `/app/api/analytics/chat/route.ts` system prompt:

```
## Trace Analysis Capabilities

You have access to execution traces via the `get_traces` tool. Traces provide deep visibility into:

**What You Can Do:**
- View traces for specific conversations, sessions, or time ranges
- Compare performance across different models or runs
- Analyze RAG retrieval effectiveness and groundedness
- Debug errors and latency issues
- Track token usage and costs at trace level
- Identify performance bottlenecks

**Common User Requests:**
- "Show me traces for this conversation"
- "Compare the performance of model A vs model B"
- "Why was this response slow?"
- "How well is RAG working?"
- "What's causing these errors?"

**Tool Operations:**
- get_traces: Retrieve filtered traces
- get_trace_details: View single trace with hierarchy
- compare_traces: Compare metrics across traces
- get_trace_summary: Aggregate statistics
- get_rag_metrics: RAG-specific analysis
- get_performance_stats: Performance profiling

**Best Practices:**
- Use filters to narrow results (conversation_id, session_tag, time range)
- Compare traces when user asks about performance differences
- Look at RAG metrics when analyzing retrieval quality
- Check performance stats for latency issues
- Always explain insights in user-friendly terms
```

### User-Facing Documentation

Create `/docs/ASSISTANT_TRACES_GUIDE.md`:

```markdown
# Using the AI Assistant to Analyze Traces

The assistant can help you understand execution traces and debug performance issues.

## What You Can Ask

**View Traces:**
- "Show me traces for conversation [ID]"
- "What traces were created today?"
- "Show me all failed traces"

**Compare Performance:**
- "Compare traces [ID1] and [ID2]"
- "Which model is faster for this conversation?"
- "Compare RAG performance across these traces"

**Analyze Issues:**
- "Why was this response slow?"
- "What's causing errors in session [tag]?"
- "Show me the slowest traces this week"

**RAG Analysis:**
- "How well is RAG working?"
- "What's the average groundedness score?"
- "Show RAG metrics for this session"

## Example Conversations

[Examples of actual conversations with the assistant]
```

---

## 8. Rollout Plan

### Phase 1: Core Implementation (Week 1)
1. Create `traces.handler.ts` with all 6 operations
2. Add tool definition to analytics chat
3. Unit tests for all operations
4. Integration tests with traces API

### Phase 2: Testing & Refinement (Week 2)
1. Manual testing with real data
2. Performance optimization (caching, batching)
3. Error handling improvements
4. Assistant prompt refinement

### Phase 3: Documentation & Launch (Week 3)
1. Complete user documentation
2. Create example conversations
3. Train team on new capabilities
4. Monitor usage and gather feedback

### Phase 4: Enhancements (Ongoing)
1. Add visualization data formatting
2. Implement caching for frequently accessed traces
3. Add export functionality
4. Expand comparison capabilities

---

## 9. Success Metrics

Track these metrics after rollout:

- **Usage:**
  - Tool call frequency
  - Most common operations
  - Average traces per query

- **Performance:**
  - Response times
  - Error rates
  - API call efficiency

- **User Satisfaction:**
  - User feedback on insights quality
  - Repeat usage rate
  - Support ticket reduction

- **Business Impact:**
  - Faster debugging
  - Better model selection
  - Cost optimization insights

---

## 10. Future Enhancements

**Potential additions:**
- **Trace search:** Full-text search across trace metadata
- **Anomaly detection:** Automatically flag unusual traces
- **Trace replay:** Re-execute traces for debugging
- **Visualization data:** Format for UI charts/graphs
- **Alerting:** Notify when traces match conditions
- **Trace export:** Download traces as CSV/JSON
- **Batch comparison:** Compare hundreds of traces at once
- **ML insights:** Predict performance issues

---

## Summary

This implementation plan provides:
- ✅ **Full trace data access** - All 50+ fields available
- ✅ **6 powerful operations** - View, details, compare, summarize, RAG, performance
- ✅ **Flexible filtering** - By conversation, session, model, time, performance, RAG
- ✅ **Comparison capabilities** - Compare by duration, tokens, cost, quality, RAG
- ✅ **Aggregate analytics** - Summary stats, grouping, percentiles
- ✅ **Error handling** - Validation, edge cases, helpful errors
- ✅ **Testing strategy** - Unit, integration, manual testing
- ✅ **Documentation** - Assistant context, user guides, examples

The assistant will have comprehensive trace analysis capabilities to help users debug issues, optimize performance, and understand model behavior.
