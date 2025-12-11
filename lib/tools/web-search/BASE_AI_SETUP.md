# Base AI Plan - Setup Guide

## ✅ What You Have

**Plan:** Base AI - $5.00 per 1,000 requests  
**Rate Limit:** 20 requests/second  
**Monthly Cap:** 20,000,000 requests  

**Key Feature:** **Rights to use data for AI inference**

- ✅ You CAN cache search results in Supabase
- ✅ You CAN use results for RAG/LLM context
- ✅ You CAN store for AI training purposes
- ✅ You DON'T need the $45/month storage rights add-on

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Get Your API Key

1. Go to Brave Search API dashboard
2. Find your API key (should be available after purchase)
3. Copy the key

### Step 2: Enable Caching

```bash
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
```

Edit your `.env` file (or `.env.local`):

```bash
# Add/update these lines:
SEARCH_CACHE_ENABLED=true
BRAVE_SEARCH_API_KEY=your_actual_brave_api_key_here
```

### Step 3: Restart & Test

```bash
# Restart your dev server
npm run dev

# In another terminal, run tests:
npm test -- --testPathPatterns=content.service.test
```

---

## 📊 Expected Performance

### With Caching Enabled (40-60% hit rate)

**Low Usage (Development):**

- 1,000 user searches → ~600 API calls → **$3/month**
- 5,000 user searches → ~3,000 API calls → **$15/month**

**Medium Usage (Early Production):**

- 10,000 user searches → ~6,000 API calls → **$30/month**
- 20,000 user searches → ~12,000 API calls → **$60/month**

**High Usage (Growth):**

- 50,000 user searches → ~25,000 API calls → **$125/month**
- 100,000 user searches → ~50,000 API calls → **$250/month**

### Cache Savings

Without caching, you'd pay **60-150% more** for the same user searches!

Example: 10,000 user searches

- Without cache: 10,000 API calls = $50/month
- With cache (40% hit): 6,000 API calls = $30/month
- **Savings: $20/month** (40% reduction)

---

## 🔍 Monitoring Your Usage

### Check Cache Performance

```sql
-- Run in Supabase SQL editor
SELECT 
  COUNT(*) as total_cached_searches,
  COUNT(DISTINCT query_hash) as unique_queries,
  AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_cache_duration_seconds
FROM search_summaries
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Check API Usage

1. Go to Brave API dashboard
2. Check "Usage" or "Analytics" section
3. Monitor:
   - Requests per day
   - Cost accumulation
   - Rate limit usage

### Target Metrics

- **Cache hit rate:** 40-60% (good), 60-80% (excellent)
- **API cost:** Should be 40-60% of what uncached would cost
- **Rate limit:** Stay under 20 req/sec (you have plenty of headroom)

---

## 🛠️ Troubleshooting

### Issue: "API key not found" or 401 errors

**Solution:**

```bash
# Check if env var is set:
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
grep BRAVE_SEARCH_API_KEY .env

# If empty or wrong, update it:
# Edit .env and restart server
npm run dev
```

### Issue: Cache not working

**Solution:**

```bash
# Verify cache is enabled:
grep SEARCH_CACHE_ENABLED .env
# Should show: SEARCH_CACHE_ENABLED=true

# Check Supabase connection:
# Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set
```

### Issue: High API costs

**Diagnosis:**

```sql
-- Check if cache is being used:
SELECT 
  DATE(created_at) as date,
  COUNT(*) as searches_cached
FROM search_summaries
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

If counts are low → cache might not be enabled  
If counts are high → good! Cache is working

**Solutions:**

1. Increase cache TTL (currently 30 min)
   - Edit `search.config.ts`: `cacheTTLSeconds: 3600` (1 hour)
2. Monitor for repeated searches (should be cached)
3. Consider query normalization (e.g., lowercase, trim)

---

## 📈 Scaling Strategy

### Current Phase (Development)

- Cache enabled: ✅
- Expected cost: $3-30/month
- Monitor and optimize

### Early Production (100-1,000 users)

- Expected cost: $30-100/month
- Consider increasing cache TTL to 1 hour
- Add analytics to see most common queries

### Growth Phase (1,000-10,000 users)

- Expected cost: $100-500/month
- Consider query result pre-fetching for popular terms
- Optimize cache based on user patterns
- May want to explore higher-tier pricing (better rates)

### High Scale (10,000+ users)

- Contact Brave for enterprise pricing
- Consider CDN caching layer for ultra-fast responses
- Implement request batching/deduplication

---

## ✅ Checklist

Before going to production:

- [ ] API key added to `.env`
- [ ] `SEARCH_CACHE_ENABLED=true` set
- [ ] Dev server restarted with new env vars
- [ ] Unit tests passing (23/23)
- [ ] Cache table exists in Supabase (`search_summaries`)
- [ ] Monitoring set up (Brave dashboard + Supabase queries)
- [ ] Cost alerts set in Brave dashboard (optional)
- [ ] Documentation reviewed (this file + BRAVE_API_PRICING_GUIDE.md)

---

## 💡 Key Takeaways

1. **Your plan is PERFECT for your use case**
   - AI inference rights cover caching for RAG systems ✅
   - No need for $45/month storage rights add-on ✅
   - Pay-as-you-grow pricing ✅

2. **Enable caching immediately**
   - You're legally allowed to cache with "AI inference rights" ✅
   - Saves 40-60% on API costs ✅
   - Faster response times for users ✅

3. **Monitor and optimize**
   - Check cache hit rates weekly
   - Adjust TTL based on patterns
   - Keep eye on Brave API costs

4. **You're good to go!**
   - Just add API key and enable caching
   - Start building without worrying about compliance
   - Scale as your user base grows

---

## 🔗 Related Documentation

- [BRAVE_API_PRICING_GUIDE.md](./BRAVE_API_PRICING_GUIDE.md) - Detailed pricing comparison
- [DATA_STORAGE_RIGHTS_EXPLAINED.md](./DATA_STORAGE_RIGHTS_EXPLAINED.md) - Legal implications explained
- [search.config.ts](./search.config.ts) - Configuration file
- [supabaseCache.ts](./cache/supabaseCache.ts) - Cache implementation

---

## 🆘 Need Help?

**Questions about:**

- **Pricing:** Check [BRAVE_API_PRICING_GUIDE.md](./BRAVE_API_PRICING_GUIDE.md)
- **Legal/Compliance:** Check [DATA_STORAGE_RIGHTS_EXPLAINED.md](./DATA_STORAGE_RIGHTS_EXPLAINED.md)
- **Setup Issues:** See Troubleshooting section above
- **Cache Performance:** Run SQL queries in Monitoring section

**Still stuck?**

- Check Brave API documentation: <https://brave.com/search/api/>
- Verify Supabase connection
- Check application logs: `npm run dev` output

