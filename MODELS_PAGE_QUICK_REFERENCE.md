# Models Page - Quick Reference Guide

**Date:** December 1, 2025  
**File Location:** `/home/juan-canfield/Desktop/web-ui/MODELS_PAGE_WALKTHROUGH.md`

## 📍 What Is This?

A complete beginner-friendly guide to the **Models Page** in FineTune Lab - where you manage, deploy, and test LLM models.

---

## 🎯 What You Can Do Here

| Action | Who Can Do It | Purpose |
|--------|---------------|---------|
| **View Models** | Everyone (if logged in) | See all available models |
| **Search Models** | Everyone | Find models by name |
| **Filter Models** | Everyone | Filter by provider or ownership |
| **Add Custom Model** | Authenticated users | Register new models to system |
| **Edit Model** | Model owner | Update settings (API key, temperature, etc.) |
| **Delete Model** | Model owner | Remove a model from system |
| **Deploy Model** | Model owner | Start inference server (vLLM/Ollama) |
| **Stop Server** | Model owner | Shut down running inference server |

---

## 🏗️ Page Structure

```
┌─────────────────────────────────────────────┐
│ HEADER: "Model Management"                  │
│ Description: Manage LLM models...           │
├─────────────────────────────────────────────┤
│                                             │
│ 🔍 SEARCH BAR                               │
│ Model name search (case-insensitive)        │
│                                             │
│ 📊 FILTERS                                  │
│ Provider: [All Providers ▼]                 │
│ Ownership: [All Models ▼]                   │
│ Count: Showing 4 of 12 models               │
│ [➕ Add Model] Button                       │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│ 📋 MODEL CARDS (List of models)             │
│                                             │
│ Each card shows:                            │
│ • Name & Provider                           │
│ • Capabilities (⚡ Streaming, 🛠️ Tools)   │
│ • Token limits                              │
│ • Settings (temperature, top-p)             │
│ • Ownership (🌐 Global or 👤 Personal)     │
│ • Server status (🟢 Running or ⚫ Stopped)  │
│ • Action buttons (Edit, Delete, Deploy)     │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔑 Key Concepts

### Global Models 🌐
- Pre-configured by the system
- Available to all users
- Cannot edit or delete
- Example: GPT-4, Claude, Gemini

### Personal Models 👤
- Created or configured by you
- Only visible to you
- Full edit/delete permissions
- Can be fine-tuned or custom API models

### Model Providers
- **openai** - OpenAI (GPT models)
- **anthropic** - Anthropic (Claude)
- **google** - Google (Gemini)
- **vllm** - vLLM inference engine
- **ollama** - Ollama local models
- **local** - Other local models

### Server Status
- 🟢 **Running** - Server is active, ready for inference
- 🟡 **Starting** - Server is initializing
- ⚫ **Stopped/Not Deployed** - Server not running
- 🔴 **Error** - Server encountered an error

---

## ⚡ Quick Workflows

### Add a New Model (2 minutes)

```
1. Click [➕ Add Model] button
2. Fill form:
   • Name: Your model name
   • Provider: openai, anthropic, google, vllm, ollama, local
   • Model ID: Provider's model identifier
   • (Optional) API Key, context length, temperature defaults
3. Click [Add Model]
4. ✓ Model appears in list
```

### Edit a Model (1 minute)

```
1. Find your model in the list
2. Click [Edit] button (only visible for your models)
3. Change desired fields
4. Click [Update Model]
5. ✓ Changes saved
```

### Delete a Model (1 minute)

```
1. Find your model in the list
2. Click [Delete/Trash] button
3. Confirm deletion
4. ✓ Model removed
```

### Deploy to vLLM (5 minutes)

```
1. Model must be type: vllm, ollama, or local
2. Click [🚀 Deploy] button
3. Set options:
   • Server Type: vllm or ollama
   • GPU Memory: 0.8 (80% GPU usage)
   • Max Length: 8192 (max prompt size)
