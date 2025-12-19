# RunPod Training Template Testing

**Purpose:** Track systematic testing of all training methods on RunPod cloud infrastructure.

**Models Using This:** Claude (testing coordination)

---

## 🎯 Testing Objectives

1. Verify all training methods work on RunPod
2. Collect metrics via API for each method
3. Run outside dev tests per template
4. Run batch tests programmatically
5. Document limitations and gaps in offerings

---

## 📋 Training Templates Inventory

**Location:** `lib/training/training-templates.ts`

**Active Templates (ALL_TEMPLATES):**

| Template Key | Method | Status | Model | Notes |
|-------------|--------|--------|-------|-------|
| `sft_standard` | SFT | ✅ **Working** | Llama-3.2-1B-Instruct | Confirmed working with some issues |
| `dpo_standard` | DPO | ⏳ Pending | Llama-2-7b-hf | Not yet tested on RunPod |
| `rlhf_standard` | RLHF/PPO | ⏳ Pending | Llama-2-7b-hf | Requires reward model |
| `orpo_standard` | ORPO | ⏳ Pending | Llama-2-7b-hf | Reference-free preference optimization |
| `cpt_standard` | CPT | ⏳ Pending | Llama-3.2-1B | Mentioned working yesterday |

**Deprecated Templates (not in ALL_TEMPLATES):**
- sft_toolbench, sft_pc_building, dpo_basic, teacher_mode, knowledge_dense, alpaca_sft, openorca_sft, unnatural_instructions
- **Status:** Not actively tested (kept for reference)

---

## 🔬 Testing Methodology

### Phase 1: Basic Template Verification

**Goal:** Verify each template can start training on RunPod

