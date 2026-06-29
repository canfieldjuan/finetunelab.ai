# MCP Connection Refresh Boundary Coverage Plan

## Why this slice exists

PR #69 fixed stale process-global MCP connections by refreshing when the
connection-shaping config changes. Its review was LGTM, with two non-blocking
coverage NITs: prove the should-not-reconnect side for display-only name changes,
and prove the stdio reconnect branch. The root cause is not product logic now; it
is missing boundary coverage around the newly added config comparator. This slice
keeps the fix stable before heavier MCP telemetry/SSE work.

## Scope

1. Add a regression proving an HTTP server name-only change reuses the existing
   connection while refreshing cached metadata.
2. Add a regression proving stdio command/args/env changes reconnect the server id.
3. Update the MCP lane log to mark the #69 review NITs as carried into this
   robust-testing slice.

## Files touched

- `lib/tools/mcp/__tests__/client.test.ts`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-connection-refresh-boundary-coverage-plan.md`
- `.agents/session-drift/2026-06-29-mcp-connection-refresh-coverage.md`

## Mechanism

The existing `McpClientManager` tests already mock only the MCP SDK
client/transport and URL guard boundaries. This slice extends that suite. The
name-only test connects once, reconnects with the same URL/auth but a new display
name, asserts no second SDK connection/close, then forces a task-required
`listTools` warning to prove the cached metadata now uses the new name. The stdio
test connects once, reconnects with changed command/args/env, and asserts the old
client closes and the new stdio transport receives the updated config.

## Intentional

- No production code changes are expected.
- This does not start a real MCP stdio process. The external MCP SDK transport is
  the boundary; the real manager behavior is under test.
- The remaining MCP telemetry/SSE follow-ups stay deferred.

## Deferred

- Schema-first telemetry for MCP `tool_executions`.
- Browser-level live SSE verification with a real MCP server.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npm run test:vitest -- lib/tools/mcp/__tests__/client.test.ts --run`
  passed: 17 tests.
- `npm run test:vitest -- lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/client.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run`
  passed: 61 tests.
- `git diff --check` passed.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `npm run build` passed with existing missing-env placeholder/fetch noise.
- After rebasing onto `origin/main` at PR #66's merge, re-ran
  `npm run test:vitest -- lib/tools/mcp/__tests__/client.test.ts --run`;
  passed: 17 tests.

## Estimated diff size

Target: under 120 LOC.
