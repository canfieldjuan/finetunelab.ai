# MCP Tool UI Rendering Smoke Plan

## Why this slice exists

PR #63 proves `/api/chat` can offer authenticated-user MCP tools, dispatch MCP calls through the scoped user toolset, and emit non-streaming `tools_metadata`. The remaining vLLM/tool-use runbook gap is the client side: whether the chat UI keeps that metadata visible and renders MCP tool activity as user-readable activity instead of leaking raw internal names like `mcp__docs__lookup`.

## Scope

1. Make chat tool activity labels format MCP names as readable server/tool labels.
2. Add a helper-level test proving MCP `tools_metadata` normalizes into renderable tool activity.
3. Add a MessageList UI smoke proving MCP tool activity renders without raw JSON or raw `mcp__` namespace text.
4. Update the vLLM tool-use runbook to record this UI rendering smoke.
5. Keep this slice UI/test only; no route, MCP server, or provider-runtime behavior changes.

## Files touched

- `components/chat/MessageList.tsx`
- `components/chat/__tests__/MessageList.test.tsx`
- `components/hooks/__tests__/chatToolStream.test.ts`
- `docs/VLLM_TOOL_USE_TEST_ARC.md`
- `development/planning/2026-06-29_mcp-tool-ui-rendering-smoke-plan.md`

## Mechanism

The existing `tools_metadata` client path stores normalized tool calls on the assistant message and `MessageList` renders those calls in the tool activity panel. This slice keeps that path, but formats namespaced MCP tool names by splitting `mcp__<server>__<tool>` into a readable label such as `docs lookup`. Focused tests cover both the normalization helper and the rendered chat surface.

## Intentional

- This does not add a live browser/e2e harness. The route smoke already proves server-side SSE metadata emission; this slice proves the client render contract in deterministic unit/jsdom tests.
- Successful `web_search` activity is still suppressed when search cards render, preserving the existing no-duplicate behavior.
- MCP execution results are not shown in this panel; this slice only renders tool-call status metadata that already exists.

## Deferred

- Browser-level live SSE verification against a running dev server.
- Live MCP server integration with a real authenticated local session.
- Trace persistence assertions for MCP tool-call spans.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run components/hooks/__tests__/chatToolStream.test.ts components/chat/__tests__/MessageList.test.tsx` passed: 10 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.

## Estimated diff size

Target: under 180 LOC.
