# 🔧 QUICK FIX: GraphRAG Metadata Not Showing

## The Problem
Your `GRAPHRAG_SEARCH_THRESHOLD=0.8` (80%) is **TOO HIGH** and filtering out ALL search results.

**What's happening:**
1. GraphRAG searches your documents ✅
2. Finds results with confidence scores like 65%, 58%, 52% ✅
3. Filters out ALL results below 80% ❌
4. No context = no metadata saved ❌
5. Model never sees your documents ❌

## The Fix (2 minutes)

### Step 1: Edit .env.local
```bash
# Change this line:
GRAPHRAG_SEARCH_THRESHOLD=0.8

# To this:
GRAPHRAG_SEARCH_THRESHOLD=0.5
```

### Step 2: Restart dev server
```bash
# Stop current server (Ctrl+C)
npm run dev
```

### Step 3: Send a NEW message
- OLD messages won't change (already in database)
- NEW messages will have metadata

### Step 4: Verify it worked
Watch server logs - you should see:
```
[GraphRAG] Sources returned from search: 5
[GraphRAG] Confidence scores: 65.3%, 58.7%, 52.1%, 48.9%, 45.2%
[GraphRAG] Threshold: 50.0%
[GraphRAG] After threshold filter: 3/5 sources remaining
[API] GraphRAG context added from 3 sources
```

Then check UI - you should see GraphRAG metadata below assistant messages:
```
🗄️ RAG: 3 nodes · 3 chunks · 245ms · 58% rel
```

## Verify Database
```bash
node scripts/check-graphrag-metadata.mjs
```

Should show ✅ for new messages.

## Understanding Thresholds

- **0.9-1.0** (90-100%): VERY strict - only near-perfect matches
- **0.8** (80%): Too strict - filters out good results ❌ (your current setting)
- **0.5-0.6** (50-60%): Balanced - good quality results ✅ **RECOMMENDED**
- **0.3-0.4** (30-40%): Permissive - more noise but catches edge cases
- **0.0** (0%): No filtering - all results included

Start with 0.5 and adjust based on quality.

## What I Changed

Added diagnostic logging to `lib/graphrag/service/graphrag-service.ts`:
- Shows confidence scores BEFORE filtering
- Shows how many sources remain AFTER filtering
- Provides actionable tips when all sources filtered out

This will help you tune the threshold to your needs.

## Full Details

See `/development/troubleshooting/graphrag-metadata-missing-diagnosis.md` for complete root cause analysis.
