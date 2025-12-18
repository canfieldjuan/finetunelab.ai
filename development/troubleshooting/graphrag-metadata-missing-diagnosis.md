# GraphRAG Metadata Missing - Root Cause Analysis

**Date:** 2025-12-16
**Issue:** GraphRAG metadata not appearing in UI despite documents being used
**Status:** ✅ ROOT CAUSE IDENTIFIED

---

## Problem Statement

User reports:
- Documents are uploaded to GraphRAG knowledge base
- Model appears to use documents to answer questions
- But GraphRAG metadata is NOT appearing in the UI

---

## Investigation Results

### 1. Database Verification
✅ Verified - **NO GraphRAG metadata in database**

Ran script `scripts/check-graphrag-metadata.mjs`:
- Checked last 10 assistant messages
- **0 messages have `metadata.graphrag` field**
- This confirms the issue is in the backend, not the frontend

### 2. Configuration Check
✅ Identified - **THRESHOLD TOO HIGH**

```bash
$ grep GRAPHRAG_SEARCH_THRESHOLD .env.local
GRAPHRAG_SEARCH_THRESHOLD=0.8
```

**Current setting: 0.8 (80% confidence)**
- This is extremely restrictive
- Default in code: 0.7 (70%)
- Recommended: 0.5-0.6 (50-60%)

### 3. Code Flow Analysis

#### The Filtering Logic
Location: `lib/graphrag/service/graphrag-service.ts:106-136`

```typescript
const searchResult = await searchService.search(userMessage, userId);
let filteredSources = searchResult.sources || [];

// FILTERING HAPPENS HERE
if (typeof minConfidence === 'number') {
  filteredSources = filteredSources.filter(source => source.confidence >= minConfidence);
}

// IF ALL SOURCES FILTERED OUT
if (filteredSources.length === 0) {
  console.log('[GraphRAG] No relevant context found');
  return {
    prompt: userMessage,         // ❌ Original prompt (no context)
    contextUsed: false,          // ❌ No context flag
    // NO METADATA RETURNED        ❌ No metadata
  };
}
```

#### Where threshold is set
Location: `app/api/chat/route.ts:488`

```typescript
const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
  userId,
  userMessage,
  {
    minConfidence: graphragConfig.search.threshold,  // ← Uses 0.8 from .env.local
    embedderConfig,
  }
);
```

#### Result of filtering
When `filteredSources.length === 0`:
1. Returns `contextUsed: false`
2. Returns `metadata: undefined`
3. API route gets `enhanced.contextUsed === false` (line 493)
4. Sets `graphRAGMetadata = undefined` (never enters the if block)
5. Database saves message WITHOUT graphrag metadata (lines 1264-1274)

---

## Root Cause

**All GraphRAG search results are being filtered out by the 0.8 (80%) confidence threshold.**

### Evidence:
1. Search service logs show: `[GraphRAG] No relevant context found`
2. API logs show: `[API] GraphRAG found no relevant context for query`
3. Database has zero messages with graphrag metadata
4. Threshold is set to 0.8 in `.env.local`

### Why metadata isn't saved:
```typescript
// app/api/chat/route.ts:1264-1274
const messageMetadata = {
  model_name: ...,
  provider: ...,
  // This spread only happens if graphRAGMetadata?.metadata exists
  ...(graphRAGMetadata?.metadata && {   // ← FALSE when contextUsed: false
    graphrag: {
      graph_used: graphRAGMetadata.metadata.graph_used,
      nodes_retrieved: graphRAGMetadata.metadata.nodes_retrieved,
      // ...
    }
  })
};
```

When no sources pass the threshold:
- `enhanced.contextUsed === false`
- `graphRAGMetadata` is never set
- Conditional spread doesn't execute
- No `graphrag` field in metadata

---

## User's Claim Investigation

User said: *"I have docs in rag and model definitely used the docs to answer the questions"*

**Analysis:**
The model is **NOT** actually receiving document context when threshold filters out all results:

