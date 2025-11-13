# WebSocket Migration Guide

## Issue
The existing `useTrainingMetricsRealtime.ts` hook uses Supabase Realtime, which requires:
1. Training server to write metrics to Supabase database
2. Supabase Realtime subscription setup
3. Additional database writes (slower, more complex)

**Error:** `[TrainingRealtime] ❌ Connection error: {}`

## Solution: Use New WebSocket Hook

Phase 3 added WebSocket streaming directly from the training server:
- **Endpoint:** `ws://localhost:8000/ws/training/{job_id}`
- **Lower latency:** < 1 second (vs 2 second polling)
- **Direct connection:** No database intermediary
- **Simpler:** No Supabase Realtime configuration needed

---

## New Hook: `useTrainingWebSocket`

**Location:** `lib/hooks/useTrainingWebSocket.ts`

**Features:**
- ✅ Real-time training metrics via WebSocket
- ✅ Automatic reconnection (5 retries with exponential backoff)
- ✅ Heartbeat/keepalive (30s interval)
- ✅ Clean connection management
- ✅ TypeScript support

---

## Migration Steps

### 1. Import the New Hook

**Before:**
```typescript
import { useTrainingMetricsRealtime } from '@/lib/hooks/useTrainingMetricsRealtime';
```

**After:**
```typescript
import { useTrainingWebSocket } from '@/lib/hooks/useTrainingWebSocket';
```

### 2. Update Hook Usage

**Before:**
```typescript
const {
  metrics,
  isLoading,
  error,
  isConnected
} = useTrainingMetricsRealtime({
  jobId: job.id,
  enabled: job.status === 'running',
  accessToken: session?.access_token
});
```

**After:**
```typescript
const {
  metrics,
  isConnected,
  error,
  reconnect
} = useTrainingWebSocket({
  jobId: job.id,
  enabled: job.status === 'running',
  onMetrics: (metricsData) => {
    console.log('New metrics:', metricsData);
  },
  onStatusChange: (status) => {
    console.log('Status changed:', status);
  },
  onError: (errorMsg) => {
    console.error('WebSocket error:', errorMsg);
  }
});
```

### 3. Update Metrics Access

**Metrics Format (New):**
```typescript
interface TrainingMetrics {
  step: number;
  loss: number;
  learning_rate: number;
  samples_per_second: number;
  gpu_utilization: number;
  gpu_memory_used: number;
  gpu_temperature: number;
  timestamp: string;
  status?: string;
}
```

**Usage:**
```typescript
// Access latest metrics
const currentLoss = metrics?.loss;
const currentStep = metrics?.step;
const throughput = metrics?.samples_per_second;
```

---

## Example Component

```typescript
'use client';

import { useTrainingWebSocket } from '@/lib/hooks/useTrainingWebSocket';

export function TrainingMonitor({ jobId }: { jobId: string }) {
  const {
    metrics,
    isConnected,
    error,
    reconnect
  } = useTrainingWebSocket({
    jobId,
    enabled: true,
    onMetrics: (data) => {
      // Optional: Handle new metrics
      console.log('Training progress:', data.step, 'Loss:', data.loss);
    }
  });

  if (error) {
    return (
      <div className="error">
        <p>Connection error: {error}</p>
        <button onClick={reconnect}>Reconnect</button>
      </div>
    );
  }

  if (!isConnected) {
    return <div>Connecting to training session...</div>;
  }

  if (!metrics) {
    return <div>Waiting for metrics...</div>;
  }

  return (
    <div className="metrics-panel">
      <div>Step: {metrics.step}</div>
      <div>Loss: {metrics.loss.toFixed(4)}</div>
      <div>Throughput: {metrics.samples_per_second.toFixed(2)} samples/sec</div>
      <div>GPU: {metrics.gpu_utilization.toFixed(1)}%</div>
      <div>Memory: {metrics.gpu_memory_used.toFixed(1)} MB</div>
      <div>Temp: {metrics.gpu_temperature.toFixed(1)}°C</div>
      
      <div className="connection-status">
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
}
```

---

## Environment Variables

Make sure you have the training server URL configured:

```env
# .env.local
NEXT_PUBLIC_TRAINING_BACKEND_URL=http://localhost:8000
# or
LOCAL_TRAINING_SERVER_URL=http://localhost:8000
```

The hook will automatically convert `http://` to `ws://` for WebSocket connections.

---

## Comparison: Old vs New

| Feature | Supabase Realtime | WebSocket Direct |
|---------|-------------------|------------------|
| Latency | ~2 seconds (polling) | < 1 second |
| Setup | Requires DB writes | Direct stream |
| Dependencies | Supabase Realtime | Native WebSocket |
| Reconnection | Manual | Automatic (5 retries) |
| Heartbeat | No | Yes (30s) |
| Error Handling | Basic | Comprehensive |

---

## Files to Update

Search for components using the old hook:

```bash
# Find components using old hook
grep -r "useTrainingMetricsRealtime" app/
grep -r "useTrainingMetricsRealtime" components/
```

Common files that may need updating:
- `app/(dashboard)/training/[jobId]/page.tsx`
- `components/training/TrainingMonitor.tsx`
- `components/training/MetricsChart.tsx`
- Any component displaying real-time training progress

---

## Testing

1. **Start Training Server:**
   ```bash
   cd lib/training
   python training_server.py
   ```

2. **Start a Training Job:**
   ```bash
   curl -X POST http://localhost:8000/api/training/execute \
     -H "Content-Type: application/json" \
     -d '{"job_id": "test123", "config": {...}}'
   ```

3. **Test WebSocket Connection:**
   ```bash
   # Using wscat (npm install -g wscat)
   wscat -c ws://localhost:8000/ws/training/test123
   ```

4. **Verify in Browser:**
   - Open DevTools → Network → WS tab
   - Should see WebSocket connection to `/ws/training/{job_id}`
   - Should see real-time messages streaming

---

## Troubleshooting

### Issue: "WebSocket connection error"

**Solution:** Verify training server is running on port 8000

```bash
curl http://localhost:8000/health
```

### Issue: "Maximum reconnection attempts reached"

**Solution:** Check if job_id exists

```bash
curl http://localhost:8000/api/training/jobs/{job_id}
```

### Issue: No metrics received

**Solution:** Ensure training job is actually running

```bash
curl http://localhost:8000/api/training/status/{job_id}
```

### Issue: CORS errors

**Solution:** Training server CORS is already configured to allow all origins.
If still seeing CORS errors, check browser console for specific messages.

---

## Benefits of Migration

✅ **Faster:** < 1s latency vs 2s polling  
✅ **Simpler:** No database writes needed  
✅ **More Reliable:** Automatic reconnection  
✅ **Better UX:** Real-time updates feel instant  
✅ **Lower Load:** No database polling  
✅ **Phase 3 Feature:** Uses our new WebSocket implementation  

---

## Need Help?

- **WebSocket Implementation:** See `lib/training/training_server.py` (Phase 3 section)
- **Hook Implementation:** See `lib/hooks/useTrainingWebSocket.ts`
- **Phase 3 Docs:** See `lib/training/PHASE3_COMPLETE.md`

---

*Created: November 6, 2025*  
*Part of Phase 3: WebSocket Streaming implementation*
