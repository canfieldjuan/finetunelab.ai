# Predictions Eval Fix Plan – 2025-12-06

## Context
- Training eval-time predictions were not firing reliably due to gating, config validation gaps, dataset format assumptions, and silent local sink failures.
- Scope: SFT path; no changes to other trainer modes yet.

## Planned/Applied Changes (this session)
1) Allow `sample_frequency="eval"` in validation (Python validator + diagnostic script) to match callback capability.
2) Improve diagnostics for local vs cloud output, dataset path fallback (top-level or `data.dataset_path`).
3) Add dataset format support in sampler (JSON array in addition to JSONL) to prevent silent disable.
4) Harden writer in local mode: if API URL/token missing, skip write with explicit warning (no failing POST).
5) SFT gating clarity: resolve dataset_path with fallback, warn when eval-frequency predictions are requested but eval strategy is off or eval set is empty.

## Verification Plan
- Run `python3 lib/training/check_predictions_config.py <config>` with `sample_frequency="eval"` to confirm passes in local and cloud modes depending on env.
- Quick sampler check: JSONL and JSON array fixtures return requested sample_count.
- Short SFT smoke run with eval enabled and eval-frequency predictions: confirm logs show callback attached and generation lines; ensure no warnings about disabled eval.
- If local mode missing API URL/token, expect a single explicit warning and no attempts to POST.

## Follow-ups
- Decide if predictions should be added for DPO/RLHF/ORPO/PPO (currently SFT-only).
- Optional: add opt-in local file fallback sink for predictions if needed.

## Session Update (extended modes)
- Added predictions callback support to DPO and ORPO trainer paths with dataset_path fallback, eval-frequency warnings, and existing gating (JOB_ID, JOB_USER_ID, predictions.enabled, TrainingPredictionsCallback availability).
- Kept SFT logic unchanged; teacher_mode inherits SFT. RLHF/PPO remains unchanged pending callback support validation for PPOTrainer.
