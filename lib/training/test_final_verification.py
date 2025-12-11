"""
Final Verification Test - Test All Persistence Fixes
Tests:
1. Model name persists correctly (gpt2, not unknown)
2. No duplicate metrics
3. Metrics persist successfully
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from training_server import execute_training

async def run_test():
    """Submit a test training job"""
    print("=" * 70)
    print("FINAL VERIFICATION TEST")
    print("=" * 70)
    print("\nSubmitting test job with:")
    print("- Model: gpt2")
    print("- Dataset: test_dataset.json")
    print("- Method: SFT")
    print("- Epochs: 1")
    print("\nExpected results:")
    print("1. model_name should be 'gpt2' in database")
    print("2. Only 1 metric should be persisted (no duplicates)")
    print("3. All persistence should succeed without errors")
    print("\n" + "=" * 70)

    config = {
        "training_method": "sft",
        "model": {
            "name": "gpt2",
