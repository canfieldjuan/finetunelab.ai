# LLM Providers and Models - Complete Overview

**Date:** 2025-12-02
**Status:** Active Configuration Documentation

---

## Executive Summary

Your application supports **8 LLM providers** with **28 pre-configured model templates**. The system uses a **unified client architecture** that abstracts provider differences, allowing seamless switching between providers and models.

### Currently Active Providers

Based on your `.env.local` configuration:

```bash
LLM_PROVIDER=openai              # Primary provider
OPENAI_API_KEY=sk-proj-...       # ✅ Configured
OPENAI_MODEL=gpt-4o-mini         # Default model

ANTHROPIC_API_KEY=sk-ant-...     # ✅ Configured
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Default model
```

---

## Provider Architecture

### Unified Client Pattern

**Location:** `/lib/llm/unified-client.ts`

The application uses a **Provider Adapter Pattern** to support multiple LLM providers through a single interface:

```
User Request
     ↓
UnifiedLLMClient
     ↓
Provider Adapter (selected based on model config)
     ↓
├── OpenAIAdapter        → OpenAI, Azure, vLLM, RunPod, Custom
├── AnthropicAdapter     → Anthropic Claude
├── OllamaAdapter        → Ollama (local)
└── HuggingFaceAdapter   → HuggingFace Inference API
```

**Key Benefits:**
- ✅ Single API for all providers
- ✅ Automatic provider selection based on model
- ✅ Tool calling support across all providers
- ✅ Consistent error handling
- ✅ Token usage tracking
- ✅ Streaming support

---

## Provider Details

### 1. OpenAI (Primary Provider)

**Implementation:** `/lib/llm/openai.ts`
**Adapter:** `OpenAIAdapter`
**API Docs:** https://platform.openai.com/docs

#### Current Configuration

```bash
OPENAI_API_KEY=sk-proj-m2ihW4ov...   # ✅ Active
OPENAI_MODEL=gpt-4o-mini              # Default
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true
```

#### Available Models (5)

| Model ID | Name | Context | Max Output | Price (Input/Output) | Features |
|----------|------|---------|------------|---------------------|----------|
| `gpt-4o-mini` | GPT-4o Mini | 128K | 16K | $0.15/$0.60 per 1M | ✅ Vision, Functions, Fast |
| `gpt-4-turbo-preview` | GPT-4 Turbo | 128K | 4K | $10/$30 per 1M | ✅ Vision, Functions, Complex reasoning |
| `gpt-3.5-turbo` | GPT-3.5 Turbo | 16K | 4K | $0.50/$1.50 per 1M | ✅ Functions, Fast & cheap |
| `gpt-5-chat` | GPT-5 Chat | 256K | 32K | $15/$45 per 1M | ✅ Vision, Functions, Latest gen |
| `gpt-5-pro` | GPT-5 Pro | 256K | 65K | $30/$90 per 1M | ✅ Vision, Functions, Most advanced |

**Current Usage:** Primary provider for main chat interface

#### Features

**Streaming:**
```typescript
async *streamOpenAIResponse(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools?: ToolDefinition[]
): AsyncGenerator<string>
```

**Tool Calling:**
```typescript
async runOpenAIWithToolCalls(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools?: ToolDefinition[],
  toolCallHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<LLMResponse>
```

**Token Tracking:**
- ✅ Tracks input/output tokens per request
- ✅ Accumulates across tool call rounds
- ✅ Logs to console for debugging

**Tool Call Support:**
- Max 3 rounds of tool calling
- Handles parallel tool calls
- Error recovery for failed tools

---

### 2. Anthropic (Secondary Provider)

**Implementation:** `/lib/llm/anthropic.ts`
**Adapter:** `AnthropicAdapter`
**API Docs:** https://docs.anthropic.com

