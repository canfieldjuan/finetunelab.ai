# Types Coordination

**Purpose:** Document shared TypeScript types used across backend and frontend.

**Models Using This:** Claude (backend), Copilot (frontend)

---

## 🚧 Current Work

### In Progress

**Chat Attachment Types**
- **Started:** 2026-06-30
- **Branch:** `codex/chat-attachment-ui`
- **Locations:** `lib/chat/attachments.ts`, `lib/chat/attachment-limits.ts`, `components/chat/types.ts`
- **Status:** Backend DTOs are consumed by the chat UI; pending upload state lives in `PendingChatAttachment`.

**Chat Attachment Signed Download Response**
- **Started:** 2026-06-30
- **Branch:** `codex/chat-attachment-download-links`
- **Locations:** `lib/chat/attachments.ts`, `components/chat/AttachmentChips.tsx`
- **Status:** Persisted chips request a short-lived signed URL through `GET /api/chat/attachments?attachmentId=<uuid>`; no signed URL is stored in `ChatAttachmentDto`.

**Chat Vision Attachment Message Parts**
- **Started:** 2026-06-30
- **Branch:** `codex/chat-vision-attachments`
- **Locations:** `lib/llm/openai.ts`, `lib/chat/attachments.ts`, `lib/chat/attachment-limits.ts`, `app/api/chat/route.ts`
- **Status:** Private image attachments remain metadata-only in DTOs; the chat route creates transient multimodal model message parts only for vision-capable model configs after image byte validation, image byte-budget checks, and image-aware context estimation.

### Recently Completed

**Training Stats Types**
- **Completed:** 2025-12-19
- **Location:** Defined inline in `components/training/TrainingStatsBadge.tsx`
- **Status:** Should be moved to shared types file

---

## 📦 Shared Type Definitions

### Chat Attachment Types

#### ChatAttachmentDto

**Location:** `lib/chat/attachments.ts`

```typescript
interface ChatAttachmentDto {
  id: string;
  filename: string;
  contentType: string | null;
  sizeBytes: number;
  kind: "text" | "document" | "code" | "image" | "unknown";
  extractedChars: number;
  status: "uploaded" | "attaching" | "attached" | "deleted";
}
```

**Usage:**
- Backend: returned from `POST /api/chat/attachments`.
- Chat route: persisted in assistant metadata when `attachmentIds` are accepted.
- UI: used for uploaded chips, sent-message chips, and persisted message attachment display.
- Downloads and vision input: the DTO carries only identity/display metadata. Persisted chips fetch a fresh signed URL on click instead of storing or rendering an href. Vision model calls download private image bytes server-side and do not add data URLs to `ChatAttachmentDto` or message metadata. Image rows carry empty extracted text; server-side metadata records the detected image MIME, image byte count, and estimated vision token count.

#### PendingChatAttachment

**Location:** `components/chat/types.ts`

```typescript
interface PendingChatAttachment {
  clientId: string;
  conversationId: string;
  filename: string;
  sizeBytes: number;
  status: "uploading" | "uploaded" | "deleting" | "error";
  attachment?: ChatAttachmentDto;
  error?: string;
}
```

**Rules:** pending attachment state is scoped by `conversationId`; the client
sends only uploaded `attachment.id` values, never file bytes, in the chat JSON
request.

#### Chat Request Attachment Field

```typescript
interface ChatRequestAttachmentFields {
  attachmentIds?: string[];
}
```

**Rules:** max 5 ids, authenticated non-widget chat only, same `user_id` and `conversation_id`.
Image ids may be included in the same field. Non-vision models ignore image
payloads for model input; vision-capable models receive transient image message
parts generated server-side from private storage after enforcing the 4 MB
per-image cap, 12 MB per-turn image cap, and image token estimate
`max(512, ceil(bytes / 1024))`.

#### ChatMessageContent / ChatMessageContentPart

**Location:** `lib/llm/openai.ts`

```typescript
type ChatMessageTextPart = {
  type: "text";
  text: string;
};

type ChatMessageImagePart = {
  type: "image_url";
  image_url: {
    url: string; // server-side data URL for private attachment model input
    detail?: "auto" | "low" | "high";
  };
};

type ChatMessageContentPart = ChatMessageTextPart | ChatMessageImagePart;
type ChatMessageContent = string | ChatMessageContentPart[];
```

**Rules:** regular chat messages can stay string-only. The chat route appends
image parts only after loading a selected model config with `supports_vision`.
Use `getChatMessageTextContent()` for guardrails, token estimates, prompts, and
adapters that need a text-only view, but model context preflight must add
vision-token estimates separately so image-only turns do not count as zero
input. OpenAI-compatible and RunPod payloads preserve image parts, Anthropic
maps data URLs to base64 source blocks, and Ollama maps them to its native
`images` field.

#### Chat Attachment Download Response

**Location:** `app/api/chat/attachments/route.ts`

```typescript
interface ChatAttachmentDownloadResponse {
  success: true;
  url: string;
  expiresInSeconds: number;
  attachment: {
    id: string;
    filename: string;
  };
}
```

**Rules:** `url` is a short-lived Supabase Storage signed URL generated per
request for the authenticated user. Do not persist it into message metadata or
`ChatAttachmentDto`.

### Training Types

#### TrainingJobStats

**Location:** Should be in `lib/types/training.ts` (TODO: create this file)

**Currently defined in:** `components/training/TrainingStatsBadge.tsx`

