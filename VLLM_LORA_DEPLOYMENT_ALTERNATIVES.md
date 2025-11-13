# vLLM LoRA Deployment - Alternative Solutions

**Date:** 2025-11-03  
**Goal:** Deploy trained LoRA/QLoRA checkpoints to vLLM immediately after training WITHOUT Docker  
**Current Problem:** Windows compatibility + Docker dependency overhead

---

## Table of Contents

1. [Current Implementation Analysis](#current-implementation-analysis)
2. [The Real Problem](#the-real-problem)
3. [Alternative Solutions](#alternative-solutions)
4. [Recommended Approach](#recommended-approach)
5. [Implementation Plan](#implementation-plan)

---

## Current Implementation Analysis

### Training Output Structure

**Location:** `lib/training/logs/job_{job_id}/`

After training completes, you have:
```
job_022f09d9-c945-4270-b18c-d1622acb3219/
├── checkpoint-200/
│   ├── adapter_config.json      # LoRA configuration
│   ├── adapter_model.safetensors # LoRA weights (~50-500MB)
│   ├── trainer_state.json        # Training state
│   ├── tokenizer_config.json
│   ├── tokenizer.json
│   └── special_tokens_map.json
├── checkpoint-400/
├── checkpoint-600/
└── runs/                         # TensorBoard logs
```

**Key File: `adapter_config.json`**
```json
{
  "base_model_name_or_path": "Qwen/Qwen2.5-0.5B",
  "peft_type": "LORA",
  "task_type": "CAUSAL_LM",
  "r": 16,
  "lora_alpha": 32,
  "lora_dropout": 0.05,
  "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
  "inference_mode": false
}
```

---

### Current Deployment Flow

**File:** `lib/services/inference-server-manager.ts`

**Step 1:** User clicks "Deploy to vLLM"

**Step 2:** Detection (line 1249)
```typescript
const loraInfo = this.isLoRAAdapter(modelPath);
// Checks for adapter_config.json
// Returns: { isLora: true, baseModel: "Qwen/Qwen2.5-0.5B" }
```

**Step 3:** Find Local Base Model (line 1254)
```typescript
const localBaseModel = this.findLocalBaseModel(loraInfo.baseModel);
// Searches: ../AI_Models/huggingface_models/
// Returns: "C:/Users/Juan/Desktop/Dev_Ops/AI_Models/huggingface_models/Qwen-Qwen2.5-0.5B"
```

**Step 4:** Merge LoRA + Base Model (line 1263)
```typescript
const mergedModelDir = path.join(path.dirname(modelPath), 'merged');
await this.mergeLoRAAdapter(modelPath, localBaseModel, mergedModelDir);
```

**Merge Script:** `lib/scripts/merge-lora.py`
```python
# Uses PEFT library to merge weights
base_model = AutoModelForCausalLM.from_pretrained(base_model_name)
model = PeftModel.from_pretrained(base_model, adapter_path)
merged_model = model.merge_and_unload()  # ← KEY LINE
merged_model.save_pretrained(output_path)  # Saves full model (~1-14GB)
```

**Step 5:** Deploy Merged Model via Docker
```typescript
const dockerCmd = `docker run -d \
  --name vllm-server \
  --gpus all \
  -p 8003:8000 \
  -v "${mergedModelPath}:/model" \
  vllm/vllm-openai:v0.6.3.post1 \
  --model /model \
  --served-model-name "my-model"`;
```

---

### Why This Approach?

**Problem vLLM Was Solving:**
- vLLM v0.6.3.post1 has **LIMITED LoRA support**
- Only works with specific architectures (Llama, Mistral, some Qwen variants)
- Qwen3, GPT2, Phi-2 → **NO native LoRA support**

**Solution Implemented:**
- Merge LoRA adapter into base model → full fine-tuned model
- Deploy merged model as regular model
- Bypasses vLLM's LoRA limitations

**Downsides:**
1. **Storage overhead:** Merged model = full model size (1-14GB vs 50-500MB adapter)
2. **Merge time:** 1-2 minutes per deployment
3. **Memory usage:** Needs to load base model + adapter simultaneously during merge
4. **Docker dependency:** Uses Docker to run vLLM (Windows workaround)

---

## The Real Problem

### Issue #1: Windows + uvloop Incompatibility

**Root Cause:**
```python
# vLLM internally uses uvloop for async I/O
import uvloop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())  # ← Fails on Windows
```

**Why It Matters:**
- uvloop = high-performance event loop (Linux/macOS only)
- vLLM package **requires** uvloop
- Cannot install vLLM on Windows natively

**Current Workaround:**
- Docker Desktop (uses WSL2 backend)
- vLLM runs inside Linux container
- Works but adds complexity

---

### Issue #2: Dependency Overhead

**What's Required for Current Flow:**

1. **Docker Desktop** (~2GB download, 500MB RAM overhead)
2. **Python with PEFT** (for merging)
   ```bash
   pip install peft transformers torch
   ```
3. **Base model downloaded locally** (1-14GB per model)
4. **Disk space for merged models** (1-14GB per checkpoint)

**Total Overhead:**
- Initial setup: ~5GB (Docker + base model)
- Per deployment: 1-14GB (merged model storage)
- Runtime: 500MB-2GB (Docker daemon)

---

## Alternative Solutions

### Option 1: vLLM Native LoRA Support (Best for Linux)

**How It Works:**
vLLM v0.6+ supports loading LoRA adapters directly **without merging**

**Command:**
```bash
# Start vLLM server with base model
python -m vllm.entrypoints.openai.api_server \
  --model "Qwen/Qwen2.5-0.5B" \
  --enable-lora \
  --max-loras 4 \
  --max-lora-rank 64 \
  --port 8002

# Then use API to load adapters dynamically
curl -X POST http://localhost:8002/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-0.5B",
    "prompt": "Hello world",
    "lora_request": {
      "lora_name": "my-adapter",
      "lora_path": "/path/to/checkpoint-600"
    }
  }'
```

**Pros:**
- ✅ No merging needed (saves time and disk space)
- ✅ Can load multiple adapters simultaneously
- ✅ Faster deployment (just specify path)
- ✅ Less memory usage (share base model weights)

**Cons:**
- ❌ Only works on **Linux/macOS** (uvloop requirement)
- ❌ Architecture-limited (not all models supported)
- ❌ Requires vLLM v0.6+ with LoRA support for your model

**Compatibility Matrix (vLLM v0.6.3):**
| Model Family | Native LoRA Support |
|--------------|---------------------|
| Llama 2/3 | ✅ Yes |
| Mistral | ✅ Yes |
| Qwen2.5 | ✅ Yes |
| Qwen3 | ❌ No |
| Phi-2 | ❌ No |
| GPT2 | ❌ No |

---

### Option 2: Hugging Face TGI (Text Generation Inference)

**Alternative inference server with better Windows support**

**Installation:**
```bash
# Install TGI (supports Windows via WSL2)
pip install text-generation

# Start server with LoRA adapter
text-generation-launcher \
  --model-id "Qwen/Qwen2.5-0.5B" \
  --adapter-id "/path/to/checkpoint-600" \
  --port 8003
```

**Pros:**
- ✅ Better Windows support (no uvloop dependency)
- ✅ Native LoRA adapter loading
- ✅ OpenAI-compatible API
- ✅ Good performance (Flash Attention)

**Cons:**
- ❌ Slower than vLLM for batched requests
- ❌ Less mature ecosystem
- ❌ Different configuration format

---

### Option 3: Local Python Server with Transformers

**Simplest approach - no vLLM at all**

**Implementation:**
```python
# lib/inference/simple_server.py
from fastapi import FastAPI
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import torch

app = FastAPI()

# Load base model once at startup
base_model = AutoModelForCausalLM.from_pretrained(
    "Qwen/Qwen2.5-0.5B",
    device_map="auto",
    torch_dtype=torch.float16
)
tokenizer = AutoTokenizer.from_pretrained("Qwen/Qwen2.5-0.5B")

# Load LoRA adapter
model = PeftModel.from_pretrained(base_model, "/path/to/checkpoint-600")

@app.post("/v1/completions")
async def generate(prompt: str, max_tokens: int = 100):
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    outputs = model.generate(**inputs, max_new_tokens=max_tokens)
    text = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return {"text": text}

# Run with: uvicorn simple_server:app --port 8002
```

**Pros:**
- ✅ **Works on Windows** (no uvloop needed!)
- ✅ Direct LoRA loading (no merging)
- ✅ Minimal dependencies (transformers + peft)
- ✅ Full control over inference
- ✅ Easy debugging

**Cons:**
- ❌ Slower than vLLM (no paged attention, continuous batching)
- ❌ No request batching optimization
- ❌ Higher memory usage per request
- ❌ Need to implement OpenAI-compatible API manually

---

### Option 4: Ollama with GGUF Conversion

**Already partially implemented in your codebase**

**File:** `lib/services/inference-server-manager.ts` (line 300)

**Flow:**
```typescript
async startOllama(config: OllamaConfig, ...): Promise<ServerInfo> {
  // 1. Ensure Ollama server running
  await this.ensureOllamaRunning();
  
  // 2. Convert checkpoint to GGUF format
  const ggufPath = await this.convertToGGUF(modelPath, modelName);
  
  // 3. Create Modelfile
  const modelfileContent = generateModelfile({...});
  await saveModelfile(modelfileContent, modelfilePath);
  
  // 4. Register model with Ollama
  spawn('ollama', ['create', servedName, '-f', modelfilePath]);
}
```

**Pros:**
- ✅ **Native Windows support** (no Docker needed!)
- ✅ Lower memory usage (quantized models)
- ✅ Faster startup
- ✅ Simple setup

**Cons:**
- ❌ No tool calling support yet (roadmap item)
- ❌ Quantization can reduce quality
- ❌ GGUF conversion required (adds step)
- ❌ Slower inference than vLLM

---

### Option 5: WSL2 + vLLM Direct (Hybrid Approach)

**Run vLLM in WSL2, control from Windows**

**Setup:**
```bash
# Inside WSL2 (Ubuntu)
conda create -n vllm python=3.10
conda activate vllm
pip install vllm

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model "/mnt/c/Users/Juan/Desktop/Dev_Ops/AI_Models/huggingface_models/Qwen-Qwen2.5-0.5B" \
  --enable-lora \
  --max-loras 4 \
  --port 8002 \
  --host 0.0.0.0  # Allow Windows to connect
```

**Windows Integration:**
```typescript
// lib/services/inference-server-manager.ts

private async startVLLMWSL2(config: VLLMConfig, port: number): Promise<ChildProcess> {
  // Convert Windows path to WSL2 path
  const wsl2Path = this.convertToWSL2Path(config.modelPath);
  // C:\Users\Juan\models → /mnt/c/Users/Juan/models
  
  const args = [
    '--distribution', 'Ubuntu',
    '--exec', '/home/juan/miniconda3/envs/vllm/bin/python',
    '-m', 'vllm.entrypoints.openai.api_server',
    '--model', config.baseModel,  // Base model from HuggingFace
    '--enable-lora',
    '--max-loras', '4',
    '--port', port.toString(),
    '--host', '0.0.0.0'
  ];
  
  return spawn('wsl', args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

// Then load adapter via API
async loadLoRAAdapter(serverUrl: string, adapterPath: string, adapterName: string) {
  const wsl2AdapterPath = this.convertToWSL2Path(adapterPath);
  
  // Use vLLM's LoRA API
  await fetch(`${serverUrl}/v1/loras`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      lora_name: adapterName,
      lora_path: wsl2AdapterPath
    })
  });
}
```

**Pros:**
- ✅ No Docker overhead (direct WSL2 process)
- ✅ Native vLLM LoRA support (if model supports it)
- ✅ Better performance than Docker
- ✅ Easier debugging

**Cons:**
- ❌ Requires WSL2 setup
- ❌ Path conversion complexity
- ❌ Still need Linux environment

---

## Recommended Approach

### Strategy: Hybrid Multi-Backend System

**Why:**
- No single solution works perfectly for all cases
- Different models have different deployment needs
- Users have different environments (Windows/Linux, Docker/WSL2)

**Implementation:**

#### Backend 1: Simple Transformers Server (Universal Fallback)

**Use When:**
- User on Windows without Docker/WSL2
- Need immediate testing after training
- Model doesn't have vLLM LoRA support

**Code:**
```python
# lib/inference/transformers_server.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
from peft import PeftModel
import torch
from threading import Thread
from typing import Optional, List

app = FastAPI()

class ModelLoader:
    def __init__(self):
        self.base_model = None
        self.tokenizer = None
        self.current_adapter = None
        self.model = None
    
    def load_base(self, base_model_path: str):
        """Load base model once"""
        if self.base_model is None:
            self.base_model = AutoModelForCausalLM.from_pretrained(
                base_model_path,
                device_map="auto",
                torch_dtype=torch.float16
            )
            self.tokenizer = AutoTokenizer.from_pretrained(base_model_path)
    
    def load_adapter(self, adapter_path: str):
        """Load LoRA adapter dynamically"""
        if self.current_adapter != adapter_path:
            self.model = PeftModel.from_pretrained(
                self.base_model, 
                adapter_path,
                adapter_name="default"
            )
            self.current_adapter = adapter_path

loader = ModelLoader()

class CompletionRequest(BaseModel):
    model: str
    prompt: str
    max_tokens: int = 100
    temperature: float = 0.7
    stream: bool = False

@app.post("/v1/completions")
async def create_completion(request: CompletionRequest):
    """OpenAI-compatible completion endpoint"""
    inputs = loader.tokenizer(request.prompt, return_tensors="pt").to(loader.model.device)
    
    if request.stream:
        # Streaming response
        streamer = TextIteratorStreamer(loader.tokenizer, skip_special_tokens=True)
        generation_kwargs = dict(
            **inputs,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature,
            streamer=streamer
        )
        
        thread = Thread(target=loader.model.generate, kwargs=generation_kwargs)
        thread.start()
        
        def generate():
            for text in streamer:
                yield f"data: {json.dumps({'text': text})}\n\n"
            yield "data: [DONE]\n\n"
        
        return StreamingResponse(generate(), media_type="text/event-stream")
    else:
        # Non-streaming
        outputs = loader.model.generate(
            **inputs,
            max_new_tokens=request.max_tokens,
            temperature=request.temperature
        )
        text = loader.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return {"text": text, "model": request.model}

@app.post("/v1/adapters/load")
async def load_adapter_endpoint(base_model: str, adapter_path: str):
    """Load a new LoRA adapter"""
    try:
        loader.load_base(base_model)
        loader.load_adapter(adapter_path)
        return {"status": "success", "adapter": adapter_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: python -m uvicorn lib.inference.transformers_server:app --port 8002
```

**Node.js Integration:**
```typescript
// lib/services/transformers-server-manager.ts

export class TransformersServerManager {
  async startServer(
    baseModel: string,
    adapterPath: string,
    port: number
  ): Promise<ServerInfo> {
    // Get Python from training environment
    const pythonPath = process.env.PYTHON_PATH || 
      path.join(process.cwd(), 'lib', 'training', 'trainer_venv', 'Scripts', 'python.exe');
    
    const serverScript = path.join(process.cwd(), 'lib', 'inference', 'transformers_server.py');
    
    const args = [
      '-m', 'uvicorn',
      'lib.inference.transformers_server:app',
      '--port', port.toString(),
      '--host', '127.0.0.1'
    ];
    
    const process = spawn(pythonPath, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BASE_MODEL: baseModel,
        ADAPTER_PATH: adapterPath
      }
    });
    
    // Wait for server to start
    await this.waitForHealthy(`http://127.0.0.1:${port}`);
    
    return {
      serverId: uuidv4(),
      baseUrl: `http://127.0.0.1:${port}`,
      port,
      pid: process.pid,
      status: 'running'
    };
  }
}
```

---

#### Backend 2: vLLM with Native LoRA (WSL2 or Linux)

**Use When:**
- Model has vLLM LoRA support
- User has WSL2 or Linux
- Need high performance

**Already documented in previous analysis - use WSL2 approach**

---

#### Backend 3: vLLM with Merged Model (Docker fallback)

**Use When:**
- Model doesn't have vLLM LoRA support
- User wants maximum performance
- User already has Docker

**Keep existing implementation**

---

### Deployment Decision Tree

```typescript
// lib/services/deployment-router.ts

export class DeploymentRouter {
  async deploy(checkpoint: CheckpointInfo, userId: string): Promise<ServerInfo> {
    const loraInfo = this.isLoRAAdapter(checkpoint.path);
    
    // Decision 1: Check deployment mode preference
    const mode = process.env.DEPLOYMENT_MODE || 'auto';
    
    if (mode === 'transformers' || mode === 'auto') {
      // Try simple transformers server first (universal)
      try {
        return await this.deployTransformersServer(checkpoint, userId);
      } catch (error) {
        console.log('Transformers deployment failed, trying alternatives...');
      }
    }
    
    // Decision 2: Check for WSL2 + vLLM with LoRA support
    if (await this.hasWSL2() && await this.hasVLLMLoRASupport(checkpoint.baseModel)) {
      try {
        return await this.deployVLLMWSL2WithLoRA(checkpoint, userId);
      } catch (error) {
        console.log('WSL2 vLLM LoRA deployment failed, trying merge...');
      }
    }
    
    // Decision 3: Check for Docker + merge capability
    if (await this.hasDocker()) {
      return await this.deployVLLMDockerMerged(checkpoint, userId);
    }
    
    // Fallback: Ollama (if installed)
    if (await this.hasOllama()) {
      return await this.deployOllama(checkpoint, userId);
    }
    
    throw new Error('No deployment backend available');
  }
}
```

---

## Implementation Plan

### Phase 1: Add Transformers Server (Immediate Solution)

**Why First:**
- ✅ Works on Windows without ANY extra dependencies
- ✅ Uses existing Python environment (trainer_venv)
- ✅ Minimal code changes
- ✅ Gets you testing immediately

**Files to Create:**
1. `lib/inference/transformers_server.py` - FastAPI server
2. `lib/services/transformers-server-manager.ts` - Node.js manager
3. Update `app/api/training/deploy/route.ts` - Add transformers option

**Estimated Time:** 3-4 hours

**Test Plan:**
1. Train small model (Qwen 0.5B)
2. Deploy via transformers server
3. Test in chat portal
4. Verify streaming works

---

### Phase 2: Add vLLM Native LoRA Support (WSL2)

**Why Second:**
- ✅ Better performance than transformers
- ✅ Native LoRA support (no merging)
- ✅ Prepares for Linux deployment

**Files to Modify:**
1. `lib/services/inference-server-manager.ts` - Add WSL2 spawn
2. Add path conversion utilities
3. Update deployment router

**Estimated Time:** 4-5 hours

---

### Phase 3: Simplify UI - Auto Backend Selection

**Add dropdown in deploy dialog:**
```
Deployment Backend:
○ Auto (recommended)
○ Transformers Server (fast setup, Windows-friendly)
○ vLLM + LoRA (best performance, requires WSL2/Linux)
○ vLLM + Merge (universal, slower startup)
○ Ollama (quantized, lower memory)
```

**Estimated Time:** 2 hours

---

## Summary Table

| Solution | Windows | Docker Needed | Merge Needed | Performance | Setup Time |
|----------|---------|---------------|--------------|-------------|------------|
| **Transformers Server** | ✅ Native | ❌ No | ❌ No | ⭐⭐⭐ Good | ⚡ 10 sec |
| **vLLM WSL2 + LoRA** | ✅ WSL2 | ❌ No | ❌ No | ⭐⭐⭐⭐⭐ Excellent | ⚡ 30 sec |
| **vLLM Docker + Merge** | ✅ Docker | ✅ Yes | ✅ Yes | ⭐⭐⭐⭐⭐ Excellent | ⏱️ 2-3 min |
| **Ollama** | ✅ Native | ❌ No | ⚠️ GGUF | ⭐⭐⭐ Good | ⚡ 20 sec |

---

## Recommendation

**For Immediate Use:**
1. Implement **Transformers Server** (Phase 1) - Get it working today
2. Keep existing Docker solution as fallback
3. Add WSL2 support later when you need performance

**This gets you:**
- ✅ Training → Deploy → Test in **under 1 minute**
- ✅ No Docker dependency
- ✅ No model merging overhead
- ✅ Works on Windows natively
- ✅ Direct LoRA adapter loading

**Next Steps:**
Should I implement the Transformers Server approach? It's the simplest path to get you testing models immediately after training.

