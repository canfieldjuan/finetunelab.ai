#!/usr/bin/env python3
"""
Combine all datasets:
1. Original finetune_lab_final_dataset.jsonl (5,278 ChatML)
2. finetuning_expert_augmented.json (11 ShareGPT)
3. finetuning_workflows_5k.json (5,000 ShareGPT)
"""

import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Set

def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file"""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples

def load_json_array(file_path: str) -> List[Dict[str, Any]]:
    """Load JSON array file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_jsonl(examples: List[Dict[str, Any]], file_path: str):
    """Save examples to JSONL file"""
    with open(file_path, 'w', encoding='utf-8') as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')
    print(f"💾 Saved {len(examples)} examples to: {file_path}")

def sharegpt_to_chatml(example: Dict[str, Any]) -> Dict[str, Any]:
    """Convert ShareGPT format to ChatML format"""
    conversations = example.get("conversations", [])

    messages = []
    for conv in conversations:
        from_role = conv.get("from", "")
        value = conv.get("value", "")

        # Map ShareGPT roles to ChatML roles
        if from_role == "system":
            role = "system"
        elif from_role == "human":
            role = "user"
        elif from_role == "gpt":
            role = "assistant"
        elif from_role == "user":
            role = "user"
        elif from_role == "assistant":
            role = "assistant"
        else:
            role = from_role  # Keep unknown roles as-is

        messages.append({
            "role": role,
            "content": value
        })

    return {"messages": messages}

def get_example_hash(example: Dict[str, Any]) -> str:
    """Generate hash for duplicate detection"""
    messages = example.get("messages", [])
    content = "\n".join([f"{m.get('role', '')}:{m.get('content', '')}" for m in messages])
    return hashlib.md5(content.encode('utf-8')).hexdigest()

def deduplicate(examples: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], int]:
    """Remove duplicate examples, keeping first occurrence"""
    seen_hashes: Set[str] = set()
    unique_examples = []
    duplicates_removed = 0

    for example in examples:
        example_hash = get_example_hash(example)

        if example_hash not in seen_hashes:
            seen_hashes.add(example_hash)
            unique_examples.append(example)
        else:
            duplicates_removed += 1

    return unique_examples, duplicates_removed

def validate_chatml_example(example: Dict[str, Any]) -> tuple[bool, str]:
    """Validate ChatML format example"""
    if "messages" not in example:
        return False, "Missing 'messages' field"

    messages = example.get("messages", [])

    if not messages:
        return False, "Empty messages array"

    if not isinstance(messages, list):
        return False, "Messages must be a list"

    for i, msg in enumerate(messages):
        if not isinstance(msg, dict):
            return False, f"Message {i} is not a dict"

        if "role" not in msg:
            return False, f"Message {i} missing 'role'"

        if "content" not in msg:
            return False, f"Message {i} missing 'content'"

        role = msg.get("role")
        if role not in ["system", "user", "assistant"]:
            return False, f"Message {i} has invalid role: {role}"

    # Check role alternation (excluding system)
    # NOTE: We allow consecutive assistant messages for tool-calling workflows
    # where the assistant makes multiple tool calls in sequence
    conversation_messages = [m for m in messages if m.get("role") != "system"]

    if conversation_messages:
        if conversation_messages[0].get("role") != "user":
            return False, "Conversation must start with 'user' role"

        # Check for consecutive USER messages (not allowed)
        # Multiple assistant messages are OK (tool calling pattern)
        for i in range(len(conversation_messages) - 1):
            current_role = conversation_messages[i].get("role")
            next_role = conversation_messages[i + 1].get("role")

            if current_role == "user" and next_role == "user":
                return False, f"Consecutive user messages not allowed"

    return True, "Valid"

