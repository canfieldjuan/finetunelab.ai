#!/usr/bin/env python3
"""
Validate Atlas dataset for Fine Tune Lab upload
Checks format, structure, duplicates, and quality
"""

import json
from pathlib import Path
from collections import defaultdict, Counter
import hashlib

def validate_example(example, line_num):
    """Validate a single training example"""
    issues = []

    # Check required fields
    if 'messages' not in example:
        issues.append(f"Line {line_num}: Missing 'messages' field")
        return issues

    messages = example['messages']

    # Check messages is a list
    if not isinstance(messages, list):
        issues.append(f"Line {line_num}: 'messages' must be a list")
        return issues

    # Check minimum message count (system + user + assistant = 3)
    if len(messages) < 3:
        issues.append(f"Line {line_num}: Need at least 3 messages (system, user, assistant)")

    # Validate message structure
    for i, msg in enumerate(messages):
        if 'role' not in msg:
            issues.append(f"Line {line_num}, message {i}: Missing 'role' field")
        elif msg['role'] not in ['system', 'user', 'assistant']:
            issues.append(f"Line {line_num}, message {i}: Invalid role '{msg['role']}'")

        if 'content' not in msg:
            issues.append(f"Line {line_num}, message {i}: Missing 'content' field")
        elif not isinstance(msg['content'], str):
            issues.append(f"Line {line_num}, message {i}: 'content' must be string")
        elif not msg['content'].strip():
            issues.append(f"Line {line_num}, message {i}: Empty content")

    # Check message order
    if len(messages) >= 1 and messages[0].get('role') != 'system':
        issues.append(f"Line {line_num}: First message should be 'system'")

    # Check alternating user/assistant after system
    for i in range(1, len(messages) - 1, 2):
        if messages[i].get('role') != 'user':
            issues.append(f"Line {line_num}, message {i}: Expected 'user' role")
        if i + 1 < len(messages) and messages[i + 1].get('role') != 'assistant':
            issues.append(f"Line {line_num}, message {i+1}: Expected 'assistant' role")

    return issues

def check_duplicates(examples):
    """Check for duplicate examples based on content hash"""
    seen = {}
    duplicates = []

    for i, ex in enumerate(examples):
        # Create hash of user messages only (ignore system prompt variations)
        user_messages = [msg['content'] for msg in ex['messages'] if msg['role'] == 'user']
        content_hash = hashlib.md5(''.join(user_messages).encode()).hexdigest()

        if content_hash in seen:
            duplicates.append({
                'line1': seen[content_hash],
                'line2': i + 1,
                'content': user_messages[0][:100] if user_messages else ''
            })
        else:
            seen[content_hash] = i + 1

    return duplicates

def analyze_dataset(examples):
    """Analyze dataset statistics"""
    stats = {
        'total': len(examples),
        'single_turn': 0,
        'multi_turn': 0,
        'message_counts': Counter(),
        'content_lengths': [],
        'sources': Counter(),
        'system_prompts': Counter()
    }

    for ex in examples:
        msg_count = len(ex['messages'])
        stats['message_counts'][msg_count] += 1

        # Count turns (user-assistant pairs)
        turns = (msg_count - 1) // 2
        if turns == 1:
            stats['single_turn'] += 1
        else:
            stats['multi_turn'] += 1

        # Content length
        total_chars = sum(len(msg['content']) for msg in ex['messages'])
        stats['content_lengths'].append(total_chars)

        # Source
        source = ex.get('metadata', {}).get('source', 'unknown')
        stats['sources'][source] += 1

        # System prompt
        if ex['messages'][0]['role'] == 'system':
            system_prompt = ex['messages'][0]['content'][:100]
            stats['system_prompts'][system_prompt] += 1

    return stats

