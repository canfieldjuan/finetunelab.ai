# Training Metrics Comparison Page - Implementation Plan

**Date:** 2025-12-07
**Status:** Completed - Phase 1 Implemented
**Priority:** Enhancement

## Overview

Create a dedicated page for side-by-side comparison of training metrics across multiple training runs. This allows users to overlay loss curves, learning rate schedules, and other metrics on the same charts for easier analysis.

## Current State

- **ComparisonModal** (`/components/training/ComparisonModal.tsx`) - Shows table of final metrics only, no charts
- **Training Monitor** (`/training/monitor`) - Views one job at a time, tedious to compare
- **Finetuned Models** (`/finetuned-models`) - Deployment-focused cards, not analysis

## Proposed Solution

New page at `/training/compare` with:
- Job selection (checkboxes for 2-5 completed/running jobs)
- Overlay charts showing metrics from all selected jobs
- Color-coded lines per job
- Summary table with final metrics

## Phased Implementation Plan

### Phase 1: Core Infrastructure (Additive Only)
**Files to CREATE:**
1. `app/training/compare/page.tsx` - Main page component
2. `components/training/comparison/MultiJobLossChart.tsx` - Overlay loss chart
3. `components/training/comparison/MultiJobMetricsTable.tsx` - Summary table
4. `hooks/useMultiJobMetrics.ts` - Hook to fetch metrics for multiple jobs

**Files to MODIFY (additive only):**
1. `components/layout/AppSidebar.tsx` - Add nav item (line ~153)
   - Add: `{ id: 'training-compare', href: '/training/compare', icon: GitCompare, label: 'Compare Runs' }`
   - Update line 103: Add 'training-compare' to training group

### Phase 2: Additional Charts
**Files to CREATE:**
1. `components/training/comparison/MultiJobPerplexityChart.tsx`
2. `components/training/comparison/MultiJobLearningRateChart.tsx`
3. `components/training/comparison/MultiJobGradNormChart.tsx`

### Phase 3: Polish & UX
- Add job color legend
- Add metric toggle checkboxes
- Add export comparison report

## Technical Details

### Data Flow
```
useTrainingJobsRealtime() → Get list of jobs
    ↓
User selects jobs (2-5 max)
    ↓
useMultiJobMetrics(selectedJobIds) → Fetch metrics for each
    ↓
Merge data with job identifier → { ...metric, jobId, jobColor }
    ↓
Recharts LineChart with multiple <Line> components
```

### Existing Dependencies to Reuse
- `useTrainingJobsRealtime` - Job list with realtime updates
- `MetricPoint` type from `lib/hooks/useTrainingMetricsRealtime.ts`
- `TrainingJob` type from `lib/hooks/useTrainingJobsRealtime.ts`
- Recharts (already installed, used in LossChart etc.)
- UI components (Button, Card, Select, etc.)

### New Hook: useMultiJobMetrics
```typescript
// hooks/useMultiJobMetrics.ts
export function useMultiJobMetrics(
  jobIds: string[],
  sessionToken?: string
): {
  metricsMap: Record<string, MetricPoint[]>;
  isLoading: boolean;
  error: string | null;
}
```

### Color Scheme for Jobs
```typescript
const JOB_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#9333ea', // purple
  '#ea580c', // orange
];
```

## Files Affected Analysis

### No Breaking Changes Expected
All changes are **additive**:
- New page (new file)
- New components (new files)
- New hook (new file)
- Sidebar nav (add one item to existing array)

### Existing Files - Minimal Modifications
| File | Change | Risk |
|------|--------|------|
| `AppSidebar.tsx` | Add 1 nav item + 1 string to array | Very Low |

### No Modifications Needed
- Existing chart components (LossChart, etc.) - untouched
- TrainingMetricsContext - untouched
- Existing hooks - untouched
- API routes - will use existing `/api/training/metrics/[jobId]`

## Verification Steps

1. **Before implementation:**
   - Verify `lucide-react` has `GitCompare` icon
   - Verify Recharts supports multiple Line components
   - Verify API endpoint returns metrics correctly

2. **After each phase:**
   - Run `npx tsc --noEmit` to check types
   - Test navigation link works
   - Test job selection works
   - Test charts render with multiple jobs

3. **Final verification:**
   - Select 2 jobs, verify overlay works
   - Select 5 jobs (max), verify colors distinct
   - Verify no console errors
   - Verify existing pages unaffected

## Approval Checklist

- [x] Plan reviewed
- [x] Additive-only approach confirmed
- [x] No breaking changes identified
- [x] Ready to proceed with Phase 1

---

## Implementation Complete

**Phase 1 Completed:** 2025-12-07

### Files Created:
1. `app/training/analytics/page.tsx` - Main page component
2. `components/training/comparison/MultiJobLossChart.tsx` - Overlay loss chart
3. `components/training/comparison/MultiJobSummaryTable.tsx` - Summary table
4. `hooks/useMultiJobMetrics.ts` - Hook to fetch metrics for multiple jobs

### Files Modified:
1. `components/layout/AppSidebar.tsx` - Added "Training Analytics" nav item to Training group

### Verification:
- TypeScript compiles without errors for all new files
- No breaking changes to existing functionality
