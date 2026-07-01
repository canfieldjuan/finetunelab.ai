# API Coordination

**Purpose:** Document all API endpoints, contracts, and integration points between backend and frontend.

**Models Using This:** Claude (backend), Copilot (frontend)

---

## 🚧 Current Work

### In Progress

**Snippet Revision Client Boundary Follow-up**
- **Started:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/snippet-revision-client-boundary-followup`
- **Work:** Harden `requestSnippetRevision` successful-response validation against request context and preserve abort cancellation as a distinct client error.
- **Files:**
  - Client: `lib/snippet-revision/client.ts`
  - Tests: `lib/snippet-revision/__tests__/client.test.ts`

**Chat Vision Attachments**
- **Started:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-vision-attachments`
- **Work:** Accept byte-validated image uploads as private chat attachments and add model input image parts only when the selected model config advertises `supports_vision`; non-vision models ignore image payloads and continue with text. Vision requests now have image-specific byte caps and image-aware context preflight.
- **Plan:** `development/planning/2026-06-30_chat-vision-attachments-plan.md`
- **Endpoints affected:** `POST /api/chat/attachments`, `POST /api/chat` with `attachmentIds`
- **Files:**
  - API: `app/api/chat/attachments/route.ts`, `app/api/chat/route.ts`
  - Service/adapters: `lib/chat/attachments.ts`, `lib/chat/attachment-limits.ts`, `lib/llm/openai.ts`, `lib/llm/adapters/openai-adapter.ts`, `lib/llm/adapters/anthropic-adapter.ts`, `lib/llm/adapters/ollama-adapter.ts`, `lib/llm/adapters/runpod-adapter.ts`, `lib/llm/adapters/huggingface-adapter.ts`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`, `app/api/chat/__tests__/route-tool-use-smoke.test.ts`, `lib/llm/adapters/__tests__/openai-adapter.test.ts`, `lib/llm/adapters/__tests__/ollama-adapter.test.ts`, `lib/llm/adapters/__tests__/anthropic-adapter.test.ts`, `lib/llm/adapters/__tests__/runpod-adapter.test.ts`, `lib/llm/adapters/__tests__/huggingface-adapter.test.ts`, `lib/llm/__tests__/unified-client.test.ts`

**Chat Attachment UI Wiring**
- **Started:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-attachment-ui`
- **Work:** Wire the live chat composer to upload selected files through `POST /api/chat/attachments`, send only returned `attachmentIds` to `/api/chat`, block send while uploads are pending/failed, and render compact attachment chips from optimistic and persisted metadata.
- **Plan:** `development/planning/2026-06-30_chat-attachment-ui-plan.md`
- **Endpoints consumed:** `POST /api/chat/attachments`, `DELETE /api/chat/attachments`, `POST /api/chat` with `attachmentIds`
- **Files:**
  - UI: `components/Chat.tsx`, `components/chat/AttachmentChips.tsx`, `components/chat/ChatInput.tsx`, `components/chat/MessageList.tsx`
  - Hook/metadata: `components/hooks/useChat.ts`, `components/hooks/useMessages.ts`, `components/hooks/chatMessageMetadata.ts`
  - Shared limits/types: `lib/chat/attachment-limits.ts`, `components/chat/types.ts`
  - Tests: `components/hooks/__tests__/useChat.mcp-sse.test.tsx`, `components/chat/__tests__/MessageList.test.tsx`, `components/hooks/__tests__/chatMessageMetadata.test.ts`, `components/hooks/__tests__/useMessages.test.ts`

**Chat Attachment Signed Downloads**
- **Started:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-attachment-download-links`
- **Work:** Add a private signed-download action for persisted chat attachment chips without making storage objects public.
- **Plan:** `development/planning/2026-06-30_chat-attachment-download-links-plan.md`
- **Endpoints consumed:** `GET /api/chat/attachments?attachmentId=<uuid>`
- **Files:**
  - API: `app/api/chat/attachments/route.ts`
  - Service: `lib/chat/attachments.ts`
  - UI: `components/chat/AttachmentChips.tsx`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`, `components/chat/__tests__/MessageList.test.tsx`

### Recently Completed

