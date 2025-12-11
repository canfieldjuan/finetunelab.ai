#!/usr/bin/env python3
"""
Add navigation examples to the complete dataset
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
            role = from_role

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

def main():
    print("\n" + "="*80)
    print("ADDING NAVIGATION EXAMPLES TO DATASET")
    print("="*80 + "\n")

    base_dir = Path("/home/juan-canfield/Desktop/web-ui/output/In_progress")

    complete_dataset = base_dir / "finetune_lab_complete_dataset.jsonl"
    navigation_examples = base_dir / "navigation_examples.json"
    output_file = base_dir / "finetune_lab_with_navigation.jsonl"

    # Load datasets
    print("📂 Loading datasets...")
    main_dataset = load_jsonl(str(complete_dataset))
    print(f"  ✓ Loaded {len(main_dataset)} examples from main dataset")

    nav_examples = load_json_array(str(navigation_examples))
    print(f"  ✓ Loaded {len(nav_examples)} navigation examples")

    # Convert navigation examples to ChatML
    print(f"\n🔄 Converting navigation examples to ChatML...")
    nav_converted = [sharegpt_to_chatml(ex) for ex in nav_examples]
    print(f"  ✓ Converted {len(nav_converted)} examples")

    # Combine
    print(f"\n🔗 Combining datasets...")
    all_examples = main_dataset + nav_converted
    print(f"  ✓ Combined total: {len(all_examples)} examples")

    # Deduplicate
    print(f"\n🧹 Removing duplicates...")
    unique_examples, duplicates_removed = deduplicate(all_examples)
    print(f"  ✓ Removed {duplicates_removed} duplicates")
    print(f"  ✓ Unique examples: {len(unique_examples)}")

    # Save
    print(f"\n💾 Saving final dataset...")
    save_jsonl(unique_examples, str(output_file))

    # Summary
    print(f"\n" + "="*80)
    print("ADDITION COMPLETE")
    print("="*80 + "\n")

    print(f"📈 Final Statistics:")
    print(f"  Original dataset: {len(main_dataset)}")
    print(f"  Navigation examples added: {len(nav_converted)}")
    print(f"  Duplicates removed: {duplicates_removed}")
    print(f"  Final total: {len(unique_examples)}")

    print(f"\n📁 Output File:")
    print(f"  {output_file}")

    import os
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  Size: {file_size_mb:.1f} MB")

    print(f"\n✨ Dataset ready with navigation capabilities!")

if __name__ == "__main__":
    main()
