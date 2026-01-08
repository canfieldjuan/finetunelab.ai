# OLD Usage System - Recording Calls Audit

## Summary

Found **24 calls** to `recordUsageEvent()` across **10 API route files** and **2 library files**.

## Core Function

**lib/usage/checker.ts:85**
```typescript
export async function recordUsageEvent(...)
```

This is the core function that records events to the `usage_events` table.

## All Recording Locations

### 1. Chat API (app/api/chat/route.ts)
- **Import:** Line 28
- **Call 1:** Line 1287 - Records chat messages
- **Call 2:** Line 1937 - Records chat messages (alternate path)

### 2. Research API (app/api/research/route.ts)
- **Import:** Line 4
- **Call:** Line 32 - Records research job creation

### 3. GraphRAG Search (app/api/graphrag/search/route.ts)
- **Import:** Line 4
- **Call:** Line 41 - Records GraphRAG search queries

### 4. Batch Testing (app/api/batch-testing/run/route.ts)
- **Import:** Line 137
- **Call 1:** Line 490 - Records batch test runs
- **Call 2:** Line 798 - Records batch test runs (completion)

### 5. Analytics Chat (app/api/analytics/chat/route.ts)
- **Import:** Line 14
- **Call:** Line 2093 - Records analytics assistant queries

### 6. Anomaly Detection (app/api/analytics/anomalies/detect/route.ts)
- **Import:** Line 4
- **Call:** Line 297 - Records anomaly detection runs

### 7. Inference API (app/api/v1/predict/route.ts)
- **Import:** Line 21
- **Call 1:** Line 173 - Records inference calls
- **Call 2:** Line 245 - Records inference calls (alternate path)

### 8. Judge Evaluations (app/api/evaluation/judge/route.ts)
- **Import:** Line 13
- **Call 1:** Line 217 - Records single evaluation runs
- **Call 2:** Line 360 - Records batch evaluation runs

### 9. Training Status (app/api/training/execute/[id]/status/route.ts)
- **Import:** Line 14
- **Call:** Line 190 - Records training job status updates

### 10. Scheduled Evaluations (lib/evaluation/scheduler-worker.ts)
- **Import:** Line 13
- **Call:** Line 221 - Records scheduled evaluation runs

## Metric Types Being Recorded

Based on the calls found:

1. **chat_message** - User chat interactions
2. **research_job** - Research query submissions
3. **graphrag_search** - Knowledge base searches
4. **batch_test_run** - Batch test executions
5. **analytics_assistant** - Analytics chat queries
6. **anomaly_detection** - Anomaly detection runs
7. **inference_call** - Model inference requests
8. **evaluation_run** - Judge evaluation executions
9. **scheduled_eval_run** - Scheduled test executions
10. **training_job** - Training status updates

## Recommended Action: Comment Out (Safe Approach)

Instead of deleting, comment out all calls for safer rollback.

### Example Pattern

**Before:**
```typescript
await recordUsageEvent({
  user_id: userId,
  metric_type: 'chat_message',
  value: 1,
});
```

**After:**
```typescript
// DEPRECATED: OLD usage tracking system
// Now using usage_meters table via increment_root_trace_count()
// await recordUsageEvent({
//   user_id: userId,
//   metric_type: 'chat_message',
//   value: 1,
// });
```

## Files Requiring Modification

1. ✅ app/account/page.tsx (UI removed)
2. ⏳ app/api/chat/route.ts
3. ⏳ app/api/research/route.ts
4. ⏳ app/api/graphrag/search/route.ts
5. ⏳ app/api/batch-testing/run/route.ts
6. ⏳ app/api/analytics/chat/route.ts
7. ⏳ app/api/analytics/anomalies/detect/route.ts
8. ⏳ app/api/v1/predict/route.ts
9. ⏳ app/api/evaluation/judge/route.ts
10. ⏳ app/api/training/execute/[id]/status/route.ts
11. ⏳ lib/evaluation/scheduler-worker.ts

## Import Cleanup

After commenting out all calls, remove these imports:

```typescript
import { recordUsageEvent } from '@/lib/usage/checker';
```

## Keep These Files (Historical/Reference)

- **lib/usage/checker.ts** - Keep function definition for reference
- **Database tables** - Keep `usage_events` and `current_usage_summary` for historical data

## Verification

After commenting out, verify:

1. No runtime errors when using features
2. NEW system (usage_meters) still recording correctly
3. No missing imports (TypeScript will catch)
4. No undefined function errors in logs

## Timeline

- Phase 1: UI Removal - ✅ DONE
- Phase 2: Comment Out Recording - NEXT
- Phase 3: Monitor (1 week) - Verify no issues
- Phase 4: Remove Comments - Clean up after confidence

## Testing Checklist

After commenting out, test these features:

- [ ] Chat messages
- [ ] Research queries
- [ ] GraphRAG search
- [ ] Batch testing
- [ ] Analytics assistant
- [ ] Anomaly detection
- [ ] Model inference
- [ ] Judge evaluations
- [ ] Scheduled evaluations
- [ ] Training jobs

All should work normally, just without OLD usage tracking.

## Rollback Plan

If issues arise:

1. Uncomment recordUsageEvent calls
2. Deploy
3. Investigate issue
4. Re-plan deprecation

## Question for User

Do you want me to:

**Option A:** Comment out all 24 recordUsageEvent calls now (safe, reversible)
**Option B:** Remove imports and calls completely (clean, permanent)
**Option C:** Leave recording calls in place, only UI removed (minimal change)

Recommended: **Option A** - Comment out calls, monitor for 1 week, then remove completely.
