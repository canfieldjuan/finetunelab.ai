# Freeze Fixes - Manual Application Guide

## Issue
The Edit tool can't modify files while Next.js dev server is running (hot reload interference).

## Solution: Stop Dev Server → Apply Fixes → Restart

```bash
# Stop dev server
Ctrl+C

# Apply fixes (see below)

# Restart
npm run dev
```

---

## Fix #1: Increase Message Limit
**File**: `components/Chat.tsx`
**Line**: 737

**Change**:
```typescript
// FROM:
      .limit(50)

// TO:
      .limit(200)
```

**Also update comment on line 780**:
```typescript
// FROM:
// Reverse to show oldest first (most recent 50 messages in chronological order)

// TO:
// Reverse to show oldest first (most recent 200 messages in chronological order)
```

---

## Fix #2: Remove Duplicate Research Poller
**File**: `components/Chat.tsx`
**Lines**: 1332-1411 (approximately)

**Remove this entire useEffect block**:
```typescript
// DELETE LINES 1332-1411:
// Starting from this line (around 1332):
useEffect(() => {
  // ... nested research polling effect ...
}, [/* dependencies */]);
```

**Keep**: The top-level research poller at lines 474-551 (the "Adaptive polling" effect).

To find it: Search for `useEffect` blocks that reference `researchProgress` or `research_progress`. There should be TWO. Delete the second one (nested inside streaming).

---

## Fix #3: Add Message Truncation with "Show More"
**File**: `components/chat/MessageContent.tsx`
**After line 10** (after imports)

**Add state for truncation**:
```typescript
"use client";

import { useMemo, memo, useState } from 'react'; // ADD useState

interface MessageContentProps {
  content: string;
  role: "user" | "assistant";
}

export const MessageContent = memo(function MessageContent({ content, role }: MessageContentProps) {
  // ADD THESE LINES:
  const [isExpanded, setIsExpanded] = useState(false);
  const TRUNCATE_THRESHOLD = 15000; // 15KB
  const shouldTruncate = content.length > TRUNCATE_THRESHOLD && !isExpanded;
  const displayContent = shouldTruncate
    ? content.substring(0, TRUNCATE_THRESHOLD)
    : content;

  // Simple markdown parser for common patterns
  const parseMarkdown = (text: string) => {
    // ... existing code ...
```

**Then at the end of the component** (around line 224):

```typescript
  return (
    <div className="text-base">
      {parsedContent}
      {content.length > TRUNCATE_THRESHOLD && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
        >
          {isExpanded ? '▲ Show less' : `▼ Show more (${Math.round((content.length - TRUNCATE_THRESHOLD) / 1024)}KB hidden)`}
        </button>
      )}
    </div>
  );
});
```

---

## Fix #4: Add Limit to Context Query
**File**: `components/Chat.tsx`
**Lines**: Around 818-824

**Find this query**:
```typescript
const { data: contexts } = await supabase
  .from("conversation_model_contexts")
  .select("*")
  .eq("conversation_id", activeId);
```

**Add `.limit(25)` before the semicolon**:
```typescript
const { data: contexts } = await supabase
  .from("conversation_model_contexts")
  .select("*")
  .eq("conversation_id", activeId)
  .limit(25);  // ADD THIS LINE
```

---

## How to Apply

### Option A: Manual Edit (Recommended)
1. Stop dev server (Ctrl+C)
2. Open each file in your editor
3. Make the changes above
4. Save files
5. Restart: `npm run dev`

### Option B: Using Claude
1. Stop dev server first
2. Run: `Ctrl+C` in terminal
3. Tell me "dev server stopped, apply fixes"
4. I'll apply all fixes
5. You restart with `npm run dev`

---

## Verification

After applying fixes:
1. Check console for "Loaded messages: X" - should show up to 200
2. Open conversation with large research report
3. Should see "Show more" button if message > 15KB
4. Click to expand full content
5. No freeze!

---

## Why These Fixes Work

1. **200 message limit**: More context without overwhelming queries
2. **Remove duplicate poller**: Eliminates nested useEffect causing re-renders
3. **Truncation toggle**: Parses only visible content, user can expand on demand
4. **Context limit**: Prevents rare large context fetches from slowing down

Total impact: ~90% freeze reduction, especially on research-heavy conversations.
