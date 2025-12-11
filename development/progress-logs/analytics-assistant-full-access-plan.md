# Analytics Assistant - Full Training & Analytics Access Implementation Plan

**Date:** 2025-12-02
**Status:** 🟡 AWAITING APPROVAL
**Priority:** High
**Complexity:** Medium
**Risk Level:** Low

---

## Executive Summary

**Goal:** Give the Analytics Assistant complete access to training metrics and analytics data.

**Current State:** Assistant has 9 tools for session analysis but CANNOT access training job data.

**Proposed Solution:** Add 3 new tools to connect existing training/analytics APIs to the assistant.

**Impact:**
- ✅ Users can ask about training progress, loss curves, predictions
- ✅ Users can compare models, analyze benchmarks, view anomalies
- ✅ Complete unified analytics experience
- ✅ No breaking changes - only additive

---

## Problem Analysis

### What the Assistant Currently HAS ✅

**9 Existing Tools:**
1. `get_session_evaluations` - Ratings, feedback for conversations
2. `get_session_metrics` - Token usage, costs, response times
3. `get_session_conversations` - Full conversation data
4. `calculator` - Math calculations
5. `evaluate_messages` - LLM-as-judge evaluation
6. `evaluation_metrics` - 13 quality operations
7. `datetime` - Date/time operations
8. `system_monitor` - System health
9. `training_control` - List configs, start training (LIMITED)

**Scope:** Session/conversation analysis only

### What the Assistant is MISSING ❌

**Training Metrics:**
- ❌ Training job status (progress, epoch, step)
- ❌ Training metrics (loss, accuracy, perplexity)
- ❌ Training predictions (model outputs)
- ❌ Training history & job list
- ❌ GPU metrics
- ❌ Hyperparameter details

**Analytics Data:**
- ❌ Model performance comparison
- ❌ Benchmark results
- ❌ Cohort analysis
- ❌ Anomaly detection
- ❌ Sentiment trends

**User Questions Assistant CANNOT Answer:**
- "How is my training job doing?"
- "Show me the loss curve for job X"
- "What's my model's perplexity?"
- "Compare model A vs model B"
- "Did my training improve the model?"
- "Show me predictions from epoch 3"

---

## Solution Design

### Add 3 New Tools to Analytics Chat API

```
lib/training/
app/api/analytics/chat/route.ts  ← ADD 3 NEW TOOLS HERE
```

**Tool 1: `training_metrics`** - Training job status and metrics
**Tool 2: `training_predictions`** - Model predictions during training
**Tool 3: `advanced_analytics`** - Model comparison, benchmarks, cohorts, anomalies

---

## Detailed Tool Design

### Tool 1: `training_metrics` 🆕

**Purpose:** Access training job status, metrics, history, and progress.

**Operations:**
1. `get_job_status` - Current status, progress, step, epoch
2. `get_job_metrics` - Loss curves, GPU usage, throughput
3. `list_jobs` - All training jobs for user (with filters)
4. `get_job_details` - Full config, hyperparameters, timestamps

**API Endpoints Used:**
- `/api/training/local/[jobId]/status` (existing)
- `/api/training/local/jobs` (existing)
- `/api/training/jobs/[jobId]/metrics` (existing)

**Tool Definition:**
```typescript
{
  type: 'function',
  function: {
    name: 'training_metrics',
    description: 'Access training job status, metrics, and history. Monitor training progress, view loss curves, check GPU usage, list all training jobs, and get detailed job configurations.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['get_job_status', 'get_job_metrics', 'list_jobs', 'get_job_details'],
          description: 'Operation to perform'
        },
        jobId: {
          type: 'string',
          description: 'Training job ID (required for get_job_status, get_job_metrics, get_job_details)'
        },
        status: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'all'],
          description: 'Filter jobs by status (for list_jobs)'
        },
        limit: {
          type: 'number',
          description: 'Max number of jobs to return (for list_jobs, default: 50)'
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (for list_jobs)'
        }
      },
      required: ['operation']
    }
  }
}
```

**Example Usage:**
```javascript
// User asks: "How is my training job abc123 doing?"
await training_metrics({
  operation: 'get_job_status',
  jobId: 'abc123'
})
// Returns: { status: 'running', progress: 45%, current_epoch: 2, loss: 0.234, ... }

// User asks: "Show me all my completed training jobs"
await training_metrics({
  operation: 'list_jobs',
  status: 'completed',
  limit: 10
})
// Returns: [{ id, model_name, status, started_at, completed_at, ... }, ...]
```

---

### Tool 2: `training_predictions` 🆕

**Purpose:** Access model predictions generated during training for quality analysis.

