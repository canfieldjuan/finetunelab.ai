# Analytics Dashboard Collapsible Sections Implementation Plan

**Feature:** Hybrid Collapsible Sections + Pinned Overview  
**Status:** Planning Phase  
**Date Created:** November 11, 2025  
**Estimated Complexity:** Medium  
**Breaking Changes Risk:** LOW (Pure UI enhancement, no data/API changes)

---

## 🎯 Objective

Transform the Analytics Dashboard from a single long scrolling list into an organized, collapsible section-based layout that:
1. Keeps critical metrics always visible (pinned overview)
2. Groups related charts into logical collapsible sections
3. Matches the UX pattern established on Training/Models pages
4. Maintains all existing functionality without breaking changes

---

## 📊 Current State Analysis

### Current Structure (AnalyticsDashboard.tsx - 811 lines)
**Location:** `/components/analytics/AnalyticsDashboard.tsx`

**Always Visible Components:**
- Filters (Time Range, Date Range, Models, Sessions) - collapsible
- Settings (SLA, Pricing) - collapsible
- MetricsOverview (6 stat cards) - always visible

**Chart Components (17 sections, ~20 components):**
1. ModelPerformanceTable
2. SessionComparisonTable
3. TrainingEffectivenessChart
4. BenchmarkAnalysisChart
5. AnomalyFeed + QualityForecastChart (grid)
6. RatingDistribution + SuccessRateChart (grid)
7. JudgmentsBreakdown + JudgmentsTable
8. ToolPerformanceChart + ErrorBreakdownChart (grid)
9. TokenUsageChart
10. CostTrackingChart
11. ConversationLengthChart + ResponseTimeChart (grid)
12. SLABreachChart
13. InsightsPanel
14. SentimentAnalyzer + SentimentTrendChart (grid)
15. ProviderTelemetryPanel + ResearchJobsPanel (grid)

### Dependencies Verified ✅
- **Primary File:** `components/analytics/AnalyticsDashboard.tsx`
- **Import Location:** `app/analytics/page.tsx` (single usage)
- **Lazy Loaded:** All chart components already lazy loaded (Phase 4.1)
- **Shared Pattern:** Collapsible card pattern from `components/training/TrainingWorkflow.tsx`
- **Icons Needed:** `ChevronRight`, `ChevronDown` from `lucide-react`

### Existing Collapsible Pattern (From Training Page)
```tsx
// Collapsed State
<Card 
  className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
  onClick={() => setCollapsed(false)}
>
  <CardContent className="flex items-center justify-between py-4">
    <h2 className="text-xl font-semibold">Section Title</h2>
    <ChevronRight className="h-5 w-5" />
  </CardContent>
</Card>

// Expanded State
<div 
  className="flex items-center justify-between mb-3 pl-4 cursor-pointer hover:opacity-70 transition-opacity"
  onClick={() => setCollapsed(true)}
>
  <h2 className="text-xl font-semibold">Section Title</h2>
  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
    <ChevronDown className="h-5 w-5" />
  </Button>
</div>
<Card className="shadow-none border border-gray-300 dark:border-gray-600">
  {/* Content */}
</Card>
```

---

## 🏗️ Proposed Organization Structure

### **PINNED (Always Visible)**
- **Filters Section** (already collapsible)
- **Settings Section** (already collapsible)
- **MetricsOverview** (6 stat cards - keep always visible)

### **Section 1: 🎯 Model & Training Performance**
**Default State:** Expanded  
**Components:**
- ModelPerformanceTable
- SessionComparisonTable
- TrainingEffectivenessChart
- BenchmarkAnalysisChart

**Rationale:** Core performance metrics users check first

### **Section 2: ⭐ Quality & Evaluation Metrics**
**Default State:** Expanded  
**Components:**
- RatingDistribution + SuccessRateChart (grid)
- JudgmentsBreakdown
- JudgmentsTable
- SentimentAnalyzer + SentimentTrendChart (grid)

**Rationale:** Quality analysis and user feedback metrics

### **Section 3: ⚡ Performance & SLA Metrics**
**Default State:** Collapsed  
**Components:**
- ResponseTimeChart + ConversationLengthChart (grid)
- SLABreachChart

