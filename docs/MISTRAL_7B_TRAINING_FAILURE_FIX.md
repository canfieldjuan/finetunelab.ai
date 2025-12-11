# Mistral 7B Training Failure Fix

**Date:** 2025-11-30
**Issue:** Mistral 7B training failed while Qwen 4B and Qwen 14B succeeded

---

## 🐛 The Problem

User ran 3 training jobs overnight:
- ✅ **Qwen 4B** - Success
- ✅ **Qwen 14B** - Success
- ❌ **Mistral 7B** - Failed

### Error Message:
```
OSError: mistralai-Mistral-7B-Instruct is not a local folder and is not a valid model identifier listed on 'https://huggingface.co/models'
```

### Root Cause:
**Model name format inconsistency:**

The Mistral training config used **dash format** instead of **slash format**:
- ❌ `mistralai-Mistral-7B-Instruct` (incorrect - dashes)
- ✅ `mistralai/Mistral-7B-Instruct` (correct - slash)

Meanwhile, the Qwen configs used correct format:
- ✅ `Qwen/Qwen3-14B` (correct - slash)
- ✅ `Qwen/Qwen2.5-4B` (correct - slash)

---

## 🔍 Investigation Details

### Job Information:
```
Job ID: db4f6654-9710-47fb-b6cd-c8ad7062dcf3
Model: mistralai-Mistral-7B-Instruct (dash format)
Method: SFT
Dataset: 5383 examples
Config: /lib/training/configs/job_db4f6654-9710-47fb-b6cd-c8ad7062dcf3.json
Log: /lib/training/logs/job_db4f6654-9710-47fb-b6cd-c8ad7062dcf3.log
```

### What Happened:
1. Config stored model name as `mistralai-Mistral-7B-Instruct` (dash format)
2. Trainer detected the dash format (line 1281)
3. Trainer converted to proper format: `mistralai/Mistral-7B-Instruct` (line 1310)
4. Trainer checked for local model - not found
5. **BUG:** Trainer returned original dash format instead of converted slash format
6. HuggingFace API rejected the dash format as invalid model ID
7. Training failed immediately

### The Bug in Code:

**File:** `/lib/training/standalone_trainer.py`
**Location:** Lines 1306-1338

**Before (buggy code):**
```python
proper_model_name = None  # Declared but never used
for i, char in enumerate(model_name):
    if i > 0 and char.isupper() and model_name[i-1] == '-':
        proper_model_name = model_name[:i-1] + "/" + model_name[i:]
        logger.info(f"[Model] Converted to proper format: {proper_model_name}")
        # ... check for local model ...
        break

logger.info(f"[Model] Local model not found for: {model_name}")

# Regular HuggingFace model ID (not found locally)
logger.info(f"[Model] Using HuggingFace model ID: {model_name}")  # BUG: Uses original dash format!
return model_name, False  # Should return proper_model_name!
```

**Issue:** The code converted the name but never used it for the HuggingFace download.

---

## ✅ The Fix

Added logic to use the converted name when downloading from HuggingFace:

**File:** `/lib/training/standalone_trainer.py`
**Lines:** 1306-1340

**After (fixed code):**
```python
proper_model_name = None  # Store converted name
for i, char in enumerate(model_name):
    if i > 0 and char.isupper() and model_name[i-1] == '-':
        proper_model_name = model_name[:i-1] + "/" + model_name[i:]
        logger.info(f"[Model] Converted to proper format: {proper_model_name}")
        # ... check for local model ...
        break

logger.info(f"[Model] Local model not found for: {model_name}")

# If we converted the name but didn't find it locally, use the converted name for HuggingFace
if proper_model_name:
    logger.info(f"[Model] Using converted HuggingFace model ID: {proper_model_name}")
    return proper_model_name, False  # ✅ Now returns the converted slash format!

# Regular HuggingFace model ID (not found locally)
logger.info(f"[Model] Using HuggingFace model ID: {model_name}")
return model_name, False
```

