# Training Predictions Feature - Implementation Plan

**Feature:** W&B-style model predictions tracking during training
**Date:** 2025-11-15
**Status:** Planning Phase

## Overview

This feature allows users to track model predictions on sample prompts during training, enabling quality improvement visualization across epochs. Similar to Weights & Biases prediction tracking.

## Critical Requirements

1. **No hardcoded variables** - All values must be configurable
2. **No Unicode in Python files or tests** - CRITICAL requirement
3. **No stub, mock, TODO, or fake implementations** - Only production-ready code
4. **30-line code blocks** - Or complete logic blocks, whichever makes sense
5. **Must be configurable** - Users control sampling due to cost concerns
6. **Phased implementation** - Each phase is independently deployable
7. **Never assume, always verify** - Check existing code patterns before implementing

## Database Schema Verification (Completed)

### Existing Tables

**local_training_jobs:**
- id, user_id, status, model_name, dataset_path
- config (JSONB), total_steps, total_epochs, total_samples
- best_eval_loss, best_epoch, best_step, loss_trend
- gpu_memory_reserved_gb, gpu_memory_allocated_gb
- started_at, completed_at, updated_at, created_at
- resumed_from_job_id, resume_from_checkpoint, job_token

**local_training_metrics:**
- job_id, step, epoch, train_loss, eval_loss
- learning_rate, grad_norm
- gpu_memory_allocated_gb, gpu_memory_reserved_gb, gpu_utilization_percent
- samples_per_second, tokens_per_second
- train_perplexity, perplexity, timestamp

---

## Phase 1: Database Schema Design

**Goal:** Create database table for storing training predictions

### Tasks

1.1. **Create Migration File**
   - File: `supabase/migrations/YYYYMMDDHHMMSS_create_training_predictions_table.sql`
   - Table: `training_predictions`
   - Columns:
     ```sql
     id UUID PRIMARY KEY DEFAULT gen_random_uuid()
     job_id TEXT NOT NULL REFERENCES local_training_jobs(id) ON DELETE CASCADE
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
     epoch INTEGER NOT NULL
     step INTEGER NOT NULL
     sample_index INTEGER NOT NULL
     prompt TEXT NOT NULL
     ground_truth TEXT
     prediction TEXT NOT NULL
     created_at TIMESTAMPTZ DEFAULT NOW()
     ```
   - Indexes:
     - `idx_training_predictions_job_id` on (job_id)
     - `idx_training_predictions_epoch` on (job_id, epoch)
     - `idx_training_predictions_user_id` on (user_id)

1.2. **Add RLS Policies**
   - SELECT policy: `auth.uid() = user_id`
   - INSERT policy: `auth.uid() = user_id`
   - DELETE policy: `auth.uid() = user_id`
   - UPDATE policy: None (predictions are immutable)

1.3. **Add Configuration to local_training_jobs**
   - Add to existing `config` JSONB field:
     ```json
     {
       "predictions": {
         "enabled": boolean,
         "sample_count": integer,
         "sample_frequency": "epoch" | "steps",
         "step_interval": integer
       }
     }
     ```
   - No schema migration needed (JSONB is flexible)

**Deliverables:**
- Migration SQL file
- RLS policies configured
- Documentation of config schema

**Estimated Time:** 2 hours

---

## Phase 2: Configuration System

**Goal:** Enable configurable prediction sampling with cost controls

### Tasks

2.1. **Environment Variables**
   - Add to `.env.example` and document in README:
     ```bash
     # Training Predictions Configuration
     PREDICTIONS_ENABLED=true
     PREDICTIONS_DEFAULT_SAMPLE_COUNT=5
     PREDICTIONS_MAX_SAMPLE_COUNT=100
     PREDICTIONS_DEFAULT_FREQUENCY=epoch
     PREDICTIONS_MIN_STEP_INTERVAL=10
     ```

2.2. **Configuration Validation Function**
   - File: `lib/training/predictions-config.ts`
   - Function: `validatePredictionsConfig(config: unknown): PredictionsConfig`
   - Validates user input against environment limits
   - Returns typed configuration object
   - No hardcoded values - all from environment

