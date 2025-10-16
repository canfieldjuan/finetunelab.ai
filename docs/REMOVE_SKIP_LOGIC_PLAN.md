# ⚠️ DEPRECATED - PHASED PLAN: Remove Skip Logic Entirely

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This skip logic removal has been completed and superseded by the summary document.
>
> **SUPERSEDED BY:**
> - `SKIP_LOGIC_REMOVAL_SUMMARY.md` (complete implementation summary)
>
> **DO NOT USE THIS PLAN** - The shouldSkipGraphRAG() function has been removed. GraphRAG now runs for all queries.

---

# PHASED PLAN: Remove Skip Logic Entirely

**Date:** October 12, 2025
**Objective:** Remove `shouldSkipGraphRAG()` function to allow GraphRAG + Tools to work together
**Status:** PLANNING

---

## 📋 VERIFICATION CHECKLIST

### Files Identified for Changes

- [x] `/web-ui/app/api/chat/route.ts` - **PRIMARY FILE** (Contains function + usage)
- [x] `/web-ui/scripts/test-skip-graphrag.js` - **TEST FILE** (Will become obsolete)
- [x] `/web-ui/scripts/diagnose-graphrag-tools.js` - **DIAGNOSTIC** (References function)
- [x] `/web-ui/docs/ROOT_CAUSE_GRAPHRAG_TOOLS.md` - **DOCUMENTATION** (Needs update)

### Code Locations Verified

#### File: `/web-ui/app/api/chat/route.ts`

- **Line 16-43:** `shouldSkipGraphRAG()` function definition
- **Line 114:** Function call: `if (shouldSkipGraphRAG(userMessage))`
- **Line 115:** Skip logging: `console.log('[API] Skipping GraphRAG...')`
- **Lines 116-135:** else block with GraphRAG enhancement

**Current Code Structure:**

```
Line 108: if (userId) {
Line 111:   if (userMessage && typeof userMessage === 'string') {
Line 114:     if (shouldSkipGraphRAG(userMessage)) {
Line 115:       console.log('[API] Skipping GraphRAG for query type:', ...);
Line 116:     } else {
Line 117:       const enhanced = await graphragService.enhancePrompt(...);
Line 119:       if (enhanced.contextUsed) {
              ...
Line 135:       }
Line 136:     }
Line 137:   }
Line 138: } catch (error) {
```

---

## 🎯 IMPLEMENTATION PHASES

### **PHASE 1: Pre-Change Verification** ✅ COMPLETE

**Status:** All verifications complete

1. ✅ Read entire route.ts file (305 lines)
2. ✅ Locate shouldSkipGraphRAG function (lines 16-43)
3. ✅ Locate function usage (line 114)
4. ✅ Identify all files referencing shouldSkipGraphRAG
5. ✅ Document current code structure

---

### **PHASE 2: Backup Current State**

**Objective:** Create safety backup before changes

**Tasks:**

1. Create backup of route.ts
2. Document current line numbers
3. Run existing tests to establish baseline

**Files to backup:**

- `/web-ui/app/api/chat/route.ts`

**Verification:**

- Backup file created successfully
- Current file compiles without errors

---

### **PHASE 3: Remove shouldSkipGraphRAG Function**

**Objective:** Delete function definition (lines 16-43)

**Change Location:**

- **File:** `/web-ui/app/api/chat/route.ts`
- **Lines to DELETE:** 16-43 (28 lines total)
- **Code Block:**

```typescript
// DELETE THIS ENTIRE BLOCK:
// Helper function to determine if GraphRAG should be skipped
function shouldSkipGraphRAG(message: string): boolean {
  if (!message || typeof message !== 'string') return true;
  const msg = message.toLowerCase().trim();
  // Skip very short messages (likely greetings)
  if (msg.length < 15) return true;
  // Skip greetings
  if (/^(hi|hey|hello|sup|yo)\b/i.test(msg)) return true;
  if (/^how are you/i.test(msg)) return true;
  // Skip ONLY direct time/date queries (not questions that mention time)
  if (/^(what time|what's the time|current time|what.*the date)/i.test(msg)) return true;
  // Skip weather queries
  if (/(weather|temperature|forecast)/i.test(msg)) return true;
  // Skip math/calculations - improved detection
  // Matches: "calculate X", "what is 5+5", "50 * 2", "23% of 456", etc.
  if (/^(calculate|convert|what is \d|how much is \d)/i.test(msg)) return true;
  // Detect mathematical expressions: numbers with operators
  if (/\d+\s*[\+\-\*\/\%]\s*\d+/.test(msg)) return true;
  // Detect percentage calculations: "X% of Y"
  if (/\d+\s*%\s*of\s*\d+/i.test(msg)) return true;
  return false;
}
```

**After deletion:**

- File should be: 305 - 28 = **277 lines**
- Line numbering will shift down by 28 lines

**Verification:**

