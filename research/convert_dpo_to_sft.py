#!/usr/bin/env python3
"""
Convert DPO dataset to SFT format
DPO: {prompt, chosen, rejected}
SFT: {messages: [{role: system/user/assistant, content}]}
"""

import json
from datetime import datetime
from pathlib import Path

# System prompt for Atlas
ATLAS_SYSTEM_PROMPT = (
    "You are Atlas, an AI assistant built on Llama 3.2 3B and fine-tuned to be an expert guide at FineTune Lab. "
    "You help users understand the platform, guide them through features, and gently encourage them to try it. "
    "You're knowledgeable, enthusiastic, and honest about what the platform can and cannot do. "
    "When relevant, you naturally suggest sign-ups with phrases like \"Want to try this yourself? Sign up takes just 2 minutes!\" "
    "You are NOT a GPT model or an OpenAI product - you're a specialized fine-tuned Llama 3.2 3B model trained specifically for FineTune Lab support."
)

def validate_dpo_example(ex):
    """Validate DPO example has required fields"""
    required = ['prompt', 'chosen', 'rejected']
    for field in required:
        if field not in ex or not ex[field]:
            return False, f"Missing or empty field: {field}"
    return True, None

def validate_sft_example(ex):
    """Validate SFT example has correct structure"""
    if 'messages' not in ex:
        return False, "Missing 'messages' field"

    messages = ex['messages']
    if not isinstance(messages, list) or len(messages) < 2:
        return False, "Messages must be a list with at least 2 items"

    # Check for system, user, assistant
    roles = [m['role'] for m in messages]
    if roles[0] != 'system':
        return False, "First message must be system"
    if 'user' not in roles or 'assistant' not in roles:
        return False, "Must have user and assistant messages"

    # Check all messages have content
    for msg in messages:
        if 'role' not in msg or 'content' not in msg:
            return False, "Message missing role or content"
        if not msg['content']:
            return False, "Message has empty content"

    return True, None

def convert_dpo_to_sft(dpo_example):
    """Convert single DPO example to SFT format using 'chosen' response"""
    return {
        "messages": [
            {
                "role": "system",
                "content": ATLAS_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": dpo_example['prompt']
            },
            {
                "role": "assistant",
                "content": dpo_example['chosen']
            }
        ],
        "metadata": {
            "source": "dpo_converted",
            "original_category": dpo_example.get('metadata', {}).get('category', 'unknown'),
            "type": "single_turn"
        }
    }

def main():
    print("="*70)
    print("DPO → SFT CONVERSION")
    print("="*70)

    # Load DPO dataset
    dpo_file = Path("final_combined_dataset_4484_20251125_223550.json")
    print(f"\nLoading DPO dataset: {dpo_file}")

    with open(dpo_file, 'r') as f:
        dpo_data = json.load(f)

    print(f"Loaded {len(dpo_data)} DPO examples")

    # Validate input
    print("\nValidating DPO examples...")
    validation_errors = 0
    for i, ex in enumerate(dpo_data):
        valid, error = validate_dpo_example(ex)
        if not valid:
            print(f"  Error in example {i}: {error}")
            validation_errors += 1
            if validation_errors >= 5:
                print(f"  ... stopping after 5 errors")
                break

    if validation_errors > 0:
        print(f"\n❌ Found {validation_errors} validation errors. Aborting.")
        return

    print(f"✓ All {len(dpo_data)} examples validated")

    # Convert
    print("\nConverting to SFT format...")
    sft_data = []
    for i, dpo_ex in enumerate(dpo_data):
        sft_ex = convert_dpo_to_sft(dpo_ex)
        sft_data.append(sft_ex)

        if (i + 1) % 1000 == 0:
            print(f"  Converted {i + 1}/{len(dpo_data)}...")

    print(f"✓ Converted {len(sft_data)} examples")

    # Validate output
    print("\nValidating SFT examples...")
    validation_errors = 0
    for i, ex in enumerate(sft_data):
        valid, error = validate_sft_example(ex)
        if not valid:
            print(f"  Error in example {i}: {error}")
            validation_errors += 1
            if validation_errors >= 5:
                print(f"  ... stopping after 5 errors")
                break

    if validation_errors > 0:
        print(f"\n❌ Found {validation_errors} validation errors in output. Aborting.")
        return

    print(f"✓ All {len(sft_data)} SFT examples validated")

    # Save output files
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # JSONL format (standard for training)
    jsonl_file = Path(f"atlas_sft_from_dpo_{len(sft_data)}_{timestamp}.jsonl")
    print(f"\nSaving JSONL: {jsonl_file}")
    with open(jsonl_file, 'w') as f:
        for ex in sft_data:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    # JSON format (for inspection)
    json_file = Path(f"atlas_sft_from_dpo_{len(sft_data)}_{timestamp}.json")
    print(f"Saving JSON:  {json_file}")
    with open(json_file, 'w') as f:
        json.dump(sft_data, f, indent=2, ensure_ascii=False)

    # Stats
    print("\n" + "="*70)
    print("CONVERSION COMPLETE")
    print("="*70)
    print(f"  Input:  {len(dpo_data)} DPO examples")
    print(f"  Output: {len(sft_data)} SFT examples")
    print(f"  Format: Single-turn conversations with system prompt")
    print(f"  Files:")
    print(f"    - {jsonl_file}")
    print(f"    - {json_file}")

    # Sample verification
    print("\n" + "="*70)
    print("SAMPLE VERIFICATION (First Example)")
    print("="*70)
    sample = sft_data[0]
    print(f"\nSystem: {sample['messages'][0]['content'][:100]}...")
    print(f"\nUser ({len(sample['messages'][1]['content'].split())}w):")
    print(f"  {sample['messages'][1]['content'][:150]}...")
    print(f"\nAssistant ({len(sample['messages'][2]['content'].split())}w):")
    print(f"  {sample['messages'][2]['content'][:200]}...")
    print(f"\nMetadata: {sample['metadata']}")
    print("="*70)

if __name__ == "__main__":
    main()
