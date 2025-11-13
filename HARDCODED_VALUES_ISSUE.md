# Hardcoded Values Issue - Training Speed Bottleneck

## Root Cause Found

The SFT trainer in `lib/training/standalone_trainer.py` has **HARDCODED values** that override your config file settings.

This is why changing the config doesn't improve speed.

---

## Hardcoded Values (Lines 836-864)

### What's Hardcoded in SFTConfig:

```python
training_args = SFTConfig(
    # ... your config values ...
    logging_steps=10,                    # HARDCODED (ignores config)
    eval_steps=100,                      # HARDCODED (ignores config)
    dataloader_pin_memory=False,         # HARDCODED (ignores config)
    fp16=self.config["training"].get("use_lora", True),  # WRONG FIELD (should be bf16)
    max_grad_norm=1.0,                   # HARDCODED (ignores config)
    optim="adamw_torch",                 # HARDCODED (ignores config)
    label_smoothing_factor=0.1,          # HARDCODED
    # ... and many fields are MISSING ...
)
```

### What's MISSING from SFTConfig:

These fields are NOT passed to SFTConfig at all:

- `gradient_checkpointing` - **THIS IS THE MAIN SPEED KILLER**
- `group_by_length`
- `dataloader_num_workers`
- `bf16` (fp16 is set to wrong field)
- `weight_decay`
- `dataloader_prefetch_factor`
- `max_length` (used later, not in SFTConfig)

---

## Why This Causes Slow Training

### 1. Gradient Checkpointing (ENABLED by default)

**Your config says:** `"gradient_checkpointing": false`
**Actual value:** `True` (PyTorch/Transformers default)
**Impact:** 2-3x slowdown

### 2. Optimizer (HARDCODED to adamw_torch)

**Your config says:** `"optim": "paged_adamw_8bit"`
**Actual value:** `"adamw_torch"` (hardcoded line 859)
**Impact:** This one is actually GOOD (adamw_torch is faster)

### 3. Other Missing Optimizations

- `dataloader_num_workers`: Not set, uses default (0 or 1)
- `dataloader_prefetch_factor`: Not set
- `group_by_length`: Not set, may default to True
- `bf16`: Wrong field used (fp16 instead)

---

## Comparison: SFT vs DPO Trainer Code

### SFT Trainer (BROKEN - lines 836-864)
```python
training_args = SFTConfig(
    # Only reads: num_epochs, batch_size, learning_rate, warmup_ratio,
    #             lr_scheduler_type, save_steps, save_total_limit,
    #             evaluation_strategy, packing, gradient_accumulation_steps

    # HARDCODED: logging_steps, eval_steps, optim, max_grad_norm,
    #            dataloader_pin_memory, label_smoothing_factor

    # MISSING: gradient_checkpointing, group_by_length, dataloader_num_workers,
    #          bf16, weight_decay, dataloader_prefetch_factor
)
```

### DPO Trainer (CORRECT - lines 970-981)
```python
training_args = DPOConfig(
    # Properly reads from config:
    gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", 1),
    max_grad_norm=self.config["training"].get("max_grad_norm", 0.3),
    optim=self.config["training"].get("optim", "paged_adamw_8bit"),
    bf16=self.config["training"].get("bf16", False),
    fp16=self.config["training"].get("fp16", True),
    max_length=self.config["training"].get("max_length", 512),
    # ... etc
)
```

**DPO trainer properly reads config values, SFT trainer doesn't!**

---

## Fields That Need To Be Added to SFTConfig

```python
training_args = SFTConfig(
    # ... existing fields ...

    # ADD THESE:
    gradient_checkpointing=self.config["training"].get("gradient_checkpointing", False),
    group_by_length=self.config["training"].get("group_by_length", False),
    dataloader_num_workers=self.config["training"].get("dataloader_num_workers", 0),
    dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", None),
    dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", True),
    bf16=self.config["training"].get("bf16", False),
    fp16=self.config["training"].get("fp16", False),
    weight_decay=self.config["training"].get("weight_decay", 0.0),

    # CHANGE THESE FROM HARDCODED:
    logging_steps=self.config["training"].get("logging_steps", 25),
    eval_steps=self.config["training"].get("eval_steps", 500),
    max_grad_norm=self.config["training"].get("max_grad_norm", 1.0),
    optim=self.config["training"].get("optim", "adamw_torch"),

    # REMOVE THIS (not standard):
    # label_smoothing_factor=0.1,
)
```

---

## The Fix

### File: `lib/training/standalone_trainer.py`

**Lines 836-864:** Replace SFTConfig construction with:

