#!/usr/bin/env python3
"""Quick test of single batch generation"""

import asyncio
import json
import sys
from openai import AsyncOpenAI
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(line_buffering=True)

API_KEY = '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'
MODEL_ID = 'nvidia/llama-3.3-nemotron-super-49b-v1.5'

def load_system_prompt():
    prompt_path = Path(__file__).parent / 'deepseek-dpo-generation-prompt.md'
    with open(prompt_path, 'r') as f:
        content = f.read()
    parts = content.split('# BATCH GENERATION REQUEST')
    return parts[0].strip()

async def test_single_batch():
    print('Loading system prompt...')
    system_prompt = load_system_prompt()
    print(f'System prompt: {len(system_prompt)} chars')

    user_message = """Generate exactly 5 DPO training examples.
Focus on: Monitoring, Analytics
Return ONLY valid JSON array."""

    print('Creating client...')
    client = AsyncOpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=API_KEY
    )

    print('Making API call...')
    start = datetime.now()

    response = await client.chat.completions.create(
        model=MODEL_ID,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': user_message}
        ],
        temperature=0.7,
        max_tokens=8000
    )

    duration = (datetime.now() - start).total_seconds()
    content = response.choices[0].message.content
    usage = response.usage

    print(f'Done in {duration:.1f}s')
    print(f'Tokens: {usage.prompt_tokens} in, {usage.completion_tokens} out')
    print(f'Response starts with: {content[:100]}...')

    # Parse
    try:
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0]
        examples = json.loads(content.strip())
        print(f'Parsed {len(examples)} examples successfully!')
    except Exception as e:
        print(f'Parse error: {e}')

if __name__ == '__main__':
    asyncio.run(test_single_batch())
