# Tool Comparison Analysis: prompt-injector vs prompt-pipeline

**Date:** October 21, 2025  
**Status:** ⚠️ POTENTIAL CONFLICT IDENTIFIED

---

## Executive Summary

After investigating both tools, **there IS potential for duplicate entries** if both tools are used incorrectly. However, they serve **different purposes** and can coexist safely with proper usage guidelines.

### Key Finding

- **prompt-injector**: Sends prompts through your **chat portal UI** (`/api/chat`) for interactive testing with user feedback
- **prompt-pipeline**: Sends prompts **directly to model APIs** for batch evaluation without UI interaction

**Risk:** If `prompt-pipeline.execute_batch()` is configured to call `/api/chat` instead of a direct model endpoint, it WILL create duplicate database entries.

---

## Tool Architecture Comparison

### 1. prompt-injector Tool

**Purpose:** Load testing and evaluation through your web portal

**Flow:**

```
User Prompt
    ↓
/api/batch-testing/run
    ↓
extractPrompts() [from prompt-extractor]
    ↓
processSinglePrompt() → /api/chat endpoint
    ↓
/api/chat handles:
    - Widget session tracking
    - Conversation creation
    - Message storage
    - Metrics capture
    - Feedback collection (likes/dislikes)
    - Automatic Supabase insertion
    ↓
Database Tables Updated:
    - conversations
    - messages
    - batch_test_runs
    - runs (experiment tracking)
    - errors (if failures)
```

**Key Characteristics:**

- ✅ Uses your chat portal infrastructure (`/api/chat`)
- ✅ Captures widget session IDs for user tracking
- ✅ Automatically stores in Supabase via existing chat API
- ✅ Supports user feedback (likes/dislikes/notes)
- ✅ Integrated with experiment tracking
- ✅ Rate limiting and concurrency control
- ✅ Error categorization and logging
- ❌ Does NOT store to custom tables (uses chat schema)

**Database Schema Used:**

```sql
-- Tables written to by prompt-injector:
- conversations (widget_session_id, batch_test_run_id)
- messages (conversation_id, content, role)
- batch_test_runs (status, completed_prompts, failed_prompts)
- runs (experiment tracking)
- errors (categorized failures)
```

---

### 2. prompt-pipeline Tool (Our New Tool)

**Purpose:** Direct batch execution to model APIs for evaluation

**Flow:**

```
Operation: execute_batch
    ↓
Prompts sent DIRECTLY to model endpoint
    (e.g., https://api.openai.com/v1/chat/completions)
    ↓
Responses collected in memory
    ↓
Operation: store_results
    ↓
Bulk insert to custom Supabase table
    (user-specified table name)
    ↓
Database Tables Updated:
    - [user-specified table] (e.g., prompt_evaluations)
```

**Key Characteristics:**

- ✅ Direct API calls to model endpoints (OpenAI, HuggingFace, etc.)
- ✅ Custom table storage (user specifies table name)
- ✅ Batch processing with concurrency control
- ✅ Rich metadata support (experiment_name, tags)
- ✅ Flexible - works with ANY model API
- ❌ Does NOT use chat portal
- ❌ Does NOT capture widget session IDs
- ❌ Does NOT integrate with user feedback system
- ❌ Does NOT use conversation/message schema

**Database Schema Used:**

```sql
-- Default schema for prompt-pipeline:
{
  prompt: string,
  response: string,
  model: string,
  success: boolean,
  error: string,
  timestamp: string,
  duration_ms: number,
  tokens_used: number,
  metadata: object,
  experiment_name: string,
  tags: string[]
}
```

---

## Conflict Analysis

### ⚠️ When Conflicts WOULD Occur

**Scenario 1: Misconfigured prompt-pipeline**

```typescript
// ❌ WRONG - This creates duplicates!
await promptPipelineTool.execute({
  operation: 'execute_batch',
  prompts: ['test prompt'],
  modelEndpoint: 'http://localhost:3000/api/chat',  // ← PROBLEM!
  // ...
});
```

**Why it's wrong:**

- `/api/chat` already stores to `conversations` and `messages` tables
- `store_results` would then ALSO store to custom table
- Result: Data in TWO places

**Scenario 2: Using both tools for same prompts**

```typescript
// Step 1: User runs batch test via prompt-injector
// → Stores in conversations/messages

// Step 2: User extracts same prompts and re-runs via prompt-pipeline
// → Stores in custom evaluation table

// Result: Same prompts/responses in TWO different schemas
```

---

### ✅ When NO Conflicts Occur (Safe Usage)

**Scenario 1: Different purposes**

```typescript
// prompt-injector: Portal testing with user feedback
// Used for: Interactive testing, user evaluation sessions
// Stores to: conversations, messages

// prompt-pipeline: Direct model evaluation
// Used for: Automated benchmarking, model comparison
// Stores to: prompt_evaluations (custom table)
```

**Scenario 2: Different endpoints**

