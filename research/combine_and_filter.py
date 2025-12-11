#!/usr/bin/env python3
"""Combine all datasets and filter to exactly 2000 with perfect distribution"""

import json
import random
from pathlib import Path
from datetime import datetime

# All datasets to combine
datasets = [
    "dpo_production_output/dpo_dataset_986_20251125_211321.json",  # Claude Haiku 4.5
    "dpo_production_output/dpo_dataset_99_20251125_213434.json",    # Nemotron
    "dpo_production_output/dpo_dataset_100_20251125_213927.json",   # Grok test
    "dpo_production_output/dpo_dataset_100_20251125_215644.json",   # No how-to test
    "dpo_production_output/dpo_dataset_994_20251125_221137.json",   # Grok 1k
    "dpo_production_output/dpo_dataset_249_20251125_221629.json",   # Grok final 250
]

print("="*70)
print("COMBINING ALL DATASETS")
print("="*70)

all_examples = []
for path in datasets:
    with open(path, 'r') as f:
        data = json.load(f)
        all_examples.extend(data)
        print(f"Loaded {len(data):4d} from {Path(path).name}")

print(f"\nTotal examples: {len(all_examples)}")

# Classify all examples
def classify_scenario(prompt):
    """Classify scenario type"""
    prompt_lower = prompt.lower()

    has_problem = any(phrase in prompt_lower for phrase in [
        'not working', 'doesn\'t work', 'isn\'t working', 'won\'t',
        'error', 'issue', 'problem', 'broke', 'failed', 'crash', 'failing',
        'weird', 'unexpected', 'confusing', 'wrong', 'stuck',
        'i tried', 'i ran', 'i trained', 'i tested', 'getting', 'seeing'
    ])

    if any(phrase in prompt_lower for phrase in ['broke', 'failed', 'crash', 'failing']):
        return 'failure'
    elif has_problem:
        return 'troubleshooting'
    elif any(phrase in prompt_lower for phrase in ['how do i', 'how can i', 'how to', 'what\'s the best way']):
        return 'how_to'
    else:
        return 'edge_case'

# Categorize all examples
categorized = {
    'how_to': [],
    'troubleshooting': [],
    'failure': [],
    'edge_case': []
}

for ex in all_examples:
    scenario = classify_scenario(ex['prompt'])
    categorized[scenario].append(ex)

print("\n" + "="*70)
print("AVAILABLE EXAMPLES BY SCENARIO")
print("="*70)
print(f"How-to:          {len(categorized['how_to']):4d}")
print(f"Troubleshooting: {len(categorized['troubleshooting']):4d}")
print(f"Failure:         {len(categorized['failure']):4d}")
print(f"Edge case:       {len(categorized['edge_case']):4d}")

# Target distribution for 2000 examples
targets = {
    'how_to': 800,
    'troubleshooting': 600,
    'failure': 400,
    'edge_case': 200
}

print("\n" + "="*70)
print("SELECTING 2000 EXAMPLES")
print("="*70)

final_dataset = []
random.seed(42)  # For reproducibility

for scenario, target in targets.items():
    available = categorized[scenario]

    if len(available) >= target:
        selected = random.sample(available, target)
        print(f"{scenario:15s}: Selected {len(selected):4d} / {len(available):4d} available")
    else:
        selected = available
        print(f"{scenario:15s}: Only {len(selected):4d} available (need {target:4d}) ⚠️")

    final_dataset.extend(selected)

# Shuffle final dataset
random.shuffle(final_dataset)

print(f"\nFinal dataset: {len(final_dataset)} examples")

# Save
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_dir = Path("dpo_production_output")

jsonl_file = output_dir / f"final_dpo_dataset_{len(final_dataset)}_{timestamp}.jsonl"
with open(jsonl_file, 'w') as f:
    for ex in final_dataset:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

json_file = output_dir / f"final_dpo_dataset_{len(final_dataset)}_{timestamp}.json"
with open(json_file, 'w') as f:
    json.dump(final_dataset, f, indent=2, ensure_ascii=False)

print("\n" + "="*70)
print("SAVED FINAL DATASET")
print("="*70)
print(f"JSONL: {jsonl_file.name}")
print(f"JSON:  {json_file.name}")
print("="*70)
