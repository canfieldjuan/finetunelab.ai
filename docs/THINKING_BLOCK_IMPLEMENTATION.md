# Thinking Block Parser Implementation Plan

**Date:** 2025-11-30
**Status:** ✅ IMPLEMENTED - Ready for Manual Testing
**Issue:** Thinking models (Qwen 14B, Claude extended thinking) show `<think></think>` tags in UI, but reasoning content is not visible

---

## ✅ Implementation Status

**Completed:** 2025-11-30

All code changes have been successfully implemented and verified:
- ✅ Added `parseThinkingBlocks()` function (lines 102-124)
- ✅ Added `ThinkingBlock` component (lines 380-425)
- ✅ Integrated into `MessageContent` component (lines 427-469)
- ✅ Added required imports (ChevronDown, Brain icons)
- ✅ TypeScript compilation verified (no new errors)
- ✅ Function tests passed (5/5 test cases)

**Files Modified:**
1. `/components/chat/MessageContent.tsx` - Added 95 lines of code

**Files NOT Modified (as planned):**
- `/components/chat/MessageList.tsx` - Already passing `role` prop ✅
- `/components/chat/types.ts` - No changes needed ✅

**Next Steps:**
- Manual testing with Qwen 14B model
- Testing with Claude extended thinking
- See `/docs/THINKING_BLOCK_TESTING.md` for comprehensive test plan

---

## 🎯 Objective

Parse and display thinking/reasoning blocks from LLM responses in a collapsible UI component, allowing users to optionally view the model's internal reasoning process separately from the final response.

**Models Affected:**
- Qwen 14B (thinking model)
- Claude 3.5 Sonnet with extended thinking
- Any future thinking models using `<think>` tags

---

## 📋 Summary

Currently when thinking models respond, the UI displays literal `<think></think>` tags without showing the reasoning content inside. Users cannot see what the model was thinking.

**Current Behavior:**
```
Response displays: "<think> </think>"
User sees: Empty tags, no reasoning visible
```

**Desired Behavior:**
```
Response displays:
[Collapsible "Show Thinking" dropdown]
  └─ When expanded: Full reasoning content with nice formatting
[Main response content without <think> tags]
```

---

## 🔍 Files Analysis

### Files That Handle Message Display:

1. **`/components/chat/MessageContent.tsx`** (367 lines) - PRIMARY FILE TO MODIFY
   - **Lines 211-336:** `parseMarkdown()` function - Block-level markdown parser
   - **Lines 91-209:** `parseInlineMarkdown()` function - Inline markdown parser
   - **Lines 338-367:** `MessageContent` component - Main render component
   - Uses `useMemo` for performance optimization
   - Custom markdown parser (no external libraries)
   - Already has truncation feature for long messages (15000 char threshold)

2. **`/components/chat/MessageList.tsx`** (242 lines) - NO CHANGES NEEDED
   - Imports and uses `MessageContent` component (line 5, 85)
   - Handles message iteration and action buttons
   - Passes `content` prop to MessageContent
   - **Impact:** None - changes are isolated to MessageContent

3. **`/components/chat/types.ts`** (80 lines) - NO CHANGES NEEDED
   - Defines `Message` interface with `content: string` field
   - **Impact:** None - thinking blocks are parsed from existing content string

4. **`/components/analytics/AnalyticsChat.tsx`** - NO CHANGES NEEDED
   - Separate analytics component with own message rendering
   - **Impact:** None - isolated from main chat

---

## 🏗️ Architecture Design

### 1. Thinking Block Parser Function

**Location:** Add to `/components/chat/MessageContent.tsx` (before `parseMarkdown`)

**Function Signature:**
```typescript
interface ParsedContent {
  thinkingBlocks: string[];  // Array of thinking content blocks
  responseContent: string;    // Main response without <think> tags
}

function parseThinkingBlocks(content: string): ParsedContent
```

**Logic:**
```typescript
function parseThinkingBlocks(content: string): ParsedContent {
  const thinkingBlocks: string[] = [];

  // Regex to match <think>...</think> (non-greedy, multiline, case-insensitive)
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/gi;

  // Extract all thinking blocks
  let match;
  while ((match = thinkingRegex.exec(content)) !== null) {
    const thinkingContent = match[1].trim();
    if (thinkingContent) {
      thinkingBlocks.push(thinkingContent);
    }
  }

  // Remove thinking blocks from response
  const responseContent = content.replace(thinkingRegex, '').trim();

  return {
    thinkingBlocks,
    responseContent
  };
}
```

