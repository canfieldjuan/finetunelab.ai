#!/usr/bin/env python3
"""
Recover valid multi-turn conversations from failed batches.

Filters out JSON parse errors, keeps message count mismatches if they're valid multi-turn.
"""

import json
import os
from pathlib import Path
from datetime import datetime

def is_valid_multiturn(data):
    """Check if a conversation is a valid multi-turn example (2-4 turns)."""
    if not isinstance(data, dict) or 'messages' not in data:
        return False, "Missing messages field"

    messages = data['messages']
    if not isinstance(messages, list) or len(messages) < 5:
        return False, f"Too few messages: {len(messages)}"

    # Count roles
    has_system = any(m.get('role') == 'system' for m in messages)
    user_count = sum(1 for m in messages if m.get('role') == 'user')
    assistant_count = sum(1 for m in messages if m.get('role') == 'assistant')

    # Valid multi-turn: 2-4 complete exchanges
    if user_count != assistant_count:
        return False, f"Mismatched user/assistant count: {user_count} vs {assistant_count}"

    turns = user_count
    if turns < 2 or turns > 4:
        return False, f"Invalid turn count: {turns} (need 2-4)"

    # Check message structure
    for msg in messages:
        if not isinstance(msg, dict) or 'role' not in msg or 'content' not in msg:
            return False, "Invalid message structure"

    return True, f"{turns}-turn conversation"

def recover_failed_batches(output_dir):
    """Process all debug_batch_*.txt files and recover valid conversations."""

    print("="*80)
    print("RECOVERING FAILED MULTI-TURN BATCHES")
    print("="*80)
    print()

    debug_files = sorted(Path(output_dir).glob("debug_batch_*.txt"))
    print(f"Found {len(debug_files)} debug files to process")
    print()

    recovered = []
    json_parse_errors = 0
    invalid_structure = 0

    for debug_file in debug_files:
        try:
            with open(debug_file, 'r', encoding='utf-8') as f:
                content = f.read().strip()

            # Try to parse JSON
            try:
                data = json.loads(content)
            except json.JSONDecodeError as e:
                json_parse_errors += 1
                continue

            # Validate if it's a valid multi-turn conversation
            valid, reason = is_valid_multiturn(data)

            if valid:
                recovered.append(data)
                print(f"✓ Recovered {debug_file.name}: {reason}")
            else:
                invalid_structure += 1

        except Exception as e:
            print(f"✗ Error processing {debug_file.name}: {e}")
            continue

    print()
    print("="*80)
    print("RECOVERY SUMMARY")
    print("="*80)
    print(f"Total debug files: {len(debug_files)}")
    print(f"  ✓ Recovered valid conversations: {len(recovered)}")
    print(f"  ✗ JSON parse errors: {json_parse_errors}")
    print(f"  ✗ Invalid structure: {invalid_structure}")
    print()

    if recovered:
        # Analyze recovered data
        turn_counts = {}
        for conv in recovered:
            messages = conv['messages']
            user_count = sum(1 for m in messages if m.get('role') == 'user')
            turn_counts[user_count] = turn_counts.get(user_count, 0) + 1

        print("Recovered conversations by turn count:")
        for turns, count in sorted(turn_counts.items()):
            print(f"  {turns}-turn: {count} conversations")
        print()

        # Save recovered data
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = Path(output_dir) / f"recovered_conversations_{len(recovered)}_{timestamp}.jsonl"

        with open(output_file, 'w', encoding='utf-8') as f:
            for conv in recovered:
                f.write(json.dumps(conv, ensure_ascii=False) + '\n')

        print(f"✓ Saved {len(recovered)} recovered conversations to:")
        print(f"  {output_file}")
        print()

    return recovered

if __name__ == "__main__":
    output_dir = Path(__file__).parent / "multiturn_sft_output"
    recovered = recover_failed_batches(output_dir)

    print("="*80)
    print("NEXT STEPS:")
    print("="*80)
    if recovered:
        print(f"You can add these {len(recovered)} recovered conversations to your dataset.")
        print("Run combine_all_sft_data.py again to merge them.")
    else:
        print("No additional conversations recovered.")
    print("="*80)
