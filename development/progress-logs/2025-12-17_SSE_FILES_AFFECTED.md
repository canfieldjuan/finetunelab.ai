# SSE Implementation - Files Affected Analysis

**Date**: 2025-12-17
**Related**: SSE_REALTIME_PREDICTIONS_PLAN.md

---

## File Dependency Map

```
New Files (Zero Breaking Changes)
├── /app/api/training/predictions/[jobId]/stream/route.ts
│   └── NEW SSE endpoint
│       ├── Uses: validateRequestWithScope (existing)
│       ├── Uses: Supabase Realtime (existing)
│       └── No impact on existing endpoints
│
└── /lib/hooks/useTrainingPredictionsSSE.ts
    └── NEW hook for SSE consumption
        ├── Independent from existing hooks
        └── No impact on existing components

Modified Files (Controlled Breaking Changes)
├── /components/training/PredictionsTable.tsx
│   ├── ADD: useTrainingPredictionsSSE hook
│   ├── ADD: Live connection indicator
│   ├── ADD: Auto-update on new predictions
│   ├── KEEP: Existing fetch on mount (fallback)
│   └── RISK: Medium
│       └── Mitigation: Feature flag, graceful fallback
│
├── /components/training/PredictionsComparison.tsx
│   ├── ADD: useTrainingPredictionsSSE hook
│   ├── ADD: Live comparison updates
│   └── RISK: Low
│       └── Mitigation: Optional, works without SSE
│
└── /components/training/PredictionsTrendsChart.tsx
    ├── ADD: useTrainingPredictionsSSE hook
    ├── ADD: Live trend updates
    └── RISK: Low
        └── Mitigation: Chart already handles dynamic data

Files That Use Modified Components (Verify No Breaks)
└── /app/training/monitor/page.tsx
    ├── Uses PredictionsTable ✓
    ├── Uses PredictionsComparison ✓
    ├── Current: Passes jobId + authToken
    └── After SSE: Same props, no breaking changes

Unaffected Files (No Changes Needed)
├── /contexts/TrainingMetricsContext.tsx
│   └── Separate concern (job metrics)
│       └── Already uses Supabase Realtime
│
├── /lib/hooks/useTrainingJobsRealtime.ts
│   └── Separate concern (job status)
│       └── Already uses Supabase Realtime
│
└── All Chart Components
    └── LossChart.tsx, LearningRateChart.tsx, etc.
        └── Work independently, no SSE needed
```

---

## Change Impact Assessment

### Phase 1: Backend SSE Endpoint
**File**: `/app/api/training/predictions/[jobId]/stream/route.ts`

**Dependencies**:
- ✅ `validateRequestWithScope` from `/lib/auth/api-key-validator.ts` (exists)
- ✅ `createClient` from `@supabase/supabase-js` (exists)
- ✅ Environment variables (NEXT_PUBLIC_SUPABASE_URL, etc.) (exist)

**Breaking Changes**: NONE
- New file, no existing code affected
- Endpoint is new route, doesn't override anything
- Authentication reuses existing patterns

**Verification**:
```bash
# Test endpoint exists
curl -N -H "X-API-Key: wak_xxx" \
  https://finetunelab.ai/api/training/predictions/test_job/stream

# Expected: SSE stream with heartbeat events
```

---

### Phase 2: Frontend SSE Hook
**File**: `/lib/hooks/useTrainingPredictionsSSE.ts`

**Dependencies**:
- ✅ React hooks (useState, useEffect, useRef) (built-in)
- ✅ EventSource API (browser native)
- ✅ TrainingPrediction type from `/lib/training/types/predictions-types.ts` (exists)

**Breaking Changes**: NONE
- New hook, doesn't modify existing hooks
- Optional to use, doesn't affect components not using it

**Verification**:
```tsx
// Test in isolated component
import { useTrainingPredictionsSSE } from '@/lib/hooks/useTrainingPredictionsSSE';

function TestComponent() {
  const { latestPrediction, isConnected } = useTrainingPredictionsSSE({
    jobId: 'test_job',
    apiKey: 'wak_xxx',
  });

  return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
}
```

---

### Phase 3: Component Integration
**File**: `/components/training/PredictionsTable.tsx`

