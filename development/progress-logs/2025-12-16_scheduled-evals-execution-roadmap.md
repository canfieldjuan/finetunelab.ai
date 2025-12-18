# Scheduled Evaluations - Execution Roadmap
**Date**: December 16, 2025
**Implementation Approach**: Option B - Standalone Worker (Render)
**Status**: Ready for Execution

---

## Pre-Execution Verification ✅

### Files Located and Verified:

#### Files to MODIFY:
1. ✅ `lib/batch-testing/types.ts` - Verified (84 lines, ends with BatchTestResult interface)
   - **Insertion Point**: After line 84
   - **Change**: Add 3 new interfaces (ScheduleType, ScheduledEvaluation, ScheduledEvaluationRun)
   - **Impact**: NO BREAKING CHANGES - only additions

2. ✅ `app/api/batch-testing/run/route.ts` - Verified (line 240-269 checked)
   - **Insertion Point**: After line 251 (after auth result)
   - **Change**: Add scheduled run detection headers
   - **Impact**: NO BREAKING CHANGES - new headers are optional

3. ✅ `app/testing/page.tsx` - Verified (43 lines)
   - **Insertion Point**: Lines 28-30 (in space-y-6 div)
   - **Change**: Add ScheduledEvaluationManager component
   - **Impact**: NO BREAKING CHANGES - adds new component alongside existing

4. ✅ `package.json` - Verified (scripts section lines 4-23)
   - **Insertion Point**: After line 22 (after generate:sdk:python)
   - **Change**: Add "scheduler:start": "tsx scripts/start-scheduler-worker.ts"
   - **Impact**: NO BREAKING CHANGES - new script only

#### Files to CREATE (zero breaking changes):
1. `supabase/migrations/20251216000000_create_scheduled_evaluations.sql`
2. `lib/evaluation/schedule-calculator.ts`
3. `lib/evaluation/scheduler-worker.ts`
4. `scripts/start-scheduler-worker.ts`
5. `app/api/scheduled-evaluations/route.ts`
6. `app/api/scheduled-evaluations/[id]/route.ts`
7. `app/api/scheduled-evaluations/[id]/toggle/route.ts`
8. `app/api/scheduled-evaluations/[id]/runs/route.ts`
9. `components/evaluation/ScheduledEvaluationList.tsx`
10. `components/evaluation/ScheduledEvaluationForm.tsx`
11. `components/evaluation/ScheduleRunHistory.tsx`

---

## Phase 1: Database Foundation (2-3 hours)

### Task 1.1: Create Migration File ✅ Ready
**File**: `supabase/migrations/20251216000000_create_scheduled_evaluations.sql` (NEW)

**Purpose**: Create database tables for scheduled evaluations

**Tables Created**:
1. `scheduled_evaluations` - Stores schedule configurations
2. `scheduled_evaluation_runs` - Audit trail of executions

**Verification Steps**:
```bash
# Apply migration
psql $DATABASE_URL -f supabase/migrations/20251216000000_create_scheduled_evaluations.sql

# Verify tables exist
psql $DATABASE_URL -c "\d scheduled_evaluations"
psql $DATABASE_URL -c "\d scheduled_evaluation_runs"

# Test RLS policies
psql $DATABASE_URL -c "SET ROLE authenticated; SELECT * FROM scheduled_evaluations;"

# Test indexes
psql $DATABASE_URL -c "EXPLAIN SELECT * FROM scheduled_evaluations WHERE next_run_at <= NOW() AND is_active = true;"
```

**Success Criteria**:
- [ ] Tables created without errors
- [ ] Indexes exist and are used
- [ ] RLS policies enforce user isolation
- [ ] Cascading deletes work correctly

---

### Task 1.2: Add TypeScript Types ✅ Ready
**File**: `lib/batch-testing/types.ts` (MODIFY)

**Insertion Point**: Line 85 (after BatchTestResult interface)

