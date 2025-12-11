#!/usr/bin/env python3
"""
Call DeepSeek via OpenRouter to answer FineTune Lab questions
Uses OpenRouter API to access DeepSeek models
"""

import os
import json
import time
from pathlib import Path
from openai import OpenAI

# Initialize OpenRouter client
client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1"
)

def call_deepseek(system_prompt: str, user_prompt: str, model: str = "deepseek/deepseek-chat") -> str:
    """Call DeepSeek via OpenRouter"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,  # Low temperature for factual answers
        max_tokens=500
    )
    return response.choices[0].message.content

def main():
    # Load prompts
    prompts_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_prompts.json"
    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print(f"Processing {len(prompts)} questions...")

    results = []

    for i, prompt_data in enumerate(prompts, 1):
        print(f"\n[{i}/{len(prompts)}] {prompt_data['question']}")

        try:
            answer = call_deepseek(
                prompt_data['system_prompt'],
                prompt_data['user_prompt']
            )

            results.append({
                "question": prompt_data['question'],
                "answer": answer
            })

            print(f"✅ Answer: {answer[:100]}...")

            # Rate limiting
            time.sleep(1)

        except Exception as e:
            print(f"❌ Error: {e}")
            results.append({
                "question": prompt_data['question'],
                "answer": f"ERROR: {str(e)}"
            })

    # Save results
    output_path = Path("deepseek_answers.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Saved {len(results)} answers to {output_path}")

if __name__ == "__main__":
    main()
