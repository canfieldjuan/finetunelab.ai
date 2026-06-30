# URL Page Reader Tool Plan

## Why this slice exists

GitHub issue #79 orders the provider-agnostic local chat portal backlog from
least lift to most. The first post-MCP item is a direct URL/page reader: today
the portal can search the web, but it does not expose a clear "read this exact
URL" tool distinct from search. The root gap is not content extraction itself
because `ContentService` already exists; the gap is a safe, portal-registered
tool surface around that existing fetch/clean primitive.

This PR is over the normal small-slice budget because the usable surface is
indivisible: the tool registration, public-URL safety guard, DB-backed tool
seed, and real-tool regression tests need to ship together for the portal to
expose the tool safely. Review then found reachable SSRF/DoS gaps before merge,
so this same PR also closes those root issues rather than shipping a default-on
fetch surface.

## Scope

1. Add a `read_url` portal tool that fetches readable text from a specific
   public web page URL.
2. Reuse the existing web-search `ContentService` instead of adding a second
   HTML parser/fetch adapter.
3. Add a guarded content-service path for user-supplied URLs: public http(s)
   validation, DNS public-address validation, and no redirect following.
4. Register the tool in the registry and portal allowlist.
5. Add an idempotent seed migration so the DB-backed chat tool list has the
   new tool row ready for operators to enable after deploy.
6. Add focused tests that mock only network/DNS transport boundaries.
7. Fix review findings: pin the validated DNS address into the request lookup,
   bound response bytes before buffering/parsing, reject non-HTML content on the
   public URL path, reuse one URL/IP safety primitive with MCP, and make the
   tool explicit opt-in until operators enable it.
8. Preserve content-service truncation metadata so `read_url` reports page
   truncation against the original cleaned text length, not only its own
   `maxCharacters` cap.

## Files touched

- `lib/tools/config.ts`
- `lib/tools/toolManager.ts`
- `lib/tools/registry.ts`
- `lib/tools/registry-sync.ts`
- `lib/tools/mcp/url-guard.ts`
- `lib/tools/url-reader/index.ts`
- `lib/tools/url-reader/__tests__/tool.test.ts`
- `lib/tools/url-safety.ts`
- `lib/tools/web-search/content.service.ts`
- `lib/tools/__tests__/registry-sync.test.ts`
- `lib/tools/__tests__/toolManager.test.ts`
- `supabase/migrations/20260629235500_seed_read_url_tool.sql`
- `development/planning/2026-06-29_url-page-reader-tool-plan.md`
- `.agents/session-drift/2026-06-29-url-page-reader-tool.md`

## Mechanism

`read_url` validates the requested URL with the shared public-target checks now
used by MCP HTTP servers, resolves the host to catch private/internal DNS
results, pins those validated addresses into the axios request `lookup`, then
calls `ContentService.fetchAndCleanOrThrow(..., { publicOnly: true, lookup })`.
The public-only fetch disables redirects, bounds response bytes with
`maxContentLength`/`maxBodyLength`, and rejects non-HTML content before parsing.
The content service exposes cleaned-content metadata for this caller, so the
tool returns a bounded structured payload with URL, extracted content, original
cleaned length, returned length, and a `truncated` flag that includes both
service-level and tool-level truncation.

## Intentional

- This is not broad search; the tool reads one explicit URL.
- `read_url` is registered but default-off behind `TOOL_URL_READER_ENABLED=true`
  because it fetches model/user supplied URLs.
- No per-chat attachment storage, artifact rendering, or browsing history is
  added here.
- URL safety errors are surfaced as `UrlReader` validation/execution errors
  even though the core URL/IP allowlist is shared with MCP.

## Deferred

- Rich card rendering for `read_url` results.
- Follow-up issue #79 items: tool bindings, import/export, per-chat
  attachments, multimodal input, artifacts, automations, code sandbox, and
  workspace filesystem.

## Verification

- `npm run test:vitest -- lib/tools/url-reader/__tests__/tool.test.ts lib/tools/__tests__/registry-sync.test.ts lib/tools/__tests__/toolManager.test.ts lib/tools/mcp/__tests__/url-guard.test.ts --run` - 4 files, 32 tests passed.
- `npm run type-check` - passed.
- `npm run lint` - passed with 0 errors and the existing warning backlog.
- `git diff --check` - passed.
- `npm run build` - passed; build logs include `ToolRegistry` registering `read_url v1.0.0`.

## Estimated diff size

Actual: 14 files, +859 / -101.
