# Render Environment Variable Setup

## Critical: Fix RunPod Metrics Connection

### Problem
RunPod training pods trying to connect to `localhost:3000` instead of production URL.

### Solution
Add server-side environment variable on Render.

---

## Steps to Fix on Render

1. **Go to Render Dashboard**
   - Navigate to your web service
   - Click on "Environment" tab

2. **Add New Environment Variable**
   ```
   Key:   APP_BASE_URL
   Value: https://finetunelab.ai
   ```

3. **Save Changes**
   - Click "Save Changes"
   - Render will automatically redeploy

4. **Verify Fix**
   - Wait for deployment to complete
   - Start a new training job
   - Check logs for:
     ```
     [RunPod API] Auto-detected app URL from request: https://finetunelab.ai
     ```
   - Training metrics should POST successfully (no connection refused errors)

---

## What This Fixes

### Before
- `NEXT_PUBLIC_APP_URL=http://localhost:3000` from `.env.local`
- Gets embedded at build time
- RunPod tries: `http://localhost:3000/api/training/local/metrics`
- Error: `Connection refused`

### After
- `APP_BASE_URL=https://finetunelab.ai` on Render (runtime)
- RunPod uses: `https://finetunelab.ai/api/training/local/metrics`
- Metrics POST successfully
- Alerts POST successfully

---

## Alternative: Use Auto-Detection

If you don't set `APP_BASE_URL`, the system will auto-detect from request headers:
- Protocol: `x-forwarded-proto` header (usually `https`)
- Host: `host` header (e.g., `finetunelab.ai`)
- Result: `https://finetunelab.ai`

**However**, setting `APP_BASE_URL` explicitly is recommended for reliability.

---

## Verification

After deploying, check logs when creating a training job:

**Good (Fixed):**
```
[RunPod API] Auto-detected app URL from request: https://finetunelab.ai
[RunPod API] DEBUG - Constructed METRICS_API_URL: https://finetunelab.ai/api/training/local/metrics
```

**Bad (Still Broken):**
```
[RunPod API] ⚠️ WARNING: Using localhost URL in production!
[RunPod API] Set APP_BASE_URL environment variable to fix this.
[RunPod API] DEBUG - Constructed METRICS_API_URL: http://localhost:3000/api/training/local/metrics
```

---

## Troubleshooting

### Still seeing localhost after setting APP_BASE_URL?

1. **Verify variable is saved**
   - Check Render Environment tab
   - Variable should show: `APP_BASE_URL` = `https://finetunelab.ai`

2. **Redeploy**
   - Click "Manual Deploy" > "Deploy latest commit"
   - Wait for deployment to complete

3. **Check deployment logs**
   - Look for "Using APP_BASE_URL" or "Auto-detected" messages
   - Should NOT see "Using NEXT_PUBLIC_APP_URL"

### Metrics still failing?

1. **Check firewall/network**
   - Ensure Render allows outbound HTTPS
   - RunPod should be able to reach your domain

2. **Verify INTERNAL_API_KEY**
   - Check if `INTERNAL_API_KEY` is set on Render
   - This is required for alert/metrics API authentication

3. **Check logs in training pod**
   - Look for actual URL being used
   - Should be `https://finetunelab.ai/api/...`