#### Current Configuration

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...   # ✅ Active
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Default
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_STREAM=true
```

#### Available Models (5)

| Model ID | Name | Context | Max Output | Price (Input/Output) | Features |
|----------|------|---------|------------|---------------------|----------|
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | 200K | 8K | $3/$15 per 1M | ✅ Vision, Functions, Most intelligent |
| `claude-3-opus-20240229` | Claude 3 Opus | 200K | 4K | $15/$75 per 1M | ✅ Vision, Functions, Complex tasks |
| `claude-3-haiku-20240307` | Claude 3 Haiku | 200K | 4K | $0.25/$1.25 per 1M | ✅ Functions, Fast & cheap |
| `claude-sonnet-4.5` | Claude Sonnet 4.5 | 300K | 16K | $5/$25 per 1M | ✅ Vision, Functions, Next-gen |
| `claude-haiku-4.5` | Claude Haiku 4.5 | 300K | 8K | $0.80/$4 per 1M | ✅ Vision, Functions, Ultra-fast |

**Current Usage:** Available as alternative provider, used in analytics chat

#### Features

**Streaming:**
```typescript
async *streamAnthropicResponse(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools?: ToolDefinition[]
): AsyncGenerator<string>
```

**Tool Calling:**
```typescript
async runAnthropicWithToolCalls(
  messages: ChatMessage[],
  model: string,
  temperature: number,
  maxTokens: number,
  tools: ToolDefinition[],
  toolCallHandler?: (name: string, args: Record<string, unknown>) => Promise<unknown>
): Promise<LLMResponse>
```

**Key Differences from OpenAI:**
- Uses `x-api-key` header instead of `Authorization: Bearer`
- Requires `anthropic-version` header
- Different message format (no system role in messages array)
- Tool results use `tool_result` content block

---

### 3. HuggingFace (Open Source Models)

**Adapter:** `HuggingFaceAdapter`
**Base URL:** `https://router.huggingface.co/v1`
**API Docs:** https://huggingface.co/docs/api-inference

#### Available Models (5)

| Model ID | Name | Context | Features | Auth |
|----------|------|---------|----------|------|
| `Qwen/Qwen2.5-0.5B` | Custom Import | 32K | Functions | Bearer token |
| `mistralai/Mistral-7B-Instruct-v0.3` | Mistral 7B | 32K | Open-source | Bearer token |
| `meta-llama/Meta-Llama-3.1-8B-Instruct` | Llama 3.1 8B | 131K | Meta's latest | Bearer token |
| `HuggingFaceH4/zephyr-7b-beta` | Zephyr 7B | 32K | Assistant-tuned | Bearer token |
| `gpt2` | GPT-2 | 1K | Free tier available | Optional |

**Use Cases:**
- Testing open-source models
- Importing custom fine-tuned models from HF Hub
- Free tier experimentation
- Research and development

**Limitations:**
- ⚠️ No streaming support (HF Inference API limitation)
- ⚠️ Limited function calling support
- ⚠️ Rate limits on free tier

---

### 4. Ollama (Local Models)

**Adapter:** `OllamaAdapter`
**Base URL:** `http://localhost:11434`
**Docs:** https://ollama.ai/docs

#### Available Models (3)

| Model ID | Name | Size | Context | Features |
|----------|------|------|---------|----------|
| `llama3.1:8b` | Llama 3.1 8B | 8B | 131K | ✅ Streaming, Local |
| `mistral:7b` | Mistral 7B | 7B | 32K | ✅ Streaming, Local |
| `phi3:mini` | Phi-3 Mini | 3.8B | 131K | ✅ Streaming, Compact |

**Use Cases:**
- 🔒 Privacy-sensitive applications
- 💰 Zero API costs
- 📡 Offline operation
- 🧪 Local development

**Requirements:**
- Ollama installed locally
- Models downloaded via `ollama pull <model>`
- Sufficient RAM (8GB+ recommended)

**No API Key Required!**

---

### 5. vLLM (Self-Hosted)

**Adapter:** `OpenAIAdapter` (OpenAI-compatible)
**Base URL:** `http://localhost:8000/v1`
**Docs:** https://docs.vllm.ai

#### Available Models (2)

| Model ID | Name | Features |
|----------|------|----------|
| `custom-model` | Custom vLLM Endpoint | ✅ Streaming, Functions |
| `mistralai/Mistral-7B-Instruct-v0.2` | Mistral 7B | ✅ Streaming, Fast inference |

**Use Cases:**
- 🚀 High-performance local inference
- 💰 Cost optimization for high volume
- 🔒 Data privacy
- 🧪 Testing fine-tuned models

