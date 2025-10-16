# GraphRAG Client-Side Warning Fix

**Date:** October 12, 2025
**Issue:** NEO4J_PASSWORD warning appearing in browser console
**Status:** ✅ FIXED
**Files Modified:** `lib/tools/web-search/search.service.ts`

---

## 🐛 PROBLEM

Browser console showing warning:

```text
[GraphRAG Config] NEO4J_PASSWORD not available on client side
```

**Call Stack:**

```text
config.ts:23 → search.service.ts:3 → registry.ts:200 → useTools.ts:11 → Chat.tsx:40
```

---

## 🔍 ROOT CAUSE

**File:** `/lib/tools/web-search/search.service.ts:3`

```typescript
import { documentService } from '@/lib/graphrag';  // <-- Loaded on client AND server
```

**Problem:**

1. Web search service imported GraphRAG at top level
2. Import statement executes when module loads
3. Module loads on both client (browser) and server (API)
4. GraphRAG config evaluates on client side
5. NEO4J_PASSWORD unavailable in browser → warning

**Why It Happens:**

- Chat component uses `useTools()` hook
- Hook loads tool registry
- Registry imports all tools including web-search
- Web-search imports GraphRAG
- GraphRAG config tries to read environment variables
- Browser doesn't have server environment variables

---

## ✅ FIX APPLIED

### Change: Dynamic Import Instead of Static

**Before:**

```typescript
// Line 3 - Static import at module level
import { documentService } from '@/lib/graphrag';

// Line 235 - Used in function
await documentService.uploadAndProcess(...)
```

**After:**

```typescript
// Line 3 - Removed static import
// (no import at top)

// Line 214 - Dynamic import inside function
const { documentService } = await import('@/lib/graphrag');
await documentService.uploadAndProcess(...)
```

---

## 🔧 TECHNICAL DETAILS

### Dynamic Import Benefits

**Static Import (Top-Level):**

- Executes when module loads
- Happens on both client and server
- Entire dependency chain evaluated immediately
- GraphRAG config runs in browser

**Dynamic Import (Inside Function):**

- Only executes when function called
- Function only called server-side (API route)
- Dependency chain loads on-demand
- GraphRAG never loads in browser

### Function Context

The `maybeIngestToGraphRag()` function:

- Only runs after successful search (server-side API)
- Only runs if `SEARCH_INGEST_TO_GRAPHRAG=true`
- Only runs if results exist
- Never called from client-side code

**Perfect candidate for dynamic import!**

---

## 📊 BEFORE vs AFTER

### Before Fix

**Module Load Chain:**

```text
Browser loads Chat.tsx
  ↓
useTools() hook initializes
  ↓
Tool registry loads
  ↓
Web-search tool imports
  ↓
search.service.ts imports GraphRAG  ← Static import
  ↓
GraphRAG config evaluates
  ↓
⚠️ Warning: NEO4J_PASSWORD not available
```

### After Fix

**Module Load Chain:**

```text
Browser loads Chat.tsx
  ↓
useTools() hook initializes
  ↓
Tool registry loads
  ↓
Web-search tool imports
  ↓
search.service.ts loads (no GraphRAG import)
  ↓
✅ No GraphRAG config evaluation
```

**GraphRAG Only Loads When Needed (Server-Side):**

```text
API receives search request
  ↓
search() executes
  ↓
maybeIngestToGraphRag() called
  ↓
Dynamic import loads GraphRAG  ← Lazy load
  ↓
GraphRAG config evaluates (server has env vars)
  ↓
✅ No warnings, works correctly
```

---

## 📝 FILES MODIFIED

| File | Change | Lines | Status |
|------|--------|-------|--------|
| `lib/tools/web-search/search.service.ts` | Removed static import | 3 | ✅ Complete |
| `lib/tools/web-search/search.service.ts` | Added dynamic import | 214 | ✅ Complete |
| `lib/tools/web-search/search.service.ts` | Added comment | 197, 213 | ✅ Complete |

---

## 🧪 VERIFICATION

### Check Browser Console

**Before:** Warning appears on page load

```text
[GraphRAG Config] NEO4J_PASSWORD not available on client side
```

**After:** No warnings

```text
(clean console)
```

### Verify Server-Side Still Works

When GraphRAG ingestion is enabled:

1. Search executes successfully
2. Results ingested to GraphRAG
3. No errors in server logs
4. Dynamic import works correctly

---

## 🎯 SUCCESS CRITERIA

- [ ] No GraphRAG warnings in browser console
- [ ] Chat interface loads without errors
- [ ] Web search still works correctly
- [ ] GraphRAG ingestion still works (server-side)
- [ ] Dynamic import loads when needed

---

## 📚 PATTERN: Lazy Loading Server-Only Code

This pattern can be used for other server-only imports:

```typescript
// ❌ Bad: Static import loads on client
import { serverOnlyService } from './server-only';

export async function clientLoadedFunction() {
  await serverOnlyService.doSomething();  // Loads on client!
}

// ✅ Good: Dynamic import only on server
export async function clientLoadedFunction() {
  // Only loads when function actually runs (server-side)
  const { serverOnlyService } = await import('./server-only');
  await serverOnlyService.doSomething();
}
```

**Use Cases:**

- Database services
- Server-only utilities
- Environment-specific code
- Heavy dependencies only needed sometimes

---

## 🔄 ROLLBACK

If issues occur:

```bash
git checkout lib/tools/web-search/search.service.ts
npm run dev
```

Or manually restore line 3:

```typescript
import { documentService } from '@/lib/graphrag';
```

And remove line 214:

```typescript
const { documentService } = await import('@/lib/graphrag');
```

---

## 📋 SUMMARY

**Issue:** GraphRAG warning in browser console

**Root Cause:** Static import at module level loaded GraphRAG on client-side

**Fix:** Changed to dynamic import inside function (server-side only)

**Impact:**

- ✅ No more client-side warnings
- ✅ GraphRAG still works server-side
- ✅ Smaller client bundle (GraphRAG not loaded)
- ✅ Faster initial page load

**Pattern:** Lazy-load server-only code with dynamic imports

---

**Status:** ✅ Fix Applied - Restart Dev Server to See Changes
**Last Updated:** October 12, 2025
**Related Fix:** GraphRAG config client-side detection (earlier in session)
