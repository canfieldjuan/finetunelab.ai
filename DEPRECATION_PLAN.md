# Deprecation & Cleanup Plan

**Status:** 🚧 IN PROGRESS
**Created:** 2025-12-21
**Execution:** Methodical, safe, zero-downtime

---

## Overview

This document outlines the systematic deprecation and cleanup of the old export systems now that the Unified Export System (v2) is operational.

**Principle:** We will NOT break anything. Deprecation warnings first, removal only after grace period.

---

## Systems Inventory

### ✅ Systems to Keep (NOT part of unified system)

These have unique requirements and will remain separate:

1. **Search Summaries Export** (`app/api/search-summaries/export/`)
   - Reason: Unique signed token flow
   - Status: Keep as-is
   - Action: None

2. **Demo Export** (`app/api/demo/v2/export/`)
   - Reason: Public access, different security model
   - Status: Keep as-is
   - Action: None

### ⚠️ Systems to Deprecate

These are replaced by Unified Export System v2:

#### 1. Conversation Export System

**Location:** `lib/export/`

**Files to Deprecate:**
- `lib/export/exportService.ts` (main service)
- `lib/export/archiveService.ts` (archive management)
- `lib/export/config.ts` (configuration)
- `lib/export/types.ts` (type definitions)
- `lib/export/formatters/jsonFormatter.ts`
- `lib/export/formatters/jsonlFormatter.ts`
- `lib/export/formatters/markdownFormatter.ts`
- `lib/export/formatters/txtFormatter.ts`

**API Routes (if they exist):**
- `app/api/export/generate/route.ts` (if exists)
- `app/api/export/download/[id]/route.ts` (if exists)
- `app/api/export/archive/route.ts` (if exists)

**Database Tables:**
- `conversation_exports` - Keep read-only for 60 days

**Components:**
- `components/export/ExportDialog.tsx` - Update to use v2 API

**Status:** Replace with v2 API

#### 2. Analytics Export System

**Location:** `lib/analytics/export/` + `lib/tools/analytics-export/`

**Files to Deprecate:**
- `lib/tools/analytics-export/analytics-export.service.ts`
- `lib/tools/analytics-export/config.ts`
- `lib/analytics/export/csvGenerator.ts` (if exists)
- `lib/analytics/export/jsonGenerator.ts` (if exists)
- `lib/analytics/export/reportGenerator.ts` (if exists)
- `lib/analytics/export/storage.ts` (if exists)
- `lib/analytics/export/templates/*` (if exist)
- `lib/analytics/export/renderers/*` (if exist)

**API Routes:**
- `app/api/analytics/export/route.ts` (if exists)

**Database Tables:**
- `analytics_exports` - Keep read-only for 60 days

**Components:**
- `components/analytics/ExportButton.tsx` - Update to use v2 API
- `components/analytics/ExportModal.tsx` - Update to use v2 API
- `components/analytics/ExportFormatSelector.tsx` - Update to use v2 API
- `components/analytics/ExportTypeSelector.tsx` - Update to use v2 API
- `components/analytics/ExportHistory.tsx` - Update to use v2 API

**Status:** Replace with v2 API

#### 3. Client-Side Utilities

**Location:** `lib/utils/` and root `lib/`

**Files to Review:**
- `lib/csv-export.ts` - Client-side CSV utilities
- `lib/utils/export.ts` - General export utilities

**Status:** Review if still needed for client-side exports

---

## Deprecation Strategy (Phase 8)

### Step 1: Inventory (CURRENT)
- [x] Document all old export code
- [ ] Verify which files actually exist
- [ ] Identify all API endpoints to deprecate
- [ ] Identify all UI components to update

### Step 2: Add Deprecation Warnings (Safe)
- [ ] Add `@deprecated` JSDoc comments to old functions
- [ ] Add deprecation headers to old API endpoints (if they exist)
- [ ] Add console warnings when old code is used
- [ ] NO CODE REMOVAL - only warnings

### Step 3: Create Migration Guide
- [ ] Document how to migrate from old to new API
- [ ] Code examples for common use cases
- [ ] Update README with migration instructions

