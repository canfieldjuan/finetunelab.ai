# Validation Set RAG Integration - Phased Implementation Plan
**Date**: November 29, 2025
**Approach**: Integrate validation sets with existing Graphiti/Neo4j GraphRAG system
**Status**: INVESTIGATION COMPLETE - Ready for implementation

---

## Executive Summary

### Current State ✅
You already have a complete GraphRAG implementation:
- **Graphiti**: Graph-based RAG system with embeddings and semantic search
- **Neo4j**: Knowledge graph database for entity/relationship storage
- **Episode Service**: Adds documents as episodes with automatic entity extraction
- **Search Service**: Hybrid search (semantic + keyword) with vector similarity
- **Chat Integration**: GraphRAG tool already used in chat UI

### Goal
Integrate validation sets into the existing GraphRAG system so:
1. Validation sets are stored as episodes in Neo4j (not separate table)
2. Test cases are embedded and searchable like documents
3. Analytics assistant can semantically search for relevant test cases
4. Compare actual responses to similar expected responses using RAG

---

## Architecture Analysis

### Existing GraphRAG Flow

**Document Upload → GraphRAG**:
```
1. User uploads document.pdf
2. Parse content → text
3. Create episode: { name, episode_body, source_description, group_id }
4. Graphiti API adds episode → Creates entities/relations in Neo4j
5. Returns episode_id
6. Search later: semantic/hybrid search finds relevant facts
```

**File**: `lib/graphrag/graphiti/episode-service.ts`
- `addDocument()` - Adds single episode
- `addDocumentChunked()` - Splits large docs into chunks

**File**: `lib/graphrag/graphiti/search-service.ts`
- `search()` - Hybrid search with embeddings
- `searchCustom()` - Custom top-K and threshold

---

### Proposed: Validation Set → GraphRAG

**Validation Upload → GraphRAG**:
```
1. User uploads validation-set.json
2. Parse test cases
3. For each test case:
   - Create episode with prompt + expected_response as content
   - Tag with source_description: "validation_test_case"
   - group_id: userId
4. Graphiti embeds and creates entities
5. Later: semantic search finds similar test cases
```

**Key Insight**: Validation test cases ARE just specialized documents!
- They have content (prompt + expected_response)
- They should be searchable by semantic similarity
- They belong to a user (group_id)
- They have metadata (keywords, tone, max_length)

---

## Why RAG is Better Than Database Storage

### Current Upload API (Database Only) ❌
```typescript
// Stores in validation_sets table
{
  id: uuid,
  user_id: uuid,
  name: "PC Troubleshooting",
  test_cases: JSONB  // ← Not searchable by embeddings!
}
```

**Problems**:
- Test cases stored as flat JSON
- No embeddings, no semantic search
- To compare, must loop through ALL test cases
- Doesn't scale (1000+ test cases = slow)

### Proposed: RAG-Integrated ✅
```typescript
// Each test case becomes an episode in Neo4j
Episode {
  name: "validation: My PC won't turn on",
  episode_body: "Prompt: My PC won't turn on\nExpected: Let's check the basics...",
  source_description: "validation_test_case|PC Troubleshooting|keywords:power,cable",
  group_id: userId
}
```

**Benefits**:
- ✅ Automatic embeddings via Graphiti
- ✅ Semantic search finds similar test cases
- ✅ Scales to 10,000+ test cases (vector search is fast)
- ✅ Reuses existing infrastructure (no new tables!)
- ✅ Can query: "Find test cases similar to this response"

---

## Phased Implementation Plan

### Phase 1: Extend Upload Handler to Use GraphRAG ✅

**Goal**: When user uploads validation set, add each test case as Graphiti episode

**Files to Modify**:
1. `app/api/validation-sets/route.ts` - Upload endpoint
2. `lib/graphrag/graphiti/episode-service.ts` - Add `addValidationTestCase()` method

**Changes**:

#### 1.1 Add Method to EpisodeService

**File**: `lib/graphrag/graphiti/episode-service.ts`

**Insert After**: `addDocumentChunked()` method (around line 86)

**New Method**:
```typescript
/**
 * Add a validation test case as an episode
 * @param testCase - Test case with prompt and expected_response
 * @param userId - User ID (group_id)
 * @param validationSetName - Name of the validation set
 * @returns Episode ID
 */
async addValidationTestCase(
  testCase: {
    prompt: string;
    expected_response: string;
    keywords_required?: string[];
    tone?: string;
    max_length?: number;
    [key: string]: unknown;
  },
  userId: string,
  validationSetName: string
): Promise<AddEpisodeResult> {
  // Build episode content combining prompt and expected response
  const episodeBody = `VALIDATION TEST CASE

