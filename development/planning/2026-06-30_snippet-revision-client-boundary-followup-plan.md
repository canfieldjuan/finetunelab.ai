# Snippet Revision Client Boundary Follow-up Plan

## Why this slice exists

PR #80 merged the snippet revision client helper after fixing payload-shape validation, but a late Codex review landed while the merge was already in flight. The three new findings are legitimate boundary gaps: successful responses are validated as self-contained objects, but the client does not confirm they match the original request action or source text, and abort cancellations are wrapped as generic network failures.

Root cause: `requestSnippetRevision` treated a structurally valid `SnippetRevisionResult` as sufficient runtime proof. This fixes the root at the client response boundary by validating successful payloads against the submitted request context and by separating abort cancellation from transport failure.

## Scope

1. Reject successful response ranges whose `change.end` exceeds `request.sourceText.length`.
2. Reject successful response payloads whose `applied` flag does not match `request.action`.
3. Map fetch/body aborts to a distinct `request_aborted` client error code.
4. Keep engine failures (`ok: false`) as return values when their code is valid.
5. Add focused client tests through the real helper with only the fetch transport mocked.
6. Update API coordination notes for the snippet revision client contract.

## Files touched

- `lib/snippet-revision/client.ts`
- `lib/snippet-revision/__tests__/client.test.ts`
- `.github/ai-coordination/API_COORDINATION.md`
- `development/planning/2026-06-30_snippet-revision-client-boundary-followup-plan.md`

## Mechanism

The client result guard will accept the original request as context. For successful results, it will verify that the returned `change` fits within `sourceText`, that `change.original` and `updatedText` are coherent with the submitted source and replacement, and that `applied` matches whether the request was `apply` or `preview`. Abort errors from either `fetch` or JSON body reading will surface as `SnippetRevisionApiError` with `code: 'request_aborted'`.

## Intentional

- This remains a pure client helper slice; no UI, hook, chat tool, or persistence behavior changes.
- Tests continue to mock only the transport boundary (`fetcher` / response body), not the client validator.
- No endpoint changes are needed because the official route already returns context-consistent results.

## Deferred

- UI-specific cancellation behavior, such as ignoring stale preview aborts in a component, remains deferred until the snippet revision UI exists.
- Version-tolerant cross-deployment compatibility remains deferred; this app currently ships the client and route together.

## Verification

- `npm ci` installed dependencies in the fresh worktree.
- `npm run test:vitest -- lib/snippet-revision/__tests__/client.test.ts --run` passed: 19 tests.
- `npm run test:vitest -- lib/snippet-revision/__tests__/snippet-revision.test.ts app/api/snippet-revision/__tests__/route.test.ts lib/snippet-revision/__tests__/client.test.ts --run` passed: 35 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and 0 errors.
- `git diff --check` passed.
- `npm run build` passed.

## Estimated diff size

Current diff: 4 files, about +300 / -9 before final commit metadata. The slice is above the initial estimate because the API coordination contract was updated alongside the code and the tests cover both positive and negative request-context cases.
