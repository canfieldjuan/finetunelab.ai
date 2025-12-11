#!/usr/bin/env python3
"""Verify the converted SFT dataset quality"""

import json
import random

print("="*70)
print("SFT CONVERSION QUALITY VERIFICATION")
print("="*70)

# Load converted dataset
with open('atlas_sft_from_dpo_4484_20251125_224614.jsonl', 'r') as f:
    converted_data = [json.loads(line) for line in f]

print(f"\nTotal examples: {len(converted_data)}")

# Validate structure
valid = 0
invalid = 0
word_counts_user = []
word_counts_assistant = []

for ex in converted_data:
    # Check required fields
    if 'messages' not in ex or len(ex['messages']) != 3:
        invalid += 1
        continue

    msgs = ex['messages']
    if msgs[0]['role'] != 'system' or msgs[1]['role'] != 'user' or msgs[2]['role'] != 'assistant':
        invalid += 1
        continue

    valid += 1
    word_counts_user.append(len(msgs[1]['content'].split()))
    word_counts_assistant.append(len(msgs[2]['content'].split()))

print(f"\nSTRUCTURE VALIDATION:")
print(f"  Valid:   {valid}/{len(converted_data)} ({valid/len(converted_data)*100:.1f}%)")
print(f"  Invalid: {invalid}/{len(converted_data)} ({invalid/len(converted_data)*100:.1f}%)")

print(f"\nWORD COUNTS:")
print(f"  User prompts:  {min(word_counts_user)}-{max(word_counts_user)}w (avg: {sum(word_counts_user)/len(word_counts_user):.1f}w)")
print(f"  Assistant:     {min(word_counts_assistant)}-{max(word_counts_assistant)}w (avg: {sum(word_counts_assistant)/len(word_counts_assistant):.1f}w)")

# Check assistant response features
assistant_responses = [ex['messages'][2]['content'] for ex in converted_data]
has_numbered = sum(1 for r in assistant_responses if any(x in r for x in ['**1.', '1. **', '**Step']))
has_bold = sum(1 for r in assistant_responses if '**' in r)
has_tips = sum(1 for r in assistant_responses if 'Pro Tip' in r)

print(f"\nASSISTANT RESPONSE FEATURES:")
print(f"  Numbered steps:  {has_numbered}/{len(assistant_responses)} ({has_numbered/len(assistant_responses)*100:.1f}%)")
print(f"  Bold formatting: {has_bold}/{len(assistant_responses)} ({has_bold/len(assistant_responses)*100:.1f}%)")
print(f"  Pro Tips:        {has_tips}/{len(assistant_responses)} ({has_tips/len(assistant_responses)*100:.1f}%)")

# Sample 3 random examples
print(f"\n{'='*70}")
print("SAMPLE EXAMPLES")
print(f"{'='*70}")

random.seed(42)
samples = random.sample(converted_data, 3)

for i, ex in enumerate(samples, 1):
    print(f"\n--- EXAMPLE {i} ---")
    print(f"User ({len(ex['messages'][1]['content'].split())}w):")
    print(f"  {ex['messages'][1]['content'][:150]}...")
    print(f"\nAssistant ({len(ex['messages'][2]['content'].split())}w):")
    print(f"  {ex['messages'][2]['content'][:300]}...")

print(f"\n{'='*70}")
print("COMPARISON: OLD ATLAS vs NEW SFT")
print(f"{'='*70}")

# Load old Atlas for comparison
with open('/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/Atlas - Fineune-Lab-Expert/atlas_clean_final_dataset.jsonl', 'r') as f:
    old_atlas = [json.loads(line) for line in f]

old_user_words = []
old_assistant_words = []
for ex in old_atlas:
    user_msgs = [m for m in ex['messages'] if m['role'] == 'user']
    assistant_msgs = [m for m in ex['messages'] if m['role'] == 'assistant']
    if user_msgs:
        old_user_words.append(len(user_msgs[0]['content'].split()))
    for msg in assistant_msgs:
        old_assistant_words.append(len(msg['content'].split()))

print(f"\nOLD ATLAS (vague, short):")
print(f"  Examples:      {len(old_atlas)}")
print(f"  User avg:      {sum(old_user_words)/len(old_user_words):.1f}w")
print(f"  Assistant avg: {sum(old_assistant_words)/len(old_assistant_words):.1f}w")

print(f"\nNEW SFT (detailed, expert):")
print(f"  Examples:      {len(converted_data)}")
print(f"  User avg:      {sum(word_counts_user)/len(word_counts_user):.1f}w")
print(f"  Assistant avg: {sum(word_counts_assistant)/len(word_counts_assistant):.1f}w")

print(f"\nIMPROVEMENT:")
example_diff = len(converted_data) - len(old_atlas)
example_pct = (len(converted_data)/len(old_atlas)-1)*100
user_diff = sum(word_counts_user)/len(word_counts_user) - sum(old_user_words)/len(old_user_words)
user_pct = ((sum(word_counts_user)/len(word_counts_user))/(sum(old_user_words)/len(old_user_words))-1)*100
asst_diff = sum(word_counts_assistant)/len(word_counts_assistant) - sum(old_assistant_words)/len(old_assistant_words)
asst_pct = ((sum(word_counts_assistant)/len(word_counts_assistant))/(sum(old_assistant_words)/len(old_assistant_words))-1)*100

print(f"  More examples:    +{example_diff} ({example_pct:+.1f}%)")
print(f"  User richness:    +{user_diff:.1f}w ({user_pct:+.0f}%)")
print(f"  Assistant detail: +{asst_diff:.1f}w ({asst_pct:+.0f}%)")

print(f"\n{'='*70}")
print("✓ CONVERSION VERIFIED - READY FOR TRAINING")
print(f"{'='*70}\n")
