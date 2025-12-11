# Models Page Walkthrough - A Complete Guide for New Users

**Date:** December 1, 2025  
**Purpose:** Complete step-by-step guide for the Models page workflow  
**Audience:** New users, developers, dataset creators

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [User Journey](#user-journey)
3. [Page Layout](#page-layout)
4. [Core Workflows](#core-workflows)
5. [Model Types](#model-types)
6. [API Reference](#api-reference)
7. [Data Structures](#data-structures)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### What is the Models Page?

The **Models Page** is where you:

- ✅ View all available models on HuggingFace (global + your personal models)
- ✅ Add new custom models to the system
- ✅ Edit or delete your own models
- ✅ Test model connections
- ✅ Deploy models to inference servers (vLLM, Ollama)
- ✅ Monitor inference server status

### Getting There

```
1. Log in to FineTune Lab
2. Navigate to "Models" from the main menu
3. See all available models in a sortable list
```

### First Time Setup

When you first visit the Models page:

1. **Authentication Check** - System verifies you're logged in
2. **Models Load** - System fetches all available models
3. **Servers Check** - System checks status of any deployed inference servers
4. **Display** - Models are displayed with filtering options

---

## User Journey

### Step 1: Authentication

```
User clicks "Models" in navigation
         ↓
System checks if user is authenticated
         ↓
NOT AUTHENTICATED? → Redirect to login page
         ↓
AUTHENTICATED? → Continue to step 2
```

**Code Flow:**

```typescript
// Check authentication on page load
useEffect(() => {
  if (!authLoading && !user) {
    router.push('/login');  // Redirect if not logged in
  }
}, [user, authLoading, router]);
```

**What Happens:**

- User object is required from AuthContext
- Session access token is required for API calls
- If missing, user is redirected to `/login`

---

### Step 2: Data Loading

```
User is authenticated
         ↓
Page mounts and sets loading=true
         ↓
Fetch Models:
  GET /api/models
  Headers: Authorization: Bearer {access_token}
         ↓
Parse response and set models state
         ↓
Fetch Servers:
  GET /api/servers/status
  Headers: Authorization: Bearer {access_token}
         ↓
Match servers to models and create serverMap
         ↓
Set loading=false and display models
```

**API Call Sequence:**

```typescript
async function fetchModels() {
  setLoading(true);
  try {
    // Call 1: Get all models
    const response = await fetch('/api/models', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    const data = await response.json();
    setModels(data.models);  // Store models in state

    // Call 2: Get inference server status
    await fetchServers();
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}

async function fetchServers() {
  const response = await fetch('/api/servers/status', {
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  });
  const data = await response.json();
  
  // Create map: model_id → server_info
  // Prioritize running servers
  const serverMap = {};
  data.servers?.forEach(server => {
    if (server.model_id) {
      const existing = serverMap[server.model_id];
      if (!existing || server.status === 'running') {
        serverMap[server.model_id] = server;
      }
    }
  });
  setServers(serverMap);
}
```

---

### Step 3: Search and Filter

Once models are loaded, users can filter them:

```
┌─────────────────────────────────────────────┐
│ SEARCH: "GPT"          [Search Bar]         │
├─────────────────────────────────────────────┤
│ Provider: [All Providers ▼]                 │
│ Ownership: [All Models ▼]                   │
├─────────────────────────────────────────────┤
│ Showing 4 of 12 models     [+ Add Model]    │
└─────────────────────────────────────────────┘
```

**Filter Logic:**

```typescript
const filteredModels = models.filter(model => {
  // Filter 1: Search text
  if (searchQuery && !model.name.toLowerCase().includes(searchQuery.toLowerCase())) {
    return false;
  }

  // Filter 2: Provider
  if (providerFilter !== 'all' && model.provider !== providerFilter) {
    return false;
  }

  // Filter 3: Ownership
  if (ownershipFilter === 'global' && !model.is_global) {
    return false;
  }
  if (ownershipFilter === 'mine' && (model.is_global || model.user_id !== user?.id)) {
    return false;
  }

  return true;
});
```

**Available Filters:**

| Filter | Options | Behavior |
|--------|---------|----------|
| **Search** | Text input | Searches model name (case-insensitive) |
| **Provider** | All, openai, anthropic, google, local, vllm, ollama | Filters by provider type |
| **Ownership** | All Models, Global Only, My Models Only | Shows user's personal models or global |

---

## Page Layout

### The Models Page Structure

```
┌────────────────────────────────────────────────────────────┐
│ 📑 Model Management                                        │
│ Manage LLM models for your chat interface...              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Search: [Model name...                    ]              │
│                                                            │
│ 📊 Provider:  [All Providers    ▼]                       │
│ 👤 Ownership: [All Models       ▼]                       │
│    Showing X of Y models                  [➕ Add Model]  │
│                                                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌─ GPT-4 Turbo (OpenAI)                 [Edit] [Delete] │
│ │ • Streaming enabled ⚡                                 │
│ │ • Tool use enabled 🛠️                                 │
│ │ • Vision capable 👁️                                   │
│ │ Context: 128K tokens  |  Output: 4K tokens           │
│ │ Default Temp: 0.7     |  Top P: 1.0                  │
│ │                                                        │
│ │ 🌐 Global Model (Shared with all users)              │
│ └────────────────────────────────────────────────────────┘
│
│ ┌─ Claude 3 (Anthropic)                 [Edit] [Delete] │
│ │ • Streaming enabled ⚡                                 │
│ │ • Tool use enabled 🛠️                                 │
│ │ Context: 200K tokens  |  Output: 4K tokens           │
│ │ Status: 🟢 Running vLLM on port 8000                 │
│ │                                                        │
│ │ 👤 My Model (Personal)                [▬️ Stop Server] │
│ └────────────────────────────────────────────────────────┘
│
│ ┌─ Custom Qwen (local)                  [Edit] [Delete] │
│ │ • Streaming disabled                                  │
│ │ • Tool use disabled                                   │
│ │ Context: 32K tokens   |  Output: 2K tokens           │
│ │ Status: ⚫ Not deployed                               │
│ │                                                        │
│ │ 👤 My Model (Personal)                [🚀 Deploy]     │
│ └────────────────────────────────────────────────────────┘
│
└────────────────────────────────────────────────────────────┘
```

### ModelCard Component

Each model is displayed as a **ModelCard** showing:

| Element | Shows | Purpose |
|---------|-------|---------|
| **Name** | Model display name | Identify the model |
| **Provider Badge** | openai, anthropic, google, local, vllm, ollama | Know the API provider |
| **Capability Icons** | ⚡ Streaming, 🛠️ Tools, 👁️ Vision | Quick capability check |
| **Context Info** | Input/output token limits | Understand capacity |
| **Settings** | Temperature, Top-P defaults | See generation defaults |
| **Ownership** | 🌐 Global or 👤 My Model | Know who owns it |
| **Server Status** | Running, Stopped, or Not deployed | Current deployment state |
| **Actions** | Edit, Delete, Deploy/Stop | What you can do |

---

## Core Workflows

### Workflow 1: Adding a New Model

#### Scenario

You want to add a fine-tuned model or a custom API model to the system.

#### Steps

**Step 1: Click "Add Model" Button**

```
Visible at top-right of page
Opens: AddModelDialog
```

**Step 2: Fill in Model Details**

```
Form Fields:

1. Model Name*
   Input: "My GPT-4 Fine-tuned"
   Description: Display name for the model

2. Provider*
   Select: openai | anthropic | google | local | vllm | ollama
   Description: Where the model is hosted

3. Model ID*
   Input: "gpt-4-turbo-preview" (or "llama-2-7b" for local)
   Description: Provider's model identifier

4. API Key (Optional)
   Input: [Encrypted field]
   Description: Leave empty to use global key, or provide custom

5. Context Length (Optional)
   Input: "128000"
   Default: 4096
   Description: Max input tokens

6. Max Output Tokens (Optional)
   Input: "4096"
   Default: 2048
   Description: Max generation tokens

7. Default Temperature (Optional)
   Input: "0.7" (0.0 - 2.0)
   Default: 1.0
   Description: Randomness in responses

8. Default Top-P (Optional)
   Input: "1.0" (0.0 - 1.0)
   Default: 1.0
   Description: Nucleus sampling threshold

9. Enable Streaming
   Checkbox: ✓
   Description: Model supports streaming responses

10. Enable Tools
    Checkbox: ✓
    Description: Model supports function calling

11. Enable Vision
    Checkbox: ✗
    Description: Model can process images
```

**Step 3: Submit Form**

```
Click "Add Model" button
         ↓
POST /api/models
Headers: Authorization: Bearer {access_token}
Body: CreateModelDTO {
  name: string,
  provider: string,
  model_id: string,
  api_key_encrypted?: string,
  context_length?: number,
  max_output_tokens?: number,
  default_temperature?: number,
  default_top_p?: number,
  supports_streaming?: boolean,
  supports_tools?: boolean,
  supports_vision?: boolean
}
         ↓
Server validates data
         ↓
Server encrypts API key if provided
         ↓
Server stores in database
         ↓
Success: Show toast "Model added successfully"
         ↓
Refresh models list (fetchModels())
         ↓
New model appears in list
```

**Code Example:**

```typescript
// In AddModelDialog
const handleAddModel = async (formData) => {
  try {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.name,
        provider: formData.provider,
        model_id: formData.model_id,
        api_key_encrypted: formData.apiKey,  // Will be encrypted on backend
        context_length: formData.contextLength,
        max_output_tokens: formData.maxOutputTokens,
        default_temperature: formData.temperature,
        default_top_p: formData.topP,
        supports_streaming: formData.streaming,
        supports_tools: formData.tools,
        supports_vision: formData.vision,
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    const result = await response.json();
    toast.success('Model added successfully');
    onSuccess();  // Closes dialog and refreshes
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

### Workflow 2: Editing a Model

#### Scenario

You want to update a model's configuration (API key, temperature defaults, etc.)

#### Steps

**Step 1: Click Edit Button on Model Card**

```
Only visible for your personal models (👤 My Model)
Click [Edit] button
         ↓
Opens: EditModelDialog with current values
```

**Step 2: Update Fields**

```
Same form as "Add Model" but pre-filled
You can change any field:
- Name
- API key
- Context length
- Temperature/Top-P defaults
- Capability flags
```

**Step 3: Submit Changes**

```
Click "Update Model" button
         ↓
PATCH /api/models/{model_id}
Headers: Authorization: Bearer {access_token}
Body: Updated fields
         ↓
Server validates changes
         ↓
Server updates database record
         ↓
Success: Show toast "Model updated"
         ↓
Refresh models list
         ↓
Model card shows new values
```

---

### Workflow 3: Deleting a Model

#### Scenario

You no longer need a custom model and want to remove it.

#### Steps

**Step 1: Click Delete Button**

```
Only visible for your personal models
Click [Delete] icon (trash)
         ↓
Show confirmation dialog
```

**Step 2: Confirm Deletion**

```
Dialog: "Are you sure you want to delete this model?"
        [Cancel]  [Delete]
         ↓
Click "Delete" to confirm
```

**Step 3: Delete Process**

```
DELETE /api/models/{model_id}
Headers: Authorization: Bearer {access_token}
         ↓
Server removes from database
         ↓
Success: Show toast "Model deleted"
         ↓
Remove from local models state
         ↓
Model disappears from list immediately
```

**Code Example:**

```typescript
async function handleDeleteModel(model: LLMModelDisplay) {
  try {
    const response = await fetch(`/api/models/${model.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error);
    }

    // Remove from local state immediately
    setModels(prev => prev.filter(m => m.id !== model.id));
    
    toast.success('Model deleted successfully');
  } catch (error) {
    toast.error(error.message);
  }
}
```

---

### Workflow 4: Deploying a Model to vLLM/Ollama

#### Scenario

You trained a custom model and want to deploy it for inference testing.

#### Steps

**Step 1: Model Must Be Eligible**

```
Model requirements:
✓ Is your personal model (👤 My Model)
✓ Provider is "vllm", "ollama", or "local"
✓ Not already deployed

If not eligible: Deploy button is disabled
```

**Step 2: Click "Deploy" or "Start Server" Button**

```
Click blue deploy button on model card
         ↓
Opens deployment configuration dialog
```

**Step 3: Configure Deployment**

```
Deployment Options:

1. Server Type*
   Select: vllm | ollama
   Description: Which inference engine to use

2. GPU Memory Utilization (vLLM)
   Slider: 0.0 - 1.0 (default: 0.8)
   Description: How much GPU VRAM to use

3. Max Model Length (vLLM)
   Input: "8192" (max sequence length)
   Description: Maximum prompt + generation length

4. Tensor Parallel Size (vLLM)
   Input: "1" (number of GPUs)
   Description: For multi-GPU inference

5. Data Type (vLLM)
   Select: auto | float16 | bfloat16 | float32
   Description: Precision for computation

6. Trust Remote Code
   Checkbox: ✗
   Description: Allow loading custom modeling code
```

**Step 4: Submit**

```
Click "Deploy Server" button
         ↓
POST /api/training/deploy
Headers: Authorization: Bearer {access_token}
Body: {
  job_id: null,  // No training job, just model deployment
  server_type: "vllm",
  checkpoint_path: model.path,
  name: model.name,
  config: {
    gpu_memory_utilization: 0.8,
    max_model_len: 8192,
    tensor_parallel_size: 1
  }
}
         ↓
Backend starts inference server
         ↓
Server status updates to "starting"
         ↓
Server status changes to "running"
         ↓
Show toast with server URL
```

**Step 5: Server Deployed**

```
Model card now shows:
- Server status badge: 🟢 Running
- Server port: 8000 (or dynamic)
- Test URL: http://localhost:8000/v1/chat/completions
- Stop Server button (instead of Deploy)
```

---

### Workflow 5: Stopping a Deployed Server

#### Scenario

You want to stop a running inference server to free GPU memory.

#### Steps

**Step 1: Click "Stop Server" Button**

```
Only visible if server is running
Click [⬛ Stop Server] button
```

**Step 2: Stop Process**

```
POST /api/servers/stop
Headers: Authorization: Bearer {access_token}
Body: { server_id: "server_123" }
         ↓
Backend sends SIGTERM to server process
         ↓
Server gracefully shuts down
         ↓
Status updates to "stopped"
         ↓
Show toast "Server stopped"
         ↓
Model card refreshes
```

**Step 3: Server Stopped**

```
Model card now shows:
- Server status badge: ⚫ Not Deployed
- Deploy button reappears
```

---

## Model Types

### Global Models

```
🌐 GLOBAL MODELS (Pre-configured by system)

These are available to all users without setup:

OpenAI
├─ GPT-4 Turbo
├─ GPT-4
└─ GPT-3.5 Turbo

Anthropic
├─ Claude 3 Opus
├─ Claude 3 Sonnet
└─ Claude 3 Haiku

Google
├─ Gemini Pro
├─ Gemini Pro Vision
└─ PaLM 2

Properties:
- ✓ Read-only (no edit/delete)
- ✓ Shared with all users
- ✓ Pre-configured with correct settings
- ✓ Require API keys in settings (global configuration)
```

### User Models

```
👤 USER MODELS (Your personal models)

Models you've created, fine-tuned, or configured:

Fine-Tuned Models
├─ My Qwen Fine-Tuned
├─ My Llama Chat Bot
└─ Custom Domain Model

Custom API Models
├─ My OpenAI Instance (different key)
├─ Custom Claude Setup
└─ Internal API Model

Local Models
├─ vLLM Deployment
├─ Ollama Running
└─ Local GGUF Model

Properties:
- ✓ Full edit/delete permissions
- ✓ Personal (only visible to you)
- ✓ Can be deployed to inference servers
- ✓ Can use custom API keys
```

---

## API Reference

### GET /api/models - List Models

**Purpose:** Retrieve all available models

**Request:**

```bash
curl -X GET https://your-app.com/api/models \
  -H "Authorization: Bearer {access_token}"
```

**Response:**

```json
{
  "success": true,
  "count": 12,
  "models": [
    {
      "id": "model_123",
      "name": "GPT-4 Turbo",
      "provider": "openai",
      "model_id": "gpt-4-turbo-preview",
      "context_length": 128000,
      "max_output_tokens": 4096,
      "default_temperature": 0.7,
      "default_top_p": 1.0,
      "supports_streaming": true,
      "supports_tools": true,
      "supports_vision": true,
      "is_global": true,
      "user_id": null,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /api/models - Create Model

**Purpose:** Register a new custom model

**Request:**

```bash
curl -X POST https://your-app.com/api/models \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Model",
    "provider": "openai",
    "model_id": "gpt-4-turbo-preview",
    "context_length": 128000,
    "max_output_tokens": 4096,
    "default_temperature": 0.7,
    "default_top_p": 1.0,
    "supports_streaming": true,
    "supports_tools": true,
    "supports_vision": true
  }'
```

**Response:**

```json
{
  "success": true,
  "model": { ... model object ... }
}
```

---

### PATCH /api/models/{model_id} - Update Model

**Purpose:** Update model configuration

**Request:**

```bash
curl -X PATCH https://your-app.com/api/models/model_123 \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "default_temperature": 0.5,
    "default_top_p": 0.9
  }'
```

---

### DELETE /api/models/{model_id} - Delete Model

**Purpose:** Remove a personal model

**Request:**

```bash
curl -X DELETE https://your-app.com/api/models/model_123 \
  -H "Authorization: Bearer {access_token}"
```

**Response:**

```json
{
  "success": true,
  "message": "Model deleted successfully"
}
```

---

### GET /api/servers/status - Get Server Status

**Purpose:** Check status of deployed inference servers

**Request:**

```bash
curl -X GET https://your-app.com/api/servers/status \
  -H "Authorization: Bearer {access_token}"
```

**Response:**

```json
{
  "success": true,
  "servers": [
    {
      "id": "server_123",
      "model_id": "model_456",
      "model_name": "My Qwen",
      "server_type": "vllm",
      "status": "running",
      "port": 8000,
      "url": "http://localhost:8000",
      "started_at": "2025-12-01T10:30:00Z",
      "uptime_seconds": 3600
    }
  ]
}
```

---

## Data Structures

### LLMModelDisplay Type

```typescript
interface LLMModelDisplay {
  id: string;                    // Unique model ID
  name: string;                  // Display name
  provider: string;              // openai, anthropic, google, local, vllm, ollama
  model_id: string;              // Provider's model identifier
  
  // Capabilities
  context_length: number;        // Max input tokens (default: 4096)
  max_output_tokens: number;     // Max output tokens (default: 2048)
  default_temperature: number;   // Default temperature (0.0 - 2.0)
  default_top_p: number;         // Default top_p (0.0 - 1.0)
  
  // Feature flags
  supports_streaming: boolean;   // Can stream responses
  supports_tools: boolean;       // Can use function calling
  supports_vision: boolean;      // Can process images
  
  // Ownership
  is_global: boolean;            // Global (all users) vs personal
  user_id: string | null;        // Owner's user ID (null if global)
  
  // Metadata
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}
```

### CreateModelDTO Type

```typescript
interface CreateModelDTO {
  name: string;                      // Required: Display name
  provider: string;                  // Required: Provider type
  model_id: string;                  // Required: Model identifier
  
  api_key_encrypted?: string;        // Optional: Custom API key
  context_length?: number;           // Optional: Input limit
  max_output_tokens?: number;        // Optional: Output limit
  default_temperature?: number;      // Optional: Temperature
  default_top_p?: number;            // Optional: Top-P
  supports_streaming?: boolean;      // Optional: Streaming support
  supports_tools?: boolean;          // Optional: Tools support
  supports_vision?: boolean;         // Optional: Vision support
}
```

### InferenceServer Type

```typescript
interface InferenceServer {
  id: string;                    // Unique server ID
  user_id: string;               // Owner
  model_id: string;              // Model being served
  model_name: string;            // Model display name
  server_type: string;           // "vllm", "ollama"
  
  // Status
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  
  // Connection
  port: number;                  // Local port
  url: string;                   // Server URL
  
  // Metadata
  started_at: string;            // ISO timestamp
  uptime_seconds: number;        // How long running
}
```

---

## Troubleshooting

### Issue: "Models not loading"

**Symptoms:**

- Page shows loading spinner indefinitely
- No models appear after 30 seconds
- Error: "Failed to load models"

**Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Not authenticated | Log in at `/login` and try again |
| No access token | Clear cookies, re-login |
| Network error | Check internet connection |
| API server down | Try again in a few minutes |
| Slow API response | High server load, retry |

**Debug Steps:**

```typescript
// Open browser DevTools Console (F12)

// Check 1: Are you authenticated?
console.log('Session:', window.__AUTH?.session?.access_token);

// Check 2: What's the API response?
// Look in Network tab for GET /api/models
// Check response status (should be 200)
// Check response body for errors

// Check 3: Browser storage
// Local Storage → Look for 'sb-*' keys
// These are Supabase auth tokens
```

---

### Issue: "Cannot add model - field missing"

**Symptoms:**

- Form validation error when trying to add model
- Red error message under form field

**Common Mistakes:**

```
1. Missing required fields:
   ❌ Left "Model Name" blank
   ❌ Didn't select a Provider
   ❌ Didn't enter Model ID
   
   Fix: Fill all fields marked with *

2. Invalid values:
   ❌ Temperature > 2.0 or < 0.0
   ❌ Top-P > 1.0 or < 0.0
   ❌ Context length = 0
   
   Fix: Check value ranges

3. Duplicate name:
   ❌ Model with same name already exists
   
   Fix: Use a unique name
```

---

### Issue: "Deploy button is disabled"

**Symptoms:**

- Deploy button appears greyed out
- Tooltip says "Cannot deploy this model"

**Causes:**

| Cause | Reason |
|-------|--------|
| Global model | Only personal models can be deployed |
| Wrong provider | Must be "vllm", "ollama", or "local" |
| Already deployed | Server is running for this model |
| Not owner | Only model owner can deploy |

**Solution:**

```
For training-based models:
1. Go to Training page
2. Complete training
3. When prompted, deploy to vLLM
4. Model appears here with running server

For custom models:
1. Must create as type "vllm" or "ollama"
2. Click "Deploy" button
3. Configure settings
4. Server starts
```

---

### Issue: "Server failed to start"

**Symptoms:**

- Server status shows: ⚫ Error
- Tooltip shows error message

**Common Causes:**

| Issue | Solution |
|-------|----------|
| GPU out of memory | Reduce `gpu_memory_utilization` (try 0.6) |
| Model file missing | Model path invalid, check file exists |
| Port already in use | Another server using same port, stop it |
| CUDA not available | GPU drivers not installed |
| Model download failed | Network issue, check internet |

**Debug:**

```bash
# Check if vLLM is installed
python3 -c "import vllm; print(vllm.__version__)"

# Check GPU availability
nvidia-smi

# Check if port is free
lsof -i :8000  # Shows process using port 8000

# Check logs in terminal where app is running
# Look for error messages in red text
```

---

## Complete Example: From Start to Finish

### Scenario: You trained a model and want to deploy it

**Step 1: Training Complete**

```
✓ Training finished successfully
✓ Model saved to: /lib/training/logs/job_abc123/
✓ Redirected to models page with highlight
✓ Toast: "Model Deployed Successfully!"
```

**Step 2: Model Appears in List**

```
You see new card:
┌─ My Qwen Fine-Tuned (vLLM)    [Edit] [Delete]
│ • Streaming enabled
│ • Tool use disabled
│ Status: ⚫ Not deployed
│ 👤 My Model (Personal)        [🚀 Deploy]
└─────────────────────────────
```

**Step 3: Click Deploy**

```
Opens deployment dialog:
┌─ Deploy Server ─────────────┐
│ Server Type: vLLM           │
│ GPU Memory: ████████░░ 0.8  │
│ Max Length: 8192            │
│ Data Type: auto             │
│                             │
│ [Deploy Server] [Cancel]    │
└─────────────────────────────┘
```

**Step 4: Server Starts**

```
API Call:
POST /api/training/deploy
{
  server_type: "vllm",
  checkpoint_path: "/lib/training/logs/job_abc123",
  name: "My Qwen Fine-Tuned",
  config: {
    gpu_memory_utilization: 0.8,
    max_model_len: 8192
  }
}

Server Status Updates:
⏳ starting → 🟡 starting → 🟢 running
```

**Step 5: Server Running**

```
Model card updates:
┌─ My Qwen Fine-Tuned (vLLM)    [Edit] [Delete]
│ • Streaming enabled
│ • Tool use disabled
│ Status: 🟢 Running vLLM on port 8000
│ 👤 My Model (Personal)        [⬛ Stop Server]
└─────────────────────────────────────────────

Test the server:
http://localhost:8000/docs → Swagger UI
POST http://localhost:8000/v1/chat/completions
```

**Step 6: Use in Chat**

```
Go to Chat page
Model selector shows: "My Qwen Fine-Tuned" ✓
Select it
Start chatting!
```

**Step 7: Stop Server (when done)**

```
Click "Stop Server" button
API Call: POST /api/servers/stop
Status: 🟢 running → ⚫ stopped
Deploy button reappears
GPU memory freed
```

---

## Summary

**The Models Page lets you:**

- ✅ View all available models at a glance
- ✅ Manage your personal models (create, edit, delete)
- ✅ Deploy trained models to inference servers
- ✅ Monitor inference server status
- ✅ Test model connections and configurations

**Key Takeaways:**

- **Global Models** are read-only, available to all users
- **Personal Models** are fully editable by you
- **Deployment** requires vLLM/Ollama provider type
- **Filtering** helps find models quickly by name or provider
- **Servers** can be started/stopped for resource management

**Most Common Actions:**

1. Add custom model → Edit → Delete
2. Deploy model → Test → Stop server
3. Filter → Search → Select for chat

---

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Suitable for:** New users, dataset creation, workflow documentation
