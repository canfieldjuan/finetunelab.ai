# Live Trace Streaming - SSE Implementation Audit

**Date:** 2025-12-26
**Feature:** Real-time trace monitoring via Server-Sent Events
**Status:** Partially Implemented - Critical Gaps Identified

---

## Implementation Overview

### Backend: SSE Server (`app/api/analytics/traces/stream/route.ts`)

**Status:** ✅ Fully Implemented (170 lines)

**Features:**
- ✅ Authentication via Authorization header
- ✅ Supabase Realtime subscription to `llm_traces` table
- ✅ Event types: INSERT and UPDATE
- ✅ Keep-alive pings (30s interval)
- ✅ Proper cleanup on disconnect
- ✅ Error handling and logging
- ✅ SSE response headers (Content-Type, Cache-Control, Connection)
- ✅ User-filtered events (`user_id=eq.${user.id}`)

**Event Types Sent:**
1. `connected` - Initial connection established
2. `subscribed` - Realtime subscription active
3. `trace` - New trace inserted
4. `trace_update` - Existing trace updated
5. `ping` - Keep-alive heartbeat
6. `error` - Subscription errors

---

### Frontend: SSE Client (`components/analytics/TraceExplorer.tsx`)

**Status:** ⚠️ Partially Implemented - Critical Gap

**Features:**
- ✅ State management (`liveStreaming`, `streamStatus`)
- ✅ EventSource connection
- ✅ Auto-reconnect with exponential backoff (max 30s)
- ✅ UI toggle button with status indicator
- ✅ Event handling (trace, trace_update, ping)
- ✅ Cleanup on unmount
- ✅ Visual status indicator (connecting/connected/error)

**Lines:** 434-535 (streaming logic), 684-712 (UI toggle)

---

## Critical Gaps Identified

### 🔴 **GAP 1: Authorization Header Not Sent**
**Severity:** CRITICAL
**Impact:** SSE connection will fail with 401 Unauthorized

**Issue:**
```typescript
// Line 459 - NO AUTH HEADER
const eventSource = new EventSource(`/api/analytics/traces/stream`);
```

**Problem:** EventSource API doesn't support custom headers (including Authorization)

**Solutions:**
1. **Option A: URL-based token** (Recommended)
   - Pass token as query parameter: `/api/analytics/traces/stream?token=${session.access_token}`
   - Validate token server-side
   - ⚠️ Token visible in URL (less secure but standard for SSE)

2. **Option B: Fetch-based SSE** (More Complex)
   - Use `fetch()` with ReadableStream instead of EventSource
   - Allows custom headers
   - Requires manual SSE parsing

3. **Option C: Session-based auth**
   - Use HTTP-only cookies
   - Requires session middleware

**Recommendation:** Use Option A (URL token) - standard SSE authentication pattern

---

### 🟡 **GAP 2: No Visual Notification for New Traces**
**Severity:** MEDIUM
**Impact:** Users don't know when new traces arrive

**Current Behavior:**
- New traces silently refresh the list
- No toast notification
- No badge count

**Recommendation:**
- Add toast notification: "New trace received"
- Show badge on "Live" button: "Live (3 new)"
- Highlight new traces with animation

---

### 🟡 **GAP 3: No New Trace Counter**
**Severity:** MEDIUM
**Impact:** Users can't see how many new traces arrived

**Current Behavior:**
- Just refreshes list, no count

**Recommendation:**
```typescript
const [newTraceCount, setNewTraceCount] = useState(0);

// On new trace event:
setNewTraceCount(prev => prev + 1);

// Show in UI:
{liveStreaming && newTraceCount > 0 && (
  <Badge>{newTraceCount} new</Badge>
)}

// Reset on view:
const handleViewNewTraces = () => {
  setNewTraceCount(0);
  fetchTraces();
};
```

---

### 🟢 **GAP 4: No Error Display to User**
**Severity:** LOW
**Impact:** Users don't see why streaming failed

**Current Behavior:**
- Errors logged to console
- Status shows "error" but no details

**Recommendation:**
- Show error message in UI
- Add retry button
- Display connection lost notification

---

### 🟢 **GAP 5: No Manual Refresh During Streaming**
**Severity:** LOW
**Impact:** Users can't force refresh while streaming

**Current Behavior:**
- Auto-refresh on events only
- No manual trigger

**Recommendation:**
- Add "Refresh" button that works during streaming
- Show last refresh timestamp

---

### 🟢 **GAP 6: No Connection Quality Indicator**
**Severity:** LOW
**Impact:** Users don't know if connection is healthy

**Recommendation:**
- Track last ping timestamp
- Show "Last update: X seconds ago"
- Warn if no pings for 60+ seconds

---

## Implementation Status Summary

| Component | Status | Lines | Completeness |
|-----------|--------|-------|--------------|
| SSE Server API | ✅ Complete | 170 | 100% |
| SSE Client Logic | ⚠️ Auth Issue | 102 | 85% |
| UI Toggle/Status | ✅ Complete | 29 | 100% |
| Notifications | ❌ Missing | 0 | 0% |
| Error Handling | ⚠️ Partial | 25 | 50% |
| **Overall** | **⚠️ Needs Fixes** | **326** | **75%** |

---

## Files Modified

### Backend:
- ✅ `app/api/analytics/traces/stream/route.ts` (170 lines) - SSE endpoint

### Frontend:
- ⚠️ `components/analytics/TraceExplorer.tsx` (lines 78-84, 434-535, 684-712) - Client implementation

### Missing:
- ❌ Toast notification component integration
- ❌ New trace counter state
- ❌ Error display UI

---

## Testing Required

### Unit Tests:
- [ ] SSE endpoint authentication
- [ ] Realtime subscription filtering
- [ ] Keep-alive ping timing
- [ ] Cleanup on disconnect

### Integration Tests:
- [ ] End-to-end trace streaming
- [ ] Auto-reconnect on connection loss
- [ ] Multiple concurrent clients
- [ ] Performance with high trace volume

### Manual Tests:
- [ ] Connect/disconnect streaming
- [ ] Create new trace, verify real-time update
- [ ] Network interruption handling
- [ ] Browser tab switching
- [ ] Long-running connection stability (30+ min)

---

## Priority Fixes

1. **🔴 CRITICAL: Fix authorization** (1 hour)
   - Implement URL-based token authentication
   - Test auth flow end-to-end

2. **🟡 HIGH: Add visual feedback** (2 hours)
   - New trace notifications
   - Counter badge
   - Animation highlights

3. **🟡 MEDIUM: Error display** (1 hour)
   - Show connection errors
   - Add retry button

4. **🟢 LOW: Quality improvements** (2 hours)
   - Connection health indicator
   - Manual refresh button
   - Last update timestamp

**Total Estimated Time:** 6 hours

---

## Deployment Checklist

Before deploying to production:

- [ ] Fix authorization header issue
- [ ] Test with real Supabase Realtime
- [ ] Verify SSE works behind Render proxy
- [ ] Test connection limits (concurrent users)
- [ ] Monitor memory leaks on long connections
- [ ] Add rate limiting to prevent abuse
- [ ] Document SSE endpoint in API docs
- [ ] Add Sentry error tracking for SSE failures

---

## Next Steps

1. ✅ Complete this audit
2. ⏭️ Fix Gap 1 (Authorization)
3. ⏭️ Fix Gap 2 & 3 (Notifications)
4. ⏭️ Test end-to-end
5. ⏭️ Deploy and monitor
