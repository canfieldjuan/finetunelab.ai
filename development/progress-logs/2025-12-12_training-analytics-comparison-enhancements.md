# Training Analytics Comparison Enhancements

**Date:** 2025-12-12
**Status:** IN PROGRESS
**Goal:** Enhance training analytics page for better model comparison and selection

---

## Context

The `/training/analytics` page allows users to compare training runs side-by-side to choose the best model for testing. Current implementation has basic comparison but needs better UX for decision-making.

## Current State Analysis

### Files Involved

| File | Purpose | Will Modify |
|------|---------|-------------|
| `app/training/analytics/page.tsx` | Main analytics page | YES |
| `components/training/comparison/MultiJobSummaryTable.tsx` | Summary comparison table | YES |
| `components/training/comparison/MultiJobLossChart.tsx` | Loss curves chart | NO |
| `components/training/comparison/MultiJobMetricChart.tsx` | Generic metric chart | NO (new) |
| `components/training/comparison/MultiJobLearningRateChart.tsx` | LR chart | NO (new) |
| `components/training/comparison/MultiJobGradientNormChart.tsx` | Grad norm chart | NO (new) |
| `components/training/comparison/MultiJobThroughputChart.tsx` | Throughput chart | NO (new) |
| `components/training/comparison/MultiJobMemoryChart.tsx` | Memory chart | NO (new) |
| `hooks/useMultiJobMetrics.ts` | Metrics fetching hook | MAYBE |
| `lib/hooks/useTrainingJobsRealtime.ts` | Jobs realtime hook | NO |

### Current Features (as of 2025-12-12)
- Job selection panel (max 5 jobs)
- Status filter (all/completed/running/failed)
- Loss curves comparison chart
- Learning rate chart (NEW)
- Gradient norm chart (NEW)
- Throughput chart (NEW)
- GPU memory chart (NEW)
- Summary table with: Model, Status, Best Eval Loss, Train Loss, Perplexity, Speed, Duration, Epochs
- Best performer highlight

### Available Data Fields (from TrainingJob interface)
```typescript
// Core
id, user_id, status, model_name, dataset_path, base_model

// Progress
current_step, current_epoch, total_steps, total_epochs, progress

// Training params
learning_rate, batch_size, gradient_accumulation_steps

// Metrics
loss, eval_loss, grad_norm, perplexity, train_perplexity
best_eval_loss, best_epoch, best_step, final_loss, final_eval_loss

// Resources
gpu_memory_allocated_gb, gpu_utilization_percent, samples_per_second

// Timing
created_at, started_at, completed_at, elapsed_seconds, remaining_seconds

// Config
config (JSON with full hyperparameters)
```

---

## Phased Implementation Plan

### Phase 1: Enhanced Summary Table (Priority: HIGH)
**Goal:** Make the summary table more useful for comparison decisions

**Changes:**
1. Add sortable columns (click header to sort)
2. Add dataset name column
3. Add overfitting indicator (eval_loss - train_loss gap)
4. Add learning rate and batch size columns
5. Add convergence speed metric (steps to best loss)
6. Better visual highlighting of best/worst values

**Files to modify:**
- `components/training/comparison/MultiJobSummaryTable.tsx`

**Risk:** LOW - isolated component, no external dependencies

### Phase 2: Better Job Selection Panel (Priority: HIGH)
**Goal:** Make it easier to find and select jobs to compare

**Changes:**
1. Add search input to filter by model name
2. Show more info per job: dataset, date, duration
3. Add sort options (by date, loss, status)
4. Better visual design with more information density

**Files to modify:**
- `app/training/analytics/page.tsx` (job selection panel section)

**Risk:** LOW - UI-only changes within existing component

### Phase 3: Recommendation System (Priority: MEDIUM)
**Goal:** Auto-highlight recommended model based on metrics

**Changes:**
1. Calculate composite score from: eval_loss, overfitting gap, stability
2. Show recommendation badge on best job
3. Explain why in tooltip

**Files to modify:**
- `app/training/analytics/page.tsx`
- `components/training/comparison/MultiJobSummaryTable.tsx`

