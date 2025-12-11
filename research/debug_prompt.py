#!/usr/bin/env python3
"""Debug what prompts we're actually sending"""

import sys
sys.path.insert(0, '.')
from production_dpo_generator import create_user_message
import random

print("="*70)
print("DEBUGGING ACTUAL PROMPTS SENT TO MODEL")
print("="*70)

# Set seed for reproducibility
random.seed(42)

# Generate 10 sample messages
for i in range(1, 11):
    msg = create_user_message(i)

    # Extract the required persona and scenario
    lines = msg.split('\n')

    print(f"\n--- Batch {i} ---")
    for line in lines:
        if 'REQUIRED PERSONA' in line or 'REQUIRED SCENARIO' in line or line.startswith('- '):
            print(line)
