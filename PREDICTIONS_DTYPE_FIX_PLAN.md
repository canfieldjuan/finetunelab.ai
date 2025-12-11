# Training Predictions DType Fix - Implementation Plan

**Issue:** Predictions table not being populated during eval due to dtype mismatch
**Date:** 2025-12-02
**Status:** Investigation Complete - Awaiting Approval

---

## Root Cause Analysis

### Problem Statement
The `training_predictions` table remains empty during fine-tuning despite:
- ✅ Callback system is initialized correctly
- ✅ Predictions config is enabled (`sample_frequency: "eval"`)
- ✅ Environment variables are present (JOB_ID, JOB_USER_ID, JOB_TOKEN, METRICS_API_URL)
- ✅ PredictionsWriter is configured for local mode API
- ✅ Callback fires on every eval step

### Evidence from Logs
```
[PredictionsCallback] Generating 5 predictions at epoch 0, step 25
Generation error for sample 0: expected scalar type Float but found BFloat16
Generation error for sample 1: expected scalar type Float but found BFloat16
Generation error for sample 2: expected scalar type Float but found BFloat16
Generation error for sample 3: expected scalar type Float but found BFloat16
Generation error for sample 4: expected scalar type Float but found BFloat16
```

**Observed in jobs:**
- `job_db0a2144-a2f9-419f-9471-8a0dd87af6af` (Qwen/Qwen3-1.7B, bf16=true)
- `job_c57274a5-eb44-4047-b3eb-38d911474065` (Qwen/Qwen3-1.7B, bf16=true)
- `job_af142225-b952-45ce-a31e-6c95a3652f41` (Model with bf16)
- Multiple other recent runs with BFloat16 enabled

### Technical Analysis

#### Current Flow
1. TrainingPredictionsCallback.on_evaluate() is called during eval
2. _generate_predictions() retrieves model and tokenizer from kwargs
3. PredictionsGenerator.generate_predictions() is called
4. _generate_single() tokenizes and calls model.generate()
5. **FAILS:** "expected scalar type Float but found BFloat16" exception
6. Exception is caught, logged, sample is skipped
7. Empty predictions list returned to writer
8. Writer never called because predictions list is empty
9. Table remains empty

#### Verified via Manual Testing
Created test with training venv Python:
- ✅ Loaded Qwen/Qwen3-1.7B with 4-bit quantization
- ✅ Applied prepare_model_for_kbit_training()
- ✅ Attached LoRA adapters (r=32, alpha=64)
- ✅ Generation **works** outside trainer context
- ✅ Model dtype after LoRA: torch.float32
- ✅ Generation with plain model: SUCCESS
- ✅ Generation with LoRA model: SUCCESS

**Conclusion:** The trainer's eval context introduces a dtype incompatibility, likely due to:
- BFloat16 autocast context from trainer
- PEFT wrapper interaction with autocast
- Input tensors not matching model's expected dtype during generation

---

## Affected Files

### Files Requiring Changes
1. **lib/training/predictions_generator.py** (Primary fix location)
   - Current: No dtype handling in _generate_single()
   - Lines: 69-103 (_generate_single method)

2. **lib/training/predictions_callback.py** (Verification logging)
   - Current: Catches exceptions but provides minimal debug info
   - Lines: 152-182 (_generate_predictions method)

### Files for Verification (No Changes)
1. **lib/training/standalone_trainer.py**
   - Verify how bf16/fp16 config propagates to eval
   - Check if autocast is active during eval
   - Lines: 1680-1860 (SFT trainer setup with callbacks)

2. **lib/training/predictions_writer.py**
   - Already working correctly
   - No changes needed

3. **app/api/training/local/predictions/route.ts**
   - API endpoint working correctly
   - No changes needed

---

## Implementation Plan - 3 Phases

### Phase 1: Enhanced Diagnostics (Pre-Fix Verification)
**Goal:** Capture exact dtype state during generation failure
**Duration:** 1 hour
**Risk:** Low (logging only, no behavior changes)

#### Changes Required

**File:** `lib/training/predictions_generator.py`
**Location:** `_generate_single()` method (lines 69-103)

