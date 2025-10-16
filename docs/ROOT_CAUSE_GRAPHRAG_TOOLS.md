# ROOT CAUSE ANALYSIS: GraphRAG vs Calculator Tool Conflict

**Date:** October 12, 2025  
**Issue:** LLM saying "approximately" instead of using calculator tool  
**Status:** ✅ RESOLVED → ✅ ARCHITECTURE UPDATED (Skip Logic Removed)

---

## 🔄 FINAL RESOLUTION (October 12, 2025)

### Skip Logic Completely Removed

The `shouldSkipGraphRAG()` function has been **permanently removed** to support
hybrid use cases where GraphRAG context and tools must work together.

### New Architecture

- **GraphRAG runs for ALL queries** (no skip logic)
- If no relevant documents: `contextUsed: false`
- Tools are always available to LLM
- LLM intelligently chooses: context, tools, or both

### Key Benefits

✅ **Hybrid Use Cases Supported:**

- PC Builder: GraphRAG finds specs + Calculator computes power
- Company Q&A: GraphRAG finds policy + Tools perform actions
- No maintenance: Zero regex patterns to update

✅ **Graceful Degradation:**

- Pure math query → GraphRAG finds nothing → Tools execute
- Knowledge query → GraphRAG provides context → LLM reads
- Hybrid query → Both work together seamlessly

### Implementation Details

- **File:** `/web-ui/app/api/chat/route.ts`
- **Lines Removed:** 30 (function definition + conditional logic)
- **New Line Count:** 276 (was 304)
- **Complexity:** Reduced from 2 code paths to 1

### Example Flows

**Pure Math:**

```
User: "calculate 23% of 456"
  → GraphRAG searches → No relevant docs → contextUsed: false
  → Calculator tool executes → Returns: 104.88
  → LLM: "The result is 104.88"
```

**Knowledge Query:**

```
User: "What is RTX 4090 TDP?"
  → GraphRAG searches → Finds spec sheet → contextUsed: true
  → Enhanced message includes: "RTX 4090: 450W TDP"
  → LLM reads context → "The RTX 4090 has a TDP of 450W"
```

**Hybrid Query (PC Builder):**

```
User: "I have 700W PSU, can I add RTX 4090?"
  → GraphRAG searches → Finds GPU specs → contextUsed: true
  → Enhanced message includes power requirements
  → Calculator tool available for math if needed
  → LLM: "Your 700W PSU is below the 850W minimum for RTX 4090"
```

---

## 🎯 QUERY CLASSIFICATION SOLUTION (October 12, 2025)

### Problem Identified

After removing skip logic, GraphRAG was searching Neo4j for ALL queries including math:

- Query: "50*2" → GraphRAG searched knowledge graph (unnecessary)
- Query: "23% of 456" → GraphRAG queried Neo4j (wasted resources)
- Issue: No query type classification before search

### Solution: Smart Query Classification

**Implementation:** 7-Phase rollout with query classifier utility

**Phase 1:** Created `/lib/graphrag/utils/query-classifier.ts`

- Detects math queries (operators, percentages, calculate keywords)
- Detects datetime queries (time, date, timezone)
- Detects web search queries (search keywords, news)
- Returns classification with reasoning

**Phase 2:** Updated `/lib/graphrag/service/graphrag-service.ts`

- Added early return logic before Neo4j search
- Skips search for tool-appropriate queries
- Lines 74-89: Classification check with structured logging

**Phase 3:** Updated `/app/api/chat/route.ts`

- Passes minConfidence: 0.7 parameter
- Filters low-confidence results as safety net
- Lines 90-92: Options parameter added

**Phase 4:** Enhanced logging for observability

- Structured logging shows classification decisions
- Terminal displays SKIP_SEARCH vs SEARCH actions
- Easy debugging of query routing

**Phase 5:** Created automated test suite

- File: `/scripts/test-query-classifier.js`
- 17 test cases covering all query types
- Result: 17/17 PASS

**Phase 6:** Integration testing guide

- File: `/scripts/test-integration-graphrag-tools.js`
- Manual testing instructions for browser validation
- Success criteria defined

