# RunPod Training Evaluation & vLLM Deployment Fixes

**Date**: 2025-11-27
**Session**: Continuation from context limit
**Status**: ✅ Implemented, Pending Testing

## Overview

Fixed critical issues with RunPod cloud training evaluation strategy and vLLM deployment max context length that were causing training failures and inference server crashes.

## Issues Identified

### 1. **Evaluation Strategy Error** (CRITICAL)
**Error**: `ValueError: You have set args.eval_strategy to steps but you didn't pass an eval_dataset to Trainer`

**Root Cause**:
- Training script created `train_dataset` and `eval_dataset` variables (lines 626-643)
- But trainers were using hardcoded `dataset["train"]` instead of the variables
- When `eval_strategy != "no"`, Trainer requires `eval_dataset` parameter
- Missing eval_dataset for DPO/ORPO preference datasets

**Impact**: Training jobs failed immediately after starting when evaluation was enabled

### 2. **CUDA OOM During Evaluation** (HIGH)
**Error**: `CUDA out of memory. Tried to allocate 10.16 GiB`

**Root Cause**:
- Memory fragmentation: 10.67 GB reserved but unallocated
- No `per_device_eval_batch_size` configured (defaults to same as training)
- Evaluation batches consume additional memory

**Impact**: Training crashed at step 3 during first evaluation

### 3. **vLLM Max Context Length** (CRITICAL)
**Error**: `ValueError: 14.00 GiB KV cache needed, only 11.55 GiB available`

**Root Cause**:
- Model's default `max_seq_len` = 131072 tokens (128k)
- No `max_model_len` default in deployment config
- vLLM tried to allocate KV cache for full 128k context
- GPU only had 11.55 GB available for KV cache

**Impact**: vLLM server failed to start after training completion

## Files Modified

### 1. `/home/juan-canfield/Desktop/web-ui/lib/training/runpod-service.ts`

#### Changes Made:

**Line 380**: Added CUDA memory allocator configuration
```python
# Configure PyTorch CUDA memory allocator to reduce fragmentation
os.environ['PYTORCH_CUDA_ALLOC_CONF'] = 'expandable_segments:True'
```

**Line 676**: Added eval batch size to SFTConfig
```python
per_device_eval_batch_size=${trainingConfig.training?.eval_batch_size || 2},
```

**Lines 697-698**: Fixed SFTTrainer dataset parameters
```python
train_dataset=train_dataset,  # Was: dataset["train"]
eval_dataset=eval_dataset,     # Added
```

**Lines 707-714**: Split preference dataset creation for DPO/ORPO
```python
# Create preference dataset for training
preference_train_dataset = create_preference_dataset(train_dataset, "train")

# Create preference dataset for evaluation if eval is enabled
preference_eval_dataset = None
if eval_dataset is not None:
    preference_eval_dataset = create_preference_dataset(eval_dataset, "eval")
```

**Line 725**: Added eval batch size to DPOConfig
```python
per_device_eval_batch_size=${trainingConfig.training?.eval_batch_size || 2},
```

**Lines 746-747**: Fixed DPOTrainer dataset parameters
```python
train_dataset=preference_train_dataset,  # Was: preference_dataset
eval_dataset=preference_eval_dataset,     # Added
```

**Line 761**: Added eval batch size to ORPOConfig
```python
per_device_eval_batch_size=${trainingConfig.training?.eval_batch_size || 2},
```

**Lines 781-782**: Fixed ORPOTrainer dataset parameters
```python
train_dataset=preference_train_dataset,  # Was: preference_dataset
eval_dataset=preference_eval_dataset,     # Added
```

### 2. `/home/juan-canfield/Desktop/web-ui/app/api/training/deploy/route.ts`

#### Changes Made:

**Line 286**: Added default max_model_len for vLLM deployment
```typescript
maxModelLen: config?.max_model_len || 8192,  # Was: config?.max_model_len
```

