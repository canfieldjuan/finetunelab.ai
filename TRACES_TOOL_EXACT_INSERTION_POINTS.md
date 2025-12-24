# Exact File Locations and Code Insertion Points for Traces Tool

This document identifies the precise files and line numbers where code needs to be added to implement the `get_traces` tool.

---

## Files to Modify

### 1. **CREATE NEW FILE**: `/lib/tools/analytics/traces.handler.ts`
**Action**: Create new file
**Location**: `/home/user/finetunelab.ai/lib/tools/analytics/traces.handler.ts`
**Content**: Full handler implementation (see TRACES_TOOL_IMPLEMENTATION_PLAN.md section 4)

---

### 2. **MODIFY**: `/app/api/analytics/chat/route.ts` (1,608 lines total)

#### **Insertion Point 1: Import Statement**
**Location**: Top of file, after existing imports
**Current Code** (lines 1-10):
```typescript
// API route for analytics chat - provides tools for analyzing tagged sessions
import { NextRequest } from 'next/server';
import type { ToolDefinition } from '@/lib/llm/openai';
import { supabase } from '@/lib/supabaseClient';
import { executeTool } from '@/lib/tools/toolManager';
import { createClient } from '@supabase/supabase-js';
import { executeTrainingMetrics } from '@/lib/tools/analytics/training-metrics.handler';
import { executeTrainingPredictions } from '@/lib/tools/analytics/training-predictions.handler';
import { executeAdvancedAnalytics } from '@/lib/tools/analytics/advanced-analytics.handler';

export const runtime = 'nodejs';
```

**ADD AFTER LINE 9** (after `executeAdvancedAnalytics` import):
```typescript
import { executeGetTraces } from '@/lib/tools/analytics/traces.handler';
```

**Result**:
```typescript
import { executeTrainingMetrics } from '@/lib/tools/analytics/training-metrics.handler';
import { executeTrainingPredictions } from '@/lib/tools/analytics/training-predictions.handler';
import { executeAdvancedAnalytics } from '@/lib/tools/analytics/advanced-analytics.handler';
import { executeGetTraces } from '@/lib/tools/analytics/traces.handler'; // NEW LINE

export const runtime = 'nodejs';
```

---

#### **Insertion Point 2: Tool Definition in `analyticsTools` Array**
**Location**: Inside `analyticsTools` array, after line 540 (after `query_knowledge_graph` tool)
**Current Code** (lines 519-541):
```typescript
  // Tool 17: Knowledge Graph Query
  {
    type: 'function',
    function: {
      name: 'query_knowledge_graph',
      description: "Search the user's uploaded documents and knowledge graph for relevant information. Use when user asks about their documents or wants to query their knowledge base.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query. Use empty string "" to list all documents.'
          },
          maxResults: {
            type: 'number',
            description: 'Max results (default: 30, max: 50)'
          }
        },
        required: ['query']
      }
    }
  }
];
```

**ADD BEFORE LINE 541** (before the closing `];`):
```typescript
  },
  // Tool 18: Get Traces
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
- Investigate latency and performance bottlenecks
- Audit model behavior`,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['get_traces', 'get_trace_details', 'compare_traces', 'get_trace_summary', 'get_rag_metrics', 'get_performance_stats'],
            description: 'Operation to perform'
          },
          conversation_id: {
            type: 'string',
            description: 'Filter traces by conversation ID'
          },
          trace_id: {
            type: 'string',
            description: 'Get specific trace (required for get_trace_details)'
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
          start_date: {
            type: 'string',
            description: 'Filter traces after this date (ISO 8601 format)'
          },
          end_date: {
            type: 'string',
            description: 'Filter traces before this date (ISO 8601 format)'
          },
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
          rag_used: {
            type: 'boolean',
            description: 'Filter traces that used RAG'
          },
          min_groundedness_score: {
            type: 'number',
            description: 'Minimum groundedness score (0-1)'
          },
          trace_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of trace IDs to compare (for compare_traces operation)'
          },
          compare_by: {
            type: 'string',
            enum: ['duration', 'tokens', 'cost', 'quality', 'rag_performance'],
            description: 'Metric to compare traces by (for compare_traces operation)'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of traces to return (default: 50, max: 500)'
          },
          offset: {
            type: 'number',
            description: 'Number of traces to skip for pagination (default: 0)'
          },
          include_hierarchy: {
            type: 'boolean',
            description: 'Include child traces in hierarchical structure (default: false)'
          },
          include_quality_data: {
            type: 'boolean',
            description: 'Include judgments and user ratings (default: true)'
          },
          include_input_output: {
            type: 'boolean',
            description: 'Include full input/output data - can be large (default: false)'
          }
        },
        required: ['operation']
      }
    }
  }
