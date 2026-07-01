# Chat Generated Image Persistence Plan

## Why this slice exists

The chat image-generation lane can already start a `generate_image` job and
stream the completed image back to the browser. The result is currently only
appended to local React state. If the user reloads the conversation or opens it
from history, the generated image is gone even though the job succeeded.

Root cause: the async image-result stream bypasses the existing assistant
message persistence path. This slice fixes the root in safe scope by writing
completed image results into the same `messages` table used by normal assistant
responses.

## Scope

- Ownership lane: chat portal image generation results
- Slice phase: Vertical slice

1. Persist an `image_complete` SSE result as an assistant chat message for
   authenticated, non-anonymous conversations.
2. Keep anonymous/widget flows unchanged: they still render the image locally
   without database writes.
3. Replace the local image message id with the persisted database id when the
   insert succeeds.
4. Add focused hook coverage for the real `useChat` image-result flow.

### Files touched

- `components/hooks/useChat.ts`
- `components/hooks/__tests__/useChat.mcp-sse.test.tsx`
- `development/planning/2026-07-01_chat-generated-image-persistence-plan.md`
- `.agents/session-drift/2026-07-01-chat-image-generation-result-ui.md`

## Mechanism

`useChat` already opens `/api/image/stream` after the chat route emits an
`image_generation_started` event. On `image_complete`, the hook builds the same
markdown image content it renders today. The change routes that content through a
small helper: append the optimistic assistant image message immediately, then,
when `user`, `activeId`, and `allowAnonymous` permit persistence, insert a
`messages` row with `role = 'assistant'` and the generated markdown content. On
success, the optimistic image message is replaced with the returned row while
preserving the no-judgment UI flag.

## Intentional

- No gallery, artifact panel, or richer generated-image card in this slice.
- No retry queue for failed message persistence; the image still renders
  immediately in the live chat if the insert fails.
- No change to ComfyUI/Unsplash generation, storage, or signed URL behavior.

## Deferred

- Persisting `image_failed` terminal events.
- Structured generated-image metadata for future artifact panels.
- Image result polish such as download controls, gallery grouping, or progress
  cards.
- Hardening around duplicate terminal events beyond the existing job-subscription
  dedupe.

## Verification

- `npm run test:vitest -- components/hooks/__tests__/useChat.mcp-sse.test.tsx --run` — 12 tests passed.
- `npm run type-check` — passed.
- `npm run lint` — passed with existing warning debt (0 errors, 245 warnings).
- `npm test` — 101 files / 893 tests passed.
- `git diff --check` — passed.
- `npm run build` — passed. Build emitted existing missing-env placeholder logs during static generation, but exited 0.

## Estimated diff size

- Current: 3 tracked files, about +127/-5 LOC plus this plan doc.
