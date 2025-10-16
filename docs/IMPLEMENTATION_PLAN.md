# ⚠️ DEPRECATED - Advanced Features Implementation Plan

> **STATUS:** DEPRECATED - October 13, 2025
>
> **REASON:** This implementation plan has been completed and superseded by the completion document.
>
> **SUPERSEDED BY:**
> - `IMPLEMENTATION_COMPLETE.md` (full implementation summary)
> - `PHASE_3_MASTER_COMPLETE.md` (GraphRAG implementation)
> - `TOOL_REFACTORING_COMPLETE.md` (tool system refactoring)
>
> **DO NOT USE THIS PLAN** - All phases have been implemented.

---

# Advanced Features Implementation Plan

**Date:** October 10, 2025
**Features:** Plugin System, RAG (Document Upload), Memory System with Session Persistence
**Approach:** Phased implementation with verification at each step

---

## DISCOVERY PHASE - VERIFIED FILES

### Current Architecture Analysis

#### ✅ API Layer (VERIFIED)

- **File:** `/app/api/chat/route.ts` (51 lines)
  - Current: Handles streaming chat with OpenAI
  - Uses: `streamOpenAIResponse` from `/lib/llm/openai.ts`
  - Runtime: Node.js
  - **Insertion Point:** Line 10 (after extracting `messages`)

#### ✅ LLM Provider (VERIFIED)

- **File:** `/lib/llm/openai.ts` (60 lines)
  - Functions: `streamOpenAIResponse`, `getOpenAIResponse`
  - Parameters: messages, model, temperature, maxTokens
  - **Insertion Points:**
    - Line 14: Add tools/functions parameter
    - Line 21: Add function calling to API call

#### ✅ Database Schema (VERIFIED)

- **File:** `/docs/COMPLETE_SCHEMA.sql`
  - Tables: session_logs, conversations, messages, feedback
  - **Need to Add:**
    - `user_preferences` table (memory system)
    - `documents` table (RAG)
    - `tools` table (plugin system)
    - `tool_executions` table (tracking)

#### ✅ Client Component (VERIFIED)

- **File:** `/components/Chat.tsx` (~600 lines)
  - Current: Handles UI, message sending, conversation management
  - **Insertion Points:**
    - After line 30: Add state for tools, documents, memory
    - Line 226-240: Modify message preparation for tools
    - After line 600: Add UI for document upload, tool selection

---

## FEATURE 1: MEMORY SYSTEM (Session Persistence)

### Priority: HIGH (Foundation for other features)

### Estimated Lines: ~300 new lines across 6 files

### Phase 1.1: Database Schema (30 lines)

**File to Create:** `/docs/schema_updates/01_memory_system.sql`

```sql
-- User preferences and memory system
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    is_persistent BOOLEAN DEFAULT false,  -- Flag for session persistence
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, preference_key)
);

CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_persistent ON user_preferences(is_persistent);

-- Conversation memory/context
CREATE TABLE IF NOT EXISTS conversation_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    memory_key TEXT NOT NULL,
    memory_value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(conversation_id, memory_key)
);

CREATE INDEX idx_conversation_memory_conversation_id ON conversation_memory(conversation_id);
```

**Validation:** Run in Supabase SQL Editor, verify tables created

### Phase 1.2: Memory Service (90 lines)

**File to Create:** `/lib/memory/memoryService.ts`

```typescript
// Memory service for user preferences and conversation context
import { supabase } from '../supabaseClient';

export interface UserPreference {
  key: string;
  value: any;
  isPersistent: boolean;
}

export interface ConversationMemory {
  key: string;
  value: any;
}

// User-level preferences (30 lines)
export async function saveUserPreference(
  userId: string,
  key: string,
  value: any,
  isPersistent: boolean = false
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      preference_key: key,
      preference_value: value,
      is_persistent: isPersistent,
      updated_at: new Date().toISOString(),
    });
  
  return { error: error?.message || null };
}

export async function getUserPreference(
  userId: string,
  key: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preference_value')
    .eq('user_id', userId)
    .eq('preference_key', key)
    .single();
  
  return { 
    data: data?.preference_value || null, 
    error: error?.message || null 
  };
}

export async function getAllUserPreferences(
  userId: string,
  persistentOnly: boolean = false
): Promise<{ data: UserPreference[]; error: string | null }> {
  let query = supabase
    .from('user_preferences')
    .select('preference_key, preference_value, is_persistent')
    .eq('user_id', userId);
  
  if (persistentOnly) {
    query = query.eq('is_persistent', true);
  }
  
  const { data, error } = await query;
  
  const preferences = data?.map(p => ({
    key: p.preference_key,
    value: p.preference_value,
    isPersistent: p.is_persistent,
  })) || [];
  
  return { data: preferences, error: error?.message || null };
}

// Conversation-level memory (30 lines)
export async function saveConversationMemory(
  conversationId: string,
  key: string,
  value: any
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('conversation_memory')
    .upsert({
      conversation_id: conversationId,
      memory_key: key,
      memory_value: value,
    });
  
  return { error: error?.message || null };
}

export async function getConversationMemory(
  conversationId: string,
  key: string
): Promise<{ data: any; error: string | null }> {
  const { data, error } = await supabase
    .from('conversation_memory')
    .select('memory_value')
    .eq('conversation_id', conversationId)
    .eq('memory_key', key)
    .single();
  
  return { 
    data: data?.memory_value || null, 
    error: error?.message || null 
  };
}

export async function getAllConversationMemory(
  conversationId: string
): Promise<{ data: ConversationMemory[]; error: string | null }> {
  const { data, error } = await supabase
    .from('conversation_memory')
    .select('memory_key, memory_value')
    .eq('conversation_id', conversationId);
  
  const memories = data?.map(m => ({
    key: m.memory_key,
    value: m.memory_value,
  })) || [];
  
  return { data: memories, error: error?.message || null };
}
```

