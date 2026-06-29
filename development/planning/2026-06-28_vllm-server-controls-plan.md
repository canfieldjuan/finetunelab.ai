# vLLM Server Controls Plan

## Why this slice exists

The vLLM backend already has status, stop, and VRAM-safe swap APIs, but the Models page only exposes those controls inside individual model cards. That makes local serving feel opaque when a model is occupying VRAM or when Juan needs to eject the current model before loading another one.

## Scope

1. Add a compact local inference server panel to the Models page.
2. Show active, starting, stopped, and errored vLLM/Ollama server rows with model, endpoint, port, and PID context where available.
3. Reuse existing `/api/servers/stop` and `/api/servers/swap` actions from the panel.
4. Refresh the existing model-card server map after panel actions.

## Files touched

- `app/models/page.tsx`
- `components/models/LocalInferenceServersPanel.tsx`
- `development/planning/2026-06-28_vllm-server-controls-plan.md`
- `.agents/session-drift/2026-06-28-vllm-server-controls.md`

## Mechanism

The Models page already fetches `/api/servers/status`. This slice keeps the existing model-id map for cards and also stores the full server list. A new presentational/action component renders that list as a runtime control panel and calls the existing stop/swap endpoints with the current session token.

## Intentional

- No new backend endpoint in this slice; the backend already has the required lifecycle APIs.
- No global process manager or daemon wrapper yet; this panel manages rows the app already knows about.
- No automatic polling yet; manual refresh and action-triggered refresh are enough for this first control surface.

## Deferred

- vLLM process launcher presets for arbitrary Hugging Face IDs outside saved model rows.
- Live logs or health probe stream for starting servers.
- A dedicated local runtime settings page with executable path, default port range, and GPU policy.

## Verification

- `npm ci` to install this fresh worktree's dependencies before local checks.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- Browser check on `http://localhost:3000/models` passed: route compiled, auth redirect rendered login, no Next.js error overlay, and body content was nonblank.