**Operations:**
1. `get_predictions` - Get predictions for a job (with filters)
2. `get_predictions_by_epoch` - Predictions from specific epoch
3. `compare_epochs` - Compare predictions across epochs
4. `list_available_epochs` - Which epochs have predictions

**API Endpoints Used:**
- `/api/training/predictions/[jobId]` (existing)
- `/api/training/predictions/[jobId]/epochs` (existing)

**Tool Definition:**
```typescript
{
  type: 'function',
  function: {
    name: 'training_predictions',
    description: 'Access model predictions generated during training. Track how predictions improve across epochs, compare quality evolution, and analyze specific training samples.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['get_predictions', 'get_predictions_by_epoch', 'compare_epochs', 'list_available_epochs'],
          description: 'Operation to perform'
        },
        jobId: {
          type: 'string',
          description: 'Training job ID (required for all operations)'
        },
        epoch: {
          type: 'number',
          description: 'Epoch number (for get_predictions_by_epoch)'
        },
        epochs: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of epoch numbers to compare (for compare_epochs)'
        },
        limit: {
          type: 'number',
          description: 'Max predictions to return (default: 50)'
        },
        offset: {
          type: 'number',
          description: 'Pagination offset'
        }
      },
      required: ['operation', 'jobId']
    }
  }
}
```

**Example Usage:**
```javascript
// User asks: "Show me predictions from epoch 3 of job abc123"
await training_predictions({
  operation: 'get_predictions_by_epoch',
  jobId: 'abc123',
  epoch: 3
})
// Returns: [{ prompt, ground_truth, prediction, sample_index, ... }, ...]

// User asks: "Did predictions improve from epoch 1 to 3?"
await training_predictions({
  operation: 'compare_epochs',
  jobId: 'abc123',
  epochs: [1, 3]
})
// Returns: { epoch_1: [...], epoch_3: [...], improvement_analysis: {...} }
```

---

### Tool 3: `advanced_analytics` 🆕

**Purpose:** Access pre-computed analytics like model comparison, benchmarks, cohorts, anomalies.

**Operations:**
1. `model_comparison` - Compare model performance
2. `benchmark_analysis` - Benchmark results and accuracy
3. `cohort_analysis` - Cohort performance metrics
4. `anomaly_detection` - Detected anomalies and outliers
5. `sentiment_trends` - Sentiment analysis trends
6. `quality_forecast` - Predictive quality modeling

**API Endpoints Used:**
- `/api/analytics/model-comparison` (existing)
- `/api/analytics/benchmark-analysis` (existing)
- `/api/analytics/cohorts` (existing)
- `/api/analytics/anomalies` (existing)
- `/api/analytics/sentiment/trends` (existing)
- `/api/analytics/forecast-data` (existing)

**Tool Definition:**
```typescript
{
  type: 'function',
  function: {
    name: 'advanced_analytics',
    description: 'Access advanced analytics including model comparison, benchmark results, cohort analysis, anomaly detection, sentiment trends, and quality forecasting.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['model_comparison', 'benchmark_analysis', 'cohort_analysis', 'anomaly_detection', 'sentiment_trends', 'quality_forecast'],
          description: 'Analytics operation to perform'
        },
        period: {
          type: 'string',
          enum: ['day', 'week', 'month', 'quarter', 'year', 'all'],
          description: 'Time period to analyze (default: month)'
        },
        startDate: {
          type: 'string',
          description: 'Start date (ISO format, overrides period)'
        },
        endDate: {
          type: 'string',
          description: 'End date (ISO format)'
        },
        cohortId: {
          type: 'string',
          description: 'Cohort ID (for cohort_analysis)'
        },
        modelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Model IDs to compare (for model_comparison)'
        },
        threshold: {
          type: 'number',
          description: 'Anomaly detection threshold (for anomaly_detection)'
        }
      },
      required: ['operation']
    }
  }
}
```

**Example Usage:**
```javascript
// User asks: "Compare all my models' performance this month"
await advanced_analytics({
  operation: 'model_comparison',
  period: 'month'
})
// Returns: { models: [...], bestModel: {...}, recommendations: [...] }

// User asks: "Show me any anomalies in my data"
await advanced_analytics({
  operation: 'anomaly_detection',
  period: 'week'
})
// Returns: { anomalies: [...], severity: {...}, affected_metrics: [...] }
```

---

## Implementation Plan

### Phase 1: Prepare Tool Handlers (Day 1)

**Files to Create:**
```
/home/juan-canfield/Desktop/web-ui/lib/tools/analytics/training-metrics.handler.ts
/home/juan-canfield/Desktop/web-ui/lib/tools/analytics/training-predictions.handler.ts
/home/juan-canfield/Desktop/web-ui/lib/tools/analytics/advanced-analytics.handler.ts
```

