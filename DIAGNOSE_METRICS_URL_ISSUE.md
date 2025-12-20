# Diagnose Metrics URL Issue

## Verification Steps

### 1. Check Render Deployment Logs

After deployment completes, create a new training job and look for these log lines:

```
[RunPod API] === URL DETECTION DEBUG ===
[RunPod API] APP_BASE_URL: <value or NOT SET>
[RunPod API] ALERT_APP_BASE_URL: <value or NOT SET>
[RunPod API] NEXT_PUBLIC_APP_URL: <value>
[RunPod API] Request host: <host>
[RunPod API] Request protocol: <protocol>
[RunPod API] NODE_ENV: <environment>
[RunPod API] === FINAL URL: <url> ===
```

### 2. Identify the Issue

**If you see:**
```
[RunPod API] === FINAL URL: http://localhost:3000 ===
[RunPod API] ⚠️  WARNING: Using localhost URL in production!
```

**Then:**
- APP_BASE_URL is NOT set on Render
- NEXT_PUBLIC_APP_URL has localhost (from build)
- Auto-detection failed

**Solution:** Set `APP_BASE_URL=https://finetunelab.ai` on Render

---

**If you see:**
```
[RunPod API] === FINAL URL: https://finetunelab.ai ===
```

**But RunPod still connects to localhost, then:**
- The job was created BEFORE the fix was deployed
- Check the actual METRICS_API_URL in RunPod logs

---

### 3. Verify Endpoint Accepts POST

The endpoint `/api/training/local/metrics` is verified to:
- ✅ Export POST handler (line 46)
- ✅ Accept Authorization: Bearer {token} header
- ✅ Validate job_token
- ✅ Insert metrics to database

**Requirements:**
1. Content-Type: application/json
2. Authorization: Bearer {job_token}
3. Body: { "job_id": "...", "metrics": [{...}] }

All of these ARE correctly sent by standalone_trainer.py (verified lines 974-978)

---

### 4. Check RunPod Pod Logs

In the RunPod pod logs, look for:
```
[MetricsCallback] Cloud mode enabled - will POST to <URL>
```

**If it shows localhost:**
- The environment variable passed to RunPod is wrong
- Check Render logs to see what URL was constructed at deployment time

**If it shows correct URL but still fails:**
- Network/firewall issue
- Check if RunPod can reach your domain

---

## Quick Fix Checklist

- [ ] Deployment shows: `=== FINAL URL: https://finetunelab.ai ===`
- [ ] No warning about localhost in production
- [ ] RunPod pod shows correct URL in logs
- [ ] Metrics POST succeeds (no connection refused)

---

## If Auto-Detection Works

If logs show:
```
[RunPod API] ✓ Auto-detected app URL from request: https://finetunelab.ai
```

Then auto-detection is working! You don't need to set APP_BASE_URL.

---

## If Still Failing After Fix

1. **Check job was created AFTER deployment**
   - Old jobs have old URL baked in
   - Create a NEW job to test

2. **Check RunPod can reach your domain**
   - Try: `curl https://finetunelab.ai/api/health`
   - Should return 200 OK

3. **Check INTERNAL_API_KEY if using alerts**
   - Required for /api/alerts/trigger
   - Not required for /api/training/local/metrics

---

## Expected Working Flow

1. User creates training job on UI
2. Render logs show: `=== FINAL URL: https://finetunelab.ai ===`
3. RunPod deployment gets: `METRICS_API_URL=https://finetunelab.ai/api/training/local/metrics`
4. Trainer logs: `[MetricsCallback] Cloud mode enabled - will POST to https://finetunelab.ai/api/training/local/metrics`
5. Trainer POSTs metrics successfully
6. No connection refused errors
