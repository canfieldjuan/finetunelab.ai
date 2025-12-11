#!/usr/bin/env python3
"""
JSONL Sample Creator
Creates a 1k sample from cleaned_qa_pairs.jsonl (true JSONL format - one JSON per line)
"""

import json
import random
from pathlib import Path


def create_jsonl_sample(
    input_path: str,
    output_path: str,
    sample_size: int = 1000,
    seed: int = 42
):
    """
    Create a sample from a JSONL file (one JSON object per line).

    Args:
        input_path: Path to input JSONL file
        output_path: Path to output sample file
        sample_size: Number of examples to sample
        seed: Random seed for reproducibility
    """
    print(f"Reading JSONL dataset from: {input_path}")

    # Read all lines
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    total_examples = len(lines)
    print(f"Total examples in source: {total_examples}")

    if sample_size > total_examples:
        print(f"Warning: Requested sample size ({sample_size}) exceeds total examples ({total_examples})")
        sample_size = total_examples

    # Set random seed for reproducibility
    random.seed(seed)

    # Randomly sample line indices
    sample_indices = sorted(random.sample(range(total_examples), sample_size))

    # Extract sampled lines
    sampled_lines = [lines[i] for i in sample_indices]

    print(f"Sampled {len(sampled_lines)} examples")

    # Parse first line to understand structure
    first_example = json.loads(sampled_lines[0])
    print(f"Example structure: {list(first_example.keys())}")

    # Write to output file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing sample dataset to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        for line in sampled_lines:
            f.write(line)

    # Verify output
    with open(output_path, 'r', encoding='utf-8') as f:
        verify_count = sum(1 for _ in f)

    print(f"[SUCCESS] Sample dataset created successfully!")
    print(f"  - Input: {total_examples} examples")
    print(f"  - Output: {verify_count} examples")
    print(f"  - File size: {output_file.stat().st_size / 1024:.2f} KB")
    print(f"  - Sampling method: random (seed={seed})")

    return verify_count


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Create a sample from cleaned_qa_pairs.jsonl (true JSONL format)'
    )
    parser.add_argument(
        '--input',
        default='C:\\Users\\Juan\\Desktop\\Dev_Ops\\web-ui\\output\\cleaned_qa_pairs.jsonl',
        help='Input JSONL file path'
    )
    parser.add_argument(
        '--output',
        default='C:\\Users\\Juan\\Desktop\\Dev_Ops\\web-ui\\output\\cleaned_qa_pairs_1k_sample.jsonl',
        help='Output sample file path'
    )
    parser.add_argument(
        '--size',
        type=int,
        default=1000,
        help='Number of examples to sample (default: 1000)'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=42,
        help='Random seed for reproducibility (default: 42)'
    )

    args = parser.parse_args()

    create_jsonl_sample(
        input_path=args.input,
        output_path=args.output,
        sample_size=args.size,
        seed=args.seed
    )


if __name__ == '__main__':
    main()

