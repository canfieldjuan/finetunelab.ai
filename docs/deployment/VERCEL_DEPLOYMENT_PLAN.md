# Vercel Deployment Plan - FineTune Lab

**Created:** 2025-12-10
**Status:** Phases 1-4 Complete
**Last Updated:** 2025-12-11

---

## Phase 1 Audit Results (COMPLETE)

### Audit Summary

| Category | Count | Status |
|----------|-------|--------|
| Config files with env var fallbacks | 8 | GOOD - All use `process.env` |
| Template placeholders (UI only) | 11 | OK - User-editable fields |
| Test files | 6 | OK - Not deployed |
| node_modules | 15+ | OK - Ignored |
| Hardcoded without env var | 2 | NEEDS FIX |
| Comments/docs only | 8 | OK - No runtime impact |

### Files Requiring Attention

**GOOD - Already use environment variables:**
- `lib/config/endpoints.ts` - Centralized config, all 7 endpoints use env vars
- `lib/config/services.ts` - Uses `getEnvString()` helper
- `lib/config/agent.ts` - Uses `getEnvString()` helper
- `lib/graphrag/config.ts` - Uses `getEnvVar()` helper
- `lib/graphrag/graphiti/client.ts` - Uses `process.env.GRAPHITI_API_URL`
- `components/training/CheckpointResumeCard.tsx` - Uses env var fallback
- `components/training/JobRecoveryCard.tsx` - Uses env var fallback
- All `app/api/` routes - Use env var fallbacks

**OK - Template placeholders (user-editable, not runtime):**
- `lib/models/model-templates.ts` lines 332, 349, 366, 390, 407, 650, 667, 684
- `components/models/AddModelDialog.tsx` lines 988, 993
- `components/training/dag/config-forms/*.tsx` - Form placeholders

**OK - Test files (not deployed):**
- `lib/tools/prompt-extractor/validation-test.ts`
- `lib/tools/filesystem/test-adapter.ts`
- `app/api/__tests__/test-api-keys.ts`
- `components/training/workflow/useWorkflowState.test.tsx`

**FIXED - Hardcoded validation messages (2025-12-11):**
- `lib/training/validate-job-queue.ts:124` - Now uses `${redisHost}:${redisPort}` env vars
- `lib/training/validate-state-store.ts:82-88` - Now uses `${redisHost}:${redisPort}` env vars

### Files Created

- `.env.production.example` - Production environment template with all required variables
- `lib/training/redis-client.ts` - Redis client factory for Upstash/ioredis compatibility (Phase 3)
- `lib/storage/export-storage.ts` - Export storage abstraction for Supabase/filesystem (Phase 4)
- `lib/storage/index.ts` - Storage module exports

---

## Executive Summary

This document outlines the phased implementation plan to deploy FineTune Lab's Next.js frontend to Vercel while properly separating backend services that require persistent infrastructure.

---

## Current Architecture Analysis

### Services Currently Running on localhost

| Service | Current URL | Port | Type | Vercel Compatible? |
|---------|-------------|------|------|-------------------|
| Next.js App | localhost:3000 | 3000 | Frontend | YES |
| Training Server | localhost:8000 | 8000 | Python FastAPI | NO - needs external |
| Graphiti (GraphRAG) | localhost:8001 | 8001 | Python + Neo4j | NO - needs external |
| Ollama | localhost:11434 | 11434 | Go binary | NO - needs external |
| vLLM | localhost:8003 | 8003 | Python + GPU | NO - needs external |
| Neo4j | localhost:7687 | 7687 | Database | NO - needs external |
| Redis | localhost:6379 | 6379 | Cache/Queue | NO - needs Upstash |

### Files with localhost References (Source Code Only)

**Configuration Files:**
- `lib/config/endpoints.ts` - Centralized endpoint config (GOOD - uses env vars)
- `lib/config/services.ts` - Service config with Redis
- `lib/config/agent.ts` - Training server URL
- `lib/graphrag/config.ts` - Neo4j URI
- `lib/graphrag/graphiti/client.ts` - Graphiti API URL