**Rationale:** Technical performance monitoring

### **Section 4: 💰 Cost & Resource Analysis**
**Default State:** Collapsed  
**Components:**
- TokenUsageChart
- CostTrackingChart

**Rationale:** Financial tracking and optimization

### **Section 5: 🛠️ Operations & Monitoring**
**Default State:** Collapsed  
**Components:**
- AnomalyFeed + QualityForecastChart (grid)
- ToolPerformanceChart + ErrorBreakdownChart (grid)
- ProviderTelemetryPanel + ResearchJobsPanel (grid)
- InsightsPanel

**Rationale:** Advanced monitoring and predictive analytics

---

## 📋 Implementation Phases

### **PHASE 1: Preparation & Validation** ✅
**Estimated Time:** 30 minutes  
**Risk Level:** LOW

#### Tasks:
1. ✅ Verify current component structure in AnalyticsDashboard.tsx
2. ✅ Identify all chart components and their locations (lines 550-811)
3. ✅ Confirm lazy loading is already implemented (Phase 4.1)
4. ✅ Review collapsible pattern from TrainingWorkflow.tsx
5. ✅ Check for any state dependencies between components
6. ✅ Verify no breaking changes to data flow (useAnalytics hook)

#### Validation Checklist:
- [x] AnalyticsDashboard.tsx location confirmed
- [x] Single usage in app/analytics/page.tsx verified
- [x] All chart components lazy loaded
- [x] Collapsible pattern documented
- [x] No data/API dependencies identified
- [x] ChevronRight/ChevronDown icons available

---

### **PHASE 2: Add Collapse State Management**
**Estimated Time:** 15 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Add section collapse state variables (5 sections)
2. Import ChevronRight and ChevronDown icons
3. Import Card and CardContent if not already imported

#### Implementation Details:

**Location:** After line 87 (existing collapse state)

```tsx
// Existing collapse state
const [showFilters, setShowFilters] = useState(false);
const [showSettings, setShowSettings] = useState(false);

// NEW: Section collapse states
const [modelTrainingCollapsed, setModelTrainingCollapsed] = useState(false);
const [qualityCollapsed, setQualityCollapsed] = useState(false);
const [performanceCollapsed, setPerformanceCollapsed] = useState(true);
const [costCollapsed, setCostCollapsed] = useState(true);
const [operationsCollapsed, setOperationsCollapsed] = useState(true);
```

**Icon Import Update (Line ~13):**
```tsx
// Update existing import
import { ArrowLeft, MessageSquare, Download, Smile, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
```

**Card Import Update (Line ~44):**
```tsx
// Verify Card and CardContent are imported
import { Card, CardContent } from '../ui/card';
```

#### Validation:
- [ ] State variables added without affecting existing state
- [ ] Icons imported successfully
- [ ] Card components available
- [ ] No TypeScript errors
- [ ] Default states set correctly (2 expanded, 3 collapsed)

---

### **PHASE 3: Create Reusable Section Component**
**Estimated Time:** 30 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Create CollapsibleSection component inside AnalyticsDashboard
2. Reuse exact pattern from TrainingWorkflow
3. Add props for title, icon, collapsed state, and children

#### Implementation Details:

**Location:** After ChartLoader function (around line 55)

```tsx
// Loading fallback component
function ChartLoader() {
  return (
    <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Loading chart...</p>
      </div>
    </div>
  );
}

// NEW: Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ title, icon, collapsed, onToggle, children }: CollapsibleSectionProps) {
  if (collapsed) {
    return (
      <Card 
        className="shadow-none border border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            {icon && <span className="text-xl">{icon}</span>}
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <ChevronRight className="h-5 w-5" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div 
        className="flex items-center justify-between mb-3 pl-4 cursor-pointer hover:opacity-70 transition-opacity"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <ChevronDown className="h-5 w-5" />
        </Button>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </div>
  );
}
```

#### Validation:
- [ ] Component compiles without errors
- [ ] Props interface matches requirements
- [ ] Styling matches Training page pattern
- [ ] Collapsed/expanded states render correctly
- [ ] Click handlers work properly

---

### **PHASE 4: Wrap Section 1 (Model & Training)**
**Estimated Time:** 20 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Locate Section 1 components (lines ~660-688)
2. Wrap in CollapsibleSection component
3. Test with existing data flow