**Risk:** LOW - additive feature, no breaking changes

### Phase 4: Hyperparameter Diff View (Priority: LOW)
**Goal:** Show parameter differences between runs

**Changes:**
1. Extract config from jobs
2. Create diff table showing differences
3. Highlight parameters that changed

**Files to modify:**
- Create new component `MultiJobHyperparameterDiff.tsx`
- `app/training/analytics/page.tsx`

**Risk:** LOW - new component, additive

---

## Implementation Progress

### Session 1 (2025-12-12)

**Completed:**
- [x] Created 4 new metric chart components (LR, GradNorm, Throughput, Memory)
- [x] Created generic `MultiJobMetricChart` component
- [x] Updated analytics page to include new charts in 2x2 grid
- [x] Created index.ts for chart exports
- [x] Phase 1: Enhanced Summary Table
- [x] Phase 2: Better Job Selection Panel
- [x] Phase 3: Recommendation System
- [x] Phase 4: Hyperparameter Diff View
- [x] Phase 5: Chart Readability Fixes

**Files Created:**
- `components/training/comparison/MultiJobMetricChart.tsx`
- `components/training/comparison/MultiJobLearningRateChart.tsx`
- `components/training/comparison/MultiJobGradientNormChart.tsx`
- `components/training/comparison/MultiJobThroughputChart.tsx`
- `components/training/comparison/MultiJobMemoryChart.tsx`
- `components/training/comparison/MultiJobHyperparameterDiff.tsx`
- `components/training/comparison/index.ts`

**Files Modified:**
- `app/training/analytics/page.tsx`
  - Added imports for new chart components
  - Added 2x2 chart grid below Loss chart
  - Added search input for filtering jobs by model/dataset name
  - Added sort dropdown (Newest, Oldest, Best Loss)
  - Improved job card layout with date, status badge, and loss value
  - Made UI more compact and information-dense

- `components/training/comparison/MultiJobSummaryTable.tsx`
  - Added sortable columns (click header to sort)
  - Added Overfitting Gap column (Eval - Train loss)
  - Added Learning Rate column
  - Added Batch Size column
  - Added sort indicators (arrows)
  - Improved recommendation callout with gap info
  - Made table more compact with smaller text

### Phase 1 Details: Enhanced Summary Table

**New Columns Added:**
1. Gap - Overfitting indicator (eval_loss - train_loss)
2. LR - Learning rate in scientific notation
3. Batch - Batch size

**Features Added:**
- Sortable columns with visual indicators
- Overfitting warning (orange text when gap > 0.1)
- Best values highlighted in green
- Trophy icon for best eval loss
- Compact styling for more data in less space

### Phase 2 Details: Better Job Selection Panel

**Features Added:**
1. Search input - Filter by model name or dataset path
2. Sort dropdown - Newest, Oldest, Best Loss
3. Compact job cards with:
   - Status badge with color coding
   - Eval loss value
   - Date (month/day format)
   - Color indicator when selected
4. Job count display
5. Visual feedback when max 5 jobs selected (opacity on disabled cards)

### Phase 3 Details: Recommendation System

**Scoring Algorithm:**
- Only considers completed jobs
- Composite score = (Eval Loss Score * 70%) + (Overfit Score * 30%)
- Eval Loss Score: Inverse of loss (lower loss = higher score)
- Overfit Score based on gap (eval_loss - train_loss):
  - Gap < 0.05: Excellent (100 pts)
  - Gap < 0.1: Good (80 pts)
  - Gap < 0.2: Moderate (60 pts)
  - Gap >= 0.2: High overfitting (30 pts)
  - Negative gap: Potential data leakage (40 pts)

**Visual Indicators:**
1. Job Selection Panel:
   - Gold star icon on recommended job
   - Yellow border and background highlight
   - Tooltip showing recommendation reasons
2. Summary Table:
   - Yellow background row for recommended job
   - Star icon instead of color dot
   - Yellow callout footer with model name and reasons