**Action:** Add comprehensive dtype logging before generation
```python
def _generate_single(self, model, tokenizer, prompt, device):
    """Generate prediction for single prompt"""
    
    # DIAGNOSTIC LOGGING - Phase 1
    model_dtype = next(model.parameters()).dtype
    logger.info(f'[PredictionsGenerator] Model dtype: {model_dtype}')
    
    # Check if autocast is active
    if torch.is_autocast_enabled():
        autocast_dtype = torch.get_autocast_gpu_dtype()
        logger.info(f'[PredictionsGenerator] Autocast active: {autocast_dtype}')
    else:
        logger.info('[PredictionsGenerator] Autocast: disabled')
    
    inputs = tokenizer(
        prompt,
        return_tensors='pt',
        truncation=True
    )
    
    # DIAGNOSTIC - Log input tensor dtypes
    input_ids = inputs['input_ids'].to(device)
    logger.info(f'[PredictionsGenerator] input_ids dtype: {input_ids.dtype}')
    
    # ... rest of method
```

**Verification:** Run training job with predictions enabled, check logs for dtype information

---

### Phase 2: Dtype Correction Implementation
**Goal:** Ensure generation uses correct dtype regardless of trainer context
**Duration:** 2 hours
**Risk:** Medium (changes generation behavior, needs testing)

#### Changes Required

**File:** `lib/training/predictions_generator.py`
**Location:** `_generate_single()` method (lines 69-103)

**Action:** Implement dtype-safe generation with autocast management

**Option A: Disable Autocast (Safest)**
```python
def _generate_single(self, model, tokenizer, prompt, device):
    """Generate prediction for single prompt with dtype safety"""
    
    # Get model's actual dtype (handles quantized models correctly)
    model_dtype = next(model.parameters()).dtype
    
    inputs = tokenizer(
        prompt,
        return_tensors='pt',
        truncation=True
    )
    
    # Move inputs to device and ensure dtype compatibility
    input_ids = inputs['input_ids'].to(device)
    attention_mask = inputs.get('attention_mask')
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    
    # Prepare generate kwargs
    gen_kwargs = {
        'input_ids': input_ids,
        'max_new_tokens': self.max_length,
        'do_sample': False,
        'pad_token_id': tokenizer.eos_token_id
    }
    
    if attention_mask is not None:
        gen_kwargs['attention_mask'] = attention_mask
    
    # CRITICAL FIX: Disable autocast during generation
    # This prevents dtype mismatches when trainer uses bf16/fp16
    with torch.amp.autocast('cuda', enabled=False):
        outputs = model.generate(**gen_kwargs)
    
    generated_ids = outputs[0][input_ids.shape[1]:]
    prediction = tokenizer.decode(
        generated_ids,
        skip_special_tokens=True
    )
    
    return prediction.strip()
```

**Option B: Match Autocast Dtype (Alternative)**
```python
def _generate_single(self, model, tokenizer, prompt, device):
    """Generate prediction for single prompt with dtype safety"""
    
    # Detect active autocast dtype
    if torch.is_autocast_enabled():
        target_dtype = torch.get_autocast_gpu_dtype()
    else:
        target_dtype = next(model.parameters()).dtype
    
    inputs = tokenizer(
        prompt,
        return_tensors='pt',
        truncation=True
    )
    
    # Move inputs to device
    input_ids = inputs['input_ids'].to(device)
    attention_mask = inputs.get('attention_mask')
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)
    
    gen_kwargs = {
        'input_ids': input_ids,
        'max_new_tokens': self.max_length,
        'do_sample': False,
        'pad_token_id': tokenizer.eos_token_id
    }
    
    if attention_mask is not None:
        gen_kwargs['attention_mask'] = attention_mask
    
    # CRITICAL FIX: Use explicit autocast with detected dtype
    with torch.amp.autocast('cuda', dtype=target_dtype, enabled=True):
        outputs = model.generate(**gen_kwargs)
    
    generated_ids = outputs[0][input_ids.shape[1]:]
    prediction = tokenizer.decode(
        generated_ids,
        skip_special_tokens=True
    )
    
    return prediction.strip()
```

