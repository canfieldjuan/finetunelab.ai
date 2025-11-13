# Evaluation Metrics Tool - Enhancement Implementation Plan

**Version:** 1.0.0 → 2.0.0  
**Date:** October 20, 2025  
**Status:** Ready for Implementation

---

## Executive Summary

This plan enhances the evaluation-metrics tool from **6 operations** to **14 operations** by leveraging **unused database fields** and adding **critical analytics capabilities**. Currently, only ~50% of available data is being utilized. This implementation will unlock the full potential of our metrics collection system.

**Key Statistics:**

- **Current State:** 6 operations, ~1,249 lines of code
- **Enhanced State:** 14 operations (8 new), ~2,500 lines estimated
- **Data Utilization:** 50% → 95%
- **Unused Fields:** error_type, fallback_used, notes, expected_behavior, actual_behavior, benchmarks table
- **Implementation Approach:** Incremental, verified, backward-compatible

---

## Current State Analysis

### Existing Operations (Verified)

1. **get_metrics** (lines 80-177)
   - Aggregates: rating, success rate, quality distribution
   - Data sources: message_evaluations + messages tables
   - Status: ✅ Fully functional

2. **quality_trends** (lines 179-420)
   - Daily averages, trend detection (improving/declining/stable)
   - Data sources: message_evaluations (rating, created_at)
   - Status: ✅ Fully functional

3. **success_analysis** (lines 422-542)
   - Failure pattern identification, common tags
   - Data sources: message_evaluations (success, failure_tags)
   - Status: ✅ Fully functional

4. **compare_periods** (lines 544-588)
   - Period-over-period comparison
   - Data sources: Reuses getMetrics for two date ranges
   - Status: ✅ Fully functional

5. **model_comparison** (lines 590-872)
   - Multi-model performance, cost, value analysis
   - Data sources: messages (model_id, tokens) + evaluations (rating)
   - Status: ✅ Fully functional

6. **tool_impact_analysis** (lines 874-1247)
   - Tool effectiveness correlation with quality
   - Data sources: messages (tools_called, tool_success) + evaluations
   - Status: ✅ Fully functional

### Unused Database Fields (Verified)

From `001_add_metrics_columns.sql`:

```sql
-- UNUSED fields in messages table:
- error_type TEXT          -- NOT used in any operation
- fallback_used BOOLEAN    -- NOT used in any operation
```

From `002_create_evaluations_table.sql`:

```sql
-- UNDERUTILIZED fields in message_evaluations table:
- notes TEXT               -- NOT analyzed (only stored)
- expected_behavior TEXT   -- NOT analyzed (only stored)
- actual_behavior TEXT     -- NOT analyzed (only stored)
```

From `20251019000008_create_benchmarks.sql`:

```sql
-- COMPLETELY UNUSED table:
- benchmarks              -- NOT queried by evaluation-metrics tool
- judgments.benchmark_id  -- NOT analyzed
```

---

## Enhancement Strategy

### Design Principles

1. **Never Assume, Always Verify** ✅
   - Read all existing code before modifications
   - Verify database schema matches expectations
   - Test each operation before moving to next

2. **Incremental Implementation** ✅
   - Add one operation at a time
   - Verify compilation after each addition
   - Test functionality before proceeding

3. **Backward Compatibility** ✅
   - Keep all existing operations unchanged
   - Add new operations without breaking existing
   - Maintain existing type definitions

4. **Code Quality Standards** ✅
   - No 'any' types (use strict TypeScript)
   - 30-line blocks or complete logic blocks
   - Comprehensive error handling
   - Debug logging at critical points

---

## Implementation Tiers

### Tier 1: Error & Fallback Analytics (QUICK WINS)

**Priority:** HIGH  
**Effort:** LOW  
**Value:** HIGH  
**Estimated Lines:** ~200

#### Operation 1: `error_analysis`

**Purpose:** Analyze error patterns using the unused `error_type` field

**Database Query:**