**Key Features:**
- OpenAI-compatible API
- Continuous batching for high throughput
- PagedAttention for memory efficiency
- Support for quantization (AWQ, GPTQ)

**Tool Call Support:**
```bash
# Must enable tool calling when starting vLLM:
vllm serve MODEL --port 8003 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
```

⚠️ **Important:** Without `--enable-auto-tool-choice`, tool calling will fail with helpful error message.

---

### 6. Azure OpenAI

**Adapter:** `OpenAIAdapter` (OpenAI-compatible)
**Base URL:** `https://YOUR-RESOURCE.openai.azure.com`
**Docs:** https://learn.microsoft.com/en-us/azure/ai-services/openai/

#### Available Models (2)

| Model ID | Name | Features |
|----------|------|----------|
| `your-deployment-name` | GPT-4o (Azure) | ✅ Vision, Functions, Enterprise |
| `your-deployment-name` | GPT-3.5 Turbo (Azure) | ✅ Functions, Enterprise |

**Use Cases:**
- 🏢 Enterprise deployments
- 🔒 Data residency requirements
- 📊 Usage analytics and controls
- 💼 SLA guarantees

**Configuration:**
- Requires Azure subscription
- Deploy models through Azure portal
- Use deployment name (not model ID) in config
- API key from Azure resource

---

### 7. RunPod (Cloud GPU Deployment)

**Adapter:** `OpenAIAdapter` (vLLM-based)
**Base URL:** `https://YOUR_POD_ID-8000.proxy.runpod.net/v1`
**Docs:** https://docs.runpod.io

#### Available Models (4)

| Model ID | Name | Use Case |
|----------|------|----------|
| `your-model-name` | Custom RunPod Endpoint | General deployment |
| `Qwen/Qwen2.5-7B-Instruct` | Qwen2.5 on RunPod | ✅ Streaming, Functions |
| `meta-llama/Llama-3.1-8B-Instruct` | Llama 3.1 on RunPod | ✅ Streaming, Functions |
| `your-username/your-finetuned-model` | Fine-tuned on RunPod | Your trained models |

**Use Cases:**
- ☁️ Cloud GPU rental
- 💰 Cost-effective inference
- 📈 Scalable deployments
- 🚀 Deploy fine-tuned models

**Integration with Training:**
Your app can deploy training checkpoints directly to RunPod vLLM pods for inference.

**No API Key Required:** RunPod proxy URL is publicly accessible via HTTPS.

---

### 8. Local Model Deployment

**Adapter:** `OpenAIAdapter` (vLLM-based)
**Base URL:** `http://127.0.0.1:8002/v1` (dynamically assigned)

#### Available Templates (3)

| Template ID | Description | Use Case |
|-------------|-------------|----------|
| `local-vllm-huggingface` | Deploy HF Model (vLLM) | Deploy any HuggingFace model locally |
| `local-vllm-checkpoint` | Deploy Training Checkpoint (vLLM) | Deploy fine-tuned checkpoints |
| `local-ollama-checkpoint` | Deploy Checkpoint (Ollama) | Convert checkpoint to GGUF and deploy |

**Workflow:**
1. Train model in `/training` interface
2. Select best checkpoint
3. Click "Deploy" → Choose provider (local vLLM or Ollama)
4. System starts local inference server
5. Model becomes available for chat

**Example Checkpoint Path:**
```
lib/training/logs/job_e1728de8-1e35-4a73-8c91-893c946d5444/checkpoint-708
```

---

## Model Selection Logic

### Where Models Are Selected

#### 1. Main Chat Interface (`/app/api/chat/route.ts`)

**Model Selection Flow:**
```typescript
// 1. User selects model from dropdown (frontend)
// 2. Model ID sent in request body
const { model_id } = await req.json();

// 3. Load model configuration from database
const config = await modelManager.getModelConfig(model_id, userId);

// 4. Determine provider from config
const provider = config.provider; // 'openai', 'anthropic', etc.

// 5. Call appropriate provider
if (provider === 'openai') {
  await runOpenAIWithToolCalls(...);
} else if (provider === 'anthropic') {
  await runAnthropicWithToolCalls(...);
}
```

