# vLLM Runtime Status Plan

## Why this slice exists

PR #46 made saved local server rows manageable, but the portal still does not say whether vLLM itself is usable from this app process. The existing check endpoint only reports local package availability, even though deployment can also work when `VLLM_EXTERNAL_URL` is configured. That makes the UI misleading in external-runtime mode.

## Scope

1. Extend the vLLM check endpoint with effective readiness and runtime mode.
2. Keep sensitive local paths out of the public response.
3. Show runtime mode/version/configuration in the Models page local runtime panel.
4. Let the deploy button label external mode correctly instead of only showing a local package version.

## Files touched

- `app/api/training/vllm/check/route.ts`
- `components/models/LocalInferenceServersPanel.tsx`
- `components/training/DeployModelButton.tsx`
- `lib/services/vllm-checker.ts`
- `development/planning/2026-06-28_vllm-runtime-status-plan.md`
- `.agents/session-drift/2026-06-28-vllm-runtime-status.md`

## Mechanism

The checker exposes a safe runtime status helper that reports local executable availability, local package version, external URL configuration, cloud runtime detection, and the effective serving mode. The API returns `available` based on the effective mode: external URL configured or local executable found. The Models page panel fetches the same endpoint client-side and renders a compact status band above server rows.

## Intentional

- The endpoint reports booleans and mode names, not raw executable or Python paths.
- External endpoint management remains separate from local process controls.
- The panel fetch is client-side because the Models page is already a client component and the endpoint is used client-side elsewhere.

## Deferred

- Auth-gating the vLLM status endpoint if future responses include sensitive paths.
- Editable runtime settings for executable path, default ports, and GPU policy.
- Live runtime probes against an external endpoint.

## Verification

- `npm ci` to install this fresh worktree's dependencies before local checks.
- `npx vitest run lib/services/__tests__/vllm-checker.test.ts` passed: 2 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- Browser check on `http://localhost:3000/models` passed: route compiled, auth redirect rendered login, no Next.js error overlay, and body content was nonblank.
- Runtime API check on `http://localhost:3000/api/training/vllm/check` returned the new status shape with `mode: "unavailable"` in this environment where neither local vLLM nor `VLLM_EXTERNAL_URL` is configured.
