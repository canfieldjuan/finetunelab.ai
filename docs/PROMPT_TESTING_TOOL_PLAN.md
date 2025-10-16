# Prompt Testing Tool - Implementation Plan

**Date:** October 13, 2025  
**Context:** LLM Evaluation & Fine-tuning Platform  
**Priority:** CRITICAL - Core evaluation workflow  

---

## VERIFIED SYSTEM CONTEXT

### Existing Infrastructure ✅

**GraphRAG System:**
- ✅ Episode service for storing knowledge (`episodeService.addDocument`)
- ✅ Search functionality (`searchService.search`)
- ✅ Graphiti client integration
- ✅ Episode-based pattern storage capability

**Message System:**
- ✅ Messages table with conversation context
- ✅ Message evaluations for rating responses
- ✅ Conversation grouping

**LLM Integration:**
- ✅ OpenAI streaming (`lib/llm/openai.ts`)
- ✅ Tool calling support
- ✅ Token tracking

**Dataset Tool:**
- ✅ Export conversations
- ✅ Filter by quality
- ✅ Validation metrics

---

## PROMPT TESTING TOOL DESIGN

### Core Functionality

The Prompt Testing Tool enables A/B testing of prompts, pattern extraction, and storage of successful patterns to GraphRAG for future retrieval.

### Operations

1. **test_prompt** - Test a single prompt variation against reference data
2. **compare_prompts** - A/B test multiple prompt variations
3. **save_pattern** - Save successful prompt pattern to GraphRAG
4. **get_patterns** - Retrieve saved prompt patterns
5. **analyze_results** - Analyze test results and recommend best prompt

---

## TOOL DEFINITION

```typescript
{
  name: 'prompt_tester',
  description: 'Test and compare prompt variations, analyze results, and save successful patterns to GraphRAG for future use. Essential for prompt optimization and evaluation workflows.',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['test', 'compare', 'save_pattern', 'get_patterns', 'analyze'],
        description: 'Prompt testing operation to perform',
        required: true
      },
      prompt_template: {
        type: 'string',
        description: 'Prompt template with {variables} for testing'
      },
      prompt_variations: {
        type: 'array',
        description: 'Array of prompt templates for comparison',
        items: { type: 'string' }
      },
      test_data: {
        type: 'object',
        description: 'Test data with variables to inject into prompts',
        properties: {
          messages: { type: 'array' },
          variables: { type: 'object' }
        }
      },
      pattern_name: {
        type: 'string',
        description: 'Name for saved pattern'
      },
      pattern_metadata: {
        type: 'object',
        description: 'Metadata for pattern (use_case, avg_rating, success_rate)'
      },
      evaluation_criteria: {
        type: 'object',
        description: 'Criteria for evaluating responses',
        properties: {
          check_quality: { type: 'boolean' },
          check_length: { type: 'boolean' },
          check_relevance: { type: 'boolean' }
        }
      }
    },
    required: ['operation']
  }
}
```

---

## IMPLEMENTATION PHASES

### Phase 1: Types & Configuration (15 min)

**File:** `/lib/tools/prompt-tester/types.ts`

```typescript
export interface PromptTestResult {
  prompt: string;
  response: string;
  tokenCount: number;
  responseTime: number;
  qualityScore?: number;
  issues: string[];
}

export interface PromptComparison {
  variations: PromptTestResult[];
  winner: number; // Index of best variation
  reasoning: string;
  metrics: ComparisonMetrics;
}

export interface ComparisonMetrics {
  avgTokenCount: number[];
  avgResponseTime: number[];
  avgQualityScore: number[];
}

export interface PromptPattern {
  id: string;
  name: string;
  template: string;
  use_case: string;
  success_rate: number;
  avg_rating: number;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface TestOptions {
  max_tokens?: number;
  temperature?: number;
  iterations?: number;
}
```

**File:** `/lib/tools/prompt-tester/config.ts`

```typescript
export const promptTesterConfig = {
  enabled: true,
  maxIterations: 5,
  defaultTemperature: 0.7,
  defaultMaxTokens: 1000,
  minQualityThreshold: 3.0,
  graphragGroupId: 'prompt_patterns',
};
```

