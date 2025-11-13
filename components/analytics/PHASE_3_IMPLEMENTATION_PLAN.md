# Phase 3 Implementation Plan
## Advanced User Insights & Business Intelligence

**Version:** 1.0.0
**Date Created:** 2025-10-25
**Status:** Ready for Implementation
**Prerequisites:** Phase 0, Phase 1, Phase 2 Complete

---

## Executive Summary

This plan details the implementation of **Phase 3: Advanced User Insights & Business Intelligence** which connects AI performance metrics to business outcomes and user experience through user-level analysis.

**Key Deliverables:**
- User cohort backend services with segmentation logic
- Interactive cohort analysis dashboard
- Advanced sentiment analysis engine
- Sentiment visualization and correlation tools
- AI-powered insights with root cause analysis

**Timeline:** 5-7 days (Sprint 5)
**Complexity:** Medium-High
**Database Schema:** Already Created (Phase 0)

---

## Phase 3 Tasks Overview

| Task | Feature | Priority | Est. Time | Dependencies |
|------|---------|----------|-----------|--------------|
| 3.1 | User Cohort Backend | High | 1.5 days | Phase 0 schema |
| 3.2 | Cohort Analysis UI | High | 1.5 days | Task 3.1 |
| 3.3 | Advanced Sentiment Analysis | Medium | 1.5 days | None |
| 3.4 | Sentiment Dashboard | Medium | 1.5 days | Task 3.3 |
| 3.5 | Enhanced AI Insights | Low | 1 day | Tasks 3.1-3.4 |

---

## Task 3.1: User Cohort Backend

**Objective:** Build backend services for user segmentation based on properties like subscription plan, signup date, feature usage, and custom criteria.

**Database Schema:** ✅ Already created in `20251025000004_create_user_cohorts.sql`

### Implementation Steps

#### Step 3.1.1: Create Cohort Service
**File:** `lib/services/cohort.service.ts`

**Functions to Implement:**
```typescript
// Cohort CRUD operations
- createCohort(cohortData): Promise<Cohort>
- updateCohort(cohortId, updates): Promise<Cohort>
- deleteCohort(cohortId): Promise<void>
- getCohort(cohortId): Promise<Cohort>
- listCohorts(filters): Promise<Cohort[]>

// Member management
- addCohortMember(cohortId, userId, method): Promise<void>
- removeCohortMember(cohortId, userId, reason): Promise<void>
- getCohortMembers(cohortId): Promise<CohortMember[]>
- getUserCohorts(userId): Promise<Cohort[]>

// Dynamic cohort evaluation
- evaluateCriteria(userId, criteria): Promise<boolean>
- refreshDynamicCohort(cohortId): Promise<number>
- autoAssignUserToCohorts(userId): Promise<Cohort[]>

// Metrics calculation
- calculateCohortMetrics(cohortId): Promise<CohortMetrics>
- calculateBaselineMetrics(): Promise<BaselineMetrics>
- compareToBaseline(cohortId): Promise<ComparisonMetrics>

// Snapshot management
- createSnapshot(cohortId, type): Promise<Snapshot>
- getSnapshots(cohortId, dateRange): Promise<Snapshot[]>
- getTrendData(cohortId, metric): Promise<TrendData>
```

**Code Structure Requirements:**
- Max 30 lines per function or complete logic blocks
- Debug logging: `[CohortService]` prefix
- Comprehensive error handling with try-catch
- Input validation on all public methods
- User authentication checks

#### Step 3.1.2: Create Cohort Criteria Evaluator
**File:** `lib/services/cohort-criteria-evaluator.ts`

**Purpose:** Evaluate complex user criteria for dynamic cohort assignment

**Supported Criteria Types:**
```typescript
interface CohortCriteria {
  // User properties
  signup_date?: { before?: Date; after?: Date; between?: [Date, Date] };
  subscription_plan?: { in?: string[]; not_in?: string[] };
  total_conversations?: { gt?: number; lt?: number; eq?: number };

  // Behavioral patterns
  activity_level?: 'low' | 'medium' | 'high' | 'very_high';
  last_active?: { days_ago?: number };
  feature_usage?: { feature: string; min_uses?: number };

  // Performance metrics
  average_rating?: { gt?: number; lt?: number };
  success_rate?: { gt?: number; lt?: number };
  total_cost?: { gt?: number; lt?: number };

  // Custom properties
  custom_fields?: Record<string, any>;

  // Logical operators
  AND?: CohortCriteria[];
  OR?: CohortCriteria[];
  NOT?: CohortCriteria;
}
```

**Functions:**
```typescript
- evaluateCriteria(userId: string, criteria: CohortCriteria): Promise<boolean>
- parseCondition(condition, value): boolean
- fetchUserMetrics(userId): Promise<UserMetrics>
- evaluateLogicalOperator(userId, operator, criteria[]): Promise<boolean>
```

#### Step 3.1.3: Create Cohort API Routes
**File:** `app/api/analytics/cohorts/route.ts`

