#!/usr/bin/env python3
"""
Analyze failed multi-turn batches to see if they're actually usable despite validation failures.

Many failures are just message count mismatches (e.g., 6 or 8 messages instead of 7),
but the conversations might still be valid multi-turn examples.
"""

import json
import sys
from pathlib import Path
from datetime import datetime

def analyze_failed_batches(log_file_path):
    """Parse the log to find failed batches and their raw outputs."""

    print("="*70)
    print("ANALYZING FAILED MULTI-TURN BATCHES")
    print("="*70)

    # Read the log file
    with open(log_file_path, 'r') as f:
        log_content = f.read()

    # Find all failed batch lines
    failed_batches = []
    for line in log_content.split('\n'):
        if 'FAILED:' in line:
            failed_batches.append(line)

    print(f"\nTotal failed batches: {len(failed_batches)}")
    print()

    # Categorize failures
    failure_types = {
        'message_count_mismatch': [],
        'json_parse_error': [],
        'other': []
    }

    for failure in failed_batches:
        if 'Expected' in failure and 'messages, got' in failure:
            # Extract expected vs actual
            parts = failure.split('Expected ')
            if len(parts) > 1:
                expected = parts[1].split(' messages')[0]
                actual = parts[1].split('got ')[1].split(',')[0]
                failure_types['message_count_mismatch'].append({
                    'line': failure,
                    'expected': int(expected),
                    'actual': int(actual)
                })
        elif 'JSON parse' in failure:
            failure_types['json_parse_error'].append(failure)
        else:
            failure_types['other'].append(failure)

    print("Failure breakdown:")
    print(f"  Message count mismatch: {len(failure_types['message_count_mismatch'])}")
    print(f"  JSON parse errors: {len(failure_types['json_parse_error'])}")
    print(f"  Other: {len(failure_types['other'])}")
    print()

    # Analyze message count mismatches
    if failure_types['message_count_mismatch']:
        print("Message count mismatch details:")
        expected_vs_actual = {}
        for failure in failure_types['message_count_mismatch']:
            key = f"Expected {failure['expected']}, got {failure['actual']}"
            expected_vs_actual[key] = expected_vs_actual.get(key, 0) + 1

        for pattern, count in sorted(expected_vs_actual.items(), key=lambda x: x[1], reverse=True):
            print(f"  {pattern}: {count} cases")
        print()

        # Determine if these are salvageable
        print("Analysis:")
        for failure in failure_types['message_count_mismatch']:
            expected = failure['expected']
            actual = failure['actual']
            diff = actual - expected

            if diff == 1 and expected == 7:
                # Got 8 instead of 7 for 3-turn - might be 4-turn conversation
                status = "✅ SALVAGEABLE - Likely valid 4-turn (8 msgs)"
            elif diff == -1 and expected == 7:
                # Got 6 instead of 7 for 3-turn - might be 2-turn conversation
                status = "⚠️  PARTIAL - Likely valid 2-turn (6 msgs)"
            elif diff == 2 and expected == 7:
                # Got 9 instead of 7 for 3-turn - might be 4-turn conversation
                status = "✅ SALVAGEABLE - Likely valid 4-turn (9 msgs)"
            elif diff == -1 and expected == 9:
                # Got 8 instead of 9 for 4-turn - might be 3-turn conversation
                status = "⚠️  PARTIAL - Likely valid 3-turn (8 msgs)"
            elif diff == -2 and expected == 9:
                # Got 7 instead of 9 for 4-turn - might be 3-turn conversation
                status = "⚠️  PARTIAL - Likely valid 3-turn (7 msgs)"
            else:
                status = f"❓ UNKNOWN - Diff: {diff}"

            # Only print first few
            if failure == failure_types['message_count_mismatch'][0]:
                print(f"  Example: {status}")
                break

        # Count salvageable
        salvageable = 0
        partial = 0
        for failure in failure_types['message_count_mismatch']:
            expected = failure['expected']
            actual = failure['actual']
            diff = actual - expected

            # Valid multi-turn conversations (2, 3, or 4 turns)
            # 2-turn = 5 msgs, 3-turn = 7 msgs, 4-turn = 9 msgs (including 1 system)
            if actual in [5, 7, 9]:
                salvageable += 1
            elif actual in [6, 8]:  # Off by 1
                partial += 1

        print()
        print(f"✅ Salvageable (valid 2/3/4-turn): {salvageable}/{len(failure_types['message_count_mismatch'])}")
        print(f"⚠️  Partial (off by 1): {partial}/{len(failure_types['message_count_mismatch'])}")
        print(f"❌ Unusable: {len(failure_types['message_count_mismatch']) - salvageable - partial}")
        print()

    # Summary
    total_failures = len(failed_batches)
    message_count_failures = len(failure_types['message_count_mismatch'])
    json_failures = len(failure_types['json_parse_error'])

    print("="*70)
    print("RECOMMENDATION:")
    print("="*70)
    if message_count_failures > json_failures * 2:
        print(f"Most failures ({message_count_failures}/{total_failures}) are message count mismatches.")
        print("These are likely still valid multi-turn conversations, just with different")
        print("turn counts than requested. We can:")
        print("  1. Keep them as-is (they're still multi-turn SFT data)")
        print("  2. Filter to only valid 2/3/4-turn conversations")
        print("  3. Manually inspect a few samples to verify quality")
        print()
        print("✅ SAFE TO INCLUDE - These add diversity to the dataset!")
    else:
        print(f"Significant JSON parse errors ({json_failures}/{total_failures}).")
        print("Need to inspect these manually before including.")
    print("="*70)

if __name__ == "__main__":
    # Find the most recent production run log
    output_dir = Path(__file__).parent / "multiturn_sft_output"

    if len(sys.argv) > 1:
        log_file = Path(sys.argv[1])
    else:
        log_file = output_dir / "production_run_1000.log"

    if not log_file.exists():
        print(f"Error: Log file not found: {log_file}")
        sys.exit(1)

    analyze_failed_batches(log_file)
