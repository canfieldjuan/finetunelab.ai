# MCP Server Controls UI Plan

## Why this slice exists

The MCP client is now usable from authenticated chat, but there is no portal
surface for a user to add, disable, edit, or remove their HTTP MCP servers. The
root gap is a missing management layer over the already-landed `mcp_servers`
service: users can benefit from MCP tools only after an operator or SQL path
creates rows for them. This slice fixes that root for user-safe HTTP servers and
keeps stdio host-managed by construction.

The user also asked what provider-agnostic local-chat-portal tools are still
missing relative to Open WebUI. This plan logs that inventory without adding
marketing audit/resolution tools, which are explicitly deferred.

## Scope

1. Add authenticated MCP server API routes for user-owned HTTP MCP server list,
   create, update, and delete operations.
2. Surface an MCP server management panel on the existing Secrets/Integrations
   portal page.
3. Show host-managed stdio MCP servers as read-only active servers without
   exposing command, args, or env.
4. Update the MCP/tool gap log with a provider-agnostic local portal inventory.
5. Add focused API/component/page tests for the new controls.
6. Address review feedback around route-level SSRF proof, host namespace
   collisions, owner-scoped 404s, generic internal errors, and cached MCP
   disconnects on disable/delete.

## Files touched

- `app/api/mcp/servers/auth.ts`
- `app/api/mcp/servers/route.ts`
- `app/api/mcp/servers/[id]/route.ts`
- `app/api/mcp/servers/__tests__/route.test.ts`
- `components/settings/McpServerManagement.tsx`
- `components/settings/__tests__/McpServerManagement.test.tsx`
- `app/secrets/page.tsx`
- `app/secrets/__tests__/page.test.tsx`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-server-controls-ui-plan.md`
- `.agents/session-drift/2026-06-29-mcp-server-controls-ui.md`

## Mechanism

The API routes authenticate with the caller's Supabase bearer token, then pass
that RLS-scoped client into the real `McpServerConfigService`. The routes accept
only HTTP server fields and reject stdio command-shaped payloads before reaching
the service. Token values are write-only; responses use `McpServerSummary`.

The UI fetches `/api/mcp/servers`, renders configured HTTP servers with edit,
enable/disable, and delete controls, and renders host stdio servers in a read-only
section. Stdio command details remain server-only.

Review follow-up keeps the durable rules in `McpServerConfigService`: host stdio
namespaces are reserved, HTTP URLs are capped and SSRF-guarded before DB writes,
and owner-scoped update/delete misses become a typed not-found error. The by-id
routes translate that error to 404, avoid returning raw internal error strings,
and disconnect the shared MCP client manager after a successful disable or delete
so stale sessions do not stay alive in memory.

## Intentional

- No user-editable stdio controls. Stdio MCP servers execute host commands and
  remain `MCP_STDIO_SERVERS` only.
- No connection test button in this slice. A reliable probe should reuse the MCP
  guarded client/discovery path and get its own focused testable slice.
- No marketing audit/resolution tools. The gap log is limited to generic local
  chat portal capabilities.
- Supabase placeholder auth constants remain unchanged in this review fix to
  avoid changing dev/test auth behavior outside the reviewed route/service
  boundary.

## Deferred

- MCP connection-test/discovery preview button.
- Per-model/per-chat MCP tool enablement controls.
- Code interpreter, per-chat file attachments, URL fetch, artifacts, task
  automations, and other Open WebUI-style generic capabilities logged as future
  work.

## Verification

- `npm ci` - passed. Existing peer/deprecation/audit warnings printed.
- `npm run test:vitest -- app/api/mcp/servers/__tests__/route.test.ts components/settings/__tests__/McpServerManagement.test.tsx app/secrets/__tests__/page.test.tsx --run` - passed, 21 tests.
- `npm run test:vitest -- lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts app/api/mcp/servers/__tests__/route.test.ts --run` - passed, 38 tests.
- `npm run type-check` - passed.
- `npm run lint` - passed with 0 errors and existing warnings.
- `git diff --check` - passed.
- `npm run build` - passed. Existing missing-env/static-generation warnings printed, but the build exited 0 and included `/api/mcp/servers` and `/api/mcp/servers/[id]`.

## Estimated diff size

Expected: 11 files, roughly +750 / -5. Actual after implementation: 11 files,
roughly +1,300 / -0, mostly because the component and API tests cover create,
toggle, delete, token redaction, stdio rejection, and host stdio read-only
display rather than only the happy path.
