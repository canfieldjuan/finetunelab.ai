# JSDoc Deprecation Tags Added

**Date:** 2025-12-21
**Status:** ✅ COMPLETE - Core Services
**Scope:** Service Files and Main Modules

---

## Overview

Added `@deprecated` JSDoc tags to all core export service files. These tags will show up in IDEs and editors, warning developers not to use these modules.

---

## Files Updated

### 1. Conversation Export System (lib/export/)

#### lib/export/index.ts
**Module-level deprecation:**
```typescript
/**
 * @deprecated This export system has been replaced by the Unified Export System (lib/export-unified).
 * Please migrate to /api/export/v2 for all export operations.
 * See migration guide: /docs/export-migration.md
 * This module will be removed after 60-day grace period.
 */
```

#### lib/export/exportService.ts
**Class deprecation:**
```typescript
/**
 * Main Export Service
 *
 * @deprecated This service has been replaced by UnifiedExportService (lib/export-unified).
 * Please use /api/export/v2 instead of this service directly.
 * See migration guide: /docs/export-migration.md
 * This class will be removed after 60-day grace period.
 */
export class ExportService { ... }
```

**Singleton deprecation:**
```typescript
/**
 * Export singleton instance
 *
 * @deprecated Use UnifiedExportService instead via /api/export/v2
 * This instance will be removed after 60-day grace period.
 */
export const exportService = new ExportService();
```

#### lib/export/archiveService.ts
**Class deprecation:**
```typescript
/**
 * Archive Service
 *
 * @deprecated Archive functionality is being moved to a separate API (/api/archive).
 * This service will be removed after 60-day grace period.
 * See migration guide: /docs/export-migration.md
 */
export class ArchiveService { ... }
```

**Singleton deprecation:**
```typescript
/**
 * Archive singleton instance
 *
 * @deprecated Use new /api/archive endpoint instead
 * This instance will be removed after 60-day grace period.
 */
export const archiveService = new ArchiveService();
```

---

### 2. Analytics Export System

#### lib/tools/analytics-export/index.ts
**Tool definition deprecation:**
```typescript
/**
 * Analytics Export Tool - Tool Definition
 * Phase 6: LLM Integration
 * Date: October 25, 2025
 *
 * Enables LLM to create analytics exports and provide download links
 *
 * @deprecated This tool has been replaced by the Unified Export System.
 * Please use /api/export/v2 with exportType="analytics" instead.
 * This tool will be removed after 60-day grace period.
 * See migration guide: /docs/export-migration.md
 */
```

#### lib/analytics/export/csvGenerator.ts
**Module deprecation:**
```typescript
/**
 * CSV Export Generator
 *
 * @deprecated This module has been replaced by lib/export-unified/formatters/CSVFormatter.ts
 * Please use /api/export/v2 instead.
 * This module will be removed after 60-day grace period.
 */
```

#### lib/analytics/export/jsonGenerator.ts
**Module deprecation:**
```typescript
/**
 * JSON Export Generator
 *
 * @deprecated This module has been replaced by lib/export-unified/formatters/JSONFormatter.ts
 * Please use /api/export/v2 instead.
 * This module will be removed after 60-day grace period.
 */
```

#### lib/analytics/export/reportGenerator.ts
**Module deprecation:**
```typescript
/**
 * Report Data Generator
 *
 * @deprecated This module has been replaced by the Unified Export System.
 * Please use /api/export/v2 with appropriate templates instead.
 * This module will be removed after 60-day grace period.
 */
```

---

## What Developers Will See

### In VS Code / TypeScript IDEs

When importing or using deprecated modules:

```typescript
import { exportService } from '@/lib/export';
//      ^~~~~~~~~~~~~
// Deprecated: Use UnifiedExportService instead via /api/export/v2
// This instance will be removed after 60-day grace period.

exportService.generate(userId, options);
// ~~~~~~~~~~~~~
// Strike-through text indicating deprecation
```

### In JSDoc Popups

When hovering over deprecated imports:

```
(deprecated) exportService: ExportService

@deprecated Use UnifiedExportService instead via /api/export/v2
This instance will be removed after 60-day grace period.
```

### In Code Completion

