# BYOM Deployment Guide for Render

**Platform**: Render.com
**Date**: December 26, 2025
**Feature**: BYOM (Bring Your Own Model)

---

## Quick Start

### 1. Set Environment Variables in Render Dashboard

Go to your web service → Environment:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# BYOM - Production Encryption Key
DEMO_ENCRYPTION_KEY=36b166b741c2b8218ff42767724dc24bb334c84b5970f3a964fb8931bd3f755d

# BYOM - Cron Authentication (generate new for production)
CRON_SECRET=<generate-with-openssl>

# Optional (development only)
NODE_ENV=production
# DEMO_ALLOW_LOCALHOST=false  # Default, don't set in production
```

**Generate CRON_SECRET**:
```bash
openssl rand -base64 32
```

---

## 2. Configure Cron Job in Render

### Option A: Using Render Dashboard (Recommended)

1. Go to **Dashboard** → **New** → **Cron Job**
2. **Name**: `cleanup-demo-sessions`
3. **Schedule**: `0 * * * *` (every hour)
4. **Command**:
```bash
curl -X DELETE https://your-app-name.onrender.com/api/cron/cleanup-demo-sessions \
  -H "Authorization: Bearer $CRON_SECRET"
```
5. **Environment**: Link to same environment as web service
6. Click **Create Cron Job**

### Option B: Using render.yaml (Infrastructure as Code)

The `render.yaml` file is already configured. To use it:

1. Commit `render.yaml` to your repo
2. In Render Dashboard → **New** → **Blueprint**
3. Connect your repository
4. Render will auto-create:
   - Web service
   - Cron job for cleanup

**Update `render.yaml` with your domain**:
```yaml
startCommand: |
  curl -X DELETE https://your-actual-domain.onrender.com/api/cron/cleanup-demo-sessions \
    -H "Authorization: Bearer $CRON_SECRET"
```

---

## 3. Seed Test Suites

After deployment, seed the database with test prompts:

```bash
# Connect to your deployed app (from local machine)
node scripts/seed-demo-test-suites.mjs
```

This creates 8 test suites with 80 curated prompts across 4 domains.

---

## 4. Verify Deployment

### Test BYOM Flow

1. Go to `https://your-app.onrender.com/demo/test-model`
2. Select a test domain (e.g., "Q&A")
3. Configure model:
   - Choose provider preset (Together.ai, Groq, etc.)
   - Enter API key
   - Test connection
4. Run batch test (10 prompts)
5. Chat with your model about results
6. Export CSV/JSON
7. Clean up session

### Verify Cron Job

Check **Render Dashboard** → **Cron Jobs** → **cleanup-demo-sessions**:
- Status should be "Running"
- Logs should show hourly executions
- Look for successful cleanup messages

**Manual Test**:
```bash
curl -X DELETE https://your-app.onrender.com/api/cron/cleanup-demo-sessions \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -v
```

Expected response:
```json
{
  "success": true,
  "deleted": {
    "configs": 2,
    "testRuns": 2,
    "results": 15
  },
  "timestamp": "2025-12-26T01:00:00.000Z"
}
```

---

## Render-Specific Features

### Health Checks

Render automatically pings your app. Add a health endpoint (optional):

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
}
```

### Environment Groups

For multiple services (web + workers), use **Environment Groups**:
1. Dashboard → Environment Groups → New Group
2. Add shared variables (Supabase, DEMO_ENCRYPTION_KEY)
3. Link to both web service and cron job

### Auto-Deploy

Enable auto-deploy from GitHub:
1. Service Settings → GitHub
2. Enable "Auto-Deploy"
3. Choose branch (usually `main`)

---

## Background Workers (If Using)

If you're already running a background worker on Render, you can add cleanup there instead:

### Update Worker Script

Add to your existing worker (e.g., `lib/evaluation/scheduler-worker.ts`):

```typescript
import { cleanupExpiredDemoSessions } from '@/lib/demo/cleanup';

// Add to your worker's periodic tasks
setInterval(async () => {
  console.log('[Worker] Running demo session cleanup...');
  const result = await cleanupExpiredDemoSessions();
  console.log('[Worker] Cleanup complete:', result);
}, 60 * 60 * 1000); // Every hour
```

This eliminates the need for a separate cron job.

---

## Database Migrations

Migrations should already be applied. If not:

```bash
# Check if migrations exist
SELECT * FROM demo_model_configs LIMIT 1;

# If table doesn't exist, run migrations:
# 1. supabase/migrations/20251215100000_create_demo_v2_tables.sql
# 2. supabase/migrations/20251226000000_add_demo_rate_limiting.sql
```

---

## Monitoring & Logs

### View Logs

**Web Service**:
```bash
# Render Dashboard → Your Service → Logs
# Look for:
[API/demo/v2/configure] Session created: demo-...
[Background Batch] Processing prompt 1/10
[DemoAtlas] Chat request for session demo-...
```

**Cron Job**:
```bash
# Render Dashboard → Cron Jobs → cleanup-demo-sessions → Logs
# Look for:
[Cron/Cleanup] Starting cleanup...
[Cron/Cleanup] Cleanup complete: { deleted: { configs: 2, ... } }
```

### Monitor Database

```sql
-- Active demo sessions
SELECT COUNT(*) FROM demo_model_configs
WHERE expires_at > NOW();

