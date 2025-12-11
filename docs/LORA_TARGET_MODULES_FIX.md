# LoRA Target Modules Fix

**Date:** 2025-11-30
**Issue:** UI showed only 4 target modules (attention-only) instead of all 7 modules for Mistral/Llama

---

## 🐛 The Problem

User reported seeing only `q_proj, k_proj, v_proj, o_proj` in UI for Mistral finetuning, but expected all 7 modules including MLP layers.

### Root Cause:
**Inconsistent defaults across codebase:**

1. **Backend Auto-Detection (Correct):**
   - `/lib/training/runpod-service.ts:399-400` - Returns all 7 modules for Mistral
   - Auto-detects architecture and applies correct modules

2. **UI Hardcoded Defaults (Incorrect):**
   - `/components/training/ConfigEditor.tsx:917` - Defaulted to 4 modules
   - `/lib/training/google-colab-service.ts:319` - Defaulted to 4 modules
   - `/lib/training/kaggle-service.ts:288` - Defaulted to 4 modules

### Impact:
- Users saw "budget/experimentation" config (4 modules) instead of "production" config (7 modules)
- Training on Google Colab/Kaggle used suboptimal configuration
- RunPod/Lambda auto-corrected but UI still showed wrong defaults

---

## ✅ The Fix

Updated all hardcoded defaults to match backend auto-detection:

### 1. UI Config Editor
**File:** `/components/training/ConfigEditor.tsx`
**Line:** 917

**Before:**
```typescript
value={config.training.lora_config?.target_modules?.join(', ') || 'q_proj, k_proj, v_proj, o_proj'}
```

**After:**
```typescript
value={config.training.lora_config?.target_modules?.join(', ') || 'q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj'}
```

**Updated help text:**
```
Default (recommended): All 7 modules (attention + MLP) for best quality
q_proj, k_proj, v_proj, o_proj: Attention mechanism
gate_proj, up_proj, down_proj: Feed-forward network (MLP)
Budget option: Remove MLP modules to save 40% VRAM (slight quality loss)
```

### 2. Google Colab Service
**File:** `/lib/training/google-colab-service.ts`
**Line:** 319

**Before:**
```typescript
const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj"];
```

**After:**
```typescript
const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"];
```

### 3. Kaggle Service
**File:** `/lib/training/kaggle-service.ts`
**Line:** 288

**Before:**
```typescript
const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj"];
```

**After:**
```typescript
const targetModules = (loraConfig?.target_modules as string[]) || ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"];
```

---

## 📋 Target Modules by Architecture

### Mistral (and Llama, Gemma)
```python
['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
```

**Breakdown:**
- **Attention (4 modules):** `q_proj`, `k_proj`, `v_proj`, `o_proj`
- **MLP/FFN (3 modules):** `gate_proj`, `up_proj`, `down_proj`

### Phi
```python
['q_proj', 'k_proj', 'v_proj', 'dense', 'fc1', 'fc2']
```

### GPT-2
```python
['c_attn', 'c_proj']
```

### BERT
```python
['query', 'key', 'value']
```

---

## 🎯 Configuration Options

### Option 1: Full Adaptation (Recommended - Now Default)
```python
target_modules = ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
```
- ✅ Best quality
- ✅ Adapts both attention and MLP
- ❌ Higher VRAM (~18-20GB for Mistral-7B)
- **Use when:** You have enough VRAM and want best results

### Option 2: Attention-Only (Budget)
```python
target_modules = ['q_proj', 'k_proj', 'v_proj', 'o_proj']
```
- ⚠️ Good quality (slight degradation)
- ✅ Lower VRAM (~14-16GB for Mistral-7B)
- **Use when:** Limited VRAM or experimentation

### Option 3: Minimal (Q+V only)
```python
target_modules = ['q_proj', 'v_proj']
```
- ❌ Lower quality
- ✅ Lowest VRAM (~12-14GB for Mistral-7B)
- **Use when:** Very tight on VRAM

---

## 🧪 Testing

To verify the fix works:

1. **Create new training config in UI:**
   - Select Mistral or Llama model
   - Check LoRA config section
   - Should show all 7 modules by default

2. **Submit training job:**
   - RunPod: Auto-detection should match UI default (7 modules)
   - Colab/Kaggle: Should now use 7 modules instead of 4

3. **Check training logs:**
   ```
   [LoRA] Target modules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
   ```

---

## 📊 Impact Comparison

### Before Fix:
```
Colab/Kaggle: 4 modules (attention only)
RunPod/Lambda: 7 modules (auto-corrected)
UI Display: 4 modules (confusing mismatch)
```

### After Fix:
```
Colab/Kaggle: 7 modules (full adaptation)
RunPod/Lambda: 7 modules (consistent)
UI Display: 7 modules (accurate)
```

---

## 💡 Key Takeaways

1. **Default is now optimal:** All 7 modules for maximum quality
2. **Users can still customize:** Edit the comma-separated list in UI
3. **Consistent across platforms:** Colab, Kaggle, RunPod, Lambda all use same defaults
4. **Better documentation:** UI help text explains trade-offs clearly

---

## 🔗 Related Files

- Backend auto-detection: `/lib/training/runpod-service.ts` (lines 388-416)
- UI config editor: `/components/training/ConfigEditor.tsx` (line 917)
- Colab service: `/lib/training/google-colab-service.ts` (line 319)
- Kaggle service: `/lib/training/kaggle-service.ts` (line 288)

---

**End of Document**