#### 2. Analytics Chat (`/app/api/analytics/chat/route.ts`)

**Provider Detection:**
```typescript
const getProviderForModel = (modelName: string): 'openai' | 'anthropic' | 'xai' => {
  if (modelName.startsWith('claude')) return 'anthropic';
  if (modelName.startsWith('grok')) return 'xai';
  return 'openai'; // Default for gpt-* models
};
```

**Used for:**
- Analytics assistant conversations
- Tool-enabled analysis sessions
- Training job queries
- Performance analytics

#### 3. Environment Variable Fallback

**When no model specified:**
```typescript
// Load from .env.local
const config = loadLLMConfig();

// Use configured provider
const provider = config.provider; // 'openai' from LLM_PROVIDER

// Use configured model
const model = config.openai.model; // 'gpt-4o-mini' from OPENAI_MODEL
```

---

## Tool Calling Support

### How Tool Calling Works

**Unified Flow:**
```
1. User sends message
2. LLM decides if tools are needed
3. LLM returns tool_calls instead of text
4. System executes tools via toolCallHandler
5. Tool results added to conversation
6. LLM called again with results
7. LLM returns final answer
```

### Tool Support by Provider

| Provider | Tool Calling | Max Rounds | Parallel Tools |
|----------|--------------|------------|----------------|
| OpenAI | ✅ Yes | 3 | ✅ Yes |
| Anthropic | ✅ Yes | 3 | ✅ Yes |
| HuggingFace | ⚠️ Limited | 1 | ❌ No |
| Ollama | ❌ No | - | - |
| vLLM | ✅ Yes (with flags) | 3 | ✅ Yes |
| Azure | ✅ Yes | 3 | ✅ Yes |
| RunPod | ✅ Yes (vLLM) | 3 | ✅ Yes |
| Local | ✅ Yes (vLLM) | 3 | ✅ Yes |

### Available Tools

**Main Chat Tools:**
- `calculator` - Math calculations
- `web_search` - Internet search
- `document_search` - GraphRAG knowledge search
- `datetime` - Date/time operations
- `filesystem` - File operations (read/write/list)

**Analytics Chat Tools:**
- `calculator` - Math calculations
- `evaluation_metrics` - Quality analysis
- `datetime` - Date/time operations
- `system_monitor` - Health monitoring
- `session_analysis` - Session deep-dive
- `user_cohorts` - Cohort analysis
- `export_data` - Data export
- `cache_metrics` - Cache performance
- `training_metrics` - Training job analysis ⭐ NEW
- `training_predictions` - Prediction analysis ⭐ NEW
- `advanced_analytics` - Advanced analytics ⭐ NEW

---

## Token Usage and Cost Tracking

### Token Tracking Interface

**Unified across providers:**
```typescript
export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  toolsCalled?: ToolCallMetadata[];
}
```

### How Tokens Are Tracked

**1. Single Request:**
```typescript
const response = await unifiedLLMClient.chat(modelId, messages);
console.log('Tokens used:', response.usage.input_tokens, 'in,', response.usage.output_tokens, 'out');
```

**2. Multi-Round Tool Calling:**
```typescript
// Accumulates across all rounds
let totalInputTokens = 0;
let totalOutputTokens = 0;

for (let round = 0; round < 3; round++) {
  const completion = await client.chat.completions.create(...);
  totalInputTokens += completion.usage.prompt_tokens;
  totalOutputTokens += completion.usage.completion_tokens;
}

return {
  content: finalText,
  usage: {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
  },
};
```

### Cost Calculation

**Formula:**
```typescript
const inputCost = (usage.input_tokens / 1_000_000) * model.price_per_input_token;
const outputCost = (usage.output_tokens / 1_000_000) * model.price_per_output_token;
const totalCost = inputCost + outputCost;
```

**Example (GPT-4o Mini):**
```
Input: 1000 tokens × $0.15/1M = $0.00015
Output: 500 tokens × $0.60/1M = $0.00030
Total: $0.00045 per request
```

### Where Costs Are Logged

