# MCP Live SSE Verification Plan

## Why this slice exists

The MCP lane now has per-user discovery, scoped chat dispatch, rendered tool
activity, connection refresh, and `tool_executions` telemetry. The remaining gap
in `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md` is proof that the chat stream works
against a real MCP server rather than only mocked `McpUserToolset` objects. The
root risk is a test-boundary gap: the route tests verify orchestration, but they
mock the exact adapter/client boundary that can fail when the SDK stdio transport,
tool discovery, callTool normalization, route SSE metadata, and client stream
parser compose.

## Scope

1. Add a tiny tracked stdio MCP fixture server using the official SDK server API.
2. Add a `/api/chat` smoke test that mocks auth/model/database boundaries but uses
   the real MCP client manager, user toolset, adapter, and stdio transport.
3. Add a hook-level browser smoke proving streamed MCP `tools_metadata` survives
   chunked SSE parsing into the assistant message state.
4. Update the MCP lane log and session handoff note.

## Files touched

- `lib/tools/mcp/__tests__/fixtures/stdio-docs-server.mjs`
- `app/api/chat/__tests__/route-mcp-live-stdio-sse.test.ts`
- `components/hooks/__tests__/useChat.mcp-sse.test.tsx`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-live-sse-verification-plan.md`
- `.agents/session-drift/2026-06-29-mcp-live-sse-verification.md`

## Mechanism

The route smoke imports the real chat route after mocking non-MCP side effects.
`McpServerConfigService.listEnabledServers` returns one stdio server whose command
is `process.execPath` and whose script is the fixture MCP server. The real
`buildUserMcpToolset()` connects to that process, lists its `lookup` tool, injects
`mcp__docs__lookup`, and the mocked unified model calls the provided
`toolCallHandler`. The test then reads the returned SSE stream and asserts the
live fixture result, `tools_metadata`, and telemetry row.

The hook smoke runs in `jsdom`, mocks `fetch` with a chunked `ReadableStream`, and
asserts that `useChat` stores streamed MCP tool metadata on the assistant message.

## Intentional

- This is not a full Playwright login test. It is the narrowest reliable proof of
  the browser stream parser plus a real MCP SDK stdio server in the API path.
- Supabase/auth/model calls remain mocked because the slice is about MCP/SSE
  composition, not external services.
- The stdio fixture is host-controlled test code and writes no user data or
  secrets.

## Deferred

- Manual browser testing with an operator-configured MCP server, if needed after
  this hermetic smoke.
- HTTP MCP live server coverage; stdio is the riskiest composition path because
  it spawns a child process and owns the host-command boundary.

## Verification

- `npm run test:vitest -- app/api/chat/__tests__/route-mcp-live-stdio-sse.test.ts components/hooks/__tests__/useChat.mcp-sse.test.tsx --run` - passed, 2 tests.
- `npm run test:vitest -- app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-live-stdio-sse.test.ts components/hooks/__tests__/chatToolStream.test.ts components/hooks/__tests__/sseStream.test.ts components/hooks/__tests__/useChat.mcp-sse.test.tsx lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/client.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run` - passed, 74 tests.
- `npm run type-check` - passed.
- `npm run lint` - passed with 0 errors and existing warnings.
- `npm test -- --passWithNoTests` - passed, 81 files / 665 tests. Existing Postgres fixture shutdown notices printed during migration tests, but the run exited 0.
- `git diff --check` - passed.
- `npm run build` - passed. Existing missing-env/static-generation warnings printed, but the run exited 0.

## Estimated diff size

Expected: 6 files, roughly +350 / -5. Actual after implementation: 6 files,
roughly +630 / -0, mostly route-test scaffolding plus the fixture server.
