# MCP Chat Route Smoke Plan

## Why this slice exists

The MCP client lane now has per-user toolsets and the chat route can inject authenticated-user MCP tools into model calls. The vLLM tool-use runbook still lists MCP-backed tools as outside the verified portal chat path, so we need a focused route-level smoke that proves `/api/chat` offers a user's MCP tools to the model and dispatches an MCP tool call through the scoped toolset instead of the global portal registry.

## Scope

1. Add a unit smoke for the authenticated `/api/chat` path with one mocked MCP tool.
2. Assert the route passes the MCP tool definition into `unifiedLLMClient.chat`.
3. Assert an MCP tool call runs through `McpUserToolset.execute` and not `executePortalChatTool`.
4. Add a negative route smoke proving body-claimed users without authenticated session context do not get MCP tools.
5. Update the vLLM tool-use runbook so the MCP-backed route smoke is no longer described as unverified.
6. Keep this slice test/runbook only unless the smoke exposes a real route bug.

## Files touched

- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `docs/VLLM_TOOL_USE_TEST_ARC.md`
- `development/planning/2026-06-29_mcp-chat-route-smoke-plan.md`

## Mechanism

The test mocks Supabase auth/session validation, model lookup, MCP toolset construction, and the unified LLM client. The mocked LLM client inspects the offered tool list, invokes the route's `toolCallHandler` with the MCP tool name, and returns a normal non-streaming response. The assertions prove both halves of the route behavior: MCP definitions are offered to the model, and MCP execution stays scoped to the requesting user's toolset. A companion negative request sends only a body-claimed `userId` and asserts MCP discovery/execution stays off.

## Intentional

- The positive smoke uses the normal portal request shape: bearer session auth without `widgetSessionId`. The route intentionally does not load MCP tools from a body-claimed user id or public widget key.
- This does not start vLLM or an MCP server. Live provider/runtime testing remains covered by the probe and future browser smoke.
- The test mocks persistence and trace dependencies so it can stay cheap and deterministic.

## Deferred

- Browser-level SSE/rendering verification for MCP tool calls in the chat UI.
- Live MCP server integration with a real authenticated local session.
- Trace persistence assertions for MCP tool-call spans.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts` passed: 2 tests.
- `npx vitest run app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts lib/chat/__tests__/resolve-chat-user.test.ts lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts lib/tools/__tests__/toolManager.test.ts` passed: 38 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.

## Estimated diff size

Soft cap target: about 400 LOC. Current diff is about 427 insertions; the overage is intentional and comes from route-test mocks needed to keep `/api/chat` deterministic without live Supabase, vLLM, or MCP services plus the added review-requested negative auth-gate case.