-- Sessions created today
SELECT COUNT(*) FROM demo_model_configs
WHERE created_at >= CURRENT_DATE;

-- Batch tests completed today
SELECT COUNT(*) FROM demo_batch_test_runs
WHERE status = 'completed'
  AND completed_at >= CURRENT_DATE;

-- Average success rate
SELECT AVG(
  (completed_prompts::float / NULLIF(total_prompts, 0)) * 100
) as avg_success_rate
FROM demo_batch_test_runs
WHERE status = 'completed';
```

---

## Troubleshooting

### Issue: "Localhost URLs are not allowed in production"

**Cause**: Trying to use localhost endpoint in production.

**Fix**: Only use public HTTPS endpoints. For testing with local models:
1. Use ngrok or similar tunnel: `ngrok http 8000`
2. Use the public URL: `https://abc123.ngrok.io/v1/chat/completions`

### Issue: Cron job not running

**Check**:
1. Render Dashboard → Cron Jobs → Status
2. Verify `CRON_SECRET` is set
3. Check logs for errors

**Manual trigger**:
```bash
curl -X DELETE https://your-app.onrender.com/api/cron/cleanup-demo-sessions \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Issue: "Failed to decrypt API key"

**Cause**: `DEMO_ENCRYPTION_KEY` changed or missing.

**Fix**:
1. Ensure `DEMO_ENCRYPTION_KEY` is set in Render environment
2. Use the same key across all environments
3. If key changed, old sessions won't work (expected behavior - create new sessions)

### Issue: Rate limiting blocking tests

**Cause**: IP-based limit (1 session per IP).

**Check active sessions**:
```sql
SELECT session_id, ip_address, created_at, expires_at
FROM demo_model_configs
WHERE ip_address = 'YOUR_IP'
  AND expires_at > NOW();
```

**Fix**: Wait for expiration or cleanup session:
```bash
curl -X DELETE "https://your-app.onrender.com/api/demo/v2/configure?session_id=SESSION_ID"
```

---

## Security Checklist

- [x] `DEMO_ENCRYPTION_KEY` set in Render environment (not committed to git)
- [x] `CRON_SECRET` set in Render environment
- [x] `DEMO_ALLOW_LOCALHOST` NOT set in production (defaults to false)
- [x] Cron endpoint requires `Authorization: Bearer $CRON_SECRET`
- [x] API keys encrypted with AES-256-GCM
- [x] Session TTL enforced (1 hour)
- [x] SSRF protection active (localhost/private IPs blocked)
- [x] Rate limiting active (1 session per IP)

---

## Performance Optimization

### Render Specific

**Instance Type**:
- Starter plan sufficient for testing
- Standard or higher for production (faster build times)

**Region**:
- Choose region closest to your Supabase instance
- Check: Render Dashboard → Service Settings → Region

**Autoscaling** (optional):
- Service Settings → Scaling
- Min instances: 1
- Max instances: 3+ (handles batch test spikes)

### Database Connection Pooling

Render doesn't include connection pooling by default. Use Supabase's built-in pooler:

```typescript
// In your Supabase client configuration
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false, // Don't persist in server context
    },
  }
);
```

---

## Cost Estimation

### Render Pricing (Approximate)

**Web Service**:
- Starter: $7/month (512 MB RAM, shared CPU)
- Standard: $25/month (2 GB RAM, 1 CPU)

**Cron Job**:
- Free (included with paid web service)
- Runs hourly, takes ~1 second

**Total**: $7-25/month depending on instance type

### Supabase Usage

**BYOM Feature**:
- Database: Minimal (sessions auto-delete after 1 hour)
- Storage: None (no file uploads)
- Bandwidth: Low (API calls only)

**Estimate**: Free tier sufficient for testing, ~$25/month for production

---

## Deployment Checklist

- [ ] Environment variables set in Render
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `DEMO_ENCRYPTION_KEY` (generated)
  - [ ] `CRON_SECRET` (generated)
- [ ] Database migrations applied
  - [ ] `create_demo_v2_tables.sql`
  - [ ] `add_demo_rate_limiting.sql`
- [ ] Test suites seeded
  - [ ] Run `scripts/seed-demo-test-suites.mjs`
- [ ] Cron job configured
  - [ ] Created in Render dashboard OR
  - [ ] Deployed via `render.yaml`
- [ ] Manual test completed
  - [ ] Session creation works
  - [ ] Batch test executes
  - [ ] Chat works
  - [ ] Export works
  - [ ] Cleanup works
- [ ] Cron job verified
  - [ ] Check logs for execution
  - [ ] Manual trigger successful

---

## Next Steps

1. **Deploy**: Push to GitHub → Render auto-deploys
2. **Seed**: Run `node scripts/seed-demo-test-suites.mjs`
3. **Test**: Try full BYOM flow end-to-end
4. **Monitor**: Check cron logs after 1 hour
5. **Optimize**: Adjust instance type if needed

---

**Render deployment ready!** 🚀

For issues, check:
- [Render Docs](https://render.com/docs)
- [BYOM Implementation Audit](./BYOM_IMPLEMENTATION_AUDIT.md)
- Render Dashboard → Logs