**Current Code** (lines 117-158):
```typescript
const fetchPredictions = useCallback(async () => {
  setLoading(true);
  setError(null);

  try {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: (page * pageSize).toString(),
    });

    if (selectedEpoch !== null) {
      params.set('epoch', selectedEpoch.toString());
    }

    const url = `/api/training/predictions/${jobId}?${params}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // ... parse response ...
    setPredictions(data.predictions || []);
    setTotalCount(data.total_count || 0);
  } catch (err) {
    // ... error handling ...
  } finally {
    setLoading(false);
  }
}, [jobId, authToken, page, selectedEpoch]);

// Only fetch predictions if they exist
useEffect(() => {
  if (hasPredictions === true) {
    fetchPredictions();
  } else if (hasPredictions === false) {
    setLoading(false);
  }
}, [hasPredictions, fetchPredictions]);
```

**Proposed Changes**:
```typescript
// ADD: SSE hook (non-breaking, optional)
const {
  latestPrediction,
  totalCount: sseCount,
  isConnected: sseConnected,
} = useTrainingPredictionsSSE({
  jobId,
  authToken,
  enabled: hasPredictions === true && !selectedEpoch, // Only for "all epochs" view
});

// KEEP: Existing fetch (fallback)
const fetchPredictions = useCallback(async () => {
  // ... existing code unchanged ...
}, [jobId, authToken, page, selectedEpoch]);

// ADD: Auto-update on new prediction
useEffect(() => {
  if (!latestPrediction) return;

  // Only update if viewing first page and no epoch filter
  if (page === 0 && selectedEpoch === null) {
    setPredictions((prev) => {
      // Deduplicate
      const exists = prev.find((p) => p.id === latestPrediction.id);
      if (exists) return prev;

      // Add to top, trim to page size
      return [latestPrediction, ...prev].slice(0, pageSize);
    });

    // Update total count
    if (sseCount > 0) {
      setTotalCount(sseCount);
    }
  }
}, [latestPrediction, sseCount, page, selectedEpoch]);

// KEEP: Existing fetch logic unchanged
useEffect(() => {
  if (hasPredictions === true) {
    fetchPredictions();
  } else if (hasPredictions === false) {
    setLoading(false);
  }
}, [hasPredictions, fetchPredictions]);
```

**Breaking Change Analysis**:
- ❌ **NO breaking changes to props** - Still accepts same `jobId` and `authToken`
- ❌ **NO breaking changes to behavior** - Fetch still happens on mount
- ✅ **ADDITIVE change** - SSE adds live updates on top
- ✅ **GRACEFUL fallback** - If SSE fails, fetch still works

**Verification Checklist**:
- [ ] PredictionsTable renders with no props changes
- [ ] Initial fetch still happens on mount
- [ ] Pagination still works
- [ ] Epoch filtering still works
- [ ] Live updates appear when SSE connected
- [ ] No live updates when SSE disconnected
- [ ] No duplicate predictions
- [ ] Total count updates correctly

---

### Files That Import Modified Components

**File**: `/app/training/monitor/page.tsx` (line 1016)

**Current Usage**:
```typescript
<PredictionsTable
  jobId={jobId}
  authToken={getFreshToken() || ''}
/>
```

**After SSE**:
```typescript
<PredictionsTable
  jobId={jobId}
  authToken={getFreshToken() || ''}
/>
// NO CHANGES - Same props, backward compatible
```

**Breaking Change Analysis**:
- ✅ **NO changes needed** - Props interface unchanged
- ✅ **NO behavior changes** - Component still works as before
- ✅ **ENHANCEMENT only** - Live updates added automatically

---

## Testing Strategy

### Phase 1 Testing (SSE Endpoint)
```bash
# 1. Test connection
curl -N -H "X-API-Key: wak_xxx" \
  https://finetunelab.ai/api/training/predictions/test_job/stream

# Expected output:
# event: connected
# data: {"jobId":"test_job"}
#
# event: heartbeat
# data: {"timestamp":"2025-12-17T12:00:00Z"}

# 2. Test authentication failure
curl -N https://finetunelab.ai/api/training/predictions/test_job/stream

# Expected: 401 Unauthorized

# 3. Test prediction event
# (In separate terminal, send prediction via SDK)
python3 -c "
from finetune_lab import FinetuneLabClient
client = FinetuneLabClient(api_key='wak_xxx')
client.training_predictions.create(
    job_id='test_job',
    job_token='...',
    predictions=[{'epoch': 1, 'step': 0, ...}]
)
"

# Expected in curl output:
# event: prediction
# data: {"type":"prediction","prediction":{...}}
```

### Phase 2 Testing (Hook)
```typescript
// Test component
'use client';

