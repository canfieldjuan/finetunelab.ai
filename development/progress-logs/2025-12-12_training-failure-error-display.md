# Training Failure Error Display Feature

**Date:** 2025-12-12
**Status:** IN PROGRESS
**Goal:** Display training failure errors and intelligent analysis in the monitor page right panel

---

## Context

Users currently have no way to see why their training jobs failed. The infrastructure exists:
- `error_message` field is stored in the database
- `error_analyzer.py` provides intelligent analysis
- API endpoint `/api/training/local/[jobId]/analyze-failure` exists

**Missing:** UI to display this information to users.

## Requirements

- Show error information in the right panel of monitor page when a failed job is selected
- Display raw error message (expandable for long errors)
- Call analyze-failure API to get intelligent suggestions
- Show actionable fix recommendations

---

## Phased Implementation Plan

### Phase 1: Investigation & Analysis (CURRENT)
**Goal:** Understand current monitor page structure and find exact insertion points

**Tasks:**
- [ ] Read monitor page structure
- [ ] Identify the right panel component/section
- [ ] Find where job status determines what's displayed
- [ ] Identify all files that may be affected
- [ ] Document insertion points

### Phase 2: Create TrainingErrorPanel Component
**Goal:** Create isolated, testable component for error display

**Tasks:**
- [ ] Create `components/training/TrainingErrorPanel.tsx`
- [ ] Implement error message display (collapsible for long errors)
- [ ] Implement analyze-failure API call
- [ ] Display analysis results (error type, description, suggestions)
- [ ] Style consistent with existing UI
- [ ] Verify component compiles without errors

### Phase 3: Integration
**Goal:** Add component to monitor page without breaking existing functionality

**Tasks:**
- [ ] Find exact insertion point in monitor page
- [ ] Add conditional rendering for failed jobs
- [ ] Pass required props (jobId, error_message, auth token)
- [ ] Test with actual failed job
- [ ] Verify no breaking changes to existing functionality

### Phase 4: Verification
**Goal:** Ensure everything works correctly

**Tasks:**
- [ ] TypeScript compilation check
- [ ] Visual verification in browser
- [ ] Test with job that has error_message
- [ ] Test with job that has no error_message
- [ ] Test with running/completed jobs (should not show panel)

---

## Files Analysis

### Files to Read (Investigation)
| File | Purpose |
|------|---------|
| `app/training/monitor/page.tsx` | Main monitor page - need to understand structure |
| `lib/hooks/useTrainingJobsRealtime.ts` | TrainingJob interface - verify error_message field |

### Files to Create
| File | Purpose |
|------|---------|
| `components/training/TrainingErrorPanel.tsx` | New component for error display |

### Files to Modify
| File | Changes |
|------|---------|
| `app/training/monitor/page.tsx` | Add TrainingErrorPanel import and render |

### Files That May Be Affected (Need Verification)
| File | Risk |
|------|------|
| None expected | Component is additive, no existing code modified |

---

## Implementation Progress

### Session 1 (2025-12-12)

**Status:** Investigation complete, ready for implementation

**Key Findings:**

1. **Monitor Page Structure** (`app/training/monitor/page.tsx`):
   - Two modes: job selection list (!isMonitoring) and job monitoring (isMonitoring)
   - When monitoring, right panel shows: TrainingDashboard, charts, etc.
   - Failed/cancelled jobs already show `CheckpointResumeCard` (line 914)
   - `currentStatus` (TrainingJobStatus) has `error?: string` field

2. **Existing Infrastructure**:
   - `CheckpointResumeCard` fetches failure analysis but ONLY when checkpoints exist
   - Raw error_message is stored in database but NEVER shown to users
   - Analysis API endpoint exists: `/api/training/local/[jobId]/analyze-failure`

3. **The Gap**:
   - If job fails BEFORE creating checkpoints → users see "No checkpoints available"
   - The actual error_message is NOT displayed anywhere
   - Users can't see WHY their training failed

4. **Insertion Point Identified**:
   - Line 914 in monitor/page.tsx: Right before CheckpointResumeCard
   - Condition: `currentStatus && (currentStatus.status === STATUS.FAILED || currentStatus.status === STATUS.CANCELLED)`

