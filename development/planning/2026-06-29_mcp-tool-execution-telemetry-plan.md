# MCP Tool Execution Telemetry Plan

## Why this slice exists

MCP tool calls are now offered, executed, traced, and rendered in chat, but they
still bypass the `tool_executions` table because they intentionally have no
global `tools` row. Built-in portal tools log through `executePortalChatTool`;
MCP tools route through the per-user `McpUserToolset` and return before any
database telemetry is written. The root cause is that the telemetry contract is
tied to a non-null global `tool_id`, and the table shape is not versioned in
`supabase/migrations`. This slice fixes the root by versioning the table contract
first and making `tool_id` nullable for scoped/non-global tool sources.

## Scope

1. Add an idempotent `tool_executions` migration that captures the current
   built-in row shape and adds a source discriminator for `portal` vs `mcp`.
2. Allow `tool_id` to be null so MCP rows do not need global `tools` entries.
3. Add a shared logging helper in `toolManager` and keep built-in portal logging
   on the same helper.
4. Log MCP tool calls from `/api/chat` after scoped MCP execution, including
   success and failure rows.
5. Add focused tests for the migration contract, the helper row shape, and the
   MCP route telemetry path.

## Files touched

- `supabase/migrations/20260629223000_create_tool_executions.sql`
- `supabase/migrations/__tests__/tool-executions-schema.test.ts`
- `lib/tools/toolManager.ts`
- `lib/tools/__tests__/toolManager.test.ts`
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts`
- `hooks/useTools.ts`
- `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- `development/planning/2026-06-29_mcp-tool-execution-telemetry-plan.md`
- `.agents/session-drift/2026-06-29-mcp-tool-execution-telemetry.md`

## Mechanism

The migration creates `public.tool_executions` if it is missing, adds
`tool_source` and `metadata`, makes `tool_id` nullable, and adds indexes/RLS for
owner-readable rows. `recordToolExecution` writes the common row shape without
throwing on insert errors. `executeTool` delegates its existing built-in logging
to that helper with `tool_source = 'portal'`. The chat route calls the same helper
for MCP tool calls with `tool_id = null`, `tool_source = 'mcp'`, and metadata
that marks the tool as MCP-scoped.

## Intentional

- This does not write MCP tools to the global `tools` table. Per-user MCP tools
  remain request-scoped.
- This does not build an analytics UI for MCP rows; it makes the canonical
  telemetry table contain them so existing consumers can see the executions.
- Telemetry insert failures are logged and swallowed, matching the non-blocking
  behavior of tracing failures.

## Deferred

- Browser-level live SSE verification with a real MCP server.
- Rich MCP telemetry dimensions such as resolved server id/name; the current
  `McpUserToolset` keeps those private and this slice logs the namespaced tool
  name plus MCP source without expanding that API.

## Verification

- `npm run test:vitest -- app/api/chat/__tests__/route-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts lib/tools/__tests__/toolManager.test.ts --run` - passed, 11 tests.
- `npm run test:vitest -- supabase/migrations/__tests__/tool-executions-schema.test.ts --run` - passed, 3 real Postgres tests.
- `npm run type-check` - passed.
- `npm run lint` - passed with 0 errors and existing warnings.
- `npm test -- --passWithNoTests` - passed, 79 files / 663 tests.
- `npm run build` - passed.
- `git diff --check` - passed.

## Estimated diff size

Expected: about 10 files, roughly +700 / -30. This is over the initial target
because the root fix is schema-first and the migration test uses a real
Docker-backed Postgres harness, matching the existing model-serving migration
test shape instead of mocking the database contract.
