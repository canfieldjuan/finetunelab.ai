#!/usr/bin/env python3
"""Analyze token distribution for fine-tuning max length determination."""

import json

# Read all token data
input_file = r'C:\Users\Juan\Desktop\Dev_Ops\web-ui\output\batch_6906407ba5648190864a426d6d8bc87e_output.jsonl'

completion_tokens = []
prompt_tokens = []

with open(input_file, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line.strip())
        usage = data.get('response', {}).get('body', {}).get('usage')
        if usage:
            completion_tokens.append(usage['completion_tokens'])
            prompt_tokens.append(usage['prompt_tokens'])

total_tokens = [p + c for p, c in zip(prompt_tokens, completion_tokens)]

print("=" * 80)
print("TOKEN DISTRIBUTION ANALYSIS FOR FINE-TUNING")
print("=" * 80)

print("\n=== COMPLETION TOKENS (Assistant Output) ===")
print(f"Average: {sum(completion_tokens)/len(completion_tokens):.0f} tokens")
print(f"90th percentile: {sorted(completion_tokens)[int(len(completion_tokens)*0.90)]} tokens")
print(f"95th percentile: {sorted(completion_tokens)[int(len(completion_tokens)*0.95)]} tokens")
print(f"99th percentile: {sorted(completion_tokens)[int(len(completion_tokens)*0.99)]} tokens")
print(f"Max: {max(completion_tokens)} tokens")

print("\n=== PROMPT TOKENS (User Input) ===")
print(f"Average: {sum(prompt_tokens)/len(prompt_tokens):.0f} tokens")
print(f"90th percentile: {sorted(prompt_tokens)[int(len(prompt_tokens)*0.90)]} tokens")
print(f"95th percentile: {sorted(prompt_tokens)[int(len(prompt_tokens)*0.95)]} tokens")
print(f"Max: {max(prompt_tokens)} tokens")

print("\n=== TOTAL TOKENS (Prompt + Completion) ===")
print(f"Average: {sum(total_tokens)/len(total_tokens):.0f} tokens")
print(f"90th percentile: {sorted(total_tokens)[int(len(total_tokens)*0.90)]} tokens")
print(f"95th percentile: {sorted(total_tokens)[int(len(total_tokens)*0.95)]} tokens")
print(f"99th percentile: {sorted(total_tokens)[int(len(total_tokens)*0.99)]} tokens")
print(f"Max: {max(total_tokens)} tokens")

# Check how many hit the ceiling
print("\n=== RESPONSES HITTING MAX COMPLETION LENGTH ===")
max_8k = len([t for t in completion_tokens if t == 8192])
max_7k = len([t for t in completion_tokens if t >= 7000])
max_6k = len([t for t in completion_tokens if t >= 6000])
max_5k = len([t for t in completion_tokens if t >= 5000])

print(f"8192 tokens (exact max): {max_8k} ({max_8k/len(completion_tokens)*100:.1f}%)")
print(f"7000+ tokens: {max_7k} ({max_7k/len(completion_tokens)*100:.1f}%)")
print(f"6000+ tokens: {max_6k} ({max_6k/len(completion_tokens)*100:.1f}%)")
print(f"5000+ tokens: {max_5k} ({max_5k/len(completion_tokens)*100:.1f}%)")

print("\n" + "=" * 80)
print("RECOMMENDATION FOR FINE-TUNING MAX LENGTH")
print("=" * 80)

if max_8k > len(completion_tokens) * 0.05:  # More than 5% hit max
    print(f"\n[!] WARNING: {max_8k/len(completion_tokens)*100:.1f}% of responses hit 8192 token limit")
    print("    These responses were likely TRUNCATED during generation.")
    print("\n[RECOMMENDATION] Increase max_tokens to at least 12,000-16,000")
    print("    This ensures responses can complete naturally without truncation.")
elif max_7k > len(completion_tokens) * 0.10:  # More than 10% near max
    print(f"\n[!] CAUTION: {max_7k/len(completion_tokens)*100:.1f}% of responses exceed 7000 tokens")
    print("    Current 8192 limit is tight for longer responses.")
    print("\n[RECOMMENDATION] Consider increasing max_tokens to 10,000-12,000")
    print("    This gives headroom for natural response variation.")
else:
    print(f"\n[OK] Only {max_8k/len(completion_tokens)*100:.1f}% hit max length")
    print("    Current 8192 token limit appears adequate for most responses.")
    print("\n[RECOMMENDATION] Keep current max_tokens (8192) or increase to 10,000 for safety")

# Common fine-tuning context windows
print("\n=== COMMON FINE-TUNING CONTEXT WINDOWS ===")
print("GPT-3.5-turbo: 4,096 tokens (total) - TOO SMALL for this data")
print("GPT-3.5-turbo-16k: 16,384 tokens (total) - ADEQUATE")
print("GPT-4: 8,192 tokens (total) - TIGHT, may truncate some responses")
print("GPT-4-32k: 32,768 tokens (total) - PLENTY of headroom")
print("GPT-4-turbo: 128,000 tokens (total) - MASSIVE headroom")
print("Llama 3: 8,192 tokens (default) - TIGHT")
print("Llama 3.1: 128,000 tokens - PLENTY of headroom")

print("\n" + "=" * 80)
