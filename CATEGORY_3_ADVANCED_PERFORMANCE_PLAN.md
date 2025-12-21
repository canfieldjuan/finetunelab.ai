# Category 3: Advanced Performance - Implementation Plan

## Overview
Enhance tracing system with error pattern detection, provider comparison analytics, and cache hit/miss tracking.

---

## Phase 1: Database Schema Enhancement

### New Fields to Add to `llm_traces` Table

```sql
-- Cache tracking (Anthropic prompt caching)
ALTER TABLE llm_traces
  ADD COLUMN cache_creation_input_tokens INTEGER DEFAULT NULL,
  ADD COLUMN cache_read_input_tokens INTEGER DEFAULT NULL;

-- Retry tracking
ALTER TABLE llm_traces
  ADD COLUMN retry_count INTEGER DEFAULT 0,
  ADD COLUMN retry_reason TEXT DEFAULT NULL;

-- Error categorization
ALTER TABLE llm_traces
  ADD COLUMN error_category TEXT DEFAULT NULL;

-- Indexes for analytics
CREATE INDEX idx_llm_traces_error_category ON llm_traces(error_category);
CREATE INDEX idx_llm_traces_model_provider ON llm_traces(model_provider);
CREATE INDEX idx_llm_traces_cache_read ON llm_traces(cache_read_input_tokens) WHERE cache_read_input_tokens IS NOT NULL;
CREATE INDEX idx_llm_traces_retry_count ON llm_traces(retry_count) WHERE retry_count > 0;

-- Comments
COMMENT ON COLUMN llm_traces.cache_creation_input_tokens IS 'Tokens used to create cache (Anthropic prompt caching)';
COMMENT ON COLUMN llm_traces.cache_read_input_tokens IS 'Tokens read from cache (Anthropic prompt caching)';
COMMENT ON COLUMN llm_traces.retry_count IS 'Number of retry attempts for this operation';
COMMENT ON COLUMN llm_traces.retry_reason IS 'Reason for retry (e.g., rate_limit, timeout, network_error)';
COMMENT ON COLUMN llm_traces.error_category IS 'Categorized error type (rate_limit, timeout, auth, validation, api_error, network_error, unknown)';
```

### Error Categories
- `rate_limit` - 429 errors, rate limit exceeded
- `timeout` - Request timeout, slow response
- `auth` - 401/403 authentication/authorization errors
- `validation` - 400 bad request, invalid input
- `api_error` - 500/502/503 server errors
- `network_error` - Connection failures, DNS errors
- `quota_exceeded` - Usage quota/budget exceeded
- `model_overloaded` - 529 model overloaded
- `unknown` - Uncategorized errors

---

## Phase 2: Cache Tracking Implementation

### Files to Modify:

**1. `lib/tracing/types.ts`**
Add cache fields to TraceResult:
```typescript
export interface TraceResult {
  // ... existing fields ...

  /** Cache creation tokens (Anthropic prompt caching) */
  cacheCreationInputTokens?: number;

  /** Cache read tokens (Anthropic prompt caching) */
  cacheReadInputTokens?: number;
}
```

**2. `lib/llm/adapters/anthropic-adapter.ts`** (lines 207-213)
Capture cache usage from Anthropic API:
```typescript
// Extract usage metrics
const usage = body.usage
  ? {
      input_tokens: body.usage.input_tokens || 0,
      output_tokens: body.usage.output_tokens || 0,
      cache_creation_input_tokens: body.usage.cache_creation_input_tokens,
      cache_read_input_tokens: body.usage.cache_read_input_tokens,
    }
  : undefined;
```

**3. `app/api/chat/trace-completion-helper.ts`**
Pass cache data to endTrace:
```typescript
await traceService.endTrace(traceContext, {
  endTime: new Date(),
  status: 'completed',
  inputTokens: tokenUsage?.input_tokens,
  outputTokens: tokenUsage?.output_tokens,
  cacheCreationInputTokens: tokenUsage?.cache_creation_input_tokens,
  cacheReadInputTokens: tokenUsage?.cache_read_input_tokens,
  costUsd,
  // ... other fields ...
});
```

**4. `lib/tracing/trace.service.ts`** (endTrace function)
Add cache fields to trace update:
```typescript
const traceUpdate = {
  // ... existing fields ...
  cache_creation_input_tokens: result.cacheCreationInputTokens || null,
  cache_read_input_tokens: result.cacheReadInputTokens || null,
};
```