```typescript
// File: metrics.service.ts
// Location: After getToolImpactAnalysis method (line ~1247)

async getErrorAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<ErrorAnalysis> {
  console.log('[EvaluationMetrics] Getting error analysis', {
    userId,
    period: options.period || 'week',
  });

  // Get date range
  const { start, end } = this.getDateRange(
    options.period || evaluationMetricsConfig.defaultPeriod,
    options.endDate ? new Date(options.endDate) : undefined
  );

  // Query messages with errors
  let query = supabase
    .from('messages')
    .select(
      `
      id,
      error_type,
      created_at,
      model_id,
      provider,
      tools_called,
      latency_ms
    `
    )
    .eq('user_id', userId)
    .not('error_type', 'is', null)
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false });

  // Apply filters
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

  // Calculate error statistics
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

  // Identify patterns
  const commonPatterns = this.identifyErrorPatterns(messages);

  // Generate recommendations
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
    errorRate: 0, // TODO: Calculate from total messages
    errorsByType,
    errorsByModel,
    commonPatterns,
    recommendations,
  };
}
```

**Type Definition (add to types.ts):**

```typescript
// File: types.ts
// Location: After ToolCorrelation interface (line ~122)

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
```

**Index.ts Update:**

```typescript
// File: index.ts
// Location: In parameters.operation.enum array (line ~43)
// ADD to existing array:
'error_analysis',

// Location: In execute() switch statement (line ~205)
// ADD new case:
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
```

**Helper Methods (add to metrics.service.ts):**

```typescript
// File: metrics.service.ts
// Location: After getToolImpactAnalysis method

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

  return Array.from(patterns.values())
    .sort((a, b) => b.count - a.count);
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

  // Check for high error rate by type
  const sortedTypes = Object.entries(errorsByType)
    .sort(([, a], [, b]) => b - a);
  
  if (sortedTypes.length > 0) {
    const [topType, count] = sortedTypes[0];
    recommendations.push(
      `Primary error type: ${topType} (${count} occurrences). ${
        this.getSuggestedFix(topType)
      }`
    );
  }

  // Check for model-specific issues
  const sortedModels = Object.entries(errorsByModel)
    .sort(([, a], [, b]) => b - a);
  
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

#### Operation 2: `fallback_analysis`

**Purpose:** Track when models fallback instead of using tools

**Implementation:**

```typescript
// File: metrics.service.ts
// Location: After getErrorAnalysis method

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

  // Query messages with fallback data
  let query = supabase
    .from('messages')
    .select(
      `
      id,
      fallback_used,
      tools_called,
      model_id,
      created_at
    `
    )
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

  // Group by model
  const fallbacksByModel: Record<string, number> = {};
  fallbackMessages.forEach((msg) => {
    const model = msg.model_id || 'unknown';
    fallbacksByModel[model] = (fallbacksByModel[model] || 0) + 1;
  });

  // Identify which tools were avoided
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