**Code to Add** (90 lines):
```typescript
// ============================================================================
// SCHEDULED EVALUATIONS TYPES
// ============================================================================

/**
 * Schedule type - defines how often evaluations run
 */
export type ScheduleType = 'hourly' | 'daily' | 'weekly' | 'custom';

/**
 * Scheduled evaluation record - stores recurring evaluation configuration
 */
export interface ScheduledEvaluation {
  id: string;
  user_id: string;

  // Schedule identification
  name: string;
  description?: string;

  // Schedule configuration
  schedule_type: ScheduleType;
  cron_expression?: string;  // For future 'custom' schedules
  timezone: string;

  // Test configuration
  test_suite_id: string;
  model_id: string;
  batch_test_config: BatchTestConfig;

  // Status tracking
  is_active: boolean;
  last_run_at?: string;
  next_run_at: string;
  last_run_status?: 'success' | 'failed' | 'cancelled';
  last_run_id?: string;
  consecutive_failures: number;

  // Alerting configuration
  alert_on_failure: boolean;
  alert_on_regression: boolean;
  regression_threshold_percent: number;

  // Metadata
  created_at: string;
  updated_at: string;
}

/**
 * Scheduled evaluation run record - tracks execution history
 */
export interface ScheduledEvaluationRun {
  id: string;
  scheduled_evaluation_id: string;
  batch_test_run_id?: string;

  // Execution tracking
  status: 'triggered' | 'running' | 'completed' | 'failed' | 'cancelled';
  triggered_at: string;
  started_at?: string;
  completed_at?: string;

  // Results summary (denormalized for quick queries)
  total_prompts?: number;
  successful_prompts?: number;
  failed_prompts?: number;
  avg_latency_ms?: number;
  avg_quality_score?: number;

  // Regression detection (Phase 2)
  regression_detected: boolean;
  regression_details?: Record<string, unknown>;
  baseline_run_id?: string;

  // Error tracking
  error_message?: string;
  error_details?: Record<string, unknown>;

  created_at: string;
}
```

**Verification Steps**:
```bash
# Compile TypeScript
npx tsc --noEmit lib/batch-testing/types.ts

# Check for errors
echo $?  # Should be 0
```

**Success Criteria**:
- [ ] TypeScript compiles without errors
- [ ] No breaking changes to existing types
- [ ] Interfaces align with database schema

---

## Phase 2: API Endpoints (3-4 hours)

### Task 2.1: Main CRUD Endpoint ✅ Ready
**File**: `app/api/scheduled-evaluations/route.ts` (NEW - ~300 lines)

**Purpose**: List and create scheduled evaluations

**Endpoints**:
- `GET /api/scheduled-evaluations` - List user's schedules
- `POST /api/scheduled-evaluations` - Create new schedule

**Dependencies**:
- `lib/batch-testing/types.ts` (will exist after Task 1.2)
- `lib/evaluation/schedule-calculator.ts` (will create in Phase 3)

**Verification Steps**:
```bash
# Test GET
curl -X GET http://localhost:3000/api/scheduled-evaluations \
  -H "Authorization: Bearer $TOKEN"

# Test POST
curl -X POST http://localhost:3000/api/scheduled-evaluations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hourly Quality Check",
    "schedule_type": "hourly",
    "test_suite_id": "uuid-here",
    "model_id": "gpt-4-turbo"
  }'
```

**Success Criteria**:
- [ ] GET returns user's schedules (empty array for new users)
- [ ] POST creates schedule and returns 201
- [ ] POST calculates next_run_at correctly
- [ ] RLS policies enforced
- [ ] Validation rejects invalid input (400)

---

### Task 2.2: Individual Schedule Operations ✅ Ready
**File**: `app/api/scheduled-evaluations/[id]/route.ts` (NEW - ~200 lines)

**Purpose**: Get, update, delete individual schedules