**Actions:**
1. Create handler files with operation routing
2. Implement API calls to existing endpoints
3. Add error handling and validation
4. Add response formatting for LLM consumption

**Verification:**
- [ ] Each handler file compiles without errors
- [ ] Each operation routes to correct API endpoint
- [ ] Error handling covers all edge cases
- [ ] Response format is LLM-friendly (structured data)

---

### Phase 2: Integrate Tools into Analytics Chat API (Day 1)

**File to Modify:**
```
/home/juan-canfield/Desktop/web-ui/app/api/analytics/chat/route.ts
```

**Changes:**
1. Import new tool handlers
2. Add 3 new tool definitions to `analyticsTools` array (after line 273)
3. Add switch cases in `executeAnalyticsTool` function (after line 811)
4. Update system message to document new tools (after line 1079)

**Exact Insertion Points:**

**Location 1: Import handlers (after line 6)**
```typescript
import { executeTrainingMetrics } from '@/lib/tools/analytics/training-metrics.handler';
import { executeTrainingPredictions } from '@/lib/tools/analytics/training-predictions.handler';
import { executeAdvancedAnalytics } from '@/lib/tools/analytics/advanced-analytics.handler';
```

**Location 2: Add tool definitions (after line 273, before line 274)**
```typescript
  // Tool 10: Training Metrics
  {
    type: 'function',
    function: {
      name: 'training_metrics',
      description: '...',
      parameters: {...}
    }
  },
  // Tool 11: Training Predictions
  {
    type: 'function',
    function: {
      name: 'training_predictions',
      description: '...',
      parameters: {...}
    }
  },
  // Tool 12: Advanced Analytics
  {
    type: 'function',
    function: {
      name: 'advanced_analytics',
      description: '...',
      parameters: {...}
    }
  }
```

**Location 3: Add handler cases (after line 811, before default case)**
```typescript
      case 'training_metrics':
        return await executeTrainingMetrics(args, userId, authHeader, authClient);

      case 'training_predictions':
        return await executeTrainingPredictions(args, userId, authHeader, authClient);

      case 'advanced_analytics':
        return await executeAdvancedAnalytics(args, userId, authHeader, authClient);
```

**Location 4: Update system message (after line 1008, before "## ANALYSIS WORKFLOWS")**
```typescript
9. **training_metrics** - Training job status, metrics, and history
   - USE when asked about training progress, loss curves, GPU usage, or job history
   - Operations: get_job_status, get_job_metrics, list_jobs, get_job_details

10. **training_predictions** - Model predictions during training
   - USE when asked about prediction quality, epoch comparisons, or training samples
   - Operations: get_predictions, get_predictions_by_epoch, compare_epochs

11. **advanced_analytics** - Pre-computed analytics (model comparison, benchmarks, cohorts, anomalies)
   - USE for high-level analysis: comparing models, viewing benchmarks, detecting anomalies
   - Operations: model_comparison, benchmark_analysis, cohort_analysis, anomaly_detection, sentiment_trends, quality_forecast
```

**Verification:**
- [ ] File compiles without TypeScript errors
- [ ] Tool definitions follow exact schema format
- [ ] Handler cases return expected data structure
- [ ] System message accurately describes new tools
- [ ] No breaking changes to existing tools

---

### Phase 3: Testing & Validation (Day 2)

**Test Cases:**

**Test 1: Training Metrics Tool**
```
User: "Show me my recent training jobs"
Expected: Assistant calls training_metrics with operation='list_jobs'
Expected Response: List of jobs with status, model, timestamps
```

**Test 2: Training Job Status**
```
User: "How is job abc123 doing?"
Expected: Assistant calls training_metrics with operation='get_job_status'
Expected Response: Progress%, epoch, step, loss, GPU metrics
```

**Test 3: Training Predictions**
```
User: "Show me predictions from epoch 2"
Expected: Assistant calls training_predictions with operation='get_predictions_by_epoch'
Expected Response: List of predictions with prompts and outputs
```

**Test 4: Model Comparison**
```
User: "Which model performed best this month?"
Expected: Assistant calls advanced_analytics with operation='model_comparison'
Expected Response: Model rankings, quality scores, recommendations
```

**Test 5: Error Handling**
```
User: "Show me status for nonexistent job"
Expected: Assistant calls training_metrics, receives error
Expected Response: Friendly error message explaining job not found
```

**Verification:**
- [ ] All test cases pass
- [ ] Error handling graceful
- [ ] Response times acceptable (<3s)
- [ ] No API errors in logs
- [ ] LLM interprets results correctly

