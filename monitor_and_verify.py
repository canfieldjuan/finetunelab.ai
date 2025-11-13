"""Monitor training and verify database persistence"""
import requests
import time
import sys

JOB_ID = "f49eed94-4fef-46b1-82f1-56bf4c9aaa5f"
STATUS_URL = f"http://localhost:8000/api/training/status/{JOB_ID}"

print("=" * 70)
print(f"MONITORING: {JOB_ID}")
print("Testing FIXED incremental persistence")
print("=" * 70)

last_step = 0
while True:
    try:
        response = requests.get(STATUS_URL, timeout=5)
        if response.ok:
            data = response.json()
            status = data.get('status', 'unknown')
            current_step = data.get('current_step', 0)
            total_steps = data.get('total_steps', 0)
            progress = data.get('progress', 0)

            if current_step > last_step:
                print(f"Step {current_step}/{total_steps} ({progress:.0f}%)")
                last_step = current_step

            if status in ['completed', 'failed']:
                print(f"\nTraining {status.upper()}")
                break

        time.sleep(5)

    except KeyboardInterrupt:
        print("\nStopped by user")
        sys.exit(0)
    except:
        time.sleep(5)

print("\nNow run this SQL query to verify ALL metrics persisted:")
print("-" * 70)
print(f"""
SELECT
    job_id,
    COUNT(*) as metric_count,
    MIN(step) as first_step,
    MAX(step) as last_step
FROM local_training_metrics
WHERE job_id = '{JOB_ID}'
GROUP BY job_id;
""")
print("-" * 70)
print("\nExpected: metric_count = 23 (not 1!) ✅")
