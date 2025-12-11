#!/usr/bin/env python3
"""
Remove conflicting examples that incorrectly claim FineTune Lab integrates 
with Lambda Labs, Kaggle, AWS, and GCP.
"""

import json

# Lines to remove (these claim false integrations)
LINES_TO_REMOVE = {48, 99, 100, 103, 104, 105, 116, 814, 815, 816, 817}

input_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl'
output_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data_cleaned.jsonl'

removed_count = 0
kept_count = 0

with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
    for line_num, line in enumerate(infile, 1):
        if line_num in LINES_TO_REMOVE:
            removed_count += 1
            print(f"Removed line {line_num}")
        else:
            outfile.write(line)
            kept_count += 1

print(f"\n✅ Done!")
print(f"Removed: {removed_count} lines")
print(f"Kept: {kept_count} lines")
print(f"Output: {output_file}")