**Console Logs:**
```
[OpenAI] Token usage: 1234 in, 567 out
[Anthropic] Token usage: 2345 in, 890 out
[UnifiedLLMClient] Response: { usage: { input_tokens: 1234, output_tokens: 567 } }
```

**Analytics Dashboard:**
- Cost tracking per conversation
- Cost per model comparison
- Daily/weekly/monthly spend
- User-level cost attribution

---

## Configuration Management

### Environment Variables (`.env.local`)

**Primary Configuration:**
```bash
# Provider Selection
LLM_PROVIDER=openai  # 'openai' | 'anthropic' | 'ollama'

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_STREAM=true

# Ollama Configuration (optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_TEMPERATURE=0.7
OLLAMA_STREAM=true
```

### Model Templates (`/lib/models/model-templates.ts`)

**Purpose:**
- Pre-configured model definitions
- Default parameters
- Pricing information
- Feature flags (vision, functions, streaming)

**Structure:**
```typescript
export const OPENAI_TEMPLATES: ModelTemplate[] = [
  {
    id: 'openai-gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Fast and cost-effective model for most tasks',
    base_url: 'https://api.openai.com/v1',
    model_id: 'gpt-4o-mini',
    auth_type: 'bearer',
    supports_streaming: true,
    supports_functions: true,
    supports_vision: true,
    context_length: 128000,
    max_output_tokens: 16384,
    price_per_input_token: 0.00000015,
    price_per_output_token: 0.0000006,
    default_temperature: 0.7,
    default_top_p: 1.0,
    placeholder_api_key: 'sk-proj-...',
  },
  // ... more templates
];
```

### Database Model Storage

**Table:** `llm_models`

**Schema:**
```sql
CREATE TABLE llm_models (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', etc.
  model_id TEXT NOT NULL,  -- 'gpt-4o-mini', 'claude-3-5-sonnet', etc.
  base_url TEXT,
  api_key TEXT,  -- Encrypted
  is_enabled BOOLEAN DEFAULT true,
  config JSONB,  -- Temperature, max_tokens, etc.
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Usage:**
```typescript
// Get model config (with API key decryption)
const config = await modelManager.getModelConfig(modelId, userId);

// Returns:
{
  id: 'uuid',
  name: 'My GPT-4o Mini',
  provider: 'openai',
  model_id: 'gpt-4o-mini',
  base_url: 'https://api.openai.com/v1',
  api_key: 'sk-proj-...',  // Decrypted for this user
  temperature: 0.7,
  max_tokens: 2000,
  supports_streaming: true,
  supports_functions: true,
  // ... other fields
}
```

---

## Provider Adapters Deep Dive

### Base Adapter Interface

**Location:** `/lib/llm/adapters/base-adapter.ts`

```typescript
export interface ProviderAdapter {
  // Format request for provider API
  formatRequest(request: AdapterRequest): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };

  // Parse non-streaming response
  parseResponse(
    response: Response,
    body: unknown
  ): Promise<AdapterResponse>;

  // Parse streaming chunk (SSE format)
  parseStreamChunk(chunk: string): string | null;
}
```

### OpenAI Adapter

**Used by:** OpenAI, Azure, vLLM, RunPod, Custom endpoints

**Request Format:**
```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true,
  "tools": [/* tool definitions */]
}
```

**Response Format:**
```json
{
  "id": "chatcmpl-...",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help?",
      "tool_calls": [/* if tools used */]
    }
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Anthropic Adapter

**Used by:** Anthropic Claude

**Request Format:**
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 2000,
  "temperature": 0.7,
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true,
  "tools": [/* tool definitions */]
}
```

**Headers:**
```typescript
{
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json'
}
```

**Response Format:**
```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Hello! How can I help?" }
  ],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20
  }
}
```

### Ollama Adapter

**Used by:** Ollama (local)

**Request Format:**
```json
{
  "model": "llama3.1:8b",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true,
  "options": {
    "temperature": 0.7
  }
}
```

**No API Key:** Ollama is local and doesn't require authentication.

### HuggingFace Adapter

**Used by:** HuggingFace Inference API

**Request Format:**
```json
{
  "model": "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "max_tokens": 2000,
  "temperature": 0.7
}
```

**Headers:**
```typescript
{
  'Authorization': `Bearer ${apiKey}`,
  'Content-Type': 'application/json'
}
```

---

## Usage Examples

### Example 1: Simple Chat with OpenAI

```typescript
import { unifiedLLMClient } from '@/lib/llm/unified-client';

