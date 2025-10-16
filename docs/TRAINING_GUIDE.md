# Training Guide: Tiny Tool Use Integration

**Last Updated:** 2025-10-15

Complete guide for training small language models with Tiny Tool Use framework and deploying them in your web-ui.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Training Workflow](#training-workflow)
4. [Importing Models](#importing-models)
5. [Using Models in Chat](#using-models-in-chat)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Topics](#advanced-topics)

---

## Overview

This guide covers the complete workflow for:
1. Training small models (0.6B-1B parameters) with Tiny Tool Use framework
2. Pushing trained models to HuggingFace Hub
3. Importing models into web-ui
4. Serving models via HuggingFace Inference API
5. Using models in chat with tool calling support

**Training Framework:** Tiny Tool Use (bagel-RL repo)
**Model Sizes:** Qwen3-0.6B (600M-1B parameters)
**Training Method:** SFT/DPO with QLoRA/LoRA
**Training Time:** 2-4 hours on single GPU
**Output Format:** HuggingFace safetensors
**Serving:** HuggingFace Inference API

---

## Prerequisites

### Hardware Requirements
- **GPU:** NVIDIA RTX 4060 Ti (8GB VRAM) or better
- **Alternatives:** RTX 3090, RTX 4090, A100, H100
- **RAM:** 16GB system RAM minimum
- **Storage:** 20GB free space for model checkpoints

### Software Requirements
```bash
# Python 3.10+
python --version

# CUDA 11.8+ or 12.1+
nvcc --version

# PyTorch with CUDA support
python -c "import torch; print(torch.cuda.is_available())"
```

### Python Dependencies
```bash
cd /home/juanc/Desktop/claude_desktop/bagel-RL/Tiny\ Tool\ Use/

# Install dependencies
pip install -r requirements.txt

# Key packages:
# - transformers
# - peft (for LoRA)
# - bitsandbytes (for quantization)
# - datasets
# - accelerate
```

### HuggingFace Account
1. Create account at [huggingface.co](https://huggingface.co/)
2. Generate API token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
3. Login to CLI:
```bash
huggingface-cli login
# Paste your token when prompted
```

---

## Training Workflow

### Step 1: Prepare Training Config

Navigate to Tiny Tool Use directory:
```bash
cd /home/juanc/Desktop/claude_desktop/bagel-RL/Tiny\ Tool\ Use/
```

Example config (`configs/my_custom_config.json`):
```json
{
  "model": {
    "name": "Qwen/Qwen3-0.6B",
    "trust_remote_code": true,
    "torch_dtype": "float16",
    "device_map": "auto"
  },
  "training": {
    "method": "sft",
    "num_epochs": 1,
    "learning_rate": 5e-5,
    "batch_size": 4,
    "gradient_accumulation_steps": 8,
    "tokenizer_padding_side": "left",
    "warmup_steps": 100,
    "max_length": 2048,
    "use_lora": true,
    "lora_r": 8,
    "lora_alpha": 32,
    "lora_dropout": 0.05
  },
  "data": {
    "strategy": "toolbench",
    "generation_type": "real",
    "max_samples": 700,
    "train_split": 0.99
  },
  "tokenizer": {
    "name": "Qwen/Qwen3-0.6B",
    "trust_remote_code": true
  },
  "tools": {}
}
```

**Config Options:**

| Field | Options | Notes |
|-------|---------|-------|
| `training.method` | `sft`, `dpo` | SFT for supervised fine-tuning |
| `data.strategy` | `toolbench`, `pc_building`, `teacher_mode`, `knowledge_dense` | Dataset selection |
| `training.use_lora` | `true`, `false` | LoRA saves memory |
| `lora_r` | `8`, `16`, `32` | Lower = less memory, faster |
| `lora_alpha` | `32`, `64` | Usually 2x or 4x lora_r |

### Step 2: Run Training

```bash
python train.py --config configs/my_custom_config.json --output-dir ./outputs/my_run
```

**Expected Output:**
```
[Training] Loading model: Qwen/Qwen3-0.6B
[Training] Using LoRA (r=8, alpha=32, dropout=0.05)
[Training] Loading dataset: ToolBench (700 samples)
[Training] Starting training...
Epoch 1/1: 100%|████████| 175/175 [1:23:45<00:00, 28.8s/it, loss=0.18]
[Training] Training complete!
[Training] Final loss: 0.18
[Training] Token acceptance: 92%
```

**Training Time:**
- 1 epoch, 700 samples: ~2 hours (RTX 4060 Ti)
- 3 epochs, 2000 samples: ~8 hours (RTX 4060 Ti)

**Monitor Training:**
```bash
# Watch GPU usage
watch -n 1 nvidia-smi

# Check training logs
tail -f outputs/my_run/training.log
```

### Step 3: Merge LoRA Adapters

After training, merge LoRA adapters with base model:

```bash
python save_merge_model.py \
  --base_model Qwen/Qwen3-0.6B \
  --adapter_path outputs/my_run/checkpoint-final \
  --output_dir outputs/my_run/merged_model \
  --half_precision
```

**Output:**
```
Loading base model: Qwen/Qwen3-0.6B
Loading adapter from: outputs/my_run/checkpoint-final
Merging adapter with base model...
Saving merged model to outputs/my_run/merged_model
✓ Model saved successfully
```

### Step 4: Push to HuggingFace Hub

Upload your model to HuggingFace:

```bash
# Create model card (optional but recommended)
cat > outputs/my_run/merged_model/README.md << 'EOF'
---
license: apache-2.0
base_model: Qwen/Qwen3-0.6B
tags:
- tiny-tool-use
- function-calling
- qwen3
---

# Qwen3-0.6B Tool Use V1

Fine-tuned Qwen3-0.6B model for tool/function calling.

**Training Details:**
- Base Model: Qwen/Qwen3-0.6B
- Method: SFT with LoRA (r=8, alpha=32)
- Dataset: ToolBench (700 samples)
- Training Time: 2 hours on RTX 4060 Ti
- Final Loss: 0.18
- Token Acceptance: 92%

**Usage:**
See [Web-UI Training Guide](https://github.com/yourrepo/web-ui/docs/TRAINING_GUIDE.md)
EOF

# Upload to HuggingFace
huggingface-cli upload yourname/qwen3-0.6b-tool-use-v1 outputs/my_run/merged_model
```

**Alternative: Python Script**
```python
from huggingface_hub import HfApi

api = HfApi()
api.upload_folder(
    folder_path="outputs/my_run/merged_model",
    repo_id="yourname/qwen3-0.6b-tool-use-v1",
    repo_type="model",
)
print("✓ Model uploaded successfully!")
```

**Verify Upload:**
Visit `https://huggingface.co/yourname/qwen3-0.6b-tool-use-v1` to confirm.

---

## Importing Models

### Step 1: Navigate to Models Page

1. Open web-ui: `http://localhost:3003`
2. Click "Models" in navigation
3. Click "Add Model" button

### Step 2: Select Import Template

1. Click "Templates" tab (default)
2. Scroll to "HuggingFace" section
3. Select **"Import Custom Model"** template

You should see a helper box with import instructions.

### Step 3: Fill Model Details

**Required Fields:**

| Field | Value | Example |
|-------|-------|---------|
| **Model Name** | Display name for your model | `Qwen3 Tool Use V1` |
| **Model ID** | HuggingFace model path | `yourname/qwen3-0.6b-tool-use-v1` |
| **API Key** | HuggingFace API token | `hf_...` (from settings page) |

**Optional Fields:**

| Field | Value | Notes |
|-------|-------|-------|
| **Description** | Model notes | `Fine-tuned on ToolBench, 92% accuracy` |

**Pre-filled Fields (from template):**

- Base URL: `https://api-inference.huggingface.co/models`
- Auth Type: `Bearer`
- Supports Functions: `true` ✅
- Supports Streaming: `false` (HF limitation)
- Context Length: `2048` tokens
- Max Output: `1024` tokens

### Step 4: Test Connection

1. Click **"Test Connection"** button
2. Wait 10-30 seconds (first request may be slow - cold start)
3. Verify success message: "Connection successful (latency: XXXms)"

**If test fails:**
- Check model_id format: `username/model-name`
- Verify model is public (or token has access)
- Wait 1 minute and retry (model loading)

### Step 5: Create Model

1. Click **"Create Model"** button
2. Model will be saved with encrypted API key
3. Redirected to models list

**Verify:**
- Model appears in models list
- Shows "HuggingFace" provider badge
- Functions icon (✨) is displayed

---

## Using Models in Chat

### Step 1: Navigate to Chat

1. Click "Chat" in navigation
2. Look for model selector dropdown

### Step 2: Select Your Model

1. Click model selector dropdown
2. Find your imported model: `Qwen3 Tool Use V1`
3. Click to select

### Step 3: Start Chatting

**Test Prompt 1: Basic Response**
```
User: What is 2 + 2?
Model: 2 + 2 equals 4.
```

**Test Prompt 2: Tool Calling (if trained on tool use)**
```
User: What's the weather in San Francisco?
Model: I'll use the weather tool to check.

[Tool Call: get_weather(location="San Francisco")]
```

**Test Prompt 3: Complex Reasoning**
```
User: I have a meeting at 3pm PST. What time is that in Tokyo?
Model: PST is UTC-8, Tokyo is UTC+9.
3pm PST = 11pm PST same day = 8am Tokyo next day.
```

### Step 4: Monitor Performance

- **Latency:** First message: 10-30s (cold start), subsequent: 2-5s
- **Token Count:** Check message metadata for input/output tokens
- **Tool Usage:** Look for 🔧 "Tools Used" section below responses

### Step 5: Session Tagging (Optional)

To track model performance:
1. Click "Tag Session" in chat header
2. Enter Session ID: `qwen3-test-1`
3. Enter Experiment Name: `Tool Use Accuracy Test`
4. Use model for testing
5. View analytics later to compare with other models

---

## Troubleshooting

### Issue: Training Out of Memory

**Error:** `CUDA out of memory`

**Solutions:**
1. Reduce batch size: `"batch_size": 2`
2. Increase gradient accumulation: `"gradient_accumulation_steps": 16`
3. Use smaller LoRA rank: `"lora_r": 4`
4. Enable gradient checkpointing in train.py

### Issue: Cold Start Delays

**Symptom:** First request takes 30+ seconds

**Explanation:** HuggingFace Inference API loads models on-demand (cold start)

**Solutions:**
1. **Wait:** Subsequent requests will be fast
2. **Keep active:** Send request every 15 minutes to keep model loaded
3. **Upgrade:** HuggingFace Pro has faster cold starts
4. **Self-host:** Use vLLM or Ollama for instant responses

### Issue: Connection Test Fails

**Error:** `Failed to connect to model`

**Checks:**
1. Model ID format: `username/model-name` (not `https://...`)
2. Model visibility: Public or token has access
3. Model status: Check HuggingFace model page
4. API token: Verify at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
5. Network: Check firewall/proxy settings

### Issue: Model Not Responding in Chat

**Checks:**
1. Model selected in dropdown?
2. Check browser console for errors (F12)
3. Check server logs: `npm run dev` output
4. Test with different prompt
5. Try public model (e.g., `gpt2`) to isolate issue

### Issue: Low Quality Responses

**Possible Causes:**
1. **Undertrained:** Too few epochs or samples
2. **Wrong dataset:** Dataset doesn't match use case
3. **Overfit:** Too many epochs on small dataset
4. **Learning rate:** Too high or too low

**Solutions:**
1. Increase training samples: `"max_samples": 2000`
2. Train longer: `"num_epochs": 3`
3. Try different dataset: `"strategy": "knowledge_dense"`
4. Adjust learning rate: `"learning_rate": 1e-5` (lower) or `1e-4` (higher)

### Issue: Model Returns Empty Responses

**Checks:**
1. Max output tokens too low? Increase to `2048`
2. Temperature too low? Try `0.7`
3. Check HuggingFace model page for errors
4. Test with simple prompt: "Hello"

---

## Advanced Topics

### Custom Datasets

Create custom training data:

```python
# datasets/my_custom_data.json
[
  {
    "messages": [
      {"role": "user", "content": "What is X?"},
      {"role": "assistant", "content": "X is..."}
    ]
  }
]
```

Update config:
```json
{
  "data": {
    "strategy": "custom",
    "data_path": "datasets/my_custom_data.json"
  }
}
```

### DPO Training (Advanced)

For better alignment, use DPO after SFT:

```json
{
  "training": {
    "method": "dpo",
    "beta": 0.1,
    "sft_model_path": "outputs/my_run/merged_model"
  }
}
```

### Self-Hosted Inference (vLLM)

For faster inference without cold starts:

```bash
# Install vLLM
pip install vllm

# Start server
vllm serve yourname/qwen3-0.6b-tool-use-v1 \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 1

# Import in web-ui as vLLM model
# Base URL: http://localhost:8000/v1
# Model ID: yourname/qwen3-0.6b-tool-use-v1
```

### Model Quantization

Reduce model size for faster inference:

```bash
# Install llama.cpp
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp && make

# Convert to GGUF
python convert.py outputs/my_run/merged_model

# Quantize to 4-bit
./quantize outputs/my_run/merged_model/ggml-model-f16.gguf \
            outputs/my_run/merged_model/ggml-model-q4_0.gguf q4_0

# Use with Ollama
ollama create my-model -f Modelfile
```

### Training Metadata Tracking

When importing, you can track training metadata:

```typescript
// In AddModelDialog, optionally fill:
{
  training_method: "sft",
  base_model: "Qwen/Qwen3-0.6B",
  training_dataset: "ToolBench",
  training_date: "2025-10-15",
  lora_config: { r: 8, alpha: 32, dropout: 0.05 },
  evaluation_metrics: { accuracy: 0.95, loss: 0.18, token_acceptance: 0.92 }
}
```

This helps track model provenance in analytics.

---

## Additional Resources

- **Tiny Tool Use Repo:** `/home/juanc/Desktop/claude_desktop/bagel-RL/Tiny Tool Use/`
- **HuggingFace Docs:** [huggingface.co/docs](https://huggingface.co/docs)
- **Qwen3 Model:** [huggingface.co/Qwen/Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B)
- **LoRA Paper:** [arxiv.org/abs/2106.09685](https://arxiv.org/abs/2106.09685)
- **vLLM Docs:** [docs.vllm.ai](https://docs.vllm.ai)

---

## Quick Reference

### Training Commands
```bash
# Train model
python train.py --config configs/my_config.json --output-dir ./outputs/run1

# Merge LoRA
python save_merge_model.py --base_model Qwen/Qwen3-0.6B --adapter_path outputs/run1/checkpoint-final --output_dir outputs/run1/merged

# Upload to HuggingFace
huggingface-cli upload myname/model-v1 outputs/run1/merged
```

### Import Steps
1. Models page → Add Model
2. Select "Import Custom Model" template
3. Enter Model ID: `myname/model-v1`
4. Enter API Key (from HuggingFace)
5. Test Connection
6. Create Model

### Chat Usage
1. Chat page → Select model from dropdown
2. Start chatting
3. Monitor performance in message metadata

---

**Questions?** Check [MINOR_ISSUES_LOG.md](./MINOR_ISSUES_LOG.md) for known issues.

**Need Help?** File an issue in the repo or check HuggingFace community forums.
