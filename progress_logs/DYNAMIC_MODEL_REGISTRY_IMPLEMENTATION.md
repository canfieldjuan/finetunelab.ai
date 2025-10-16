# Dynamic Model Registry Implementation Progress Log
**Feature:** Enterprise-Grade Multi-Model Support
**Date Started:** 2025-10-14
**Status:** Phase 0 - Planning & Architecture Verification
**Session ID:** dynamic-model-registry-v1

---

## Table of Contents
1. [Current Architecture Analysis](#current-architecture-analysis)
2. [New Architecture Design](#new-architecture-design)
3. [Phased Implementation Plan](#phased-implementation-plan)
4. [Implementation Progress](#implementation-progress)
5. [Testing & Verification](#testing--verification)
6. [Known Issues & Decisions](#known-issues--decisions)

---

## Current Architecture Analysis

### Existing LLM Provider Implementation

**Files Analyzed:**
- `/lib/config/llmConfig.ts` (75 lines) - Environment-based config
- `/lib/llm/openai.ts` (254 lines) - OpenAI client with tool support
- `/lib/llm/anthropic.ts` (220 lines) - Anthropic client with tool support
- `/app/api/chat/route.ts` (317 lines) - Chat API with provider switching

**Current Flow:**
```
.env (LLM_PROVIDER=openai)
  \u2193
loadLLMConfig()
  \u2193
Switch (provider)
  case 'openai' \u2192 streamOpenAIResponse / runOpenAIWithToolCalls
  case 'anthropic' \u2192 streamAnthropicResponse / runAnthropicWithToolCalls
  \u2193
Chat API Response
```

**Current Limitations:**
1. \u274C **Single provider at a time** - Can only use one via LLM_PROVIDER env var
2. \u274C **Hardcoded credentials** - API keys in .env file
3. \u274C **No model comparison** - Can't A/B test different models
4. \u274C **No custom endpoints** - Can't use internal/fine-tuned models
5. \u274C **No per-conversation model** - All conversations use same model
6. \u274C **No user-specific models** - Can't let users add their own API keys

**Current Strengths:**
1. \u2705 **Unified interfaces** - Shared ChatMessage, ToolDefinition, LLMResponse
2. \u2705 **Tool support** - Both providers support function calling
3. \u2705 **Streaming** - Both support streaming responses
4. \u2705 **Token tracking** - Usage metrics collected
5. \u2705 **GraphRAG integration** - Document context enhancement works

---

## New Architecture Design

### Goals
- \u2705 Support multiple models simultaneously (OpenAI, Anthropic, HuggingFace, vLLM, Ollama, custom)
- \u2705 Allow admins to configure company-wide models
- \u2705 Allow users to add personal API keys
- \u2705 Enable model comparison and A/B testing
- \u2705 Support fine-tuned and internal models
- \u2705 Maintain backward compatibility with existing code
- \u2705 Secure credential storage with encryption

### Database Schema

```sql
CREATE TABLE llm_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = global

  -- Display
  name TEXT NOT NULL,                    -- "GPT-4o Mini"
  description TEXT,                      -- "Fast, cost-effective model"
  provider TEXT NOT NULL,                -- "openai", "anthropic", "custom"

  -- Endpoint
  base_url TEXT NOT NULL,                -- "https://api.openai.com/v1"
  model_id TEXT NOT NULL,                -- "gpt-4o-mini"

  -- Auth (encrypted)
  auth_type TEXT NOT NULL,               -- "bearer", "api_key", "none"
  api_key_encrypted TEXT,                -- AES-256 encrypted
  auth_headers JSONB,                    -- {"X-Custom-Auth": "..."}

  -- Capabilities
  supports_streaming BOOLEAN DEFAULT true,
  supports_functions BOOLEAN DEFAULT true,
  supports_vision BOOLEAN DEFAULT false,
  context_length INTEGER DEFAULT 4096,
  max_output_tokens INTEGER DEFAULT 2000,

  -- Pricing (per token)
  price_per_input_token NUMERIC(10, 8),
  price_per_output_token NUMERIC(10, 8),

  -- Config
  default_temperature NUMERIC(3, 2) DEFAULT 0.7,
  default_top_p NUMERIC(3, 2) DEFAULT 1.0,

  -- Status
  enabled BOOLEAN DEFAULT true,
  is_global BOOLEAN DEFAULT false,       -- Available to all users

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  UNIQUE (user_id, name)
);

-- Conversation model tracking
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS llm_model_id UUID REFERENCES llm_models(id);

-- Message model tracking (for A/B testing)
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS llm_model_id UUID REFERENCES llm_models(id);
```

### New Architecture Flow

```
User selects model in UI
  \u2193
Model selector queries llm_models table
  \u2193
UnifiedLLMClient.chat(modelId, messages, tools)
  \u2193
1. Load model config from database
2. Decrypt API key
3. Build request to base_url
4. Send OpenAI-compatible request
5. Handle response (streaming/non-streaming)
6. Return unified LLMResponse
  \u2193
Chat API Response (same as before)
```

### Provider Adapters

**UnifiedLLMClient** - Single client for all providers
```typescript
class UnifiedLLMClient {
  async chat(modelId: string, messages, tools?, stream?): Promise<LLMResponse>
  async *stream(modelId: string, messages, tools?): AsyncGenerator<string>
  private buildRequest(model: ModelConfig, messages, tools): RequestInit
  private handleResponse(response: Response, model: ModelConfig): LLMResponse
}
```

**Provider Adapters** - Format requests/responses for each provider
```typescript
interface ProviderAdapter {
  formatRequest(messages, tools, config): RequestBody
  parseResponse(response): LLMResponse
  parseStreamChunk(chunk): string | null
}

// Adapters:
- OpenAIAdapter (for OpenAI, vLLM, LM Studio, etc.)
- AnthropicAdapter
- OllamaAdapter
- HuggingFaceAdapter
```

---

## Phased Implementation Plan

### Phase 0: Planning & Verification \u2705 COMPLETED
**Status:** Done
**Tasks:**
- [x] Analyze current architecture
- [x] Design new schema
- [x] Create implementation plan
- [x] Document progress log

---

### Phase 1: Database Schema & Migrations
**Status:** Pending
**Estimated Time:** 2-3 hours
**Files to Create:**
1. `docs/schema_updates/10_llm_models_registry.sql` - Table creation with RLS
2. `lib/models/llm-model.types.ts` - TypeScript types
3. `lib/models/encryption.ts` - AES-256 encryption helpers
4. `scripts/seed-default-models.ts` - Seed OpenAI/Anthropic models

**Tasks:**
- [ ] Create llm_models table with proper constraints
- [ ] Add RLS policies (users see global + their own models)
- [ ] Create indexes for performance
- [ ] Add llm_model_id to conversations and messages tables
- [ ] Implement encryption/decryption functions
- [ ] Create model seeding script
- [ ] Test migration on dev database

**Verification:**
- [ ] Table created successfully
- [ ] RLS policies work correctly
- [ ] Encryption round-trip works
- [ ] Default models seeded

**Dependencies:** None

---

### Phase 2: Model Manager Service
**Status:** Pending
**Estimated Time:** 3-4 hours
**Files to Create:**
1. `lib/models/model-manager.service.ts` - CRUD operations
2. `lib/models/model-templates.ts` - Provider templates
3. `app/api/models/route.ts` - API endpoints
4. `app/api/models/[id]/route.ts` - Individual model operations
5. `app/api/models/test-connection/route.ts` - Connection testing

**Service Methods:**
```typescript
class ModelManagerService {
  // CRUD
  async listModels(userId?: string): Promise<LLMModel[]>
  async getModel(modelId: string): Promise<LLMModel>
  async createModel(model: CreateModelDTO, userId?: string): Promise<LLMModel>
  async updateModel(modelId: string, updates: UpdateModelDTO): Promise<LLMModel>
  async deleteModel(modelId: string): Promise<void>

  // Helpers
  async testConnection(modelId: string): Promise<ConnectionTestResult>
  async getTemplates(): Promise<ModelTemplate[]>
  async createFromTemplate(templateId: string, apiKey: string): Promise<LLMModel>
}
```

**API Endpoints:**
- `GET /api/models` - List models (global + user's)
- `POST /api/models` - Create model
- `GET /api/models/:id` - Get model
- `PATCH /api/models/:id` - Update model
- `DELETE /api/models/:id` - Delete model
- `POST /api/models/test-connection` - Test model connection
- `GET /api/models/templates` - Get provider templates

**Tasks:**
- [ ] Implement model manager service with logging
- [ ] Create API routes with error handling
- [ ] Add connection testing logic
- [ ] Create provider templates (OpenAI, Anthropic, HF, Ollama, vLLM, Azure)
- [ ] Add comprehensive logging
- [ ] Write unit tests

**Verification:**
- [ ] Can create/read/update/delete models
- [ ] API keys are encrypted in database
- [ ] Connection testing works
- [ ] Templates import correctly
- [ ] RLS prevents unauthorized access

**Dependencies:** Phase 1

---

### Phase 3: Unified LLM Client
**Status:** Pending
**Estimated Time:** 4-5 hours
**Files to Create:**
1. `lib/llm/unified-client.ts` - Main client class
2. `lib/llm/adapters/openai-adapter.ts` - OpenAI-compatible adapter
3. `lib/llm/adapters/anthropic-adapter.ts` - Anthropic adapter
4. `lib/llm/adapters/ollama-adapter.ts` - Ollama adapter
5. `lib/llm/adapters/huggingface-adapter.ts` - HuggingFace adapter
6. `lib/llm/adapters/base-adapter.ts` - Base adapter interface

**Unified Client:**
```typescript
class UnifiedLLMClient {
  async chat(
    modelId: string,
    messages: ChatMessage[],
    options?: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
      toolCallHandler?: ToolCallHandler;
    }
  ): Promise<LLMResponse>

  async *stream(
    modelId: string,
    messages: ChatMessage[],
    options?: {
      tools?: ToolDefinition[];
      temperature?: number;
      maxTokens?: number;
    }
  ): AsyncGenerator<string>
}
```

**Tasks:**
- [ ] Implement UnifiedLLMClient
- [ ] Create provider adapters
- [ ] Handle request formatting per provider
- [ ] Handle response parsing per provider
- [ ] Support streaming for all providers
- [ ] Handle tool calls for all providers
- [ ] Add fallback logic (retry, alternate model)
- [ ] Add comprehensive logging
- [ ] Write integration tests

**Verification:**
- [ ] Works with OpenAI models
- [ ] Works with Anthropic models
- [ ] Works with Ollama models
- [ ] Works with HuggingFace models
- [ ] Streaming works for all
- [ ] Tool calls work for all
- [ ] Proper error handling

**Dependencies:** Phase 2

---

### Phase 4: Chat API Integration
**Status:** Pending
**Estimated Time:** 2-3 hours
**Files to Modify:**
1. `app/api/chat/route.ts` - Use UnifiedLLMClient instead of direct providers

**Changes:**
- Replace provider switching logic (lines 142-154)
- Use UnifiedLLMClient.chat() / stream()
- Get modelId from request or conversation
- Maintain backward compatibility

**Old Code:**
```typescript
const llmConfig = loadLLMConfig();
const provider = llmConfig.provider || 'openai';
if (provider === 'anthropic') {
  streamLLMResponse = streamAnthropicResponse;
  runLLMWithToolCalls = runAnthropicWithToolCalls;
} else {
  streamLLMResponse = streamOpenAIResponse;
  runLLMWithToolCalls = runOpenAIWithToolCalls;
}
```

**New Code:**
```typescript
const modelId = req.body.modelId || await getDefaultModel(userId);
const client = new UnifiedLLMClient();

if (tools && tools.length > 0) {
  const response = await client.chat(modelId, enhancedMessages, {
    tools,
    toolCallHandler,
  });
  // ... rest stays the same
} else {
  for await (const chunk of client.stream(modelId, enhancedMessages)) {
    // ... rest stays the same
  }
}
```

**Tasks:**
- [ ] Modify chat route to use UnifiedLLMClient
- [ ] Add modelId extraction from request/conversation
- [ ] Maintain backward compatibility (default model)
- [ ] Add logging for model selection
- [ ] Update error handling
- [ ] Test with existing conversations

**Verification:**
- [ ] Existing conversations still work
- [ ] Can select model per request
- [ ] Streaming still works
- [ ] Tool calls still work
- [ ] GraphRAG integration still works
- [ ] Token tracking still works

**Dependencies:** Phase 3

---

### Phase 5: UI Components
**Status:** Pending
**Estimated Time:** 5-6 hours
**Files to Create:**
1. `components/models/ModelSelector.tsx` - Dropdown to select model
2. `components/models/ModelManagement.tsx` - Admin dashboard
3. `components/models/AddModelDialog.tsx` - Add/edit model form
4. `components/models/TestConnection.tsx` - Test model connection
5. `app/models/page.tsx` - Models management page

**Components:**

**ModelSelector** - In chat interface
```tsx
<ModelSelector
  value={selectedModelId}
  onChange={setSelectedModelId}
  showGlobal={true}
  showPersonal={true}
  groupBy="provider"
/>
```

**ModelManagement** - Admin dashboard
```tsx
<ModelManagement
  onAdd={() => openAddDialog()}
  onEdit={(id) => openEditDialog(id)}
  onDelete={(id) => confirmDelete(id)}
  onTest={(id) => testConnection(id)}
/>
```

**Tasks:**
- [ ] Create ModelSelector component
- [ ] Create ModelManagement dashboard
- [ ] Create AddModelDialog with template support
- [ ] Create TestConnection component
- [ ] Add to navigation menu
- [ ] Style with existing design system
- [ ] Add loading states
- [ ] Add error states
- [ ] Write component tests

**Verification:**
- [ ] Can select model in chat
- [ ] Can view all models
- [ ] Can add new model
- [ ] Can edit existing model
- [ ] Can delete model
- [ ] Can test connection
- [ ] Can import from template
- [ ] UI is responsive

**Dependencies:** Phase 4

---

### Phase 6: Testing & Documentation
**Status:** Pending
**Estimated Time:** 3-4 hours
**Files to Create:**
1. `__tests__/lib/models/model-manager.test.ts`
2. `__tests__/lib/llm/unified-client.test.ts`
3. `__tests__/api/models/route.test.ts`
4. `docs/features/DYNAMIC_MODELS.md`
5. `docs/api/MODELS_API.md`

**Tasks:**
- [ ] Unit tests for model manager
- [ ] Integration tests for unified client
- [ ] API endpoint tests
- [ ] Component tests
- [ ] E2E tests for complete flow
- [ ] Documentation for admins
- [ ] Documentation for users
- [ ] API documentation

**Verification:**
- [ ] All tests pass
- [ ] Documentation is complete
- [ ] Code coverage > 80%

**Dependencies:** Phase 5

---

## Implementation Progress

### Session 1: 2025-10-14
**Duration:** 1 hour
**Completed:**
- \u2705 Analyzed current architecture
- \u2705 Designed new schema
- \u2705 Created implementation plan
- \u2705 Created progress log

**Next Session:**
- Start Phase 1: Database schema

---

## Testing & Verification

### Manual Testing Checklist
- [ ] Can create model from template
- [ ] Can add custom vLLM endpoint
- [ ] Can add HuggingFace model
- [ ] Can test connection before saving
- [ ] Can select model in chat
- [ ] Chat works with new model
- [ ] Streaming works
- [ ] Tool calls work
- [ ] Token tracking works
- [ ] A/B testing works (same convo, different models)

### Automated Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] No TypeScript errors
- [ ] No console errors

---

## Known Issues & Decisions

### Design Decisions
1. **Encryption:** Using AES-256-GCM with key stored in env (ENCRYPTION_KEY)
2. **Default Model:** Fall back to first enabled global model if user doesn't select
3. **Backward Compatibility:** Keep existing .env config working, but prioritize database models
4. **Ollama:** Treat as OpenAI-compatible (uses same adapter)
5. **Per-Message Model:** Store llm_model_id in messages table for A/B testing analytics

### Security Considerations
1. API keys encrypted at rest
2. RLS ensures users only see their models + global
3. Connection testing doesn't expose full API key
4. Rate limiting on model API endpoints
5. Audit log for model changes

### Performance Considerations
1. Cache decrypted models in memory (5 min TTL)
2. Index on (user_id, enabled) for fast queries
3. Lazy load model configs
4. Connection pool for database queries

---

## Migration Path

### For Existing Users
1. Run migration 10_llm_models_registry.sql
2. Run seed-default-models.ts to create OpenAI/Anthropic models
3. Existing .env config still works (backward compatible)
4. Gradually migrate to database models

### For New Users
1. Admin seeds default models
2. Users select from available models or add their own
3. No .env configuration needed

---

## Future Enhancements
- [ ] Model performance analytics dashboard
- [ ] Cost tracking per model
- [ ] Automatic model fallback on errors
- [ ] Model recommendation engine
- [ ] Support for embedding models
- [ ] Support for image generation models
- [ ] Multi-model ensemble responses

---

**End of Progress Log**
