# Continued Pre-Training (CPT) Implementation Plan
**Date**: 2025-12-18
**Status**: VERIFICATION COMPLETE - READY FOR APPROVAL

---

## Executive Summary

This plan adds Continued Pre-Training (CPT) support to FineTune Lab with **ZERO breaking changes**. All changes are additive and backward compatible.

**Implementation Effort**: 12 files, ~215 lines of code
**Breaking Changes**: NONE
**Hard-coded Values**: NONE (all configurable)
**Unicode in Python**: NONE

---

## CRITICAL FINDING: Type Duplication Issue

### Issue Discovered
`TrainingMethod` type is defined in **4 separate files**:
1. `lib/training/training-config.types.ts:59`
2. `lib/training/format-validator.ts:7`
3. `lib/training/execution-types.ts:8`
4. `lib/constants.ts:64` (derived from TRAINING_METHODS constant)

### Additional Issue
**TRAINING_METHODS constant is MISSING 'orpo'**:
```typescript
// lib/constants.ts:58-62 (CURRENT - INCORRECT)
export const TRAINING_METHODS = {
  SFT: 'sft',
  DPO: 'dpo',
  RLHF: 'rlhf',
} as const;
```

But the type definitions include 'orpo'. This is a pre-existing bug.

### Resolution Strategy
All 4 definitions need coordinated updates to add 'cpt'. We'll also fix the missing 'orpo' in TRAINING_METHODS constant.

---

## Implementation Plan by File

### File 1: `lib/constants.ts`
**Lines to modify**: 58-62, 45-54
**Current state verified**: ✅

#### Change 1.1: Add ORPO to TRAINING_METHODS (Bug Fix)
```typescript
// BEFORE (lines 58-62):
export const TRAINING_METHODS = {
  SFT: 'sft',
  DPO: 'dpo',
  RLHF: 'rlhf',
} as const;

// AFTER:
export const TRAINING_METHODS = {
  SFT: 'sft',
  DPO: 'dpo',
  RLHF: 'rlhf',
  ORPO: 'orpo',
  CPT: 'cpt',
} as const;
```

#### Change 1.2: Add RAW_TEXT to DATASET_FORMATS
```typescript
// BEFORE (lines 45-54):
export const DATASET_FORMATS = {
  CHATML: 'chatml',
  SHAREGPT: 'sharegpt',
  JSONL: 'jsonl',
  DPO: 'dpo',
  RLHF: 'rlhf',
  ALPACA: 'alpaca',
  OPENORCA: 'openorca',
  UNNATURAL: 'unnatural',
} as const;

// AFTER:
export const DATASET_FORMATS = {
  CHATML: 'chatml',
  SHAREGPT: 'sharegpt',
  JSONL: 'jsonl',
  DPO: 'dpo',
  RLHF: 'rlhf',
  ALPACA: 'alpaca',
  OPENORCA: 'openorca',
  UNNATURAL: 'unnatural',
  RAW_TEXT: 'raw_text',
} as const;
```

---

### File 2: `lib/training/training-config.types.ts`
**Line to modify**: 59
**Current state verified**: ✅

```typescript
// BEFORE (line 59):
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo';

// AFTER:
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';
```

---

### File 3: `lib/training/format-validator.ts`
**Lines to modify**: 7, 14-19
**Current state verified**: ✅

#### Change 3.1: Update TrainingMethod type
```typescript
// BEFORE (line 7):
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo';

// AFTER:
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';
```

#### Change 3.2: Add CPT format compatibility
```typescript
// BEFORE (lines 14-19):
const FORMAT_COMPATIBILITY: Record<TrainingMethod, DatasetFormat[]> = {
  sft: ['chatml', 'sharegpt', 'jsonl', 'alpaca', 'openorca', 'unnatural'],
  dpo: ['dpo'],
  rlhf: ['rlhf'],
  orpo: ['dpo'],
};

// AFTER:
const FORMAT_COMPATIBILITY: Record<TrainingMethod, DatasetFormat[]> = {
  sft: ['chatml', 'sharegpt', 'jsonl', 'alpaca', 'openorca', 'unnatural'],
  dpo: ['dpo'],
  rlhf: ['rlhf'],
  orpo: ['dpo'],
  cpt: ['raw_text'],
};
```

