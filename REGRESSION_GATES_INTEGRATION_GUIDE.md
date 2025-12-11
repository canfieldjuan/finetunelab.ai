# Regression Gates Integration Guide

## What Are Regression Gates?

**Regression gates** are automated quality checks that prevent bad models from reaching production. They compare new model metrics against established baselines to catch performance regressions before deployment.

## Current Status: ✅ Infrastructure Ready, ⚠️ Not Wired In

### What Exists Now

1. **✅ Database Tables**
   - `model_baselines` - Stores baseline metrics for each model
   - `validation_results` - Stores validation history and pass/fail results

2. **✅ Baseline Manager Service** (`lib/services/baseline-manager.ts`)
   - `createBaseline()` - Define what "good" looks like
   - `validate()` - Compare actual metrics against baselines
   - `getBaselines()` - Retrieve existing baselines
   - Supports 4 threshold types: min, max, delta, ratio
   - 3 severity levels: critical, warning, info

3. **✅ API Endpoints** (`app/api/training/baselines/route.ts`)
   - POST `/api/training/baselines` - Create new baseline
   - GET `/api/training/baselines?modelName=xxx` - Get baselines
   - PUT `/api/training/baselines/:id` - Update baseline
   - DELETE `/api/training/baselines/:id` - Delete baseline

4. **✅ Validation History API** (`app/api/training/validations/route.ts`)
   - GET `/api/training/validations?modelName=xxx` - View validation history

## Where Regression Gates Should Be Wired

### 🎯 Primary Integration Point: After Training Completes

**File:** `lib/training/job-handlers.ts` (or create new `lib/training/post-training-validation.ts`)

**When:** After model training finishes successfully, but BEFORE marking job as complete

**Flow:**
```typescript
// After training completes
1. Extract final metrics from training run
   - eval_loss
   - eval_accuracy  
   - perplexity
   - Any custom metrics collected

2. Call BaselineManager.validate()
   - Pass model name, version, metrics
   - Get validation result (passed/failed/warning)

3. Store validation result
   - Automatically saved to validation_results table
   - Includes pass/fail status, comparisons, failures

4. Decision point based on result:
   - ✅ PASSED: Continue to deployment
   - ⚠️ WARNING: Log warning, continue (or block if configured)
   - ❌ FAILED (critical): BLOCK deployment, notify user
```

### Example Integration Code

```typescript
// In lib/training/job-handlers.ts or new file
import { getBaselineManager } from '@/lib/services/baseline-manager';

async function handleTrainingCompletion(
  jobId: string,
  modelName: string,
  modelVersion: string,
  finalMetrics: Record<string, number>
) {
  console.log('[Training] Job completed:', jobId);
  console.log('[Training] Final metrics:', finalMetrics);

  // Run regression gate validation
  try {
    const baselineManager = getBaselineManager();
    
    const validationResult = await baselineManager.validate({
      modelName,
      modelVersion,
      metrics: finalMetrics,
      executionId: jobId,
      jobId: jobId,
    });

    console.log('[RegressionGate] Validation status:', validationResult.status);
    console.log('[RegressionGate] Failures:', validationResult.failures);
    console.log('[RegressionGate] Warnings:', validationResult.warnings);

    // Handle validation result
    if (validationResult.status === 'failed') {
      // BLOCK deployment
      await updateJobStatus(jobId, {
        status: 'failed',
        error: `Regression gate failed: ${validationResult.failures.join(', ')}`,
        validation_status: 'blocked',
      });

      await notifyUser({
        jobId,
        subject: 'Training Complete - Deployment Blocked',
        message: `Model ${modelName} failed regression gates:\n${validationResult.failures.join('\n')}`,
      });

      return { blocked: true, reason: 'regression_gate_failed' };
    }

    if (validationResult.status === 'warning') {
      // Log warning but allow deployment (configurable)
      await updateJobStatus(jobId, {
        status: 'completed',
        validation_status: 'passed_with_warnings',
        warnings: validationResult.warnings,
      });

      await notifyUser({
        jobId,
        subject: 'Training Complete - Warnings',
        message: `Model ${modelName} passed with warnings:\n${validationResult.warnings.join('\n')}`,
      });
    }

    // Validation passed
    await updateJobStatus(jobId, {
      status: 'completed',
      validation_status: 'passed',
    });

    console.log('[RegressionGate] ✅ Validation passed');
    return { blocked: false };

  } catch (error) {
    console.error('[RegressionGate] Validation error:', error);
    // Decide: fail open (allow) or fail closed (block) on error
    // Recommended: fail open for robustness, log error
    return { blocked: false, error };
  }
}
```

### Where Metrics Come From

**Source:** Training metrics are collected during training and stored in `local_training_metrics` table

**Relevant Metrics:**
```typescript
{
  eval_loss: 0.45,          // Most important - lower is better
  eval_accuracy: 0.92,      // If available from evaluation
  perplexity: 1.568,        // Language model quality metric
  train_loss: 0.38,         // Training performance
  learning_rate: 0.00005,   // For monitoring
  // ... other metrics collected during training
}
```

**How to Extract Final Metrics:**

