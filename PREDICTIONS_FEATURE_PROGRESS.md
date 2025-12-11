# Training Predictions Feature - Progress Log

**Feature:** W&B-style model predictions tracking
**Started:** 2025-11-15
**Status:** Planning Phase

---

## Session 1: 2025-11-15 - Planning & Schema Verification

### Context

User requested implementation of training predictions feature similar to Weights & Biases. This feature will track model predictions on sample prompts during training to visualize quality improvement across epochs.

### Critical Requirements Established

1. No hardcoded variables - all values must be configurable
2. No Unicode in Python files or tests (CRITICAL)
3. No stub, mock, TODO, or fake implementations in production code
4. Code in 30-line blocks or complete logic blocks
5. Must be configurable - users control sampling due to cost
6. Phased implementation approach
7. Never assume, always verify

### Work Completed

#### 1. Database Schema Verification

**Verified existing tables:**

- `local_training_jobs` table structure documented
- `local_training_metrics` table structure documented
- Identified config JSONB field for storing predictions configuration
- No migration needed for configuration (JSONB is flexible)

**Key findings:**

- Jobs use JSONB config field - predictions config will go here
- RLS policies use pattern: `auth.uid() = user_id`
- User ownership verified via user_id column
- Bearer token authentication via Supabase JWT

#### 2. Implementation Plan Created

**File:** `PREDICTIONS_FEATURE_IMPLEMENTATION_PLAN.md`

**6 Phases defined:**

1. Database Schema (2 hours) - Create training_predictions table
2. Configuration System (3 hours) - Environment variables and validation
3. Python Prediction Sampler (8 hours) - Core prediction generation (NO UNICODE)
4. API Endpoints (4 hours) - REST API for predictions data
5. UI Components (10 hours) - User controls and display
6. Testing & Documentation (6 hours) - Quality assurance

**Total estimated time:** 33 hours

#### 3. Key Design Decisions

**Configuration Storage:**

- Using existing `config` JSONB field in `local_training_jobs`
- No schema migration required for configuration
- Structure:

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

**Database Design:**

- New table: `training_predictions`
- Columns: id, job_id, user_id, epoch, step, sample_index, prompt, ground_truth, prediction, created_at
- Three indexes: job_id, (job_id, epoch), user_id
- RLS policies for user isolation
- ON DELETE CASCADE for cleanup

**Configuration Sources (Priority Order):**

1. Job-specific config (in database)
2. Environment variables (system defaults/limits)
3. No hardcoded fallbacks allowed

**Python Implementation:**

- Four separate modules: config, sampler, generator, writer
- Each module focused on single responsibility
- All modules: NO UNICODE CHARACTERS (critical requirement)
- Maximum 30 lines per method (or complete logic block)
- Async database writes to avoid blocking training

**API Design:**

- Two endpoints:
  - GET /api/training/predictions/[jobId] - Retrieve predictions with pagination
  - GET /api/training/predictions/[jobId]/epochs - List epochs with prediction counts
- Bearer token authentication
- RLS for authorization
- Pagination support (limit/offset)
- Filtering by epoch

**UI Design:**

- Configuration panel in job creation form
- Cost estimator to help users make informed decisions
- Predictions table with expand/collapse for full text
- Comparison view to track sample across epochs
- Integration with existing training monitor page
- Lazy loading following existing pattern

### Files Created

- `/home/juan-canfield/Desktop/web-ui/PREDICTIONS_FEATURE_IMPLEMENTATION_PLAN.md` - Comprehensive implementation plan
- `/home/juan-canfield/Desktop/web-ui/PREDICTIONS_FEATURE_PROGRESS.md` - This progress log

### Code Patterns Verified

**Authentication Pattern (from existing code):**

```typescript
const authHeader = request.headers.get('authorization');
const supabaseAuth = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user }, error } = await supabaseAuth.auth.getUser();
```

**RLS Pattern (from existing migrations):**