```typescript
interface TrainingStats {
  total_jobs: number;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  cancelled: number;
}
```

**Usage:**
- Backend: Returns this from `GET /api/training/stats`
- Frontend: Expects this shape in TrainingStatsBadge component

---

## 🎯 Type Naming Conventions

### General Rules

1. **Use descriptive names**
   ```typescript
   ✅ interface TrainingJobMetrics { }
   ❌ interface Metrics { }  // Too generic
   ```

2. **Suffix with purpose**
   ```typescript
   - XxxRequest  - API request body
   - XxxResponse - API response body
   - XxxConfig   - Configuration object
   - XxxParams   - Function parameters
   - XxxProps    - React component props
   ```

3. **Match API response shape**
   ```typescript
   // Backend returns this
   { total_jobs: 10, running: 2 }

   // Frontend type must match exactly
   interface TrainingStats {
     total_jobs: number;  // ✅ snake_case to match API
     running: number;
   }
   ```

4. **Use enums for fixed values**
   ```typescript
   enum TrainingStatus {
     PENDING = 'pending',
     RUNNING = 'running',
     COMPLETED = 'completed',
     FAILED = 'failed',
     CANCELLED = 'cancelled'
   }
   ```

---

## 📂 Type Organization

### File Structure

```
lib/types/
├── training.ts         - Training system types
├── analytics.ts        - Analytics types
├── api.ts             - Generic API types
├── database.ts        - Database schema types
└── common.ts          - Shared utility types
```

### Example: training.ts

```typescript
// lib/types/training.ts

export interface TrainingStats {
  total_jobs: number;
  completed: number;
  running: number;
  failed: number;
  pending: number;
  cancelled: number;
}

export enum TrainingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TrainingJob {
  id: string;
  user_id: string;
  status: TrainingStatus;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingMetricPoint {
  step: number;
  epoch: number;
  train_loss?: number;
  eval_loss?: number;
  learning_rate?: number;
  timestamp: string;
}
```

---

## 🔄 Type Sync Between Models

### Backend → Frontend Type Flow

**When Claude creates a new API endpoint:**

1. Define response type in backend
```typescript
// app/api/training/stats/route.ts
interface StatsResponse {
  total_jobs: number;
  running: number;
}
```

2. Add type to shared types file
```typescript
// lib/types/training.ts
export interface TrainingStats {
  total_jobs: number;
  running: number;
}
```

3. Update this coordination file
```markdown
## New Type: TrainingStats
- Location: lib/types/training.ts
- Used by: /api/training/stats, TrainingStatsBadge component
```

4. Copilot uses the shared type
```typescript
// components/training/TrainingStatsBadge.tsx
import { TrainingStats } from '@/lib/types/training';

const [stats, setStats] = useState<TrainingStats | null>(null);
```

---

## 📝 Common Patterns

### API Response Wrapper

```typescript
// lib/types/api.ts
export interface ApiResponse<T> {
  data: T;
  error?: never;
}

export interface ApiError {
  data?: never;
  error: string;
  details?: string;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Usage
type StatsResult = ApiResult<TrainingStats>;
```

### Pagination

```typescript
// lib/types/api.ts
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Usage
type JobsResponse = PaginatedResponse<TrainingJob>;
```

### Database Row Types

```typescript
// lib/types/database.ts
export interface Database {
  public: {
    Tables: {
      local_training_jobs: {
        Row: {
          id: string;
          user_id: string;
          status: string;
          // ... all columns
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: string;
          // ... required fields
        };
        Update: {
          id?: string;
          status?: string;
          // ... optional fields
        };
      };
    };
  };
}
```

---

## 🚨 Common Type Mismatches to Avoid

### Issue 1: Case Mismatch

```typescript
❌ Backend returns: { total_jobs: 10 }
❌ Frontend expects: { totalJobs: 10 }

✅ Both use: { total_jobs: 10 }  // Match API convention
```

### Issue 2: Optional vs Required

```typescript
❌ Backend: { name: string | null }
❌ Frontend: { name: string }  // Will crash on null

✅ Both use: { name: string | null }
✅ Frontend handles: if (data.name) { ... }
```

### Issue 3: Date Format

```typescript
❌ Backend returns: { created_at: Date }  // JavaScript Date
❌ Frontend expects: { created_at: string }

✅ Backend serializes: { created_at: date.toISOString() }
✅ Frontend type: { created_at: string }
✅ Frontend parses: new Date(data.created_at)
```

### Issue 4: Enum vs String

```typescript
❌ Backend uses: status: 'running' | 'completed'
❌ Frontend uses: enum Status { Running = 'running' }

✅ Both use shared enum:
export enum TrainingStatus {
  RUNNING = 'running',
  COMPLETED = 'completed'
}
```

---

## 📋 TODOs

- [ ] Create `lib/types/training.ts` and move TrainingStats there
- [ ] Create `lib/types/api.ts` for generic API types
- [ ] Extract database types from Supabase schema
- [ ] Add JSDoc comments to all exported types
- [ ] Create type guards for runtime validation

---

## 📝 Decisions Log

### 2025-12-19: snake_case vs camelCase

**Decision:** Use snake_case for API types (matching database/API)

**Rationale:**
- Backend uses snake_case (PostgreSQL convention)
- Changing case in frontend adds transformation layer
- Direct mapping prevents bugs

**Example:**
```typescript
✅ interface User { user_id: string; first_name: string }
❌ interface User { userId: string; firstName: string }
```

---

**Last Updated:** 2025-12-19