**Endpoints:**

**GET /api/analytics/cohorts**
```typescript
Query params:
- cohort_type?: string
- is_active?: boolean
- limit?: number (default: 50)
- offset?: number (default: 0)

Response: { cohorts: Cohort[], total: number }
```

**POST /api/analytics/cohorts**
```typescript
Body: {
  name: string;
  description?: string;
  cohort_type: CohortType;
  criteria?: CohortCriteria;
}

Response: { cohort: Cohort }
```

**PATCH /api/analytics/cohorts**
```typescript
Body: {
  cohort_id: string;
  updates: Partial<Cohort>;
}

Response: { cohort: Cohort }
```

**DELETE /api/analytics/cohorts/{id}**
```typescript
Response: { success: boolean }
```

**File:** `app/api/analytics/cohorts/[id]/members/route.ts`

**GET /api/analytics/cohorts/{id}/members**
```typescript
Query params:
- is_active?: boolean
- limit?: number
- offset?: number

Response: { members: CohortMember[], total: number }
```

**POST /api/analytics/cohorts/{id}/members**
```typescript
Body: {
  user_ids: string[];
  added_method: 'manual' | 'automatic' | 'criteria_match' | 'import';
}

Response: { added: number, failed: number }
```

**DELETE /api/analytics/cohorts/{id}/members/{userId}**
```typescript
Body: { removal_reason?: string }

Response: { success: boolean }
```

**File:** `app/api/analytics/cohorts/[id]/metrics/route.ts`

**GET /api/analytics/cohorts/{id}/metrics**
```typescript
Query params:
- start_date?: string
- end_date?: string
- include_trends?: boolean

Response: {
  metrics: CohortMetrics;
  baseline_comparison?: ComparisonMetrics;
  trends?: TrendData;
}
```

**POST /api/analytics/cohorts/{id}/refresh**
```typescript
Purpose: Recalculate dynamic cohort membership

Response: {
  members_added: number;
  members_removed: number;
  total_members: number;
}
```

#### Step 3.1.4: Create Cohort Snapshot Scheduler
**File:** `lib/services/cohort-snapshot-scheduler.ts`

**Purpose:** Automated daily/weekly/monthly snapshot creation

**Functions:**
```typescript
- createDailySnapshots(): Promise<void>
- createWeeklySnapshots(): Promise<void>
- createMonthlySnapshots(): Promise<void>
- scheduleSnapshots(cohortId, type, schedule): Promise<void>
- cleanupOldSnapshots(retentionDays): Promise<number>
```

**Note:** This service will be called by cron job or scheduled task

### Verification Steps for Task 3.1

1. **Database Verification:**
   - Verify tables exist and have correct schema
   - Test RLS policies with different users
   - Verify indexes are created

2. **Service Testing:**
   - Create cohorts of each type (static, dynamic, behavioral)
   - Add/remove members
   - Calculate metrics for cohort
   - Evaluate criteria for users
   - Create snapshots

3. **API Testing:**
   - Test all CRUD operations
   - Test member management endpoints
   - Test metrics calculation
   - Test refresh functionality
   - Verify authentication and authorization

4. **Debug Logging:**
   - All operations should log start/end
   - Errors should be logged with context
   - Performance metrics logged for expensive operations

---

## Task 3.2: Cohort Analysis UI

**Objective:** Build interactive cohort analysis dashboard for comparing metrics across user segments.

**Component:** `CohortAnalysisView`
**Integration:** New route and dashboard section

### Implementation Steps

#### Step 3.2.1: Create Cohort Analysis Component
**File:** `components/analytics/CohortAnalysisView.tsx`

**Features:**
- Cohort list/grid view
- Cohort creation modal
- Cohort comparison chart
- Member management interface
- Metrics dashboard
- Trend visualization
- Export functionality

**Props:**
```typescript
interface CohortAnalysisViewProps {
  defaultCohortId?: string;
  comparisonMode?: boolean;
}
```

**State Management:**
```typescript
- cohorts: Cohort[]
- selectedCohorts: string[]  // For comparison
- currentCohort: Cohort | null
- cohortMembers: CohortMember[]
- cohortMetrics: CohortMetrics | null
- trendData: TrendData[]
- loading: boolean
- error: string | null
```

**Sub-components to create:**
- `CohortCard` - Display cohort summary
- `CohortComparisonChart` - Side-by-side metric comparison
- `CohortMemberList` - List and manage members
- `CohortMetricsPanel` - Display key metrics
- `CohortTrendChart` - Historical trend visualization
- `CohortCreationModal` - Create new cohorts
- `CohortCriteriaBuilder` - Build dynamic criteria

#### Step 3.2.2: Create Cohort Card Component
**File:** `components/analytics/CohortCard.tsx`

**Display Information:**
- Cohort name and description
- Cohort type badge
- Member count
- Key metrics (avg rating, success rate, cost)
- vs Baseline indicators (↑/↓ with percentage)
- Last calculated timestamp
- Action buttons (View, Edit, Delete)

