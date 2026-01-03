# Phase 2: Comment Out Remaining Usage Calls

## Progress So Far

✅ **Completed (5 out of 24 calls):**
1. app/api/chat/route.ts - Line 1287-1301 ✅
2. app/api/chat/route.ts - Line 1938-1953 ✅
3. app/api/research/route.ts - Line 44-54 ✅
4. app/api/graphrag/search/route.ts - Line 41-51 ✅

## Remaining Files (19 calls)

### Batch Testing (2 calls)
**File:** app/api/batch-testing/run/route.ts
- Line 490-505: `recordUsageEvent` in batch test creation
- Line 798+: `await recordUsageEvent` in batch test execution

### Analytics Chat (1 call)
**File:** app/api/analytics/chat/route.ts
- Line 2093+: `await recordUsageEvent` for analytics assistant

### Anomaly Detection (1 call)
**File:** app/api/analytics/anomalies/detect/route.ts
- Line 297+: `await recordUsageEvent` for anomaly detection

### Inference API (2 calls)
**File:** app/api/v1/predict/route.ts
- Line 173+: `recordUsageEvent` for inference call
- Line 245+: `recordUsageEvent` for inference call (alternate path)

### Judge Evaluations (2 calls)
**File:** app/api/evaluation/judge/route.ts
- Line 217+: `await recordUsageEvent` for single evaluation
- Line 360+: `await recordUsageEvent` for batch evaluation

### Training Status (1 call)
**File:** app/api/training/execute/[id]/status/route.ts
- Line 190+: `recordUsageEvent` for training status update

### Scheduler Worker (1 call)
**File:** lib/evaluation/scheduler-worker.ts
- Line 221+: `await recordUsageEvent` for scheduled evaluation

## Pattern for Commenting Out

Replace this pattern:
```typescript
await recordUsageEvent({
  userId: userId,
  metricType: 'some_type',
  value: 1,
  ...
});
```

With this:
```typescript
// DEPRECATED: OLD usage tracking system
// Now using usage_meters table via increment_root_trace_count()
// await recordUsageEvent({
//   userId: userId,
//   metricType: 'some_type',
//   value: 1,
//   ...
// });
```

## Option: Manual vs Automated

Since there are 19 more calls to comment out, you have two options:

**Option A: Continue one-by-one** (safe, thorough, but time-consuming)
- I continue editing each file individually
- ~19 more read/edit cycles
- Guaranteed accuracy

**Option B: Batch edit remaining files** (faster)
- I can comment out multiple files in fewer operations
- Risk of missing edge cases
- Faster completion

Which would you prefer?