#### Implementation Details:

**Current Code (Lines ~660-688):**
```tsx
{/* Model Performance Table - Phase 4.1: Lazy loaded */}
{data.modelPerformance && data.modelPerformance.length > 0 && (
  <Suspense fallback={<ChartLoader />}>
    <ModelPerformanceTable
      data={data.modelPerformance}
      selectedModelId={selectedModelId}
      onModelSelect={setSelectedModelId}
    />
  </Suspense>
)}

{/* Session Comparison Table - Phase 4.1: Lazy loaded */}
<Suspense fallback={<ChartLoader />}>
  <SessionComparisonTable
    data={data.sessionMetrics}
    selectedSessionId={selectedSessionId}
    onSessionSelect={setSelectedSessionId}
  />
</Suspense>

{/* Training Effectiveness Chart - Phase 4.1: Lazy loaded */}
{data.trainingEffectiveness && data.trainingEffectiveness.length > 0 && (
  <Suspense fallback={<ChartLoader />}>
    <TrainingEffectivenessChart data={data.trainingEffectiveness} />
  </Suspense>
)}

{/* Benchmark Analysis Chart - Phase 4.1: Lazy loaded */}
{benchmarkLoading ? (
  <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
    Loading benchmark analysis...
  </div>
) : benchmarkError ? (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
    Failed to load benchmark analysis: {benchmarkError}
  </div>
) : (
  <Suspense fallback={<ChartLoader />}>
    <BenchmarkAnalysisChart data={benchmarkData} />
  </Suspense>
)}
```

**New Code (Replace above section):**
```tsx
{/* Section 1: Model & Training Performance */}
<CollapsibleSection
  title="Model & Training Performance"
  icon="🎯"
  collapsed={modelTrainingCollapsed}
  onToggle={() => setModelTrainingCollapsed(!modelTrainingCollapsed)}
>
  {/* Model Performance Table - Phase 4.1: Lazy loaded */}
  {data.modelPerformance && data.modelPerformance.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <ModelPerformanceTable
        data={data.modelPerformance}
        selectedModelId={selectedModelId}
        onModelSelect={setSelectedModelId}
      />
    </Suspense>
  )}

  {/* Session Comparison Table - Phase 4.1: Lazy loaded */}
  <Suspense fallback={<ChartLoader />}>
    <SessionComparisonTable
      data={data.sessionMetrics}
      selectedSessionId={selectedSessionId}
      onSessionSelect={setSelectedSessionId}
    />
  </Suspense>

  {/* Training Effectiveness Chart - Phase 4.1: Lazy loaded */}
  {data.trainingEffectiveness && data.trainingEffectiveness.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <TrainingEffectivenessChart data={data.trainingEffectiveness} />
    </Suspense>
  )}

  {/* Benchmark Analysis Chart - Phase 4.1: Lazy loaded */}
  {benchmarkLoading ? (
    <div className="bg-card border rounded-lg p-4 text-sm text-muted-foreground">
      Loading benchmark analysis...
    </div>
  ) : benchmarkError ? (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      Failed to load benchmark analysis: {benchmarkError}
    </div>
  ) : (
    <Suspense fallback={<ChartLoader />}>
      <BenchmarkAnalysisChart data={benchmarkData} />
    </Suspense>
  )}
</CollapsibleSection>
```

#### Validation:
- [ ] Section renders correctly when expanded
- [ ] Section collapses/expands on click
- [ ] All 4 charts render properly
- [ ] Conditional rendering still works
- [ ] No layout shifts or visual glitches
- [ ] Lazy loading still functions
- [ ] Test: npm run build (TypeScript check)

---

### **PHASE 5: Wrap Section 2 (Quality & Evaluation)**
**Estimated Time:** 20 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Locate Section 2 components (lines ~690-725)
2. Wrap in CollapsibleSection component
3. Maintain grid layouts

#### Implementation Details:

