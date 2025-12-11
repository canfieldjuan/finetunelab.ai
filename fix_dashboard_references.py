import json

# Read the file
with open('/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl', 'r') as f:
    lines = f.readlines()

# Line numbers to update (1-indexed in user request, but 0-indexed in list)
lines_to_update = [43, 56, 62] + list(range(109, 117))

# Convert to 0-indexed
lines_to_update = [i - 1 for i in lines_to_update]

print(f"Updating lines: {[i+1 for i in lines_to_update]}")

# Update each line by replacing "dashboard" with "analytics"
for line_idx in lines_to_update:
    if line_idx < len(lines):
        original = lines[line_idx]
        # Replace dashboard with analytics (case-sensitive)
        updated = original.replace('dashboard', 'analytics').replace('Dashboard', 'Analytics')
        
        if original != updated:
            lines[line_idx] = updated
            print(f"✓ Updated line {line_idx + 1}")
        else:
            print(f"⚠ No 'dashboard' found in line {line_idx + 1}")

# Write back to file
with open('/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl', 'w') as f:
    f.writelines(lines)

print("\n✅ Complete! All dashboard references changed to analytics in specified lines.")
