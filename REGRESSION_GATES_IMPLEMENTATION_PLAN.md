# Regression Gates Integration - Phased Implementation Plan

**Date:** November 29, 2025  
**Status:** Awaiting Approval  
**Scope:** Wire regression gates into training completion flow

---

## Executive Summary

**Goal:** Automatically validate trained models against baselines to prevent regressions from reaching production

**Current State:**
- ✅ Infrastructure complete (tables, API, BaselineManager service)
- ✅ Regression gate handler exists (`regressionGateJobHandler`) in job-handlers.ts
- ⚠️ NOT automatically called after training completes
- ⚠️ Needs wiring into training completion workflow

**Approach:** Integrate validation checks at training completion with configurable blocking behavior

---

## Phase 1: Code Analysis & Verification (COMPLETED)

### 1.1 Infrastructure Verification ✅

**Files Verified:**
- `lib/services/baseline-manager.ts` (461 lines)
  - Lines 88-103: `createBaseline()` method
  - Lines 215-266: `validate()` method  
  - Lines 325-385: Validation result storage
  - Uses `createServerClient()` for database access ✅

- `lib/supabase/server-client.ts` (30 lines)
  - Service role client for server-side operations ✅

- `app/api/training/baselines/route.ts` (289 lines)
  - POST endpoint for creating baselines ✅
  - GET endpoint for retrieving baselines ✅
  - Authentication via Bearer tokens ✅

- `app/api/training/validations/route.ts`
  - GET endpoint for validation history ✅

- Database Tables:
  - `model_baselines` - RLS policies fixed ✅
  - `validation_results` - RLS policies fixed ✅

### 1.2 Existing Integration Points Found ✅

**File:** `lib/training/job-handlers.ts` (1300 lines)

**Existing Handler:** `regressionGateJobHandler` (Lines 1080-1288)
- **Purpose:** DAG node type for explicit regression gate checks
- **Current Usage:** Manual DAG workflows only
- **Parameters:** 
  - `baselineId`: ID of baseline to compare against
  - `currentMetrics`: Manual metrics OR
  - `modelPath + testDatasetId`: Automated metric computation
  - `blockOnFailure`: Whether to block on failure (default: true)
  - `requiredMetrics`: Optional list of metrics to validate

**Training Completion:** Lines 105-115
```typescript
if (status.status === 'completed') {
  console.log('[DAG-LocalPoll] Training completed successfully');
  context.log('Training completed successfully!');
  return {
    success: true,
    output: status,
  };
}
```

**Critical Finding:** Training completion does NOT call validation currently

### 1.3 Metrics Source Verification ✅

**Table:** `local_training_metrics`
- **Fields:** job_id, step, train_loss, eval_loss, perplexity, learning_rate, etc.
- **Access:** Authenticated users + service role
- **Query Pattern:** Get last metrics by job_id + max(step)

**Sample Query:**
```typescript
const { data: finalMetrics } = await supabase
  .from('local_training_metrics')
  .select('*')
  .eq('job_id', jobId)
  .order('step', { ascending: false })
  .limit(1)
  .single();
```

---

## Phase 2: Design & Integration Plan

### 2.1 Integration Strategy

**Option A: Auto-Validation After Training (RECOMMENDED)**
- Automatically validate after every successful training
- Configurable via job config: `enableRegressionGates: boolean`
- Non-blocking by default (log warnings), optional blocking mode

**Option B: Explicit DAG Node Only**
- Keep current manual approach
- Requires users to add regression-gate node to workflows
- More control but less automated safety

**Decision:** Implement Option A (automatic validation) with Option B already available

### 2.2 New File Structure

**New File:** `lib/training/post-training-validator.ts`
```
Purpose: Encapsulates post-training validation logic
Exports:
  - validateTrainingResults(jobId, modelName, modelVersion?)
  - extractFinalMetrics(jobId)
  - shouldBlockDeployment(validationResult, config)
```

**Why New File:**
- Separation of concerns
- Reusable across training handlers
- Easier to test independently
- Doesn't clutter existing handlers

### 2.3 Integration Points

**File 1:** `lib/training/job-handlers.ts`
- **Location:** Line 107 (training completion handler)
- **Action:** Add validation call after successful training
- **Change Type:** Addition (non-breaking)

**File 2:** `lib/training/post-training-validator.ts` 
- **Location:** NEW FILE
- **Action:** Create validator module
- **Change Type:** New file (non-breaking)

**File 3:** Database schema (optional)
- **Table:** `local_training_jobs`
- **Potential Addition:** `validation_status` column (enum: passed, warning, failed, blocked, not_run)
- **Change Type:** Schema addition (backwards compatible)