```typescript
// ✅ CORRECT - No conflict
await promptPipelineTool.execute({
  operation: 'execute_batch',
  prompts: extractedPrompts,
  modelEndpoint: 'https://api.openai.com/v1/chat/completions',  // ← Direct API
  // ...
});

await promptPipelineTool.execute({
  operation: 'store_results',
  supabaseTable: 'model_benchmark_results',  // ← Different table
  // ...
});
```

---

## Recommended Usage Guidelines

### Use prompt-injector When

1. ✅ Testing your chat portal UI
2. ✅ You need widget session tracking
3. ✅ You want user feedback (likes/dislikes/notes)
4. ✅ You need conversation history
5. ✅ You're testing user-facing features
6. ✅ You want automatic integration with existing chat schema

### Use prompt-pipeline When

1. ✅ Comparing multiple models side-by-side
2. ✅ Running automated benchmarks
3. ✅ Testing external APIs directly (OpenAI, Anthropic, etc.)
4. ✅ You need custom metadata (experiment names, tags)
5. ✅ You want flexible table schema
6. ✅ You don't need user feedback collection
7. ✅ You're doing offline evaluation

---

## Architecture Recommendations

### Option 1: Keep Both Tools (Recommended)

**Reasoning:**

- Different use cases
- Different data flows
- Different storage schemas
- No inherent conflict if used correctly

**Safeguards to Add:**

1. **Documentation** ✅ (This document)
2. **Endpoint Validation** in prompt-pipeline:

```typescript
// Add to prompt-extractor.service.ts executeBatch()
function validateEndpoint(endpoint: string): void {
  const localChatPatterns = [
    '/api/chat',
    'localhost:3000/api/chat',
    '127.0.0.1',
  ];
  
  const isLocalChat = localChatPatterns.some(pattern => 
    endpoint.includes(pattern)
  );
  
  if (isLocalChat) {
    throw new Error(
      '[prompt-pipeline] Cannot use /api/chat endpoint. ' +
      'This would create duplicate entries. ' +
      'Use prompt-injector tool for portal testing, ' +
      'or provide a direct model API endpoint (e.g., OpenAI, HuggingFace).'
    );
  }
}
```

3. **Tool Descriptions** - Update to clarify:

```typescript
// prompt-injector
description: 'Send prompts through your CHAT PORTAL for load testing with user feedback collection'

// prompt-pipeline  
description: 'Send prompts DIRECTLY to model APIs for batch evaluation (bypasses portal UI)'
```

### Option 2: Merge Tools (Not Recommended)

**Why not:**

- Different purposes (portal testing vs direct API testing)
- Different storage needs (chat schema vs custom schema)
- Would make both tools more complex
- Loses separation of concerns

---

## Data Flow Diagram

### Current Architecture (Safe)

```
┌─────────────────────────────────────────────────────────┐
│                     User's Workflow                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────┐              ┌────────────────────┐
│  prompt-injector    │              │  prompt-pipeline   │
│                     │              │                    │
│  Use Case:          │              │  Use Case:         │
│  Portal testing     │              │  Model evaluation  │
│  with feedback      │              │  & benchmarking    │
└──────────┬──────────┘              └─────────┬──────────┘
           │                                   │
           ▼                                   ▼
    /api/chat                          Direct Model APIs
    (Portal UI)                        (OpenAI, HF, etc.)
           │                                   │
           ▼                                   ▼
  ┌────────────────┐              ┌──────────────────────┐
  │ conversations  │              │ prompt_evaluations   │
  │ messages       │              │ (custom table)       │
  │ batch_test_runs│              │                      │
  │ runs           │              │                      │
  └────────────────┘              └──────────────────────┘
           │                                   │
           └───────────────┬───────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Different Data  │
                  │  Different Uses  │
                  │  No Conflict ✅  │
                  └─────────────────┘
```

---

## Immediate Action Items

### 1. Add Validation to prompt-pipeline ⚠️ HIGH PRIORITY

- Prevent `/api/chat` endpoint in `execute_batch()`
- Throw clear error with usage guidance

### 2. Update Tool Descriptions

- Clarify prompt-injector is for portal testing
- Clarify prompt-pipeline is for direct API testing

### 3. Create Usage Examples

- Add examples showing when to use each tool
- Document the different storage schemas

### 4. Add to Documentation

- Update PROGRESS_LOG.md with tool comparison
- Add warning about endpoint conflicts

---

## Conclusion

### Safe to Proceed? ✅ YES

**With safeguards:**

1. Add endpoint validation (prevent /api/chat in prompt-pipeline)
2. Update tool descriptions
3. Document proper usage

**Tools are complementary, not competing:**

- prompt-injector = Portal-based testing with user feedback
- prompt-pipeline = Direct API testing with flexible storage

**No changes needed to prompt-injector** ✅  
**Small validation needed in prompt-pipeline** ⚠️

Would you like me to implement the endpoint validation safeguard now?

---

*Analysis completed: October 21, 2025*
