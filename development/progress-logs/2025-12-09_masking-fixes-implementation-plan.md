# SFT Response Masking Fixes - Implementation Plan
**Date:** 2025-12-09
**Status:** AWAITING APPROVAL
**Session Type:** Permanent Fix Implementation Plan

---

## Executive Summary

This plan addresses 4 critical issues with SFT response masking that cause:
- Models training on prompts (wasting capacity)
- Models learning nothing (all tokens masked)
- Silent failures (no error messages)
- Prediction format mismatches (already fixed)

**Root Cause:** Masking logic has multiple failure modes with no fallbacks.

---

## Issues Analysis

### Issue 1: Misleading Log Message (LOW SEVERITY)
**Location:** `standalone_trainer.py:1959`
**Current Code:**
```python
logger.info("[SFT] Skipping formatting_func and DataCollatorForCompletionOnlyLM (using pre-masked labels)")
```

**Problem:** `DataCollatorForCompletionOnlyLM` doesn't exist in TRL 0.26.0 or transformers. Message confuses users.

**Impact:** Cosmetic - misleading but doesn't affect training.

**Affected Files:** `standalone_trainer.py` only

---

### Issue 2: No Masking for Non-Pretokenized Datasets (HIGH SEVERITY)
**Location:** `standalone_trainer.py:2037-2042`
**Current Code:**
```python
else:
    # Non-pretokenized: No masking available (TRL 0.26.0 limitation)
    logger.warning("[SFT] ⚠ Response masking: DISABLED (requires pretokenization)")
    logger.warning("[SFT] Training will be on FULL SEQUENCES")
    logger.warning("[SFT] To enable masking: set training.pretokenize=true in config")
    data_collator = None
```

**Problem:** When `data_collator=None`, SFTTrainer trains on full sequences (system + user + assistant). Model wastes capacity learning prompts instead of just responses.

**Impact:**
- Training quality degradation
- Model learns to repeat prompts
- Wasted GPU time and compute

**Current Workaround:** Users must enable `pretokenize=true`

**Affected Files:**
- `standalone_trainer.py` (main fix)
- `training-config.types.ts` (documentation update)

---

### Issue 3: Pretokenization Fallback Masks Everything (HIGH SEVERITY)
**Location:** `standalone_trainer.py:3265-3266`
**Current Code:**
```python
else:
    # Fallback: mask everything if template not found
    labels = [-100] * len(labels)
```

**Problem:** If response template isn't detected in tokenized sequence, fallback masks ALL tokens with -100. This means:
- Zero training signal
- Model learns nothing (0% loss because all labels ignored)
- Silent failure (no error raised)

**Impact:**
- Training completes "successfully" but model is unchanged
- Wasted GPU time (entire training run useless)
- No error message to alert user

**Scenarios When This Happens:**
1. Model uses unsupported chat template format
2. Template detection string doesn't match actual tokens
3. Tokenizer adds unexpected tokens/whitespace
4. Multi-turn conversations (multiple assistant responses)

**Affected Files:**
- `standalone_trainer.py` (main fix)
- Need test script to verify template detection

---

### Issue 4: Limited Template Detection (MEDIUM SEVERITY)
**Location:** `standalone_trainer.py:3202-3210`
**Current Code:**
```python
if "<|start_header_id|>assistant<|end_header_id|>" in template_str:
    response_template = "<|start_header_id|>assistant<|end_header_id|>\n\n"
elif "<|im_start|>assistant" in template_str:
    response_template = "<|im_start|>assistant\n"
elif "[/INST]" in template_str:
    response_template = " [/INST] "
```

**Problem:** Only 3 template formats supported:
- Llama 3: `<|start_header_id|>assistant<|end_header_id|>`
- ChatML (Qwen, Yi, etc.): `<|im_start|>assistant`
- Mistral: `[/INST]`

**Missing Templates:**
- Gemma: `<start_of_turn>model`
- Phi-3: `<|assistant|>`
- Command-R: `<|CHATBOT_TOKEN|>`
- Zephyr: `<|assistant|>`
- Others

**Impact:**
- Falls back to Issue 3 (masks everything) for unsupported models
- Users must manually add templates or switch models