**Solution:**
Create `TrainingErrorPanel` component that:
1. Shows raw error message (always visible for failed jobs)
2. Fetches and displays intelligent analysis
3. Shows BEFORE CheckpointResumeCard so users see error first, then recovery options

**Files Identified:**
- CREATE: `components/training/TrainingErrorPanel.tsx`
- MODIFY: `app/training/monitor/page.tsx` (add import + render)
- NO CHANGES to: CheckpointResumeCard.tsx (it handles recovery, not error display)

---

**Implementation Completed:**

1. **Created `components/training/TrainingErrorPanel.tsx`**
   - Displays raw error message (collapsible for long errors)
   - Fetches intelligent analysis from `/api/training/local/[jobId]/analyze-failure`
   - Shows error type, phase, description
   - Shows actionable suggestions with current → suggested values
   - Styled consistently with existing error UI (red theme)

2. **Modified `app/training/monitor/page.tsx`**
   - Added dynamic import for TrainingErrorPanel (line 77-80)
   - Added TrainingErrorPanel render BEFORE CheckpointResumeCard (line 917-924)
   - Same condition as CheckpointResumeCard: `STATUS.FAILED || STATUS.CANCELLED`
   - Props: jobId, errorMessage (from currentStatus.error), jobStatus

3. **Verified:**
   - TypeScript compilation: No errors
   - No breaking changes to existing functionality
   - Component is additive only

**User Experience Flow (for failed jobs):**
1. User clicks on failed job to monitor
2. TrainingErrorPanel shows at top with:
   - Red header "Training Failed"
   - Raw error message (expandable)
   - Intelligent analysis with suggestions
3. Below that, CheckpointResumeCard shows recovery options

---

### Additional Fix: URL State Consistency (2025-12-12)

**Problem:** Monitor page had inconsistent state management:
- State 1: `/training/monitor` - Job list (no jobId)
- State 2: `/training/monitor` - Monitoring (jobId in state only, NOT URL)
- State 3: `/training/monitor?jobId=xxx` - Monitoring (jobId in URL)

State 2 was problematic - refreshing lost job selection.

**Fix:**
1. Added `useRouter` import from `next/navigation`
2. Updated `handleStartMonitoring` to use `router.push()` instead of state
3. Updated job card click handler to use `router.push()`
4. Updated "Monitor Different Job" button to use `router.push('/training/monitor')`
5. Added `useEffect` to sync state with URL changes (URL is source of truth)

**Result:** URL always reflects current state:
- Clicking job → URL updates to `?jobId=xxx`
- Clicking "Monitor Different Job" → URL clears jobId
- Refresh works correctly
- Links can be shared/bookmarked

---

### Terminal Error Trace Panel (2025-12-12)

**Requirement:** Add verbose error tracking to terminal page, showing errors and tracing them back to source.

**Implementation:**

1. **Created `components/terminal/ErrorTracePanel.tsx`**
   - Only renders when `status === 'failed'`
   - Displays error message from job status
   - Extracts and shows stack trace from logs
   - Calls analyze-failure API for intelligent suggestions
   - Terminal-style theming (red/green/yellow on dark background)
   - "Copy" button to copy full error for sharing

2. **Modified `components/terminal/TerminalMonitor.tsx`**
   - Added ErrorTracePanel import
   - Renders after LogStream section
   - Passes: jobId, errorMessage, logs, status

**Features:**
- Error type/phase classification (from analysis)
- Main error message in red
- Collapsible stack trace with syntax highlighting
- Error logs filtered from recent_logs
- Suggested fixes with current → suggested values
- Copy-to-clipboard functionality

**Visual Structure:**
```
┌─────────────────────────────────────────┐
│ 🚨 ERROR TRACE                   [Copy] │
├─────────────────────────────────────────┤
│ Type: CUDA_OOM | Phase: Training        │
├─────────────────────────────────────────┤
│ Error Message:                          │
│ > RuntimeError: CUDA out of memory      │
├─────────────────────────────────────────┤
│ 💡 Analysis: Memory exhausted during... │
├─────────────────────────────────────────┤
│ Stack Trace (5 lines)          [▶ Show] │
├─────────────────────────────────────────┤
│ 🔧 Suggested Fixes:                     │
│   batch_size: 4 → 2                     │
│   gradient_checkpointing: false → true  │
└─────────────────────────────────────────┘
```