**Endpoints**:
- `GET /api/scheduled-evaluations/[id]`
- `PATCH /api/scheduled-evaluations/[id]`
- `DELETE /api/scheduled-evaluations/[id]`

**Verification Steps**:
```bash
# Test GET
curl -X GET http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID \
  -H "Authorization: Bearer $TOKEN"

# Test PATCH
curl -X PATCH http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'

# Test DELETE
curl -X DELETE http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Success Criteria**:
- [ ] GET returns 404 for non-existent ID
- [ ] PATCH updates and recalculates next_run_at if schedule_type changed
- [ ] DELETE removes schedule and cascade deletes runs
- [ ] RLS prevents accessing other users' schedules

---

### Task 2.3: Toggle Active Status ✅ Ready
**File**: `app/api/scheduled-evaluations/[id]/toggle/route.ts` (NEW - ~100 lines)

**Purpose**: Quick enable/disable without full update

**Endpoint**:
- `POST /api/scheduled-evaluations/[id]/toggle`

**Verification Steps**:
```bash
# Toggle schedule
curl -X POST http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID/toggle \
  -H "Authorization: Bearer $TOKEN"

# Verify status changed
curl -X GET http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.is_active'
```

**Success Criteria**:
- [ ] POST toggles is_active boolean
- [ ] Returns updated schedule object
- [ ] Works for both true→false and false→true

---

### Task 2.4: Run History ✅ Ready
**File**: `app/api/scheduled-evaluations/[id]/runs/route.ts` (NEW - ~150 lines)

**Purpose**: Get execution history for a schedule

**Endpoint**:
- `GET /api/scheduled-evaluations/[id]/runs`

**Verification Steps**:
```bash
# Get run history
curl -X GET http://localhost:3000/api/scheduled-evaluations/$SCHEDULE_ID/runs \
  -H "Authorization: Bearer $TOKEN"
```

**Success Criteria**:
- [ ] Returns runs ordered by created_at DESC
- [ ] Pagination works (limit/offset)
- [ ] RLS enforced via schedule ownership

---

### Task 2.5: Modify Batch Testing API ✅ Ready
**File**: `app/api/batch-testing/run/route.ts` (MODIFY)

**Insertion Point**: Line 252 (right after line 251: `const auth = authResult.auth;`)

**Code to Add** (~25 lines):
```typescript
    // Detect scheduled evaluation run
    const isScheduledRun = req.headers.get('x-scheduled-evaluation') === 'true';
    const scheduledEvalId = req.headers.get('x-scheduled-evaluation-id');

    let scheduledEvaluationRunId: string | null = null;

    if (isScheduledRun && scheduledEvalId) {
      console.log('[Batch Testing Run] Scheduled evaluation run:', scheduledEvalId);

      // Create scheduled_evaluation_run record
      const { data: schedRun, error: schedError } = await supabaseWriteClient
        .from('scheduled_evaluation_runs')
        .insert({
          scheduled_evaluation_id: scheduledEvalId,
          status: 'triggered',
          triggered_at: new Date().toISOString()
        })
        .select()
        .single();

      if (schedError) {
        console.error('[Batch Testing Run] Failed to create scheduled run:', schedError);
      } else {
        scheduledEvaluationRunId = schedRun?.id || null;
      }
    }
```

**Impact Analysis**:
- ✅ NO BREAKING CHANGES
- ✅ New headers are optional - existing batch tests unchanged
- ✅ Only adds functionality when headers present
- ✅ Does not modify existing request/response contracts

**Verification Steps**:
```bash
# Test existing batch test (no scheduled headers)
curl -X POST http://localhost:3000/api/batch-testing/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {...}}'
# Should work exactly as before

# Test with scheduled headers
curl -X POST http://localhost:3000/api/batch-testing/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-scheduled-evaluation: true" \
  -H "x-scheduled-evaluation-id: $SCHEDULE_ID" \
  -H "Content-Type: application/json" \
  -d '{"config": {...}}'
