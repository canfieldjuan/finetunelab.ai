#!/usr/bin/env python3
"""
Remove ALL examples that incorrectly claim integration with Lambda Labs, Kaggle, AWS, GCP.
Keep only examples that correctly state we DON'T support these providers.
"""

import json
import re

input_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl'
output_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data_final.jsonl'

removed_count = 0
kept_count = 0
removed_lines = []

# Patterns that indicate FALSE integration claims (remove these)
FALSE_INTEGRATION_PATTERNS = [
    r'multi-cloud providers.*RunPod, AWS, GCP',
    r'RunPod, AWS, and GCP.*with their GPU types',
    r'switch providers.*RunPod, AWS, GCP',
    r'Lambda Labs.*fast deployment.*on-demand',
    r'Kaggle.*free tier.*30 hours',
    r'Choose from:.*Lambda Labs',
    r'Option B: Lambda Labs',
    r'Option C: Kaggle',
    r'Cloud Training.*RunPod, Lambda Labs',
    r'RunPod/Lambda/Kaggle',
    r'aws events put-rule.*finetuning',
    r'CloudWatch.*finetuning',
    r'S3.*checkpoint.*training',
    r'EventBridge.*training',
    r'Lambda.*orchestrator',
    r'works fine.*RunPod, Lambda, Kaggle',
    r'RunPod/Lambda API key',
    r'Deploy to cloud:.*RunPod/Lambda/Kaggle'
]

# Patterns that indicate CORRECT "not supported" statements (keep these)
CORRECT_NOT_SUPPORTED_PATTERNS = [
    r"doesn't support.*Lambda Labs",
    r"doesn't support.*AWS",
    r"doesn't support.*GCP",
    r"does not integrate with AWS",
    r"does not integrate with.*Google Cloud",
    r"not supported.*GCP",
    r"don't support.*AWS, Azure, Google Cloud, Lambda Labs",
    r"exclusively.*RunPod",
    r"only.*RunPod"
]

with open(input_file, 'r') as infile, open(output_file, 'w') as outfile:
    for line_num, line in enumerate(infile, 1):
        try:
            data = json.loads(line)
            content = json.dumps(data).lower()
            
            # Check if this line has a CORRECT "not supported" statement
            is_correct_statement = any(re.search(pattern, content, re.IGNORECASE) 
                                      for pattern in CORRECT_NOT_SUPPORTED_PATTERNS)
            
            # Check if this line has FALSE integration claim
            has_false_claim = any(re.search(pattern, content, re.IGNORECASE) 
                                 for pattern in FALSE_INTEGRATION_PATTERNS)
            
            # Keep if: no false claims OR it's a correct "not supported" statement
            if not has_false_claim or is_correct_statement:
                outfile.write(line)
                kept_count += 1
            else:
                removed_count += 1
                removed_lines.append(line_num)
                if removed_count <= 5:  # Show first 5 removed examples
                    msg = data['messages'][0]['content'] if 'messages' in data else 'Unknown'
                    print(f"Removed line {line_num}: {msg[:80]}...")
                    
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON on line {line_num}")
            kept_count += 1
            outfile.write(line)

print(f"\n✅ Done!")
print(f"Removed: {removed_count} lines with false integration claims")
print(f"Kept: {kept_count} lines")
print(f"Removed line numbers: {removed_lines}")
print(f"Output: {output_file}")
