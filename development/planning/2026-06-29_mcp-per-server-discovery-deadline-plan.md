# MCP Per-Server Discovery Deadline Plan

## Why this slice exists

The MCP chat route currently wraps the entire `buildUserMcpToolset()` call in one
8 second race. That keeps chat from hanging forever, but it also makes discovery
all-or-nothing at the route level: one slow MCP server can make the route drop
tools discovered from faster servers because the partially built toolset is not
returned before the global deadline. The root cause is that `McpUserToolset.load`
loads servers sequentially without per-server deadlines, leaving the orchestrator
to timebox the whole set.

## Scope

1. Add a per-server MCP discovery timeout inside `McpUserToolset.load`.
2. Load enabled servers in parallel so slow or hung servers do not block fast
   servers.
3. Keep per-server failures non-fatal and preserve scoped tool dispatch by server
   id.
4. Keep the existing route-level timeout as a final backstop, but pass a shorter
   per-server timeout into `buildUserMcpToolset`.
5. Add focused tests proving fast tools survive when another server hangs.

## Files touched

- `lib/tools/mcp/user-toolset.ts`
- `lib/tools/mcp/__tests__/user-toolset.test.ts`
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-per-server-discovery-deadline-plan.md`

## Mechanism

`McpUserToolset.load` will accept an optional `perServerTimeoutMs`. Each server is
loaded through a `loadServer` helper and raced against a timeout promise; the
outer load uses `Promise.all` across servers. A timeout logs and skips only that
server. `buildUserMcpToolset` forwards the option, and `/api/chat` uses a
per-server deadline smaller than the existing total route deadline.

## Intentional

- This does not change MCP transport, auth, URL guards, name generation, or tool
  execution semantics.
- The route-level 8 second guard stays in place as a final defense against DB
  lookups or unexpected code paths that are not covered by per-server loading.
- A timed-out server is skipped for that request only; this slice does not mark
  the server disabled or mutate saved config.

## Deferred

- Refreshing a shared MCP connection when a server URL/auth config changes.
- MCP `tool_executions` telemetry; that table contract is not currently
  versioned in `supabase/migrations`, so it needs a schema-first slice.
- Browser-level live SSE verification with a real MCP server.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npm run test:vitest -- lib/tools/mcp/__tests__/user-toolset.test.ts --run` passed: 7 tests.
- `npm run test:vitest -- app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run` passed: 9 tests.
- `npm run test:vitest -- lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/client.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run` passed: 57 tests.
- `git diff --check origin/main...HEAD` passed.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `npm run build` passed with existing missing-env placeholder/fetch noise.

## Estimated diff size

Target: under 230 LOC including plan/log updates.