**Chat Attachments Backend Contract**
- **Completed:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-attachments-plan`
- **Work:** Implemented authenticated per-chat attachment APIs for the chat portal.
- **Plan:** `development/planning/2026-06-29_chat-attachments-plan.md`
- **Endpoints:** `POST /api/chat/attachments`, `DELETE /api/chat/attachments`, `POST /api/chat` with `attachmentIds`
- **Files:**
  - API: `app/api/chat/attachments/route.ts`, `app/api/chat/route.ts`
  - Service/types: `lib/chat/attachments.ts`
  - Migration: `supabase/migrations/20260630000000_create_chat_attachments.sql`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`, `app/api/chat/__tests__/route-tool-use-smoke.test.ts`, `supabase/migrations/__tests__/chat-attachments-schema.test.ts`

**Chat Attachment Upload Hardening**
- **Completed:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-attachment-hardening`
- **Work:** Stacked follow-up on PR #85 that requires bounded upload bodies before multipart parsing and bounds attachment text extraction before UI drives regular uploads.
- **Files:**
  - API: `app/api/chat/attachments/route.ts`
  - Service: `lib/chat/attachments.ts`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`

**Training Statistics API**
- **Completed:** 2025-12-19
- **Models:** Claude (backend) + Copilot (frontend)
- **Branch:** Merged to main
- **Files:**
  - Backend: `app/api/training/stats/route.ts`
  - Frontend: `components/training/TrainingStatsBadge.tsx`

---

## 📋 API Endpoint Contracts

### Chat Attachment APIs

#### POST /api/chat/attachments

**Purpose:** Upload a private file for use as bounded context in a single authenticated chat turn.

**Authentication:** Required Supabase bearer session. Widget/API-key mode is not supported for attachments.

**Request:** `multipart/form-data`
```typescript
{
  file: File;              // txt, md, pdf, docx, ts, tsx, js, jsx, py, png, jpg/jpeg, webp, gif
  conversationId: string;  // UUID, must belong to the authenticated user
}
```

**Response (201):**
```typescript
{
  success: true;
  attachment: {
    id: string;
    filename: string;
    contentType: string | null;
    sizeBytes: number;
    kind: "text" | "document" | "code" | "image" | "unknown";
    extractedChars: number;
    status: "uploaded" | "attaching" | "attached" | "deleted";
  };
}
```

**Limits:** 10 MB generic file cap, 4 MB per image file, 12 MB total image bytes per vision turn, 11 MB multipart request pre-parse ceiling including envelope overhead, valid bounded `Content-Length` required before `request.formData()`, 15s extraction timeout, 50 MB DOCX uncompressed-entry ceiling, 5 uploaded attachments per turn candidate, 20,000 extracted chars stored per file.

**Extraction timeout behavior:** The 15s timeout starts before DOCX archive inspection and parser invocation. Timeout aborts the route operation, closes/destroys the owned DOCX ZIP/read streams, and passes an `AbortSignal` into the parser factory for cooperative pre/post checks. Current third-party parser libraries (`pdf-parse`, `mammoth`) do not expose mid-parse cancellation, so parser work that is already inside those libraries may finish before the cooperative post-call check rejects the result.

**MIME behavior:** Extension validation is authoritative for code/text attachments. TypeScript `.ts` files may arrive as `video/mp2t` from common upload environments and are accepted as code after extension validation. Image uploads accept `image/png`, `image/jpeg`, `image/webp`, and `image/gif`; upload handling validates PNG/JPEG/WebP/GIF magic bytes, derives the real image MIME for octet-stream uploads, stores empty extracted text, and does not pass image rows through document parsers.

**Write ownership:** Attachment row and storage mutations are server-owned through the upload/chat routes. Authenticated clients may read their own rows/files but must not insert, update, or delete `chat_attachments` rows directly. Upload row creation goes through `create_chat_attachment_with_capacity`, which serializes per-user/conversation inserts with an advisory transaction lock before enforcing the five-`uploaded` cap.

#### DELETE /api/chat/attachments

**Purpose:** Clear uploaded attachments that were selected but abandoned before a chat turn is sent, so pending rows do not permanently count against the per-turn upload capacity.

**Authentication:** Required Supabase bearer session. Widget/API-key mode is not supported for attachments.

