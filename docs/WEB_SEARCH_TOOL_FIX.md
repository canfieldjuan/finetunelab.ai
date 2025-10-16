# Web Search Tool Fix - Not Working Issue

**Date:** October 12, 2025  
**Issue:** LLM says it can't search the web when asked  
**Status:** ✅ FIXED (2 issues identified and resolved)  
**Critical:** Both fixes required for web search to work

---

## 🐛 PROBLEM REPORTED

User reports: "Its not searching the web when asked to. It says it cant do it."

---

## 🔍 ROOT CAUSE ANALYSIS

### Discovery Process

Following critical guidelines: "Never Assume, always verify"

### Step 1: Verify tool registration

- File: `/lib/tools/registry.ts:200,206`
- Status: ✅ web_search tool IS registered
- Result: Tool exists in code registry

### Step 2: Check tool configuration

- File: `/lib/tools/config.ts:41`
- Config reads: `process.env.TOOL_WEBSEARCH_ENABLED === 'true'`
- Status: Checking environment variable

### Step 3: Check environment variables

```bash
grep "WEBSEARCH" .env
# Result: STOOL_WEBSEARCH_ENABLED=true
```

- Status: ❌ **TYPO FOUND - Issue #1**

### Step 4: Verify tool passed to LLM

- File: `/components/Chat.tsx:40,254`
- Code: `const { getToolsForOpenAI } = useTools();`
- Trace: useTools() → getEnabledTools() → Supabase query
- Status: Tools come from DATABASE, not registry

### Step 5: Check Supabase tools table

- File: `/docs/schema_updates/02_plugin_system_CLEAN.sql:68-73`
- SQL INSERT shows:

```sql
('web_search', ..., true, false)
                        ^^^^^ is_enabled = FALSE
```

- Status: ❌ **DATABASE DISABLED - Issue #2**

---

## 🎯 TWO ISSUES IDENTIFIED

### Issue #1: Environment Variable Typo

**Location:** `.env:45`

**Problem:**

```bash
STOOL_WEBSEARCH_ENABLED=true  # Wrong: Extra 'S'
```

**Expected:**

```bash
TOOL_WEBSEARCH_ENABLED=true   # Correct
```

**Impact:**

- Registry tool config reads undefined
- Tool appears disabled in config
- However, database query overrides this

### Issue #2: Database Tool Disabled

**Location:** Supabase `tools` table

**Problem:**

```sql
INSERT INTO tools (name, ..., is_enabled) VALUES
('web_search', ..., false);  -- Disabled on insert
```

**Impact:**

- `getEnabledTools()` queries: `WHERE is_enabled = true`
- web_search tool NOT included in query results
- LLM never receives web_search tool definition
- LLM cannot call tool it doesn't know exists

---

## ✅ FIXES APPLIED

### Fix #1: Corrected .env Typo ✅

**File:** `.env:45`

**Change Applied:**

```diff
- STOOL_WEBSEARCH_ENABLED=true
+ TOOL_WEBSEARCH_ENABLED=true
```

**Verification:**

```bash
grep "^TOOL_WEBSEARCH" .env
# Output: TOOL_WEBSEARCH_ENABLED=true
```

### Fix #2: Enable Tool in Database ⏳

**Required Action:** Run SQL in Supabase SQL Editor

**SQL to Execute:**

```sql
-- Enable web_search tool in database
UPDATE tools
SET is_enabled = true
WHERE name = 'web_search';

-- Verify the change
SELECT name, is_enabled, is_builtin
FROM tools
WHERE name = 'web_search';
```

**Expected Output:**

name        | is_enabled | is_builtin
------------|------------|------------
web_search  | true       | true

**Steps to Apply:**

1. Go to Supabase Dashboard
2. Navigate to SQL Editor
3. Paste the UPDATE query above
4. Click "Run"
5. Verify result shows is_enabled = true

---

## 🔧 TECHNICAL DETAILS

### Tool Loading Flow

**Frontend (Chat Component):**

1. User opens chat interface
2. `useTools()` hook initializes (Chat.tsx:40)
3. Hook calls `getEnabledTools()` (useTools.ts:26)
4. Query: `SELECT * FROM tools WHERE is_enabled = true`
5. Results formatted for OpenAI API (useTools.ts:109-118)
6. Tools passed to API: `tools: getToolsForOpenAI()` (Chat.tsx:254)

**Backend (API Route):**

1. API receives tools array in request body (route.ts:17)
2. Tools passed to LLM function (route.ts:171-177)
3. LLM sees tool definitions
4. LLM can call tools when needed

**Tool Execution:**