### 3. `/home/juan-canfield/Desktop/web-ui/components/training/DeployModelButton.tsx`

#### Changes Made:

**Line 38**: Added Slider import
```typescript
import { Slider } from '@/components/ui/slider';
```

**Line 75**: Added state variable for max_model_len
```typescript
// vLLM configuration
const [maxModelLen, setMaxModelLen] = useState<number>(8192);
```

**Line 148**: Added max_model_len to config object sent to deploy API
```typescript
config: {
  gpu_memory_utilization: 0.8,
  max_model_len: maxModelLen,  // Added
  // RunPod-specific config
  ...(serverType === STATUS.RUNPOD && {
    gpu_type: runpodGpu,
    budget_limit: parseFloat(runpodBudget),
  }),
},
```

**Lines 453-491**: Replaced static configuration display with interactive slider
```typescript
{/* Local deployment configuration */}
{serverType !== STATUS.RUNPOD && (
  <div className="rounded-lg border p-4 bg-muted/50 space-y-4">
    <h4 className="text-sm font-medium">Configuration</h4>

    {/* Max Context Length Slider */}
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="max-context" className="text-sm font-medium">
          Max Context Length
        </Label>
        <span className="text-sm text-muted-foreground">
          {maxModelLen.toLocaleString()} tokens
        </span>
      </div>
      <Slider
        id="max-context"
        min={2048}
        max={32768}
        step={2048}
        value={[maxModelLen]}
        onValueChange={(value) => setMaxModelLen(value[0])}
        className="w-full"
      />
      <p className="text-xs text-muted-foreground">
        Higher values require more GPU memory. 8k recommended for most models.
      </p>
    </div>

    {/* Static configuration info */}
    <div className="pt-2 border-t">
      <ul className="text-sm text-muted-foreground space-y-1">
        <li>• GPU Memory: 80% utilization</li>
        <li>• Port: Auto-allocated (8002-8020)</li>
        <li>• Security: Bound to localhost only</li>
      </ul>
    </div>
  </div>
)}
```

## Technical Details

### Evaluation Dataset Flow

```
1. Load dataset from JSONL
   ├─> dataset["train"]

2. Check if evaluation enabled
   ├─> use_eval = evaluation_strategy != "no"

3. Create train/eval split if needed
   ├─> IF use_eval AND no test/validation split
   │   ├─> Split 90/10
   │   ├─> train_dataset = dataset["train"] (90%)
   │   └─> eval_dataset = dataset["test"] (10%)
   │
   ├─> IF use_eval AND has test/validation split
   │   ├─> train_dataset = dataset["train"]
   │   └─> eval_dataset = dataset["test"] or dataset["validation"]
   │
   └─> ELSE (no evaluation)
       ├─> train_dataset = dataset["train"]
       └─> eval_dataset = None

4. For DPO/ORPO: Create preference datasets
   ├─> preference_train_dataset = create_preference_dataset(train_dataset)
   └─> preference_eval_dataset = create_preference_dataset(eval_dataset) if eval_dataset else None

5. Pass to trainers
   ├─> SFTTrainer(train_dataset, eval_dataset)
   ├─> DPOTrainer(preference_train_dataset, preference_eval_dataset)
   └─> ORPOTrainer(preference_train_dataset, preference_eval_dataset)
```

### Memory Optimization Strategy

```
Training Memory = Model + Gradients + Optimizer States + Train Batch
Eval Memory = Model + Eval Batch

Peak Memory = max(Training Memory, Eval Memory during eval step)

Optimizations Applied:
1. PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
   └─> Reduces fragmentation by allowing memory segments to expand

2. per_device_eval_batch_size = 2 (vs train batch_size = 4)
   └─> Halves eval memory footprint

3. Automatic best checkpoint selection
   └─> load_best_model_at_end=True when eval enabled
   └─> metric_for_best_model="loss"
```

### vLLM Context Length Calculation