**Visual Design:**
- Color-coded by cohort type
- Metric badges with icons
- Comparison indicators (green/red arrows)
- Loading skeleton state

#### Step 3.2.3: Create Cohort Comparison Chart
**File:** `components/analytics/CohortComparisonChart.tsx`

**Chart Type:** Grouped Bar Chart (Recharts)

**Metrics Compared:**
- Average Rating (0-5 scale)
- Success Rate (0-100%)
- Average Cost per Session ($)
- Average Tokens per Conversation
- Total Conversations
- Active Members

**Props:**
```typescript
interface CohortComparisonChartProps {
  cohorts: Cohort[];
  metric: 'rating' | 'success_rate' | 'cost' | 'tokens' | 'conversations';
  includeBaseline?: boolean;
}
```

**Features:**
- Selectable metrics dropdown
- Baseline comparison line
- Interactive tooltips
- Legend with cohort colors
- Export to image

#### Step 3.2.4: Create Cohort Criteria Builder
**File:** `components/analytics/CohortCriteriaBuilder.tsx`

**Purpose:** Visual builder for dynamic cohort criteria

**UI Elements:**
- Condition type selector (AND/OR/NOT)
- Field selector (signup_date, activity_level, etc.)
- Operator selector (>, <, =, in, between)
- Value input (text, number, date, multi-select)
- Add/remove condition buttons
- Nested condition support
- Preview member count
- Validation feedback

**Output:** Valid `CohortCriteria` JSON object

#### Step 3.2.5: Create Cohort Trend Chart
**File:** `components/analytics/CohortTrendChart.tsx`

**Chart Type:** Line Chart (Recharts)

**Data Source:** `user_cohort_snapshots` table

**Metrics to Visualize:**
- Member count over time
- Average rating trend
- Success rate trend
- Total cost trend
- Active members trend

**Props:**
```typescript
interface CohortTrendChartProps {
  cohortId: string;
  metric: 'members' | 'rating' | 'success_rate' | 'cost' | 'activity';
  dateRange?: { start: Date; end: Date };
}
```

**Features:**
- Date range selector
- Multiple metrics on same chart
- Zoom and pan
- Annotations for significant events
- Export functionality

#### Step 3.2.6: Integrate into Dashboard
**Files to Modify:**
- `app/analytics/cohorts/page.tsx` (NEW PAGE)
- `components/analytics/AnalyticsDashboard.tsx` (ADD LINK)
- `app/layout.tsx` or nav component (ADD NAV LINK)

**New Route:**
- `/analytics/cohorts` - Main cohort analysis page
- `/analytics/cohorts/[id]` - Detailed cohort view

### Verification Steps for Task 3.2

1. **Component Rendering:**
   - All components render without errors
   - Loading states display correctly
   - Error states show user-friendly messages
   - Empty states provide guidance

2. **User Interactions:**
   - Create cohort flow works end-to-end
   - Criteria builder generates valid JSON
   - Member list loads and displays
   - Comparison chart updates on selection
   - Trend chart updates on date range change

3. **Data Flow:**
   - API calls authenticated correctly
   - Data fetched and cached appropriately
   - State updates trigger re-renders
   - Error handling displays feedback

4. **Visual Quality:**
   - Responsive design on all screen sizes
   - Color scheme consistent with app
   - Charts render smoothly
   - Animations enhance UX

---

## Task 3.3: Advanced Sentiment Analysis

**Objective:** Implement sentiment analysis service to detect user emotions like frustration, confusion, satisfaction from feedback and chat logs.

**Technology:** Client-side sentiment analysis or API integration

### Implementation Steps

#### Step 3.3.1: Create Sentiment Analysis Service
**File:** `lib/services/sentiment-analysis.service.ts`

**Core Functions:**
```typescript
// Text analysis
- analyzeSentiment(text: string): Promise<SentimentResult>
- detectEmotions(text: string): Promise<EmotionScores>
- extractKeyPhrases(text: string): Promise<string[]>

// Batch processing
- analyzeBatch(texts: string[]): Promise<SentimentResult[]>
- analyzeConversation(messages: Message[]): Promise<ConversationSentiment>

// Trend analysis
- calculateSentimentTrend(sentiments: SentimentResult[]): SentimentTrend
- correlateSentimentWithRating(sentiments, ratings): number

// Classification
- classifyFrustration(sentiment: SentimentResult): FrustrationLevel
- detectConfusion(text: string): boolean
- detectSatisfaction(sentiment: SentimentResult): SatisfactionLevel
```

**Data Structures:**
```typescript
interface SentimentResult {
  score: number;  // -1 to 1 (negative to positive)
  magnitude: number;  // 0 to infinity (emotional intensity)
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;  // 0 to 1
}

interface EmotionScores {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  frustration: number;
  confusion: number;
  satisfaction: number;
}

interface ConversationSentiment {
  overall: SentimentResult;
  messages: Array<{
    message_id: string;
    sentiment: SentimentResult;
    emotions: EmotionScores;
  }>;
  trend: 'improving' | 'degrading' | 'stable';
  emotional_arc: SentimentResult[];
}
```