**Current Code (Lines ~690-725):**
```tsx
{/* Evaluation Charts - Phase 4.1: Lazy loaded */}
<div className="grid gap-6 md:grid-cols-2">
  <Suspense fallback={<ChartLoader />}>
    <RatingDistribution data={data.ratingDistribution} />
  </Suspense>
  <Suspense fallback={<ChartLoader />}>
    <SuccessRateChart data={data.successFailure} />
  </Suspense>
</div>

{/* Judgments Breakdown - Phase 4.1: Lazy loaded */}
{data.failureTags.length > 0 && (
  <>
    <Suspense fallback={<ChartLoader />}>
      <JudgmentsBreakdown data={data.failureTags} />
    </Suspense>
    <Suspense fallback={<ChartLoader />}>
      <JudgmentsTable data={data.failureTags} timeRange={timeRange} />
    </Suspense>
  </>
)}

{/* Sentiment Analysis - Phase 4.1: Lazy loaded */}
<div className="grid gap-6 md:grid-cols-2">
  <Suspense fallback={<ChartLoader />}>
    <SentimentAnalyzer lookbackDays={timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365} />
  </Suspense>
  <Suspense fallback={<ChartLoader />}>
    <SentimentTrendChart
      startDate={sentimentDateRange.startDate}
      endDate={sentimentDateRange.endDate}
    />
  </Suspense>
</div>
```

**New Code (Replace above section):**
```tsx
{/* Section 2: Quality & Evaluation Metrics */}
<CollapsibleSection
  title="Quality & Evaluation Metrics"
  icon="⭐"
  collapsed={qualityCollapsed}
  onToggle={() => setQualityCollapsed(!qualityCollapsed)}
>
  {/* Evaluation Charts - Phase 4.1: Lazy loaded */}
  <div className="grid gap-6 md:grid-cols-2">
    <Suspense fallback={<ChartLoader />}>
      <RatingDistribution data={data.ratingDistribution} />
    </Suspense>
    <Suspense fallback={<ChartLoader />}>
      <SuccessRateChart data={data.successFailure} />
    </Suspense>
  </div>

  {/* Judgments Breakdown - Phase 4.1: Lazy loaded */}
  {data.failureTags.length > 0 && (
    <>
      <Suspense fallback={<ChartLoader />}>
        <JudgmentsBreakdown data={data.failureTags} />
      </Suspense>
      <Suspense fallback={<ChartLoader />}>
        <JudgmentsTable data={data.failureTags} timeRange={timeRange} />
      </Suspense>
    </>
  )}

  {/* Sentiment Analysis - Phase 4.1: Lazy loaded */}
  <div className="grid gap-6 md:grid-cols-2">
    <Suspense fallback={<ChartLoader />}>
      <SentimentAnalyzer lookbackDays={timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365} />
    </Suspense>
    <Suspense fallback={<ChartLoader />}>
      <SentimentTrendChart
        startDate={sentimentDateRange.startDate}
        endDate={sentimentDateRange.endDate}
      />
    </Suspense>
  </div>
</CollapsibleSection>
```

#### Validation:
- [ ] Section renders correctly when expanded
- [ ] Grid layouts maintain responsive behavior
- [ ] Conditional rendering for judgments works
- [ ] Sentiment analyzer receives correct props
- [ ] No visual regressions
- [ ] Test: Toggle section, verify smooth transitions

---

### **PHASE 6: Wrap Section 3 (Performance & SLA)**
**Estimated Time:** 15 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Locate Section 3 components (lines ~740-768)
2. Wrap in CollapsibleSection component
3. Start with collapsed state (default: true)

#### Implementation Details:

**Current Code (Lines ~740-768):**
```tsx
{/* Performance Metrics - Phase 4.1: Lazy loaded */}
<div className="grid gap-6 md:grid-cols-2">
  {data.conversationLengths.some(c => c.count > 0) && (
    <Suspense fallback={<ChartLoader />}>
      <ConversationLengthChart data={data.conversationLengths} />
    </Suspense>
  )}
  {data.responseTimeTrends.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <ResponseTimeChart data={data.responseTimeTrends} />
    </Suspense>
  )}
</div>

{/* SLABreach Rate - Phase 4.1: Lazy loaded */}
{data.responseTimeTrends.length > 0 && (
  <Suspense fallback={<ChartLoader />}>
    <SLABreachChart data={data.responseTimeTrends.map(d => ({ date: d.date, slaBreachRate: d.slaBreachRate, sampleSize: d.sampleSize }))} />
  </Suspense>
)}
```