```typescript
// Option 1: Query from local_training_metrics table
const { data: metrics } = await supabase
  .from('local_training_metrics')
  .select('*')
  .eq('job_id', jobId)
  .order('step', { ascending: false })
  .limit(1)
  .single();

// Extract relevant metrics
const finalMetrics = {
  eval_loss: metrics.eval_loss,
  eval_accuracy: metrics.eval_accuracy,
  perplexity: metrics.perplexity,
  train_loss: metrics.train_loss,
};

// Option 2: From job metadata/result object
const finalMetrics = job.final_metrics || job.evaluation_results;
```

## Setting Up Baselines

### When to Create Baselines

**Initial Baseline:** After your first successful training run with good results

**Example:**
```bash
# After training llama-3.2-3b successfully
curl -X POST http://localhost:3000/api/training/baselines \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "modelName": "llama-3.2-3b",
    "version": "v1.0",
    "metricName": "eval_loss",
    "metricCategory": "accuracy",
    "baselineValue": 0.45,
    "thresholdType": "max",
    "thresholdValue": 0.50,
    "severity": "critical",
    "description": "Eval loss should stay below 0.50"
  }'
```

### Baseline Configuration Examples

**Critical Metrics (Block deployment):**
```json
{
  "metricName": "eval_loss",
  "thresholdType": "max",
  "baselineValue": 0.45,
  "thresholdValue": 0.50,
  "severity": "critical",
  "description": "Model must maintain eval_loss below 0.50"
}
```

**Warning Metrics (Allow but warn):**
```json
{
  "metricName": "perplexity",
  "thresholdType": "delta",
  "baselineValue": 1.568,
  "thresholdValue": 0.2,
  "severity": "warning",
  "description": "Perplexity should stay within ±0.2 of baseline"
}
```

**Ratio-based (Relative comparison):**
```json
{
  "metricName": "eval_accuracy",
  "thresholdType": "ratio",
  "baselineValue": 0.92,
  "thresholdValue": 0.05,
  "severity": "critical",
  "description": "Accuracy must stay within 5% of baseline (0.95 ratio = 5% drop allowed)"
}
```

## Validation History

**Purpose:** Track all validation attempts to see model quality over time

**What Gets Stored:**
- Every validation run creates a record in `validation_results`
- Includes: metrics, baseline comparisons, pass/fail status, failures, warnings
- Linked to job_id and execution_id for traceability

**Viewing History:**
```bash
# Get all validations for a model
curl http://localhost:3000/api/training/validations?modelName=llama-3.2-3b \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response Example:**
```json
{
  "success": true,
  "modelName": "llama-3.2-3b",
  "validations": [
    {
      "id": "abc-123",
      "executionId": "job-456",
      "status": "passed",
      "metrics": {
        "eval_loss": 0.43,
        "perplexity": 1.52
      },
      "baselineComparisons": [
        {
          "metricName": "eval_loss",
          "actualValue": 0.43,
          "baselineValue": 0.45,
          "passed": true,
          "message": "eval_loss: 0.43 <= 0.50 (max threshold) ✓"
        }
      ],
      "createdAt": "2025-11-29T..."
    }
  ]
}
```

## Implementation Checklist

- [ ] Create `lib/training/post-training-validation.ts` with validation logic
- [ ] Hook into training completion in `job-handlers.ts` or `dag-orchestrator.ts`
- [ ] Extract final metrics from `local_training_metrics` table
- [ ] Call `BaselineManager.validate()` with metrics
- [ ] Handle validation result (passed/warning/failed)
- [ ] Update job status based on validation
- [ ] Add user notifications for blocked deployments
- [ ] Create UI to set baselines (or use API)
- [ ] Add validation status to training job UI
- [ ] Display validation history in model details page
- [ ] Add "Override Gate" button for manual approval (optional)
- [ ] Configure fail-open vs fail-closed behavior
- [ ] Add metrics to existing models' baselines
- [ ] Test with real training run
- [ ] Document for team

## UI Integration Points

### Training Jobs Page
- Show validation status badge next to job status
- Color coding: ✅ Passed | ⚠️ Warning | ❌ Blocked

### Model Details Page
- **Baselines Tab:** Show all baselines for this model
- **Validation History Tab:** Show all validation results
- **Add Baseline Button:** Quick setup for new metrics

### Training Job Details
- Validation section showing:
  - Overall status
  - Metric-by-metric comparison
  - Link to view full history

## Questions You Asked

### "Where are regression gates wired in?"
**A:** They're NOT wired in yet. The infrastructure exists but needs to be connected to the training completion flow.

### "What are they for?"
**A:** Prevent bad models from reaching production by automatically checking if metrics meet quality standards.

### "Where do metrics come from?"
**A:** From the training process itself. Final evaluation metrics (eval_loss, perplexity, etc.) stored in `local_training_metrics` table.

### "What's validation history for?"
**A:** Track every time a model was validated, see trends over time, debug why deployments were blocked.

## Next Steps

1. **Create baselines for your models** - Use the API to define "good" metrics
2. **Wire validation into training completion** - Add code to call BaselineManager.validate()
3. **Test with a real training run** - Verify it catches regressions
4. **Build UI for baseline management** - Make it easy to set/view baselines
5. **Add to deployment pipeline** - Ensure no model deploys without passing gates