**Request:**
```typescript
{
  conversationId: string;  // UUID
  attachmentIds: string[]; // max 5, must still be status "uploaded"
}
```

**Response (200):**
```typescript
{
  success: true;
  deletedIds: string[];
}
```

**Behavior:** The route verifies the authenticated user, marks only still-`uploaded` rows in that conversation as `deleted`, and removes the private storage objects best-effort after the database transition. Rows already `attaching`/`attached` are refused.

#### GET /api/chat/attachments

**Purpose:** Create a short-lived signed download URL for a private chat attachment that is already visible on a persisted message chip.

**Authentication:** Required Supabase bearer session. Widget/API-key mode is not supported for attachment downloads.

**Request:** query string
```typescript
{
  attachmentId: string; // UUID
}
```

**Response (200):**
```typescript
{
  success: true;
  url: string;              // 60-second Supabase Storage signed URL
  expiresInSeconds: 60;
  attachment: {
    id: string;
    filename: string;
  };
}
```

**Behavior:** The route verifies the authenticated user, validates `attachmentId` before querying UUID columns, loads the row with a service-role query scoped by `user_id` and `id`, rejects missing or deleted rows, and calls Supabase Storage `createSignedUrl` with `download: filename`. The UI must fetch this endpoint with the current Supabase session token and open the returned URL; rendered chips must not expose public storage hrefs.

#### POST /api/chat attachmentIds

**Purpose:** Let an authenticated chat turn reference uploaded per-chat attachments by id.

**Request addition:**
```typescript
{
  attachmentIds?: string[]; // UUIDs, max 5, same user and conversation as the request
}
```

**Behavior:**
- Only honored for verified, non-widget chat requests with a real `conversationId`.
- Rejects malformed non-UUID attachment ids and attachment-bearing conversation ids as client 400s before querying UUID columns.
- Loads with a service-role query scoped by `user_id`, `conversation_id`, and requested ids.
- Rejects missing, deleted, already-attached, cross-user, or cross-conversation attachment ids before the model call.
- Appends delimited attachment text to the latest user message after GraphRAG enhancement.
- Image attachments are not injected as text. When the selected model config has `supports_vision: true`, the route counts image payloads in the context-length guard using `max(512, ceil(bytes / 1024))` per image, enforces the 4 MB per-image and 12 MB per-turn image byte budgets before private download/model execution, then downloads the private storage object server-side and appends image parts to the latest user message for the model call. When the model is not vision-capable or the capability is unknown, image payloads are ignored for model input and the text turn still proceeds.
- Image download or byte-validation failures during model part construction are best-effort skipped after preflight, so transient storage failures do not fail the entire text turn.
- OpenAI-compatible providers receive multimodal `content` parts, Anthropic receives image blocks converted from data URLs, RunPod preserves multimodal array content in its OpenAI-compatible request, and Ollama receives native base64 `images` arrays. Provider request-body logging must redact transient image data URLs before printing.
- Atomically claims rows with `status = "uploaded"` by moving them to `attaching` before model execution, so concurrent sends cannot reuse the same upload.
- Releases claimed rows back to `uploaded` only if the model turn fails before output begins. After output has started, a finalize failure leaves the claim unreleased rather than making a consumed attachment reusable.
- Rejects the turn before model execution when the selected model context window is too small for the prompt plus attachment context.
- Emits an SSE `attachment_metadata` event with `attachment_ids` and compact attachment DTOs after successful streaming finalization so the regular portal client can persist traceability metadata only on successful assistant messages.
- Caps total injected attachment text at 40,000 chars per turn and finalizes successful rows as `attached`.
- Keeps `chat_attachments.message_id` nullable because regular portal user messages are currently persisted by the client outside `/api/chat`.

### Snippet Revision APIs

#### POST /api/snippet-revision

**Purpose:** Preview or apply a structured text snippet revision without model-specific assumptions.

**Authentication:** Same-origin portal API behavior; the current route is a pure text helper and does not add auth behavior.

**Request:**
```typescript
{
  action: "preview" | "apply";
  sourceText: string;
  revision:
    | { mode: "replace_text"; find: string; replace: string }
    | { mode: "replace_range"; start: number; end: number; expectedText: string; replace: string };
}
```