# Should create scheduled_evaluation_run record
```

**Success Criteria**:
- [ ] Existing batch tests work unchanged
- [ ] Scheduled headers trigger run record creation
- [ ] scheduledEvaluationRunId is passed through (for future linking)

---

## Phase 3: Background Worker (4-5 hours)

### Task 3.1: Schedule Calculator ✅ Ready
**File**: `lib/evaluation/schedule-calculator.ts` (NEW - ~150 lines)

**Purpose**: Calculate next run time based on schedule type

**Functions**:
- `calculateNextRun(scheduleType, timezone, fromTime?)` → Date
- `isTimeDue(nextRunAt, currentTime?)` → boolean

**Dependencies**: NONE (pure utility functions)

**Verification Steps**:
```bash
# Create test file
cat > lib/evaluation/__tests__/schedule-calculator.test.ts << 'EOF'
import { calculateNextRun } from '../schedule-calculator';

describe('calculateNextRun', () => {
  it('calculates hourly schedule', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const next = calculateNextRun('hourly', 'UTC', now);
    expect(next).toEqual(new Date('2025-01-15T11:00:00Z'));
  });

  it('calculates daily schedule at 2 AM', () => {
    const now = new Date('2025-01-15T10:00:00Z');
    const next = calculateNextRun('daily', 'UTC', now);
    expect(next).toEqual(new Date('2025-01-16T02:00:00Z'));
  });

  it('calculates weekly schedule on Monday 2 AM', () => {
    const now = new Date('2025-01-15T10:00:00Z'); // Wednesday
    const next = calculateNextRun('weekly', 'UTC', now);
    expect(next).toEqual(new Date('2025-01-20T02:00:00Z')); // Next Monday
  });
});
EOF

# Run tests
npm run test:vitest lib/evaluation/__tests__/schedule-calculator.test.ts
```

**Success Criteria**:
- [ ] All unit tests pass
- [ ] Hourly: adds exactly 1 hour
- [ ] Daily: next day at 2 AM
- [ ] Weekly: next Monday at 2 AM
- [ ] Handles timezone conversions correctly

---

### Task 3.2: Scheduler Worker ✅ Ready
**File**: `lib/evaluation/scheduler-worker.ts` (NEW - ~500 lines)

**Purpose**: Background process to check and execute due evaluations

**Class**: `EvaluationSchedulerWorker`

**Methods**:
- `start()` - Start the worker loop
- `stop()` - Stop the worker
- `tick()` - Check for due evaluations (called every minute)
- `getDueEvaluations()` - Query database
- `executeEvaluation(eval)` - Trigger batch test
- `scheduleNextRun(eval, status, batchTestRunId)` - Update next_run_at
- `handleFailure(eval, error)` - Handle errors, auto-disable after 3 failures

**Dependencies**:
- `lib/evaluation/schedule-calculator.ts`
- `@supabase/supabase-js`
- Batch testing API (internal fetch)

**Configuration**:
```typescript
const WORKER_INTERVAL_MS = 60000; // Check every minute
const MAX_CONCURRENT_EVALS = 3; // Concurrency limit
```

**Verification Steps**:
```bash
# Dry run test
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
tsx scripts/start-scheduler-worker.ts

# Monitor logs
# Should see:
# [EvalScheduler] Worker started - check interval: 60000
# [EvalScheduler] No due evaluations
# (repeats every minute)

# Create test schedule with next_run_at in past
# Should trigger execution
```

**Success Criteria**:
- [ ] Worker starts without errors
- [ ] Detects due evaluations correctly
- [ ] Triggers batch tests successfully
- [ ] Updates next_run_at after execution
- [ ] Handles failures gracefully
- [ ] Auto-disables after 3 consecutive failures
- [ ] Respects MAX_CONCURRENT_EVALS limit

---

### Task 3.3: Worker Startup Script ✅ Ready
**File**: `scripts/start-scheduler-worker.ts` (NEW - ~50 lines)

**Purpose**: Entry point for standalone worker

**Features**:
- Loads environment variables
- Creates worker instance
- Handles graceful shutdown (SIGINT/SIGTERM)

**Verification Steps**:
```bash
# Test startup
npm run scheduler:start

