"""
Test Training with Hardcoded Fast Config
Purpose: Isolate whether slow performance is due to config flow or fundamental training issues
Run: python test_hardcoded_training.py
"""

import json
import subprocess
from pathlib import Path

# HARDCODED FAST CONFIG - Optimized for RTX 3090
config = {
    "execution_id": "hardcoded-test-001",
    "dataset_path": "C:/Users/Juan/Desktop/Dev_Ops/web-ui/output/completed_datasets/mega_dataset_combined.jsonl",
    "output_dir": "./output/hardcoded_test",
    "model": {
        "name": "Qwen/Qwen2.5-Coder-1.5B",
        "device_map": "auto",
        "torch_dtype": "bfloat16",
        "trust_remote_code": True,
        "max_seq_length": 512
    },
    "training": {
        "method": "sft",
        "use_lora": True,
        "num_epochs": 1,
        "batch_size": 16,
        "gradient_accumulation_steps": 2,
        "learning_rate": 2e-4,
        "lr_scheduler_type": "cosine",
        "warmup_ratio": 0.03,
        "max_length": 512,
        "bf16": True,
        "fp16": False,
        "optim": "adamw_torch_fused",
        "gradient_checkpointing": False,
        "logging_steps": 5,
        "save_steps": 1000,
        "eval_steps": 1000,
        "save_total_limit": 1,
        "evaluation_strategy": "steps",
        "load_best_model_at_end": False,
        "group_by_length": True,
        "packing": False,  # DISABLE PACKING - no Flash Attention
        "dataloader_num_workers": 8,  # CRITICAL
        "max_grad_norm": 1.0,
        "weight_decay": 0.01,
        "lora_config": {
            "r": 16,
            "lora_alpha": 32,
            "lora_dropout": 0.05,
            "bias": "none",
            "task_type": "CAUSAL_LM",
            "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"]
        },
        "quantization": {
            "load_in_4bit": True,
            "bnb_4bit_quant_type": "nf4",
            "bnb_4bit_compute_dtype": "bfloat16",
            "bnb_4bit_use_double_quant": True
        }
    },
    "data": {
        "train_split": 0.95,
        "eval_split": 0.05
    }
}

print("="*80)
print("HARDCODED CONFIG TEST")
print("="*80)
print(f"Model: {config['model']['name']}")
print(f"Batch Size: {config['training']['batch_size']}")
print(f"Dataloader Workers: {config['training']['dataloader_num_workers']}")
print(f"Packing: {config['training']['packing']}")
print(f"Optimizer: {config['training']['optim']}")
print()

# Dataset path
dataset_path = Path("C:/Users/Juan/Desktop/Dev_Ops/web-ui/output/completed_datasets/mega_dataset_combined.jsonl")

if not dataset_path.exists():
    print(f"ERROR: Dataset not found: {dataset_path}")
    exit(1)

# Output directory
output_dir = Path(__file__).parent / "output" / "hardcoded_test"
output_dir.mkdir(parents=True, exist_ok=True)

# Save config
config_file = output_dir / "test_config.json"
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print(f"Dataset: {dataset_path}")
print(f"Output: {output_dir}")
print(f"Config: {config_file}")
print()
print("="*80)
print("STARTING TRAINING")
print("="*80)
print()

# Run standalone_trainer.py
python_exe = Path(__file__).parent / "trainer_venv" / "bin" / "python3"
trainer_script = Path(__file__).parent / "standalone_trainer.py"

cmd = [
    str(python_exe),
    str(trainer_script),
    "--config", str(config_file),
    "--execution-id", "hardcoded-test-001"
]

print(f"Command: {' '.join([str(c) for c in cmd])}")
print()

try:
    subprocess.run(cmd, check=True)
    print()
    print("="*80)
    print("TRAINING COMPLETE - Check output above for samples/second")
    print("="*80)
except subprocess.CalledProcessError as e:
    print()
    print(f"TRAINING FAILED: Exit code {e.returncode}")
except Exception as e:
    print()
    print(f"ERROR: {e}")
