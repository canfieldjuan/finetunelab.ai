#!/usr/bin/env python3
"""
Final validation of cleaned dataset for Fine Tune Lab upload
"""

import json
from pathlib import Path
from collections import Counter
import hashlib

def main():
    dataset_path = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/atlas_clean_final_dataset.jsonl")

    print("="*80)
    print("FINAL VALIDATION - ATLAS CLEAN DATASET")
    print("="*80)
    print()

    # Load and validate
    examples = []
    errors = []

    with open(dataset_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                ex = json.loads(line)

                # Validate structure
                if 'messages' not in ex:
                    errors.append(f"Line {i}: Missing 'messages'")
                    continue

                if len(ex['messages']) < 3:
                    errors.append(f"Line {i}: Too few messages")
                    continue

                if ex['messages'][0]['role'] != 'system':
                    errors.append(f"Line {i}: First message must be 'system'")

                # Check all messages have role and content
                for msg in ex['messages']:
                    if 'role' not in msg or 'content' not in msg:
                        errors.append(f"Line {i}: Invalid message structure")
                        break
                    if not msg['content'].strip():
                        errors.append(f"Line {i}: Empty content")
                        break

                examples.append(ex)

            except Exception as e:
                errors.append(f"Line {i}: {str(e)}")

    print(f"✅ Loaded {len(examples)} examples")
    print()

    if errors:
        print(f"❌ Found {len(errors)} errors:")
        for err in errors[:10]:
            print(f"   {err}")
        print()
        return

    # Check for duplicates again
    seen = set()
    duplicates = 0
    for ex in examples:
        user_msgs = [m['content'] for m in ex['messages'] if m['role'] == 'user']
        content_hash = hashlib.md5(''.join(user_msgs).encode()).hexdigest()
        if content_hash in seen:
            duplicates += 1
        seen.add(content_hash)

    if duplicates > 0:
        print(f"⚠️  Warning: {duplicates} duplicates still found")
        print()
    else:
        print("✅ No duplicates found")
        print()

    # Statistics
    stats = {
        'single_turn': 0,
        'multi_turn': 0,
        'message_counts': Counter(),
        'sources': Counter()
    }

    for ex in examples:
        msg_count = len(ex['messages'])
        turns = (msg_count - 1) // 2

        if turns == 1:
            stats['single_turn'] += 1
        else:
            stats['multi_turn'] += 1

        stats['message_counts'][msg_count] += 1
        stats['sources'][ex.get('metadata', {}).get('source', 'unknown')] += 1

    print("="*80)
    print("📊 FINAL DATASET STATISTICS")
    print("="*80)
    print(f"Total examples: {len(examples)}")
    print(f"Single-turn: {stats['single_turn']} ({stats['single_turn']/len(examples)*100:.1f}%)")
    print(f"Multi-turn: {stats['multi_turn']} ({stats['multi_turn']/len(examples)*100:.1f}%)")
    print()

    print("Message distribution:")
    for count, freq in sorted(stats['message_counts'].items()):
        print(f"   {count} messages: {freq} examples")
    print()

    print("Sources:")
    for source, count in stats['sources'].most_common():
        pct = (count / len(examples)) * 100
        print(f"   {source}: {count} ({pct:.1f}%)")
    print()

    # Sample examples
    print("="*80)
    print("📝 SAMPLE EXAMPLES")
    print("="*80)
    print()

    print("Single-turn example:")
    single = next((ex for ex in examples if len(ex['messages']) == 3), None)
    if single:
        print(json.dumps(single, indent=2)[:600])
        print("...\n")

    print("Multi-turn example:")
    multi = next((ex for ex in examples if len(ex['messages']) > 3), None)
    if multi:
        print(json.dumps(multi, indent=2)[:800])
        print("...\n")

    # Final verdict
    print("="*80)
    print("✅ FINAL VALIDATION COMPLETE")
    print("="*80)
    print()
    print(f"📁 File: {dataset_path.name}")
    print(f"📊 Examples: {len(examples)}")
    print(f"📏 Size: {dataset_path.stat().st_size:,} bytes ({dataset_path.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"✨ Format: Valid JSONL")
    print(f"🎯 Ready for: Fine Tune Lab Upload")
    print()
    print("🚀 DATASET IS CLEAN AND READY FOR TRAINING!")
    print()

if __name__ == "__main__":
    main()
