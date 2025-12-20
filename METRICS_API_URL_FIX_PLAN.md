# Metrics API URL Fix Plan

**Issue:** RunPod training pods connecting to localhost:3000 instead of production URL
**Root Cause:** NEXT_PUBLIC_APP_URL=http://localhost:3000 in .env.local gets embedded at build time

---

## Problem Analysis

### Current Flow
1. `.env.local` has `NEXT_PUBLIC_APP_URL=http://localhost:3000`
2. Next.js embeds this at BUILD time (NEXT_PUBLIC_* vars are build-time)
3. Deployed to Render with localhost URL baked in
4. RunPod deployment uses this localhost URL
5. Trainer tries to POST to http://localhost:3000/api/training/local/metrics
6. Connection refused (localhost doesn't exist on RunPod pod)

### Why Auto-Detection Doesn't Work
Code at line 554-563:
```typescript
let appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!appUrl) {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  appUrl = `${protocol}://${host}`;
}
```

Problem: `NEXT_PUBLIC_APP_URL` IS set (to localhost), so auto-detection is skipped!

---

## Solution Options

### Option 1: Use Server-Side Environment Variable (RECOMMENDED)
**Approach:** Use runtime environment variable instead of build-time

**Changes:**
- app/api/training/deploy/runpod/route.ts line 554
- Change from `process.env.NEXT_PUBLIC_APP_URL` to `process.env.APP_BASE_URL`
- Fall back to NEXT_PUBLIC_APP_URL, then auto-detect
- Set APP_BASE_URL on Render (server-side only, not embedded in bundle)

**Pros:**
- Can change URL without rebuild
- Works for all environments
- Keeps .env.local as-is for local development

**Cons:**
- Requires Render environment variable configuration

### Option 2: Always Use Auto-Detection in Production
**Approach:** Ignore NEXT_PUBLIC_APP_URL if it's localhost in production

**Changes:**
- app/api/training/deploy/runpod/route.ts line 554-563
- Check if appUrl is localhost AND in production
- If so, use auto-detection instead

**Pros:**
- No environment variable needed
- Automatically works in production

**Cons:**
- Relies on request headers being correct
- Could break if headers are missing

### Option 3: Remove from .env.local
**Approach:** Delete NEXT_PUBLIC_APP_URL from .env.local entirely

**Changes:**
- Remove line from .env.local
- Always use auto-detection

**Pros:**
- Simplest change
- Auto-detection works

**Cons:**
- Breaks if auto-detection fails
- Less explicit configuration

---

## Recommended Implementation: Hybrid Approach

Combine Option 1 + Option 2 for maximum reliability:

```typescript
// Priority order:
// 1. Server-side APP_BASE_URL (runtime, changeable)
// 2. If NEXT_PUBLIC_APP_URL is NOT localhost, use it
// 3. Auto-detect from request headers
// 4. Warn if still localhost in production

let appUrl = process.env.APP_BASE_URL || process.env.ALERT_APP_BASE_URL;

if (!appUrl || appUrl.includes('localhost')) {
  const buildTimeUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (buildTimeUrl && !buildTimeUrl.includes('localhost')) {
    appUrl = buildTimeUrl;
  }
}

if (!appUrl || appUrl.includes('localhost')) {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  appUrl = `${protocol}://${host}`;
  console.log('[RunPod API] Auto-detected app URL:', appUrl);
}

if (appUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
  console.error('[RunPod API] ⚠️ WARNING: Using localhost URL in production!');
  console.error('[RunPod API] Set APP_BASE_URL environment variable to fix this.');
}
```

---

## Implementation Steps

1. Update app/api/training/deploy/runpod/route.ts with hybrid logic
2. Test locally (should still use localhost)
3. Commit changes
4. On Render, set environment variable: `APP_BASE_URL=https://finetunelab.ai`
5. Deploy and test with new training job

---

## Files to Update

- `app/api/training/deploy/runpod/route.ts` (lines 554-570)

---

## Testing Checklist

- [ ] Local development: appUrl = http://localhost:3000
- [ ] Production without APP_BASE_URL: appUrl = auto-detected from headers
- [ ] Production with APP_BASE_URL: appUrl = APP_BASE_URL value
- [ ] RunPod receives correct production URL
- [ ] Metrics POST succeeds
- [ ] Alerts POST succeeds