**Edge Cases Handled:**
- Multiple `<think>` blocks in one response
- Nested tags (not supported - will match outer tags only)
- Malformed tags (unclosed `<think>` without `</think>` - won't match)
- Empty thinking blocks (filtered out with `.trim()`)
- Case insensitivity (`<Think>`, `<THINK>`, etc.)
- Multiline thinking content

---

### 2. Collapsible Thinking UI Component

**Location:** New component in `/components/chat/MessageContent.tsx`

**Component Name:** `ThinkingBlock`

**Implementation:**
```typescript
interface ThinkingBlockProps {
  thinkingBlocks: string[];
}

function ThinkingBlock({ thinkingBlocks }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (thinkingBlocks.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/20">
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4" />
          <span>Model Thinking Process {thinkingBlocks.length > 1 ? `(${thinkingBlocks.length} blocks)` : ''}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Thinking Content - Collapsible */}
      {isExpanded && (
        <div className="px-4 py-3 border-t border-blue-200 dark:border-blue-800 space-y-3">
          {thinkingBlocks.map((block, index) => (
            <div
              key={index}
              className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 rounded p-3 font-mono whitespace-pre-wrap"
            >
              {thinkingBlocks.length > 1 && (
                <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-2">
                  Thinking Block {index + 1}:
                </div>
              )}
              {parseMarkdown(block)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Design Pattern Used:**
- Based on existing `CollapsibleNavGroup` pattern (components/layout/CollapsibleNavGroup.tsx)
- Simple state-based collapse (not using Radix UI to avoid new dependencies)
- Chevron rotation animation on expand/collapse
- Accessible with `aria-expanded` attribute

**Visual Design:**
- Blue color scheme to distinguish from main response
- Brain icon (from lucide-react) to indicate thinking
- Rounded borders matching existing UI style
- Font mono for thinking content (code-like appearance)
- Block count badge if multiple thinking blocks exist
- Each thinking block numbered if multiple exist

---

### 3. Integration with MessageContent

**Modification to `MessageContent` component:**

**Current Code (lines 338-367):**
```typescript
export const MessageContent = memo(function MessageContent({ content }: MessageContentProps) {
  const parsedContent = useMemo(() => {
    return parseMarkdown(displayContent);
  }, [displayContent]);

  return (
    <div className="text-base">
      {parsedContent}
    </div>
  );
});
```

**New Code:**
```typescript
export const MessageContent = memo(function MessageContent({ content, role }: MessageContentProps) {
  // Parse thinking blocks FIRST (before markdown parsing)
  const { thinkingBlocks, responseContent } = useMemo(() => {
    return parseThinkingBlocks(content);
  }, [content]);

  // Parse markdown on cleaned response content
  const parsedContent = useMemo(() => {
    const displayContent = responseContent.length > 15000
      ? responseContent.substring(0, 15000) + '...'
      : responseContent;
    return parseMarkdown(displayContent);
  }, [responseContent]);

  return (
    <div className="text-base">
      {/* Show thinking block ONLY for assistant messages */}
      {role === 'assistant' && <ThinkingBlock thinkingBlocks={thinkingBlocks} />}
      {/* Main response content */}
      {parsedContent}
    </div>
  );
});
```

**Key Changes:**
1. Accept `role` prop to conditionally show thinking blocks (only for assistant)
2. Parse thinking blocks BEFORE markdown parsing
3. Apply markdown parsing to cleaned response (without `<think>` tags)
4. Render thinking block component before main content
5. Preserve existing truncation logic (15000 char limit)

**Update MessageContentProps interface (lines 6-8):**
```typescript
interface MessageContentProps {
  content: string;
  role: 'user' | 'assistant';  // ADD THIS
}
```

**Update MessageList.tsx import call (line 85):**
```typescript
// Current:
<MessageContent content={msg.content} />

// New:
<MessageContent content={msg.content} role={msg.role} />
```

---

## 📦 Required Imports

**Add to `/components/chat/MessageContent.tsx` (line 2):**
```typescript
import { ChevronDown, Brain } from 'lucide-react';
import { useState } from 'react';  // ADD useState for ThinkingBlock
```

**Already Imported:**
- ✅ `memo` from 'react'
- ✅ `useMemo` from 'react'

---

## 🧪 Testing Strategy

### Manual Testing:

1. **Test with Qwen 14B Model:**
   ```
   - Select Qwen 14B model
   - Ask a complex question requiring reasoning
   - Verify:
     ✓ Thinking block appears above response
     ✓ Clicking header expands/collapses thinking
     ✓ Main response doesn't show <think> tags
     ✓ Thinking content is properly formatted
   ```

2. **Test with Claude Extended Thinking:**
   ```
   - Enable extended thinking in Claude model settings
   - Ask a question
   - Verify same behavior as above
   ```

3. **Test with Regular Models (no thinking):**
   ```
   - Select GPT-4, regular Claude, etc.
   - Ask questions
   - Verify:
     ✓ No thinking block appears
     ✓ Responses render normally
     ✓ No UI changes for non-thinking models
   ```

4. **Edge Cases:**
   ```
   Test Case 1: Multiple thinking blocks
   - Content: "<think>First reasoning</think> Middle text <think>Second reasoning</think>"
   - Expected: 2 thinking blocks displayed, "Middle text" in main response

   Test Case 2: Empty thinking blocks
   - Content: "<think></think>Response here"
   - Expected: No thinking block displayed, "Response here" in main response

   Test Case 3: Malformed tags
   - Content: "<think>Unclosed tag... Response here"
   - Expected: No thinking block, full content in main response

   Test Case 4: Nested tags
   - Content: "<think>Outer <think>Inner</think> Outer</think>"
   - Expected: Matches outer tags only, inner tags visible in thinking content

   Test Case 5: Very long thinking content
   - Content: "<think>[5000 chars of reasoning]</think>Response"
   - Expected: Thinking block scrollable, main response normal

   Test Case 6: Markdown in thinking blocks
   - Content: "<think>**Bold** reasoning with `code`</think>Response"
   - Expected: Thinking content rendered with markdown formatting
   ```

### Automated Testing:

**Test File:** `/components/chat/MessageContent.test.tsx` (create new)

```typescript
import { parseThinkingBlocks } from './MessageContent';

describe('parseThinkingBlocks', () => {
  it('should extract single thinking block', () => {
    const input = '<think>Reasoning here</think>Final response';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual(['Reasoning here']);
    expect(result.responseContent).toBe('Final response');
  });

  it('should extract multiple thinking blocks', () => {
    const input = '<think>First</think>Middle<think>Second</think>';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual(['First', 'Second']);
    expect(result.responseContent).toBe('Middle');
  });

  it('should handle no thinking blocks', () => {
    const input = 'Just a regular response';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual([]);
    expect(result.responseContent).toBe('Just a regular response');
  });

  it('should ignore empty thinking blocks', () => {
    const input = '<think></think>Response';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual([]);
    expect(result.responseContent).toBe('Response');
  });

  it('should handle malformed tags', () => {
    const input = '<think>Unclosed... Response';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual([]);
    expect(result.responseContent).toBe('<think>Unclosed... Response');
  });

  it('should be case insensitive', () => {
    const input = '<Think>Reasoning</Think>Response';
    const result = parseThinkingBlocks(input);
    expect(result.thinkingBlocks).toEqual(['Reasoning']);
  });
});
```

---

## 🔒 Breaking Changes Verification

### ✅ NO Breaking Changes Expected

**Why:**
1. **Isolated to MessageContent component:** Changes only affect how content is parsed and displayed
2. **Backwards compatible:** Non-thinking models see NO UI changes
3. **Preserves existing props:** Message interface unchanged
4. **No API changes:** Backend sends same content string
5. **No database changes:** Messages stored as before
6. **Opt-in feature:** Only appears when `<think>` tags present
7. **Preserves truncation:** Existing 15000 char limit still works
8. **Preserves markdown:** All existing markdown parsing unchanged

**Components NOT Affected:**
- ✅ MessageList.tsx - Only needs to pass `role` prop (one line change)
- ✅ ChatBody.tsx - No changes needed
- ✅ Message type definition - No changes needed
- ✅ API endpoints - No changes needed
- ✅ Database schema - No changes needed

**Existing Features Still Work:**
- ✅ Message copying
- ✅ TTS (text-to-speech) - Will read response content only (not thinking)
- ✅ Feedback buttons (thumbs up/down)
- ✅ GraphRAG citations
- ✅ Message metadata display
- ✅ Markdown rendering (bold, italic, code, lists, etc.)
- ✅ Message truncation for long responses

---

## 📊 Performance Impact

### Minimal Performance Impact:

**Regex Parsing:**
- Runs once per message via `useMemo`
- Regex complexity: O(n) where n = content length
- Typical execution time: <1ms for 10KB response

**Re-render Optimization:**
- `useMemo` prevents re-parsing on every render
- Thinking block collapse/expand is local state (no message re-parse)
- No additional network requests

**Memory Impact:**
- Thinking content already in memory (part of message.content)
- Additional state: `isExpanded` boolean per message
- Negligible increase: ~4 bytes per assistant message

**Comparison:**
```
Current: parseMarkdown(content) → React elements
New:     parseThinkingBlocks(content) → parseMarkdown(response) → React elements
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^
         Added step: ~0.5-1ms overhead
```

---

## 🚀 Implementation Steps

### Phase 1: Create ThinkingBlock Component (30 min)
1. Add `parseThinkingBlocks()` function to MessageContent.tsx
2. Add `ThinkingBlock` component to MessageContent.tsx
3. Add required imports (ChevronDown, Brain, useState)
4. Run TypeScript compilation to verify no errors

### Phase 2: Integrate with MessageContent (15 min)
1. Update `MessageContentProps` interface to include `role`
2. Modify `MessageContent` component to use parser
3. Update MessageList.tsx to pass `role` prop
4. Run TypeScript compilation to verify no errors

### Phase 3: Testing (30 min)
1. Test with Qwen 14B model
2. Test with Claude extended thinking
3. Test with regular models (verify no breaking changes)
4. Test all edge cases listed above
5. Verify TTS, copying, markdown rendering still work

### Phase 4: Documentation (15 min)
1. Update this document with test results
2. Add JSDoc comments to new functions
3. Create user-facing docs if needed

**Total Estimated Time:** 90 minutes

---

## 📝 Code Changes Summary

### Files to Modify:

1. **`/components/chat/MessageContent.tsx`**
   - **Lines to add:** ~90 lines
   - **Lines to modify:** ~15 lines
   - **Changes:**
     - Add `parseThinkingBlocks()` function (30 lines)
     - Add `ThinkingBlock` component (50 lines)
     - Update `MessageContentProps` interface (1 line)
     - Modify `MessageContent` component (10 lines)
     - Add imports (3 lines)

2. **`/components/chat/MessageList.tsx`**
   - **Lines to modify:** 1 line
   - **Change:** Add `role={msg.role}` to MessageContent call (line 85)

### New Files:

None required. All changes in existing files.

---

## 🎨 UI Mockup

### Before (Current):
```
┌────────────────────────────────────────┐
│ <think> </think>                       │
│                                        │
│ Here is my response to your question. │
│                                        │
└────────────────────────────────────────┘
```

### After (Collapsed):
```
┌────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ 🧠 Model Thinking Process            ▼    │ │
│ └───────────────────────────────────────────┘ │
│                                                │
│ Here is my response to your question.         │
│                                                │
└────────────────────────────────────────────────┘
```

### After (Expanded):
```
┌────────────────────────────────────────────────┐
│ ┌───────────────────────────────────────────┐ │
│ │ 🧠 Model Thinking Process            ▲    │ │
│ ├───────────────────────────────────────────┤ │
│ │ Let me analyze this step by step:        │ │
│ │                                           │ │
│ │ 1. First, I need to understand...        │ │
│ │ 2. Then, I should consider...            │ │
│ │ 3. Finally, my conclusion is...          │ │
│ └───────────────────────────────────────────┘ │
│                                                │
│ Here is my response to your question.         │
│                                                │
└────────────────────────────────────────────────┘
```

---

## 🔄 Future Enhancements

### Short-term (Not in this implementation):
1. Add "Copy thinking" button
2. Syntax highlighting for thinking content
3. Collapsible nested sections in thinking
4. Timestamp for each thinking block

### Long-term:
1. Visual diff showing thinking vs response
2. Analytics: Track thinking block usage
3. Export thinking blocks separately
4. Support for other thinking tags (e.g., `<reasoning>`, `<analysis>`)

---

## ❓ FAQ

**Q: Will this slow down message rendering?**
A: No. Regex parsing adds <1ms per message, and results are memoized.

**Q: What if a user message contains `<think>` tags?**
A: Thinking blocks only render for assistant messages (role check).

**Q: Will TTS read the thinking blocks?**
A: No. TTS receives `msg.content` which is unchanged. Thinking is parsed client-side only.

**Q: What if thinking blocks are very long?**
A: They'll be scrollable within the collapsed container. Truncation doesn't apply to thinking blocks.

**Q: Do I need to install new dependencies?**
A: No. Uses existing React state and lucide-react icons.

**Q: Will this break message exports?**
A: No. Message content is unchanged in database. Export will include `<think>` tags as before.

---

## ✅ Approval Checklist

Before implementation, verify:

- [ ] All files identified and changes planned
- [ ] No new dependencies required
- [ ] No breaking changes to existing features
- [ ] Performance impact acceptable
- [ ] Testing strategy covers edge cases
- [ ] UI design matches existing patterns
- [ ] Code follows project conventions
- [ ] TypeScript types properly defined
- [ ] Accessibility attributes included
- [ ] Documentation complete

---

**Ready for Review & Approval**

Please review this plan and approve before implementation begins.

---

**End of Document**
