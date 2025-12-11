#!/usr/bin/env python3
"""Verify accuracy and quality of final dataset"""

import json
import random

with open('dpo_production_output/final_dpo_dataset_1984_combined.json', 'r') as f:
    data = json.load(f)

print(f"\n{'='*70}")
print(f"ACCURACY VERIFICATION - {len(data)} examples")
print(f"{'='*70}\n")

# Check structure requirements
issues = []
good_examples = 0

for i, ex in enumerate(data):
    prompt = ex['prompt']
    chosen = ex['chosen']
    rejected = ex['rejected']

    prompt_words = len(prompt.split())
    chosen_words = len(chosen.split())
    rejected_words = len(rejected.split())

    # Check word counts
    if prompt_words < 80 or prompt_words > 150:
        issues.append(f"Example {i}: Prompt {prompt_words}w (target: 80-120w)")

    if chosen_words < 200 or chosen_words > 400:
        issues.append(f"Example {i}: Chosen {chosen_words}w (target: 250-300w)")

    if rejected_words < 150 or rejected_words > 300:
        issues.append(f"Example {i}: Rejected {rejected_words}w (target: 200-250w)")

    # Check chosen structure
    has_numbered_steps = '**1.' in chosen or '**Step' in chosen or '1. **' in chosen
    has_bold = '**' in chosen
    has_pro_tip = 'Pro Tip' in chosen or 'pro tip' in chosen.lower()

    if not has_numbered_steps:
        issues.append(f"Example {i}: Chosen missing numbered steps")

    if not has_bold:
        issues.append(f"Example {i}: Chosen missing bold headers")

    if not has_pro_tip:
        issues.append(f"Example {i}: Chosen missing Pro Tip")

    # Check rejected is substantial
    if rejected_words < 100:
        issues.append(f"Example {i}: Rejected too short ({rejected_words}w)")

    if not issues or len([iss for iss in issues if f"Example {i}:" in iss]) == 0:
        good_examples += 1

# Word count stats
prompt_words = [len(ex['prompt'].split()) for ex in data]
chosen_words = [len(ex['chosen'].split()) for ex in data]
rejected_words = [len(ex['rejected'].split()) for ex in data]

print("WORD COUNT STATS:")
print(f"  Prompts:  {min(prompt_words)}-{max(prompt_words)}w (avg: {sum(prompt_words)/len(prompt_words):.1f}w)")
print(f"  Chosen:   {min(chosen_words)}-{max(chosen_words)}w (avg: {sum(chosen_words)/len(chosen_words):.1f}w)")
print(f"  Rejected: {min(rejected_words)}-{max(rejected_words)}w (avg: {sum(rejected_words)/len(rejected_words):.1f}w)")

# Structure stats
has_steps = sum(1 for ex in data if '**1.' in ex['chosen'] or '**Step' in ex['chosen'] or '1. **' in ex['chosen'])
has_bold = sum(1 for ex in data if '**' in ex['chosen'])
has_tip = sum(1 for ex in data if 'Pro Tip' in ex['chosen'] or 'pro tip' in ex['chosen'].lower())

print(f"\nSTRUCTURE COMPLIANCE:")
print(f"  Numbered steps: {has_steps}/{len(data)} ({has_steps/len(data)*100:.1f}%)")
print(f"  Bold headers:   {has_bold}/{len(data)} ({has_bold/len(data)*100:.1f}%)")
print(f"  Pro Tips:       {has_tip}/{len(data)} ({has_tip/len(data)*100:.1f}%)")

print(f"\nQUALITY:")
print(f"  Examples with all requirements: {good_examples}/{len(data)} ({good_examples/len(data)*100:.1f}%)")
print(f"  Issues found: {len(issues)}")

if issues and len(issues) < 20:
    print("\nSample issues:")
    for issue in issues[:10]:
        print(f"  - {issue}")

# Sample 3 random examples for manual review
print(f"\n{'='*70}")
print("SAMPLE EXAMPLES FOR MANUAL REVIEW")
print(f"{'='*70}")

random.seed(42)
samples = random.sample(data, 3)

for i, ex in enumerate(samples, 1):
    print(f"\n--- EXAMPLE {i} ---")
    print(f"Prompt ({len(ex['prompt'].split())}w):")
    print(ex['prompt'][:200] + "..." if len(ex['prompt']) > 200 else ex['prompt'])
    print(f"\nChosen ({len(ex['chosen'].split())}w):")
    print(ex['chosen'][:300] + "..." if len(ex['chosen']) > 300 else ex['chosen'])
    print(f"\nRejected ({len(ex['rejected'].split())}w):")
    print(ex['rejected'][:300] + "..." if len(ex['rejected']) > 300 else ex['rejected'])

print(f"\n{'='*70}\n")