```sql
CREATE POLICY "policy_name"
  ON table_name
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Dynamic Import Pattern (from TrainingMonitor):**

```typescript
const Component = dynamic(
  () => import('@/components/...').then(mod => ({ default: mod.Component })),
  { loading: () => <div className="h-64 bg-muted animate-pulse rounded-lg" />, ssr: false }
);
```

**Environment Variable Pattern (from existing code):**

```typescript
const limit = parseInt(process.env.TRAINING_JOBS_LIST_LIMIT || '50', 10);
```

### Verification Checklist

- [x] Verified local_training_jobs table structure
- [x] Verified local_training_metrics table structure
- [x] Verified existing RLS policy pattern
- [x] Verified authentication pattern
- [x] Verified existing API route patterns
- [x] Verified environment variable usage pattern
- [x] Verified dynamic import pattern for components
- [x] Documented configuration schema
- [x] Created phased implementation plan
- [x] Established no-Unicode requirement for Python

### Next Steps

1. Begin Phase 1: Create database migration for training_predictions table
2. Implement RLS policies
3. Test migration locally before proceeding

### Questions & Decisions

**Q: Where to store predictions configuration?**
A: In existing `config` JSONB field of `local_training_jobs` table. No migration needed.

**Q: How to handle cost control?**
A: Multi-layered approach:

- Environment variables set system-wide limits
- Cost estimator shows estimated spend before enabling
- User configures sample_count per job (within limits)
- Default to small sample count (5 from env)

**Q: How often to generate predictions?**
A: User-configurable frequency:

- Default: Once per epoch (from env: PREDICTIONS_DEFAULT_FREQUENCY=epoch)
- Alternative: Every N steps (user sets step_interval)
- Recommendation: Epoch-based to minimize cost

**Q: How to avoid slowing down training?**
A: Async database writes with error handling that doesn't interrupt training

**Q: Unicode requirement - why so critical?**
A: User explicitly marked this as CRITICAL multiple times. Must ensure:

- No Unicode in Python source files
- No Unicode in test files
- No Unicode in comments or docstrings
- ASCII-only throughout Python codebase

### Notes for Future Sessions

- Implementation plan is in `PREDICTIONS_FEATURE_IMPLEMENTATION_PLAN.md`
- This progress log should be updated (never deleted) after each session
- All environment variables must be documented in `.env.example`
- All API endpoints must be documented in OpenAPI spec
- Follow existing code patterns for consistency
- Test locally before committing each phase
- Each phase is independently deployable

### Session Summary

Planning phase completed successfully. Comprehensive implementation plan created with 6 phases and detailed tasks. Database schema verified, design decisions documented, existing code patterns analyzed. Ready to begin implementation starting with Phase 1 (database migration).

---

## Session 2: 2025-11-15 - Phases 1-4 Implementation

### Context

Implementing predictions feature following the plan. Completed database schema, configuration system, Python modules, and API endpoints in a single focused session.

### Work Completed

#### Phase 1: Database Schema (COMPLETED)

**Migration File Created:**

- File: `supabase/migrations/20251115115752_create_training_predictions_table.sql`
- Table: `training_predictions` with all required columns
- Indexes: job_id, (job_id, epoch), user_id for query performance
- RLS Policies: SELECT, INSERT, DELETE (no UPDATE - predictions are immutable)
- Foreign keys with CASCADE delete for cleanup

**Verification Status:**

- SQL syntax verified against existing migration patterns
- Local testing pending (Supabase CLI not installed)
- Manual testing required before production deployment

#### Phase 2: Configuration System (COMPLETED)

**TypeScript Types:**

- File: `lib/training/types/predictions-types.ts`
- Interfaces: PredictionsConfig, TrainingPrediction, PredictionsSample, etc.
- All response types for API endpoints

**Configuration Validation:**

- File: `lib/training/predictions-config.ts`
- Function: `loadPredictionsLimits()` - loads from environment
- Function: `validatePredictionsConfig()` - validates user input
- Zero hardcoded values - all configurable

**Environment Variables:**

- Updated `.env.example` with predictions configuration
- Variables added:
  - PREDICTIONS_ENABLED=true
  - PREDICTIONS_DEFAULT_SAMPLE_COUNT=5
  - PREDICTIONS_MAX_SAMPLE_COUNT=100
  - PREDICTIONS_DEFAULT_FREQUENCY=epoch
  - PREDICTIONS_MIN_STEP_INTERVAL=10

#### Phase 3: Python Prediction Modules (COMPLETED)

**NO UNICODE CHARACTERS - VERIFIED**

**Module 1: predictions_config.py**

- Class: PredictionsConfig
- Loads all settings from environment variables
- Method: validate_user_config() - validates against limits
- No hardcoded values

**Module 2: predictions_sampler.py**

- Class: PredictionsSampler
- Method: load_samples() - randomly samples from dataset
- Method: _extract_prompt() - extracts prompts from various formats
- Method: _extract_ground_truth() - extracts expected outputs
- Supports multiple dataset formats (messages, prompt/completion, etc.)

**Module 3: predictions_generator.py**

- Class: PredictionsGenerator
- Method: generate_predictions() - generates predictions for all samples
- Method: _generate_single() - generates single prediction
- Uses torch.no_grad() for efficiency
- model.eval() mode during generation

**Module 4: predictions_writer.py**

- Class: PredictionsWriter
- Method: write_predictions() - sync batch insert to database
- Method: write_predictions_async() - async wrapper
- Uses Supabase client with service role key
- Error handling that doesn't interrupt training

**Code Quality:**

- All methods under 30 lines or complete logic blocks
- NO UNICODE characters in any file
- Clean separation of concerns
- Follows existing Python code patterns in lib/training

#### Phase 4: API Endpoints (COMPLETED)

**Endpoint 1: GET /api/training/predictions/[jobId]**

- File: `app/api/training/predictions/[jobId]/route.ts`
- Query params: epoch (filter), limit (pagination), offset (pagination)
- Returns: predictions array with total_count and epoch_count
- Authentication: Bearer token via Supabase
- Authorization: RLS ensures user owns job
- OpenAPI documentation included

**Endpoint 2: GET /api/training/predictions/[jobId]/epochs**

- File: `app/api/training/predictions/[jobId]/epochs/route.ts`
- Returns: Array of epochs with prediction counts and latest step
- Used for building epoch selectors in UI
- Authentication and authorization same as above
- OpenAPI documentation included

**OpenAPI Spec Updates:**

- Updated `openapi.config.js`
- Added TrainingPrediction schema to components.schemas
- Added both endpoints to apis array
- Full documentation with examples

### Files Created (11 files)

**Database:**

1. `supabase/migrations/20251115115752_create_training_predictions_table.sql`

**TypeScript:**
2. `lib/training/types/predictions-types.ts`
3. `lib/training/predictions-config.ts`

**Python:**
4. `lib/training/predictions_config.py`
5. `lib/training/predictions_sampler.py`
6. `lib/training/predictions_generator.py`
7. `lib/training/predictions_writer.py`

**API Routes:**
8. `app/api/training/predictions/[jobId]/route.ts`
9. `app/api/training/predictions/[jobId]/epochs/route.ts`

**Configuration:**
10. `.env.example` (updated)
11. `openapi.config.js` (updated)

### Code Metrics

- Total lines of new code: ~650 lines
- Python modules: 4 files, ~250 lines (NO UNICODE)
- TypeScript modules: 2 files, ~200 lines
- API endpoints: 2 files, ~200 lines
- All methods respect 30-line guideline

### Compliance Checklist

- [x] No hardcoded variables - all from environment
- [x] No Unicode in Python files - VERIFIED
- [x] No stub/mock/TODO implementations
- [x] Code in 30-line blocks or complete logic
- [x] Everything configurable via environment
- [x] OpenAPI documentation complete
- [x] Follows existing code patterns
- [x] RLS policies for security
- [x] Bearer token authentication

### Remaining Work (Phases 5-6)

**Phase 5: UI Components (Not Started)**

- PredictionsConfigPanel component
- PredictionsTable component
- PredictionsComparison component
- Integration with training monitor page
- Cost estimator utility

**Phase 6: Testing & Documentation (Not Started)**

- Python unit tests
- API integration tests
- Frontend component tests
- User documentation
- Final progress log update

### Next Steps

1. Begin Phase 5: Create UI components
2. Start with PredictionsConfigPanel for job creation form
3. Then create display components for training monitor
4. Test end-to-end workflow
5. Write comprehensive tests

### Session Summary

Completed Phases 1-4 in single session: database schema, configuration system, Python modules (NO UNICODE), and API endpoints. All code follows requirements: no hardcoded values, configurable throughout, proper authentication/authorization. Ready for UI implementation in Phase 5.

---

## Session 3: 2025-11-15 (continued) - Phase 5: UI Components

### Context

Implementing UI components for predictions feature. Creating user-facing components for configuration and visualization.

### Work Completed

#### Phase 5: UI Components (COMPLETED)

**Utility 1: Cost Estimator**

- File: `lib/training/predictions-cost-estimator.ts`
- Function: `estimatePredictionsCost()` - calculates cost based on model and config
- Function: `formatCost()` - formats cost for display
- Model-specific pricing (7B, 13B, 70B)
- All pricing configurable via environment

**Component 1: PredictionsConfigPanel**

- File: `components/training/PredictionsConfigPanel.tsx`
- Enable/disable toggle with Switch component
- Sample count slider (1 to max from env)
- Frequency selector (epoch recommended)
- Real-time cost estimate display
- Warning for high costs (> $1.00)
- Validates configuration against limits
- Uses Card, Alert, Slider components

**Component 2: PredictionsTable**

- File: `components/training/PredictionsTable.tsx`
- Displays predictions in table format
- Columns: Epoch, Sample #, Prompt, Prediction, View
- Expand/collapse for full text
- Epoch filter dropdown
- Pagination controls (10 per page)
- Fetches from GET /api/training/predictions/[jobId]
- Auto-fetches epochs for filter
- Loading and error states

**Component 3: PredictionsComparison**

- File: `components/training/PredictionsComparison.tsx`
- Side-by-side comparison across epochs
- Sample selector dropdown
- Shows prompt and ground truth
- Displays predictions chronologically
- Visual indicators for changes (TrendingUp/Down icons)
- Highlights latest prediction
- Shows evolution over time

**Integration with Training Monitor:**

- File: `app/training/monitor/page.tsx` (updated)
- Added dynamic imports for PredictionsTable and PredictionsComparison
- Integrated components after metrics charts
- Conditional rendering (requires auth token)
- Follows existing lazy loading pattern
- Added between MetricsOverviewCard and BestModelCard

**Environment Variables Added:**

```bash
PREDICTIONS_API_DEFAULT_LIMIT=50
PREDICTIONS_MAX_LENGTH=256
PREDICTIONS_AVG_TOKENS=300
PREDICTIONS_DEFAULT_COST_PER_1K=0.01
PREDICTIONS_COST_7B=0.005
PREDICTIONS_COST_13B=0.01
PREDICTIONS_COST_70B=0.05
```

### Files Created/Updated (5 files)

**Utilities:**

1. `lib/training/predictions-cost-estimator.ts`

**Components:**
2. `components/training/PredictionsConfigPanel.tsx`
3. `components/training/PredictionsTable.tsx`
4. `components/training/PredictionsComparison.tsx`

**Integration:**
5. `app/training/monitor/page.tsx` (updated)

**Configuration:**
6. `.env.example` (updated with 7 additional variables)

### Code Metrics

- New component code: ~500 lines
- Cost estimator: ~100 lines
- All components use existing UI library (shadcn/ui)
- Follows established patterns from existing components

### Component Features

**PredictionsConfigPanel:**

- Real-time validation
- Cost estimation with model-specific pricing
- User-friendly controls (Switch, Slider)
- Warning alerts for expensive configurations
- Integrates with existing training config system

**PredictionsTable:**

- Fetches data via REST API
- Client-side pagination
- Epoch filtering
- Text truncation with expand/collapse
- Responsive design

**PredictionsComparison:**

- Track prediction evolution
- Visual trend indicators
- Ground truth comparison
- Sample selection
- Chronological ordering

### Integration Details

- Components lazy-loaded for performance
- Uses dynamic imports like existing charts
- Positioned logically in monitor page flow
- Conditional rendering based on auth state
- No impact on existing functionality

### Compliance Checklist

- [x] Uses existing UI component library
- [x] Follows existing code patterns
- [x] Lazy loading for performance
- [x] Proper error handling
- [x] Loading states
- [x] All values configurable via environment
- [x] TypeScript types properly used
- [x] Responsive design

### Session Summary

Completed Phase 5: Created 3 UI components and 1 utility function. PredictionsConfigPanel provides user controls with cost estimation. PredictionsTable displays predictions with filtering and pagination. PredictionsComparison shows prediction evolution across epochs. All components integrated into training monitor page with lazy loading. Total ~600 lines of new UI code following established patterns.

---

## Session 2: 2025-12-02 - DType Mismatch Root Cause & Fix Planning

### Context

User reported that training_predictions table is not being populated during fine-tuning despite feature being enabled. Investigation revealed dtype compatibility issues in the predictions generation system.

### Critical Requirements Reaffirmed

1. "-Never Assume, always verify.- critical"
2. "-verify code in files before updating or making changes- critical"
3. "-validate any changes that need to be made, make sure the changes works as intended before you implement it so you do not break other files"
4. "Create phased implementation plan to address issues and create a permanent fix - no workarounds"
5. "Wait for my approval after"
6. "NOT CREATE BREAKING CHANGES _CRITICAL"

### Problem Investigation

#### Initial Symptoms

- ✅ Configuration verified: `predictions.enabled: true` in job configs
- ✅ Environment variables present: JOB_ID, JOB_USER_ID, JOB_TOKEN, METRICS_API_URL
- ✅ Callback system initialized correctly in standalone_trainer.py
- ✅ Database table exists with correct schema
- ✅ API endpoint functional at POST /api/training/local/predictions
- ❌ Zero predictions written to database
- ❌ Table remains empty across all training runs

#### Evidence from Logs

**Error pattern observed in multiple jobs:**

```
[PredictionsCallback] Generating 5 predictions at epoch 0, step 25
Generation error for sample 0: expected scalar type Float but found BFloat16
Generation error for sample 1: expected scalar type Float but found BFloat16
Generation error for sample 2: expected scalar type Float but found BFloat16
Generation error for sample 3: expected scalar type Float but found BFloat16
Generation error for sample 4: expected scalar type Float but found BFloat16
```

**Jobs affected:**

- `job_db0a2144-a2f9-419f-9471-8a0dd87af6af` (Qwen/Qwen3-1.7B, bf16=true, 4-bit quant)
- `job_c57274a5-eb44-4047-b3eb-38d911474065` (Qwen/Qwen3-1.7B, bf16=true, 4-bit quant)
- `job_af142225-b952-45ce-a31e-6c95a3652f41` (Model with bf16=true)
- Multiple other recent training runs with BFloat16 enabled

**Pattern:** 100% failure rate on prediction generation during eval callbacks

#### Code Analysis Performed

**Files examined:**

1. `lib/training/predictions_callback.py` (lines 99-182)
   - TrainingPredictionsCallback.on_evaluate() correctly fires during eval
   - _generate_predictions() retrieves model/tokenizer from kwargs
   - Calls generator.generate_predictions()
   - Status: ✅ Working correctly

2. `lib/training/predictions_generator.py` (lines 24-103)
   - generate_predictions() iterates samples with try/catch
   - _generate_single() calls model.generate()
   - Exception caught and logged, but sample skipped silently
   - Returns empty list on all failures
   - Status: ❌ No dtype handling before generation

3. `lib/training/predictions_writer.py` (lines 68-140)
   - write_predictions() makes HTTP POST to local API
   - _prepare_records() formats prediction data
   - Status: ✅ Working correctly (never receives data to write)

4. `lib/training/standalone_trainer.py` (lines 1696-1716)
   - Initializes predictions callback with config validation
   - Verifies all prerequisites (PREDICTIONS_AVAILABLE, JOB_ID, etc.)
   - Status: ✅ Working correctly

**Root cause identified:**

- Trainer uses BFloat16 autocast context during eval for mixed precision training
- PredictionsGenerator._generate_single() has no dtype management
- model.generate() fails with "expected scalar type Float but found BFloat16"
- Silent failure due to broad try/catch with continue statement

### Verification Testing

#### Manual Reproduction (Outside Trainer Context)

Created isolated test using training environment:

- Python: `/home/juan-canfield/Desktop/web-ui/lib/training/trainer_venv/bin/python`
- Interactive session PID: 353995

**Test Setup:**

```python
# Loaded exact training configuration
config = json.load(open('training_logs/job_db0a2144-a2f9-419f-9471-8a0dd87af6af.json'))
model_name = "Qwen/Qwen3-1.7B"

