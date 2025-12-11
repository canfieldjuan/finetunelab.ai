#!/usr/bin/env python3
"""
Prepare DeepSeek prompts for Features Addendum questions
"""

import json
from pathlib import Path

def prepare_prompts():
    """Load questions and KB, create prompts"""

    # Load questions
    questions_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_questions.txt")
    questions = questions_path.read_text(encoding='utf-8').strip().split('\n')

    # Load knowledge base
    kb_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_addendum_kb.txt")
    knowledge_base = kb_path.read_text(encoding='utf-8')

    # Create prompts
    prompts = []

    system_prompt = f"""You are a helpful documentation assistant for FineTune Lab. Use the knowledge base below to answer questions accurately and concisely.

KNOWLEDGE BASE:
{knowledge_base}

Answer questions based ONLY on the information in the knowledge base. If something is not covered, say so. Keep answers clear and direct."""

    for question in questions:
        if question.strip():
            prompts.append({
                "question": question.strip(),
                "system_prompt": system_prompt,
                "user_prompt": question.strip()
            })

    return prompts

def main():
    print("="*80)
    print("PREPARING FEATURES ADDENDUM PROMPTS FOR DEEPSEEK")
    print("="*80)
    print()

    prompts = prepare_prompts()

    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_prompts.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)

    print(f"✅ Created {len(prompts)} prompts!")
    print(f"📁 Location: {output_path}")
    print(f"📊 File size: {output_path.stat().st_size:,} bytes")
    print()

    # Verification
    print("📋 Verification:")
    print(f"   Total prompts: {len(prompts)}")
    print(f"   Knowledge base included: {len(prompts[0]['system_prompt']) > 10000}")
    print(f"   Sample question: {prompts[0]['question'][:80]}...")
    print()

if __name__ == "__main__":
    main()
