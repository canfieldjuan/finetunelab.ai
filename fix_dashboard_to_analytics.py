import json

input_file = '/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl'
output_file = input_file

with open(input_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replacements to make
replacements = [
    ('aggregated into dashboards', 'aggregated in the analytics page'),
    ('build custom dashboards', 'create custom analytics views'),
    ('into dashboards that reveal', 'in the analytics page that reveal'),
    ('detailed dashboards', 'analytics page'),
    ('powering dashboards', 'powering the analytics page'),
    ('same data powering your detailed dashboards', 'same data powering your analytics page'),
    ('on the dashboard', 'in the analytics page'),
    ('see on the dashboard', 'see in the analytics page'),
    ('customize what metrics I see on the dashboard', 'customize what metrics I see in the analytics page'),
    ('custom analytics dashboards', 'custom analytics views'),
    ('in the dashboard showing', 'in the analytics showing'),
]

updated_count = 0
for i, line in enumerate(lines):
    original = line
    for old, new in replacements:
        if old in line:
            line = line.replace(old, new)
            if line != original:
                print(f"✓ Updated line {i+1}: {old} → {new}")
                updated_count += 1
                original = line

    lines[i] = line

with open(output_file, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"\n✅ Complete! Updated {updated_count} references from dashboard to analytics page.")