import { useTrainingPredictionsSSE } from '@/lib/hooks/useTrainingPredictionsSSE';

export function SSETestComponent() {
  const { latestPrediction, totalCount, isConnected, error } = useTrainingPredictionsSSE({
    jobId: 'test_job',
    authToken: 'xxx',
    enabled: true,
  });

  return (
    <div className="p-4">
      <div>Connected: {isConnected ? '✅' : '❌'}</div>
      <div>Error: {error || 'None'}</div>
      <div>Total: {totalCount}</div>
      <div>Latest: {latestPrediction?.id || 'None'}</div>
    </div>
  );
}

// Checklist:
// [ ] Component renders
// [ ] isConnected becomes true
// [ ] Heartbeat logs appear in console
// [ ] Send prediction via SDK → latestPrediction updates
// [ ] totalCount increments
// [ ] Disconnect network → isConnected becomes false
// [ ] Reconnect network → isConnected becomes true again
```

### Phase 3 Testing (Component Integration)
```typescript
// Full integration test
// 1. Open /training/monitor?jobId=test_job
// 2. Verify predictions table loads
// 3. Verify "Live" badge appears (if SSE connected)
// 4. Send prediction via SDK:
python3 test_sdk_integration.py

// 5. Checklist:
// [ ] New prediction appears in table automatically
// [ ] Total count updates
// [ ] Pagination still works
// [ ] Epoch filter still works
// [ ] No duplicate predictions
// [ ] No console errors
```

---

## Rollback Plan

If SSE causes issues in production:

### Immediate Rollback (< 5 minutes)
1. Set feature flag to `false`:
   ```typescript
   // In component
   const SSE_ENABLED = false; // Disable SSE
   ```

2. Component falls back to fetch-only mode
3. No downtime, graceful degradation

### Full Rollback (< 30 minutes)
1. Revert commits:
   ```bash
   git revert <sse-commit-hash>
   git push
   ```

2. Deploy reverted code
3. SSE endpoint removed, components back to fetch-only

### Zero Impact Rollback
- Since SSE is additive (not replacing existing fetch)
- Disabling SSE = back to original behavior
- No data loss, no breaking changes

---

## Success Criteria Summary

### Phase 1: SSE Endpoint
- ✅ Endpoint responds with SSE headers
- ✅ Authentication works (API key + Bearer)
- ✅ Heartbeat every 15s
- ✅ Prediction events on INSERT
- ✅ Graceful disconnect
- ✅ No memory leaks

### Phase 2: Hook
- ✅ Connects to SSE endpoint
- ✅ Receives prediction events
- ✅ Auto-reconnects on error
- ✅ Cleans up on unmount
- ✅ No breaking changes

### Phase 3: Components
- ✅ Live updates work
- ✅ Backward compatible
- ✅ Fetch fallback works
- ✅ No duplicate predictions
- ✅ Performance acceptable (< 5% CPU)

---

**All phases designed for zero breaking changes.**
**Rollback possible at any stage.**
**Ready for approval.**

---

## Phase 2 Implementation Completed (2025-12-17)

**File Created**: `/lib/hooks/useTrainingPredictionsSSE.ts` (200 lines)

**Implementation Details**:
- Uses fetch() with ReadableStream instead of EventSource for header authentication support
- Supports both API key (`X-API-Key`) and Bearer token (`Authorization`) authentication
- Manual SSE event parsing (event: type, data: JSON payload)
- Auto-reconnect with exponential backoff (max 5 attempts, up to 30s delay)
- Proper cleanup on unmount (aborts fetch, clears timeouts)

**Event Types Handled**:
- `connected` - Initial connection confirmation
- `prediction` - New prediction with total_count
- `heartbeat` - Keep-alive signal
- `error` - Server error notification

**Public Interface**:
```typescript
const { latestPrediction, totalCount, isConnected, error } = useTrainingPredictionsSSE({
  jobId: string,
  authToken?: string,
  apiKey?: string,
  enabled?: boolean
});
```

**Verification**:
- ✅ TypeScript compiles without errors
- ✅ No breaking changes to existing code
- ✅ Import paths verified (TrainingPrediction from predictions-types.ts)
- ✅ Follows existing SSE patterns (useResearchStream, ExecutionLogs)
- ✅ No hard-coded values (all configurable)
- ✅ Written in logical blocks (6 blocks, max 30 lines each)

**Next Phase**: Phase 3 - Component Integration
