# Tool Config Import/Export/Catalog Plan

## Root Cause

HTTP MCP server management is already in the portal, but every server has to be
entered row-by-row through the form. The missing root contract is a portable,
versioned, token-redacted manifest shape that both API and UI can validate. In
the current state there is no safe way to export a user's configured tool
servers, import a batch of safe HTTP definitions, or start from a small catalog
without hand-editing rows.

The upstream fix is not another prompt or manual convention. It is an API-level
manifest parser/exporter that accepts only user-manageable HTTP MCP server
definitions and structurally rejects executable or host-bound stdio shapes before
any database write.

## Scope

1. Add a versioned MCP server manifest shape for user-managed HTTP servers.
2. Export the authenticated user's HTTP MCP servers without auth tokens.
3. Import one or more HTTP MCP servers from a manifest, updating existing servers
   by name and creating missing servers.
4. Expose a small built-in catalog of safe HTTP MCP server templates that users
   can import without hand-editing rows.
5. Wire the existing MCP settings panel to export, import pasted JSON, and import
   a catalog template.
6. Add focused service/API/UI tests for token redaction, bulk import, catalog
   import, and stdio/command rejection.
7. Update coordination docs with the new API and type contracts.

## Intentional

- Stdio MCP servers remain trusted host config only via `MCP_STDIO_SERVERS`.
- Exported manifests do not include bearer tokens. A manifest may include an
  auth token only when a user intentionally adds one before importing.
- No database migration. The slice builds on the existing `mcp_servers` table.
- No OpenAPI execution surface in this slice. If OpenAPI tool servers become
  first-class later, they should use the same manifest posture: declarative HTTP
  configs may be user-managed; executable host-bound configs stay operator-only.

## Expected Files

- `lib/tools/mcp/server-config.service.ts`
- `lib/tools/mcp/catalog.ts`
- `lib/tools/mcp/types.ts`
- `app/api/mcp/servers/export/route.ts`
- `app/api/mcp/servers/import/route.ts`
- `app/api/mcp/servers/catalog/route.ts`
- `app/api/mcp/servers/__tests__/route.test.ts`
- `components/settings/McpServerManagement.tsx`
- `components/settings/__tests__/McpServerManagement.test.tsx`
- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`

## Verification

- `npm run test:vitest -- app/api/mcp/servers/__tests__/route.test.ts components/settings/__tests__/McpServerManagement.test.tsx lib/tools/mcp/__tests__/server-config.service.test.ts --run` - passed, 3 files / 32 tests.
- `npm run type-check` - passed.
- `npm run lint` - passed with 0 errors and the existing 244-warning backlog.
- `git diff --check` - passed.
- `npm run build` - passed. Existing browser data staleness and static-generation logs printed; build exited 0 and listed `/api/mcp/servers/catalog`, `/api/mcp/servers/export`, and `/api/mcp/servers/import`.
- `npm test` - passed, 103 files / 921 tests. Existing transient Postgres restart/NOTICE noise printed; Vitest exited 0.
- Review follow-up: `POST /api/mcp/servers/import` now disconnects imported
  server ids from the shared MCP client manager after successful DB writes so
  disables, URL changes, and token rotations take effect without process restart.
  Verified with:
  - `npm run test:vitest -- app/api/mcp/servers/__tests__/route.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts components/settings/__tests__/McpServerManagement.test.tsx --run` - passed, 3 files / 32 tests.
  - `npm run type-check` - passed.
  - `npm run lint` - passed with 0 errors and the existing 244-warning backlog.
  - `git diff --check` - passed.
