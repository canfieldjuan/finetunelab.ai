# Prompt Testing Tool - Implementation Plan

**Date:** October 13, 2025  
**Context:** LLM Evaluation & Fine-tuning Platform  
**Priority:** HIGH - Critical for evaluation workflow  

---

## VERIFIED SYSTEM CONTEXT

### Existing Infrastructure ✅

**GraphRAG System:**

- ✅ `/lib/graphrag/` - Complete GraphRAG implementation
- ✅ Episode service for storing patterns
- ✅ Search functionality for retrieving context
- ✅ Document processing pipeline

**Message System:**

- ✅ `messages` table with conversation history
- ✅ `message_evaluations` table for ratings
- ✅ `/app/api/chat/route.ts` - Chat endpoint with LLM integration

**Tools System:**

- ✅ Tool registry with auto-registration
- ✅ Dataset Management Tool for accessing training data
- ✅ Calculator, DateTime, WebSearch, Filesystem tools

---

## PROMPT TESTING TOOL DESIGN

### Core Functionality

The Prompt Testing Tool enables A/B testing of prompts, stores successful patterns in GraphRAG, and provides evaluation metrics for prompt optimization.

### Operations

1. **test_prompt** - Test a single prompt against messages
2. **compare_prompts** - A/B test multiple prompt variations
3. **save_pattern** - Save successful prompt to GraphRAG
4. **search_patterns** - Find similar successful prompts
5. **evaluate_results** - Score prompt performance

### Tool Definition

```typescript
{
  name: 'prompt_tester',
  description: 'Test and compare prompts for LLM responses. A/B test variations, save successful patterns to GraphRAG, and evaluate performance.',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['test', 'compare', 'save_pattern', 'search_patterns', 'evaluate'],
        description: 'Prompt testing operation',
        required: true
      },
      prompt: {
        type: 'string',
        description: 'Prompt template to test'
      },
      prompts: {
        type: 'array',
        description: 'Multiple prompts for A/B testing'
      },
      test_messages: {
        type: 'array',
        description: 'Messages to test against'
      },
      pattern_name: {
        type: 'string',
        description: 'Name for saved pattern'
      },
      search_query: {
        type: 'string',
        description: 'Query to find similar patterns'
      }
    },
    required: ['operation']
  }
}
```

---

## IMPLEMENTATION PHASES

### Phase 1: Types & Configuration (10 min)

**File:** `/lib/tools/prompt-tester/types.ts`

```typescript
export interface PromptTest {
  prompt: string;
  test_messages: string[];
  results?: PromptTestResult[];
}

export interface PromptTestResult {
  message: string;
  response: string;
  tokens_used: number;
  latency_ms: number;
  timestamp: string;
}

export interface PromptComparison {
  prompts: string[];
  test_messages: string[];
  results: ComparisonResult[];
  winner?: string;
  metrics: ComparisonMetrics;
}

export interface ComparisonResult {
  message: string;
  responses: {
    prompt_index: number;
    response: string;
    tokens: number;
    latency: number;
  }[];
}

export interface ComparisonMetrics {
  avg_tokens: number[];
  avg_latency: number[];
  quality_scores: number[];
}

export interface SavedPattern {
  name: string;
  prompt: string;
  description: string;
  use_cases: string[];
  performance_metrics: {
    avg_tokens: number;
    avg_latency: number;
    success_rate: number;
  };
  saved_at: string;
}
```

**File:** `/lib/tools/prompt-tester/prompt.config.ts`

```typescript
export const promptConfig = {
  enabled: true,
  maxTestMessages: 10,
  maxPromptLength: 2000,
  defaultModel: 'gpt-4',
  timeout: 30000,
  graphragGroupId: 'prompt_patterns',
};
```

### Phase 2: LLM Service Integration (20 min)

**File:** `/lib/tools/prompt-tester/llm.service.ts`

Functions to implement:

- `testPrompt(prompt, messages)` - Test single prompt
- `comparePrompts(prompts, messages)` - Run A/B test
- `calculateMetrics(results)` - Compute performance metrics

**Integration Points:**

- Use existing `/lib/llm/openai.ts` for API calls
- Measure token usage and latency
- Handle errors gracefully

### Phase 3: GraphRAG Pattern Service (20 min)

**File:** `/lib/tools/prompt-tester/pattern.service.ts`

Functions to implement:

- `savePattern(pattern)` - Store in GraphRAG via episode service
- `searchPatterns(query)` - Search similar patterns
- `getPatternsByUseCase(useCase)` - Filter by use case

**GraphRAG Integration:**

```typescript
// Save pattern as episode
await episodeService.addEpisodes(supabase, {
  name: pattern.name,
  content: JSON.stringify(pattern),
  source: 'prompt_tester',
  groupId: 'prompt_patterns',
  entityEdges: [
    { name: pattern.name, labels: ['prompt', 'pattern'] }
  ]
});

// Search patterns
const results = await episodeService.search(supabase, {
  query: searchQuery,
  groupIds: ['prompt_patterns'],
  limit: 10
});
```

### Phase 4: Main Service Layer (30 min)

**File:** `/lib/tools/prompt-tester/prompt.service.ts`

Orchestrate all operations:

- Validate inputs
- Route to appropriate sub-services
- Format results for tool response
- Handle GraphRAG integration

### Phase 5: Tool Definition (15 min)

**File:** `/lib/tools/prompt-tester/index.ts`

