#!/usr/bin/env python3
import json

input_file = 'output/combined_training_data.jsonl'

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Track changes
changes = []

# Line-by-line replacements
for i in range(len(lines)):
    original_line = lines[i]
    modified = original_line
    
    # Replace specific phrases
    modified = modified.replace('are aggregated into dashboards.', 'are aggregated in the analytics page.')
    modified = modified.replace('into dashboards that reveal patterns', 'in the analytics page that reveal patterns')
    modified = modified.replace('build custom dashboards for every question', 'create custom analytics views for every question')
    modified = modified.replace('same underlying data as the detailed dashboards', 'same underlying data as the analytics page')
    modified = modified.replace('same data powering dashboards', 'same data powering the analytics page')
    modified = modified.replace('same data powering your detailed dashboards', 'same data powering your analytics page')
    modified = modified.replace('see on the dashboard?', 'see in the analytics page?')
    modified = modified.replace('custom analytics dashboards with', 'custom analytics views with')
    modified = modified.replace('in the dashboard showing the estimated', 'in the analytics showing the estimated')
    
    if modified != original_line:
        changes.append((i+1, 'Updated'))
        lines[i] = modified

# Write back
with open(input_file, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"✅ Updated {len(changes)} lines")
for line_num, change in changes:
    print(f"  Line {line_num}: {change}")