# Should see:
# Starting Evaluation Scheduler Worker...
# Environment: development
# Supabase URL: https://...
# [EvalScheduler] Worker started

# Test shutdown (Ctrl+C)
# Should see:
# Received SIGINT, shutting down...
# [EvalScheduler] Worker stopped
```

**Success Criteria**:
- [ ] Worker starts successfully
- [ ] Environment variables loaded
- [ ] Graceful shutdown works
- [ ] Process exits cleanly

---

### Task 3.4: Add NPM Script ✅ Ready
**File**: `package.json` (MODIFY)

**Insertion Point**: Line 23 (after "generate:sdk:python")

**Code to Add**:
```json
    "scheduler:start": "tsx scripts/start-scheduler-worker.ts"
```

**Verification Steps**:
```bash
# Test script
npm run scheduler:start

# Should start worker
```

**Success Criteria**:
- [ ] Script is callable via npm run
- [ ] No syntax errors in package.json

---

## Phase 4: UI Components (5-6 hours)

### Task 4.1: Scheduled Evaluation List ✅ Ready
**File**: `components/evaluation/ScheduledEvaluationList.tsx` (NEW - ~400 lines)

**Purpose**: Display all user's schedules

**Features**:
- Table view with columns: Name, Schedule, Model, Next Run, Status, Actions
- Filter by status (active/paused)
- Sort by name, next run, last run
- Quick actions: Enable/Disable, Edit, Delete, View History
- Empty state for no schedules

**Dependencies**:
- API: `/api/scheduled-evaluations`
- Components: shadcn/ui table, buttons, dialogs

**Verification Steps**:
```bash
# Start dev server
npm run dev

# Navigate to /testing page
# Should see list component (empty initially)

# Create a schedule via API or form
# Should appear in list

# Click Enable/Disable toggle
# Should update is_active status

# Click Delete
# Should show confirmation and delete
```

**Success Criteria**:
- [ ] List displays correctly
- [ ] Filters work
- [ ] Sorting works
- [ ] Actions trigger correct API calls
- [ ] Empty state shows when no schedules
- [ ] Loading states shown during API calls

---

### Task 4.2: Scheduled Evaluation Form ✅ Ready
**File**: `components/evaluation/ScheduledEvaluationForm.tsx` (NEW - ~500 lines)

**Purpose**: Create/edit schedules

**Features**:
- Form fields: Name, Description, Schedule Type, Test Suite, Model
- Schedule type selector (Hourly/Daily/Weekly)
- Test suite dropdown (loads from /api/test-suites)
- Model dropdown (loads from /api/models)
- Batch config options (concurrency, delays)
- Alert options (alert on failure/regression)
- Form validation
- Submit handler

**Dependencies**:
- API: `/api/scheduled-evaluations`
- API: `/api/test-suites`
- API: `/api/models`

**Verification Steps**:
```bash
# Open form (create mode)
# All fields empty
# Validation prevents submission

# Fill required fields
# Submit
# Should create schedule and close form

# Open form (edit mode with existing schedule)
# Fields pre-populated
# Submit
# Should update schedule
```

**Success Criteria**:
- [ ] Form validates required fields
- [ ] Dropdowns load correctly
- [ ] Create mode works
- [ ] Edit mode works
- [ ] Error messages shown on failure

---

### Task 4.3: Schedule Run History ✅ Ready
**File**: `components/evaluation/ScheduleRunHistory.tsx` (NEW - ~400 lines)

**Purpose**: Display execution history

**Features**:
- Table with columns: Time, Status, Results, Duration, Actions
- Link to full batch test results
- Trend chart (success rate over time)
- Export to CSV
- Pagination

**Dependencies**:
- API: `/api/scheduled-evaluations/[id]/runs`
- Chart library: recharts

**Verification Steps**:
```bash
# Click "View History" on a schedule
# Should show modal/page with history

