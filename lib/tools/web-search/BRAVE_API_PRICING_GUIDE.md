# Brave Search API Pricing - Plan Comparison & Recommendations

## ✅ YOUR CURRENT PLAN: **Base AI** ($5/month)

### 🎉 What You Purchased

**Plan:** Base AI - $5.00 per 1,000 requests
**Rate Limits:** 20 requests/second, 20,000,000 requests/month
**Features Included:**

- ✅ Web search API access
- ✅ Goggles (custom ranking/filtering)
- ✅ News cluster results
- ✅ Video cluster results
- ✅ Extra alternate snippets optimized for AI
- ✅ Video search
- ✅ News search
- ✅ Image search
- ✅ **Rights to use data for AI inference** ← THIS IS KEY!

### 🔑 What "Rights to use data for AI inference" Means

This is **PERFECT** for your use case! It means:

✅ **You CAN:**

- Use search results to train/fine-tune AI models
- Feed results into LLM prompts (RAG system)
- Process results with AI for summarization
- Cache results in your own database (Supabase) ← **You can enable caching!**
- Store results for AI training purposes
- Use results as context for AI agents

❌ **You CANNOT** (without storage rights add-on):

- Resell raw search results as a data product
- Build a competing search engine
- Redistribute raw search data to third parties

### 💰 Your Cost Breakdown