**New Code (Replace above section):**
```tsx
{/* Section 3: Performance & SLA Metrics */}
<CollapsibleSection
  title="Performance & SLA Metrics"
  icon="⚡"
  collapsed={performanceCollapsed}
  onToggle={() => setPerformanceCollapsed(!performanceCollapsed)}
>
  {/* Performance Metrics - Phase 4.1: Lazy loaded */}
  <div className="grid gap-6 md:grid-cols-2">
    {data.conversationLengths.some(c => c.count > 0) && (
      <Suspense fallback={<ChartLoader />}>
        <ConversationLengthChart data={data.conversationLengths} />
      </Suspense>
    )}
    {data.responseTimeTrends.length > 0 && (
      <Suspense fallback={<ChartLoader />}>
        <ResponseTimeChart data={data.responseTimeTrends} />
      </Suspense>
    )}
  </div>

  {/* SLABreach Rate - Phase 4.1: Lazy loaded */}
  {data.responseTimeTrends.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <SLABreachChart data={data.responseTimeTrends.map(d => ({ date: d.date, slaBreachRate: d.slaBreachRate, sampleSize: d.sampleSize }))} />
    </Suspense>
  )}
</CollapsibleSection>
```

#### Validation:
- [ ] Section starts collapsed (performanceCollapsed = true)
- [ ] Expands correctly on click
- [ ] Grid layout preserved
- [ ] Conditional rendering works
- [ ] SLA chart receives correct data transformation
- [ ] Test: Expand/collapse multiple times

---

### **PHASE 7: Wrap Section 4 (Cost & Resources)**
**Estimated Time:** 15 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Locate Section 4 components (lines ~730-745)
2. Wrap in CollapsibleSection component
3. Start with collapsed state (default: true)

#### Implementation Details:

**Current Code (Lines ~730-745):**
```tsx
{/* Token Usage - Phase 4.1: Lazy loaded */}
{data.tokenUsage.length > 0 && (
  <Suspense fallback={<ChartLoader />}>
    <TokenUsageChart data={data.tokenUsage} />
  </Suspense>
)}

{/* Cost Tracking - Phase 4.1: Lazy loaded */}
{data.costTracking.length > 0 && (
  <Suspense fallback={<ChartLoader />}>
    <CostTrackingChart data={data.costTracking} />
  </Suspense>
)}
```

**New Code (Replace above section):**
```tsx
{/* Section 4: Cost & Resource Analysis */}
<CollapsibleSection
  title="Cost & Resource Analysis"
  icon="💰"
  collapsed={costCollapsed}
  onToggle={() => setCostCollapsed(!costCollapsed)}
>
  {/* Token Usage - Phase 4.1: Lazy loaded */}
  {data.tokenUsage.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <TokenUsageChart data={data.tokenUsage} />
    </Suspense>
  )}

  {/* Cost Tracking - Phase 4.1: Lazy loaded */}
  {data.costTracking.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <CostTrackingChart data={data.costTracking} />
    </Suspense>
  )}
</CollapsibleSection>
```

#### Validation:
- [ ] Section starts collapsed (costCollapsed = true)
- [ ] Both charts render when expanded
- [ ] Conditional rendering preserved
- [ ] No layout issues
- [ ] Test: Verify charts load data correctly

---

### **PHASE 8: Wrap Section 5 (Operations & Monitoring)**
**Estimated Time:** 25 minutes  
**Risk Level:** LOW  
**File:** `components/analytics/AnalyticsDashboard.tsx`

#### Tasks:
1. Locate Section 5 components (lines ~695-790)
2. Wrap in CollapsibleSection component
3. Handle multiple grid layouts
4. Start with collapsed state (default: true)

#### Implementation Details:

