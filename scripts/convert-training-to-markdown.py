#!/usr/bin/env python3
"""
Convert JSONL training data to Markdown format for GraphRAG ingestion.

This preserves ALL data from the original file - nothing is removed.
Each Q&A pair becomes a markdown section that GraphRAG can index.
"""

import json
import re
from pathlib import Path
from datetime import datetime

INPUT_FILE = Path("/home/juan-canfield/Desktop/web-ui/output/combined_training_data.jsonl")
OUTPUT_FILE = Path("/home/juan-canfield/Desktop/web-ui/output/finetune_lab_knowledge_base.md")

def clean_thinking_tags(text: str) -> str:
    """Remove <thinking>...</thinking> blocks from assistant responses."""
    # Keep the actual answer, remove the thinking process
    return re.sub(r'<thinking>.*?</thinking>\s*', '', text, flags=re.DOTALL)

def extract_qa_pairs(jsonl_path: Path) -> list[dict]:
    """Extract all Q&A pairs from JSONL file."""
    pairs = []

    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
                messages = data.get('messages', [])

                # Extract user question and assistant answer
                user_msg = None
                assistant_msg = None

                for msg in messages:
                    role = msg.get('role', '')
                    content = msg.get('content', '')

                    if role == 'user' and not user_msg:
                        user_msg = content
                    elif role == 'assistant' and not assistant_msg:
                        assistant_msg = content

                if user_msg and assistant_msg:
                    # Clean the assistant response (remove thinking tags)
                    clean_answer = clean_thinking_tags(assistant_msg)

                    pairs.append({
                        'question': user_msg,
                        'answer': clean_answer,
                        'original_answer': assistant_msg,  # Keep original too
                        'line_num': line_num
                    })

            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse line {line_num}: {e}")
                continue

    return pairs

def categorize_qa(question: str) -> str:
    """Attempt to categorize the Q&A based on keywords."""
    q_lower = question.lower()

    if any(kw in q_lower for kw in ['error', 'nan', 'fail', 'bug', 'fix', 'issue', 'problem', 'crash']):
        return "Troubleshooting"
    elif any(kw in q_lower for kw in ['finetune', 'train', 'training', 'fine-tune', 'fine tune']):
        return "Model Training"
    elif any(kw in q_lower for kw in ['dataset', 'data', 'jsonl', 'csv', 'upload']):
        return "Datasets"
    elif any(kw in q_lower for kw in ['deploy', 'serve', 'inference', 'endpoint', 'api']):
        return "Deployment"
    elif any(kw in q_lower for kw in ['hyperparameter', 'learning rate', 'batch size', 'epoch', 'optimizer']):
        return "Hyperparameters"
    elif any(kw in q_lower for kw in ['eval', 'metric', 'benchmark', 'test', 'accuracy', 'loss']):
        return "Evaluation"
    elif any(kw in q_lower for kw in ['account', 'setting', 'profile', 'password', 'login', 'signup']):
        return "Account Management"
    elif any(kw in q_lower for kw in ['llama', 'mistral', 'gpt', 'bert', 'model']):
        return "Model Selection"
    elif any(kw in q_lower for kw in ['lora', 'qlora', 'adapter', 'peft']):
        return "LoRA and Adapters"
    elif any(kw in q_lower for kw in ['gpu', 'memory', 'vram', 'cuda', 'hardware']):
        return "Hardware and Resources"
    else:
        return "General"

def generate_markdown(pairs: list[dict]) -> str:
    """Generate markdown document from Q&A pairs."""

    # Group by category
    categories = {}
    for pair in pairs:
        cat = categorize_qa(pair['question'])
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(pair)

    # Build markdown
    lines = []

    # Header
    lines.append("# FineTune Lab Knowledge Base")
    lines.append("")
    lines.append(f"*Generated from training data on {datetime.now().strftime('%Y-%m-%d %H:%M')}*")
    lines.append(f"*Total Q&A pairs: {len(pairs)}*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Table of contents
    lines.append("## Table of Contents")
    lines.append("")
    for cat in sorted(categories.keys()):
        count = len(categories[cat])
        anchor = cat.lower().replace(' ', '-').replace('/', '-')
        lines.append(f"- [{cat}](#{anchor}) ({count} entries)")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Q&A sections by category
    for cat in sorted(categories.keys()):
        anchor = cat.lower().replace(' ', '-').replace('/', '-')
        lines.append(f"## {cat}")
        lines.append("")

        for i, pair in enumerate(categories[cat], 1):
            # Question as heading
            question = pair['question'].strip()
            # Truncate very long questions for heading
            heading = question[:200] + "..." if len(question) > 200 else question
            # Clean heading for markdown (remove special chars that break headers)
            heading = heading.replace('\n', ' ').replace('#', '').strip()

            lines.append(f"### {heading}")
            lines.append("")

            # Full question if truncated
            if len(question) > 200:
                lines.append(f"**Full Question:** {question}")
                lines.append("")

            # Answer
            lines.append(pair['answer'].strip())
            lines.append("")
            lines.append("---")
            lines.append("")

    return '\n'.join(lines)

def main():
    print(f"Reading from: {INPUT_FILE}")

    # Extract Q&A pairs
    pairs = extract_qa_pairs(INPUT_FILE)
    print(f"Extracted {len(pairs)} Q&A pairs")

    # Generate markdown
    markdown = generate_markdown(pairs)
    print(f"Generated markdown: {len(markdown)} characters")

    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(markdown)

    print(f"Written to: {OUTPUT_FILE}")

    # Print category summary
    categories = {}
    for pair in pairs:
        cat = categorize_qa(pair['question'])
        categories[cat] = categories.get(cat, 0) + 1

    print("\nCategory breakdown:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

if __name__ == "__main__":
    main()