```
KV Cache Memory = layers × heads × head_dim × seq_len × batch_size × 2 (K+V) × dtype_size

For 131072 tokens (128k):
└─> Required: ~14 GB KV cache
└─> Available: 11.55 GB
└─> Result: FAIL ❌

For 8192 tokens (8k):
└─> Required: ~0.875 GB KV cache
└─> Available: 11.55 GB
└─> Result: SUCCESS ✅
```

## Configuration Parameters

### New Configurable Parameters

All parameters support configuration with safe defaults:

```typescript
// Training Config
{
  training: {
    eval_batch_size?: number;        // Default: 2
    evaluation_strategy?: string;     // Default: "no"
    eval_steps?: number;              // Default: 500
    save_strategy?: string;           // Default: "epoch"
    save_steps?: number;              // Default: 500
    save_total_limit?: number;        // Default: 3
  }
}

// Deployment Config
{
  max_model_len?: number;             // Default: 8192
  gpu_memory_utilization?: number;    // Default: 0.8
  tensor_parallel_size?: number;      // Default: 1
  dtype?: string;                     // Default: "auto"
}
```

## Validation Checklist

### Pre-Deployment Verification

- [x] Verified runpod-service.ts changes don't break existing code
- [x] Verified deploy route.ts changes don't break existing code
- [x] Confirmed all parameters have fallback defaults
- [x] Confirmed changes are backwards compatible
- [ ] **TODO**: Test training with evaluation enabled
- [ ] **TODO**: Test training without evaluation (regression test)
- [ ] **TODO**: Test DPO training with evaluation
- [ ] **TODO**: Test ORPO training with evaluation
- [ ] **TODO**: Test vLLM deployment after training
- [ ] **TODO**: Verify checkpoint selection works correctly

### Files That Import/Use Modified Code

**RunPod Service** (`lib/training/runpod-service.ts`):
- ✅ `app/api/training/deploy/runpod/route.ts` - Uses `generateTrainingScript()`
- ✅ No other direct imports found

**Deploy Route** (`app/api/training/deploy/route.ts`):
- ✅ Called by frontend deployment buttons
- ✅ `components/training/DeployModelButton.tsx`
- ✅ `components/training/CloudDeploymentWizard.tsx`

### Breaking Change Analysis

**Potential Breaking Changes**: ❌ NONE

1. **Backward Compatibility**:
   - All new parameters have defaults
   - Existing training configs will work unchanged
   - If `eval_batch_size` not set → defaults to 2
   - If `max_model_len` not set → defaults to 8192

2. **API Contracts**:
   - No API signature changes
   - No required parameter additions
   - All changes are additive only

3. **Database Schema**:
   - No database changes required
   - `config_json` JSONB fields support new parameters

## Testing Plan

### Phase 1: Unit Testing (Manual)

1. **Test Evaluation Disabled** (Regression)
   ```
   Config: { evaluation_strategy: "no" }
   Expected: Training completes, no eval_dataset passed
   ```

2. **Test Evaluation by Steps**
   ```
   Config: { evaluation_strategy: "steps", eval_steps: 100 }
   Expected:
   - 10% validation split created
   - Eval runs every 100 steps
   - Best checkpoint saved
   ```

3. **Test Evaluation by Epoch**
   ```
   Config: { evaluation_strategy: "epoch" }
   Expected:
   - 10% validation split created
   - Eval runs at end of each epoch
   - Best checkpoint saved
   ```

4. **Test DPO with Evaluation**
   ```
   Config: { method: "dpo", evaluation_strategy: "steps" }
   Expected:
   - Preference datasets created for train AND eval
   - Both passed to DPOTrainer
   ```

5. **Test vLLM Deployment**
   ```
   Action: Deploy trained model to vLLM
   Expected:
   - Server starts with max_model_len=8192
   - KV cache fits in GPU memory
   - No engine core initialization errors
   ```

### Phase 2: Integration Testing