const response = await unifiedLLMClient.chat(
  'openai-gpt-4o-mini',  // Model ID
  [
    { role: 'user', content: 'What is 2+2?' }
  ],
  {
    temperature: 0.7,
    maxTokens: 100,
    userId: 'user-123'
  }
);

console.log('Response:', response.content);
console.log('Tokens:', response.usage);
// Output:
// Response: 2+2 equals 4.
// Tokens: { input_tokens: 12, output_tokens: 8 }
```

### Example 2: Chat with Tool Calling

```typescript
import { unifiedLLMClient } from '@/lib/llm/unified-client';

const tools = [
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string' }
        },
        required: ['expression']
      }
    }
  }
];

const toolHandler = async (name: string, args: Record<string, unknown>) => {
  if (name === 'calculator') {
    const result = eval(args.expression as string);
    return { result };
  }
};

const response = await unifiedLLMClient.chat(
  'anthropic-claude-3.5-sonnet',
  [
    { role: 'user', content: 'What is 157 * 289?' }
  ],
  {
    tools,
    toolCallHandler: toolHandler,
    userId: 'user-123'
  }
);

console.log('Response:', response.content);
console.log('Tools called:', response.toolsCalled);
// Output:
// Response: 157 multiplied by 289 equals 45,373.
// Tools called: [{ name: 'calculator', success: true }]
```

### Example 3: Streaming Response

```typescript
import { unifiedLLMClient } from '@/lib/llm/unified-client';

const stream = unifiedLLMClient.stream(
  'openai-gpt-4o-mini',
  [
    { role: 'user', content: 'Write a short poem about coding' }
  ],
  {
    temperature: 0.8,
    userId: 'user-123'
  }
);

for await (const chunk of stream) {
  process.stdout.write(chunk);
}
// Output (streamed):
// Code flows like poetry,
// Functions dance in harmony,
// Bugs hide in mystery.
```

### Example 4: Using Local Ollama Model

```typescript
import { unifiedLLMClient } from '@/lib/llm/unified-client';

// First, ensure Ollama is running and model is downloaded:
// $ ollama pull llama3.1:8b

const response = await unifiedLLMClient.chat(
  'ollama-llama3.1-8b',
  [
    { role: 'user', content: 'Explain quantum computing briefly' }
  ],
  {
    temperature: 0.7,
    userId: 'user-123'
  }
);

console.log('Response:', response.content);
// No API costs! Runs 100% locally.
```

### Example 5: Deploying Fine-Tuned Model

```typescript
// After training a model locally...

// 1. Deploy to local vLLM
const deployment = await deployLocalModel({
  checkpointPath: 'lib/training/logs/job_e1728de8/checkpoint-708',
  provider: 'vllm',
  port: 8003,
  enableToolChoice: true,
  toolParser: 'hermes'
});

// 2. Add model to database
const modelConfig = await modelManager.createModel({
  name: 'My Fine-Tuned Qwen',
  provider: 'vllm',
  model_id: 'Qwen/Qwen2.5-7B-Instruct',
  base_url: `http://localhost:${deployment.port}/v1`,
  userId: 'user-123'
});