def validate_dataset(examples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Validate entire dataset"""
    validation_results = {
        "total": len(examples),
        "valid": 0,
        "invalid": 0,
        "errors": []
    }

    for i, example in enumerate(examples):
        is_valid, error_msg = validate_chatml_example(example)

        if is_valid:
            validation_results["valid"] += 1
        else:
            validation_results["invalid"] += 1
            validation_results["errors"].append(f"Example {i}: {error_msg}")

    return validation_results

def main():
    print("\n" + "="*80)
    print("DATASET COMBINATION - ALL SOURCES")
    print("="*80 + "\n")

    # File paths
    base_dir = Path("/home/juan-canfield/Desktop/web-ui/output/In_progress")

    chatml_file = base_dir / "finetune_lab_final_dataset.jsonl"
    expert_original = Path("/home/juan-canfield/Desktop/web-ui/output/finetuning_expert_augmented.json")
    workflows_5k = base_dir / "finetuning_workflows_5k.json"

    output_file = base_dir / "finetune_lab_complete_dataset.jsonl"

    # Step 1: Load all datasets
    print("📂 Step 1: Loading all datasets...")

    chatml_examples = load_jsonl(str(chatml_file))
    print(f"  ✓ Loaded {len(chatml_examples)} ChatML examples (main dataset)")

    expert_original_examples = load_json_array(str(expert_original))
    print(f"  ✓ Loaded {len(expert_original_examples)} original expert examples")

    workflows_5k_examples = load_json_array(str(workflows_5k))
    print(f"  ✓ Loaded {len(workflows_5k_examples)} generated workflow examples")

    # Step 2: Convert all ShareGPT to ChatML
    print(f"\n🔄 Step 2: Converting ShareGPT → ChatML...")

    expert_converted = [sharegpt_to_chatml(ex) for ex in expert_original_examples]
    print(f"  ✓ Converted {len(expert_converted)} expert examples")

    workflows_converted = [sharegpt_to_chatml(ex) for ex in workflows_5k_examples]
    print(f"  ✓ Converted {len(workflows_converted)} workflow examples")

    # Step 3: Combine all datasets
    print(f"\n🔗 Step 3: Combining all datasets...")
    all_examples = chatml_examples + expert_converted + workflows_converted
    print(f"  ✓ Combined total: {len(all_examples)} examples")
    print(f"    - Main dataset: {len(chatml_examples)}")
    print(f"    - Expert workflows: {len(expert_converted)}")
    print(f"    - Generated workflows: {len(workflows_converted)}")

    # Step 4: Deduplicate
    print(f"\n🧹 Step 4: Removing duplicates...")
    unique_examples, duplicates_removed = deduplicate(all_examples)
    print(f"  ✓ Removed {duplicates_removed} duplicates")
    print(f"  ✓ Unique examples: {len(unique_examples)}")

    # Step 5: Validate
    print(f"\n✅ Step 5: Validating ChatML format...")
    validation_results = validate_dataset(unique_examples)

    print(f"  ✓ Valid examples: {validation_results['valid']}")
    print(f"  ✗ Invalid examples: {validation_results['invalid']}")

    if validation_results['invalid'] > 0:
        print(f"\n  ⚠️  Validation Errors (first 10):")
        for error in validation_results['errors'][:10]:
            print(f"    {error}")

        if validation_results['invalid'] > 10:
            print(f"    ... and {validation_results['invalid'] - 10} more")

    # Step 6: Save final dataset
    print(f"\n💾 Step 6: Saving complete dataset...")
    save_jsonl(unique_examples, str(output_file))

    # Final summary
    print(f"\n" + "="*80)
    print("COMBINATION COMPLETE")
    print("="*80 + "\n")

    print(f"📈 Final Statistics:")
    print(f"  Total unique examples: {len(unique_examples)}")
    print(f"  Valid examples: {validation_results['valid']}")
    print(f"  Duplicates removed: {duplicates_removed}")

    print(f"\n📁 Output File:")
    print(f"  {output_file}")

    # File size
    import os
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  Size: {file_size_mb:.1f} MB")

    print(f"\n✨ Ready for training!")

if __name__ == "__main__":
    main()