**5. `lib/tracing/pricing-config.ts`**
Update cost calculation to account for cache pricing:
```typescript
/**
 * Calculate cost with cache optimization
 * Anthropic charges less for cached tokens:
 * - Cache writes: 25% more than regular input
 * - Cache reads: 90% less than regular input
 */
export function calculateCostWithCache(
  pricingKey: ModelPricingKey,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens?: number,
  cacheReadTokens?: number
): number {
  const pricing = MODEL_PRICING[pricingKey];

  let cost = 0;

  // Regular input tokens
  const regularInputTokens = inputTokens - (cacheReadTokens || 0) - (cacheCreationTokens || 0);
  cost += (regularInputTokens / 1_000_000) * pricing.inputPer1M;

  // Cache creation (25% premium)
  if (cacheCreationTokens) {
    cost += (cacheCreationTokens / 1_000_000) * pricing.inputPer1M * 1.25;
  }

  // Cache reads (90% discount)
  if (cacheReadTokens) {
    cost += (cacheReadTokens / 1_000_000) * pricing.inputPer1M * 0.1;
  }

  // Output tokens
  cost += (outputTokens / 1_000_000) * pricing.outputPer1M;

  return cost;
}
```

---

## Phase 3: Error Pattern Detection

### Files to Modify:

**1. `lib/tracing/error-categorizer.ts`** (NEW FILE)
```typescript
/**
 * Categorize errors for pattern detection and analytics
 */

export type ErrorCategory =
  | 'rate_limit'
  | 'timeout'
  | 'auth'
  | 'validation'
  | 'api_error'
  | 'network_error'
  | 'quota_exceeded'
  | 'model_overloaded'
  | 'unknown';

export interface CategorizedError {
  category: ErrorCategory;
  isRetryable: boolean;
  suggestedRetryDelayMs?: number;
}

/**
 * Categorize error based on HTTP status code and error message
 */
export function categorizeError(
  statusCode?: number,
  errorMessage?: string,
  errorType?: string
): CategorizedError {
  const msg = (errorMessage || '').toLowerCase();

  // Rate limit errors
  if (statusCode === 429 || msg.includes('rate limit') || msg.includes('too many requests')) {
    return {
      category: 'rate_limit',
      isRetryable: true,
      suggestedRetryDelayMs: 60000, // 1 minute
    };
  }

  // Model overloaded
  if (statusCode === 529 || msg.includes('overloaded')) {
    return {
      category: 'model_overloaded',
      isRetryable: true,
      suggestedRetryDelayMs: 30000, // 30 seconds
    };
  }

  // Timeout errors
  if (msg.includes('timeout') || msg.includes('timed out') || statusCode === 408) {
    return {
      category: 'timeout',
      isRetryable: true,
      suggestedRetryDelayMs: 5000, // 5 seconds
    };
  }

  // Auth errors
  if (statusCode === 401 || statusCode === 403 || msg.includes('unauthorized') || msg.includes('forbidden')) {
    return {
      category: 'auth',
      isRetryable: false,
    };
  }

  // Validation errors
  if (statusCode === 400 || msg.includes('invalid') || msg.includes('bad request')) {
    return {
      category: 'validation',
      isRetryable: false,
    };
  }

  // Quota exceeded
  if (msg.includes('quota') || msg.includes('insufficient') || msg.includes('limit exceeded')) {
    return {
      category: 'quota_exceeded',
      isRetryable: false,
    };
  }

  // API errors (5xx)
  if (statusCode && statusCode >= 500 && statusCode < 600) {
    return {
      category: 'api_error',
      isRetryable: true,
      suggestedRetryDelayMs: 10000, // 10 seconds
    };
  }

  // Network errors
  if (msg.includes('network') || msg.includes('connection') || msg.includes('ECONNREFUSED')) {
    return {
      category: 'network_error',
      isRetryable: true,
      suggestedRetryDelayMs: 5000, // 5 seconds
    };
  }

  // Unknown
  return {
    category: 'unknown',
    isRetryable: false,
  };
}

/**
 * Detect error patterns from recent traces
 * Returns insights for analytics dashboard
 */
export interface ErrorPattern {
  category: ErrorCategory;
  count: number;
  percentage: number;
  avgDurationMs?: number;
  affectedProviders: string[];
  suggestedAction?: string;
}

/**
 * Analyze error patterns for a given time period
 */
export function detectErrorPatterns(traces: Array<{
  error_category?: string | null;
  error_message?: string | null;
  model_provider?: string | null;
  duration_ms?: number | null;
}>): ErrorPattern[] {
  const categoryCounts = new Map<ErrorCategory, {
    count: number;
    totalDuration: number;
    providers: Set<string>;
  }>();

  const failedTraces = traces.filter(t => t.error_category);

  for (const trace of failedTraces) {
    const category = trace.error_category as ErrorCategory;
    if (!categoryCounts.has(category)) {
      categoryCounts.set(category, {
        count: 0,
        totalDuration: 0,
        providers: new Set(),
      });
    }

    const stats = categoryCounts.get(category)!;
    stats.count++;
    if (trace.duration_ms) stats.totalDuration += trace.duration_ms;
    if (trace.model_provider) stats.providers.add(trace.model_provider);
  }

  const totalFailed = failedTraces.length || 1; // Avoid division by zero

  return Array.from(categoryCounts.entries()).map(([category, stats]) => ({
    category,
    count: stats.count,
    percentage: (stats.count / totalFailed) * 100,
    avgDurationMs: stats.totalDuration / stats.count,
    affectedProviders: Array.from(stats.providers),
    suggestedAction: getSuggestedAction(category),
  }));
}

function getSuggestedAction(category: ErrorCategory): string {
  switch (category) {
    case 'rate_limit':
      return 'Consider implementing exponential backoff or using multiple API keys';
    case 'timeout':
      return 'Reduce max_tokens or implement request timeout handling';
    case 'auth':
      return 'Check API keys in Secrets Vault';
    case 'validation':
      return 'Review input validation logic';
    case 'quota_exceeded':
      return 'Upgrade plan or monitor usage more closely';
    case 'model_overloaded':
      return 'Retry with exponential backoff or try different model';
    case 'api_error':
      return 'Monitor provider status page';
    case 'network_error':
      return 'Check network connectivity and DNS resolution';
    default:
      return 'Review error logs for details';
  }
}
```

