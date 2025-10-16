# Phase 3.6: GraphRAG Chat Service - DETAILED EXECUTION PLAN

## VERIFICATION COMPLETE ✅

### Existing Files Located

1. ✅ `/app/api/chat/route.ts` - EXISTS (75 lines)
   - Current structure: POST handler with streaming
   - Memory context injection already implemented (lines 21-33)
   - **Insertion point**: After memory context, before streamOpenAIResponse call (line 40)

2. ✅ `/lib/graphrag/service/index.ts` - EXISTS (15 lines)
   - Exports: DocumentService, types
   - **Insertion point**: Add GraphRAGService exports (line 15)

3. ✅ `/lib/graphrag/graphiti/search-service.ts` - EXISTS (187 lines)
   - Has search() method ready to use
   - Returns SearchResult with context and sources
   - **No changes needed** - will use as-is

4. ✅ `/lib/graphrag/config.ts` - EXISTS
   - Has graphragConfig.enabled flag
   - **No changes needed** - will use as-is

### Files to CREATE

1. ❌ `/lib/graphrag/service/graphrag-service.ts` - NEW FILE

### Files to MODIFY

1. 📝 `/lib/graphrag/service/index.ts` - Add exports
2. 📝 `/lib/graphrag/index.ts` - Add exports
3. 📝 `/app/api/chat/route.ts` - Integrate GraphRAG

---

## IMPLEMENTATION PLAN - PHASE 3.6

### BLOCK 1: Create GraphRAG Service - Part 1 (Types & Imports)

**File**: `/lib/graphrag/service/graphrag-service.ts`
**Lines**: ~30 lines
**Purpose**: Type definitions and imports

```typescript
/**
 * GraphRAG Service
 * Integrates document search with chat for context-aware responses
 */

import { searchService } from '../graphiti';
import { graphragConfig } from '../config';
import type { SearchResult, SearchSource, SearchMetadata } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface EnhanceOptions {
  maxSources?: number;
  minConfidence?: number;
  maxContextLength?: number;
  includeMetadata?: boolean;
}

export interface EnhancedPrompt {
  prompt: string;
  contextUsed: boolean;
  sources?: SearchSource[];
  metadata?: SearchMetadata;
}

export interface Citation {
  source: string;
  content: string;
  confidence: number;
}
```

**Verification After Block 1**:

- Check: File created successfully
- Check: No TypeScript errors on imports
- Check: Types properly exported

---

### BLOCK 2: Create GraphRAG Service - Part 2 (Core Class & enhancePrompt)

**File**: `/lib/graphrag/service/graphrag-service.ts`
**Lines**: ~40 lines
**Purpose**: Main service class with enhance method

```typescript
// ============================================================================
// GraphRAG Service
// ============================================================================

export class GraphRAGService {
  /**
   * Enhance user prompt with document context
   * Returns original prompt if GraphRAG disabled or no context found
   */
  async enhancePrompt(
    userId: string,
    userMessage: string,
    options: EnhanceOptions = {}
  ): Promise<EnhancedPrompt> {
    // Check if GraphRAG is enabled
    if (!graphragConfig.enabled) {
      console.log('[GraphRAG] Disabled in config, skipping enhancement');
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }

    // Validate inputs
    if (!userId || !userMessage.trim()) {
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }

    try {
      // Search knowledge graph for relevant context
      console.log('[GraphRAG] Searching for context:', userMessage.slice(0, 50));
      const searchResult = await searchService.search(userMessage, userId);

      // Check if we got useful results
      if (!searchResult.sources || searchResult.sources.length === 0) {
        console.log('[GraphRAG] No relevant context found');
        return {
          prompt: userMessage,
          contextUsed: false,
        };
      }
```

**Verification After Block 2**:

- Check: GraphRAGService class created
- Check: enhancePrompt method signature correct
- Check: No compilation errors
- Check: Proper error handling structure

---

### BLOCK 3: Create GraphRAG Service - Part 3 (Format & Inject Context)

**File**: `/lib/graphrag/service/graphrag-service.ts`
**Lines**: ~35 lines
**Purpose**: Complete enhancePrompt and add helper methods

```typescript
      // Format context from search results
      const formattedContext = this.formatContext(searchResult);

      // Inject context into prompt
      const enhancedPrompt = this.injectContext(userMessage, formattedContext);

      console.log('[GraphRAG] Enhanced prompt with', searchResult.sources.length, 'sources');

      return {
        prompt: enhancedPrompt,
        contextUsed: true,
        sources: searchResult.sources,
        metadata: searchResult.metadata,
      };
    } catch (error) {
      console.error('[GraphRAG] Error enhancing prompt:', error);
      // Fallback to original prompt on error
      return {
        prompt: userMessage,
        contextUsed: false,
      };
    }
  }

  /**
   * Format search results into readable context
   */
  private formatContext(searchResult: SearchResult): string {
    const { sources } = searchResult;
    
    const contextParts = sources.map((source, index) => {
      return `[${index + 1}] ${source.fact}`;
    });

    return contextParts.join('\n\n');
  }
```

