# Web Search Tool - Quick Start Guide

**For developers who need to use the tool immediately.**

## What It Does

Search the web for current, up-to-date information with AI-powered summarization, deep content analysis, automatic query refinement, and intelligent confidence scoring.

## Import

```typescript
import webSearchTool from '@/lib/tools/web-search';
```

## Basic Usage

### Simple Search

```typescript
const result = await webSearchTool.execute({
  query: 'latest AI news'
});

console.log('Found:', result.resultCount, 'results');
result.results.forEach(r => {
  console.log(`${r.title} (${r.confidenceScore?.toFixed(2)})`);
  console.log(r.snippet);
});
```

### Search with Options

```typescript
// All options enabled
const result = await webSearchTool.execute({
  query: 'Python machine learning tutorials',
  maxResults: 10,        // 1-20 results
  summarize: true,       // AI-powered summaries
  deepSearch: true,      // Fetch full page content
  autoRefine: true       // Auto-improve poor queries
}, conversationId, userId);
```

## Parameters

### Required
- `query` (string): Search query (3-500 characters)

### Optional
- `maxResults` (number): Max results (1-20, default: 10)
- `summarize` (boolean): AI summaries (default: false)
- `deepSearch` (boolean): Full content (default: false)
- `autoRefine` (boolean): Auto-improve query (default: false)

## Result Structure

```typescript
{
  instruction: string,           // LLM instructions
  query: string,                 // Normalized query
  resultCount: number,           // Number of results
  summarizationEnabled: boolean,
  deepSearchEnabled: boolean,
  results: [
    {
      title: string,             // Page title
      url: string,               // URL
      snippet: string,           // Text excerpt
      summary?: string,          // AI summary (if enabled)
      confidenceScore?: number,  // 0-1 relevance score
      source?: string,           // Domain/source
      publishedAt?: string,      // Publication date
      fullContent?: string       // Full text (deepSearch only)
    }
  ],
  metadata: {
    provider: string,            // 'brave' or 'serper'
    latencyMs: number,           // Response time
    cached: boolean,             // From cache?
    fetchedAt: string,           // Timestamp
    resultCount: number
  }
}
```

## Common Patterns

### 1. Latest News

```typescript
async function getLatestNews(topic: string) {
  const result = await webSearchTool.execute({
    query: `latest ${topic} news`,
    maxResults: 10,
    summarize: true
  });

  result.results.forEach((r, i) => {
    console.log(`${i+1}. ${r.title}`);
    console.log(`   ${r.summary}`);
    console.log(`   ${r.source} | ${r.publishedAt}`);
  });
}

await getLatestNews('AI');
```

### 2. Deep Research

```typescript
async function research(topic: string, userId: string, convId: string) {
  const result = await webSearchTool.execute({
    query: topic,
    maxResults: 5,
    deepSearch: true,     // Fetch full content
    autoRefine: true      // Improve query if needed
  }, convId, userId);

  result.results.forEach((r, i) => {
    console.log(`${i+1}. ${r.title}`);
    console.log(`   Score: ${r.confidenceScore?.toFixed(3)}`);
    console.log(`   Content: ${r.fullContent?.length || 0} chars`);
    console.log(`   Summary: ${r.summary}`);
  });
}
```

### 3. Fact-Checking

```typescript
async function factCheck(claim: string) {
  const result = await webSearchTool.execute({
    query: claim,
    maxResults: 15,
    summarize: true
  });

  // Filter by confidence score
  const highTrust = result.results.filter(r =>
    (r.confidenceScore ?? 0) > 0.8
  );

  console.log(`High Trust Sources (${highTrust.length}):`);
  highTrust.forEach(r => {
    console.log(`  - ${r.title} (${r.confidenceScore?.toFixed(2)})`);
    console.log(`    ${r.source}`);
    console.log(`    ${r.summary}`);
  });
}
```

### 4. Comparison Research

```typescript
async function compare(topicA: string, topicB: string) {
  const [resultA, resultB] = await Promise.all([
    webSearchTool.execute({ query: topicA, maxResults: 10 }),
    webSearchTool.execute({ query: topicB, maxResults: 10 })
  ]);

  console.log(`${topicA}: ${resultA.resultCount} results`);
  console.log(`${topicB}: ${resultB.resultCount} results`);

  return { resultA, resultB };
}
```

### 5. Topic Monitoring

