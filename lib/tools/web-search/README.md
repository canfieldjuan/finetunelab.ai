# Web Search Tool

**Version:** 1.0.1
**Location:** `/lib/tools/web-search`
**Type:** Information Retrieval
**Access:** READ + FETCH

---

## Overview

The **Web Search Tool** provides comprehensive web search capabilities with intelligent result processing, including AI-powered summarization, deep content analysis, automatic query refinement, and confidence scoring. It searches the web for current, up-to-date information using multiple providers (Brave, Serper) with smart fallback mechanisms.

### Key Features

- **Multiple Search Providers:** Brave and Serper with automatic fallback
- **AI-Powered Summarization:** Generate concise summaries of search results
- **Deep Search Mode:** Fetch and analyze full page content (not just snippets)
- **Automatic Query Refinement:** Detect poor results and retry with better queries
- **Confidence Scoring:** Intelligent relevance and trust scoring (0-1 scale)
- **Source Reputation:** Domain trust evaluation for result quality
- **Recency Detection:** Prioritize recent content for time-sensitive queries
- **Smart Caching:** 1-hour cache TTL with automatic expiration
- **GraphRAG Integration:** Optional ingestion of results into knowledge graph

---

## What It Does

The web search tool provides a single operation with multiple enhancement options:

**Main Operation:** `web_search`
- Basic web search with snippets
- Optional AI summarization
- Optional deep content fetching
- Optional automatic query refinement
- Confidence scoring and ranking

---

## Architecture

### File Structure

```
web-search/
├── index.ts                       # Tool definition and registration
├── types.ts                       # TypeScript interfaces
├── search.config.ts               # Configuration wrapper
├── search.service.ts              # Main search orchestration
├── content.service.ts             # Full page content fetching
├── scoring.service.ts             # Confidence scoring algorithm
├── summarization.service.ts       # AI-powered summarization
├── query-refinement.service.ts    # Automatic query improvement
├── storage.service.ts             # Result persistence
├── cache/                         # Cache functions and utilities
├── providers/                     # Search provider implementations
│   ├── brave.provider.ts          # Brave Search API
│   └── serper.provider.ts         # Serper API
├── migrations/                    # Database migrations
├── scripts/                       # Utility scripts
└── reputation.json                # Domain trust database
```

### Dependencies

- **axios:** HTTP client for fetching content
- **cheerio:** HTML parsing and cleaning
- **Supabase Client:** Database operations and caching
- **LLM Integration:** OpenAI for summarization and query refinement

### Database Tables

**web_search_cache:**
```sql
CREATE TABLE web_search_cache (
  id UUID PRIMARY KEY,
  query TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  provider VARCHAR(50) NOT NULL,
  max_results INTEGER,
  result_count INTEGER,
  results JSONB,
  raw JSONB,
  expires_at TIMESTAMP,
  fetched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_web_search_cache_hash ON web_search_cache(query_hash);
CREATE INDEX idx_web_search_cache_expires ON web_search_cache(expires_at);
```

**web_search_results:** (for saved summaries)
```sql
CREATE TABLE web_search_results (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID,
  query TEXT NOT NULL,
  result_url TEXT NOT NULL,
  result_title TEXT,
  original_snippet TEXT,
  summary TEXT,
  source VARCHAR(200),
  published_at TIMESTAMP,
  is_ingested BOOLEAN DEFAULT false,
  is_saved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## How to Use

### Basic Search

```typescript
import webSearchTool from '@/lib/tools/web-search';

// Simple search
const result = await webSearchTool.execute({
  query: 'latest AI news'
});

console.log('Found:', result.resultCount, 'results');
result.results.forEach(r => {
  console.log(`- ${r.title} (Score: ${r.confidenceScore?.toFixed(2)})`);
  console.log(`  ${r.snippet}`);
});
```

### Search with Options

```typescript
// Search with all options enabled
const result = await webSearchTool.execute({
  query: 'Python machine learning tutorials',
  maxResults: 10,
  summarize: true,      // AI-powered summaries
  deepSearch: true,     // Fetch full content
  autoRefine: true      // Auto-improve poor queries
}, conversationId, userId);
```

### Understanding Results

```typescript
const result = await webSearchTool.execute({
  query: 'weather in Tokyo'
});

