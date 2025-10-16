# OpenAI Configuration Update

**Date:** October 12, 2025
**Status:** ⚠️ SUPERSEDED - See LLM_CONFIG_UNIFICATION_COMPLETE.md
**Type:** Configuration Enhancement

> **Note:** This document describes the initial OpenAI-specific environment variable migration.
> It has been superseded by the unified LLM configuration system that supports OpenAI, Anthropic, and Ollama.
> See `LLM_CONFIG_UNIFICATION_COMPLETE.md` for the current configuration method.

---

## 🎯 **Objective**

Make OpenAI model and parameters configurable via environment variables instead of hardcoded values.

---

## 📋 **Changes Made**

### **1. Environment Variables Added (.env)**

Added three new configuration variables:

```properties
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
```

**Location:** `/web-ui/.env` (lines 7-9)

### **2. OpenAI Library Updated (openai.ts)**

**File:** `/web-ui/lib/llm/openai.ts`

**Changes:**

1. Added configuration constants (lines 10-12):

   ```typescript
   const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
   const DEFAULT_TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
   const DEFAULT_MAX_TOKENS = parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
   ```

2. Updated `streamOpenAIResponse()` function signature (line 37):

   ```typescript
   model: string = DEFAULT_MODEL,
   temperature: number = DEFAULT_TEMPERATURE,
   maxTokens: number = DEFAULT_MAX_TOKENS,
   ```

3. Updated `getOpenAIResponse()` function signature (line 70):

   ```typescript
   model: string = DEFAULT_MODEL,
   temperature: number = DEFAULT_TEMPERATURE,
   maxTokens: number = DEFAULT_MAX_TOKENS,
   ```

4. Updated `runOpenAIWithToolCalls()` function signature (line 93):

   ```typescript
   model: string = DEFAULT_MODEL,
   temperature: number = DEFAULT_TEMPERATURE,
   maxTokens: number = DEFAULT_MAX_TOKENS,
   ```

---

## ✅ **Verification**

- [x] TypeScript compilation successful (no errors)
- [x] All three functions updated consistently
- [x] Environment variables added to .env
- [x] Backward compatible (defaults provided if env vars missing)
- [x] Falls back to original hardcoded values if env vars not set

---

## 🎛️ **Usage**

### **Default Behavior (No Changes Required)**

If environment variables are not set, the system uses:

- Model: `gpt-4o-mini`
- Temperature: `0.7`
- Max Tokens: `2000`

### **Custom Configuration**

Update `.env` file to change defaults:

```properties
# Use GPT-4 Turbo instead
OPENAI_MODEL=gpt-4-turbo

# More creative responses
OPENAI_TEMPERATURE=0.9

# Longer responses
OPENAI_MAX_TOKENS=4000
```

### **Per-Call Override**

You can still override values per function call:

```typescript
// Use GPT-4 for this specific call
await getOpenAIResponse(messages, 'gpt-4');

// More deterministic response
await getOpenAIResponse(messages, undefined, 0.2);
```

---

## 🔧 **Technical Details**

### **Type Safety**

- `parseFloat()` used for temperature (supports decimals)
- `parseInt()` with base 10 used for max tokens (integers only)
- String values passed directly for model names
- All parameters have fallback defaults

### **Supported Models**

Any OpenAI model name can be used:

- `gpt-4o-mini` (default, fastest)
- `gpt-4o` (more capable)
- `gpt-4-turbo` (legacy)
- `gpt-4` (legacy)
- `gpt-3.5-turbo` (legacy)

### **Parameter Ranges**

- **Temperature:** 0.0 to 2.0 (0.7 recommended)
- **Max Tokens:** 1 to model's max (varies by model)

---

## 🚀 **Benefits**

1. **Flexibility:** Change model without code changes
2. **Environment-Specific:** Different models for dev/staging/prod
3. **Cost Control:** Use cheaper models in development
4. **Performance Tuning:** Adjust temperature and tokens per environment
5. **Backward Compatible:** No breaking changes to existing code

---

## 📝 **Testing Recommendations**

1. **Verify Default Behavior:**

   ```bash
   # Remove env vars temporarily
   unset OPENAI_MODEL OPENAI_TEMPERATURE OPENAI_MAX_TOKENS
   npm run dev
   # Should use gpt-4o-mini with default settings
   ```

2. **Test Custom Configuration:**

   ```bash
   # Set custom values
   export OPENAI_MODEL=gpt-4
   npm run dev
   # Should use GPT-4
   ```

3. **Test Runtime Override:**

   ```typescript
   // In your code
   const response = await getOpenAIResponse(messages, 'gpt-4-turbo');
   // Should use gpt-4-turbo regardless of env var
   ```

---

## 🔄 **Future Enhancements**

Potential additions:

- `OPENAI_FREQUENCY_PENALTY` env var
- `OPENAI_PRESENCE_PENALTY` env var
- `OPENAI_TOP_P` env var
- Model-specific configurations
- Automatic model selection based on query complexity

---

**✅ Implementation Complete - No Further Action Required**
