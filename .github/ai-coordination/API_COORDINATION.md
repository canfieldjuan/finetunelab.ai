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

**Chat Attachments Backend Contract**
- **Started:** 2026-06-29
- **Model:** Codex
- **Branch:** `codex/chat-attachments-plan`
- **Work:** Implemented authenticated per-chat attachment APIs for the chat portal; UI controls remain a follow-up.
- **Plan:** `development/planning/2026-06-29_chat-attachments-plan.md`
- **Endpoints:** `POST /api/chat/attachments`, `DELETE /api/chat/attachments`, `POST /api/chat` with `attachmentIds`
- **Files:**
  - API: `app/api/chat/attachments/route.ts`, `app/api/chat/route.ts`
  - Service/types: `lib/chat/attachments.ts`
  - Migration: `supabase/migrations/20260630000000_create_chat_attachments.sql`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`, `app/api/chat/__tests__/route-tool-use-smoke.test.ts`, `supabase/migrations/__tests__/chat-attachments-schema.test.ts`

**Chat Attachment Upload Hardening**
- **Started:** 2026-06-30
- **Model:** Codex
- **Branch:** `codex/chat-attachment-hardening`
- **Work:** Stacked follow-up on PR #85 that requires bounded upload bodies before multipart parsing and bounds attachment text extraction before UI drives regular uploads.
- **Files:**
  - API: `app/api/chat/attachments/route.ts`
  - Service: `lib/chat/attachments.ts`
  - Tests: `app/api/chat/attachments/__tests__/route.test.ts`

### Recently Completed

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
  file: File;              // txt, md, pdf, docx, ts, tsx, js, jsx, py
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

**Limits:** 10 MB per file, 11 MB multipart request pre-parse ceiling including envelope overhead, valid bounded `Content-Length` required before `request.formData()`, 15s extraction timeout, 50 MB DOCX uncompressed-entry ceiling, 5 uploaded attachments per turn candidate, 20,000 extracted chars stored per file.

**Extraction timeout behavior:** The 15s timeout starts before DOCX archive inspection and parser invocation. Timeout aborts the route operation, closes/destroys the owned DOCX ZIP/read streams, and passes an `AbortSignal` into the parser factory for cooperative pre/post checks. Current third-party parser libraries (`pdf-parse`, `mammoth`) do not expose mid-parse cancellation, so parser work that is already inside those libraries may finish before the cooperative post-call check rejects the result.

**MIME behavior:** Extension validation is authoritative for code/text attachments. TypeScript `.ts` files may arrive as `video/mp2t` from common upload environments and are accepted as code after extension validation.

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
