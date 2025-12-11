#!/usr/bin/env python3
"""
Deduplicate Atlas dataset - remove duplicate Q&As
Keeps the most complete/detailed version of duplicates
"""

import json
from pathlib import Path
import hashlib
from collections import defaultdict

def get_content_hash(example):
    """Create hash from user messages only"""
    user_messages = [msg['content'] for msg in example['messages'] if msg['role'] == 'user']
    return hashlib.md5(''.join(user_messages).encode()).hexdigest()

def score_example(example):
    """Score example quality - higher is better"""
    score = 0

    # Prefer multi-turn conversations
    msg_count = len(example['messages'])
    turns = (msg_count - 1) // 2
    score += turns * 100

    # Prefer longer, more detailed responses
    for msg in example['messages']:
        if msg['role'] == 'assistant':
            score += len(msg['content']) // 10

    # Prefer Atlas-generated over DeepSeek (more personality)
    source = example.get('metadata', {}).get('source', '')
    if 'atlas' in source:
        score += 50

    return score

def deduplicate(examples):
    """Remove duplicates, keeping highest quality version"""
    seen = {}
    kept = []
    removed = []

    for i, ex in enumerate(examples):
        content_hash = get_content_hash(ex)

        if content_hash in seen:
            # Duplicate found - compare quality
            existing_idx = seen[content_hash]
            existing_score = score_example(examples[existing_idx])
            current_score = score_example(ex)

            if current_score > existing_score:
                # Current is better - replace
                removed.append({
                    'line': existing_idx + 1,
                    'kept_line': i + 1,
                    'reason': f'Replaced with better quality (score {current_score} > {existing_score})'
                })
                kept[existing_idx] = None  # Mark for removal
                kept.append(ex)
                seen[content_hash] = len(kept) - 1
            else:
                # Existing is better - skip current
                removed.append({
                    'line': i + 1,
                    'kept_line': existing_idx + 1,
                    'reason': f'Duplicate (keeping better quality, score {existing_score})'
                })
        else:
            # New unique example
            kept.append(ex)
            seen[content_hash] = len(kept) - 1

    # Filter out None values (replaced examples)
    final = [ex for ex in kept if ex is not None]

    return final, removed

def main():
    input_path = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/atlas_complete_company_dataset.jsonl")
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/completed_datasets/Fine_Tune_Lab- company-data/atlas_clean_final_dataset.jsonl")

    print("="*80)
    print("DEDUPLICATING ATLAS DATASET")
    print("="*80)
    print()

    # Load dataset
    print("📂 Loading dataset...")
    examples = []
    with open(input_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                examples.append(json.loads(line))

    print(f"   ✅ Loaded {len(examples)} examples")
    print()

    # Deduplicate
    print("🧹 Deduplicating...")
    deduplicated, removed = deduplicate(examples)

    print(f"   ✅ Removed {len(removed)} duplicates")
    print(f"   ✅ Kept {len(deduplicated)} unique examples")
    print()

    # Show sample removals
    if removed:
        print("   Sample duplicates removed:")
        for item in removed[:5]:
            print(f"      Line {item['line']}: {item['reason']}")
        if len(removed) > 5:
            print(f"      ... and {len(removed) - 5} more")
        print()

    # Analyze cleaned dataset
    from collections import Counter
    stats = {
        'single_turn': 0,
        'multi_turn': 0,
        'sources': Counter()
    }

    for ex in deduplicated:
        msg_count = len(ex['messages'])
        turns = (msg_count - 1) // 2
        if turns == 1:
            stats['single_turn'] += 1
        else:
            stats['multi_turn'] += 1

        source = ex.get('metadata', {}).get('source', 'unknown')
        stats['sources'][source] += 1

    print("="*80)
    print("📊 CLEANED DATASET STATISTICS")
    print("="*80)
    print(f"Total examples: {len(deduplicated)}")
    print(f"Single-turn: {stats['single_turn']} ({stats['single_turn']/len(deduplicated)*100:.1f}%)")
    print(f"Multi-turn: {stats['multi_turn']} ({stats['multi_turn']/len(deduplicated)*100:.1f}%)")
    print()

    print("By source:")
    for source, count in stats['sources'].most_common():
        pct = (count / len(deduplicated)) * 100
        print(f"   {source}: {count} ({pct:.1f}%)")
    print()

    # Save cleaned dataset
    with open(output_path, 'w', encoding='utf-8') as f:
        for example in deduplicated:
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    print("💾 Saved cleaned dataset to:")
    print(f"   {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()
    print("✅ DATASET IS NOW CLEAN AND READY FOR UPLOAD!")

if __name__ == "__main__":
    main()
