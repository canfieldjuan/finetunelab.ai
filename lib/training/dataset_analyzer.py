#!/usr/bin/env python3
"""
Dataset Analysis Tool
Analyzes JSONL datasets for quality, format, and statistics
Phase 1: Inspection & Analysis
Date: 2025-11-18
"""

import json
import sys
from pathlib import Path
from collections import Counter, defaultdict
from typing import Dict, List, Any, Tuple
import hashlib

def load_jsonl(file_path: str) -> List[Dict[str, Any]]:
    """Load JSONL file and return list of examples"""
    examples = []
    errors = []

    with open(file_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                examples.append(json.loads(line))
            except json.JSONDecodeError as e:
                errors.append(f"Line {line_num}: {e}")

    if errors:
        print(f"⚠️  Found {len(errors)} JSON parsing errors:")
        for error in errors[:5]:  # Show first 5
            print(f"  {error}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more")

    return examples

def detect_format(example: Dict[str, Any]) -> str:
    """Detect dataset format (ChatML, ShareGPT, etc.)"""
    if "messages" in example:
        return "chatml"
    elif "conversations" in example:
        return "sharegpt"
    elif "instruction" in example and "response" in example:
        return "alpaca"
    elif "text" in example:
        return "text"
    else:
        return "unknown"

def count_tokens_simple(text: str) -> int:
    """Simple token count estimate (whitespace split) - fallback method"""
    return len(text.split())


# === Phase 1: Real Tokenizer Integration (2025-12-07) ===

_tokenizer_cache: Dict[str, Any] = {}

def get_tokenizer(model_name: str = "gpt2"):
    """
    Get or create cached tokenizer for accurate token counting.

    Args:
        model_name: HuggingFace model name (default: gpt2 for broad compatibility)

    Returns:
        Tokenizer instance or None if loading fails
    """
    if model_name not in _tokenizer_cache:
        try:
            from transformers import AutoTokenizer
            _tokenizer_cache[model_name] = AutoTokenizer.from_pretrained(
                model_name,
                trust_remote_code=True
            )
        except Exception as e:
            print(f"Warning: Could not load tokenizer {model_name}: {e}")
            _tokenizer_cache[model_name] = None
    return _tokenizer_cache[model_name]


def count_tokens_accurate(text: str, model_name: str = "gpt2") -> int:
    """
    Accurate token count using HuggingFace tokenizer.
    Falls back to whitespace counting if tokenizer unavailable.

    Args:
        text: Text to tokenize
        model_name: HuggingFace model name for tokenizer

    Returns:
        Token count
    """
    if not text:
        return 0

    tokenizer = get_tokenizer(model_name)
    if tokenizer is None:
        return count_tokens_simple(text)

    try:
        return len(tokenizer.encode(text, add_special_tokens=False))
    except Exception:
        return count_tokens_simple(text)


def count_tokens(text: str, use_accurate: bool = True, model_name: str = "gpt2") -> int:
    """
    Count tokens in text with configurable accuracy.

    Args:
        text: Text to tokenize
        use_accurate: If True, use HuggingFace tokenizer; if False, use whitespace
        model_name: Model name for accurate tokenization

    Returns:
        Token count
    """
    if use_accurate:
        return count_tokens_accurate(text, model_name)
    return count_tokens_simple(text)


def analyze_chatml_example(example: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze a ChatML format example"""
    messages = example.get("messages", [])

    total_tokens = 0
    roles = []
    content_lengths = []

    for msg in messages:
        role = msg.get("role", "")
        content = msg.get("content", "")

        roles.append(role)
        tokens = count_tokens_simple(content)
        total_tokens += tokens
        content_lengths.append(tokens)

    return {
        "num_turns": len(messages),
        "total_tokens": total_tokens,
        "roles": roles,
        "content_lengths": content_lengths,
        "has_system": "system" in roles,
        "alternates_properly": check_role_alternation(roles),
    }

def analyze_sharegpt_example(example: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze a ShareGPT format example"""
    conversations = example.get("conversations", [])

    total_tokens = 0
    roles = []
    content_lengths = []

    for conv in conversations:
        role = conv.get("from", "")
        value = conv.get("value", "")

        roles.append(role)
        tokens = count_tokens_simple(value)
        total_tokens += tokens
        content_lengths.append(tokens)

    return {
        "num_turns": len(conversations),
        "total_tokens": total_tokens,
        "roles": roles,
        "content_lengths": content_lengths,
        "has_system": "system" in roles,
        "alternates_properly": check_role_alternation_sharegpt(roles),
    }

def check_role_alternation(roles: List[str]) -> bool:
    """Check if roles alternate properly (user/assistant)"""
    # Skip system message if present
    conversation_roles = [r for r in roles if r != "system"]

    if not conversation_roles:
        return False

    # Should start with user
    if conversation_roles[0] != "user":
        return False

    # Should alternate user/assistant
    for i in range(len(conversation_roles) - 1):
        current = conversation_roles[i]
        next_role = conversation_roles[i + 1]

        if current == "user" and next_role != "assistant":
            return False
        if current == "assistant" and next_role != "user":
            return False

    return True

def check_role_alternation_sharegpt(roles: List[str]) -> bool:
    """Check if roles alternate properly (human/gpt)"""
    conversation_roles = [r for r in roles if r != "system"]

    if not conversation_roles:
        return False

    if conversation_roles[0] != "human":
        return False

    for i in range(len(conversation_roles) - 1):
        current = conversation_roles[i]
        next_role = conversation_roles[i + 1]

        if current == "human" and next_role != "gpt":
            return False
        if current == "gpt" and next_role != "human":
            return False

    return True

def get_example_hash(example: Dict[str, Any], format_type: str) -> str:
    """Create hash of example content for duplicate detection"""
    if format_type == "chatml":
        messages = example.get("messages", [])
        content = "\n".join([f"{m.get('role', '')}:{m.get('content', '')}" for m in messages])
    elif format_type == "sharegpt":
        conversations = example.get("conversations", [])
        content = "\n".join([f"{c.get('from', '')}:{c.get('value', '')}" for c in conversations])
    else:
        content = json.dumps(example, sort_keys=True)

    return hashlib.md5(content.encode('utf-8')).hexdigest()


# === Phase 2: Outlier Detection (2025-12-07) ===

def detect_outliers(
    token_counts: List[int],
    method: str = "iqr"
) -> Dict[str, Any]:
    """
    Detect outlier examples based on token counts using statistical methods.

    Args:
        token_counts: List of token counts per example
        method: Detection method - 'iqr' (Interquartile Range) or 'zscore'

    Returns:
        Dictionary with outlier information:
        - outliers: List of outlier details (index, tokens, type/zscore)
        - method: Method used
        - threshold/bounds: Detection thresholds
        - statistics: Mean, stdev, quartiles as applicable
    """
    if len(token_counts) < 10:
        return {
            "outliers": [],
            "method": method,
            "message": "Not enough examples for outlier detection (minimum 10)"
        }

    import statistics

    if method == "zscore":
        mean = statistics.mean(token_counts)
        stdev = statistics.stdev(token_counts)

        if stdev == 0:
            return {
                "outliers": [],
                "method": method,
                "message": "All examples have identical token counts"
            }

        threshold = 3.0
        outliers = []
        for i, t in enumerate(token_counts):
            zscore = (t - mean) / stdev
            if abs(zscore) > threshold:
                outliers.append({
                    "index": i,
                    "tokens": t,
                    "zscore": round(zscore, 2),
                    "type": "high" if zscore > 0 else "low"
                })

        return {
            "outliers": outliers,
            "method": method,
            "threshold": threshold,
            "mean": round(mean, 2),
            "stdev": round(stdev, 2),
            "count": len(outliers)
        }

    else:  # IQR method (default)
        sorted_counts = sorted(token_counts)
        n = len(sorted_counts)

        # Calculate quartiles
        q1_idx = n // 4
        q3_idx = 3 * n // 4
        q1 = sorted_counts[q1_idx]
        q3 = sorted_counts[q3_idx]
        iqr = q3 - q1

        # Calculate bounds (1.5 * IQR rule)
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outliers = []
        for i, t in enumerate(token_counts):
            if t < lower_bound:
                outliers.append({
                    "index": i,
                    "tokens": t,
                    "type": "low",
                    "deviation": round(lower_bound - t, 2)
                })
            elif t > upper_bound:
                outliers.append({
                    "index": i,
                    "tokens": t,
                    "type": "high",
                    "deviation": round(t - upper_bound, 2)
                })

        return {
            "outliers": outliers,
            "method": method,
            "lower_bound": round(lower_bound, 2),
            "upper_bound": round(upper_bound, 2),
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "count": len(outliers)
        }


def calculate_quality_score(stats: Dict[str, Any]) -> int:
    """
    Calculate overall dataset quality score (0-100).

    Deductions:
    - Empty examples: -5 per percentage point
    - Malformed examples: -10 per percentage point
    - Alternation errors: -3 per percentage point
    - Duplicates: -2 per percentage point
    - Outliers: -1 per percentage point

    Args:
        stats: Dataset statistics dictionary

    Returns:
        Quality score 0-100
    """
    total = stats.get("total_examples", 1)
    if total == 0:
        return 0

    score = 100

    # Calculate percentages and apply deductions
    empty_pct = (stats.get("empty_examples", 0) / total) * 100
    malformed_pct = (stats.get("malformed_examples", 0) / total) * 100
    alternation_pct = (stats.get("alternation_errors", 0) / total) * 100
    duplicate_pct = (stats.get("duplicates", 0) / total) * 100
    outlier_pct = (stats.get("outlier_count", 0) / total) * 100

    score -= empty_pct * 5
    score -= malformed_pct * 10
    score -= alternation_pct * 3
    score -= duplicate_pct * 2
    score -= outlier_pct * 1

    return max(0, min(100, int(score)))


def analyze_dataset(file_path: str, name: str) -> Dict[str, Any]:
    """Comprehensive dataset analysis"""
    print(f"\n{'='*80}")
    print(f"Analyzing: {name}")
    print(f"File: {file_path}")
    print(f"{'='*80}\n")

    examples = load_jsonl(file_path)

    if not examples:
        print("❌ No valid examples found!")
        return {}

    # Detect format
    format_type = detect_format(examples[0])
    print(f"📋 Detected Format: {format_type.upper()}")
    print(f"📊 Total Examples: {len(examples)}")

    # Statistics containers
    stats = {
        "total_examples": len(examples),
        "format": format_type,
        "token_counts": [],
        "turn_counts": [],
        "has_system_count": 0,
        "alternation_errors": 0,
        "empty_examples": 0,
        "malformed_examples": 0,
        "duplicates": 0,
        "example_hashes": set(),
        "duplicate_hashes": [],
    }

    # Analyze each example
    for i, example in enumerate(examples):
        try:
            if format_type == "chatml":
                analysis = analyze_chatml_example(example)
            elif format_type == "sharegpt":
                analysis = analyze_sharegpt_example(example)
            else:
                continue

            stats["token_counts"].append(analysis["total_tokens"])
            stats["turn_counts"].append(analysis["num_turns"])

            if analysis["has_system"]:
                stats["has_system_count"] += 1

            if not analysis["alternates_properly"]:
                stats["alternation_errors"] += 1

            if analysis["total_tokens"] == 0:
                stats["empty_examples"] += 1

            # Check for duplicates
            example_hash = get_example_hash(example, format_type)
            if example_hash in stats["example_hashes"]:
                stats["duplicates"] += 1
                stats["duplicate_hashes"].append((i, example_hash))
            else:
                stats["example_hashes"].add(example_hash)

        except Exception as e:
            stats["malformed_examples"] += 1
            if i < 5:  # Show first 5 errors
                print(f"⚠️  Example {i}: {e}")

    # Calculate statistics
    if stats["token_counts"]:
        stats["avg_tokens"] = sum(stats["token_counts"]) / len(stats["token_counts"])
        stats["min_tokens"] = min(stats["token_counts"])
        stats["max_tokens"] = max(stats["token_counts"])
        stats["median_tokens"] = sorted(stats["token_counts"])[len(stats["token_counts"]) // 2]

    if stats["turn_counts"]:
        stats["avg_turns"] = sum(stats["turn_counts"]) / len(stats["turn_counts"])
        stats["min_turns"] = min(stats["turn_counts"])
        stats["max_turns"] = max(stats["turn_counts"])

    # Print summary
    print(f"\n📈 Statistics:")
    print(f"  Average tokens per example: {stats.get('avg_tokens', 0):.1f}")
    print(f"  Min/Max tokens: {stats.get('min_tokens', 0)} / {stats.get('max_tokens', 0)}")
    print(f"  Median tokens: {stats.get('median_tokens', 0)}")
    print(f"  Average turns: {stats.get('avg_turns', 0):.1f}")
    print(f"  Min/Max turns: {stats.get('min_turns', 0)} / {stats.get('max_turns', 0)}")

    print(f"\n🔍 Quality Checks:")
    print(f"  Examples with system message: {stats['has_system_count']}")
    print(f"  Role alternation errors: {stats['alternation_errors']}")
    print(f"  Empty examples: {stats['empty_examples']}")
    print(f"  Malformed examples: {stats['malformed_examples']}")
    print(f"  Duplicate examples: {stats['duplicates']}")

    # Token distribution
    if stats["token_counts"]:
        print(f"\n📊 Token Distribution:")
        ranges = [
            (0, 50, "Very short (0-50)"),
            (51, 100, "Short (51-100)"),
            (101, 500, "Medium (101-500)"),
            (501, 1000, "Long (501-1000)"),
            (1001, 4096, "Very long (1001-4096)"),
            (4097, float('inf'), "Extremely long (>4096)"),
        ]

        for min_tok, max_tok, label in ranges:
            count = sum(1 for t in stats["token_counts"] if min_tok <= t <= max_tok)
            pct = (count / len(stats["token_counts"])) * 100
            print(f"  {label}: {count} ({pct:.1f}%)")

    return stats

def sample_examples(file_path: str, format_type: str, n: int = 5):
    """Show sample examples from dataset"""
    print(f"\n{'='*80}")
    print(f"Sample Examples ({n} random samples)")
    print(f"{'='*80}\n")

    examples = load_jsonl(file_path)

    import random
    samples = random.sample(examples, min(n, len(examples)))

    for i, example in enumerate(samples, 1):
        print(f"\n--- Example {i} ---")
        print(json.dumps(example, indent=2, ensure_ascii=False)[:500])  # First 500 chars
        print("...")

def main():
    # File paths
    file1 = "/home/juan-canfield/Desktop/web-ui/output/In_progress/combined_chatml_dataset.jsonl"
    file2 = "/home/juan-canfield/Desktop/web-ui/output/In_progress/llama32-1b-finetune-lab-agent-dataset.jsonl"

    print("\n" + "="*80)
    print("DATASET ANALYSIS - PHASE 1: INSPECTION")
    print("="*80)

    # Analyze both datasets
    stats1 = analyze_dataset(file1, "Combined ChatML Dataset")
    stats2 = analyze_dataset(file2, "FineTune Lab Agent Dataset")

    # Show samples
    print(f"\n\n{'='*80}")
    print("SAMPLE EXAMPLES - Dataset 1 (ChatML)")
    print(f"{'='*80}")
    sample_examples(file1, "chatml", 3)

    print(f"\n\n{'='*80}")
    print("SAMPLE EXAMPLES - Dataset 2 (ShareGPT)")
    print(f"{'='*80}")
    sample_examples(file2, "sharegpt", 3)

    # Combined statistics
    print(f"\n\n{'='*80}")
    print("COMBINED DATASET PROJECTION")
    print(f"{'='*80}\n")

    total_examples = stats1.get("total_examples", 0) + stats2.get("total_examples", 0)
    total_duplicates = stats1.get("duplicates", 0) + stats2.get("duplicates", 0)

    print(f"📊 Combined Statistics:")
    print(f"  Total examples (before dedup): {total_examples}")
    print(f"  Duplicates found: {total_duplicates}")
    print(f"  Projected unique examples: {total_examples - total_duplicates}")
    print(f"  Format conversion needed: {stats2.get('total_examples', 0)} ShareGPT → ChatML")

    quality_issues = (
        stats1.get("alternation_errors", 0) + stats2.get("alternation_errors", 0) +
        stats1.get("empty_examples", 0) + stats2.get("empty_examples", 0) +
        stats1.get("malformed_examples", 0) + stats2.get("malformed_examples", 0)
    )

    print(f"\n⚠️  Quality Issues to Address:")
    print(f"  Total issues found: {quality_issues}")
    print(f"  Alternation errors: {stats1.get('alternation_errors', 0) + stats2.get('alternation_errors', 0)}")
    print(f"  Empty examples: {stats1.get('empty_examples', 0) + stats2.get('empty_examples', 0)}")
    print(f"  Malformed examples: {stats1.get('malformed_examples', 0) + stats2.get('malformed_examples', 0)}")

    print(f"\n✅ Next Steps:")
    print(f"  1. Convert ShareGPT → ChatML format")
    print(f"  2. Remove {total_duplicates} duplicates")
    print(f"  3. Fix {quality_issues} quality issues")
    print(f"  4. Validate final dataset")

    print(f"\n💾 Final dataset size estimate: ~{total_examples - total_duplicates - quality_issues} examples")

if __name__ == "__main__":
    main()