---

## Phase 3: Detailed Implementation Plan

### 3.1 Create Post-Training Validator Module

**File:** `lib/training/post-training-validator.ts`

**Functions to Implement:**

```typescript
/**
 * Extract final metrics from training job
 * @param jobId - Training job ID
 * @returns Final metrics object or null
 */
async function extractFinalMetrics(
  jobId: string
): Promise<Record<string, number> | null>

/**
 * Validate training results against baselines
 * @param jobId - Training job ID
 * @param modelName - Model name
 * @param modelVersion - Optional model version
 * @returns Validation result with status and details
 */
async function validateTrainingResults(
  jobId: string,
  modelName: string,
  modelVersion?: string
): Promise<{
  status: 'passed' | 'failed' | 'warning' | 'no_baselines';
  validationResult?: ValidationResult;
  error?: string;
}>

/**
 * Determine if deployment should be blocked
 * @param validationResult - Result from validation
 * @param config - Job configuration
 * @returns Whether to block deployment
 */
function shouldBlockDeployment(
  validationResult: ValidationResult,
  config: { blockOnCriticalFailures?: boolean }
): boolean
```

**Dependencies:**
- `@/lib/services/baseline-manager` (getBaselineManager)
- `@/lib/supabase/server-client` (createServerClient)
- `@/lib/training/types` (ValidationResult, etc.)

### 3.2 Modify Training Completion Handler

**File:** `lib/training/job-handlers.ts`
**Location:** Lines 105-115

**Current Code:**
```typescript
if (status.status === 'completed') {
  console.log('[DAG-LocalPoll] Training completed successfully');
  context.log('Training completed successfully!');
  return {
    success: true,
    output: status,
  };
}
```

**Proposed Change:**
```typescript
if (status.status === 'completed') {
  console.log('[DAG-LocalPoll] Training completed successfully');
  context.log('Training completed successfully!');
  
  // Optional: Run regression gate validation
  if (config?.enableRegressionGates !== false) {  // Enabled by default
    try {
      const validationResult = await validateTrainingResults(
        jobId,
        modelName || config?.model_name,
        config?.model_version
      );
      
      if (validationResult.status === 'failed' && shouldBlockDeployment(validationResult, config)) {
        context.log('⚠️  REGRESSION GATE FAILED - Deployment blocked');
        return {
          success: false,
          error: 'Regression gate validation failed',
          validation: validationResult,
        };
      } else if (validationResult.status === 'warning') {
        context.log('⚠️  Regression gate warnings detected');
      } else if (validationResult.status === 'passed') {
        context.log('✅ Regression gate validation passed');
      }
    } catch (validationError) {
      // Fail open: log error but don't block deployment
      console.error('[DAG-Validation] Error:', validationError);
      context.log(`⚠️  Validation error (non-blocking): ${validationError}`);
    }
  }
  
  return {
    success: true,
    output: status,
  };
}
```

**Impact Analysis:**
- ✅ Non-breaking: Existing workflows continue working
- ✅ Opt-out available: Set `enableRegressionGates: false` in config
- ✅ Fail-open: Validation errors don't block deployment by default
- ✅ Configurable blocking: Can enable strict mode via config

### 3.3 Configuration Schema

**Job Config Extension:**
```typescript
interface TrainingJobConfig {
  // ... existing fields ...
  
  // Regression gate configuration (Phase 4)
  enableRegressionGates?: boolean;  // Default: true
  blockOnCriticalFailures?: boolean;  // Default: false (warn only)
  regressionGateConfig?: {
    requireBaselines?: boolean;  // Fail if no baselines exist
    metricsToValidate?: string[];  // Specific metrics to check
    failOpen?: boolean;  // Continue on validation errors (default: true)
  };
}
```

---

## Phase 4: Testing & Validation Plan

### 4.1 Unit Tests

**New Test File:** `lib/training/__tests__/post-training-validator.test.ts`

**Test Cases:**
1. ✅ Extract final metrics from completed job
2. ✅ Extract metrics returns null when no metrics found
3. ✅ Validate with existing baselines (pass scenario)
4. ✅ Validate with existing baselines (fail scenario)
5. ✅ Validate with no baselines (pass by default)
6. ✅ shouldBlockDeployment with blockOnCriticalFailures=true
7. ✅ shouldBlockDeployment with blockOnCriticalFailures=false
8. ✅ Error handling when BaselineManager fails

### 4.2 Integration Tests