private identifyAvoidedTools(
  messages: Array<{ tools_called: any }>
): string[] {
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

**Type Definition:**

```typescript
// File: types.ts
// Location: After ErrorPattern interface

export interface FallbackAnalysis {
  totalMessages: number;
  fallbackCount: number;
  fallbackRate: number;
  fallbacksByModel: Record<string, number>;
  toolsAvoided: string[];
}
```

---

### Tier 2: Textual Feedback Analytics (MEDIUM COMPLEXITY)

**Priority:** HIGH  
**Effort:** MEDIUM  
**Value:** HIGH  
**Estimated Lines:** ~350

#### Operation 3: `feedback_analysis`

**Purpose:** Analyze textual feedback (notes, expected_behavior, actual_behavior)

**Implementation Strategy:**

1. Extract all evaluations with textual feedback
2. Categorize feedback by sentiment/theme
3. Link feedback to ratings for correlation
4. Identify common improvement themes

**Placeholder (to be implemented):**

```typescript
// File: metrics.service.ts

async getFeedbackAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<FeedbackAnalysis> {
  // Implementation: Extract and analyze textual feedback
  // - Query evaluations with notes, expected_behavior, actual_behavior
  // - Categorize by theme (functionality, accuracy, tone, etc.)
  // - Correlate with ratings
  // - Extract common improvement suggestions
}
```

#### Operation 4: `quality_insights`

**Purpose:** Deep dive into quality issues using textual data

**Implementation Strategy:**

1. Analyze low-rated responses (rating < 3)
2. Extract patterns from expected vs actual behavior
3. Generate actionable insights

---

### Tier 3: Benchmark Integration (HIGH VALUE)

**Priority:** MEDIUM  
**Effort:** MEDIUM  
**Value:** VERY HIGH  
**Estimated Lines:** ~400

#### Operation 5: `benchmark_performance`

**Purpose:** Measure performance against defined benchmarks

**Database Schema (from migrations):**

```sql
-- Table: benchmarks
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  task_type TEXT CHECK (task_type IN ('code', 'reasoning', 'domain_qa', ...)),
  pass_criteria JSONB,
  created_by UUID,
  is_public BOOLEAN
);

-- Table: judgments (links to benchmarks)
ALTER TABLE judgments ADD COLUMN benchmark_id UUID;
```

**Implementation:**

```typescript
// File: metrics.service.ts

async getBenchmarkPerformance(
  userId: string,
  options: MetricsOptions & { benchmarkId?: string } = {}
): Promise<BenchmarkPerformance> {
  console.log('[EvaluationMetrics] Getting benchmark performance', {
    userId,
    benchmarkId: options.benchmarkId,
  });

  // Query benchmarks
  let benchmarkQuery = supabase
    .from('benchmarks')
    .select('*')
    .or(`created_by.eq.${userId},is_public.eq.true`);

  if (options.benchmarkId) {
    benchmarkQuery = benchmarkQuery.eq('id', options.benchmarkId);
  }

  const { data: benchmarks, error: benchmarkError } = await benchmarkQuery;

  if (benchmarkError) {
    throw new Error(`Failed to fetch benchmarks: ${benchmarkError.message}`);
  }

  // Query judgments linked to benchmarks
  const { data: judgments, error: judgmentError } = await supabase
    .from('judgments')
    .select(
      `
      id,
      benchmark_id,
      score,
      passed,
      created_at,
      messages (
        model_id,
        provider
      )
    `
    )
    .not('benchmark_id', 'is', null)
    .in(
      'benchmark_id',
      benchmarks?.map((b) => b.id) || []
    );

  if (judgmentError) {
    throw new Error(`Failed to fetch judgments: ${judgmentError.message}`);
  }

  // Calculate pass rates per benchmark
  const performanceByBenchmark = this.calculateBenchmarkMetrics(
    benchmarks || [],
    judgments || []
  );

  return {
    benchmarks: performanceByBenchmark,
    overall: this.calculateOverallBenchmarkMetrics(performanceByBenchmark),
  };
}

private calculateBenchmarkMetrics(
  benchmarks: any[],
  judgments: any[]
): BenchmarkMetric[] {
  return benchmarks.map((benchmark) => {
    const benchmarkJudgments = judgments.filter(
      (j) => j.benchmark_id === benchmark.id
    );

    const totalTests = benchmarkJudgments.length;
    const passed = benchmarkJudgments.filter((j) => j.passed).length;
    const passRate = totalTests > 0 ? passed / totalTests : 0;

    const avgScore =
      totalTests > 0
        ? benchmarkJudgments.reduce((sum, j) => sum + (j.score || 0), 0) /
          totalTests
        : 0;

    return {
      benchmarkId: benchmark.id,
      name: benchmark.name,
      taskType: benchmark.task_type,
      totalTests,
      passed,
      failed: totalTests - passed,
      passRate,
      avgScore,
      passCriteria: benchmark.pass_criteria,
    };
  });
}
```

**Type Definitions:**

```typescript
// File: types.ts

export interface BenchmarkPerformance {
  benchmarks: BenchmarkMetric[];
  overall: OverallBenchmarkMetrics;
}

export interface BenchmarkMetric {
  benchmarkId: string;
  name: string;
  taskType: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  passCriteria: any;
}

export interface OverallBenchmarkMetrics {
  totalBenchmarks: number;
  totalTests: number;
  overallPassRate: number;
  avgScore: number;
  byTaskType: Record<string, { passRate: number; avgScore: number }>;
}
```

---

### Tier 4: Advanced Analytics (LONG-TERM)

**Priority:** LOW  
**Effort:** HIGH  
**Value:** MEDIUM  
**Estimated Lines:** ~500

#### Operation 6: `temporal_analysis`

**Purpose:** Time-based patterns (hourly, daily, weekly)

#### Operation 7: `conversation_quality`

**Purpose:** Analyze quality trends within conversations

#### Operation 8: `predictive_insights`

**Purpose:** Predict quality based on historical patterns

---

## Implementation Order

### Phase 1: Tier 1 - Error & Fallback Analytics

**Duration:** 2-3 hours  
**Files to Create:** None  
**Files to Modify:** 3

1. **Step 1.1:** Add ErrorAnalysis types to `types.ts`
   - Location: After line 122 (ToolCorrelation interface)
   - Changes: Add ErrorAnalysis, ErrorPattern interfaces
   - Verification: `npm run type-check`

2. **Step 1.2:** Implement getErrorAnalysis in `metrics.service.ts`
   - Location: After line 1247 (end of getToolImpactAnalysis)
   - Changes: Add 80-line method + 3 helper methods (~50 lines)
   - Verification: Check TypeScript compilation

3. **Step 1.3:** Add error_analysis operation to `index.ts`
   - Location 1: Line 43 (enum array)
   - Location 2: Line 205 (switch statement)
   - Changes: Add enum value + case handler (~20 lines)
   - Verification: Test operation execution

4. **Step 1.4:** Add FallbackAnalysis types to `types.ts`
   - Location: After ErrorPattern interface
   - Changes: Add FallbackAnalysis interface
   - Verification: `npm run type-check`

5. **Step 1.5:** Implement getFallbackAnalysis in `metrics.service.ts`
   - Location: After getErrorAnalysis method
   - Changes: Add 60-line method + 1 helper (~20 lines)
   - Verification: Check TypeScript compilation

6. **Step 1.6:** Add fallback_analysis operation to `index.ts`
   - Location 1: Line 43 (enum array)
   - Location 2: After error_analysis case
   - Changes: Add enum value + case handler
   - Verification: Test operation execution

**Testing Checklist:**

- [ ] TypeScript compiles without errors
- [ ] Both operations callable via tool interface
- [ ] Database queries return expected data
- [ ] Error handling works for empty datasets
- [ ] Debug logs appear at critical points

### Phase 2: Tier 2 - Textual Feedback (Optional)

**Duration:** 4-5 hours  
**Complexity:** Requires text analysis logic

### Phase 3: Tier 3 - Benchmark Integration

**Duration:** 5-6 hours  
**Complexity:** Multi-table joins, complex aggregations

### Phase 4: Tier 4 - Advanced Analytics

**Duration:** 8-10 hours  
**Complexity:** Statistical analysis, prediction models

---

## File Modification Map

### 1. types.ts

**Current State:** 163 lines, 15 interfaces  
**Expected State:** ~250 lines, 22 interfaces

**Changes:**

```typescript
// Line ~122 - ADD after ToolCorrelation interface:

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

export interface FeedbackAnalysis {
  totalWithFeedback: number;
  feedbackRate: number;
  commonThemes: FeedbackTheme[];
  sentimentDistribution: Record<string, number>;
  improvementSuggestions: string[];
}

export interface FeedbackTheme {
  theme: string;
  count: number;
  avgRating: number;
  examples: string[];
}

export interface BenchmarkPerformance {
  benchmarks: BenchmarkMetric[];
  overall: OverallBenchmarkMetrics;
}

export interface BenchmarkMetric {
  benchmarkId: string;
  name: string;
  taskType: string;
  totalTests: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  passCriteria: any;
}

export interface OverallBenchmarkMetrics {
  totalBenchmarks: number;
  totalTests: number;
  overallPassRate: number;
  avgScore: number;
  byTaskType: Record<string, { passRate: number; avgScore: number }>;
}
```

### 2. metrics.service.ts

**Current State:** 1,249 lines, 6 public methods  
**Expected State:** ~1,900 lines, 11 public methods

**Changes:**

```typescript
// Line ~1247 - ADD after getToolImpactAnalysis method:

// ============================================================================
// ERROR ANALYSIS
// ============================================================================

async getErrorAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<ErrorAnalysis> {
  // [Full implementation from Tier 1, Operation 1]
}

private identifyErrorPatterns(messages: any[]): ErrorPattern[] {
  // [Helper method implementation]
}

private getSuggestedFix(errorType: string | null): string {
  // [Helper method implementation]
}

private generateErrorRecommendations(
  errorsByType: Record<string, number>,
  errorsByModel: Record<string, number>,
  patterns: ErrorPattern[]
): string[] {
  // [Helper method implementation]
}

// ============================================================================
// FALLBACK ANALYSIS
// ============================================================================

async getFallbackAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<FallbackAnalysis> {
  // [Full implementation from Tier 1, Operation 2]
}

private identifyAvoidedTools(messages: any[]): string[] {
  // [Helper method implementation]
}

// ============================================================================
// FEEDBACK ANALYSIS (Phase 2)
// ============================================================================

async getFeedbackAnalysis(
  userId: string,
  options: MetricsOptions = {}
): Promise<FeedbackAnalysis> {
  // TODO: Implement in Phase 2
}

// ============================================================================
// BENCHMARK PERFORMANCE (Phase 3)
// ============================================================================

async getBenchmarkPerformance(
  userId: string,
  options: MetricsOptions & { benchmarkId?: string } = {}
): Promise<BenchmarkPerformance> {
  // TODO: Implement in Phase 3
}
```

### 3. index.ts

**Current State:** 226 lines, 6 operations  
**Expected State:** ~340 lines, 11 operations

**Changes:**

```typescript
// Line ~43 - MODIFY parameters.operation.enum array:

enum: [
  'get_metrics',
  'quality_trends',
  'success_analysis',
  'compare_periods',
  'model_comparison',
  'tool_impact_analysis',
  'error_analysis',        // NEW
  'fallback_analysis',     // NEW
  'feedback_analysis',     // NEW (Phase 2)
  'benchmark_performance', // NEW (Phase 3)
  'temporal_analysis',     // NEW (Phase 4)
],

// Line ~205 - ADD new case statements in execute():

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

// TODO: Add feedback_analysis case in Phase 2
// TODO: Add benchmark_performance case in Phase 3
```

### 4. config.ts

**Current State:** 30 lines  
**Expected State:** ~40 lines

**Changes:**

```typescript
// Line ~30 - ADD new configuration options:

// Error analysis thresholds
errorAnalysis: {
  criticalErrorRate: 0.05, // 5% error rate is critical
  highErrorThreshold: 10,  // 10+ errors needs attention
},

// Fallback detection
fallbackAnalysis: {
  highFallbackRate: 0.2,   // 20% fallback rate is high
},
```

---

## Testing Strategy

### Unit Tests (To Be Created)

**File:** `metrics.service.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { evaluationMetricsService } from './metrics.service';

describe('EvaluationMetricsService - Error Analysis', () => {
  it('should return zero errors when no error data exists', async () => {
    const result = await evaluationMetricsService.getErrorAnalysis('user-123', {
      period: 'week',
    });
    
    expect(result.totalErrors).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(Object.keys(result.errorsByType)).toHaveLength(0);
  });

  it('should group errors by type correctly', async () => {
    // TODO: Mock database with test data
    // TODO: Verify grouping logic
  });

  it('should generate recommendations for common errors', async () => {
    // TODO: Test recommendation generation
  });
});

describe('EvaluationMetricsService - Fallback Analysis', () => {
  it('should calculate fallback rate correctly', async () => {
    // TODO: Mock database with fallback data
    // TODO: Verify rate calculation
  });

  it('should identify avoided tools', async () => {
    // TODO: Test tool identification logic
  });
});
```

### Integration Tests

1. **Database Connectivity**
   - Verify Supabase queries execute
   - Test RLS policies don't block queries
   - Validate date range filtering

2. **Tool Execution**
   - Call operations via tool interface
   - Verify response structure
   - Test error handling

3. **Performance**
   - Measure query execution time
   - Validate result limits work
   - Test with large datasets

---

## Verification Checklist

### Pre-Implementation ✅

- [x] Read all existing code
- [x] Verify database schema
- [x] Map unused fields
- [x] Identify insertion points
- [x] Plan backward compatibility

### Phase 1 Implementation

- [ ] Add ErrorAnalysis types
- [ ] Implement getErrorAnalysis
- [ ] Add error_analysis operation
- [ ] Verify TypeScript compilation
- [ ] Test with empty database
- [ ] Test with error data
- [ ] Add FallbackAnalysis types
- [ ] Implement getFallbackAnalysis
- [ ] Add fallback_analysis operation
- [ ] Verify all operations work
- [ ] Run linter (`npm run lint`)
- [ ] Update version to 1.1.0

### Phase 2 Implementation

- [ ] Design feedback categorization
- [ ] Implement getFeedbackAnalysis
- [ ] Add feedback_analysis operation
- [ ] Test with textual data
- [ ] Update version to 1.2.0

### Phase 3 Implementation

- [ ] Verify benchmarks table access
- [ ] Implement getBenchmarkPerformance
- [ ] Add benchmark_performance operation
- [ ] Test with benchmark data
- [ ] Update version to 1.3.0

---

## Risk Mitigation

### Risk 1: Database Performance

**Issue:** Complex queries on large datasets may timeout

**Mitigation:**

- Implement query limits (maxEvaluationsAnalyzed)
- Add indexes if needed
- Use pagination for large results
- Add query timing logs

### Risk 2: Missing Data

**Issue:** Unused fields may have null values

**Mitigation:**

- Handle null gracefully (`.not('field', 'is', null)`)
- Return empty results instead of errors
- Document data availability requirements

### Risk 3: Breaking Changes

**Issue:** Modifications might break existing functionality

**Mitigation:**

- Keep all existing operations unchanged
- Add new operations as separate methods
- Maintain backward-compatible types
- Test existing operations after changes

---

## Success Metrics

### Quantitative

- **Operation Count:** 6 → 11+ operations
- **Data Utilization:** 50% → 95%
- **Code Coverage:** 0% → 60%+ (with tests)
- **Response Time:** < 2s per operation
- **Zero Breaking Changes:** All existing operations work

### Qualitative

- **Developer Experience:** Clear error messages, good logging
- **Code Quality:** No 'any' types, consistent patterns
- **Documentation:** Every operation documented
- **Maintainability:** Modular, testable code

---

## Next Steps

1. **Review This Plan** ✅ (You are here)
2. **Begin Phase 1:** Implement Tier 1 operations
3. **Verify Phase 1:** Test thoroughly
4. **Plan Phase 2:** Review feedback analysis requirements
5. **Iterate:** Continue with Tiers 2-4

---

## Notes

- **Database Access:** All queries use Supabase client with RLS
- **Authentication:** userId required for all operations
- **Logging:** Console.log at method entry/exit + critical points
- **Error Handling:** Try/catch with descriptive error messages
- **TypeScript:** Strict mode, no 'any' types allowed

**Document Version:** 1.0.0  
**Last Updated:** October 20, 2025  
**Author:** AI Assistant (following user requirements)
