# vLLM Trained Deploy Runtime Controls Plan

## Why this slice exists

The Add/Edit model flows already expose vLLM tool-call parser, chat template, and Qwen XML fallback settings, and the deploy API can persist and use those fields. The trained-model deploy dialog still only exposes context length and GPU memory controls, so trained deployments cannot configure the same runtime behavior from the UI.

## Scope

1. Add vLLM runtime controls to the trained-model deploy dialog.
2. Send tool-call parser, chat template, template content format, auto tool choice, and Qwen XML fallback settings in trained deployment requests.
3. Reuse the existing vLLM parser/content-format option lists.
4. Keep the change to vLLM-backed deploy paths only.

## Files touched

- `components/training/DeployModelButton.tsx`
- `development/planning/2026-06-28_vllm-trained-deploy-runtime-controls-plan.md`

## Mechanism

`DeployModelButton` keeps local state for the vLLM runtime fields and includes those values in the deployment `config` only when the selected target is vLLM-backed. The UI renders a compact "vLLM Tool Runtime" section for local vLLM and RunPod vLLM pod deploys. The existing deploy route already maps these request fields into server `config_json` and model `metadata.vllm_runtime`, so this slice wires the missing UI surface without adding a backend contract.

## Intentional

- No new deploy-route parser validation in this slice; the route already preserves the known fields and existing tests cover the payload mapping.
- No MCP client or tool execution changes here; this only configures the vLLM runtime that will receive tool-capable requests.
- RunPod serverless is left out because that path uses a different endpoint/template flow and currently registers `supports_functions: false`.

## Deferred

- Provider-specific presets such as "Qwen XML" that set parser, template format, and fallback together.
- Live validation that a configured external vLLM server was started with matching parser/template flags.
- A shared vLLM runtime control component for Add, Edit, and trained Deploy dialogs.

## Verification

- `npm ci` to install this fresh worktree's dependencies before local checks.
- `npm run type-check` passed.
- `npx vitest run app/api/training/deploy/__tests__/route.test.ts lib/services/__tests__/vllm-runtime-config.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts` passed: 11 tests.
- `npm run lint` passed with existing repo warnings and no errors.
- Browser check on `http://localhost:3000/training/monitor` passed: route compiled, auth-required state rendered, body content was nonblank, and no Next.js error overlay was present.

## Estimated diff size

Target: under 180 LOC.
