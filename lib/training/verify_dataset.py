#!/usr/bin/env python3
"""
Comprehensive dataset verification
Checks structure, content quality, and examples
"""

import json
import random
from typing import List, Dict, Any
from collections import Counter

def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file"""
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if line:
                try:
                    examples.append(json.loads(line))
                except json.JSONDecodeError as e:
                    print(f"❌ JSON parse error on line {line_num}: {e}")
    return examples

def verify_structure(examples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Verify basic structure"""
    print("\n📋 STRUCTURE VERIFICATION")
    print("=" * 80)

    issues = []
    message_counts = []
    role_sequences = []

    for i, example in enumerate(examples):
        # Check has messages field
        if "messages" not in example:
            issues.append(f"Example {i}: Missing 'messages' field")
            continue

        messages = example["messages"]

        # Check messages is list
        if not isinstance(messages, list):
            issues.append(f"Example {i}: 'messages' is not a list")
            continue

        # Check not empty
        if not messages:
            issues.append(f"Example {i}: Empty messages array")
            continue

        message_counts.append(len(messages))

        # Get role sequence
        roles = [m.get("role") for m in messages]
        role_sequences.append(tuple(roles))

        # Verify each message has role and content
        for j, msg in enumerate(messages):
            if "role" not in msg:
                issues.append(f"Example {i}, message {j}: Missing 'role'")
            if "content" not in msg:
                issues.append(f"Example {i}, message {j}: Missing 'content'")
            if msg.get("role") not in ["system", "user", "assistant"]:
                issues.append(f"Example {i}, message {j}: Invalid role '{msg.get('role')}'")

    print(f"Total examples: {len(examples)}")
    print(f"Structural issues found: {len(issues)}")

    if issues:
        print("\nFirst 10 issues:")
        for issue in issues[:10]:
            print(f"  - {issue}")

    # Message count statistics
    if message_counts:
        print(f"\n📊 Message Statistics:")
        print(f"  Min messages: {min(message_counts)}")
        print(f"  Max messages: {max(message_counts)}")
        print(f"  Avg messages: {sum(message_counts) / len(message_counts):.1f}")

        # Distribution
        print(f"\n  Message count distribution:")
        msg_dist = Counter(message_counts)
        for count in sorted(msg_dist.keys())[:10]:  # Top 10
            print(f"    {count} messages: {msg_dist[count]} examples")

    # Role pattern analysis
    print(f"\n👥 Role Pattern Analysis:")
    role_pattern_counts = Counter(role_sequences)
    print(f"  Unique role patterns: {len(role_pattern_counts)}")
    print(f"\n  Most common patterns:")
    for pattern, count in role_pattern_counts.most_common(5):
        pattern_str = " -> ".join(pattern)
        print(f"    {pattern_str}: {count} examples")

    return {
        "issues": issues,
        "message_counts": message_counts,
        "role_patterns": role_pattern_counts
    }