Prompt: ${testCase.prompt}

Expected Response: ${testCase.expected_response}`;

  // Build source description with metadata for filtering
  const metadata = {
    type: 'validation_test_case',
    validation_set: validationSetName,
    keywords: testCase.keywords_required?.join(',') || '',
    tone: testCase.tone || '',
    max_length: testCase.max_length || 0,
  };

  const sourceDescription = JSON.stringify(metadata);

  const episode: GraphitiEpisode = {
    name: `validation: ${testCase.prompt.substring(0, 50)}`,
    episode_body: episodeBody,
    source_description: sourceDescription,
    reference_time: new Date().toISOString(),
    group_id: userId,
  };

  const response = await this.client.addEpisode(episode);

  return {
    episodeId: response.episode_id,
    entitiesCreated: response.entities_created,
    relationsCreated: response.relations_created,
  };
}
```

**Why This Works**:
- Reuses existing `addEpisode()` method
- Formats test case as episode with structured content
- Metadata in `source_description` allows filtering
- `group_id` ensures user privacy (users only see their test cases)

---

#### 1.2 Modify Upload Handler

**File**: `app/api/validation-sets/route.ts`

**Current Code** (lines 76-99):
```typescript
// Insert into database
const { data, error } = await supabase
  .from('validation_sets')
  .insert({
    user_id: user.id,
    name: body.name,
    description: body.description || null,
    test_cases: body.test_cases,
  })
  .select()
  .single();
```

**New Code**:
```typescript
import { episodeService } from '@/lib/graphrag/graphiti';

// Add each test case to Graphiti as an episode
const episodeIds: string[] = [];
let entitiesTotal = 0;
let relationsTotal = 0;

for (const testCase of body.test_cases) {
  try {
    const result = await episodeService.addValidationTestCase(
      testCase,
      user.id,
      body.name
    );
    episodeIds.push(result.episodeId);
    entitiesTotal += result.entitiesCreated;
    relationsTotal += result.relationsCreated;
  } catch (error) {
    console.error('[ValidationSets] Error adding test case to Graphiti:', error);
    // Continue processing other test cases even if one fails
  }
}

// Store metadata in validation_sets table
const { data, error } = await supabase
  .from('validation_sets')
  .insert({
    user_id: user.id,
    name: body.name,
    description: body.description || null,
    test_cases: body.test_cases, // Keep for reference
    neo4j_episode_ids: episodeIds, // NEW: Link to Neo4j episodes
  })
  .select()
  .single();

console.log('[ValidationSets] Added to Graphiti:', {
  episodeCount: episodeIds.length,
  entitiesCreated: entitiesTotal,
  relationsCreated: relationsTotal,
});
```

**Migration**: Add `neo4j_episode_ids` column to `validation_sets` table:
```sql
ALTER TABLE validation_sets ADD COLUMN neo4j_episode_ids TEXT[] DEFAULT '{}';
```

---

### Phase 2: Add Semantic Search for Validation Sets ✅

**Goal**: Create tool to semantically search validation test cases

**Files to Modify**:
1. `lib/graphrag/graphiti/search-service.ts` - Add validation-specific search
2. `app/api/analytics/chat/route.ts` - Add `compare_to_validation_set` tool

**Changes**:

#### 2.1 Add Validation Search Method

**File**: `lib/graphrag/graphiti/search-service.ts`

**Insert After**: `getRelatedEntities()` method (around line 105)