2.3. **TypeScript Types**
   - File: `lib/training/types/predictions-types.ts`
   - Interfaces:
     ```typescript
     export interface PredictionsConfig {
       enabled: boolean;
       sample_count: number;
       sample_frequency: 'epoch' | 'steps';
       step_interval?: number;
     }

     export interface TrainingPrediction {
       id: string;
       job_id: string;
       user_id: string;
       epoch: number;
       step: number;
       sample_index: number;
       prompt: string;
       ground_truth?: string;
       prediction: string;
       created_at: string;
     }
     ```

**Deliverables:**
- Environment variable definitions
- TypeScript types
- Validation function with tests

**Estimated Time:** 3 hours

---

## Phase 3: Python Prediction Sampler

**Goal:** Generate predictions during training (no Unicode, no hardcoded values)

### Tasks

3.1. **Configuration Loader**
   - File: `lib/training/predictions_config.py`
   - Class: `PredictionsConfig`
   - Loads from environment variables (no hardcoded defaults)
   - All values configurable via environment
   - **NO UNICODE CHARACTERS** in code or comments

3.2. **Sample Dataset Loader**
   - File: `lib/training/predictions_sampler.py`
   - Class: `PredictionsSampler`
   - Method: `load_samples(dataset_path, sample_count, random_seed)`
   - Randomly samples from training dataset
   - Stores samples for consistency across epochs
   - **NO UNICODE CHARACTERS** in code or comments

3.3. **Prediction Generator**
   - File: `lib/training/predictions_generator.py`
   - Class: `PredictionsGenerator`
   - Method: `generate_predictions(model, tokenizer, samples, epoch, step)`
   - Generates predictions using current model state
   - Handles batching for efficiency
   - **NO UNICODE CHARACTERS** in code or comments
   - Returns list of prediction dictionaries

3.4. **Database Writer**
   - File: `lib/training/predictions_writer.py`
   - Class: `PredictionsWriter`
   - Method: `write_predictions(predictions, job_id, user_id)`
   - Async write to Supabase using service role key
   - Batch inserts for performance
   - Error handling without training interruption
   - **NO UNICODE CHARACTERS** in code or comments

3.5. **Training Loop Integration**
   - File: Integration point in existing training script
   - Hook: After each epoch evaluation
   - Conditional execution based on config
   - No impact on training if disabled
   - **NO UNICODE CHARACTERS** in code or comments

**Code Size Guidelines:**
- Each method: Maximum 30 lines or complete logic block
- Classes: Break into multiple files if needed
- No monolithic implementations

**Deliverables:**
- Python modules (predictions_config.py, predictions_sampler.py, predictions_generator.py, predictions_writer.py)
- Integration code for training loop
- Unit tests (no Unicode in tests either)

**Estimated Time:** 8 hours

---

## Phase 4: API Endpoints

**Goal:** Expose predictions data via REST API

### Tasks

4.1. **GET /api/training/predictions/[jobId]**
   - File: `app/api/training/predictions/[jobId]/route.ts`
   - Query params:
     - `epoch` (optional): Filter by specific epoch
     - `limit` (default from env): Number of predictions to return
     - `offset` (default 0): Pagination offset
   - Response:
     ```typescript
     {
       job_id: string;
       predictions: TrainingPrediction[];
       total_count: number;
       epoch_count: number;
     }
     ```
   - Authentication: Bearer token
   - Authorization: User must own the job (RLS handles this)

4.2. **GET /api/training/predictions/[jobId]/epochs**
   - File: `app/api/training/predictions/[jobId]/epochs/route.ts`
   - Returns list of epochs with prediction counts
   - Response:
     ```typescript
     {
       job_id: string;
       epochs: Array<{
         epoch: number;
         prediction_count: number;
         latest_step: number;
       }>;
     }
     ```

4.3. **OpenAPI Documentation**
   - Update `openapi.config.js`
   - Add schema: `TrainingPrediction` to components.schemas
   - Document both endpoints with examples
   - Add to `Metrics` tag

**Deliverables:**
- Two API route files
- OpenAPI spec updates
- Integration tests

**Estimated Time:** 4 hours

---

## Phase 5: UI Components

