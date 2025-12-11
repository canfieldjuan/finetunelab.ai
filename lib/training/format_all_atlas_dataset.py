#!/usr/bin/env python3
"""
Format ALL Atlas responses into complete training dataset
Combines all documentation Q&As into single JSONL file
"""

import json
import re
from pathlib import Path
from typing import Dict

ATLAS_SYSTEM_PROMPT = """You are Atlas, an AI guide and employee at FineTune Lab. You help users understand the platform, guide them through features, and gently encourage them to try the platform. You're knowledgeable, enthusiastic, and honest about what the platform can and cannot do. When relevant, you naturally suggest sign-ups with phrases like "Want to try this yourself? Sign up takes just 2 minutes!" """

def extract_json_from_response(response: str) -> Dict:
    """Extract JSON from DeepSeek response"""
    try:
        return json.loads(response)
    except:
        match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        match = re.search(r'(\{.*\})', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise ValueError("Could not extract JSON")

def format_single_turn(qa_pair: Dict, metadata: Dict) -> Dict:
    """Format single-turn Q&A"""
    return {
        "messages": [
            {"role": "system", "content": ATLAS_SYSTEM_PROMPT},
            {"role": "user", "content": qa_pair['user']},
            {"role": "assistant", "content": qa_pair['atlas']}
        ],
        "metadata": {
            "source": "atlas_finetune_lab",
            "source_file": metadata['source_file'],
            "section": metadata['section_title'],
            "type": "single_turn"
        }
    }

def format_multi_turn(conversation: Dict, metadata: Dict) -> Dict:
    """Format multi-turn conversation"""
    messages = [{"role": "system", "content": ATLAS_SYSTEM_PROMPT}]

    for exchange in conversation['conversation']:
        messages.append({"role": "user", "content": exchange['user']})
        messages.append({"role": "assistant", "content": exchange['atlas']})

    return {
        "messages": messages,
        "metadata": {
            "source": "atlas_finetune_lab",
            "source_file": metadata['source_file'],
            "section": metadata['section_title'],
            "type": "multi_turn",
            "turns": len(conversation['conversation'])
        }
    }

def main():
    responses_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/all_atlas_responses.json")

    with open(responses_path, 'r', encoding='utf-8') as f:
        responses = json.load(f)

    print("="*80)
    print("FORMATTING ALL ATLAS RESPONSES INTO TRAINING DATASET")
    print("="*80)
    print()

    training_examples = []
    stats = {
        "single_turn": 0,
        "multi_turn": 0,
        "total_turns": 0,
        "errors": 0,
        "by_file": {}
    }

    for response_data in responses:
        if response_data['error']:
            print(f"⚠️  Skipping {response_data['id'][:50]}: {response_data['error'][:40]}")
            stats['errors'] += 1
            continue

        metadata = response_data['prompt']['metadata']
        source_file = metadata['source_file']
        response_text = response_data['response']

        try:
            qa_data = extract_json_from_response(response_text)

            # Process single-turn
            if 'single_turn' in qa_data:
                for qa in qa_data['single_turn']:
                    example = format_single_turn(qa, metadata)
                    training_examples.append(example)
                    stats['single_turn'] += 1

            # Process multi-turn
            if 'multi_turn' in qa_data:
                for conv in qa_data['multi_turn']:
                    example = format_multi_turn(conv, metadata)
                    training_examples.append(example)
                    stats['multi_turn'] += 1
                    stats['total_turns'] += len(conv['conversation'])

            # Track by file
            if source_file not in stats['by_file']:
                stats['by_file'][source_file] = {"single": 0, "multi": 0}
            stats['by_file'][source_file]['single'] += len(qa_data.get('single_turn', []))
            stats['by_file'][source_file]['multi'] += len(qa_data.get('multi_turn', []))

            print(f"✅ {source_file} - {metadata['section_title'][:40]}")

        except Exception as e:
            print(f"❌ Error processing {response_data['id'][:50]}: {str(e)[:60]}")
            stats['errors'] += 1

    print()
    print("="*80)
    print("📊 COMPLETE DATASET STATISTICS")
    print("="*80)
    print(f"Single-turn Q&As: {stats['single_turn']}")
    print(f"Multi-turn conversations: {stats['multi_turn']}")
    print(f"Avg turns per conversation: {stats['total_turns'] / max(stats['multi_turn'], 1):.1f}")
    print(f"Total training examples: {len(training_examples)}")
    print(f"Errors: {stats['errors']}")
    print()

    print("📋 Examples by document:")
    for file_name, counts in sorted(stats['by_file'].items()):
        total = counts['single'] + counts['multi']
        print(f"   {file_name}: {total} ({counts['single']} single, {counts['multi']} multi)")
    print()

    # Save complete dataset
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_complete_training_dataset.jsonl")
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in training_examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print(f"💾 Saved complete dataset to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()

    # Show samples
    print("="*80)
    print("📝 SAMPLE EXAMPLES")
    print("="*80)
    print()
    print("Single-turn example:")
    print(json.dumps(training_examples[0], indent=2)[:400])
    print("...\n")

    multi_example = next((ex for ex in training_examples if ex['metadata']['type'] == 'multi_turn'), None)
    if multi_example:
        print("Multi-turn example:")
        print(json.dumps(multi_example, indent=2)[:500])
        print("...")

if __name__ == "__main__":
    main()