### Step 4: Update UI Components
- [ ] Update `ExportDialog.tsx` to use v2 API (optional - keep backward compatible)
- [ ] Update analytics export components to use v2 API (optional)
- [ ] Add UI notices about new API

### Step 5: Grace Period (30-60 days)
- [ ] Monitor old endpoint usage
- [ ] Send notifications to users
- [ ] Collect feedback
- [ ] NO CODE REMOVAL

---

## Cleanup Strategy (Phase 9)

**IMPORTANT:** Only execute after grace period and verification!

### Step 1: Database Backup
- [ ] Export all records from `conversation_exports` table
- [ ] Export all records from `analytics_exports` table
- [ ] Store backups in secure location
- [ ] Verify backup integrity

### Step 2: Make Tables Read-Only
- [ ] Revoke INSERT/UPDATE/DELETE on `conversation_exports`
- [ ] Revoke INSERT/UPDATE/DELETE on `analytics_exports`
- [ ] Keep SELECT permission for fallback reads
- [ ] Monitor for any write attempts

### Step 3: Code Removal (Careful!)
- [ ] Remove deprecated files (only after grace period)
- [ ] Update imports in remaining code
- [ ] Run full test suite
- [ ] Verify no references remain

### Step 4: Database Cleanup (After 60 days)
- [ ] Drop `conversation_exports` table (only after backup + verification)
- [ ] Drop `analytics_exports` table (only after backup + verification)
- [ ] Update database documentation

---

## Safety Checks

Before removing ANY code:

✅ **Pre-Removal Checklist:**
1. [ ] Grace period completed (30-60 days)
2. [ ] No usage detected in logs for 30 days
3. [ ] All UI components migrated
4. [ ] Database backups verified
5. [ ] Rollback plan documented
6. [ ] Team approval received

❌ **Do NOT Remove If:**
- Still seeing usage in logs
- No backup exists
- Test failures
- Team hasn't approved
- Within grace period

---

## Rollback Plan

If issues arise after deprecation:

1. **Immediate Rollback:**
   - Revert code changes via git
   - Restore database permissions
   - Notify users

2. **Partial Rollback:**
   - Keep old API alongside new API
   - Extend grace period
   - Fix issues in v2 API

3. **Communication:**
   - Status page update
   - Email to affected users
   - Postmortem document

---

## Migration Guide Template

Will create detailed guide covering:

1. **API Changes:**
   - Old endpoint → New endpoint mapping
   - Request format changes
   - Response format changes

2. **Code Examples:**
   - Before/After code snippets
   - Common migration patterns
   - Error handling changes

3. **Testing:**
   - How to verify migration
   - Testing checklist
   - Common issues

---

## Current Status

**Phase 8: Deprecation**
- [x] Step 1.1: Create deprecation plan document
- [ ] Step 1.2: Verify which old files exist
- [ ] Step 1.3: Identify old API endpoints
- [ ] Step 2: Add deprecation warnings
- [ ] Step 3: Create migration guide
- [ ] Step 4: Update UI components (optional)
- [ ] Step 5: Monitor grace period

**Phase 9: Cleanup**
- [ ] Not started (will begin after Phase 8 completion)

---

## Timeline

**Week 1 (Current):**
- Complete inventory
- Add deprecation warnings
- Create migration guide

**Week 2-5 (Grace Period):**
- Monitor usage
- Collect feedback
- Support migration
- NO REMOVAL

**Week 6+ (Cleanup - ONLY if safe):**
- Backup databases
- Make tables read-only
- Remove deprecated code (carefully!)
- Final verification

---

## Next Steps

1. ✅ Create this plan document
2. ⏳ Verify which old export files actually exist
3. ⏳ Find old API endpoints (if any)
4. ⏳ Add deprecation warnings (safe, non-breaking)
5. ⏳ Create migration guide
6. ⏳ Wait for grace period
7. ⏳ Execute cleanup (only after verification)

---

## Notes

- **Priority:** Safety over speed
- **Approach:** Gradual, monitored, reversible
- **Testing:** Extensive before each step
- **Communication:** Transparent with users
- **Backup:** Always, before any removal

**Remember:** We can always extend the grace period. We cannot undo deletions.