**2. `lib/tracing/trace.service.ts`** (endTrace function)
Add error categorization:
```typescript
// Auto-categorize error if failed
let errorCategory: string | undefined;
if (result.status === 'failed' && result.errorMessage) {
  const { categorizeError } = await import('./error-categorizer');
  const categorized = categorizeError(
    result.metadata?.statusCode as number | undefined,
    result.errorMessage,
    result.errorType
  );
  errorCategory = categorized.category;
}

const traceUpdate = {
  // ... existing fields ...
  error_category: errorCategory || null,
};
```

---

## Phase 4: Provider Comparison Analytics

### New API Endpoint: `/api/analytics/provider-comparison`

**File**: `app/api/analytics/provider-comparison/route.ts` (NEW FILE)
```typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d'; // 7d, 30d, 90d

    // Calculate date range
    const now = new Date();
    const startDate = new Date(now);
    if (timeRange === '7d') startDate.setDate(now.getDate() - 7);
    else if (timeRange === '30d') startDate.setDate(now.getDate() - 30);
    else if (timeRange === '90d') startDate.setDate(now.getDate() - 90);

    // Query traces grouped by provider
    const { data: traces, error } = await supabase
      .from('llm_traces')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .not('model_provider', 'is', null);

    if (error) throw error;

    // Group by provider
    const providerStats = new Map<string, {
      totalCalls: number;
      successfulCalls: number;
      failedCalls: number;
      totalCost: number;
      totalTokens: number;
      totalDurationMs: number;
      avgLatencyMs: number;
      avgCostPerCall: number;
      avgTTFTMs: number;
      avgThroughput: number;
      errorRate: number;
      cacheHitRate?: number;
      topErrors: Map<string, number>;
    }>();

    for (const trace of traces || []) {
      const provider = trace.model_provider;
      if (!provider) continue;

      if (!providerStats.has(provider)) {
        providerStats.set(provider, {
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalCost: 0,
          totalTokens: 0,
          totalDurationMs: 0,
          avgLatencyMs: 0,
          avgCostPerCall: 0,
          avgTTFTMs: 0,
          avgThroughput: 0,
          errorRate: 0,
          topErrors: new Map(),
        });
      }

      const stats = providerStats.get(provider)!;
      stats.totalCalls++;

      if (trace.status === 'completed') {
        stats.successfulCalls++;
      } else if (trace.status === 'failed') {
        stats.failedCalls++;
        if (trace.error_category) {
          const count = stats.topErrors.get(trace.error_category) || 0;
          stats.topErrors.set(trace.error_category, count + 1);
        }
      }

      if (trace.cost_usd) stats.totalCost += trace.cost_usd;
      if (trace.total_tokens) stats.totalTokens += trace.total_tokens;
      if (trace.duration_ms) stats.totalDurationMs += trace.duration_ms;
    }

    // Calculate averages
    const comparison = Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      totalCalls: stats.totalCalls,
      successRate: (stats.successfulCalls / stats.totalCalls) * 100,
      errorRate: (stats.failedCalls / stats.totalCalls) * 100,
      avgLatencyMs: stats.totalDurationMs / stats.totalCalls,
      avgCostPerCall: stats.totalCost / stats.totalCalls,
      totalCost: stats.totalCost,
      totalTokens: stats.totalTokens,
      topErrors: Array.from(stats.topErrors.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, count]) => ({ category, count })),
    }));

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error('[Provider Comparison API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## Phase 5: Analytics Dashboard Views

### Component: `components/analytics/ProviderComparisonView.tsx` (NEW FILE)
```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ProviderStats {
  provider: string;
  totalCalls: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  avgCostPerCall: number;
  totalCost: number;
  totalTokens: number;
  topErrors: Array<{ category: string; count: number }>;
}

