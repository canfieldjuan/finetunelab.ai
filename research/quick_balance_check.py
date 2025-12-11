#!/usr/bin/env python3
"""Quick balance check for DPO dataset"""

import json
import sys
from collections import Counter

if len(sys.argv) < 2:
    print("Usage: python3 quick_balance_check.py <dataset.json>")
    sys.exit(1)

with open(sys.argv[1], 'r') as f:
    data = json.load(f)

print(f"\n{'='*70}")
print(f"DATASET BALANCE ANALYSIS - {len(data)} examples")
print(f"{'='*70}\n")

# Analyze prompts for scenario types
scenarios = {
    'how_to': 0,
    'troubleshooting': 0,
    'failure': 0,
    'edge_case': 0
}

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

    # Detect scenarios
    if any(phrase in prompt_lower for phrase in ['how do i', 'how can i', 'how to', 'what\'s the best way']):
        scenarios['how_to'] += 1
    elif any(phrase in prompt_lower for phrase in ['not working', 'doesn\'t work', 'isn\'t working', 'won\'t', 'error', 'issue', 'problem']):
        scenarios['troubleshooting'] += 1
    elif any(phrase in prompt_lower for phrase in ['broke', 'failed', 'crash', 'failing']):
        scenarios['failure'] += 1
    else:
        scenarios['edge_case'] += 1

    # Detect personas
    if any(phrase in prompt_lower for phrase in ['intern', 'new to', 'first time', 'beginner']):
        personas['ml_intern'] += 1
    elif any(phrase in prompt_lower for phrase in ['ceo', 'non-technical', 'executive']):
        personas['ceo'] += 1
    elif any(phrase in prompt_lower for phrase in ['enterprise', 'company-wide', 'organization']):
        personas['enterprise'] += 1
    elif any(phrase in prompt_lower for phrase in ['agency', 'consultant', 'client']):
        personas['agency'] += 1
    elif any(phrase in prompt_lower for phrase in ['frustrated', 'tried everything', 'still not']):
        personas['frustrated'] += 1
    elif any(phrase in prompt_lower for phrase in ['data scientist', 'team of']):
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