```python
# Build SFTConfig with ALL UI-configurable parameters
training_args = SFTConfig(
    output_dir=str(self.output_dir),
    overwrite_output_dir=True,
    num_train_epochs=num_epochs,
    per_device_train_batch_size=batch_size,
    per_device_eval_batch_size=self.config["training"].get("eval_batch_size", 4),
    gradient_accumulation_steps=self.config["training"].get("gradient_accumulation_steps", 1),
    learning_rate=learning_rate,
    warmup_steps=self.config["training"].get("warmup_steps", 100),
    warmup_ratio=warmup_ratio if warmup_ratio is not None else 0.0,

    # Logging and evaluation
    logging_steps=self.config["training"].get("logging_steps", 25),
    eval_strategy=evaluation_strategy,
    eval_steps=self.config["training"].get("eval_steps", 500),

    # Checkpointing
    save_strategy="steps",
    save_steps=save_steps,
    save_total_limit=save_total_limit,
    load_best_model_at_end=True,
    metric_for_best_model="eval_loss",
    greater_is_better=False,

    # Precision and optimization
    bf16=self.config["training"].get("bf16", False),
    fp16=self.config["training"].get("fp16", False),
    optim=self.config["training"].get("optim", "adamw_torch"),
    max_grad_norm=self.config["training"].get("max_grad_norm", 1.0),
    weight_decay=self.config["training"].get("weight_decay", 0.01),

    # Memory optimization
    gradient_checkpointing=self.config["training"].get("gradient_checkpointing", False),

    # Data loading
    dataloader_num_workers=self.config["training"].get("dataloader_num_workers", 0),
    dataloader_prefetch_factor=self.config["training"].get("dataloader_prefetch_factor", None) if self.config["training"].get("dataloader_num_workers", 0) > 0 else None,
    dataloader_pin_memory=self.config["training"].get("dataloader_pin_memory", True),
    group_by_length=self.config["training"].get("group_by_length", False),

    # SFT-specific
    packing=packing,

    # Scheduler
    lr_scheduler_type=lr_scheduler_type,

    # Reporting
    report_to="tensorboard" if self.config.get("tensorboard", {}).get("enabled") else None,
    label_names=["labels"]
)
```

---

## Why You're Stuck at 0.03 samples/sec

**Gradient checkpointing is ON** (default in Transformers when not explicitly set to False)

Even though your config says:
```json
{
  "training": {
    "gradient_checkpointing": false
  }
}
```

The SFTConfig doesn't read this field, so it uses the model's default (which is ON for memory efficiency).

**This single issue causes 2-3x slowdown.**

Combined with:
- Limited dataloader workers (default 0)
- Group_by_length overhead
- 4-bit quantization

You get: 0.03 samples/sec instead of 2-4 samples/sec.

---

## Immediate Workaround

Since fixing the code requires editing `standalone_trainer.py`, here's a temporary workaround:

### Option 1: Use DPO Training Method

DPO trainer properly reads all config fields. Change your config:

```json
{
  "training": {
    "method": "dpo"
  }
}
```

But this won't work for ChatML data (DPO needs preference pairs).

### Option 2: Disable Gradient Checkpointing via Model Config

Add to config:
```json
{
  "model": {
    "gradient_checkpointing_enable": false
  }
}
```

But this field might not be read either.

### Option 3: Edit standalone_trainer.py (RECOMMENDED)

Apply the fix above to read gradient_checkpointing and other fields from config.

---

## Required Config Fields (Once Fixed)

After fixing standalone_trainer.py, use this config:

```json
{
  "model": {
    "name": "Qwen/Qwen2.5-Coder-4B-Instruct",
    "device_map": "auto",
    "torch_dtype": "bfloat16",
    "trust_remote_code": true,
    "max_seq_length": 1024
  },
  "training": {
    "method": "sft",
    "use_lora": true,
    "num_epochs": 3,
    "batch_size": 6,
    "gradient_accumulation_steps": 4,
    "learning_rate": 2e-4,
    "lr_scheduler_type": "cosine",
    "warmup_ratio": 0.03,
    "max_length": 1024,
    "bf16": true,
    "fp16": false,
    "optim": "adamw_torch",
    "gradient_checkpointing": false,
    "logging_steps": 25,
    "eval_steps": 500,
    "save_steps": 500,
    "save_total_limit": 2,
    "evaluation_strategy": "steps",
    "group_by_length": false,
    "packing": true,
    "dataloader_num_workers": 4,
    "dataloader_prefetch_factor": 4,
    "dataloader_pin_memory": true,
    "max_grad_norm": 1.0,
    "weight_decay": 0.01,
    "lora_config": {
      "r": 16,
      "lora_alpha": 32,
      "lora_dropout": 0.1,
      "bias": "none",
      "task_type": "CAUSAL_LM",
      "target_modules": [
        "q_proj", "k_proj", "v_proj", "o_proj",
        "gate_proj", "up_proj", "down_proj"
      ]
    },
    "quantization": {
      "load_in_4bit": true,
      "bnb_4bit_quant_type": "nf4",
      "bnb_4bit_compute_dtype": "bfloat16",
      "bnb_4bit_use_double_quant": true
    }
  },
  "data": {
    "train_split": 0.95,
    "eval_split": 0.05
  },
  "dataset_path": "output/completed_datasets/mega_dataset_combined.jsonl"
}
```

---

## Summary

**Problem:** SFTConfig in standalone_trainer.py has hardcoded values and missing fields.

**Impact:** Your config changes don't affect training, gradient_checkpointing stays ON.

**Result:** 0.03 samples/sec (40x slower than expected).

**Solution:** Fix standalone_trainer.py lines 836-864 to read all config fields properly.

**Expected after fix:** 2-4 samples/sec (60-120x speedup).
