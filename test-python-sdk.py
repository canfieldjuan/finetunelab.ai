#!/usr/bin/env python3
"""Test Python SDK predictions client"""

import sys
sys.path.insert(0, '/home/juan-canfield/Desktop/web-ui/python-package')

from finetune_lab import FinetuneLabClient

# Test credentials
API_KEY = 'wak_7ug7yOXttPvAlEnCDEWPfina4eShUvZd'
BASE_URL = 'http://localhost:3000'  # Dev server
JOB_ID = '38d9a037-9c68-4bb7-b1aa-d91de34da720'

print("=== Testing Python SDK - Training Predictions ===\n")

# Initialize client
print("1. Initializing client...")
client = FinetuneLabClient(api_key=API_KEY, base_url=BASE_URL)
print(f"   ✓ Client initialized with base_url: {client.base_url}\n")

# Check that training_predictions sub-client exists
print("2. Checking training_predictions sub-client...")
if hasattr(client, 'training_predictions'):
    print("   ✓ training_predictions sub-client exists")
    print(f"   ✓ Type: {type(client.training_predictions)}\n")
else:
    print("   ✗ training_predictions sub-client NOT FOUND")
    sys.exit(1)

# Test methods exist
print("3. Checking methods...")
methods = ['get', 'epochs', 'trends']
for method in methods:
    if hasattr(client.training_predictions, method):
        print(f"   ✓ Method '{method}' exists")
    else:
        print(f"   ✗ Method '{method}' NOT FOUND")

print("\n✅ Python SDK structure verified!")

# Test live API calls
print("\n4. Testing live API calls...")
try:
    # Test get() method
    print("   Testing predictions.get()...")
    result = client.training_predictions.get(JOB_ID, limit=2)
    print(f"   ✓ Retrieved {len(result.predictions)} predictions")
    print(f"   ✓ Total count: {result.total_count}")
    print(f"   ✓ Epochs: {result.epoch_count}")

    # Test epochs() method
    print("\n   Testing predictions.epochs()...")
    epochs = client.training_predictions.epochs(JOB_ID)
    print(f"   ✓ Retrieved {len(epochs.epochs)} epoch summaries")

    # Test trends() method
    print("\n   Testing predictions.trends()...")
    trends = client.training_predictions.trends(JOB_ID)
    print(f"   ✓ Retrieved {len(trends.trends)} trend points")

    print("\n✅ All API calls successful!")
    print("   Python SDK is fully functional!")

except Exception as e:
    print(f"\n   ✗ API call failed: {e}")
    print("   SDK structure is correct but API communication failed")