1. **Full Training Pipeline**
   - Start training with eval enabled
   - Monitor CUDA memory usage
   - Verify eval metrics appear in UI
   - Check checkpoint selection
   - Deploy to vLLM
   - Test inference

2. **Memory Stress Test**
   - Large model (7B+ parameters)
   - Enable evaluation
   - Monitor GPU memory
   - Verify no OOM errors

### Phase 3: UI Testing

1. **Deployment Dialog**
   - Verify current behavior (no max_model_len control)
   - Plan UI enhancement (slider/input for max_model_len)

## Next Steps

### Immediate (Critical Path)

1. ✅ **Complete**: Fixes implemented
2. ⏳ **In Progress**: Documentation and validation
3. 📋 **Pending**: User testing with real training job

### Completed Enhancements

1. **✅ UI Control for max_model_len** (2025-11-27)
   - Location: `components/training/DeployModelButton.tsx`
   - Added interactive slider: 2048 to 32768 tokens (2048 step)
   - Default: 8192
   - Shows current value with thousands separator
   - Includes helper text about memory requirements

### Future Enhancements

1. **Automatic max_model_len Calculation**
   ```typescript
   // Calculate optimal max_model_len based on:
   // - Available GPU memory
   // - Model size
   // - gpu_memory_utilization setting
   const optimalMaxLen = calculateOptimalContextLength(
     gpuMemoryGB,
     modelSizeGB,
     gpuMemoryUtilization
   );
   ```

2. **Checkpoint Upload to HuggingFace**
   - Auto-generate `HF_REPO_NAME`
   - Upload best checkpoint to HF Hub
   - Persist checkpoints beyond pod lifetime

## Known Limitations

1. **Checkpoint Persistence**:
   - Checkpoints saved to `/workspace/results/` on RunPod
   - Deleted when pod terminates
   - Only merged model persists
   - **Workaround**: Enable HF Hub upload (future enhancement)

2. **Evaluation Dataset Size**:
   - Fixed 10% split
   - No configuration for split ratio
   - **Workaround**: Pre-split dataset before upload

3. **Max Context Length**:
   - ~~No UI control yet~~ ✅ RESOLVED (2025-11-27)
   - Interactive slider added to deployment dialog
   - Range: 2048-32768 tokens
   - Default: 8192

## Rollback Plan

If issues arise:

```bash
# Revert runpod-service.ts changes
git checkout lib/training/runpod-service.ts

# Revert deploy route changes
git checkout app/api/training/deploy/route.ts

# Or manually remove:
# - Line 380: PYTORCH_CUDA_ALLOC_CONF
# - Lines 676, 725, 761: per_device_eval_batch_size
# - Lines 697-698, 746-747, 781-782: eval_dataset parameters
# - Lines 707-714: preference dataset split logic
# - Line 286: max_model_len default
```

## Session Context for Continuity

**Previous Issues Resolved**:
1. ✅ RunPod Deploy button silent failure (missing A100_80GB GPU in pricing)
2. ✅ Model name format error (slashes → hyphens transformation)
3. ✅ Dataset gzip decompression error
4. ✅ RLS policy for local_training_metrics

**This Session**:
1. ✅ HuggingFace authentication for gated models
2. ✅ Hardcoded training parameters (save_strategy, etc.)
3. ✅ Evaluation strategy parameter errors
4. ✅ CUDA OOM during evaluation
5. ✅ vLLM max context length crash
6. ✅ UI control for max_model_len configuration

**Still Pending**:
- Metrics overwhelming training monitor UI (downsampling needed)
- Checkpoint upload to HuggingFace Hub

## References

- HuggingFace TRL Documentation: https://huggingface.co/docs/trl
- vLLM Documentation: https://docs.vllm.ai/
- PyTorch CUDA Memory Management: https://pytorch.org/docs/stable/notes/cuda.html
- RunPod API Docs: https://docs.runpod.io/

---
**Author**: Claude (Sonnet 4.5)
**Last Updated**: 2025-11-27
**Review Status**: Pending User Testing
