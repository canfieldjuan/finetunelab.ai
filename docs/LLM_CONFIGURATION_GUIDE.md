# LLM Configuration Guide

**Date:** October 12, 2025
**Status:** Current (Unified Configuration)
**Version:** 2.0

---

## Overview

This guide covers configuration for all supported LLM providers:

- OpenAI (GPT-4, GPT-4o, GPT-4o-mini)
- Anthropic (Claude 3.5 Sonnet)
- Ollama (Local LLMs)

**Configuration Method:** Environment variables in `.env` file
**Previous Method:** YAML files (deprecated as of October 12, 2025)

---

## Quick Start

### 1. Set Your Provider

Edit `/web-ui/.env` and set the provider you want to use:

```bash
# Options: 'openai', 'anthropic', 'ollama'
LLM_PROVIDER=openai
```

### 2. Configure Your Chosen Provider

Add the appropriate API key and settings below.

---

## OpenAI Configuration

### Required Variables

```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

**Get your API key:** <https://platform.openai.com/api-keys>

### Optional Variables

```bash
# Model selection
OPENAI_MODEL=gpt-4o-mini
# Options: gpt-4o-mini (default), gpt-4o, gpt-4-turbo, gpt-3.5-turbo

# Temperature (creativity)
OPENAI_TEMPERATURE=0.7
# Range: 0.0 to 2.0
# Lower = more focused, Higher = more creative

# Max tokens (response length)
OPENAI_MAX_TOKENS=2000
# Default: 2000, Max depends on model

# Streaming responses
OPENAI_STREAM=true
# Default: true, Set to false for non-streaming
```

### Example Configuration

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-abc123...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true
```

---

## Anthropic Configuration

### Required Variables

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Get your API key:** <https://console.anthropic.com/account/keys>

### Optional Variables

```bash
# Model selection
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
# Options: claude-3-5-sonnet-20241022 (default), claude-3-opus, claude-3-sonnet

# Temperature (creativity)
ANTHROPIC_TEMPERATURE=0.7
# Range: 0.0 to 1.0
# Lower = more focused, Higher = more creative

# Max tokens (response length)
ANTHROPIC_MAX_TOKENS=2000
# Default: 2000, Max: 4096 for most models

# Streaming responses
ANTHROPIC_STREAM=true
# Default: true, Set to false for non-streaming
```

### Example Configuration

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xyz789...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_STREAM=true
```

---

## Ollama Configuration (Local LLMs)

### Prerequisites

1. Install Ollama: <https://ollama.ai/>
2. Pull a model: `ollama pull llama3.1`
3. Start Ollama service: `ollama serve`

### Required Variables

No API key needed for local Ollama!

### Optional Variables

```bash
# Ollama server URL
OLLAMA_BASE_URL=http://localhost:11434
# Default: http://localhost:11434

# Model selection
OLLAMA_MODEL=llama3.1
# Options: Any model you've pulled with ollama

# Temperature (creativity)
OLLAMA_TEMPERATURE=0.7
# Range: 0.0 to 2.0

# Streaming responses
OLLAMA_STREAM=true
# Default: true
```

### Example Configuration

```bash
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_TEMPERATURE=0.7
OLLAMA_STREAM=true
```

---

## Switching Providers

To switch between providers, simply change the `LLM_PROVIDER` variable:

```bash
# Use OpenAI
LLM_PROVIDER=openai

# Use Anthropic
LLM_PROVIDER=anthropic

# Use Ollama
LLM_PROVIDER=ollama
```

**Important:** Restart the dev server after changing providers:

```bash
npm run dev
```

---

## Troubleshooting

### Issue: "Missing required environment variable"

**Symptom:** Error message about missing API key or other variable

**Solution:**

1. Check `.env` file exists in `/web-ui` directory
2. Verify variable name matches exactly (case-sensitive)
3. Restart dev server after adding variables
4. Ensure no typos in variable names

**Example:**

```bash
# Wrong
OPEN_AI_API_KEY=...