**Recommended:** Option A (Disable Autocast)
- **Why:** Simpler, more predictable behavior
- Quantized models already handle dtype internally
- Avoids potential autocast/PEFT interaction issues
- Generation speed impact is negligible (small batch)

---

### Phase 3: Enhanced Error Handling & Verification
**Goal:** Prevent silent failures, add recovery mechanisms
**Duration:** 2 hours
**Risk:** Low (improves robustness)

#### Changes Required

**File:** `lib/training/predictions_callback.py`
**Location:** `_generate_predictions()` method (lines 152-182)

**Action:** Improve error logging and add partial success handling

```python
def _generate_predictions(self, state: TrainerState, **kwargs):
    """Generate and save predictions"""
    if not self.samples or not self.generator or not self.writer:
        return

    try:
        # Try to get model/tokenizer from kwargs first
        model = kwargs.get('model') or self.model
        tokenizer = kwargs.get('processing_class') or kwargs.get('tokenizer') or self.tokenizer

        if not model or not tokenizer:
            logger.warning('[PredictionsCallback] Model/tokenizer missing')
            logger.debug(f'[PredictionsCallback] Debug: model={bool(model)}, tokenizer={bool(tokenizer)}, '
                        f'kwargs_model={bool(kwargs.get("model"))}, '
                        f'stored_model={bool(self.model)}')
            return

        current_epoch = int(state.epoch) if state.epoch else 0
        current_step = state.global_step

        logger.info(
            f'[PredictionsCallback] Generating {len(self.samples)} '
            f'predictions at epoch {current_epoch}, step {current_step}'
        )

        # ENHANCED: Track success/failure per sample
        predictions = self.generator.generate_predictions(
            model,
            tokenizer,
            self.samples,
            current_epoch,
            current_step
        )

        # ENHANCED: Log generation results
        successful_count = len(predictions)
        failed_count = len(self.samples) - successful_count
        
        if failed_count > 0:
            logger.warning(
                f'[PredictionsCallback] Generation completed with errors: '
                f'{successful_count} succeeded, {failed_count} failed'
            )
        else:
            logger.info(
                f'[PredictionsCallback] All {successful_count} predictions generated successfully'
            )

        # ENHANCED: Write even partial results
        if predictions:
            success, errors = self.writer.write_predictions(
                predictions,
                self.job_id,
                self.user_id
            )
            logger.info(
                f'[PredictionsCallback] Saved {success} predictions '
                f'({errors} errors)'
            )
        else:
            logger.warning(
                f'[PredictionsCallback] No predictions generated - all samples failed'
            )

    except Exception as e:
        logger.error(f'[PredictionsCallback] Generation failed: {e}')
        # ENHANCED: Log full stack trace in debug mode
        logger.debug(f'[PredictionsCallback] Stack trace:', exc_info=True)
```

**File:** `lib/training/predictions_generator.py`
**Location:** `generate_predictions()` method (lines 24-66)

**Action:** Improve error logging per sample

```python
def generate_predictions(
    self,
    model,
    tokenizer,
    samples,
    epoch,
    step
):
    """
    Generate predictions for samples

    Args:
        model: The model to use for generation
        tokenizer: Tokenizer for encoding/decoding
        samples: List of sample dicts with 'prompt' key
        epoch: Current training epoch
        step: Current training step

    Returns:
        list: Prediction dicts ready for database
    """
    predictions = []
    device = next(model.parameters()).device

    model.eval()
    with torch.no_grad():
        for sample in samples:
            try:
                prediction_text = self._generate_single(
                    model,
                    tokenizer,
                    sample['prompt'],
                    device
                )

                predictions.append({
                    'epoch': epoch,
                    'step': step,
                    'sample_index': sample['index'],
                    'prompt': sample['prompt'],
                    'ground_truth': sample.get('ground_truth'),
                    'prediction': prediction_text
                })
            except Exception as e:
                # ENHANCED: More detailed error logging
                logger.error(
                    f'[PredictionsGenerator] Generation error for sample {sample["index"]}: '
                    f'{type(e).__name__}: {e}'
                )
                # Log first occurrence with more context
                if len(predictions) == 0:
                    logger.error(
                        f'[PredictionsGenerator] First failure context - '
                        f'model_dtype: {next(model.parameters()).dtype}, '
                        f'device: {device}, '
                        f'autocast_enabled: {torch.is_autocast_enabled()}'
                    )
                continue

    return predictions
```

