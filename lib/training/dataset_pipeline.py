#!/usr/bin/env python3
"""
Dataset Processing Pipeline
Combines, cleans, and validates training datasets
Phase 2-5: Format conversion, deduplication, validation
Date: 2025-11-18
"""

import json
import sys
import hashlib
from pathlib import Path
from typing import Dict, List, Any, Set
from collections import Counter
from datetime import datetime

def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file"""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples

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
    conversation_messages = [m for m in messages if m.get("role") != "system"]

    if conversation_messages:
        if conversation_messages[0].get("role") != "user":
            return False, "Conversation must start with 'user' role"

        for i in range(len(conversation_messages) - 1):
            current_role = conversation_messages[i].get("role")
            next_role = conversation_messages[i + 1].get("role")

            if current_role == next_role:
                return False, f"Consecutive {current_role} messages (alternation required)"

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

def count_tokens_simple(text: str) -> int:
    """Simple token count estimate"""
    return len(text.split())

def generate_report(examples: List[Dict[str, Any]], output_path: str):
    """Generate detailed dataset report"""
    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "total_examples": len(examples),
        "statistics": {
            "token_counts": [],
            "turn_counts": [],
            "has_system_count": 0,
            "roles_distribution": Counter(),
        }
    }

    # Gather statistics
    for example in examples:
        messages = example.get("messages", [])

        total_tokens = sum(count_tokens_simple(m.get("content", "")) for m in messages)
        report["statistics"]["token_counts"].append(total_tokens)
        report["statistics"]["turn_counts"].append(len(messages))

        for msg in messages:
            role = msg.get("role")
            if role == "system":
                report["statistics"]["has_system_count"] += 1
            report["statistics"]["roles_distribution"][role] += 1

    # Calculate aggregates
    token_counts = report["statistics"]["token_counts"]
    turn_counts = report["statistics"]["turn_counts"]

    if token_counts:
        report["statistics"]["avg_tokens"] = sum(token_counts) / len(token_counts)
        report["statistics"]["min_tokens"] = min(token_counts)
        report["statistics"]["max_tokens"] = max(token_counts)
        report["statistics"]["median_tokens"] = sorted(token_counts)[len(token_counts) // 2]

    if turn_counts:
        report["statistics"]["avg_turns"] = sum(turn_counts) / len(turn_counts)
        report["statistics"]["min_turns"] = min(turn_counts)
        report["statistics"]["max_turns"] = max(turn_counts)

    # Save report
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"📊 Report saved to: {output_path}")
    return report

def main():
    print("\n" + "="*80)
    print("DATASET PROCESSING PIPELINE")
    print("="*80 + "\n")

    # Input files
    chatml_file = "/home/juan-canfield/Desktop/web-ui/output/In_progress/combined_chatml_dataset.jsonl"
    sharegpt_file = "/home/juan-canfield/Desktop/web-ui/output/In_progress/llama32-1b-finetune-lab-agent-dataset.jsonl"

    # Output files
    output_dir = Path("/home/juan-canfield/Desktop/web-ui/output/In_progress")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    final_dataset_path = output_dir / "finetune_lab_final_dataset.jsonl"
    report_path = output_dir / f"dataset_report_{timestamp}.json"

    # Step 1: Load datasets
    print("📂 Step 1: Loading datasets...")
    chatml_examples = load_jsonl(chatml_file)
    sharegpt_examples = load_jsonl(sharegpt_file)

    print(f"  ✓ Loaded {len(chatml_examples)} ChatML examples")
    print(f"  ✓ Loaded {len(sharegpt_examples)} ShareGPT examples")

    # Step 2: Convert ShareGPT → ChatML
    print(f"\n🔄 Step 2: Converting {len(sharegpt_examples)} ShareGPT → ChatML...")
    converted_examples = [sharegpt_to_chatml(ex) for ex in sharegpt_examples]
    print(f"  ✓ Converted {len(converted_examples)} examples")

    # Step 3: Combine datasets
    print(f"\n🔗 Step 3: Combining datasets...")
    all_examples = chatml_examples + converted_examples
    print(f"  ✓ Combined total: {len(all_examples)} examples")

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
    print(f"\n💾 Step 6: Saving final dataset...")
    save_jsonl(unique_examples, str(final_dataset_path))

    # Step 7: Generate report
    print(f"\n📊 Step 7: Generating dataset report...")
    report = generate_report(unique_examples, str(report_path))

    # Final summary
    print(f"\n" + "="*80)
    print("PIPELINE COMPLETE")
    print("="*80 + "\n")

    print(f"📈 Final Statistics:")
    print(f"  Total examples: {len(unique_examples)}")
    print(f"  Average tokens: {report['statistics']['avg_tokens']:.1f}")
    print(f"  Average turns: {report['statistics']['avg_turns']:.1f}")
    print(f"  Examples with system message: {report['statistics']['has_system_count']}")
    print(f"  Valid examples: {validation_results['valid']}")

    print(f"\n📁 Output Files:")
    print(f"  Dataset: {final_dataset_path}")
    print(f"  Report: {report_path}")

    print(f"\n✨ Ready for training!")

if __name__ == "__main__":
    main()