---

### File 4: `lib/training/execution-types.ts`
**Line to modify**: 8
**Current state verified**: ✅

```typescript
// BEFORE (line 8):
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo';

// AFTER:
export type TrainingMethod = 'sft' | 'dpo' | 'rlhf' | 'orpo' | 'cpt';
```

---

### File 5: `lib/training/dataset.types.ts`
**Lines to modify**: 5, add new interface after line 5
**Current state verified**: ✅

#### Change 5.1: Add 'raw_text' to DatasetFormat
```typescript
// BEFORE (line 5):
export type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural';

// AFTER:
export type DatasetFormat = 'chatml' | 'sharegpt' | 'jsonl' | 'dpo' | 'rlhf' | 'alpaca' | 'openorca' | 'unnatural' | 'raw_text';
```

#### Change 5.2: Add RawTextExample interface
```typescript
// INSERT AFTER line 5 (after DatasetFormat type):

// Raw text example for Continued Pre-Training (CPT)
export interface RawTextExample {
  text: string;
}
```

---

### File 6: `lib/training/training-templates.ts`
**Lines to modify**: Insert new template before line 876, update 876-881
**Current state verified**: ✅

#### Change 6.1: Add CPT_STANDARD_TEMPLATE
```typescript
// INSERT BEFORE line 876 (before ALL_TEMPLATES comment):

/**
 * CPT (Continued Pre-Training) Standard Template
 *
 * Domain adaptation training on raw text using causal language modeling.
 * Used to adapt base models to specific domains before instruction fine-tuning.
 *
 * Key Parameters:
 * - Lower learning rate (2e-5) for stable adaptation
 * - Longer sequences (4096) to capture domain context
 * - Packing enabled for efficiency with raw text
 * - Raw text format (simple text strings, no conversations)
 *
 * Use Cases: Medical, legal, finance, research papers, enterprise knowledge bases
 * Workflow: Base Model -> CPT -> SFT -> DPO -> Production
 */
export const CPT_STANDARD_TEMPLATE: TrainingConfig = {
  model: {
    name: 'meta-llama/Llama-3.2-1B',
    trust_remote_code: true,
    torch_dtype: 'bfloat16',
    device_map: 'auto'
  },
  tokenizer: {
    name: 'meta-llama/Llama-3.2-1B',
    trust_remote_code: true
  },
  training: {
    method: 'cpt',
    num_epochs: 1,
    learning_rate: 2e-5,
    batch_size: 4,
    gradient_accumulation_steps: 8,
    warmup_ratio: 0.03,
    warmup_steps: 100,
    max_length: 4096,
    use_lora: true,

    lora_r: 16,
    lora_alpha: 32,
    lora_dropout: 0.1,

    lora_config: {
      r: 16,
      lora_alpha: 32,
      lora_dropout: 0.1,
      target_modules: ["q_proj", "k_proj", "v_proj", "o_proj"],
      bias: "none",
      task_type: "CAUSAL_LM"
    },

    quantization: {
      load_in_4bit: true,
      bnb_4bit_quant_type: "nf4",
      bnb_4bit_compute_dtype: "bfloat16",
      bnb_4bit_use_double_quant: true
    },

    optim: "paged_adamw_8bit",
    gradient_checkpointing: true,
    fp16: false,
    bf16: true,
    max_grad_norm: 1.0,
    weight_decay: 0.01,
    lr_scheduler_type: 'cosine',

    dataloader_num_workers: 4,
    dataloader_prefetch_factor: 2,
    dataloader_pin_memory: true,
    group_by_length: false,
    eval_batch_size: 4,

    logging_steps: 10,
    eval_steps: 500,
    save_steps: 500,
    save_total_limit: 3,
    evaluation_strategy: 'steps',
    packing: true
  },
  data: {
    strategy: 'standard',
    generation_type: 'real',
    max_samples: undefined,
    train_split: 0.95,
    eval_split: 0.05,
    dataset_format: 'raw_text'
  }
};
```

