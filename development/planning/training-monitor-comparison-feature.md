# Training Monitor - Model Run Comparison Feature

**Date:** 2025-12-02
**Purpose:** Compare training runs of the same model to identify the best performing run and eliminate underperforming ones
**Priority:** High (User actively testing/iterating on models)

---

## User Story

> "I'm doing a lot of testing with the same model (e.g., Qwen2.5-7B-Instruct). I want to see which of my training runs performed best based on their checkpoints, so I can identify the winners and eliminate the runs that didn't do as well as they should have."

---

## Current State Analysis

### What Exists ✅

**Monitor Page Features:**
- Real-time monitoring of single job
- Loss charts, GPU metrics, throughput
- Predictions comparison (epoch-by-epoch for single job)
- Recent jobs list with filters (status, search)
- Individual job details

**Available Metrics Per Job:**
- `best_eval_loss` - Best validation loss achieved
- `final_eval_loss` - Final validation loss
- `best_epoch` - Epoch with best eval loss
- `best_checkpoint_path` - Path to best checkpoint
- `total_epochs` - Total epochs trained
- `created_at`, `completed_at` - Timing
- `model_name` - Model identifier

### What's Missing ❌

**No Way To:**
- Compare multiple runs of the same model side-by-side
- Visualize best checkpoints across runs
- Identify the "winner" automatically
- Bulk delete/archive underperforming runs
- Export comparison data
- See improvement trends across attempts

---

## Design Proposal: Multi-Run Comparison Dashboard

### Option 1: Integrated Comparison View (Recommended)

**Location:** New tab/section on `/training/monitor` page

**Design:**
```
┌─────────────────────────────────────────────────────────┐
│ Training Monitor                                         │
│ ┌─────┬────────────┬──────────┐                        │
│ │ Job │ Comparison │ History  │                         │
│ └─────┴────────────┴──────────┘                         │
│                                                          │
│  🔍 Compare Runs: Qwen/Qwen2.5-7B-Instruct             │
│  ┌────────────────────────────────────────────┐        │
│  │ Select runs to compare (2-5 runs)          │        │
│  │ ☑ Run #1: 06a9655e (completed Dec 2)      │ 🏆     │
│  │ ☑ Run #2: fa25ad23 (completed Dec 1)      │        │
│  │ ☐ Run #3: 0a04dd4e (completed Nov 30)     │        │
│  └────────────────────────────────────────────┘        │
│                                                          │
│  📊 Comparison Metrics                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Metric          Run #1  Run #2  Run #3   Best     │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ Best Eval Loss  0.6686  0.9041  1.1267   Run #1   │  │
│  │ Best Epoch      11/12   12/12   12/12    Run #1   │  │
│  │ Training Time   2.3h    2.5h    2.1h     Run #3   │  │
│  │ GPU Efficiency  85%     78%     82%      Run #1   │  │
│  │ Final Perplexity 1.95   2.47    3.08     Run #1   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  📈 Visual Comparison                                   │
│  [Loss curves overlaid on same chart]                  │
│  [Training speed comparison bar chart]                 │
│  [Checkpoint quality evolution]                        │
│                                                          │
│  🎯 Recommendation                                      │
│  ┌────────────────────────────────────────────────┐    │
│  │ ⭐ Best Run: 06a9655e                          │    │
│  │ • 26% better eval loss than Run #2             │    │
│  │ • Converged at epoch 11 (early stopping)      │    │
│  │ • Highest GPU efficiency (85%)                 │    │
│  │                                                  │    │
│  │ [Deploy This Model] [Save Comparison]          │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  🗑️ Manage Underperforming Runs                        │
│  ┌────────────────────────────────────────────────┐    │
│  │ Run #2 & #3 are 26-41% worse than Run #1       │    │
│  │ [Archive Run #2] [Archive Run #3]              │    │
│  │ [Delete Run #2] [Delete Run #3]                │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key Features:**
1. **Model Grouping** - Automatically group runs by model_name
2. **Multi-Select** - Select 2-5 runs to compare
3. **Metric Table** - Side-by-side comparison of key metrics
4. **Visual Charts** - Overlaid loss curves, bar charts
5. **Auto-Recommendation** - Highlight best run with explanation
6. **Bulk Actions** - Archive/delete underperforming runs

### Option 2: Standalone Comparison Page

**Location:** New page at `/training/compare`

**Pros:**
- Dedicated space for analysis
- Can be more feature-rich
- Doesn't clutter monitor page

**Cons:**
- Extra navigation step
- Disconnected from monitoring workflow
- Need to remember which runs to compare

### Option 3: Enhanced Recent Jobs List (Quick Win)

**Location:** Inline on existing monitor page recent jobs list

**Design:**
```
Recent Training Jobs (Qwen/Qwen2.5-7B-Instruct)

