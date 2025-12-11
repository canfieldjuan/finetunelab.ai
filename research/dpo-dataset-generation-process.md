# DPO Dataset Generation Process
## FineTune Lab Atlas Training Data

**Created:** 2025-11-25
**Status:** In Progress
**Goal:** Generate high-quality, factually accurate DPO training data for Atlas assistant

---

## Core Principle

> **Every token generated must reflect real data, real scenarios, real training solutions, and real bottlenecks. We provide actionable information that breaks illusions, not reinforces them.**

---

## Problem Identified

During initial test runs (2025-11-25), we discovered LLMs generating plausible-sounding but **factually impossible scenarios**:

### Example of Bad Generation:
```
"Training a GPT-NeoX 20B model on a 50GB dataset with $500 budget in 3 days"
```

### Why This Is Wrong:
- 50GB text ≈ 12-15 billion tokens
- H100 at ~3,000 tok/sec = ~305 hours for ONE epoch
- $500 ÷ $3.50/hr = only 143 hours available
- **Reality: Would need $750+ minimum for single epoch**

### The Harm:
- User gets false expectations
- User wastes money on impossible task
- User loses trust in Atlas when reality hits
- Atlas looks incompetent

---

## Solution: Separate Concerns

We're splitting the dataset generation into **two distinct datasets** that can be merged later:

### Dataset 1: FineTune Lab Features & Workflows
- **Focus:** Platform features, UI workflows, how to use FineTune Lab
- **Source of Truth:** Codebase, feature manifest, actual UI behavior
- **LLM Generation:** Safe - features are documented and verifiable
- **Models:** DeepSeek-V3, Llama-3.3-70B, Mistral-Large (cost-effective)

### Dataset 2: ML Training Fundamentals (Reality Check Dataset)
- **Focus:** Real costs, real timelines, real hardware requirements, real bottlenecks
- **Source of Truth:** Benchmarks, pricing data, published training reports
- **LLM Generation:** Requires factual grounding - use premium models
- **Models:** GPT-4o, Claude Opus 4.5 (higher accuracy, fact-checking capability)
- **Content Types:**
  - Model size vs VRAM requirements
  - Dataset size vs training time calculations
  - Cost estimates by model/GPU combination
  - Common mistakes and realistic expectations
  - "Reality check" responses that correct user misconceptions

---

## Dataset 2: ML Training Reality Data

### Required Factual Information

#### 1. Model Size vs Hardware Requirements

| Model Size | Min VRAM (Full FT) | Min VRAM (LoRA) | Min VRAM (QLoRA 4-bit) |
|------------|-------------------|-----------------|------------------------|
| 1B | 8GB | 6GB | 4GB |
| 3B | 16GB | 10GB | 6GB |
| 7B | 32GB | 16GB | 8GB |
| 13B | 64GB | 24GB | 12GB |
| 20B | 80GB+ | 40GB | 16GB |
| 70B | 320GB+ (multi-GPU) | 80GB | 24GB |

#### 2. GPU Pricing (Cloud - as of Nov 2025)

| GPU | VRAM | Approx $/hour | Best For |
|-----|------|---------------|----------|
| RTX 4090 | 24GB | $0.50-0.80 | 7B QLoRA, inference |
| A100 40GB | 40GB | $1.50-2.00 | 7B-13B training |
| A100 80GB | 80GB | $2.50-3.50 | 13B-20B training |
| H100 80GB | 80GB | $3.00-4.50 | 20B+ training, fastest |

#### 3. Training Time Estimates (Approximate)

| Dataset Size | Model Size | GPU | Method | Est. Time (1 epoch) |
|--------------|------------|-----|--------|---------------------|
| 1k examples | 7B | A100 40GB | QLoRA | 15-30 min |
| 5k examples | 7B | A100 40GB | QLoRA | 1-2 hours |
| 10k examples | 7B | A100 40GB | QLoRA | 2-4 hours |
| 50k examples | 7B | A100 40GB | QLoRA | 10-20 hours |
| 1k examples | 13B | A100 80GB | QLoRA | 30-60 min |
| 10k examples | 13B | A100 80GB | QLoRA | 4-8 hours |
| 1k examples | 70B | H100 | QLoRA | 2-4 hours |
| 10k examples | 70B | H100 | QLoRA | 20-40 hours |

