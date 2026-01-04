# Add Model UX Improvements

## Problem Statement

The original Add Model dialog was confusing:
- Templates tab showed 19 different model templates
- Too many provider options including OpenAI and Anthropic
- Users didn't know that flagship models were already available globally
- Navigation between Templates and Manual tabs was unclear

## Solution

### 1. Removed Templates Tab

**Reasoning:**
- OpenAI (GPT-4.1, GPT-5 variants, o3-pro) models are **already global**
- Anthropic (Claude Opus/Sonnet/Haiku variants) models are **already global**
- Users don't need to manually add these flagship models
- Templates were causing confusion rather than helping

**Change:**
- Commented out entire templates tab and related code
- Show manual configuration form directly
- Cleaner, single-purpose interface

### 2. Updated Provider Dropdown

**Before:**
```typescript
const providers = ['openai', 'anthropic', 'huggingface', 'ollama', 'vllm', 'azure', 'runpod', 'fireworks'];
```

**After:**
```typescript
// Only show providers for custom models (OpenAI/Anthropic are global)
const providers = ['huggingface', 'ollama', 'vllm', 'azure', 'runpod', 'fireworks'];
```

**Providers Now Available:**

| Provider | Use Case | Auth Required |
|----------|----------|---------------|
| **HuggingFace** | Custom fine-tuned models from HF Hub | API Token |
| **Ollama** | Local models running on Ollama | None (local) |
| **vLLM** | Local high-performance serving | None (local) |
| **Azure** | Enterprise Azure OpenAI deployments | API Key |
| **RunPod** | vLLM on RunPod cloud infrastructure | None (proxy) |
| **Fireworks** | Fast inference via Fireworks.ai | API Key |

### 3. Enhanced Provider Guidance

Added contextual helper boxes that appear when a provider is selected:

#### 🤗 HuggingFace
- Base URL: `https://api-inference.huggingface.co/models`
- Model ID format: `username/model-name`
- Link to get API token
- Example: `meta-llama/Llama-3.3-70B-Instruct`

#### 🦙 Ollama (Local)
- Base URL: `http://localhost:11434/v1`
- Model ID: Name from `ollama list`
- Setup instructions with link to ollama.ai
- No API key needed (runs offline)

#### ⚡ vLLM (Local)
- Base URL: `http://localhost:8000/v1`
- Model ID: Model loaded in vLLM
- Startup command: `vllm serve [model] --port 8000`
- No API key needed (local server)

#### ☁️ Azure OpenAI
- Base URL format: `https://{resource}.openai.azure.com/openai/deployments/{deployment}`
- Model ID: Azure deployment name
- API key location in Azure Portal
- Enterprise features highlighted

#### 🚀 RunPod
- Base URL format: `https://{pod_id}-8000.proxy.runpod.net/v1`
- Pod ID from RunPod dashboard
- Model ID: HuggingFace model in vLLM
- No API key needed (proxy URL)

#### 🔥 Fireworks.ai
- Base URL: `https://api.fireworks.ai/inference/v1`
- Model ID format: `accounts/fireworks/models/[model]`
- Benefits: <1s cold starts, pay per token only
- API key link provided

### 4. Updated Header & Messaging

**Before:**
```
Add Model
Choose from templates or create a custom model configuration
```

**After:**
```
Add Custom Model
Add your own custom models (HuggingFace, local servers, Azure, etc.)
💡 OpenAI and Anthropic models are already available to all users
```

### 5. Info Banner

Added blue info box at top of form:

```
📋 About Custom Models

Already Available: OpenAI (GPT-4.1, GPT-5 variants, o3-pro) and
Anthropic (Claude Opus/Sonnet/Haiku) models are available to all users.

Add Custom Models: Use this form to connect your own models via
HuggingFace, local servers (vLLM/Ollama), Azure, RunPod, or Fireworks.ai
```

### 6. Default Provider Changed

**Before:** Default to `openai`
**After:** Default to `huggingface`

Reasoning: HuggingFace is the most common use case for adding custom models (fine-tuned models, models from HF Hub).

## User Experience Flow

### Before
1. User clicks "Add Model"
2. Sees two tabs: Templates (19 options) vs Manual
3. Confused which to use
4. If Templates → sees OpenAI/Anthropic options (redundant)
5. If Manual → no guidance on what providers mean

### After
1. User clicks "Add Model"
2. Immediately sees clear message: flagship models already available
3. Single clean form with 6 relevant providers
4. Select provider → contextual helper appears with exact setup instructions
5. Fill in details with provider-specific placeholders and hints
6. Test connection and create model

## Visual Design

### Color-Coded Helpers
- **Yellow** - HuggingFace (brand color)
- **Green** - Ollama (friendly, local)
- **Indigo** - vLLM (high-performance)
- **Blue** - Azure (enterprise cloud)
- **Purple** - RunPod (cloud infrastructure)
- **Orange** - Fireworks (fast, fiery)

### Code Formatting
- Inline `<code>` blocks for technical values
- Consistent spacing and layout
- External links open in new tabs
- Examples provided for complex formats

## Technical Changes

### Files Modified
- `components/models/AddModelDialog.tsx`

### Lines Changed
- Commented out: ~60 lines (templates tab, template components)
- Updated: ~30 lines (providers, defaults, headers)
- Added: ~120 lines (6 provider helper boxes)

### Breaking Changes
**None** - This is purely a UI/UX improvement. The backend API and data models remain unchanged.

### Backward Compatibility
- Existing models continue to work
- Template-created models still valid
- All API endpoints unchanged

## Testing Checklist

- [ ] Open Add Model dialog
- [ ] Verify no templates tab visible
- [ ] Verify header shows "Add Custom Model" with info about global models
- [ ] Verify provider dropdown shows 6 providers (no OpenAI/Anthropic)
- [ ] Select each provider and verify helper box appears:
  - [ ] HuggingFace (yellow)
  - [ ] Ollama (green)
  - [ ] vLLM (indigo)
  - [ ] Azure (blue)
  - [ ] RunPod (purple)
  - [ ] Fireworks (orange)
- [ ] Verify external links work
- [ ] Test model creation flow for at least 2 providers
- [ ] Verify form validation still works
- [ ] Test connection feature still works

## Future Improvements

1. **Provider Auto-Detection**
   - Auto-fill base URL when provider selected
   - Smart defaults for common configurations

2. **Model Discovery**
   - Browse HuggingFace models directly in UI
   - Import from Ollama registry
   - Search RunPod templates

3. **Connection Wizard**
   - Step-by-step guided setup for each provider
   - Auto-test during configuration
   - Save credentials securely

4. **Model Recommendations**
   - Suggest models based on use case
   - Show popular models per provider
   - Community ratings/reviews

## Metrics to Track

- **Reduction in support questions** about which models to add
- **Increase in custom model additions** (clearer UX)
- **Provider distribution** - which providers are most used
- **Success rate** of model creation (should increase with better guidance)

## Commit

**Hash:** `42196e2`
**Message:** `feat: simplify model addition UX - remove templates, focus on custom models`
**Date:** 2026-01-03