[Comparison Mode: ON] [Group by Model]

☑ 06a9655e • completed • Best Loss: 0.6686 🏆
☑ fa25ad23 • completed • Best Loss: 0.9041 ⚠️ 26% worse
☐ 0a04dd4e • completed • Best Loss: 1.1267 ⚠️ 41% worse

[Compare Selected (2)]
```

**Pros:**
- Minimal UI changes
- Quick to implement
- Familiar interface

**Cons:**
- Limited space for detailed comparison
- Harder to visualize trends

---

## Recommended Approach: Phased Implementation

### Phase 1: Quick Wins (1-2 days)

**Goal:** Add comparison indicators to existing UI

**Changes:**

1. **Group Jobs by Model**
   - Add "Group by Model" toggle to recent jobs
   - Show model name as section headers
   - Auto-collapse/expand groups

2. **Add Comparison Badges**
   - Show best_eval_loss next to each job
   - Add visual indicator for best run (🏆)
   - Show relative performance (% better/worse than best)

3. **Multi-Select in Recent Jobs**
   - Checkboxes for each job
   - "Compare Selected" button
   - Opens modal with basic comparison table

**Implementation:**
```typescript
// Add to TrainingMonitorPageContent
const [selectedJobsForComparison, setSelectedJobsForComparison] = useState<string[]>([]);
const [showComparisonModal, setShowComparisonModal] = useState(false);
const [groupByModel, setGroupByModel] = useState(true);

// Group jobs by model
const groupedJobs = useMemo(() => {
  if (!groupByModel) return { 'All Jobs': filteredJobs };

  return filteredJobs.reduce((groups, job) => {
    const model = job.model_name || 'Unknown Model';
    if (!groups[model]) groups[model] = [];
    groups[model].push(job);
    return groups;
  }, {} as Record<string, typeof filteredJobs>);
}, [filteredJobs, groupByModel]);

// Find best run per model group
const getBestRunInGroup = (jobs: typeof filteredJobs) => {
  return jobs.reduce((best, job) => {
    if (!best) return job;
    const jobLoss = job.best_eval_loss ?? job.final_eval_loss ?? Infinity;
    const bestLoss = best.best_eval_loss ?? best.final_eval_loss ?? Infinity;
    return jobLoss < bestLoss ? job : best;
  }, null as typeof filteredJobs[0] | null);
};
```

**UI Changes:**
- Add checkbox column to jobs list
- Add "Group by Model" toggle
- Add "Compare Selected (N)" floating button
- Add ComparisonModal component

### Phase 2: Dedicated Comparison View (3-5 days)

**Goal:** Full-featured comparison dashboard

**Components to Create:**

1. **ModelRunComparisonView.tsx**
   - Main comparison UI
   - Metric comparison table
   - Visual charts (overlaid loss curves)
   - Recommendation engine

2. **ComparisonMetricsTable.tsx**
   - Side-by-side metrics
   - Highlight best values
   - Calculate deltas (% difference)

3. **OverlaidLossChart.tsx**
   - Fetch metrics for multiple jobs
   - Overlay loss curves on same chart
   - Color-code by job
   - Show best checkpoint markers

4. **RunRecommendation.tsx**
   - Analyze metrics
   - Generate recommendation
   - Explain reasoning (better loss, faster, more efficient)

5. **BulkActionPanel.tsx**
   - Archive runs
   - Delete runs
   - Export comparison data

**Database Queries:**
```typescript
// Get all runs for a specific model
const { data: modelRuns } = await supabase
  .from('local_training_jobs')
  .select('*')
  .eq('model_name', modelName)
  .eq('user_id', userId)
  .order('created_at', { ascending: false });

// Get metrics for multiple jobs
const { data: metricsData } = await supabase
  .from('training_metrics')
  .select('*')
  .in('job_id', selectedJobIds)
  .order('step', { ascending: true });