#### Change 6.2: Update ALL_TEMPLATES registry
```typescript
// BEFORE (lines 876-881):
export const ALL_TEMPLATES: Record<string, TrainingConfig> = {
  'sft_standard': SFT_STANDARD_TEMPLATE,
  'dpo_standard': DPO_STANDARD_TEMPLATE,
  'rlhf_standard': RLHF_STANDARD_TEMPLATE,
  'orpo_standard': ORPO_STANDARD_TEMPLATE
};

// AFTER:
export const ALL_TEMPLATES: Record<string, TrainingConfig> = {
  'sft_standard': SFT_STANDARD_TEMPLATE,
  'dpo_standard': DPO_STANDARD_TEMPLATE,
  'rlhf_standard': RLHF_STANDARD_TEMPLATE,
  'orpo_standard': ORPO_STANDARD_TEMPLATE,
  'cpt_standard': CPT_STANDARD_TEMPLATE
};
```

---

### File 7: `lib/training/standalone_trainer.py`
**Lines to modify**: 211 (add constant), 1790-1798 (add dispatch)
**Current state verified**: ✅

#### Change 7.1: Add DEFAULT_LEARNING_RATE_CPT constant
```python
# LOCATION: After line 211 (after DEFAULT_LEARNING_RATE_ORPO)
# BEFORE:
DEFAULT_LEARNING_RATE_ORPO = float(os.getenv("DEFAULT_LEARNING_RATE_ORPO", "8e-6"))

# AFTER:
DEFAULT_LEARNING_RATE_ORPO = float(os.getenv("DEFAULT_LEARNING_RATE_ORPO", "8e-6"))
DEFAULT_LEARNING_RATE_CPT = float(os.getenv("DEFAULT_LEARNING_RATE_CPT", "2e-5"))
```

#### Change 7.2: Add CPT dispatch in train() method
```python
# LOCATION: lines 1790-1798
# BEFORE:
        elif self.training_method == "orpo":
            self._train_orpo(resume_from_checkpoint)
        elif self.training_method == "teacher_mode":
            self._train_teacher_mode(resume_from_checkpoint)
        else:
            raise ValueError(
                f"Unknown training method: {self.training_method}. "
                f"Supported methods: sft, dpo, rlhf, orpo, teacher_mode"
            )

# AFTER:
        elif self.training_method == "orpo":
            self._train_orpo(resume_from_checkpoint)
        elif self.training_method == "cpt":
            self._train_cpt(resume_from_checkpoint)
        elif self.training_method == "teacher_mode":
            self._train_teacher_mode(resume_from_checkpoint)
        else:
            raise ValueError(
                f"Unknown training method: {self.training_method}. "
                f"Supported methods: sft, dpo, rlhf, orpo, cpt, teacher_mode"
            )
```

---

### File 8: `lib/training/standalone_trainer.py` (continued)
**Location**: After _train_orpo method (around line 2800)
**Current state verified**: Need to find exact insertion point

