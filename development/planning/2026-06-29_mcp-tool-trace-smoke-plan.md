# MCP Tool Trace Smoke Plan

## Why this slice exists

PR #63 proves authenticated-user MCP tools are offered and executed through `/api/chat`, and PR #64 proves that MCP tool activity renders cleanly in chat. The remaining verified gap in this vLLM/MCP lane is observability: the route has tool-span tracing code, but the smoke suite does not yet pin that MCP tool calls create a child span and close it with structured tool input/output metadata.

## Scope

1. Extend the MCP `/api/chat` route smoke with assertions for MCP tool-call trace child-span creation.
2. Assert the MCP tool span is closed as completed with structured input, output, and metadata.
3. Update the vLLM tool-use runbook so route-level MCP trace span coverage is recorded.
4. Keep this slice test/runbook only unless the smoke exposes a real route bug.

## Files touched

- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `docs/VLLM_TOOL_USE_TEST_ARC.md`
- `development/planning/2026-06-29_mcp-tool-trace-smoke-plan.md`

## Mechanism

The existing MCP route smoke already mocks `startTrace`, `createChildSpan`, and `endTrace`. This slice uses those mocks in the authenticated MCP execution test: the mocked LLM invokes the route-level `toolCallHandler`, the route dispatches the MCP tool through the scoped `McpUserToolset`, then the test asserts the trace service received a `tool.mcp__docs__lookup` child span and a completed `endTrace` payload that includes the MCP arguments, tool description, execution status, and result metadata.

## Intentional

- This tests route-level trace service calls, not live database trace persistence.
- This does not add browser/e2e trace verification. The route smoke is the cheapest place to prove the tool span contract without starting Supabase, vLLM, or an MCP server.
- The assertions avoid exact timing values because execution time is runtime-dependent.

## Deferred

- Live DB-backed trace persistence verification for MCP tool calls.
- Browser-level live SSE/rendering verification against a running dev server.
- Live MCP server integration with a real authenticated local session.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts` passed: 2 tests.
- `npx vitest run app/api/chat/__tests__/route-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts` passed: 3 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `git diff --check` passed.

## Estimated diff size

Target: under 100 LOC.