```

### Phase 3: Advanced Features (5-7 days)

**Goal:** ML-powered insights and automation

**Features:**

1. **Auto-Archive**
   - Automatically archive runs >50% worse than best
   - Configurable threshold
   - One-click bulk archive

2. **Improvement Trends**
   - Track best_eval_loss across sequential runs
   - Show learning curve (are you improving?)
   - Suggest when to stop experimenting

3. **Hyperparameter Diff**
   - Compare configs between runs
   - Highlight what changed
   - Correlate changes with performance

4. **Export & Share**
   - Export comparison as CSV/JSON
   - Generate comparison report (markdown)
   - Share comparison link

5. **Checkpoint Management**
   - Quick deploy best checkpoint
   - Download best checkpoint
   - Compare checkpoint sizes

---

## Key Metrics to Compare

### Primary Metrics (Always Show)
1. **Best Eval Loss** - Main quality indicator
2. **Best Epoch** - When did it peak?
3. **Total Training Time** - Efficiency
4. **Final Perplexity** - Model confidence
5. **GPU Utilization Avg** - Resource efficiency

### Secondary Metrics (Expandable)
6. **Training Loss** - Convergence behavior
7. **Gradient Norm** - Training stability
8. **Learning Rate** - Optimization schedule
9. **Samples/Second** - Throughput
10. **Total Tokens Processed** - Data seen

### Derived Metrics (Calculated)
11. **Relative Performance** - % better/worse than best
12. **Efficiency Score** - (Quality / Time) ratio
13. **Cost** - GPU hours * rate (if tracked)
14. **Improvement Rate** - Loss reduction per epoch

---

## UI/UX Considerations

### Selection Experience
- **Auto-select best run** when grouping by model
- **Limit to 5 runs max** to avoid clutter
- **Persist selection** across page refreshes (URL params)
- **Quick actions** on hover (add to comparison, deploy, delete)

### Visual Design
- **Color coding** for runs (consistent across all charts)
- **Trophy icon** 🏆 for best run
- **Warning icon** ⚠️ for significantly worse runs (>25% worse)
- **Delta badges** showing +/- % difference

### Data Loading
- **Lazy load** comparison data (only when comparing)
- **Cache** metrics data for selected runs
- **Skeleton UI** while loading comparison

### Mobile Responsive
- **Scrollable table** on mobile
- **Swipe** between run details
- **Bottom sheet** for comparison on mobile

---

## Database Schema Considerations

### Current Schema (Sufficient)
```sql
-- local_training_jobs table has all needed fields
id
user_id
model_name
status
best_eval_loss
best_epoch
best_checkpoint_path
total_epochs
created_at
completed_at
-- ... and many more metrics
```

### Optional: Add Comparison State Table
```sql
CREATE TABLE training_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT, -- "Qwen2.5 Hyperparameter Sweep"
  model_name TEXT,
  job_ids UUID[], -- Array of job IDs being compared
  created_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);
```

**Benefits:**
- Save comparison sets for later
- Share comparisons with team
- Track comparison history

**Cons:**
- Extra complexity
- May not be needed initially

---

## Implementation Plan

### Week 1: Foundation (Phase 1)

**Day 1-2: Grouping & Selection**
- [ ] Add "Group by Model" toggle
- [ ] Implement job grouping logic
- [ ] Add checkboxes to job list
- [ ] Add "Compare Selected" button
- [ ] Create ComparisonModal skeleton

**Day 3: Basic Comparison**
- [ ] Create ComparisonMetricsTable component
- [ ] Fetch comparison data API
- [ ] Display side-by-side metrics
- [ ] Highlight best values

**Day 4-5: Visual Comparison**
- [ ] Create OverlaidLossChart component
- [ ] Fetch metrics for multiple jobs
- [ ] Render overlaid curves
- [ ] Add legend with job colors

### Week 2: Enhancement (Phase 2)

**Day 6-7: Recommendation Engine**
- [ ] Analyze metrics to pick best run
- [ ] Generate explanation text
- [ ] Create RunRecommendation component
- [ ] Add deploy/archive actions

**Day 8-9: Bulk Actions**
- [ ] Create BulkActionPanel
- [ ] Implement archive functionality
- [ ] Implement delete functionality
- [ ] Add confirmation modals

**Day 10: Polish**
- [ ] Mobile responsiveness
- [ ] Loading states
- [ ] Error handling
- [ ] User testing

### Week 3: Advanced (Phase 3 - Optional)

**Day 11-12: Auto-Archive**
- [ ] Threshold configuration
- [ ] Auto-identify underperformers
- [ ] Bulk archive suggestions

**Day 13-14: Trends & Export**
- [ ] Improvement tracking over time
- [ ] CSV/JSON export
- [ ] Comparison reports

**Day 15: Integration**
- [ ] Link to analytics assistant
- [ ] Add to training workflow
- [ ] Documentation

---

## API Requirements

### New Endpoints (Optional)

**1. GET `/api/training/compare`**
```typescript
// Get comparison data for multiple jobs
GET /api/training/compare?jobIds=id1,id2,id3

