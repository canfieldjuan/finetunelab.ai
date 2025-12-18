#!/usr/bin/env python3
"""
Real-world user scenario: Monitor training predictions
A data scientist wants to track their model's predictions during training
"""

import sys
sys.path.insert(0, '/home/juan-canfield/Desktop/web-ui/python-package')

from finetune_lab import FinetuneLabClient

# User's API key (with 'training' scope)
API_KEY = 'wak_7ug7yOXttPvAlEnCDEWPfina4eShUvZd'
BASE_URL = 'http://localhost:3000'

# The training job they're monitoring
JOB_ID = '38d9a037-9c68-4bb7-b1aa-d91de34da720'

print("=" * 70)
print("📊 TRAINING PREDICTIONS MONITORING")
print("=" * 70)
print(f"\nMonitoring job: {JOB_ID}")
print(f"Using API: {BASE_URL}\n")

# Initialize the SDK
client = FinetuneLabClient(api_key=API_KEY, base_url=BASE_URL)

# Scenario 1: Check overall training progress
print("1️⃣  Checking training progress across epochs...")
print("-" * 70)
try:
    epochs_data = client.training_predictions.epochs(JOB_ID)
    print(f"✓ Training has completed {len(epochs_data.epochs)} epochs\n")

    for epoch_summary in epochs_data.epochs:
        print(f"   Epoch {epoch_summary.epoch}:")
        print(f"   • Predictions logged: {epoch_summary.prediction_count}")
        print(f"   • Latest step: {epoch_summary.latest_step}")
        print()

except Exception as e:
    print(f"✗ Failed to fetch epochs: {e}\n")
    sys.exit(1)

# Scenario 2: View recent predictions from latest epoch
print("\n2️⃣  Viewing recent predictions from latest epoch...")
print("-" * 70)
try:
    latest_epoch = epochs_data.epochs[-1].epoch
    predictions = client.training_predictions.get(
        JOB_ID,
        epoch=latest_epoch,
        limit=5
    )

    print(f"✓ Retrieved {len(predictions.predictions)} recent predictions")
    print(f"   (Total: {predictions.total_count} predictions across {predictions.epoch_count} epochs)\n")

    for i, pred in enumerate(predictions.predictions[:3], 1):
        print(f"   Prediction {i}:")
        print(f"   • Step: {pred.step}")
        print(f"   • Prompt: {pred.prompt[:60]}...")
        print(f"   • Ground truth: {pred.ground_truth[:60] if pred.ground_truth else 'N/A'}...")
        print(f"   • Model output: {pred.prediction[:60]}...")
        print()

except Exception as e:
    print(f"✗ Failed to fetch predictions: {e}\n")
    sys.exit(1)

# Scenario 3: Analyze quality trends over time
print("\n3️⃣  Analyzing quality trends across training...")
print("-" * 70)
try:
    trends = client.training_predictions.trends(JOB_ID)

    print(f"✓ Retrieved quality metrics for {len(trends.trends)} checkpoints\n")

    for trend in trends.trends:
        print(f"   Epoch {trend.epoch} (Step {trend.step}):")
        print(f"   • Samples evaluated: {trend.sample_count}")

        if trend.avg_exact_match is not None:
            print(f"   • Exact match rate: {trend.avg_exact_match:.2%}")
        if trend.avg_char_error_rate is not None:
            print(f"   • Character error rate: {trend.avg_char_error_rate:.3f}")
        if trend.avg_word_overlap is not None:
            print(f"   • Word overlap: {trend.avg_word_overlap:.2%}")
        if trend.validation_pass_rate is not None:
            print(f"   • Validation pass rate: {trend.validation_pass_rate:.2%}")

        if all(v is None for v in [trend.avg_exact_match, trend.avg_char_error_rate,
                                     trend.avg_word_overlap, trend.validation_pass_rate]):
            print(f"   • Quality metrics: Not yet calculated")
        print()

    if trends.overall_improvement is not None:
        print(f"   📈 Overall improvement: {trends.overall_improvement:+.2%}")
    else:
        print(f"   ℹ️  Overall improvement: Metrics not yet available")

except Exception as e:
    print(f"✗ Failed to fetch trends: {e}\n")
    sys.exit(1)

# Scenario 4: Paginate through all predictions
print("\n4️⃣  Demonstrating pagination through all predictions...")
print("-" * 70)
try:
    page_size = 10
    page_1 = client.training_predictions.get(JOB_ID, limit=page_size, offset=0)
    page_2 = client.training_predictions.get(JOB_ID, limit=page_size, offset=page_size)

    print(f"✓ Page 1: Retrieved {len(page_1.predictions)} predictions")
    print(f"✓ Page 2: Retrieved {len(page_2.predictions)} predictions")
    print(f"   Total available: {page_1.total_count} predictions")
    print(f"   Pages needed: {(page_1.total_count + page_size - 1) // page_size}")

except Exception as e:
    print(f"✗ Failed to paginate: {e}\n")
    sys.exit(1)

print("\n" + "=" * 70)
print("✅ Training monitoring complete!")
print("=" * 70)
print("\n💡 Use case demonstrated:")
print("   • Monitor training progress across epochs")
print("   • Inspect individual predictions")
print("   • Track quality metrics over time")
print("   • Paginate through large prediction sets")
print()