---

## Verification Strategy

### Phase 1 Verification
1. Run training job with predictions enabled (bf16=true)
2. Check logs for dtype diagnostic information
3. Confirm autocast state is captured
4. Document exact dtype mismatch scenario

### Phase 2 Verification
1. Apply dtype fix to predictions_generator.py
2. Run same training job configuration
3. Verify predictions generate without errors
4. Check database for populated training_predictions records
5. Compare prediction quality before/after fix

### Phase 3 Verification
1. Test with multiple configurations:
   - bf16=true, bf16=false
   - fp16=true, fp16=false
   - Different models (Qwen, Llama, Mistral)
   - With/without LoRA
2. Verify partial success handling (if some samples fail)
3. Check API endpoint returns predictions
4. Verify UI can display predictions

---

## Testing Matrix

| Configuration | Model | Quantization | Expected Result |
|--------------|-------|--------------|-----------------|
| bf16=true | Qwen/Qwen3-1.7B | 4-bit | ✅ Predictions saved |
| bf16=false | Qwen/Qwen3-1.7B | 4-bit | ✅ Predictions saved |
| fp16=true | meta-llama/Llama-3.2-1B | 4-bit | ✅ Predictions saved |
| bf16=true | mistralai/Mistral-7B | 4-bit | ✅ Predictions saved |
| bf16=true | Qwen/Qwen3-1.7B | None | ✅ Predictions saved |

---

## Rollback Plan

If Phase 2 implementation causes issues:

1. **Immediate Rollback:**
   ```bash
   git revert <commit-hash>
   ```

2. **Alternative Approach:**
   - Move generation to separate process outside trainer context
   - Use model checkpoint loading instead of in-memory model

3. **Fallback Configuration:**
   - Add environment variable `PREDICTIONS_DISABLE_AUTOCAST_FIX=false`
   - Allow users to disable fix if it causes issues

---

## Implementation Steps (Awaiting Approval)

### Step 1: Create backup branch
```bash
cd /home/juan-canfield/Desktop/web-ui
git checkout -b feature/predictions-dtype-fix
```

### Step 2: Implement Phase 1 (Diagnostics)
- Update `lib/training/predictions_generator.py`
- Test with existing training job
- Document dtype information from logs

### Step 3: Implement Phase 2 (Fix)
- Apply Option A (disable autocast) to `_generate_single()`
- Run test training job
- Verify predictions populate database

### Step 4: Implement Phase 3 (Enhancement)
- Update error handling in callback and generator
- Add comprehensive logging
- Test edge cases

### Step 5: Documentation
- Update PREDICTIONS_FEATURE_PROGRESS.md
- Add troubleshooting section to docs
- Document dtype considerations for users

---

## Success Criteria

✅ **Phase 1 Complete:**
- Dtype diagnostic logs captured during eval
- Autocast state confirmed in logs
- Root cause fully documented

✅ **Phase 2 Complete:**
- No "expected scalar type Float but found BFloat16" errors
- Predictions generated successfully during training
- `training_predictions` table populated with records
- API endpoint returns prediction data

✅ **Phase 3 Complete:**
- Partial success handling works (some samples can fail)
- Error logging provides actionable information
- All test matrix configurations pass
- No regressions in training performance

---

## Questions for Approval

1. **Approach Selection:** Do you approve Option A (Disable Autocast) as the primary fix?
2. **Phased Implementation:** Should we proceed with all 3 phases, or Phase 2 only first?
3. **Testing Scope:** Should we test all configurations in the matrix, or subset?
4. **Documentation:** Where should user-facing dtype notes be added?

**Awaiting approval to proceed with implementation.**
