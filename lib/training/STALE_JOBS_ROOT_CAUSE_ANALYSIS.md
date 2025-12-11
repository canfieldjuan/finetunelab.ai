# Stale Jobs Root Cause Analysis
**Date**: 2025-11-14
**Issue**: Jobs showing incorrect states (running/pending when not actually running)
**Severity**: CRITICAL - Core functionality broken

---

## EXECUTIVE SUMMARY

**The Problem**: Jobs in the "Recent Training Jobs" list show stale states (e.g., "running since 11/11/2025" when no training is actually happening).

**Root Cause**: Database-backed state persistence without periodic reconciliation against actual backend state.

**Impact**:
- Users cannot trust job status display
- Dead jobs accumulate as "running" forever
- Database fills with garbage data
- Cannot determine actual training activity

---

## INVESTIGATION FINDINGS

### Backend Status ✅
```bash
ps aux | grep training_server
# Result: Backend running since Nov 13 (PID 1208495)
# Port: 8000
# Status: RUNNING
```

### What Actually Happens

#### Job Lifecycle - Normal Flow
1. **Job Creation**:
   - Frontend submits job → Backend `/api/training/execute`
   - Backend creates JobStatus in memory with `status='queued'`
   - Backend calls `persist_job()` → POST `/api/training/local/jobs`
   - Database record created: `status='queued'`

2. **Job Execution**:
   - Queue worker picks up job
   - Status changes to `status='running'`
   - `monitor_job()` task starts
   - Every 2 seconds: reads `progress.json` → calls `persist_job()` → DB updated

3. **Job Completion**:
   - Training finishes
   - Status changes to `status='completed'`
   - Final `persist_job()` call
   - Database updated: `status='completed'`

#### What Goes Wrong - Stale Jobs

**Scenario 1: Backend Crashes**
1. Job is running, DB shows `status='running'`
2. Backend crashes/restarts
3. `monitor_job()` stops → No more DB updates
4. **Result**: DB frozen at `status='running'` forever

**Scenario 2: Training Process Dies**
1. Job running, DB shows `status='running'`
2. Python training process killed/crashes
3. `monitor_job()` detects completion, marks as failed
4. But if monitor crashes too → **DB frozen as `running`**

**Scenario 3: Next.js Server Down**
1. Job running normally
2. Next.js server down/restarted
3. Backend calls `persist_job()` → fails (connection error)
4. `persist_job()` retries 3 times, all fail
5. **Result**: DB not updated, shows stale state

**Scenario 4: Server Runs Continuously**
1. Backend started Nov 13, startup cleanup runs
2. Jobs created/started AFTER Nov 13
3. Some jobs get stuck/die
4. No cleanup runs (only on startup)
5. **Result**: Stale jobs accumulate

---

## VERIFIED CODE ANALYSIS

### Stale Job Cleanup - ONLY On Startup ❌

**File**: `training_server.py` (Lines 885-958)
**Function**: `reconnect_orphaned_training_jobs()`
**Trigger**: `@app.on_event("startup")` - RUNS ONCE

**What It Does**:
```python
# 1. Query database for jobs with status='running' or status='pending'
db_response = supabase.table('local_training_jobs')
    .select('id, status, updated_at, model_name')
    .in_('status', ['running', 'pending'])
    .execute()

# 2. For each job:
#    - If job in backend memory (jobs dict) → Skip (it's active)
#    - If updated_at > 10 minutes old → Mark as failed
#    - Else → Leave alone

# 3. Update stale jobs in database
supabase.table('local_training_jobs').update({
    'status': 'failed',
    'completed_at': datetime.now().isoformat(),
    'config': {'error': 'Process terminated...'}
}).eq('id', job_id).execute()
```

**The Problem**:
- ❌ Only runs on backend startup
- ❌ Backend running since Nov 13 → No cleanup since then
- ❌ Jobs stuck AFTER Nov 13 never cleaned up
- ❌ No periodic reconciliation

### Recent Jobs Display - Shows Stale Data ❌

**File**: `app/api/training/jobs/route.ts`
**Endpoint**: `GET /api/training/jobs`

**What It Does**:
```typescript
// Fetch DIRECTLY from database
const { data: jobs } = await supabase
  .from('local_training_jobs')
  .select('id, model_name, status, started_at, completed_at, created_at')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(20);

// Return whatever status is in DB
return NextResponse.json({ jobs });
```

