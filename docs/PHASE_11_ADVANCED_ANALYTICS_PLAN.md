# Phase 11: Advanced Analytics Dashboard

**Feature:** Expand analytics with additional insights and charts
**Estimated Time:** 2-3 hours
**Priority:** HIGH - Deeper insights into model performance
**Status:** Planning Complete - Ready for Implementation

---

## Table of Contents
1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [New Features](#new-features)
4. [Implementation Plan](#implementation-plan)
5. [Verification Checklist](#verification-checklist)

---

## Overview

### Objective
Extend the existing analytics dashboard (Phase 10) with additional charts and metrics to provide deeper insights into model performance, costs, errors, and tool usage.

### Success Criteria
- ✅ Tool performance breakdown chart (success/failure by tool)
- ✅ Error type distribution chart
- ✅ Cost tracking (token costs by provider)
- ✅ Conversation length distribution
- ✅ Response time trends (latency over time)
- ✅ No breaking changes to existing analytics
- ✅ All new charts follow existing design patterns

### Key Principle
**Never assume - always verify before implementing**

---

## Current State Analysis

### Existing Analytics Dashboard (Phase 10)

**File:** `components/analytics/AnalyticsDashboard.tsx`

**Current Charts:**
1. MetricsOverview (4 cards: messages, conversations, avg rating, success rate)
2. RatingDistribution (bar chart: 1-5 stars)
3. SuccessRateChart (pie chart: success vs failure)
4. TokenUsageChart (line chart: input/output tokens over time)

**Hook:** `hooks/useAnalytics.ts`

**Existing Data Structure:**
```typescript
interface AnalyticsData {
  overview: {
    totalMessages: number;
    totalConversations: number;
    totalEvaluations: number;
    avgRating: number;
    successRate: number;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  successFailure: Array<{ name: string; value: number }>;
  tokenUsage: Array<{ date: string; input: number; output: number }>;
  errorBreakdown: Array<{ name: string; value: number }>;  // EXISTS but not displayed
  toolPerformance: Array<{ tool: string; success: number; failure: number }>;  // EXISTS but not displayed
}
```

**Key Finding:** The hook already calculates `errorBreakdown` and `toolPerformance` but they're not displayed!

---

## Phase Options Considered

### Option A: Advanced Analytics Dashboard ✅ SELECTED
- Tool performance breakdown
- Error type distribution
- Cost tracking
- Conversation length distribution
- Response time trends

### Option B: Dataset Quality Tools
- Dataset validation dashboard
- Data quality scores
- Balance checker
- Duplicate detection

### Option C: Model Comparison (A/B Testing)
- Side-by-side model comparison
- Dual response rating
- Statistical analysis

### Option D: Automated Fine-Tuning Pipeline
- CI/CD for model fine-tuning
- API integration
- Automated evaluation
- Deployment workflow

### Option E: Evaluation Workflow Improvements
- Bulk evaluation
- Evaluation templates
- Comparison views
- Export reports

---

## New Features

### 11.1: Tool Performance Breakdown Chart

**Type:** Stacked Bar Chart
**Data Source:** Already calculated in `useAnalytics.ts` (toolPerformance)
**Display:** Success (green) and Failure (red) stacked bars per tool

**Visual:**
```
Tool Usage Performance
─────────────────────────
calculator   [████████░░]  80% success
web_search   [██████████]  100% success
datetime     [█████░░░░░]  50% success
```

**File to Create:** `components/analytics/ToolPerformanceChart.tsx`

---

### 11.2: Error Type Distribution Chart

**Type:** Pie Chart
**Data Source:** Already calculated in `useAnalytics.ts` (errorBreakdown)
**Display:** Percentage of each error type

**Categories:**
- timeout
- rate_limit
- context_length
- api_error
- network_error
- unknown_error

**File to Create:** `components/analytics/ErrorBreakdownChart.tsx`

---

### 11.3: Cost Tracking Chart

**Type:** Line Chart with dual Y-axis
**Data Source:** New calculation based on token usage
**Display:** Daily cost in USD, total tokens

**Pricing (as of 2025):**
- GPT-4: $0.03/1K input tokens, $0.06/1K output tokens
- GPT-3.5-turbo: $0.0015/1K input, $0.002/1K output
- Claude 3.5 Sonnet: $0.003/1K input, $0.015/1K output

**File to Create:** `components/analytics/CostTrackingChart.tsx`

---

### 11.4: Conversation Length Distribution

**Type:** Histogram
**Data Source:** New query to messages table
**Display:** Distribution of message counts per conversation

**Bins:**
- 1-5 messages
- 6-10 messages
- 11-20 messages
- 21-50 messages
- 51+ messages

**File to Create:** `components/analytics/ConversationLengthChart.tsx`

---

### 11.5: Response Time Trends

**Type:** Line Chart with confidence interval
**Data Source:** latency_ms from messages table
**Display:** Average latency over time with min/max range

**Metrics:**
- Average latency (ms)
- Min/max range
- Trend line

**File to Create:** `components/analytics/ResponseTimeChart.tsx`

---

## Implementation Plan

### Phase 11.1: Update useAnalytics Hook

**File:** `hooks/useAnalytics.ts`

**Changes Needed:**
1. Add cost calculation to processAnalyticsData()
2. Add conversation length aggregation
3. Add response time trend calculation (already have latency data)

**New Interface Fields:**
```typescript
interface AnalyticsData {
  // ... existing fields ...
  costTracking: Array<{ date: string; cost: number; tokens: number; provider: string }>;
  conversationLengths: Array<{ range: string; count: number }>;
  responseTimeTrends: Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }>;
}
```

**Implementation:**
- Read existing hook structure (lines 106-197)
- Add new processing functions
- Update return type

---

### Phase 11.2: Create Tool Performance Chart

**File:** `components/analytics/ToolPerformanceChart.tsx`

**Component Structure:**
```typescript
interface ToolPerformanceChartProps {
  data: Array<{ tool: string; success: number; failure: number }>;
}

export function ToolPerformanceChart({ data }: ToolPerformanceChartProps) {
  // Transform for recharts stacked bar
  const chartData = data.map(item => ({
    tool: item.tool,
    success: item.success,
    failure: item.failure,
    total: item.success + item.failure
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tool Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tool" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="success" stackId="a" fill="#10b981" name="Success" />
            <Bar dataKey="failure" stackId="a" fill="#ef4444" name="Failure" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 11.3: Create Error Breakdown Chart

**File:** `components/analytics/ErrorBreakdownChart.tsx`

**Component Structure:**
```typescript
interface ErrorBreakdownChartProps {
  data: Array<{ name: string; value: number }>;
}

export function ErrorBreakdownChart({ data }: ErrorBreakdownChartProps) {
  // Colors for different error types
  const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name}: ${entry.value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 11.4: Create Cost Tracking Chart

**File:** `components/analytics/CostTrackingChart.tsx`

**Component Structure:**
```typescript
interface CostTrackingChartProps {
  data: Array<{ date: string; cost: number; tokens: number }>;
}

export function CostTrackingChart({ data }: CostTrackingChartProps) {
  // Format dates and calculate cumulative cost
  const chartData = data.map((item, index, arr) => {
    const cumulativeCost = arr.slice(0, index + 1).reduce((sum, d) => sum + d.cost, 0);
    return {
      ...item,
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      cumulativeCost: parseFloat(cumulativeCost.toFixed(4))
    };
  });

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Cost Tracking</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#8b5cf6" name="Daily Cost ($)" />
            <Line yAxisId="right" type="monotone" dataKey="cumulativeCost" stroke="#ec4899" name="Cumulative Cost ($)" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 11.5: Create Conversation Length Chart

**File:** `components/analytics/ConversationLengthChart.tsx`

**Component Structure:**
```typescript
interface ConversationLengthChartProps {
  data: Array<{ range: string; count: number }>;
}

export function ConversationLengthChart({ data }: ConversationLengthChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversation Length Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="range" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" name="Conversations" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 11.6: Create Response Time Trends Chart

**File:** `components/analytics/ResponseTimeChart.tsx`

**Component Structure:**
```typescript
interface ResponseTimeChartProps {
  data: Array<{ date: string; avgLatency: number; minLatency: number; maxLatency: number }>;
}

export function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Format dates
  const chartData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Response Time Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="avgLatency" stroke="#8b5cf6" name="Avg Latency (ms)" />
            <Line type="monotone" dataKey="minLatency" stroke="#10b981" strokeDasharray="3 3" name="Min" />
            <Line type="monotone" dataKey="maxLatency" stroke="#ef4444" strokeDasharray="3 3" name="Max" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 11.7: Update Analytics Index

**File:** `components/analytics/index.ts`

**Changes:**
```typescript
export { MetricsOverview } from './MetricsOverview';
export { RatingDistribution } from './RatingDistribution';
export { SuccessRateChart } from './SuccessRateChart';
export { TokenUsageChart } from './TokenUsageChart';
export { ToolPerformanceChart } from './ToolPerformanceChart';        // NEW
export { ErrorBreakdownChart } from './ErrorBreakdownChart';          // NEW
export { CostTrackingChart } from './CostTrackingChart';              // NEW
export { ConversationLengthChart } from './ConversationLengthChart';  // NEW
export { ResponseTimeChart } from './ResponseTimeChart';              // NEW
```

---

### Phase 11.8: Update Analytics Dashboard

**File:** `components/analytics/AnalyticsDashboard.tsx`

**Changes:**
1. Import new chart components
2. Add new charts to layout
3. Conditional rendering based on data availability

**Layout Structure:**
```
[Header with Back button and Time Range filter]

[4 Overview Cards] - Existing

[Rating Distribution] [Success Rate Chart] - Existing (row 1)

[Tool Performance] [Error Breakdown] - NEW (row 2)

[Token Usage Chart] - Existing (full width, row 3)

[Cost Tracking Chart] - NEW (full width, row 4)

[Conversation Length] [Response Time Trends] - NEW (row 5)
```

---

## Verification Checklist

### Code Changes
- [ ] Update useAnalytics hook with new data processing
- [ ] Create ToolPerformanceChart component
- [ ] Create ErrorBreakdownChart component
- [ ] Create CostTrackingChart component
- [ ] Create ConversationLengthChart component
- [ ] Create ResponseTimeChart component
- [ ] Update analytics index.ts
- [ ] Update AnalyticsDashboard.tsx with new charts
- [ ] TypeScript compilation succeeds
- [ ] Dev server runs without errors

### Functional Testing
- [ ] Tool performance chart displays correctly
- [ ] Error breakdown chart shows error types
- [ ] Cost tracking shows daily and cumulative costs
- [ ] Conversation length histogram displays
- [ ] Response time trends show avg/min/max
- [ ] All charts update with time range filter
- [ ] Charts handle empty data gracefully
- [ ] Existing analytics still work

### Data Verification
- [ ] Tool performance data is accurate
- [ ] Error types are categorized correctly
- [ ] Cost calculations are correct
- [ ] Conversation lengths are accurate
- [ ] Latency trends match database
- [ ] All charts responsive on mobile

---

## Rollback Plan

### If Implementation Fails
1. Remove new chart components
2. Revert useAnalytics.ts changes
3. Revert AnalyticsDashboard.tsx changes
4. Clear .next cache
5. Restart dev server

### Backward Compatibility
- All new features are additive
- Existing analytics unaffected
- Can deploy incrementally
- Each chart independent

---

## Success Metrics

- ✅ 5 new chart types implemented
- ✅ No breaking changes to existing analytics
- ✅ All charts follow existing design patterns
- ✅ TypeScript compiles successfully
- ✅ Dev server runs without errors
- ✅ Mobile responsive
- ✅ Performance not degraded

---

**Document Version:** 1.0
**Created:** 2025-10-13
**Last Updated:** 2025-10-13
**Status:** Ready for Implementation