```

**Result**:
```typescript
      name: 'query_knowledge_graph',
      // ... parameters ...
    }
  },
  // Tool 18: Get Traces (NEW TOOL)
  {
    type: 'function',
    function: {
      name: 'get_traces',
      // ... (full definition above) ...
    }
  }
];
```

---

#### **Insertion Point 3: Tool Handler Case in Switch Statement**
**Location**: Inside `toolCallHandler` function, after line 1123 (after `query_knowledge_graph` case, before `default`)
**Current Code** (lines 1118-1127):
```typescript
      case 'query_knowledge_graph':
        const graphResult = await executeTool('query_knowledge_graph', args, '', undefined, userId, authClient);
        if (graphResult.error) {
          return { error: graphResult.error };
        }
        return graphResult.data;

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    console.error('[AnalyticsAPI] Tool execution error:', error);
    return { error: error instanceof Error ? error.message : 'Tool execution failed' };
  }
}
```

**ADD AFTER LINE 1123** (after `query_knowledge_graph` case, before `default`):
```typescript

      case 'get_traces':
        return await executeGetTraces(args, userId, authHeader, authClient);
```

**Result**:
```typescript
      case 'query_knowledge_graph':
        const graphResult = await executeTool('query_knowledge_graph', args, '', undefined, userId, authClient);
        if (graphResult.error) {
          return { error: graphResult.error };
        }
        return graphResult.data;

      case 'get_traces': // NEW CASE
        return await executeGetTraces(args, userId, authHeader, authClient);

      default:
        return { error: `Unknown tool: ${toolName}` };
```

---

## Summary of Changes

| File | Action | Lines to Modify | What to Add |
|------|--------|----------------|-------------|
| `/lib/tools/analytics/traces.handler.ts` | **CREATE** | N/A | New file with full handler implementation |
| `/app/api/analytics/chat/route.ts` | **MODIFY** | After line 9 | Import statement for `executeGetTraces` |
| `/app/api/analytics/chat/route.ts` | **MODIFY** | Before line 541 | Tool definition object in `analyticsTools` array |
| `/app/api/analytics/chat/route.ts` | **MODIFY** | After line 1123 | Case statement in `toolCallHandler` switch |

---

## Verification Steps

After making changes, verify:

1. **Import Check**:
   ```bash
   grep "executeGetTraces" /home/user/finetunelab.ai/app/api/analytics/chat/route.ts
   ```
   Should show the import on line ~10

2. **Tool Definition Check**:
   ```bash
   grep -n "get_traces" /home/user/finetunelab.ai/app/api/analytics/chat/route.ts
   ```
   Should show:
   - Tool name in `analyticsTools` array (~line 547)
   - Case statement in handler (~line 1125)

3. **Handler File Check**:
   ```bash
   test -f /home/user/finetunelab.ai/lib/tools/analytics/traces.handler.ts && echo "Handler exists" || echo "Handler missing"
   ```

4. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   Should have no errors related to traces tool

---

## Testing After Implementation

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Test via analytics chat**:
   - Navigate to analytics page
   - Ask assistant: "Show me traces for conversation [id]"
   - Verify tool is called and returns data

3. **Check browser console**:
   - Should see: `[AnalyticsAPI] get_traces called`
   - No errors in tool execution

4. **Test different operations**:
   - `get_traces` - Basic retrieval
   - `get_trace_details` - Single trace with hierarchy
   - `compare_traces` - Compare multiple traces
   - `get_trace_summary` - Aggregate statistics
   - `get_rag_metrics` - RAG analysis
   - `get_performance_stats` - Performance profiling

---

## Exact Line Numbers Summary

**File**: `/app/api/analytics/chat/route.ts` (1,608 lines)

| Insertion Point | Line Number | Context |
|----------------|-------------|---------|
| Import statement | After line 9 | After `import { executeAdvancedAnalytics }` |
| Tool definition | Before line 541 | Inside `analyticsTools` array, before `];` |
| Case statement | After line 1123 | Inside `toolCallHandler` switch, after `query_knowledge_graph` case |

**New File**: `/lib/tools/analytics/traces.handler.ts`
- Create with full implementation from TRACES_TOOL_IMPLEMENTATION_PLAN.md

---

## No Assumptions Made

All insertion points have been verified by:
1. Reading the actual file content
2. Checking existing tool patterns (training_metrics, advanced_analytics)
3. Verifying the switch statement structure
4. Confirming the import pattern
5. Matching the exact array structure for tool definitions

The traces tool follows the exact same pattern as existing analytics tools (`training_metrics`, `training_predictions`, `advanced_analytics`).