// Result structure
console.log(result.instruction);  // LLM instructions
console.log(result.query);        // Normalized query
console.log(result.resultCount);  // Number of results

result.results.forEach(doc => {
  console.log(doc.title);              // Page title
  console.log(doc.url);                // URL
  console.log(doc.snippet);            // Text snippet
  console.log(doc.summary);            // AI summary (if enabled)
  console.log(doc.confidenceScore);    // 0-1 relevance score
  console.log(doc.source);             // Domain/source
  console.log(doc.publishedAt);        // Publication date
  console.log(doc.fullContent);        // Full text (deepSearch only)
});

console.log(result.metadata.provider);  // 'brave' or 'serper'
console.log(result.metadata.cached);    // From cache?
console.log(result.metadata.latencyMs); // Response time
```

---

## Parameters

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search query (3-500 characters) |

### Optional Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxResults` | number | 10 | Max results to return (1-20) |
| `summarize` | boolean | false | Generate AI-powered summaries |
| `deepSearch` | boolean | false | Fetch full page content |
| `autoRefine` | boolean | false | Auto-improve poor queries |

---

## Features Deep Dive

### 1. Confidence Scoring

Every result gets a confidence score (0-1) based on:

**Scoring Algorithm:**
```typescript
confidenceScore =
  keywordRelevance * 0.6 +  // 60% weight
  sourceReputation * 0.2 +   // 20% weight
  recency * 0.2              // 20% weight
```

**Keyword Relevance (0-1):**
- How well title and snippet match query terms
- Title matches weighted 70%, snippet 30%
- Stop words filtered out

**Source Reputation (0-1):**
```typescript
// High trust (0.9): wikipedia.org, .gov, .edu, nytimes.com, bbc.com, etc.
// Medium trust (0.7): Medium, TechCrunch, Ars Technica, etc.
// Low trust (0.3): Domains with spam indicators
// Unknown (0.5): Other domains
```

**Recency (0-1):**
- Only applies when query asks for recent info
- Keywords: "latest", "recent", "new", "current", "2025", etc.
- Scoring:
  - < 7 days: 1.0
  - < 30 days: 0.8
  - < 90 days: 0.6
  - < 365 days: 0.4
  - Older: 0.2

**Example:**
```typescript
const result = await webSearchTool.execute({
  query: 'latest Python tutorials'
});

// Results are automatically sorted by confidence score
result.results.forEach((r, i) => {
  console.log(`${i+1}. ${r.title}`);
  console.log(`   Score: ${r.confidenceScore?.toFixed(3)}`);
  // Higher scored results = more relevant + trustworthy
});
```

---

### 2. AI-Powered Summarization

Generate concise, focused summaries of search results.

**How It Works:**
1. Sends snippet to LLM (GPT-4O-mini)
2. Asks for 150-character summary focused on query
3. Attaches summary to result
4. Falls back to original snippet on error

**Configuration:**
```typescript
// In summarization.service.ts
{
  enabled: true,
  maxSummaryLength: 150,
  provider: 'openai',
  model: 'gpt-4o-mini'
}
```

**Example:**
```typescript
const result = await webSearchTool.execute({
  query: 'machine learning basics',
  summarize: true
}, conversationId, userId);

result.results.forEach(r => {
  console.log('Original:', r.snippet);
  console.log('Summary:', r.summary);  // Concise, query-focused
});
```

**Performance:**
- Processes results in parallel
- ~200-400ms per result
- 10 results ≈ 2-4 seconds total

**Storage:**
- Summaries saved to `web_search_results` table
- Linked to user and conversation
- Can be retrieved later

---

### 3. Deep Search Mode

Fetches and analyzes full page content instead of just snippets.

**How It Works:**
1. Performs normal search
2. Fetches top 3 result URLs
3. Extracts main content using Cheerio
4. Removes nav, header, footer, scripts
5. Cleans and truncates to 15,000 chars
6. Automatically triggers summarization