**Phase 7:** Documentation updates (this section)

### Classification Logic

**Math Queries - SKIP GraphRAG:**

```typescript
// Pattern 1: Direct operators (50*2, 100/4)
/\d+\s*[\+\-\*\/\%]\s*\d+/.test(query)

// Pattern 2: Percentage (23% of 456)
/\d+\s*%\s*of\s*\d+/i.test(query)

// Pattern 3: Calculate keywords
/^(calculate|compute|what is|how much is)\s+[\d\s\+\-\*\/\%\(\)\.]+/i.test(query)

// Pattern 4: Pure arithmetic
/^[\d\s\+\-\*\/\%\(\)\.]+$/.test(query)
```

**Knowledge Queries - USE GraphRAG:**

- No tool-specific patterns detected
- Searches Neo4j for relevant context
- Examples: "What is RTX 4090 TDP?", "Explain Python"

**Hybrid Queries - USE GraphRAG:**

- Complex questions needing context + tools
- Example: "I have 700W PSU, can I add RTX 4090?"
- GraphRAG provides specs, tools handle calculations

### Benefits

**Performance:**

- Math queries no longer hit Neo4j
- Reduced unnecessary vector searches
- Faster response times for calculations

**Accuracy:**

- Tool-appropriate queries route to tools directly
- Knowledge queries get relevant context
- Hybrid queries work seamlessly

**Observability:**

- Clear terminal logs show classification
- Easy debugging of routing decisions
- Structured logging for monitoring

### Example Terminal Output

**Math Query:**

```
[GraphRAG] Query classification: {
  query: '50*2',
  isMath: true,
  action: 'SKIP_SEARCH',
  reason: 'Math calculation - calculator tool appropriate'
}
[Calculator Tool] Evaluating: 50*2
```

**Knowledge Query:**

```
[GraphRAG] Query classification: {
  query: 'What is RTX 4090 TDP?',
  isToolSpecific: false,
  action: 'SEARCH'
}
[GraphRAG] Searching for context: What is RTX 4090...
[GraphRAG] Enhanced prompt with 3 sources
```

---

## 🔍 ORIGINAL DISCOVERY PROCESS (Historical)

### Initial Symptom

User query: `"23% of 456"` → LLM responds: "approximately **104.88**"

- User suspected: Calculator tool not being called
- Reality: Tool WAS being called, but GraphRAG might be interfering

### Investigation Timeline

1. **Phase 1: Architecture Diagnosis**
   - Found orphaned tool execution code
   - Refactored API route with clean branching

2. **Phase 2: Tool Execution Verification**
   - Terminal logs showed: `[ToolManager] Executing tool: calculator`
   - Tool IS working correctly
   - Returns exact result: 100 for "50 * 2"

3. **Phase 3: GraphRAG Discovery** ⭐ **ROOT CAUSE**
   - Terminal showed: `[API] Request with 118 messages, 2 tools`
   - **Also showed:** `[GraphRAG] Enhanced prompt with 5 sources`
   - GraphRAG was adding context to user messages
   - LLM receiving: Enhanced message + calculator tool

4. **Phase 4: Tool vs Context Priority**
   - Hypothesis: LLM choosing GraphRAG context over calculator tool
   - GraphRAG context might contain math-related information
   - LLM reads from context instead of executing calculator

---

## 🎯 ROOT CAUSE

**File:** `/web-ui/app/api/chat/route.ts`  
**Function:** `shouldSkipGraphRAG()`  
**Problem:** Mathematical queries were NOT skipping GraphRAG

### Original Logic (BROKEN)

```javascript
// Skip math/calculations (only direct calculation requests)
if (/^(calculate|convert|what is \d|how much is \d)/i.test(msg)) return true;
```

**What it checked:**

- ✅ Messages starting with "calculate"
- ✅ Messages starting with "what is [digit]"
- ❌ Math operators anywhere in message (50 * 2, 23% of 456)

### Why It Failed