**Components with Fallbacks:**
- `components/training/CheckpointResumeCard.tsx:88`
- `components/training/JobRecoveryCard.tsx:45`
- `components/training/dag/config-forms/*.tsx` (placeholders only)

**Services:**
- `lib/services/inference-server-manager.ts` - Spawns processes (NOT Vercel compatible)
- `lib/training/worker-manager.ts` - Redis + BullMQ
- `lib/training/job-queue.ts` - Redis queue
- `lib/training/state-store.ts` - Redis state

### Environment Variables Required for Production

```env
# REQUIRED - Already External
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# REQUIRED - Need External Services
NEXT_PUBLIC_TRAINING_BACKEND_URL=https://your-training-server.com
GRAPHITI_API_URL=https://your-graphiti-server.com
NEO4J_URI=bolt://your-neo4j-host:7687
REDIS_URL=redis://your-upstash-redis.com:6379

# OPTIONAL - Cloud Providers (already external)
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
BRAVE_SEARCH_API_KEY=xxx

# NOT NEEDED ON VERCEL
OLLAMA_BASE_URL=           # No local Ollama on Vercel
VLLM_PYTHON_PATH=          # No Python environment on Vercel
VLLM_EXTERNAL_URL=         # Connect to external vLLM if needed
```

---

## Issues Identified

### Issue 1: Process Spawning (CRITICAL)
**File:** `lib/services/inference-server-manager.ts`
**Problem:** Uses `spawn()`, `execSync()`, `spawnSync()` for vLLM/Ollama
**Impact:** Will fail silently or error on Vercel
**Solution:** These APIs already check env vars for external URLs; ensure they're set

### Issue 2: Redis/BullMQ Job Queue (CRITICAL)
**Files:**
- `lib/training/worker-manager.ts`
- `lib/training/job-queue.ts`
- `lib/training/state-store.ts`
**Problem:** Requires persistent Redis connection
**Solution:** Use Upstash Redis (serverless-compatible)

### Issue 3: File System Operations (MODERATE)
**Files:**
- `app/api/export/download/[id]/route.ts`
- `app/api/training/execute/route.ts`
- `app/api/training/[id]/download-package/route.ts`
**Problem:** Uses `/tmp` for file operations (ephemeral on Vercel)
**Solution:** Use Supabase Storage for persistent files

### Issue 4: Long-Running Operations (MODERATE)
**File:** `app/api/graphrag/process/[id]/route.ts`
**Problem:** Has `maxDuration = 3600` (60 min) - exceeds Vercel limits
**Solution:** Vercel Pro supports up to 300s; move long ops to external service

### Issue 5: Neo4j/Graphiti Dependency (MODERATE)
**Files:**
- `lib/graphrag/config.ts`
- `lib/graphrag/graphiti/client.ts`
**Problem:** Points to localhost by default
**Solution:** Environment variables already support external URLs

---

## Phased Implementation Plan

### Phase 1: Environment Configuration (No Code Changes)
**Goal:** Ensure all localhost references use environment variables
**Risk:** LOW
**Effort:** 1-2 hours

**Tasks:**
1. Audit all env var usage in `lib/config/endpoints.ts`
2. Create `.env.production` template
3. Document required external services

**Verification:**
- Run `grep -r "localhost" --include="*.ts" lib/` to confirm all use env vars

---

### Phase 2: Conditional Service Loading (COMPLETE - 2025-12-11)
**Goal:** Prevent process spawning code from running on Vercel
**Risk:** MEDIUM
**Effort:** 2-4 hours

**Status:** IMPLEMENTED

