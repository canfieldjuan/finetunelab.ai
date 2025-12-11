# Web Search Tool Enhancement Plan

**Objective:** Address critical reliability, robustness, and performance issues in the Web Search and Research tools to create a production-ready system.

**Guiding Principle:** "Never Assume, Always Verify."

**Status:** 📅 Planned
**Start Date:** December 8, 2025

---

## Phase 1: Reliability & Persistence (Critical)

**Goal:** Ensure research jobs and search telemetry survive server restarts and provide persistent history.

### 1.1 Research Job Persistence (✅ Completed)

- **Target File:** `lib/tools/web-search/research.service.ts`
- **New File:** `lib/tools/web-search/storage.service.ts` (Enhance or replace existing)
- **Action:**
  - Create a `ResearchStorageService` that interfaces with Supabase (table: `research_jobs`).
  - Replace in-memory `Map<string, ResearchJob>` with database calls.
  - **Schema:** `id`, `user_id`, `query`, `status`, `steps` (jsonb), `report` (jsonb), `created_at`, `updated_at`.
- **Verification:**
  - ✅ Verify job creation persists to DB.
  - ✅ Verify job status updates persist.
  - ✅ Verify job retrieval works after service restart.
  - ✅ Created migration: `supabase/migrations/20251208000000_create_research_jobs.sql`
  - ✅ Updated API routes to handle async service calls.
  - ✅ Refactored `SseService` to use `EventEmitter` for streaming.

### 1.2 Search Telemetry Persistence (✅ Completed)

- **Target File:** `lib/tools/web-search/search.service.ts`
- **New File:** `lib/tools/web-search/telemetry.service.ts`
- **Action:**
  - Create `TelemetryService` to log search events to Supabase (table: `search_telemetry` or similar).
  - Record: `provider`, `latency_ms`, `success` (bool), `error_code`, `query_length`.
  - Remove in-memory `telemetry` Map.
- **Verification:**
  - ✅ Verify search events are logged to DB.
  - ✅ Verify no performance regression (async logging).
  - ✅ Created migration: `supabase/migrations/20251208000001_create_search_telemetry.sql`
  - ✅ Implemented `TelemetryService` with fire-and-forget persistence.
  - ✅ Updated `SearchService` to use `TelemetryService`.

---

## Phase 2: Robustness & Anti-Bot (✅ Completed)

**Goal:** Prevent blocking by WAFs (403/406 errors) and improve the quality of extracted content.

### 2.1 Enhanced Content Fetching (✅ Completed)

- **Target File:** `lib/tools/web-search/content.service.ts`
- **Action:**
  - Update `AXIOS_CONFIG` with realistic browser headers (`User-Agent`, `Accept`, `Accept-Language`, `Referer`, `Upgrade-Insecure-Requests`).
  - Implement retry logic with exponential backoff for `429` and `5xx` errors.
  - Handle encoding issues (UTF-8 enforcement).
- **Verification:**
  - ✅ Test against known strict WAFs (if possible/allowed) or verify headers in request logs.
  - ✅ Verify retry logic triggers on 429.
  - ✅ Implemented `fetchHtml` with retry loop and manual decoding.

### 2.2 Smart Content Truncation (✅ Completed)

- **Target File:** `lib/tools/web-search/content.service.ts`
- **Action:**
  - Replace hard character limit (15,000) with a "smart truncate" function.
  - Truncate at the nearest paragraph or sentence boundary within the limit.
  - Ensure no broken HTML entities or partial words.
- **Verification:**
  - ✅ Unit test with long text inputs.
  - ✅ Verify output ends with complete sentence/paragraph.
  - ✅ Implemented `smartTruncate` method.

---

## Phase 3: Performance & Safety (✅ Completed)

**Goal:** Prevent rate limits, ensure type safety, and improve error visibility.

### 3.1 Concurrency Control (✅ Completed)

- **Target File:** `lib/tools/web-search/research.service.ts`
- **Action:**
  - Implement a concurrency limiter (e.g., `p-limit` style or chunking) for `sub_query_search`.
  - Limit concurrent search requests to 3-5 to respect provider rate limits.
- **Verification:**
  - ✅ Verify max concurrent requests do not exceed limit during stress test.
  - ✅ Implemented `runWithConcurrency` helper and applied it to `sub_query_search`.

### 3.2 Type Safety & Error Handling (✅ Completed)

- **Target File:** `lib/tools/web-search/research.service.ts`
- **Action:**
  - Remove unsafe type assertions (`as string[]`, `as WebSearchResponse`).
  - Implement Zod schemas or type guards for step outputs.
  - Add `failureReason` field to `ResearchJob` and populate it on error.
- **Verification:**
  - ✅ Verify TypeScript compiles with `strict: true` (or equivalent strictness).
  - ✅ Verify errors are correctly captured and persisted.
  - ✅ Added type guards (`isStringArray`, `isWebSearchResponse`, etc.).
  - ✅ Added `failureReason` to `ResearchJob` and populated it in `updateJobStatus`.

---

## Execution Strategy

1. **Audit:** (Completed) Identified critical files and insertion points.
2. **Phase 1 Implementation:** (Completed) Persistence and Telemetry.
3. **Phase 2 Implementation:** (Completed) Robustness and Anti-Bot.
4. **Phase 3 Implementation:** (Completed) Performance and Safety.
5. **Final Verification:** (Pending) Run full integration test.
3. **Phase 2 Implementation:** Improve success rate of content fetching.
4. **Phase 3 Implementation:** Optimize for scale and stability.
5. **Final Verification:** Run E2E tests to validate the entire pipeline.
