#!/usr/bin/env python3
"""
Call DeepSeek via OpenRouter to answer FineTune Lab questions
Uses requests library (no openai dependency needed)
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
    # Get API key
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ OPENROUTER_API_KEY not set!")
        print("Run: export OPENROUTER_API_KEY='your-key'")
        return

    # Load prompts
    prompts_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_prompts.json"
    print(f"Loading prompts from {prompts_path}...")

    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print(f"Processing {len(prompts)} questions via OpenRouter → DeepSeek...")
    print()

    results = []

    for i, prompt_data in enumerate(prompts, 1):
        print(f"[{i}/{len(prompts)}] {prompt_data['question'][:80]}...")

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

            print(f"✅ {answer[:100]}...")

            # Rate limiting (1 request per second)
            time.sleep(1)

        except Exception as e:
            print(f"❌ Error: {e}")
            results.append({
                "question": prompt_data['question'],
                "answer": f"ERROR: {str(e)}"
            })

            # Wait a bit longer on error
            time.sleep(2)

    # Save results
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_answers.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print()
    print("="*80)
    print(f"✅ Saved {len(results)} answers to {output_path}")
    print()

    # Count errors
    errors = sum(1 for r in results if r['answer'].startswith('ERROR:'))
    success = len(results) - errors

    print(f"Success: {success}/{len(results)}")
    print(f"Errors: {errors}/{len(results)}")
    print()
    print("Next step: python3 format_deepseek_dataset.py")
    print("="*80)

if __name__ == "__main__":
    main()
