#!/usr/bin/env python3
"""
Test script to verify train_loss tracking during eval.

This simulates the scenario where:
1. Training steps populate recent_losses
2. Eval step has no train_loss in logs
3. We should use recent_losses[-1] for scoring
"""

from collections import deque

def test_train_loss_fallback():
    """Test that we correctly use recent_losses when train_loss is None."""

    # Simulate the deque
    recent_losses = deque(maxlen=10)

    # Scenario 1: Training step - has train_loss
    print("Scenario 1: Training Step")
    train_loss = 1.5
    train_loss_for_scoring = train_loss
    if train_loss_for_scoring is None and len(recent_losses) > 0:
        train_loss_for_scoring = recent_losses[-1]

    print(f"  train_loss from logs: {train_loss}")
    print(f"  train_loss_for_scoring: {train_loss_for_scoring}")
    assert train_loss_for_scoring == 1.5, "Should use train_loss from logs"
    print("  ✅ PASS\n")

    # Add to recent_losses (simulating line 758)
    recent_losses.append(train_loss)

    # Scenario 2: Eval step - no train_loss, but recent_losses has data
    print("Scenario 2: Eval Step (after training)")
    train_loss = None  # HuggingFace doesn't provide train_loss during eval
    train_loss_for_scoring = train_loss
    if train_loss_for_scoring is None and len(recent_losses) > 0:
        train_loss_for_scoring = recent_losses[-1]

    print(f"  train_loss from logs: {train_loss}")
    print(f"  recent_losses: {list(recent_losses)}")
    print(f"  train_loss_for_scoring: {train_loss_for_scoring}")
    assert train_loss_for_scoring == 1.5, "Should use recent_losses[-1]"
    print("  ✅ PASS\n")

    # Scenario 3: First eval (no training steps yet)
    print("Scenario 3: First Eval (no training yet)")
    recent_losses_empty = deque(maxlen=10)
    train_loss = None
    train_loss_for_scoring = train_loss
    if train_loss_for_scoring is None and len(recent_losses_empty) > 0:
        train_loss_for_scoring = recent_losses_empty[-1]

    print(f"  train_loss from logs: {train_loss}")
    print(f"  recent_losses: {list(recent_losses_empty)}")
    print(f"  train_loss_for_scoring: {train_loss_for_scoring}")
    assert train_loss_for_scoring is None, "Should stay None if no recent losses"
    print("  ✅ PASS\n")

    # Scenario 4: Multiple training steps, then eval
    print("Scenario 4: Multiple Training Steps + Eval")
    recent_losses_multi = deque(maxlen=10)

    # Simulate 3 training steps
    for i, loss in enumerate([2.5, 2.0, 1.8]):
        recent_losses_multi.append(loss)
        print(f"  Training step {i+1}: loss={loss}")

    # Now eval
    train_loss = None
    train_loss_for_scoring = train_loss
    if train_loss_for_scoring is None and len(recent_losses_multi) > 0:
        train_loss_for_scoring = recent_losses_multi[-1]

    print(f"  Eval step:")
    print(f"    train_loss from logs: {train_loss}")
    print(f"    recent_losses: {list(recent_losses_multi)}")
    print(f"    train_loss_for_scoring: {train_loss_for_scoring}")
    assert train_loss_for_scoring == 1.8, "Should use most recent (1.8)"
    print("  ✅ PASS\n")

    print("=" * 60)
    print("ALL TESTS PASSED ✅")
    print("=" * 60)

if __name__ == "__main__":
    test_train_loss_fallback()
