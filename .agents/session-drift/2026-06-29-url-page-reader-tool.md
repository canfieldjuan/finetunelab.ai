# URL Page Reader Tool

- Date: 2026-06-29
- Branch: `codex/url-page-reader-tool`
- Worktree: `/home/juan-canfield/Desktop/finetunelab.ai-url-page-reader-tool`
- Base: `origin/main` at `6b0bda8` after PR #77 merged.
- Lane: provider-agnostic local chat portal parity, issue #79.
- Scope: add the least-lift backlog item, a direct URL/page reader portal tool.
- Active PR: #81 - https://github.com/canfieldjuan/finetunelab.ai/pull/81
- Decisions:
  - Start from `origin/main`, not PR #78, so this slice does not depend on the
    MCP server controls UI review.
  - Use the real `ContentService`; tests mock axios and DNS only.
  - Extract the shared URL/IP safety primitive so MCP and `read_url` do not
    maintain separate SSRF allowlists.
  - Disable redirects in the public URL fetch path to avoid redirect-to-private
    SSRF.
  - Pin the validated DNS result into the axios request lookup to close the
    rebinding TOCTOU called out in review.
  - Bound public URL response bytes and reject non-HTML content before parsing.
  - Preserve content-service truncation metadata so `read_url` reports original
    cleaned length and service-level truncation correctly.
  - Keep `read_url` default-off behind `TOOL_URL_READER_ENABLED=true`.
  - Do not edit `PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md` in this PR because
    #78 already edits it; GitHub issue #79 is the canonical backlog log.
- Commands run:
  - Created fresh worktree from `origin/main`.
  - Created GitHub issue #79 for the ordered generic local portal backlog.
  - Read registry/tool manager, web-search tool/content service, route tool-call
    handling, and related tests.
  - `npm ci` (passed with existing dependency/audit warnings).
  - `npm run test:vitest -- lib/tools/url-reader/__tests__/tool.test.ts lib/tools/__tests__/registry-sync.test.ts --run` (2 files, 8 tests passed).
  - Review read at PR #81 head `1b92b0d`; actionable MAJORs: DNS rebinding,
    unbounded response read, duplicated SSRF guard; minor default-on/config
    listing mismatch.
  - `npm run test:vitest -- lib/tools/url-reader/__tests__/tool.test.ts lib/tools/__tests__/registry-sync.test.ts lib/tools/__tests__/toolManager.test.ts lib/tools/mcp/__tests__/url-guard.test.ts --run` (4 files, 32 tests passed).
  - `npm run type-check` (passed).
  - `npm run lint` (passed with 0 errors, existing warnings).
  - `git diff --check` (passed).
  - `npm run build` (passed; registry logged `read_url v1.0.0`).
- Current files planned:
  - `development/planning/2026-06-29_url-page-reader-tool-plan.md`
  - `.agents/session-drift/2026-06-29-url-page-reader-tool.md`
  - `lib/tools/url-reader/index.ts`
  - `lib/tools/url-reader/__tests__/tool.test.ts`
  - `lib/tools/url-safety.ts`
  - `lib/tools/web-search/content.service.ts`
  - `lib/tools/config.ts`
  - `lib/tools/toolManager.ts`
  - `lib/tools/mcp/url-guard.ts`
  - `lib/tools/registry.ts`
  - `lib/tools/registry-sync.ts`
  - `lib/tools/__tests__/registry-sync.test.ts`
  - `lib/tools/__tests__/toolManager.test.ts`
  - `supabase/migrations/20260629235500_seed_read_url_tool.sql`
- Next step: push the review fix, update PR body, then stop for re-review.
