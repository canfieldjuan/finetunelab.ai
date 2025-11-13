# Training Deployment Architecture

## Overview

After training a model, you can deploy it to either **vLLM** or **Ollama** for inference.

## Deployment Paths

### 1. vLLM Deployment (Direct HuggingFace)

```
Trained Model (HF Format)
    ↓
    → vLLM Server (no conversion needed)
    ↓
Available at: http://localhost:<port>/v1
```

**Files Involved:**
- `app/api/training/deploy/route.ts` - Deployment API
- `lib/services/inference-server-manager.ts` - vLLM server lifecycle
- `lib/services/vllm-checker.ts` - vLLM availability check

**No GGUF conversion required** - vLLM uses HuggingFace models directly.

**Command:**
```bash
python -m vllm.entrypoints.openai.api_server \
  --model <model_path> \
  --host 0.0.0.0 \
  --port <port> \
  --gpu-memory-utilization 0.8
```

### 2. Ollama Deployment (GGUF Conversion)

```
Trained Model (HF Format)
    ↓
    → convert_to_gguf.py (F16 → Quantized GGUF)
    ↓
    → Ollama Model Import
    ↓
    → Ollama Server
    ↓
Available at: http://localhost:<port>
```

**Files Involved:**
- `app/api/training/deploy/route.ts` - Deployment API
- `lib/services/inference-server-manager.ts` - Ollama server lifecycle
- `lib/training/convert_to_gguf.py` - **GGUF conversion (Ollama only)**

**GGUF conversion steps:**
1. Convert HF model to F16 GGUF
2. Optionally quantize to Q4_K_M/Q5_K_M/Q8_0
3. Import into Ollama
4. Start Ollama server

**Command:**
```bash
# Convert to GGUF
python lib/training/convert_to_gguf.py \
  <model_path> \
  <output.gguf> \
  --quantization Q4_K_M

# Import to Ollama
ollama create my-model -f Modelfile

# Serve
ollama serve
```

## API Endpoint

**POST `/api/training/deploy`**

Request:
```json
{
  "job_id": "uuid",
  "server_type": "vllm" | "ollama",
  "checkpoint_path": "checkpoint-1000" (optional),
  "name": "my-model",
  "config": {
    "gpu_memory_utilization": 0.8,  // vLLM
    "context_length": 4096           // Ollama
  }
}
```

Response:
```json
{
  "success": true,
  "server_id": "uuid",
  "status": "running",
  "base_url": "http://localhost:8000",
  "port": 8000,
  "model_id": "uuid",
  "model_name": "my-model"
}
```

## When to Use What

### Use vLLM when:
- Maximum performance needed
- Have CUDA GPU
- Want OpenAI-compatible API
- Don't need quantization
- **No GGUF conversion required**

### Use Ollama when:
- Want simpler deployment
- Need aggressive quantization (Q4_K_M for 8GB GPUs)
- Want model library management
- Cross-platform support
- **Requires GGUF conversion**

## File Purpose Clarification

### `convert_to_gguf.py`
- **Purpose:** Convert HuggingFace models to GGUF format
- **Used by:** Ollama deployment ONLY
- **NOT used by:** vLLM deployment
- **Why:** vLLM uses HuggingFace models directly, no conversion needed

### Key Point
Both deployment paths work fine. They're independent:
- vLLM path: HF → vLLM Server ✓
- Ollama path: HF → GGUF → Ollama Server ✓

The `convert_to_gguf.py` file being "only for Ollama" is **correct architecture**.

## Error Resolution

If you're seeing GGUF conversion errors during **vLLM deployment**, that's a bug - vLLM shouldn't be calling `convert_to_gguf.py` at all.

Check:
1. Is `server_type` correctly set to `"vllm"` vs `"ollama"`?
2. Is the deployment API routing correctly?
3. Is inference-server-manager calling the right function?

The deployment API should route based on `server_type`:
```typescript
if (server_type === 'vllm') {
  // startVLLM - NO GGUF conversion
  serverInfo = await inferenceServerManager.startVLLM(...)
} else if (server_type === 'ollama') {
  // startOllama - WITH GGUF conversion
  serverInfo = await inferenceServerManager.startOllama(...)
}
```
