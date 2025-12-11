# Pretokenization Response Masking Fix - Implementation Plan
**Date:** 2025-12-09
**Status:** AWAITING APPROVAL
**Priority:** CRITICAL - Training Quality Issue

---

## Executive Summary

### The Problem
Pretokenization (`training.pretokenize=true`) completely bypasses response template masking in SFT training, causing models to learn to repeat prompts instead of only generating responses. This results in:
- Repetitive output (model echoes user questions)
- Verbose responses (learning conversation structure instead of content)
- Training degradation (overfitting to format, catastrophic failures)

### Root Cause
1. `_pretokenize_dataset()` tokenizes full conversations without masking (lines 3142-3151)
2. Creates dataset with `input_ids` column
3. SFT training detects `is_pretokenized=True` (line 1894)
4. Blocks `DataCollatorForCompletionOnlyLM` creation (line 1974)
5. Model trains on full sequences (prompt + response) instead of response-only

### Verification Evidence
- ✅ ChatML template detection works correctly
- ✅ DataCollatorForCompletionOnlyLM implementation is correct
- ❌ Pretokenization creates unmasked tokens
- ❌ Masking never applied when `pretokenize=true`
- ✅ User's symptoms match exact pattern of unmasked training

### Solution Overview
Implement masking-aware pretokenization that applies response template masking **during** tokenization phase, storing masked labels alongside input_ids. This preserves performance benefits while ensuring correct training behavior.

---

## Technical Analysis

### Current Code Flow (BROKEN)

```
User Config: pretokenize=true
    ↓
_pretokenize_dataset() called (line 1194)
    ↓
tokenizer.apply_chat_template() - FULL SEQUENCE (line 3144)
    ↓
Dataset with input_ids created (NO MASKING)
    ↓
is_pretokenized=True detected (line 1894)
    ↓
DataCollatorForCompletionOnlyLM SKIPPED (line 1974)
    ↓
SFTTrainer trains on FULL SEQUENCE ❌
    ↓
Model learns to repeat prompts (BROKEN BEHAVIOR)
```

### Proposed Code Flow (FIXED)

```
User Config: pretokenize=true
    ↓
_pretokenize_dataset_with_masking() called
    ↓
tokenizer.apply_chat_template() - FULL SEQUENCE
    ↓
Detect response_template in formatted text
    ↓
Create labels array: prompt_tokens=-100, response_tokens=input_ids
    ↓
Dataset with input_ids + labels created (MASKING APPLIED)
    ↓
is_pretokenized=True detected
    ↓
SFTTrainer uses pre-masked labels ✅
    ↓
Model trains ONLY on responses (CORRECT BEHAVIOR)
```

### Files Affected

| File | Lines | Changes | Risk |
|------|-------|---------|------|
| `standalone_trainer.py` | 3058-3199 | Modify `_pretokenize_dataset()` | Medium |
| `standalone_trainer.py` | 1950-1999 | Update masking detection logic | Low |
| `standalone_trainer.py` | 3094-3101 | Update cache hash to include masking | Low |
| `training-config.types.ts` | 174-197 | Update pretokenize documentation | None |

**Files NOT Affected:**
- ✅ DPO/ORPO training (use preference pairs, different objective)
- ✅ Non-pretokenized SFT (existing masking works correctly)
- ✅ UI components (backend-only change)
- ✅ Database schema (no new columns needed)
- ✅ RunPod service (uses standalone_trainer.py)

---

## Implementation Plan

### Phase 1: Add Masking Logic to Pretokenization
**File:** `standalone_trainer.py`
**Function:** `_pretokenize_dataset()` (lines 3058-3199)

#### 1.1: Detect Response Template (Insert after line 3136)
```python
# Detect response template for masking (same logic as SFT training)
response_template = None
if hasattr(tokenizer, 'chat_template') and tokenizer.chat_template:
    template_str = str(tokenizer.chat_template)
    if "<|start_header_id|>assistant<|end_header_id|>" in template_str:
        response_template = "<|start_header_id|>assistant<|end_header_id|>\n\n"
        logger.info("[PreTokenize] Detected Llama 3 template, will apply masking")
    elif "<|im_start|>assistant" in template_str:
        response_template = "<|im_start|>assistant\n"
        logger.info("[PreTokenize] Detected ChatML template, will apply masking")
    elif "[/INST]" in template_str:
        response_template = " [/INST] "
        logger.info("[PreTokenize] Detected Mistral template, will apply masking")

if response_template:
    logger.info(f"[PreTokenize] Response masking enabled with template: {repr(response_template)}")
else:
    logger.warning("[PreTokenize] No response template detected - training will be on full sequences")
```

