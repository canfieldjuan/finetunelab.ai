# Quantization Config Fix - HuggingFace Inference Endpoint Deployment

## Problem
Your model deployment to HuggingFace Inference Endpoint was failing with:
```
PackageNotFoundError: No package metadata was found for bitsandbytes
```

## Root Cause
During LoRA training with QLoRA, the model was loaded with 4-bit quantization using bitsandbytes. When the model was saved, it included a `quantization_config` in the config.json file:

```json
{
  "quantization_config": {
    "quant_method": "bitsandbytes",
    "load_in_4bit": true,
    "bnb_4bit_quant_type": "nf4",
    "bnb_4bit_compute_dtype": "bfloat16"
  }
}
```

HuggingFace Inference Endpoints **do not have bitsandbytes installed**, so when they try to load your model, they fail because the config specifies quantization requirements.

## Solution Applied
Modified `lib/training/runpod-service.ts` to:

1. **Merge LoRA adapters** into the base model after training:
   ```python
   merged_model = model.merge_and_unload()
   ```

2. **Save the merged full-precision model** (this removes quantization):
   ```python
   merged_model.save_pretrained(save_path, safe_serialization=True)
   ```

3. **Explicitly remove quantization_config** from config.json if it exists:
   ```python
   if 'quantization_config' in config:
       del config['quantization_config']
   ```

4. **Auto-generate README.md** with correct `pipeline_tag: text-generation` metadata

## What Changed
- Training still uses 4-bit quantization for efficiency (saves memory during training)
- After training completes, LoRA adapters are merged into base model
- The merged model is saved WITHOUT quantization config
- This produces a full-precision model compatible with HF Inference Endpoints

## Important: Two Save Modes

The training script now supports TWO modes:

### Mode 1: Adapter-Only (Default) - Recommended for Most Users
**Best for:** General use, fast uploads, small file size

```bash
# No special configuration needed - this is the default
# Saves only LoRA adapters (~100MB)
```

- ✅ Small file size (~100-200MB)
- ✅ Fast upload to HuggingFace
- ✅ Works with PEFT library for inference
- ✅ Can be loaded with quantization
- ❌ NOT compatible with HF Inference Endpoints

### Mode 2: Merged Model - For HF Inference Endpoints
**Best for:** Deploying to HuggingFace Inference Endpoints

```bash
# Set environment variable when launching training:
MERGE_ADAPTERS=true

# This will merge LoRA into base model (~12GB for 3B models)
```

- ✅ Compatible with HF Inference Endpoints
- ✅ No quantization config (full-precision)
- ✅ Ready for production deployment
- ❌ Large file size (~12GB for 3B model)
- ❌ Slower upload

## Next Steps

### For Regular Training (Default)
No changes needed! Training will save adapters only:

```bash
# Your existing training command works as before
# Produces small adapter files (~100MB)
```

### For HF Inference Endpoint Deployment
Set `MERGE_ADAPTERS=true` when starting training:

```bash
# In your training configuration, add:
MERGE_ADAPTERS=true

# This will produce a merged full-precision model
```

### 2. Verify Model Config (Optional)
After training completes and uploads, verify the fix:

```bash
python check_hf_model_config.py
```

Expected output:
```
✅ config.json found
Model type: llama
Architecture: LlamaForCausalLM
✅ No quantization config found - model is full precision
```

### 3. Deploy to HuggingFace Inference Endpoint
1. Go to https://ui.endpoints.huggingface.co/
2. Delete the failed endpoint (if it still exists)
3. Create new endpoint:
   - Repository: `Canfield/llama-3-2-3b-instruct-new-atlas-dataset`
   - Instance: Choose based on budget (e.g., 1x NVIDIA A10G)
   - Framework: Transformers
4. Wait for deployment (should succeed now)

### 4. Test Inference
Once deployed, test with Python:

```python
from huggingface_hub import InferenceClient

client = InferenceClient(
    model="Canfield/llama-3-2-3b-instruct-new-atlas-dataset",
    token="YOUR_HF_TOKEN"
)

response = client.chat_completion(
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=100
)

print(response.choices[0].message.content)
```

Or with curl:
```bash
curl https://YOUR_ENDPOINT_URL/v1/chat/completions \
  -H "Authorization: Bearer YOUR_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Canfield/llama-3-2-3b-instruct-new-atlas-dataset",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## Alternative: Local Deployment

If HuggingFace Inference Endpoints are too expensive (~$0.60/hour), you can deploy locally with vLLM:

```bash
# Install vLLM
pip install vllm

# Serve the model
vllm serve Canfield/llama-3-2-3b-instruct-new-atlas-dataset --port 8000

# Test
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Canfield/llama-3-2-3b-instruct-new-atlas-dataset",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

Then update your model config in the UI:
- Provider: vLLM or OpenAI (compatible API)
- Base URL: `http://localhost:8000/v1`
- Model ID: `Canfield/llama-3-2-3b-instruct-new-atlas-dataset`

## Technical Details

### Why This Works
- **During training**: Model uses 4-bit quantization via bitsandbytes (memory efficient)
- **After training**: LoRA adapters are merged into base model weights
- **merge_and_unload()**: Converts quantized PEFT model to full-precision merged model
- **Result**: Saved model has no quantization config → HF Endpoints can load it

### File Modified
- `lib/training/runpod-service.ts` (lines 730-815)
  - Added merge step before save
  - Added explicit quantization_config removal
  - Added automatic README.md generation

### README.md Auto-Generation
The training pipeline now automatically creates a README.md with:
- `pipeline_tag: text-generation` (required for chat models)
- Metadata (language, license, base model)
- Usage examples
- Training details

This ensures your model is properly recognized by HuggingFace as a chat model.

## Verification Checklist

After re-training and deployment:

- [ ] Training completed successfully
- [ ] Model uploaded to HuggingFace
- [ ] README.md exists with `pipeline_tag: text-generation`
- [ ] config.json has NO `quantization_config` field
- [ ] HuggingFace Inference Endpoint deployed successfully
- [ ] Inference test returns valid responses
- [ ] Model works in your web UI

## Cost Considerations

**HuggingFace Inference Endpoint:**
- ~$0.60/hour for NVIDIA A10G (24GB)
- ~$1.20/hour for NVIDIA A100 (40GB)
- Billed per second, minimum 1 hour
- Can pause when not in use

**Local vLLM:**
- Free (uses your GPU)
- Requires ~8GB VRAM for 3B model
- Better for development/testing
- No cloud costs

## Support Resources

- HuggingFace Inference Endpoints: https://huggingface.co/docs/inference-endpoints/
- vLLM Documentation: https://docs.vllm.ai/
- Transformers Quantization: https://huggingface.co/docs/transformers/quantization
- PEFT merge_and_unload: https://huggingface.co/docs/peft/main/en/package_reference/lora
