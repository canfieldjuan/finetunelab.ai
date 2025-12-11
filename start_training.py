#!/usr/bin/env python3
"""
Quick script to start training directly
Bypasses UI and API - directly calls standalone_trainer
"""

import sys
import json
from pathlib import Path

# Add lib to path
sys.path.insert(0, str(Path(__file__).parent / "lib" / "training"))

from standalone_trainer import StandaloneTrainer

def main():
    print("🚀 Starting Training - Quick Wins Applied")
    print("=" * 60)

    # Your dataset and config
    dataset_id = "7b4d3743-5e48-4ef4-880c-b72615414a79"
    config_id = "15d63981-2630-4f96-a101-49cd359eef39"

    # Test config (1 epoch, fast)
    config = {
        "model": {
            "name": "Qwen/Qwen3-0.6B",
            "device_map": "auto",
            "torch_dtype": "float16",
            "trust_remote_code": True
        },
        "training": {
            "method": "sft",
            "num_epochs": 1,  # Fast test
            "batch_size": 8,
            "gradient_accumulation_steps": 1,
            "learning_rate": 0.0002,
            "warmup_steps": 100,
            "max_length": 1024,
            "logging_steps": 10,
            "use_lora": True,
            "lora_r": 8,
            "lora_alpha": 16,
            "lora_dropout": 0.05
        },
        "eval_split": 0.1,
        "execution_id": f"test_{dataset_id[:8]}"
    }

    # Dataset path - you'll need to get this from Supabase storage
    # For now, this assumes you've downloaded it
    dataset_path = Path(__file__).parent / "datasets" / f"{dataset_id}.jsonl"

    if not dataset_path.exists():
        print(f"❌ Dataset not found at: {dataset_path}")
        print("\nYou need to:")
        print("1. Download dataset from Supabase storage")
        print("2. Place it in: datasets/")
        print("3. Or use the API/UI method instead")
        return

    config["dataset_path"] = str(dataset_path)

    print(f"\n📊 Config:")
    print(f"  Model: {config['model']['name']}")
    print(f"  Epochs: {config['training']['num_epochs']}")
    print(f"  Batch: {config['training']['batch_size']}")
    print(f"  Learning rate: {config['training']['learning_rate']}")
    print(f"  Dataset: {dataset_path.name}")

    print(f"\n✅ Quick wins active:")
    print(f"  - Label smoothing: 0.1")
    print(f"  - LR scheduler: cosine")
    print(f"  - LoRA targets: 7 modules (q,k,v,o,gate,up,down)")

    print(f"\n⏱️  Expected time: 15-20 minutes")
    print(f"\n🚂 Starting training...\n")

    # Create trainer and start
    trainer = StandaloneTrainer(config)
    trainer.train()

    print("\n✅ Training complete!")
    print(f"Check output directory: {trainer.output_dir}")

if __name__ == "__main__":
    main()
