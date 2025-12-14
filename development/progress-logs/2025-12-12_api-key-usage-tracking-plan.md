# API Key Usage Tracking - Production Environment
**Date:** 2025-12-12
**Status:** IMPLEMENTED
**Priority:** High

## Overview
Implement detailed production environment tracking for API key usage. This extends the basic `request_count`/`last_used_at` tracking to include per-request logging with endpoint, tokens, latency, status, and errors.

## Current State Analysis

### Existing Infrastructure
| Component | Location | Purpose |
|-----------|----------|---------|
| `user_api_keys` table | Supabase | Stores API keys with basic `request_count`, `last_used_at` |
| `api-key-validator.ts` | `lib/auth/` | Validates keys, updates basic usage stats |
| `llm_traces` table | Supabase | Internal LLM trace data (tied to user_id, not API keys) |
| `widget_llm_requests` | Supabase | Widget SDK production tracking (uses app tokens, not API keys) |

### Endpoints Using API Key Auth
| Endpoint | Auth Method | Scope |
|----------|-------------|-------|
| `/api/v1/predict` | `validateRequestWithScope` | production |
| `/api/batch-testing/*` | `validateRequest` | testing |
| `/api/analytics/traces` | `validateRequest` | production |
| `/api/analytics/data` | `validateRequest` | production |
| `/api/feedback/collect` | `validateRequest` | production |
| `/api/chat` | `validateApiKey` | all |

### What's NOT Currently Tracked
- Per-endpoint breakdown
- Token usage per request
- Response latency
- Error rates and types
- Request/response metadata
- Daily/monthly quotas

---

## Phased Implementation Plan

### Phase 1: Database Schema
**Goal:** Create `api_key_usage_logs` table with detailed tracking fields

**Migration File:** `supabase/migrations/20251212200000_create_api_key_usage_logs.sql`

**Table Schema:**
```sql
CREATE TABLE api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES user_api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Request details
  endpoint TEXT NOT NULL,           -- e.g., '/api/v1/predict'
  method TEXT NOT NULL,             -- 'POST', 'GET'
  scope_used TEXT,                  -- 'production', 'training', 'testing'

  -- Timing
  request_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_ts TIMESTAMPTZ,
  latency_ms INTEGER,

  -- Token usage (for LLM endpoints)
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,

  -- Model info (for predict endpoint)
  model_id TEXT,
  model_provider TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'success', 'error'
  status_code INTEGER,
  error_type TEXT,
  error_message TEXT,

  -- Request metadata
  request_metadata JSONB DEFAULT '{}'::jsonb,

  -- IP/User-Agent for security
  client_ip TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_api_key_usage_logs_api_key_id` - Query by API key
- `idx_api_key_usage_logs_user_id` - Query by user
- `idx_api_key_usage_logs_endpoint` - Query by endpoint
- `idx_api_key_usage_logs_request_ts` - Time-based queries
- `idx_api_key_usage_logs_status` - Filter by status

**RLS Policies:**
- Users can view logs for their own API keys
- Service role can insert (for server-side logging)

**Files to create:**
- `supabase/migrations/20251212200000_create_api_key_usage_logs.sql`

---

### Phase 2: Usage Logging Service
**Goal:** Create TypeScript service for logging API key usage

**New File:** `lib/auth/api-key-usage-logger.ts`

**Functions:**
```typescript
// Start tracking a request (returns log ID)
startUsageLog(params: {
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  scopeUsed?: string;
  clientIp?: string;
  userAgent?: string;
}): Promise<string>;

// Complete a successful request
completeUsageLog(logId: string, params: {
  statusCode: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  modelId?: string;
  modelProvider?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>;

// Record an error
failUsageLog(logId: string, params: {
  statusCode: number;
  latencyMs: number;
  errorType: string;
  errorMessage: string;
}): Promise<void>;

// Convenience: Log a complete request in one call (fire-and-forget)
logApiKeyUsage(params: {
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  scopeUsed?: string;
  statusCode: number;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  modelId?: string;
  modelProvider?: string;
  errorType?: string;
  errorMessage?: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>;
```

**Files to create:**
- `lib/auth/api-key-usage-logger.ts`

---

### Phase 3: Endpoint Integration
**Goal:** Integrate usage logging into API key authenticated endpoints

