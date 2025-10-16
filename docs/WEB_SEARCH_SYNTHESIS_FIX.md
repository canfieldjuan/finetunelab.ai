# Web Search Synthesis Improvement

**Date:** October 12, 2025
**Issue:** Web search returns only snippets and links, no synthesis
**Status:** ✅ FIXED
**Files Modified:** `lib/tools/web-search/index.ts`

---

## 🐛 PROBLEM

User reports: "now its not really giving me much info, just kinda snippets and links to the sites"

**Example Output:**

```text
User: "What's the latest news about AI?"
LLM: Here are some results:
- Title: AI news article
  URL: example.com
  Snippet: AI is advancing...
- Title: Another article
  URL: example2.com
  Snippet: New developments...
```

**What User Expected:**
Comprehensive answer synthesized from multiple sources with analysis and context.

---

## 🔍 ROOT CAUSE

**Tool Description Analysis:**

File: `/lib/tools/web-search/index.ts:15`

**Before:**

```typescript
description: 'Search the web for current information, news, and answers. Returns relevant web pages with titles, URLs, and snippets.',
```

**Problem:** Description tells LLM tool "Returns... titles, URLs, and snippets"

- LLM follows instructions literally
- Returns exactly what tool says: snippets and links
- No instruction to synthesize or analyze

**Tool Response Format:**

Lines 59-70 returned raw data structure:

```typescript
{
  query: "...",
  resultCount: 5,
  results: [{title, url, snippet}, ...]
}
```

**Problem:**

- No guidance for LLM on what to do with data
- LLM treats it as structured data to display
- Missing instruction to read and synthesize

---

## ✅ FIXES APPLIED

### Fix #1: Enhanced Tool Description

**File:** `/lib/tools/web-search/index.ts:15-16`

**Before:**

```typescript
description: 'Search the web for current information, news, and answers. Returns relevant web pages with titles, URLs, and snippets.',
version: '1.0.0',
```

**After:**

```typescript
description: 'Search the web for CURRENT, UP-TO-DATE information, news, and answers. Use this for recent events, latest news, current facts, or anything requiring real-time data. YOU MUST read and synthesize the content from multiple search results to provide a comprehensive, informative answer. Do not just list snippets - analyze and explain the information found.',
version: '1.0.1',
```

**Key Improvements:**

1. **Emphasized timeliness:** "CURRENT, UP-TO-DATE" (caps for emphasis)
2. **Clear use cases:** "recent events, latest news, current facts"
3. **Explicit instruction:** "YOU MUST read and synthesize"
4. **Desired behavior:** "comprehensive, informative answer"
5. **Prohibited behavior:** "Do not just list snippets"
6. **Action words:** "analyze and explain"

---

### Fix #2: Added Instruction Field to Response

**File:** `/lib/tools/web-search/index.ts:59-71`

**Before:**

```typescript
return {
  query: result.query,
  resultCount: result.results.length,
  results: result.results.map(doc => ({...})),
  metadata: result.metadata,
};
```

**After:**

```typescript
const response = {
  instruction: `Found ${result.results.length} search results for "${query}". Read through ALL results below and synthesize a comprehensive answer. Include specific details, facts, and context from multiple sources. Cite sources when mentioning specific information.`,
  query: result.query,
  resultCount: result.results.length,
  results: result.results.map(doc => ({...})),
  metadata: result.metadata,
};
return response;
```

**Key Addition:**

- **instruction field:** Direct command to LLM in the response data
- **Clear directive:** "Read through ALL results"
- **Expected output:** "synthesize a comprehensive answer"
- **Quality requirements:** "specific details, facts, and context"
- **Source attribution:** "Cite sources when mentioning"

---

## 🔧 TECHNICAL RATIONALE

### Why Both Fixes Work Together

**Fix #1 (Description):**

- Sent when LLM decides WHETHER to use tool
- Shapes LLM's understanding of tool purpose
- Sets expectations for tool output

**Fix #2 (Instruction Field):**

- Sent AFTER tool executes with results
- Provides immediate, contextual guidance
- Reinforces synthesis behavior

### Comparison to Calculator Tool

We used similar pattern for calculator confidence fix:

**Calculator:**

```typescript
return {
  answer: `The exact result of ${expression} is ${result}`,
  result: result.result,
  ...
};
```

**Web Search:**

```typescript
return {
  instruction: `Found N results... synthesize comprehensive answer...`,
  results: [...],
  ...
};
```

Both add a **text field with explicit instructions** for the LLM.

---

## 📊 EXPECTED BEHAVIOR

### Before Fix

```text
User: "What's the latest AI news?"

LLM calls web_search
Receives: {results: [{title, url, snippet}, ...]}

LLM Response:
"Here are some recent articles:
1. Title: AI advances
   URL: example.com
   Snippet: AI is growing...
2. Title: New models
   URL: example2.com
   Snippet: Companies release..."
```