**Goal:** Display predictions with user controls for cost management

### Tasks

5.1. **Predictions Configuration Panel**
   - File: `components/training/PredictionsConfigPanel.tsx`
   - Location: Training job creation form
   - Controls:
     - Enable/disable predictions
     - Sample count slider (1 to env max)
     - Frequency selector (epoch/steps)
     - Cost estimate display
   - Saves to job config JSONB

5.2. **Predictions Table Component**
   - File: `components/training/PredictionsTable.tsx`
   - Displays predictions in tabular format
   - Columns: Epoch, Sample #, Prompt (truncated), Prediction (truncated), Ground Truth (if available)
   - Click to expand full text
   - Filter by epoch dropdown
   - Pagination controls

5.3. **Predictions Comparison View**
   - File: `components/training/PredictionsComparison.tsx`
   - Side-by-side comparison across epochs
   - Select specific sample to track across training
   - Shows improvement/degradation over time
   - Highlighting of differences

5.4. **Integration with Training Monitor**
   - File: `app/training/monitor/page.tsx`
   - Add new tab: "Predictions"
   - Conditional rendering (only show if predictions enabled)
   - Lazy loading with dynamic import pattern (following existing code pattern)

5.5. **Cost Estimator Utility**
   - File: `lib/training/predictions-cost-estimator.ts`
   - Function: `estimatePredictionsCost(config, total_epochs, model_name)`
   - Returns estimated cost in dollars
   - Based on inference pricing
   - Display in configuration panel

**Deliverables:**
- Five React components
- Cost estimator utility
- Integration with existing training monitor page

**Estimated Time:** 10 hours

---

## Phase 6: Testing & Documentation

**Goal:** Ensure quality and usability

### Tasks

6.1. **Backend Tests**
   - Python unit tests for all modules
   - Test configuration validation
   - Test sample loading
   - Test prediction generation
   - Test database writes
   - **NO UNICODE in test files**

6.2. **API Tests**
   - Test authentication/authorization
   - Test pagination
   - Test filtering by epoch
   - Test error cases (job not found, etc.)

6.3. **Frontend Tests**
   - Component tests for UI components
   - Test configuration validation
   - Test cost estimation
   - Test data fetching and display

6.4. **Documentation**
   - Update `openapi.config.js` description
   - Create user guide: "Using Training Predictions"
   - Document configuration options
   - Add to docs sidebar navigation

6.5. **Progress Log Update**
   - Update progress log with implementation notes
   - Document any deviations from plan
   - Record lessons learned

**Deliverables:**
- Test suites for all components
- User documentation
- Updated progress log

**Estimated Time:** 6 hours

---

## Implementation Order

1. **Phase 1** (Database) - Foundation for all other phases
2. **Phase 2** (Configuration) - Required for Phase 3
3. **Phase 3** (Python) - Core prediction generation logic
4. **Phase 4** (API) - Exposes data to frontend
5. **Phase 5** (UI) - User-facing features
6. **Phase 6** (Testing/Docs) - Continuous throughout

## Total Estimated Time

33 hours across 6 phases

## Success Criteria

- [ ] Users can enable/disable predictions per training job
- [ ] Users can configure sample count (cost control)
- [ ] Predictions are generated at each epoch automatically
- [ ] UI displays predictions with comparison across epochs
- [ ] No hardcoded values anywhere in implementation
- [ ] No Unicode characters in Python files or tests
- [ ] All code in 30-line blocks or complete logic blocks
- [ ] Full OpenAPI documentation
- [ ] Comprehensive test coverage

## Risk Mitigation

**Risk:** Prediction generation slows down training
**Mitigation:** Async writes, minimal sampling, configurable frequency

**Risk:** High inference costs for users
**Mitigation:** User controls, cost estimator, sensible defaults from env

**Risk:** Database performance with many predictions
**Mitigation:** Proper indexing, pagination in API, cleanup of old predictions

**Risk:** Unicode accidentally added to Python files
**Mitigation:** Pre-commit hooks, linting rules, code review checklist

## Next Steps

1. Review and approve this plan
2. Create progress log document
3. Begin Phase 1 implementation
