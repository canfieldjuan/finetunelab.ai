# Analytics System Discovery Document
**Date**: November 28, 2025
**Purpose**: Complete system analysis of analytics infrastructure
**Status**: Discovery Complete - Ready for Iron Out Phase

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Data Flow](#data-flow)
5. [UI Components](#ui-components)
6. [API Endpoints](#api-endpoints)
7. [Current Issues & Gaps](#current-issues--gaps)
8. [Recommendations](#recommendations)

---

## Executive Summary

### What Analytics Does
The analytics system provides comprehensive insights into:
- **Model Performance**: Track quality, success rate, error rate, response time, cost per message
- **Training Effectiveness**: Compare base vs SFT/DPO/RLHF models
- **Session-Based A/B Testing**: Experiment tracking with conversation grouping
- **Quality Metrics**: Rating distribution, success/failure rates, failure tags (judgments)
- **Token & Cost Tracking**: Input/output tokens, cost estimation with configurable pricing
- **Performance SLA**: Latency percentiles (p50, p90, p95, p99), breach rate tracking
- **Sentiment Analysis**: Conversation sentiment over time
- **Benchmark Analysis**: Evaluation framework performance tracking
- **Anomaly Detection**: Proactive quality degradation alerts
- **Cohort Analysis**: User segmentation and behavior patterns
- **Export Capabilities**: CSV, JSON, Report formats with caching

### Key Statistics
- **45 UI Components**: Dashboard, charts, tables, filters, modals
- **10 API Endpoints**: Data aggregation, traces, exports, benchmarks, anomalies
- **6 Core Database Tables**: messages, conversations, message_evaluations, llm_models, (traces, analytics_exports)
- **100% Client-Side Filtering**: Instant filter updates via React useMemo
- **Lazy Loading**: Performance optimization with code splitting
- **Real-time Updates**: Auto-refresh capabilities for monitoring

---

## System Architecture

### High-Level Architecture
```
┌─────────────────┐
│   User Actions  │ (Chat, Rate, Train, Deploy)
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────┐
│         Database (Supabase)             │
│  ┌─────────────────────────────────┐   │
│  │ messages                         │   │
│  │ - input_tokens, output_tokens    │   │
│  │ - latency_ms, error_type         │   │
│  │ - model_id, provider             │   │
│  │ - conversation_id                │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ message_evaluations              │   │
│  │ - rating, success, failure_tags  │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ conversations                    │   │
│  │ - session_id, experiment_name    │   │
│  │ - is_widget_session              │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ llm_models                       │   │
│  │ - training_method, base_model    │   │
│  │ - metadata (deployment info)     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│     useAnalytics Hook (Client)          │
│  - Fetches raw data on mount/timeRange  │
│  - Applies filters via useMemo          │
│  - Instant client-side updates          │
└─────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│   AnalyticsDashboard Component          │
│  - 6 collapsible sections               │
│  - Lazy-loaded chart components         │
│  - Filters & Settings UI                │
│  - LocalStorage persistence             │
└─────────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────────┐
│        45 Chart/Table Components        │
│  - MetricsOverview, ModelPerformance    │
│  - SentimentTrend, BenchmarkAnalysis    │
│  - CostTracking, AnomalyFeed            │
└─────────────────────────────────────────┘
```

### File Organization
```
/home/juan-canfield/Desktop/web-ui/
├── app/
│   ├── analytics/
│   │   ├── page.tsx                    # Main analytics page (auth wrapper)
│   │   ├── chat/page.tsx               # Analytics assistant
│   │   └── sentiment/page.tsx          # Sentiment dashboard
│   └── api/analytics/
│       ├── data/route.ts               # Main data aggregation API
│       ├── traces/route.ts             # Execution traces
│       ├── export/route.ts             # Export generation
│       ├── download/[id]/route.ts      # Export download
│       ├── benchmark-analysis/route.ts # Benchmark metrics
│       ├── anomalies/route.ts          # Anomaly detection
│       ├── experiments/route.ts        # A/B testing
│       ├── sentiment/insights/route.ts # Sentiment analysis
│       ├── judgment-examples/route.ts  # Failure tag examples
│       └── model-comparison/route.ts   # Model comparison
├── components/analytics/
│   ├── AnalyticsDashboard.tsx          # Main dashboard (920 lines)
│   ├── MetricsOverview.tsx             # KPI cards
│   ├── ModelPerformanceTable.tsx       # Per-model breakdown
│   ├── SessionComparisonTable.tsx      # A/B test results
│   ├── TrainingEffectivenessChart.tsx  # SFT/DPO/RLHF comparison
│   ├── BenchmarkAnalysisChart.tsx      # Benchmark evaluations
│   ├── SentimentTrendChart.tsx         # Sentiment over time
│   ├── CostTrackingChart.tsx           # Token cost tracking
│   ├── AnomalyFeed.tsx                 # Real-time anomaly alerts
│   ├── FilterPanel.tsx                 # Client-side filters
│   ├── ExportModal.tsx                 # Export UI
│   └── ... (35 more components)
├── hooks/
│   └── useAnalytics.ts                 # Main analytics hook (1235 lines)
├── lib/analytics/
│   ├── dataAggregator.ts               # Server-side aggregation
│   └── types.ts                        # Type definitions
└── lib/tools/evaluation-metrics/
    └── metrics.service.ts              # Evaluation framework
```

---

## Database Schema

### Core Tables

#### 1. `messages`
**Purpose**: Stores all chat messages with performance metrics
**Location**: `/hooks/useAnalytics.ts:243-248`

**Key Fields**:
```typescript
{
  id: string                    // Message UUID
  user_id: string               // Owner
  conversation_id: string       // Parent conversation
  role: 'user' | 'assistant'    // Message type
  content: string               // Message text
  created_at: timestamp         // Message timestamp

  // Analytics fields:
  model_id: string              // Model used (joins to llm_models)
  provider: string              // Provider (openai, anthropic, runpod)
  input_tokens: number          // Prompt tokens
  output_tokens: number         // Completion tokens
  latency_ms: number            // Response time
  tools_called: json            // Tool usage array
  tool_success: boolean         // Tool execution status
  error_type: string            // Error category
  metadata: json                // Additional data
}
```

**Used For**:
- Token usage aggregation (`/hooks/useAnalytics.ts:690-705`)
- Cost calculation (`/hooks/useAnalytics.ts:707-742`)
- Response time trends (`/hooks/useAnalytics.ts:785-853`)
- Model performance (`/hooks/useAnalytics.ts:856-961`)
- Training effectiveness (`/hooks/useAnalytics.ts:1081-1234`)

#### 2. `message_evaluations`
**Purpose**: User ratings and quality judgments
**Location**: `/hooks/useAnalytics.ts:258-262`

**Key Fields**:
```typescript
{
  id: string
  message_id: string            // FK to messages
  evaluator_id: string          // User who rated
  created_at: timestamp

  // Quality metrics:
  rating: number                // 1-5 star rating
  success: boolean              // Pass/fail judgment
  failure_tags: string[]        // Categorized failure reasons
}
```

**Used For**:
- Rating distribution (`/hooks/useAnalytics.ts:560-563`)
- Success rate calculation (`/hooks/useAnalytics.ts:549-550`)
- Failure tags breakdown (`/hooks/useAnalytics.ts:665-687`)
- Quality trends

#### 3. `conversations`
**Purpose**: Groups messages, tracks experiments
**Location**: `/hooks/useAnalytics.ts:267-271`

**Key Fields**:
```typescript
{
  id: string
  user_id: string
  created_at: timestamp

  // Experiment tracking:
  session_id: string            // A/B test session grouping
  experiment_name: string       // Human-readable experiment label
  is_widget_session: boolean    // Widget vs normal chat
}
```

**Used For**:
- Session-based A/B testing (`/hooks/useAnalytics.ts:964-1078`)
- Conversation length distribution (`/hooks/useAnalytics.ts:744-772`)
- Experiment comparison

#### 4. `llm_models`
**Purpose**: Model registry with training metadata
**Location**: `/hooks/useAnalytics.ts:281-284`

**Key Fields**:
```typescript
{
  id: string
  user_id: string
  model_id: string              // Unique model identifier
  name: string                  // Display name
  provider: string              // runpod, openai, anthropic

  // Training metadata:
  training_method: string       // base, sft, dpo, rlhf
  base_model: string            // Parent model
  training_dataset: json        // Dataset used
  evaluation_metrics: json      // Training results

  // Deployment metadata:
  metadata: {
    training_job_id: string
    runpod_endpoint_id: string
    deployment_type: string
    deployed_at: timestamp
  }
}
```

**Used For**:
- Model performance table
- Training effectiveness comparison
- Cost calculation (future pricing lookup)

#### 5. Analytics Support Tables (Inferred)
**Note**: These tables are referenced but schema not directly observed

- `analytics_traces`: Execution traces for debugging
- `analytics_exports`: Export history and download tracking
- `analytics_cohorts`: User segmentation definitions
- `analytics_anomalies`: Quality degradation alerts

---

## Data Flow

### 1. Data Collection (Real-time)
```
User Action → Database Insert
├── Chat message sent
│   └── Insert into `messages` (latency_ms, tokens, model_id)
├── User rates response
│   └── Insert into `message_evaluations` (rating, success, failure_tags)
└── Model deployed
    └── Update `llm_models.metadata` (endpoint_id, deployed_at)
```

**Collection Points**:
- `/lib/inference/chat-service.ts`: Captures latency, tokens on every chat completion
- `/components/chat/MessageActions.tsx`: Star rating → message_evaluations
- `/app/api/training/deploy/route.ts:580-624`: Auto-registers deployed models

### 2. Data Fetching (On-Demand)
```
User Opens /analytics → useAnalytics Hook
├── Fetch messages (user_id, timeRange filter)
│   Location: /hooks/useAnalytics.ts:243
├── Fetch message_evaluations (evaluator_id, timeRange filter)
│   Location: /hooks/useAnalytics.ts:258
├── Fetch conversations (user_id, timeRange filter)
│   Location: /hooks/useAnalytics.ts:267
└── Fetch llm_models (user_id, no time filter)
    Location: /hooks/useAnalytics.ts:281

Result: Raw data stored in React state
```

### 3. Client-Side Processing (Instant Updates)
```
useMemo(() => processAnalyticsData(...), [rawData, filters, settings])
├── Apply filters (models, sessions, ratings, success/failure)
│   Location: /hooks/useAnalytics.ts:369-513
├── Calculate overview metrics
│   Location: /hooks/useAnalytics.ts:534-550
├── Aggregate by model
│   Location: /hooks/useAnalytics.ts:856-961
├── Aggregate by session
│   Location: /hooks/useAnalytics.ts:964-1078
├── Aggregate by training method
│   Location: /hooks/useAnalytics.ts:1081-1234
└── Build chart data (tokens, costs, latency, errors)
    Location: /hooks/useAnalytics.ts:572-853

Result: Processed AnalyticsData object → Dashboard
```

**Performance Optimization**:
- ✅ Single database fetch per timeRange change
- ✅ All filters applied client-side (instant updates)
- ✅ Lazy-loaded chart components (code splitting)
- ✅ LocalStorage persistence for filters/settings

### 4. Export Flow
```
User Clicks Export → ExportModal
├── Select format (CSV, JSON, Report)
├── Select type (Overview, Timeseries, Complete, Model Comparison)
├── POST /api/analytics/export
│   └── Generate file, store in analytics_exports
├── Return download URL
└── Redirect to /api/analytics/download/[id]
```

**Location**: `/components/analytics/ExportModal.tsx`, `/app/api/analytics/export/route.ts`

---

## UI Components

### Dashboard Structure (`/components/analytics/AnalyticsDashboard.tsx`)

**Header Section** (Lines 371-431):
- Back to Chat button
- Analytics Assistant link (`/analytics/chat`)
- Sentiment Dashboard link (`/analytics/sentiment`)
- Export Data button
- Time Range selector (7d, 30d, 90d, all)

**Filters Section** (Lines 434-457) - Collapsible:
- Rating filter (1-5 stars, multi-select)
- Model filter (dropdown from available models)
- Success filter (all, success only, failure only)
- Training method filter (base, sft, dpo, rlhf)
- Session filter (A/B test sessions)
- Widget session filter (widget, normal, all)

**Settings Section** (Lines 460-684) - Collapsible:
- SLA Threshold (ms) - for breach rate calculation
- Default Pricing (input/output per 1K tokens)
- Provider Override (openai, anthropic custom pricing)
- Model Override (exact model_id pricing)
- Reset buttons

**Section 1: Model & Training Performance** (Lines 700-748) - Collapsible:
```typescript
Components:
- ModelPerformanceTable         // Sortable table with model metrics
- SessionComparisonTable        // A/B test results
- TrainingEffectivenessChart    // Base vs SFT/DPO/RLHF comparison
- BenchmarkAnalysisChart        // Evaluation framework results
```

**Section 2: Quality & Evaluation Metrics** (Lines 750-791) - Collapsible:
```typescript
Components:
- RatingDistribution            // 1-5 star bar chart
- SuccessRateChart              // Success vs failure pie chart
- JudgmentsBreakdown            // Failure tags breakdown
- JudgmentsTable                // Detailed failure examples
- SentimentAnalyzer             // Sentiment score gauge
- SentimentTrendChart           // Sentiment over time
```

**Section 3: Performance & SLA Metrics** (Lines 793-820) - Collapsible:
```typescript
Components:
- ConversationLengthChart       // Message count distribution
- ResponseTimeChart             // Latency over time
- SLABreachChart                // Breach rate percentage
```

**Section 4: Cost & Resource Analysis** (Lines 822-842) - Collapsible:
```typescript
Components:
- TokenUsageChart               // Input vs output tokens
- CostTrackingChart             // Daily cost trends
```

**Section 5: Operations & Monitoring** (Lines 844-891) - Collapsible:
```typescript
Components:
- AnomalyFeed                   // Real-time quality degradation alerts
- QualityForecastChart          // Predictive quality modeling
- ToolPerformanceChart          // Tool success/failure rates
- ErrorBreakdownChart           // Error type distribution
- InsightsPanel                 // AI-generated insights
- ProviderTelemetryPanel        // Provider health monitoring
- ResearchJobsPanel             // Background job status
```

**Section 6: Workspace Activity** (Lines 893-901) - Collapsible:
```typescript
Components:
- ActivityFeed                  // Recent workspace actions
```

### Key Component Features

**Lazy Loading** (`/components/analytics/AnalyticsDashboard.tsx:17-40`):
```typescript
const MetricsOverview = lazy(() => import('./MetricsOverview'));
const RatingDistribution = lazy(() => import('./RatingDistribution'));
// ... 20+ more lazy imports

// Loading fallback:
<Suspense fallback={<ChartLoader />}>
  <MetricsOverview {...props} />
</Suspense>
```

**Collapsible Sections** (`/components/analytics/AnalyticsDashboard.tsx:70-107`):
- Click-to-expand/collapse
- State persisted in component (not localStorage yet)
- Reduces initial DOM size

**Filter Persistence** (`/components/analytics/AnalyticsDashboard.tsx:250-277`):
```typescript
// Load from localStorage on mount
useEffect(() => {
  const saved = localStorage.getItem(`analytics:filters:${user.id}`);
  if (saved) setFilters(JSON.parse(saved));
}, [user?.id]);

// Save on change
useEffect(() => {
  localStorage.setItem(`analytics:filters:${user.id}`, JSON.stringify(filters));
}, [filters, user?.id]);
```

---

## API Endpoints

### 1. `/api/analytics/data` - Main Data API
**Location**: `/app/api/analytics/data/route.ts`
**Method**: GET
**Purpose**: Aggregate analytics data for dashboards

**Query Parameters**:
```typescript
{
  startDate: string    // ISO 8601 timestamp
  endDate: string      // ISO 8601 timestamp
  period: 'hour' | 'day' | 'week' | 'month' | 'all'
  metrics: string      // Comma-separated: 'tokens,quality,latency,errors,tools,conversations'
  granularity: string  // Aggregation level
}
```

**Response**:
```typescript
{
  success: true,
  data: AnalyticsDataset {
    userId: string,
    timeRange: DateRange,
    metrics: {
      tokenUsage: TokenUsageDataPoint[],
      quality: QualityDataPoint[],
      tools: ToolUsageDataPoint[],
      conversations: ConversationDataPoint[],
      errors: ErrorDataPoint[],
      latency: LatencyDataPoint[]
    },
    aggregations: AggregatedMetrics
  }
}
```

**Features**:
- Authentication required (Bearer token)
- Max date range: 90 days (configurable via `ANALYTICS_MAX_DATE_RANGE_DAYS`)
- Cache-Control: 5 minutes (configurable via `ANALYTICS_CACHE_MAX_AGE`)
- Metric filtering (request only what you need)

### 2. `/api/analytics/traces` - Execution Traces
**Location**: `/app/api/analytics/traces/route.ts`
**Methods**: GET, POST
**Purpose**: Debug LLM operations with hierarchical traces

**GET Parameters**:
```typescript
{
  conversation_id?: string,
  limit: number = 100,
  start_date?: string
}
```

**POST Body** (Capture trace):
```typescript
{
  trace_id: string,
  span_name: string,
  duration_ms: number,
  model_name?: string,
  operation_type: string,
  parent_trace_id?: string,
  metadata?: object
}
```

### 3. `/api/analytics/export` - Export Generation
**Location**: `/app/api/analytics/export/route.ts`
**Method**: POST
**Purpose**: Generate CSV/JSON/Report exports

**Request Body**:
```typescript
{
  format: 'csv' | 'json' | 'report',
  exportType: 'overview' | 'timeseries' | 'complete' | 'model_comparison',
  startDate: string,
  endDate: string,
  includedMetrics?: string[]
}
```

**Response**:
```typescript
{
  success: true,
  exportId: string,
  downloadUrl: string,
  fileName: string,
  fileSize: number,
  expiresAt: string
}
```

### 4. `/api/analytics/benchmark-analysis` - Benchmark Metrics
**Location**: `/app/api/analytics/benchmark-analysis/route.ts`
**Method**: GET
**Purpose**: Evaluate model performance against benchmarks

**Parameters**:
```typescript
{
  startDate?: string,
  endDate?: string,
  period?: 'all'
}
```

**Response**:
```typescript
{
  data: BenchmarkAnalysis {
    benchmarksAnalyzed: number,
    totalJudgments: number,
    overallAccuracy: number,
    judgmentBreakdown: { passed: number, failed: number },
    // ... detailed analysis
  }
}
```

### 5. `/api/analytics/anomalies` - Anomaly Detection
**Location**: `/app/api/analytics/anomalies/route.ts`
**Method**: GET
**Purpose**: Detect quality degradation in real-time

**Features**:
- Statistical anomaly detection
- Configurable sensitivity
- Real-time alerts

### 6. Other Endpoints
- `/api/analytics/sentiment/insights`: Sentiment analysis
- `/api/analytics/experiments`: A/B test management
- `/api/analytics/judgment-examples`: Failure tag examples
- `/api/analytics/model-comparison`: Side-by-side model comparison
- `/api/analytics/download/[id]`: Export file download

---

## Current Issues & Gaps

### 🔴 Critical Issues

**1. No Database Schema Migrations Found**
- **Issue**: Cannot find CREATE TABLE statements for core analytics tables
- **Impact**: Unclear if messages/conversations tables have required analytics fields
- **Evidence**: Search for "CREATE TABLE.*messages" returned no results
- **Location**: Expected in `/supabase/migrations/*.sql`
- **Action Required**: Verify schema or create migration scripts

**2. Missing Trace Storage Implementation**
- **Issue**: `/api/analytics/traces` POST handler exists but no confirmed table
- **Impact**: Traces API may not persist data
- **Evidence**: No `analytics_traces` table found in migrations
- **Action Required**: Confirm trace persistence or implement storage

### 🟡 Medium Priority Issues

**3. Hardcoded Pricing Data**
- **Issue**: Token pricing hardcoded in multiple files
- **Locations**:
  - `/hooks/useAnalytics.ts:895-899` - Model aggregation (GPT-4 pricing)
  - `/hooks/useAnalytics.ts:1024-1026` - Session aggregation (same pricing)
  - `/hooks/useAnalytics.ts:1143-1145` - Training aggregation (same pricing)
  - `/lib/analytics/dataAggregator.ts:133-141` - Token cost calculation
- **Impact**: Inaccurate cost estimates for non-GPT-4 models
- **Fix**: Dashboard has configurable pricing (`settings.priceBook`), but aggregation functions don't use it
- **Action Required**: Pass `priceBook` to aggregation functions

**4. Filter State Not Fully Persisted**
- **Issue**: Section collapse states (modelTrainingCollapsed, qualityCollapsed, etc.) not saved to localStorage
- **Impact**: User must re-collapse sections on every page load
- **Location**: `/components/analytics/AnalyticsDashboard.tsx:141-146`
- **Action Required**: Add collapse state to localStorage persistence

**5. Incomplete Export Implementation**
- **Issue**: ExportModal shows but export API implementation unclear
- **Evidence**: `/app/api/analytics/export/route.ts` exists but internal logic not verified
- **Impact**: May generate incomplete or incorrectly formatted exports
- **Action Required**: Test export functionality end-to-end

**6. Sentiment Analysis Integration Gaps**
- **Issue**: SentimentTrendChart and SentimentAnalyzer use separate data sources
- **Location**:
  - `/components/analytics/SentimentTrendChart.tsx`
  - `/components/analytics/SentimentAnalyzer.tsx`
- **Impact**: Sentiment data may not be stored in main analytics tables
- **Action Required**: Verify sentiment data storage and consistency

### 🟢 Minor Issues / Tech Debt

**7. TODO Comments in Production Code**
- **Locations**:
  - `/components/analytics/ExperimentManager.tsx:351` - "Implement edit modal"
  - `/components/analytics/ExperimentManager.tsx:360` - "Implement delete functionality"
  - `/components/analytics/ExperimentManager.tsx:508` - "Create experiment modal"
  - `/components/analytics/CohortAnalysisView.tsx:179,191` - "Implement create cohort modal"
- **Impact**: Missing UI features for experiment/cohort management
- **Action Required**: Implement modals or remove buttons

**8. Inconsistent Error Handling**
- **Issue**: Some aggregation functions throw errors, others return empty arrays
- **Evidence**: `/lib/analytics/dataAggregator.ts` error handling varies
- **Impact**: May cause dashboard to break on partial data failures
- **Action Required**: Standardize error handling (fail gracefully vs throw)

**9. Performance Concerns**
- **Issue**: Large date ranges (`all`) may fetch thousands of messages
- **Impact**: Slow initial load, high client-side memory usage
- **Current Mitigation**: Lazy loading, client-side caching
- **Potential Issue**: No pagination on database queries
- **Action Required**: Add query limits or server-side aggregation for large datasets

**10. No Real-time Updates**
- **Issue**: Dashboard requires manual refresh to see new data
- **Impact**: Analytics lag behind actual usage
- **Potential Solution**: WebSocket subscriptions or polling
- **Action Required**: Design real-time update strategy if needed

### 🔵 Missing Features (Not Issues, But Gaps)

**11. No User-Level Analytics**
- **Gap**: All analytics are per current user, no admin/team view
- **Impact**: Cannot compare users or see org-wide metrics
- **Action Required**: Define multi-user analytics requirements

**12. No Alerting/Notifications**
- **Gap**: AnomalyFeed exists but no email/Slack notifications
- **Impact**: Users must actively monitor dashboard
- **Action Required**: Implement alert delivery system

**13. No Historical Comparison**
- **Gap**: Cannot compare "this month vs last month" easily
- **Impact**: Difficult to track improvement over time
- **Action Required**: Add period-over-period comparison UI

**14. No Custom Dashboards**
- **Gap**: Single fixed dashboard layout for all users
- **Impact**: Power users cannot customize views
- **Action Required**: Consider dashboard customization feature

---

## Recommendations

### Phase 1: Immediate Fixes (High Priority)
**Timeline**: 1-2 days

1. **Verify Database Schema**
   - [ ] Confirm messages table has analytics fields (latency_ms, input_tokens, etc.)
   - [ ] Confirm message_evaluations table exists with rating, success, failure_tags
   - [ ] Document actual schema or create migration scripts
   - [ ] Location: `/supabase/migrations/`

2. **Fix Hardcoded Pricing**
   - [ ] Update aggregation functions to accept priceBook parameter
   - [ ] Pass settings.priceBook from dashboard to useAnalytics hook
   - [ ] Update calculateCostTracking to use dynamic pricing
   - [ ] Locations:
     - `/hooks/useAnalytics.ts:707-742` (calculateCostTracking)
     - `/hooks/useAnalytics.ts:895-899` (aggregateByModel)
     - `/hooks/useAnalytics.ts:1024-1026` (aggregateBySession)
     - `/hooks/useAnalytics.ts:1143-1145` (aggregateTrainingEffectiveness)

3. **Complete Missing Modal Implementations**
   - [ ] Implement experiment edit modal
   - [ ] Implement experiment delete functionality
   - [ ] Implement create experiment modal
   - [ ] Implement create cohort modal
   - [ ] Or: Hide buttons if features not planned

### Phase 2: Quality Improvements (Medium Priority)
**Timeline**: 3-5 days

4. **Improve Filter Persistence**
   - [ ] Save section collapse states to localStorage
   - [ ] Add "Reset to defaults" button
   - [ ] Consider server-side user preferences

5. **Test & Fix Export Functionality**
   - [ ] Test CSV export with various data sizes
   - [ ] Test JSON export format
   - [ ] Test Report generation
   - [ ] Verify download expiration works
   - [ ] Location: `/app/api/analytics/export/route.ts`

6. **Standardize Error Handling**
   - [ ] Decide: throw errors or return empty arrays?
   - [ ] Add error boundaries to chart components
   - [ ] Show user-friendly error messages
   - [ ] Log errors for debugging

7. **Verify Trace Storage**
   - [ ] Test POST /api/analytics/traces endpoint
   - [ ] Confirm data persists to database
   - [ ] Create analytics_traces table if missing
   - [ ] Implement trace retention policy

### Phase 3: Performance & Scale (Low Priority)
**Timeline**: 1 week

8. **Optimize Large Data Handling**
   - [ ] Add pagination to database queries
   - [ ] Implement server-side aggregation for "all" time range
   - [ ] Add loading states for slow queries
   - [ ] Consider data sampling for very large datasets

9. **Add Real-time Capabilities** (Optional)
   - [ ] Design real-time update strategy
   - [ ] Implement WebSocket subscriptions or polling
   - [ ] Add auto-refresh toggle to dashboard
   - [ ] Test performance impact

### Phase 4: Feature Enhancements (Future)
**Timeline**: 2+ weeks

10. **Period-over-Period Comparison**
    - [ ] Design comparison UI (side-by-side, overlay charts)
    - [ ] Add comparison period selector
    - [ ] Implement trend indicators (↑ ↓ →)

11. **Alerting System**
    - [ ] Define alert rules (SLA breach, error spike, cost limit)
    - [ ] Implement email/Slack delivery
    - [ ] Add alert history UI
    - [ ] Allow user alert configuration

12. **Multi-User Analytics** (Enterprise Feature)
    - [ ] Define org-level analytics requirements
    - [ ] Add team/workspace grouping
    - [ ] Implement RLS policies for shared analytics
    - [ ] Add user comparison views

13. **Custom Dashboards** (Power User Feature)
    - [ ] Design drag-and-drop dashboard builder
    - [ ] Allow widget selection and arrangement
    - [ ] Save custom dashboard layouts
    - [ ] Share dashboard templates

---

## Testing Recommendations

### Unit Tests
- [ ] Test aggregation functions with various data shapes
- [ ] Test filter logic with edge cases (empty arrays, null values)
- [ ] Test cost calculation with different pricing configurations
- [ ] Test percentile calculation accuracy

### Integration Tests
- [ ] Test full data flow: message insert → analytics display
- [ ] Test export generation and download
- [ ] Test trace capture and retrieval
- [ ] Test anomaly detection triggers

### Performance Tests
- [ ] Load test with 10K+ messages
- [ ] Measure client-side filter performance
- [ ] Test dashboard render time with all sections expanded
- [ ] Profile memory usage with large datasets

### User Acceptance Tests
- [ ] Verify all charts display correct data
- [ ] Test filter combinations (models + ratings + sessions)
- [ ] Verify export files contain expected data
- [ ] Test dashboard on mobile/tablet (responsive design)

---

## Key Metrics to Validate

To ensure analytics accuracy, validate these calculations manually:

1. **Token Costs**
   - Pull 10 random messages from database
   - Manually calculate cost with known pricing
   - Compare to dashboard display
   - **Expected Formula**: `(input_tokens / 1000 * input_price) + (output_tokens / 1000 * output_price)`

2. **Success Rate**
   - Count message_evaluations where success = true
   - Divide by total evaluations
   - Compare to dashboard "Success Rate" metric
   - **Expected Formula**: `(successCount / totalEvaluations) * 100`

3. **SLA Breach Rate**
   - Count messages where latency_ms > slaThresholdMs
   - Divide by total messages with latency
   - Compare to SLABreachChart
   - **Expected Formula**: `(breaches / messagesWithLatency) * 100`

4. **Model Performance**
   - Filter messages by model_id
   - Calculate average rating from joined evaluations
   - Compare to ModelPerformanceTable row
   - **Expected Formula**: `sum(ratings) / count(evaluations)`

---

## Glossary

- **Cohort**: User segment defined by criteria (e.g., "users with >10 conversations")
- **Failure Tags**: Categorized failure reasons (e.g., "hallucination", "incorrect_format")
- **Judgment**: Manual evaluation of message quality (success/failure + tags)
- **SLA**: Service Level Agreement - latency threshold for performance monitoring
- **Session**: Group of conversations for A/B testing (same experiment_name)
- **Trace**: Hierarchical execution log for debugging (spans, durations, parent-child)
- **Widget Session**: Embedded chat widget conversation vs normal UI chat

---

## Next Steps

1. **Review this document** with team/stakeholders
2. **Prioritize issues** based on user impact and effort
3. **Verify database schema** as first step (critical)
4. **Fix hardcoded pricing** to improve cost accuracy
5. **Test export functionality** to ensure it works
6. **Plan Phase 1 fixes** and assign ownership
7. **Create GitHub issues** for each recommendation

---

## Document Metadata
- **Author**: Claude (Analytics Discovery Agent)
- **Created**: November 28, 2025
- **File Count Analyzed**: 100+ files
- **Lines of Code Reviewed**: ~5000+ lines
- **Component Count**: 45 UI components
- **API Endpoint Count**: 10 REST endpoints
- **Discovery Method**: Static code analysis, pattern matching, architecture inference
