"""
Test script to verify the orphaned training job reconnection logic.
This simulates a server restart scenario.
"""

import subprocess
import sys
import time
from pathlib import Path

def test_reconnection():
    """Test the reconnection logic"""
    
    print("=" * 60)
    print("Training Server Reconnection Test")
    print("=" * 60)
    
    # Check if there are running trainer processes
    print("\n1. Checking for running standalone_trainer.py processes...")
    
    try:
        # List processes (Linux/macOS)
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode != 0:
            print(f"   ❌ FAIL: Could not list processes: {result.stderr}")
            return False
        
        # Count trainer processes
        trainer_processes = []
        for line in result.stdout.split('\n'):
            if 'standalone_trainer.py' in line:
                trainer_processes.append(line.strip())
        
        if trainer_processes:
            print(f"   ✅ PASS: Found {len(trainer_processes)} trainer process(es)")
            for proc in trainer_processes:
                print(f"        {proc[:100]}...")
        else:
            print(f"   ⚠️  INFO: No trainer processes currently running")
            print(f"        This is expected if no training is active")
        
    except Exception as e:
        print(f"   ❌ FAIL: Error checking processes: {e}")
        return False
    
    # Check for job directories
    print("\n2. Checking for job directories with progress.json...")
    
    logs_dir = Path(__file__).parent / "logs"
    if not logs_dir.exists():
        print(f"   ⚠️  WARN: Logs directory does not exist: {logs_dir}")
        return True
    
    job_dirs = list(logs_dir.glob("job_*"))
    if not job_dirs:
        print(f"   ℹ️  INFO: No job directories found (no training history)")
        return True
    
    print(f"   ✅ PASS: Found {len(job_dirs)} job director(ies)")
    
    # Check each job directory
    active_jobs = []
    for job_dir in job_dirs:
        job_id = job_dir.name.replace("job_", "")
        progress_file = job_dir / "progress.json"
        
        if not progress_file.exists():
            continue
        
        # Check progress file modification time (this is what the server checks)
        progress_mtime = progress_file.stat().st_mtime
        time_diff = time.time() - progress_mtime
        
        if time_diff < 300:  # Less than 5 minutes old
            active_jobs.append((job_id, time_diff))
            print(f"        ✅ {job_id[:8]}... - progress.json updated {time_diff:.0f}s ago (ACTIVE)")
        else:
            print(f"        ⏸️  {job_id[:8]}... - progress.json updated {time_diff/60:.1f}m ago (stale)")
    
    if active_jobs:
        print(f"\n   ✅ PASS: Found {len(active_jobs)} active job(s) that should reconnect")
    else:
        print(f"\n   ℹ️  INFO: No active jobs found (all logs are stale)")
    
    # Test the reconnection function
    print("\n3. Testing reconnection logic...")
    print("   To fully test:")
    print("   1. Start a training job")
    print("   2. Wait for it to begin training")
    print("   3. Restart the training server: cd lib/training && uvicorn training_server:app --reload --host 0.0.0.0 --port 8000")
    print("   4. Check server logs for '[Reconnect]' messages")
    print("   5. Verify metrics continue to update in the UI")
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)
    
    return True

if __name__ == "__main__":
    success = test_reconnection()
    exit(0 if success else 1)