**Current Code (Lines ~695-790):**
```tsx
{/* Proactive Monitoring & Predictive Intelligence - Phase 4.1: Lazy loaded */}
<div className="grid gap-6 md:grid-cols-2">
  <Suspense fallback={<ChartLoader />}>
    <AnomalyFeed maxItems={10} autoRefresh={true} refreshInterval={30000} />
  </Suspense>
  <Suspense fallback={<ChartLoader />}>
    <QualityForecastChart metricName="Success Rate" timeRange={timeRange === 'all' ? '90d' : timeRange} forecastDays={7} />
  </Suspense>
</div>

{/* Tool & Error Analytics - Phase 4.1: Lazy loaded */}
<div className="grid gap-6 md:grid-cols-2">
  {data.toolPerformance.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <ToolPerformanceChart data={data.toolPerformance} />
    </Suspense>
  )}
  {data.errorBreakdown.length > 0 && (
    <Suspense fallback={<ChartLoader />}>
      <ErrorBreakdownChart data={data.errorBreakdown} />
    </Suspense>
  )}
</div>

{/* AI Insights Panel - Phase 4.1: Lazy loaded */}
{user?.id && (
  <Suspense fallback={<ChartLoader />}>
    <InsightsPanel userId={user.id} timeRange={timeRange} />
  </Suspense>
)}

{/* Operations Panels */}
<div className="grid gap-6 md:grid-cols-2">
  <Suspense fallback={<ChartLoader />}>
    <ProviderTelemetryPanel hours={24} />
  </Suspense>
  <Suspense fallback={<ChartLoader />}>
    <ResearchJobsPanel limit={20} />
  </Suspense>
</div>
```

**New Code (Replace above section):**
```tsx
{/* Section 5: Operations & Monitoring */}
<CollapsibleSection
  title="Operations & Monitoring"
  icon="🛠️"
  collapsed={operationsCollapsed}
  onToggle={() => setOperationsCollapsed(!operationsCollapsed)}
>
  {/* Proactive Monitoring & Predictive Intelligence - Phase 4.1: Lazy loaded */}
  <div className="grid gap-6 md:grid-cols-2">
    <Suspense fallback={<ChartLoader />}>
      <AnomalyFeed maxItems={10} autoRefresh={true} refreshInterval={30000} />
    </Suspense>
    <Suspense fallback={<ChartLoader />}>
      <QualityForecastChart metricName="Success Rate" timeRange={timeRange === 'all' ? '90d' : timeRange} forecastDays={7} />
    </Suspense>
  </div>

  {/* Tool & Error Analytics - Phase 4.1: Lazy loaded */}
  <div className="grid gap-6 md:grid-cols-2">
    {data.toolPerformance.length > 0 && (
      <Suspense fallback={<ChartLoader />}>
        <ToolPerformanceChart data={data.toolPerformance} />
      </Suspense>
    )}
    {data.errorBreakdown.length > 0 && (
      <Suspense fallback={<ChartLoader />}>
        <ErrorBreakdownChart data={data.errorBreakdown} />
      </Suspense>
    )}
  </div>

  {/* AI Insights Panel - Phase 4.1: Lazy loaded */}
  {user?.id && (
    <Suspense fallback={<ChartLoader />}>
      <InsightsPanel userId={user.id} timeRange={timeRange} />
    </Suspense>
  )}

  {/* Operations Panels */}
  <div className="grid gap-6 md:grid-cols-2">
    <Suspense fallback={<ChartLoader />}>
      <ProviderTelemetryPanel hours={24} />
    </Suspense>
    <Suspense fallback={<ChartLoader />}>
      <ResearchJobsPanel limit={20} />
    </Suspense>
  </div>
</CollapsibleSection>
```

#### Validation:
- [ ] Section starts collapsed (operationsCollapsed = true)
- [ ] All 4 grids render correctly when expanded
- [ ] AnomalyFeed autoRefresh works
- [ ] QualityForecastChart timeRange calculation preserved
- [ ] Conditional rendering for tool/error charts works
- [ ] InsightsPanel only renders when user exists
- [ ] Provider telemetry and research jobs load correctly
- [ ] Test: Verify grid responsiveness on mobile

---

### **PHASE 9: Testing & Validation**
**Estimated Time:** 45 minutes  
**Risk Level:** LOW

#### Tasks:
1. Build project and check for TypeScript errors
2. Run dev server and test each section
3. Verify lazy loading still works
4. Test responsive behavior
5. Verify data flow unchanged
6. Performance check

#### Testing Checklist:

