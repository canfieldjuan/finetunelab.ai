"""
Test pre-tokenization functionality.
Run a minimal training iteration to verify pre-tokenization works correctly.
"""
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

import logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s'
)

def test_pretokenization():
    """Test pre-tokenization with small dataset."""
    print("\n" + "=" * 60)
    print("PRE-TOKENIZATION INTEGRATION TEST")
    print("=" * 60)
    
    config_path = Path("test_pretokenize_config.json")
    
    if not config_path.exists():
        print(f"ERROR: Config file not found: {config_path}")
        return False
    
    print(f"\n[Test] Loading config from: {config_path}")
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    print(f"[Test] Pretokenize enabled: {config['training'].get('pretokenize', False)}")
    print(f"[Test] Dataset path: {config['dataset_path']}")
    print(f"[Test] Model: {config['model']['name']}")
    
    # Import after path setup
    from standalone_trainer import load_datasets, ToolTrainer
    
    print("\n[Test] Loading datasets...")
    try:
        train_dataset, eval_dataset = load_datasets(config)
        print(f"[Test] Train dataset: {len(train_dataset)} examples")
        print(f"[Test] Eval dataset: {len(eval_dataset)} examples")
        print(f"[Test] Train columns: {train_dataset.column_names}")
    except Exception as e:
        print(f"[Test] ERROR loading datasets: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n[Test] Creating ToolTrainer (will trigger pre-tokenization)...")
    try:
        output_dir = Path(config['output_dir'])
        trainer = ToolTrainer(
            config=config,
            train_dataset=train_dataset,
            eval_dataset=eval_dataset,
            output_dir=output_dir
        )
        print("[Test] ToolTrainer created successfully")
        
        # Check if datasets are pre-tokenized
        if "input_ids" in trainer.train_dataset.column_names:
            print("[Test] SUCCESS - Train dataset is pre-tokenized")
            print(f"[Test] Columns: {trainer.train_dataset.column_names}")
        else:
            print("[Test] FAIL - Train dataset is NOT pre-tokenized")
            return False
            
    except Exception as e:
        print(f"[Test] ERROR creating trainer: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("PRE-TOKENIZATION TEST PASSED")
    print("=" * 60)
    print("\nCache directory should exist: tokenized_cache/")
    print("Check logs above for '[PreTokenize]' messages")
    return True


if __name__ == "__main__":
    success = test_pretokenization()
    sys.exit(0 if success else 1)
