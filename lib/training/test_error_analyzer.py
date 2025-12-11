"""
Unit Tests for Error Analyzer

Tests the error analysis logic and config suggestions generation.

Date: 2025-11-10
Phase: Intelligent Resume Implementation - Phase 2
"""

import sys
import json
from error_analyzer import (
    analyze_training_failure,
    ConfigSuggestion,
    FailureAnalysis,
    get_suggestion_summary
)


def test_oom_eval_detection():
    """Test OOM during evaluation detection"""
    print("\n=== Test 1: OOM Eval Detection ===")

    error_msg = "CUDA out of memory during eval at step 200"
    config = {
        'per_device_eval_batch_size': 4,
        'eval_accumulation_steps': 10,
        'gradient_checkpointing': False
    }

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'oom_eval', f"Expected oom_eval, got {analysis.error_type}"
    assert analysis.error_phase == 'evaluation', f"Expected evaluation, got {analysis.error_phase}"
    assert analysis.confidence == 'high', f"Expected high confidence, got {analysis.confidence}"
    assert len(analysis.suggestions) >= 2, f"Expected at least 2 suggestions, got {len(analysis.suggestions)}"

    # Check for eval_accumulation_steps suggestion
    eval_accum_suggestion = next((s for s in analysis.suggestions if s.field == 'eval_accumulation_steps'), None)
    assert eval_accum_suggestion is not None, "Missing eval_accumulation_steps suggestion"
    assert eval_accum_suggestion.current_value == 10
    assert eval_accum_suggestion.suggested_value == 2, f"Expected 2, got {eval_accum_suggestion.suggested_value}"

    print("✓ OOM eval detection working correctly")
    print(f"  Suggestions: {len(analysis.suggestions)}")
    for s in analysis.suggestions:
        print(f"    - {s.field}: {s.current_value} → {s.suggested_value}")

    return True


def test_oom_training_detection():
    """Test OOM during training detection"""
    print("\n=== Test 2: OOM Training Detection ===")

    error_msg = "CUDA out of memory. Tried to allocate 2.00 GiB during training"
    config = {
        'per_device_train_batch_size': 4,
        'gradient_accumulation_steps': 1,
        'gradient_checkpointing': False
    }

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'oom_training', f"Expected oom_training, got {analysis.error_type}"
    assert analysis.error_phase == 'training', f"Expected training, got {analysis.error_phase}"
    assert analysis.confidence == 'high', f"Expected high confidence, got {analysis.confidence}"

    # Check for train batch size reduction
    batch_suggestion = next((s for s in analysis.suggestions if s.field == 'per_device_train_batch_size'), None)
    assert batch_suggestion is not None, "Missing per_device_train_batch_size suggestion"
    assert batch_suggestion.suggested_value == 2, f"Expected 2, got {batch_suggestion.suggested_value}"

    # Check for gradient accumulation increase
    grad_accum_suggestion = next((s for s in analysis.suggestions if s.field == 'gradient_accumulation_steps'), None)
    assert grad_accum_suggestion is not None, "Missing gradient_accumulation_steps suggestion"
    assert grad_accum_suggestion.suggested_value == 2, f"Expected 2, got {grad_accum_suggestion.suggested_value}"

    print("✓ OOM training detection working correctly")
    print(f"  Suggestions: {len(analysis.suggestions)}")
    for s in analysis.suggestions:
        print(f"    - {s.field}: {s.current_value} → {s.suggested_value}")

    return True


def test_timeout_detection():
    """Test timeout detection"""
    print("\n=== Test 3: Timeout Detection ===")

    error_msg = "Training timed out - no progress updates for 30 minutes"
    config = {
        'per_device_eval_batch_size': 2,
        'eval_steps': 100,
        'logging_steps': 10
    }

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'timeout', f"Expected timeout, got {analysis.error_type}"
    assert analysis.confidence == 'medium', f"Expected medium confidence, got {analysis.confidence}"

    # Check for eval_steps increase
    eval_steps_suggestion = next((s for s in analysis.suggestions if s.field == 'eval_steps'), None)
    assert eval_steps_suggestion is not None, "Missing eval_steps suggestion"
    assert eval_steps_suggestion.suggested_value == 200, f"Expected 200, got {eval_steps_suggestion.suggested_value}"

    print("✓ Timeout detection working correctly")
    print(f"  Suggestions: {len(analysis.suggestions)}")
    for s in analysis.suggestions:
        print(f"    - {s.field}: {s.current_value} → {s.suggested_value}")

    return True


