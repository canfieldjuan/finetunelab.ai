# GraphRAG Metadata UI Display - Implementation Plan

**Created:** 2025-12-16
**Status:** Planning Phase
**Objective:** Surface GraphRAG retrieval metadata in the chat UI

## Current State Analysis

### ✅ What's Working
1. **Backend:** GraphRAG metadata is being saved to `messages.metadata.graphrag` in database
2. **Data Flow:** `useMessages` hook reads metadata from database
3. **UI Components:** MessageMetadata component exists and displays model/token info
4. **GraphRAG Indicator:** Separate component exists for citations

### ❌ What's Missing
1. **Data Extraction:** GraphRAG metadata not extracted from `msg.metadata` in useMessages hook
2. **Type Definitions:** Message type doesn't include GraphRAG metadata fields
3. **Component Props:** MessageMetadata doesn't accept GraphRAG props
4. **UI Display:** No visual representation of GraphRAG retrieval stats

## File Structure

```
components/
├── chat/
│   ├── types.ts              # Message type definition
│   ├── MessageList.tsx        # Renders messages, uses MessageMetadata
│   └── MessageMetadata.tsx    # Displays model/token/latency info
├── graphrag/
│   └── GraphRAGIndicator.tsx  # Shows citations (already exists)
└── hooks/
    └── useMessages.ts         # Fetches messages from database
```

## Implementation Plan

### Phase 1: Update Type Definitions

**File:** `components/chat/types.ts`
**Location:** Lines 13-35 (Message interface)
**Action:** Add GraphRAG metadata fields

**Current:**
```typescript
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  contextsUsed?: number;
  model_id?: string;
  provider?: string;
  input_tokens?: number;
  output_tokens?: number;
  latency_ms?: number;
  metadata?: unknown;
  model_name?: string;
  [key: string]: unknown;
}
```

**Add:**
```typescript
export interface Message {
  // ... existing fields ...

  // GraphRAG retrieval metadata (extracted from metadata.graphrag)
  graphrag_used?: boolean;
  graphrag_nodes?: number;
  graphrag_chunks?: number;
  graphrag_retrieval_ms?: number;
  graphrag_relevance?: number;
  graphrag_grounded?: boolean;
  graphrag_method?: string;
}
```

---

### Phase 2: Extract GraphRAG Metadata in useMessages Hook

**File:** `components/hooks/useMessages.ts`
**Location:** After line 142 (inside enrichedMsg processing)
**Action:** Extract GraphRAG metadata from `msg.metadata.graphrag`

**Current code (lines 130-150):**
```typescript
const enrichedMsg: Message = { ...msg };

// PRIORITY 1: Use persisted metadata if available
if (msg.metadata && typeof msg.metadata === 'object') {
  const meta = msg.metadata as { model_name?: string; provider?: string };
  if (meta.model_name) {
    enrichedMsg.model_name = meta.model_name;
    // ...
  }
}
```

**Modification:**
```typescript
const enrichedMsg: Message = { ...msg };

// PRIORITY 1: Use persisted metadata if available
if (msg.metadata && typeof msg.metadata === 'object') {
  const meta = msg.metadata as {
    model_name?: string;
    provider?: string;
    graphrag?: {
      graph_used?: boolean;
      nodes_retrieved?: number;
      context_chunks_used?: number;
      retrieval_time_ms?: number;
      context_relevance_score?: number;
      answer_grounded_in_graph?: boolean;
      retrieval_method?: string;
    };
  };

  if (meta.model_name) {
    enrichedMsg.model_name = meta.model_name;
    enrichedCount++;

    if (!enrichedMsg.provider && meta.provider) {
      enrichedMsg.provider = meta.provider;
    }

    // Extract GraphRAG metadata if available
    if (meta.graphrag) {
      enrichedMsg.graphrag_used = meta.graphrag.graph_used;
      enrichedMsg.graphrag_nodes = meta.graphrag.nodes_retrieved;
      enrichedMsg.graphrag_chunks = meta.graphrag.context_chunks_used;
      enrichedMsg.graphrag_retrieval_ms = meta.graphrag.retrieval_time_ms;
      enrichedMsg.graphrag_relevance = meta.graphrag.context_relevance_score;
      enrichedMsg.graphrag_grounded = meta.graphrag.answer_grounded_in_graph;
      enrichedMsg.graphrag_method = meta.graphrag.retrieval_method;
    }

    // Content truncation...
    return enrichedMsg;
  }
}
```

---

### Phase 3: Update MessageMetadata Component

**File:** `components/chat/MessageMetadata.tsx`

#### 3A: Update Props Interface (lines 5-11)

**Current:**
```typescript
interface MessageMetadataProps {
  modelName?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}
```

**Add:**
```typescript
interface MessageMetadataProps {
  modelName?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;

  // GraphRAG metadata
  graphragUsed?: boolean;
  graphragNodes?: number;
  graphragChunks?: number;
  graphragRetrievalMs?: number;
  graphragRelevance?: number;
  graphragGrounded?: boolean;
  graphragMethod?: string;
}
```

#### 3B: Update Component (lines 17-76)

