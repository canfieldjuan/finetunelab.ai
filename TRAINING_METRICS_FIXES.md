# Training Metrics Dashboard Fixes

**Date:** 2025-12-19
**Branch:** `claude/training-metrics-fixes`

---

## 🐛 Issues Reported

User reported several missing metrics and incorrect status for cloud (RunPod) training jobs:

1. **Job Status:** All cloud training jobs showing as "failed" even though they succeeded
2. **Missing Metrics:** Eval Loss, Perplexity, Learning Rate showing "Pending..."
3. **Missing Metadata:** Dataset size, total steps, progress % all missing

---

## 🔍 Root Cause Analysis

### Issue 1: Jobs Showing as "Failed" ❌

**Root Cause:**
- `standalone_trainer.py` calls `trigger_alert('job_completed')` when training finishes
- This only sends an email notification via `/api/alerts/trigger`
- It does NOT update `local_training_jobs.status` to 'completed'
- Jobs remain stuck in 'running' status forever
- UI interprets stale 'running' jobs as failed

**Files Involved:**
- `lib/training/standalone_trainer.py:3655` - Triggers alert
- `app/api/alerts/trigger/route.ts:68` - Receives alert but doesn't update DB
- `lib/alerts/alert.service.ts` - Only sends notifications

**Fix:**
Add database update to `/api/alerts/trigger` endpoint:
```typescript
// When job_completed alert received:
if (body.type === 'job_completed') {
  await supabase
    .from('local_training_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', body.job_id);
}

// When job_failed alert received:
if (body.type === 'job_failed') {
  await supabase
    .from('local_training_jobs')
    .update({
      status: 'failed',
      error: body.error_message,
      failed_at: new Date().toISOString()
    })
    .eq('id', body.job_id);
}
```

---

### Issue 2: Eval Loss Showing "Pending..." ⚠️

**Root Cause:**
- **This is actually EXPECTED behavior, NOT a bug!**
- DPO/ORPO templates: `evaluation_strategy: 'steps'`, `eval_steps: 100`
- CPT template: `evaluation_strategy: 'steps'`, `eval_steps: 500`
- Eval loss is only calculated at evaluation steps (every 100 or 500 steps)
- Early in training (steps < 100), `eval_loss` is NULL
- This is correct behavior!

**Files Involved:**
- `lib/training/standalone_trainer.py:773` - `eval_loss = logs.get('eval_loss')` (None if no eval yet)
- `lib/training/training-templates.ts:218,637` - Evaluation configs
- `components/training/TrainingDashboard.tsx:589-592` - Displays "Pending..." when null

**Fix:**
- **No code fix needed** - behavior is correct
- Update UI to show better message: "Awaiting evaluation (every 100 steps)" instead of "Pending..."
- Document this as expected behavior

---

### Issue 3: Perplexity and Learning Rate Metrics ✅

**Status:** Actually working correctly!

**Investigation:**
- `standalone_trainer.py:838,952` - Both metrics ARE calculated and POSTed
- Perplexity: Calculated from train_loss via `math.exp(loss)`
- Learning Rate: Extracted from `logs.get('learning_rate')`
- API stores them correctly in `local_training_metrics` table

**Why they might show "Pending...":**
- Perplexity: Only calculated if `train_loss` exists (should exist from step 1)
- Learning Rate: Depends on Hugging Face trainer including it in logs (should be there)
- If showing "Pending...", it means the values are NULL in the database

**Verification Needed:**
- Check actual database values for a running job
- If NULL, need to debug why trainer isn't providing these values

---

### Issue 4: Dataset Size Missing 📊

**Root Cause:**
- Job created at: `app/api/training/deploy/runpod/route.ts:497-508`
- Only inserts: `id, user_id, model_name, dataset_path, status, job_token, config, started_at`
- Does NOT populate: `total_samples`, `train_samples`, `val_samples`
- UI component relies on these fields to display dataset size
- Without them: shows "Unknown"

**Files Involved:**
- `app/api/training/deploy/runpod/route.ts:497-508` - Job creation
- `lib/training/progress-calculator.ts:138-173` - Tries to extract `total_samples`
- `components/training/TrainingDashboard.tsx:738-745` - Displays dataset size

**Fix:**
Extract dataset metadata at job creation:
```typescript
// Get dataset metadata
const { data: dataset } = await supabase
  .from('training_datasets')
  .select('sample_count, train_samples, val_samples')
  .eq('storage_path', datasetStoragePath)
  .single();

// Add to job insert
const { error: jobError } = await supabase
  .from('local_training_jobs')
  .insert({
    // ... existing fields
    total_samples: dataset?.sample_count || null,
    train_samples: dataset?.train_samples || null,
    val_samples: dataset?.val_samples || null,
  });
```

