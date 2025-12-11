#!/usr/bin/env python3
"""
Generate reasoning training data using existing SFT/DPO formats.
No new training methods needed - just enriches the assistant responses.
"""

import json
import anthropic
from pathlib import Path
from typing import List, Dict
import os

def generate_reasoning_sft(questions: List[str], output_file: str):
    """
    Generate SFT training data with reasoning.
    Uses standard 'messages' format that your trainer already supports.
    """
    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

    training_data = []

    for question in questions:
        print(f"Generating reasoning for: {question}")

        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"""Solve this problem with clear step-by-step reasoning.
Show your work before giving the final answer.

Problem: {question}"""
            }]
        )

        reasoning = response.content[0].text

        # Standard messages format - your trainer auto-detects this!
        training_data.append({
            "messages": [
                {"role": "user", "content": question},
                {"role": "assistant", "content": reasoning}
            ]
        })

    # Save as JSONL (one JSON object per line)
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for item in training_data:
            f.write(json.dumps(item) + '\n')

    print(f"\n✅ Created {len(training_data)} reasoning examples")
    print(f"📁 Saved to: {output_file}")
    print(f"\n🚀 Use with your existing SFT trainer - no code changes needed!")

    return training_data


def generate_reasoning_dpo(problems: List[Dict[str, str]], output_file: str):
    """
    Generate DPO training data with reasoning comparisons.
    Format: {"prompt": "...", "chosen": "good reasoning", "rejected": "bad reasoning"}
    """
    client = anthropic.Anthropic(api_key=os.environ.get('ANTHROPIC_API_KEY'))

    training_data = []

    for problem in problems:
        question = problem['question']
        print(f"Generating DPO pair for: {question}")

        # Generate good reasoning (chosen)
        good_response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": f"Solve step-by-step with clear reasoning: {question}"
            }]
        )

        # Generate mediocre reasoning (rejected) - higher temperature, less structured
        bad_response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            temperature=1.0,
            messages=[{
                "role": "user",
                "content": f"Quickly answer: {question}"
            }]
        )

        training_data.append({
            "prompt": question,
            "chosen": good_response.content[0].text,
            "rejected": bad_response.content[0].text
        })

    # Save as JSONL
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        for item in training_data:
            f.write(json.dumps(item) + '\n')

    print(f"\n✅ Created {len(training_data)} DPO reasoning pairs")
    print(f"📁 Saved to: {output_file}")
    print(f"\n🚀 Use with your existing DPO trainer - no code changes needed!")

    return training_data


if __name__ == "__main__":
    # Example: Generate SFT reasoning data
    math_questions = [
        "What is 15% of 240?",
        "If a train travels 120 km in 2 hours, what is its average speed in m/s?",
        "A rectangle has length 12cm and width 5cm. What is its perimeter?",
        "Solve for x: 3x + 7 = 22",
        "What is the sum of the first 10 positive integers?",
    ]

    print("=" * 60)
    print("Generating SFT Reasoning Data")
    print("=" * 60)
    generate_reasoning_sft(
        math_questions,
        "datasets/reasoning_sft_math.jsonl"
    )

    print("\n" + "=" * 60)
    print("Generating DPO Reasoning Data")
    print("=" * 60)

    dpo_problems = [
        {"question": "Calculate 25% of 80"},
        {"question": "If 5 apples cost $10, how much do 8 apples cost?"},
        {"question": "What is the area of a circle with radius 5cm? (use π ≈ 3.14)"},
    ]

    generate_reasoning_dpo(
        dpo_problems,
        "datasets/reasoning_dpo_math.jsonl"
    )

    print("\n" + "=" * 60)
    print("✅ DONE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Upload the .jsonl files to your web UI")
    print("2. Select SFT or DPO training method")
    print("3. Train normally - your trainer already handles the format!")
    print("\nNo code changes needed - it's all about the data! 🎯")