### Phase 2: Service Layer (45 min)

**File:** `/lib/tools/prompt-tester/prompt-tester.service.ts`

Core methods:
```typescript
class PromptTesterService {
  // Test single prompt
  async testPrompt(
    template: string,
    testData: TestData,
    options: TestOptions
  ): Promise<PromptTestResult>
  
  // A/B test multiple prompts
  async comparePrompts(
    variations: string[],
    testData: TestData,
    options: TestOptions
  ): Promise<PromptComparison>
  
  // Save successful pattern to GraphRAG
  async savePattern(
    name: string,
    template: string,
    metadata: PatternMetadata
  ): Promise<{ episodeId: string }>
  
  // Retrieve patterns from GraphRAG
  async getPatterns(
    useCase?: string
  ): Promise<PromptPattern[]>
  
  // Analyze test results
  async analyzeResults(
    results: PromptTestResult[]
  ): Promise<AnalysisResult>
}
```

**Key Implementation Details:**

1. **Prompt Variable Injection:**
```typescript
private injectVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (match, key) => variables[key] || match
  );
}
```

2. **LLM Testing:**
```typescript
private async executePrompt(
  prompt: string,
  options: TestOptions
): Promise<{ response: string; tokens: number; time: number }> {
  const startTime = Date.now();
  const response = await getOpenAIResponse(
    [{ role: 'user', content: prompt }],
    'gpt-4',
    options.temperature || 0.7,
    options.max_tokens || 1000
  );
  return {
    response: response.content,
    tokens: response.usage.total_tokens,
    time: Date.now() - startTime
  };
}
```

3. **GraphRAG Pattern Storage:**
```typescript
private async saveToGraphRAG(
  name: string,
  template: string,
  metadata: PatternMetadata
): Promise<string> {
  const content = JSON.stringify({
    type: 'prompt_pattern',
    name,
    template,
    ...metadata
  }, null, 2);
  
  const result = await episodeService.addDocument(
    content,
    promptTesterConfig.graphragGroupId,
    `pattern_${name}_${Date.now()}`
  );
  
  return result.episodeId;
}
```

4. **Pattern Retrieval:**
```typescript
private async retrieveFromGraphRAG(
  useCase?: string
): Promise<PromptPattern[]> {
  const query = useCase 
    ? `prompt patterns for ${useCase}`
    : 'all prompt patterns';
    
  const results = await searchService.search(
    query,
    promptTesterConfig.graphragGroupId
  );
  
  return results.sources.map(parsePattern);
}
```

5. **Quality Analysis:**
```typescript
private analyzeQuality(response: string): number {
  let score = 5;
  // Check length
  if (response.length < 50) score -= 1;
  if (response.length > 2000) score -= 0.5;
  // Check structure
  if (!response.includes('\n')) score -= 0.5;
  // Check completeness
  if (response.endsWith('...')) score -= 1;
  return Math.max(1, score);
}
```

### Phase 3: Tool Implementation (20 min)

**File:** `/lib/tools/prompt-tester/index.ts`

Follow existing tool pattern:
- Tool definition with proper parameters
- Execute function routing to service
- Error handling: `[PromptTester] ErrorType: message`
- Return data directly (no ToolExecutionResult)

### Phase 4: Testing & Validation (20 min)

**File:** `/lib/tools/prompt-tester/test.ts`

Test scenarios:
- Test single prompt with variables
- Compare 2-3 variations
- Save pattern to GraphRAG
- Retrieve patterns
- Analyze results

---

## USAGE EXAMPLES

### Example 1: Test Single Prompt

**User:** "Test this prompt: 'Explain {topic} in simple terms'"

**Tool Invocation:**
```json
{
  "operation": "test",
  "prompt_template": "Explain {topic} in simple terms",
  "test_data": {
    "variables": { "topic": "quantum computing" }
  }
}
```

**Response:**
```
Prompt Test Results:
✓ Response generated successfully
✓ Token count: 247
✓ Response time: 1.8s
✓ Quality score: 4.2/5

Response preview:
"Quantum computing uses quantum mechanics principles..."

Recommendation: Prompt works well for technical topics
```

