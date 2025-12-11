#!/usr/bin/env python3
"""
Parallel DeepSeek API caller for RLHF dataset generation
Processes 2000 prompts with 10 concurrent workers for speed
"""

import os
import json
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Tuple

def call_deepseek_single(system_prompt: str, user_prompt: str, api_key: str, item_id: str) -> Tuple[str, str, str]:
    """Call DeepSeek via OpenRouter - returns (item_id, response, error)"""
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
        "temperature": 0.8,  # Higher for variety in responses
        "max_tokens": 800
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        return (item_id, content, None)
    except Exception as e:
        return (item_id, None, str(e))

def process_batch_parallel(prompts: list, api_key: str, max_workers: int = 10):
    """Process prompts in parallel with progress tracking"""
    results = {}
    total = len(prompts)
    completed = 0
    successful = 0
    failed = 0

    print(f"🚀 Processing {total} RLHF prompts with {max_workers} concurrent workers")
    print()

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_prompt = {
            executor.submit(
                call_deepseek_single,
                prompt['system_prompt'],
                prompt['user_prompt'],
                api_key,
                prompt['id']
            ): prompt for prompt in prompts
        }

        for future in as_completed(future_to_prompt):
            prompt = future_to_prompt[future]
            item_id, response, error = future.result()

            completed += 1
            progress = (completed / total) * 100
            elapsed = time.time() - start_time
            rate = completed / elapsed if elapsed > 0 else 0
            eta = (total - completed) / rate if rate > 0 else 0

            if error:
                failed += 1
                print(f"❌ [{completed}/{total}] ({progress:.1f}%) {item_id[:45]} - FAILED")
                results[item_id] = {
                    "id": item_id,
                    "prompt": prompt,
                    "response": None,
                    "error": error
                }
            else:
                successful += 1
                print(f"✅ [{completed}/{total}] ({progress:.1f}%) {item_id[:45]} - {rate:.1f}/s - ETA: {eta/60:.1f}m")
                results[item_id] = {
                    "id": item_id,
                    "prompt": prompt,
                    "response": response,
                    "error": None
                }

            time.sleep(0.1)  # Rate limiting

    elapsed = time.time() - start_time
    print()
    print(f"⏱️  Completed in {elapsed/60:.1f} minutes ({total/elapsed:.2f} req/sec)")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print()

    return [results[prompt['id']] for prompt in prompts]

def main():
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not set")
        return

    prompts_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/rlhf_generation_prompts.json")

    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print("="*80)
    print("PARALLEL RLHF DATASET GENERATION - DEEPSEEK")
    print("="*80)
    print()
    print(f"📊 Total prompts: {len(prompts)}")
    print(f"⚡ Workers: 10 concurrent")
    print(f"⏱️  Estimated time: ~{len(prompts) / 10 / 60:.1f} minutes")
    print()

    results = process_batch_parallel(prompts, api_key, max_workers=10)

    # Save results
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/rlhf_raw_responses.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    successful = sum(1 for r in results if r['error'] is None)
    failed = len(results) - successful

    print(f"💾 Saved {len(results)} responses to: {output_path}")
    print(f"📊 Final Stats: {successful} successful, {failed} failed")
    print()

    # Show category breakdown
    from collections import Counter
    by_category = Counter()
    for r in results:
        if r['error'] is None:
            category = r['prompt']['metadata']['category']
            by_category[category] += 1

    print("📋 Successful responses by category:")
    for category, count in sorted(by_category.items(), key=lambda x: -x[1]):
        print(f"   {category}: {count}")

if __name__ == "__main__":
    main()