**New Method**:
```typescript
/**
 * Search validation test cases similar to a given response
 * @param response - Actual response to compare
 * @param userId - User ID to filter validation sets
 * @param validationSetName - Optional: filter by specific validation set
 * @param topK - Number of similar test cases to return
 */
async searchValidationTestCases(
  response: string,
  userId: string,
  validationSetName?: string,
  topK: number = 3
): Promise<SearchResult> {
  const startTime = Date.now();

  // Build search query from response
  const searchQuery = `Find validation test cases similar to: ${response.substring(0, 500)}`;

  const params: GraphitiSearchParams = {
    query: searchQuery,
    group_ids: [userId],
    num_results: topK * 2, // Get more than needed for filtering
  };

  const graphitiResult = await this.client.search(params);

  // Filter to only validation test case episodes
  const validationEdges = graphitiResult.edges.filter(edge => {
    try {
      const sourceDesc = edge.source_description || '';
      const metadata = JSON.parse(sourceDesc);

      // Must be validation test case
      if (metadata.type !== 'validation_test_case') return false;

      // Filter by validation set name if specified
      if (validationSetName && metadata.validation_set !== validationSetName) {
        return false;
      }

      return true;
    } catch {
      return false; // Invalid JSON in source_description
    }
  }).slice(0, topK); // Limit to requested topK

  const context = this.buildContextFromEdges(validationEdges);
  const sources = this.extractSourcesFromEdges(validationEdges);

  return {
    context,
    sources,
    metadata: {
      searchMethod: 'hybrid',
      resultsCount: validationEdges.length,
      queryTime: Date.now() - startTime,
    },
  };
}
```

---

#### 2.2 Add Analytics Tool

**File**: `app/api/analytics/chat/route.ts`

**Add Tool Definition** (after `evaluate_messages` tool, around line 272):

```typescript
{
  type: 'function',
  function: {
    name: 'compare_to_validation_set',
    description: 'Compare session responses to validation set using semantic similarity. Finds the most similar expected responses from the validation set and scores how close the actual responses are. Use when user asks to validate against expected answers or check response quality against golden examples.',
    parameters: {
      type: 'object',
      properties: {
        message_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of message IDs to compare (get from get_session_conversations, filter to assistant messages)'
        },
        validation_set_name: {
          type: 'string',
          description: 'Name of the validation set to compare against (optional - if not provided, searches all validation sets)'
        },
        top_k_matches: {
          type: 'number',
          description: 'Number of similar test cases to compare each message against (default: 3)',
          default: 3
        }
      },
      required: ['message_ids']
    }
  }
}
```

**Add Handler Function** (before `executeAnalyticsTool`):

```typescript
async function compareToValidationSet(
  messageIds: string[],
  validationSetName: string | undefined,
  topKMatches: number = 3,
  authHeader: string
) {
  console.log(`[AnalyticsAPI] Comparing ${messageIds.length} messages to validation set`);

  try {
    // Import search service
    const { SearchService } = await import('@/lib/graphrag/graphiti/search-service');
    const searchService = new SearchService();

    // Get message contents
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content')
      .in('id', messageIds);

    if (error || !messages) {
      return { error: 'Failed to fetch messages' };
    }

    const comparisons = [];

    for (const message of messages) {
      // Search for similar validation test cases
      const searchResult = await searchService.searchValidationTestCases(
        message.content,
        authHeader, // userId extracted from auth
        validationSetName,
        topKMatches
      );

      // Parse similar test cases from context
      const similarTestCases = searchResult.sources.map(source => ({
        prompt: source.entity, // Entity names contain prompt snippets
        expected_response: source.fact,
        similarity_score: source.confidence,
      }));

      comparisons.push({
        message_id: message.id,
        actual_response: message.content.substring(0, 200), // Truncate for summary
        similar_test_cases: similarTestCases,
        average_similarity: similarTestCases.reduce((sum, tc) => sum + tc.similarity_score, 0) / (similarTestCases.length || 1),
      });
    }

    // Calculate overall statistics
    const avgSimilarity = comparisons.reduce((sum, c) => sum + c.average_similarity, 0) / comparisons.length;

    return {
      success: true,
      summary: {
        messages_compared: messageIds.length,
        validation_set: validationSetName || 'all',
        average_similarity: Math.round(avgSimilarity * 100) / 100,
        top_k_matches: topKMatches,
      },
      comparisons,
    };
  } catch (error: any) {
    console.error('[AnalyticsAPI] Error comparing to validation set:', error);
    return {
      error: true,
      message: `Failed to compare: ${error.message}`,
    };
  }
}
```

**Add to Tool Execution Switch**:
```typescript
case 'compare_to_validation_set':
  if (!authHeader) {
    return { error: 'Authorization required' };
  }
  return await compareToValidationSet(
    args.message_ids as string[],
    args.validation_set_name as string | undefined,
    args.top_k_matches as number | undefined,
    authHeader
  );
```

---

### Phase 3: Update System Prompt ✅

**File**: `app/api/analytics/chat/route.ts`

**Update Tool Count**: "YOUR 8 TOOLS" → "YOUR 9 TOOLS"

**Add Tool Documentation** (after `evaluate_messages` description):

