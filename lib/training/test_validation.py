"""
Test config validation with intentionally bad configs
"""

import sys
sys.path.insert(0, ".")

from config_validator import validate_config, validate_dataset_format, ValidationError

def test_validation(description, test_func):
    """Helper to run a test and print results"""
    print(f"\n{'=' * 70}")
    print(f"TEST: {description}")
    print('=' * 70)
    try:
        test_func()
        print("PASS")
    except AssertionError as e:
        print(f"FAIL: {e}")
    except Exception as e:
        print(f"ERROR: {e}")

def test_missing_model_section():
    """Test validation catches missing model section"""
    config = {
        "training": {"method": "sft", "num_epochs": 1}
    }
    
    try:
        validate_config(config)
        raise AssertionError("Should have raised ValidationError for missing model")
    except ValidationError as e:
        assert "model" in str(e).lower()
        print(f"Correctly caught: {e}")

def test_missing_model_name():
    """Test validation catches missing model.name"""
    config = {
        "model": {"quantization": "4bit"},
        "training": {"method": "sft", "num_epochs": 1}
    }
    
    try:
        validate_config(config)
        raise AssertionError("Should have raised ValidationError for missing model.name")
    except ValidationError as e:
        assert "name" in str(e).lower()
        print(f"Correctly caught: {e}")

def test_wrong_lora_targets_gpt2():
    """Test validation catches wrong LoRA targets for GPT-2"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "lora": {
            "r": 8,
            "alpha": 16,
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"]
        }
    }
    
    try:
        validate_config(config)
        raise AssertionError("Should have raised ValidationError for wrong LoRA targets")
    except ValidationError as e:
        assert "target_modules" in str(e).lower() or "q_proj" in str(e)
        print(f"Correctly caught: {e}")

def test_chat_template_on_gpt2():
    """Test validation catches chat template on GPT-2"""
    config = {
        "model": {"name": "gpt2"},
        "data": {"strategy": "chat", "chat_template": "chatml"},
        "training": {"method": "sft", "num_epochs": 1}
    }
    
    try:
        validate_config(config)
        raise AssertionError("Should have raised ValidationError for chat template on GPT-2")
    except ValidationError as e:
        assert "chat" in str(e).lower()
        print(f"Correctly caught: {e}")

def test_invalid_num_epochs():
    """Test validation catches invalid num_epochs"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": -1}
    }
    
    try:
        validate_config(config)
        raise AssertionError("Should have raised ValidationError for negative epochs")
    except ValidationError as e:
        assert "epoch" in str(e).lower() or "positive" in str(e).lower()
        print(f"Correctly caught: {e}")

def test_valid_config_gpt2():
    """Test that valid GPT-2 config passes"""
    config = {
        "model": {"name": "gpt2"},
        "data": {"strategy": "standard"},
        "training": {"method": "sft", "num_epochs": 1, "batch_size": 2, "learning_rate": 0.0002},
        "lora": {"r": 8, "alpha": 16, "target_modules": ["c_attn", "c_proj"]},
        "output": {"output_dir": "./output", "save_total_limit": 2}
    }
    
    is_valid, warnings = validate_config(config)
    assert is_valid
    print(f"Config validated successfully with {len(warnings)} warnings")
    for w in warnings:
        print(f"  Warning: {w}")

def test_valid_config_llama():
    """Test that valid Llama config passes"""
    config = {
        "model": {"name": "meta-llama/Llama-2-7b"},
        "data": {"strategy": "chat"},
        "training": {"method": "sft", "num_epochs": 3, "learning_rate": 0.0001},
        "lora": {
            "r": 16, 
            "alpha": 32, 
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"]
        }
    }
    
    is_valid, warnings = validate_config(config)
    assert is_valid
    print(f"Config validated successfully with {len(warnings)} warnings")

def test_dataset_messages_vs_text():
    """Test dataset validation accepts normalized format with warning (since 2025-11-01)"""
    dataset = [
        {
            "messages": [
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi"}
            ]
        }
    ]

    # Since 2025-11-01: Datasets are pre-normalized at upload time
    # Validator now accepts messages format regardless of strategy (with warning)
    is_valid, warnings = validate_dataset_format(dataset, data_strategy="standard")
    assert is_valid
    assert len(warnings) > 0
    assert any("normalized" in w.lower() or "messages" in w.lower() for w in warnings)
    print(f"Correctly returned warning about normalized format: {warnings[0]}")

def test_dataset_text_format():
    """Test dataset validation passes for text format"""
    dataset = [
        {"text": "Question: What is 2+2?\nAnswer: 4"},
        {"text": "Question: What is the capital of France?\nAnswer: Paris"}
    ]
    
    is_valid, warnings = validate_dataset_format(dataset, data_strategy="standard")
    assert is_valid
    print(f"Dataset validated successfully with {len(warnings)} warnings")

def test_empty_dataset():
    """Test dataset validation catches empty dataset"""
    dataset = []
    
    try:
        validate_dataset_format(dataset)
        raise AssertionError("Should have raised ValidationError for empty dataset")
    except ValidationError as e:
        assert "empty" in str(e).lower()
        print(f"Correctly caught: {e}")

def main():
    """Run all validation tests"""
    print("\n" + "=" * 70)
    print("CONFIG VALIDATION TESTS")
    print("=" * 70)
    
    test_validation("Missing model section", test_missing_model_section)
    test_validation("Missing model.name", test_missing_model_name)
    test_validation("Wrong LoRA targets for GPT-2", test_wrong_lora_targets_gpt2)
    test_validation("Chat template on GPT-2", test_chat_template_on_gpt2)
    test_validation("Invalid num_epochs", test_invalid_num_epochs)
    test_validation("Valid GPT-2 config", test_valid_config_gpt2)
    test_validation("Valid Llama config", test_valid_config_llama)
    
    print("\n" + "=" * 70)
    print("DATASET VALIDATION TESTS")
    print("=" * 70)
    
    test_validation("Messages vs text mismatch", test_dataset_messages_vs_text)
    test_validation("Valid text format", test_dataset_text_format)
    test_validation("Empty dataset", test_empty_dataset)
    
    print("\n" + "=" * 70)
    print("ALL TESTS COMPLETE")
    print("=" * 70)

if __name__ == "__main__":
    main()
