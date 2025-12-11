#!/usr/bin/env python3
"""Total balance across all datasets with fixed logic"""

import json

datasets = [
    ("Claude Haiku 4.5 (986)", "dpo_production_output/dpo_dataset_986_20251125_211321.json"),
    ("Nemotron (99)", "dpo_production_output/dpo_dataset_99_20251125_213434.json"),
    ("Grok (100)", "dpo_production_output/dpo_dataset_100_20251125_213927.json"),
    ("No how-to test (100)", "dpo_production_output/dpo_dataset_100_20251125_215644.json"),
]

all_examples = []
for name, path in datasets:
    with open(path, 'r') as f:
        all_examples.extend(json.load(f))

print(f"\n{'='*70}")
print(f"TOTAL FIXED BALANCE - {len(all_examples)} examples")
print(f"{'='*70}\n")

scenarios = {'how_to': 0, 'troubleshooting': 0, 'failure': 0, 'edge_case': 0}

for ex in all_examples:
    prompt_lower = ex['prompt'].lower()

    has_problem = any(phrase in prompt_lower for phrase in [
        'not working', 'doesn\'t work', 'isn\'t working', 'won\'t',
        'error', 'issue', 'problem', 'broke', 'failed', 'crash', 'failing',
        'weird', 'unexpected', 'confusing', 'wrong', 'stuck',
        'i tried', 'i ran', 'i trained', 'i tested', 'getting', 'seeing'
    ])

    if any(phrase in prompt_lower for phrase in ['broke', 'failed', 'crash', 'failing']):
        scenarios['failure'] += 1
    elif has_problem:
        scenarios['troubleshooting'] += 1
    elif any(phrase in prompt_lower for phrase in ['how do i', 'how can i', 'how to', 'what\'s the best way']):
        scenarios['how_to'] += 1
    else:
        scenarios['edge_case'] += 1

print("SCENARIO DISTRIBUTION:")
print(f"  How-to:          {scenarios['how_to']:4d} ({scenarios['how_to']/len(all_examples)*100:5.1f}%)  [Target: 800 / 40%]")
print(f"  Troubleshooting: {scenarios['troubleshooting']:4d} ({scenarios['troubleshooting']/len(all_examples)*100:5.1f}%)  [Target: 600 / 30%]")
print(f"  Failure:         {scenarios['failure']:4d} ({scenarios['failure']/len(all_examples)*100:5.1f}%)  [Target: 400 / 20%]")
print(f"  Edge case:       {scenarios['edge_case']:4d} ({scenarios['edge_case']/len(all_examples)*100:5.1f}%)  [Target: 200 / 10%]")

print(f"\nFor 2000 examples, we need:")
print(f"  How-to:          {max(0, 800 - scenarios['how_to']):4d} more")
print(f"  Troubleshooting: {max(0, 600 - scenarios['troubleshooting']):4d} more")
print(f"  Failure:         {max(0, 400 - scenarios['failure']):4d} more")
print(f"  Edge case:       {max(0, 200 - scenarios['edge_case']):4d} more")
print(f"\n{'='*70}\n")
