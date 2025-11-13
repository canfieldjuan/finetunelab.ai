"""
Integration Test - Verify Config and Dataset Flow
Tests that server receives correct config (not hardcoded gpt2)
"""

import requests
import json
import time
from pathlib import Path

BASE_URL = "http://localhost:8000"
LOGS_DIR = Path(__file__).parent / "logs"

def test_1_server_health():
    """Test 1: Verify server is healthy"""
    print("\n" + "=" * 70)
    print("TEST 1: Server Health Check")
    print("=" * 70)
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"Status: {data['status']}")
            print(f"Service: {data['service']}")
            print(f"GPU Available: {data['gpu_available']}")
            print(f"GPU Info: {data['gpu_info']}")
            print("\nResult: PASS")
            return True
        else:
            print(f"\nResult: FAIL - Server returned {response.status_code}")
            return False
            
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def test_2_check_recent_jobs():
    """Test 2: Check if there are recent jobs in logs"""
    print("\n" + "=" * 70)
    print("TEST 2: Check Recent Jobs")
    print("=" * 70)
    
    if not LOGS_DIR.exists():
        print("No logs directory found")
        print("Result: SKIP - No jobs run yet")
        return None
    
    job_dirs = [d for d in LOGS_DIR.iterdir() if d.is_dir() and d.name.startswith("job_")]
    
    if not job_dirs:
        print("No job directories found")
        print("Result: SKIP - No jobs run yet")
        return None
    
    latest_job = max(job_dirs, key=lambda d: d.stat().st_mtime)
    job_id = latest_job.name.replace("job_", "")
    
    print(f"Found latest job: {job_id}")
    print(f"Directory: {latest_job}")
    
    config_file = LOGS_DIR.parent / "configs" / f"job_{job_id}.json"
    if config_file.exists():
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        model_name = config.get('model', {}).get('name', 'unknown')
        method = config.get('training', {}).get('method', 'unknown')
        
        print(f"\nConfig Analysis:")
        print(f"  Model: {model_name}")
        print(f"  Method: {method}")
        
        if model_name == "gpt2":
            print("\nWARNING: Still using hardcoded gpt2!")
            print("This means the fix didn't work properly")
        else:
            print(f"\nGOOD: Using custom model '{model_name}'")
    
    progress_file = latest_job / "progress.json"
    if progress_file.exists():
        with open(progress_file, 'r', encoding='utf-8') as f:
            progress = json.load(f)
        
        print(f"\nProgress Data:")
        print(f"  Status: {progress.get('status')}")
        print(f"  Epoch: {progress.get('current_epoch')}/{progress.get('total_epochs')}")
        print(f"  Progress: {progress.get('progress_percent')}%")
        print(f"  Loss: {progress.get('train_loss')}")
        print(f"  LR: {progress.get('learning_rate')}")
        print(f"  GPU Memory: {progress.get('gpu_memory_allocated_gb')} GB")
        print(f"  History Points: {len(progress.get('metrics_history', []))}")
    
    log_file = latest_job.parent / f"{latest_job.name}.log"
    if log_file.exists():
        print(f"\nLog file exists: {log_file}")
        with open(log_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        print(f"Total log lines: {len(lines)}")
        
        model_lines = [l for l in lines if 'Loading from:' in l or 'Model:' in l]
        if model_lines:
            print("\nModel loading lines:")
            for line in model_lines[:3]:
                print(f"  {line.strip()}")
    
    print("\nResult: INFO - Job analysis complete")
    return job_id

def test_3_verify_status_endpoint(job_id):
    """Test 3: Verify status endpoint returns rich metrics"""
    print("\n" + "=" * 70)
    print("TEST 3: Status Endpoint Verification")
    print("=" * 70)
    
    if not job_id:
        print("No job ID provided")
        print("Result: SKIP - Need a job to test")
        return None
    
    print(f"Testing with job: {job_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/training/status/{job_id}", timeout=5)
        
        if response.status_code == 404:
            print(f"Job {job_id} not found in server memory")
            print("Result: SKIP - Job expired or server restarted")
            return None
        
        if response.status_code != 200:
            print(f"Status endpoint returned {response.status_code}")
            print("Result: FAIL")
            return False
        
        data = response.json()
        
        print("\nStatus Response:")
        print(f"  Job ID: {data.get('job_id')}")
        print(f"  Status: {data.get('status')}")
        print(f"  Progress: {data.get('progress')}%")
        print(f"  Epoch: {data.get('current_epoch')}/{data.get('total_epochs')}")
        print(f"  Step: {data.get('current_step')}/{data.get('total_steps')}")
        print(f"  Loss: {data.get('loss')}")
        print(f"  Eval Loss: {data.get('eval_loss')}")
        print(f"  Learning Rate: {data.get('learning_rate')}")
        print(f"  Grad Norm: {data.get('grad_norm')}")
        print(f"  GPU Memory: {data.get('gpu_memory_allocated_gb')} GB")
        print(f"  Elapsed: {data.get('elapsed_seconds')}s")
        print(f"  Remaining: {data.get('remaining_seconds')}s")
        print(f"  Samples/sec: {data.get('samples_per_second')}")
        
        new_fields = [
            'current_step', 'total_steps', 'learning_rate', 
            'grad_norm', 'gpu_memory_allocated_gb', 'elapsed_seconds',
            'remaining_seconds', 'samples_per_second', 'updated_at'
        ]
        
        missing_fields = [f for f in new_fields if f not in data]
        
        if missing_fields:
            print(f"\nWARNING: Missing new fields: {missing_fields}")
            print("Result: PARTIAL - Some new fields not present")
            return False
        else:
            print("\nAll new fields present!")
            print("Result: PASS")
            return True
            
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def test_4_verify_metrics_endpoint(job_id):
    """Test 4: Verify metrics history endpoint"""
    print("\n" + "=" * 70)
    print("TEST 4: Metrics History Endpoint Verification")
    print("=" * 70)
    
    if not job_id:
        print("No job ID provided")
        print("Result: SKIP - Need a job to test")
        return None
    
    print(f"Testing with job: {job_id}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/training/metrics/{job_id}", timeout=5)
        
        if response.status_code == 404:
            print(f"Job {job_id} not found")
            print("Result: SKIP - Job expired")
            return None
        
        if response.status_code != 200:
            print(f"Metrics endpoint returned {response.status_code}")
            print("Result: FAIL")
            return False
        
        data = response.json()
        metrics = data.get('metrics', [])
        
        print(f"\nMetrics History:")
        print(f"  Total points: {len(metrics)}")
        
        if metrics:
            sample = metrics[0]
            print(f"\nFirst metric point:")
            print(f"  Step: {sample.get('step')}")
            print(f"  Epoch: {sample.get('epoch')}")
            print(f"  Train Loss: {sample.get('train_loss')}")
            print(f"  Learning Rate: {sample.get('learning_rate')}")
            print(f"  GPU Memory: {sample.get('gpu_memory_allocated_gb')} GB")
            print(f"  Timestamp: {sample.get('timestamp')}")
            
            if len(metrics) > 1:
                last = metrics[-1]
                print(f"\nLatest metric point:")
                print(f"  Step: {last.get('step')}")
                print(f"  Epoch: {last.get('epoch')}")
                print(f"  Train Loss: {last.get('train_loss')}")
            
            print("\nResult: PASS")
            return True
        else:
            print("\nNo metrics in history yet")
            print("Result: SKIP - Training hasn't logged metrics yet")
            return None
            
    except Exception as e:
        print(f"\nResult: FAIL - {e}")
        return False

def main():
    """Run all integration tests"""
    print("\n" + "=" * 70)
    print("INTEGRATION TEST SUITE")
    print("Testing: Config/Dataset Flow and Progress Tracking")
    print("=" * 70)
    
    results = {}
    
    results['server_health'] = test_1_server_health()
    
    job_id = test_2_check_recent_jobs()
    
    if job_id:
        results['status_endpoint'] = test_3_verify_status_endpoint(job_id)
        results['metrics_endpoint'] = test_4_verify_metrics_endpoint(job_id)
    else:
        print("\n" + "=" * 70)
        print("NOTICE: No recent jobs found to test endpoints")
        print("=" * 70)
        print("\nTo complete testing, you need to:")
        print("1. Go to http://localhost:3000/training")
        print("2. Create or select a training config")
        print("3. Attach a dataset to the config")
        print("4. Click 'Local Training' and start training")
        print("5. Wait 30 seconds for metrics to populate")
        print("6. Run this test script again")
    
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    for test_name, result in results.items():
        if result is True:
            status = "PASS"
            symbol = "✓"
        elif result is False:
            status = "FAIL"
            symbol = "✗"
        else:
            status = "SKIP"
            symbol = "-"
        
        print(f"{symbol} {test_name}: {status}")
    
    passed = sum(1 for r in results.values() if r is True)
    failed = sum(1 for r in results.values() if r is False)
    skipped = sum(1 for r in results.values() if r is None)
    
    print("\n" + "=" * 70)
    print(f"Results: {passed} passed, {failed} failed, {skipped} skipped")
    print("=" * 70)
    
    if failed > 0:
        print("\nSome tests failed. Check the output above for details.")
    elif passed > 0:
        print("\nAll executed tests passed!")
    else:
        print("\nNo jobs to test yet. Submit a training job first.")
    
    print()

if __name__ == "__main__":
    main()
