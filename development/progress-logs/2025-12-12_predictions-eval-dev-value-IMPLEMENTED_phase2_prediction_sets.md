# Predictions Eval Dev-Value — Phase 2 Implemented: Curated Prediction Sets (file-based)

Date: 2025-12-12

## Goal
Allow training-time predictions to sample from a dedicated, curated “prediction set” file (JSON/JSONL, optionally `.gz`) instead of always sampling from the training dataset path.

Constraints:
- Additive / non-breaking (optional config field; existing behavior unchanged).
- Preserve existing `sample_index` semantics and Phase 1 identity fields.

## Verified Before Changes
- UI/backend config normalization preserves `predictions` object: `lib/training/config-builder.ts`.
- UI predictions config is normalized via `validatePredictionsConfig(...)`: `lib/training/predictions-config.ts`.
- Training-side sampling entrypoint is `TrainingPredictionsCallback.on_train_begin(...)`: `lib/training/predictions_callback.py`.
- Trainer gating required `dataset_path` even if an alternate source could exist: `lib/training/standalone_trainer.py`.

## Changes
### 1) Config surface (additive)
- Added optional `predictions.samples_path?: string` to `PredictionsConfig`.
  - File: `lib/training/types/predictions-types.ts`

### 2) Frontend validation preserves samples_path
- `validatePredictionsConfig(...)` now validates and passes through `samples_path` (instead of dropping unknown keys).
  - File: `lib/training/predictions-config.ts`

### 3) Python config normalization preserves samples_path
- `PredictionsConfig.validate_user_config(...)` now validates and includes `samples_path` when present.
  - File: `lib/training/predictions_config.py`

### 4) Sampling & source metadata
- `PredictionsSampler.load_samples(...)` now accepts optional `sample_source` / `sample_source_id` and attaches them to each sample.
  - Backward compatible: existing callers still work.
  - File: `lib/training/predictions_sampler.py`

### 5) Callback chooses curated set when provided
- `TrainingPredictionsCallback.on_train_begin(...)` uses `predictions.samples_path` when set; otherwise falls back to `dataset_path`.
  - Sets `sample_source='prediction_set'` when using `samples_path`.
  - File: `lib/training/predictions_callback.py`

### 6) Trainer gating updated (SFT/DPO/ORPO)
- Predictions now initialize when either `dataset_path` OR `predictions.samples_path` is available.
  - File: `lib/training/standalone_trainer.py`

### 7) Diagnostics / smoke tests
- Updated `check_predictions_config.py` to treat `predictions.samples_path` as the primary samples source when present.
  - File: `lib/training/check_predictions_config.py`
- Updated `test_predictions_integration.py` to assert presence of new identity/source fields on loaded samples.
  - File: `test_predictions_integration.py`

## How to Use
In your training config JSON:

```json
{
  "predictions": {
    "enabled": true,
    "sample_count": 10,
    "sample_frequency": "eval",
    "samples_path": "/path/to/prediction_set.jsonl"
  }
}
```

If `samples_path` is not provided, behavior remains unchanged (samples are drawn from `dataset_path`).

## Notes
- No DB/API schema changes are required for Phase 2; `sample_source` / `sample_source_id` were already introduced in Phase 1 and are now populated for file-based sets.
