#!/usr/bin/env python3
"""Analyze the Tulu-3 SFT personas instruction-following dataset."""

import pandas as pd
import json
from pathlib import Path
from collections import Counter

# Read the parquet file
parquet_path = "/home/juan-canfield/Desktop/web-ui/output/completed_datasets/SFT-datasets/datasets--allenai--tulu-3-sft-personas-instruction-following/snapshots/fe0c7d350c9b4542b8d829a6f1daa1c259f0ba0e/data/train-00000-of-00001.parquet"

print("="*80)
print("TULU-3 SFT PERSONAS INSTRUCTION-FOLLOWING DATASET ANALYSIS")
print("="*80)
print()

df = pd.read_parquet(parquet_path)

print(f"Total examples: {len(df):,}")
print(f"Columns: {list(df.columns)}")
print()

# Show first example structure
print("="*80)
print("EXAMPLE STRUCTURE (First Example):")
print("="*80)
first_example = df.iloc[0]
for col in df.columns:
    value = first_example[col]
    if isinstance(value, (list, dict)):
        print(f"\n{col}:")
        if isinstance(value, list) and len(value) > 0:
            print(f"  Type: list with {len(value)} items")
            if isinstance(value[0], dict):
                print(f"  First item keys: {list(value[0].keys())}")
                print(f"  First item: {json.dumps(value[0], indent=2)[:200]}...")
        else:
            print(f"  {json.dumps(value, indent=2)[:200]}...")
    else:
        print(f"{col}: {str(value)[:100]}")
print()

# Check if it has 'messages' field (SFT format)
if 'messages' in df.columns:
    print("="*80)
    print("MESSAGE ANALYSIS:")
    print("="*80)

    # Count turns (number of message exchanges)
    turn_counts = []
    role_distributions = Counter()

    for idx, row in df.iterrows():
        messages = row['messages']
        if isinstance(messages, list):
            turn_counts.append(len(messages))
            for msg in messages:
                if isinstance(msg, dict) and 'role' in msg:
                    role_distributions[msg['role']] += 1

    turn_counter = Counter(turn_counts)
    print(f"Turn distribution (total messages per example):")
    for turns, count in sorted(turn_counter.items())[:10]:
        print(f"  {turns} messages: {count:,} examples ({count/len(df)*100:.1f}%)")

    print()
    print(f"Role distribution:")
    for role, count in role_distributions.most_common():
        print(f"  {role}: {count:,}")
    print()

    # Sample a few examples
    print("="*80)
    print("SAMPLE EXAMPLES (First 3):")
    print("="*80)
    for idx in range(min(3, len(df))):
        example = df.iloc[idx]
        print(f"\n--- Example {idx+1} ---")
        messages = example['messages']
        print(f"Total messages: {len(messages)}")
        for i, msg in enumerate(messages[:6]):  # Show first 6 messages
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            print(f"  [{i+1}] {role}: {content[:100]}...")
        if len(messages) > 6:
            print(f"  ... and {len(messages)-6} more messages")
        print()

# Check for persona/category fields
print("="*80)
print("METADATA ANALYSIS:")
print("="*80)

for col in df.columns:
    if col not in ['messages', 'id']:
        unique_values = df[col].nunique()
        print(f"{col}: {unique_values} unique values")
        if unique_values < 50:
            value_counts = df[col].value_counts()
            print(f"  Top values:")
            for val, count in value_counts.head(10).items():
                print(f"    {val}: {count} ({count/len(df)*100:.1f}%)")
        print()

# Calculate average lengths
print("="*80)
print("CONTENT LENGTH ANALYSIS:")
print("="*80)

if 'messages' in df.columns:
    user_lengths = []
    assistant_lengths = []

    for idx, row in df.iterrows():
        messages = row['messages']
        if isinstance(messages, list):
            for msg in messages:
                if isinstance(msg, dict):
                    role = msg.get('role', '')
                    content = msg.get('content', '')
                    word_count = len(content.split())

                    if role == 'user':
                        user_lengths.append(word_count)
                    elif role == 'assistant':
                        assistant_lengths.append(word_count)

    if user_lengths:
        print(f"User message lengths (words):")
        print(f"  Average: {sum(user_lengths)/len(user_lengths):.1f}")
        print(f"  Median: {sorted(user_lengths)[len(user_lengths)//2]}")
        print(f"  Min: {min(user_lengths)}")
        print(f"  Max: {max(user_lengths)}")
        print()

    if assistant_lengths:
        print(f"Assistant message lengths (words):")
        print(f"  Average: {sum(assistant_lengths)/len(assistant_lengths):.1f}")
        print(f"  Median: {sorted(assistant_lengths)[len(assistant_lengths)//2]}")
        print(f"  Min: {min(assistant_lengths)}")
        print(f"  Max: {max(assistant_lengths)}")
        print()

print("="*80)
print("RECOMMENDATION FOR YOUR ATLAS SFT TRAINING:")
print("="*80)
print()
print("This is Tulu-3's persona-based instruction-following dataset.")
print()
print("PROS:")
print("  ✓ High-quality instruction-following examples")
print("  ✓ Diverse personas and tasks")
print("  ✓ Well-formatted SFT data (messages format)")
print()
print("CONS:")
print("  ✗ Generic instruction-following (not FineTune Lab specific)")
print("  ✗ May dilute Atlas's domain expertise")
print("  ✗ Different style/tone than your FineTune Lab examples")
print()
print("RECOMMENDATION:")
print("  • AVOID mixing - Keep Atlas focused on FineTune Lab domain")
print("  • Your custom data (4.5k DPO + 1k multi-turn) is better for Atlas")
print("  • Generic instruction-following may hurt domain specialization")
print("  • If you want to add variety, better to generate MORE FineTune Lab examples")
print()
print("=" * 80)