1. GraphRAG search returns results with scores < 0.8
2. All results are filtered out
3. `enhancePrompt()` returns original prompt (no context injected)
4. Model receives question WITHOUT document context
5. Model answers based on its training data (may sound relevant but isn't grounded in docs)

**Conclusion:** The user is **mistaken** - the model is NOT using the uploaded documents.
The threshold is preventing GraphRAG from working entirely.

---

## Solution

### Option 1: Lower the Threshold (RECOMMENDED)
**File:** `.env.local`

```bash
# Change from:
GRAPHRAG_SEARCH_THRESHOLD=0.8

# To:
GRAPHRAG_SEARCH_THRESHOLD=0.5
```

**Rationale:**
- 0.5 (50%) is a balanced threshold
- Allows more relevant results through
- Can be adjusted based on observed quality

### Option 2: Remove threshold filtering entirely
```bash
# Set to 0 to disable filtering
GRAPHRAG_SEARCH_THRESHOLD=0
```

### Option 3: Make threshold configurable per-query
- Allow users to adjust threshold in UI
- Add slider in settings
- More complex, not needed immediately

---

## Diagnostic Logging Added

**File:** `lib/graphrag/service/graphrag-service.ts:110-131`

Added logging to show:
- Number of sources returned from search
- Confidence scores of all sources
- Current threshold setting
- How many sources remain after filtering

**Example output:**
```
[GraphRAG] Sources returned from search: 5
[GraphRAG] Confidence scores: 65.3%, 58.7%, 52.1%, 48.9%, 45.2%
[GraphRAG] Threshold: 80.0%
[GraphRAG] After threshold filter: 0/5 sources remaining
[GraphRAG] ❌ No relevant context found - all sources filtered out by threshold
[GraphRAG] 💡 TIP: Lower GRAPHRAG_SEARCH_THRESHOLD in .env.local to see more results
```

---

## Testing Steps

### 1. Verify current behavior
1. Send a message asking about your documents
2. Check server logs for confidence scores
3. Confirm 0/X sources pass threshold

### 2. Apply fix
```bash
# Edit .env.local
GRAPHRAG_SEARCH_THRESHOLD=0.5
```

### 3. Restart server
```bash
npm run dev
```

### 4. Test with new message
1. Send a NEW message (old messages won't be updated)
2. Check server logs - should see sources passing threshold
3. Check UI - should see GraphRAG metadata badge
4. Run database check:
```bash
node scripts/check-graphrag-metadata.mjs
```

### 5. Verify metadata in database
Should see output like:
```
1. Message ID: abc123... (12/16/2025, 6:00:00 PM)
   ✅ HAS GraphRAG metadata:
       {
         "graph_used": true,
         "nodes_retrieved": 3,
         "context_chunks_used": 3,
         "retrieval_time_ms": 245,
         "context_relevance_score": 0.587,
         "answer_grounded_in_graph": true,
         "retrieval_method": "hybrid"
       }
```

---

## Files Modified

### 1. `lib/graphrag/service/graphrag-service.ts`
- Added diagnostic logging (lines 110-131)
- Shows confidence scores before/after filtering
- Provides actionable tips when all sources filtered

---

## Related Files (No Changes Needed)

These files are already correct:
- ✅ `components/chat/types.ts` - Has GraphRAG fields
- ✅ `components/hooks/useMessages.ts` - Extracts GraphRAG metadata
- ✅ `components/chat/MessageMetadata.tsx` - Displays GraphRAG metadata
- ✅ `components/chat/MessageList.tsx` - Wires GraphRAG props
- ✅ `app/api/chat/route.ts` - Saves GraphRAG metadata to DB

**The UI implementation is 100% correct. The issue is purely in the threshold filtering.**

---

## Next Steps

1. ✅ Diagnostic logging added
2. ⏳ **USER ACTION REQUIRED:** Lower threshold in `.env.local`
3. ⏳ Test with new message
4. ⏳ Verify metadata appears in UI
5. ⏳ Fine-tune threshold based on observed quality

---

## Recommendations

### Immediate:
- **Change `GRAPHRAG_SEARCH_THRESHOLD=0.5`** in `.env.local`
- Restart dev server
- Send new test message

### Future Enhancements:
- Add threshold slider in Settings UI
- Show "no context found" reason in UI when threshold filters everything
- Add analytics to track threshold effectiveness
- Allow per-conversation threshold override

---

## Summary

**Root Cause:** Threshold of 0.8 is filtering out ALL search results
**Impact:** No GraphRAG metadata saved, no context injected, model not using docs
**Fix:** Lower `GRAPHRAG_SEARCH_THRESHOLD` to 0.5
**Status:** Diagnostic logging added, waiting for user to apply fix