# Correct
OPENAI_API_KEY=...
```

### Issue: Chat not responding or infinite loading

**Symptom:** Messages sent but no response received

**Solutions:**

1. **Check API key validity**
   - OpenAI: Visit <https://platform.openai.com/api-keys>
   - Anthropic: Visit <https://console.anthropic.com/account/keys>
   - Test key in their web dashboard first

2. **Verify account status**
   - Check if API key has credits/quota remaining
   - Ensure account is in good standing

3. **Check console for errors**
   - Open browser console (F12)
   - Look for error messages
   - Check terminal where dev server is running

4. **Verify environment**
   - Run: `echo $LLM_PROVIDER` (should show your provider)
   - Restart dev server after .env changes

### Issue: Wrong model being used

**Symptom:** Responses seem different than expected model

**Solution:**

1. Check `LLM_PROVIDER` matches your intended provider
2. Verify model name is correct for that provider
3. Restart dev server after changes
4. Check console logs for actual model being used

### Issue: Ollama connection refused

**Symptom:** Error connecting to Ollama server

**Solution:**

1. Verify Ollama is running: `ollama serve`
2. Check Ollama is accessible: `curl http://localhost:11434`
3. Verify `OLLAMA_BASE_URL` matches your Ollama installation
4. Ensure model is pulled: `ollama pull llama3.1`

### Issue: Rate limit errors

**Symptom:** "Rate limit exceeded" errors

**Solution:**

1. **OpenAI:** Check usage limits at <https://platform.openai.com/usage>
2. **Anthropic:** Check limits in console
3. Wait before retrying
4. Consider upgrading plan for higher limits

---

## Migration from YAML Configuration

If you're upgrading from the old YAML-based configuration:

### Step 1: Review Old Configuration

Check your old `config/llm.yaml`:

```yaml
provider: openai
openai:
  model: gpt-4o-mini
  temperature: 0.7
```

### Step 2: Add to .env File

Convert YAML values to environment variables in `.env`:

```bash
# Provider from yaml
LLM_PROVIDER=openai

# OpenAI settings from yaml
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true
```

### Step 3: Verify Migration

1. Backup old YAML file (already done automatically)
2. Restart dev server: `npm run dev`
3. Test chat functionality
4. Verify responses are working correctly

### Step 4: Cleanup (Optional)

The old `config/llm.yaml` file is no longer used but has been backed up to `config/llm.yaml.backup` for safety.

---

## Complete .env Example

Here's a complete example with all providers configured:

```bash
# ========================================
# LLM Configuration
# ========================================

# Active provider (change this to switch providers)
LLM_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000
OPENAI_STREAM=true

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-your-key-here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.7
ANTHROPIC_MAX_TOKENS=2000
ANTHROPIC_STREAM=true

# Ollama Configuration (Local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_TEMPERATURE=0.7
OLLAMA_STREAM=true
```

---

## Best Practices

1. **Never commit .env to git**
   - Already in .gitignore
   - Contains sensitive API keys

2. **Use different keys for dev/prod**
   - Create separate API keys for each environment
   - Easier to track usage and rotate keys

3. **Monitor usage**
   - OpenAI: <https://platform.openai.com/usage>
   - Anthropic: <https://console.anthropic.com/>

4. **Start with cheaper models**
   - gpt-4o-mini for development
   - Upgrade to gpt-4o when needed

5. **Test locally first**
   - Use Ollama for development
   - No API costs during testing

---

## Related Documentation

- **Implementation Details:** `LLM_CONFIG_UNIFICATION_COMPLETE.md`
- **Implementation Plan:** `LLM_CONFIG_UNIFICATION_PLAN.md`
- **Quick Setup:** `/OPENAI_SETUP.md`

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review implementation logs in `docs/`
3. Verify all environment variables are set correctly
4. Ensure dev server restarted after changes

---

**Last Updated:** October 12, 2025
**Configuration Version:** 2.0 (Environment Variables)
**Previous Version:** 1.0 (YAML - Deprecated)