```typescript
async function monitorTopic(topic: string) {
  const result = await webSearchTool.execute({
    query: `latest ${topic}`,
    maxResults: 5,
    summarize: true
  });

  const recent = result.results.filter(r => {
    if (!r.publishedAt) return false;
    const daysSince = (Date.now() - new Date(r.publishedAt).getTime()) / (1000*60*60*24);
    return daysSince < 7;  // Last week
  });

  console.log(`Recent updates (${recent.length}):`);
  recent.forEach(r => {
    console.log(`  ${r.title}`);
    console.log(`  ${r.summary}`);
  });
}
```

## Features

### Confidence Scoring

Every result gets a 0-1 confidence score based on:
- **Keyword Relevance (60%)**: How well it matches query
- **Source Reputation (20%)**: Domain trustworthiness
- **Recency (20%)**: Publication date (for time-sensitive queries)

```typescript
const result = await webSearchTool.execute({ query: 'latest Python' });

// Results sorted by confidence (highest first)
result.results.forEach(r => {
  const score = r.confidenceScore ?? 0.5;
  const quality = score > 0.8 ? '🟢' : score > 0.6 ? '🟡' : '🔴';
  console.log(`${quality} ${r.title} (${score.toFixed(2)})`);
});
```

### Source Reputation

```typescript
// High Trust (0.9): .gov, .edu, Wikipedia, NYTimes, BBC, etc.
// Medium Trust (0.7): Medium, TechCrunch, Ars Technica, etc.
// Low Trust (0.3): Spam indicators
// Unknown (0.5): Other domains
```

### AI Summarization

```typescript
const result = await webSearchTool.execute({
  query: 'machine learning basics',
  summarize: true  // Generates 150-char summaries
});

result.results.forEach(r => {
  console.log('Original:', r.snippet.substring(0, 100) + '...');
  console.log('Summary:', r.summary);  // Concise, query-focused
});
```

### Deep Search

```typescript
const result = await webSearchTool.execute({
  query: 'React hooks tutorial',
  deepSearch: true  // Fetches full content from top 3 results
});

result.results.slice(0, 3).forEach(r => {
  if (r.fullContent) {
    console.log(`Full content: ${r.fullContent.length} chars`);
    console.log(`Summary: ${r.summary}`);
  }
});
```

**Notes:**
- Fetches top 3 results only
- 10-second timeout per page
- Falls back to snippet on error
- Automatically enables summarization

### Auto Query Refinement

```typescript
const result = await webSearchTool.execute({
  query: 'AI',  // Vague query
  autoRefine: true
});

// If results are poor:
// - Avg confidence < 0.4, OR
// - Fewer than 3 results
// → Auto-generates better query
// → Retries search
// → Returns better results
```

### Smart Caching

```typescript
// First call: Fetches from provider (~300ms)
const result1 = await webSearchTool.execute({ query: 'Python' });

// Second call: Returns from cache (0ms)
const result2 = await webSearchTool.execute({ query: 'Python' });

console.log('Cached:', result2.metadata.cached);  // true
```

**Cache TTL:** 1 hour

## Performance

| Configuration | Typical Time |
|---------------|--------------|
| Basic search | 200-500ms |
| + Summarization (10 results) | +2-4s |
| + Deep search (3 pages) | +3-9s |
| + Auto-refinement | +1-3s |
| **All features enabled** | **6-17s** |

**Tips:**
1. Use cache for repeated queries
2. Limit `maxResults` for faster processing
3. Use `deepSearch` only when needed
4. Run parallel searches with `Promise.all()`

## Configuration

### Environment Variables

```bash
# Required: Enable tool
TOOL_WEBSEARCH_ENABLED=true

# Required: At least one provider API key
BRAVE_SEARCH_API_KEY=your_brave_key
# OR
SERPER_API_KEY=your_serper_key

# Optional: Providers
SEARCH_PRIMARY_PROVIDER=brave
SEARCH_FALLBACK_PROVIDER=serper

# Optional: Behavior
SEARCH_MAX_RESULTS=10
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_SECONDS=3600
SEARCH_LOG_RESULTS=true
```

## When to Use

### ✅ Good Use Cases:
- Latest news and current events
- Broad topic research
- Fact-checking and verification
- Finding tutorials/guides
- Real-time data (weather, stocks)

### ❌ Bad Use Cases:
- Fetching specific known URLs → Use web scraper
- Deep technical docs → Use `deepSearch: true` or fetch directly
- Private/proprietary info → Use internal APIs
- Precise calculations → Use authoritative data sources
- Image/video search → Use specialized media APIs
- Real-time streaming → Use WebSockets/RSS

