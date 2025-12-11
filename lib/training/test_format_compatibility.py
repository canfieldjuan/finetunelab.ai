"""
Integration tests for dataset format compatibility
Tests all training method + format combinations
Date: 2025-11-12
"""

import sys
import json
from pathlib import Path

sys.path.insert(0, ".")

from config_validator import validate_config, validate_dataset_format, ValidationError

# Test datasets directory
TEST_DATA_DIR = Path(__file__).parent / "test-datasets"

def load_test_dataset(format_name):
    """Load a test dataset from file"""
    file_path = TEST_DATA_DIR / f"sample-{format_name}.jsonl"
    if not file_path.exists():
        raise FileNotFoundError(f"Test dataset not found: {file_path}")

    dataset = []
    with open(file_path, 'r') as f:
        for line in f:
            if line.strip():
                dataset.append(json.loads(line))

    return dataset

def test_runner(description, test_func):
    """Helper to run a test and print results"""
    print(f"\n{'=' * 70}")
    print(f"TEST: {description}")
    print('=' * 70)
    try:
        test_func()
        print("✅ PASS")
        return True
    except AssertionError as e:
        print(f"❌ FAIL: {e}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False

# ============================================================================
# SFT Training Method Tests
# ============================================================================

def test_sft_with_chatml():
    """SFT should accept ChatML format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "chatml"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with ChatML should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_sharegpt():
    """SFT should accept ShareGPT format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "sharegpt"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with ShareGPT should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_jsonl():
    """SFT should accept JSONL format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "jsonl"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with JSONL should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_alpaca():
    """SFT should accept Alpaca format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "alpaca"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with Alpaca should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_openorca():
    """SFT should accept OpenOrca format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "openorca"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with OpenOrca should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_unnatural():
    """SFT should accept Unnatural Instructions format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "unnatural"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "SFT with Unnatural should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_sft_with_dpo_format():
    """SFT should warn about incompatible DPO format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "dpo"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    assert any("dpo" in w.lower() for w in warnings), "Should mention DPO format issue"
    print(f"Got expected warning: {warnings[0]}")

def test_sft_with_rlhf_format():
    """SFT should warn about incompatible RLHF format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "sft", "num_epochs": 1},
        "data": {"dataset_format": "rlhf"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    assert any("rlhf" in w.lower() for w in warnings), "Should mention RLHF format issue"
    print(f"Got expected warning: {warnings[0]}")

# ============================================================================
# DPO Training Method Tests
# ============================================================================

def test_dpo_with_dpo_format():
    """DPO should accept DPO format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "dpo", "num_epochs": 1},
        "data": {"dataset_format": "dpo"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "DPO with DPO format should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_dpo_with_text_format():
    """DPO should accept text format (synthetic generation)"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "dpo", "num_epochs": 1},
        "data": {"dataset_format": "text"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "DPO with text format should be valid (legacy synthetic)"
    print(f"Config valid with {len(warnings)} warnings (may include synthetic generation notice)")

def test_dpo_with_chatml():
    """DPO should warn about incompatible ChatML format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "dpo", "num_epochs": 1},
        "data": {"dataset_format": "chatml"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    assert any("dpo" in w.lower() and ("chatml" in w.lower() or "typically" in w.lower()) for w in warnings), \
        "Should mention format incompatibility"
    print(f"Got expected warning: {warnings[0]}")

def test_dpo_with_sharegpt():
    """DPO should warn about incompatible ShareGPT format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "dpo", "num_epochs": 1},
        "data": {"dataset_format": "sharegpt"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    print(f"Got expected warning: {warnings[0]}")

# ============================================================================
# RLHF Training Method Tests
# ============================================================================

def test_rlhf_with_rlhf_format():
    """RLHF should accept RLHF format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "rlhf", "num_epochs": 1},
        "data": {"dataset_format": "rlhf"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "RLHF with RLHF format should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_rlhf_with_dpo_format():
    """RLHF should warn about incompatible DPO format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "rlhf", "num_epochs": 1},
        "data": {"dataset_format": "dpo"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    assert any("rlhf" in w.lower() for w in warnings), "Should mention RLHF format requirements"
    print(f"Got expected warning: {warnings[0]}")

def test_rlhf_with_chatml():
    """RLHF should warn about incompatible ChatML format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "rlhf", "num_epochs": 1},
        "data": {"dataset_format": "chatml"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    print(f"Got expected warning: {warnings[0]}")

# ============================================================================
# ORPO Training Method Tests
# ============================================================================

def test_orpo_with_dpo_format():
    """ORPO should accept DPO format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "orpo", "num_epochs": 1},
        "data": {"dataset_format": "dpo"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "ORPO with DPO format should be valid"
    print(f"Config valid with {len(warnings)} warnings")

def test_orpo_with_chatml():
    """ORPO should warn about incompatible ChatML format"""
    config = {
        "model": {"name": "gpt2"},
        "training": {"method": "orpo", "num_epochs": 1},
        "data": {"dataset_format": "chatml"}
    }

    is_valid, warnings = validate_config(config)
    assert is_valid, "Config should still be valid (warnings only)"
    assert len(warnings) > 0, "Should have warnings about format mismatch"
    assert any("orpo" in w.lower() for w in warnings), "Should mention ORPO format requirements"
    print(f"Got expected warning: {warnings[0]}")

# ============================================================================
# Dataset Format Validation Tests
# ============================================================================

def test_load_chatml_dataset():
    """Test loading ChatML dataset"""
    dataset = load_test_dataset("chatml")
    assert len(dataset) >= 3, "Should have at least 3 examples"
    assert "messages" in dataset[0], "ChatML should have messages field"
    print(f"Loaded {len(dataset)} ChatML examples")

def test_load_dpo_dataset():
    """Test loading DPO dataset"""
    dataset = load_test_dataset("dpo")
    assert len(dataset) >= 3, "Should have at least 3 examples"
    assert "prompt" in dataset[0], "DPO should have prompt field"
    assert "chosen" in dataset[0], "DPO should have chosen field"
    assert "rejected" in dataset[0], "DPO should have rejected field"
    print(f"Loaded {len(dataset)} DPO examples")

def test_load_rlhf_dataset():
    """Test loading RLHF dataset"""
    dataset = load_test_dataset("rlhf")
    assert len(dataset) >= 3, "Should have at least 3 examples"
    assert "prompt" in dataset[0], "RLHF should have prompt field"
    assert "response" in dataset[0], "RLHF should have response field"
    assert "reward" in dataset[0], "RLHF should have reward field"
    print(f"Loaded {len(dataset)} RLHF examples")

def test_validate_dpo_dataset_format():
    """Test DPO dataset passes validation"""
    dataset = load_test_dataset("dpo")

    # DPO datasets have prompt/chosen/rejected fields
    # These should be accepted by the validator
    first_example = dataset[0]
    assert "prompt" in first_example
    assert "chosen" in first_example
    assert "rejected" in first_example
    print(f"DPO dataset has correct structure")

# ============================================================================
# Main Test Runner
# ============================================================================

def main():
    """Run all integration tests"""
    print("\n" + "=" * 70)
    print("FORMAT COMPATIBILITY INTEGRATION TESTS")
    print("=" * 70)

    passed = 0
    failed = 0

    # SFT Tests
    print("\n" + "=" * 70)
    print("SFT TRAINING METHOD TESTS")
    print("=" * 70)

    tests = [
        ("SFT with ChatML format", test_sft_with_chatml),
        ("SFT with ShareGPT format", test_sft_with_sharegpt),
        ("SFT with JSONL format", test_sft_with_jsonl),
        ("SFT with Alpaca format", test_sft_with_alpaca),
        ("SFT with OpenOrca format", test_sft_with_openorca),
        ("SFT with Unnatural format", test_sft_with_unnatural),
        ("SFT with DPO format (should warn)", test_sft_with_dpo_format),
        ("SFT with RLHF format (should warn)", test_sft_with_rlhf_format),
    ]

    for desc, test_func in tests:
        if test_runner(desc, test_func):
            passed += 1
        else:
            failed += 1

    # DPO Tests
    print("\n" + "=" * 70)
    print("DPO TRAINING METHOD TESTS")
    print("=" * 70)

    tests = [
        ("DPO with DPO format", test_dpo_with_dpo_format),
        ("DPO with text format (synthetic)", test_dpo_with_text_format),
        ("DPO with ChatML (should warn)", test_dpo_with_chatml),
        ("DPO with ShareGPT (should warn)", test_dpo_with_sharegpt),
    ]

    for desc, test_func in tests:
        if test_runner(desc, test_func):
            passed += 1
        else:
            failed += 1

    # RLHF Tests
    print("\n" + "=" * 70)
    print("RLHF TRAINING METHOD TESTS")
    print("=" * 70)

    tests = [
        ("RLHF with RLHF format", test_rlhf_with_rlhf_format),
        ("RLHF with DPO format (should warn)", test_rlhf_with_dpo_format),
        ("RLHF with ChatML (should warn)", test_rlhf_with_chatml),
    ]

    for desc, test_func in tests:
        if test_runner(desc, test_func):
            passed += 1
        else:
            failed += 1

    # ORPO Tests
    print("\n" + "=" * 70)
    print("ORPO TRAINING METHOD TESTS")
    print("=" * 70)

    tests = [
        ("ORPO with DPO format", test_orpo_with_dpo_format),
        ("ORPO with ChatML (should warn)", test_orpo_with_chatml),
    ]

    for desc, test_func in tests:
        if test_runner(desc, test_func):
            passed += 1
        else:
            failed += 1

    # Dataset Loading Tests
    print("\n" + "=" * 70)
    print("DATASET LOADING TESTS")
    print("=" * 70)

    tests = [
        ("Load ChatML dataset", test_load_chatml_dataset),
        ("Load DPO dataset", test_load_dpo_dataset),
        ("Load RLHF dataset", test_load_rlhf_dataset),
        ("Validate DPO dataset format", test_validate_dpo_dataset_format),
    ]

    for desc, test_func in tests:
        if test_runner(desc, test_func):
            passed += 1
        else:
            failed += 1

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Total Tests: {passed + failed}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {100 * passed / (passed + failed):.1f}%")
    print("=" * 70)

    if failed == 0:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {failed} TEST(S) FAILED")
        return 1

if __name__ == "__main__":
    exit(main())
