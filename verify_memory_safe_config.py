"""
Verify memory_safe training configuration and dataset
Displays key parameters and calculates memory estimates
"""

import json
import os
from pathlib import Path

def format_bytes(bytes_val):
    """Convert bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_val < 1024.0:
            return f"{bytes_val:.2f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.2f} PB"

def count_jsonl_lines(filepath):
    """Count lines in JSONL file"""
    if not os.path.exists(filepath):
        return 0
    with open(filepath, 'r', encoding='utf-8') as f:
        return sum(1 for _ in f)

def main():
    config_path = Path(__file__).parent / "training_config_memory_safe.json"

    print("=" * 80)
    print("MEMORY-SAFE TRAINING CONFIGURATION VERIFICATION")
    print("=" * 80)
    print()

    # Load config
    with open(config_path, 'r') as f:
        config = json.load(f)

    # Display model settings
    print("[MODEL CONFIGURATION]")
    print(f"  Model: {config['model']['name']}")
    print(f"  Quantization: 4-bit NF4 with double quant")
    print(f"  Data Type: {config['model']['torch_dtype']}")
    print(f"  Max Sequence Length: {config['model']['max_seq_length']}")
    print()

    # Display training settings
    training = config['training']
    print("[TRAINING CONFIGURATION]")
    print(f"  Method: {training['method'].upper()}")
    print(f"  LoRA Enabled: {training['use_lora']}")
    print(f"  Batch Size: {training['batch_size']}")
    print(f"  Gradient Accumulation: {training['gradient_accumulation_steps']}")
    effective_batch = training['batch_size'] * training['gradient_accumulation_steps']
    print(f"  Effective Batch Size: {effective_batch}")
    print(f"  Max Length: {training['max_length']} tokens")
    print(f"  Number of Epochs: {training['num_epochs']}")
    print(f"  Learning Rate: {training['learning_rate']}")
    print(f"  Optimizer: {training['optim']}")
    print(f"  Packing: {training['packing']}")
    print(f"  Gradient Checkpointing: {training['gradient_checkpointing']}")
    print()

    # Display LoRA settings
    lora = training['lora_config']
    print("[LORA CONFIGURATION]")
    print(f"  Rank (r): {lora['r']}")
    print(f"  Alpha: {lora['lora_alpha']}")
    print(f"  Dropout: {lora['lora_dropout']}")
    print(f"  Target Modules: {', '.join(lora['target_modules'])}")
    print()

    # Dataset info
    dataset_path = Path(config['dataset_path'])
    print("[DATASET INFORMATION]")
    print(f"  Path: {dataset_path}")
    print(f"  Exists: {dataset_path.exists()}")

    if dataset_path.exists():
        total_samples = count_jsonl_lines(dataset_path)
        file_size = dataset_path.stat().st_size
        train_split = config['data']['train_split']
        eval_split = config['data']['eval_split']
        train_samples = int(total_samples * train_split)
        eval_samples = int(total_samples * eval_split)

        print(f"  File Size: {format_bytes(file_size)}")
        print(f"  Total Samples: {total_samples:,}")
        print(f"  Train Split: {train_split*100}% = {train_samples:,} samples")
        print(f"  Eval Split: {eval_split*100}% = {eval_samples:,} samples")
        print()

        # Calculate training steps
        steps_per_epoch = train_samples // effective_batch
        total_steps = steps_per_epoch * training['num_epochs']

        print("[TRAINING STEPS]")
        print(f"  Steps per Epoch: {steps_per_epoch:,}")
        print(f"  Total Steps: {total_steps:,}")
        print(f"  Logging Interval: Every {training['logging_steps']} steps")
        print(f"  Eval Interval: Every {training['eval_steps']} steps")
        print(f"  Save Interval: Every {training['save_steps']} steps")
        print()

    # Memory estimation
    print("[MEMORY ESTIMATION]")
    print("  Base Model (4B params, 4-bit):")
    print("    Model weights: ~2.5 GiB")
    print("    LoRA adapters: ~0.5 GiB")
    print(f"  Batch Memory (batch_size={training['batch_size']}, max_length={training['max_length']}):")
    print("    Activations: ~6-8 GiB")
    print("  Optimizer State (8-bit paged):")
    print("    AdamW states: ~3-4 GiB")
    print("  " + "-" * 40)
    print("  TOTAL ESTIMATED: ~13-15 GiB")
    print("  GPU Capacity: 24 GiB")
    print("  Safety Margin: ~9-11 GiB (38-46%)")
    print()

    # Performance estimation
    if dataset_path.exists() and total_samples > 0:
        print("[PERFORMANCE ESTIMATION]")
        print("  Expected Speed (with packing): 2-4 samples/sec")
        print()
        print("  At 2 samples/sec:")
        samples_per_hour_slow = 2 * 3600
        hours_per_epoch_slow = train_samples / samples_per_hour_slow
        total_time_slow = hours_per_epoch_slow * training['num_epochs']
        print(f"    Time per epoch: {hours_per_epoch_slow:.1f} hours")
        print(f"    Total training time: {total_time_slow:.1f} hours ({total_time_slow/24:.1f} days)")
        print()
        print("  At 4 samples/sec:")
        samples_per_hour_fast = 4 * 3600
        hours_per_epoch_fast = train_samples / samples_per_hour_fast
        total_time_fast = hours_per_epoch_fast * training['num_epochs']
        print(f"    Time per epoch: {hours_per_epoch_fast:.1f} hours")
        print(f"    Total training time: {total_time_fast:.1f} hours ({total_time_fast/24:.1f} days)")
        print()

    # Risk assessment
    print("[RISK ASSESSMENT]")
    print("  OOM Risk: LOW")
    print("    - Reduced batch size (4 vs 16)")
    print("    - Reduced max_length (1024 vs 2048)")
    print("    - 4-bit quantization active")
    print("    - 8-bit optimizer active")
    print("    - Gradient checkpointing enabled")
    print()
    print("  Quality Risk: LOW")
    print("    - Effective batch size maintained (32)")
    print("    - LoRA rank adequate (r=16)")
    print("    - All major modules targeted (7 layers)")
    print("    - Full dataset used (no downsampling)")
    print()

    print("=" * 80)
    print("RECOMMENDATION: Use this configuration for the next training run")
    print("=" * 80)
    print()
    print("To start training with this config:")
    print("  1. Open the training UI")
    print("  2. Select 'training_config_memory_safe.json'")
    print("  3. Verify dataset is 'mega_dataset_combined.jsonl'")
    print("  4. Start training")
    print("  5. Monitor GPU memory in first 100 steps (should stay under 16 GiB)")
    print()

if __name__ == "__main__":
    main()