#### 4. Cost Estimates (Realistic)

| Scenario | Est. Cost |
|----------|-----------|
| 7B model, 5k examples, QLoRA, 3 epochs | $10-30 |
| 7B model, 20k examples, QLoRA, 3 epochs | $30-80 |
| 13B model, 10k examples, QLoRA, 3 epochs | $50-150 |
| 70B model, 5k examples, QLoRA, 2 epochs | $100-300 |
| 7B model, full fine-tune, 10k examples | $200-500 |

#### 5. Common User Misconceptions to Address

1. **"I can fine-tune a 70B model on my RTX 3080"**
   - Reality: 70B needs 24GB+ even with QLoRA 4-bit

2. **"I have 100GB of data, this will make my model amazing"**
   - Reality: Quality > quantity. 5k high-quality examples often beats 100k noisy ones

3. **"Fine-tuning will make my model know everything about X"**
   - Reality: Fine-tuning adjusts behavior/style, not knowledge. Use RAG for knowledge.

4. **"Training loss went down so my model is better"**
   - Reality: Low training loss can mean overfitting. Eval loss matters more.

5. **"I can train in an hour for $5"**
   - Reality: Depends entirely on model size, dataset size, and GPU choice

---

## Generation Process

### Phase 1: Feature-Focused Dataset (Current)
1. Use existing prompt with FineTune Lab features
2. Generate with cost-effective models (DeepSeek, Llama, Mistral)
3. Review for feature accuracy (verifiable against codebase)
4. Remove any examples with specific cost/time claims

### Phase 2: Reality Check Dataset (Next)
1. Create new prompt focused on ML training fundamentals
2. Include factual tables above as grounding data
3. Use premium models (GPT-4o, Claude Opus 4.5)
4. Explicitly instruct: "Correct user misconceptions with real numbers"
5. Human review all cost/time claims against benchmarks

### Phase 3: Merge & Validate
1. Combine both datasets
2. Cross-reference any overlapping claims
3. Final human review pass
4. Tag examples by confidence level

---

## Quality Gates

### For Feature Examples:
- [ ] Feature name matches actual FineTune Lab feature
- [ ] UI flow described matches actual implementation
- [ ] No fabricated features mentioned

### For Training Reality Examples:
- [ ] Cost estimates within 2x of benchmark data
- [ ] Time estimates within 2x of benchmark data
- [ ] Hardware requirements match published specs
- [ ] No impossible scenarios (like 20B on 50GB for $500)

### For All Examples:
- [ ] Prompt is 80-120 words with real context
- [ ] Chosen response is 200-300 words with specifics
- [ ] Rejected response is 80-120 words, generic but not wrong
- [ ] JSON valid and complete

---

## Files & Locations

```
/research/
├── dpo-dataset-generation-process.md     # This document
├── deepseek-dpo-generation-prompt.md     # Main generation prompt
├── atlas_features.yaml                    # Feature reference
├── finetune-lab-feature-manifest.yaml    # Feature locations in code
├── ml-training-reality-data.yaml         # [TO CREATE] Factual training data
├── test_dpo_generation_3_llms.py         # Test runner
└── test_results/                          # Generated examples
```

---

## Next Steps

1. [ ] Create `ml-training-reality-data.yaml` with verified benchmarks
2. [ ] Update main prompt to exclude cost/time specifics OR include factual constraints
3. [ ] Create separate "Reality Check" prompt for training fundamentals
4. [ ] Run premium model generation for reality dataset
5. [ ] Establish human review process for factual claims

---

## Open Questions

1. **Where do we source authoritative benchmark data?**
   - HuggingFace training reports?
   - RunPod/Lambda Labs published benchmarks?
   - Our own internal testing?

