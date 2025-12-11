#!/usr/bin/env python3
"""Analyze the existing Atlas SFT dataset to compare with our DPO dataset"""

import json
import random

print("="*70)
print("ATLAS DATASET ANALYSIS")
print("="*70)

# Load the dataset
with open('/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/Atlas - Fineune-Lab-Expert/atlas_clean_final_dataset.jsonl', 'r') as f:
    data = [json.loads(line) for line in f]

print(f"\nTotal examples: {len(data)}")

# Analyze structure
single_turn = 0
multi_turn = 0
word_counts_user = []
word_counts_assistant = []
all_assistant_responses = []

for ex in data:
    messages = ex['messages']

    # Count turns (exclude system message)
    user_msgs = [m for m in messages if m['role'] == 'user']
    assistant_msgs = [m for m in messages if m['role'] == 'assistant']

    if len(user_msgs) == 1:
        single_turn += 1
    else:
        multi_turn += 1

    # Word counts for first exchange
    if user_msgs:
        word_counts_user.append(len(user_msgs[0]['content'].split()))

    if assistant_msgs:
        for msg in assistant_msgs:
            word_counts_assistant.append(len(msg['content'].split()))
            all_assistant_responses.append(msg['content'])

print(f"\nTURN STRUCTURE:")
print(f"  Single-turn: {single_turn} ({single_turn/len(data)*100:.1f}%)")
print(f"  Multi-turn:  {multi_turn} ({multi_turn/len(data)*100:.1f}%)")

print(f"\nWORD COUNTS:")
print(f"  User prompts:     {min(word_counts_user)}-{max(word_counts_user)}w (avg: {sum(word_counts_user)/len(word_counts_user):.1f}w)")
print(f"  Assistant:        {min(word_counts_assistant)}-{max(word_counts_assistant)}w (avg: {sum(word_counts_assistant)/len(word_counts_assistant):.1f}w)")

# Check for formatting features in assistant responses
has_numbered = sum(1 for r in all_assistant_responses if any(x in r for x in ['**1.', '1. **', '**Step']))
has_bold = sum(1 for r in all_assistant_responses if '**' in r)
has_code = sum(1 for r in all_assistant_responses if '```' in r)
has_tips = sum(1 for r in all_assistant_responses if 'Pro Tip' in r or 'Tip:' in r)

total_responses = len(all_assistant_responses)
print(f"\nASSISTANT RESPONSE FEATURES:")
print(f"  Numbered steps:  {has_numbered}/{total_responses} ({has_numbered/total_responses*100:.1f}%)")
print(f"  Bold formatting: {has_bold}/{total_responses} ({has_bold/total_responses*100:.1f}%)")
print(f"  Code blocks:     {has_code}/{total_responses} ({has_code/total_responses*100:.1f}%)")
print(f"  Tips/Pro Tips:   {has_tips}/{total_responses} ({has_tips/total_responses*100:.1f}%)")

# Check for vagueness indicators
vague_count = 0
for resp in all_assistant_responses:
    resp_lower = resp.lower()
    if any(phrase in resp_lower for phrase in [
        'according to', 'knowledge base', 'source:',
        'documentation', 'not provided', 'not included',
        "i don't have", "isn't specified", "not specified"
    ]):
        vague_count += 1

print(f"\nVAGUENESS INDICATORS:")
print(f"  Responses citing sources: {vague_count}/{total_responses} ({vague_count/total_responses*100:.1f}%)")

# Sample 5 random examples
print(f"\n{'='*70}")
print("SAMPLE EXAMPLES")
print(f"{'='*70}")

random.seed(42)
samples = random.sample(data, 5)

for i, ex in enumerate(samples, 1):
    print(f"\n--- EXAMPLE {i} ---")
    messages = ex['messages']

    for msg in messages:
        if msg['role'] == 'user':
            print(f"User ({len(msg['content'].split())}w): {msg['content'][:150]}...")
        elif msg['role'] == 'assistant':
            print(f"Assistant ({len(msg['content'].split())}w): {msg['content'][:200]}...")

print(f"\n{'='*70}")
print("COMPARISON WITH DPO DATASET")
print(f"{'='*70}")

print("\nATLAS (SFT) vs DPO Dataset:")
print(f"  Atlas examples:    {len(data)}")
print(f"  DPO examples:      4,484")
print(f"  ")
print(f"  Atlas user avg:    {sum(word_counts_user)/len(word_counts_user):.1f}w")
print(f"  DPO prompt avg:    ~100w (target: 80-120w)")
print(f"  ")
print(f"  Atlas assistant:   {sum(word_counts_assistant)/len(word_counts_assistant):.1f}w")
print(f"  DPO chosen:        ~280w (target: 250-300w)")
print(f"  DPO rejected:      ~230w (target: 200-250w)")
print(f"  ")
print(f"  Atlas multi-turn:  {multi_turn/len(data)*100:.1f}%")
print(f"  DPO multi-turn:    0% (single-turn only)")

print(f"\n{'='*70}\n")
