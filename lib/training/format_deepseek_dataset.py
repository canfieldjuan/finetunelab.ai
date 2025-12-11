#!/usr/bin/env python3
"""
Convert DeepSeek answers to FineTune Lab training dataset format
Input: deepseek_answers.json
Output: finetune_lab_deepseek_dataset.jsonl (ChatML format)
"""

import json
from pathlib import Path
from typing import List, Dict

SYSTEM_PROMPT = "You are a helpful assistant for FineTune Lab. Provide accurate, specific information about the platform's implementation details."

def load_deepseek_answers(answers_path: str) -> List[Dict]:
    """Load DeepSeek answers from JSON"""
    with open(answers_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def convert_to_chatml(qa_pairs: List[Dict]) -> List[Dict]:
    """Convert Q&A pairs to ChatML format"""
    dataset = []

    for qa in qa_pairs:
        # Skip errors
        if qa['answer'].startswith('ERROR:'):
            print(f"⚠️  Skipping error: {qa['question']}")
            continue

        # Create ChatML format
        example = {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": qa['question']},
                {"role": "assistant", "content": qa['answer']}
            ]
        }

        dataset.append(example)

    return dataset

def validate_dataset(dataset: List[Dict]) -> Dict[str, int]:
    """Validate dataset quality"""
    stats = {
        "total": len(dataset),
        "valid": 0,
        "too_short": 0,
        "too_long": 0,
        "missing_fields": 0
    }

    for example in dataset:
        try:
            messages = example['messages']

            # Check structure
            if len(messages) != 3:
                stats['missing_fields'] += 1
                continue

            assistant_msg = messages[2]['content']

            # Check length
            if len(assistant_msg) < 20:
                stats['too_short'] += 1
                continue

            if len(assistant_msg) > 1000:
                stats['too_long'] += 1
                continue

            stats['valid'] += 1

        except (KeyError, IndexError) as e:
            stats['missing_fields'] += 1

    return stats

def save_dataset(dataset: List[Dict], output_path: str):
    """Save dataset in JSONL format"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        for example in dataset:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print(f"\n💾 Dataset saved!")
    print(f"📁 Location: {output_file}")
    print(f"📊 Size: {output_file.stat().st_size / 1024:.1f} KB")

def assess_with_existing_tool(dataset_path: str):
    """Run existing assessment tool on new dataset"""
    print("\n🔍 Running quality assessment...")

    try:
        import subprocess
        result = subprocess.run(
            ['python3', 'assess_dataset_accuracy.py',
             str(Path(dataset_path).name),
             str(len(Path(dataset_path).read_text().strip().split('\n')))],
            capture_output=True,
            text=True,
            cwd='/home/juan-canfield/Desktop/web-ui/lib/training'
        )

        if result.returncode == 0:
            print(result.stdout)
        else:
            print(f"⚠️  Assessment failed: {result.stderr}")

    except Exception as e:
        print(f"⚠️  Could not run assessment: {e}")

def main():
    print("="*80)
    print("CONVERTING DEEPSEEK ANSWERS TO TRAINING DATASET")
    print("="*80)
    print()

    # Paths
    answers_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_answers.json"
    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/finetune_lab_deepseek_dataset.jsonl"

    # Check if answers exist
    if not Path(answers_path).exists():
        print(f"❌ Error: {answers_path} not found!")
        print("\n💡 You need to run DeepSeek API first:")
        print("   python3 call_deepseek_api.py")
        return

    # Load answers
    print("📚 Loading DeepSeek answers...")
    qa_pairs = load_deepseek_answers(answers_path)
    print(f"   Found {len(qa_pairs)} Q&A pairs")

    # Convert to ChatML
    print("\n🔄 Converting to ChatML format...")
    dataset = convert_to_chatml(qa_pairs)
    print(f"   Created {len(dataset)} training examples")

    # Validate
    print("\n✅ Validating dataset...")
    stats = validate_dataset(dataset)
    print(f"   Total: {stats['total']}")
    print(f"   Valid: {stats['valid']} ({stats['valid']/stats['total']*100:.1f}%)")
    print(f"   Too short: {stats['too_short']}")
    print(f"   Too long: {stats['too_long']}")
    print(f"   Missing fields: {stats['missing_fields']}")

    # Save
    save_dataset(dataset, output_path)

    # Assess quality
    assess_with_existing_tool(output_path)

    print("\n" + "="*80)
    print("DATASET READY FOR TRAINING!")
    print("="*80)
    print(f"\n✨ Created {len(dataset)} training examples from DeepSeek answers")
    print("\n💡 Next Steps:")
    print("   1. Review quality score above")
    print("   2. If score is high (>80%), use for training")
    print("   3. If score is low, review answers and regenerate")

if __name__ == "__main__":
    main()