```
Query: "test tools: what is 50 * 2?"
             ↓
Starts with "test tools", NOT "what is"
             ↓
shouldSkipGraphRAG() returns FALSE
             ↓
GraphRAG searches for context
             ↓
Finds 5 sources (possibly containing math info)
             ↓
Enhances message with context
             ↓
LLM receives: [Context + Original Query + Calculator Tool]
             ↓
LLM might use context instead of tool
```

---

## ✅ SOLUTION IMPLEMENTED

### Improved Detection (Lines 33-37 in route.ts)

```javascript
// Skip math/calculations - improved detection
// Matches: "calculate X", "what is 5+5", "50 * 2", "23% of 456", etc.
if (/^(calculate|convert|what is \d|how much is \d)/i.test(msg)) return true;
// Detect mathematical expressions: numbers with operators
if (/\d+\s*[\+\-\*\/\%]\s*\d+/.test(msg)) return true;
// Detect percentage calculations: "X% of Y"
if (/\d+\s*%\s*of\s*\d+/i.test(msg)) return true;
```

### What It Now Detects

| Query | Detection | Result |
|-------|-----------|--------|
| `"test tools: what is 50 * 2?"` | Math operator: `50 * 2` | ✅ SKIP GraphRAG |
| `"23% of 456"` | Percentage: `23% of 456` | ✅ SKIP GraphRAG |
| `"calculate 50 + 30"` | Starts with "calculate" | ✅ SKIP GraphRAG |
| `"100 / 4"` | Division operator | ✅ SKIP GraphRAG |
| `"5 - 3"` | Subtraction operator | ✅ SKIP GraphRAG |
| `"tell me about ML"` | No math pattern | ❌ USE GraphRAG |

### Enhanced Logging (Lines 115-117)

```javascript
console.log('[API] Skipping GraphRAG for query type:', userMessage.slice(0, 50));
// OR
console.log('[API] Original message:', userMessage.slice(0, 100));
console.log('[API] Enhanced message preview:', enhanced.prompt.slice(0, 200) + '...');
```

**What You'll See:**

- If GraphRAG skipped: `[API] Skipping GraphRAG for query type: 23% of 456`
- If GraphRAG used: Shows original vs enhanced message comparison

---

## 📊 TOOL SYSTEM ARCHITECTURE

### Tools Source: Supabase Database

```sql
-- Three tools in database (web_search disabled by default)
SELECT name, is_enabled FROM tools;
```

| Tool | Status | Location |
|------|--------|----------|
| `calculator` | ✅ Enabled | `/web-ui/lib/tools/calculator.ts` |
| `datetime` | ✅ Enabled | `/web-ui/lib/tools/datetime.ts` |
| `web_search` | ❌ Disabled | `/web-ui/lib/tools/web-search.ts` |

### Data Flow

```
1. Frontend (Chat.tsx)
   ↓ getEnabledTools() from Supabase
   ↓ Converts to API format
   
2. API Request Body
   { messages, tools, conversationId }
   ↓
   
3. API Route (route.ts)
   ↓ shouldSkipGraphRAG()?
   ├─ YES → Skip to tool execution
   └─ NO → GraphRAG.enhancePrompt()
            ↓ Search knowledge graph
            ↓ Inject context into message
   
4. LLM Provider (OpenAI/Anthropic)
   ↓ Receives: [Enhanced Message] + [Tools]
   ↓ Chooses: Use tool OR use context
   
5. Tool Execution (if called)
   ↓ toolCallHandler() → executeTool()
   ↓ Returns result to LLM
   ↓ LLM generates final response
```

---

## 🧪 TESTING & VERIFICATION

### Test Script Results

**File:** `/web-ui/scripts/test-skip-graphrag.js`

```bash
$ node scripts/test-skip-graphrag.js
✅ All tests passed! (12/12)
```

**Key Test Cases:**

- `"test tools: what is 50 * 2?"` → SKIP GraphRAG ✅
- `"23% of 456"` → SKIP GraphRAG ✅
- `"tell me about ML"` → USE GraphRAG ✅

### Manual Testing Steps

1. **Start dev server:**

   ```bash
   npm run dev
   ```