**Implementation Options:**

**Option A: Client-side ML (Recommended for MVP)**
- Use `sentiment` npm package for basic sentiment
- Use pattern matching for emotion detection
- No API costs
- Works offline
- Faster response times

**Option B: API Integration (Better accuracy)**
- Google Cloud Natural Language API
- AWS Comprehend
- Azure Text Analytics
- Requires API keys and budget
- Higher accuracy
- More emotion categories

#### Step 3.3.2: Create Sentiment Database Schema
**File:** `supabase/migrations/20251025000005_create_sentiment_analysis.sql`

**Tables to Create:**
```sql
CREATE TABLE sentiment_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID,
  message_id UUID,

  -- Analysis results
  sentiment_score DECIMAL(5, 4) NOT NULL,  -- -1 to 1
  sentiment_magnitude DECIMAL(5, 4) NOT NULL,
  sentiment_label TEXT NOT NULL CHECK (sentiment_label IN (
    'positive', 'negative', 'neutral', 'mixed'
  )),
  confidence DECIMAL(5, 4) NOT NULL,

  -- Emotions
  emotion_scores JSONB DEFAULT '{}',
  primary_emotion TEXT,
  frustration_level TEXT CHECK (frustration_level IN (
    'none', 'low', 'medium', 'high', 'severe'
  )),

  -- Context
  analyzed_text TEXT,
  text_length INTEGER,
  language TEXT DEFAULT 'en',

  -- Metadata
  analysis_method TEXT,  -- 'client' or 'api'
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sentiment trends table
CREATE TABLE sentiment_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),

  -- Time period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL,  -- 'hourly', 'daily', 'weekly'

  -- Aggregated metrics
  average_sentiment DECIMAL(5, 4),
  sentiment_volatility DECIMAL(5, 4),
  positive_count INTEGER,
  negative_count INTEGER,
  neutral_count INTEGER,

  -- Correlations
  correlation_with_rating DECIMAL(5, 4),
  correlation_with_success DECIMAL(5, 4),

  -- Key insights
  dominant_emotions JSONB,
  frustration_incidents INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, period_start, period_type)
);
```

**RLS Policies:**
- Users can view own sentiment analyses
- Users can insert own sentiment analyses
- Aggregated trends viewable by all users

#### Step 3.3.3: Create Sentiment API Routes
**File:** `app/api/analytics/sentiment/route.ts`

**POST /api/analytics/sentiment/analyze**
```typescript
Body: {
  text: string;
  conversation_id?: string;
  message_id?: string;
}

Response: {
  sentiment: SentimentResult;
  emotions: EmotionScores;
  frustration_level: FrustrationLevel;
}
```

**POST /api/analytics/sentiment/batch**
```typescript
Body: {
  items: Array<{ id: string; text: string }>;
}

Response: {
  results: Array<{ id: string; sentiment: SentimentResult }>;
}
```

**GET /api/analytics/sentiment/trends**
```typescript
Query params:
- start_date: string
- end_date: string
- period_type: 'hourly' | 'daily' | 'weekly'

Response: {
  trends: SentimentTrend[];
  summary: SentimentSummary;
}
```

**GET /api/analytics/sentiment/conversation/{id}**
```typescript
Response: {
  conversation_sentiment: ConversationSentiment;
}
```

#### Step 3.3.4: Create Sentiment Analysis Hook
**File:** `lib/hooks/useSentimentAnalysis.ts`

**Purpose:** React hook for easy sentiment analysis in components

```typescript
export function useSentimentAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzText = async (text: string): Promise<SentimentResult> => {
    // Implementation
  };

  const analyzeConversation = async (conversationId: string): Promise<ConversationSentiment> => {
    // Implementation
  };

  const getTrends = async (dateRange: DateRange): Promise<SentimentTrend[]> => {
    // Implementation
  };

  return {
    analyzeText,
    analyzeConversation,
    getTrends,
    analyzing,
    error
  };
}
```

### Verification Steps for Task 3.3

1. **Service Testing:**
   - Analyze sample texts with known sentiments
   - Verify sentiment scores are in valid ranges
   - Test emotion detection accuracy
   - Test batch processing performance

2. **Database Testing:**
   - Insert sentiment analyses
   - Query trends by date range
   - Verify RLS policies
   - Test aggregation queries

3. **API Testing:**
   - Test all endpoints with valid/invalid data
   - Verify authentication
   - Test batch processing limits
   - Verify response formats

4. **Accuracy Validation:**
   - Compare results with manual sentiment assessment
   - Test edge cases (sarcasm, mixed emotions)
   - Validate frustration detection
   - Verify confidence scores

---

