#!/usr/bin/env python3
"""Properly fixed balance check - look at last sentence of prompts"""

import json
import sys

if len(sys.argv) < 2:
    print("Usage: python3 truly_fixed_balance.py <dataset.json>")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

print(f"\n{'='*70}")
print(f"PROPERLY FIXED BALANCE - {len(data)} examples")
print(f"{'='*70}\n")

scenarios = {'how_to': 0, 'troubleshooting': 0, 'failure': 0, 'edge_case': 0}

for ex in data:
    prompt = ex['prompt']

    # Get last 200 chars where the question usually is
    ending = prompt[-200:].lower()

    # Check for explicit problem statements first
    has_explicit_problem = any(phrase in prompt.lower() for phrase in [
        'not working', 'doesn\'t work', 'isn\'t working', 'won\'t work',
        'giving unexpected', 'getting errors', 'results are confusing',
        'i tried', 'i ran', 'i trained', 'i tested',
        'broke', 'failed', 'crash', 'failing',
        'stuck', 'confused', 'frustrat'
    ])

    # If there's a clear problem described, it's troubleshooting or failure
    if has_explicit_problem:
        if any(word in prompt.lower() for word in ['broke', 'crashed', 'failed', 'failing']):
            scenarios['failure'] += 1
        else:
            scenarios['troubleshooting'] += 1
    # If it asks "how do I" or "how can I" without a problem context, it's how-to
    elif any(phrase in ending for phrase in ['how do i', 'how can i', 'how to', 'what\'s the best way to', 'how should i']):
        scenarios['how_to'] += 1
    # If it mentions edge cases, rare situations, unusual scenarios
    elif any(phrase in prompt.lower() for phrase in ['edge case', 'unusual', 'rare', 'uncommon', 'special case']):
        scenarios['edge_case'] += 1
    else:
        # Default to how-to for unclear cases
        scenarios['how_to'] += 1

print("SCENARIO DISTRIBUTION:")
print(f"  How-to:          {scenarios['how_to']:4d} ({scenarios['how_to']/len(data)*100:5.1f}%)  [Target: 40%]")
print(f"  Troubleshooting: {scenarios['troubleshooting']:4d} ({scenarios['troubleshooting']/len(data)*100:5.1f}%)  [Target: 30%]")
print(f"  Failure:         {scenarios['failure']:4d} ({scenarios['failure']/len(data)*100:5.1f}%)  [Target: 20%]")
print(f"  Edge case:       {scenarios['edge_case']:4d} ({scenarios['edge_case']/len(data)*100:5.1f}%)  [Target: 10%]")

# Persona detection
personas = {
    'solo_dev': 0,
    'ml_intern': 0,
    'ceo': 0,
    'enterprise': 0,
    'agency': 0,
    'frustrated': 0,
    'data_scientist': 0
}

for ex in data:
    prompt_lower = ex['prompt'].lower()

    if any(phrase in prompt_lower for phrase in ['intern', 'new to', 'first time', 'first job', 'first real', 'nervous']):
        personas['ml_intern'] += 1
    elif any(phrase in prompt_lower for phrase in ['ceo', 'non-technical', 'executive', 'don\'t code', 'board meeting']):
        personas['ceo'] += 1
    elif any(phrase in prompt_lower for phrase in ['enterprise', 'company-wide', 'organization']):
        personas['enterprise'] += 1
    elif any(phrase in prompt_lower for phrase in ['agency', 'consultant', 'client', 'multiple clients']):
        personas['agency'] += 1
    elif any(phrase in prompt_lower for phrase in ['frustrated', 'tried everything', 'still not', 'stuck']):
        personas['frustrated'] += 1
    elif any(phrase in prompt_lower for phrase in ['data scientist', 'team of', 'ml team']):
        personas['data_scientist'] += 1
    else:
        personas['solo_dev'] += 1

print("\nPERSONA DISTRIBUTION:")
print(f"  Solo Developer:  {personas['solo_dev']:4d} ({personas['solo_dev']/len(data)*100:5.1f}%)  [Target: 20%]")
print(f"  ML Intern:       {personas['ml_intern']:4d} ({personas['ml_intern']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  CEO:             {personas['ceo']:4d} ({personas['ceo']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Enterprise:      {personas['enterprise']:4d} ({personas['enterprise']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Agency:          {personas['agency']:4d} ({personas['agency']/len(data)*100:5.1f}%)  [Target: 10%]")
print(f"  Frustrated:      {personas['frustrated']:4d} ({personas['frustrated']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Data Scientist:  {personas['data_scientist']:4d} ({personas['data_scientist']/len(data)*100:5.1f}%)  [Target: 10%]")

# Word counts
prompt_words = [len(ex['prompt'].split()) for ex in data]
chosen_words = [len(ex['chosen'].split()) for ex in data]
rejected_words = [len(ex['rejected'].split()) for ex in data]

print(f"\nWORD COUNTS:")
print(f"  Prompts:  {sum(prompt_words)/len(prompt_words):.1f}w avg  [Target: 80-120w]")
print(f"  Chosen:   {sum(chosen_words)/len(chosen_words):.1f}w avg  [Target: 250-300w]")
print(f"  Rejected: {sum(rejected_words)/len(rejected_words):.1f}w avg  [Target: 200-250w]")
print(f"\n{'='*70}\n")
