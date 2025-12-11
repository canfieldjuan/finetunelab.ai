#!/usr/bin/env python3
"""
Call DeepSeek API via OpenRouter for Features Addendum questions
"""

import os
import json
import time
import requests
from pathlib import Path

def call_deepseek(system_prompt: str, user_prompt: str, api_key: str) -> str:
    """Call DeepSeek via OpenRouter using requests"""
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "deepseek/deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.1,
        "max_tokens": 500
    }

    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    result = response.json()
    return result['choices'][0]['message']['content']

def main():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not set")
        return

    prompts_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/features_prompts.json"

    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print("="*80)
    print("CALLING DEEPSEEK API FOR FEATURES ADDENDUM QUESTIONS")
    print("="*80)
    print(f"Processing {len(prompts)} questions via OpenRouter → DeepSeek...")
    print()

    results = []

    for i, prompt_data in enumerate(prompts, 1):
        question_preview = prompt_data['question'][:80]
        print(f"[{i}/{len(prompts)}] {question_preview}...")

        try:
            answer = call_deepseek(
                prompt_data['system_prompt'],
                prompt_data['user_prompt'],
                api_key
            )

            results.append({
                "question": prompt_data['question'],
                "answer": answer
            })

            answer_preview = answer[:100].replace('\n', ' ')
            print(f"✅ {answer_preview}...")

            time.sleep(1)  # Rate limiting

        except Exception as e:
            print(f"❌ Error: {e}")
            results.append({
                "question": prompt_data['question'],
                "answer": f"ERROR: {str(e)}"
            })
            time.sleep(2)

    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/features_answers.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print()
    print("="*80)
    print(f"✅ Saved {len(results)} answers to {output_path}")
    print("="*80)

if __name__ == "__main__":
    main()