export function ProviderComparisonView() {
  const [comparison, setComparison] = useState<ProviderStats[]>([]);
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComparison();
  }, [timeRange]);

  async function fetchComparison() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/provider-comparison?timeRange=${timeRange}`);
      const data = await res.json();
      setComparison(data.comparison || []);
    } catch (error) {
      console.error('Failed to fetch provider comparison:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Provider Comparison</h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparison.map((stats) => (
            <Card key={stats.provider}>
              <CardHeader>
                <CardTitle className="capitalize">{stats.provider}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Total Calls:</span>
                  <span className="ml-2 font-semibold">{stats.totalCalls.toLocaleString()}</span>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Success Rate:</span>
                  <Badge className="ml-2" variant={stats.successRate > 95 ? 'default' : 'destructive'}>
                    {stats.successRate.toFixed(1)}%
                  </Badge>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Avg Latency:</span>
                  <span className="ml-2 font-semibold">{stats.avgLatencyMs.toFixed(0)}ms</span>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Avg Cost/Call:</span>
                  <span className="ml-2 font-semibold">${stats.avgCostPerCall.toFixed(4)}</span>
                </div>

                <div>
                  <span className="text-sm text-muted-foreground">Total Cost:</span>
                  <span className="ml-2 font-semibold">${stats.totalCost.toFixed(2)}</span>
                </div>

                {stats.topErrors.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Top Errors:</span>
                    <ul className="ml-2 text-sm">
                      {stats.topErrors.map((err) => (
                        <li key={err.category}>
                          {err.category}: {err.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Component: `components/analytics/ErrorPatternsView.tsx` (NEW FILE)
Similar to provider comparison, but focused on error patterns with charts showing:
- Error distribution by category
- Error rate over time
- Most affected operations
- Suggested remediation actions

---

## Phase 6: Integration

### Update TraceView to show cache metrics:
```typescript
{trace.cache_read_input_tokens != null && (
  <div className="metric">
    <span className="label">Cache Hits:</span>
    <Badge variant="success">
      {trace.cache_read_input_tokens.toLocaleString()} tokens
      {trace.input_tokens && (
        <span className="text-xs ml-1">
          ({((trace.cache_read_input_tokens / trace.input_tokens) * 100).toFixed(1)}%)
        </span>
      )}
    </Badge>
  </div>
)}

{trace.retry_count != null && trace.retry_count > 0 && (
  <div className="metric">
    <span className="label">Retries:</span>
    <Badge variant="warning">{trace.retry_count}x</Badge>
    {trace.retry_reason && (
      <span className="text-xs text-muted-foreground ml-1">({trace.retry_reason})</span>
    )}
  </div>
)}
```

---

## Rollout Timeline

**Week 1: Database + Cache Tracking**
- Migration for new fields
- Update Anthropic adapter to capture cache usage
- Update trace service to store cache data
- Update cost calculation for cache pricing

**Week 2: Error Pattern Detection**
- Create error categorizer
- Auto-categorize errors in traces
- Test error detection accuracy

**Week 3: Provider Comparison**
- Create comparison API endpoint
- Build comparison dashboard component
- Test with multi-provider usage

**Week 4: Analytics Views**
- Create error patterns view
- Integrate into main analytics page
- Add charts and visualizations
- Performance testing

---

## Success Metrics

After implementation, we should be able to answer:
- Which provider has the best success rate?
- Which provider is most cost-effective?
- What's our cache hit rate with Anthropic?
- What's the most common error category?
- Are rate limits affecting specific providers?
- What's the average retry rate?
- How much money are we saving from prompt caching?

---

## Next Steps

1. Create database migration
2. Update types and interfaces
3. Implement cache tracking
4. Implement error categorization
5. Build analytics endpoints
6. Create dashboard views
7. Test with real data