**Affected Files:**
- `standalone_trainer.py` (template detection)
- Need comprehensive template registry

---

## Dependencies and Conflicts

### Files Involved
1. **`standalone_trainer.py`** - Main training logic (all 4 issues)
2. **`training-config.types.ts`** - Type definitions and docs (Issue 2 docs)
3. **Test files** - Need new tests for template detection

### Functions Affected
- `_train_sft()` - SFT training orchestration (Issues 1, 2)
- `_pretokenize_dataset()` - Pretokenization with masking (Issues 3, 4)
- Template detection logic (Issue 4)

### NOT Affected
- `_train_dpo()` - Uses preference datasets, different logic
- `_train_orpo()` - Uses preference datasets, different logic
- `runpod-service.ts` - Doesn't use pretokenization
- `predictions_generator.py` - Already fixed (2025-12-09)
- `predictions_sampler.py` - Already fixed (2025-12-09)

---

## Phased Implementation Plan

### Phase 1: Low-Hanging Fruit (Issue 1)
**Effort:** 1 minute
**Risk:** None
**Testing:** Visual inspection

**Changes:**
- Fix misleading log message at line 1959

**File:** `standalone_trainer.py:1959`

**Before:**
```python
logger.info("[SFT] Skipping formatting_func and DataCollatorForCompletionOnlyLM (using pre-masked labels)")
```

**After:**
```python
logger.info("[SFT] Skipping formatting_func (using pre-masked labels with DataCollatorForSeq2Seq)")
```

**Validation:**
- Read line 1959 to verify current text
- Update with Edit tool
- No other changes needed

---

### Phase 2: Critical Safety Net (Issue 3)
**Effort:** 10 minutes
**Risk:** Low (improves current behavior)
**Testing:** Test script with template-not-found scenario

**Problem:** Masking everything = zero training signal

**Solution:** Fallback to NO masking instead of masking everything

**File:** `standalone_trainer.py:3264-3266`

**Before:**
```python
else:
    # Fallback: mask everything if template not found
    labels = [-100] * len(labels)
```

**After:**
```python
else:
    # Fallback: no masking if template not found
    # Training on full sequences is better than zero training signal
    logger.warning(
        f"[PreTokenize] Response template not found in tokenized sequence. "
        f"Training will use FULL SEQUENCE (prompt + response). "
        f"This may cause model to learn prompt patterns. "
        f"Template searched: {repr(response_template)}"
    )
    labels = list(input_ids)
```

**Validation:**
1. Create test with unsupported template
2. Verify it falls back to full-sequence training (not masking everything)
3. Verify warning message appears in logs
4. Ensure labels = input_ids (not -100)

