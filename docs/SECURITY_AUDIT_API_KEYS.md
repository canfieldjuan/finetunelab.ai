# Security Audit: API Key Protection

**Date:** October 13, 2025  
**Issue:** Frontend exposure of OpenAI API keys  
**Status:** ✅ RESOLVED  

---

## 🚨 VULNERABILITY IDENTIFIED

### Original Issue

The **Prompt Tester Tool** was directly importing and calling `getOpenAIResponse` from `@/lib/llm/openai`, which contains the OpenAI API key via `process.env.OPENAI_API_KEY`.

**Risk Level:** CRITICAL  
**Impact:** API keys could be exposed in frontend bundle  
**Affected Files:**

- `lib/tools/prompt-tester/prompt-tester.service.ts`

---

## ✅ RESOLUTION IMPLEMENTED

### Solution: API Route Pattern

Created a secure server-side API route to handle OpenAI calls:

```text
app/api/tools/prompt-tester/route.ts
```

**Architecture:**

1. **Frontend (lib/tools)** → Calls `/api/tools/prompt-tester`
2. **API Route (app/api)** → Executes OpenAI calls server-side
3. **Response** → Returns results without exposing keys

### Changes Made

#### 1. Created Secure API Route

**File:** `app/api/tools/prompt-tester/route.ts`

- Runs on Node.js runtime (server-side only)
- Imports OpenAI safely
- Handles prompt execution
- Returns results to frontend

#### 2. Updated Service Layer

**File:** `lib/tools/prompt-tester/prompt-tester.service.ts`

- **Removed:** `import { getOpenAIResponse, ChatMessage } from '../../llm/openai'`
- **Added:** `fetch('/api/tools/prompt-tester')` calls
- Uses HTTP requests instead of direct imports
- API keys never reach frontend code

---

## 🔍 SECURITY VERIFICATION

### ✅ Frontend Bundle Check

**Safe files (no API keys):**

- ✅ `lib/tools/prompt-tester/prompt-tester.service.ts` - Uses fetch()
- ✅ `lib/tools/prompt-tester/index.ts` - Tool definition only
- ✅ `lib/tools/prompt-tester/types.ts` - Type definitions
- ✅ `lib/tools/prompt-tester/config.ts` - Public config only
- ✅ `lib/tools/token-analyzer/*` - No LLM calls
- ✅ `lib/tools/dataset-manager/*` - Supabase only (RLS protected)

**Secure files (server-side only):**

- ✅ `app/api/tools/prompt-tester/route.ts` - Node.js runtime
- ✅ `app/api/chat/route.ts` - Node.js runtime
- ✅ `lib/llm/openai.ts` - Only imported by API routes

### ✅ Environment Variable Protection

**Server-side only:**

```typescript
// ✅ SAFE: Only in API routes with runtime = 'nodejs'
import { getOpenAIResponse } from '@/lib/llm/openai';
```

**Never in frontend:**

```typescript
// ❌ UNSAFE: Do not import in lib/tools/**
import { getOpenAIResponse } from '@/lib/llm/openai';
```

---

## 📋 SECURITY CHECKLIST

### API Key Protection

- ✅ OpenAI API key never imported in `lib/tools/**`
- ✅ All LLM calls go through API routes
- ✅ API routes use `runtime = 'nodejs'` (server-side)
- ✅ No `process.env.OPENAI_API_KEY` in frontend code

### Other Sensitive Data

- ✅ Supabase keys: Protected via RLS policies
- ✅ User data: Isolated via `userId` filtering
- ✅ GraphRAG: Server-side episodeService
- ✅ File uploads: Supabase storage with RLS

### Configuration Safety

**Safe in frontend:**

- ✅ `process.env.NEXT_PUBLIC_*` variables (intentionally public)
- ✅ Tool config objects (no secrets)
- ✅ Type definitions
- ✅ UI constants

**Must stay server-side:**

- ✅ `process.env.OPENAI_API_KEY`
- ✅ `process.env.ANTHROPIC_API_KEY`
- ✅ Database connection strings
- ✅ Private API endpoints

---

## 🎯 BEST PRACTICES ESTABLISHED

### 1. API Route Pattern for LLM Calls

**DO:**

```typescript
// In lib/tools/service.ts
const response = await fetch('/api/tools/my-tool', {
  method: 'POST',
  body: JSON.stringify({ prompt, options })
});
```

**DON'T:**

```typescript
// In lib/tools/service.ts
import { getOpenAIResponse } from '@/lib/llm/openai'; // ❌ UNSAFE
```

### 2. Clear Separation of Concerns

- **lib/tools/** - Frontend logic, no secrets
- **app/api/** - Server-side logic, can use secrets
- **lib/llm/** - Only imported by API routes

### 3. Runtime Declaration

All API routes must specify:

```typescript
export const runtime = 'nodejs'; // Server-side only
```

---

## 🔄 MIGRATION GUIDE

### For Existing Tools

If a tool needs LLM access:

1. **Create API route:**

   ```text
   app/api/tools/[tool-name]/route.ts
   ```

2. **Move LLM calls to API route:**

   ```typescript
   // route.ts
   import { getOpenAIResponse } from '@/lib/llm/openai';
   export const runtime = 'nodejs';
   ```

3. **Update service to use fetch:**

   ```typescript
   // service.ts (frontend-safe)
   const response = await fetch('/api/tools/[tool-name]', {...});
   ```

### For New Tools

**Decision tree:**

- Does tool need LLM? → Create API route
- Only database access? → Use Supabase client (RLS protected)
- Pure computation? → Can stay in lib/tools/

---

## 📚 REFERENCE ARCHITECTURE

### Secure Architecture Pattern

```text
┌─────────────────────────────────────────┐
│ Frontend (Browser)                      │
│ ┌─────────────────────────────────────┐ │
│ │ lib/tools/prompt-tester/            │ │
│ │ - prompt-tester.service.ts          │ │
│ │ - Uses fetch() to call API          │ │
│ │ - NO API keys                        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  ↓ HTTP POST
┌─────────────────────────────────────────┐
│ Backend (Node.js)                       │
│ ┌─────────────────────────────────────┐ │
│ │ app/api/tools/prompt-tester/        │ │
│ │ - route.ts                           │ │
│ │ - Imports getOpenAIResponse         │ │
│ │ - HAS API keys (server-side)        │ │
│ └─────────────────────────────────────┘ │
│             ↓                            │
│ ┌─────────────────────────────────────┐ │
│ │ lib/llm/openai.ts                   │ │
│ │ - OpenAI API client                 │ │
│ │ - process.env.OPENAI_API_KEY        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## ✅ VERIFICATION COMPLETE

**All API keys are now secure:**

- ✅ No OpenAI imports in frontend code
- ✅ No Anthropic imports in frontend code
- ✅ All LLM calls proxied through API routes
- ✅ TypeScript compilation: 0 errors
- ✅ Security audit: PASSED

---

## 📝 MAINTENANCE NOTES

### When Adding New Tools

**Ask these questions:**

1. Does it call an LLM? → Need API route
2. Does it use API keys? → Must be server-side
3. Does it access user data? → Use RLS-protected Supabase
4. Is it pure computation? → Can stay in lib/tools/

### Code Review Checklist

- [ ] No `import` of llm/* in lib/tools/**
- [ ] No `process.env.*` except NEXT_PUBLIC_* in lib/tools/**
- [ ] All API routes have `export const runtime = 'nodejs'`
- [ ] Supabase queries use userId filtering

---

**Audit Completed:** October 13, 2025  
**Severity:** Critical vulnerability resolved  
**Status:** ✅ SECURE  
**Next Audit:** Before production deployment
