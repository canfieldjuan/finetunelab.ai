# Security Remediation Plan – December 18, 2025

**Objective**: Ship permanent fixes for the newly discovered authentication gaps (distributed control plane, DAG template CRUD, and research/telemetry APIs) without introducing regressions. No temporary firewalls or manual mitigations—every change must live in-code, have automated tests, and be documented.

---

## Phase 1 – Distributed Control Plane Lockdown (CRITICAL)

**Scope**
- Routes:  
  - `app/api/distributed/workers/register/route.ts` (auth check must happen before line 9 where `request.json()` is called)  
  - `app/api/distributed/execute/route.ts` (before line 10)  
  - `app/api/distributed/workers/[workerId]/heartbeat/route.ts` (before line 13)  
  - `app/api/distributed/workers/[workerId]/route.ts` (before line 13)  
  - `app/api/distributed/queue/*/route.ts` (pause/resume/stats endpoints)

**Work Items**
1. **Worker Auth Module** – Create `lib/auth/worker-auth.ts` exporting `assertWorkerRequest(request: NextRequest): WorkerIdentity`. This module will:
   - Read `x-worker-api-key` and optional `x-worker-signature`.
   - Compare against `DISTRIBUTED_WORKER_API_KEY` or verify HMAC (`workerId` + timestamp).
   - Enforce replay safe timestamps (±30s) and reject all unauthenticated requests with 401.
2. **Route Integration** – Import `assertWorkerRequest` in each distributed route and call it before parsing the body. Example insertion: `const workerIdentity = assertWorkerRequest(request, 'register');`.
3. **Telemetry & Abuse Detection** – Extend logging to include workerId/IP on auth failures; add rate limiting via `lib/middleware/rate-limit.ts` if available.
4. **Tests** – Add `tests/api/distributed-auth.test.ts` covering: missing headers (401), invalid signature (401), valid request passes through to underlying handler.

**Verification**
- Run distributed-specific tests (`npm run test -- tests/api/distributed-auth.test.ts`), plus smoke test `test-dag.ts` to ensure orchestrator flow still works.

---

## Phase 2 – DAG Template API Hardening (HIGH)

**Scope**
- `app/api/training/dag/templates/route.ts` (GET/POST handlers)
- `app/api/training/dag/templates/[id]/route.ts` (GET/DELETE handlers)

**Work Items**
1. **User Authentication** – For each handler, before line 11 (GET) / 68 (POST) / 20 (GET by ID) / 58 (DELETE), derive an authenticated Supabase client using the bearer token from `Authorization`. Use anon key + `global.headers.Authorization`.
2. **Ownership & Workspace Checks** – Extend queries so that template reads/writes are scoped to `user_id = caller` or to the caller’s workspace membership. Service-role access may be reintroduced by passing the authenticated client into `lib/workspace/workspace.service.ts` for multi-tenant filtering.
3. **Input Validation** – Validate JSON schema on POST (max job count, allowed fields) to prevent payload injection that could later be executed.
4. **Tests** – Add `tests/api/dag-templates-auth.test.ts` verifying:  
   - Anonymous requests return 401.  
   - Authenticated user can only see/create templates linked to their workspace.  
   - Attempts to delete another user’s template return 403.

**Verification**
- Run new tests plus affected suites (`npm run test -- test-dag.ts`) to confirm DAG execution still sees templates.

---

## Phase 3 – Research & Telemetry Authorization (HIGH)

**Scope**
- `app/api/web-search/research/list/route.ts`
- `app/api/web-search/research/[id]/route.ts`
- `app/api/web-search/research/[id]/report/route.ts`
- `app/api/web-search/research/[id]/steps/route.ts`
- `app/api/telemetry/web-search/aggregate/route.ts`

**Work Items**
1. **Dual-Mode Auth** – Implement helper `requireUserOrAdmin(request)` (shared util) that:
   - Accepts either a Supabase session bearer token or a server-admin header (e.g., `x-admin-token`).
   - Returns `{ supabaseClient, userId, isAdmin }`.  
   - Enforces token expiration and constant-time comparison for admin token.
2. **Client Selection** – When `userId` is present, replace current `supabaseAdmin` calls with the anon client bound to the user’s Authorization header so RLS enforces ownership. Reserve service-role usage exclusively for the admin-token code path.
3. **Result Filtering** – Even for admin mode, add query filters (e.g., `eq('workspace_id', targetWorkspace)`) to minimize blast radius and log all admin queries.
4. **Tests** – Create `tests/api/research-auth.test.ts` verifying unauthorized calls fail, authenticated users see only their jobs, and admin token returns results while being audited.

**Verification**
- Run new tests and existing research suites (if any), plus a manual curl test that ensures telemetry endpoint returns 401 without credentials.

---

## Cross-Phase Governance

- **Secret Rotation**: After implementing the changes, rotate `DISTRIBUTED_WORKER_API_KEY`, `WEB_SEARCH_ADMIN_TOKEN`, and any existing worker tokens because we must assume they may already be compromised.
- **Documentation**: Update `README.md` / `docs/SECURITY_AUDIT_FINDINGS.md` to reflect the new requirements, header names, and rotation procedures.
- **Monitoring**: Ship alerting for repeated unauthorized hits on the new auth checks (hook into existing logging pipeline).

## Ready for Implementation

With the scope, insertion points, and verification strategy defined above, we can now execute Phase 1. Awaiting approval to begin coding changes.