**Approach:**
- Update `validateRequest` and `validateRequestWithScope` to return `keyId` in result
- Add usage logging call at end of each endpoint handler
- Use fire-and-forget pattern to avoid blocking responses

**Files to modify:**
| File | Changes |
|------|---------|
| `lib/auth/api-key-validator.ts` | Ensure `keyId` is always returned in validation result |
| `app/api/v1/predict/route.ts` | Add usage logging with token counts |
| `app/api/batch-testing/run/route.ts` | Add usage logging |
| `app/api/batch-testing/status/[id]/route.ts` | Add usage logging |
| `app/api/batch-testing/cancel/route.ts` | Add usage logging |
| `app/api/batch-testing/archive/route.ts` | Add usage logging |
| `app/api/analytics/traces/route.ts` | Add usage logging |
| `app/api/analytics/data/route.ts` | Add usage logging |

**Integration Pattern:**
```typescript
// At start of handler
const startTime = Date.now();

// ... existing code ...

// Before returning response (in finally block or after success/error)
if (validation.keyId) {
  logApiKeyUsage({
    apiKeyId: validation.keyId,
    userId: validation.userId!,
    endpoint: '/api/v1/predict',
    method: 'POST',
    scopeUsed: 'production',
    statusCode: 200,
    latencyMs: Date.now() - startTime,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    modelId: body.model,
    modelProvider: modelConfig.provider,
  }).catch(console.error);
}
```

---

### Phase 4: Query API & UI
**Goal:** Create API endpoints for querying usage and add UI to view detailed usage