## Task 3.4: Sentiment Dashboard

**Objective:** Create visualization tools for sentiment trends and correlations with tool errors and conversation ratings.

**Component:** Sentiment dashboard section in analytics

### Implementation Steps

#### Step 3.4.1: Create Sentiment Overview Component
**File:** `components/analytics/SentimentOverview.tsx`

**Display:**
- Current sentiment score (gauge chart)
- Sentiment distribution (pie chart)
- Emotion breakdown (radar chart)
- Trend line (line chart)
- Frustration incident count
- Top positive/negative messages

**Props:**
```typescript
interface SentimentOverviewProps {
  dateRange?: DateRange;
  filters?: SentimentFilters;
}
```

#### Step 3.4.2: Create Sentiment Trend Chart
**File:** `components/analytics/SentimentTrendChart.tsx`

**Chart Type:** Area Chart with multiple series

**Series:**
- Average sentiment score
- Positive message percentage
- Negative message percentage
- Frustration incidents

**Props:**
```typescript
interface SentimentTrendChartProps {
  dateRange: DateRange;
  granularity: 'hourly' | 'daily' | 'weekly';
  showCorrelations?: boolean;
}
```

**Features:**
- Overlay rating trend
- Overlay error count
- Highlight correlation points
- Interactive tooltips
- Zoom and pan

#### Step 3.4.3: Create Sentiment Correlation Matrix
**File:** `components/analytics/SentimentCorrelationMatrix.tsx`

**Purpose:** Show correlations between sentiment and performance metrics

**Correlations to Display:**
- Sentiment ↔ User Rating
- Sentiment ↔ Success Rate
- Sentiment ↔ Response Time
- Sentiment ↔ Error Count
- Frustration ↔ Tool Failures
- Confusion ↔ Conversation Length

**Visual:** Heatmap with correlation coefficients

**Props:**
```typescript
interface SentimentCorrelationMatrixProps {
  dateRange: DateRange;
  minCorrelation?: number;  // Filter weak correlations
}
```

#### Step 3.4.4: Create Emotion Radar Chart
**File:** `components/analytics/EmotionRadarChart.tsx`

**Chart Type:** Radar/Spider Chart (Recharts)

**Emotions Displayed:**
- Joy
- Frustration
- Confusion
- Satisfaction
- Anger
- Surprise

**Props:**
```typescript
interface EmotionRadarChartProps {
  emotions: EmotionScores;
  comparisonEmotions?: EmotionScores;  // For before/after
}
```

#### Step 3.4.5: Create Frustration Incidents List
**File:** `components/analytics/FrustrationIncidentsList.tsx`

**Purpose:** List messages/conversations with high frustration

**Display:**
- Timestamp
- User (anonymized if needed)
- Frustration level (color-coded)
- Message excerpt
- Associated tool errors
- Link to conversation
- Resolution status

**Features:**
- Sort by frustration level
- Filter by resolved/unresolved
- Bulk actions (mark resolved, export)
- Pagination

#### Step 3.4.6: Integrate into Dashboard
**Files to Modify:**
- `components/analytics/AnalyticsDashboard.tsx`
- Create new section: "Sentiment Analysis & User Experience"

**Layout:**
```typescript
{/* Sentiment Analysis & User Experience */}
<div className="space-y-6">
  <SentimentOverview dateRange={timeRange} />

  <div className="grid gap-6 md:grid-cols-2">
    <SentimentTrendChart dateRange={timeRange} granularity="daily" />
    <SentimentCorrelationMatrix dateRange={timeRange} />
  </div>

  <div className="grid gap-6 md:grid-cols-2">
    <EmotionRadarChart emotions={currentEmotions} />
    <FrustrationIncidentsList limit={10} />
  </div>
</div>
```

### Verification Steps for Task 3.4

1. **Component Rendering:**
   - All charts render with sample data
   - Loading states work correctly
   - Error states display properly
   - Empty states provide guidance

2. **Data Visualization:**
   - Charts accurately represent data
   - Colors are distinguishable
   - Tooltips show correct information
   - Legends are clear

3. **Interactions:**
   - Date range changes update all charts
   - Click events work (drill-down to details)
   - Export functionality works
   - Filters apply correctly

4. **Performance:**
   - Charts render smoothly with 1000+ data points
   - No lag when switching date ranges
   - Memoization prevents unnecessary re-renders

---

## Task 3.5: Enhanced AI Insights

**Objective:** Upgrade InsightsPanel to perform automated root cause analysis for metric degradations and provide proactive recommendations.

**Enhancement:** Add AI-powered analysis to existing `InsightsPanel`

### Implementation Steps

#### Step 3.5.1: Create AI Insights Service
**File:** `lib/services/ai-insights.service.ts`