**Changes Made:**
- `lib/services/inference-server-manager.ts` - Vercel guards added at lines 28, 164, 412, 450
  - Line 28: Early guard for Vercel environment
  - Line 164: vLLM external URL check with `process.env.VERCEL || process.env.VLLM_EXTERNAL_URL`
  - Line 412: Additional Vercel guard
  - Line 450: Ollama guard in `ensureOllamaRunning()`

**Verification:**
- TypeScript compilation passes
- Guards prevent process spawning on Vercel

---

### Phase 3: Redis to Upstash Migration (COMPLETE - 2025-12-11)
**Goal:** Create Redis client factory for Upstash/ioredis compatibility
**Risk:** MEDIUM
**Effort:** 4-6 hours

**Status:** IMPLEMENTED

**Files Created:**
- `lib/training/redis-client.ts` - Redis client factory with:
  - `getRedisConfig()` - Gets Redis options from env vars (UPSTASH_REDIS_URL, REDIS_URL, or host/port)
  - `createRedisClient()` - Creates ioredis client with proper config
  - `isUpstashRedis()` - Detects Upstash environment
  - `isRedisConfigured()` - Checks if Redis is available
  - `getRedisConnectionInfo()` - Safe logging helper

**Files Modified:**
- `lib/config/services.ts` - Added `url` and `isUpstash` properties to redis config