**Content Extraction:**
```typescript
// Prioritizes main content containers
const containers = ['main', 'article', '[role="main"]'];
// Removes noise
removes = ['script', 'style', 'nav', 'header', 'footer', 'aside'];
// Filters short lines (likely navigation)
minLineLength = 20 chars;
```

**Example:**
```typescript
const result = await webSearchTool.execute({
  query: 'React hooks tutorial',
  deepSearch: true  // Automatically enables summarize
});

result.results.slice(0, 3).forEach(r => {
  console.log('URL:', r.url);
  console.log('Snippet:', r.snippet.substring(0, 100));
  console.log('Full Content Length:', r.fullContent?.length);
  console.log('Summary:', r.summary);
});
```

**Performance:**
- Fetches 3 pages in parallel
- ~1-3 seconds per page fetch
- Total: +3-9 seconds to search time

**Limitations:**
- Only top 3 results enriched
- 10-second timeout per page
- Some sites block scraping
- JavaScript-heavy sites may fail
- Falls back to snippet on error

---

### 4. Automatic Query Refinement

Detects poor results and automatically retries with improved queries.

**When It Triggers:**
```typescript
// Triggers refinement if:
avgConfidence < 0.4  // Low average score
OR
resultCount < 3      // Too few results
```

**How It Works:**
1. Detects poor results
2. Sends query to LLM (GPT-4O-mini)
3. LLM generates 2 refined queries
4. Retries search with first refined query
5. Compares results
6. Uses better set (or merges)

**Example Refinements:**
```
Original: "python"
Refined:  "python programming tutorial 2025"

Original: "AI"
Refined:  "artificial intelligence latest developments 2025"

Original: "weather"
Refined:  "current weather forecast"
```

**LLM Prompt:**
```
The search query "X" returned low-quality results.

Generate 2 alternative, more specific queries:
- Make queries more specific and detailed
- Add relevant context or keywords
- Include current date if query wants recent info
- Keep queries natural and readable
```

**Example:**
```typescript
const result = await webSearchTool.execute({
  query: 'AI',  // Vague query
  autoRefine: true
});

// Tool detects poor results
// Refines to: "artificial intelligence latest developments 2025"
// Retries and returns better results
```

**Deduplication:**
- Merges original + refined results
- Removes duplicate URLs
- Sorts by confidence score
- Limits to maxResults

**Performance:**
- +1-3 seconds when triggered
- Only happens once (prevents infinite recursion)
- Skips cache for refined query

---

### 5. Smart Caching

1-hour cache with automatic expiration and purging.

**How It Works:**
```typescript
// Cache key includes:
- Normalized query (trimmed, single spaces)
- Provider name
- Max results requested

// Cache TTL: 1 hour (3600 seconds)
```

**Normalization:**
```typescript
normalizeQuery("  Python    tutorials  ")
// → "Python tutorials"
```

**Cache Lookup:**
```typescript
const result = await webSearchTool.execute({
  query: 'Python tutorials'
});
// First call: Fetches from provider (200-500ms)
// Second call: Returns from cache (0ms)
```

**Cache Purging:**
- 5% chance per search
- Deletes expired entries
- Runs async (non-blocking)

**Bypass Cache:**
```typescript
const result = await searchService.search(
  'query',
  10,
  { skipCache: true }  // Force fresh results
);
```

**Storage:**
- Stored in `web_search_cache` table
- Indexed on `query_hash` for fast lookup
- Indexed on `expires_at` for purging

---

### 6. Multi-Provider Support

**Primary Provider:** Brave Search
**Fallback Provider:** Serper

**Provider Selection:**
```typescript
// Tries providers in order:
1. providerOverride (if specified)
2. primaryProvider (from config)
3. fallbackProvider (if primary fails)
```

**Brave Search:**
- Fast, comprehensive results
- Requires `BRAVE_SEARCH_API_KEY`
- Adult content filtering
- Duplicate filtering

**Serper:**
- Google search results
- Requires `SERPER_API_KEY`
- Location-based results
- Language support

