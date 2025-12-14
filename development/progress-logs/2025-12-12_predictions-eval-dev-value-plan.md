# Predictions During Training Eval: Developer-Value Upgrade Plan (Permanent)
**Date:** 2025-12-12
**Status:** PLAN (no code changes in this session)

## Verified Current State (as of repo HEAD)
### Where eval-time predictions are generated
- **Trainer hook:** `TrainingPredictionsCallback.on_evaluate(...)` in `lib/training/predictions_callback.py`
  - Guard: only runs when `predictions.sample_frequency == "eval"` and `predictions.enabled == true`.
  - Calls `_generate_predictions(state, **kwargs)`.

### How samples are selected
- **Sampler:** `PredictionsSampler.load_samples(dataset_path, sample_count)` in `lib/training/predictions_sampler.py`
  - Supports JSON array (`[...]`) and JSONL files, plus `.gz`.
  - Uses `random.sample(...)` with fixed seed 42 (set in callback).
  - **Note:** `sample_index` is currently the *enumeration index of the sampled subset* (0..N-1), not a stable dataset identifier.

### How predictions are produced and stored
- **Generation:** `PredictionsGenerator.generate_predictions(...)` in `lib/training/predictions_generator.py`
  - Deterministic generation (`do_sample=False`), `max_new_tokens` from `PREDICTIONS_MAX_LENGTH` env.
  - Optional scoring if `ground_truth` exists via `PredictionsScorer` in `lib/training/predictions_scorer.py`.
- **Persistence:** `PredictionsWriter.write_predictions(...)` in `lib/training/predictions_writer.py`
  - Cloud: direct insert to Supabase.
  - Local: POST to derived predictions endpoint (`METRICS_API_URL` → `/predictions`) with `JOB_TOKEN`.
  - Local server endpoint: `app/api/training/local/predictions/route.ts`.

### How developers/users consume predictions
- APIs:
  - `GET /api/training/predictions/[jobId]` in `app/api/training/predictions/[jobId]/route.ts`
  - `GET /api/training/predictions/[jobId]/epochs` in `app/api/training/predictions/[jobId]/epochs/route.ts`
  - `GET /api/training/predictions/[jobId]/trends` in `app/api/training/predictions/[jobId]/trends/route.ts`
- UI:
  - `components/training/PredictionsTable.tsx`
  - `components/training/PredictionsComparison.tsx`
  - `components/training/PredictionsTrendsChart.tsx` (integrated into `app/training/monitor/page.tsx`)
- Config UI:
  - `components/training/PredictionsConfigPanel.tsx`
  - Validation/normalization: `lib/training/predictions-config.ts` and `lib/training/predictions_config.py`
  - Types: `lib/training/types/predictions-types.ts`

## What makes it *less valuable than it could be* (developer perspective)
These are confirmed by reading the current code + schema (no assumptions):
1. **No stable prompt identity across runs**
   - `sample_index` is re-assigned 0..N-1 each run; comparing jobs/runs isn’t robust.
2. **Limited evaluation signal**
   - Current metrics are string-similarity oriented (`exact_match`, CER, overlap). Useful for “answer-like” tasks, weak for structured outputs, tool calls, API contracts, or domain constraints.
3. **Missing reproducibility context**
   - The DB row does not capture generation params, template, checkpoint identity, token counts, or latency; when something regresses, it’s hard to attribute.
4. **No explicit “golden set” / regression suite**
   - Samples are drawn from the training dataset path, not a curated, versioned prediction set.

## Permanent Fix: Phased Implementation Plan (no workarounds)
All changes are designed to be **additive** (no breaking changes): new nullable columns/tables, optional config fields, new endpoints.

### Phase 0 — Spec & Compatibility Guardrails (design-first)
**Goal:** lock down backwards compatibility and verification criteria.
- Define a “Prediction Set” concept:
  - **Training-sampled set** (current behavior)
  - **Curated set** (new): stable prompts/messages + optional ground truth + optional validators.
- Define minimal compatibility contract:
  - Existing endpoints keep working and continue returning existing fields.
  - Existing UI components remain functional with old rows (missing new fields).

**Verification (before coding):**
- Enumerate all readers of `training_predictions`:
  - `app/api/training/predictions/...` routes
  - `components/training/*Predictions*.tsx`
  - any analytics handlers (search for `training_predictions` usage)

### Phase 1 — Stable Prompt Identity + Curated Sets (schema)
**Goal:** make predictions comparable across runs.

**Schema changes (exact insertion points):**
- New tables (preferred) OR new columns (minimal):
  - **Preferred (tables):** create `training_prediction_sets` and `training_prediction_set_items`.
  - **Minimal (columns):** add `prompt_id` (TEXT), `set_id` (UUID/TEXT), `set_item_id` (UUID/TEXT) to `training_predictions`.

