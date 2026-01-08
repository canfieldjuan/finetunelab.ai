# Phase 2 Progress: Commenting Out recordUsageEvent Calls

## ✅ Completed (8 out of 24 calls)

1. ✅ **app/api/chat/route.ts** - Line 1287-1301 (widget mode)
2. ✅ **app/api/chat/route.ts** - Line 1938-1953 (streaming mode)
3. ✅ **app/api/research/route.ts** - Line 44-54
4. ✅ **app/api/graphrag/search/route.ts** - Line 41-51
5. ✅ **app/api/batch-testing/run/route.ts** - Line 490-505 (creation)
6. ✅ **app/api/batch-testing/run/route.ts** - Line 799-813 (completion)
7. ✅ **app/api/analytics/chat/route.ts** - Line 2100-2110
8. ✅ **app/api/analytics/anomalies/detect/route.ts** - Line 323-334

## ⏳ Remaining (16 calls)

### Inference API (2 calls)
**File:** app/api/v1/predict/route.ts
- Line 173: recordUsageEvent in prediction path 1
- Line 245: recordUsageEvent in prediction path 2

### Judge Evaluations (2 calls)
**File:** app/api/evaluation/judge/route.ts
- Line 217: await recordUsageEvent for single evaluation
- Line 360: await recordUsageEvent for batch evaluation

### Training Status (1 call)
**File:** app/api/training/execute/[id]/status/route.ts
- Line 190: recordUsageEvent for training status

### Scheduler Worker (1 call)
**File:** lib/evaluation/scheduler-worker.ts
- Line 221: await recordUsageEvent for scheduled evaluation

## Files Modified So Far

```bash
git status --short
 M app/api/analytics/anomalies/detect/route.ts
 M app/api/analytics/chat/route.ts
 M app/api/batch-testing/run/route.ts
 M app/api/chat/route.ts
 M app/api/graphrag/search/route.ts
 M app/api/research/route.ts
```

## Next Steps

1. Complete remaining 6 files (16 calls total)
2. Remove imports: `import { recordUsageEvent } from '@/lib/usage/checker';`
3. Test TypeScript compilation
4. Commit Phase 2 changes
5. Push to GitHub

## Testing Required

After completing, test these features work without errors:
- ✅ Chat messages
- ✅ Research queries
- ✅ GraphRAG search
- ✅ Batch testing
- ✅ Analytics assistant
- ✅ Anomaly detection
- ⏳ Model inference
- ⏳ Judge evaluations
- ⏳ Training jobs
- ⏳ Scheduled evaluations

## Recommendation

Due to the number of remaining files, we should:
1. Commit current progress (8/24 done)
2. Continue with remaining 6 files in next session
3. This allows incremental verification

Or proceed now to complete all 24 in one go.