2. **Try these queries:**
   - `"23% of 456"` (original failing case)
   - `"test tools: what is 50 * 2?"` (previous test)
   - `"calculate 100 / 4"`
   - `"5 + 5"`

3. **Check terminal logs for:**

   ```
   [API] Skipping GraphRAG for query type: 23% of 456
   [OpenAI ToolCall Debug] Full OpenAI response:
     tool_calls: [{ function: { name: "calculator", ... } }]
   [ToolManager] Executing tool: calculator with params: { expression: '0.23 * 456' }
   [Calculator Tool] Evaluating: 0.23 * 456
   ```

4. **Expected response:**
   - Exact calculation (not approximate)
   - No GraphRAG context added
   - Calculator tool executed

---

## 📈 IMPROVEMENTS MADE

### Code Changes

1. **`/web-ui/app/api/chat/route.ts`**
   - Lines 33-37: Improved `shouldSkipGraphRAG()` regex patterns
   - Lines 115-117: Enhanced logging for debugging
   - Total: 303 lines (was 298)

2. **New Test Scripts**
   - `/web-ui/scripts/test-skip-graphrag.js` - Function testing
   - `/web-ui/scripts/diagnose-graphrag-tools.js` - Analysis tool
   - `/web-ui/scripts/check-tool-logs.js` - Log inspection

### Architecture Improvements

- ✅ GraphRAG now skips mathematical queries
- ✅ Calculator tool gets priority for math
- ✅ Better logging for debugging tool vs context decisions
- ✅ Comprehensive test coverage

---

## 🎓 LESSONS LEARNED

### 1. GraphRAG Context ≠ Tool

- GraphRAG injects document context into messages
- It's NOT a tool itself
- Can interfere with tool usage if not filtered

### 2. LLM Priority Logic

- When LLM receives both context AND tools:
  - It MIGHT choose to read from context
  - Even if a tool would be more accurate
- Solution: Don't give it the choice - skip irrelevant context

### 3. Regex Pattern Complexity

- Original pattern only checked message START
- Math can appear anywhere: "test tools: what is 50 * 2?"
- Need flexible patterns: operators, percentages, keywords

### 4. Debugging Server vs Client

- Server logs: Terminal only (`[API]`, `[ToolManager]`)
- Client logs: Browser console only (`[Chat]`)
- Both needed for full picture

---

## 🚀 NEXT STEPS

### Immediate

- [x] Fix `shouldSkipGraphRAG()` patterns
- [x] Add enhanced logging
- [x] Test with original failing case
- [ ] User verification: Test "23% of 456" manually

### Future Enhancements

1. **System Prompt Optimization**
   - Add instruction: "Always use calculator tool for math"
   - Reduce context ambiguity

2. **GraphRAG Skip Rules**
   - Consider detecting tool-related keywords
   - Skip GraphRAG when tools are explicitly mentioned

3. **Tool Priority System**
   - Add metadata to tools: `priority: 'high'`
   - LLM should prefer high-priority tools over context

4. **Analytics**
   - Track: How often tools are called vs skipped
   - Identify: Cases where LLM chooses context over tools

---

## 📝 SUMMARY

**Problem:** GraphRAG context was interfering with calculator tool usage  
**Cause:** `shouldSkipGraphRAG()` didn't detect math operators in queries  
**Solution:** Improved regex patterns to detect mathematical expressions  
**Result:** Math queries now skip GraphRAG, ensuring calculator tool is used  

**The LLM WAS using the calculator tool - but ALSO had GraphRAG context available,
leading to inconsistent behavior. Now math queries bypass GraphRAG entirely,
forcing calculator tool usage.**

---

## 🔗 RELATED FILES

- `/web-ui/app/api/chat/route.ts` - Main API route (MODIFIED)
- `/web-ui/lib/graphrag/service/graphrag-service.ts` - GraphRAG enhancement
- `/web-ui/lib/tools/toolManager.ts` - Tool execution
- `/web-ui/lib/tools/calculator.ts` - Calculator implementation
- `/web-ui/components/Chat.tsx` - Frontend tool loading
- `/web-ui/scripts/test-skip-graphrag.js` - Test suite (NEW)

---

**End of Analysis**