**The Problem**:
- ❌ Shows raw database status
- ❌ No validation against backend
- ❌ No freshness check
- ❌ Displays "running" even if backend doesn't have the job

---

## THE ACTUAL STATE OF THINGS

### What Database Shows (Stale)
- Job A: `status='running'`, `updated_at='2025-11-11'` ← **GHOST**
- Job B: `status='pending'`, `updated_at='2025-11-12'` ← **GHOST**
- Job C: `status='queued'`, `updated_at='2025-11-14'` ← Maybe real?

### What Backend Actually Has (Truth)
- Backend memory (`jobs` dict): Only ACTIVE jobs
- If job not in `jobs` dict → NOT RUNNING
- Jobs disappear from memory on completion/failure

### The Gap
**Database ≠ Backend Reality**

---

## WHY PREVIOUS "SOLUTIONS" DIDN'T HELP

### What I Built (That Wasn't Needed)
1. **Force-start endpoint** - Solves a problem that doesn't exist
   - User already has resume functionality
   - Real issue: Jobs showing wrong state, not inability to start

2. **JobRecoveryCard** - UI for a non-problem
   - Shows "Start Job" for jobs that don't need starting
   - Real issue: Jobs shouldn't show as stuck in first place

3. **Queued job recovery** - Partially useful
   - Helps on restart
   - But doesn't solve continuous operation issue

### What Actually Needed
- **Periodic reconciliation** - Clean stale jobs while backend runs
- **Accurate status display** - Show truth, not stale DB data
- **Better monitoring** - Detect when jobs die

---

## THE REAL FIXES NEEDED

### Fix 1: Periodic Stale Job Cleanup (CRITICAL)
**What**: Background task running every 5-10 minutes
**How**: Same logic as startup cleanup, but periodic
**Impact**: Stale jobs cleaned up automatically

### Fix 2: Status Reconciliation on Display (IMPORTANT)
**What**: When showing recent jobs, validate against backend
**How**: For each job with status='running', check if in backend memory
**Impact**: Display shows accurate state

### Fix 3: Better Job State Transitions (NICE TO HAVE)
**What**: More robust error handling in persist_job()
**How**: Local cache if Next.js server down, sync later
**Impact**: Fewer missed updates

---

## VERIFIED TIMELINE

**Nov 13**: Backend started (last restart)
- Startup cleanup ran
- Old stale jobs cleaned up

**Nov 13 - Nov 14**: Backend running continuously
- Jobs created and executed
- Some jobs failed/died
- No cleanup ran
- Stale jobs accumulated

**Nov 14**: User discovers issue
- Multiple jobs showing wrong states
- Ghost job "running since 11/11" still in DB
- Actual root cause identified

---

## RECOMMENDATION

Implement in this order:

**Phase 1 (Critical - 1 day)**:
- Add periodic stale job cleanup (every 10 minutes)
- Use existing cleanup logic
- Minimal code changes
- **Impact**: Stops accumulation of stale jobs

**Phase 2 (Important - 1 day)**:
- Modify "Recent Jobs" to show reconciled state
- Query backend for each "running" job
- Display actual state
- **Impact**: Users see truth

**Phase 3 (Nice to have - 2 days)**:
- Improve persist_job() resilience
- Add local caching
- Better error recovery
- **Impact**: Fewer sync failures

---

## FILES TO MODIFY

### Phase 1: Periodic Cleanup
**File**: `lib/training/training_server.py`
- Extract cleanup logic into separate function
- Add background asyncio task
- Run every 10 minutes
- **Lines to modify**: ~50 lines
- **Breaking changes**: NONE

### Phase 2: Display Reconciliation
**File**: `app/api/training/jobs/route.ts`
- After fetching from DB, validate "running" jobs
- Call backend `/api/training/status/{id}` for each
- Update status before returning
- **Lines to modify**: ~30 lines
- **Breaking changes**: NONE

---

## NEXT STEPS

1. Create phased implementation plan
2. Get user approval
3. Implement Phase 1 (periodic cleanup)
4. Test with existing stale jobs
5. Implement Phase 2 (display reconciliation)
6. Monitor for 24 hours
7. Implement Phase 3 if needed

**Estimated Total Time**: 2-4 days
**Risk**: LOW - No breaking changes, incremental improvements
