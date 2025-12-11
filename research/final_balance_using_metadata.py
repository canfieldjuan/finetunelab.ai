#!/usr/bin/env python3
"""Check balance using metadata topic for accurate classification"""

import json

with open('dpo_production_output/final_dpo_dataset_1884_20251125_221656.json', 'r') as f:
    data = json.load(f)

print(f"\n{'='*70}")
print(f"ACCURATE BALANCE CHECK - {len(data)} examples")
print(f"Using metadata.topic for classification")
print(f"{'='*70}\n")

scenarios = {'how_to': 0, 'troubleshooting': 0, 'failure': 0, 'edge_case': 0}

for ex in data:
    topic = ex['metadata'].get('topic', '').lower()

    # More accurate classification using metadata
    if 'troubleshooting' in topic or 'debugging' in topic or 'diagnosing' in topic:
        scenarios['troubleshooting'] += 1
    elif 'failure' in topic or 'broke' in topic or 'crash' in topic or 'failed' in topic:
        scenarios['failure'] += 1
    elif 'edge case' in topic or 'unusual' in topic or 'rare' in topic:
        scenarios['edge_case'] += 1
    else:
        # Default to how-to
        scenarios['how_to'] += 1

print("SCENARIO DISTRIBUTION:")
print(f"  How-to:          {scenarios['how_to']:4d} ({scenarios['how_to']/len(data)*100:5.1f}%)  [Target: 40%]")
print(f"  Troubleshooting: {scenarios['troubleshooting']:4d} ({scenarios['troubleshooting']/len(data)*100:5.1f}%)  [Target: 30%]")
print(f"  Failure:         {scenarios['failure']:4d} ({scenarios['failure']/len(data)*100:5.1f}%)  [Target: 20%]")
print(f"  Edge case:       {scenarios['edge_case']:4d} ({scenarios['edge_case']/len(data)*100:5.1f}%)  [Target: 10%]")

# Word count check
prompt_words = [len(ex['prompt'].split()) for ex in data]
chosen_words = [len(ex['chosen'].split()) for ex in data]
rejected_words = [len(ex['rejected'].split()) for ex in data]

print(f"\nWORD COUNTS:")
print(f"  Prompts:  {sum(prompt_words)/len(prompt_words):.1f}w avg  [Target: 80-120w]")
print(f"  Chosen:   {sum(chosen_words)/len(chosen_words):.1f}w avg  [Target: 250-300w]")
print(f"  Rejected: {sum(rejected_words)/len(rejected_words):.1f}w avg  [Target: 200-250w]")
print(f"\n{'='*70}\n")
