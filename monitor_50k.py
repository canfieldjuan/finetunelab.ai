"""Monitor 50K training job"""
import requests
import time
from datetime import datetime

JOB_ID = "3acee2e0-7721-4634-ac54-40dab510edcb"
STATUS_URL = f"http://localhost:8000/api/training/status/{JOB_ID}"

print("="*70)
print("50K TRAINING JOB MONITOR")
print("="*70)
print(f"Job ID: {JOB_ID}")
print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Expected duration: ~1.5 hours (84 minutes)")
print("="*70)

last_step = 0
start_time = time.time()

while True:
    try:
        response = requests.get(STATUS_URL, timeout=5)
        if response.ok:
            data = response.json()
            status = data.get('status', 'unknown')
            current_step = data.get('current_step', 0)
            total_steps = data.get('total_steps', 0)
            progress = data.get('progress', 0)
            loss = data.get('loss')

            elapsed = int(time.time() - start_time)
            elapsed_min = elapsed // 60

            if current_step > last_step:
                loss_str = f"{loss:.4f}" if loss else "N/A"
                # Estimate remaining time
                if current_step > 0:
                    steps_per_sec = current_step / elapsed
                    remaining_steps = total_steps - current_step
                    remaining_sec = remaining_steps / steps_per_sec if steps_per_sec > 0 else 0
                    remaining_min = int(remaining_sec / 60)
                    print(f"[{elapsed_min:3d}m] Step {current_step:5d}/{total_steps} ({progress:5.1f}%) | Loss: {loss_str} | ETA: {remaining_min}m")
                else:
                    print(f"[{elapsed_min:3d}m] Step {current_step:5d}/{total_steps} ({progress:5.1f}%) | Loss: {loss_str}")
                last_step = current_step

            if status == 'completed':
                print("\n" + "="*70)
                print("TRAINING COMPLETED!")
                print(f"Total time: {elapsed_min} minutes ({elapsed//3600}h {(elapsed%3600)//60}m)")
                print("="*70)
                break
            elif status == 'failed':
                print("\n" + "="*70)
                print("TRAINING FAILED")
                print(data.get('error', 'Unknown error'))
                print("="*70)
                break

        time.sleep(10)  # Check every 10 seconds

    except KeyboardInterrupt:
        print("\n\nMonitoring stopped by user")
        print(f"Job is still running. Check status with:")
        print(f"  curl http://localhost:8000/api/training/status/{JOB_ID}")
        break
    except Exception as e:
        time.sleep(10)

print("\nVerify metrics in database:")
print(f"  SELECT COUNT(*) FROM local_training_metrics WHERE job_id = '{JOB_ID}';")
