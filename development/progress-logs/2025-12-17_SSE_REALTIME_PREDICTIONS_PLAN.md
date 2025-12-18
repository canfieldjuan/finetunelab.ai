# Server-Sent Events (SSE) for Real-Time Training Predictions
## Implementation Plan

**Created**: 2025-12-17
**Status**: Awaiting Approval
**Priority**: High - Cost Optimization & User Experience

---

## Executive Summary

Replace polling-based prediction updates with Server-Sent Events (SSE) for efficient real-time updates in training monitor dashboards. This eliminates unnecessary server load while providing instant updates as developers send predictions via SDK.

---

## Current State Analysis

### What Works Today
✅ **Job Metrics**: Already uses Supabase Realtime (WebSocket)
- Primary: WebSocket connection for job status/metrics
- Fallback: Polling every 30s (configurable)
- Batch flushing every 2s to reduce re-renders
- Location: `/contexts/TrainingMetricsContext.tsx`

✅ **Predictions Display**: One-time fetch on component mount
- Fetches predictions when user opens `/training/monitor?jobId=xxx`
- No automatic updates
- Location: `/components/training/PredictionsTable.tsx`

### The Problem
❌ **No Real-Time Prediction Updates**
- Developer sends prediction via SDK → Web UI doesn't update
- User must manually refresh page to see new predictions
- Future polling implementation would waste server resources

❌ **Inefficient for External Developers**
- Developer training locally sends predictions every few seconds
- Web UI shows stale data unless refreshed
- Poor experience compared to W&B

---

## Proposed Solution: SSE Architecture

### Why SSE Instead of WebSocket?
| Feature | SSE | WebSocket | Polling |
|---------|-----|-----------|---------|
| **Unidirectional (server → client)** | ✅ Perfect fit | ❌ Overkill | ✅ Yes |
| **Auto-reconnect** | ✅ Built-in | ❌ Manual | N/A |
| **HTTP/2 multiplexing** | ✅ Efficient | ❌ Separate protocol | ❌ Many requests |
| **Simple to implement** | ✅ Standard HTTP | ❌ Complex | ✅ Simple |
| **Server resource usage** | ✅ Low (long-lived HTTP) | ⚠️ Medium | ❌ High (repeated requests) |
| **Already using** | ❌ No | ✅ Yes (Supabase) | ❌ No |

**Decision**: Use SSE for predictions because:
1. One-way data flow (server → client)
2. Built-in reconnection
3. Simpler than WebSocket
4. Lower server overhead than polling
5. Complement existing Supabase Realtime (not replace)

---

## Architecture Design

### Data Flow
```
Developer Training Script (Local/Cloud)
         ↓
    SDK: client.training_predictions.create()
         ↓
POST /api/training/predictions (with job_token auth)
         ↓
    Insert into training_predictions table
         ↓
SSE Endpoint: GET /api/training/predictions/[jobId]/stream
         ↓
    Web UI: useTrainingPredictionsSSE() hook
         ↓
Components auto-update (PredictionsTable, Charts, Trends)
```

### New SSE Endpoint

**Endpoint**: `GET /api/training/predictions/[jobId]/stream`

**Authentication**:
- API key (X-API-Key header)
- Bearer token (Authorization header)

**Response Format**:
```typescript
// SSE event stream
event: prediction
data: {"prediction": {...}, "total_count": 16}

event: epoch_complete
data: {"epoch": 2, "prediction_count": 5, "latest_step": 40}

event: heartbeat
data: {"timestamp": "2025-12-17T12:00:00Z"}
```

**Events Types**:
1. `prediction` - New prediction inserted
2. `epoch_complete` - Epoch finished
3. `trends_update` - Quality metrics changed
4. `heartbeat` - Keep-alive (every 15s)

---

## Implementation Phases

### Phase 1: Backend SSE Endpoint (Non-Breaking)
**Goal**: Create SSE endpoint without changing existing code

**Files to Create**:
- `/app/api/training/predictions/[jobId]/stream/route.ts` - SSE endpoint

