# Stale Jobs Fix - Implementation Plan
**Created**: 2025-11-14
**Status**: AWAITING APPROVAL
**Estimated Time**: 2-4 days
**Risk Level**: LOW

---

## PROBLEM STATEMENT

Jobs in "Recent Training Jobs" display incorrect states because:
1. Database shows stale status (last persisted state)
2. Cleanup only runs on backend startup (once per restart)
3. Backend has been running since Nov 13 without cleanup
4. Jobs that died/failed after Nov 13 still show as "running"

**Example**: Job showing "running since 11/11/2025" but no actual training happening.

---

## SOLUTION OVERVIEW

Three-phase approach to fix stale job states:

**Phase 1**: Periodic database cleanup (CRITICAL)
- Add background task that runs every 10 minutes
- Marks stale jobs as failed automatically
- **Impact**: Stops accumulation of ghost jobs

**Phase 2**: Display reconciliation (IMPORTANT)
- Validate job status before displaying
- Check backend for actual state
- **Impact**: Users see accurate information

**Phase 3**: Resilient persistence (OPTIONAL)
- Improve error handling in persist_job()
- Add caching for offline scenarios
- **Impact**: Fewer missed database updates

---

## PHASE 1: PERIODIC DATABASE CLEANUP (CRITICAL)

### Objective
Add periodic background task to clean stale jobs every 10 minutes.

### Technical Approach

#### Step 1: Extract Cleanup Logic
**File**: `lib/training/training_server.py`

**Current**: Cleanup code is inline in `reconnect_orphaned_training_jobs()` (lines 885-958)

**Change**: Extract to separate async function:
```python
async def cleanup_stale_jobs():
    """
    Clean up stale jobs in database.
    Marks running/pending jobs as failed if:
    - Not in backend memory (jobs dict)
    - updated_at > 10 minutes old
    """
    # Same logic as startup cleanup
    # Query DB for running/pending jobs
    # Check if in memory
    # Mark stale ones as failed
```

**Lines to add**: ~80 lines (extracted + new function wrapper)
**Lines to modify**: ~5 lines (in reconnect function)
**Breaking changes**: NONE

#### Step 2: Add Periodic Task
**File**: `lib/training/training_server.py`

**Add background task**:
```python
async def periodic_cleanup_worker():
    """
    Background worker that runs cleanup every 10 minutes.
    """
    logger.info("[PeriodicCleanup] Worker started")
    while True:
        try:
            await asyncio.sleep(600)  # 10 minutes
            logger.info("[PeriodicCleanup] Running cleanup...")
            await cleanup_stale_jobs()
        except Exception as e:
            logger.error(f"[PeriodicCleanup] Error: {e}")
```

**Start on startup**:
```python
@app.on_event("startup")
async def startup_event():
    logger.info("[Startup] Starting job queue worker...")
    asyncio.create_task(queue_worker())
    asyncio.create_task(periodic_cleanup_worker())  # NEW
    logger.info("[Startup] Starting periodic cleanup worker...")
```

**Lines to add**: ~20 lines
**Lines to modify**: ~2 lines
**Breaking changes**: NONE

### Files Modified
1. `lib/training/training_server.py`
   - Extract cleanup logic: ~80 lines
   - Add periodic worker: ~20 lines
   - Update startup: ~2 lines
   - **Total**: ~100 lines added/modified

### Validation Steps
1. ✅ Python syntax check: `python3 -m py_compile training_server.py`
2. ✅ Restart backend
3. ✅ Check logs for `[PeriodicCleanup] Worker started`
4. ✅ Wait 10 minutes, verify cleanup runs
5. ✅ Manually create stale job (set updated_at to old date)
6. ✅ Wait for cleanup, verify marked as failed

### Success Criteria
- [ ] Periodic worker starts on backend startup
- [ ] Cleanup runs every 10 minutes
- [ ] Stale jobs marked as failed automatically
- [ ] Backend logs show cleanup activity
- [ ] No crashes or errors

### Rollback Plan
- Remove periodic_cleanup_worker function
- Remove asyncio.create_task(periodic_cleanup_worker())
- Restart backend

---

## PHASE 2: DISPLAY RECONCILIATION (IMPORTANT)

### Objective
Show accurate job status by validating against backend before display.

### Technical Approach

#### Option A: Frontend Reconciliation (Recommended)
**File**: `app/api/training/jobs/route.ts`

**Current**: Returns raw database data
**Change**: Validate "running" jobs against backend