**Insertion Point:** After line 3136 (`logger.info(f"[PreTokenize] Max length: {max_length}")`)

#### 1.2: Apply Masking During Tokenization (Modify lines 3138-3167)
```python
def tokenize_example(example):
    """Tokenize a single example and apply response masking if template detected."""
    try:
        # Format the example to text
        if "messages" in example:
            messages = example["messages"]
            result = tokenizer.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=False,
                return_dict=True,
                max_length=max_length,
                truncation=True
            )
        else:
            # Fallback to formatting_func for text-based data
            text = formatting_func(example)
            result = tokenizer(
                text,
                max_length=max_length,
                truncation=True,
                padding=False,
                return_tensors=None
            )

        # Apply response masking if template detected
        if response_template:
            input_ids = result['input_ids']
            labels = list(input_ids)  # Copy input_ids

            # Find response start position
            # Encode response template to get token sequence
            response_template_ids = tokenizer.encode(
                response_template,
                add_special_tokens=False
            )

            # Search for response template in input_ids
            response_start_idx = None
            for i in range(len(input_ids) - len(response_template_ids) + 1):
                if input_ids[i:i+len(response_template_ids)] == response_template_ids:
                    response_start_idx = i + len(response_template_ids)
                    break

            # Mask prompt tokens (set to -100)
            if response_start_idx is not None:
                for i in range(response_start_idx):
                    labels[i] = -100
            else:
                # Fallback: mask everything (training will skip this example)
                logger.warning("[PreTokenize] Could not find response template in tokenized sequence")
                labels = [-100] * len(labels)

            result['labels'] = labels
        else:
            # No masking - labels = input_ids (trains on full sequence)
            result['labels'] = list(result['input_ids'])

        return result

    except Exception as e:
        logger.error(f"[PreTokenize] Error tokenizing example: {e}")
        return {"input_ids": [], "attention_mask": [], "labels": []}
```

**Modification:** Replace function at lines 3138-3167

#### 1.3: Update Cache Hash to Include Masking (Modify lines 3094-3101)
```python
# Create hash of relevant config parameters
config_params = {
    "model": model_name,
    "max_length": config.get("training", {}).get("max_length", DEFAULT_MAX_LENGTH_PPO),
    "dataset_path": config.get("dataset_path", ""),
    "masking_version": "v1"  # NEW: Invalidate old caches without masking
}
```

**Modification:** Add `"masking_version": "v1"` to config_params dict

**Cache Impact:** This will invalidate all existing pretokenized caches (intentional - old caches are unmasked and broken)

---

### Phase 2: Update SFT Training to Use Pre-Masked Labels
**File:** `standalone_trainer.py`
**Section:** `_train_sft()` (lines 1896-1999)

#### 2.1: Update Pretokenized Dataset Detection (Modify line 1896-1900)
```python
if is_pretokenized:
    logger.info("[SFT] Detected pre-tokenized dataset (has 'input_ids' column)")
    logger.info(f"[SFT] Dataset columns: {dataset_columns}")

    # Check if labels column exists (masking-aware pretokenization)
    if "labels" in dataset_columns:
        logger.info("[SFT] Dataset has 'labels' column - response masking already applied during pretokenization")
        logger.info("[SFT] Skipping formatting_func and DataCollatorForCompletionOnlyLM (using pre-masked labels)")
    else:
        logger.warning("[SFT] Dataset missing 'labels' column - old cache format detected")
        logger.warning("[SFT] Training will be on FULL SEQUENCES (not masked) - consider clearing tokenized_cache/")

    formatting_func = None
```

**Modification:** Add labels column check at line 1896-1900

#### 2.2: Update Data Collator Logic (Modify lines 1973-1988)
```python
data_collator = None
if response_template and not is_pretokenized:
    # Only use DataCollatorForCompletionOnlyLM for non-pretokenized datasets
    # Pretokenized datasets already have masking applied in labels column
    try:
        data_collator = DataCollatorForCompletionOnlyLM(
            response_template=response_template,
            tokenizer=self.tokenizer,
            mlm=False
        )
        logger.info(f"[SFT] Using DataCollatorForCompletionOnlyLM with response_template: {response_template}")
    except Exception as e:
        logger.warning(f"[SFT] Failed to create DataCollatorForCompletionOnlyLM: {e}")
        logger.warning("[SFT] Falling back to default collator - model will train on full sequence")
        data_collator = None
elif is_pretokenized and "labels" in dataset_columns:
    # Pretokenized with masking - use default collator (labels already masked)
    logger.info("[SFT] Using default data collator (labels pre-masked during tokenization)")
    data_collator = None
```

**Modification:** Update logic at lines 1973-1988 to handle pre-masked labels

---