**Configuration:**
```typescript
// In search.config.ts
primaryProvider: process.env.SEARCH_PRIMARY_PROVIDER || 'brave'
fallbackProvider: process.env.SEARCH_FALLBACK_PROVIDER || 'serper'
```

**Provider Override:**
```typescript
const result = await searchService.search(
  'query',
  10,
  { providerOverride: 'serper' }  // Force specific provider
);
```

---

### 7. GraphRAG Integration

Optional ingestion of search results into knowledge graph.

**Configuration:**
```typescript
// Enable in search.config.ts
graphRag: {
  ingestResults: true,
  groupId: 'your-group-id',
  maxDocumentsPerRun: 5
}
```

**What Gets Ingested:**
- Top 5 results from each search
- Query, title, snippet, URL, source, date
- Formatted as markdown document
- Automatically processed for RAG

**Use Case:**
- Build knowledge base from searches
- Enable semantic search over results
- Cross-reference information

---

## When to Use

### ✅ Use Web Search When:

1. **Current Information Needed**
   - Latest news and events
   - Recent developments
   - Current facts and statistics
   - Time-sensitive information

2. **Broad Topic Research**
   - General overviews
   - Multiple perspectives
   - Comparative analysis
   - Trending topics

3. **Fact-Checking**
   - Verify claims
   - Check sources
   - Compare accounts
   - Find authoritative sources

4. **Discovery**
   - Find tutorials and guides
   - Explore new topics
   - Locate resources
   - Identify experts

5. **Real-Time Data**
   - Weather
   - Stock prices
   - Sports scores
   - Breaking news

---

## When NOT to Use

### ❌ Do NOT Use Web Search When:

1. **User Provided Specific URLs**
   - **Limitation:** Searches the web, doesn't fetch specific pages
   - **Alternative:** Use dedicated web scraping or content fetching tool
   - **Why:** Tool is for discovering content, not retrieving known URLs

2. **Deep Technical Documentation Needed**
   - **Limitation:** Snippets may miss critical details
   - **Alternative:** Use `deepSearch: true` or fetch official docs directly
   - **Why:** API docs, specs, and manuals need complete context

3. **Private/Proprietary Information**
   - **Limitation:** Only searches publicly indexed web
   - **Alternative:** Query internal databases or APIs
   - **Why:** Cannot access password-protected or private content

4. **Precise Numerical Calculations**
   - **Limitation:** Search results may be outdated or approximate
   - **Alternative:** Use calculation APIs or authoritative data sources
   - **Why:** Financial, scientific, or statistical data needs accuracy

5. **Historical Data Analysis**
   - **Limitation:** Focus on current/recent content
   - **Alternative:** Use academic databases or archives
   - **Why:** Search engines prioritize recent content

6. **Image/Video/File Search**
   - **Limitation:** Text-based search only
   - **Alternative:** Use specialized media search APIs
   - **Why:** Tool designed for textual information retrieval

7. **Real-Time Streaming Data**
   - **Limitation:** Snapshot search, not continuous monitoring
   - **Alternative:** Use webhooks, WebSockets, or RSS feeds
   - **Why:** Cache and processing introduce latency

---

## Configuration

### Environment Variables

```bash
# Tool Enable/Disable
TOOL_WEBSEARCH_ENABLED=true

# Providers
SEARCH_PRIMARY_PROVIDER=brave
SEARCH_FALLBACK_PROVIDER=serper

# Brave Search
BRAVE_SEARCH_API_KEY=your_key_here
BRAVE_SEARCH_ENDPOINT=https://api.search.brave.com/res/v1/web/search
SEARCH_BRAVE_FILTER_ADULT=true
SEARCH_BRAVE_FILTER_DUPLICATES=true

# Serper
SERPER_API_KEY=your_key_here
SERPER_ENDPOINT=https://google.serper.dev/search
SERPER_LOCATION="United States"
SERPER_GL=us
SERPER_HL=en

# Search Behavior
SEARCH_MAX_RESULTS=10
SEARCH_REQUEST_TIMEOUT_MS=10000
SEARCH_MIN_QUERY_LENGTH=3
SEARCH_MAX_QUERY_LENGTH=500
SEARCH_RATE_LIMIT_PER_MINUTE=30
SEARCH_LOG_RESULTS=true

# Caching
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_SECONDS=3600

# GraphRAG Integration
SEARCH_INGEST_RESULTS=false
SEARCH_INGEST_GROUP_ID=
SEARCH_INGEST_MAX_DOCS=5
```

