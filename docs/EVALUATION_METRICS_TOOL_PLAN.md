# Evaluation Metrics Tool - Implementation Plan

**Date:** October 13, 2025  
**Tool #:** 6 of 7 in LLM Evaluation Platform  
**Priority:** HIGH - Core training workflow component  

---

## 🎯 OBJECTIVE

Build an Evaluation Metrics Tool that tracks quality scores, analyzes trends, monitors success rates, and provides insights into model performance over time.

---

## 📋 REQUIREMENTS

### Core Operations

1. **get_metrics** - Overall evaluation metrics for a period
2. **quality_trends** - Rating distribution and changes over time
3. **success_analysis** - Success/failure patterns and insights
4. **compare_periods** - Week-over-week, month-over-month comparisons

### Data Source

- **Primary Table:** `message_evaluations`
- **Supporting Tables:** `messages`, `conversations`
- **No LLM Calls:** Pure analytics (frontend-safe)
- **Security:** RLS enforced, user-scoped queries

---

## 🗂️ FILE STRUCTURE

```
lib/tools/evaluation-metrics/
├── index.ts                    # Tool definition
├── metrics.service.ts          # Analytics logic
├── types.ts                    # TypeScript interfaces
├── config.ts                   # Configuration
└── test.ts                     # Basic tests (optional)
```

---

## 📐 TYPE DEFINITIONS

### types.ts

```typescript
export interface EvaluationMetrics {
  userId: string;
  period: string;
  totalEvaluations: number;
  averageRating: number;
  successRate: number;
  qualityDistribution: {
    excellent: number;    // 5 stars
    good: number;         // 4 stars
    average: number;      // 3 stars
    poor: number;         // 2 stars
    veryPoor: number;     // 1 star
  };
  breakdown: {
    successful: number;
    failed: number;
    unevaluated: number;
  };
}

export interface QualityTrend {
  period: string;
  dataPoints: TrendDataPoint[];
  trend: 'improving' | 'declining' | 'stable';
  changePercentage: number;
}

export interface TrendDataPoint {
  date: string;
  averageRating: number;
  evaluationCount: number;
}

export interface SuccessAnalysis {
  period: string;
  successRate: number;
  failureRate: number;
  totalInteractions: number;
  insights: string[];
  commonIssues: string[];
}

export interface PeriodComparison {
  currentPeriod: EvaluationMetrics;
  previousPeriod: EvaluationMetrics;
  changes: {
    ratingChange: number;
    successRateChange: number;
    volumeChange: number;
  };
  summary: string;
}

export interface MetricsOptions {
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
  conversationId?: string;
  minRating?: number;
  maxRating?: number;
}
```

---

## ⚙️ CONFIGURATION

### config.ts

```typescript
export const evaluationMetricsConfig = {
  enabled: true,
  
  // Default analysis period
  defaultPeriod: 'week' as const,
  
  // Thresholds for quality assessment
  thresholds: {
    excellentRating: 4.5,      // >= 4.5 is excellent
    goodRating: 3.5,           // >= 3.5 is good
    poorRating: 2.5,           // < 2.5 is poor
    minSuccessRate: 0.8,       // 80% success rate target
  },
  
  // Trend detection
  trendDetection: {
    improvingThreshold: 0.1,   // +10% improvement
    decliningThreshold: -0.1,  // -10% decline
    minDataPoints: 3,          // Need 3+ points for trend
  },
  
  // Query limits
  maxEvaluationsAnalyzed: 10000,
  maxTrendDataPoints: 100,
};
```

---

## 🔧 SERVICE IMPLEMENTATION

### metrics.service.ts - Core Methods

```typescript
class EvaluationMetricsService {
  // Get overall metrics
  async getMetrics(userId: string, options: MetricsOptions): Promise<EvaluationMetrics>
  
  // Analyze quality trends
  async getQualityTrends(userId: string, options: MetricsOptions): Promise<QualityTrend>
  
  // Success/failure analysis
  async getSuccessAnalysis(userId: string, options: MetricsOptions): Promise<SuccessAnalysis>
  
  // Compare two periods
  async comparePeriods(
    userId: string,
    currentPeriod: MetricsOptions,
    previousPeriod: MetricsOptions
  ): Promise<PeriodComparison>
  
  // Helper: Calculate date range
  private getDateRange(period: string, endDate?: Date): { start: Date; end: Date }
  
  // Helper: Determine trend direction
  private analyzeTrend(dataPoints: TrendDataPoint[]): 'improving' | 'declining' | 'stable'
  
  // Helper: Generate insights
  private generateInsights(metrics: EvaluationMetrics): string[]
}
```

---

## 🎯 TOOL DEFINITION

### index.ts - Operations