**Test Scenarios:**
1. Complete training → Auto-validate → Pass → Deploy
2. Complete training → Auto-validate → Fail (warning) → Deploy with warning
3. Complete training → Auto-validate → Fail (critical) → Block deployment
4. Complete training → No baselines → Pass (log info)
5. Complete training → Validation error → Fail open (deploy anyway)
6. Complete training → enableRegressionGates=false → Skip validation

### 4.3 Manual Testing Checklist

- [ ] Create baseline for test model
- [ ] Run training job with good metrics → Verify passes validation
- [ ] Run training job with bad metrics → Verify fails validation
- [ ] Check validation_results table for stored results
- [ ] Verify validation history API returns results
- [ ] Test with no baselines → Should pass with info log
- [ ] Test with enableRegressionGates=false → Should skip validation
- [ ] Test with blockOnCriticalFailures=true → Should block bad models

---

## Phase 5: Deployment & Rollout

### 5.1 Database Schema Changes (Optional)

**Migration:** `supabase/migrations/YYYYMMDD_add_validation_status_to_jobs.sql`

```sql
-- Add validation status tracking to training jobs
ALTER TABLE local_training_jobs
ADD COLUMN validation_status TEXT CHECK (validation_status IN (
  'not_run', 'passed', 'warning', 'failed', 'blocked', 'error'
));

-- Add validation result reference
ALTER TABLE local_training_jobs
ADD COLUMN validation_result_id UUID REFERENCES validation_results(id);

-- Add index for querying by validation status
CREATE INDEX idx_training_jobs_validation_status
ON local_training_jobs(validation_status)
WHERE validation_status IS NOT NULL;

-- Comment
COMMENT ON COLUMN local_training_jobs.validation_status IS 
  'Status of regression gate validation: not_run (skipped), passed (all checks passed), warning (some warnings), failed (critical failures but not blocked), blocked (deployment blocked), error (validation error)';
```

**Impact:** Backwards compatible (new nullable column)

### 5.2 Rollout Strategy

**Stage 1: Soft Launch (Default: Warn Only)**
- Enable validation but don't block deployments
- Collect validation data for 1-2 weeks
- Monitor false positive rate
- Tune baselines based on data

**Stage 2: Selective Blocking**
- Enable blocking for specific critical models
- Keep warning-only for experimental models
- Gather user feedback

**Stage 3: Full Rollout**
- Enable blocking by default for production models
- Provide easy override mechanism for emergencies
- Document baseline setup process

### 5.3 Monitoring & Alerts

**Metrics to Track:**
- Validation pass rate
- Validation failure rate (warnings vs critical)
- Blocked deployments count
- False positive rate (user overrides)
- Validation errors (should be near 0)

**Alerts:**
- Critical: Validation errors > threshold (infrastructure issue)
- Warning: High false positive rate (baselines need tuning)
- Info: First validation failure for a model (review needed)

---

## Phase 6: Documentation & Training

### 6.1 User Documentation

**Document:** `docs/REGRESSION_GATES_USER_GUIDE.md`

**Topics:**
- What are regression gates
- When they run automatically
- How to create baselines
- How to interpret validation results
- How to override blocked deployments (emergency)
- Troubleshooting validation errors

### 6.2 Developer Documentation

**Document:** `docs/REGRESSION_GATES_DEVELOPER_GUIDE.md`

**Topics:**
- Architecture overview
- Code structure
- Adding new validation logic
- Testing validation
- Debugging validation failures

### 6.3 API Documentation

**Update:** `app/api/training/README.md`

**Add:**
- POST /api/training/baselines endpoint
- GET /api/training/baselines endpoint
- GET /api/training/validations endpoint
- Example requests and responses

---

## Risk Assessment & Mitigation

### Risk 1: False Positives Block Valid Deployments
**Severity:** High  
**Mitigation:**
- Default to warn-only mode initially
- Provide easy override mechanism
- Monitor false positive rate closely
- Allow per-model configuration

