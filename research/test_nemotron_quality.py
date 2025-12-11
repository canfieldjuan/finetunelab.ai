#!/usr/bin/env python3
"""Test Nemotron quality - generate 1 example and inspect it"""

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

async def test_quality():
    print(f"Testing: {MODEL_ID}")
    print("=" * 70)
    print("Generating 1 example for quality inspection...")
    
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )
    
    system_prompt = load_system_prompt()
    user_message = create_user_message(1)
    
    response = await client.chat.completions.create(
        model=MODEL_ID,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        temperature=0.8,
        max_tokens=32000
    )
    
    content = response.choices[0].message.content
    
    # Parse JSON
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    
    examples = json.loads(content.strip())
    ex = examples[0]
    
    print("\n" + "=" * 70)
    print("FULL EXAMPLE FOR QUALITY REVIEW")
    print("=" * 70)
    print(json.dumps(ex, indent=2))
    
    # Quality checks
    print("\n" + "=" * 70)
    print("QUALITY CHECKLIST")
    print("=" * 70)
    
    # Check chosen response
    chosen = ex['chosen']
    print("\n1. CHOSEN RESPONSE QUALITY:")
    print(f"   - Has numbered steps: {'**1.' in chosen or '**Step' in chosen}")
    print(f"   - Has bold headers: {'**' in chosen}")
    print(f"   - Has Pro Tip: {'Pro Tip' in chosen}")
    print(f"   - Has navigation paths: {'→' in chosen or 'Go to' in chosen}")
    print(f"   - Word count: {len(chosen.split())}w")
    
    # Check rejected response
    rejected = ex['rejected']
    print("\n2. REJECTED RESPONSE QUALITY:")
    print(f"   - Is substantial: {len(rejected.split()) > 150}")
    print(f"   - Has numbered steps: {'**1.' in rejected or '**Step' in rejected}")
    print(f"   - Has Pro Tip: {'Pro Tip' in rejected}")
    print(f"   - Word count: {len(rejected.split())}w")
    
    # Check prompt
    prompt = ex['prompt']
    print("\n3. PROMPT QUALITY:")
    print(f"   - Has persona context: {any(p in prompt.lower() for p in ['intern', 'developer', 'ceo', 'architect', 'agency', 'frustrated'])}")
    print(f"   - Has specific situation: {len(prompt.split()) > 80}")
    print(f"   - Word count: {len(prompt.split())}w")
    
    # Check metadata
    metadata = ex['metadata']
    print("\n4. METADATA:")
    print(f"   - Category: {metadata.get('category')}")
    print(f"   - Topic: {metadata.get('topic')}")
    print(f"   - Chosen words: {metadata.get('chosen_words')}")
    print(f"   - Rejected words: {metadata.get('rejected_words')}")

if __name__ == "__main__":
    asyncio.run(test_quality())
