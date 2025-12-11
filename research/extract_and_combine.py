#!/usr/bin/env python3
"""Extract 1.5k more from UltraFeedback and combine with our dataset"""

import json
import random
from datetime import datetime

print("="*70)
print("EXTRACTING 1.5K MORE FROM ULTRAFEEDBACK")
print("="*70)

# Load the 60k dataset
print("\nLoading 60k UltraFeedback dataset...")
with open('/home/juan-canfield/Desktop/web-ui/output/completed_datasets/DPO-Datasets/ultrafeedback_cleaned_60k.jsonl', 'r') as f:
    all_ultrafeedback = [json.loads(line) for line in f]

print(f"Loaded {len(all_ultrafeedback)} examples")

# Load existing 1k sample to avoid duplicates
print("\nLoading existing 1k sample...")
with open('ultrafeedback_sample_1k.jsonl', 'r') as f:
    existing_1k = [json.loads(line) for line in f]

print(f"Loaded {len(existing_1k)} existing examples")

# Create a set of existing prompts to avoid duplicates
existing_prompts = {ex['prompt'] for ex in existing_1k}

# Filter out already sampled examples
available = [ex for ex in all_ultrafeedback if ex['prompt'] not in existing_prompts]
print(f"Available for sampling: {len(available)} examples")

# Randomly sample 1.5k
random.seed(42)
new_sample = random.sample(available, 1500)

print(f"Sampled {len(new_sample)} new examples")

# Combine with existing 1k
combined_ultrafeedback = existing_1k + new_sample
print(f"\nTotal UltraFeedback: {len(combined_ultrafeedback)} examples")

# Save combined UltraFeedback
with open('ultrafeedback_sample_2.5k.jsonl', 'w') as f:
    for ex in combined_ultrafeedback:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

print("Saved: ultrafeedback_sample_2.5k.jsonl")

# Load our custom dataset
print("\nLoading our custom dataset...")
with open('dpo_production_output/final_dpo_dataset_1984_combined.json', 'r') as f:
    our_dataset = json.load(f)

print(f"Loaded {len(our_dataset)} examples from our dataset")

# Combine everything
print("\nCombining datasets...")
final_combined = our_dataset + combined_ultrafeedback

# Shuffle
random.shuffle(final_combined)

print(f"Total combined: {len(final_combined)} examples")

# Save final combined dataset
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

with open(f'final_combined_dataset_{len(final_combined)}_{timestamp}.jsonl', 'w') as f:
    for ex in final_combined:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

with open(f'final_combined_dataset_{len(final_combined)}_{timestamp}.json', 'w') as f:
    json.dump(final_combined, f, indent=2, ensure_ascii=False)

print("\n" + "="*70)
print("FINAL DATASET")
print("="*70)
print(f"Our custom examples:     {len(our_dataset)}")
print(f"UltraFeedback examples:  {len(combined_ultrafeedback)}")
print(f"Total:                   {len(final_combined)}")
print(f"\nSaved:")
print(f"  - final_combined_dataset_{len(final_combined)}_{timestamp}.jsonl")
print(f"  - final_combined_dataset_{len(final_combined)}_{timestamp}.json")
print("="*70)
