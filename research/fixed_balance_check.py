#!/usr/bin/env python3
"""Fixed balance check - properly distinguish how-to from troubleshooting"""

import json
import sys
from collections import Counter

if len(sys.argv) < 2:
    print("Usage: python3 fixed_balance_check.py <dataset.json>")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

print(f"\n{'='*70}")
print(f"FIXED DATASET BALANCE ANALYSIS - {len(data)} examples")
print(f"{'='*70}\n")

# Analyze prompts for scenario types with better logic
scenarios = {
    'how_to': 0,
    'troubleshooting': 0,
    'failure': 0,
    'edge_case': 0
}

for ex in data:
    prompt = ex['prompt']
    prompt_lower = prompt.lower()

    # FIXED LOGIC: Check for problem indicators FIRST
    # These phrases indicate the user already tried something and it's not working
    has_problem = any(phrase in prompt_lower for phrase in [
        'not working', 'doesn\'t work', 'isn\'t working', 'won\'t work',
        'error', 'issue', 'problem', 'weird', 'unexpected', 'confusing', 'wrong',
        'stuck', 'confused', 'frustrated',
        'i tried', 'i ran', 'i trained', 'i tested', 'i started',
        'getting', 'seeing', 'receiving', 'showing'
    ])

    # Check for explicit failure indicators
    has_failure = any(phrase in prompt_lower for phrase in [
        'broke', 'failed', 'crash', 'failing', 'broken'
    ])

    # Check for edge case indicators
    has_edge_case = any(phrase in prompt_lower for phrase in [
        'edge case', 'unusual', 'rare', 'uncommon', 'special case'
    ])

    # Classification logic:
    # 1. Failure indicators = failure scenario
    # 2. Problem indicators = troubleshooting scenario
    # 3. Edge case indicators = edge case scenario
    # 4. Otherwise = how-to scenario

    if has_failure:
        scenarios['failure'] += 1
    elif has_problem:
        scenarios['troubleshooting'] += 1
    elif has_edge_case:
        scenarios['edge_case'] += 1
    else:
        # Clean how-to without problem context
        scenarios['how_to'] += 1

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

    # Detect personas
    if any(phrase in prompt_lower for phrase in ['intern', 'new to', 'first time', 'first job', 'beginner']):
        personas['ml_intern'] += 1
    elif any(phrase in prompt_lower for phrase in ['ceo', 'non-technical', 'executive', 'don\'t code']):
        personas['ceo'] += 1
    elif any(phrase in prompt_lower for phrase in ['enterprise', 'company-wide', 'organization']):
        personas['enterprise'] += 1
    elif any(phrase in prompt_lower for phrase in ['agency', 'consultant', 'client']):
        personas['agency'] += 1
    elif any(phrase in prompt_lower for phrase in ['frustrated', 'tried everything', 'still not', 'stuck']):
        personas['frustrated'] += 1
    elif any(phrase in prompt_lower for phrase in ['data scientist', 'team of', 'ml team']):
        personas['data_scientist'] += 1
    else:
        personas['solo_dev'] += 1

print("SCENARIO DISTRIBUTION:")
print(f"  How-to:          {scenarios['how_to']:3d} ({scenarios['how_to']/len(data)*100:5.1f}%)  [Target: 40%]")
print(f"  Troubleshooting: {scenarios['troubleshooting']:3d} ({scenarios['troubleshooting']/len(data)*100:5.1f}%)  [Target: 30%]")
print(f"  Failure:         {scenarios['failure']:3d} ({scenarios['failure']/len(data)*100:5.1f}%)  [Target: 20%]")
print(f"  Edge case:       {scenarios['edge_case']:3d} ({scenarios['edge_case']/len(data)*100:5.1f}%)  [Target: 10%]")

print("\nPERSONA DISTRIBUTION:")
print(f"  Solo Developer:  {personas['solo_dev']:3d} ({personas['solo_dev']/len(data)*100:5.1f}%)  [Target: 20%]")
print(f"  ML Intern:       {personas['ml_intern']:3d} ({personas['ml_intern']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  CEO:             {personas['ceo']:3d} ({personas['ceo']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Enterprise:      {personas['enterprise']:3d} ({personas['enterprise']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Agency:          {personas['agency']:3d} ({personas['agency']/len(data)*100:5.1f}%)  [Target: 10%]")
print(f"  Frustrated:      {personas['frustrated']:3d} ({personas['frustrated']/len(data)*100:5.1f}%)  [Target: 15%]")
print(f"  Data Scientist:  {personas['data_scientist']:3d} ({personas['data_scientist']/len(data)*100:5.1f}%)  [Target: 10%]")

# Word count check
prompt_words = [len(ex['prompt'].split()) for ex in data]
chosen_words = [len(ex['chosen'].split()) for ex in data]
rejected_words = [len(ex['rejected'].split()) for ex in data]

print(f"\nWORD COUNTS:")
print(f"  Prompts:  {sum(prompt_words)/len(prompt_words):.1f}w avg  [Target: 80-120w]")
print(f"  Chosen:   {sum(chosen_words)/len(chosen_words):.1f}w avg  [Target: 250-300w]")
print(f"  Rejected: {sum(rejected_words)/len(rejected_words):.1f}w avg  [Target: 200-250w]")
print(f"\n{'='*70}\n")