# Should see table of past runs
# Click on run to see details
# Should navigate to batch test results

# Click export
# Should download CSV
```

**Success Criteria**:
- [ ] History loads correctly
- [ ] Pagination works
- [ ] Links to batch test results work
- [ ] Export generates valid CSV
- [ ] Chart displays correctly

---

### Task 4.4: Integrate with Testing Page ✅ Ready
**File**: `app/testing/page.tsx` (MODIFY)

**Insertion Point**: Lines 28-30 (in the `<div className="space-y-6">`)

**Code to Add**:
```tsx
        <ScheduledEvaluationManager sessionToken={session?.access_token || ''} />
```

**Also need to**:
- Import: `import { ScheduledEvaluationManager } from '@/components/evaluation/ScheduledEvaluationManager';`
- Create wrapper component that includes List + Form

**Verification Steps**:
```bash
# Navigate to /testing page
# Should see new section for scheduled evaluations

# Click "+ New Schedule"
# Should open form

# Create schedule
# Should appear in list

# All existing functionality (BenchmarkManager, BatchTesting) unchanged
```

**Success Criteria**:
- [ ] New section appears on page
- [ ] Existing functionality unchanged
- [ ] No console errors
- [ ] Responsive design works

---

## Deployment Instructions

### For Render.com:

1. **Create New Background Worker Service**:
   - Service Type: Background Worker
   - Build Command: `npm install`
   - Start Command: `npm run scheduler:start`

2. **Environment Variables**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   NEXT_PUBLIC_APP_URL=<your-app-url>
   NODE_ENV=production
   ```

3. **Health Check** (optional):
   - Path: `/api/cron/scheduled-evaluations/health`
   - Interval: 5 minutes

4. **Scaling**:
   - Instances: 1 (only need one worker)
   - Auto-scaling: Off

---

## Testing Checklist

### Unit Tests:
- [ ] Schedule calculator tests pass
- [ ] Worker tests pass (if added)

### Integration Tests:
- [ ] API endpoints return correct status codes
- [ ] RLS policies enforced
- [ ] Database operations work correctly

### End-to-End Tests:
- [ ] Create schedule via UI → appears in list
- [ ] Edit schedule → updates correctly
- [ ] Delete schedule → removes from list
- [ ] Worker detects due schedule → executes batch test
- [ ] Batch test completes → schedule updates next_run_at
- [ ] Failure handling → increments consecutive_failures
- [ ] 3 failures → auto-disables schedule

---

## Rollback Plan

### If Issues Arise:

1. **Stop Worker**:
   ```bash
   # On Render: Stop the background worker service
   ```

2. **Disable All Schedules**:
   ```sql
   UPDATE scheduled_evaluations SET is_active = false;
   ```

3. **Revert Code Changes**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

4. **Remove Tables** (last resort):
   ```sql
   DROP TABLE IF EXISTS scheduled_evaluation_runs CASCADE;
   DROP TABLE IF EXISTS scheduled_evaluations CASCADE;
   ```

---

## Success Metrics

### Technical:
- [ ] 0 breaking changes to existing APIs
- [ ] < 200ms API response time
- [ ] < 60s to detect and trigger due evaluation
- [ ] Worker runs continuously without crashes

### User Experience:
- [ ] Create schedule in < 30 seconds
- [ ] Schedules execute within 1 minute of due time
- [ ] UI responsive and error-free

---

## Next Steps

1. ✅ Execution roadmap complete
2. ⏳ Begin Phase 1: Database migration
3. ⏳ Proceed through phases sequentially
4. ⏳ Test after each phase
5. ⏳ Deploy worker to Render

**Status**: Ready to begin implementation
**Awaiting**: User approval to proceed with Phase 1