**Core Functions:**
```typescript
// Root cause analysis
- analyzeMetricDegradation(metric, historicalData): Promise<RootCauseAnalysis>
- identifyContributingFactors(anomaly): Promise<ContributingFactor[]>
- generateHypotheses(pattern): Promise<Hypothesis[]>

// Recommendations
- generateRecommendations(analysis): Promise<Recommendation[]>
- prioritizeActions(recommendations): Promise<PrioritizedAction[]>
- estimateImpact(action): Promise<ImpactEstimate>

// Pattern detection
- detectPatterns(metricData): Promise<Pattern[]>
- identifySeasonality(timeSeriesData): Promise<SeasonalityReport>
- findAnomalousSegments(data): Promise<AnomalousSegment[]>

// Correlations
- findCorrelations(metrics): Promise<Correlation[]>
- analyzeLeadLagRelationships(metrics): Promise<LeadLagRelation[]>
```

**Data Structures:**
```typescript
interface RootCauseAnalysis {
  metric_name: string;
  degradation_detected: {
    start_time: Date;
    severity: 'minor' | 'moderate' | 'severe' | 'critical';
    percentage_drop: number;
  };

  primary_causes: Array<{
    factor: string;
    confidence: number;  // 0-1
    contribution_percentage: number;
    evidence: string[];
  }>;

  contributing_factors: Array<{
    factor: string;
    correlation: number;
    time_lag_hours?: number;
  }>;

  timeline: Array<{
    timestamp: Date;
    event: string;
    impact: string;
  }>;

  similar_incidents: Array<{
    date: Date;
    cause: string;
    resolution: string;
  }>;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  action_type: 'immediate' | 'short_term' | 'long_term';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_impact: {
    metric: string;
    improvement_percentage: number;
    confidence: number;
  };
  implementation_steps: string[];
  effort_estimate: string;
  dependencies: string[];
}
```

#### Step 3.5.2: Implement Root Cause Analysis Algorithm

**Algorithm Steps:**
1. Detect anomaly/degradation in target metric
2. Identify time window of degradation
3. Gather all metrics in same time window
4. Calculate correlations between metrics
5. Identify metrics that changed before target metric (potential causes)
6. Analyze error logs, tool failures in time window
7. Check for deployment/configuration changes
8. Compare with historical similar incidents
9. Generate hypotheses ranked by confidence
10. Produce actionable recommendations

**Pseudo-code:**
```typescript
async function analyzeMetricDegradation(
  metric: string,
  historicalData: DataPoint[]
): Promise<RootCauseAnalysis> {
  // Step 1: Detect anomaly
  const anomalies = await detectAnomalies(historicalData);
  if (anomalies.length === 0) return null;

  const mainAnomaly = anomalies[0];
  const timeWindow = {
    start: subtractHours(mainAnomaly.timestamp, 24),
    end: mainAnomaly.timestamp
  };

  // Step 2: Gather related metrics
  const relatedMetrics = await fetchAllMetrics(timeWindow);

  // Step 3: Calculate correlations
  const correlations = calculateCorrelations(metric, relatedMetrics);
  const significantCorrelations = correlations.filter(c => abs(c.value) > 0.6);

  // Step 4: Analyze lead-lag relationships
  const leadingIndicators = significantCorrelations.filter(c =>
    c.leadTimeHours > 0 && c.leadTimeHours < 12
  );

  // Step 5: Check error logs
  const errors = await fetchErrors(timeWindow);
  const errorSpikes = detectSpikes(errors);

  // Step 6: Check deployments
  const deployments = await fetchDeployments(timeWindow);

  // Step 7: Generate hypotheses
  const hypotheses = [];

  for (const indicator of leadingIndicators) {
    hypotheses.push({
      factor: indicator.metricName,
      confidence: indicator.correlation,
      evidence: [`${indicator.metricName} changed ${indicator.leadTimeHours}h before ${metric}`]
    });
  }

  for (const errorSpike of errorSpikes) {
    hypotheses.push({
      factor: `Error: ${errorSpike.errorType}`,
      confidence: 0.8,
      evidence: [`${errorSpike.count} errors occurred in window`]
    });
  }

  // Step 8: Rank by confidence
  hypotheses.sort((a, b) => b.confidence - a.confidence);

  return {
    metric_name: metric,
    degradation_detected: mainAnomaly,
    primary_causes: hypotheses.slice(0, 3),
    contributing_factors: significantCorrelations,
    timeline: buildTimeline(leadingIndicators, errorSpikes, deployments),
    similar_incidents: await findSimilarIncidents(hypotheses)
  };
}
```

#### Step 3.5.3: Implement Recommendation Engine

**Recommendation Sources:**
1. **Error-based:** If error spike detected, recommend error fixes
2. **Performance-based:** If latency increased, recommend optimization
3. **Cost-based:** If cost increased, recommend model/prompt optimization
4. **Quality-based:** If quality dropped, recommend prompt tuning
5. **Historical:** Recommend actions that worked for similar incidents

