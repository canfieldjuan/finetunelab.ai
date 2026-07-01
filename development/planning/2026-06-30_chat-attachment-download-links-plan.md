# Chat Attachment Download Links Plan

## Why this slice exists

The attachment UI now renders compact chips, but attached files are inspect-only:
users can see a filename and size without any safe way to reopen the private
file. The root cause is that per-chat storage is intentionally private and the
chip renderer has no authenticated signed-download path.

This slice adds the smallest useful follow-up: persisted attachment chips request
a short-lived signed URL through an authenticated route, then open that URL. It
does not make storage public and does not add rich previews.

## Scope

- Ownership lane: chat portal attachments
- Slice phase: Product polish

1. Add an authenticated signed-download action to `/api/chat/attachments`.
2. Scope signed URL creation by verified Supabase user and attachment id.
3. Render a download/open affordance on persisted attachment chips only.
4. Add route and component tests for the signed-download path.

### Files touched

- `.github/ai-coordination/API_COORDINATION.md`
- `.github/ai-coordination/TYPES_COORDINATION.md`
- `app/api/chat/attachments/route.ts`
- `app/api/chat/attachments/__tests__/route.test.ts`
- `components/chat/AttachmentChips.tsx`
- `components/chat/__tests__/MessageList.test.tsx`
- `lib/chat/attachments.ts`
- `development/planning/2026-06-30_chat-attachment-download-links-plan.md`
- `.agents/session-drift/2026-06-30-chat-attachment-download-links.md`

## Mechanism

`GET /api/chat/attachments?attachmentId=<uuid>` verifies the bearer session,
loads the attachment row with the service-role client scoped by `user_id` and
`id`, rejects deleted or missing rows, and returns a short-lived Supabase Storage
signed URL. `AttachmentChips` uses the existing client Supabase session to call
that route, then opens the returned URL.

## Intentional

- No public hrefs in rendered message markup; downloads require the current
  Supabase session token.
- No rich preview surface in this slice. The chip affordance proves private file
  reopening without designing a document viewer.
- Pending composer attachments do not get download buttons because their useful
  action remains remove/retry before send.

## Deferred

- Rich attachment previews.
- Signed URL expiry/refresh UI.
- Durable artifact panel that groups generated and attached files together.

## Verification

- `npm run test:vitest -- app/api/chat/attachments/__tests__/route.test.ts components/chat/__tests__/MessageList.test.tsx --run` - passed, 32 tests after review fixes.
- `npm run type-check` - passed.
- `git diff --check` - passed.
- `npm run lint` - passed with existing repo warnings.
- `npm test` - passed, 94 files / 831 tests.
- `npm run build` - passed.

## Estimated diff size

- Estimate: about 450 inserted lines across API/helper/UI tests plus coordination docs.
- Note: above the initial 250 LOC target because the safe download path requires both server authorization coverage and client behavior coverage in the same slice.