def main():
    dataset_path = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/atlas_complete_company_dataset.jsonl")

    print("="*80)
    print("VALIDATING ATLAS DATASET FOR FINE TUNE LAB")
    print("="*80)
    print()

    # Load dataset
    print("📂 Loading dataset...")
    examples = []
    load_errors = []

    with open(dataset_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            try:
                example = json.loads(line)
                examples.append(example)
            except json.JSONDecodeError as e:
                load_errors.append(f"Line {i}: JSON decode error: {e}")

    print(f"   ✅ Loaded {len(examples)} examples")

    if load_errors:
        print(f"   ⚠️  {len(load_errors)} load errors:")
        for err in load_errors[:5]:
            print(f"      {err}")
        if len(load_errors) > 5:
            print(f"      ... and {len(load_errors) - 5} more")
    print()

    # Validate structure
    print("🔍 Validating structure...")
    all_issues = []
    for i, ex in enumerate(examples, 1):
        issues = validate_example(ex, i)
        all_issues.extend(issues)

    if all_issues:
        print(f"   ⚠️  Found {len(all_issues)} structural issues:")
        for issue in all_issues[:10]:
            print(f"      {issue}")
        if len(all_issues) > 10:
            print(f"      ... and {len(all_issues) - 10} more")
    else:
        print("   ✅ All examples have valid structure")
    print()

    # Check duplicates
    print("🔍 Checking for duplicates...")
    duplicates = check_duplicates(examples)
    if duplicates:
        print(f"   ⚠️  Found {len(duplicates)} potential duplicates:")
        for dup in duplicates[:5]:
            print(f"      Lines {dup['line1']} and {dup['line2']}: {dup['content']}...")
        if len(duplicates) > 5:
            print(f"      ... and {len(duplicates) - 5} more")
    else:
        print("   ✅ No duplicates found")
    print()

    # Analyze dataset
    print("📊 Analyzing dataset...")
    stats = analyze_dataset(examples)

    print(f"   Total examples: {stats['total']}")
    print(f"   Single-turn: {stats['single_turn']} ({stats['single_turn']/stats['total']*100:.1f}%)")
    print(f"   Multi-turn: {stats['multi_turn']} ({stats['multi_turn']/stats['total']*100:.1f}%)")
    print()

    print("   Message counts:")
    for count, freq in sorted(stats['message_counts'].items())[:10]:
        print(f"      {count} messages: {freq} examples")
    print()

    avg_length = sum(stats['content_lengths']) / len(stats['content_lengths'])
    min_length = min(stats['content_lengths'])
    max_length = max(stats['content_lengths'])
    print(f"   Content length (chars):")
    print(f"      Average: {avg_length:.0f}")
    print(f"      Min: {min_length}")
    print(f"      Max: {max_length}")
    print()

    print("   Sources:")
    for source, count in stats['sources'].most_common():
        print(f"      {source}: {count}")
    print()

    print("   System prompts (unique):")
    print(f"      Found {len(stats['system_prompts'])} unique system prompts")
    if len(stats['system_prompts']) > 1:
        print("      Note: Multiple system prompts detected")
        for prompt, count in stats['system_prompts'].most_common(3):
            print(f"         '{prompt}...': {count} examples")
    print()

    # Final verdict
    print("="*80)
    print("📋 VALIDATION SUMMARY")
    print("="*80)

    critical_issues = len(load_errors) + len([i for i in all_issues if 'Missing' in i or 'Invalid' in i])

    if critical_issues == 0 and len(duplicates) == 0:
        print("✅ DATASET IS CLEAN AND READY FOR UPLOAD!")
        print()
        print(f"   📁 File: {dataset_path}")
        print(f"   📊 Examples: {len(examples)}")
        print(f"   📏 Size: {dataset_path.stat().st_size:,} bytes")
        print(f"   ✨ Format: Valid JSONL")
        print()
    elif critical_issues == 0:
        print("⚠️  DATASET HAS MINOR ISSUES (duplicates)")
        print(f"   {len(duplicates)} duplicate examples found")
        print("   Consider deduplication before upload")
        print()
    else:
        print("❌ DATASET HAS CRITICAL ISSUES")
        print(f"   Load errors: {len(load_errors)}")
        print(f"   Structural issues: {len(all_issues)}")
        print(f"   Duplicates: {len(duplicates)}")
        print("   Please fix issues before upload")
        print()

if __name__ == "__main__":
    main()
