"""
Simple test for pre-tokenization - ONLY tests tokenizer, no model loading.
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from transformers import AutoTokenizer
from datasets import Dataset

def test_pretokenize_function():
    """Test only the _pretokenize_dataset function without loading model."""
    print("\n" + "=" * 60)
    print("SIMPLE PRE-TOKENIZATION TEST (NO MODEL LOADING)")
    print("=" * 60)
    
    # Use your local Qwen model path
    local_model_path = "huggingface_models/Qwen-Qwen3-1.7B/snapshots/70d244cc86ccca08cf5af4e1e306ecf908b1ad5e"
    
    # Check if model exists locally
    model_paths_to_try = [
        Path(local_model_path),
        Path(__file__).parent.parent.parent / "AI_Models" / local_model_path,
        Path("C:/Users/Juan/Desktop/Dev_Ops/AI_Models") / local_model_path
    ]
    
    tokenizer_path = None
    for p in model_paths_to_try:
        if p.exists():
            tokenizer_path = str(p)
            print(f"[Test] Found local model at: {tokenizer_path}")
            break
    
    if not tokenizer_path:
        print(f"[Test] ERROR: Local model not found. Tried:")
        for p in model_paths_to_try:
            print(f"  - {p}")
        return False
    
    # Load ONLY tokenizer (fast, no model weights)
    print("[Test] Loading tokenizer (no model weights)...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_path,
            trust_remote_code=True,
            local_files_only=True
        )
        print("[Test] Tokenizer loaded successfully")
    except Exception as e:
        print(f"[Test] ERROR loading tokenizer: {e}")
        return False
    
    # Create sample dataset
    sample_data = [
        {"messages": [
            {"role": "user", "content": "Test 1"},
            {"role": "assistant", "content": "Response 1"}
        ]},
        {"messages": [
            {"role": "user", "content": "Test 2"},
            {"role": "assistant", "content": "Response 2"}
        ]},
    ]
    
    dataset = Dataset.from_list(sample_data)
    print(f"[Test] Created dataset with {len(dataset)} examples")
    print(f"[Test] Original columns: {dataset.column_names}")
    
    # Import and test the pre-tokenization function
    print("\n[Test] Testing _pretokenize_dataset function...")
    try:
        from standalone_trainer import _pretokenize_dataset
        
        # Dummy formatting function (won't be used for chat data)
        def dummy_format(x):
            return str(x)
        
        # Minimal config
        test_config = {
            "training": {"max_length": 512},
            "dataset_path": "test_data.json"
        }
        
        # Call pre-tokenization
        tokenized_dataset = _pretokenize_dataset(
            dataset=dataset,
            tokenizer=tokenizer,
            formatting_func=dummy_format,
            model_name="test_model",
            config=test_config,
            dataset_type="test"
        )
        
        print(f"[Test] Tokenization complete!")
        print(f"[Test] Tokenized columns: {tokenized_dataset.column_names}")
        print(f"[Test] Dataset size: {len(tokenized_dataset)}")
        
        # Verify required columns
        if "input_ids" in tokenized_dataset.column_names:
            print("[Test] ✅ PASS - Has 'input_ids' column")
        else:
            print("[Test] ❌ FAIL - Missing 'input_ids' column")
            return False
        
        if "attention_mask" in tokenized_dataset.column_names:
            print("[Test] ✅ PASS - Has 'attention_mask' column")
        else:
            print("[Test] ❌ FAIL - Missing 'attention_mask' column")
            return False
        
        # Check first example
        first = tokenized_dataset[0]
        print(f"[Test] First example input_ids length: {len(first['input_ids'])}")
        print(f"[Test] First 10 tokens: {first['input_ids'][:10]}")
        
        # Check cache was created
        cache_dir = Path("tokenized_cache")
        if cache_dir.exists():
            print(f"[Test] ✅ Cache directory created: {cache_dir}")
        else:
            print(f"[Test] ⚠️  Cache directory not found (may have failed silently)")
        
    except Exception as e:
        print(f"[Test] ERROR during pre-tokenization: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    print("\n" + "=" * 60)
    print("✅ ALL TESTS PASSED - Pre-tokenization works!")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_pretokenize_function()
    sys.exit(0 if success else 1)
