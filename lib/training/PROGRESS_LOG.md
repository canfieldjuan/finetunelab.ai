# Training UI – Progress Log

Date: 2025-10-28

Summary
- Expanded Config Editor with essential SFT knobs: method, logging_steps, eval_steps, FP16/BF16, gradient_checkpointing, optimizer/regularization (optim, weight_decay, max_grad_norm, adam betas/epsilon).
- Added centralized config builder module `lib/training/config-builder.ts` with robust debug logging.
- Integrated builder into Config Editor save path only (non-breaking). No changes to packaging or submit flows yet.
- Maintained backward compatibility. No removal of existing functionality.

Details
- File updated: `components/training/ConfigEditor.tsx`
  - Uses `buildUiConfig` + `validateBeforeUse` prior to saving.
  - Continues to save `config_json` with original schema unless user-set fields are present.
- File added: `lib/training/config-builder.ts`
  - `buildUiConfig(input)` – conservative defaults, no mutation.
  - `normalizeForBackend(config)` – maps training.lora_* → top-level lora when present.
  - `createSubmissionPayload(opts)` – prepares payload for server (not yet integrated).
  - `validateBeforeUse(config)` – wraps existing config validator.

Planned Next Steps (pending approval)
1) Adopt builder in package generation path.
2) Adopt builder in training submit path.
3) Add targeted unit tests for builder normalization/defaults.

2025-10-28 (Continuation)
- Package generation: Added optional normalization flag in generator
  - File updated: `lib/training/local-package-generator.ts`
  - New option: `normalizeForBackend?: boolean` (default false for backward compatibility)
  - If true, writes normalized config.json via `normalizeForBackend()`
- Submission: Added shared payload builder helper
  - File added: `lib/services/training-providers/payload.ts`
  - Exposes `buildTrainingSubmissionPayload()` using centralized builder
- Next adoption steps:
  - Call `generateLocalPackage({ ..., normalizeForBackend: true })` from UI
  - Import `buildTrainingSubmissionPayload` in local provider and use it for POST body

2025-10-28 (Phase 2 backend integration)
- API Route: Download package normalized by default
  - File updated: `app/api/training/[id]/download-package/route.ts`
  - Added log and `normalizeForBackend: true` when calling `generateLocalPackage`
- Local provider: Normalizes request.config before submit
  - File updated: `lib/services/training-providers/local.provider.ts`
  - Imports `normalizeForBackend` and constructs payload with normalized config
  - Added robust logs

Verification Notes
- Hot reload should reflect UI changes; check browser console for `[ConfigBuilder]` logs.
- Save flow will abort with clear error if validation fails before PUT.
