# Web Search Tool - Quick Reference Guide

## 🚀 Quick Start

The enhanced web search tool now includes three powerful features to improve search quality and relevance.

---

## 📋 Available Parameters

```typescript
{
  query: string,              // Required: Your search query
  maxResults?: number,        // Optional: Max results (default: 10)
  summarize?: boolean,        // Optional: Get LLM summary of results
  deepSearch?: boolean,       // 🆕 Fetch full page content
  autoRefine?: boolean,       // 🆕 Auto-improve poor queries
}
```

---

## 🎯 Usage Examples

### Basic Search

```typescript
search({ 
  query: "machine learning algorithms" 
})
```

**Returns:** Top results sorted by confidence score

---

### Deep Research Mode

```typescript
search({ 
  query: "quantum computing applications",
  deepSearch: true,
  summarize: true
})
```

**What it does:**

- ✅ Fetches full content from top 3 results
- ✅ Generates comprehensive summary
- ⏱️ Takes 3-5 seconds

**Best for:** Research, detailed analysis, understanding complex topics

---

### Smart Query Refinement

```typescript
search({ 
  query: "AI stuff",  // Vague query
  autoRefine: true
})
```

**What happens:**

1. Initial search returns 2 low-quality results
2. System detects: avgConfidence = 0.35 (below 0.4 threshold)
3. LLM generates refined queries:
   - "artificial intelligence developments 2025"
   - "AI breakthroughs and innovations latest research"
4. Searches again with refined queries
5. Merges and deduplicates results

**Returns:** 8+ better quality results instead of 2  
**Time:** 6-10 seconds (LLM call + additional searches)

**Best for:** Exploratory searches, vague questions, initial research

---

### Complete Power Mode

```typescript
search({ 
  query: "emerging technologies 2025",
  maxResults: 15,
  deepSearch: true,
  summarize: true,
  autoRefine: true
})
```

**What you get:**

- ✅ Up to 15 results
- ✅ Full page content for top results
- ✅ Confidence scores on every result
- ✅ Auto-refinement if needed
- ✅ Comprehensive summary

**Time:** 8-15 seconds (full pipeline)

**Best for:** Comprehensive research, thesis work, critical decisions

---

## 📊 Understanding Confidence Scores

Every result now includes a `confidenceScore` (0-1):

| Score | Quality | Interpretation |
|-------|---------|----------------|
| 0.8 - 1.0 | Excellent | Highly relevant from trusted source |
| 0.6 - 0.8 | Good | Relevant with decent source reputation |
| 0.4 - 0.6 | Moderate | May be relevant but verify carefully |
| 0.2 - 0.4 | Low | Questionable relevance or source |
| 0.0 - 0.2 | Very Low | Likely not relevant |

### Scoring Factors

- **60%** Keyword Relevance - How well does content match query?
- **20%** Source Reputation - Is domain trusted? (.gov, .edu, Wikipedia)
- **20%** Recency - How recent is the content?

---

## 🔄 Auto-Refinement Triggers

Query refinement automatically activates when:

1. **Too Few Results:** Less than 3 results found
2. **Low Confidence:** Average confidence score below 0.4

### Refinement Process

```
Initial Query → Poor Results Detected
    ↓
LLM Generates 2 Refined Queries
    ↓
Search with Each Refined Query
    ↓
Merge & Deduplicate Results
    ↓
Return Combined Results
```

### Prevention of Infinite Loops

- Refinement only runs once per search
- If refined query also fails, returns best available results
- Fallback query generation if LLM fails

---

## 🎨 Response Format

```typescript
{
  results: [
    {
      title: "Result Title",
      url: "https://example.com/page",
      snippet: "Brief description...",
      publishedAt: "2025-01-15",           // If available
      confidenceScore: 0.85,               // 🆕 Quality score
      fullContent: "Complete page text..." // 🆕 If deepSearch enabled
    }
  ],
  summary: "Comprehensive overview..."     // If summarize enabled
}
```

---

## ⚡ Performance Guide

| Configuration | Time | Best Use Case |
|---------------|------|---------------|
| Basic | 1-2s | Quick lookups |
| + Confidence Scoring | 1-2s | Always included, no extra time |
| + Deep Search | 3-5s | Detailed research |
| + Auto Refine (if triggered) | 6-10s | Vague queries |
| All Features | 8-15s | Comprehensive research |

