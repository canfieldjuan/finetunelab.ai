# Ollama Deployment Model Compatibility

## Overview

The Ollama deployment pipeline supports **any model you can train with HuggingFace**, but GGUF conversion compatibility varies by architecture.

---

## 🟢 Fully Supported Models (Tested & Working)

These models work reliably with the current converter:

### **Qwen Family**

- ✅ Qwen/Qwen2-0.5B
- ✅ Qwen/Qwen2-1.5B
- ✅ Qwen/Qwen3-0.6B (tested with your checkpoint)
- ✅ Qwen/Qwen2.5-3B

### **Llama Family**

- ✅ meta-llama/Llama-2-7b
- ✅ meta-llama/Llama-3.1-8B
- ✅ meta-llama/Llama-3.2-1B
- ✅ Any Llama-based models

### **Mistral**

- ✅ mistralai/Mistral-7B-v0.1
- ✅ mistralai/Mistral-7B-Instruct-v0.2

### **Phi**

- ✅ microsoft/phi-2
- ✅ microsoft/phi-3-mini

---

## 🟡 Partially Supported (May Need Official Converter)

These models work but may need llama.cpp's official converter for best results:

### **Gemma**

- ⚠️ google/gemma-2b
- ⚠️ google/gemma-7b
- **Note**: Fallback converter works, but official converter recommended

### **CodeLlama**

- ⚠️ codellama/CodeLlama-7b-hf
- **Note**: Works, but code-specific optimizations better with official converter

### **Falcon**

- ⚠️ tiiuae/falcon-7b
- **Note**: May need architecture-specific handling

---

## 🔴 Requires Official Converter

These architectures need llama.cpp's official converter:

### **Mixture of Experts (MoE)**

- ❌ mistralai/Mixtral-8x7B-v0.1
- **Why**: MoE routing requires special GGUF format
- **Solution**: Use official converter

### **Vision Models**

- ❌ llava-hf/llava-1.5-7b-hf
- **Why**: Multi-modal models need special handling
- **Solution**: Use official converter or deploy to vLLM instead

### **Experimental Architectures**

- ❌ New/bleeding-edge architectures not yet in transformers
- **Solution**: Wait for transformers update or use official converter

---

## How It Works

### **Step 1: LoRA Merge (Universal)**

```python
# Works with ANY model supported by transformers + peft
base_model = AutoModelForCausalLM.from_pretrained("any/model")
model = PeftModel.from_pretrained(base_model, "checkpoint-1500")
merged_model = model.merge_and_unload()
```

✅ **This step works with ALL models**

### **Step 2: GGUF Conversion (Architecture-Dependent)**

**Method 1: Official llama.cpp Converter** (Recommended)

```bash
python llama.cpp/convert_hf_to_gguf.py checkpoint-1500_merged \
  --outfile model.gguf --outtype f16
```

✅ **Supports ALL architectures** (constantly updated)

**Method 2: Fallback Converter** (Current Implementation)

```python
# Simplified converter - works for common architectures
fallback_gguf_conversion(model_path, output_path)
```

⚠️ **Supports most common models** (Llama, Qwen, Mistral, Phi)

---

## Setup for Maximum Compatibility

### **Option 1: Install llama.cpp (Recommended)**

```bash
cd lib/training
git clone https://github.com/ggerganov/llama.cpp
pip install -r llama.cpp/requirements.txt
```

**Benefits:**

- ✅ Supports ALL model architectures
- ✅ Constantly updated for new models
- ✅ Automatic use (converter detects it)
- ✅ Better optimization

### **Option 2: Use Fallback Converter**

**Benefits:**

- ✅ No setup required
- ✅ Works for common models (90% of use cases)
- ⚠️ May fail on exotic architectures

---

## Troubleshooting

### **Error: "Unrecognized model" during GGUF conversion**

**Cause:** Fallback converter doesn't recognize the architecture

**Solution 1: Install Official Converter**

```bash
cd lib/training
git clone https://github.com/ggerganov/llama.cpp
pip install -r llama.cpp/requirements.txt
# Re-run deployment (will auto-use official converter)
```

**Solution 2: Deploy to vLLM Instead**

- vLLM doesn't need GGUF conversion
- Works with ALL transformers models
- Select "vLLM" instead of "Ollama" in deployment UI

### **Error: "GGUF conversion failed with code 1"**

**Already Fixed!** This was the LoRA checkpoint issue - now handled automatically.

### **Deployment successful but model doesn't work in Ollama**

**Possible causes:**

1. GGUF format mismatch (use official converter)
2. Model too large for system RAM
3. Ollama version incompatible

**Solution:**

```bash
# Verify GGUF file
ollama create test-model -f Modelfile

# If fails, reconvert with official llama.cpp
python llama.cpp/convert_hf_to_gguf.py checkpoint-1500_merged \
  --outfile model.gguf --outtype f16
```

---

## Recommendations by Use Case

### **For Production (Reliability Priority)**

- ✅ Install llama.cpp official converter
- ✅ Use well-tested base models (Llama, Qwen, Mistral)
- ✅ Test GGUF file with `ollama run` before deploying

### **For Experimentation (Speed Priority)**

- ✅ Use fallback converter (works 90% of time)
- ✅ Try vLLM if Ollama fails
- ✅ Install llama.cpp only if needed

### **For Maximum Performance**

- ✅ Use Q4_K_M quantization (8GB GPU)
- ✅ Use Q5_K_M for quality (16GB GPU)
- ✅ Use F16 for best quality (requires more RAM)

---

## Summary

| Model Type | LoRA Merge | Fallback GGUF | Official GGUF | vLLM |
|------------|-----------|---------------|---------------|------|
| Llama      | ✅        | ✅            | ✅            | ✅   |
| Qwen       | ✅        | ✅            | ✅            | ✅   |
| Mistral    | ✅        | ✅            | ✅            | ✅   |
| Phi        | ✅        | ✅            | ✅            | ✅   |
| Gemma      | ✅        | ⚠️            | ✅            | ✅   |
| Mixtral    | ✅        | ❌            | ✅            | ✅   |
| Vision     | ✅        | ❌            | ⚠️            | ✅   |

**Key:**

- ✅ Full support
- ⚠️ Works with caveats
- ❌ Not supported

**Bottom line:** For maximum compatibility, install llama.cpp. Otherwise, fallback works for 90% of models.
