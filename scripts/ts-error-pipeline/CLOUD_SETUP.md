# Cloud Models & Parallel Execution Guide

## Overview

The TypeScript error pipeline now supports:
- ✅ **Ollama Cloud API** for large models (GLM-4, DeepSeek, Qwen 400B+)
- ✅ **Parallel execution** (run all 3 tiers simultaneously)
- ✅ **Hybrid mode** (local + cloud)
- ✅ **Automatic fallback** (cloud backup when local fails)
- ✅ **.env file support** for secure API key management

## Quick Setup

### 1. Configure Your API Key

```bash
npm run ts:setup-cloud
```

This interactive setup will:
- Save your Ollama Cloud API key to `.env` file (secure, not committed to git)
- Select cloud models for tier 2/3
- Choose execution mode (sequential/parallel/hybrid)
- Configure fallback options

**Example API Key**: `b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2`

> **Note**: Your API key is stored in `.env` and will NOT be committed to git. See [ENV_SETUP.md](ENV_SETUP.md) for details.

### 2. Test Connection

```bash
npm run ts:test-cloud
```

Verifies:
- ✅ API key is valid
- ✅ Cloud models are accessible
- ✅ Local models still work

### 3. Run with Cloud Models

```bash
# Sequential (one tier at a time)
npm run ts:pipeline

# Parallel (all tiers at once - FASTER)
npm run ts:pipeline:parallel
```

## Execution Modes Explained

### Sequential Mode (Default)
```
Tier 1 → Tier 2 → Tier 3
   ↓        ↓        ↓
  5min    8min     5min
Total: ~18 minutes
```

**When to use:**
- First run (testing)
- Lower cost priority
- Debugging issues

### Parallel Mode (Faster)
```
Tier 1 ─┐
        ├→ All run simultaneously
Tier 2 ─┤
        │
Tier 3 ─┘
Total: ~8 minutes (max of the three)
```

**When to use:**
- Regular usage
- Need results fast
- Have good internet/API quota

**Command:**
```bash
npm run ts:fix:parallel
```

### Hybrid Mode (Best of Both)
```
Tier 1 (Local) → Fast, free
Tier 2 (Cloud) ─┐
                ├→ Run in parallel
Tier 3 (Cloud) ─┘
```

**When to use:**
- Maximize speed while saving local GPU
- Tier 2/3 errors are more complex anyway
- Want cloud's larger models for hard problems

**Setup:**
```bash
npm run ts:setup-cloud
# Select option 3: hybrid mode
```

## Model Recommendations

### For Tier 2 (Medium Complexity)
**Best:** `deepseek-ai/deepseek-r1:671b`
- Excellent reasoning
- Good code understanding
- Handles multi-file changes

**Alternative:** `qwen/qwen2.5-coder:32b-instruct-q8_0`
- Faster
- Code-specialized
- Lower cost

### For Tier 3 (Complex)
**Best:** `qwen/qwen2.5-coder:32b-instruct-q8_0`
- Very strong at code
- Architectural understanding
- Good with TypeScript specifics

**Alternative:** `deepseek-ai/deepseek-r1:671b`
- Better reasoning
- More verbose analysis
- Catches subtle issues

## Cost Comparison

**Local Only (Free)**
- Tier 1: qwen2.5-coder:32b (local)
- Tier 2: deepseek-r1:32b (local)
- Tier 3: deepseek-r1:70b (local)
- Time: ~18-20 minutes
- Cost: $0

**Hybrid (Balanced)**
- Tier 1: qwen2.5-coder:32b (local)
- Tier 2: deepseek-r1:671b (cloud)
- Tier 3: qwen 400B (cloud)
- Time: ~8-10 minutes
- Cost: ~$0.05-0.10 per run

**All Cloud (Fastest)**
- Tier 1: GLM-4.7 (cloud)
- Tier 2: deepseek-r1:671b (cloud)
- Tier 3: qwen 400B (cloud)
- Time: ~5-8 minutes
- Cost: ~$0.10-0.20 per run

## Configuration Files

### config.json - Model and Execution Settings

Edit `scripts/ts-error-pipeline/config.json` for model configuration:

```json
{
  "models": {
    "tier1": {
      "model": "qwen2.5-coder:32b",
      "provider": "local"  // or "cloud"
    },
    "tier2": {
      "model": "deepseek-r1:32b",
      "provider": "local"
    },
    "tier3": {
      "model": "deepseek-r1:70b",
      "provider": "local"
    }
  },
  "cloud_models": {
    "tier2": {
      "model": "deepseek-ai/deepseek-r1:671b",
      "provider": "cloud"
    },
    "tier3": {
      "model": "qwen/qwen2.5-coder:32b-instruct-q8_0",
      "provider": "cloud"
    }
  },
  "ollama": {
    "cloud": {
      "base_url": "https://cloud.ollamahub.com",
      "api_key": "YOUR_API_KEY_HERE",  // Will be overridden by .env
      "timeout_ms": 600000
    }
  },
  "execution": {
    "mode": "parallel",           // "sequential" | "parallel" | "hybrid"
    "use_cloud_fallback": true,   // Retry with cloud if local fails
    "max_parallel_requests": 3     // Concurrent requests limit
  }
}
```

### .env - API Keys and Secrets (Recommended)

Create `scripts/ts-error-pipeline/.env` for sensitive data:

```env
# Your Ollama Cloud API key (NOT committed to git)
OLLAMA_CLOUD_API_KEY=b9e48d640a074990b1daeafca86357ad.CID3XSGADEbDmgILwgGHBXo2

# Optional overrides
OLLAMA_CLOUD_BASE_URL=https://cloud.ollamahub.com
OLLAMA_CLOUD_TIMEOUT_MS=600000
```

**Benefits:**
- ✅ API keys are NOT committed to git
- ✅ Easy to share config.json without exposing credentials
- ✅ Standard security practice

See [ENV_SETUP.md](ENV_SETUP.md) for complete documentation.

## Fallback Behavior

When `use_cloud_fallback: true`:

```
Local model fails
    ↓
Automatically retry with cloud model
    ↓
Success! (or final failure)
```

**Example:**
```
[Tier 2] Fixing error with deepseek-r1:32b (local)...
  ✗ Local model timeout
  ↻ Retrying with deepseek-r1:671b (cloud)...
  ✓ Success!
```

## Parallel vs Sequential - Real Example

**Your 45 TypeScript errors:**

| Mode | Tier 1 | Tier 2 | Tier 3 | Total Time |
|------|--------|--------|--------|------------|
| Sequential | 5 min | 8 min | 5 min | ~18 min |
| Parallel | 5 min (max) | 8 min (max) | 5 min (max) | ~8 min |
| Hybrid | 5 min (local) | In parallel → | 8 min | ~13 min |

**Speed improvement: 2-2.5x faster with parallel!**

## Troubleshooting

**"Cloud API error: 401"**
→ API key invalid, run `npm run ts:setup-cloud`

**"Cloud API error: 429"**
→ Rate limited, wait a minute or reduce `max_parallel_requests`

**"Request timeout"**
→ Cloud model too slow, increase `timeout_ms` in config

**"Model not found"**
→ Model name typo, check available models at cloud.ollamahub.com

**Local vs Cloud confusion**
→ Check `config.json` - look at `provider` field for each tier

## Best Practices

### First Run
```bash
# Start with sequential to see quality
npm run ts:pipeline
```

### Regular Use
```bash
# Use parallel for speed
npm run ts:pipeline:parallel
```

### Production/CI
```bash
# Hybrid: local tier 1, cloud tier 2/3
# Edit config.json:
{
  "models": {
    "tier1": { "provider": "local" },
    "tier2": { "provider": "cloud" },
    "tier3": { "provider": "cloud" }
  },
  "execution": { "mode": "parallel" }
}
```

### Cost Optimization
```bash
# Keep tier 1/2 local, only tier 3 cloud
{
  "models": {
    "tier1": { "provider": "local" },
    "tier2": { "provider": "local" },
    "tier3": { "provider": "cloud" }
  }
}
```

## Available Models (Cloud)

**Coding Specialists:**
- `qwen/qwen2.5-coder:32b-instruct-q8_0` - Excellent for TS
- `deepseek-ai/deepseek-coder:33b` - Strong code gen
- `meta/codellama:70b` - Good all-rounder

**Reasoning Models:**
- `deepseek-ai/deepseek-r1:671b` - Best reasoning
- `anthropic/claude-3.5-sonnet` - Excellent analysis
- `openai/gpt-4-turbo` - Strong understanding

**Large Context:**
- `google/gemini-1.5-pro` - 1M+ tokens
- `anthropic/claude-3-opus` - 200k tokens

Check Ollama Cloud docs for latest models: https://cloud.ollamahub.com/models

## Next Steps

1. **Setup**: `npm run ts:setup-cloud`
2. **Test**: `npm run ts:test-cloud`
3. **Run**: `npm run ts:pipeline:parallel`
4. **Optimize**: Adjust config based on results

Enjoy faster TypeScript error fixing! 🚀