**Example Recommendations:**
```typescript
const recommendationTemplates = {
  high_error_rate: {
    title: "Investigate and fix {error_type} errors",
    action_type: "immediate",
    priority: "high",
    steps: [
      "Check error logs for {error_type}",
      "Identify root cause",
      "Implement fix",
      "Deploy and monitor"
    ]
  },

  high_latency: {
    title: "Optimize response time performance",
    action_type: "short_term",
    priority: "medium",
    steps: [
      "Profile slow requests",
      "Optimize database queries",
      "Add caching for common requests",
      "Consider switching to faster model"
    ]
  },

  quality_degradation: {
    title: "Improve prompt quality and model performance",
    action_type: "short_term",
    priority: "high",
    steps: [
      "Review recent prompt changes",
      "A/B test prompt variations",
      "Consider few-shot examples",
      "Evaluate alternative models"
    ]
  }
};
```

#### Step 3.5.4: Enhance InsightsPanel Component
**File:** `components/analytics/InsightsPanel.tsx`

**New Features to Add:**
- Root cause analysis section
- Recommendation cards with action buttons
- Historical incident timeline
- Correlation visualization
- "Explain this anomaly" button
- Automated insights refresh

**Enhanced Structure:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>AI-Powered Insights</CardTitle>
    <Button onClick={refreshInsights}>Refresh Analysis</Button>
  </CardHeader>

  <CardContent>
    {/* Existing insights */}
    <div className="space-y-4">
      {insights.map(insight => <InsightCard key={insight.id} {...insight} />)}
    </div>

    {/* NEW: Root Cause Analysis Section */}
    {rootCauseAnalysis && (
      <div className="mt-6 border-t pt-6">
        <h3>Root Cause Analysis</h3>
        <RootCauseTimeline analysis={rootCauseAnalysis} />
        <ContributingFactorsList factors={rootCauseAnalysis.primary_causes} />
      </div>
    )}

    {/* NEW: Recommendations Section */}
    {recommendations.length > 0 && (
      <div className="mt-6 border-t pt-6">
        <h3>Recommended Actions</h3>
        <div className="grid gap-4">
          {recommendations.map(rec => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onAccept={() => handleAcceptRecommendation(rec)}
              onDismiss={() => handleDismissRecommendation(rec)}
            />
          ))}
        </div>
      </div>
    )}

    {/* NEW: Pattern Detection */}
    {patterns.length > 0 && (
      <div className="mt-6 border-t pt-6">
        <h3>Detected Patterns</h3>
        <PatternsList patterns={patterns} />
      </div>
    )}
  </CardContent>