**Verification After Block 3**:

- Check: formatContext method added
- Check: Logic is clear and simple
- Check: No TypeScript errors

---

### BLOCK 4: Create GraphRAG Service - Part 4 (Inject & Export)

**File**: `/lib/graphrag/service/graphrag-service.ts`
**Lines**: ~30 lines
**Purpose**: Complete the service with inject method and singleton

```typescript
  /**
   * Inject context into user message
   */
  private injectContext(userMessage: string, context: string): string {
    return `You have access to the user's uploaded documents. Use this context to provide accurate answers.

CONTEXT FROM USER'S DOCUMENTS:
${context}

USER'S QUESTION:
${userMessage}

Instructions:
- Answer the question using the provided context
- If the context contains relevant information, use it in your response
- If the context doesn't help answer the question, say so and provide a general answer
- Be specific and cite facts from the context when applicable`;
  }

  /**
   * Format citations for display
   */
  formatCitations(sources: SearchSource[]): Citation[] {
    return sources.map(source => ({
      source: source.entity || 'Unknown',
      content: source.fact,
      confidence: source.confidence,
    }));
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const graphragService = new GraphRAGService();
```

**Verification After Block 4**:

- Check: Complete file compiles
- Check: Singleton exported
- Check: All methods implemented
- Run: `get_errors` on graphrag-service.ts

---

### BLOCK 5: Update Service Index Exports

**File**: `/lib/graphrag/service/index.ts`
**Lines**: ~8 lines added
**Insertion Point**: After existing exports (line 15)

```typescript
export {
  GraphRAGService,
  graphragService,
} from './graphrag-service';

export type {
  EnhanceOptions,
  EnhancedPrompt,
  Citation,
} from './graphrag-service';
```

**Verification After Block 5**:

- Check: No export conflicts
- Check: Types properly exported
- Run: `get_errors` on service/index.ts

---

### BLOCK 6: Update Main GraphRAG Index

**File**: `/lib/graphrag/index.ts`
**Lines**: ~8 lines added
**Insertion Point**: After service exports (current end of file)

```typescript
// GraphRAG Chat Service
export {
  graphragService,
} from './service';

export type {
  EnhanceOptions,
  EnhancedPrompt,
  Citation,
} from './service';
```

**Verification After Block 6**:

- Check: No circular dependencies
- Check: Full import chain works
- Run: `get_errors` on lib/graphrag/index.ts

---

### BLOCK 7: Integrate into Chat API - Part 1 (Imports & Setup)

**File**: `/app/api/chat/route.ts`
**Lines**: ~5 lines added
**Insertion Point**: After existing imports (line 4)

```typescript
import { streamOpenAIResponse } from '@/lib/llm/openai';
import { executeTool } from '@/lib/tools';
import { graphragService } from '@/lib/graphrag';
import type { EnhancedPrompt } from '@/lib/graphrag';

// Use Node.js runtime instead of Edge for OpenAI SDK compatibility
```

**Verification After Block 7**:

- Check: Imports resolve correctly
- Check: No import errors
- Run: `get_errors` on route.ts

---

### BLOCK 8: Integrate into Chat API - Part 2 (Get User ID)

**File**: `/app/api/chat/route.ts`
**Lines**: ~15 lines added
**Insertion Point**: After JSON parsing (line 11)

**Current code at line 11:**

```typescript
const { messages, memory, tools } = await req.json();
```

**Add after line 11:**

```typescript
const { messages, memory, tools } = await req.json();

// Extract user ID from request (from auth)
let userId: string | null = null;
try {
  // Get user from session/auth
  // Note: This depends on your auth implementation
  // For now, we'll extract from memory if available
  userId = memory?.userId || null;
} catch (error) {
  console.log('[API] Could not get user ID for GraphRAG');
}

if (!messages || !Array.isArray(messages)) {
```

**Verification After Block 8**:

- Check: User ID extraction logic in place
- Check: No errors if user ID not found
- Note: May need to adjust based on actual auth implementation

---

### BLOCK 9: Integrate into Chat API - Part 3 (Enhance Prompt)

**File**: `/app/api/chat/route.ts`
**Lines**: ~25 lines added
**Insertion Point**: After memory context injection (around line 33)

**Current code around line 33:**

```typescript
if (memory && (Object.keys(memory.userPreferences || {}).length > 0 || 
               Object.keys(memory.conversationMemories || {}).length > 0)) {
  // ... memory injection code ...
}

// Create a readable stream for Server-Sent Events
```