**Add after latency display (after line 74):**
```typescript
{/* GraphRAG Retrieval Stats */}
{graphragUsed && (
  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
    <Database className="w-3.5 h-3.5" />
    <span className="font-medium">RAG:</span>
    <span className="text-muted-foreground/90">
      {graphragNodes} nodes
      {graphragChunks !== undefined && ` · ${graphragChunks} chunks`}
      {graphragRetrievalMs !== undefined && ` · ${Math.round(graphragRetrievalMs)}ms`}
      {graphragRelevance !== undefined && ` · ${Math.round(graphragRelevance * 100)}% rel`}
    </span>
  </div>
)}
```

#### 3C: Add Import (line 3)
```typescript
import { Cpu, Zap, Activity, Database } from 'lucide-react';
```

---

### Phase 4: Update MessageList to Pass Props

**File:** `components/chat/MessageList.tsx`
**Location:** Lines 96-102

**Current:**
```typescript
<MessageMetadata
  modelName={msg.model_name}
  provider={msg.provider}
  inputTokens={msg.input_tokens}
  outputTokens={msg.output_tokens}
  latencyMs={msg.latency_ms}
/>
```

**Add:**
```typescript
<MessageMetadata
  modelName={msg.model_name}
  provider={msg.provider}
  inputTokens={msg.input_tokens}
  outputTokens={msg.output_tokens}
  latencyMs={msg.latency_ms}

  // GraphRAG metadata
  graphragUsed={msg.graphrag_used}
  graphragNodes={msg.graphrag_nodes}
  graphragChunks={msg.graphrag_chunks}
  graphragRetrievalMs={msg.graphrag_retrieval_ms}
  graphragRelevance={msg.graphrag_relevance}
  graphragGrounded={msg.graphrag_grounded}
  graphragMethod={msg.graphrag_method}
/>
```

---

## Visual Design

### Current MessageMetadata Display:
```
[Cpu icon] gpt-4 (openai) | [Activity icon] read: 150 generated: 200 | [Zap icon] 1.2s
```

### New with GraphRAG:
```
[Cpu icon] gpt-4 (openai) | [Activity icon] read: 150 generated: 200 | [Zap icon] 1.2s
[Database icon] RAG: 12 nodes · 3 chunks · 145ms · 87% rel
```

The GraphRAG line will only appear when `graphrag_used === true`.

---

## Breaking Change Analysis

### Potential Issues
1. **Message type expansion:** Adding optional fields is safe (backward compatible)
2. **useMessages hook:** Only affects messages with metadata.graphrag (new messages)
3. **Component props:** All new props are optional

### Risk Assessment
- **Risk Level:** LOW
- **Backward Compatibility:** ✅ Yes - all changes are additive
- **Affects:** Only new messages with GraphRAG metadata
- **Old messages:** Continue to work without GraphRAG display

---

## Testing Strategy

### Test Case 1: Message with GraphRAG
1. Upload document to knowledge base
2. Ask question about document
3. Verify GraphRAG metadata appears below message
4. Check all 7 fields display correctly

### Test Case 2: Message without GraphRAG
1. Ask math question (skips GraphRAG)
2. Verify NO GraphRAG line appears
3. Verify model/token/latency still show normally

### Test Case 3: Old Messages
1. Query conversation created before this update
2. Verify messages display without errors
3. Verify no GraphRAG metadata shown (expected)

---

## Implementation Sequence

```
Phase 1: Types (5 min)
  ↓
Verify: TypeScript compiles
  ↓
Phase 2: Extract Metadata (10 min)
  ↓
Verify: Console.log shows GraphRAG fields
  ↓
Phase 3: Update Component (10 min)
  ↓
Verify: Component accepts props
  ↓
Phase 4: Wire Props (5 min)
  ↓
Verify: End-to-end test
  ↓
COMPLETE
```

---

## Files to Modify

| Phase | File | Lines | Type | Risk |
|-------|------|-------|------|------|
| 1 | `components/chat/types.ts` | 13-35 | Add fields | LOW |
| 2 | `components/hooks/useMessages.ts` | 133-150 | Extract data | LOW |
| 3A | `components/chat/MessageMetadata.tsx` | 3, 5-11 | Props + import | LOW |
| 3B | `components/chat/MessageMetadata.tsx` | 74+ | UI display | LOW |
| 4 | `components/chat/MessageList.tsx` | 96-102 | Pass props | LOW |

**Total:** 5 file modifications, ~50 lines of code

---

## Expected User Experience

**Before:**
Users see model name, tokens, and latency but have no visibility into whether RAG was used or how effective it was.

**After:**
Users immediately see:
- ✅ Whether GraphRAG was used for this response
- ✅ How many knowledge graph nodes were retrieved
- ✅ How many context chunks were used
- ✅ How fast retrieval was
- ✅ Relevance score of retrieved context

**Value:**
Perfect for testing fine-tuned models with RAG - users can validate:
1. Is RAG working? → Check if GraphRAG line appears
2. Is it finding relevant info? → Check relevance percentage
3. Is it fast enough? → Check retrieval time
4. How much context? → Check nodes/chunks count

---

## Next Steps

**Awaiting User Approval:**
1. Review this implementation plan
2. Confirm UI design approach
3. Approve to proceed with Phase 1

**After Approval:**
1. Execute Phase 1 (Type definitions)
2. Execute Phase 2 (Extract metadata)
3. Execute Phase 3 (Update component)
4. Execute Phase 4 (Wire props)
5. End-to-end testing
6. Update this log with results
