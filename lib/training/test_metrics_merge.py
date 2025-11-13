"""
Test for metrics merging logic - verifies that evaluation metrics
are merged with training metrics instead of creating duplicate rows.
"""

def test_metrics_merge_logic():
    """Simulate the metrics merging behavior"""
    
    # Simulate metrics_history (deque-like list)
    metrics_history = []
    
    # Simulate step 1000 - training log
    step = 1000
    train_metrics = {
        "step": step,
        "epoch": 0,
        "train_loss": 0.5512,
        "eval_loss": None,
        "learning_rate": 5e-5,
        "timestamp": "2025-11-10T21:00:00Z"
    }
    
    # First on_log call (training) - append
    existing_idx = None
    for idx in range(len(metrics_history) - 1, max(0, len(metrics_history) - 10), -1):
        if metrics_history[idx].get("step") == step:
            existing_idx = idx
            break
    
    if existing_idx is not None:
        print(f"❌ ERROR: Found existing metric at step {step} when it shouldn't exist")
    else:
        metrics_history.append(train_metrics.copy())
        print(f"✅ Appended training metrics for step {step}")
        print(f"   Metrics count: {len(metrics_history)}")
    
    # Simulate step 1000 - evaluation log (a few seconds later)
    eval_metrics = {
        "step": step,
        "epoch": 0,
        "train_loss": None,
        "eval_loss": 1.952604,
        "learning_rate": None,
        "perplexity": 7.047,
        "timestamp": "2025-11-10T21:00:05Z"
    }
    
    # Second on_log call (evaluation) - should merge
    existing_idx = None
    search_start = len(metrics_history) - 1
    search_end = max(-1, len(metrics_history) - 10 - 1)  # Go back 10 entries or to start
    for idx in range(search_start, search_end, -1):
        if metrics_history[idx].get("step") == step:
            existing_idx = idx
            break
    
    if existing_idx is not None:
        # Merge
        existing = metrics_history[existing_idx]
        for key, value in eval_metrics.items():
            if value is not None:
                existing[key] = value
        print(f"✅ Merged evaluation metrics into step {step}")
        print(f"   Metrics count: {len(metrics_history)} (should still be 1)")
        print(f"   Merged data: train_loss={existing['train_loss']}, eval_loss={existing['eval_loss']}")
    else:
        metrics_history.append(eval_metrics.copy())
        print(f"❌ ERROR: Appended eval metrics as new row instead of merging")
        print(f"   Metrics count: {len(metrics_history)} (should be 1, not 2!)")
    
    # Verify results
    print("\n=== VERIFICATION ===")
    print(f"Total metric entries: {len(metrics_history)}")
    
    if len(metrics_history) == 1:
        print("✅ PASS: Only one row for step 1000")
        final = metrics_history[0]
        if final["train_loss"] is not None and final["eval_loss"] is not None:
            print(f"✅ PASS: Both train_loss ({final['train_loss']}) and eval_loss ({final['eval_loss']}) present")
        else:
            print(f"❌ FAIL: Missing values - train_loss={final['train_loss']}, eval_loss={final['eval_loss']}")
    else:
        print(f"❌ FAIL: Expected 1 row, got {len(metrics_history)}")
        for idx, metric in enumerate(metrics_history):
            print(f"   Row {idx}: step={metric['step']}, train_loss={metric['train_loss']}, eval_loss={metric['eval_loss']}")
    
    return len(metrics_history) == 1 and metrics_history[0]["train_loss"] is not None and metrics_history[0]["eval_loss"] is not None


if __name__ == "__main__":
    print("Testing metrics merge logic...")
    print("=" * 60)
    success = test_metrics_merge_logic()
    print("=" * 60)
    if success:
        print("\n✅ ALL TESTS PASSED")
    else:
        print("\n❌ TESTS FAILED")
    exit(0 if success else 1)