---

### Issue 5: Total Steps Missing 🎯

**Root Cause:**
- `total_steps` field not populated at job creation
- UI calculator tries to estimate from: `total_samples / batch_size * num_epochs`
- But without `total_samples`, calculation fails
- Result: "Unknown" for total steps

**Files Involved:**
- `app/api/training/deploy/runpod/route.ts:497-508` - Job creation
- `lib/training/progress-calculator.ts:179-228` - Tries to calculate total_steps
- `components/training/TrainingDashboard.tsx` - Displays total steps

**Fix:**
Calculate total_steps from config at job creation:
```typescript
// Extract training config
const config = trainingConfig.config_json;
const batchSize = config.training?.batch_size || 4;
const gradAccum = config.training?.gradient_accumulation_steps || 8;
const numEpochs = config.training?.num_epochs || 3;
const sampleCount = dataset?.sample_count || 0;

// Calculate total steps
const effectiveBatch = batchSize * gradAccum;
const stepsPerEpoch = Math.ceil(sampleCount / effectiveBatch);
const totalSteps = stepsPerEpoch * numEpochs;

// Add to job insert
const { error: jobError } = await supabase
  .from('local_training_jobs')
  .insert({
    // ... existing fields
    total_steps: totalSteps,
    expected_total_steps: totalSteps,
  });
```

---

### Issue 6: Progress % Missing 📈

**Root Cause:**
- Progress % calculated as: `(currentStep / totalSteps) * 100`
- Without `totalSteps`, calculation fails
- Falls back to `raw.progress` field which is also NULL for cloud jobs
- Result: shows 0% or missing

**Files Involved:**
- `lib/training/progress-calculator.ts:434-436` - Progress calculation
- `components/training/TrainingDashboard.tsx` - Displays progress

**Fix:**
- Once `total_steps` is populated (Issue 5 fix), progress % will calculate correctly
- No additional code needed

---

## 🔧 Implementation Plan

### Priority 1: Critical Fixes (User-Facing)

1. **Fix Job Status** (Issue 1)
   - File: `app/api/alerts/trigger/route.ts`
   - Add database update for `job_completed` and `job_failed` alerts
   - Test: Run DPO job, verify status changes to 'completed'

2. **Fix Dataset Size & Total Steps** (Issues 4, 5)
   - File: `app/api/training/deploy/runpod/route.ts`
   - Query dataset metadata before job creation
   - Calculate total_steps from config + sample_count
   - Populate fields in job insert
   - Test: Create new job, verify fields populated

### Priority 2: UI Improvements

3. **Improve Eval Loss Message** (Issue 2)
   - File: `components/training/TrainingDashboard.tsx`
   - Change "Pending..." to "Awaiting evaluation (every X steps)"
   - Extract eval_steps from config to show accurate message

### Priority 3: Verification

4. **Verify Perplexity & Learning Rate** (Issue 3)
   - Query running job metrics from database
   - Check if values are actually NULL or just not displaying
   - If NULL, debug trainer logs to see if values are in logs dict

---

## 📋 Testing Checklist

- [ ] Deploy DPO job, verify status updates to 'completed'
- [ ] Deploy ORPO job, verify status updates to 'completed'
- [ ] Deploy CPT job, verify status updates to 'completed'
- [ ] Verify dataset size displays correctly
- [ ] Verify total steps displays correctly
- [ ] Verify progress % displays correctly
- [ ] Verify eval loss shows better message before first eval
- [ ] Verify perplexity displays (if not, investigate)
- [ ] Verify learning rate displays (if not, investigate)

---

## 🎯 Expected Outcomes

**After fixes:**
- ✅ Jobs show 'completed' status when training finishes
- ✅ Dataset size displays: "500 samples" instead of "Unknown"
- ✅ Total steps displays: "156 steps" instead of "Unknown"
- ✅ Progress displays: "45%" instead of "0%" or missing
- ✅ Eval loss shows helpful message before first evaluation
- ⚠️ Eval loss shows value after first evaluation (100+ steps for DPO/ORPO, 500+ for CPT)
- ✅ Perplexity displays from step 1
- ✅ Learning rate displays from step 1

---

## 📝 Notes

**Eval Loss Clarification:**
- DPO/ORPO: First eval at step 100
- CPT: First eval at step 500
- SFT: Depends on template (typically every 500 steps)
- This is CORRECT behavior - not a bug!

**Database Schema:**
- `local_training_jobs` table has all required fields
- No migration needed, just populate them at creation

**Backward Compatibility:**
- Existing jobs won't have these fields (will remain NULL)
- Only affects new jobs created after this fix
- UI already handles NULL gracefully (shows "Unknown")

---

**Last Updated:** 2025-12-19
