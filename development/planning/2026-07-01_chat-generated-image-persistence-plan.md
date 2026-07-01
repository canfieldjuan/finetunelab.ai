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

Review follow-up root cause: the first persistence pass stored the generated
image's display URL as if it were durable. For ComfyUI results that URL is a
seven-day Supabase signed URL; the durable storage path already existed on the
job but was not emitted to the chat client. This update fixes the root by
streaming `storagePath`, persisting it in message metadata, and re-signing it
when history loads.

## Scope

- Ownership lane: chat portal image generation results
- Slice phase: Vertical slice

1. Persist an `image_complete` SSE result as an assistant chat message for
   authenticated, non-anonymous conversations.
2. Persist ComfyUI image messages with durable `generated_image.storage_path`
   metadata and plain fallback text instead of an expiring signed URL.
3. Re-sign persisted generated-image storage paths on message-history load.
4. Keep anonymous/widget flows unchanged: they still render the image locally
   without database writes.
5. Replace the local image message id with the persisted database id when the
   insert succeeds.
6. Queue image-result persistence behind the normal assistant text row so reload
   order matches live order, and persist to the originating conversation even if
   the user navigates away before the image finishes.
7. Add focused hook and service coverage for the real image-result flow.

### Files touched

- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`
- `app/api/image/stream/route.ts`
- `app/api/image/stream/__tests__/route.test.ts`
- `components/hooks/chatMessageMetadata.ts`
- `components/hooks/__tests__/chatMessageMetadata.test.ts`
- `components/hooks/useChat.ts`
- `components/hooks/__tests__/useChat.mcp-sse.test.tsx`
- `components/hooks/useMessages.ts`
- `components/hooks/__tests__/useMessages.test.ts`
- `lib/tools/image-gen/image-job-service.ts`
- `lib/tools/image-gen/__tests__/image-job-service.test.ts`
- `development/planning/2026-07-01_chat-generated-image-persistence-plan.md`
- `.agents/session-drift/2026-07-01-chat-image-generation-result-ui.md`

## Mechanism

`image-job-service` and `/api/image/stream` now include `storagePath` on
completed ComfyUI image events. `useChat` renders the immediate signed URL
optimistically for the active conversation, but persists a `messages` row with
plain fallback content plus `metadata.generated_image.storage_path`. Generated
image rows are queued until the normal assistant text row finishes persistence,
so history ordering stays stable. If the user switches conversations before the
image completes, the hook skips local append but still writes the result to the
originating conversation.

`useMessages` hydrates generated-image metadata during history load. If a
persisted row has `storage_path`, it asks Supabase Storage for a fresh signed URL
and rebuilds markdown display content; if re-signing fails, the fallback text
remains visible instead of rendering a broken stale URL. Unsplash results, which
do not have private storage paths, keep their permanent CDN URL in metadata and
content.

## Intentional

- No gallery, artifact panel, or richer generated-image card in this slice.
- No retry queue for failed message persistence; the image still renders
  immediately in the live chat if the insert fails.
- No new image proxy endpoint; the existing owner-scoped Supabase Storage policy
  lets the browser client re-sign the user's own generated image path.

## Deferred

- Persisting `image_failed` terminal events.
- Richer generated-image metadata for future artifact panels beyond the durable
  path/source/attribution fields needed for reload.
- Image result polish such as download controls, gallery grouping, or progress
  cards.
- Hardening around duplicate terminal events beyond the existing job-subscription
  dedupe.

## Verification

- `npm run test:vitest -- components/hooks/__tests__/useChat.mcp-sse.test.tsx components/hooks/__tests__/useMessages.test.ts components/hooks/__tests__/chatMessageMetadata.test.ts app/api/image/stream/__tests__/route.test.ts lib/tools/image-gen/__tests__/image-job-service.test.ts --run` — 38 tests passed.
- `npm run type-check` — passed.
- `npm run lint` — passed with existing warning debt (0 errors, 245 warnings).
- `npm test` — 101 files / 899 tests passed. Local Postgres restart/NOTICE logs were emitted, but Vitest exited 0.
- `git diff --check` — passed.
- `npm run build` — passed. Build emitted existing missing-env placeholder logs during static generation, but exited 0.

## Estimated diff size

- Current: review update touches stream contract, metadata hydration, hook
  persistence ordering, focused tests, and coordination docs. Over the original
  target because the MAJOR review showed the persistence contract needed both
  write-time durable metadata and read-time re-signing to be real.