**Add before "Create a readable stream":**

```typescript
}

// GraphRAG enhancement - inject document context
let graphRAGMetadata: any = null;
if (userId) {
  try {
    const userMessage = messages[messages.length - 1]?.content;
    if (userMessage && typeof userMessage === 'string') {
      const enhanced: EnhancedPrompt = await graphragService.enhancePrompt(
        userId,
        userMessage
      );
      
      if (enhanced.contextUsed) {
        console.log('[API] GraphRAG context added from', enhanced.sources?.length, 'sources');
        // Replace the last message with enhanced version
        enhancedMessages[enhancedMessages.length - 1] = {
          role: 'user',
          content: enhanced.prompt
        };
        
        graphRAGMetadata = {
          sources: enhanced.sources,
          metadata: enhanced.metadata
        };
      }
    }
  } catch (error) {
    console.error('[API] GraphRAG enhancement error:', error);
    // Continue without GraphRAG on error
  }
}

// Create a readable stream for Server-Sent Events
```

**Verification After Block 9**:

- Check: Enhancement happens before streaming
- Check: Fallback to normal chat on error
- Check: graphRAGMetadata captured

---

### BLOCK 10: Integrate into Chat API - Part 4 (Include Metadata in Response)

**File**: `/app/api/chat/route.ts`
**Lines**: ~10 lines modified
**Location**: Inside stream start function (around line 40-50)

**Current code:**

```typescript
for await (const chunk of streamOpenAIResponse(
  enhancedMessages, 
  'gpt-4o-mini',
  0.7,
  2000,
  tools
)) {
  const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
  controller.enqueue(encoder.encode(data));
}
```

**Modify to:**

```typescript
// Send GraphRAG metadata first if available
if (graphRAGMetadata) {
  const metaData = `data: ${JSON.stringify({ 
    type: 'graphrag_metadata',
    metadata: graphRAGMetadata 
  })}\n\n`;
  controller.enqueue(encoder.encode(metaData));
}

for await (const chunk of streamOpenAIResponse(
  enhancedMessages, 
  'gpt-4o-mini',
  0.7,
  2000,
  tools
)) {
  const data = `data: ${JSON.stringify({ content: chunk })}\n\n`;
  controller.enqueue(encoder.encode(data));
}
```

**Verification After Block 10**:

- Check: Metadata sent before content
- Check: Stream still works correctly
- Run: `get_errors` on route.ts

---

## EXECUTION SEQUENCE

**Execute in this exact order:**

1. **Block 1** → Verify types created
2. **Block 2** → Verify class structure
3. **Block 3** → Verify context formatting
4. **Block 4** → Verify complete service, run get_errors
5. **Block 5** → Verify service exports, run get_errors
6. **Block 6** → Verify main index exports, run get_errors
7. **Block 7** → Verify chat API imports, run get_errors
8. **Block 8** → Verify user ID extraction
9. **Block 9** → Verify prompt enhancement
10. **Block 10** → Verify metadata streaming, final get_errors

**After each block:**

- ✅ Check file exists/modified correctly
- ✅ Run get_errors on the file
- ✅ Verify 0 errors before proceeding
- ✅ Document any issues found

---

## SUCCESS CRITERIA

### Code Quality

- ✅ 0 TypeScript errors across all files
- ✅ All imports resolve correctly
- ✅ No circular dependencies
- ✅ Proper error handling in place

### Functionality

- ✅ GraphRAG service can be imported
- ✅ enhancePrompt() method works
- ✅ Chat API integrates without breaking
- ✅ Falls back gracefully if disabled/errors

### Integration

- ✅ Existing chat functionality unchanged
- ✅ Memory context still works
- ✅ Tool calling still works
- ✅ GraphRAG adds value without disruption

---

## ROLLBACK PLAN

If issues occur at any block:

1. Block 1-4: Delete graphrag-service.ts
2. Block 5: Revert service/index.ts exports
3. Block 6: Revert lib/graphrag/index.ts exports
4. Block 7-10: Revert app/api/chat/route.ts changes

Each block is independent and can be rolled back without affecting previous blocks.

---

## TESTING AFTER COMPLETION

### Manual Test 1: Service in Isolation

```typescript
import { graphragService } from '@/lib/graphrag';

const result = await graphragService.enhancePrompt(
  'user123',
  'What does my research say about AI?'
);
console.log(result);
```

### Manual Test 2: Chat API with GraphRAG

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What do my docs say?"}],
    "memory": {"userId": "test-user-id"}
  }'
```

### Manual Test 3: GraphRAG Disabled

```bash
# In .env.local: NEXT_PUBLIC_GRAPHRAG_ENABLED=false
# Should fall back to normal chat
```

---

**READY TO EXECUTE - Waiting for approval to proceed with Block 1**