**Files Modified:**
- `app/training/analytics/page.tsx`
  - Added `recommendedJob` useMemo with scoring algorithm
  - Added Star icon import
  - Updated job card to show recommendation badge
  - Pass `recommendedJobId` and `recommendationReasons` to summary table

- `components/training/comparison/MultiJobSummaryTable.tsx`
  - Added `recommendedJobId` and `recommendationReasons` props
  - Added Star icon import
  - Highlight recommended row with yellow background
  - Show star icon instead of color dot for recommended job
  - Updated footer to show recommendation with reasons

### Phase 4 Details: Hyperparameter Diff View

**Component:** `MultiJobHyperparameterDiff.tsx`

**Features:**
1. Collapsible panel showing hyperparameter comparison
2. Two sections:
   - **Different Values** - Highlighted in orange, shows parameters that vary between jobs
   - **Same Values** - Shows parameters shared across all jobs
3. Badge showing count of differences
4. Supports both direct job fields and config JSON extraction

**Parameters Compared:**
- Direct fields: learning_rate, batch_size, gradient_accumulation_steps, total_epochs, warmup_steps, max/min_learning_rate, num_gpus
- Config fields: weight_decay, lr_scheduler_type, optimizer, max_seq_length, lora_r, lora_alpha, lora_dropout

**Files Modified:**
- `app/training/analytics/page.tsx` - Added import and component
- `components/training/comparison/index.ts` - Added export

### Phase 5: Chart Readability Fixes

**Issues Identified:**
1. Long job names (e.g., "Qwen2.5-7B-Instruct") overflow legend
2. Loss chart in "both" mode creates 2 entries per job (10 items for 5 jobs)
3. Horizontal legend causes text overlap with many entries
4. No name truncation in legends or tooltips

**Fixes Applied:**

**MultiJobMetricChart.tsx:**
- Added `truncateJobName()` helper function (max 18 chars)
- Legend switches to vertical layout when > 3 jobs
- Dynamic right margin (120px) when vertical legend active
- Truncated names in legend with full names in tooltip
- Tooltip shows full job name on hover

**MultiJobLossChart.tsx:**
- Added `truncateJobName()` helper function (max 14 chars)
- Shortened suffixes: `(Train)` → `(T)`, `(Eval)` → `(E)`
- Legend switches to vertical layout when > 2 jobs
- Dynamic right margin (140px) when vertical legend active
- Tooltip expands abbreviations to show full names
- Updated style legend to explain (T) and (E) abbreviations

**Visual Improvements:**
- Vertical legend on right side prevents overlap
- Shorter names fit in legend space
- Hover shows full job name for identification
- Consistent styling across all chart types
- Smaller font size (10-11px) for compact display

---

## Dependencies Map

```
app/training/analytics/page.tsx
  ├── useAuth (contexts/AuthContext)
  ├── useTrainingJobsRealtime (lib/hooks/useTrainingJobsRealtime)
  ├── useMultiJobMetrics (hooks/useMultiJobMetrics)
  ├── MultiJobLossChart
  ├── MultiJobSummaryTable
  ├── MultiJobLearningRateChart
  ├── MultiJobGradientNormChart
  ├── MultiJobThroughputChart
  ├── MultiJobMemoryChart
  └── MultiJobHyperparameterDiff (NEW)

MultiJobSummaryTable
  └── TrainingJob type (lib/hooks/useTrainingJobsRealtime)

MultiJobMetricChart (base)
  ├── JobMetrics type (hooks/useMultiJobMetrics)
  ├── MetricPoint type (lib/hooks/useTrainingMetricsRealtime)
  └── mergeMetricsForChart (hooks/useMultiJobMetrics)
```

---

## Verification Checklist

Before each phase completion:
- [ ] TypeScript compiles without errors in modified files
- [ ] No breaking changes to existing functionality
- [ ] Component renders without errors
- [ ] All imports resolve correctly
- [ ] No hard-coded values introduced

---

## Notes

- TrainingJob interface has all fields needed for enhanced comparison
- Config field contains full hyperparameters as JSON
- No database changes required
- All changes are frontend-only
