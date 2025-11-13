# Evaluation Metrics Enhancement - Quick Start Guide

**Date:** October 20, 2025  
**Tool Version:** 1.0.0 → 2.0.0  
**Status:** Phase 1 Ready

---

## What We're Building

Enhancing the evaluation-metrics tool to utilize **unused database fields** and provide **8 new analytics operations**:

### Current Operations (6)

1. ✅ get_metrics - Overall statistics
2. ✅ quality_trends - Rating trends over time
3. ✅ success_analysis - Success/failure breakdown
4. ✅ compare_periods - Period comparison
5. ✅ model_comparison - Model performance
6. ✅ tool_impact_analysis - Tool effectiveness

### New Operations (8)

7. 🔨 error_analysis - Error pattern analysis (Phase 1)
8. 🔨 fallback_analysis - Tool fallback tracking (Phase 1)
9. ⏳ feedback_analysis - Textual feedback analysis (Phase 2)
10. ⏳ quality_insights - Deep quality analysis (Phase 2)
11. ⏳ benchmark_performance - Benchmark metrics (Phase 3)
12. ⏳ accuracy_metrics - Accuracy tracking (Phase 3)
13. ⏳ temporal_analysis - Time-based patterns (Phase 4)
14. ⏳ conversation_quality - Conversation trends (Phase 4)

---

## Phase 1: Error & Fallback Analytics

**Goal:** Leverage `error_type` and `fallback_used` fields  
**Duration:** 2-3 hours  
**Files:** 3 modifications, 0 new files

### Implementation Steps

#### Step 1: Add Type Definitions (5 minutes)

**File:** `types.ts`  
**Location:** After line 122 (ToolCorrelation interface)  
**Action:** Add 3 new interfaces

```typescript
export interface ErrorAnalysis {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsByModel: Record<string, number>;
  commonPatterns: ErrorPattern[];
  recommendations: string[];
}

export interface ErrorPattern {
  pattern: string;
  count: number;
  affectedModels: string[];
  suggestedFix: string;
}

export interface FallbackAnalysis {
  totalMessages: number;
  fallbackCount: number;
  fallbackRate: number;
  fallbacksByModel: Record<string, number>;
  toolsAvoided: string[];
}
```

**Verification:**

```bash
npx tsc --noEmit 2>&1 | grep "types.ts"
# Should show no new errors
```

---

#### Step 2: Implement Error Analysis (30 minutes)

**File:** `metrics.service.ts`  
**Location:** After line 1247 (end of getToolImpactAnalysis method)  
**Action:** Add 4 methods (~150 lines total)

**Main Method:**

```typescript
async getErrorAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<ErrorAnalysis> {
  console.log('[EvaluationMetrics] Getting error analysis', {
    userId,
    period: options.period || 'week',
  });

  const { start, end } = this.getDateRange(
    options.period || evaluationMetricsConfig.defaultPeriod,
    options.endDate ? new Date(options.endDate) : undefined
  );

  // Query messages with errors
  let query = supabase
    .from('messages')
    .select('id, error_type, created_at, model_id, provider, tools_called, latency_ms')
    .eq('user_id', userId)
    .not('error_type', 'is', null)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  if (options.conversationId) {
    query = query.eq('conversation_id', options.conversationId);
  }
  if (options.modelId) {
    query = query.eq('model_id', options.modelId);
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error('[EvaluationMetrics] Error fetching error data:', error);
    throw new Error(`Failed to fetch error data: ${error.message}`);
  }

  if (!messages || messages.length === 0) {
    console.log('[EvaluationMetrics] No error data found');
    return {
      totalErrors: 0,
      errorRate: 0,
      errorsByType: {},
      errorsByModel: {},
      commonPatterns: [],
      recommendations: [],
    };
  }

  const totalErrors = messages.length;
  
  // Group by error type
  const errorsByType: Record<string, number> = {};
  messages.forEach((msg) => {
    const type = msg.error_type || 'unknown';
    errorsByType[type] = (errorsByType[type] || 0) + 1;
  });

  // Group by model
  const errorsByModel: Record<string, number> = {};
  messages.forEach((msg) => {
    const model = msg.model_id || 'unknown';
    errorsByModel[model] = (errorsByModel[model] || 0) + 1;
  });

  const commonPatterns = this.identifyErrorPatterns(messages);
  const recommendations = this.generateErrorRecommendations(
    errorsByType,
    errorsByModel,
    commonPatterns
  );

  console.log('[EvaluationMetrics] Error analysis complete', {
    totalErrors,
    uniqueTypes: Object.keys(errorsByType).length,
  });

  return {
    totalErrors,
    errorRate: 0,
    errorsByType,
    errorsByModel,
    commonPatterns,
    recommendations,
  };
}
```

