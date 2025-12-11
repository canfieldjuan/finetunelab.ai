"""
Test tokenizer behavior to verify pre-tokenization requirements.
This test validates that we can safely implement pre-tokenization.
"""
import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from transformers import AutoTokenizer
from datasets import Dataset

def test_tokenizer_output():
    """Test what tokenizer outputs and verify it matches SFTTrainer requirements."""
    print("\n" + "=" * 60)
    print("TOKENIZER OUTPUT VERIFICATION TEST")
    print("=" * 60)
    
    # Test with Qwen model (same as current training job)
    model_name = "Qwen/Qwen2.5-1.5B-Instruct"
    print(f"\n[Test] Loading tokenizer: {model_name}")
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            trust_remote_code=True
        )
        print(f"[Test] Tokenizer loaded successfully")
        print(f"[Test] Pad token: {tokenizer.pad_token}")
        print(f"[Test] EOS token: {tokenizer.eos_token}")
        print(f"[Test] Vocab size: {len(tokenizer)}")
    except Exception as e:
        print(f"[Test] ERROR loading tokenizer: {e}")
        return False
    
    # Create sample data (matches current training format)
    sample_data = [
        {
            "messages": [
                {"role": "user", "content": "What is Python?"},
                {"role": "assistant", "content": "Python is a programming language."}
            ]
        },
        {
            "messages": [
                {"role": "user", "content": "How do I use loops?"},
                {"role": "assistant", "content": "Use for or while loops."}
            ]
        }
    ]
    
    print(f"\n[Test] Created {len(sample_data)} test examples")
    
    # Test tokenization with apply_chat_template
    print("\n[Test] Testing apply_chat_template() method...")
    try:
        messages = sample_data[0]["messages"]
        output = tokenizer.apply_chat_template(
            messages,
            tokenize=True,
            add_generation_prompt=False,
            return_dict=True
        )
        
        print(f"[Test] Tokenization successful!")
        print(f"[Test] Output keys: {list(output.keys())}")
        print(f"[Test] input_ids length: {len(output['input_ids'])}")
        print(f"[Test] attention_mask length: {len(output['attention_mask'])}")
        print(f"[Test] First 10 input_ids: {output['input_ids'][:10]}")
        
    except Exception as e:
        print(f"[Test] ERROR during tokenization: {e}")
        return False
    
    # Test Dataset creation with tokenized data
    print("\n[Test] Creating Dataset with tokenized data...")
    try:
        tokenized_data = []
        for example in sample_data:
            result = tokenizer.apply_chat_template(
                example["messages"],
                tokenize=True,
                add_generation_prompt=False,
                return_dict=True
            )
            tokenized_data.append(result)
        
        dataset = Dataset.from_list(tokenized_data)
        print(f"[Test] Dataset created successfully")
        print(f"[Test] Dataset columns: {dataset.column_names}")
        print(f"[Test] Dataset size: {len(dataset)}")
        
        # Verify required columns exist
        required_cols = ["input_ids", "attention_mask"]
        for col in required_cols:
            if col in dataset.column_names:
                print(f"[Test] PASS - Column '{col}' exists")
            else:
                print(f"[Test] FAIL - Missing required column '{col}'")
                return False
                
    except Exception as e:
        print(f"[Test] ERROR creating dataset: {e}")
        return False
    
    # Test cache directory structure
    print("\n[Test] Testing cache directory structure...")
    cache_dir = Path("tokenized_cache/test_cache")
    cache_dir.mkdir(parents=True, exist_ok=True)
    print(f"[Test] Created cache directory: {cache_dir}")
    
    # Test saving dataset
    try:
        dataset.save_to_disk(str(cache_dir))
        print(f"[Test] Dataset saved successfully")
        
        # Test loading from cache
        loaded_dataset = Dataset.load_from_disk(str(cache_dir))
        print(f"[Test] Dataset loaded from cache successfully")
        print(f"[Test] Loaded columns: {loaded_dataset.column_names}")
        print(f"[Test] Loaded size: {len(loaded_dataset)}")
        
        # Cleanup
        import shutil
        shutil.rmtree("tokenized_cache")
        print(f"[Test] Cleanup completed")
        
    except Exception as e:
        print(f"[Test] ERROR saving/loading cache: {e}")
        return False
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED - Pre-tokenization is safe to implement")
    print("=" * 60)
    return True


if __name__ == "__main__":
    success = test_tokenizer_output()
    sys.exit(0 if success else 1)

