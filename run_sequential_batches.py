import subprocess
import os
import time
from datetime import datetime

def run_batch(batch_num, input_file, output_file, num_examples):
    print(f"\n{'='*70}")
    print(f"[*] Starting Batch {batch_num}")
    print(f"[*] Input: {input_file}")
    print(f"[*] Output: {output_file}")
    print(f"[*] Examples: {num_examples}")
    print(f"[*] Started at {datetime.now().strftime('%I:%M:%S %p')}")
    print(f"{'='*70}\n")

    cmd = [
        'python', 'generate_batch_async.py',
        input_file,
        output_file,
        str(num_examples),
        '15'
    ]

    result = subprocess.run(cmd, capture_output=False)

    print(f"\n{'='*70}")
    print(f"[*] Batch {batch_num} completed at {datetime.now().strftime('%I:%M:%S %p')}")
    print(f"[*] Exit code: {result.returncode}")
    print(f"{'='*70}\n")

    return result.returncode == 0

def wait_for_batch_5():
    """Wait for batch 5 to complete by checking if the output file exists and is stable"""
    output_file = "output/tier3_batch_005_COMPLETE.jsonl"

    print(f"[*] Waiting for Batch 5 to complete...")
    print(f"[*] Monitoring: {output_file}")
    print(f"[*] Current time: {datetime.now().strftime('%I:%M:%S %p')}")
    print()

    last_size = 0
    stable_count = 0

    while True:
        if os.path.exists(output_file):
            current_size = os.path.getsize(output_file)

            if current_size > last_size:
                last_size = current_size
                stable_count = 0
                print(f"[*] Batch 5 in progress... ({current_size:,} bytes)")
            else:
                stable_count += 1
                if stable_count >= 3:  # File size stable for 30 seconds
                    print(f"[*] Batch 5 appears complete!")
                    print(f"[*] Final size: {current_size:,} bytes")
                    break

        time.sleep(10)  # Check every 10 seconds

def main():
    print(f"\n{'='*70}")
    print("SEQUENTIAL BATCH PROCESSOR")
    print("Batches 2, 3, 4 (3,000 examples total)")
    print(f"{'='*70}\n")

    # Wait for batch 5 to complete first
    wait_for_batch_5()

    # Define batches to run
    batches = [
        {
            'num': 2,
            'input': 'output/batches_for_deepseek/tier3/tier3_batch_002_mobo_gpu.jsonl',
            'output': 'output/tier3_batch_002_COMPLETE.jsonl',
            'examples': 1000
        },
        {
            'num': 3,
            'input': 'output/batches_for_deepseek/tier3/tier3_batch_003_psu_cooling.jsonl',
            'output': 'output/tier3_batch_003_COMPLETE.jsonl',
            'examples': 1000
        },
        {
            'num': 4,
            'input': 'output/batches_for_deepseek/tier3/tier3_batch_004_ram_cpu.jsonl',
            'output': 'output/tier3_batch_004_COMPLETE.jsonl',
            'examples': 1000
        }
    ]

    # Run each batch sequentially
    start_time = datetime.now()
    successful = 0
    failed = 0

    for batch in batches:
        success = run_batch(
            batch['num'],
            batch['input'],
            batch['output'],
            batch['examples']
        )

        if success:
            successful += 1
        else:
            failed += 1
            print(f"[!] Batch {batch['num']} failed! Continuing to next batch...")

    # Final summary
    end_time = datetime.now()
    duration = end_time - start_time

    print(f"\n{'='*70}")
    print("FINAL SUMMARY")
    print(f"{'='*70}")
    print(f"Total batches: {len(batches)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Total duration: {duration}")
    print(f"Completed at: {end_time.strftime('%I:%M:%S %p')}")
    print(f"{'='*70}\n")

if __name__ == '__main__':
    main()
