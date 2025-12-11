# Auto-Fetch Provider Models Feature

**Date:** 2025-12-03
**Goal:** VS Code-style model selection - when users add API keys, automatically fetch available models from provider

---

## Current Situation

**What you have:**
- ✅ Model management page (`/models`)
- ✅ AddModelDialog with templates
- ✅ Manual model creation
- ✅ API key storage (encrypted)

**What's missing:**
- ❌ Automatic model list fetching from provider APIs
- ❌ Default model selection for users
- ❌ Easy way to add models from provider account

---

## Proposed Solution

### User Flow

**Step 1: User adds API key**
```
User opens /models → Click "Add Model" → Select provider (OpenAI/Anthropic)
→ Enter API key → Click "Fetch Models" button
→ System queries provider API → Shows list of available models
→ User selects which models to add → Done!
```

**Step 2: Set default model**
```
User goes to /models → Click star icon on preferred model → Becomes default
→ Shows as selected in chat dropdown by default
```

---

## Implementation Plan

### Part 1: Provider Model List API Endpoints

**Create:** `/app/api/providers/fetch-models/route.ts`

```typescript
// Fetches available models from provider API
POST /api/providers/fetch-models

Request:
{
  "provider": "openai" | "anthropic",
  "api_key": "sk-..."
}

Response:
{
  "success": true,
  "models": [
    {
      "id": "gpt-4o-mini",
      "name": "GPT-4o Mini",
      "context_length": 128000,
      "supports_streaming": true,
      "supports_functions": true,
      "supports_vision": true
    },
    ...
  ]
}
```

**OpenAI Endpoint:**
```
GET https://api.openai.com/v1/models
Authorization: Bearer sk-proj-...
```

**Anthropic Endpoint:**
```
GET https://api.anthropic.com/v1/models
x-api-key: sk-ant-...
anthropic-version: 2023-06-01
```

### Part 2: Enhanced AddModelDialog

**Modify:** `/components/models/AddModelDialog.tsx`

**Add new tab:** "Import from Provider"

```tsx
Tabs:
1. "Templates" (existing)
2. "Import from Provider" (NEW)
3. "Manual" (existing)
```

**New Import Tab UI:**
```
┌─────────────────────────────────────────────┐
│ Import Models from Provider                 │
├─────────────────────────────────────────────┤
│                                              │
│ Provider: [OpenAI ▼]                        │
│                                              │
│ API Key: [sk-proj-...] [Fetch Models]      │
│                                              │
│ ✓ gpt-4o-mini                               │
│ ✓ gpt-4-turbo-preview                       │
│ ✓ gpt-3.5-turbo                             │
│ ☐ gpt-4o                                    │
│ ☐ gpt-5-chat                                │
│                                              │
│ [Cancel] [Import Selected (3)]              │
└─────────────────────────────────────────────┘
```

### Part 3: Default Model Preference

**Database Schema Change:**

```sql
-- Add default_model_id to user_settings or profiles table
ALTER TABLE user_settings ADD COLUMN default_model_id UUID REFERENCES llm_models(id);

-- Or add is_default flag to llm_models
ALTER TABLE llm_models ADD COLUMN is_default BOOLEAN DEFAULT false;
```

**API Endpoint:**
```typescript
// Set default model
POST /api/user/settings/default-model

Request:
{
  "model_id": "uuid-of-model"
}

Response:
{
  "success": true,
  "default_model_id": "uuid-of-model"
}
```

**UI Changes:**

In `/models` page, add star icon to each model card:
```tsx
<Button onClick={() => setDefaultModel(model.id)}>
  {model.is_default ? <StarFilled /> : <Star />}
  Set as Default
</Button>
```

In chat `ModelSelector`:
```tsx
// Load default on mount
useEffect(() => {
  const defaultModel = models.find(m => m.is_default);
  if (defaultModel && !value) {
    onChange(defaultModel.id);
  }
}, [models]);
```

---

## Implementation Steps

### Phase 1: Provider Model Fetching (1-2 hours)

**Step 1.1: Create provider API clients**
```typescript
// lib/llm/providers/openai-models.ts
export async function fetchOpenAIModels(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  const data = await response.json();

  return data.data.map(model => ({
    id: model.id,
    name: formatModelName(model.id),
    context_length: getContextLength(model.id),
    supports_streaming: true,
    supports_functions: supportsTools(model.id),
    supports_vision: supportsVision(model.id),
  }));
}

// lib/llm/providers/anthropic-models.ts
export async function fetchAnthropicModels(apiKey: string) {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });

  const data = await response.json();

  return data.models.map(model => ({
    id: model.id,
    name: model.display_name || model.id,
    context_length: model.max_tokens,
    supports_streaming: true,
    supports_functions: true,
    supports_vision: model.capabilities?.includes('vision'),
  }));
}
```

**Step 1.2: Create API route**
```typescript
// app/api/providers/fetch-models/route.ts
import { fetchOpenAIModels } from '@/lib/llm/providers/openai-models';
import { fetchAnthropicModels } from '@/lib/llm/providers/anthropic-models';

export async function POST(req: Request) {
  const { provider, api_key } = await req.json();

  try {
    let models;

    if (provider === 'openai') {
      models = await fetchOpenAIModels(api_key);
    } else if (provider === 'anthropic') {
      models = await fetchAnthropicModels(api_key);
    } else {
      throw new Error('Unsupported provider');
    }

    return Response.json({ success: true, models });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
}
```

