# Snippet Revision API Plan

## Why this slice exists

PR #75 added the data-agnostic snippet revision engine, but it is only usable from local TypeScript imports. The next slice needs a small API boundary so future UI, chat-tool, and document workflows can submit arbitrary text plus a structured snippet revision and receive a safe preview/apply result without knowing engine internals.

## Scope

1. Add a deterministic `POST /api/snippet-revision` route.
2. Accept `action: "preview" | "apply"`, `sourceText`, and a snippet revision payload.
3. Validate request shape and size before calling the engine.
4. Return engine success or safe engine rejection as normal JSON result state.
5. Add route contract tests for preview, apply, malformed input, and stale/ambiguous engine rejection behavior.
6. Keep this slice independent from chat tools, model calls, persistence, file writes, UI, readability, and marketing presets.

## Files touched

- `app/api/snippet-revision/route.ts`
- `app/api/snippet-revision/__tests__/route.test.ts`
- `development/planning/2026-06-29_snippet-revision-api-plan.md`

## Mechanism

The route validates a plain JSON request, enforces conservative text-size limits, narrows the revision union, then calls `previewSnippetRevision` or `applySnippetRevision`. Malformed request payloads return HTTP 400. Engine-level failures like `target_ambiguous` or `target_mismatch` return HTTP 200 with `result.ok === false`, because those are expected product states for a future preview/accept UI rather than transport failures.

## Intentional

- No auth gate in this slice: the endpoint performs pure in-memory string transformation, does not call a model, and does not read or write user data. A future UI/API integration can wrap this behind app auth if needed.
- No persistence or file writes. `apply` means "return the transformed text and mark the result applied"; it does not save anything.
- No model-facing schema/tool registration yet. The API only exposes the deterministic engine boundary.

## Deferred

- UI for selecting snippets, previewing changes, and accepting/rejecting revisions.
- Chat/tool integration that lets a model propose structured snippet revisions.
- Markdown-aware section targeting by heading.
- Readability and marketing/copywriting presets.
- File-backed save/apply flow for local documents.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run app/api/snippet-revision/__tests__/route.test.ts` passed: 5 tests.
- `npx vitest run lib/snippet-revision/__tests__/snippet-revision.test.ts app/api/snippet-revision/__tests__/route.test.ts` passed: 16 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `git diff --check` passed.

## Estimated diff size

Current diff: 3 files, +378 / -0. This stays under the 400 LOC soft cap; the size comes from adding the route validation boundary plus contract tests for preview, apply, malformed input, safe engine rejection, and size limits.