---

## 🎓 Best Practices

### When to Use Deep Search

✅ **Use for:**

- Academic research
- Technical documentation
- In-depth analysis
- Understanding complex topics

❌ **Skip for:**

- Quick fact checking
- Recent news (snippets usually sufficient)
- Time-sensitive queries

### When to Enable Auto-Refinement

✅ **Use for:**

- Exploratory searches ("tell me about AI")
- Unfamiliar topics
- Brainstorming
- Initial research

❌ **Skip for:**

- Specific questions ("GPT-4 release date")
- Well-defined queries
- Time-critical searches

### Optimizing for Speed vs Quality

**Fast Mode** (1-2s):

```typescript
{ query: "Python pandas documentation" }
```

**Balanced Mode** (3-5s):

```typescript
{ 
  query: "machine learning best practices",
  deepSearch: true 
}
```

**Thorough Mode** (8-15s):

```typescript
{ 
  query: "blockchain applications",
  deepSearch: true,
  autoRefine: true,
  summarize: true 
}
```

---

## 🔍 Trusted Sources

The confidence scoring system recognizes these high-trust domains:

### Government & Education (Score: 0.9-1.0)

- `.gov` domains
- `.edu` domains
- Official government sites

### Research & Knowledge (Score: 0.8-0.9)

- Wikipedia
- ArXiv (scientific papers)
- Academic journals
- PubMed

### Tech & News (Score: 0.6-0.8)

- Major tech sites (TechCrunch, Ars Technica)
- Reputable news outlets (Reuters, AP)
- Developer docs (MDN, GitHub)

### Blogs & Community (Score: 0.5-0.7)

- Medium, Dev.to
- Stack Overflow
- Tech blogs

---

## 🐛 Troubleshooting

### "Getting low confidence scores"

- **Solution:** Try `autoRefine: true` to improve query
- **Check:** Is your query too vague? Be more specific

### "Deep search not returning content"

- **Reason:** Some sites block scrapers
- **Fallback:** System automatically uses snippets instead
- **No action needed:** Handled gracefully

### "Search takes too long"

- **Cause:** All features enabled (8-15s is normal)
- **Solution:** Disable features you don't need
- **Trade-off:** Speed vs thoroughness

### "Not enough results"

- **Solution:** Enable `autoRefine: true`
- **Alternative:** Broaden your query terms
- **Check:** Lower `maxResults` expectation

---

## 📈 Advanced Tips

### Combine with Summarization

Deep search + summarization = best understanding:

```typescript
{ 
  query: "climate change impacts",
  deepSearch: true,
  summarize: true  // LLM digests full content
}
```

### Trust But Verify

Use confidence scores to prioritize, but:

- Review low-scored results that might be relevant
- Don't blindly trust high scores
- Cross-reference important information

### Query Crafting

Even with auto-refinement, better queries = better results:

- ✅ "Python async/await tutorial 2025"
- ❌ "Python stuff"

---

## 🔐 Privacy & Reliability

### What Gets Cached

- Search results (30-minute TTL)
- Not stored: Query refinements, full content

### Error Handling

All features fail gracefully:

- Content fetch fails → uses snippets
- LLM fails → uses simple refinement
- Scoring fails → continues without scores

### No Breaking Changes

All new features are optional:

- Old code continues working
- Backward compatible
- Opt-in enhancements

---

## 📞 Quick Reference

| Want to... | Use this |
|------------|----------|
| Quick search | `{ query: "..." }` |
| Research deeply | `{ query: "...", deepSearch: true }` |
| Improve vague query | `{ query: "...", autoRefine: true }` |
| Get summary | `{ query: "...", summarize: true }` |
| Full power | All parameters enabled |

---

## ✅ Summary

The enhanced web search tool gives you:

1. **🎯 Better Quality** - Confidence scores on every result
2. **🔍 Deeper Analysis** - Full page content when needed
3. **🤖 Smart Assistance** - Automatic query improvement
4. **⚡ Flexible** - Use features only when needed
5. **🛡️ Reliable** - Graceful error handling throughout

**Start simple, enhance as needed!**
