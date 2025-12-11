#!/usr/bin/env python3
"""
Sample Dataset Creator
Creates a 1k sample from tier1_factual_base_38k.jsonl
Maintains the same structure with metadata and sampled examples
"""

import json
import random
from pathlib import Path

def create_sample_dataset(
    input_path: str,
    output_path: str,
    sample_size: int = 1000,
    seed: int = 42
):
    """
    Create a sample dataset from a larger JSONL file.

    Args:
        input_path: Path to input JSONL file
        output_path: Path to output sample file
        sample_size: Number of examples to sample
        seed: Random seed for reproducibility
    """
    print(f"Reading dataset from: {input_path}")

    # Read the source file
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Extract metadata and examples
    metadata = data.get('metadata', {})
    examples = data.get('examples', [])

    total_examples = len(examples)
    print(f"Total examples in source: {total_examples}")

    if sample_size > total_examples:
        print(f"Warning: Requested sample size ({sample_size}) exceeds total examples ({total_examples})")
        sample_size = total_examples

    # Set random seed for reproducibility
    random.seed(seed)

    # Randomly sample examples
    sampled_examples = random.sample(examples, sample_size)

    print(f"Sampled {len(sampled_examples)} examples")

    # Update metadata with new counts
    updated_metadata = metadata.copy()
    updated_metadata['total_examples'] = len(sampled_examples)
    updated_metadata['source_file'] = input_path
    updated_metadata['sample_size'] = sample_size
    updated_metadata['sampling_method'] = 'random'
    updated_metadata['random_seed'] = seed

    # Calculate component breakdown for sampled data
    if 'component_breakdown' in metadata:
        print("Calculating component distribution in sample...")
        # This would require parsing the examples, keeping original for now
        updated_metadata['original_component_breakdown'] = metadata.get('component_breakdown')

    # Create output structure
    output_data = {
        'metadata': updated_metadata,
        'examples': sampled_examples
    }

    # Write to output file
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Writing sample dataset to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"[SUCCESS] Sample dataset created successfully!")
    print(f"  - Input: {total_examples} examples")
    print(f"  - Output: {len(sampled_examples)} examples")
    print(f"  - File size: {output_file.stat().st_size / 1024:.2f} KB")

    return output_data


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Create a sample dataset from tier1_factual_base_38k.jsonl'
    )
    parser.add_argument(
        '--input',
        default='C:\\Users\\Juan\\Desktop\\Dev_Ops\\web-ui\\output\\tier1_factual_base_38k.jsonl',
        help='Input JSONL file path'
    )
    parser.add_argument(
        '--output',
        default='C:\\Users\\Juan\\Desktop\\Dev_Ops\\web-ui\\output\\tier1_factual_base_1k_sample.jsonl',
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

    create_sample_dataset(
        input_path=args.input,
        output_path=args.output,
        sample_size=args.size,
        seed=args.seed
    )


if __name__ == '__main__':
    main()