- Follow existing tool pattern
- Implement execute function
- Error handling with `[PromptTester] Category: message` format
- Return data directly

### Phase 6: Testing & Validation (25 min)

**File:** `/lib/tools/prompt-tester/test.ts`

Test scenarios:

- Test single prompt
- Compare multiple prompts
- Save pattern to GraphRAG
- Search for patterns
- Evaluate results
- Error handling

---

## DATABASE SCHEMA

### No New Tables Needed

Uses existing infrastructure:

- `messages` - Test data source
- GraphRAG episodes - Pattern storage
- No new migrations required

### GraphRAG Episode Structure

```json
{
  "name": "customer_support_greeting",
  "prompt": "You are a helpful customer support agent...",
  "description": "Friendly greeting for customer support",
  "use_cases": ["support", "onboarding", "help"],
  "performance_metrics": {
    "avg_tokens": 150,
    "avg_latency": 1200,
    "success_rate": 0.95
  },
  "saved_at": "2025-10-13T10:00:00Z"
}
```

---

## INTEGRATION WITH EXISTING SYSTEM

### LLM Integration

- Use existing OpenAI client from `/lib/llm/openai.ts`
- Reuse chat API infrastructure
- Leverage existing streaming support (optional)

### GraphRAG Integration

- Use episodeService from `/lib/graphrag/graphiti/episode-service.ts`
- Store patterns as structured episodes
- Search using existing search functionality

### Dataset Integration

- Use Dataset Manager Tool to get test messages
- Pull from user's conversation history
- Filter by quality/ratings

---

## CONVERSATIONAL UX FLOW

## Example 1: Test a Prompt

```text
User: "Test this prompt: 'You are a helpful assistant' with my recent messages"
Assistant: [Invokes prompt_tester with operation: 'test']
Response: "Tested prompt with 5 messages:
- Avg response: 142 tokens
- Avg latency: 1.2s
- All responses coherent and helpful"
```

## Example 2: A/B Test Prompts

```text
User: "Compare these two prompts: 'Be concise' vs 'Be detailed'"
Assistant: [Invokes prompt_tester with operation: 'compare']
Response: "A/B Test Results:
Prompt A (Be concise): 89 tokens avg, 0.8s latency
Prompt B (Be detailed): 203 tokens avg, 1.5s latency
Winner: Prompt A (better efficiency, similar quality)"
```

## Example 3: Save Successful Pattern

```text
User: "Save this prompt pattern as 'support_greeting'"
Assistant: [Invokes prompt_tester with operation: 'save_pattern']
Response: "Pattern 'support_greeting' saved to knowledge base.
Can be retrieved with: search for support greeting patterns"
```

## Example 4: Find Similar Patterns

```text
User: "Show me customer support prompts"
Assistant: [Invokes prompt_tester with operation: 'search_patterns']
Response: "Found 3 customer support patterns:
1. support_greeting - 95% success rate
2. issue_resolution - 88% success rate
3. escalation_handling - 92% success rate"
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Types & Config

- [ ] Create `/lib/tools/prompt-tester/` directory
- [ ] Create `types.ts` with all interfaces
- [ ] Create `prompt.config.ts` with settings
- [ ] Verify types align with GraphRAG schema

### Phase 2: LLM Service

- [ ] Create `llm.service.ts`
- [ ] Implement `testPrompt` function
- [ ] Implement `comparePrompts` function
- [ ] Implement `calculateMetrics` function
- [ ] Verify OpenAI integration works

### Phase 3: Pattern Service

- [ ] Create `pattern.service.ts`
- [ ] Implement `savePattern` function
- [ ] Implement `searchPatterns` function
- [ ] Implement `getPatternsByUseCase` function
- [ ] Verify GraphRAG integration works

### Phase 4: Main Service

- [ ] Create `prompt.service.ts`
- [ ] Implement routing logic
- [ ] Add input validation
- [ ] Add result formatting
- [ ] Verify all operations work

### Phase 5: Tool Definition

- [ ] Create `index.ts` with ToolDefinition
- [ ] Implement execute function
- [ ] Add error handling
- [ ] Verify parameters match schema
- [ ] Register in tool registry

### Phase 6: Testing

- [ ] Create test file with unit tests
- [ ] Test all 5 operations
- [ ] Test error cases
- [ ] Verify TypeScript compilation
- [ ] Test through chat interface

### Phase 7: Documentation

- [ ] Update PROGRESS_LOG.md
- [ ] Add usage examples
- [ ] Document GraphRAG integration

---

## SUCCESS CRITERIA

✅ Tool registers correctly in registry  
✅ All 5 operations work correctly  
✅ GraphRAG integration saves/retrieves patterns  
✅ LLM calls execute successfully  
✅ A/B testing compares prompts accurately  
✅ Error messages follow `[PromptTester] Category: message` format  
✅ TypeScript compiles with 0 errors  
✅ Conversational UX feels natural  
✅ No breaking changes to existing functionality  

---

## SECURITY CONSIDERATIONS

- API key handling (use existing env vars)
- Rate limiting for LLM calls
- Input validation for prompts
- User data isolation in GraphRAG
- Cost tracking for token usage

---

## NEXT STEPS AFTER COMPLETION

1. **Token Analysis Tool** - Track costs from prompt testing
2. **Evaluation Metrics Tool** - Deeper analysis of results
3. **UI Integration** - Visual prompt testing interface
4. **Batch Testing** - Test across entire datasets