**Response (200):**
```typescript
{
  result:
    | {
        ok: true;
        applied: boolean;       // true only for action: "apply"
        updatedText: string;
        unchanged: boolean;
        change: {
          mode: "replace_text" | "replace_range";
          start: number;
          end: number;          // within sourceText.length
          original: string;     // sourceText.slice(start, end)
          replacement: string;
        };
      }
    | {
        ok: false;
        applied: false;
        code: "empty_find" | "target_not_found" | "target_ambiguous" | "target_mismatch" | "range_invalid" | "range_out_of_bounds";
        message: string;
      };
}
```

**Client contract:**
- `requestSnippetRevision` returns valid engine failures (`result.ok === false`) instead of throwing.
- `requestSnippetRevision` throws `SnippetRevisionApiError` with `code: "invalid_response"` for stale/custom endpoint success payloads that do not match the submitted action, source text, or revision fields.
- Successful `replace_text` responses must match the submitted `find`/`replace` and the unique matching source span; successful `replace_range` responses must match the submitted `start`/`end`/`expectedText`/`replace`.
- `requestSnippetRevision` throws `SnippetRevisionApiError` with `code: "request_aborted"` for abort cancellation, including custom `AbortSignal.reason` throws, distinct from `request_failed`.

### Training APIs

#### GET /api/training/stats

**Purpose:** Get training job statistics for authenticated user

**Authentication:** Required (Bearer token OR API key)

**Request:**
```typescript
// Headers
Authorization: Bearer <session-token>
// OR
X-API-Key: <api-key>
```

**Response (200):**
```typescript
{
  total_jobs: number;      // Total training jobs
  completed: number;       // Completed jobs count
  running: number;         // Currently running jobs
  failed: number;          // Failed jobs count
  pending: number;         // Queued jobs count
  cancelled: number;       // Cancelled jobs count
}
```

**Response (401):**
```typescript
{
  error: "Unauthorized" | "Missing authorization header"
}
```

**Response (500):**
```typescript
{
  error: "Server configuration error" | "Failed to fetch statistics"
}
```

**Example Usage:**
```typescript
// Frontend
const response = await fetch('/api/training/stats', {
  headers: {
    Authorization: `Bearer ${session.access_token}`
  }
});
const stats = await response.json();
```

---

## 🔐 Authentication Patterns

### Standard Auth Flow

All API routes should support BOTH:

1. **Session Token (Web UI)**
```typescript
const authHeader = request.headers.get('authorization');
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await supabase.auth.getUser();
```

2. **API Key (SDK/External)**
```typescript
import { validateRequestWithScope } from '@/lib/auth/api-key-validator';

const apiKeyValidation = await validateRequestWithScope(
  request.headers,
  'training'  // Required scope
);
if (apiKeyValidation.isValid) {
  userId = apiKeyValidation.userId;
}
```

### Auth Template

```typescript
export async function GET(request: NextRequest) {
  let userId: string | null = null;

  // Try API key first
  const apiKeyValidation = await validateRequestWithScope(
    request.headers,
    'required-scope'
  );

  if (apiKeyValidation.isValid && apiKeyValidation.userId) {
    userId = apiKeyValidation.userId;
  } else {
    // Fall back to session token
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    userId = user.id;
  }

  // Use userId for queries...
}
```

---

## 📤 Response Patterns

### Success Responses

**Single Resource:**
```typescript
{
  id: string;
  data: { /* resource fields */ }
}
```

**List of Resources:**
```typescript
{
  data: Array<T>;
  total: number;
  limit: number;
  offset: number;
}
```

**Action Complete:**
```typescript
{
  success: true;
  message?: string;
}
```

### Error Responses

**Standard Error Format:**
```typescript
{
  error: string;           // User-friendly error message
  details?: string;        // Technical details (optional)
  code?: string;          // Error code (optional)
}
```

**Common Error Codes:**
- `400` - Bad request (invalid input)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (authenticated but not allowed)
- `404` - Not found
- `409` - Conflict (duplicate resource)
- `500` - Server error

---

## 🎯 Naming Conventions

### Endpoint Paths

**Pattern:** `/api/<domain>/<resource>[/<id>][/<action>]`

