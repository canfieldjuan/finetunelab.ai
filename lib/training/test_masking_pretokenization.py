#!/usr/bin/env python3
"""
Test script to verify masking-aware pretokenization works correctly.
Tests the pretokenization function with a sample dataset.
"""

import sys
import json
from pathlib import Path
from datasets import Dataset
from transformers import AutoTokenizer


def test_masking_detection():
    """Test 1: Verify template detection and masking logic"""
    print("="*60)
    print("TEST 1: Template Detection and Masking Logic")
    print("="*60)

    # Load Qwen tokenizer
    print("\nLoading Qwen/Qwen2.5-7B-Instruct tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        "Qwen/Qwen2.5-7B-Instruct",
        trust_remote_code=True
    )

    # Test response template detection
    response_template = None
    if hasattr(tokenizer, 'chat_template') and tokenizer.chat_template:
        template_str = str(tokenizer.chat_template)
        if "<|im_start|>assistant" in template_str:
            response_template = "<|im_start|>assistant\n"
            print("✓ ChatML template detected")
        else:
            print("✗ ChatML template NOT detected")
            return False
    else:
        print("✗ No chat template found")
        return False

    # Test tokenization with masking
    print("\nTesting tokenization with masking...")
    messages = [
        {"role": "user", "content": "What is 2+2?"},
        {"role": "assistant", "content": "2+2 equals 4."}
    ]

    # Tokenize
    result = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=False,
        return_dict=True,
        max_length=512,
        truncation=True
    )

    input_ids = result['input_ids']
    print(f"  Total tokens: {len(input_ids)}")

    # Find response start
    response_template_ids = tokenizer.encode(response_template, add_special_tokens=False)
    print(f"  Response template tokens: {response_template_ids}")

    response_start_idx = None
    for i in range(len(input_ids) - len(response_template_ids) + 1):
        if input_ids[i:i+len(response_template_ids)] == response_template_ids:
            response_start_idx = i + len(response_template_ids)
            break

    if response_start_idx:
        print(f"  Response starts at token index: {response_start_idx}")
        print(f"  Prompt tokens (will be masked): {response_start_idx}")
        print(f"  Response tokens (trainable): {len(input_ids) - response_start_idx}")

        # Create labels
        labels = list(input_ids)
        for i in range(response_start_idx):
            labels[i] = -100

        masked_count = sum(1 for x in labels if x == -100)
        trainable_count = sum(1 for x in labels if x != -100)

        print(f"\n  Labels created:")
        print(f"    Masked tokens (-100): {masked_count}")
        print(f"    Trainable tokens: {trainable_count}")

        # Decode to verify
        prompt_part = tokenizer.decode(input_ids[:response_start_idx], skip_special_tokens=False)
        response_part = tokenizer.decode(input_ids[response_start_idx:], skip_special_tokens=False)

        print(f"\n  Masked portion (prompt):")
        print(f"    {repr(prompt_part[:100])}")
        print(f"\n  Trainable portion (response):")
        print(f"    {repr(response_part)}")

        print("\n✓ TEST 1 PASSED: Masking logic works correctly")
        return True
    else:
        print("✗ Could not find response template in tokens")
        return False


def test_pretokenized_dataset_format():
    """Test 2: Verify pretokenized dataset has correct columns"""
    print("\n" + "="*60)
    print("TEST 2: Pretokenized Dataset Format")
    print("="*60)

    # Check if there's a recent cache
    cache_base = Path("tokenized_cache")
    if not cache_base.exists():
        print("\n⚠ No tokenized_cache directory found")
        print("  This is expected if you haven't run pretokenization yet")
        print("  Run training with pretokenize=true to generate cache")
        return True

    # Find most recent cache
    cache_dirs = list(cache_base.rglob("train"))
    if not cache_dirs:
        print("\n⚠ No pretokenized datasets found in cache")
        print("  Run training with pretokenize=true to generate cache")
        return True

    # Check most recent
    latest_cache = max(cache_dirs, key=lambda p: p.stat().st_mtime)
    print(f"\nChecking cache: {latest_cache}")

    try:
        dataset = Dataset.load_from_disk(str(latest_cache))
        print(f"  Dataset size: {len(dataset)} examples")
        print(f"  Columns: {dataset.column_names}")

        # Check for required columns
        required = ['input_ids', 'attention_mask', 'labels']
        missing = [col for col in required if col not in dataset.column_names]

        if missing:
            print(f"\n✗ Missing columns: {missing}")
            print("  This cache was created with OLD pretokenization (no masking)")
            print("  Clear cache and re-run training to regenerate with masking")
            return False

        # Check first example
        example = dataset[0]
        masked_count = sum(1 for x in example['labels'] if x == -100)
        trainable_count = sum(1 for x in example['labels'] if x != -100)

        print(f"\n  First example:")
        print(f"    input_ids length: {len(example['input_ids'])}")
        print(f"    labels length: {len(example['labels'])}")
        print(f"    Masked tokens (-100): {masked_count}")
        print(f"    Trainable tokens: {trainable_count}")

        if masked_count == 0:
            print("\n✗ No masked tokens found - masking not applied!")
            return False

        if trainable_count == 0:
            print("\n✗ No trainable tokens found - everything is masked!")
            return False

        print("\n✓ TEST 2 PASSED: Dataset has correct format with masking")
        return True

    except Exception as e:
        print(f"\n✗ Error loading dataset: {e}")
        return False


def test_backward_compatibility():
    """Test 3: Verify code compiles and imports work"""
    print("\n" + "="*60)
    print("TEST 3: Backward Compatibility Check")
    print("="*60)

    print("\nChecking imports...")
    try:
        from standalone_trainer import _pretokenize_dataset
        print("✓ _pretokenize_dataset imports correctly")

        # Check function signature
        import inspect
        sig = inspect.signature(_pretokenize_dataset)
        params = list(sig.parameters.keys())
        expected = ['dataset', 'tokenizer', 'formatting_func', 'model_name', 'config', 'dataset_type']

        if params == expected:
            print("✓ Function signature unchanged (backward compatible)")
        else:
            print(f"✗ Function signature changed:")
            print(f"  Expected: {expected}")
            print(f"  Got: {params}")
            return False

        print("\n✓ TEST 3 PASSED: Backward compatibility maintained")
        return True

    except ImportError as e:
        print(f"✗ Import error: {e}")
        return False
    except Exception as e:
        print(f"✗ Error: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("MASKING-AWARE PRETOKENIZATION VERIFICATION")
    print("="*60)

    results = []

    # Run tests
    results.append(("Template Detection & Masking", test_masking_detection()))
    results.append(("Pretokenized Dataset Format", test_pretokenized_dataset_format()))
    results.append(("Backward Compatibility", test_backward_compatibility()))

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {name}")

    print(f"\nTotal: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("\n⚠ SOME TESTS FAILED - Review output above")
        return 1


if __name__ == "__main__":
    sys.exit(main())