**Implementation**:
```typescript
// app/api/training/predictions/[jobId]/stream/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const resolvedParams = await params;
  const jobId = resolvedParams.jobId;

  // Authenticate (same as existing endpoints)
  const apiKeyValidation = await validateRequestWithScope(request.headers, 'training');
  let userId: string | null = null;

  if (apiKeyValidation.isValid && apiKeyValidation.userId) {
    userId = apiKeyValidation.userId;
  } else {
    // Fallback to bearer token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error } = await supabaseAuth.auth.getUser();
    if (error || !user) {
      return new Response('Unauthorized', { status: 401 });
    }
    userId = user.id;
  }

  // Verify job belongs to user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: job } = await supabase
    .from('local_training_jobs')
    .select('id')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single();

  if (!job) {
    return new Response('Job not found', { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  let isConnected = true;

  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] Client connected for job:', jobId);

      // Send initial connection confirmation
      controller.enqueue(
        encoder.encode(`event: connected\ndata: {"jobId":"${jobId}"}\n\n`)
      );

      // Subscribe to database changes
      const channel = supabase
        .channel(`predictions:${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'training_predictions',
            filter: `job_id=eq.${jobId}`,
          },
          (payload) => {
            if (!isConnected) return;

            console.log('[SSE] New prediction for', jobId);
            const data = JSON.stringify({
              type: 'prediction',
              prediction: payload.new,
            });
            controller.enqueue(encoder.encode(`event: prediction\ndata: ${data}\n\n`));
          }
        )
        .subscribe();

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!isConnected) {
          clearInterval(heartbeatInterval);
          return;
        }

        const data = JSON.stringify({ timestamp: new Date().toISOString() });
        controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${data}\n\n`));
      }, 15000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        console.log('[SSE] Client disconnected for job:', jobId);
        isConnected = false;
        clearInterval(heartbeatInterval);
        channel.unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
```

**Verification Steps**:
1. Create endpoint file
2. Test with curl:
   ```bash
   curl -N -H "X-API-Key: wak_xxx" \
     https://finetunelab.ai/api/training/predictions/test_job/stream
   ```
3. Verify heartbeat events arrive every 15s
4. Send prediction via SDK, verify `prediction` event arrives
5. Check server logs for connection/disconnection messages

**Success Criteria**:
✅ Endpoint authenticates correctly
✅ SSE connection stays alive
✅ Heartbeat events sent every 15s
✅ Prediction events sent when new predictions inserted
✅ Graceful disconnect on client close
✅ No breaking changes to existing code

---

### Phase 2: Frontend Hook (Non-Breaking)
**Goal**: Create React hook to consume SSE without changing components

**Files to Create**:
- `/lib/hooks/useTrainingPredictionsSSE.ts` - SSE consumer hook

**Implementation**:
```typescript
// lib/hooks/useTrainingPredictionsSSE.ts
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import type { TrainingPrediction } from '@/lib/training/types/predictions-types';

interface SSEPredictionEvent {
  type: 'prediction' | 'epoch_complete' | 'trends_update';
  prediction?: TrainingPrediction;
  epoch?: number;
  total_count?: number;
}

interface UseTrainingPredictionsSSEOptions {
  jobId: string;
  authToken?: string;
  apiKey?: string;
  enabled?: boolean; // Allow disabling SSE
}

export function useTrainingPredictionsSSE({
  jobId,
  authToken,
  apiKey,
  enabled = true,
}: UseTrainingPredictionsSSEOptions) {
  const [latestPrediction, setLatestPrediction] = useState<TrainingPrediction | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled || !jobId) return;

    try {
      // Build URL with auth
      const url = new URL(`/api/training/predictions/${jobId}/stream`, window.location.origin);

      // Add auth header via EventSource polyfill or custom implementation
      // Note: Native EventSource doesn't support headers, need workaround
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers['X-API-Key'] = apiKey;
      } else if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      // For now, use URL params for auth (will improve in Phase 3)
      if (apiKey) {
        url.searchParams.set('apiKey', apiKey);
      } else if (authToken) {
        url.searchParams.set('token', authToken);
      }

      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('connected', () => {
        console.log('[SSE] Connected to predictions stream:', jobId);
        setIsConnected(true);
        setError(null);
      });

      eventSource.addEventListener('prediction', (event) => {
        const data: SSEPredictionEvent = JSON.parse(event.data);
        console.log('[SSE] New prediction received');

        if (data.prediction) {
          setLatestPrediction(data.prediction);
        }
        if (data.total_count !== undefined) {
          setTotalCount(data.total_count);
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        // Keep connection alive marker
      });

      eventSource.onerror = () => {
        console.error('[SSE] Connection error, will reconnect...');
        setIsConnected(false);
        eventSource.close();

        // Exponential backoff reconnect
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
      };

    } catch (err) {
      console.error('[SSE] Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [jobId, authToken, apiKey, enabled]);

  useEffect(() => {
    connect();

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    latestPrediction,
    totalCount,
    isConnected,
    error,
  };
}
```

