# Chat Freeze - Actual Root Cause

## User Report
"The page freezes when I click on a conversation"

## Investigation Results

### What I Found:

1. **Symptom**: Clicking any conversation causes page to freeze for 20-30 seconds
2. **Error Logs**:
   ```
   GET /chat 500 in 29634ms
   GET /api/settings 500 in 21762ms
   ⨯ ./app/api/search-summaries/export/route.ts:78:19
   Syntax error: Unexpected reserved word 'await'.
   ```

3. **Root Cause**: Next.js dev server has **stale compilation error**
   - File `app/api/search-summaries/export/route.ts` is correct
   - But Next.js cache thinks there's a syntax error
   - This causes ALL routes to fail with 500 errors
   - When you click a conversation, `/chat` route returns 500 after 20-30 seconds
   - User experiences this as a "freeze"

### Why It's NOT GraphRAG:

- GraphRAG service is NOT running (confirmed)
- No attempts to call Graphiti API in the logs
- No GraphRAG-specific code executes when clicking a conversation
- The freeze happens on ALL routes, not just GraphRAG conversations

### The Real Flow:

1. User clicks conversation in sidebar
2. Browser tries to load `/chat` page
3. Next.js tries to compile the page
4. Hits cached syntax error in unrelated file
5. Returns 500 error after 20-30 seconds
6. User sees "freeze"

## Fix: Clear Next.js Cache

**Quick Fix**:
```bash
# Stop dev server (Ctrl+C)

# Delete .next folder
rd /s /q .next

# Restart
npm run dev
```

See `CLEAR_NEXTJS_CACHE.md` for detailed instructions.

## Services Status

Checked what's running on ports:

| Port | Service | Status |
|------|---------|--------|
| 3000 | Next.js dev server | ✅ Running (but broken/cached error) |
| 8000 | FineTune Lab Training API | ✅ Running |
| 8001 | Graphiti API | ❌ Not running |
| 8003 | vLLM server | ✅ Running |

## What About GraphRAG?

**Graphiti is NOT needed for basic chat functionality.**

GraphRAG only runs when:
1. User clicks "Add to KGraph" button (promotion)
2. User sends a message with GraphRAG tool enabled

Clicking an existing conversation (even one marked `in_knowledge_graph: true`) does NOT trigger any GraphRAG code.

## Summary

**The "freeze" is NOT related to GraphRAG.**

It's a Next.js dev server issue caused by a stale compilation cache. The dev server thinks there's a syntax error and returns 500 on all routes.

**Fix**: Clear `.next` cache and restart dev server.