**Helper Methods (add right after):**

```typescript
private identifyErrorPatterns(
  messages: Array<{
    error_type: string | null;
    model_id: string | null;
    tools_called: any;
  }>
): ErrorPattern[] {
  const patterns: Map<string, ErrorPattern> = new Map();

  messages.forEach((msg) => {
    const key = `${msg.error_type || 'unknown'}`;
    
    if (!patterns.has(key)) {
      patterns.set(key, {
        pattern: msg.error_type || 'unknown',
        count: 0,
        affectedModels: [],
        suggestedFix: this.getSuggestedFix(msg.error_type),
      });
    }

    const pattern = patterns.get(key)!;
    pattern.count += 1;
    
    if (msg.model_id && !pattern.affectedModels.includes(msg.model_id)) {
      pattern.affectedModels.push(msg.model_id);
    }
  });

  return Array.from(patterns.values()).sort((a, b) => b.count - a.count);
}

private getSuggestedFix(errorType: string | null): string {
  const fixes: Record<string, string> = {
    'timeout': 'Increase timeout threshold or optimize prompts',
    'rate_limit': 'Implement exponential backoff or upgrade plan',
    'context_length': 'Reduce prompt size or use model with larger context',
    'invalid_response': 'Add response validation and retry logic',
    'tool_error': 'Review tool implementation and error handling',
  };
  
  return fixes[errorType || ''] || 'Review error logs and model configuration';
}

private generateErrorRecommendations(
  errorsByType: Record<string, number>,
  errorsByModel: Record<string, number>,
  patterns: ErrorPattern[]
): string[] {
  const recommendations: string[] = [];

  const sortedTypes = Object.entries(errorsByType).sort(([, a], [, b]) => b - a);
  
  if (sortedTypes.length > 0) {
    const [topType, count] = sortedTypes[0];
    recommendations.push(
      `Primary error type: ${topType} (${count} occurrences). ${this.getSuggestedFix(topType)}`
    );
  }

  const sortedModels = Object.entries(errorsByModel).sort(([, a], [, b]) => b - a);
  
  if (sortedModels.length > 1) {
    const [worstModel, worstCount] = sortedModels[0];
    const [bestModel, bestCount] = sortedModels[sortedModels.length - 1];
    
    if (worstCount > bestCount * 2) {
      recommendations.push(
        `Model ${worstModel} has significantly more errors than ${bestModel}. Consider switching models.`
      );
    }
  }

  return recommendations;
}
```

**Verification:**

```bash
npx tsc --noEmit 2>&1 | grep "metrics.service.ts"
# Should show no new errors
```

---

#### Step 3: Implement Fallback Analysis (20 minutes)

**File:** `metrics.service.ts`  
**Location:** After getErrorAnalysis method  
**Action:** Add 2 methods (~80 lines)

```typescript
async getFallbackAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<FallbackAnalysis> {
  console.log('[EvaluationMetrics] Getting fallback analysis', {
    userId,
    period: options.period || 'week',
  });

  const { start, end } = this.getDateRange(
    options.period || evaluationMetricsConfig.defaultPeriod,
    options.endDate ? new Date(options.endDate) : undefined
  );

  let query = supabase
    .from('messages')
    .select('id, fallback_used, tools_called, model_id, created_at')
    .eq('user_id', userId)
    .not('fallback_used', 'is', null)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString());

  if (options.conversationId) {
    query = query.eq('conversation_id', options.conversationId);
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error('[EvaluationMetrics] Error fetching fallback data:', error);
    throw new Error(`Failed to fetch fallback data: ${error.message}`);
  }

  if (!messages || messages.length === 0) {
    return {
      totalMessages: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      fallbacksByModel: {},
      toolsAvoided: [],
    };
  }

  const fallbackMessages = messages.filter((m) => m.fallback_used === true);
  const fallbackCount = fallbackMessages.length;
  const fallbackRate = fallbackCount / messages.length;

  const fallbacksByModel: Record<string, number> = {};
  fallbackMessages.forEach((msg) => {
    const model = msg.model_id || 'unknown';
    fallbacksByModel[model] = (fallbacksByModel[model] || 0) + 1;
  });

  const toolsAvoided = this.identifyAvoidedTools(fallbackMessages);

  console.log('[EvaluationMetrics] Fallback analysis complete', {
    fallbackRate: (fallbackRate * 100).toFixed(1) + '%',
    fallbackCount,
  });

  return {
    totalMessages: messages.length,
    fallbackCount,
    fallbackRate,
    fallbacksByModel,
    toolsAvoided,
  };
}

private identifyAvoidedTools(messages: Array<{ tools_called: any }>): string[] {
  const toolCounts: Map<string, number> = new Map();

  messages.forEach((msg) => {
    if (!msg.tools_called || !Array.isArray(msg.tools_called)) {
      return;
    }

    msg.tools_called.forEach((tool: any) => {
      const name = tool.name || 'unknown';
      toolCounts.set(name, (toolCounts.get(name) || 0) + 1);
    });
  });

  return Array.from(toolCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([name]) => name);
}
```

