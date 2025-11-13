# E2E Test Configuration - Ready to Run

## Changes Made (October 18, 2025)

### 1. ✅ Environment Configuration Updated

**File:** `/web-ui/.env`

Added/Updated:

```bash
# Search caching (enabled - you have AI inference rights with Base AI plan)
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL=1800

# Rate limiting - Base AI plan: 20 requests/second = 1200 requests/minute
SEARCH_RATE_LIMIT=1200
```

**Rationale:**

- Base AI plan includes "Rights to use data for AI inference" → caching is allowed
- Your plan has 20 req/sec rate limit = 1200 req/min
- Default was 10 req/min (too conservative)

---

### 2. ✅ E2E Tests Updated with Rate Limit Protection

**File:** `/web-ui/lib/tools/web-search/__tests__/e2e.test.ts`

Added:

```typescript
// Helper to add delay between tests to respect rate limits
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Delay between tests (100ms = well under 20 req/sec limit)
const INTER_TEST_DELAY = 100;

// Add delay between tests
afterEach(async () => {
  await delay(INTER_TEST_DELAY);
});
```

**Rationale:**

- Prevents tests from running back-to-back too fast
- 100ms delay = max 10 requests/second during tests (well under your 20 req/sec limit)
- Ensures stable test execution

---

## Current Configuration Status

### ✅ Brave Search API

- **Plan:** Base AI ($5/month)
- **API Key:** Configured in `.env`
- **Rate Limit:** 20 requests/second
- **Monthly Cap:** 20,000,000 requests
- **Features:** AI inference rights (includes caching)

### ✅ Caching

- **Status:** ENABLED
- **Backend:** Supabase (`web_search_results` table)
- **TTL:** 1800 seconds (30 minutes)
- **Compliance:** ✅ Covered by AI inference rights

### ✅ Provider Configuration

- **Primary:** Brave Search (braveProvider.ts)
- **Fallback:** Serper API (configured)
- **Endpoint:** <https://api.search.brave.com/res/v1/web/search>
- **Headers:** X-Subscription-Token authentication

### ✅ Enhancement Features

1. **Deep Search** - Fetches full content from top 3 results
2. **Confidence Scoring** - Multi-factor scoring with domain reputation
3. **Query Refinement** - LLM-powered query improvement for poor results

---

## Test Suite Overview

### 10 E2E Tests

1. ✅ Basic search with confidence scoring
2. ✅ Deep search with full content
3. ✅ Auto query refinement (vague queries)
4. ✅ Specific query handling (no refinement)
5. ✅ All features combined (power mode)
6. ✅ Special characters in queries
7. ✅ Technical queries
8. ✅ Deep search error handling
9. ✅ Performance - basic search (<5s)
10. ✅ Performance - deep search (<10s)

### Expected Behavior

- **All tests should pass** with current configuration
- **Cache will reduce API calls** after first run
- **Rate limits respected** with 100ms delays
- **No compliance issues** (AI inference rights cover caching)

---

## Verification Checklist

Before running tests:

- [x] `BRAVE_SEARCH_API_KEY` set in `.env`
- [x] `SEARCH_CACHE_ENABLED=true` in `.env`
- [x] `SEARCH_RATE_LIMIT=1200` in `.env`
- [x] E2E tests have rate limit delays
- [x] Supabase connection configured
- [x] All enhancement features implemented

---

## How to Run E2E Tests

### Option 1: Run all E2E tests

```bash
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
npm test -- --testPathPattern=e2e.test
```

### Option 2: Run specific test

```bash
# Example: Run only basic search test
npm test -- --testPathPattern=e2e.test -t "should perform basic search with confidence scoring"
```

### Option 3: Run with verbose output

```bash
npm test -- --testPathPattern=e2e.test --verbose
```

---

## Expected Output

### First Run (Cold Cache)

- All 10 tests make real API calls to Brave
- Deep search tests will fetch full content (3-10 seconds each)
- Approximate cost: 30-40 API calls = $0.15-0.20
- Results will be cached for 30 minutes

### Second Run (Warm Cache)

- Most tests hit cache (instant results)
- Only uncached queries hit API
- Much faster execution
- Near-zero API cost

### Console Output Example

```
=== TEST 1: Basic Search with Confidence Scoring ===

Results found: 5

1. TypeScript Best Practices - 2024
   URL: https://example.com/ts-best-practices
   Confidence: 0.87

[WebSearch] Cache hit for query: TypeScript best practices
✓ should perform basic search with confidence scoring (234ms)
```

---

## Troubleshooting

### Issue: Rate limit errors

**Symptoms:** 429 errors from Brave API
**Solution:** Tests already have 100ms delays. If still seeing errors, increase `INTER_TEST_DELAY` to 200ms

### Issue: Cache not working

**Symptoms:** Every test makes API call even with same query
**Solution:**

```bash
# Check Supabase connection
grep SUPABASE .env

# Verify cache table exists
# Run in Supabase SQL editor:
SELECT * FROM web_search_results LIMIT 1;
```

### Issue: Deep search timeouts

**Symptoms:** Tests fail with timeout errors
**Solution:** Some sites block scrapers. Test failure here is expected behavior (graceful degradation). The test should still pass as long as it returns results with snippets.

### Issue: No results returned

**Symptoms:** `results.length === 0`
**Solution:**

- Check API key is valid
- Check internet connection
- Try a different query (some queries may have zero results)

---

## Cost Monitoring

### E2E Test Run Cost

- **First run:** ~30-40 API calls
- **Cost:** $0.15-0.20 (at $5/1000 requests)
- **Cache saves:** 60-80% on subsequent runs

### Production Usage Estimates

With 40-60% cache hit rate:

- 1K user searches → ~600 API calls → $3/month
- 5K user searches → ~3K API calls → $15/month
- 10K user searches → ~6K API calls → $30/month

---

## Next Steps

1. **Run E2E tests** to verify everything works:

   ```bash
   npm test -- --testPathPattern=e2e.test
   ```

2. **Check results** - All 10 tests should pass

3. **Monitor cache** - Check cache hit rate:

   ```sql
   SELECT 
     COUNT(*) as total_cached,
     COUNT(DISTINCT query_hash) as unique_queries
   FROM web_search_results
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

4. **Production ready** - If tests pass, the search tool is ready for production use!

---

## Summary

✅ **Configuration:** Complete and compliant with Base AI plan  
✅ **Rate Limits:** Properly configured (1200 req/min)  
✅ **Caching:** Enabled (legal under AI inference rights)  
✅ **Tests:** Protected with rate limit delays  
✅ **Features:** All three enhancements integrated  

**Status:** 🚀 READY TO TEST 🚀

