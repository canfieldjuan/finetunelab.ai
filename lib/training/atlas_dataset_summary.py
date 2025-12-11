#!/usr/bin/env python3
"""
Summary of complete Atlas training dataset
"""

import json
from pathlib import Path
from collections import defaultdict

def main():
    dataset_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_final_dataset.jsonl")

    print("="*80)
    print("ATLAS TRAINING DATASET - FINAL SUMMARY")
    print("="*80)
    print()

    examples = []
    with open(dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            examples.append(json.loads(line))

    # Statistics
    stats = {
        "total": len(examples),
        "single_turn": 0,
        "multi_turn": 0,
        "by_source": defaultdict(int),
        "total_turns": 0,
        "total_messages": 0
    }

    for ex in examples:
        if ex['metadata']['type'] == 'single_turn':
            stats['single_turn'] += 1
        else:
            stats['multi_turn'] += 1
            stats['total_turns'] += ex['metadata'].get('turns', 0)

        source = ex['metadata'].get('source_file', ex['metadata'].get('feature', 'unknown'))
        stats['by_source'][source] += 1
        stats['total_messages'] += len(ex['messages'])

    print(f"📊 DATASET OVERVIEW")
    print(f"   Total training examples: {stats['total']}")
    print(f"   Single-turn Q&As: {stats['single_turn']}")
    print(f"   Multi-turn conversations: {stats['multi_turn']}")
    print(f"   Total conversation turns: {stats['total_turns']}")
    print(f"   Average turns per multi-turn: {stats['total_turns'] / max(stats['multi_turn'], 1):.1f}")
    print(f"   Total messages (all types): {stats['total_messages']}")
    print()

    print(f"📁 EXAMPLES BY SOURCE DOCUMENT")
    for source, count in sorted(stats['by_source'].items(), key=lambda x: -x[1]):
        pct = (count / stats['total']) * 100
        print(f"   {source}: {count} ({pct:.1f}%)")
    print()

    print(f"💾 FILE INFORMATION")
    print(f"   Location: {dataset_path}")
    print(f"   Size: {dataset_path.stat().st_size:,} bytes")
    print(f"   Format: JSONL (one example per line)")
    print()

    print(f"🎯 ATLAS PERSONA")
    print(f"   Role: AI guide, mentor, and gentle salesman")
    print(f"   Tone: Knowledgeable, enthusiastic, honest")
    print(f"   Goal: Help users + encourage sign-ups naturally")
    print()

    print(f"✅ READY FOR FINE-TUNING!")
    print(f"   Use this dataset to train your model on FineTune Lab knowledge")
    print(f"   Atlas will guide users through features and encourage adoption")
    print()

if __name__ == "__main__":
    main()
