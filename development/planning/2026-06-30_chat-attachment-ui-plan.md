# Chat Attachment UI Plan

## Why this slice exists

PR #85 added the authenticated chat attachment backend contract, but the live
chat portal still has no way to select files, upload them before a turn, pass the
resulting `attachmentIds` to `/api/chat`, or show which files were attached to a
message. The root cause is that the UI send path remains text-only even though
the route contract now supports one-turn attachment ids.

This slice fixes that root in the portal UI: selected files become uploaded
pending attachments, successful uploads are sent by id with the next chat turn,
and message rendering hydrates compact attachment metadata from persisted
message metadata.

## Scope

- Ownership lane: chat portal attachments
- Slice phase: Vertical slice

1. Add attachment selection controls to the existing chat input.
2. Upload selected files through the real `/api/chat/attachments` route before
   sending the chat turn.
3. Send only uploaded attachment ids in `/api/chat` JSON.
4. Keep send blocked while an attachment upload is in flight or failed.
5. Render compact attachment chips on messages from both optimistic state and
   persisted metadata.

### Files touched

- `components/chat/ChatInput.tsx`
- `components/chat/AttachmentChips.tsx`
- `components/chat/MessageList.tsx`
- `components/chat/types.ts`
- `components/Chat.tsx`
- `components/hooks/useChat.ts`
- `components/hooks/useMessages.ts`
- `components/hooks/chatMessageMetadata.ts`
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-tool-use-smoke.test.ts`
- `lib/chat/attachments.ts`
- `lib/chat/attachment-limits.ts`
- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`
- `components/chat/__tests__/MessageList.test.tsx`
- `components/hooks/__tests__/chatMessageMetadata.test.ts`
- `components/hooks/__tests__/useChat.mcp-sse.test.tsx`
- `components/hooks/__tests__/useMessages.test.ts`

## Mechanism

`useChat` owns the pending attachment state because it already owns the active
conversation, auth session, send state, and `/api/chat` request body. `ChatInput`
receives callbacks and renders the file picker/chips. File bytes are uploaded to
`POST /api/chat/attachments`; the chat request body includes only the returned
attachment ids.

Compact DTOs are displayed through a shared chip renderer in `MessageList`.
Persisted metadata hydration is extended so loaded messages can display the same
compact attachment DTOs that the assistant streaming path already saves.

## Intentional

- No signed download links or rich previews in this slice; chips prove the
  one-turn attachment path without exposing private storage URLs.
- No widget/demo attachments; the backend contract intentionally requires an
  authenticated non-widget conversation.
- The client duplicates no server parser logic. Shared limits live in a tiny
  constants module so the browser bundle does not import server-only parser and
  storage code.

## Deferred

- Promote an attached file into the durable knowledge graph.
- Signed download links and richer previews.
- Vision-capable image attachment flow.
- Per-chat artifact panel.

## Verification

- `npm run test:vitest -- components/hooks/__tests__/useChat.mcp-sse.test.tsx components/chat/__tests__/MessageList.test.tsx components/hooks/__tests__/chatMessageMetadata.test.ts components/hooks/__tests__/useMessages.test.ts app/api/chat/attachments/__tests__/route.test.ts --run` - 5 files, 37 tests passed after review follow-up.
- `npm run test:vitest -- components/hooks/__tests__/useChat.mcp-sse.test.tsx app/api/chat/__tests__/route-tool-use-smoke.test.ts --run` - 2 files, 27 tests passed after regenerate replay and restore-race review follow-up.
- `npm run type-check` - passed.
- `npm run lint` - passed with existing repo warnings only.
- `git diff --check` - passed.
- `npm test` - 93 files, 823 tests passed after regenerate replay and restore-race review follow-up.
- `npm run build` - passed after regenerate replay and restore-race review follow-up.
- Review follow-up coverage: uploaded attachment delete failures preserve the
  server attachment for retry, and saved assistant message replacement preserves
  rendered attachment chips.
- Review follow-up coverage: uploaded draft attachments restore from
  `chat_attachments` after reload, and attachment removal is disabled/guarded
  while a send is in flight.
- Review follow-up coverage: regenerate-style sends can explicitly skip composer
  drafts, SSE `{ "error": ... }` events fail the send path so draft chips stay
  visible, and `/api/chat` releases attachment claims on streaming error/cancel
  even after output has started.
- Review follow-up coverage: regenerate-style sends skip unrelated upload/failed
  draft guards when they are explicitly not consuming pending attachments.
- Review follow-up coverage: regeneration replays the historical user message's
  original attachment ids while preserving unrelated composer drafts; the file
  picker also accepts `.markdown` and the client size-limit copy reads from the
  shared limit label.
- Review follow-up coverage: regeneration now sends historical attachment ids
  through a replay-only route path that reuses already-attached rows without
  claiming/finalizing them again, and uploaded-draft restore suppresses duplicate
  chips while a local upload/delete is in flight.

## Estimated diff size

- About 19 files including plan/coordination docs. This is over the original target
  because the UI slice includes hook state, live composer wiring, metadata
  hydration, shared chip rendering, server stream-claim lifecycle follow-up, and
  regression coverage in one vertical path. Current PR diff from merge-base is
  19 files, +1897 / -71.
