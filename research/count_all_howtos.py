#!/usr/bin/env python3
"""Count total how-to examples across all datasets"""

import json
from pathlib import Path

datasets = [
    ("Claude Haiku 4.5 (first)", "dpo_production_output/dpo_dataset_986_20251125_211321.json"),
    ("Nemotron", "dpo_production_output/dpo_dataset_99_20251125_213434.json"),
    ("Grok", "dpo_production_output/dpo_dataset_100_20251125_213927.json"),
    ("Claude Haiku 4.5 (test)", "dpo_production_output/dpo_dataset_99_20251125_214918.json"),
]

total_examples = 0
total_howtos = 0

print("\n" + "="*70)
print("TOTAL HOW-TO COUNT ACROSS ALL DATASETS")
print("="*70)

for name, path in datasets:
    with open(path, 'r') as f:
        data = json.load(f)

    howtos = 0
    for ex in data:
        prompt_lower = ex['prompt'].lower()
        if any(phrase in prompt_lower for phrase in ['how do i', 'how can i', 'how to', 'what\'s the best way']):
            howtos += 1

    total_examples += len(data)
    total_howtos += howtos

    print(f"\n{name}:")
    print(f"  Examples: {len(data)}")
    print(f"  How-tos: {howtos} ({howtos/len(data)*100:.1f}%)")

print(f"\n{'='*70}")
print(f"TOTAL ACROSS ALL DATASETS:")
print(f"  Total examples: {total_examples}")
print(f"  Total how-tos: {total_howtos} ({total_howtos/total_examples*100:.1f}%)")
print(f"  Non how-tos: {total_examples - total_howtos} ({(total_examples - total_howtos)/total_examples*100:.1f}%)")
print(f"{'='*70}\n")
