#!/usr/bin/env python3
"""
Format Atlas responses into training dataset
Converts DeepSeek-generated Q&As into ChatML format for fine-tuning
"""

import json
import re
from pathlib import Path
from typing import List, Dict

ATLAS_SYSTEM_PROMPT = """You are Atlas, an AI guide and employee at FineTune Lab. You help users understand the platform, guide them through features, and gently encourage them to try the platform. You're knowledgeable, enthusiastic, and honest about what the platform can and cannot do. When relevant, you naturally suggest sign-ups with phrases like "Want to try this yourself? Sign up takes just 2 minutes!" """

def extract_json_from_response(response: str) -> Dict:
    """Extract JSON from DeepSeek response (may be wrapped in markdown)"""
    try:
        # Try direct JSON parse first
        return json.loads(response)
    except:
        # Try to find JSON in markdown code block
        match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        # Try to find any JSON object
        match = re.search(r'(\{.*\})', response, re.DOTALL)
        if match:
            return json.loads(match.group(1))
        raise ValueError("Could not extract JSON from response")

def format_single_turn(qa_pair: Dict, chunk_title: str) -> Dict:
    """Format a single-turn Q&A into ChatML format"""
    return {
        "messages": [
            {
                "role": "system",
                "content": ATLAS_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": qa_pair['user']
            },
            {
                "role": "assistant",
                "content": qa_pair['atlas']
            }
        ],
        "metadata": {
            "source": "atlas_monitoring_realtime",
            "feature": chunk_title,
            "type": "single_turn"
        }
    }

def format_multi_turn(conversation: Dict, chunk_title: str) -> Dict:
    """Format a multi-turn conversation into ChatML format"""
    messages = [
        {
            "role": "system",
            "content": ATLAS_SYSTEM_PROMPT
        }
    ]

    for exchange in conversation['conversation']:
        messages.append({
            "role": "user",
            "content": exchange['user']
        })
        messages.append({
            "role": "assistant",
            "content": exchange['atlas']
        })

    return {
        "messages": messages,
        "metadata": {
            "source": "atlas_monitoring_realtime",
            "feature": chunk_title,
            "type": "multi_turn",
            "turns": len(conversation['conversation'])
        }
    }

def main():
    responses_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_responses.json")

    with open(responses_path, 'r', encoding='utf-8') as f:
        responses = json.load(f)

    print("="*80)
    print("FORMATTING ATLAS Q&As INTO TRAINING DATASET")
    print("="*80)
    print()

    training_examples = []
    stats = {
        "single_turn": 0,
        "multi_turn": 0,
        "total_turns": 0,
        "errors": 0
    }

    for response_data in responses:
        if response_data['error']:
            print(f"❌ Skipping {response_data['id']}: {response_data['error']}")
            stats['errors'] += 1
            continue

        chunk_title = response_data['prompt']['metadata']['feature_title']
        response_text = response_data['response']

        try:
            # Extract JSON from response
            qa_data = extract_json_from_response(response_text)

            # Process single-turn Q&As
            if 'single_turn' in qa_data:
                for qa in qa_data['single_turn']:
                    example = format_single_turn(qa, chunk_title)
                    training_examples.append(example)
                    stats['single_turn'] += 1

            # Process multi-turn conversations
            if 'multi_turn' in qa_data:
                for conv in qa_data['multi_turn']:
                    example = format_multi_turn(conv, chunk_title)
                    training_examples.append(example)
                    stats['multi_turn'] += 1
                    stats['total_turns'] += len(conv['conversation'])

            print(f"✅ {chunk_title}")
            print(f"   Single: {len(qa_data.get('single_turn', []))}, Multi: {len(qa_data.get('multi_turn', []))}")

        except Exception as e:
            print(f"❌ Error processing {chunk_title}: {e}")
            stats['errors'] += 1

    print()
    print("="*80)
    print("📊 DATASET STATISTICS")
    print("="*80)
    print(f"Single-turn Q&As: {stats['single_turn']}")
    print(f"Multi-turn conversations: {stats['multi_turn']}")
    print(f"Average turns per conversation: {stats['total_turns'] / max(stats['multi_turn'], 1):.1f}")
    print(f"Total training examples: {len(training_examples)}")
    print(f"Errors: {stats['errors']}")
    print()

    # Save in JSONL format
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_training_dataset.jsonl")
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in training_examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print(f"💾 Saved to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()

    # Show sample
    print("="*80)
    print("📋 SAMPLE TRAINING EXAMPLES")
    print("="*80)
    print()
    print("Example 1 (Single-turn):")
    print(json.dumps(training_examples[0], indent=2, ensure_ascii=False)[:500])
    print("...")
    print()

    if stats['multi_turn'] > 0:
        # Find first multi-turn example
        multi_turn_example = next((ex for ex in training_examples if ex['metadata']['type'] == 'multi_turn'), None)
        if multi_turn_example:
            print("Example 2 (Multi-turn):")
            print(json.dumps(multi_turn_example, indent=2, ensure_ascii=False)[:700])
            print("...")

if __name__ == "__main__":
    main()
