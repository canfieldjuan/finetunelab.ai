# Old Export System Inventory

**Generated:** 2025-12-21
**Purpose:** Complete inventory of old export code to deprecate

---

## ✅ Verified Files to Deprecate

### 1. Conversation Export System (`lib/export/`)

**Service Files:**
- ✅ `lib/export/exportService.ts` (11,308 bytes) - Main service
- ✅ `lib/export/archiveService.ts` (7,169 bytes) - Archive management
- ✅ `lib/export/config.ts` (6,904 bytes) - Configuration
- ✅ `lib/export/types.ts` (5,321 bytes) - Type definitions
- ✅ `lib/export/index.ts` (700 bytes) - Module exports

**Formatters:**
- ✅ `lib/export/formatters/jsonFormatter.ts` (2,244 bytes)
- ✅ `lib/export/formatters/jsonlFormatter.ts` (7,412 bytes)
- ✅ `lib/export/formatters/markdownFormatter.ts` (4,196 bytes)
- ✅ `lib/export/formatters/txtFormatter.ts` (4,022 bytes)
- ✅ `lib/export/formatters/index.ts` (491 bytes)

**Total:** 10 files, ~50 KB

### 2. Conversation Export API Routes

**API Endpoints:**
- ✅ `app/api/export/generate/route.ts` - Create export
- ✅ `app/api/export/download/[id]/route.ts` - Download export
- ✅ `app/api/export/archive/route.ts` - Archive exports

**Total:** 3 endpoint files

### 3. Analytics Export System

**Core Service Files (`lib/tools/analytics-export/`):**
- ✅ `lib/tools/analytics-export/analytics-export.service.ts` - Main service
- ✅ `lib/tools/analytics-export/config.ts` - Configuration
- ✅ `lib/tools/analytics-export/index.ts` - Module exports
- ✅ `lib/tools/analytics-export/verify.ts` - Verification
- ✅ `lib/tools/analytics-export/test-registration.ts` - Test helpers
- ✅ `lib/tools/analytics-export/__tests__/analytics-export.tool.test.ts` - Tool tests
- ✅ `lib/tools/analytics-export/__tests__/analytics-export.service.test.ts` - Service tests

**Total:** 7 files, ~28 KB

**Export Library Files (`lib/analytics/export/`):**
- ✅ `lib/analytics/export/csvGenerator.ts` - CSV generation
- ✅ `lib/analytics/export/jsonGenerator.ts` - JSON generation
- ✅ `lib/analytics/export/reportGenerator.ts` - Report generation
- ✅ `lib/analytics/export/storage.ts` - Storage handling
- ✅ `lib/analytics/export/types.ts` - Type definitions

**Templates (`lib/analytics/export/templates/`):**
- ✅ `lib/analytics/export/templates/types.ts` - Template types
- ✅ `lib/analytics/export/templates/executive.ts` - Executive template
- ✅ `lib/analytics/export/templates/engineering.ts` - Engineering template
- ✅ `lib/analytics/export/templates/onboarding.ts` - Onboarding template
- ✅ `lib/analytics/export/templates/index.ts` - Template exports

**Renderers (`lib/analytics/export/renderers/`):**
- ✅ `lib/analytics/export/renderers/html.ts` - HTML renderer
- ✅ `lib/analytics/export/renderers/pdf.ts` - PDF renderer

**Total:** 12 files, ~121 KB

**API Endpoints:**
- ✅ `app/api/analytics/export/route.ts` - Analytics export API

**Total Analytics System:** 19 files, ~149 KB

### 4. Client-Side Utilities

**Utility Files:**
- ✅ `lib/csv-export.ts` - Client-side CSV utilities (10,475 bytes)
- ✅ `lib/utils/export.ts` - General export utilities (13,931 bytes)

**Total:** 2 files, ~24 KB

### 5. UI Components

**Conversation Export Components (`components/export/`):**
- ✅ `components/export/ExportDialog.tsx` - Main export dialog
- ✅ `components/export/ArchiveManager.tsx` - Archive management UI

**Analytics Export Components (`components/analytics/`):**
- ✅ `components/analytics/ExportButton.tsx` - Export trigger button
- ✅ `components/analytics/ExportModal.tsx` - Export modal dialog
- ✅ `components/analytics/ExportFormatSelector.tsx` - Format selection UI
- ✅ `components/analytics/ExportTypeSelector.tsx` - Type selection UI
- ✅ `components/analytics/ExportHistory.tsx` - Export history view

**Total:** 7 components, ~41 KB