### Risk 2: Validation Errors Break Training Pipeline
**Severity:** Medium  
**Mitigation:**
- Fail-open by default (errors don't block)
- Comprehensive error handling
- Fallback to skip validation on repeated errors
- Alert on validation system issues

### Risk 3: Performance Impact on Training Completion
**Severity:** Low  
**Mitigation:**
- Validation runs async after training completes
- Caching of baseline data
- Efficient metric queries
- Timeout protection (max 30s)

### Risk 4: No Baselines Exist for Model
**Severity:** Low  
**Mitigation:**
- Pass by default when no baselines found
- Log info message to create baselines
- Optional strict mode (fail if no baselines)
- Documentation on baseline setup

---

## Success Criteria

### Technical Success
- ✅ Validation runs automatically after training
- ✅ Validation results stored in database
- ✅ API endpoints working correctly
- ✅ No breaking changes to existing workflows
- ✅ All tests passing
- ✅ Performance impact < 5s per training job

### Business Success
- ✅ Catch at least 1 regression before production
- ✅ False positive rate < 10%
- ✅ User adoption > 80% (baselines created)
- ✅ Zero validation system outages
- ✅ Positive user feedback on safety

---

## Files Affected Summary

### New Files (3)
1. `lib/training/post-training-validator.ts` - Validation logic
2. `lib/training/__tests__/post-training-validator.test.ts` - Tests
3. `supabase/migrations/YYYYMMDD_add_validation_status_to_jobs.sql` - Schema (optional)

### Modified Files (1)
1. `lib/training/job-handlers.ts` - Training completion handler (Lines 105-115)

### No Changes Required (Already Complete)
- `lib/services/baseline-manager.ts` ✅
- `lib/supabase/server-client.ts` ✅
- `app/api/training/baselines/route.ts` ✅
- `app/api/training/validations/route.ts` ✅
- Database tables (model_baselines, validation_results) ✅

---

## Implementation Timeline

### Week 1: Core Implementation
- Day 1-2: Create post-training-validator.ts module
- Day 3: Integrate into training completion handler
- Day 4-5: Unit tests and integration tests

### Week 2: Testing & Refinement
- Day 1-2: Manual testing with real training jobs
- Day 3: Bug fixes and refinements
- Day 4-5: Documentation and code review

### Week 3: Soft Launch
- Day 1: Deploy to staging
- Day 2-5: Monitor and tune baselines
- Day 5: Gradual production rollout (warn-only mode)

### Week 4: Full Rollout
- Day 1-3: Enable selective blocking for critical models
- Day 4-5: Full rollout with monitoring

---

## Dependencies & Prerequisites

### Required Before Implementation
- ✅ Service role client working (`lib/supabase/server-client.ts`)
- ✅ Baseline manager service complete
- ✅ RLS policies fixed on both tables
- ✅ API endpoints tested and working

### Nice to Have
- [ ] UI for creating baselines (can use API directly for now)
- [ ] UI for viewing validation history (can use API directly)
- [ ] Slack/email notifications for blocked deployments

---

## Rollback Plan

### If Issues Arise
1. **Immediate:** Set `enableRegressionGates: false` globally
2. **Short-term:** Revert training completion handler changes
3. **Long-term:** Remove post-training-validator.ts module

### Rollback Steps
```bash
# 1. Disable globally via environment variable
ENABLE_REGRESSION_GATES=false

# 2. Revert code changes
git revert <commit-hash>

# 3. Redeploy
npm run build && npm run deploy
```

---

## Approval Checklist

Before proceeding, confirm:

- [ ] **Architecture Review:** Design approved by team
- [ ] **Breaking Changes:** None identified
- [ ] **Performance Impact:** Acceptable (<5s per job)
- [ ] **Testing Plan:** Comprehensive coverage planned
- [ ] **Rollback Plan:** Clear and tested
- [ ] **Documentation:** User and developer docs planned
- [ ] **Monitoring:** Metrics and alerts defined
- [ ] **Rollout Strategy:** Phased approach with killswitch

---

## Next Steps After Approval

1. Create feature branch: `feature/regression-gates-integration`
2. Implement Phase 3.1: Create post-training-validator.ts
3. Implement Phase 3.2: Modify training completion handler
4. Implement Phase 4.1: Write unit tests
5. Test manually with real training jobs
6. Submit PR for review
7. Deploy to staging
8. Monitor and tune
9. Gradual production rollout

---

## Questions for Review

1. **Should validation be opt-in or opt-out?**
   - Proposed: Opt-out (enabled by default, set `enableRegressionGates: false` to disable)

2. **Should we block deployments by default or warn only?**
   - Proposed: Warn only initially, enable blocking per-model later

3. **What should happen when no baselines exist?**
   - Proposed: Pass with info log, optionally enable strict mode later

4. **Should validation errors block deployment?**
   - Proposed: No (fail open), log error and continue

5. **Do we need the validation_status column in local_training_jobs?**
   - Proposed: Optional enhancement, not required for MVP

---

**Status:** ✋ AWAITING APPROVAL - Do not proceed with implementation until reviewed

**Contact:** Ready to answer questions and clarify any aspects of this plan