Deprecated items appear with strike-through in autocomplete lists, clearly indicating they should not be used.

---

## Coverage Summary

**Files Tagged:** 7 core service files
**Classes Deprecated:** 2 (ExportService, ArchiveService)
**Singletons Deprecated:** 2 (exportService, archiveService)
**Modules Deprecated:** 4 (index.ts, csvGenerator, jsonGenerator, reportGenerator)
**Tool Definitions Deprecated:** 1 (analytics_export)

---

## Additional Files That Could Be Tagged

These files exist but are lower priority for deprecation tags (can be done in cleanup phase):

### Formatters (lib/export/formatters/)
- `jsonFormatter.ts`
- `jsonlFormatter.ts`
- `markdownFormatter.ts`
- `txtFormatter.ts`
- `index.ts`

### Templates (lib/analytics/export/templates/)
- `executive.ts`
- `engineering.ts`
- `onboarding.ts`
- `types.ts`
- `index.ts`

### Renderers (lib/analytics/export/renderers/)
- `html.ts`
- `pdf.ts`

### Storage (lib/analytics/export/)
- `storage.ts`
- `types.ts`

**Note:** These are implementation details. Since the main API endpoints and services are deprecated, developers shouldn't be importing these directly anyway.

---

## Benefits

### 1. **IDE Warnings**
Developers get immediate visual feedback when trying to use deprecated code

### 2. **Prevents New Usage**
New code is less likely to use deprecated APIs when they're clearly marked

### 3. **Clear Migration Path**
Each deprecation tag points to the replacement (Unified Export System, /api/export/v2)

### 4. **Documentation**
Deprecation notices serve as inline documentation

### 5. **Grace Period Notice**
All tags mention the 60-day grace period, setting expectations

---

## TypeScript Compiler Support

TypeScript doesn't error on `@deprecated` tags by default, but can be configured to warn:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Some linters (ESLint) can be configured to flag deprecated usage:

```json
{
  "rules": {
    "deprecation/deprecation": "warn"
  }
}
```

---

## Best Practices Used

1. **Clear Migration Path:** Each tag explains what to use instead
2. **Consistent Message:** All tags reference the migration guide
3. **Timeline:** All tags mention the 60-day grace period
4. **Non-Breaking:** Tags don't prevent code from running
5. **Graduated Approach:** Core services first, implementation details later

---

## Next Steps

1. ✅ Core service files tagged
2. ⏳ Create migration guide (/docs/export-migration.md)
3. ⏳ Test old and new systems side-by-side
4. ⏳ Monitor usage of deprecated APIs
5. ⏳ Optional: Tag formatter/template files during cleanup

---

## Rollback

If deprecation tags cause confusion:

1. **Easy removal:** Simply delete the `@deprecated` lines
2. **No runtime impact:** Tags are comments only
3. **Git revert:** Can revert the entire commit

```bash
git revert <commit-hash>
```

---

## Compliance with Best Practices

✅ **Clear communication** - Migration path specified
✅ **Grace period** - 60 days mentioned in all tags
✅ **Documentation** - Links to migration guide
✅ **Non-breaking** - Code still works
✅ **Graduated rollout** - Core services first
✅ **IDE support** - Standard JSDoc format

---

## Status

**Core Services:** ✅ COMPLETE (7/7 files)
**Formatters:** ⏳ Optional (can defer to cleanup phase)
**Templates:** ⏳ Optional (can defer to cleanup phase)
**Renderers:** ⏳ Optional (can defer to cleanup phase)

**Overall:** ✅ SUFFICIENT - All critical entry points are marked

---

## Summary Statistics

| Component | Files | Status |
|-----------|-------|--------|
| Conversation Export (core) | 3 | ✅ Complete |
| Analytics Export (core) | 4 | ✅ Complete |
| Formatters | 5 | ⏳ Optional |
| Templates | 4 | ⏳ Optional |
| Renderers | 2 | ⏳ Optional |
| Storage | 1 | ⏳ Optional |
| **Total Core** | **7** | **✅ Done** |
| **Total Optional** | **12** | **⏳ Deferred** |

---

**Approved by:** Development Team
**Date:** 2025-12-21
**Impact:** High visibility for developers, zero runtime impact
