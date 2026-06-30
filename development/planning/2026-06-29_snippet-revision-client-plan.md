# Snippet Revision Client Plan

## Why this slice exists

PR #75 added the pure snippet revision engine and PR #77 exposed it through `POST /api/snippet-revision`. The next slice should keep UI work thin by adding a small client helper that knows how to call the API, parse normal engine results, and surface validation/transport failures consistently.

## Scope

1. Add a reusable `requestSnippetRevision` helper for `preview` and `apply` calls.
2. Preserve the same data-agnostic request shape used by the API route.
3. Return the engine's `SnippetRevisionResult` directly for UI consumers.
4. Validate successful response payloads deeply enough to protect downstream preview rendering.
5. Add a typed `SnippetRevisionApiError` for HTTP, API validation, network, and malformed-response failures.
6. Add unit tests with injected fetchers so no browser or network dependency is required.
7. Keep this slice independent from UI, chat tools, model calls, persistence, file writes, readability, and marketing presets.

## Files touched

- `lib/snippet-revision/client.ts`
- `lib/snippet-revision/__tests__/client.test.ts`
- `development/planning/2026-06-29_snippet-revision-client-plan.md`

## Mechanism

The helper posts JSON to `/api/snippet-revision` by default and accepts optional `fetcher`, `endpoint`, and `signal` overrides. Successful API responses must contain a valid `SnippetRevisionResult`, including the required `change` fields for successful revisions; that result is returned as-is so future UI can branch on `result.ok`. Non-2xx responses are normalized into `SnippetRevisionApiError` with status, code, and optional details.

## Intentional

- No React hook in this slice. A pure helper is easier to test and can be used by a future hook, editor component, or chat tool.
- No auth behavior here; callers can use the browser's normal same-origin credentials behavior or wrap `fetcher` later.
- No marketing/copywriting defaults. This remains text-edit infrastructure.

## Deferred

- UI for selecting snippets, previewing changes, and accepting/rejecting revisions.
- React hook/state wrapper around the helper if the first UI needs one.
- Chat/tool integration that lets a model propose structured snippet revisions.
- Markdown-aware section targeting by heading.
- Readability and marketing/copywriting presets.
- File-backed save/apply flow for local documents.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run lib/snippet-revision/__tests__/client.test.ts` passed: 8 tests.
- `npx vitest run lib/snippet-revision/__tests__/snippet-revision.test.ts app/api/snippet-revision/__tests__/route.test.ts lib/snippet-revision/__tests__/client.test.ts` passed: 24 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `git diff --check` passed.

## Estimated diff size

Current diff: 3 files, +384 / -0. This stays under the 400 LOC soft cap; the size comes from the helper, typed error class, response guards, and eight unit tests covering success, safe engine rejection, API validation, network failure, malformed success payloads, and the exported error class.