2. **How do we handle rapidly changing GPU prices?**
   - Include date stamps on all cost data?
   - Use ranges instead of exact prices?
   - Update dataset quarterly?

3. **Should Atlas admit uncertainty?**
   - "Costs vary, but typical range is $X-Y" vs exact numbers?
   - Include confidence levels in responses?

---

---

## Model Selection Results

### Round 1: DeepSeek-V3 vs Llama-3.3-70B vs Mistral-Large
**Winner: DeepSeek-V3**
- Best structure (numbered steps, bold features)
- Most actionable responses
- Consistent 210-220 word chosen responses
- Best price/quality ratio

### Round 2: DeepSeek-V3 (baseline) vs Cogito-V2.1-671B vs Nemotron-Super-49B
**Winner: Nemotron-Super-49B**

| Model | Avg Chosen | Speed | Cost | Notes |
|-------|-----------|-------|------|-------|
| DeepSeek-V3 | 216 words | 37 tok/s | $0.002 | Clean structure, solid |
| Cogito-V2.1-671B | 242 words | 74 tok/s | $0.008 | Good but 4x cost |
| **Nemotron-Super-49B** | 289 words | 76 tok/s | $0.002 | **Best depth, Pro Tips, diverse personas** |

**Why Nemotron won:**
1. Longer, more detailed chosen responses (289 avg vs 216)
2. Includes "Pro Tips" that add extra value
3. More diverse personas (startup founder, health tech, enterprise lead)
4. Specific navigation paths: "Go to Evaluation → Model Comparison Lab"
5. Same cost as DeepSeek ($0.002)
6. 2x faster than DeepSeek (76 vs 37 tok/s)

**Selected Model for Production: `nvidia/llama-3.3-nemotron-super-49b-v1.5`**

---

## Final Configuration (Production Ready)

### Model
- **Model:** `nvidia/llama-3.3-nemotron-super-49b-v1.5` (Nemotron-Super-49B)
- **Speed:** ~77 tok/s
- **Cost:** ~$0.002 per 5 examples

### Token Budget Per Example
| Component | Words | Est. Tokens |
|-----------|-------|-------------|
| Prompt | 80-120 | ~130 |
| Chosen | 250-300 | ~380 |
| Rejected | 140-160 | ~200 |
| Metadata | - | ~50 |
| **Total** | ~500 | **~760 tokens** |

### Quality Settings

**Prompt Requirements:**
- Length: 80-120 words
- Must include user context, role, constraints, concerns
- Real scenarios, not generic questions

**Persona Variety:**
- Solo developer (side project)
- ML intern (first job, nervous)
- Non-technical CEO (board presentations)
- Enterprise architect (company-wide adoption)
- Agency consultant (multiple clients)
- Frustrated user (troubleshooting)
- Data scientist (use sparingly)

**Scenario Distribution:**
- Basic usage ("How do I...") - 40%
- Troubleshooting ("Not working...") - 30%
- Failure scenarios ("Something broke...") - 20%
- Edge cases - 10%

**Chosen Response:**
- Length: 250-300 words
- Numbered steps with bold headers
- Specific feature names and navigation paths
- Pro Tips with expert insights
- Anticipates follow-up questions

**Rejected Response:**
- Length: 140-160 words (~1.8-2x ratio)
- Genuinely helpful (reasonable person might accept)
- Generic references ("check the dashboard" vs specific paths)
- No Pro Tips or expert insights
- Plain paragraphs vs structured format
- Correct but less actionable

### Exclusions (Separate Dataset Later)
- Specific dollar amounts or costs
- Training times or durations
- Hardware requirements (GPU types, VRAM)
- Dataset sizes or model parameters
- Token throughput numbers

---

## Changelog

- **2025-11-25:** Final configuration locked - ready for production batches
- **2025-11-25:** Added persona variety and scenario distribution
- **2025-11-25:** Balanced rejected response length (~150 words, 1.8-2x ratio)
- **2025-11-25:** Added model selection results - Nemotron-Super-49B selected
- **2025-11-25:** Initial document created after identifying hallucination issue in test generation