// 3. Use in chat
const response = await unifiedLLMClient.chat(
  modelConfig.id,
  [
    { role: 'user', content: 'Test my fine-tuned model' }
  ]
);
```

---

## Best Practices

### 1. Model Selection

**Choose based on:**
- ✅ **Task complexity** - Simple tasks → cheaper models (GPT-3.5, Haiku), Complex → advanced models (GPT-4, Opus)
- ✅ **Budget** - OpenAI Mini ($0.15/1M) vs GPT-4 ($10/1M)
- ✅ **Latency** - Streaming models for real-time, batch for analysis
- ✅ **Privacy** - Sensitive data → local Ollama/vLLM, General → cloud APIs

### 2. Tool Calling

**When to use tools:**
- ✅ Need current information (web search)
- ✅ Need precise calculations (calculator)
- ✅ Need to access external data (database, filesystem)
- ✅ Need to perform actions (send email, create ticket)

**When NOT to use tools:**
- ❌ LLM can answer from knowledge (factual questions)
- ❌ Simple reasoning tasks
- ❌ Creative writing

### 3. Cost Optimization

**Strategies:**
- 💰 Use cheaper models for simple tasks (classification, extraction)
- 💰 Cache common responses
- 💰 Limit max_tokens to reduce output costs
- 💰 Use streaming to cancel early if response is satisfactory
- 💰 Consider local Ollama for high-volume, low-latency tasks

### 4. Error Handling

**Provider-specific errors:**
```typescript
try {
  const response = await unifiedLLMClient.chat(modelId, messages);
} catch (error) {
  if (error.message.includes('rate_limit')) {
    // OpenAI rate limit - wait and retry
  } else if (error.message.includes('overloaded')) {
    // Anthropic overloaded - switch to different model
  } else if (error.message.includes('tool choice requires')) {
    // vLLM needs --enable-auto-tool-choice flag
  }
}
```

### 5. Security

**API Key Management:**
- ✅ Store keys in `.env.local` (never commit)
- ✅ Encrypt keys in database (user-specific keys)
- ✅ Use environment variables for server-side access
- ✅ Rotate keys periodically

**User Isolation:**
- ✅ Pass `userId` to all model manager calls
- ✅ Filter models by user in database queries
- ✅ Validate user has access to model before using

---

## Current Usage in Application

### Main Chat Interface

**Provider:** OpenAI (primary), Anthropic (secondary)
**Model:** User-selectable from database models
**Tools:** Web search, calculator, datetime, document search, filesystem

**Flow:**
```typescript
// app/api/chat/route.ts
const { model_id, messages } = await req.json();
const config = await modelManager.getModelConfig(model_id, userId);

if (provider === 'openai') {
  const response = await runOpenAIWithToolCalls(
    messages,
    config.model_id,
    config.temperature,
    config.max_tokens,
    tools,
    toolCallHandler
  );
} else if (provider === 'anthropic') {
  const response = await runAnthropicWithToolCalls(
    messages,
    config.model_id,
    config.temperature,
    config.max_tokens,
    tools,
    toolCallHandler
  );
}
```

### Analytics Chat Interface

**Provider:** OpenAI (primary), Anthropic (auto-detected)
**Model:** Auto-selected based on model name prefix
**Tools:** Analytics-specific tools (11 total)

**Flow:**
```typescript
// app/api/analytics/chat/route.ts
const getProviderForModel = (modelName: string) => {
  if (modelName.startsWith('claude')) return 'anthropic';
  return 'openai';
};

const provider = getProviderForModel(messages[0].llm_model_id);

if (provider === 'openai') {
  const { runOpenAIWithToolCalls } = await import('@/lib/llm/openai');
  response = await runOpenAIWithToolCalls(...);
} else if (provider === 'anthropic') {
  const { runAnthropicWithToolCalls } = await import('@/lib/llm/anthropic');
  response = await runAnthropicWithToolCalls(...);
}
```

### Training Interface

**Used for:** Title generation, dataset validation, evaluation judging

**Provider:** OpenAI (default)
**Model:** `gpt-4o-mini` (configured in `.env.local`)

**Example (Title Generation):**
```typescript
// app/api/conversations/generate-title/route.ts
const config = loadLLMConfig();
const response = await getOpenAIResponse(
  messages,
  config.openai.model,
  config.openai.temperature,
  100  // Short output for title
);
```

---

## Troubleshooting

### Common Issues

#### 1. "Model not found" Error

**Cause:** Model ID doesn't exist in database or user doesn't have access

**Fix:**
```typescript
// Check model exists
const model = await modelManager.getModelConfig(modelId, userId);
if (!model) {
  throw new Error('Model not found or access denied');
}
```

#### 2. "API Key Invalid" Error

**OpenAI:**
```
Error: 401 Unauthorized - Incorrect API key provided
```

**Anthropic:**
```
Error: 401 Unauthorized - x-api-key header invalid
```

**Fix:**
- Check `.env.local` has correct API key
- Verify key starts with correct prefix (`sk-proj-` for OpenAI, `sk-ant-` for Anthropic)
- Regenerate key from provider dashboard if needed

#### 3. "Tool choice requires --enable-auto-tool-choice" (vLLM)

**Cause:** vLLM server started without tool calling support

**Fix:**
```bash
# Restart vLLM with correct flags
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8003 \
  --enable-auto-tool-choice \
  --tool-call-parser hermes