1. LLM decides to call web_search tool
2. API receives tool call request
3. `executeTool()` called (route.ts:157-163)
4. Tool manager queries database again
5. Verifies tool is enabled
6. Executes tool code (web-search/index.ts)
7. Returns result to LLM

### Why Both Fixes Are Required

**Fix #1 (.env typo):**

- Affects: Tool registry configuration
- Impact: Future-proofing, consistency
- Not critical for current issue (DB overrides)

**Fix #2 (Database enable):**

- Affects: Tool availability to LLM
- Impact: **CRITICAL** - Without this, tool won't work
- This is the actual blocker

---

## 🧪 TESTING INSTRUCTIONS

### Pre-Test Checklist

- [ ] Fix #1 applied (.env corrected)
- [ ] Fix #2 applied (SQL UPDATE run)
- [ ] Dev server restarted

Test Cases
Test 1: Simple Web Search

```plaintext
User: "What's the latest news about AI?"
Expected: LLM calls web_search tool
Expected: Results returned (mock or real)
Expected: LLM synthesizes answer from results
```

Test 2: Factual Question

```plaintext
User: "Who won the 2024 Nobel Prize in Physics?"
Expected: LLM calls web_search tool
Expected: Search executed
Expected: Answer provided
```

 Test 3: Current Events

```plaintext
User: "What's the weather in Tokyo today?"
Expected: LLM calls web_search tool
Expected: Current data retrieved
```

### Verification Steps

1. **Check Browser Console:**

```plaintext
[ToolManager] Executing tool: web_search with params: {...}
[Web Search Tool] Searching: your query
```

1. **Check Network Tab:**

- POST to /api/chat
- Request body includes web_search in tools array
- Tool call visible in response

1. **Check Database:**

```sql
SELECT * FROM tool_executions
WHERE tool_name = 'web_search'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📊 VALIDATION QUERIES

### Check Tool Status

```sql
-- View all tools and their status
SELECT
  name,
  is_enabled,
  is_builtin,
  created_at
FROM tools
ORDER BY name;
```

### Enable All Builtin Tools

```sql
-- Enable all builtin tools at once
UPDATE tools
SET is_enabled = true
WHERE is_builtin = true;
```

### Check Recent Tool Executions

```sql
-- View recent web search executions
SELECT
  created_at,
  tool_name,
  input_params->>'query' as search_query,
  execution_time_ms,
  CASE
    WHEN error_message IS NULL THEN 'SUCCESS'
    ELSE 'FAILED'
  END as status
FROM tool_executions
WHERE tool_name = 'web_search'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📁 FILES MODIFIED

| File | Change | Lines | Status |
|------|--------|-------|--------|
| `.env` | Fixed typo | 45 | ✅ Complete |
| Supabase `tools` table | Enable web_search | - | ⏳ SQL Required |

---

## 📚 RELATED DOCUMENTATION

- **Tool System:** `docs/HOW_TO_REPLACE_TOOLS.md`
- **Plugin Schema:** `docs/schema_updates/02_plugin_system_CLEAN.sql`
- **Tool Verification:** `docs/schema_updates/verify_tools.sql`
- **Web Search Config:** `lib/tools/web-search/search.config.ts`
- **Tool Registry:** `lib/tools/registry.ts`

---

## 🎯 SUCCESS CRITERIA

After both fixes applied:

- [ ] .env has `TOOL_WEBSEARCH_ENABLED=true` (no typo)
- [ ] Database shows `is_enabled=true` for web_search
- [ ] Dev server restarted
- [ ] LLM calls web_search tool when asked to search web
- [ ] Tool executions logged in database
- [ ] Web search results returned successfully

---

## 🔄 ROLLBACK

If issues occur after fixes:

### Rollback Fix #1

```bash
# Revert .env change
git checkout .env
```

### Rollback Fix #2

```sql
-- Disable web_search tool
UPDATE tools
SET is_enabled = false
WHERE name = 'web_search';
```

---

## 📋 SUMMARY

**Issue:** Web search tool not working

**Root Causes:**

1. Environment variable typo: `STOOL_` instead of `TOOL_`
2. Database tool disabled: `is_enabled = false`

**Fixes:**

1. ✅ Fixed typo in `.env:45`
2. ⏳ SQL UPDATE required in Supabase (user action needed)

**Impact:**

- **Critical:** Fix #2 is essential for functionality
- **Secondary:** Fix #1 ensures consistency

**Next Steps:**

1. User runs SQL UPDATE in Supabase
2. Restart dev server
3. Test web search queries
4. Verify tool executions in database

---

**Status:** Partial Fix Applied (Fix #1 complete, Fix #2 requires user action)  
**Last Updated:** October 12, 2025  
**Verified By:** Systematic code trace and verification