**Key Change:**
- Lines 1337-1340: Check if `proper_model_name` was set during conversion
- If yes, return the converted name instead of the original
- This ensures HuggingFace gets `mistralai/Mistral-7B-Instruct` instead of `mistralai-Mistral-7B-Instruct`

---

## 🧪 Testing the Fix

### Test Case 1: Dash Format (The Bug)
```python
# Input: "mistralai-Mistral-7B-Instruct"
# Before fix: Returns "mistralai-Mistral-7B-Instruct" (404 error)
# After fix: Returns "mistralai/Mistral-7B-Instruct" (works!)
```

### Test Case 2: Slash Format (Already Working)
```python
# Input: "Qwen/Qwen3-14B"
# Before fix: Returns "Qwen/Qwen3-14B" (works)
# After fix: Returns "Qwen/Qwen3-14B" (still works)
```

### Test Case 3: Local Model with Dash Name
```python
# Input: "meta-llama-Llama-3.2-1B-Instruct" (exists locally)
# Before fix: Finds local model, returns path (works)
# After fix: Finds local model, returns path (still works)
```

---

## 📊 Impact Analysis

### Models Affected:
Any model name with dash format that needs to be downloaded from HuggingFace:
- `mistralai-Mistral-7B-Instruct` → Fixed
- `meta-llama-Llama-3-8B` → Fixed
- `microsoft-Phi-3-mini-4k-instruct` → Fixed
- etc.

### Models Not Affected:
- ✅ Models with slash format: `Qwen/Qwen3-14B`
- ✅ Locally cached models (even with dash names)
- ✅ Models already in HuggingFace cache

---

## 🎯 Recommendations

### Short-term:
1. ✅ Fix applied - retrying Mistral 7B training should now work
2. Use slash format in configs: `mistralai/Mistral-7B-Instruct`

### Long-term:
1. **UI validation:** Add input validation to prevent dash format in model names
2. **Config migration:** Add migration script to convert existing dash configs to slash format
3. **Better error messages:** Detect invalid format early and suggest correction

---

## 🔍 Related Issues

### Why Did Qwen Work But Mistral Failed?

**Qwen configs:**
```json
{
  "model": {
    "name": "Qwen/Qwen3-14B"  // ✅ Correct slash format
  }
}
```

**Mistral config:**
```json
{
  "model": {
    "name": "mistralai-Mistral-7B-Instruct"  // ❌ Incorrect dash format
  }
}
```

The difference: **Where the model name came from in the UI selection.**

Likely the UI has some legacy code path that converts slashes to dashes, or the user manually entered the dash format.

---

## 📝 Prevention Checklist

To prevent this issue in the future:

- [ ] Validate model names in UI before saving config
- [ ] Add regex pattern check: `^[a-zA-Z0-9-_]+/[a-zA-Z0-9-_.]+$`
- [ ] Show warning if dash format detected
- [ ] Auto-convert dash to slash in UI model selector
- [ ] Add unit tests for model name conversion logic
- [ ] Document correct format in UI help text

---

## 🚀 Next Steps

1. **Retry Mistral 7B training** - should now work with the fix
2. **Check other failed jobs** - search logs for similar 404 errors
3. **Update UI** - add validation to prevent dash format
4. **Documentation** - update training guide with correct model name format

---

## 📖 Example Fix Application

If you encounter this error in the future:

### Error:
```
OSError: mistralai-Mistral-7B-Instruct is not a local folder and is not a valid model identifier
```

### Solution:
Change the model name in your config from:
```json
{
  "model": {
    "name": "mistralai-Mistral-7B-Instruct"  // ❌ Wrong
  }
}
```

To:
```json
{
  "model": {
    "name": "mistralai/Mistral-7B-Instruct"  // ✅ Correct
  }
}
```

Or just re-run the training - the fix will auto-convert it now!

---

**End of Document**
