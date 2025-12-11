#!/usr/bin/env python3
"""Test Nemotron with revised prompt - 5 examples"""

import json
import os
import asyncio
from openai import AsyncOpenAI
from datetime import datetime
import sys
sys.path.insert(0, '.')
from production_dpo_generator import create_user_message, load_system_prompt

API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
MODEL_ID = "nvidia/llama-3.3-nemotron-super-49b-v1.5"

async def test_batch():
    print(f"Testing: {MODEL_ID}")
    print("=" * 70)
    
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )
    
    system_prompt = load_system_prompt()
    
    results = []
    for i in range(1, 6):
        user_message = create_user_message(i)
        
        print(f"\nBatch {i}/5...")
        start = datetime.now()
        
        try:
            response = await client.chat.completions.create(
                model=MODEL_ID,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.8,
                max_tokens=32000
            )
            
            duration = (datetime.now() - start).total_seconds()
            content = response.choices[0].message.content
            usage = response.usage
            
            # Try to parse JSON
            try:
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]
                
                examples = json.loads(content.strip())
                
                if len(examples) == 1:
                    ex = examples[0]
                    prompt_words = len(ex['prompt'].split())
                    chosen_words = len(ex['chosen'].split())
                    rejected_words = len(ex['rejected'].split())
                    
                    results.append({
                        'success': True,
                        'prompt_words': prompt_words,
                        'chosen_words': chosen_words,
                        'rejected_words': rejected_words,
                        'category': ex['metadata']['category'],
                        'duration': duration,
                        'cost': (usage.prompt_tokens / 1_000_000) * 0.12 + (usage.completion_tokens / 1_000_000) * 0.30
                    })
                    
                    print(f"  ✅ Success: {prompt_words}w / {chosen_words}w / {rejected_words}w, {duration:.1f}s")
                else:
                    results.append({'success': False, 'reason': f'Expected 1, got {len(examples)}'})
                    print(f"  ❌ Wrong count: {len(examples)}")
                
            except json.JSONDecodeError as e:
                results.append({'success': False, 'reason': f'JSON error: {e}'})
                print(f"  ❌ JSON error")
                
        except Exception as e:
            results.append({'success': False, 'reason': str(e)})
            print(f"  ❌ Error: {e}")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    successful = [r for r in results if r.get('success')]
    print(f"Success rate: {len(successful)}/5 ({len(successful)/5*100:.0f}%)")
    
    if successful:
        avg_prompt = sum(r['prompt_words'] for r in successful) / len(successful)
        avg_chosen = sum(r['chosen_words'] for r in successful) / len(successful)
        avg_rejected = sum(r['rejected_words'] for r in successful) / len(successful)
        avg_duration = sum(r['duration'] for r in successful) / len(successful)
        total_cost = sum(r['cost'] for r in successful)
        
        print(f"\nAverage word counts:")
        print(f"  Prompts: {avg_prompt:.1f}w (target: 80-120)")
        print(f"  Chosen: {avg_chosen:.1f}w (target: 250-300)")
        print(f"  Rejected: {avg_rejected:.1f}w (target: 200-250)")
        print(f"\nAverage duration: {avg_duration:.1f}s")
        print(f"Total cost: ${total_cost:.4f}")

if __name__ == "__main__":
    asyncio.run(test_batch())
