#!/usr/bin/env python3
"""
Parallel DeepSeek API caller - 5-10x faster than sequential
Uses ThreadPoolExecutor for concurrent API requests
"""

import os
import json
import time
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Tuple

def call_deepseek_single(system_prompt: str, user_prompt: str, api_key: str, item_id: str) -> Tuple[str, str, str]:
    """
    Call DeepSeek via OpenRouter - returns (item_id, response, error)
    """
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
        "temperature": 0.7,  # Higher for creative multi-turn conversations
        "max_tokens": 2000  # More tokens for multi-turn dialogues
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        return (item_id, content, None)
    except Exception as e:
        return (item_id, None, str(e))

def process_batch_parallel(prompts: List[Dict], api_key: str, max_workers: int = 8) -> List[Dict]:
    """
    Process prompts in parallel using ThreadPoolExecutor

    Args:
        prompts: List of dicts with 'id', 'system_prompt', 'user_prompt'
        api_key: OpenRouter API key
        max_workers: Number of concurrent threads (default 8)

    Returns:
        List of results with responses
    """
    results = {}
    total = len(prompts)
    completed = 0

    print(f"🚀 Processing {total} prompts with {max_workers} concurrent workers")
    print()

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_prompt = {
            executor.submit(
                call_deepseek_single,
                prompt['system_prompt'],
                prompt['user_prompt'],
                api_key,
                prompt['id']
            ): prompt for prompt in prompts
        }

        # Process completed tasks as they finish
        for future in as_completed(future_to_prompt):
            prompt = future_to_prompt[future]
            item_id, response, error = future.result()

            completed += 1
            progress = (completed / total) * 100

            if error:
                print(f"❌ [{completed}/{total}] {item_id}: {error[:60]}")
                results[item_id] = {
                    "id": item_id,
                    "prompt": prompt,
                    "response": None,
                    "error": error
                }
            else:
                preview = response[:80].replace('\n', ' ') if response else ""
                print(f"✅ [{completed}/{total}] ({progress:.1f}%) {item_id}: {preview}...")
                results[item_id] = {
                    "id": item_id,
                    "prompt": prompt,
                    "response": response,
                    "error": None
                }

            # Small delay to avoid rate limiting
            time.sleep(0.1)

    elapsed = time.time() - start_time
    print()
    print(f"⏱️  Completed {total} requests in {elapsed:.1f}s ({total/elapsed:.1f} req/sec)")
    print(f"💡 Speedup vs sequential: ~{(total * 1.0) / elapsed:.1f}x faster")
    print()

    # Return results in original order
    return [results[prompt['id']] for prompt in prompts]

def main():
    """Example usage"""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        print("❌ Error: OPENROUTER_API_KEY not set")
        return

    # Example: Load prompts from file
    prompts_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_prompts.json")

    if not prompts_path.exists():
        print(f"❌ Prompts file not found: {prompts_path}")
        return

    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print("="*80)
    print("PARALLEL DEEPSEEK API CALLER - ATLAS Q&A GENERATION")
    print("="*80)
    print()

    # Process in parallel
    results = process_batch_parallel(prompts, api_key, max_workers=8)

    # Save results
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_responses.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved {len(results)} results to: {output_path}")

    # Statistics
    successful = sum(1 for r in results if r['error'] is None)
    failed = len(results) - successful
    print(f"📊 Success: {successful}, Failed: {failed}")

if __name__ == "__main__":
    main()
