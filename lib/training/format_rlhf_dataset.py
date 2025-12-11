#!/usr/bin/env python3
"""
Format RLHF responses into training dataset
Parses DeepSeek responses and creates DPO/RLHF format
"""

import json
import re
from pathlib import Path
from collections import Counter

def extract_json_from_response(response: str) -> dict:
    """Extract JSON from DeepSeek response (may be wrapped in markdown)"""
    try:
        # Try direct JSON parse
        return json.loads(response)
    except:
        # Try to find JSON in markdown code block
        match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Try to find any JSON object
        match = re.search(r'(\{[^{}]*"prompt"[^{}]*"chosen"[^{}]*"rejected"[^{}]*\})', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise ValueError("Could not extract JSON from response")

def validate_rlhf_example(example: dict) -> tuple[bool, str]:
    """Validate RLHF example has required fields"""
    required = ['prompt', 'chosen', 'rejected']

    for field in required:
        if field not in example:
            return False, f"Missing field: {field}"
        if not isinstance(example[field], str):
            return False, f"{field} must be string"
        if not example[field].strip():
            return False, f"{field} is empty"

    # Check that chosen and rejected are different
    if example['chosen'].strip() == example['rejected'].strip():
        return False, "chosen and rejected are identical"

    return True, "valid"

def format_for_dpo(rlhf_pair: dict, metadata: dict) -> dict:
    """Format into DPO training format"""
    return {
        "prompt": rlhf_pair['prompt'],
        "chosen": rlhf_pair['chosen'],
        "rejected": rlhf_pair['rejected'],
        "metadata": {
            "source": "rlhf_atlas_finetune_lab",
            "category": metadata.get('category', 'unknown'),
            "topic": metadata.get('topic', 'unknown')
        }
    }

def main():
    responses_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/rlhf_raw_responses.json")

    print("="*80)
    print("FORMATTING RLHF DATASET FOR DPO TRAINING")
    print("="*80)
    print()

    with open(responses_path, 'r', encoding='utf-8') as f:
        responses = json.load(f)

    print(f"📂 Loaded {len(responses)} raw responses")
    print()

    training_examples = []
    stats = {
        "total_responses": len(responses),
        "successful_parse": 0,
        "failed_parse": 0,
        "validation_passed": 0,
        "validation_failed": 0,
        "by_category": Counter(),
        "error_types": Counter()
    }

    print("🔍 Processing responses...")
    print()

    for i, response_data in enumerate(responses, 1):
        if response_data['error']:
            stats['failed_parse'] += 1
            stats['error_types']['api_error'] += 1
            continue

        response_text = response_data['response']
        metadata = response_data['prompt']['metadata']

        try:
            # Extract JSON
            rlhf_pair = extract_json_from_response(response_text)
            stats['successful_parse'] += 1

            # Validate
            is_valid, message = validate_rlhf_example(rlhf_pair)

            if is_valid:
                # Format for DPO
                example = format_for_dpo(rlhf_pair, metadata)
                training_examples.append(example)
                stats['validation_passed'] += 1
                stats['by_category'][metadata['category']] += 1

                if i % 100 == 0:
                    print(f"   ✅ Processed {i}/{len(responses)} ({stats['validation_passed']} valid)")
            else:
                stats['validation_failed'] += 1
                stats['error_types'][message] += 1

        except Exception as e:
            stats['failed_parse'] += 1
            stats['error_types'][f'parse_error: {str(e)[:30]}'] += 1

    print()
    print("="*80)
    print("📊 RLHF DATASET STATISTICS")
    print("="*80)
    print(f"Total responses: {stats['total_responses']}")
    print(f"Successful parse: {stats['successful_parse']} ({stats['successful_parse']/stats['total_responses']*100:.1f}%)")
    print(f"Failed parse: {stats['failed_parse']}")
    print(f"Validation passed: {stats['validation_passed']}")
    print(f"Validation failed: {stats['validation_failed']}")
    print()

    print("📋 Valid examples by category:")
    for category, count in sorted(stats['by_category'].items(), key=lambda x: -x[1]):
        pct = (count / stats['validation_passed']) * 100
        print(f"   {category}: {count} ({pct:.1f}%)")
    print()

    if stats['error_types']:
        print("⚠️  Error types:")
        for error_type, count in stats['error_types'].most_common(10):
            print(f"   {error_type}: {count}")
        print()

    # Save RLHF dataset
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_rlhf_dataset.jsonl")
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in training_examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print(f"💾 Saved RLHF dataset to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes ({output_path.stat().st_size/1024/1024:.2f} MB)")
    print(f"📊 Total RLHF examples: {len(training_examples)}")
    print()

    # Show samples
    print("="*80)
    print("📝 SAMPLE RLHF EXAMPLES")
    print("="*80)
    print()

    if training_examples:
        print("Example 1:")
        print(json.dumps(training_examples[0], indent=2)[:800])
        print("...")
        print()

        if len(training_examples) > 100:
            print("Example 2 (different category):")
            # Find example from different category
            cat1 = training_examples[0]['metadata']['category']
            example2 = next((ex for ex in training_examples if ex['metadata']['category'] != cat1), training_examples[1])
            print(json.dumps(example2, indent=2)[:800])
            print("...")
            print()

    if stats['validation_passed'] >= 1500:
        print("✅ SUCCESS! Generated {0} RLHF examples - ready for DPO training!".format(stats['validation_passed']))
    elif stats['validation_passed'] >= 1000:
        print("⚠️  Generated {0} examples (target was 2000)".format(stats['validation_passed']))
    else:
        print(f"⚠️  Only generated {stats['validation_passed']} examples - may need to rerun failed prompts")

if __name__ == "__main__":
    main()