**Validation:** TypeScript compilation, no errors

### Phase 1.3: Memory Hook (60 lines)

**File to Create:** `/hooks/useMemory.ts`

```typescript
// React hook for memory management
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  saveUserPreference,
  getUserPreference,
  getAllUserPreferences,
  saveConversationMemory,
  getConversationMemory,
  getAllConversationMemory,
  UserPreference,
  ConversationMemory,
} from '../lib/memory/memoryService';

export function useMemory(conversationId?: string) {
  const { user } = useAuth();
  const [userPreferences, setUserPreferences] = useState<UserPreference[]>([]);
  const [conversationMemories, setConversationMemories] = useState<ConversationMemory[]>([]);
  const [loading, setLoading] = useState(false);

  // Load user preferences on mount
  useEffect(() => {
    if (!user) return;
    
    loadUserPreferences();
  }, [user]);

  // Load conversation memories when conversation changes
  useEffect(() => {
    if (!conversationId) return;
    
    loadConversationMemories();
  }, [conversationId]);

  async function loadUserPreferences() {
    setLoading(true);
    const { data } = await getAllUserPreferences(user!.id, false);
    if (data) setUserPreferences(data);
    setLoading(false);
  }

  async function loadConversationMemories() {
    if (!conversationId) return;
    setLoading(true);
    const { data } = await getAllConversationMemory(conversationId);
    if (data) setConversationMemories(data);
    setLoading(false);
  }

  async function setPreference(key: string, value: any, isPersistent: boolean = false) {
    if (!user) return { error: 'No user logged in' };
    const result = await saveUserPreference(user.id, key, value, isPersistent);
    if (!result.error) {
      await loadUserPreferences();
    }
    return result;
  }

  async function getPreference(key: string) {
    if (!user) return { data: null, error: 'No user logged in' };
    return getUserPreference(user.id, key);
  }

  async function setMemory(key: string, value: any) {
    if (!conversationId) return { error: 'No conversation selected' };
    const result = await saveConversationMemory(conversationId, key, value);
    if (!result.error) {
      await loadConversationMemories();
    }
    return result;
  }

  async function getMemory(key: string) {
    if (!conversationId) return { data: null, error: 'No conversation selected' };
    return getConversationMemory(conversationId, key);
  }

  return {
    userPreferences,
    conversationMemories,
    loading,
    setPreference,
    getPreference,
    setMemory,
    getMemory,
    reload: () => {
      loadUserPreferences();
      loadConversationMemories();
    },
  };
}
```

**Validation:** Import in Chat.tsx, verify no errors

### Phase 1.4: Update Chat Component (40 lines)

**File to Modify:** `/components/Chat.tsx`

**Insertion Point 1:** After line 30 (state declarations)

```typescript
// Import memory hook
import { useMemory } from '../hooks/useMemory';

// In component, after existing state
const {
  userPreferences,
  conversationMemories,
  setPreference,
  getPreference,
  setMemory,
  getMemory,
} = useMemory(activeId);
```

**Insertion Point 2:** In handleSend function, before API call (line 226)

```typescript
// Load conversation memories and add to context
const memories = conversationMemories.map(m => 
  `${m.key}: ${JSON.stringify(m.value)}`
).join('\n');

// Add system message with memory context if memories exist
if (memories) {
  conversationMessages.unshift({
    role: 'system',
    content: `Previous context:\n${memories}`
  });
}
```

**Validation:** Test chat, verify memories don't break existing functionality

---

## FEATURE 2: PLUGIN SYSTEM (Custom Tools)

### Priority: MEDIUM (Enables extensibility)

### Estimated Lines: ~400 new lines across 8 files