- Function definition removed
- File compiles without errors
- No import statements need changing

---

### **PHASE 4: Remove Function Usage & Refactor Logic**

**Objective:** Simplify GraphRAG enhancement to always run

**Change Location:**

- **File:** `/web-ui/app/api/chat/route.ts`
- **Lines to CHANGE:** ~86-107 (after Phase 3 deletion, was lines 114-135)

**OLD CODE (current lines 114-136):**

```typescript
if (userMessage && typeof userMessage === 'string') {
  // Check if we should skip GraphRAG for this query
  if (shouldSkipGraphRAG(userMessage)) {
    console.log('[API] Skipping GraphRAG for query type:', userMessage.slice(0, 50));
  } else {
    const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
      userId,
      userMessage
    );

    if (enhanced.contextUsed) {
      console.log('[API] GraphRAG context added from', enhanced.sources?.length, 'sources');
      console.log('[API] Original message:', userMessage.slice(0, 100));
      console.log('[API] Enhanced message preview:', enhanced.prompt.slice(0, 200) + '...');
      // Replace the last message with enhanced version
      enhancedMessages[enhancedMessages.length - 1] = {
        role: 'user',
        content: enhanced.prompt
      };

      graphRAGMetadata = {
        sources: enhanced.sources,
        metadata: enhanced.metadata
      };
    }
  }
}
```

**NEW CODE (simplified):**

```typescript
if (userMessage && typeof userMessage === 'string') {
  // Always attempt GraphRAG enhancement
  // Service will return contextUsed: false if no relevant docs found
  const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
    userId,
    userMessage
  );

  if (enhanced.contextUsed) {
    console.log('[API] GraphRAG context added from', enhanced.sources?.length, 'sources');
    console.log('[API] Original message:', userMessage.slice(0, 100));
    console.log('[API] Enhanced message preview:', enhanced.prompt.slice(0, 200) + '...');
    
    // Replace the last message with enhanced version
    enhancedMessages[enhancedMessages.length - 1] = {
      role: 'user',
      content: enhanced.prompt
    };

    graphRAGMetadata = {
      sources: enhanced.sources,
      metadata: enhanced.metadata
    };
  } else {
    console.log('[API] GraphRAG found no relevant context for query');
  }
}
```

**Changes:**

- ✅ Removed if/else branching for skip logic
- ✅ Removed shouldSkipGraphRAG() call
- ✅ Added logging for "no context" case
- ✅ Simplified to single code path

**After refactor:**

- File should be: **~280 lines** (277 + 3 new lines of logging)
- Logic is simpler and more maintainable

**Verification:**

- No shouldSkipGraphRAG references remain
- File compiles without TypeScript errors
- GraphRAG service call syntax is correct

---

### **PHASE 5: Update Comments & Documentation**

**Objective:** Update code comments to reflect new behavior

**Change Location:**

- **File:** `/web-ui/app/api/chat/route.ts`
- **Line:** ~80 (comment above GraphRAG block)

**OLD COMMENT:**

```typescript
// GraphRAG enhancement - inject document context
```

**NEW COMMENT:**

```typescript
// GraphRAG enhancement - inject document context for all queries
// The GraphRAG service returns contextUsed: false if no relevant docs found
// This allows tools and GraphRAG context to work together for hybrid queries
```

**Verification:**

- Comment accurately describes new behavior
- Explains that GraphRAG gracefully handles "no context" case

---

### **PHASE 6: Validate TypeScript Compilation**

**Objective:** Ensure no compilation errors

**Tasks:**

1. Check for TypeScript errors in route.ts
2. Verify imports are still valid
3. Check for unused variables

**Commands:**

```bash
# Check TypeScript errors
npx tsc --noEmit

# Or use VSCode's built-in checker
```

**Expected Result:**

- ✅ Zero TypeScript errors
- ✅ No unused imports
- ✅ All types resolve correctly

**Verification:**

- File compiles successfully
- No red squiggles in editor
- get_errors tool shows no errors

---

### **PHASE 7: Test Basic Functionality**

**Objective:** Verify GraphRAG + Tools work together

**Test Cases:**

1. **Pure Math Query**
   - Input: `"calculate 23% of 456"`
   - Expected: GraphRAG searches, finds no context, calculator tool runs
   - Terminal should show:

     ```
     [GraphRAG] Searching for context: calculate 23% of 456
     [GraphRAG] No relevant context found (or contextUsed: false)
     [API] GraphRAG found no relevant context for query
     [ToolManager] Executing tool: calculator
     ```

2. **Knowledge Query**
   - Input: `"What is the TDP of RTX 4090?"`
   - Expected: GraphRAG finds specs, returns context
   - Terminal should show:

     ```
     [GraphRAG] Searching for context: What is the TDP of RTX 4090?
     [GraphRAG] Enhanced prompt with X sources
     [API] GraphRAG context added from X sources
     ```