---

### Phase 4: Documentation (Day 2)

**Create/Update Files:**
1. `/development/progress-logs/analytics-assistant-full-access-COMPLETE.md` - Implementation summary
2. Update system message in chat route with usage examples
3. Add tool usage examples to assistant context

**Verification:**
- [ ] All changes documented
- [ ] Examples provided for each tool
- [ ] Session continuity maintained

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tool handler errors | Low | Medium | Comprehensive error handling in each handler |
| API endpoint failures | Low | Low | Endpoints already exist and are tested |
| Breaking existing tools | Very Low | High | Only additive changes, no modifications to existing tools |
| Performance degradation | Very Low | Low | All APIs already optimized, just exposing to assistant |
| Auth/permission issues | Low | Medium | Use existing auth patterns from other tools |

**Overall Risk:** 🟢 **LOW**

---

## Verification Checklist

### Before Implementation ✅
- [ ] All existing API endpoints verified working
- [ ] Tool handler design reviewed
- [ ] Integration points identified
- [ ] Test cases defined
- [ ] User approval obtained

### During Implementation ⏳
- [ ] Each handler file compiles
- [ ] TypeScript types correct
- [ ] API calls use correct endpoints
- [ ] Error handling comprehensive
- [ ] Response formatting LLM-friendly

### After Implementation ✅
- [ ] All test cases pass
- [ ] No TypeScript errors
- [ ] No runtime errors in logs
- [ ] Assistant correctly uses new tools
- [ ] Documentation complete

---

## Files to Modify/Create

### Files to CREATE (3 new files):
```
1. /lib/tools/analytics/training-metrics.handler.ts (NEW)
2. /lib/tools/analytics/training-predictions.handler.ts (NEW)
3. /lib/tools/analytics/advanced-analytics.handler.ts (NEW)
```

### Files to MODIFY (1 existing file):
```
1. /app/api/analytics/chat/route.ts (MODIFY - 4 locations)
   - Line 6: Add imports
   - Line 273: Add tool definitions
   - Line 811: Add handler cases
   - Line 1008: Update system message
```

### Files to CREATE for Documentation:
```
1. /development/progress-logs/analytics-assistant-full-access-COMPLETE.md (NEW)
```

**Total Impact:** 3 new files, 1 modified file, 1 documentation file

---

## Dependencies

### Required (Already Present):
- ✅ Existing API endpoints for training/analytics
- ✅ Authentication system
- ✅ Supabase client
- ✅ Tool execution framework
- ✅ LLM integration (OpenAI/Anthropic)

### No New Dependencies:
- ✅ No new npm packages needed
- ✅ No database schema changes
- ✅ No API endpoint modifications
- ✅ Pure integration work

---

## Rollback Plan

### If Issues Occur:

**Quick Rollback (remove new tools):**
1. Comment out 3 new tool definitions in `analyticsTools` array
2. Comment out 3 new cases in `executeAnalyticsTool`
3. Revert system message changes
4. Remove handler imports

**Result:** Assistant reverts to original 9-tool functionality

**Git Rollback:**
```bash
git diff app/api/analytics/chat/route.ts
git checkout app/api/analytics/chat/route.ts
rm lib/tools/analytics/*.handler.ts
```

---

## Success Criteria

### Must Have ✅
- [x] Design 3 new tools with clear operations
- [x] Identify exact integration points
- [x] Define test cases
- [x] Create comprehensive plan
- [ ] **User approval to proceed**

### Implementation Success ⏳
- [ ] All 3 handlers implemented
- [ ] All tools integrated into chat API
- [ ] All test cases pass
- [ ] No breaking changes
- [ ] Documentation complete

### User Success 🎯
- [ ] User can ask about training jobs
- [ ] User can view loss curves/metrics
- [ ] User can see training predictions
- [ ] User can compare models
- [ ] User can detect anomalies
- [ ] Complete unified analytics experience

---

## Next Steps

**Awaiting Your Approval:**

Please review and confirm:
1. ✅ Tool design is acceptable (3 new tools)
2. ✅ Integration approach is sound (additive only)
3. ✅ Risk level is acceptable (LOW)
4. ✅ Test plan is sufficient
5. ✅ Ready to implement

Once approved, I will:
1. Create 3 new tool handler files
2. Integrate tools into analytics chat API
3. Run comprehensive tests
4. Document all changes
5. Mark as complete ✅

---

**👉 AWAITING YOUR APPROVAL TO PROCEED 👈**

**Estimated Time:** 2-3 hours for full implementation and testing

**Status:** 🟡 **READY FOR APPROVAL**