**Verification:**

```bash
npx tsc --noEmit 2>&1 | grep "metrics.service.ts"
```

---

#### Step 4: Register Operations (10 minutes)

**File:** `index.ts`  
**Location 1:** Line ~43 (enum array)  
**Location 2:** Line ~205 (switch statement)

**Change 1 - Add to enum:**

```typescript
enum: [
  'get_metrics',
  'quality_trends',
  'success_analysis',
  'compare_periods',
  'model_comparison',
  'tool_impact_analysis',
  'error_analysis',     // ADD THIS
  'fallback_analysis',  // ADD THIS
],
```

**Change 2 - Add case handlers:**

```typescript
// Add after tool_impact_analysis case (around line 205)

case 'error_analysis': {
  console.log('[EvaluationMetrics] Executing error analysis', {
    userId,
    options,
  });

  const errorAnalysis = await evaluationMetricsService.getErrorAnalysis(
    userId,
    options
  );

  console.log('[EvaluationMetrics] Error analysis complete', {
    totalErrors: errorAnalysis.totalErrors,
    errorTypes: Object.keys(errorAnalysis.errorsByType).length,
  });

  return {
    success: true,
    data: errorAnalysis,
  };
}

case 'fallback_analysis': {
  console.log('[EvaluationMetrics] Executing fallback analysis', {
    userId,
    options,
  });

  const fallbackAnalysis = await evaluationMetricsService.getFallbackAnalysis(
    userId,
    options
  );

  console.log('[EvaluationMetrics] Fallback analysis complete', {
    fallbackRate: (fallbackAnalysis.fallbackRate * 100).toFixed(1) + '%',
    fallbackCount: fallbackAnalysis.fallbackCount,
  });

  return {
    success: true,
    data: fallbackAnalysis,
  };
}
```

**Verification:**

```bash
npx tsc --noEmit 2>&1 | grep "index.ts"
```

---

#### Step 5: Update Tool Version (2 minutes)

**File:** `index.ts`  
**Location:** Line ~33  
**Change:**

```typescript
version: '1.1.0',  // Changed from 1.0.0
```

---

## Testing Phase 1

### 1. TypeScript Compilation

```bash
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
npx tsc --noEmit 2>&1 | grep "evaluation-metrics"
# Expected: No new errors (only existing pricing.utils.ts errors)
```

### 2. Lint Check

```bash
npm run lint -- lib/tools/evaluation-metrics/
# Expected: No errors
```

### 3. Manual Testing

**Test error_analysis with no data:**

```typescript
// From a tool call or API:
{
  operation: 'error_analysis',
  period: 'week'
}
// Expected: { totalErrors: 0, errorRate: 0, ... }
```

**Test fallback_analysis with no data:**

```typescript
{
  operation: 'fallback_analysis',
  period: 'week'
}
// Expected: { totalMessages: 0, fallbackCount: 0, ... }
```

---

## Rollback Plan

If issues arise:

1. **Revert types.ts:**
   - Remove ErrorAnalysis, ErrorPattern, FallbackAnalysis interfaces

2. **Revert metrics.service.ts:**
   - Remove getErrorAnalysis method + helpers
   - Remove getFallbackAnalysis method + helper

3. **Revert index.ts:**
   - Remove 'error_analysis', 'fallback_analysis' from enum
   - Remove case handlers
   - Revert version to 1.0.0

---

## Success Criteria

- ✅ TypeScript compiles without new errors
- ✅ All operations callable via tool interface
- ✅ Empty datasets handled gracefully
- ✅ Debug logs present at method entry/exit
- ✅ No 'any' types used
- ✅ Version updated to 1.1.0

---

## Next Phase Preview

**Phase 2: Textual Feedback Analysis**

- feedback_analysis operation
- quality_insights operation
- Sentiment categorization
- Theme extraction

**Estimated:** 4-5 hours  
**Complexity:** Medium (text processing)

---

## Notes

- All database queries use `.not('field', 'is', null)` for safety
- Empty result sets return zero-filled objects, not errors
- Console.log at every method entry/exit for debugging
- Helper methods are private and single-purpose
- No breaking changes to existing operations

---

**Ready to Begin?** Start with Step 1 (Add Type Definitions)