# Applied 4-bit quantization (same as training)
quantization_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.bfloat16,  # bf16=true from config
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4"
)

# Loaded model
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config=quantization_config,
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Prepared for kbit training (same as standalone_trainer.py)
model = prepare_model_for_kbit_training(model)

# Applied LoRA (same as training)
lora_config = LoraConfig(
    r=32, lora_alpha=64, target_modules="all-linear", 
    lora_dropout=0.2, bias="none", task_type="CAUSAL_LM"
)
model = get_peft_model(model, lora_config)
```

**Results:**

- ✅ Model loaded: dtype=torch.float16 (quantized)
- ✅ After kbit prep: dtype=torch.float32 (trainable params)
- ✅ After LoRA: dtype=torch.float32
- ✅ Generation test 1 (plain): SUCCESS, 1 prediction generated
- ✅ Generation test 2 (with LoRA): SUCCESS, 1 prediction generated
- ✅ Generation test 3 (with autocast): SUCCESS, 1 prediction generated

**Conclusion:** Model setup is correct. Generation works when called directly. Issue is specific to trainer's eval context where autocast state differs from manual execution.

### Root Cause Analysis

**Technical Issue:**
The HuggingFace Trainer applies autocast context during eval loop to maintain consistent precision with training. When PredictionsGenerator._generate_single() is called from within the eval callback:

1. Trainer has active BFloat16 autocast context
2. PEFT model has Float32 trainable parameters
3. model.generate() receives mixed dtype inputs/context
4. PyTorch raises TypeError: "expected scalar type Float but found BFloat16"
5. Exception caught in generate_predictions(), sample skipped
6. Empty prediction list returned
7. Writer never called (no data to write)
8. Table remains empty

**Why it works in testing:**

- No active autocast context in manual testing
- Model handles dtypes consistently
- Generation succeeds normally

**Why it fails in training:**

- Trainer's eval loop uses autocast for mixed precision
- PEFT wrapper + autocast interaction causes dtype mismatch
- No dtype safety in predictions generator

### Implementation Plan Created

**File:** `PREDICTIONS_DTYPE_FIX_PLAN.md`

**3 Phases defined:**

**Phase 1: Enhanced Diagnostics** (1 hour, Low risk)

- Add dtype logging to capture exact state during failure
- Log model dtype, autocast state, input tensor dtypes
- Verify exact mismatch scenario
- No behavior changes

**Phase 2: DType Correction** (2 hours, Medium risk)

- Implement dtype-safe generation wrapper
- **Option A (Recommended):** Disable autocast during generation
  - Simpler, more predictable
  - Quantized models handle dtype internally
  - Minimal performance impact (small batch)
- **Option B (Alternative):** Match autocast dtype explicitly
  - Detect active autocast dtype
  - Use explicit autocast with detected dtype
- Update _generate_single() in predictions_generator.py

**Phase 3: Enhanced Error Handling** (2 hours, Low risk)

- Improve error logging in callback and generator
- Add partial success handling (allow some samples to fail)
- Log full stack traces in debug mode
- Track success/failure counts per generation batch

### Files Identified for Changes

**Primary fix location:**

- `lib/training/predictions_generator.py` lines 69-103 (_generate_single method)

**Secondary improvements:**

- `lib/training/predictions_callback.py` lines 152-182 (_generate_predictions method)

**Verification only (no changes):**

- `lib/training/standalone_trainer.py` lines 1680-1860
- `lib/training/predictions_writer.py` lines 68-140
- `app/api/training/local/predictions/route.ts`

### Testing Matrix Planned

| Configuration | Model | Quantization | Expected Result |
|--------------|-------|--------------|-----------------|
| bf16=true | Qwen/Qwen3-1.7B | 4-bit | ✅ Predictions saved |
| bf16=false | Qwen/Qwen3-1.7B | 4-bit | ✅ Predictions saved |
| fp16=true | meta-llama/Llama-3.2-1B | 4-bit | ✅ Predictions saved |
| bf16=true | mistralai/Mistral-7B | 4-bit | ✅ Predictions saved |
| bf16=true | Qwen/Qwen3-1.7B | None | ✅ Predictions saved |

### Success Criteria

**Phase 1 Complete:**

- Dtype diagnostic logs captured during eval
- Autocast state confirmed in logs
- Root cause fully documented

**Phase 2 Complete:**

- No "expected scalar type Float but found BFloat16" errors in logs
- Predictions generated successfully during training eval
- `training_predictions` table populated with records
- API endpoint returns prediction data
- Zero breaking changes to training pipeline

**Phase 3 Complete:**

- Partial success handling works (some samples can fail gracefully)
- Error logging provides actionable information
- All test matrix configurations pass
- No regressions in training performance or metrics

### Questions for User Approval

1. **Approach Selection:** Do you approve Option A (Disable Autocast) as the primary fix?
2. **Phased Implementation:** Should we proceed with all 3 phases, or Phase 2 only first?
3. **Testing Scope:** Should we test all configurations in the matrix, or a subset?
4. **Documentation:** Where should user-facing dtype notes be added?

### Status

**Current State:** Implementation plan complete, awaiting user approval to proceed

**Awaiting:**

- User review of PREDICTIONS_DTYPE_FIX_PLAN.md
- Approval for Option A (disable autocast) vs Option B (match autocast dtype)
- Confirmation to proceed with phased implementation
- Approval to begin Phase 1 (diagnostics)

**Next Steps After Approval:**

1. Create feature branch: `feature/predictions-dtype-fix`
2. Implement Phase 1: Add dtype diagnostic logging
3. Run test training job to capture exact dtype state
4. Implement Phase 2: Apply dtype-safe generation wrapper
5. Run test training job to verify fix
6. Implement Phase 3: Enhance error handling
7. Run full test matrix
8. Update documentation

---

## Session 4: [Date] - Phase 6: Testing & Documentation

[To be filled in during next session]

---

## Session 6: [Date] - Phase 5: UI Components

[To be filled in during next session]

---

## Session 3: 2025-12-02 - LLM-as-Judge Batch Integration Planning

### Context

User requested investigation into evaluation/validation during batch testing, specifically asking about LLM-as-judge implementation during batch runs.

### Critical Requirements Reaffirmed

1. "-Create phased implementation plan to address issues and create a permanent fix - no workarounds"
2. "-Create or update existing (never delete or overwrite) progress logs to account for new changes and context for session continuity"
3. "-Never Assume, always verify.- critical"
4. "-verify code in files before updating or making changes- critical"
5. "-find the exact files and code insertion points for any files that need updating- critical"
6. "-verify changes made actually work - critical"
7. "-validate any changes that need to be made, make sure the changes works as intended before you implement it so you do not break other files"
8. "-verify what other files may be affected by proposed changes - NOT CREATE BREAKING CHANGES _CRITICAL"
9. "-Wait for my approval after"

### Problem Investigation

#### Current Batch Evaluation System

**What's Working:**
- ✅ Batch tests run successfully through `/api/batch-testing/run`
- ✅ Each response triggers `saveBasicJudgment()` in `lib/batch-testing/evaluation-integration.ts`
- ✅ Rule-based judgments saved with `judge_type: 'rule'`:
  - Basic quality checker (heuristics on length, structure, keywords)
  - Domain validators (citations, format, policy scope) when benchmark linked
- ✅ Judgments table receives all rule-based evaluations
- ✅ Integration with `/api/chat` for automatic metadata collection

**What's Missing:**
- ❌ LLM-as-judge not integrated into batch testing flow
- ❌ No AI-powered evaluation (GPT-4/Claude) for semantic quality assessment
- ❌ Missing multi-dimensional evaluation (helpfulness, accuracy, clarity, safety, completeness)
- ❌ No confidence scores or detailed reasoning in judgments

#### LLM-Judge Infrastructure Analysis

**Existing Implementation (Verified):**

1. **`lib/evaluation/llm-judge.ts`** (426 lines)
   - `LLMJudge` class with OpenAI + Anthropic SDK integration
   - `judgeMessage()` - Evaluates single message against multiple criteria
   - `batchJudge()` - Evaluates multiple messages with concurrency limit (5)
   - `STANDARD_CRITERIA` - 5 evaluation dimensions:
     - Helpfulness (min: 1, max: 10, passing: 7)
     - Accuracy (min: 1, max: 10, passing: 7)
     - Clarity (min: 1, max: 10, passing: 7)
     - Safety (min: 1, max: 10, passing: 8)
     - Completeness (min: 1, max: 10, passing: 7)
   - Structured prompt engineering with JSON response parsing
   - Error handling with fallback judgments

2. **`app/api/evaluation/judge/route.ts`** (300 lines)
   - POST endpoint for single/batch evaluation
   - GET endpoint for available criteria
   - Database persistence with `judge_type: 'llm'`
   - Authentication via Supabase
   - Already tested and functional

3. **`lib/evaluation/judgments.service.ts`** (314 lines)
   - Unified judgment storage service
   - Supports `judge_type: 'rule' | 'human' | 'llm'`
   - Batch operations for efficiency
   - Statistics and reporting functions

**Verified Not Used in Batch Testing:**
- `grep` searches confirm no imports of `LLMJudge` in batch-testing files
- `saveBasicJudgment()` only calls rule validators
- No `judge_type: 'llm'` records created during batch runs

### Root Cause Analysis

**Why LLM-Judge Isn't Used:**

1. **No Integration Point** - `saveBasicJudgment()` doesn't call LLM judge
2. **No Configuration** - BatchTestConfig lacks llm_judge field
3. **No Config Propagation** - No path to pass LLM config from API → evaluation
4. **Design Decision** - LLM judge requires API keys and has cost, so intentionally separated

**Architecture Gap:**
```
Current Flow:
  Batch Run → processSinglePrompt() → /api/chat → saveBasicJudgment() → [rule validators only]