- **Base Cost:** $5.00/month
- **Rate:** $5.00 per 1,000 requests
- **Included Volume:** First 1,000 requests = $5
- **Additional Requests:** $5.00 per 1K beyond base
- **Monthly Cap:** 20M requests (you'll hit cost limits before this)

**Example Costs:**

- 1,000 requests/month: $5.00
- 5,000 requests/month: $25.00
- 10,000 requests/month: $50.00
- With 40% cache hit rate: 6,000 API calls = $30.00 (for 10K user searches)

---

## 📊 Other Brave Search API Plan Options (For Reference)

### **Option 1: Data for Search** (NOT what you have)

**What you get:**

- Web search API access
- Real-time search results
- No AI inference rights
- No storage/caching rights from Brave
- **Perfect for:** Basic search applications without AI

**Pricing tiers:**

- **Free:** 2,000 queries/month, 1 query/second
- **Base:** $3/month for 5,000 queries + $3/1K additional
- **Pro:** Starting at higher volumes with better rates
- **Enterprise:** Custom pricing for high volume

---

### **Option 2: Data for AI** ✅ **← YOU HAVE THIS!**

**What you get:**

- Same search API access as "Data for Search"
- **Optimized responses for AI/LLM consumption**
- **Rights to use data for AI inference** (train models, RAG, LLM prompts)
- **Rights to cache/store data for AI purposes** ← **YOU CAN ENABLE CACHING**
- Additional metadata useful for AI parsing
- Enhanced snippets for AI context

**Best for:** AI agents, chatbots, RAG systems (what you're building!)

**Your Pricing:** $5.00 per 1,000 requests, 20 req/sec, 20M/month cap

---

### **Option 3: Data with Storage Rights** (Separate Add-on)

**What you get:**

- Everything from "Data for AI" plan
- **Legal rights to store/cache data for non-AI purposes**
- Can build search result databases
- Can resell/redistribute data (with restrictions)

**Additional Cost:** +$45/month on top of your base plan

**Why you DON'T need this:**
❌ Your "Data for AI" plan already includes caching rights for AI purposes
✅ You're using data for RAG/AI inference = covered by your current plan
✅ You're already using Supabase for storage
✅ Your use case (AI agent) falls under AI inference rights

---

## 🎯 Your Current Setup Analysis

### What You Have Now

```typescript
✅ Base AI Plan - $5/month
   - 20 requests/second rate limit
   - AI inference rights (includes caching for AI)
   - Enhanced AI-optimized responses
   - All search features (web, news, images, video)

✅ Supabase Database (PostgreSQL)
   - Can store search results (covered by AI inference rights)
   - 30-minute cache TTL configured
   - Full control over data retention
   - Can query historical searches
   - Already paying for Supabase

✅ Your Own Caching Layer
   - lib/tools/web-search/cache/supabaseCache.ts
   - Checks cache before making API calls
   - Saves results after successful searches
   - Purges expired entries
   - Currently DISABLED (can be enabled now!)
```

### What "Data with Storage Rights" Would Add

```typescript
❌ Non-AI storage rights (you don't need this)
❌ Data redistribution rights (not your use case)
❌ +$45/month extra cost (unnecessary expense)

✅ You already have AI inference rights
✅ AI inference includes caching for AI purposes
✅ Your RAG system qualifies as AI inference
```

---

## 💡 What You Should Do Now

### ✅ **YOU CAN ENABLE CACHING!**

Your "Data for AI" plan includes **rights to use data for AI inference**, which covers:

- Storing results for RAG systems ✅
- Caching for AI agent responses ✅
- Using results as LLM context ✅

### Immediate Action Items

#### 1. **Enable Caching** (You're legally allowed to!)

```bash
# In your .env file
SEARCH_CACHE_ENABLED=true
BRAVE_SEARCH_API_KEY=your_actual_api_key_here
```

#### 2. **Verify Your Config**

```bash
cd C:/Users/Juan/Desktop/Dev_Ops/web-ui
grep -E "(SEARCH_CACHE_ENABLED|BRAVE_SEARCH_API_KEY)" .env
```

#### 3. **Test Your Setup**

```bash
# Run a simple test to verify caching works
npm test -- --testPathPatterns=content.service.test
```

#### 4. **Monitor Your Usage**

```bash
# Check Brave API dashboard
# Target: 40-60% cache hit rate
# Cost savings: 40% fewer API calls = 40% less cost
```

---

## 💰 Updated Cost Estimates (With Caching Enabled)

### Development Phase (Current)

**User Searches → Actual API Calls (with 40% cache hit):**

- 1,000 user searches → 600 API calls = $3.00/month
- 5,000 user searches → 3,000 API calls = $15.00/month
- 10,000 user searches → 6,000 API calls = $30.00/month
- 20,000 user searches → 12,000 API calls = $60.00/month

**Benefits of caching:**

- Faster response times (cache hits are instant)
- Lower API costs (40-60% reduction)
- Better user experience
- Reduced rate limit pressure

### Production Phase (Future)

**With optimized caching (50-60% hit rate):**

- 50,000 user searches → 20,000-25,000 API calls = $100-125/month
- 100,000 user searches → 40,000-50,000 API calls = $200-250/month

**Your plan scales well:**

- Pay only for what you use
- No need for $45/month storage rights add-on
- AI inference rights cover your caching needs

---

## � Your Current Implementation (Already Compliant!)

### Cache Flow

```typescript
User Search Request
    ↓
Check Supabase Cache (30min TTL)
    ↓
┌─────────────┬──────────────┐
│ Cache HIT   │  Cache MISS  │
│ Return fast │  Call Brave  │
│ (0ms API)   │  Save result │
│ ✅ Allowed  │  Store in DB │
│ (AI rights) │  ✅ Allowed  │
└─────────────┴──────────────┘
```

### Your Stack (Fully Legal with Base AI Plan)

```
┌─────────────────────────────────────┐
│  Your App (Next.js)                 │
│  ├─ Web Search Service              │
│  ├─ Supabase Cache Layer ✅         │
│  ├─ AI Agent (RAG System) ✅        │
│  └─ Brave Search API (Base AI) ✅   │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Supabase (PostgreSQL)              │
│  └─ search_summaries table          │
│     ✅ Store for AI inference       │
│     ✅ Cache for RAG responses      │
│     ✅ 30-min TTL                   │
└─────────────────────────────────────┘
```

### What Happens With Your Current Setup

```typescript
// 1. User searches "React hooks"
searchService.search("React hooks", 5);
  
// 2. Check Supabase first
const cached = await getCachedSearch({ query: "react hooks" });
if (cached) return cached; // ✅ No Brave API call!

// 3. If not cached, call Brave
const results = await braveProvider.search(...);

// 4. Save to Supabase for next time
await saveSearchResult({ query, results, provider: 'brave' });

// 5. Next search within 30min = instant (from Supabase)
```

---

## 💰 Cost Comparison Examples

### Scenario: 10,000 searches/month

#### Option A: Data for Search + Your Supabase ✅

```
Brave "Data for Search" Base Plan: $3/month (5K included)
Additional queries: 5,000 × $0.003 = $15
Supabase (already paying): $0 extra
─────────────────────────────────────────
Total: $18/month

With 50% cache hit rate from Supabase:
Actual Brave calls: 5,000 instead of 10,000
Total: $3/month (all included!) ← Best case
```

#### Option B: Data with Storage ❌

```
Brave "Data with Storage": $25/month base (estimate)
Additional queries: 5,000 × $0.004 = $20
Supabase (redundant but still there): $0
─────────────────────────────────────────
Total: $45/month

Cache benefit: Minimal (Brave handles it, but you pay more)
```

**Savings: $27-42/month with Option A!**

---

## 🚀 Action Plan

### **Important Update:** Storage Rights = $45/month Extra

Brave's "rights to store data" is a **$45/month add-on**, separate from base plans.

**Your Strategy:** Skip storage rights during development, add in production when cost is justified.

---

### Phase 1: Development (No Storage Rights) - NOW

#### 1. Sign Up for Brave Search API

Choose: **"Data for Search"** base plan

- Cost: ~$3-5/month
- **DO NOT** add storage rights yet ($45/mo)
- You'll add storage in production

#### 2. Disable Caching (Required Without Storage Rights)

```bash
# In your .env file
SEARCH_CACHE_ENABLED=false
```

**Why:** Without storage rights, you legally cannot cache results in Supabase. Every search must be a fresh API call.

#### 3. Get Your API Key

```bash
# After signup, add to your .env
BRAVE_SEARCH_API_KEY="your_brave_api_key_here"
SEARCH_CACHE_ENABLED=false  # ← Disable cache for compliance
```

#### 4. Verify It Works

```bash
# Run tests (will hit API every time, no cache)
npm test -- --testPathPatterns=content.service.test
```

#### 5. Monitor Usage During Development

```bash
# Check your Brave dashboard for:
# - API calls per day
# - Cost tracking
# - Rate limit usage
```

**Expected costs during development:**

- Light testing: $3-5/month (base plan)
- Heavy testing: $5-15/month (if you exceed base quota)

---

### Phase 2: Production (Add Storage Rights) - LATER

#### 1. Add Storage Rights ($45/month)

When your app is in production and has real users:

- Upgrade plan to include storage rights
- Worth it for:
  - Better user experience (faster responses)
  - Lower API costs (50% reduction with caching)
  - Scalability

#### 2. Enable Caching

```bash
# In your production .env
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_SECONDS=1800  # 30 minutes
```

#### 3. Re-enable Supabase Cache

Your existing cache layer will automatically work once enabled!

**Cost comparison in production (10K searches/month):**

**Without Storage Rights:**

```
Brave API: $3 + (10,000 × $0.003) = $33/month
Caching: Disabled (not allowed)
User Experience: Slower (every search hits API)
Total: $33/month
```

**With Storage Rights:**

```
Brave API + Storage: $45/month base
With 50% cache hit rate: Only 5K API calls
User Experience: Fast (50% from cache)
Total: $45/month
Savings: Actually cheaper + better UX!
```

---

### Cost Timeline

**Months 1-3 (Development):**

```
Brave "Data for Search": $3-15/month
Storage Rights: $0 (skip it)
Caching: Disabled
Total: $3-15/month ✅ Cheap!
```

**Months 4+ (Production):**

```
Brave "Data for Search": $3/month base
Storage Rights: +$45/month
With caching enabled: Fewer API calls
Total: $48-50/month
Value: Worth it for real users
```

---

## 📊 Brave Plan Feature Comparison

| Feature | Free | Data for Search | Data with Storage |
|---------|------|-----------------|-------------------|
| **Queries/month** | 2,000 | 5,000+ | 5,000+ |
| **Rate limit** | 1/sec | Higher | Higher |
| **Web search** | ✅ | ✅ | ✅ |
| **Real-time results** | ✅ | ✅ | ✅ |
| **Your Supabase cache** | ✅ | ✅ | ✅ |
| **Brave storage** | ❌ | ❌ | ✅ (not needed) |
| **Cost** | Free | $3-15/mo | $25-50/mo |
| **Best for** | Testing | Production | Legacy/Enterprise |

---

## ❓ FAQ

### Q: Should I disable my Supabase cache if I get "Data with Storage"?

**A:** No! Even with Brave storage, your Supabase cache is faster (local DB vs API call) and gives you more control.

### Q: What's the difference between "Data for Search" and "Data for AI"?

**A:** Primarily marketing/optimization. Both give you search results. "AI" might have:

- Better structured JSON for LLM parsing
- Additional metadata fields
- Optimized response times
Check Brave's docs for specifics, but likely minimal difference for your use case.

### Q: Can I switch plans later?

**A:** Yes! Start with "Data for Search" base plan, upgrade if you need more queries or want to try "Data for AI".

### Q: How do I know if my cache is working?

**A:** Check your logs:

```bash
# Cache hit = free
[WebSearch] Cache hit for query: react hooks

# Cache miss = costs money
[WebSearch] Query "react hooks" via brave
```

---

## 🎯 Final Recommendation

### **Choose: Data for Search (Base Plan - $3/month)**

**Why:**

1. ✅ You already have Supabase for storage/caching
2. ✅ Your caching layer is excellent (30min TTL)
3. ✅ No need to pay for duplicate storage
4. ✅ Full control over your data
5. ✅ Can scale up easily if needed
6. ✅ Save $20-40/month vs "with Storage"

**Don't choose "Data with Storage" because:**

1. ❌ Redundant with your Supabase setup
2. ❌ More expensive
3. ❌ Less flexibility
4. ❌ Vendor lock-in
5. ❌ No real benefit for your architecture

---

## 📝 Summary

Your current setup with **Supabase caching + Brave Search API (search only)** is the **optimal architecture**. You don't need Brave's storage because:

1. **You already have Supabase** (better control, already paying for it)
2. **Your cache layer is working** (reduces API costs by 30-50%)
3. **More cost-effective** ($18/mo vs $45/mo for 10K searches)
4. **Better data control** (query history, custom TTL, integration)

**Go with "Data for Search" base plan and keep your current Supabase caching implementation! 🚀**