```typescript
// After fetching from DB
const jobs = await supabase.from('local_training_jobs')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(20);

// Reconcile status for running jobs
const backendUrl = process.env.NEXT_PUBLIC_TRAINING_BACKEND_URL || 'http://localhost:8000';

for (const job of jobs.data || []) {
  if (job.status === 'running' || job.status === 'pending') {
    try {
      // Check if job actually exists in backend
      const response = await fetch(`${backendUrl}/api/training/status/${job.id}`, {
        method: 'GET',
        timeout: 2000  // 2 second timeout
      });

      if (!response.ok || response.status === 404) {
        // Job not in backend, mark as failed
        job.status = 'failed';
        job._reconciled = true;  // Flag for display
      }
    } catch (error) {
      // Backend unreachable, keep DB status
      console.warn(`Cannot validate job ${job.id}: ${error}`);
    }
  }
}

return NextResponse.json({ jobs: jobs.data });
```

**Lines to add**: ~25 lines
**Lines to modify**: ~5 lines
**Breaking changes**: NONE

#### Option B: Backend Endpoint (Alternative)
**File**: `lib/training/training_server.py`

Add new endpoint:
```python
@app.get("/api/training/validate-batch")
async def validate_job_batch(job_ids: str):
    """
    Validate multiple jobs at once.
    Returns: {job_id: true/false} for each job
    """
    ids = job_ids.split(',')
    result = {}
    for job_id in ids:
        result[job_id] = job_id in jobs  # True if in memory
    return result
```

**Then frontend calls this once instead of N times**

**Lines to add**: ~15 lines (backend), ~20 lines (frontend)
**Breaking changes**: NONE

### Files Modified

**Option A (Recommended)**:
1. `app/api/training/jobs/route.ts` (~30 lines)

**Option B**:
1. `lib/training/training_server.py` (~15 lines)
2. `app/api/training/jobs/route.ts` (~20 lines)

### Validation Steps
1. ✅ View recent jobs page
2. ✅ Verify jobs show correct status
3. ✅ Check network tab for backend calls
4. ✅ Manually create stale job in DB
5. ✅ Verify shows as failed, not running
6. ✅ Check performance (should be fast)

### Success Criteria
- [ ] Recent jobs display accurate status
- [ ] Stale jobs show as failed
- [ ] Page loads in < 2 seconds
- [ ] No errors in console
- [ ] Works when backend is down (graceful degradation)

### Rollback Plan
- Revert changes to `route.ts`
- Or delete new backend endpoint

---

## PHASE 3: RESILIENT PERSISTENCE (OPTIONAL)

### Objective
Reduce missed database updates when Next.js server is temporarily down.

### Technical Approach

**File**: `lib/training/training_server.py`

Add local cache for failed persist attempts:
```python
# Global cache for failed persists
failed_persists = {}  # {job_id: job_data}

async def persist_with_cache(job_id: str, job_data: Dict):
    """
    Persist job data, cache if fails, retry later.
    """
    success = persist_job(job_id, job_data)

    if not success:
        # Cache failed persist
        failed_persists[job_id] = job_data
        logger.warning(f"[Persist] Cached failed persist for {job_id}")
    elif job_id in failed_persists:
        # Succeeded, remove from cache
        del failed_persists[job_id]

    return success

async def retry_failed_persists():
    """
    Retry persisting cached failures every 5 minutes.
    """
    while True:
        await asyncio.sleep(300)  # 5 minutes
        if failed_persists:
            logger.info(f"[Persist] Retrying {len(failed_persists)} failed persists...")
            for job_id, job_data in list(failed_persists.items()):
                persist_with_cache(job_id, job_data)
```

**Lines to add**: ~40 lines
**Lines to modify**: ~10 lines (replace persist_job calls)
**Breaking changes**: NONE

### Files Modified
1. `lib/training/training_server.py` (~50 lines)

### Validation Steps
1. ✅ Start backend, start training job
2. ✅ Stop Next.js server
3. ✅ Verify persist fails, cached
4. ✅ Restart Next.js server
5. ✅ Wait 5 minutes, verify retry succeeds
6. ✅ Check database updated

### Success Criteria
- [ ] Failed persists cached locally
- [ ] Automatic retry every 5 minutes
- [ ] Eventually consistent database
- [ ] No data loss during Next.js downtime

### Rollback Plan
- Revert to direct persist_job() calls
- Remove cache and retry logic

---

## IMPLEMENTATION ORDER

### Day 1: Phase 1 (Critical)
**Morning**:
- Extract cleanup_stale_jobs() function
- Add periodic_cleanup_worker()
- Update startup event
- Python syntax validation

**Afternoon**:
- Restart backend
- Monitor logs
- Create test stale jobs
- Verify cleanup works
- Document results

**Deliverables**:
- Working periodic cleanup
- Test results
- Updated backend running