### Example 2: A/B Test Prompts

**User:** "Compare these two prompts for explaining technical concepts"

**Tool Invocation:**
```json
{
  "operation": "compare",
  "prompt_variations": [
    "Explain {topic} like I'm 5",
    "Provide a beginner-friendly explanation of {topic}"
  ],
  "test_data": {
    "variables": { "topic": "machine learning" }
  }
}
```

**Response:**
```
A/B Test Results:

Variation 1: "Explain {topic} like I'm 5"
- Avg tokens: 156
- Avg time: 1.2s
- Quality: 3.8/5

Variation 2: "Provide a beginner-friendly explanation..."
- Avg tokens: 203
- Avg time: 1.5s  
- Quality: 4.5/5

Winner: Variation 2 ✓
Reasoning: Better structure and completeness while maintaining simplicity
```

### Example 3: Save Successful Pattern

**User:** "Save this prompt as a customer support pattern"

**Tool Invocation:**
```json
{
  "operation": "save_pattern",
  "pattern_name": "customer_support_empathy",
  "prompt_template": "I understand your concern about {issue}. Let me help you...",
  "pattern_metadata": {
    "use_case": "customer_support",
    "avg_rating": 4.7,
    "success_rate": 0.92
  }
}
```

**Response:**
```
Pattern Saved to GraphRAG ✓

Name: customer_support_empathy
Episode ID: ep_abc123
Use Case: customer_support
Success Rate: 92%

This pattern can now be retrieved for future use!
```

### Example 4: Retrieve Patterns

**User:** "Show me all prompt patterns for customer support"

**Tool Invocation:**
```json
{
  "operation": "get_patterns",
  "pattern_metadata": {
    "use_case": "customer_support"
  }
}
```

**Response:**
```
Found 3 Customer Support Patterns:

1. customer_support_empathy (Success: 92%)
   "I understand your concern about {issue}. Let me help..."
   
2. customer_support_solution (Success: 88%)
   "Here's how we can resolve {problem}..."
   
3. customer_support_followup (Success: 85%)
   "Just checking in about {previous_issue}..."
```

---

## INTEGRATION POINTS

### GraphRAG Integration
- Use `episodeService.addDocument()` for pattern storage
- Use `searchService.search()` for pattern retrieval
- Group ID: `'prompt_patterns'` for isolation

### LLM Integration
- Use existing `getOpenAIResponse()` from `lib/llm/openai.ts`
- Support temperature and max_tokens configuration
- Track token usage and response time

### Dataset Tool Integration
- Can test prompts against exported datasets
- Use quality ratings for success_rate calculation
- Export test results to training data

---

## SECURITY & LIMITS

- **Rate Limiting:** Max 5 iterations per test
- **Token Limits:** Default 1000 max_tokens per test
- **Pattern Storage:** Isolated in GraphRAG group
- **Input Validation:** Sanitize prompt templates
- **Cost Control:** Track cumulative token usage

---

## SUCCESS CRITERIA

✅ Tool registers correctly in registry  
✅ Can test single prompts with variable injection  
✅ A/B comparison works with multiple variations  
✅ Patterns save successfully to GraphRAG  
✅ Patterns retrieve correctly from GraphRAG  
✅ Quality analysis provides actionable scores  
✅ Error messages follow `[PromptTester] Category: message` format  
✅ TypeScript compiles with 0 errors  
✅ Integration with existing LLM and GraphRAG systems  

---

## NEXT STEPS AFTER COMPLETION

1. **UI Integration** - Visual prompt testing interface
2. **Batch Testing** - Test against multiple test cases
3. **Advanced Metrics** - Perplexity, BLEU scores, etc.
4. **Pattern Recommendations** - AI-suggested improvements
5. **Version Control** - Track pattern evolution over time

---

**Implementation Priority:** HIGH  
**Estimated Time:** 100 minutes  
**Dependencies:** GraphRAG, LLM system, Dataset tool  
**Status:** Ready to implement  
