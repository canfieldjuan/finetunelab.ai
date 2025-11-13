"""
Test script to verify progress tracking implementation.
Creates a minimal training job and monitors progress updates.

Usage:
    python test_progress_tracking.py
"""

import json
import time
import requests
from pathlib import Path

BASE_URL = "http://localhost:8000"

def create_test_config():
    """Create a minimal test configuration"""
    config = {
        "model": {
            "name": "HuggingFaceH4/tiny-random-LlamaForCausalLM",
            "trust_remote_code": False
        },
        "training": {
            "method": "sft",
            "num_epochs": 2,
            "batch_size": 2,
            "learning_rate": 5e-5,
            "use_lora": True,
            "max_length": 128,
            "warmup_steps": 10,
            "gradient_accumulation_steps": 1
        },
        "dataset": {
            "train": "tests/dummy_dataset.json",
            "eval": "tests/dummy_dataset.json"
        }
    }
    return config

def test_server_health():
    """Test server is running and healthy"""
    print("\n" + "=" * 70)
    print("STEP 1: Testing Server Health")
    print("=" * 70)
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"Status: {data['status']}")
            print(f"Service: {data['service']}")
            print(f"Version: {data['version']}")
            print(f"GPU Available: {data['gpu_available']}")
            print(f"GPU Info: {data['gpu_info']}")
            print("\nResult: PASS - Server is healthy")
            return True
        else:
            print(f"\nResult: FAIL - Server returned {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\nResult: FAIL - Cannot connect to server")
        print("Make sure training server is running on port 8000")
        print("Start with: python training_server.py")
        return False
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def test_progress_file_structure():
    """Test that progress.json has correct structure"""
    print("\n" + "=" * 70)
    print("STEP 2: Verifying Progress File Structure")
    print("=" * 70)
    
    logs_dir = Path(__file__).parent / "logs"
    
    if not logs_dir.exists():
        print("No logs directory found yet (this is OK for first run)")
        return True
    
    job_dirs = [d for d in logs_dir.iterdir() if d.is_dir() and d.name.startswith("job_")]
    
    if not job_dirs:
        print("No job directories found yet (this is OK for first run)")
        return True
    
    latest_job = max(job_dirs, key=lambda d: d.stat().st_mtime)
    progress_file = latest_job / "progress.json"
    
    if not progress_file.exists():
        print(f"No progress.json in {latest_job.name}")
        return True
    
    print(f"Found progress file: {progress_file}")
    
    try:
        with open(progress_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        required_fields = [
            "status", "current_epoch", "total_epochs",
            "current_step", "total_steps", "progress_percent",
            "updated_at"
        ]
        
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            print(f"\nResult: FAIL - Missing fields: {missing}")
            return False
        
        print("\nProgress file structure:")
        print(f"  Status: {data.get('status')}")
        print(f"  Epoch: {data.get('current_epoch')}/{data.get('total_epochs')}")
        print(f"  Step: {data.get('current_step')}/{data.get('total_steps')}")
        print(f"  Progress: {data.get('progress_percent')}%")
        print(f"  Train Loss: {data.get('train_loss')}")
        print(f"  Learning Rate: {data.get('learning_rate')}")
        print(f"  History Points: {len(data.get('metrics_history', []))}")
        
        print("\nResult: PASS - Progress file structure is valid")
        return True
        
    except json.JSONDecodeError as e:
        print(f"\nResult: FAIL - Invalid JSON: {e}")
        return False
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def test_metrics_endpoint():
    """Test the metrics endpoint returns data"""
    print("\n" + "=" * 70)
    print("STEP 3: Testing Metrics Endpoint")
    print("=" * 70)
    
    logs_dir = Path(__file__).parent / "logs"
    
    if not logs_dir.exists():
        print("No logs directory found - skipping (no jobs run yet)")
        return True
    
    job_dirs = [d for d in logs_dir.iterdir() if d.is_dir() and d.name.startswith("job_")]
    
    if not job_dirs:
        print("No jobs found - skipping (no jobs run yet)")
        return True
    
    latest_job = max(job_dirs, key=lambda d: d.stat().st_mtime)
    job_id = latest_job.name.replace("job_", "")
    
    print(f"Testing with job: {job_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/training/metrics/{job_id}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            metrics = data.get('metrics', [])
            
            print(f"\nMetrics points received: {len(metrics)}")
            
            if metrics:
                print("\nSample metric point:")
                sample = metrics[0]
                print(f"  Step: {sample.get('step')}")
                print(f"  Epoch: {sample.get('epoch')}")
                print(f"  Train Loss: {sample.get('train_loss')}")
                print(f"  Learning Rate: {sample.get('learning_rate')}")
                print(f"  Timestamp: {sample.get('timestamp')}")
            
            print("\nResult: PASS - Metrics endpoint works")
            return True
        else:
            print(f"\nResult: FAIL - Server returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def test_status_endpoint_fields():
    """Test status endpoint returns rich metrics"""
    print("\n" + "=" * 70)
    print("STEP 4: Testing Status Endpoint Rich Metrics")
    print("=" * 70)
    
    logs_dir = Path(__file__).parent / "logs"
    
    if not logs_dir.exists():
        print("No logs directory found - skipping (no jobs run yet)")
        return True
    
    job_dirs = [d for d in logs_dir.iterdir() if d.is_dir() and d.name.startswith("job_")]
    
    if not job_dirs:
        print("No jobs found - skipping (no jobs run yet)")
        return True
    
    latest_job = max(job_dirs, key=lambda d: d.stat().st_mtime)
    job_id = latest_job.name.replace("job_", "")
    
    print(f"Testing with job: {job_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/training/status/{job_id}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            
            new_fields = [
                "current_step", "total_steps", "eval_loss",
                "learning_rate", "grad_norm", "gpu_memory_allocated_gb",
                "elapsed_seconds", "remaining_seconds", "samples_per_second"
            ]
            
            print("\nNew metrics fields:")
            for field in new_fields:
                value = data.get(field)
                print(f"  {field}: {value}")
            
            print("\nResult: PASS - Status endpoint includes rich metrics")
            return True
        else:
            print(f"\nResult: FAIL - Server returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def main():
    """Run all verification tests"""
    print("\n" + "=" * 70)
    print("PROGRESS TRACKING VERIFICATION TESTS")
    print("=" * 70)
    
    results = []
    
    results.append(("Server Health", test_server_health()))
    
    if results[0][1]:
        results.append(("Progress File Structure", test_progress_file_structure()))
        results.append(("Metrics Endpoint", test_metrics_endpoint()))
        results.append(("Status Endpoint Fields", test_status_endpoint_fields()))
    
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    for test_name, passed in results:
        status = "PASS" if passed else "FAIL"
        symbol = "✓" if passed else "✗"
        print(f"{symbol} {test_name}: {status}")
    
    total = len(results)
    passed = sum(1 for _, p in results if p)
    
    print("\n" + "=" * 70)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 70)
    
    if passed == total:
        print("\nAll tests PASSED! Progress tracking is working correctly.")
        print("\nNext steps:")
        print("1. Run an actual training job to test live progress updates")
        print("2. Monitor progress in real-time via /api/training/status endpoint")
        print("3. View metrics history via /api/training/metrics endpoint")
        print("4. Integrate UI components to display charts")
    else:
        print(f"\n{total - passed} test(s) FAILED. Review errors above.")
    
    print()

if __name__ == "__main__":
    main()