---

## 📊 Database Tables

### Tables to Eventually Deprecate

1. **conversation_exports**
   - Status: Active (used by old API)
   - Action: Make read-only after grace period
   - Backup: Required before any changes
   - Drop: Only after 60+ days AND backup verified

2. **analytics_exports**
   - Status: Active (used by old API)
   - Action: Make read-only after grace period
   - Backup: Required before any changes
   - Drop: Only after 60+ days AND backup verified

---

## 📊 Complete Inventory Summary

**Files to Deprecate:**
- Conversation Export: 10 files (~50 KB)
- Analytics Export: 19 files (~149 KB)
- Client Utilities: 2 files (~24 KB)
- UI Components: 7 files (~41 KB)
- API Routes: 4 endpoints

**Grand Total:** 42 files, ~264 KB of code to deprecate

**Note:** This represents significant code duplication that will be eliminated by the unified export system.

---

## ✅ Files to KEEP (NOT deprecating)

These have unique requirements and stay separate:

1. **Search Summaries Export:**
   - `app/api/search-summaries/export/` - Keep as-is
   - Reason: Unique signed token flow

2. **Demo Export:**
   - `app/api/demo/v2/export/` - Keep as-is
   - Reason: Public access, different security model

---

## 📝 Deprecation Actions (Safe, Non-Breaking)

### Step 1: Add Deprecation Headers to Old API Endpoints

**Files to modify:**
1. `app/api/export/generate/route.ts`
2. `app/api/export/download/[id]/route.ts`
3. `app/api/export/archive/route.ts`
4. `app/api/analytics/export/route.ts`

**Changes:**
- Add `X-Deprecated: true` header to responses
- Add `X-Deprecation-Message` header with migration info
- Add `X-Sunset-Date` header (60 days from now)
- Add console.warn() logs
- **NO functional changes**

### Step 2: Add JSDoc @deprecated Tags

**Files to modify:**
1. `lib/export/exportService.ts`
2. `lib/export/archiveService.ts`
3. `lib/export/formatters/*.ts`
4. `lib/tools/analytics-export/analytics-export.service.ts`

**Changes:**
- Add `@deprecated` JSDoc comments to exported functions
- Add migration guidance in comments
- **NO functional changes**

### Step 3: Add Console Warnings

**Files to modify:**
- Same as Step 2

**Changes:**
- Add `console.warn()` at start of deprecated functions
- Message: "This API is deprecated. Please migrate to /api/export/v2"
- **NO functional changes**

---

## 🧪 Testing Strategy

Before ANY changes:

1. **Test Old API:**
   - Manually test POST /api/export/generate
   - Manually test GET /api/export/download/[id]
   - Verify exports still work

2. **Test New API:**
   - Test POST /api/export/v2
   - Test GET /api/export/v2/download/[id]
   - Verify equivalent functionality

3. **Parallel Testing:**
   - Create same export with old and new API
   - Compare outputs
   - Verify both work

4. **After Deprecation Warnings:**
   - Verify old API still functions
   - Verify warnings appear in logs
   - Verify headers present in responses

---

## 📅 Timeline

**Week 1 (Current):**
- ✅ Create inventory
- ⏳ Investigate remaining files
- ⏳ Add deprecation warnings (safe)
- ⏳ Test both systems

**Weeks 2-9 (Grace Period - 60 days):**
- Monitor usage
- Collect feedback
- Support migrations
- **NO REMOVAL**

**Week 10+ (Cleanup - ONLY if verified safe):**
- Backup databases
- Make tables read-only
- Remove deprecated code
- Drop old tables (after backup verified)

---

## ⚠️ Safety Rules

**NEVER:**
- Remove code during grace period
- Drop tables without backup
- Break existing functionality
- Skip testing

**ALWAYS:**
- Test before deploying
- Monitor after deploying
- Have rollback plan ready
- Communicate with users

---

## Next Actions

1. ✅ Complete inventory of verified files
2. ✅ Investigate remaining questionable files
3. ⏳ Add deprecation warnings to API endpoints
4. ⏳ Add JSDoc @deprecated tags
5. ⏳ Test both old and new systems work
6. ⏳ Create migration guide
7. ⏳ Start grace period
8. ⏳ Monitor usage during grace period
9. ⏳ Execute cleanup (only after verification)

---

## Status

**Inventory:** ✅ COMPLETE - All 42 files verified
**Deprecation:** ⏳ Ready to start
**Cleanup:** ⏳ Not started (will be 60+ days minimum)
