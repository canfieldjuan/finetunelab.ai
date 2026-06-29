# Snippet Revision Engine Plan

## Why this slice exists

Juan wants the portal to target arbitrary snippets of text before adding marketing-specific copy tools. The first step should be data-agnostic: a deterministic text revision engine that can apply model-proposed edits to plain text safely, previewably, and without knowing whether the source is a blog post, prompt, report, note, or marketing draft.

## Scope

1. Add a pure `lib/snippet-revision` module for text-only revision operations.
2. Support exact search/replace targets for model-proposed snippet edits.
3. Support explicit range replacement for UI-selected text snippets.
4. Return structured preview/apply results with original text, replacement text, changed range, updated text, and an unchanged flag.
5. Reject stale, missing, ambiguous, reversed, overlapping, or out-of-bounds targets with clear error codes.
6. Keep this slice independent from chat tools, model prompts, file writes, product/marketing rules, and UI.

## Files touched

- `lib/snippet-revision/index.ts`
- `lib/snippet-revision/__tests__/snippet-revision.test.ts`
- `development/planning/2026-06-29_snippet-revision-engine-plan.md`

## Mechanism

The module exposes `applySnippetRevision(sourceText, revision)` and `previewSnippetRevision(sourceText, revision)`. Search/replace revisions require the `find` text to appear exactly once, including overlapping occurrences, which protects against ambiguous model edits. Range replacements use zero-based inclusive/exclusive offsets plus the originally selected text, which is the shape a text-selection UI can produce later while still rejecting stale offsets. Both modes flow through the same result builder so downstream UI can render one consistent preview contract.

## Intentional

- No marketing-specific language, keyword preservation, brand rules, or readability logic in this slice.
- No filesystem writes. The engine only transforms strings; future API/UI slices decide where text comes from and whether edits are saved.
- No unified-diff parser yet. Search/replace and range edits cover the safest first workflow for prose snippets.

## Deferred

- Chat/tool integration that lets a model propose structured snippet revisions.
- UI for selecting text, previewing a before/after diff, and accepting/rejecting revisions.
- Markdown-aware section targeting by heading.
- Readability and marketing/copywriting presets.
- File-backed save/apply flow for local documents.

## Verification

- `npm ci` installed this fresh worktree's dependencies.
- `npx vitest run lib/snippet-revision/__tests__/snippet-revision.test.ts` passed: 11 tests.
- `npm run type-check` passed.
- `npm run lint` passed with existing repo warnings and no errors.
- `git diff --check` passed.

## Estimated diff size

Current diff: 3 files, +375 / -0. This stays under the 400 LOC soft cap; the size comes from keeping the engine small while covering the stale, missing, ambiguous, invalid-range, insertion, preview, and apply behaviors in explicit unit tests.