3. **Hybrid Query**
   - Input: `"I have a 700W PSU and want to add an RTX 4090"`
   - Expected: GraphRAG finds GPU specs, calculator might be called
   - Terminal should show both GraphRAG and potential tool usage

**Verification:**

- All test cases pass
- No errors in terminal
- Responses are accurate

---

### **PHASE 8: Update Test Scripts**

**Objective:** Archive or update obsolete test files

**Files to Update:**

1. **`/web-ui/scripts/test-skip-graphrag.js`**
   - Status: **OBSOLETE** (tests removed function)
   - Action: Add deprecation notice at top
   - Keep file for historical reference

2. **`/web-ui/scripts/diagnose-graphrag-tools.js`**
   - Status: **NEEDS UPDATE** (references shouldSkipGraphRAG)
   - Action: Update diagnostic output
   - Remove references to skip function

**Changes to diagnose-graphrag-tools.js:**

```javascript
// OLD: Checks for shouldSkipGraphRAG function
console.log('Checking shouldSkipGraphRAG() function...');

// NEW: Note that function was removed
console.log('Note: shouldSkipGraphRAG() function REMOVED in Phase 2');
console.log('GraphRAG now runs for all queries (returns contextUsed: false if irrelevant)');
```

**Verification:**

- Test scripts updated or deprecated
- No broken references
- Documentation is accurate

---

### **PHASE 9: Update Documentation**

**Objective:** Update technical documentation

**Files to Update:**

1. **`/web-ui/docs/ROOT_CAUSE_GRAPHRAG_TOOLS.md`**
   - Add section: "RESOLUTION: Skip Logic Removed"
   - Document new behavior
   - Update architecture diagrams

**New Section to Add:**

```markdown
## 🔄 RESOLUTION UPDATE (October 12, 2025)

### Skip Logic Removed
The `shouldSkipGraphRAG()` function has been **completely removed** to support
hybrid use cases where GraphRAG context and tools work together.

### New Behavior
- GraphRAG **always runs** for all queries
- If no relevant documents found: `contextUsed: false`
- Tools are always available to LLM
- LLM intelligently chooses: context, tools, or both

### Benefits
- ✅ Supports hybrid queries (e.g., PC builder use case)
- ✅ Zero maintenance (no regex patterns to update)
- ✅ Tools and GraphRAG work together seamlessly
- ✅ Graceful degradation when no context available
```

**Verification:**

- Documentation is complete
- Examples are clear
- Architecture reflects new behavior

---

### **PHASE 10: Final Validation**

**Objective:** Complete end-to-end testing

**Validation Checklist:**

- [ ] File compiles without errors
- [ ] No TypeScript errors
- [ ] No broken imports
- [ ] GraphRAG runs for all queries
- [ ] Tools execute correctly
- [ ] Hybrid queries work (GraphRAG + Tools)
- [ ] No console errors in browser
- [ ] Terminal logs are clear
- [ ] Documentation is updated
- [ ] Test scripts are archived/updated

**Commands:**

```bash
# Run TypeScript check
npx tsc --noEmit

# Check file line count
wc -l app/api/chat/route.ts

# Expected: ~280 lines (was 305)
```

**Final Test:**

```bash
# Start dev server
npm run dev

# Test queries:
# 1. "calculate 23% of 456"
# 2. "What is RTX 4090 TDP?"
# 3. "I have 700W PSU, can I add RTX 4090?"
```

---

## 📊 EXPECTED OUTCOMES

### Code Metrics

- **Before:** 305 lines
- **After:** ~280 lines
- **Reduction:** ~25 lines (8% simpler)

### Complexity Reduction

- **Before:** 2 code paths (skip vs use GraphRAG)
- **After:** 1 code path (always attempt GraphRAG)
- **Maintenance:** Zero regex patterns to maintain

### Functional Improvements

- ✅ GraphRAG + Tools work together
- ✅ Supports PC builder use case
- ✅ Supports company Q&A use case
- ✅ Supports all hybrid scenarios

---

## 🚨 ROLLBACK PLAN

If issues arise:

1. **Restore from backup:**

   ```bash
   cp app/api/chat/route.ts.backup app/api/chat/route.ts
   ```

2. **Revert git changes:**

   ```bash
   git checkout app/api/chat/route.ts
   ```

3. **Known Issues:**
   - If GraphRAG is slow: Add caching layer
   - If too much context: Adjust source limit in graphragService
   - If wrong context: Improve GraphRAG search relevance

---

## ✅ SIGN-OFF

- [ ] All phases completed
- [ ] All verifications passed
- [ ] Documentation updated
- [ ] Tests passing
- [ ] Ready for production

**Next Steps After Completion:**

1. Monitor terminal logs for GraphRAG behavior
2. Collect user feedback on hybrid queries
3. Consider adding GraphRAG caching if needed
4. Optimize search relevance if needed

---

**End of Plan**
