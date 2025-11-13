"""
Combine multiple ChatML datasets into one mega training dataset.
Handles interleaving, shuffling, and validation.
"""

import json
from pathlib import Path
from typing import List, Dict
import random

def load_jsonl(file_path: str) -> List[Dict]:
    """Load JSONL file into list of dicts."""
    data = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            try:
                data.append(json.loads(line.strip()))
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping line {line_num} in {file_path}: {e}")
    return data

def validate_chatml_format(data: List[Dict], dataset_name: str) -> bool:
    """Validate that dataset is in ChatML format."""
    if not data:
        print(f"Error: {dataset_name} is empty!")
        return False

    sample = data[0]

    # Check for 'messages' field
    if 'messages' not in sample:
        print(f"Error: {dataset_name} missing 'messages' field!")
        print(f"Sample keys: {sample.keys()}")
        return False

    # Check messages structure
    messages = sample['messages']
    if not isinstance(messages, list):
        print(f"Error: {dataset_name} 'messages' is not a list!")
        return False

    if len(messages) == 0:
        print(f"Error: {dataset_name} has empty messages!")
        return False

    # Check first message has required fields
    first_msg = messages[0]
    if 'role' not in first_msg or 'content' not in first_msg:
        print(f"Error: {dataset_name} messages missing 'role' or 'content'!")
        print(f"Message structure: {first_msg.keys()}")
        return False

    print(f"[OK] {dataset_name}: Valid ChatML format ({len(data)} samples)")
    print(f"   Sample roles: {[msg['role'] for msg in messages]}")
    return True

def interleave_datasets(
    datasets: List[List[Dict]],
    probabilities: List[float]
) -> List[Dict]:
    """
    Interleave ALL samples from multiple datasets based on probabilities.
    Uses all samples, weights only control distribution order.
    """
    # Normalize probabilities
    total = sum(probabilities)
    probs = [p / total for p in probabilities]

    # Create shuffled indices for each dataset (use ALL samples)
    indices = [list(range(len(d))) for d in datasets]
    for idx_list in indices:
        random.shuffle(idx_list)

    # Interleave all samples
    result = []
    dataset_positions = [0] * len(datasets)

    # Continue until all datasets are exhausted
    while any(dataset_positions[i] < len(datasets[i]) for i in range(len(datasets))):
        # Calculate remaining samples per dataset
        remaining_counts = [
            len(datasets[i]) - dataset_positions[i]
            for i in range(len(datasets))
        ]

        # Choose dataset weighted by both probability and remaining count
        weights = []
        for i in range(len(datasets)):
            if remaining_counts[i] > 0:
                # Weight by probability * remaining samples
                weights.append(probs[i] * remaining_counts[i])
            else:
                weights.append(0)

        # If all exhausted, break
        if sum(weights) == 0:
            break

        # Weighted random choice
        total_weight = sum(weights)
        rand = random.random() * total_weight
        cumsum = 0
        dataset_idx = 0
        for i, w in enumerate(weights):
            cumsum += w
            if rand < cumsum:
                dataset_idx = i
                break

        # Add sample from chosen dataset
        if dataset_positions[dataset_idx] < len(datasets[dataset_idx]):
            idx = indices[dataset_idx][dataset_positions[dataset_idx]]
            result.append(datasets[dataset_idx][idx])
            dataset_positions[dataset_idx] += 1

    return result