**Build & Compilation:**
- [ ] Run `npm run build` - no TypeScript errors
- [ ] No new lint warnings introduced
- [ ] All imports resolve correctly

**Functional Testing:**
- [ ] All 5 sections render correctly
- [ ] Each section expands/collapses smoothly
- [ ] Collapsed sections show correct title and icon
- [ ] Expanded sections show chevron down
- [ ] Clicking anywhere on collapsed card expands section
- [ ] Clicking title or chevron collapses section

**Data & State Testing:**
- [ ] MetricsOverview displays correct stats (always visible)
- [ ] Filters still work and update data
- [ ] Settings still work and affect calculations
- [ ] Model selection updates ModelPerformanceTable
- [ ] Session selection updates SessionComparisonTable
- [ ] Time range updates all charts
- [ ] Lazy loading triggers when expanding sections

**Conditional Rendering:**
- [ ] Charts with conditional rendering still show/hide correctly
- [ ] Empty data states handled properly
- [ ] Benchmark loading/error states work
- [ ] Judgments only show when data exists
- [ ] Tool/Error charts conditional on data availability

**Responsive Testing:**
- [ ] Desktop (1920px): All grids show 2 columns
- [ ] Tablet (768px): Grids collapse to single column
- [ ] Mobile (375px): All content readable and functional
- [ ] Collapsible sections work on touch devices

**Performance Testing:**
- [ ] Initial page load time acceptable
- [ ] Expanding sections feels instant
- [ ] Lazy loading doesn't cause jank
- [ ] Memory usage similar to before
- [ ] No console errors or warnings

**Browser Testing:**
- [ ] Chrome: All features work
- [ ] Firefox: All features work
- [ ] Safari: All features work (if available)
- [ ] Edge: All features work

---

### **PHASE 10: Documentation & Cleanup**
**Estimated Time:** 20 minutes  
**Risk Level:** NONE

#### Tasks:
1. Update implementation plan with completion notes
2. Document any issues encountered
3. Create progress log entry
4. Update component comments in code

#### Deliverables:
- [ ] Updated ANALYTICS_COLLAPSIBLE_SECTIONS_IMPLEMENTATION_PLAN.md
- [ ] New entry in ANALYTICS_UI_PROGRESS_LOG.md
- [ ] Code comments updated in AnalyticsDashboard.tsx
- [ ] Screenshots of before/after (optional)

---

## 🔍 Risk Assessment

### Breaking Changes Analysis ✅

**Data Flow:**
- ✅ No changes to useAnalytics hook
- ✅ No changes to data fetching logic
- ✅ No changes to props passed to chart components
- ✅ All conditional rendering preserved

**State Management:**
- ✅ Only adding new collapse state variables
- ✅ No changes to existing filter/settings state
- ✅ No changes to model/session selection state

**Component Structure:**
- ✅ All chart components remain unchanged
- ✅ Only wrapping with CollapsibleSection (pure UI)
- ✅ All Suspense boundaries preserved
- ✅ Lazy loading still functions

**Styling:**
- ✅ Using established pattern from Training page
- ✅ No changes to chart component styles
- ✅ Grid layouts preserved inside sections
- ✅ Responsive breakpoints maintained

### Identified Risks & Mitigations

**Risk 1: Layout Shift on Expand/Collapse**
- **Impact:** LOW
- **Mitigation:** Using same pattern as Training page (proven stable)
- **Fallback:** Add transition-all class if needed

**Risk 2: Lazy Loading Timing**
- **Impact:** LOW
- **Mitigation:** Suspense boundaries already in place
- **Fallback:** Components load when section expands (expected behavior)

**Risk 3: Grid Responsiveness**
- **Impact:** LOW
- **Mitigation:** Grids already wrapped in sections, no changes to breakpoints
- **Fallback:** Test on multiple screen sizes

**Risk 4: User Confusion**
- **Impact:** VERY LOW
- **Mitigation:** Sections start in logical states (key sections expanded)
- **Fallback:** Add tooltips or help text if needed

---

## 📊 Expected Benefits

### User Experience
1. **Reduced Cognitive Load:** Organized sections vs. long list
2. **Faster Navigation:** Expand only what you need
3. **Consistent UX:** Matches Training/Models pages
4. **Better Focus:** Collapse distractions, focus on analysis