**Environment Variables Supported:**
- `UPSTASH_REDIS_URL` - Upstash TCP connection (rediss://...)
- `REDIS_URL` - Standard Redis URL
- `REDIS_HOST` / `REDIS_PORT` - Individual host/port config

**Note:** BullMQ requires ioredis TCP connection. Upstash TCP (not REST) is compatible.

**Verification:**
- TypeScript compilation passes
- Factory supports both local Redis and Upstash

---

### Phase 4: File Storage Migration (COMPLETE - 2025-12-11)
**Goal:** Create storage abstraction for Supabase Storage / local filesystem
**Risk:** MEDIUM
**Effort:** 4-6 hours

**Status:** IMPLEMENTED

**Files Created:**
- `lib/storage/export-storage.ts` - Export storage abstraction with:
  - `saveExport()` - Saves to Supabase Storage or local filesystem
  - `getExport()` - Retrieves from storage (detects `storage://` prefix)
  - `deleteExport()` - Deletes from appropriate storage
  - `exportExists()` - Checks if export exists
  - `useSupabaseStorage()` - Auto-detects Vercel or explicit config
  - `isSupabaseStoragePath()` - Checks for `storage://` prefix
  - `getStorageInfo()` - Safe logging helper
- `lib/storage/index.ts` - Module exports

**Storage Path Convention:**
- Supabase Storage paths: `storage://exports/filename.ext`
- Local filesystem paths: `/tmp/exports/filename.ext`

**Environment Variables:**
- `EXPORT_USE_SUPABASE_STORAGE=true` - Force Supabase Storage
- `VERCEL` - Auto-detected, uses Supabase Storage
- `EXPORT_STORAGE_PATH` - Local storage path (default: /tmp/exports)

**Files to Update (integration pending):**
- `app/api/export/download/[id]/route.ts` - Use `getExport()` from storage module
- `lib/export/exportService.ts` - Use `saveExport()` from storage module

**Verification:**
- TypeScript compilation passes
- Abstraction supports both local and Supabase Storage

---

### Phase 5: External Service Configuration (Infrastructure)
**Goal:** Set up external services for production
**Risk:** LOW
**Effort:** 2-4 hours (per service)

**Services to Deploy:**
1. **Upstash Redis** - Create via Vercel integration
2. **Neo4j Aura** - Managed Neo4j (or self-hosted on Railway)
3. **Graphiti Service** - Deploy to Railway/Render
4. **Training Server** - Already on RunPod

**Verification:**
- All services reachable from Vercel
- Health checks pass

---

### Phase 6: Vercel Deployment & Testing
**Goal:** Deploy to Vercel and validate
**Risk:** LOW
**Effort:** 2-4 hours

**Tasks:**
1. Connect GitHub repo to Vercel
2. Configure environment variables
3. Deploy preview branch
4. Run smoke tests
5. Fix any runtime issues

**Verification:**
- All pages load
- Authentication works
- Chat functionality works
- Training job submission works (to external server)

---

## Service Dependency Matrix

| Feature | Supabase | Redis | Neo4j | Training Server | Graphiti |
|---------|----------|-------|-------|-----------------|----------|
| Auth | YES | - | - | - | - |
| Chat | YES | - | - | - | Optional |
| Models | YES | - | - | - | - |
| Training | YES | YES | - | YES | - |
| GraphRAG | YES | - | YES | - | YES |
| Analytics | YES | - | - | - | - |
| Batch Testing | YES | Optional | - | - | - |

---

## Rollback Plan

If deployment fails:
1. Revert Vercel deployment to previous version
2. Keep localhost configuration for local development
3. Address specific failing component before retry

---

## Open Questions

1. **Graphiti hosting**: Railway vs Render vs self-hosted?
2. **Redis tier**: Upstash free tier sufficient for initial launch?
3. **File size limits**: 4.5MB default on Vercel - need Pro for larger uploads?
4. **Domain**: Custom domain or Vercel subdomain initially?

---

## Exact Code Changes Required

### Phase 2: Inference Server Manager Changes

**File:** `lib/services/inference-server-manager.ts`

**Issue Found at Line 155-157:**
```typescript
// CURRENT CODE (problematic):
if (process.env.VLLM_EXTERNAL_URL) {
  console.warn('[InferenceServerManager] Ignoring VLLM_EXTERNAL_URL – native launcher is enforced.');
}
```

**Proposed Change:**
```typescript
// NEW CODE:
if (process.env.VERCEL || process.env.VLLM_EXTERNAL_URL) {
  // On Vercel or when external URL configured, don't attempt to spawn local process
  const externalUrl = process.env.VLLM_EXTERNAL_URL;
  if (!externalUrl) {
    throw new Error(
      'Cannot spawn vLLM on Vercel. Set VLLM_EXTERNAL_URL to point to an external vLLM server.'
    );
  }
  console.log('[InferenceServerManager] Using external vLLM:', externalUrl);
  return {
    serverId: `external-${Date.now()}`,
    baseUrl: externalUrl,
    port: 0,
    status: 'running' as const,
  };
}
```

**Additional Guard for Ollama (Line ~389):**
```typescript
// Add at start of ensureOllamaRunning():
if (process.env.VERCEL) {
  throw new Error(
    'Cannot spawn Ollama on Vercel. Use OLLAMA_BASE_URL to point to an external Ollama server.'
  );
}
```

**Files Affected by This Change:**
- `lib/services/inference-server-manager.ts` (direct change)
- No other files affected (this is the only process spawning location)

---

### Phase 3: Redis Adapter Changes

**Current Implementation:**
- `lib/training/worker-manager.ts` - Line 14: `import { Redis } from 'ioredis';`
- `lib/training/job-queue.ts` - Uses BullMQ with ioredis
- `lib/training/state-store.ts` - Uses ioredis directly

**Proposed Approach: Create Redis Adapter**

**New File:** `lib/training/redis-client.ts`
```typescript
/**
 * Redis Client Factory
 * Returns ioredis for local development, Upstash for Vercel
 */
import { Redis as IORedis } from 'ioredis';

// Upstash REST-based client for serverless
let upstashClient: unknown = null;

export async function getRedisClient() {
  // If UPSTASH_REDIS_REST_URL is set, use Upstash
  if (process.env.UPSTASH_REDIS_REST_URL) {
    if (!upstashClient) {
      const { Redis } = await import('@upstash/redis');
      upstashClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
    return upstashClient;
  }

  // Otherwise use ioredis for local development
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379');
  return new IORedis({ host, port });
}

export function isUpstash(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL;
}
```

**Files to Modify:**
1. `lib/training/worker-manager.ts` - Replace direct ioredis import with factory
2. `lib/training/state-store.ts` - Replace direct ioredis import with factory
3. `lib/config/services.ts` - Add Upstash config options

**BullMQ Consideration:**
BullMQ requires ioredis and doesn't work with Upstash REST API. Options:
1. Use Upstash's ioredis-compatible connection (requires Upstash Pro)
2. Move job queue logic to external service
3. Replace BullMQ with Upstash Queue (different API)

**Recommendation:** Start with Upstash Pro for ioredis compatibility, or move job processing entirely to external training server.

---

### Phase 4: File Storage Changes

**File 1:** `app/api/export/download/[id]/route.ts`

**Current Code (Line 74):**
```typescript
const fileContent = await readFile(exportInfo.filePath);
```

**Proposed Change:**
```typescript
// Check if file is in Supabase Storage or local filesystem
if (exportInfo.filePath.startsWith('storage://')) {
  // Fetch from Supabase Storage
  const storagePath = exportInfo.filePath.replace('storage://', '');
  const { data, error } = await supabase.storage
    .from('exports')
    .download(storagePath);
  if (error) throw error;
  const fileContent = Buffer.from(await data.arrayBuffer());
} else {
  // Local filesystem (development only)
  const fileContent = await readFile(exportInfo.filePath);
}
```

**New File:** `lib/storage/export-storage.ts`
```typescript
/**
 * Export Storage Abstraction
 * Uses Supabase Storage in production, local filesystem in development
 */
export class ExportStorage {
  async saveExport(content: Buffer, filename: string): Promise<string> {
    if (process.env.VERCEL) {
      const { data, error } = await supabase.storage
        .from('exports')
        .upload(`exports/${filename}`, content);
      if (error) throw error;
      return `storage://exports/${filename}`;
    }
    // Local: save to /tmp
    const localPath = `/tmp/${filename}`;
    await writeFile(localPath, content);
    return localPath;
  }

  async getExport(path: string): Promise<Buffer> {
    if (path.startsWith('storage://')) {
      const storagePath = path.replace('storage://', '');
      const { data, error } = await supabase.storage
        .from('exports')
        .download(storagePath);
      if (error) throw error;
      return Buffer.from(await data.arrayBuffer());
    }
    return await readFile(path);
  }
}
```

---

## Verification Checklist

### Pre-Deployment Checks
- [x] All env vars documented in `.env.example`
- [x] No hardcoded `localhost` in source files (except as fallbacks)
- [ ] `npm run build` succeeds locally
- [x] TypeScript compilation passes

### Implementation Checks (2025-12-11)
- [x] Phase 2: Vercel guards in inference-server-manager.ts
- [x] Phase 3: Redis client factory created (lib/training/redis-client.ts)
- [x] Phase 4: Export storage abstraction created (lib/storage/export-storage.ts)
- [x] Hardcoded localhost fixed in validate-job-queue.ts
- [x] Hardcoded localhost fixed in validate-state-store.ts
- [x] services.ts updated with Upstash config options

### Post-Deployment Checks
- [ ] Health check endpoint responds
- [ ] Authentication flow works
- [ ] Chat completion works (Supabase + OpenAI)
- [ ] Training job submission works (external server)
- [ ] GraphRAG search works (external Graphiti)
- [ ] Export download works (Supabase Storage)

---

## Next Steps

1. [x] Review and approve this plan
2. [x] Phase 1: Environment audit - COMPLETE
3. [x] Phase 2: Vercel guards - COMPLETE
4. [x] Phase 3: Redis adapter - COMPLETE
5. [x] Phase 4: Storage abstraction - COMPLETE
6. [ ] Integrate storage abstraction into export routes
7. [ ] Set up Upstash Redis account
8. [ ] Decide on Graphiti hosting solution
9. [ ] Phase 5: External service configuration
10. [ ] Phase 6: Vercel deployment & testing