def save_jsonl(data: List[Dict], file_path: str):
    """Save list of dicts to JSONL file."""
    with open(file_path, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')

def main():
    print("=" * 70)
    print("Dataset Combiner for Fine-tuning")
    print("=" * 70)

    # Define datasets - using ALL samples (no downsampling)
    # Weights only affect interleaving distribution, not total count
    datasets_config = [
        {
            "path": "output/completed_datasets/tier1_factual_base_chatml.jsonl",
            "name": "Factual Base (Specs/Benchmarks)",
            "weight": 0.85  # Use natural proportion (~85%)
        },
        {
            "path": "output/completed_datasets/cleaned_qa_pairs_chatml.jsonl",
            "name": "PC Building Q&A (Assembly)",
            "weight": 0.07  # Use natural proportion (~7%)
        },
        {
            "path": "output/completed_datasets/pc_component_troubleshooting_data_chatml.jsonl",
            "name": "Troubleshooting (Diagnostics)",
            "weight": 0.08  # Use natural proportion (~8%)
        }
    ]

    # Load all datasets
    print("\n[LOADING] Loading datasets...")
    datasets = []
    names = []
    weights = []

    for config in datasets_config:
        path = config["path"]
        print(f"\nLoading: {config['name']}")
        print(f"  Path: {path}")

        data = load_jsonl(path)

        if not validate_chatml_format(data, config['name']):
            print(f"❌ Validation failed for {config['name']}")
            return

        datasets.append(data)
        names.append(config['name'])
        weights.append(config['weight'])

    # Show statistics
    print("\n" + "=" * 70)
    print("[STATISTICS] Dataset Statistics")
    print("=" * 70)
    total_samples = sum(len(d) for d in datasets)

    for i, (name, data, weight) in enumerate(zip(names, datasets, weights)):
        percentage = (len(data) / total_samples) * 100
        target_percentage = weight * 100
        print(f"\n{i+1}. {name}:")
        print(f"   Samples: {len(data):,}")
        print(f"   Current %: {percentage:.1f}%")
        print(f"   Target %: {target_percentage:.1f}%")

    print(f"\n{'Total samples:':<20} {total_samples:,}")

    # Combine datasets
    print("\n" + "=" * 70)
    print("[COMBINING] Combining datasets...")
    print("=" * 70)

    # Set random seed for reproducibility
    random.seed(42)

    # Interleave with weights
    print("\nInterleaving ALL samples with weighted distribution:")
    print("(Weights control order/mixing, NOT sample count)")
    for name, weight in zip(names, weights):
        print(f"  {name}: {weight*100:.1f}%")

    combined = interleave_datasets(datasets, weights)

    print(f"\n[OK] Combined ALL {len(combined):,} samples (no downsampling)")

    # Verify distribution in first 100 samples
    print("\n[VERIFY] Checking distribution in first 100 samples:")
    first_100_sources = []
    for sample in combined[:100]:
        # Try to identify source by comparing to originals
        for i, dataset in enumerate(datasets):
            if sample in dataset:
                first_100_sources.append(names[i])
                break

    from collections import Counter
    dist = Counter(first_100_sources)
    for name in names:
        count = dist.get(name, 0)
        print(f"  {name}: {count}/100 ({count}%)")

    # Save combined dataset
    output_path = "output/completed_datasets/mega_dataset_combined.jsonl"
    print(f"\n[SAVE] Saving to: {output_path}")
    save_jsonl(combined, output_path)

    print(f"[OK] Saved {len(combined):,} samples")

    # Also create a shuffled version
    print("\n[SHUFFLE] Creating fully shuffled version...")
    shuffled = combined.copy()
    random.shuffle(shuffled)

    shuffled_path = "output/completed_datasets/mega_dataset_shuffled.jsonl"
    save_jsonl(shuffled, shuffled_path)
    print(f"[OK] Saved shuffled version: {shuffled_path}")

    # Summary
    print("\n" + "=" * 70)
    print("[COMPLETE] SUCCESS!")
    print("=" * 70)
    print(f"\nGenerated files:")
    print(f"  1. {output_path}")
    print(f"     - Interleaved with target distribution")
    print(f"     - {len(combined):,} total samples")
    print(f"\n  2. {shuffled_path}")
    print(f"     - Fully randomized")
    print(f"     - {len(shuffled):,} total samples")
    print(f"\nRecommendation: Use the interleaved version for training")
    print("(Better distribution throughout training)")

if __name__ == "__main__":
    main()
