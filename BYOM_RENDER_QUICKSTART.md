# BYOM - Render Deployment Quick Start

**Platform**: Render.com
**Status**: ✅ Ready to Deploy

---

## 🚀 Deploy in 3 Steps

### Step 1: Set Environment Variables

Go to **Render Dashboard** → Your Web Service → **Environment**

Add these variables:

```bash
# Required for BYOM
DEMO_ENCRYPTION_KEY=36b166b741c2b8218ff42767724dc24bb334c84b5970f3a964fb8931bd3f755d
CRON_SECRET=<generate-new-secret>
```

**Generate CRON_SECRET**:
```bash
openssl rand -base64 32
```

### Step 2: Update Domain in render.yaml

Edit `render.yaml` line 92:
```yaml
# Change this:
https://finetunelab-production.onrender.com

# To your actual domain:
https://your-actual-app-name.onrender.com
```

### Step 3: Deploy

```bash
git add render.yaml BYOM_*.md RENDER_DEPLOYMENT.md
git commit -m "feat: add BYOM deployment for Render with cron cleanup"
git push origin main
```

Render will automatically:
- ✅ Deploy web service with BYOM support
- ✅ Create cron job for hourly cleanup
- ✅ Apply environment variables

---

## 📋 Post-Deployment

### 1. Seed Test Suites

After deployment completes:

```bash
node scripts/seed-demo-test-suites.mjs
```

Creates 8 test suites with 80 prompts.

### 2. Verify Cron Job

**Render Dashboard** → **Cron Jobs** → `cleanup-demo-sessions`

- Status: Running ✅
- Schedule: `0 * * * *` (hourly)
- Last run: Check logs

### 3. Test BYOM Flow

Visit: `https://your-app.onrender.com/demo/test-model`

1. Select domain (Q&A, Code, Support, Creative)
2. Configure model (Together.ai, Groq, etc.)
3. Run batch test (10 prompts)
4. Chat with your model
5. Export results
6. Clean up

---

## 📁 Files Updated

| File | Purpose |
|------|---------|
| `render.yaml` | Added BYOM env vars + cron job |
| `app/api/cron/cleanup-demo-sessions/route.ts` | Cron endpoint |
| `scripts/seed-demo-test-suites.mjs` | Seed script |
| `scripts/test-byom-e2e.mjs` | E2E test |
| `BYOM_IMPLEMENTATION_AUDIT.md` | Technical audit (23KB) |
| `RENDER_DEPLOYMENT.md` | Full deployment guide |
| `BYOM_DEPLOYMENT_COMPLETE.md` | Feature completion doc |

---

## 🔍 Troubleshooting

### Cron job not running?

**Check logs**:
```
Render Dashboard → Cron Jobs → cleanup-demo-sessions → Logs
```

**Manual test**:
```bash
curl -X DELETE https://your-app.onrender.com/api/cron/cleanup-demo-sessions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected:
```json
{"success": true, "deleted": {...}, "timestamp": "..."}
```

### "Localhost URLs not allowed"?

This is correct behavior in production. Use public HTTPS endpoints only.

For local testing: Use ngrok or similar tunnel.

---

## 📚 Full Documentation

- **Architecture & Security**: [BYOM_IMPLEMENTATION_AUDIT.md](./BYOM_IMPLEMENTATION_AUDIT.md)
- **Render Deployment Guide**: [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)
- **Feature Completion**: [BYOM_DEPLOYMENT_COMPLETE.md](./BYOM_DEPLOYMENT_COMPLETE.md)

---

## ✅ Deployment Checklist

- [ ] `DEMO_ENCRYPTION_KEY` added to Render
- [ ] `CRON_SECRET` generated and added
- [ ] Domain updated in `render.yaml`
- [ ] Code pushed to main
- [ ] Web service deployed successfully
- [ ] Cron job created and running
- [ ] Test suites seeded
- [ ] Manual BYOM test completed
- [ ] Cron job verified (check logs after 1 hour)

---

**Ready to deploy!** 🎉

For issues: See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) or check Render logs.