```typescript
{
  name: 'evaluation_metrics',
  description: 'Track evaluation scores, analyze quality trends, and monitor model performance',
  version: '1.0.0',
  
  operations: [
    {
      name: 'get_metrics',
      description: 'Get overall evaluation metrics',
      parameters: { period, startDate, endDate, conversationId }
    },
    {
      name: 'quality_trends',
      description: 'Analyze rating trends over time',
      parameters: { period, startDate, endDate }
    },
    {
      name: 'success_analysis',
      description: 'Analyze success/failure patterns',
      parameters: { period, startDate, endDate }
    },
    {
      name: 'compare_periods',
      description: 'Compare two time periods',
      parameters: { currentPeriod, previousPeriod }
    }
  ]
}
```

---

## 🗄️ DATABASE QUERIES

### message_evaluations Table Structure

```sql
message_evaluations:
  - id (uuid)
  - message_id (uuid, FK to messages)
  - user_id (uuid)
  - rating (integer, 1-5)
  - is_successful (boolean)
  - feedback_text (text, optional)
  - evaluation_type (string)
  - created_at (timestamp)
  - updated_at (timestamp)
```

### Key Queries

1. **Overall Metrics:**
```typescript
supabase
  .from('message_evaluations')
  .select('rating, is_successful, created_at')
  .eq('user_id', userId)
  .gte('created_at', startDate)
  .lte('created_at', endDate)
```

2. **Quality Distribution:**
```typescript
// Group by rating and count
ratings.reduce((acc, r) => {
  acc[r.rating] = (acc[r.rating] || 0) + 1;
  return acc;
}, {})
```

3. **Trend Data:**
```typescript
// Group by day/week and calculate averages
evaluations.groupBy(date).map(group => ({
  date: group.date,
  averageRating: average(group.ratings),
  count: group.length
}))
```

---

## 💬 USAGE EXAMPLES

### Example 1: Get Weekly Metrics

**User:** "Show me my evaluation metrics for this week"

**Response:**
```json
{
  "period": "2025-10-06 to 2025-10-13",
  "totalEvaluations": 156,
  "averageRating": 4.3,
  "successRate": 0.872,
  "qualityDistribution": {
    "excellent": 45,
    "good": 62,
    "average": 31,
    "poor": 12,
    "veryPoor": 6
  }
}
```

### Example 2: Analyze Trends

**User:** "Are my evaluation scores improving?"

**Response:**
```json
{
  "trend": "improving",
  "changePercentage": 12.5,
  "dataPoints": [
    { "date": "2025-10-06", "averageRating": 3.9 },
    { "date": "2025-10-09", "averageRating": 4.2 },
    { "date": "2025-10-13", "averageRating": 4.3 }
  ]
}
```

### Example 3: Compare Periods

**User:** "Compare this week vs last week"

**Response:**
```json
{
  "changes": {
    "ratingChange": +0.3,
    "successRateChange": +5.2,
    "volumeChange": +23
  },
  "summary": "Quality improved by 7.5% with 23 more evaluations"
}
```

---

## 🧪 TESTING APPROACH

### test.ts

```typescript
async function testEvaluationMetrics() {
  const testUserId = 'test-user-123';
  
  // Test 1: Get metrics
  const metrics = await metricsService.getMetrics(testUserId, {
    period: 'week'
  });
  
  // Test 2: Quality trends
  const trends = await metricsService.getQualityTrends(testUserId, {
    period: 'month'
  });
  
  // Test 3: Success analysis
  const analysis = await metricsService.getSuccessAnalysis(testUserId, {
    period: 'week'
  });
  
  // Test 4: Period comparison
  const comparison = await metricsService.comparePeriods(
    testUserId,
    { period: 'week' },
    { period: 'week', endDate: oneWeekAgo }
  );
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Create types.ts with all interfaces
- [ ] Create config.ts with thresholds and settings
- [ ] Implement metrics.service.ts (getMetrics)
- [ ] Implement quality trends analysis
- [ ] Implement success analysis
- [ ] Implement period comparison
- [ ] Create index.ts tool definition
- [ ] Register tool in lib/tools/registry.ts
- [ ] Verify TypeScript compilation (0 errors)
- [ ] Test with sample data
- [ ] Update PROGRESS_LOG.md
- [ ] Create completion document

---

## 🎯 SUCCESS CRITERIA

- ✅ TypeScript compiles with zero errors
- ✅ Tool auto-registers successfully
- ✅ Metrics calculations accurate
- ✅ Trend detection working
- ✅ Period comparisons correct
- ✅ Error handling follows platform patterns
- ✅ No API keys or LLM calls (frontend-safe)
- ✅ RLS policies respected

---

## 🔒 SECURITY NOTES

- **No LLM Calls:** Pure analytics, no API keys needed
- **Frontend Safe:** Can be bundled with frontend code
- **User Isolation:** All queries filtered by userId
- **RLS Enforced:** Supabase handles data isolation
- **No Sensitive Data:** Only aggregated metrics

---

**Next Steps:** Begin implementation with types.ts

**Estimated Time:** 1-2 hours  
**Complexity:** Medium (aggregation logic, trend analysis)  
**Risk:** Low (no external APIs, pure database analytics)
