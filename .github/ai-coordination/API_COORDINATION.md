# API Coordination

**Purpose:** Document all API endpoints, contracts, and integration points between backend and frontend.

**Models Using This:** Claude (backend), Copilot (frontend)

---

## 🚧 Current Work

### In Progress

*No current API work*

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

### 2025-12-19: Training Stats API

**Decision:** Return job counts broken down by status

**Rationale:**
- Frontend needs to show different states (running vs completed)
- Single endpoint better than multiple status-specific endpoints
- Matches existing pattern in training jobs table

**Alternative Considered:**
- Separate endpoints per status (`/stats/completed`, `/stats/running`)
- Rejected: Too many endpoints, harder to maintain

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