### Phase 2: Enhanced AddModelDialog (2-3 hours)

**Step 2.1: Add "Import from Provider" tab**

**Step 2.2: Add API key input + fetch button**

**Step 2.3: Display fetched models with checkboxes**

**Step 2.4: Batch import selected models**

### Phase 3: Default Model (1 hour)

**Step 3.1: Add database column**

**Step 3.2: Create API endpoint**

**Step 3.3: Add UI to set default**

**Step 3.4: Auto-select in chat**

---

## Code Examples

### Example 1: Fetch OpenAI Models

```typescript
const handleFetchModels = async () => {
  setFetching(true);
  setError(null);

  try {
    const response = await fetch('/api/providers/fetch-models', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        provider: selectedProvider,
        api_key: apiKey,
      }),
    });

    const data = await response.json();

    if (data.success) {
      setAvailableModels(data.models);
      setSelectedModels(data.models.map(m => m.id)); // Select all by default
    } else {
      setError(data.error);
    }
  } catch (err) {
    setError(err.message);
  } finally {
    setFetching(false);
  }
};
```

### Example 2: Batch Import Models

```typescript
const handleImportSelected = async () => {
  setImporting(true);

  const modelsToImport = availableModels.filter(m =>
    selectedModels.includes(m.id)
  );

  try {
    // Import all selected models in parallel
    await Promise.all(
      modelsToImport.map(model =>
        fetch('/api/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`,
          },
          body: JSON.stringify({
            name: model.name,
            provider: selectedProvider,
            model_id: model.id,
            api_key: apiKey,
            base_url: getBaseUrl(selectedProvider),
            auth_type: getAuthType(selectedProvider),
            supports_streaming: model.supports_streaming,
            supports_functions: model.supports_functions,
            supports_vision: model.supports_vision,
            context_length: model.context_length,
            max_output_tokens: model.max_output_tokens || 4096,
          }),
        })
      )
    );

    toast.success(`Imported ${modelsToImport.length} models!`);
    onSuccess();
  } catch (err) {
    setError(err.message);
  } finally {
    setImporting(false);
  }
};
```

### Example 3: Set Default Model

```typescript
const handleSetDefault = async (modelId: string) => {
  try {
    const response = await fetch('/api/user/settings/default-model', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ model_id: modelId }),
    });

    if (response.ok) {
      // Update local state
      setModels(prev => prev.map(m => ({
        ...m,
        is_default: m.id === modelId
      })));

      toast.success('Default model updated!');
    }
  } catch (err) {
    toast.error('Failed to set default model');
  }
};
```

---

## Benefits

### For Users

✅ **No manual setup** - Just enter API key, get all models instantly
✅ **VS Code-like experience** - Familiar workflow for developers
✅ **Auto-updated** - Can re-fetch to get new models from provider
✅ **Default model** - Chat starts with preferred model
✅ **Bulk import** - Add multiple models at once

### For You (Platform Owner)

✅ **Less support** - Users can self-serve model setup
✅ **More engagement** - Users can easily try different models
✅ **Better UX** - Professional, polished experience
✅ **Scalable** - Works for any provider that has a models API

---

## Complexity Estimate

**Time:** 4-6 hours total
**Difficulty:** Medium

**Breakdown:**
- Provider API clients: 1 hour
- API route: 30 minutes
- Enhanced dialog UI: 2-3 hours
- Default model feature: 1 hour
- Testing: 1 hour

**Dependencies:**
- None! All existing systems work as-is
- This is purely additive

---

## Alternative: Simpler Approach

If you want **even simpler** (30 minutes implementation):

### Quick Win: Provider Secrets

**Just add provider-level API keys in settings:**

```
User Settings → API Keys tab
┌─────────────────────────────┐
│ OpenAI API Key: [sk-proj-...]
│ Anthropic API Key: [sk-ant-...]
│ HuggingFace Token: [hf_...]
└─────────────────────────────┘
```

**Then models can:**
- Use user's provider secret if no model-specific key
- User adds models from templates
- Default model set per user

**Pros:**
- ✅ Much simpler (no model fetching needed)
- ✅ 30 min implementation
- ✅ Works with existing template system

**Cons:**
- ❌ User must still manually add models from templates
- ❌ No auto-discovery of new models

---

## Recommendation

**Start with Simple Approach:**
1. Add provider-level API key storage (30 min)
2. Add default model selection (1 hour)
3. Total: 1.5 hours

**Then optionally add:**
4. Auto-fetch models from provider (3-4 hours more)

This way you get the **80% benefit** (default model + provider keys) with **20% effort** (1.5 hours).

The auto-fetch feature is nice-to-have but not critical - users can still use your excellent template system.

---

## Next Steps

**Choose your path:**

**Option A: Full VS Code Experience** (4-6 hours)
- Provider model fetching
- Enhanced import dialog
- Default model selection

**Option B: Quick Win** (1.5 hours)
- Provider API key storage in settings
- Default model selection
- Use existing templates

**Want me to implement?** Let me know which option you prefer and I'll build it!