**Trade-offs:**
- **Pro:** Model learns something instead of nothing
- **Pro:** User gets warned about the issue
- **Con:** Model may learn prompts (but that's better than learning nothing)

---

### Phase 3: Expand Template Detection (Issue 4)
**Effort:** 30 minutes
**Risk:** Low (adds support, doesn't break existing)
**Testing:** Test with multiple model types

**Solution:** Add more template patterns

**File:** `standalone_trainer.py:3199-3213`

**Current:** Only 3 templates
**Target:** 10+ templates

**Implementation:**
```python
response_template = None
if hasattr(tokenizer, 'chat_template') and tokenizer.chat_template:
    template_str = str(tokenizer.chat_template)

    # Llama 3
    if "<|start_header_id|>assistant<|end_header_id|>" in template_str:
        response_template = "<|start_header_id|>assistant<|end_header_id|>\n\n"
        logger.info("[PreTokenize] Detected Llama 3 template")

    # ChatML (Qwen, Yi, DeepSeek, etc.)
    elif "<|im_start|>assistant" in template_str:
        response_template = "<|im_start|>assistant\n"
        logger.info("[PreTokenize] Detected ChatML template")

    # Mistral/Mixtral
    elif "[/INST]" in template_str:
        response_template = " [/INST] "
        logger.info("[PreTokenize] Detected Mistral template")

    # Gemma
    elif "<start_of_turn>model" in template_str:
        response_template = "<start_of_turn>model\n"
        logger.info("[PreTokenize] Detected Gemma template")

    # Phi-3
    elif "<|assistant|>" in template_str:
        response_template = "<|assistant|>\n"
        logger.info("[PreTokenize] Detected Phi-3 template")

    # Zephyr
    elif "<|assistant|>" in template_str:
        response_template = "<|assistant|>\n"
        logger.info("[PreTokenize] Detected Zephyr template")

    # Command-R
    elif "<|CHATBOT_TOKEN|>" in template_str:
        response_template = "<|CHATBOT_TOKEN|>"
        logger.info("[PreTokenize] Detected Command-R template")

    # Generic fallback attempt
    elif "assistant" in template_str.lower():
        # Try to extract assistant marker heuristically
        logger.warning(
            "[PreTokenize] Unrecognized template format, attempting generic detection. "
            "Template may not work correctly."
        )
```

**Validation:**
1. Test with Qwen (ChatML) - should work
2. Test with Llama 3 - should work
3. Test with Gemma - should work with new detection
4. Test with unknown model - should trigger fallback from Phase 2

---

### Phase 4: Non-Pretokenized Masking (Issue 2) - COMPLEX
**Effort:** 60+ minutes
**Risk:** Medium (requires careful integration)
**Testing:** Full integration tests with both pretokenized and non-pretokenized paths

**Problem:** Raw datasets have no masking

**Solution Options:**

#### Option A: Force Pretokenization (RECOMMENDED)
**Effort:** Low
**Risk:** Low
**Approach:** Auto-enable pretokenization when chat template detected

**Changes to `standalone_trainer.py:__init__()` around line 1162:**

```python
# Check if pretokenization should be auto-enabled
pretokenize_enabled = config.get("training", {}).get("pretokenize", DEFAULT_PRETOKENIZE)
auto_pretokenize = False

# Auto-enable pretokenization for chat templates if not explicitly disabled
if not pretokenize_enabled:
    if hasattr(self.tokenizer, 'chat_template') and self.tokenizer.chat_template:
        logger.info(
            "[Trainer] Chat template detected. Auto-enabling pretokenization for proper response masking. "
            "Set 'pretokenize: false' explicitly to disable (not recommended)."
        )
        pretokenize_enabled = True
        auto_pretokenize = True

if pretokenize_enabled:
    logger.info("[Trainer] Pre-tokenizing training dataset...")
    # ... existing pretokenization logic
```

**Pros:**
- Simple implementation
- Leverages existing, working pretokenization code
- No new data collator logic needed
- User can still opt-out if needed

**Cons:**
- Changes default behavior (but improves correctness)
- Slower first run (but cached for subsequent runs)

#### Option B: Implement Runtime Masking Collator (COMPLEX - NOT RECOMMENDED)
**Effort:** High
**Risk:** High
**Approach:** Create custom data collator for runtime masking

**Why NOT Recommended:**
- `DataCollatorForCompletionOnlyLM` doesn't exist in TRL 0.26.0
- Would need to implement from scratch
- More complex than pretokenization
- Runtime overhead on every batch
- Pretokenization already works and is faster

---

## Recommended Implementation Order

### Sprint 1: Quick Wins (30 minutes)
1. ✅ Fix Issue 1 (misleading log) - 1 minute
2. ✅ Fix Issue 3 (fallback to no masking) - 10 minutes
3. ✅ Test Issue 3 fix - 10 minutes
4. ✅ Verify no breaking changes - 10 minutes

### Sprint 2: Template Expansion (60 minutes)
1. ✅ Add Gemma, Phi-3, Zephyr templates (Issue 4) - 20 minutes
2. ✅ Test with multiple model types - 20 minutes
3. ✅ Update documentation - 10 minutes
4. ✅ Verify backward compatibility - 10 minutes

### Sprint 3: Auto-Pretokenization (60 minutes)
1. ✅ Implement auto-pretokenization for chat templates (Issue 2) - 20 minutes
2. ✅ Test both auto-enabled and manual modes - 20 minutes
3. ✅ Update TypeScript types and docs - 10 minutes
4. ✅ Full integration testing - 10 minutes

---

## Testing Strategy

### Unit Tests
- [ ] Template detection with supported formats
- [ ] Template detection with unsupported format (fallback)
- [ ] Pretokenization with valid template
- [ ] Pretokenization with invalid template (fallback to full-sequence)
- [ ] Auto-pretokenization enablement

### Integration Tests
- [ ] Full training run with pretokenize=true
- [ ] Full training run with pretokenize=false and chat template (auto-enable)
- [ ] Full training run with pretokenize=false and no chat template
- [ ] Prediction generation (already tested and working)

### Regression Tests
- [ ] Existing pretokenized training still works
- [ ] DPO/ORPO training unaffected
- [ ] RunPod training unaffected
- [ ] Old cache format handling unchanged

---

## Rollback Plan

Each phase can be rolled back independently:

### Phase 1 Rollback
```python
# Revert line 1959 to original text
logger.info("[SFT] Skipping formatting_func and DataCollatorForCompletionOnlyLM (using pre-masked labels)")
```

### Phase 2 Rollback
```python
# Revert lines 3264-3266
else:
    # Fallback: mask everything if template not found
    labels = [-100] * len(labels)
```

### Phase 3 Rollback
```python
# Remove added template patterns, keep only original 3
```

### Phase 4 Rollback
```python
# Remove auto-pretokenization logic
pretokenize_enabled = config.get("training", {}).get("pretokenize", DEFAULT_PRETOKENIZE)
# No auto-enable
```

---

## Risk Assessment

| Issue | Risk Level | Impact if Fails | Mitigation |
|-------|-----------|-----------------|------------|
| Issue 1 | None | Cosmetic only | Visual inspection |
| Issue 2 | Medium | Training behavior changes | Thorough testing, opt-out available |
| Issue 3 | Low | Better than current (improves safety) | Test with edge cases |
| Issue 4 | Low | Expands support, doesn't break existing | Test with multiple models |

---

## Success Criteria

### Must Have
- [x] Issue 1 fixed (misleading log)
- [ ] Issue 3 fixed (fallback doesn't mask everything)
- [ ] No breaking changes to existing working configurations
- [ ] All existing tests pass

### Should Have
- [ ] Issue 4 implemented (expanded template detection)
- [ ] Issue 2 implemented (auto-pretokenization)
- [ ] Documentation updated
- [ ] New tests added

### Nice to Have
- [ ] Template detection auto-learning
- [ ] User warnings for unsupported templates
- [ ] Metrics tracking for masking percentage

---

## Files to Modify

### Phase 1
- `standalone_trainer.py` (1 line change at 1959)

### Phase 2
- `standalone_trainer.py` (6 line change at 3264-3266)

### Phase 3
- `standalone_trainer.py` (20+ line addition at 3199-3213)

### Phase 4 (if approved)
- `standalone_trainer.py` (10 line addition around 1162)
- `training-config.types.ts` (documentation update)

---

## Implementation Notes

### Code Style
- No Unicode in Python files
- No hardcoded values (use existing constants)
- No stub/mock/TODO implementations
- Max 30-line code blocks
- Verify code before changes
- Test changes before committing

### Breaking Changes Prevention
- Maintain backward compatibility
- Preserve existing behavior unless explicitly improving
- Add opt-out mechanisms where needed
- Extensive testing before deployment

---

## Post-Implementation

### Monitoring
- Track masking percentage in logs
- Monitor for template detection failures
- Watch for user reports of training issues

### Documentation Updates
- Update pretokenization docs to mention auto-enable
- Document supported template formats
- Add troubleshooting section for unsupported templates

### Future Enhancements
- Template auto-detection from tokenizer metadata
- User-configurable template patterns
- Better fallback heuristics

---

**Status:** AWAITING USER APPROVAL
**Next Action:** User review and approval of phased plan
**Estimated Total Time:** 2-3 hours (all phases)
**Recommended Approach:** Implement Phase 1-3, defer Phase 4 pending user decision

---

**Prepared By:** Claude Sonnet 4.5
**Date:** 2025-12-09
**Session:** Masking Fixes Investigation and Planning
