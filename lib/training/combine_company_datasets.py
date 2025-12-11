#!/usr/bin/env python3
"""
Combine all 3 company training datasets into one unified dataset
"""

import json
from pathlib import Path

ATLAS_SYSTEM_PROMPT = """You are Atlas, an AI guide and employee at FineTune Lab. You help users understand the platform, guide them through features, and gently encourage them to try the platform. You're knowledgeable, enthusiastic, and honest about what the platform can and cannot do. When relevant, you naturally suggest sign-ups with phrases like "Want to try this yourself? Sign up takes just 2 minutes!" """

def load_deepseek_answers(file_path: Path):
    """Load deepseek_answers.json and convert to training format"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    examples = []
    for item in data:
        if 'question' in item and 'answer' in item and item['answer'] and not item['answer'].startswith('ERROR'):
            example = {
                "messages": [
                    {"role": "system", "content": ATLAS_SYSTEM_PROMPT},
                    {"role": "user", "content": item['question']},
                    {"role": "assistant", "content": item['answer']}
                ],
                "metadata": {
                    "source": "deepseek_generated",
                    "type": "single_turn"
                }
            }
            examples.append(example)

    return examples

def load_jsonl(file_path: Path):
    """Load JSONL file"""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))
    return examples

def main():
    base_dir = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data")

    print("="*80)
    print("COMBINING ALL FINETUNE LAB COMPANY DATASETS")
    print("="*80)
    print()

    all_examples = []

    # Load deepseek_answers.json
    print("📄 Loading deepseek_answers.json...")
    deepseek_path = base_dir / "deepseek_answers.json"
    deepseek_examples = load_deepseek_answers(deepseek_path)
    print(f"   ✅ Loaded {len(deepseek_examples)} examples")
    all_examples.extend(deepseek_examples)

    # Load atlas_training_dataset.jsonl (MONITORING_REALTIME)
    print("📄 Loading atlas_training_dataset.jsonl...")
    atlas1_path = base_dir / "atlas_training_dataset.jsonl"
    atlas1_examples = load_jsonl(atlas1_path)
    print(f"   ✅ Loaded {len(atlas1_examples)} examples")
    all_examples.extend(atlas1_examples)

    # Load atlas_final_dataset.jsonl (ALL other docs)
    print("📄 Loading atlas_final_dataset.jsonl...")
    atlas2_path = base_dir / "atlas_final_dataset.jsonl"
    atlas2_examples = load_jsonl(atlas2_path)
    print(f"   ✅ Loaded {len(atlas2_examples)} examples")
    all_examples.extend(atlas2_examples)

    print()
    print("="*80)
    print("📊 COMBINED DATASET STATISTICS")
    print("="*80)

    # Count types
    single_turn = sum(1 for ex in all_examples if ex['metadata']['type'] == 'single_turn')
    multi_turn = len(all_examples) - single_turn

    print(f"Total examples: {len(all_examples)}")
    print(f"Single-turn Q&As: {single_turn}")
    print(f"Multi-turn conversations: {multi_turn}")
    print()

    # Count by source
    from collections import defaultdict
    by_source = defaultdict(int)
    for ex in all_examples:
        source = ex['metadata'].get('source', 'unknown')
        by_source[source] += 1

    print("📋 By source:")
    for source, count in sorted(by_source.items(), key=lambda x: -x[1]):
        pct = (count / len(all_examples)) * 100
        print(f"   {source}: {count} ({pct:.1f}%)")
    print()

    # Save combined dataset
    output_path = base_dir / "atlas_complete_company_dataset.jsonl"
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in all_examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print(f"💾 Saved combined dataset to:")
    print(f"   {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()
    print("✅ All company datasets combined!")

if __name__ == "__main__":
    main()