def verify_tool_calls(examples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Verify tool call formatting in assistant messages"""
    print("\n\n🔧 TOOL CALL VERIFICATION")
    print("=" * 80)

    tool_call_examples = 0
    valid_tool_calls = 0
    invalid_tool_calls = []
    tool_names = Counter()

    for i, example in enumerate(examples):
        messages = example.get("messages", [])

        has_tool_call = False
        for j, msg in enumerate(messages):
            if msg.get("role") == "assistant":
                content = msg.get("content", "")

                # Check if this looks like a tool call (starts with {)
                if content.strip().startswith("{"):
                    has_tool_call = True

                    try:
                        tool_call = json.loads(content)

                        # Verify structure
                        if "tool" in tool_call and "args" in tool_call:
                            valid_tool_calls += 1
                            tool_names[tool_call["tool"]] += 1
                        else:
                            invalid_tool_calls.append({
                                "example": i,
                                "message": j,
                                "reason": "Missing 'tool' or 'args' field",
                                "content": content[:100]
                            })
                    except json.JSONDecodeError:
                        invalid_tool_calls.append({
                            "example": i,
                            "message": j,
                            "reason": "Invalid JSON",
                            "content": content[:100]
                        })

        if has_tool_call:
            tool_call_examples += 1

    print(f"Examples with tool calls: {tool_call_examples}")
    print(f"Valid tool calls: {valid_tool_calls}")
    print(f"Invalid tool calls: {len(invalid_tool_calls)}")

    if invalid_tool_calls:
        print(f"\nFirst 5 invalid tool calls:")
        for tc in invalid_tool_calls[:5]:
            print(f"  Example {tc['example']}, msg {tc['message']}: {tc['reason']}")
            print(f"    Content: {tc['content']}...")

    print(f"\n🛠️  Top 10 Tools Used:")
    for tool, count in tool_names.most_common(10):
        print(f"  {tool}: {count}")

    return {
        "tool_call_examples": tool_call_examples,
        "valid_tool_calls": valid_tool_calls,
        "invalid_tool_calls": invalid_tool_calls,
        "tool_names": tool_names
    }

def verify_content_quality(examples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Check content quality"""
    print("\n\n✨ CONTENT QUALITY VERIFICATION")
    print("=" * 80)

    empty_content = []
    very_short = []
    very_long = []

    for i, example in enumerate(examples):
        messages = example.get("messages", [])

        for j, msg in enumerate(messages):
            content = msg.get("content", "")

            if not content or not content.strip():
                empty_content.append((i, j))
            elif len(content) < 10:
                very_short.append((i, j, len(content), content))
            elif len(content) > 10000:
                very_long.append((i, j, len(content)))

    print(f"Empty content messages: {len(empty_content)}")
    print(f"Very short messages (<10 chars): {len(very_short)}")
    print(f"Very long messages (>10k chars): {len(very_long)}")

    if very_short:
        print(f"\nFirst 5 very short messages:")
        for ex, msg, length, content in very_short[:5]:
            print(f"  Example {ex}, msg {msg} ({length} chars): '{content}'")

    return {
        "empty_content": empty_content,
        "very_short": very_short,
        "very_long": very_long
    }

def show_random_samples(examples: List[Dict[str, Any]], n: int = 5):
    """Show random examples for manual inspection"""
    print("\n\n🎲 RANDOM SAMPLE EXAMPLES")
    print("=" * 80)

    samples = random.sample(examples, min(n, len(examples)))

    for i, example in enumerate(samples, 1):
        messages = example.get("messages", [])

        print(f"\n--- Sample {i} ({len(messages)} messages) ---")

        for j, msg in enumerate(messages, 1):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")

            # Truncate long content
            if len(content) > 200:
                display_content = content[:200] + "..."
            else:
                display_content = content

            print(f"{j}. [{role.upper()}]:")
            print(f"   {display_content}")
            print()

def show_dataset_types(examples: List[Dict[str, Any]]):
    """Categorize examples by type"""
    print("\n\n📚 DATASET TYPE ANALYSIS")
    print("=" * 80)

    informational = 0
    tool_calling = 0
    debugging = 0
    deployment = 0

    for example in examples:
        messages = example.get("messages", [])

        # Check for tool calls
        has_tools = any(
            msg.get("role") == "assistant" and msg.get("content", "").strip().startswith("{")
            for msg in messages
        )

        if has_tools:
            tool_calling += 1

            # Check if debugging
            user_msgs = [m.get("content", "").lower() for m in messages if m.get("role") == "user"]
            if any("debug" in msg or "error" in msg or "nan" in msg or "overflow" in msg for msg in user_msgs):
                debugging += 1

            # Check if deployment
            if any("deploy" in msg or "infra" in msg or "pipeline" in msg for msg in user_msgs):
                deployment += 1
        else:
            informational += 1

    print(f"Informational (Q&A): {informational} ({informational*100/len(examples):.1f}%)")
    print(f"Tool-calling workflows: {tool_calling} ({tool_calling*100/len(examples):.1f}%)")
    print(f"  └─ Debugging scenarios: {debugging}")
    print(f"  └─ Deployment scenarios: {deployment}")

def main():
    dataset_path = "/home/juan-canfield/Desktop/web-ui/output/In_progress/finetune_lab_complete_dataset.jsonl"

    print("="*80)
    print("DATASET VERIFICATION REPORT")
    print(f"File: {dataset_path}")
    print("="*80)

    # Load dataset
    print("\n📥 Loading dataset...")
    examples = load_jsonl(dataset_path)
    print(f"Loaded {len(examples)} examples")

    # Run verifications
    structure_results = verify_structure(examples)
    tool_results = verify_tool_calls(examples)
    quality_results = verify_content_quality(examples)
    show_dataset_types(examples)
    show_random_samples(examples, n=3)

    # Final summary
    print("\n\n" + "="*80)
    print("VERIFICATION SUMMARY")
    print("="*80)

    total_issues = len(structure_results["issues"]) + len(quality_results["empty_content"])

    if total_issues == 0:
        print("✅ ALL CHECKS PASSED - Dataset is ready for training!")
    else:
        print(f"⚠️  Found {total_issues} issues that should be reviewed")

    print(f"\n📊 Dataset Stats:")
    print(f"  Total examples: {len(examples)}")
    print(f"  Tool-calling examples: {tool_results['tool_call_examples']}")
    print(f"  Valid tool calls: {tool_results['valid_tool_calls']}")
    print(f"  Unique tools: {len(tool_results['tool_names'])}")
    print(f"  Avg messages per example: {sum(structure_results['message_counts'])/len(structure_results['message_counts']):.1f}")

if __name__ == "__main__":
    random.seed(42)
    main()