def test_real_oom_error():
    """Test with real OOM error from job 74801829"""
    print("\n=== Test 4: Real OOM Error (Job 74801829) ===")

    # Actual error from the failed job
    error_msg = """CUDA out of memory. Tried to allocate 594.00 MiB. GPU 0 has a total capacity of 23.56 GiB
    of which 4.06 MiB is free. Including non-PyTorch memory, this process has 23.54 GiB memory in use.
    Of the allocated memory 22.29 GiB is allocated by PyTorch, and 663.97 MiB is reserved by PyTorch but unallocated.
    Error during eval at step 200"""

    config = {
        'per_device_eval_batch_size': 4,
        'eval_accumulation_steps': 10,
        'gradient_checkpointing': False,
        'per_device_train_batch_size': 4,
        'gradient_accumulation_steps': 1
    }

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'oom_eval', f"Expected oom_eval, got {analysis.error_type}"

    # Print full analysis
    print(get_suggestion_summary(analysis))

    # Verify the specific suggestions that should fix this job
    eval_accum = next((s for s in analysis.suggestions if s.field == 'eval_accumulation_steps'), None)
    assert eval_accum is not None
    assert eval_accum.suggested_value == 2, "Should reduce eval_accumulation_steps to 2"

    eval_batch = next((s for s in analysis.suggestions if s.field == 'per_device_eval_batch_size'), None)
    assert eval_batch is not None
    assert eval_batch.suggested_value == 2, "Should reduce eval batch size to 2"

    print("✓ Real error analysis working correctly")
    print("  This would fix the job 74801829 failure!")

    return True


def test_no_error_message():
    """Test handling of missing error message"""
    print("\n=== Test 5: No Error Message ===")

    error_msg = ""
    config = {}

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'no_error', f"Expected no_error, got {analysis.error_type}"
    assert len(analysis.suggestions) == 0, f"Expected no suggestions, got {len(analysis.suggestions)}"

    print("✓ No error message handled correctly")

    return True


def test_unknown_error():
    """Test handling of unknown errors"""
    print("\n=== Test 6: Unknown Error ===")

    error_msg = "Some random error that we don't recognize"
    config = {'per_device_train_batch_size': 4}

    analysis = analyze_training_failure(error_msg, config)

    assert analysis.error_type == 'unknown', f"Expected unknown, got {analysis.error_type}"
    assert analysis.confidence == 'low', f"Expected low confidence, got {analysis.confidence}"

    print("✓ Unknown error handled correctly")

    return True


def test_to_dict_serialization():
    """Test JSON serialization of FailureAnalysis"""
    print("\n=== Test 7: JSON Serialization ===")

    error_msg = "CUDA out of memory during eval"
    config = {
        'per_device_eval_batch_size': 4,
        'eval_accumulation_steps': 10
    }

    analysis = analyze_training_failure(error_msg, config)
    result_dict = analysis.to_dict()

    # Verify it's JSON serializable
    json_str = json.dumps(result_dict, indent=2)
    assert len(json_str) > 0

    # Verify structure
    assert 'error_type' in result_dict
    assert 'suggestions' in result_dict
    assert isinstance(result_dict['suggestions'], list)

    if len(result_dict['suggestions']) > 0:
        first_suggestion = result_dict['suggestions'][0]
        assert 'field' in first_suggestion
        assert 'current_value' in first_suggestion
        assert 'suggested_value' in first_suggestion
        assert 'reason' in first_suggestion
        assert 'impact' in first_suggestion

    print("✓ JSON serialization working correctly")
    print(f"  Serialized to {len(json_str)} bytes")

    return True


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("ERROR ANALYZER UNIT TESTS")
    print("=" * 60)

    tests = [
        test_oom_eval_detection,
        test_oom_training_detection,
        test_timeout_detection,
        test_real_oom_error,
        test_no_error_message,
        test_unknown_error,
        test_to_dict_serialization
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"✗ FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ ERROR: {e}")
            failed += 1

    print("\n" + "=" * 60)
    print(f"RESULTS: {passed} passed, {failed} failed")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)
    else:
        print("\n✅ All tests passed!")
        sys.exit(0)


if __name__ == '__main__':
    run_all_tests()
