# Predictions Feature - Gaps Analysis

**Date:** 2025-11-15
**Status:** Gap identification and remediation

---

## Critical Gaps Identified

### 1. **CRITICAL: No Training Loop Integration**
**Severity:** CRITICAL
**Impact:** Feature is non-functional - predictions never generated

**Problem:**
- Created 4 Python modules (config, sampler, generator, writer)
- Never integrated them into `standalone_trainer.py`
- No callback to trigger prediction generation at epoch end
- Missing imports in training script

**Solution:**
- Create `PredictionsCallback(TrainerCallback)` class
- Hook into trainer callbacks list
- Trigger at end of each epoch (or every N steps)
- Load samples once at training start
- Generate and save predictions asynchronously

**Files to modify:**
- `lib/training/standalone_trainer.py` - Add callback class and integration

---

### 2. **CRITICAL: Config Panel Not Integrated**
**Severity:** CRITICAL
**Impact:** Users cannot configure predictions

**Problem:**
- `PredictionsConfigPanel` component exists
- Not integrated into training job creation form
- No way for users to enable/configure predictions

**Solution:**
- Find training job creation form/workflow
- Add `PredictionsConfigPanel` component
- Store config in job's config JSONB field
- Pass config to training script via environment or config file

**Files to find/modify:**
- Training job creation form (needs identification)
- Job submission logic

---

### 3. **Gap: Config Persistence**
**Severity:** HIGH
**Impact:** Predictions config not passed to training script

**Problem:**
- Config validated in TypeScript
- Not clear how it gets to Python training script
- Missing environment variable passing

**Solution:**
- Document config flow: UI -> API -> Database -> Training Script
- Ensure predictions config in job.config is read by trainer
- Set environment variables before training starts

**Files to verify:**
- Job creation API endpoint
- Training script startup (config loading)

---

### 4. **Gap: Error Handling**
**Severity:** MEDIUM
**Impact:** Training could crash on prediction errors

**Problem:**
- Python modules have basic error handling
- Not wrapped in try/catch at callback level
- Could interrupt training if predictions fail

**Solution:**
- Wrap all prediction generation in try/except
- Log errors but don't stop training
- Gracefully degrade if predictions fail

**Files to update:**
- `lib/training/predictions_generator.py`
- `lib/training/predictions_writer.py`
- New callback class

---

### 5. **Gap: Disabled State Handling**
**Severity:** LOW
**Impact:** Unnecessary overhead when disabled

**Problem:**
- No check to skip predictions when disabled
- Would attempt to run even if config.enabled = false

**Solution:**
- Check config.enabled before initializing callback
- Skip callback registration if disabled
- No-op if predictions disabled

**Files to update:**
- Trainer initialization code

---

### 6. **Gap: Sample Loading**
**Severity:** MEDIUM
**Impact:** Predictions would fail without dataset access

**Problem:**
- PredictionsSampler needs dataset path
- Not clear how it gets dataset file path
- May not have access to training dataset

**Solution:**
- Pass dataset_path to callback during init
- Load samples once at training start
- Store samples in callback state

**Files to update:**
- Callback initialization

---

### 7. **Gap: User ID Propagation**
**Severity:** HIGH
**Impact:** Predictions can't be saved without user_id

**Problem:**
- `PredictionsWriter.write_predictions()` requires user_id
- user_id not available in training script context
- No way to associate predictions with user

**Solution:**
- Pass user_id via environment variable (JOB_USER_ID)
- Read from config or environment in callback
- Document required env vars

**Files to update:**
- Job submission code (set env var)
- Callback (read user_id)

---

### 8. **Gap: Missing Environment Variables**
**Severity:** LOW
**Impact:** Python modules would use hardcoded fallbacks

**Problem:**
- Python modules read from environment
- No guarantee env vars are set
- Missing from training script environment

**Solution:**
- Document all required env vars
- Set in job execution context
- Validate before training starts

**Files to document:**
- Required env vars list
- Job execution setup

---

### 9. **Gap: API Endpoint Path**
**Severity:** LOW
**Impact:** Minor - API works but could be better organized

**Problem:**
- Endpoints at `/api/training/predictions/[jobId]`
- Inconsistent with `/api/training/local/[jobId]/metrics`

**Status:** ACCEPTABLE - No change needed
**Rationale:** Predictions are cross-platform (local and cloud)

---

### 10. **Gap: OpenAPI Schema Reference**
**Severity:** LOW
**Impact:** API documentation could be clearer

**Problem:**
- Added TrainingPrediction schema
- Not referenced by $ref in responses
- Inline schemas in endpoint docs

**Solution:**
- Update endpoint responses to use $ref
- Ensure schema consistency

**Files to update:**
- `app/api/training/predictions/[jobId]/route.ts`
- `app/api/training/predictions/[jobId]/epochs/route.ts`

---

## Priority Order for Fixes

1. **P0 (Critical):** Training loop integration (Gap #1)
2. **P0 (Critical):** Config panel integration (Gap #2)
3. **P1 (High):** Config persistence (Gap #3)
4. **P1 (High):** User ID propagation (Gap #7)
5. **P2 (Medium):** Error handling (Gap #4)
6. **P2 (Medium):** Sample loading (Gap #6)
7. **P3 (Low):** Disabled state handling (Gap #5)
8. **P3 (Low):** Environment variables (Gap #8)
9. **P4 (Nice-to-have):** OpenAPI refs (Gap #10)

---

## Implementation Plan

### Phase 1: Critical Fixes (Required for MVP)

**Gap #1: Training Integration**
- Create `TrainingPredictionsCallback` class in standalone_trainer.py
- Implement `on_epoch_end()` method
- Load samples at `on_train_begin()`
- Generate predictions asynchronously
- Write to database with error handling

**Gap #2: UI Integration**
- Locate training job creation form
- Add `<PredictionsConfigPanel>` component
- Wire up config state
- Store in job config on submission

**Gap #3 & #7: Config & User ID**
- Ensure predictions config stored in job.config JSONB
- Pass user_id via JOB_USER_ID environment variable
- Read in callback initialization

### Phase 2: Robustness (Post-MVP)

**Gap #4: Error Handling**
- Comprehensive try/except in callback
- Graceful degradation
- Error logging

**Gap #5 & #6: Edge Cases**
- Check if enabled before running
- Validate dataset access
- Handle missing samples

---

## Testing Checklist

After fixes:
- [ ] Training runs with predictions enabled
- [ ] Training runs with predictions disabled
- [ ] Predictions appear in database
- [ ] Predictions visible in UI (table and comparison)
- [ ] Cost estimate accurate
- [ ] Config persists across job creation
- [ ] Errors don't crash training
- [ ] User owns their predictions (RLS works)

---

## Files to Create/Modify

**Create:**
- TrainingPredictionsCallback class (in standalone_trainer.py)

**Modify:**
- `lib/training/standalone_trainer.py` - Add callback and imports
- Training job creation form (TBD - need to find)
- Job submission API (to store config)
- `.env.example` - Document JOB_USER_ID

**Verify:**
- All Python modules have imports available
- Supabase credentials accessible in training env
- Config validation works end-to-end