### Runtime Configuration

```typescript
import { searchConfig } from '@/lib/tools/web-search/search.config';

// Check config
console.log('Enabled:', searchConfig.enabled);
console.log('Primary:', searchConfig.primaryProvider);
console.log('Max Results:', searchConfig.maxResults);
console.log('Cache TTL:', searchConfig.cache.ttlSeconds);
```

---

## Common Workflows

### 1. Basic News Search

```typescript
async function getLatestNews(topic: string) {
  const result = await webSearchTool.execute({
    query: `latest ${topic} news`,
    maxResults: 10,
    summarize: true  // Get concise summaries
  });

  console.log(`Latest ${topic} News:\n`);

  result.results.forEach((r, i) => {
    console.log(`${i+1}. ${r.title}`);
    console.log(`   ${r.summary}`);
    console.log(`   Source: ${r.source} | ${r.publishedAt}`);
    console.log(`   Confidence: ${r.confidenceScore?.toFixed(2)}`);
    console.log('');
  });

  return result;
}

// Usage
await getLatestNews('AI');
```

---

### 2. Research with Deep Analysis

```typescript
async function deepResearch(topic: string, userId: string, conversationId: string) {
  const result = await webSearchTool.execute({
    query: topic,
    maxResults: 5,
    deepSearch: true,    // Fetch full content
    autoRefine: true,    // Improve query if needed
    summarize: true      // Already enabled by deepSearch
  }, conversationId, userId);

  console.log(`Deep Research: ${topic}\n`);
  console.log(`Query used: ${result.query}`);
  console.log(`Provider: ${result.metadata.provider}`);
  console.log(`Latency: ${result.metadata.latencyMs}ms\n`);

  result.results.forEach((r, i) => {
    console.log(`\n${i+1}. ${r.title}`);
    console.log(`   URL: ${r.url}`);
    console.log(`   Confidence: ${r.confidenceScore?.toFixed(3)}`);

    if (r.fullContent) {
      console.log(`   Full Content: ${r.fullContent.length} chars`);
    }

    console.log(`\n   Summary:`);
    console.log(`   ${r.summary}`);
  });

  return result;
}
```

---

### 3. Fact-Checking Pipeline

```typescript
async function factCheck(claim: string) {
  // Search for the claim
  const result = await webSearchTool.execute({
    query: claim,
    maxResults: 15,
    summarize: true
  });

  // Analyze source credibility
  const highTrust = result.results.filter(r =>
    (r.confidenceScore ?? 0) > 0.8
  );

  const mediumTrust = result.results.filter(r =>
    (r.confidenceScore ?? 0) > 0.6 && (r.confidenceScore ?? 0) <= 0.8
  );

  console.log(`Fact-Check: "${claim}"\n`);
  console.log(`High Trust Sources (${highTrust.length}):`);
  highTrust.forEach(r => {
    console.log(`  - ${r.title}`);
    console.log(`    ${r.source} (Score: ${r.confidenceScore?.toFixed(2)})`);
    console.log(`    ${r.summary}\n`);
  });

  console.log(`Medium Trust Sources (${mediumTrust.length}):`);
  mediumTrust.forEach(r => {
    console.log(`  - ${r.title} (${r.confidenceScore?.toFixed(2)})`);
  });

  return {
    claim,
    highTrustCount: highTrust.length,
    mediumTrustCount: mediumTrust.length,
    allResults: result.results
  };
}
```

---

### 4. Comparison Research

