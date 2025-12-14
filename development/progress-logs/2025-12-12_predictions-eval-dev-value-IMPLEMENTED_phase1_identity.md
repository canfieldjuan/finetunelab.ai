# Predictions During Training Eval: Phase 1 (Stable Identity) — IMPLEMENTED
**Date:** 2025-12-12
**Status:** IMPLEMENTED (code + migration added)

## Goal
Make training-eval predictions meaningfully comparable across runs by persisting:
- a stable `prompt_id` derived from the prompt/messages
- a stable `source_index` from the original dataset (array index or JSONL line index)

This is intentionally additive (no breaking changes).

## Changes (Verified)
### 1) Database schema (additive)
**New migration:** `supabase/migrations/20251212000000_add_prediction_identity_columns.sql`
- Adds nullable columns to `training_predictions`:
  - `prompt_id` (TEXT)
  - `source_index` (INTEGER)
  - `sample_source` (TEXT)
  - `sample_source_id` (TEXT)
- Adds partial indexes:
  - `idx_training_predictions_job_prompt_id`
  - `idx_training_predictions_job_source`

### 2) Python prediction pipeline now emits identity fields
**Sampler:** `lib/training/predictions_sampler.py`
- Sampling is now done by *original indices* so `source_index` is stable.
- Adds `prompt_id = sha256(canonical(messages) | prompt)` where `canonical(messages)` is JSON with sorted keys.
- Preserves existing `sample_index` behavior (still 0..N-1 within each run).

**Generator:** `lib/training/predictions_generator.py`
- Propagates `source_index`, `prompt_id`, `sample_source`, `sample_source_id` into each prediction dict (all optional).

**Writer:** `lib/training/predictions_writer.py`
- Includes the new optional fields in `_prepare_records(...)` so they persist to DB (cloud) or to the local API.

### 3) Local persistence API accepts the new fields
**Local endpoint:** `app/api/training/local/predictions/route.ts`
- Extends `PredictionRecord` and insert mapping to persist:
  - `source_index`, `prompt_id`, `sample_source`, `sample_source_id`

### 4) TypeScript types updated (non-breaking)
**Types:** `lib/training/types/predictions-types.ts`
- Adds optional fields to `TrainingPrediction`:
  - `source_index?`, `prompt_id?`, `sample_source?`, `sample_source_id?`

## Verification performed in this session
- Static checks: `get_errors` returned **no errors** for all modified files.
- Compatibility: all added columns/fields are nullable/optional; existing readers (`select('*')`) remain valid.

## Notes / Next steps
- Apply the new migration in your Supabase environment before expecting the new fields to persist.
- Next phase (curated prediction sets): introduce a stable set model (`set_id` + set items) and allow selecting it in `TrainingPredictionsCallback.on_train_begin(...)`.