Response: {
  jobs: [/* job details */],
  metrics: {
    job_id1: [/* metrics timeline */],
    job_id2: [/* metrics timeline */],
  },
  recommendation: {
    best_job_id: "...",
    reasoning: "...",
    metrics: { /* best values */ }
  }
}
```

**2. POST `/api/training/bulk-action`**
```typescript
// Archive or delete multiple jobs
POST /api/training/bulk-action

Body: {
  action: "archive" | "delete",
  jobIds: ["id1", "id2", "id3"]
}
```

**Alternative: Use Existing Endpoints**
- Fetch jobs individually via `/api/training/local/[jobId]/status`
- Fetch metrics via `/api/training/metrics/[jobId]`
- No new endpoints needed (simpler)

---

## Success Criteria

### Usability
- [ ] User can compare 2-5 training runs in <10 seconds
- [ ] Best run is clearly identified
- [ ] Visual comparison makes differences obvious
- [ ] Bulk actions complete in <2 seconds

### Functionality
- [ ] Accurate metric comparison
- [ ] Correct best run identification
- [ ] Overlaid loss charts render smoothly
- [ ] Archive/delete works reliably

### Performance
- [ ] Comparison loads in <2 seconds
- [ ] No performance degradation with 10+ jobs
- [ ] Charts render without lag
- [ ] Mobile responsive

### User Satisfaction
- [ ] Reduces time to identify best run
- [ ] Makes cleanup of failed runs easy
- [ ] Provides actionable insights
- [ ] Feels natural in training workflow

---

## Open Questions for Discussion

1. **Grouping Strategy**
   - Group by exact model match or by model family?
   - Example: "Qwen/Qwen2.5-7B" vs "Qwen/Qwen2.5-7B-Instruct" - same group?

2. **Best Run Criteria**
   - Always use best_eval_loss? Or allow user to choose metric?
   - What if user wants fastest training time, not best loss?

3. **Bulk Actions**
   - Archive vs soft-delete vs hard-delete?
   - Should archived jobs be hidden or just marked?

4. **Comparison Limits**
   - Min 2 runs, max 5 runs? Or allow more?
   - Should we warn if comparing very different models?

5. **Data Retention**
   - Save comparison configurations?
   - Auto-delete comparisons after 30 days?

6. **Integration**
   - Should analytics assistant auto-suggest comparisons?
   - Link to deployment pipeline for best run?

---

## Alternative Approaches

### Approach A: Simple Table View
**Pros:** Fast to build, familiar UX
**Cons:** Limited visual insights, harder to spot patterns

### Approach B: Dashboard-First
**Pros:** Comprehensive, powerful analytics
**Cons:** Complex, takes longer to build

### Approach C: CLI Tool
**Pros:** Fast for power users, scriptable
**Cons:** Not accessible to all users, no visualization

---

## Recommendation

**Start with Phase 1 (Quick Wins)**
- Minimal risk, immediate value
- Tests user interest
- Can iterate based on feedback

**Then Phase 2 if validated**
- Builds on proven foundation
- Addresses power user needs
- Sets up for advanced features

**Phase 3 only if requested**
- Nice-to-have, not essential
- Can wait for user demand
- Resource-intensive

---

## Next Steps

1. **Discuss & Validate** - Review this doc together
2. **Choose Approach** - Phase 1, 2, 3 or custom?
3. **Create Implementation Plan** - Break into tasks
4. **Build Prototype** - Quick mockup to test UX
5. **Iterate** - Gather feedback, refine

---

**Questions? Let's discuss!**