### Technical Benefits
1. **Lazy Loading Optimization:** Components only load when expanded
2. **Better Performance:** Collapsed sections don't render content
3. **Maintainability:** Clear logical grouping
4. **Extensibility:** Easy to add new charts to sections

### Analytics Usage Patterns
1. **Quick Glance:** Overview metrics always visible
2. **Deep Dive:** Expand specific section for detailed analysis
3. **Comparison:** Expand multiple sections side-by-side
4. **Custom View:** Collapse irrelevant sections

---

## 🚀 Rollout Strategy

### Phase Approach (Recommended)
**Implement incrementally:** Complete Phases 1-3 first (foundation), then wrap one section at a time (Phases 4-8). Test after each section.

**Benefits:**
- Easy rollback if issues arise
- Incremental validation
- Catch problems early
- Maintain working state between sessions

### All-At-Once Approach (Alternative)
**Implement all phases in one session:** Complete Phases 1-8 consecutively, test at end.

**Benefits:**
- Faster completion
- Consistent state throughout
- Single testing cycle

**Recommendation:** Use Phase Approach for safety, especially if working across multiple sessions.

---

## 📝 Completion Criteria

### Definition of Done
- [ ] All 5 sections wrapped in CollapsibleSection components
- [ ] No TypeScript compilation errors
- [ ] No new lint warnings
- [ ] All charts render correctly
- [ ] Responsive design maintained
- [ ] Lazy loading functions properly
- [ ] All conditional rendering works
- [ ] Data flow unchanged
- [ ] Browser testing complete
- [ ] Documentation updated
- [ ] Progress log entry created

---

## 🔄 Session Continuity

### For Next Session
If implementation spans multiple sessions, track progress:

**Completed Phases:**
- [ ] Phase 1: Preparation & Validation
- [ ] Phase 2: Add Collapse State Management
- [ ] Phase 3: Create Reusable Section Component
- [ ] Phase 4: Wrap Section 1 (Model & Training)
- [ ] Phase 5: Wrap Section 2 (Quality & Evaluation)
- [ ] Phase 6: Wrap Section 3 (Performance & SLA)
- [ ] Phase 7: Wrap Section 4 (Cost & Resources)
- [ ] Phase 8: Wrap Section 5 (Operations & Monitoring)
- [ ] Phase 9: Testing & Validation
- [ ] Phase 10: Documentation & Cleanup

**Current State:**
- Last completed phase: _____________
- Current file state: Working / Testing / Production
- Known issues: _____________
- Next steps: _____________

---

## 📚 Reference Materials

### Key Files
- `/components/analytics/AnalyticsDashboard.tsx` (811 lines)
- `/components/training/TrainingWorkflow.tsx` (collapsible pattern reference)
- `/app/training/page.tsx` (savedConfigsCollapsed pattern reference)

### Pattern References
- **Collapsible Card Pattern:** TrainingWorkflow.tsx lines 157-194
- **Icon Imports:** lucide-react (ChevronRight, ChevronDown)
- **Card Components:** @/components/ui/card

### Documentation
- Previous UI enhancements: ALL_HARDCODED_VALUES_FIXED.md
- Training page improvements: (conversation history)
- Analytics Phase 4.1: Lazy loading implementation

---

## ✅ Pre-Implementation Verification Complete

**Status:** READY TO IMPLEMENT  
**Confidence Level:** HIGH  
**Breaking Changes Risk:** NONE IDENTIFIED  
**Rollback Plan:** Git revert (pure UI changes)

**Verification Completed:**
✅ Current structure analyzed (811 lines, 5 sections identified)  
✅ Dependencies verified (single import in app/analytics/page.tsx)  
✅ Pattern documented (from TrainingWorkflow.tsx)  
✅ Component inventory complete (17 chart sections)  
✅ State management planned (5 new boolean states)  
✅ No data/API changes required  
✅ Lazy loading already implemented (Phase 4.1)  
✅ Responsive grids verified  
✅ Conditional rendering catalogued  

**Ready for Phase 2 implementation.**

---

*Implementation Plan Version: 1.0*  
*Last Updated: November 11, 2025*  
*Author: Claude (GitHub Copilot)*
