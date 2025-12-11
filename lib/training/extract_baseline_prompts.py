#!/usr/bin/env python3
"""
Extract just the user prompts from baseline test set
For manual testing via portal UI
"""

import json
from pathlib import Path

def extract_prompts():
    input_file = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/baseline_test_set_50_chatml.jsonl")
    output_file = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/baseline_test_50_prompts_only.txt")

    prompts = []

    print("📝 Extracting prompts from baseline test set...\n")

    with open(input_file, 'r', encoding='utf-8') as f:
        for line in f:
            test = json.loads(line.strip())

            # Find the user message
            for msg in test['messages']:
                if msg['role'] == 'user':
                    prompts.append({
                        'id': test['id'],
                        'question': msg['content'],
                        'category': test['category'],
                        'difficulty': test['difficulty']
                    })
                    break

    # Save prompts only (clean format)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("FINETUNE LAB - 50 BASELINE TEST PROMPTS\n")
        f.write("Copy-paste these into your portal for manual testing\n")
        f.write("="*80 + "\n\n")

        for i, p in enumerate(prompts, 1):
            f.write(f"{i}. {p['question']}\n\n")

    # Also save numbered with metadata
    output_detailed = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/baseline_test_50_prompts_detailed.txt")
    with open(output_detailed, 'w', encoding='utf-8') as f:
        f.write("FINETUNE LAB - 50 BASELINE TEST PROMPTS (WITH METADATA)\n")
        f.write("="*80 + "\n\n")

        for i, p in enumerate(prompts, 1):
            f.write(f"TEST {i:02d} - [{p['category']}] [{p['difficulty']}]\n")
            f.write(f"{p['question']}\n")
            f.write("\n" + "-"*80 + "\n\n")

    print(f"✅ Extracted {len(prompts)} prompts\n")
    print(f"📁 Output Files:")
    print(f"   1. {output_file.name}")
    print(f"      → Clean format: just questions, numbered 1-50")
    print(f"\n   2. {output_detailed.name}")
    print(f"      → With metadata: category and difficulty\n")

    # Print first 5 as preview
    print("📋 Preview (first 5 prompts):")
    print("="*80)
    for i, p in enumerate(prompts[:5], 1):
        print(f"{i}. {p['question']}\n")
    print("="*80 + "\n")

    print("💡 Usage:")
    print("   1. Open the prompts_only.txt file")
    print("   2. Copy each question")
    print("   3. Paste into your portal chat")
    print("   4. Save the response")
    print("   5. Repeat for all 50 questions")
    print("   6. Do this BEFORE training (base model)")
    print("   7. Do this AFTER training (fine-tuned model)")
    print("   8. Compare responses\n")

if __name__ == "__main__":
    extract_prompts()
