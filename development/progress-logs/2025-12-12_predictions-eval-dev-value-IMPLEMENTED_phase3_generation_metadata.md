# Predictions Eval Dev-Value — Phase 3 Implemented: Generation Metadata

Date: 2025-12-12

## Goal
Make training predictions more actionable for developers by persisting reproducibility/debug metadata per prediction:
- Token counts (prompt/completion/total)
- Wall-clock latency per prediction
- Key generation params (max_new_tokens, do_sample)

Constraints:
- Additive / non-breaking (nullable DB columns; optional fields in code; existing queries use `select('*')`).

## Changes
### 1) DB schema (additive)
- Added nullable columns to `training_predictions`:
  - `prompt_tokens`, `completion_tokens`, `total_tokens` (INTEGER)
  - `latency_ms` (INTEGER)
  - `max_new_tokens` (INTEGER)
  - `do_sample` (BOOLEAN)
- Added a partial index to support epoch-level latency queries.

File:
- `supabase/migrations/20251212000001_add_prediction_generation_metadata.sql`

### 2) Python generation metadata capture
- `PredictionsGenerator` now measures latency and computes token counts using:
  - `prompt_tokens = input_ids.shape[1]`
  - `completion_tokens = generated_ids.shape[0]`
  - `total_tokens = prompt_tokens + completion_tokens`
- These fields are attached to each prediction dict.

File:
- `lib/training/predictions_generator.py`

### 3) Persistence plumbing
- `PredictionsWriter._prepare_records(...)` now includes the new metadata fields when present.

File:
- `lib/training/predictions_writer.py`

- Local ingestion endpoint accepts/inserts the same optional metadata.

File:
- `app/api/training/local/predictions/route.ts`

### 4) Types
- `TrainingPrediction` type extended with optional metadata fields.

File:
- `lib/training/types/predictions-types.ts`

## Notes
- The runtime environment used for this repo workspace does not currently have `torch` / `transformers`, so end-to-end prediction generation tests cannot be executed here. Static checks for touched files were clean.
