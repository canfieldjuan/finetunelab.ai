# Chat Tool Use API Smoke Plan

## Why this slice exists

PR #56 logged that the vLLM probe proves the direct OpenAI-compatible adapter path, but it does not prove the portal chat route. The next useful slice is a narrow `/api/chat` smoke that exercises the non-streaming tool-aware route contract: selected registry model, offered tool definitions, route-level tool execution, SSE tool metadata, and final content.

## Scope

1. Add a unit-level `/api/chat` smoke for tool-enabled registry-model requests.
2. Mock external model/tool side effects while keeping the route branch real.
3. Assert the SSE stream includes model metadata, tool metadata, final content, and `[DONE]`.
4. Update the vLLM tool-use runbook to name this new smoke as the API-level coverage.

## Files touched

- `app/api/chat/__tests__/route-tool-use-smoke.test.ts`
- `docs/VLLM_TOOL_USE_TEST_ARC.md`
- `development/planning/2026-06-28_chat-tool-use-api-smoke-plan.md`

## Mechanism

The test imports the real chat route after module mocks are registered. It sends a normal-mode request with a registry `modelId`, one calculator tool definition, and `contextInjectionEnabled: false` so the test does not depend on GraphRAG or user context. The mocked unified client calls the provided `toolCallHandler`, which exercises the route's tool execution path, then returns a tool-aware response. The test reads the returned event stream and validates the metadata/events.

## Intentional

- This is not a live vLLM test; live model behavior stays in `probe:vllm-tools`.
- The test does not persist conversations or traces; those are still separate deeper slices.
- MCP is still deferred because MCP-backed tools need their own chat-route injection smoke.

## Deferred

- Browser-level chat UI smoke for rendered tool metadata and final answer.
- `/api/chat` smoke for MCP-backed per-user tools.
- Persistence assertions for messages, traces, and tool-call records.

## Verification

- `npm ci` to install this fresh worktree's dependencies before local checks.
- `npx vitest run app/api/chat/__tests__/route-tool-use-smoke.test.ts` passed: 1 test.
- `npx vitest run app/api/chat/__tests__/route-tool-use-smoke.test.ts lib/llm/__tests__/unified-client.test.ts lib/llm/adapters/__tests__/openai-adapter.test.ts` passed: 5 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- After PR #59 landed, rebased onto `origin/main` and reran:
  - `npm run test:vitest -- app/api/chat/__tests__/route-tool-use-smoke.test.ts --reporter=dot` passed: 1 test.
  - `git diff --check` passed.
  - `npm run type-check` passed.
  - `npm run lint` passed with existing repo warnings and no errors.

## Estimated diff size

Target: under 260 LOC.