**Verification Steps**:
1. Create hook file
2. Test in standalone component:
   ```tsx
   const { latestPrediction, isConnected } = useTrainingPredictionsSSE({
     jobId: 'test_job',
     apiKey: 'wak_xxx',
   });

   console.log('Connected:', isConnected);
   console.log('Latest:', latestPrediction);
   ```
3. Send prediction via SDK, verify hook receives update
4. Close connection, verify reconnect happens
5. Check no memory leaks on unmount

**Success Criteria**:
✅ Hook connects to SSE endpoint
✅ Receives prediction events
✅ Auto-reconnects on failure
✅ Cleans up properly on unmount
✅ No breaking changes to existing components

---

### Phase 3: Component Integration (Breaking Changes Possible)
**Goal**: Update components to use SSE hook for live updates

**Files to Modify**:
1. `/components/training/PredictionsTable.tsx` - Add live updates
2. `/components/training/PredictionsComparison.tsx` - Add live updates
3. `/components/training/PredictionsTrendsChart.tsx` - Add live trends

**Changes Required**:

#### PredictionsTable.tsx
```typescript
// Add SSE hook
const { latestPrediction, totalCount: sseCount, isConnected } = useTrainingPredictionsSSE({
  jobId,
  authToken,
  enabled: hasPredictions === true, // Only enable if predictions exist
});

// Update predictions when new one arrives
useEffect(() => {
  if (latestPrediction && selectedEpoch === latestPrediction.epoch) {
    setPredictions((prev) => [latestPrediction, ...prev].slice(0, pageSize));
    setTotalCount(sseCount);
  }
}, [latestPrediction, sseCount, selectedEpoch]);

// Add connection indicator
{isConnected && (
  <Badge variant="outline" className="ml-2">
    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" />
    Live
  </Badge>
)}
```

**Verification Steps**:
1. Open training monitor: `/training/monitor?jobId=test_job`
2. Verify "Live" badge appears
3. Send prediction via SDK
4. Verify prediction appears in table instantly (no refresh)
5. Change to different epoch, verify only relevant predictions show
6. Disconnect, verify "Live" badge disappears

**Success Criteria**:
✅ Table updates instantly when predictions arrive
✅ "Live" indicator shows connection status
✅ Pagination still works
✅ Epoch filtering still works
✅ No duplicate predictions
✅ Graceful fallback if SSE fails

---

### Phase 4: Performance Optimization
**Goal**: Optimize for production scale

**Optimizations**:
1. **Batch Updates** (similar to TrainingMetricsContext)
   - Buffer incoming SSE events
   - Flush every 2 seconds to reduce re-renders

2. **Connection Pooling**
   - Limit SSE connections per user
   - Close inactive connections after 5 minutes

3. **Event Filtering**
   - Only send events for filtered epoch
   - Reduce bandwidth for large jobs

4. **Compression**
   - Enable gzip for SSE responses
   - Reduce payload size

**Files to Modify**:
- `/app/api/training/predictions/[jobId]/stream/route.ts` - Add batching
- `/lib/hooks/useTrainingPredictionsSSE.ts` - Add buffer flushing