### Phase 3: Update Documentation
**File:** `training-config.types.ts`
**Lines:** 174-197 (pretokenize parameter documentation)

#### 3.1: Add Masking Information to Documentation
```typescript
/**
 * Pre-tokenize datasets before training to eliminate CPU bottleneck.
 *
 * When enabled, datasets are tokenized once before training starts and cached to disk.
 * This eliminates on-the-fly tokenization overhead during training, significantly
 * improving training throughput (especially with dataloader_num_workers > 0).
 *
 * IMPORTANT: Response template masking is applied DURING pretokenization for SFT training.
 * The model will only learn to generate responses, not repeat prompts.
 *
 * Benefits:
 * - 50-100x faster training throughput (eliminates CPU tokenization bottleneck)
 * - Tokenization happens once before training (not per-epoch or per-batch)
 * - Results cached to disk for reuse across training runs
 * - Reduces CPU usage during training
 * - Automatic response masking for SFT (prompt tokens masked with -100)
 *
 * Trade-offs:
 * - Initial tokenization takes time (one-time cost)
 * - Cached files use disk space (~1-2GB per dataset)
 * - Cache invalidated if model, max_length, dataset, or masking version changes
 *
 * Recommended: true for production training, false for quick experiments
 * Default: false (backward compatible)
 *
 * @default false
 */
pretokenize?: boolean;
```

**Modification:** Update lines 174-197

---

## Verification Plan

### Test 1: Pretokenized SFT with Masking
**Objective:** Verify masking is applied during pretokenization

**Steps:**
1. Clear cache: `rm -rf /home/juan-canfield/Desktop/web-ui/lib/training/tokenized_cache/`
2. Create test config with `pretokenize=true`
3. Start training with Qwen/Qwen2.5-7B-Instruct
4. Check logs for:
   - `[PreTokenize] Detected ChatML template, will apply masking`
   - `[PreTokenize] Response masking enabled with template`
   - `[SFT] Dataset has 'labels' column - response masking already applied`

**Expected Result:**
- Log shows masking detection
- Dataset has `input_ids`, `attention_mask`, `labels` columns
- Labels column contains -100 for prompt tokens

### Test 2: Inspect Pretokenized Dataset
**Objective:** Verify labels are correctly masked

**Steps:**
```python
from datasets import Dataset

# Load pretokenized dataset from cache
cache_dir = "tokenized_cache/Qwen_Qwen2.5-7B-Instruct_<hash>/train"
dataset = Dataset.load_from_disk(cache_dir)

# Check first example
example = dataset[0]
print("Columns:", dataset.column_names)
print("Input IDs:", example['input_ids'][:50])
print("Labels:", example['labels'][:50])
print("Masked tokens:", sum(1 for x in example['labels'] if x == -100))
print("Training tokens:", sum(1 for x in example['labels'] if x != -100))
```

**Expected Result:**
- Dataset has `labels` column
- First N tokens are -100 (masked prompt)
- Remaining tokens match input_ids (trainable response)

### Test 3: Training Quality Check
**Objective:** Verify model trains correctly with masked pretokenization

**Steps:**
1. Train for 50 steps with `pretokenize=true` and predictions enabled
2. Check predictions at step 50
3. Compare to previous unmasked training

**Expected Result:**
- NO repetitive prompt echoing
- Responses focused and on-topic from step 0
- No verbose conversation structure mimicry

### Test 4: Backward Compatibility
**Objective:** Verify non-pretokenized training still works

**Steps:**
1. Train with `pretokenize=false`
2. Check logs for DataCollatorForCompletionOnlyLM usage
3. Verify predictions are normal

**Expected Result:**
- DataCollatorForCompletionOnlyLM created
- Training proceeds normally
- No breaking changes

### Test 5: DPO/ORPO Unaffected
**Objective:** Verify preference-based training not broken

**Steps:**
1. Test DPO training with same config
2. Verify no errors related to masking