**New API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/user/api-keys/[id]/usage` | GET | Get usage logs for specific key |
| `/api/user/api-keys/[id]/usage/summary` | GET | Get aggregated usage summary |

**Query Parameters:**
- `startDate` / `endDate` - Date range filter
- `endpoint` - Filter by endpoint
- `status` - Filter by status (success/error)
- `limit` / `offset` - Pagination

**UI Updates to `ApiKeysManagement.tsx`:**
- Add "View Usage" button on each API key card
- Usage details modal/drawer with:
  - Usage timeline chart
  - Endpoint breakdown pie chart
  - Error rate
  - Token usage totals
  - Recent requests table

**Files to create:**
- `app/api/user/api-keys/[id]/usage/route.ts`
- `app/api/user/api-keys/[id]/usage/summary/route.ts`
- `components/settings/ApiKeyUsageModal.tsx`

**Files to modify:**
- `components/settings/ApiKeysManagement.tsx` - Add usage view button

---

## Impact Analysis

### Files That Will Be Modified
| File | Type | Risk Level |
|------|------|------------|
| `lib/auth/api-key-validator.ts` | Minor update | Low - only ensure keyId is returned |
| `app/api/v1/predict/route.ts` | Add logging | Low - additive, fire-and-forget |
| `app/api/batch-testing/*.ts` | Add logging | Low - additive, fire-and-forget |
| `app/api/analytics/*.ts` | Add logging | Low - additive, fire-and-forget |
| `components/settings/ApiKeysManagement.tsx` | Add UI | Low - additive UI |

### Files That Will Be Created
| File | Purpose |
|------|---------|
| `supabase/migrations/20251212200000_create_api_key_usage_logs.sql` | Database schema |
| `lib/auth/api-key-usage-logger.ts` | Logging service |
| `app/api/user/api-keys/[id]/usage/route.ts` | Usage query API |
| `app/api/user/api-keys/[id]/usage/summary/route.ts` | Summary API |
| `components/settings/ApiKeyUsageModal.tsx` | Usage details UI |

### No Breaking Changes Expected
- All changes are additive
- Logging is fire-and-forget (doesn't block responses)
- Existing `request_count`/`last_used_at` continues to work
- New table doesn't affect existing tables

---

## Verification Checklist

### Phase 1 Verification
- [ ] Migration runs without errors
- [ ] Table created with correct schema
- [ ] Indexes created
- [ ] RLS policies work correctly
- [ ] Test insert/select operations

### Phase 2 Verification
- [ ] Logger functions compile without TypeScript errors
- [ ] Test logging a request
- [ ] Test completing a request
- [ ] Test failing a request
- [ ] Verify async/fire-and-forget behavior

### Phase 3 Verification
- [ ] `/api/v1/predict` logs usage correctly
- [ ] Batch testing endpoints log usage
- [ ] Analytics endpoints log usage
- [ ] Error cases are logged with error details
- [ ] Token counts are captured for LLM endpoints
- [ ] No performance degradation (< 5ms added latency)

### Phase 4 Verification
- [ ] Usage query API returns correct data
- [ ] Summary API aggregates correctly
- [ ] UI displays usage data
- [ ] Pagination works
- [ ] Date filtering works

---

## Rollback Plan
If issues arise:
1. **Phase 1:** Drop migration: `DROP TABLE IF EXISTS api_key_usage_logs CASCADE;`
2. **Phase 2:** Delete `lib/auth/api-key-usage-logger.ts`
3. **Phase 3:** Remove logging calls from endpoints (git revert)
4. **Phase 4:** Remove UI components (git revert)

---

## Timeline Estimate
- Phase 1: Database schema
- Phase 2: Logging service
- Phase 3: Endpoint integration
- Phase 4: Query API & UI

---

## Approval Required
Please review this plan and confirm:
1. Schema design meets requirements
2. Endpoint coverage is complete
3. UI features are sufficient
4. No concerns with the approach

**Awaiting user approval before implementation.**

---

## Pre-Implementation Verification (Completed)

### Verified Code State

| File | Line | Verified |
|------|------|----------|
| `lib/auth/api-key-validator.ts:159` | `keyId: keyRecord.id` returned | ✅ |
| `lib/auth/api-key-validator.ts:52-61` | `ApiKeyValidationResult` includes `keyId` | ✅ |
| `app/api/v1/predict/route.ts:183` | `startTime = Date.now()` exists | ✅ |
| `app/api/v1/predict/route.ts:198` | `latencyMs = Date.now() - startTime` exists | ✅ |
| `app/api/v1/predict/route.ts:217-219` | Token counts from `response.usage` | ✅ |
| `app/api/batch-testing/run/route.ts:161` | `validateRequest` called | ✅ |
| `app/api/batch-testing/run/route.ts:175` | `keyId` NOT included in return | ❌ Needs fix |

### Integration Points - Exact Line Numbers

**`/api/v1/predict/route.ts`:**
- After line 226 (success): Add usage logging call
- After line 239 (error): Add error usage logging call
- Streaming responses (line 110-179): Limited tracking (no token counts)

**`/api/batch-testing/run/route.ts`:**
- Line 147: Add `keyId?: string` to `BatchTestingAuth` type
- Line 175: Add `keyId: validation.keyId` to return object

### Known Limitations
1. **Streaming responses**: Cannot track token counts for streaming in `/api/v1/predict`
2. **Widget ingest**: Uses app tokens, NOT API keys - out of scope for this feature

---

## Implementation Status (2025-12-12)

### Files Created
| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/20251212200000_create_api_key_usage_logs.sql` | Database schema | ✅ Created |
| `lib/auth/api-key-usage-logger.ts` | Logging service | ✅ Created |
| `app/api/user/api-keys/[id]/usage/route.ts` | Usage query API | ✅ Created |

### Files Modified
| File | Changes | Status |
|------|---------|--------|
| `app/api/v1/predict/route.ts` | Added usage logging for success + streaming | ✅ Done |
| `app/api/batch-testing/run/route.ts` | Added keyId to auth type, added usage logging | ✅ Done |

### Endpoints With Usage Tracking
| Endpoint | Tokens | Latency | Status |
|----------|--------|---------|--------|
| `/api/v1/predict` (non-streaming) | ✅ | ✅ | ✅ |
| `/api/v1/predict` (streaming) | ❌ | ✅ | ✅ |
| `/api/batch-testing/run` | ❌ | ✅ | ✅ |

### Phase 4: UI Modal - COMPLETED
| File | Changes | Status |
|------|---------|--------|
| `components/settings/ApiKeysManagement.tsx` | Added ApiKeyUsageModal component | ✅ Done |

**UI Features:**
- Summary stats: Total requests, Success rate, Avg latency, Total tokens
- Paginated usage logs table (10 per page)
- Request details: endpoint, method, time, status, latency, tokens, model
- Empty state when no usage data

### Future Enhancements
- Add logging to `/api/analytics/traces` (requires auth refactor)
- Add logging to `/api/batch-testing/status`, `/api/batch-testing/cancel`
- Add usage charts and endpoint breakdown visualizations
