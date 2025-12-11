#!/usr/bin/env python3
"""
Combine all Atlas SFT datasets into final training dataset.

Sources:
1. Single-turn SFT (from DPO conversion): 4,484 examples
2. Multi-turn SFT (new): 899 examples
Total: 5,383 examples
"""

import json
from pathlib import Path
from datetime import datetime
import random

def load_jsonl(file_path):
    """Load JSONL file."""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                data.append(json.loads(line))
    return data

def save_jsonl(data, file_path):
    """Save data as JSONL."""
    with open(file_path, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

def save_json(data, file_path):
    """Save data as formatted JSON."""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print("="*80)
print("COMBINING ALL ATLAS SFT DATASETS")
print("="*80)
print()

# Define paths
research_dir = Path(__file__).parent
atlas_output_dir = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/Atlas - Fineune-Lab-Expert")

# 1. Load single-turn SFT (from DPO conversion)
single_turn_path = atlas_output_dir / "atlas_clean_final_dataset.jsonl"
print(f"Loading single-turn SFT data from: {single_turn_path}")
single_turn_data = load_jsonl(single_turn_path)
print(f"  ✓ Loaded {len(single_turn_data):,} single-turn examples")
print()

# 2. Load multi-turn SFT (new generation)
multi_turn_path = research_dir / "multiturn_sft_output" / "multiturn_sft_899_20251125_234453.jsonl"
print(f"Loading multi-turn SFT data from: {multi_turn_path}")
multi_turn_data = load_jsonl(multi_turn_path)
print(f"  ✓ Loaded {len(multi_turn_data):,} multi-turn examples")
print()

# Validate structure
print("Validating data structure...")
for i, example in enumerate(single_turn_data[:3]):
    if 'messages' not in example:
        print(f"  ✗ Single-turn example {i} missing 'messages' field!")
        break
else:
    print(f"  ✓ Single-turn examples valid")

for i, example in enumerate(multi_turn_data[:3]):
    if 'messages' not in example:
        print(f"  ✗ Multi-turn example {i} missing 'messages' field!")
        break
else:
    print(f"  ✓ Multi-turn examples valid")
print()

# Combine datasets
print("Combining datasets...")
combined_data = single_turn_data + multi_turn_data
print(f"  ✓ Total examples: {len(combined_data):,}")
print()

# Shuffle for better training distribution
print("Shuffling combined dataset...")
random.seed(42)  # For reproducibility
random.shuffle(combined_data)
print(f"  ✓ Shuffled")
print()

# Analyze combined dataset
print("="*80)
print("COMBINED DATASET ANALYSIS")
print("="*80)
print()

# Count turns
turn_distribution = {}
for example in combined_data:
    messages = example.get('messages', [])
    num_messages = len(messages)

    # Calculate turns (subtract 1 for system message if present)
    has_system = any(m.get('role') == 'system' for m in messages)
    num_user_assistant = num_messages - (1 if has_system else 0)

    # Turns = pairs of user/assistant (so divide by 2)
    turns = num_user_assistant // 2

    turn_distribution[turns] = turn_distribution.get(turns, 0) + 1

print("Turn distribution:")
for turns, count in sorted(turn_distribution.items()):
    print(f"  {turns}-turn: {count:,} examples ({count/len(combined_data)*100:.1f}%)")
print()

# Count sources
sources = {}
for example in combined_data:
    metadata = example.get('metadata', {})
    source = metadata.get('source', 'unknown')
    sources[source] = sources.get(source, 0) + 1

print("Source distribution:")
for source, count in sorted(sources.items(), key=lambda x: x[1], reverse=True):
    print(f"  {source}: {count:,} ({count/len(combined_data)*100:.1f}%)")
print()

# Save combined dataset
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
output_jsonl = atlas_output_dir / f"atlas_sft_combined_{len(combined_data)}_{timestamp}.jsonl"
output_json = atlas_output_dir / f"atlas_sft_combined_{len(combined_data)}_{timestamp}.json"

print("="*80)
print("SAVING COMBINED DATASET")
print("="*80)
print()

print(f"Saving JSONL to: {output_jsonl}")
save_jsonl(combined_data, output_jsonl)
print(f"  ✓ Saved {len(combined_data):,} examples")
print()

print(f"Saving JSON to: {output_json}")
save_json(combined_data, output_json)
print(f"  ✓ Saved {len(combined_data):,} examples")
print()

# Create a backup of the old single-turn file
print("Creating backup of old dataset...")
backup_path = atlas_output_dir / f"atlas_clean_final_dataset_BEFORE_MULTITURN_BACKUP_{timestamp}.jsonl"
import shutil
shutil.copy(single_turn_path, backup_path)
print(f"  ✓ Backup saved to: {backup_path}")
print()

# Replace old file with combined dataset
print("Replacing old dataset with combined dataset...")
save_jsonl(combined_data, single_turn_path)
print(f"  ✓ Updated: {single_turn_path}")
print(f"  ✓ Now contains {len(combined_data):,} examples (was {len(single_turn_data):,})")
print()

print("="*80)
print("✓ COMPLETE")
print("="*80)
print()
print(f"Final Atlas SFT Dataset:")
print(f"  Total examples: {len(combined_data):,}")
print(f"  Single-turn: {len(single_turn_data):,}")
print(f"  Multi-turn: {len(multi_turn_data):,}")
print()
print(f"Files created:")
print(f"  1. {output_jsonl}")
print(f"  2. {output_json}")
print(f"  3. {single_turn_path} (updated)")
print(f"  4. {backup_path} (backup)")
print()
print("="*80)