**Success Criteria**:
✅ CPU usage < 5% per SSE connection
✅ Memory usage < 10MB per connection
✅ Supports 100+ concurrent connections
✅ Re-renders reduced from continuous to every 2s

---

### Phase 5: Monitoring & Alerting
**Goal**: Track SSE performance and issues

**Metrics to Track**:
1. Active SSE connections count
2. Average connection duration
3. Reconnection rate
4. Events sent per second
5. Client errors

**Implementation**:
- Add logging to SSE endpoint
- Track metrics in analytics
- Alert on high reconnection rates

---

## Files Affected Summary

### New Files (No Breaking Changes)
✅ `/app/api/training/predictions/[jobId]/stream/route.ts` - SSE endpoint
✅ `/lib/hooks/useTrainingPredictionsSSE.ts` - SSE consumer hook

### Modified Files (Potential Breaking Changes)
⚠️ `/components/training/PredictionsTable.tsx` - Add SSE integration
⚠️ `/components/training/PredictionsComparison.tsx` - Add SSE integration
⚠️ `/components/training/PredictionsTrendsChart.tsx` - Add SSE integration

### Dependencies Verification
**Check these files won't break**:
- `/app/training/monitor/page.tsx` - Uses PredictionsTable
- `/contexts/TrainingMetricsContext.tsx` - Separate, won't conflict
- All chart components - Should work independently

---

## Rollout Strategy

### Development
1. ✅ Phase 1: Create SSE endpoint (test with curl)
2. ✅ Phase 2: Create hook (test in isolation)
3. ⚠️ Phase 3: Update components (test in dev env)
4. ✅ Phase 4: Optimize (load test)

### Staging
1. Deploy Phases 1-3
2. Test with real SDK integration
3. Monitor performance metrics
4. Verify no regressions

### Production
1. Deploy with feature flag
2. Enable for 10% of users
3. Monitor error rates
4. Gradual rollout to 100%

---

## Risk Mitigation

### Risk 1: SSE Connection Limits
**Impact**: Server runs out of connections
**Mitigation**:
- Connection pooling
- Auto-close after 5min inactivity
- Max connections per user

### Risk 2: Breaking Existing Components
**Impact**: Monitor page breaks
**Mitigation**:
- SSE is optional (enabled flag)
- Graceful fallback to fetch on mount
- Comprehensive testing

### Risk 3: Browser Compatibility
**Impact**: SSE not supported in old browsers
**Mitigation**:
- Feature detection
- Polyfill for EventSource
- Fallback to long-polling

---

## Success Metrics

**Before SSE** (Current State):
- ❌ Predictions: Manual refresh only
- ❌ Real-time: None
- ❌ Server load: N/A (no polling yet)

**After SSE** (Target State):
- ✅ Predictions: Live updates < 1s latency
- ✅ Real-time: 99% uptime
- ✅ Server load: < 5% CPU per connection
- ✅ User satisfaction: Instant feedback like W&B

---

## Next Steps - Awaiting Approval

### Immediate Actions After Approval:
1. **Phase 1**: Create SSE endpoint
   - File: `/app/api/training/predictions/[jobId]/stream/route.ts`
   - Timeline: 1 hour
   - Test: curl verification

2. **Phase 2**: Create SSE hook
   - File: `/lib/hooks/useTrainingPredictionsSSE.ts`
   - Timeline: 1 hour
   - Test: Standalone component

3. **Phase 3**: Component integration
   - Files: PredictionsTable, PredictionsComparison
   - Timeline: 2 hours
   - Test: Full SDK integration test

**Total Estimated Time**: 4-6 hours
**Risk Level**: Low (phases 1-2), Medium (phase 3)

---

## Questions for Review

1. **SSE vs WebSocket**: Agree with SSE for predictions?
2. **Authentication**: Keep API key + Bearer token approach?
3. **Batching**: 2-second batch flush acceptable?
4. **Feature Flag**: Deploy behind flag initially?
5. **Fallback**: Keep one-time fetch as fallback?

---

**Ready to proceed with Phase 1 after approval.**