### Phase 2.1: Database Schema (40 lines)

**File to Create:** `/docs/schema_updates/02_plugin_system.sql`

```sql
-- Tools/Plugins registry
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    parameters JSONB NOT NULL,  -- JSON Schema for parameters
    enabled BOOLEAN DEFAULT true,
    is_system BOOLEAN DEFAULT false,  -- System tools vs user-created
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tools_enabled ON tools(enabled);
CREATE INDEX idx_tools_created_by ON tools(created_by);

-- Tool execution log
CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID REFERENCES tools(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    input_params JSONB NOT NULL,
    output_result JSONB,
    execution_time_ms INTEGER,
    status TEXT CHECK (status IN ('success', 'failed', 'timeout')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_executions_tool_id ON tool_executions(tool_id);
CREATE INDEX idx_tool_executions_conversation_id ON tool_executions(conversation_id);
CREATE INDEX idx_tool_executions_user_id ON tool_executions(user_id);
```

**Validation:** Run in Supabase, verify tables created

### Phase 2.2: Tool Definition Interface (30 lines)

**File to Create:** `/lib/tools/toolTypes.ts`

```typescript
// Tool system types and interfaces
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
  default?: any;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  enabled: boolean;
  isSystem: boolean;
  handler?: ToolHandler;
}

export type ToolHandler = (params: Record<string, any>) => Promise<any>;

export interface ToolExecution {
  toolId: string;
  conversationId: string;
  userId: string;
  inputParams: Record<string, any>;
  outputResult?: any;
  executionTimeMs?: number;
  status: 'success' | 'failed' | 'timeout';
  errorMessage?: string;
}
```

**Validation:** TypeScript compilation succeeds

### Phase 2.3: Built-in Tools (90 lines)

**File to Create:** `/lib/tools/builtinTools.ts`

```typescript
// Built-in system tools
import { ToolDefinition, ToolHandler } from './toolTypes';

// Calculator tool (30 lines)
const calculatorHandler: ToolHandler = async (params) => {
  const { expression } = params;
  try {
    // Safe math evaluation (use math.js library in production)
    const result = eval(expression);
    return { result, expression };
  } catch (error) {
    throw new Error(`Calculation error: ${error}`);
  }
};

export const calculatorTool: ToolDefinition = {
  id: 'calculator',
  name: 'calculator',
  description: 'Performs mathematical calculations',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate',
      required: true,
    },
  },
  enabled: true,
  isSystem: true,
  handler: calculatorHandler,
};

// Search tool (30 lines)
const searchHandler: ToolHandler = async (params) => {
  const { query } = params;
  // Implement actual search logic here
  return {
    query,
    results: [
      { title: 'Example Result', url: 'https://example.com' }
    ],
  };
};

export const searchTool: ToolDefinition = {
  id: 'search',
  name: 'search',
  description: 'Searches the web for information',
  parameters: {
    query: {
      type: 'string',
      description: 'Search query',
      required: true,
    },
  },
  enabled: true,
  isSystem: true,
  handler: searchHandler,
};

// Get current date/time tool (30 lines)
const datetimeHandler: ToolHandler = async (params) => {
  const { format = 'iso' } = params;
  const now = new Date();
  
  switch (format) {
    case 'iso':
      return { datetime: now.toISOString() };
    case 'unix':
      return { datetime: Math.floor(now.getTime() / 1000) };
    case 'readable':
      return { datetime: now.toLocaleString() };
    default:
      return { datetime: now.toISOString() };
  }
};

export const datetimeTool: ToolDefinition = {
  id: 'get_current_datetime',
  name: 'get_current_datetime',
  description: 'Gets the current date and time',
  parameters: {
    format: {
      type: 'string',
      description: 'Format for the datetime',
      enum: ['iso', 'unix', 'readable'],
      default: 'iso',
    },
  },
  enabled: true,
  isSystem: true,
  handler: datetimeHandler,
};

// Export all built-in tools
export const BUILTIN_TOOLS: ToolDefinition[] = [
  calculatorTool,
  searchTool,
  datetimeTool,
];
```

**Validation:** Import and verify exports work

### Phase 2.4: Tool Manager (120 lines)

**File to Create:** `/lib/tools/toolManager.ts`

(Continuing in next part due to length...)

---

## ESTIMATED TIMELINE

- **Phase 1 (Memory):** 2-3 hours
- **Phase 2 (Plugins):** 4-5 hours  
- **Phase 3 (RAG):** 5-6 hours
- **Testing & Integration:** 2-3 hours

**Total:** 13-17 hours

---

## NEXT STEPS

1. ✅ Create this plan document
2. □ User approval of plan
3. □ Execute Phase 1.1 (Memory schema)
4. □ Validate Phase 1.1
5. □ Continue sequential execution...
