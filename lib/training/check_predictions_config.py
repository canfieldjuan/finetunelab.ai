#!/usr/bin/env python3
"""
Diagnostic script to check predictions configuration
Run this to see why predictions might not be working
"""
import os
import json
import sys

def check_predictions_config(config_path=None):
    """Check predictions configuration from a training config file"""
    print("=" * 60)
    print("PREDICTIONS CONFIGURATION DIAGNOSTIC")
    print("=" * 60)

    # Check if config path provided
    if not config_path:
        print("\n❌ No config path provided")
        print("Usage: python3 check_predictions_config.py <path_to_config.json>")
        return False

    if not os.path.exists(config_path):
        print(f"\n❌ Config file not found: {config_path}")
        return False

    # Load config
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        print(f"\n✓ Loaded config from: {config_path}")
    except Exception as e:
        print(f"\n❌ Failed to load config: {e}")
        return False

    # Check predictions config
    predictions_config = config.get("predictions", {})
    print("\n--- Predictions Configuration ---")
    print(json.dumps(predictions_config, indent=2))

    # Check if enabled
    enabled = predictions_config.get("enabled", False)
    print(f"\n1. Predictions Enabled: {'✓ YES' if enabled else '❌ NO'}")

    if not enabled:
        print("   ⚠️  Predictions are disabled in config")
        print("   Fix: Set predictions.enabled = true in your training config")
        return False

    # Check sample count
    sample_count = predictions_config.get("sample_count", 0)
    print(f"2. Sample Count: {sample_count}")
    if sample_count == 0:
        print("   ⚠️  Sample count is 0")

    # Check frequency
    frequency = predictions_config.get("sample_frequency", "unknown")
    print(f"3. Sample Frequency: {frequency}")
    valid_frequencies = ['epoch', 'eval', 'steps']
    if frequency not in valid_frequencies:
        print(f"   ⚠️  Invalid frequency. Must be one of: {valid_frequencies}")

    # Check environment variables
    print("\n--- Environment Variables ---")
    job_user_id = os.getenv('JOB_USER_ID')
    print(f"4. JOB_USER_ID: {'✓ SET' if job_user_id else '❌ NOT SET'}")
    if not job_user_id:
        print("   ⚠️  JOB_USER_ID environment variable not set")
        print("   This is required for predictions to work")

    # Check dataset path
    dataset_path = config.get("dataset_path") or config.get("data", {}).get("dataset_path")
    print(f"5. Dataset Path: {dataset_path or '❌ NOT SET'}")
    if not dataset_path:
        print("   ⚠️  No dataset_path in config (checked dataset_path and data.dataset_path)")
    elif not os.path.exists(dataset_path):
        print(f"   ⚠️  Dataset file not found: {dataset_path}")
    else:
        print(f"   ✓ Dataset file exists")

    # Check output paths (local API vs cloud Supabase)
    print("\n--- Output Path ---")
    cloud_mode = os.getenv('IS_CLOUD', 'false').lower() == 'true'
    metrics_api_url = os.getenv('METRICS_API_URL')
    job_token = os.getenv('JOB_TOKEN')
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if cloud_mode:
        print(f"6. IS_CLOUD: ✓ true")
        print(f"7. SUPABASE_URL: {'✓ SET' if supabase_url else '❌ NOT SET'}")
        print(f"8. SUPABASE_SERVICE_ROLE_KEY: {'✓ SET' if supabase_key else '❌ NOT SET'}")
    else:
        print(f"6. IS_CLOUD: false (local API mode)")
        print(f"7. METRICS_API_URL: {'✓ SET' if metrics_api_url else '❌ NOT SET'}")
        print(f"8. JOB_TOKEN: {'✓ SET' if job_token else '❌ NOT SET'}")

    # Final verdict
    print("\n" + "=" * 60)
    dataset_exists = bool(dataset_path and os.path.exists(dataset_path))
    local_ready = (not cloud_mode) and metrics_api_url and job_token
    cloud_ready = cloud_mode and supabase_url and supabase_key

    all_good = (
        enabled and
        sample_count > 0 and
        frequency in valid_frequencies and
        job_user_id and
        dataset_exists and
        (local_ready or cloud_ready)
    )

    if all_good:
        print("✓ ALL CHECKS PASSED - Predictions should work!")
    else:
        print("❌ SOME CHECKS FAILED - See issues above")

    print("=" * 60)
    return all_good

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 check_predictions_config.py <path_to_training_config.json>")
        sys.exit(1)

    check_predictions_config(sys.argv[1])
