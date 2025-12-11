import json
import re

input_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl'
output_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl.tmp'

# Patterns to exclude (technical code examples, correct usage)
exclude_patterns = [
    r'dashboard\.add_',  # Code like dashboard.add_chart
    r'create_dashboard',  # Function names in code
    r'no.*dashboard',  # "no dashboard" explanations
    r'No.*dashboard',
    r'there.*is.*no.*dashboard',
    r'There.*is.*no.*dashboard',
    r"isn't.*dashboard",
    r"doesn't.*have.*dashboard",
]

def should_replace(line):
    """Check if this line should have dashboard replaced"""
    for pattern in exclude_patterns:
        if re.search(pattern, line, re.IGNORECASE):
            return False
    return True

with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8') as outfile:
    for line in infile:
        if 'dashboard' in line.lower() and should_replace(line):
            # Replace dashboard with analytics in various forms
            line = re.sub(r'\bdashboard\b', 'analytics', line)
            line = re.sub(r'\bDashboard\b', 'Analytics', line)
        outfile.write(line)

# Replace original file
import os
os.replace(output_file, input_file)
print("Replaced 'dashboard' with 'analytics' where appropriate")