**Files to change:**
- New migration under `supabase/migrations/` (additive)
- Type updates in `lib/training/types/predictions-types.ts` (`TrainingPrediction` + `PredictionsConfig`)

**Verification:**
- Migration applies cleanly.
- Existing inserts still succeed (new fields nullable).
- Existing APIs return unchanged payload shape for current fields.

### Phase 2 — Loading curated sets in trainer (Python)
**Goal:** allow `predictions` to run against a curated, versioned set.

**Exact code insertion points:**
- `lib/training/predictions_callback.py`
  - In `on_train_begin(...)`, after `PredictionsSampler(...)` creation and before `load_samples(...)`, add logic to select sample source:
    - dataset path sampling (current)
    - curated set (new): load set items from file or DB
- `lib/training/predictions_sampler.py`
  - Add a new method like `load_from_prediction_set(...)` OR extend `load_samples` to accept an alternate source object.

**Config insertion points:**
- `lib/training/types/predictions-types.ts` (`PredictionsConfig`): add optional fields such as:
  - `source: 'dataset' | 'set'` (default dataset)
  - `set_id?: string` (or `set_path?: string` for local-only)
- `lib/training/predictions_config.py` and `lib/training/predictions-config.ts`:
  - validate the new fields without changing existing required fields.
- `components/training/PredictionsConfigPanel.tsx`:
  - add UI controls (minimal): a toggle for “Use curated set” and an input/select for set id.
- `lib/training/predictions-cost-estimator.ts`:
  - ensure cost estimate uses set size when `source='set'`.

**Verification:**
- With no new config fields set, behavior is identical.
- With curated set configured, logs show set load succeeded and sample count matches.

### Phase 3 — Developer-grade evaluation signals (validators)
**Goal:** make prediction rows actionable for debugging.

**Approach:** store structured validation results per prediction.
- Add optional `validation_results` JSONB and `passed` boolean (or a new table keyed by prediction id).

**Exact insertion points:**
- `lib/training/predictions_generator.py`
  - After `prediction_text` is produced, run validators (only if configured) and attach results to `pred_dict`.
- Add a validator layer that can reuse existing rule validation patterns:
  - Candidate reuse: `lib/evaluation/validators/*` (if compatible with simple per-sample checks)

**Verification:**
- Validators are optional and never block training (write best-effort like current writer).
- UI and API tolerate missing fields.

### Phase 4 — Reproducibility metadata (generation context)
**Goal:** make diffs explainable.

**Add (nullable) fields:**
- `generation_params` (JSONB): max_new_tokens, do_sample, temperature, top_p, etc.
- `token_counts` (JSONB): input_tokens, output_tokens
- `checkpoint` / `model_revision` (TEXT)
- Optional `messages` (JSONB) for chat datasets (if stored)

**Exact insertion points:**
- `lib/training/predictions_generator.py`:
  - compute token counts and attach generation params.
- `lib/training/predictions_writer.py`:
  - include these fields in `_prepare_records(...)`.
- `app/api/training/local/predictions/route.ts`:
  - expand `PredictionRecord` interface + mapping to include new fields.
- `lib/training/types/predictions-types.ts`:
  - expand `TrainingPrediction`.

**Verification:**
- Existing rows lacking metadata render fine.
- New rows contain metadata; API returns it.

### Phase 5 — UI: regression-oriented views
**Goal:** developer UX for “what regressed?”

**Minimal additive UI changes:**
- Extend `PredictionsComparison.tsx` to show validator pass/fail + key metrics.
- Add “Worst samples” view (top N by error or failed validators).

**Exact insertion points:**
- `components/training/PredictionsComparison.tsx`:
  - In the map over `selectedPredictions`, add a section rendering score/validator badges when present.
- Optional new component `components/training/PredictionsFailuresTable.tsx` and integrate into `app/training/monitor/page.tsx` under the existing predictions section.

**Verification:**
- No new UI required for baseline functionality.
- New UI elements only show when fields exist.

## Non-breaking change checklist (must hold for every phase)
- Migrations are additive (new tables or nullable columns).
- Existing API routes keep response shape stable for current keys.
- Existing writer continues to work even if new env/config keys are absent.
- Training continues even if validation/scoring fails for a sample (log + skip).

## Suggested validation protocol (when implementing)
- Unit-level:
  - Python: sampler loads curated set and dataset formats.
  - Writer: record mapping includes new fields correctly.
- Integration-level:
  - Local mode: confirm `POST /api/training/local/predictions` accepts new fields and persists.
  - UI: monitor page loads predictions/trends with mixed old/new rows.
- Regression:
  - Ensure `GET /api/training/predictions/[jobId]` works with `epoch` filter and pagination.
  - Ensure `GET /trends` tolerates null scores and doesn’t crash on missing validator fields.
