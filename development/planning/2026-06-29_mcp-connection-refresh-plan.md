# MCP Connection Refresh Plan

## Why this slice exists

The MCP chat path reuses a process-global `McpClientManager` so repeated chat
requests do not reconnect to the same server on every turn. That reuse currently
keys only on server id: once an id is connected, `connect()` returns immediately
even if the server's resolved URL, auth token, or stdio command config has
changed. The root cause is that cached connection admission checks existence
only, not the transport/auth config that the cached client was opened with. This
slice fixes the root in the client manager rather than patching downstream tool
discovery or chat behavior.

## Scope

1. Teach `McpClientManager.connect()` to reuse a cached connection only when its
   connection-shaping config still matches the requested server config.
2. Reconnect the server id when URL/auth/stdio command config changes.
3. Keep concurrent same-config connects deduped, and handle in-flight
   different-config connects by finishing the stale attempt then refreshing.
4. Guard stale client `onclose` callbacks so closing an old client cannot delete
   a newer connection for the same id.
5. Add focused client-manager regressions for existing-cache and in-flight config
   changes.

## Files touched

- `lib/tools/mcp/client.ts`
- `lib/tools/mcp/__tests__/client.test.ts`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-connection-refresh-plan.md`

## Mechanism

`McpClientManager` will compare the effective connection config for the cached
server id: HTTP transport compares `url` and `authToken`; stdio compares
`command`, `args`, and `env`. A matching connection is reused. A changed
connection is disconnected before a fresh SDK client/transport is opened. The
pending-connect map records the config for the attempt in flight; a second
same-config caller awaits the shared attempt, while a different-config caller
waits for the stale attempt to settle and then calls `connect()` again with the
new config.

## Intentional

- Display-only fields such as server name do not force a reconnect because they
  do not shape the MCP transport. The live connection metadata is still refreshed
  when the connection can be reused.
- This stays inside the client manager. Server CRUD, URL guards, auth resolution,
  tool name generation, and chat route behavior are unchanged.
- The tests mock the external MCP SDK client/transport and URL guard boundaries,
  but exercise the real `McpClientManager`.

## Deferred

- Schema-first telemetry for MCP `tool_executions`.
- Browser-level live SSE verification with a real MCP server.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npm run test:vitest -- lib/tools/mcp/__tests__/client.test.ts --run`
  passed: 15 tests.
- `npm run test:vitest -- lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/client.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run`
  passed: 59 tests.
- `git diff --check origin/main...HEAD` passed.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `npm run build` passed with existing missing-env placeholder/fetch noise.

## Estimated diff size

Target: under 220 LOC including plan/log updates.
