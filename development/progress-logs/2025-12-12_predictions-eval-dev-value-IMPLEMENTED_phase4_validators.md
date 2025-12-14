# Predictions Eval Dev-Value — Phase 4 Implemented: Output Validators

Date: 2025-12-12

## Goal
Add optional, config-driven output validation for training predictions and persist the results so developers can quickly spot regressions (e.g., model stops producing valid JSON).

Requirements covered:
- Schema/JSON checks per prediction (implemented as JSON parse + optional JSONSchema validation)
- Persist pass/fail + structured error details per prediction
- Provide a summary signal (per-epoch validation pass rate in the trends API)

Constraints:
- Additive / non-breaking (validation off by default; nullable DB columns; existing UI continues working)

## Changes

### 1) DB schema (additive)
Added nullable columns to `training_predictions`:
- `validation_pass` (BOOLEAN)
- `validation_errors` (JSONB)
- `validation_kind` (TEXT)

Plus a partial index on `(job_id, epoch)` where `validation_pass IS NOT NULL`.

File:
- `supabase/migrations/20251212000002_add_prediction_validation_columns.sql`

### 2) Config surface (additive)
Extended `PredictionsConfig` with optional validator settings:

```ts
predictions: {
  validators?: {
    json_parse?: boolean,
    json_schema_path?: string
  }
}
```

Files:
- `lib/training/types/predictions-types.ts`
- `lib/training/predictions-config.ts` (preserve/validate config so UI doesn’t drop it)
- `lib/training/predictions_config.py` (normalize config on the Python side)

### 3) Python validators
Added `lib/training/predictions_validators.py`:
- `json_parse`: ensure `prediction` parses as JSON
- `json_schema_path`: validate parsed JSON against a JSONSchema file
  - Uses optional dependency `jsonschema` (imported only when this validator is enabled)

### 4) Pipeline wiring + persistence
- `TrainingPredictionsCallback` attaches `predictions_config` onto each sampled item so the generator can run validators without changing the generator signature.
  - File: `lib/training/predictions_callback.py`

- `PredictionsGenerator` runs validators (only when configured) and attaches:
  - `validation_pass`, `validation_kind`, `validation_errors`
  - File: `lib/training/predictions_generator.py`

- `PredictionsWriter` persists these optional fields.
  - File: `lib/training/predictions_writer.py`

- Local ingestion API accepts and inserts the optional validation fields.
  - File: `app/api/training/local/predictions/route.ts`

### 5) Validation summary (per-epoch)
Extended trends aggregation to include `validation_pass_rate` (0..1) when validation exists.

Files:
- `app/api/training/predictions/[jobId]/trends/route.ts`
- `lib/training/types/predictions-types.ts`

## How to enable
In your training config JSON, set validators under `predictions`:

```json
{
  "predictions": {
    "enabled": true,
    "sample_count": 10,
    "sample_frequency": "eval",
    "validators": {
      "json_parse": true,
      "json_schema_path": "/path/to/schema.json"
    }
  }
}
```

Notes:
- If `validators` is omitted, validation is not run and DB columns remain NULL.
- `json_schema_path` implies JSON parsing as a prerequisite.
- If `jsonschema` is not installed and `json_schema_path` is enabled, validation will fail safely (it will never crash training; you’ll see errors in `validation_errors`).
