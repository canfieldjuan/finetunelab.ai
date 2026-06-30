# MCP Server Controls UI

- Date: 2026-06-29
- Branch: `codex/mcp-server-controls-ui`
- Worktree: `/home/juan-canfield/Desktop/finetunelab.ai-mcp-server-controls-ui`
- Base: `origin/main` at `99eaf06` after PR #76 merged.
- Lane: MCP chat portal controls.
- Scope: expose portal controls for user-owned HTTP MCP servers; display host
  stdio servers read-only; log provider-agnostic local portal tool gaps.
- Active PR: #78 `feat: add MCP server controls UI`
  (`https://github.com/canfieldjuan/finetunelab.ai/pull/78`).
- Decisions:
  - Use the real `McpServerConfigService` in route tests; mock only Supabase auth
    transport, encryption markers, and host env loading.
  - Keep stdio host-config-only. UI/API must not accept `command`, `args`, or
    `env`, and must not expose host command details.
  - Do not add marketing audit/resolution tools to this lane.
  - Defer MCP connection testing to a separate guarded client/discovery slice.
- Commands run:
  - Created fresh worktree from `origin/main`.
  - Read `.github/AI_WORKFLOW.md`, coordination README, MCP service/types/host
    config, Secrets page, Integrations UI, route auth patterns, and MCP gap log.
  - Checked official Open WebUI docs for the provider-agnostic parity inventory.
  - Fast-forwarded to `origin/main` after PR #75 landed; no file overlap.
  - `npm ci` passed.
  - `npm run test:vitest -- app/api/mcp/servers/__tests__/route.test.ts components/settings/__tests__/McpServerManagement.test.tsx app/secrets/__tests__/page.test.tsx --run` passed, 15 tests.
  - `npm run test:vitest -- lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts app/api/mcp/servers/__tests__/route.test.ts --run` passed, 32 tests.
  - `npm run type-check` passed.
  - `npm run lint` passed with 0 errors and existing warnings.
  - `git diff --check` passed.
  - `npm run build` passed with existing missing-env/static-generation warnings.
- Current files planned:
  - `development/planning/2026-06-29_mcp-server-controls-ui-plan.md`
  - `app/api/mcp/servers/auth.ts`
  - `app/api/mcp/servers/route.ts`
  - `app/api/mcp/servers/[id]/route.ts`
  - `app/api/mcp/servers/__tests__/route.test.ts`
  - `components/settings/McpServerManagement.tsx`
  - `components/settings/__tests__/McpServerManagement.test.tsx`
  - `app/secrets/page.tsx`
  - `app/secrets/__tests__/page.test.tsx`
  - `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md`
- Next step: wait for review/check signal from the operator before inspecting,
  fixing, merging, or continuing to another MCP slice.