4. Click [Deploy Server]
5. ⏳ Server starting... 🟡
6. ✓ Server running 🟢
7. Use in Chat page!
```

### Stop a Running Server (1 minute)

```
1. Find model with running server (🟢 Running)
2. Click [⬛ Stop Server] button
3. ✓ Server stops, frees GPU memory
```

### Search for a Model (30 seconds)

```
1. Type model name in search bar
2. Results update automatically
3. Or use Provider and Ownership filters
```

---

## 📊 Form Fields Explained

When adding/editing a model, you might see:

| Field | Required? | Example | Notes |
|-------|-----------|---------|-------|
| **Name** | ✓ | "GPT-4 Turbo" | Display name in list |
| **Provider** | ✓ | openai | Where model is hosted |
| **Model ID** | ✓ | gpt-4-turbo-preview | Provider's identifier |
| **API Key** | ✗ | sk-... | Leave blank for global key |
| **Context Length** | ✗ | 128000 | Max input tokens |
| **Max Output** | ✗ | 4096 | Max generation tokens |
| **Temperature** | ✗ | 0.7 | Randomness (0=boring, 2=crazy) |
| **Top-P** | ✗ | 1.0 | Nucleus sampling (0-1) |
| **Streaming** | ✗ | ✓ | Can stream responses? |
| **Tools** | ✗ | ✓ | Function calling support? |
| **Vision** | ✗ | ✓ | Can process images? |

---

## 🐛 Troubleshooting

### Models Not Loading?
```
✓ Check: Are you logged in?
✓ Check: Is your internet connected?
✓ Try: Refresh page (Ctrl+R)
✓ Try: Clear browser cache and cookies
```

### Can't Add Model?
```
✓ All required fields filled? (marked with *)
✓ Valid values? (temperature 0-2, top-p 0-1)
✓ Unique name? (no duplicates)
```

### Deploy Button Disabled?
```
✓ Is it your personal model?
✓ Is provider set to vllm, ollama, or local?
✓ Is server not already running?
```

### Server Won't Start?
```
✓ Try: Reduce gpu_memory_utilization to 0.6
✓ Try: Increase max_model_len
✓ Try: Check if GPU has space (nvidia-smi)
```

---

## 🔗 Related Pages

- **Chat** (`/chat`) - Use deployed models for conversations
- **Training** (`/training`) - Fine-tune models and deploy them
- **Settings** (`/settings`) - Configure global API keys
- **Inference Servers** (deployment management)

---

## 📚 Full Documentation

For detailed explanations, code examples, and advanced workflows, see:
**`MODELS_PAGE_WALKTHROUGH.md`** (3000+ lines)

Covers:
- Complete user journey
- Every workflow step-by-step
- API endpoints and data structures
- Code examples and debugging
- End-to-end scenarios

---

## 🎓 For New Users

**Typical First Day:**
1. ✅ Log in
2. ✅ View pre-configured global models
3. ✅ Try searching/filtering
4. ✅ Add a custom OpenAI model (if you have API key)
5. ✅ Deploy a model to vLLM
6. ✅ Test in Chat page

**Typical Daily Use:**
```
Morning:
→ Check models page to see what's available
→ Deploy specific model for today's work

During Day:
→ Use model in Chat page for testing
→ Monitor server performance

End of Day:
→ Stop server to free resources
```

---

## ✨ Pro Tips

1. **Use meaningful names** - "Claude-Customer-Service" vs "Model2"
2. **Set sensible defaults** - Most users like temperature 0.7
3. **Enable streaming** - Faster perceived response time
4. **Test in Chat** - Before using in batch operations
5. **Stop servers** - When not using, saves GPU memory
6. **Check status** - 🟢 running vs ⚫ stopped at a glance

---

**Quick Links:**
- Full Guide: `/home/juan-canfield/Desktop/web-ui/MODELS_PAGE_WALKTHROUGH.md`
- Training Guide: `/home/juan-canfield/Desktop/web-ui/CLOUD_TRAINING_DEPLOYMENT_WORKFLOW.md`

**Last Updated:** December 1, 2025
