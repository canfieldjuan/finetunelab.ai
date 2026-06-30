# Chat Attachments Plan

## Why this slice exists

`PROJECT_LOGS/CHAT_PORTAL_TOOL_GAPS_LOG.md` marks **per-chat file attachments** as
one of the remaining Open WebUI-like chat portal gaps. The root cause is not a
missing button: the chat contract is text-only. Existing upload flows either
create durable GraphRAG knowledge-base documents or training datasets, so there
is no authenticated, private, message-scoped attachment object that `/api/chat`
can verify, persist, render, and inject into one turn.

This slice should fix that upstream contract first. Once the route can accept
verified attachment ids and include bounded extracted content, the UI can safely
offer attachment controls without turning every file into a global knowledge-base
document.

## Existing surfaces traced

- `components/chat/ChatInput.tsx` accepts text, STT controls, stop/send only.
- `components/hooks/useChat.ts` sends JSON to `/api/chat` with `messages`, tools,
  conversation/model ids, and flags; no attachment payload exists.
- `app/api/chat/route.ts` receives `ChatMessage[]` and enhances text with memory,
  conversation history, GraphRAG, tools, and metadata.
- `components/chat/types.ts` has no first-class message attachment type.
- `app/api/graphrag/upload/route.ts` + `lib/graphrag/service/document-service.ts`
  already validate/upload/parse supported document and code files, but those
  uploads create durable `documents` rows and process into GraphRAG.
- `lib/graphrag/schema.sql` has a `documents` table and private `documents`
  bucket policies; this is knowledge-base storage, not per-chat storage.

## Implemented first slice

1. Add a versioned migration for private chat attachments.
   - `chat_attachments` table:
     - `id uuid primary key`
     - `user_id uuid not null`
     - `conversation_id uuid not null`
     - `message_id uuid null` so files can be uploaded before the user message
       row exists, then attached after send
     - `filename text not null`
     - `content_type text`
     - `size_bytes integer not null`
     - `storage_bucket text not null default 'chat-attachments'`
     - `storage_path text not null`
     - `kind text not null` such as `text`, `document`, `code`, `image`,
       `unknown`
     - `extracted_text text null`
     - `extracted_chars integer default 0`
     - `status text not null` such as `uploaded`, `attached`, `deleted`
     - `metadata jsonb not null default '{}'::jsonb`
     - timestamps
   - Add indexes for `user_id`, `conversation_id`, `message_id`, and `created_at`.
   - Add RLS so users can only select/insert/update/delete their own rows.
   - Add a private `chat-attachments` storage bucket with folder ownership
     policies matching the existing `documents` / `chat-images` pattern.

2. Add `/api/chat/attachments`.
   - `POST` accepts `multipart/form-data` with `file` and `conversationId`.
   - Auth must be a verified Supabase session, matching `/api/graphrag/upload`.
   - Verify the conversation belongs to the authenticated user before upload.
   - Validate size, extension, MIME, and count limits.
   - Upload to `chat-attachments/{userId}/{conversationId}/{attachmentId}/...`.
   - For text/code/docs, reuse existing GraphRAG parser primitives to extract
     text, then store a bounded `extracted_text` preview for chat injection.
   - Return a compact attachment DTO: id, filename, contentType, sizeBytes, kind,
     extractedChars, status.

3. Extend `/api/chat` with attachment ids.
   - Request body gets `attachmentIds?: string[]` for the current user message.
   - Server loads those ids with service role only after verifying the session
     user and conversation ownership.
   - Reject attachments not owned by the user, not in the conversation, deleted,
     or over per-turn limits.
   - Inject bounded text into the prompt with clear source labels after GraphRAG
     enhancement so the attachment context is not overwritten.
   - Mark accepted attachment rows as `attached`. `message_id` remains nullable in
     this slice because regular portal user messages are currently persisted by
     the client outside `/api/chat`.
   - Persist compact attachment metadata on assistant messages for traceability.

4. UI wiring follow-up.
   - Add an attachment icon button to `ChatInput` and selected-file chips above
     the input.
   - Upload selected files before send; only send attachment ids to `/api/chat`.
   - Keep send disabled while attachment upload is pending.
   - Render user-message attachment chips in `MessageList` or the message body
     component.

## Scope boundaries

- Do not ingest per-chat attachments into GraphRAG by default.
- Do not add code execution or filesystem browsing.
- Do not send image bytes to models in this slice. Images are not accepted by
  the upload route yet; model vision input belongs to the separate multimodal
  input gap.
- Do not support public/widget chat attachments until the authenticated path is
  proven; widget API keys are public and should not grant private file upload.

## Security and limits

- Authentication: verified Supabase session only.
- Ownership: attachment, conversation, and eventual message must share the same
  `user_id`.
- Storage: private bucket; no public URLs; signed URLs only if a render path needs
  them.
- Implemented limits:
  - max 5 files per chat turn
  - max 10 MB per file
  - max 20,000 extracted chars per file
  - max 40,000 injected chars per chat turn
  - allowed extensions for slice 1: `txt`, `md`, `pdf`, `docx`, `ts`, `tsx`,
    `js`, `jsx`, `py`
- Prompt injection: include filename and bounded extracted text as data, not as
  instructions. Keep a clear delimiter around file content.

## Tests

- Migration/schema test:
  - table exists with nullable `message_id`
  - RLS policies and indexes exist
  - storage bucket/policy SQL is idempotent
- `/api/chat/attachments` route tests:
  - rejects missing/invalid auth
  - rejects a conversation owned by another user
  - rejects disallowed type and oversize files
  - uploads and extracts a text/code file
- `/api/chat` route tests:
  - rejects attachment ids from another user or conversation
  - injects bounded attachment text into the model messages
  - marks accepted rows as `attached`
  - does not load attachments for unsupported modes
- Client tests:
  - deferred to UI slice
  - `useChat` sends attachment ids with the user turn
  - selected attachment chips can be removed before send
  - send waits for uploads to finish

## Follow-ups

- Promote an attached file to the durable knowledge graph on explicit user action.
- Rich attachment previews and signed download links.
- Vision-capable model path for image attachments.
- Per-chat artifact panel that can show generated/attached files together.