```typescript
async function compareTopics(topicA: string, topicB: string) {
  const [resultA, resultB] = await Promise.all([
    webSearchTool.execute({ query: topicA, maxResults: 10, summarize: true }),
    webSearchTool.execute({ query: topicB, maxResults: 10, summarize: true })
  ]);

  console.log(`Comparison: "${topicA}" vs "${topicB}"\n`);

  console.log(`${topicA}:`);
  console.log(`  Results: ${resultA.resultCount}`);
  console.log(`  Avg Confidence: ${avgConfidence(resultA.results).toFixed(2)}`);
  console.log(`  Top Source: ${resultA.results[0]?.source}`);

  console.log(`\n${topicB}:`);
  console.log(`  Results: ${resultB.resultCount}`);
  console.log(`  Avg Confidence: ${avgConfidence(resultB.results).toFixed(2)}`);
  console.log(`  Top Source: ${resultB.results[0]?.source}`);

  return { resultA, resultB };
}

function avgConfidence(results: any[]) {
  const scores = results.map(r => r.confidenceScore ?? 0.5);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```

---

### 5. Monitoring Topic Trends

```typescript
async function monitorTopic(topic: string, checkInterval: number = 3600000) {
  let previousResults: string[] = [];

  async function check() {
    const result = await webSearchTool.execute({
      query: `latest ${topic}`,
      maxResults: 5,
      summarize: true
    });

    const currentUrls = result.results.map(r => r.url);
    const newResults = result.results.filter(r =>
      !previousResults.includes(r.url)
    );

    if (newResults.length > 0) {
      console.log(`\n🔔 New updates on "${topic}":\n`);
      newResults.forEach(r => {
        console.log(`  ${r.title}`);
        console.log(`  ${r.summary}`);
        console.log(`  ${r.url}\n`);
      });
    } else {
      console.log(`No new updates for "${topic}"`);
    }

    previousResults = currentUrls;
  }

  // Initial check
  await check();

  // Set up interval
  return setInterval(check, checkInterval);
}

// Monitor AI news every hour
const monitor = await monitorTopic('AI developments', 3600000);

// Stop monitoring
// clearInterval(monitor);
```

---

## Troubleshooting

### Issue: "Web search is disabled"

**Error:** `ConfigurationError: Web search is disabled`

**Cause:** `TOOL_WEBSEARCH_ENABLED` not set to `true`

**Solution:**
```bash
# In .env
TOOL_WEBSEARCH_ENABLED=true
```

---

### Issue: "No provider returned results"

**Error:** `ExecutionError: Search failed - No provider returned results`

**Cause:** Both Brave and Serper API keys missing or invalid

**Solution:**
```bash
# Set at least one provider API key
BRAVE_SEARCH_API_KEY=your_brave_key
# OR
SERPER_API_KEY=your_serper_key
```

**Verify:**
```typescript
import { searchConfig } from '@/lib/tools/web-search/search.config';

console.log('Brave Key:', searchConfig.providers.brave.apiKey ? 'Set' : 'Missing');
console.log('Serper Key:', searchConfig.providers.serper.apiKey ? 'Set' : 'Missing');
```

---

### Issue: "Query must be at least 3 characters"

**Error:** `ValidationError: Query must be at least 3 characters long`

**Cause:** Query too short

**Solution:** Use longer, more specific queries
```typescript
// ❌ Bad
{ query: 'AI' }

// ✅ Good
{ query: 'AI latest news' }
```

---

### Issue: Deep search returns no full content

**Symptom:** `fullContent` is undefined for all results

**Possible Causes:**
1. Sites block scraping (403/401 errors)
2. JavaScript-rendered content
3. Network timeout (10s limit)
4. Invalid HTML structure

**Solution:**
```typescript
// Check logs for fetch errors
const result = await webSearchTool.execute({
  query: 'topic',
  deepSearch: true
});

result.results.forEach(r => {
  if (!r.fullContent) {
    console.log('Failed to fetch:', r.url);
    // Fallback to snippet
    console.log('Using snippet:', r.snippet);
  }
});
```

---

### Issue: Summarization fails silently

**Symptom:** `summary` equals `snippet` (not summarized)

**Possible Causes:**
1. OpenAI API key missing
2. Rate limit exceeded
3. Model unavailable
4. Network error

**Solution:**
```bash
# Verify OpenAI key
OPENAI_API_KEY=your_key_here
```