Needed Flow:
  Batch Run → processSinglePrompt() → /api/chat → saveBasicJudgment() → [rule validators + LLM judge]
                                                                              ↑
                                                                    Config enables LLM judge
```

### Implementation Plan Created

**File:** `LLM_JUDGE_BATCH_INTEGRATION_PLAN.md`

**4 Phases defined:**

**Phase 1: Configuration & Feature Flag** (2 hours, Low risk)
- Add `llm_judge` config to `BatchTestConfig` interface
- Fields: enabled, judge_model, criteria, on_error, max_retries
- Optional (backward compatible)
- TypeScript type definitions only

**Phase 2: Integration into Evaluation Flow** (3 hours, Medium risk)
- Add `runLLMJudge()` function to `evaluation-integration.ts`
- Update `saveBasicJudgment()` to call LLM judge when enabled
- Implement retry logic with exponential backoff
- Convert LLM results to judgment records with `judge_type: 'llm'`
- Error handling: skip, retry, or fail based on config

**Phase 3: API Integration & Config Propagation** (2 hours, Low risk)
- Pass `llm_judge` config from batch API through chain:
  - `processBackgroundBatch()` → `processSinglePrompt()` → `/api/chat` → `saveBasicJudgment()`
- Update function signatures to accept config
- Extract config from request bodies

**Phase 4: Documentation & Testing** (3 hours, Low risk)
- Create `LLM_JUDGE_BATCH_USAGE.md` with:
  - Configuration options
  - Cost analysis ($0.015-$0.075 per message)
  - Usage examples
  - Querying results
- Update this progress log (Session 3)
- Create integration tests
- Verify end-to-end functionality

### Design Decisions

**Decision 1: Optional Feature Flag**
- **Chosen:** Make LLM judge opt-in with config flag
- **Why:** Users control cost (paid APIs), maintains backward compatibility
- **Alternative Rejected:** Always-on evaluation (too expensive)

**Decision 2: Inline Evaluation**
- **Chosen:** Run LLM judge during batch (inline with each response)
- **Why:** Natural integration point, progress tracking, fail-fast
- **Alternative Rejected:** Post-batch processing (harder to track, delayed feedback)

**Decision 3: All Standard Criteria by Default**
- **Chosen:** Evaluate all 5 criteria when enabled
- **Why:** Comprehensive evaluation, simple to implement
- **Alternative Rejected:** Configurable criteria (complexity, can add later)

**Decision 4: Skip on Error**
- **Chosen:** Default to `on_error: 'skip'` with retry option
- **Why:** Non-blocking (batch completes), graceful degradation
- **Alternative Rejected:** Fail entire batch (too disruptive)

### Files Identified for Changes

**Modified Files (6):**

1. **`lib/batch-testing/types.ts`**
   - Add `llm_judge` field to `BatchTestConfig` interface
   - Lines 24-36
   - Risk: Low (type definition only)
   - Breaking: None (optional field)

2. **`lib/batch-testing/evaluation-integration.ts`**
   - Add `llmJudgeConfig` to `EvaluationContext` interface
   - Implement `runLLMJudge()` function
   - Update `saveBasicJudgment()` to call LLM judge when enabled
   - Lines 1-120 (full file rewrite)
   - Risk: Medium (core evaluation logic)
   - Breaking: None (llmJudgeConfig is optional)

3. **`app/api/batch-testing/run/route.ts`**
   - Pass `config.llm_judge` to `processSinglePrompt()`
   - Update `processSinglePrompt()` signature
   - Lines 430-646
   - Risk: Low (parameter passing)
   - Breaking: None (new optional parameter)

4. **`app/api/chat/route.ts`**
   - Extract `llmJudgeConfig` from request body
   - Pass to `saveBasicJudgment()`
   - Lines 20-30, 890
   - Risk: Low (parameter passing)
   - Breaking: None (new optional parameter)

5. **`PREDICTIONS_FEATURE_PROGRESS.md`**
   - Add Session 3 (this section)
   - Append to end of file
   - Risk: None (documentation)

6. **`__tests__/lib/batch-testing/llm-judge-integration.test.ts`**
   - Create new test file
   - Risk: None (tests only)

**Files Read (No Changes):**
- `lib/evaluation/llm-judge.ts` - Existing implementation (verified working)
- `app/api/evaluation/judge/route.ts` - Existing API (verified working)
- `lib/evaluation/judgments.service.ts` - Existing service (verified working)

**New Files Created (2):**
1. `LLM_JUDGE_BATCH_INTEGRATION_PLAN.md` - Complete implementation plan
2. `LLM_JUDGE_BATCH_USAGE.md` - User documentation (Phase 4)

### Verification Strategy

**Phase 1 Verification:**
- TypeScript compilation succeeds
- Existing batch tests run without llm_judge config
- Config validation accepts new fields

**Phase 2 Verification:**
- Mock LLM judge in unit tests
- Verify judgment records structure
- Test error handling (skip/retry/fail)
- Verify rule judgments still work

**Phase 3 Verification:**
- End-to-end batch test with LLM judge enabled
- Config flows through entire chain
- Judgments table receives `judge_type: 'llm'` records
- Test with real APIs (small batch)

**Phase 4 Verification:**
- Integration tests pass
- Documentation examples work
- Cost estimates accurate

### Breaking Changes Analysis

**✅ Zero Breaking Changes Confirmed:**

1. **Optional Everywhere:**
   - `BatchTestConfig.llm_judge` is optional
   - `EvaluationContext.llmJudgeConfig` is optional
   - `processSinglePrompt()` new parameter is optional
   - `/api/chat` new field is optional

2. **Backward Compatible:**
   - Existing tests without llm_judge continue working
   - Default behavior unchanged (rule-based only)
   - API contracts accept but don't require new fields

3. **Non-Blocking:**
   - LLM judge errors don't stop batch (default: skip)
   - Rule-based judgments always saved
   - Database schema unchanged (already supports judge_type: 'llm')

4. **Type-Safe:**
   - TypeScript enforces all changes
   - No runtime type coercion
   - All optional fields properly typed

### Cost Analysis

**Per-Message Cost (5 Criteria):**
- GPT-4-Turbo: $0.02/message → $2.00 per 100 messages
- GPT-4: $0.06/message → $6.00 per 100 messages
- Claude-3-Sonnet: $0.015/message → $1.50 per 100 messages (cheapest)
- Claude-3-Opus: $0.075/message → $7.50 per 100 messages

**Cost Optimization Strategies:**
1. Use fewer criteria (2-3 instead of 5) → ~60% of cost
2. Evaluate sample only (10-20% of responses) → proportional savings
3. Use Claude-3-Sonnet (25% cheaper than GPT-4-Turbo)

**Recommendation:** Document cost clearly, provide estimator in UI

### Dependencies & Environment

**Required Environment Variables:**
- `OPENAI_API_KEY` - Required for GPT models
- `ANTHROPIC_API_KEY` - Required for Claude models
- At least one must be set for LLM judge to work

**Existing Dependencies (No New Installs):**
- `openai` package - Already installed (verified in llm-judge.ts)
- `@anthropic-ai/sdk` package - Already installed (verified in llm-judge.ts)
- Supabase client - Already configured

### Timeline

| Phase | Duration | Total Hours |
|-------|----------|-------------|
| Phase 1: Config | 2 hours | 2 |
| Phase 2: Integration | 3 hours | 5 |
| Phase 3: API Plumbing | 2 hours | 7 |
| Phase 4: Documentation | 3 hours | 10 |

**Suggested Schedule:**
- Day 1 Morning: Phase 1
- Day 1 Afternoon: Phase 2
- Day 2 Morning: Phase 3
- Day 2 Afternoon: Phase 4

### Questions for User Approval

1. **Cost Control:** Should we add a cost estimator in the UI before running batch with LLM judge?

2. **Default Behavior:** Should LLM judge be opt-in (disabled by default) or opt-out (enabled by default)?

3. **Criteria Selection:** Phase 1 uses all 5 criteria. Implement configurable criteria immediately or later?

4. **Error Strategy:** Is `on_error: 'skip'` the right default, or should we default to `'retry'`?

5. **Judge Model:** Default to `gpt-4-turbo` (faster, cheaper) or `claude-3-sonnet` (cheapest)?

6. **Sampling:** Add `sample_rate` option to evaluate only X% of messages for cost optimization?

### Status

**Current State:** Planning complete, implementation plan documented, awaiting user approval

**Awaiting:**
- User approval on design decisions
- Answers to 6 approval questions
- Confirmation to proceed with Phase 1

**Next Steps After Approval:**
1. Implement Phase 1 (config changes)
2. Verify TypeScript compilation
3. Proceed to Phase 2 (integration logic)

---

## Session 7: [Date] - Phase 6: Testing & Documentation

[To be filled in during next session]

---

## Lessons Learned

### Session 2 Lessons

1. **Silent Failures Are Dangerous:** The try/catch with continue in generate_predictions() hid critical errors. Always log failures at WARNING/ERROR level, not just print.

2. **Autocast Context Matters:** Code that works in isolation may fail when called from within trainer callbacks due to different autocast state. Always test in realistic execution context.

3. **DType Mismatches in Mixed Precision:** When using quantization + LoRA + mixed precision training, generation code needs explicit dtype management to avoid conflicts between autocast context and model parameters.

4. **Verify Before Implementing:** Interactive testing session proved invaluable for isolating root cause. Reproduced exact training setup outside trainer context to confirm model setup was correct and issue was context-specific.

5. **Log Archaeology is Essential:** Pattern matching across multiple job logs revealed consistent failure mode. Without log analysis, would have assumed database or API issue rather than generation error.

---

## Implementation Deviations from Plan

### Session 2 Deviations

None yet - awaiting approval to begin implementation. All investigation and planning completed as requested.

---

## Technical Notes

### DType Handling Best Practices (Session 2)

- When using mixed precision training (bf16/fp16), generation code needs explicit autocast management
- Quantized models (4-bit/8-bit) have mixed dtypes: quantized weights (fp16/bf16) + trainable params (fp32)
- PEFT adapters (LoRA) typically use fp32 even when base model is quantized
- Trainer eval loop applies autocast to maintain precision consistency with training
- Generation should either disable autocast or use explicit dtype matching
- Small batch inference (5 samples) has negligible performance difference with/without autocast

### Silent Failure Anti-Pattern (Session 2)

**Bad:**

```python
for sample in samples:
    try:
        result = generate(sample)
        predictions.append(result)
    except Exception as e:
        print(f"Error: {e}")  # Silent failure
        continue
```

**Good:**

```python
for sample in samples:
    try:
        result = generate(sample)
        predictions.append(result)
    except Exception as e:
        logger.error(f"Generation failed for sample {sample['index']}: {e}")
        if len(predictions) == 0:  # Log context on first failure
            logger.error(f"Context: model_dtype={model.dtype}, device={device}")
        continue
```