**Expected Result:**
- DPO training works (doesn't use masking)
- No new errors introduced

---

## Rollback Plan

### If Implementation Breaks Training:

**Immediate Rollback:**
1. Revert changes to `_pretokenize_dataset()` function
2. Clear cache: `rm -rf tokenized_cache/`
3. Notify user to use `pretokenize=false` temporarily

**Fallback Option:**
- Add config flag `pretokenize_with_masking` (default: true)
- Allow users to disable masking if needed

**Cache Management:**
- Old caches will be invalidated by masking_version change
- Users can manually clear: `rm -rf tokenized_cache/`

---

## Migration Guide for Users

### For Users with Existing Pretokenized Training:

**Impact:**
- Your existing `tokenized_cache/` directory contains unmasked data
- After this fix, caches will be regenerated with masking
- First training after update will re-tokenize (one-time cost)

**Action Required:**
1. **Recommended:** Clear cache before first training:
   ```bash
   rm -rf /home/juan-canfield/Desktop/web-ui/lib/training/tokenized_cache/
   ```

2. **Optional:** Keep old cache if you want to compare:
   ```bash
   mv tokenized_cache/ tokenized_cache_OLD/
   ```

**Timeline:**
- Cache regeneration: ~30 seconds to 5 minutes (depending on dataset size)
- Happens once per model/dataset combination
- Subsequent trainings use cached version

### For Users Training Without Pretokenization:

**Impact:** NONE - Your training already uses DataCollatorForCompletionOnlyLM correctly

---

## Success Criteria

### Must Have (Blocking):
- ✅ Pretokenized datasets have `labels` column with masking
- ✅ SFT training detects pre-masked labels
- ✅ Training logs show masking applied
- ✅ Predictions show no prompt repetition
- ✅ Non-pretokenized training unaffected
- ✅ DPO/ORPO training unaffected

### Should Have (Important):
- ✅ Cache invalidation works correctly
- ✅ Clear error messages if old cache detected
- ✅ Performance matches previous pretokenization
- ✅ Documentation updated

### Nice to Have (Optional):
- Cache migration script for existing users
- Validation script to check pretokenized datasets
- Diagnostic command to inspect cache health

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Break existing training | Low | High | Extensive testing, backward compat checks |
| Cache corruption | Low | Medium | Version hash invalidates old caches |
| Performance regression | Very Low | Medium | Masking logic is simple token replacement |
| Breaking DPO/ORPO | Very Low | High | No changes to DPO/ORPO code paths |
| Wrong masking logic | Low | High | Test with multiple chat templates |

**Overall Risk:** LOW-MEDIUM (well-isolated change, clear rollback path)

---

## Timeline Estimate

### Development:
- Phase 1 (Masking Logic): 30 minutes
- Phase 2 (SFT Integration): 20 minutes
- Phase 3 (Documentation): 10 minutes
- **Total Development:** ~1 hour

### Testing:
- Test 1-2 (Basic): 20 minutes
- Test 3 (Training): 15 minutes
- Test 4-5 (Compatibility): 10 minutes
- **Total Testing:** ~45 minutes

### **Total Implementation:** ~1.75 hours

---

## Implementation Order

1. **FIRST:** Update `_pretokenize_dataset()` with masking logic (Phase 1)
2. **SECOND:** Update SFT training to use pre-masked labels (Phase 2)
3. **THIRD:** Update documentation (Phase 3)
4. **FOURTH:** Clear old cache and verify
5. **FIFTH:** Run test suite (Tests 1-5)
6. **SIXTH:** Monitor first real training job

---

## Open Questions

1. **Q:** Should we support disabling masking for edge cases?
   **A:** Not initially - can add `pretokenize_with_masking=false` if needed

2. **Q:** What about other chat templates (Phi, Gemma, etc.)?
   **A:** Current detection covers major families (Llama, ChatML, Mistral). Can expand as needed.

3. **Q:** Should we migrate existing caches?
   **A:** No - simpler to invalidate and regenerate. Cache is fast to rebuild.

4. **Q:** What about custom formatting functions?
   **A:** Fallback path (lines 3153-3161) handles text-based data, but won't have masking. This is acceptable for custom formats.

---

## Code Review Checklist

Before implementation, verify:
- [ ] Read standalone_trainer.py lines 3058-3199 (pretokenization)
- [ ] Read standalone_trainer.py lines 1896-1999 (SFT training setup)
- [ ] Understand current masking logic (lines 1950-1988)
- [ ] Verify no other files depend on pretokenization format
- [ ] Check if RunPod service uses same code path
- [ ] Test plan covers all scenarios
- [ ] Rollback plan is clear
- [ ] Documentation explains the change

---

## Next Steps

**AWAITING USER APPROVAL**

Once approved:
1. Implement Phase 1 (Masking Logic)
2. Test pretokenization produces masked labels
3. Implement Phase 2 (SFT Integration)
4. Run verification tests
5. Clear cache and do full training run
6. Update documentation
7. Create session summary log

**DO NOT PROCEED WITHOUT EXPLICIT APPROVAL**

---

## Notes

- This is a **PERMANENT FIX**, not a workaround
- No breaking changes to user-facing APIs
- Backward compatible with non-pretokenized training
- Cache invalidation is intentional (old caches are broken)
- Performance should match or exceed current pretokenization
- Training quality will SIGNIFICANTLY improve for pretokenized SFT

---

**Author:** Claude Sonnet 4.5
**Reviewed By:** PENDING USER REVIEW
**Approved By:** PENDING
**Status:** AWAITING APPROVAL
