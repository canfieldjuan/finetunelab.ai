# ✅ Setup Complete: Base AI Plan with Caching

## 🎉 You Purchased: Base AI ($5/month)

**Good news!** Your "Base AI" plan includes **"Rights to use data for AI inference"**, which means:

- ✅ **YOU CAN ENABLE CACHING** (it's included in your plan!)
- ✅ You can store results in Supabase for RAG/AI purposes
- ✅ You DON'T need the $45/month "storage rights" add-on

**This document was written before you purchased the plan. For updated setup instructions, see:**
→ **[BASE_AI_SETUP.md](./BASE_AI_SETUP.md)** ← **Use this instead!**

---

## ⚡ Quick Setup (3 Steps)

### 1. **Enable Caching** (You're allowed to!)

Add to your `.env` file:

```bash
# ENABLE caching - you have AI inference rights!
SEARCH_CACHE_ENABLED=true
BRAVE_SEARCH_API_KEY="your_brave_api_key_here"
```

---

### 2. Add Your Brave API Key

Get your API key from Brave dashboard and add to `.env`:

```bash
BRAVE_SEARCH_API_KEY="BSA_your_api_key_here"
SEARCH_CACHE_ENABLED=true
```

---

### 3. Verify Configuration

Check your environment is set correctly:

```bash
# In web-ui directory
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
grep -E "(SEARCH_CACHE|BRAVE)" .env
```

Should show:

```
BRAVE_SEARCH_API_KEY=BSA_abc123...
SEARCH_CACHE_ENABLED=true
```

---

### 4. Test the Setup

Run a quick test:

```bash
npm test -- --testPathPatterns=content.service.test
```

Expected behavior:

- ✅ Tests pass
- ✅ No cache-related errors
- ✅ Every search hits Brave API (slower, but compliant)
- ⚠️ Watch for rate limits (1 req/sec on free tier)

---

## 📊 What to Expect (Development Mode)

### **Without Caching:**

**Pros:**

- ✅ Legally compliant with Brave's terms
- ✅ Always fresh results
- ✅ Simple setup

**Cons:**

- 🐌 Slower (every search = API call)
- 💰 More API calls = slightly higher costs
- ⚠️ Hit rate limits faster during testing

**Cost estimate:**

```
Light development (100 searches/day):
- ~3,000 searches/month
- Covered by base plan ($3-5/mo)
- Total: $3-5/month ✅

Heavy development (500 searches/day):
- ~15,000 searches/month
- Base plan (5K) + overages (10K × $0.003)
- Total: $3 + $30 = $33/month
```

### **Tips to Minimize Costs:**

1. **Use mocks for unit tests:**

   ```typescript
   // Don't hit real API in every test
   jest.mock('./providers/braveProvider');
   ```

2. **Rate limit your dev testing:**

   ```typescript
   // Add delays between test searches
   await sleep(1000); // 1 second between calls
   ```

3. **Test with small result sets:**

   ```typescript
   // Use maxResults: 3 instead of 10 during testing
   await searchService.search('query', 3);
   ```

4. **Use staging environment:**
   - Dev environment: Mocked responses (free)
   - Staging environment: Real API (limited testing)
   - Production: Real API + storage rights (when ready)

---

## 🔄 Migration Plan for Later (Production)

When you're ready to add storage rights ($45/mo):

### Step 1: Upgrade Brave Plan

- Add "Storage Rights" to your Brave account
- Cost: +$45/month

### Step 2: Enable Caching

```bash
# Update .env
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_SECONDS=1800  # 30 minutes
```

### Step 3: Deploy with Cache

```bash
# Your existing Supabase cache will automatically activate!
# No code changes needed - already implemented ✅
```

### Step 4: Monitor Performance

```bash
# Check logs for cache hit rate
grep "Cache hit" logs/app.log | wc -l
grep "Query.*via brave" logs/app.log | wc -l

# Goal: 40-60% cache hit rate
```

---

## 📝 Summary

**Right Now (Development):**

```
1. Set SEARCH_CACHE_ENABLED=false
2. Add BRAVE_SEARCH_API_KEY
3. Sign up for base plan ($3-5/mo)
4. Test without caching
5. Watch your costs
```

**Later (Production with Users):**

```
1. Upgrade to include storage rights (+$45/mo)
2. Set SEARCH_CACHE_ENABLED=true
3. Enjoy faster responses
4. Save money on API calls (caching reduces usage)
5. Better user experience
```

**The Math:**

- Development: $3-15/mo (no caching, low volume)
- Production: $45-50/mo (with caching, worth it for UX)
- Break-even: When your API costs without caching exceed $45/mo (around 15K searches/month)

---

## ✅ Checklist

Before you start coding:

- [ ] Sign up for Brave "Data for Search" base plan
- [ ] Get your API key
- [ ] Add `SEARCH_CACHE_ENABLED=false` to .env
- [ ] Add `BRAVE_SEARCH_API_KEY=...` to .env
- [ ] Run tests to verify it works
- [ ] Check Brave dashboard for usage tracking

When ready for production:

- [ ] Upgrade to add storage rights (+$45/mo)
- [ ] Change `SEARCH_CACHE_ENABLED=true`
- [ ] Deploy
- [ ] Monitor cache hit rates
- [ ] Celebrate faster app! 🎉

---

## 🆘 Troubleshooting

### "Rate limited" errors during testing

**Solution:** Add delays between API calls or use mocks for tests

### "Unauthorized" from Brave API

**Solution:** Check your API key is correct in .env

### App still trying to use cache

**Solution:** Verify `SEARCH_CACHE_ENABLED=false` and restart app

### Tests failing

**Solution:**

```bash
# Check what's set
echo $SEARCH_CACHE_ENABLED

# Should be "false" or empty
# Restart your dev server after changing .env
```

---

**You're all set! Start with the cheap base plan, add storage rights when you have paying users.** 🚀