### Day 2: Phase 2 (Important)
**Morning**:
- Implement Option A (frontend reconciliation)
- TypeScript compilation check
- Deploy to dev

**Afternoon**:
- Test with real stale jobs
- Verify performance
- Test edge cases (backend down, etc.)
- Document results

**Deliverables**:
- Accurate status display
- Test results
- Updated frontend running

### Day 3-4: Phase 3 (Optional)
**Only if needed based on Phase 1-2 results**
- Implement caching
- Add retry logic
- Test offline scenarios
- Document

---

## RISKS AND MITIGATION

### Risk 1: Performance Impact
**Risk**: Periodic cleanup queries database every 10 minutes
**Likelihood**: LOW
**Impact**: MEDIUM
**Mitigation**:
- Index on `status` and `updated_at` columns
- Limit query to last 100 jobs
- Monitor query performance

### Risk 2: False Positives
**Risk**: Mark active job as failed incorrectly
**Likelihood**: LOW
**Impact**: HIGH
**Mitigation**:
- Only mark if updated_at > 10 minutes AND not in memory
- Increase threshold if needed (10 min → 30 min)
- Add logging for verification

### Risk 3: Backend/Frontend Desync
**Risk**: Backend down during reconciliation check
**Likelihood**: MEDIUM
**Impact**: LOW
**Mitigation**:
- Timeout on backend calls (2 seconds)
- Graceful fallback to DB status
- Log warnings, don't fail

### Risk 4: Race Conditions
**Risk**: Job completes during cleanup check
**Likelihood**: LOW
**Impact**: LOW
**Mitigation**:
- Cleanup checks memory BEFORE marking failed
- Use database transactions where possible
- Acceptable edge case (will fix next cycle)

---

## TESTING PLAN

### Unit Tests
- [ ] `cleanup_stale_jobs()` identifies correct jobs
- [ ] `periodic_cleanup_worker()` runs on schedule
- [ ] Reconciliation validates status correctly

### Integration Tests
- [ ] Create job, kill process, verify cleanup marks failed
- [ ] Backend restart, verify cleanup still works
- [ ] Next.js down, verify graceful degradation

### Manual Tests
- [ ] View recent jobs with stale data, verify corrected
- [ ] Monitor backend logs for 24 hours
- [ ] Check database consistency

---

## SUCCESS METRICS

**Before Fix**:
- Ghost jobs accumulate forever
- User sees incorrect "running" status
- Database fills with stale data

**After Fix**:
- Stale jobs cleaned within 10 minutes
- Recent jobs show accurate status
- Database stays clean

**Measurable Goals**:
- [ ] Zero stale jobs older than 10 minutes
- [ ] Status accuracy: 100%
- [ ] Cleanup overhead: < 100ms every 10 min
- [ ] No user-facing errors

---

## ROLLBACK STRATEGY

### Phase 1 Rollback
1. Remove `periodic_cleanup_worker()` function
2. Remove `asyncio.create_task(periodic_cleanup_worker())` from startup
3. Restart backend
**Time**: 2 minutes
**Risk**: NONE

### Phase 2 Rollback
1. Revert changes to `app/api/training/jobs/route.ts`
2. Rebuild Next.js
3. Redeploy frontend
**Time**: 5 minutes
**Risk**: NONE

### Phase 3 Rollback
1. Remove caching logic
2. Restore direct `persist_job()` calls
3. Restart backend
**Time**: 5 minutes
**Risk**: NONE

---

## POST-IMPLEMENTATION MONITORING

### Week 1: Daily Checks
- [ ] Review backend logs for cleanup activity
- [ ] Verify no stale jobs in database
- [ ] Check error rates in persist operations
- [ ] Monitor performance metrics

### Week 2-4: Weekly Checks
- [ ] Review overall job health
- [ ] Check for any edge cases
- [ ] Gather user feedback
- [ ] Optimize if needed

---

## APPROVAL CHECKLIST

Before starting implementation:
- [ ] User reviewed root cause analysis
- [ ] User approved implementation approach
- [ ] User confirmed which phases to implement
- [ ] User understands estimated timeline
- [ ] User aware of rollback plan

**Ready to proceed**: YES / NO / NEEDS CHANGES

---

## NEXT ACTIONS

1. **User Review**: User reviews this plan
2. **User Approval**: User says "GO" for specific phases
3. **Implementation**: Start with approved phases
4. **Testing**: Validate each phase before next
5. **Monitoring**: Track results for 1-2 weeks
6. **Iterate**: Optimize based on results

**Estimated Start Date**: TBD (awaiting approval)
**Estimated Completion**: 2-4 days from approval