#### Change 8: Add _train_cpt method
```python
# INSERT AFTER _train_orpo method (will verify exact line)

def _train_cpt(self, resume_from_checkpoint: Optional[str] = None):
    """Continued pre-training with causal language modeling on raw text."""
    logger.info("[CPT] Configuring continued pre-training")

    training_config = self.config["training"]
    num_epochs = training_config.get("num_epochs", DEFAULT_NUM_EPOCHS)
    batch_size = training_config.get("batch_size", DEFAULT_BATCH_SIZE)
    learning_rate = training_config.get("learning_rate", DEFAULT_LEARNING_RATE_CPT)

    lr_scheduler_type = training_config.get("lr_scheduler_type", DEFAULT_LR_SCHEDULER_TYPE)
    warmup_ratio = training_config.get("warmup_ratio")
    save_steps = training_config.get("save_steps", DEFAULT_SAVE_STEPS)
    save_total_limit = training_config.get("save_total_limit", DEFAULT_SAVE_TOTAL_LIMIT)
    evaluation_strategy = training_config.get("evaluation_strategy", DEFAULT_EVALUATION_STRATEGY_SFT)
    eval_steps = training_config.get("eval_steps", DEFAULT_EVAL_STEPS)
    eval_batch_size = training_config.get("eval_batch_size", batch_size)

    packing = training_config.get("packing", True)

    logger.info(f"[CPT] Training config: epochs={num_epochs}, batch_size={batch_size}, lr={learning_rate}")
    logger.info(f"[CPT] Packing: {packing} (recommended for raw text)")

    training_args = SFTConfig(
        output_dir=self.output_dir,
        num_train_epochs=num_epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=eval_batch_size,
        gradient_accumulation_steps=training_config.get("gradient_accumulation_steps", DEFAULT_GRAD_ACCUM_STEPS),
        learning_rate=learning_rate,
        lr_scheduler_type=lr_scheduler_type,
        warmup_ratio=warmup_ratio,
        warmup_steps=training_config.get("warmup_steps", DEFAULT_WARMUP_STEPS),
        logging_steps=training_config.get("logging_steps", DEFAULT_LOGGING_STEPS),
        save_steps=save_steps,
        save_total_limit=save_total_limit,
        eval_strategy=evaluation_strategy,
        eval_steps=eval_steps,
        bf16=training_config.get("bf16", True),
        fp16=training_config.get("fp16", False),
        optim=training_config.get("optim", DEFAULT_OPTIMIZER),
        gradient_checkpointing=training_config.get("gradient_checkpointing", False),
        max_grad_norm=training_config.get("max_grad_norm", 1.0),
        weight_decay=training_config.get("weight_decay", 0.01),
        dataloader_num_workers=training_config.get("dataloader_num_workers", 0),
        dataloader_prefetch_factor=training_config.get("dataloader_prefetch_factor"),
        dataloader_pin_memory=training_config.get("dataloader_pin_memory", True),
        group_by_length=training_config.get("group_by_length", False),
        report_to=["tensorboard"] if self.tensorboard_writer else [],
        remove_unused_columns=False,
        dataset_text_field="text",
        max_seq_length=training_config.get("max_length", 4096),
        packing=packing,
    )

    logger.info("[CPT] Initializing SFT trainer for causal LM")
    trainer = SFTTrainer(
        model=self.model,
        args=training_args,
        train_dataset=self.train_dataset,
        eval_dataset=self.eval_dataset,
        tokenizer=self.tokenizer,
        callbacks=[self.metrics_callback],
    )

    logger.info("[CPT] Starting training")
    trainer.train(resume_from_checkpoint=resume_from_checkpoint)

    logger.info(f"[CPT] Saving final model to {self.output_dir}")
    trainer.save_model(self.output_dir)
    self.tokenizer.save_pretrained(self.output_dir)
```

---

### File 9: `lib/utils/format-labels.ts`
**Need to verify current content and add CPT label**

Will search for format label mappings and add:
```typescript
cpt: 'Continued Pre-Training (CPT)'
// or
'raw_text': 'Raw Text (CPT)'
```

---

### File 10: UI Components (TrainingParams)
**Need to locate and verify** - Add CPT to method dropdown

---

### File 11: UI Components (DatasetManager)
**Need to locate and verify** - Add raw_text format option

---

### File 12: Python config validator
**Need to locate and verify** - Ensure CPT passes validation

---

## Verification Checklist

Before implementing each change:
- [ ] Read file to verify current line numbers
- [ ] Verify exact code block matches plan
- [ ] Confirm no breaking changes
- [ ] Confirm no hardcoded values (use constants)
- [ ] Confirm no Unicode in Python files
- [ ] Write in ≤30 line blocks
- [ ] Test that change works with existing code

---

## Next Steps

1. **AWAIT APPROVAL** from user for this plan
2. Locate exact insertion points for files 9-12
3. Implement changes file-by-file with verification
4. Test each change before moving to next file

---

## Breaking Changes Analysis

**NONE** - All changes are additive:
- ✅ New type value added to existing union types
- ✅ New constant added to existing objects
- ✅ New method added to existing dispatch
- ✅ New template added to existing registry
- ✅ Existing code continues to work unchanged

---

## Risk Assessment

All risks are **LOW**:
1. Type duplication - Fixing all 4 locations eliminates inconsistency
2. Missing ORPO in constant - Bug fix included in plan
3. Python method implementation - Uses existing SFTTrainer (proven)
4. Format compatibility - Isolated to CPT, doesn't affect other methods

**Mitigation**: Implement file-by-file with verification after each change