### After Fix

```text
User: "What's the latest AI news?"

LLM calls web_search
Receives: {
  instruction: "Read ALL results and synthesize...",
  results: [{title, url, snippet}, ...]
}

LLM Response:
"Based on recent developments, AI is experiencing significant
advances across multiple sectors. According to TechNews.com,
major companies have released new language models with enhanced
capabilities. Industry experts note that these improvements focus
on reasoning and multimodal understanding. Additionally,
research from MIT shows promising applications in healthcare...

Sources:
- TechNews.com
- MIT Research Blog
- AI Weekly"
```

---

## 🧪 TESTING INSTRUCTIONS

### Prerequisites

1. **Restart dev server** (CRITICAL - loads new tool definition)

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

2. **Update database description** (Optional but recommended)

```bash
# Run docs/UPDATE_WEB_SEARCH_DESCRIPTION.sql in Supabase
```

### Test Cases

**Test 1: News Query**

```text
Query: "What's the latest AI news?"
Expected: Comprehensive summary with details from multiple sources
Expected: Source citations included
Expected: Analysis/synthesis, not just snippet listing
```

**Test 2: Current Events**

```text
Query: "What happened in tech this week?"
Expected: Detailed overview covering multiple events
Expected: Context and connections between events
Expected: Specific facts and dates
```

**Test 3: Factual Research**

```text
Query: "What are the benefits of React 19?"
Expected: Synthesized explanation of key features
Expected: Examples and use cases
Expected: Comparison with previous versions
```

**Test 4: Recent Information**

```text
Query: "When was the last SpaceX launch?"
Expected: Specific date/time from search results
Expected: Additional context (mission name, payload, outcome)
Expected: Source attribution
```

### Verification Points

1. **Check Response Length:**
   - Before: ~3-5 lines (just snippets)
   - After: ~10-20 lines (comprehensive synthesis)

2. **Check Content Quality:**
   - Multiple sources referenced
   - Coherent narrative (not list format)
   - Specific details included
   - Context and analysis provided

3. **Check Console Logs:**

```text
[Web Search Tool] Searching: your query
[Web Search] Query "your query" via brave
[Web Search] Result count: 5
```

---

## 📝 FILES MODIFIED

| File | Change | Lines | Status |
|------|--------|-------|--------|
| `lib/tools/web-search/index.ts` | Enhanced description | 15 | ✅ Complete |
| `lib/tools/web-search/index.ts` | Added instruction field | 59-71 | ✅ Complete |
| `lib/tools/web-search/index.ts` | Version bump | 16 | ✅ Complete |

---

## 📚 SQL UPDATE (Optional)

The database tool description can be updated to match the code:

**File:** `docs/UPDATE_WEB_SEARCH_DESCRIPTION.sql`

```sql
UPDATE tools
SET description = 'Search the web for CURRENT, UP-TO-DATE information, news, and answers. Use this for recent events, latest news, current facts, or anything requiring real-time data. YOU MUST read and synthesize the content from multiple search results to provide a comprehensive, informative answer. Do not just list snippets - analyze and explain the information found.'
WHERE name = 'web_search';
```

**Note:** This is optional because:

- Tool definitions come from code registry at runtime
- Database description is mainly for UI/documentation
- Code changes take effect immediately after server restart

---

## 🎯 SUCCESS CRITERIA

After fix applied and dev server restarted:

- [ ] Web search queries return comprehensive answers
- [ ] Multiple sources synthesized into coherent response
- [ ] Specific details and facts included
- [ ] Source citations provided
- [ ] No more simple snippet listings
- [ ] Response length increased significantly
- [ ] Analysis and context provided

---

## 🔄 ROLLBACK

If issues occur:

```bash
git checkout lib/tools/web-search/index.ts
npm run dev
```

Or manually revert:

1. Change description back to "Returns relevant web pages..."
2. Remove instruction field from response
3. Change version back to 1.0.0

---

## 📋 SUMMARY

**Issue:** Web search only returning snippets and links, no synthesis

**Root Cause:** Tool description and response format didn't instruct LLM to synthesize

**Fixes:**

1. ✅ Enhanced tool description with explicit synthesis instructions
2. ✅ Added instruction field to tool response

**Impact:** LLM now understands it must:

- Read ALL search results
- Synthesize comprehensive answer
- Include specific details and context
- Cite sources
- Analyze and explain (not just list)

**Next Steps:**

1. Restart dev server (CRITICAL)
2. Test with various queries
3. Verify comprehensive responses
4. Optionally update database description

---

**Status:** ✅ Fix Applied - Requires Dev Server Restart
**Last Updated:** October 12, 2025
**Version:** Web Search Tool 1.0.1
**Pattern Used:** Same as Calculator Confidence Fix (explicit instruction fields)
