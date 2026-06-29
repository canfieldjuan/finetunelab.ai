# MCP Tool Execution Telemetry

- Date: 2026-06-29
- Branch: `codex/mcp-tool-execution-telemetry`
- Worktree: `/home/juan-canfield/Desktop/finetunelab.ai-mcp-tool-execution-telemetry`
- Base: `origin/main` after PR #72 merged.
- Lane: MCP chat portal tool reliability / telemetry.
- Scope: version the `tool_executions` schema and log MCP tool calls without
  global `tools` rows.
- Decisions:
  - Keep MCP tools request-scoped; do not upsert MCP tools into the global
    registry or `tools` table.
  - Use a real Postgres migration test because local `psql` and Docker are
    available.
  - Swallow telemetry insert failures so MCP execution is not blocked by
    analytics outages.
- Commands run:
  - `gh pr view 70 ...` confirmed LGTM and green real checks.
  - Merged PR #70 and cleaned its worktree/local branch/remote branch.
  - `git worktree add -b codex/mcp-tool-execution-telemetry ... origin/main`.
  - Traced built-in `tool_executions` logging in `lib/tools/toolManager.ts` and
    MCP dispatch in `app/api/chat/route.ts`.
  - `npm run test:vitest -- app/api/chat/__tests__/route-tool-use-smoke.test.ts app/api/chat/__tests__/route-mcp-tool-use-smoke.test.ts lib/tools/__tests__/toolManager.test.ts --run` passed, 11 tests.
  - `npm run test:vitest -- supabase/migrations/__tests__/tool-executions-schema.test.ts --run` passed, 3 tests.
  - `npm run type-check` passed.
  - `npm run lint` passed with 0 errors and existing warnings.
  - `npm test -- --passWithNoTests` passed, 79 files / 663 tests.
  - `npm run build` passed.
  - `git diff --check` passed.
- Next step: commit, push, open the PR, and stop for review.
