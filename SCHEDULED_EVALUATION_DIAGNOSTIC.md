# Scheduled Evaluation System Diagnostic

## System Architecture

### How It Works:
1. **Test Suites** - Collections of prompts stored in `test_suites` table
2. **Scheduled Evaluations** - Configured schedules in `scheduled_evaluations` table  
3. **Background Worker** - Checks every minute for due evaluations
4. **Batch Testing** - Worker triggers batch tests using the test suite prompts
5. **Alerts** - Sends notifications on completion/failure

### Complete Flow:
```
User creates test suite (prompts)
    ↓
User creates scheduled evaluation (model + test suite + schedule)
    ↓
Background worker runs (npm run scheduler:start)
    ↓
Worker checks every minute for due evaluations
    ↓
Worker calls /api/batch-testing/run with test_suite_id
    ↓
Batch API fetches prompts from test suite
    ↓
Tests execute, results stored in batch_test_runs
    ↓
Alerts sent (if configured)
```

## Issue Identified

### Problem: Scheduler Worker Is NOT Running

The scheduler worker needs to be running as a background process. It's likely not started, which means:
- ❌ No evaluations are being triggered
- ❌ `next_run_at` times pass without execution
- ❌ Alerts are never sent

### Evidence:
- Worker start script exists: `scripts/start-scheduler-worker.ts`
- Package.json has command: `npm run scheduler:start`
- But worker is probably not running on your system or Render

## How to Fix

### Option 1: Run Worker Locally (Development)

```bash
# Terminal 1: Run your Next.js app
npm run dev

# Terminal 2: Run the scheduler worker
npm run scheduler:start
```

The worker will:
- Check for due evaluations every minute
- Trigger batch tests automatically
- Send alerts
- Keep running until you Ctrl+C

### Option 2: Deploy as Render Background Worker (Production)

1. **Go to Render Dashboard**
2. Click **New +** > **Background Worker**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `finetunelab-scheduler`
   - **Environment**: Same as your web service
   - **Build Command**: `npm install`
   - **Start Command**: `npm run scheduler:start`
5. Add environment variables (same as web service):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (URL of your web service)

6. Click **Create Background Worker**

The worker will run 24/7 and automatically trigger scheduled evaluations.

## How to Verify It's Working

### Check 1: Worker Health
```bash
# Check if worker is running locally
ps aux | grep "scheduler"

# Or check the health endpoint
curl http://localhost:3000/api/health/scheduler
```

### Check 2: Test Suite Exists
```bash
# Run this diagnostic
npm run scheduler:check
```

### Check 3: Create a Test Evaluation

1. Go to UI and create a test suite with some prompts
2. Create a scheduled evaluation:
   - Select a model
   - Select the test suite
   - Set schedule to run in next 2 minutes
3. Watch worker logs
4. Check if batch test runs

## Quick Diagnostic Commands

```bash
# Check if you have test suites
npm run scheduler:check

# Start worker (development)
npm run scheduler:start

# Check worker health
curl http://localhost:3000/api/health/scheduler | jq
```

## Database Tables

### test_suites
- Stores prompt collections
- Each suite has `prompts` JSONB array
- Created via `/api/test-suites` or UI

### scheduled_evaluations
- Stores evaluation schedules
- Links to test_suite_id and model_id
- Has `next_run_at` timestamp
- Worker queries this table every minute

### scheduled_evaluation_runs
- Stores execution history
- Linked to batch_test_runs
- Shows status (triggered, completed, failed)

### batch_test_runs
- Stores actual test results
- Created by `/api/batch-testing/run`
- Contains metrics, errors, etc.

## Common Issues

### Issue: "No prompts to test"
**Cause**: Test suite doesn't exist or has no prompts
**Fix**: Create test suite with prompts first

### Issue: "Test suite not found"
**Cause**: Wrong test_suite_id or permission issue
**Fix**: Verify test suite belongs to user

### Issue: Evaluations never trigger
**Cause**: Worker not running
**Fix**: Start worker with `npm run scheduler:start`

### Issue: Worker crashes
**Cause**: Missing environment variables
**Fix**: Check `.env.local` has all required vars

## Next Steps

1. ✅ Start the scheduler worker
2. ✅ Create a test suite with prompts
3. ✅ Create a scheduled evaluation
4. ✅ Verify it runs
5. ✅ Deploy worker to Render for production