## Error Handling

```typescript
try {
  const result = await webSearchTool.execute({
    query: 'test'
  });

  console.log('Success:', result.resultCount);
} catch (error) {
  console.error('Search failed:', error.message);

  // Common errors:
  // - "Web search is disabled" → Set TOOL_WEBSEARCH_ENABLED=true
  // - "Query parameter is required"
  // - "Query must be at least 3 characters long"
  // - "Search failed - No provider returned results" → Check API keys
}
```

## Troubleshooting

### No results returned

```bash
# Check API keys
BRAVE_SEARCH_API_KEY=your_key
SERPER_API_KEY=your_key
```

### Summarization not working

```bash
# Verify OpenAI key
OPENAI_API_KEY=your_key
```

### Deep search returns no content

```typescript
// Some sites block scraping - check logs
result.results.forEach(r => {
  if (!r.fullContent) {
    console.log('Failed to fetch:', r.url);
  }
});
```

### Cache not working

```bash
# Enable cache
SEARCH_CACHE_ENABLED=true
```

```sql
-- Check cache manually
SELECT * FROM web_search_cache
WHERE query = 'your query'
AND expires_at > NOW();
```

## Quick Examples

### Example 1: Quick News Check

```typescript
const news = await webSearchTool.execute({
  query: 'latest tech news',
  maxResults: 5,
  summarize: true
});

console.log(`Top ${news.resultCount} tech news:\n`);
news.results.forEach((r, i) => {
  console.log(`${i+1}. ${r.title}`);
  console.log(`   ${r.summary}\n`);
});
```

### Example 2: Academic Research

```typescript
const research = await webSearchTool.execute({
  query: 'quantum computing recent advances',
  maxResults: 10,
  deepSearch: true,
  autoRefine: true
});

const academic = research.results.filter(r =>
  r.url.includes('.edu') || r.url.includes('.gov')
);

console.log(`Found ${academic.length} academic sources`);
academic.forEach(r => {
  console.log(`${r.title}`);
  console.log(`Score: ${r.confidenceScore?.toFixed(3)}`);
});
```

### Example 3: Price Comparison

```typescript
const prices = await webSearchTool.execute({
  query: 'iPhone 15 Pro price comparison',
  maxResults: 15,
  summarize: true
});

prices.results.forEach(r => {
  console.log(`${r.source}:`);
  console.log(`${r.summary}\n`);
});
```

### Example 4: Tutorial Discovery

```typescript
const tutorials = await webSearchTool.execute({
  query: 'Next.js App Router tutorial 2025',
  maxResults: 10,
  deepSearch: true
});

const highQuality = tutorials.results.filter(r =>
  (r.confidenceScore ?? 0) > 0.7
);

console.log(`High-quality tutorials (${highQuality.length}):`);
highQuality.forEach(r => {
  console.log(`${r.title}`);
  console.log(`${r.url}`);
  console.log(`Content: ${r.fullContent?.length || 0} chars\n`);
});
```

### Example 5: Multi-Source Verification

```typescript
async function verifyFact(claim: string) {
  const result = await webSearchTool.execute({
    query: claim,
    maxResults: 20,
    summarize: true
  });

  const sourceTypes = {
    news: result.results.filter(r => r.source?.includes('news')),
    academic: result.results.filter(r => r.url.includes('.edu')),
    government: result.results.filter(r => r.url.includes('.gov')),
    other: result.results.filter(r =>
      !r.source?.includes('news') &&
      !r.url.includes('.edu') &&
      !r.url.includes('.gov')
    )
  };

  console.log('Verification Results:');
  console.log(`  News sources: ${sourceTypes.news.length}`);
  console.log(`  Academic: ${sourceTypes.academic.length}`);
  console.log(`  Government: ${sourceTypes.government.length}`);
  console.log(`  Other: ${sourceTypes.other.length}`);

  // Show highest confidence source from each type
  for (const [type, sources] of Object.entries(sourceTypes)) {
    if (sources.length > 0) {
      const top = sources[0];
      console.log(`\nTop ${type}:`);
      console.log(`  ${top.title} (${top.confidenceScore?.toFixed(2)})`);
      console.log(`  ${top.summary}`);
    }
  }
}
```

## Need More Details?

See full documentation: `/lib/tools/web-search/README.md`

## Test It

```bash
# Basic test
npx tsx -e "
import webSearchTool from './index';
const result = await webSearchTool.execute({ query: 'test' });
console.log('Results:', result.resultCount);
"
```