```

#### 4. "Rate limit exceeded" Error

**Cause:** Too many requests to provider API

**Fix:**
- Implement exponential backoff retry
- Switch to different model/provider
- Upgrade API tier
- Use local Ollama for development

#### 5. "Context length exceeded" Error

**Cause:** Input + output tokens > model's context window

**Fix:**
```typescript
// Truncate conversation history
const recentMessages = messages.slice(-10);  // Keep last 10 messages

// Or reduce max_tokens
const response = await unifiedLLMClient.chat(modelId, messages, {
  maxTokens: 500  // Reduce from 2000
});
```

---

## Next Steps / Recommendations

### 1. Add More Providers

**Potential additions:**
- ✅ **Google Gemini** - Strong multimodal capabilities
- ✅ **Cohere** - Excellent for embeddings and RAG
- ✅ **Mistral AI** - Competitive pricing and performance
- ✅ **xAI Grok** - Already referenced in analytics code, needs full integration

### 2. Implement Model Routing

**Intelligent model selection:**
```typescript
// Auto-select best model based on task
const selectModelForTask = (task: 'simple' | 'complex' | 'coding' | 'creative') => {
  switch (task) {
    case 'simple': return 'gpt-4o-mini';  // Cheap & fast
    case 'complex': return 'claude-3-5-sonnet';  // Best reasoning
    case 'coding': return 'gpt-4-turbo';  // Best at code
    case 'creative': return 'claude-3-opus';  // Most creative
  }
};
```

### 3. Add Fallback Chain

**Automatic failover:**
```typescript
const providers = ['openai', 'anthropic', 'ollama'];
for (const provider of providers) {
  try {
    return await unifiedLLMClient.chat(modelId, messages);
  } catch (error) {
    console.log(`Provider ${provider} failed, trying next...`);
  }
}
```

### 4. Implement Response Caching

**For repeated queries:**
```typescript
// Cache key = hash(model_id + messages)
const cacheKey = hashMessages(modelId, messages);
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const response = await unifiedLLMClient.chat(modelId, messages);
await redis.setex(cacheKey, 3600, JSON.stringify(response));  // 1 hour TTL
```

### 5. Add Cost Budgets

**Per-user spending limits:**
```typescript
// Track usage per user
const usage = await getUserMonthlyUsage(userId);
if (usage.totalCost > user.monthlyBudget) {
  throw new Error('Monthly budget exceeded');
}

// Log usage
await logUsage({
  userId,
  modelId,
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  cost: calculateCost(response.usage, modelConfig),
  timestamp: new Date()
});
```

---

## Summary

Your application has a **robust, extensible LLM provider architecture** with:

✅ **8 providers supported:** OpenAI, Anthropic, HuggingFace, Ollama, vLLM, Azure, RunPod, Local
✅ **28 pre-configured models** across all providers
✅ **Unified client interface** - single API for all providers
✅ **Tool calling support** - 11+ tools available
✅ **Streaming support** - real-time responses
✅ **Token tracking** - cost monitoring and optimization
✅ **Local deployment** - privacy and cost savings
✅ **Fine-tuned model support** - train and deploy your own models

**Current Active Setup:**
- **Primary:** OpenAI GPT-4o Mini ($0.15/$0.60 per 1M tokens)
- **Secondary:** Anthropic Claude 3.5 Sonnet ($3/$15 per 1M tokens)
- **Both API keys configured and working**

**Best suited for:**
- 💬 Conversational AI applications
- 🔧 Tool-enabled assistants
- 📊 Analytics and data analysis
- 🧠 Fine-tuning and deployment workflows
- 🔒 Privacy-sensitive deployments (local models)

You're well-positioned to scale, optimize costs, and experiment with different providers as needed!