```
6. **compare_to_validation_set** - Compare responses to expected answers (RAG-powered)
   - USE when user asks "how close to the validation set", "compare to expected responses"
   - Semantically searches for similar test cases in validation set
   - Returns similarity scores and specific mismatches
   - Example: User asks "Compare session to PC Troubleshooting validation"
   → get conversations → filter assistant messages → compare_to_validation_set
```

---

## Verification & Testing Plan

### Phase 1 Verification ✅

1. **Upload Test**:
   ```bash
   # Upload validation set via UI
   # Check logs for Graphiti episode creation
   # Verify episodeIds stored in validation_sets.neo4j_episode_ids
   ```

2. **Neo4j Verification**:
   ```cypher
   // Query Neo4j directly
   MATCH (n)
   WHERE n.name STARTS WITH 'validation:'
   RETURN n.name, n.content, n.created_at
   LIMIT 10
   ```

3. **Database Check**:
   ```sql
   SELECT name, array_length(neo4j_episode_ids, 1) as episode_count
   FROM validation_sets
   WHERE user_id = 'xxx';
   ```

---

### Phase 2 Verification ✅

1. **Search Test**:
   ```typescript
   // In analytics chat, ask:
   "Compare the session responses to the PC Troubleshooting validation set"

   // Should:
   // 1. Call get_session_conversations
   // 2. Filter to assistant messages
   // 3. Call compare_to_validation_set
   // 4. Return similarity scores
   ```

2. **Semantic Match Test**:
   ```
   Validation test case: "My PC won't turn on"
   Expected: "Check power cable..."

   Actual response: "The computer isn't starting"

   Should find the similar test case even though wording differs!
   ```

---

## Migration Path

### Step 1: Run Database Migration
```sql
-- Add neo4j_episode_ids column
ALTER TABLE validation_sets ADD COLUMN IF NOT EXISTS neo4j_episode_ids TEXT[] DEFAULT '{}';
```

### Step 2: Backfill Existing Validation Sets (if any)
```typescript
// If you already uploaded validation sets before RAG integration:
// Run one-time migration script to add them to Graphiti
// (Script not needed if starting fresh)
```

### Step 3: Deploy Changes
1. Deploy `episode-service.ts` with new method
2. Deploy `validation-sets/route.ts` with Graphiti integration
3. Deploy `search-service.ts` with validation search
4. Deploy `analytics/chat/route.ts` with new tool

---

## Risk Analysis & Mitigation

### Risk 1: Graphiti Timeout on Large Uploads
**Problem**: Uploading 100+ test cases might timeout

**Mitigation**:
- Process test cases in batches of 10
- Show progress in UI ("Processing 10/100...")
- Set longer timeout for validation uploads

---

### Risk 2: Search Returns Wrong Test Cases
**Problem**: Semantic search might match irrelevant test cases

**Mitigation**:
- Filter by validation_set_name to narrow scope
- Use `top_k=3` to only get best matches
- Check similarity score threshold (>0.7 = good match)

---

### Risk 3: Neo4j Episode IDs Lost
**Problem**: If validation_sets record deleted, orphaned episodes remain

**Mitigation**:
- Add cleanup job to remove orphaned episodes
- Tag episodes with validation_set_id in metadata
- Implement DELETE endpoint that removes both DB record and Neo4j episodes

---

## Files to Modify - Summary

| File | Changes | Risk Level |
|------|---------|-----------|
| `lib/graphrag/graphiti/episode-service.ts` | Add `addValidationTestCase()` method | LOW - New method, no existing code changes |
| `app/api/validation-sets/route.ts` | Call `episodeService.addValidationTestCase()` in POST handler | MEDIUM - Modifies upload flow |
| `supabase/migrations/20251129_alter_validation_sets.sql` | Add `neo4j_episode_ids` column | LOW - Additive change |
| `lib/graphrag/graphiti/search-service.ts` | Add `searchValidationTestCases()` method | LOW - New method |
| `app/api/analytics/chat/route.ts` | Add tool + handler for `compare_to_validation_set` | LOW - Additive change |

**Total Risk**: LOW - All changes are additive (no deletions or breaking changes)

---

## Next Steps

Ready to implement?  I can start with Phase 1:
1. Add `addValidationTestCase()` to EpisodeService
2. Modify upload handler to use Graphiti
3. Run database migration
4. Test upload with sample validation set

Or would you like me to verify anything else first?