**Examples:**
```
✅ GET  /api/training/jobs
✅ GET  /api/training/jobs/123
✅ POST /api/training/jobs
✅ GET  /api/training/jobs/123/metrics
✅ POST /api/training/jobs/123/cancel

❌ GET  /api/getTrainingJobs
❌ POST /api/create-job
❌ GET  /api/training/job  (use plural)
```

### HTTP Methods

- `GET` - Retrieve resources (safe, idempotent)
- `POST` - Create resources or trigger actions
- `PUT` - Replace entire resource
- `PATCH` - Update part of resource
- `DELETE` - Remove resource

---

## 📝 Decisions Log

### 2026-06-29: Chat Attachments Need Message-Scoped Contracts

**Decision:** Per-chat attachments should use a private, message-scoped attachment
contract instead of reusing the durable GraphRAG document upload path.

**Planned endpoints:**
- `POST /api/chat/attachments` to upload and extract authenticated attachments
- `/api/chat` accepts verified attachment ids for the current user turn

**Rationale:**
- GraphRAG uploads commit files to the user's durable knowledge base.
- The chat route currently accepts only text messages, so an upload-only UI would
  not let the model safely use one-turn file context.
- Attachment text must be ownership-checked, conversation-scoped, and token-bounded
  before prompt injection.

### 2026-06-29: Chat Async Started Tools Are Single-Shot Per Turn

**Decision:** When `/api/chat` tools return an async `*_started` acknowledgement, the route makes that async mode single-shot for the same chat turn. Tools that are purely async are removed from later tool-call offerings; mixed-mode tools keep their synchronous mode available while blocking repeat async work.

**Files:**
- `app/api/chat/route.ts`
- `app/api/chat/__tests__/route-tool-use-smoke.test.ts`

**Current tools covered:**
- `generate_image` after `image_generation_started`: remove `generate_image` from later offered tools and from `offeredToolNames`
- `web_search` deep research after `deep_research_started` or `research_started`: keep `web_search` offered, but force later `research` / `deepResearchConfirmed` attempts to `false` so standard search still works

**Rationale:**
- Async tools deliver completion out-of-band, so repeated calls can queue duplicate background work and exhaust model tool-round limits.
- Structural capability changes are required; prompt instructions or advisory tool-result text are only defense-in-depth.

### 2025-12-19: Training Stats API

**Decision:** Return job counts broken down by status

**Rationale:**
- Frontend needs to show different states (running vs completed)
- Single endpoint better than multiple status-specific endpoints
- Matches existing pattern in training jobs table

**Alternative Considered:**
- Separate endpoints per status (`/stats/completed`, `/stats/running`)
- Rejected: Too many endpoints, harder to maintain

### 2026-06-30: Snippet Revision Client Boundary Validation

**Decision:** Validate successful snippet revision client responses against the submitted request context, not only their standalone object shape.

**Rationale:**
- The route and client ship together today, but the client supports custom endpoints.
- Stale/custom endpoints can return structurally valid yet impossible ranges, wrong `applied` state, or abort errors that should not look like network failures.
- Failing closed with `invalid_response` protects future preview/apply UI from trusting impossible spans or commit state.

**Alternative Considered:**
- Trust any structurally valid `SnippetRevisionResult`.
- Rejected: It preserves the TypeScript shape but lets stale endpoint drift leak into UI state.

---

## 🔜 Planned APIs

### Priority: High

- [ ] `POST /api/training/jobs/:id/restart` - Restart failed job
- [ ] `GET /api/training/metrics/aggregate` - Aggregated metrics across jobs

### Priority: Medium

- [ ] `GET /api/analytics/dashboard` - Dashboard summary data
- [ ] `POST /api/datasets/validate` - Validate dataset before upload

### Priority: Low

- [ ] `GET /api/models/search` - Search HuggingFace models
- [ ] `POST /api/notifications/preferences` - Update notification settings

---

## 🐛 Known Issues

*No known API issues*

---

## 📚 Related Files

- **Auth:** `lib/auth/api-key-validator.ts`
- **Types:** See `TYPES_COORDINATION.md`
- **Database:** See `DATABASE_COORDINATION.md`

---

**Last Updated:** 2025-12-19