**Check logs:**
```
[SummarizationService] Failed to summarize results: <error>
[SummarizationService] Falling back to original snippet
```

---

### Issue: Auto-refinement not working

**Symptom:** Poor results not auto-refined

**Possible Causes:**
1. `autoRefine: false` (default)
2. Results not poor enough (avg confidence ≥ 0.4)
3. Result count ≥ 3

**Solution:**
```typescript
// Explicitly enable
const result = await webSearchTool.execute({
  query: 'vague query',
  autoRefine: true  // Must enable
});
```

**Check threshold:**
```typescript
import { POOR_RESULTS_THRESHOLD } from '@/lib/tools/web-search/query-refinement.service';

console.log('Threshold:', POOR_RESULTS_THRESHOLD);
// { avgConfidence: 0.4, minResultCount: 3 }
```

---

### Issue: Cache not working

**Symptom:** Same query always fetches from provider

**Possible Causes:**
1. Cache disabled in config
2. Different `maxResults` values
3. Query normalization differs
4. Cache expired

**Solution:**
```bash
# Enable cache
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_SECONDS=3600
```

**Debug:**
```typescript
import { searchConfig } from '@/lib/tools/web-search/search.config';

console.log('Cache enabled:', searchConfig.cache.enabled);
console.log('Cache TTL:', searchConfig.cache.ttlSeconds);
```

**Manual cache check:**
```sql
SELECT * FROM web_search_cache
WHERE query = 'your query'
AND expires_at > NOW()
ORDER BY created_at DESC
LIMIT 1;
```

---

## Performance

### Latency Breakdown

| Operation | Typical Time | Notes |
|-----------|--------------|-------|
| Basic search | 200-500ms | Provider API call |
| + Confidence scoring | +50-100ms | Runs on all results |
| + Summarization (10 results) | +2-4s | Parallel LLM calls |
| + Deep search (3 pages) | +3-9s | Parallel page fetches |
| + Query refinement | +1-3s | Only when triggered |
| **Total (all features)** | **6-17s** | Worst case with all options |

### Optimization Tips

1. **Use Cache:**
   ```typescript
   // Repeated queries return instantly from cache
   SEARCH_CACHE_ENABLED=true
   ```

2. **Limit Results:**
   ```typescript
   // Fewer results = faster processing
   { maxResults: 5 }  // vs 20
   ```

3. **Selective Deep Search:**
   ```typescript
   // Only use when full content needed
   { deepSearch: false }  // Default
   ```

4. **Batch Searches:**
   ```typescript
   // Run searches in parallel
   const [r1, r2, r3] = await Promise.all([
     webSearchTool.execute({ query: 'topic1' }),
     webSearchTool.execute({ query: 'topic2' }),
     webSearchTool.execute({ query: 'topic3' })
   ]);
   ```

5. **Smart Auto-Refine:**
   ```typescript
   // Only enable for user queries (not known-good queries)
   const isUserQuery = true;
   { autoRefine: isUserQuery }
   ```

---

## Testing

### Run Tests

```bash
cd /lib/tools/web-search/__tests__
npm test
```

### Manual Testing

```bash
# Test basic search
npx tsx -e "
import webSearchTool from './index';
const result = await webSearchTool.execute({ query: 'test' });
console.log('Results:', result.resultCount);
"

# Test with summarization
npx tsx test-summarization.ts

# Test deep search
npx tsx test-deep-search.ts
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | Oct 12, 2025 | Initial implementation |
| 1.0.1 | Oct 18, 2025 | Added deep search, auto-refinement, confidence scoring |

---

## Related Documentation

- **Quick Start Guide:** `QUICK_START.md`
- **Deep Search Explained:** `DEEP_SEARCH_EXPLAINED.md`
- **Brave API Pricing:** `BRAVE_API_PRICING_GUIDE.md`
- **Data Storage Rights:** `DATA_STORAGE_RIGHTS_EXPLAINED.md`
- **E2E Test Results:** `E2E_TEST_RESULTS_BASE_AI.md`

---

**Last Updated:** October 22, 2025
**Maintained By:** FineTune Lab Development Team