</Card>
```

#### Step 3.5.5: Create Supporting Components

**File:** `components/analytics/RootCauseTimeline.tsx`
- Visual timeline of events leading to degradation
- Vertical timeline with icons
- Expandable event details

**File:** `components/analytics/RecommendationCard.tsx`
- Recommendation title and description
- Priority badge
- Impact estimate
- Implementation steps (collapsible)
- Accept/Dismiss buttons
- Effort estimate

**File:** `components/analytics/ContributingFactorsList.tsx`
- List of factors with confidence percentages
- Evidence badges
- Correlation strength indicators

### Verification Steps for Task 3.5

1. **Service Testing:**
   - Test root cause analysis with known degradations
   - Verify correlations are calculated correctly
   - Test recommendation generation
   - Validate hypothesis ranking

2. **Algorithm Validation:**
   - Compare AI analysis with manual analysis
   - Verify lead-lag detection accuracy
   - Test with various degradation scenarios
   - Validate confidence scores

3. **UI Testing:**
   - Verify all new sections render correctly
   - Test interaction with recommendations
   - Verify timeline visualization
   - Test refresh functionality

4. **Integration Testing:**
   - Verify integration with existing InsightsPanel
   - Test with anomaly detection service
   - Verify with sentiment analysis
   - Test with cohort data

---

## Cross-Phase Requirements

### Code Quality Standards

**All Tasks Must Adhere To:**
- ✅ Max 30 lines per function or complete logical blocks
- ✅ No unicode characters in code
- ✅ No stub/TODO/mock implementations in logic
- ✅ Debug logging with component-specific prefixes
- ✅ Comprehensive error handling with try-catch
- ✅ TypeScript strict mode compliance
- ✅ Proper type exports for reusability

### Debug Logging Pattern

**Prefixes by Service:**
- `[CohortService]` - Cohort backend operations
- `[CohortCriteriaEvaluator]` - Criteria evaluation
- `[SentimentAnalysis]` - Sentiment analysis operations
- `[AIInsights]` - AI insights and recommendations
- `[CohortAnalysisView]` - Cohort UI component
- `[SentimentDashboard]` - Sentiment UI components

**Log Points:**
- Function entry with key parameters
- API calls (before/after)
- Database queries (before/after)
- Error conditions with context
- Performance metrics for expensive operations
- State changes in React components

### Authentication & Authorization

**All API endpoints require:**
- Bearer token authentication
- User ID extraction from Supabase auth
- RLS policy enforcement
- Authorization checks for data modification

### Testing Requirements

**Unit Tests:**
- All service functions
- Criteria evaluation logic
- Sentiment analysis algorithms
- Recommendation generation

**Integration Tests:**
- API endpoint flows
- Database operations with RLS
- Component data fetching
- End-to-end user flows

**Performance Tests:**
- Cohort criteria evaluation with 1000+ users
- Sentiment batch processing
- Dashboard loading with large datasets
- Recommendation generation speed

---

## Risk Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Cohort criteria evaluation too slow | High | Medium | Implement caching, indexes, and query optimization |
| Sentiment analysis inaccurate | Medium | High | Start with simple algorithm, add manual feedback loop |
| AI insights not actionable | Medium | Medium | Provide specific, testable recommendations |
| User privacy concerns with cohorts | High | Low | Anonymize data, clear privacy policy, user consent |
| Complex UI overwhelming users | Medium | Medium | Progressive disclosure, onboarding, contextual help |
| Database query performance | High | Medium | Proper indexes, pagination, caching layer |

---

## Success Metrics

**Task 3.1 & 3.2 (Cohorts):**
- Cohort creation success rate > 95%
- Cohort comparison used by product team in 3+ decisions
- Dynamic cohort refresh time < 5 seconds
- Criteria evaluation accuracy > 90%

**Task 3.3 & 3.4 (Sentiment):**
- Sentiment analysis accuracy > 70% (vs manual assessment)
- Sentiment-rating correlation > 0.6
- Frustration detection recall > 80%
- Dashboard load time < 2 seconds

**Task 3.5 (AI Insights):**
- Root cause analysis identifies correct cause in > 60% of cases
- Recommendations actionable in > 80% of cases
- User acceptance rate of recommendations > 40%
- Average time to insight < 1 minute

---

## Timeline

**Day 1-1.5:** Task 3.1 (User Cohort Backend)
- Create cohort service and evaluator
- Implement API routes
- Test with sample cohorts

**Day 2-3:** Task 3.2 (Cohort Analysis UI)
- Build all components
- Integrate into dashboard
- End-to-end testing

**Day 3.5-4.5:** Task 3.3 (Advanced Sentiment Analysis)
- Implement sentiment service
- Create database schema
- Build API routes
- Test accuracy

**Day 5-6:** Task 3.4 (Sentiment Dashboard)
- Create visualization components
- Integrate into dashboard
- Polish UI/UX

**Day 6.5-7:** Task 3.5 (Enhanced AI Insights)
- Implement AI insights service
- Enhance InsightsPanel
- Create supporting components
- Final testing

---

## Next Steps After Phase 3

**Phase 4: Performance, Security & Scale**
- Performance optimization
- Data retention policies
- Security audit
- RBAC for experiments
- Load testing
- Documentation

**Future Enhancements:**
- Real-time alerts for sentiment drops
- Predictive cohort growth modeling
- Automated experiment creation based on insights
- Multi-language sentiment support
- Advanced ML models for sentiment
- Custom insight rules engine

---

## File Structure

```
web-ui/
├── supabase/migrations/
│   └── 20251025000005_create_sentiment_analysis.sql (NEW)
│
├── lib/services/
│   ├── cohort.service.ts (NEW)
│   ├── cohort-criteria-evaluator.ts (NEW)
│   ├── cohort-snapshot-scheduler.ts (NEW)
│   ├── sentiment-analysis.service.ts (NEW)
│   └── ai-insights.service.ts (NEW)
│
├── lib/hooks/
│   └── useSentimentAnalysis.ts (NEW)
│
├── app/api/analytics/
│   ├── cohorts/
│   │   ├── route.ts (NEW)
│   │   └── [id]/
│   │       ├── members/route.ts (NEW)
│   │       └── metrics/route.ts (NEW)
│   └── sentiment/
│       └── route.ts (NEW)
│
├── app/analytics/
│   └── cohorts/
│       ├── page.tsx (NEW)
│       └── [id]/page.tsx (NEW)
│
└── components/analytics/
    ├── CohortAnalysisView.tsx (NEW)
    ├── CohortCard.tsx (NEW)
    ├── CohortComparisonChart.tsx (NEW)
    ├── CohortCriteriaBuilder.tsx (NEW)
    ├── CohortTrendChart.tsx (NEW)
    ├── SentimentOverview.tsx (NEW)
    ├── SentimentTrendChart.tsx (NEW)
    ├── SentimentCorrelationMatrix.tsx (NEW)
    ├── EmotionRadarChart.tsx (NEW)
    ├── FrustrationIncidentsList.tsx (NEW)
    ├── RootCauseTimeline.tsx (NEW)
    ├── RecommendationCard.tsx (NEW)
    ├── ContributingFactorsList.tsx (NEW)
    ├── InsightsPanel.tsx (ENHANCED)
    └── index.ts (UPDATED)
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-25
**Status:** Ready for Implementation
**Estimated Total LOC:** ~3,000-4,000 lines
