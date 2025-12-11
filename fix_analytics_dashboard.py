import json

input_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl'
output_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl.tmp'

with open(input_file, 'r', encoding='utf-8') as infile, open(output_file, 'w', encoding='utf-8') as outfile:
    for line in infile:
        # Replace "analytics dashboard" with "analytics page"
        line = line.replace('analytics dashboard', 'analytics page')
        # Also replace capitalized versions
        line = line.replace('Analytics dashboard', 'Analytics page')
        line = line.replace('Analytics Dashboard', 'Analytics Page')
        outfile.write(line)

# Replace original file
import os
os.replace(output_file, input_file)
print("Replaced all 'analytics dashboard' with 'analytics page'")
