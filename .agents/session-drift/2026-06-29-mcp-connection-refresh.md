# MCP Connection Refresh

- Date: 2026-06-29
- Branch: `codex/mcp-connection-refresh`
- Worktree: `/home/juan-canfield/Desktop/finetunelab.ai-mcp-connection-refresh`
- Base: `origin/main` after PR #67 and #68 were merged.
- PR: #69, https://github.com/canfieldjuan/finetunelab.ai/pull/69
- Lane: MCP chat portal tool reliability.
- Scope: refresh the process-global MCP client connection when a server id's
  resolved URL/auth/stdio command config changes.
- Decisions:
  - Keep the fix in `McpClientManager`; server CRUD and chat routing are not the
    root cause.
  - Mock only the MCP SDK client/transport and URL guard boundaries in tests.
- Commands run so far:
  - `gh pr view 68 ...` and `gh pr view 67 ...` before merge.
  - `git worktree add -b codex/mcp-connection-refresh ... origin/main`.
  - `npm ci` completed with existing peer/deprecation/vulnerability warnings.
  - `npm run test:vitest -- lib/tools/mcp/__tests__/client.test.ts --run`
    passed: 15 tests.
  - `npm run test:vitest -- lib/tools/mcp/__tests__/adapter.test.ts lib/tools/mcp/__tests__/client.test.ts lib/tools/mcp/__tests__/server-config.service.test.ts lib/tools/mcp/__tests__/url-guard.test.ts lib/tools/mcp/__tests__/user-toolset.test.ts --run`
    passed: 59 tests.
  - `git diff --check origin/main...HEAD` passed.
  - `npm run type-check` passed.
  - `npm run lint` passed with existing repo warnings and no errors.
  - `npm run build` passed with existing missing-env placeholder/fetch noise.
  - Opened PR #69.
- Next step: wait for review on PR #69.