**Steps per template:**
1. Deploy job to RunPod using template
2. Verify pod starts successfully
3. Verify standalone_trainer.py downloads
4. Verify training begins (first few steps complete)
5. Check alert notification for `job_started`
6. Monitor first 100 steps for metrics POST
7. Cancel job (don't wait for completion)

**Success Criteria:**
- ✅ Pod deploys without errors
- ✅ Training starts (logs show "Training started")
- ✅ `job_started` alert received
- ✅ Metrics POST successfully to `/api/training/local/metrics`
- ✅ No errors in first 100 steps

### Phase 2: Outside Dev Tests

**Goal:** Run full training jobs and collect metrics via API

**Steps per template:**
1. Deploy job with small dataset (100-500 samples)
2. Let training run to completion
3. Use SDK to fetch metrics via API
4. Verify `job_completed` alert received
5. Download trained model
6. Test model inference

**Success Criteria:**
- ✅ Training completes without errors
- ✅ All metrics visible in API
- ✅ `job_completed` alert received
- ✅ Model can be downloaded
- ✅ Model generates responses

### Phase 3: Batch Testing

**Goal:** Run multiple jobs programmatically and collect metrics

**Steps:**
1. Create batch test script (Python SDK)
2. Submit 5 jobs per template (25 total)
3. Monitor all jobs via API
4. Collect aggregated metrics
5. Compare performance across templates

**Success Criteria:**
- ✅ All jobs complete successfully
- ✅ Metrics collected programmatically
- ✅ Performance comparison document created
- ✅ Identify any patterns or issues

---

## 📊 Template Details

### 1. SFT Standard (Supervised Fine-Tuning)

**Status:** ✅ Working (with some issues)

**Config:**
- Model: `meta-llama/Llama-3.2-1B-Instruct`
- Method: `sft`
- Batch Size: 4
- Gradient Accumulation: 8
- Max Length: 2048
- LoRA: Enabled (r=16, alpha=32)
- Quantization: 4-bit NF4

**Known Issues:**
- Some metrics may not POST correctly (verify after recent fixes)
- Alert notifications restored (2025-12-19)

**Test Plan:**
- [x] Basic verification (confirmed working)
- [ ] Outside dev test
- [ ] Batch test

---

### 2. DPO Standard (Direct Preference Optimization)

**Status:** ⏳ Pending

**Config:**
- Model: `meta-llama/Llama-2-7b-hf`
- Method: `dpo`
- Batch Size: 2
- Gradient Accumulation: 16
- Max Length: 512
- LoRA: Enabled (r=16, alpha=32)
- Quantization: 4-bit NF4

**Requirements:**
- Dataset format: DPO (chosen/rejected pairs)
- Requires: `{"prompt": "...", "chosen": "...", "rejected": "..."}`

**Test Plan:**
- [ ] Create DPO test dataset
- [ ] Basic verification
- [ ] Outside dev test
- [ ] Batch test

---

### 3. RLHF Standard (PPO)

**Status:** ⏳ Pending

**Config:**
- Model: `meta-llama/Llama-2-7b-hf`
- Method: `rlhf`
- Batch Size: 4
- Gradient Accumulation: 4
- Max Length: 512
- LoRA: Enabled (r=16, alpha=32)
- Quantization: 4-bit NF4
- PPO Epochs: 4
- Clip Range: 0.2

**Requirements:**
- Dataset format: RLHF (prompts + reward signals)
- Requires reward model OR reward function
- Memory: ~2x base model size (policy + reward model)

**Challenges:**
- Need reward model implementation
- More complex than SFT/DPO
- Higher memory requirements

**Test Plan:**
- [ ] Implement/configure reward model
- [ ] Create RLHF test dataset
- [ ] Basic verification
- [ ] Outside dev test
- [ ] Batch test

---

### 4. ORPO Standard (Odds Ratio Preference Optimization)

**Status:** ⏳ Pending

**Config:**
- Model: `meta-llama/Llama-2-7b-hf`
- Method: `orpo`
- Batch Size: 4
- Gradient Accumulation: 4
- Max Length: 1024
- LoRA: Enabled (r=16, alpha=32)
- Quantization: 4-bit NF4

**Requirements:**
- Dataset format: Same as DPO (chosen/rejected pairs)
- No reference model needed (more efficient than DPO)

**Advantages:**
- Combines SFT + alignment in one step
- ~1x model memory (vs 2x for DPO)
- More efficient than DPO

**Test Plan:**
- [ ] Use same DPO dataset
- [ ] Basic verification
- [ ] Compare performance vs DPO
- [ ] Outside dev test
- [ ] Batch test

---

### 5. CPT Standard (Continued Pre-Training)

**Status:** ⏳ Pending (mentioned working yesterday)

**Config:**
- Model: `meta-llama/Llama-3.2-1B`
- Method: `cpt`
- Batch Size: 4
- Gradient Accumulation: 8
- Max Length: 4096 (longer for domain context)
- LoRA: Enabled (r=16, alpha=32)
- Quantization: 4-bit NF4
- Packing: Enabled

**Requirements:**
- Dataset format: Raw text (simple strings, no conversations)
- Use case: Domain adaptation before SFT

**Use Cases:**
- Medical, legal, finance domain adaptation
- Research papers, enterprise knowledge bases
- Workflow: Base Model → CPT → SFT → DPO → Production

**Test Plan:**
- [ ] Create raw text test dataset
- [ ] Basic verification
- [ ] Verify packing works correctly
- [ ] Outside dev test
- [ ] Batch test

---

## 🚨 Common Issues to Watch For

### 1. Dataset Format Mismatches

**Problem:** Template expects specific format, dataset doesn't match

**Templates Affected:**
- DPO/ORPO: Need `{"prompt": "...", "chosen": "...", "rejected": "..."}`
- RLHF: Need `{"prompt": "...", "reward": ...}` or reward model
- CPT: Need raw text strings `{"text": "..."}`
- SFT: Need `{"messages": [...]}` or similar

**Detection:**
- Error in first 10 steps: "KeyError: 'chosen'"
- Error: "Expected key X in dataset"

**Fix:**
- Validate dataset format before deployment
- Use correct dataset format for each method

### 2. Memory Errors (OOM)

**Problem:** GPU runs out of memory during training

**Templates Most Affected:**
- RLHF (needs policy + reward model)
- Larger models (7B+ without quantization)

**Detection:**
- Error: "CUDA out of memory"
- Alert: `gpu_oom` type

**Fix:**
- Enable `gradient_checkpointing: true`
- Reduce `batch_size`
- Increase `gradient_accumulation_steps`
- Enable 4-bit quantization

### 3. Missing Dependencies

**Problem:** TRL version doesn't support method

**Templates Affected:**
- ORPO (requires TRL >= 0.8.0)
- RLHF/PPO (requires TRL PPO support)

**Detection:**
- Error: "Method 'orpo' not found"
- Import error during training

**Fix:**
- Update TRL version in standalone_trainer.py
- Check TRL compatibility matrix

### 4. Metrics Not Posting

**Problem:** Metrics fail to POST to API

**Detection:**
- Log: `[MetricsCallback] API POST failed: 405`
- No metrics visible in dashboard

**Fix:**
- ✅ Fixed 2025-12-19 (commit fdc9080)
- Verify METRICS_API_URL is correct
- Check job_token is valid

### 5. Alert Notifications Missing

**Problem:** No email/notifications on job status changes

**Detection:**
- No `job_started` notification
- No `job_completed` notification

**Fix:**
- ✅ Fixed 2025-12-19 (commit f7fe3ab)
- Verify ALERT_API_URL is set
- Check INTERNAL_API_KEY is valid

---

## 📝 Test Results Log

### SFT Standard

**Test Date:** Ongoing
**Status:** ✅ Working (with some issues)
**Job ID:** Multiple jobs tested
**Findings:**
- Training starts successfully
- Metrics POST working after fix (commit fdc9080)
- Alerts restored (commit f7fe3ab)
- Some issues remain (TBD)

**Metrics Collected:**
- TBD

---

### DPO Standard

**Test Date:** Not yet tested
**Status:** ⏳ Pending

---

### RLHF Standard

**Test Date:** Not yet tested
**Status:** ⏳ Pending

---

### ORPO Standard

**Test Date:** Not yet tested
**Status:** ⏳ Pending

---

### CPT Standard

**Test Date:** 2025-12-18 (mentioned working)
**Status:** ⏳ Need to re-verify
**Notes:** User mentioned CPT worked yesterday with notifications

---

## 🔜 Next Steps

### Immediate (Phase 1)

1. **DPO Template Test**
   - [ ] Create small DPO dataset (50 chosen/rejected pairs)
   - [ ] Deploy to RunPod
   - [ ] Monitor first 100 steps
   - [ ] Verify metrics + alerts

2. **ORPO Template Test**
   - [ ] Use same DPO dataset
   - [ ] Deploy to RunPod
   - [ ] Compare with DPO performance
   - [ ] Verify metrics + alerts

3. **CPT Template Test**
   - [ ] Create raw text dataset (100 documents)
   - [ ] Deploy to RunPod
   - [ ] Verify packing works
   - [ ] Verify metrics + alerts

4. **RLHF Template Test**
   - [ ] Research reward model implementation
   - [ ] Create RLHF dataset OR configure reward function
   - [ ] Deploy to RunPod
   - [ ] Monitor memory usage
   - [ ] Verify metrics + alerts

### Short-term (Phase 2)

- [ ] Run full outside dev test per template
- [ ] Collect complete metrics via SDK
- [ ] Document performance characteristics
- [ ] Identify optimal hyperparameters

### Long-term (Phase 3)

- [ ] Create batch testing script
- [ ] Run 5 jobs per template (25 total)
- [ ] Aggregate metrics programmatically
- [ ] Create performance comparison report
- [ ] Document limitations and gaps

---

## 📚 Related Files

**Template Definitions:**
- `lib/training/training-templates.ts` - All template configurations

**Training Infrastructure:**
- `lib/training/standalone_trainer.py` - Main training script
- `app/api/training/deploy/runpod/route.ts` - RunPod deployment
- `lib/training/runpod-service.ts` - Bash script generation

**Coordination:**
- `TRAINING_COORDINATION.md` - Training system architecture
- `API_COORDINATION.md` - API contracts

**Testing:**
- `packages/finetune-lab-sdk/` - SDK for programmatic testing

---

## 💡 Testing Best Practices

1. **Start with small datasets**
   - 50-500 samples for initial verification
   - Faster iterations, cheaper GPU costs

2. **Monitor first 100 steps closely**
   - Most errors appear in first 100 steps
   - Cancel early if errors detected

3. **Use SDK for metric collection**
   - Programmatic access to all job data
   - Easier to aggregate and analyze

4. **Document everything**
   - Log job IDs, timestamps, errors
   - Update this file with findings
   - Create test result reports

5. **Test incrementally**
   - One template at a time
   - Fix issues before moving to next
   - Build confidence progressively

---

**Last Updated:** 2025-12-19
