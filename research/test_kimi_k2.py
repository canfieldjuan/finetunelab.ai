#!/usr/bin/env python3
"""Test moonshotai/kimi-k2-0905 with 5 prompts"""

import json
import os
import asyncio
from openai import AsyncOpenAI
from datetime import datetime
from pathlib import Path

API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
MODEL_ID = "moonshotai/kimi-k2-0905"

def load_system_prompt():
    prompt_path = Path(__file__).parent / "deepseek-dpo-generation-prompt.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parts = content.split("# BATCH GENERATION REQUEST")
    return parts[0].strip()

async def test_model():
    print(f"Testing: {MODEL_ID}")
    print("=" * 60)
    
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )
    
    system_prompt = load_system_prompt()
    
    user_message = """Generate exactly 5 DPO training examples following all specifications in the system prompt.

Focus on these categories:
- Cloud Training: 1 example
- Monitoring: 1 example  
- Model Comparison Lab: 1 example
- Batch Testing: 1 example
- Analytics: 1 example

CRITICAL REQUIREMENTS:
- Each prompt MUST be 80-120 words with specific user context
- Chosen responses MUST be 250-300 words with numbered steps, bold headers, and Pro Tips
- Rejected responses MUST be 200-250 words - genuinely helpful but less specific

Return ONLY a valid JSON array with exactly 5 objects. No markdown, just raw JSON."""

    start = datetime.now()
    
    try:
        response = await client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.8,
            max_tokens=16000
        )
        
        duration = (datetime.now() - start).total_seconds()
        content = response.choices[0].message.content
        usage = response.usage
        
        print(f"Duration: {duration:.1f}s")
        print(f"Tokens: {usage.prompt_tokens} in / {usage.completion_tokens} out")
        
        # Try to parse JSON
        try:
            # Clean markdown if present
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            examples = json.loads(content.strip())
            print(f"\n✅ Parsed {len(examples)} examples successfully!")
            
            # Analyze word counts
            for i, ex in enumerate(examples):
                prompt_words = len(ex.get('prompt', '').split())
                chosen_words = len(ex.get('chosen', '').split())
                rejected_words = len(ex.get('rejected', '').split())
                category = ex.get('metadata', {}).get('category', 'Unknown')
                print(f"  {i+1}. [{category}] prompt:{prompt_words}w, chosen:{chosen_words}w, rejected:{rejected_words}w")
            
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON parse error: {e}")
            print(f"Raw content preview: {content[:500]}...")
            
    except Exception as e:
        duration = (datetime.now() - start).total_seconds()
        print(f"ERROR after {duration:.1f}s: {e}")

if __name__ == "__main__":
    asyncio.run(test_model())
