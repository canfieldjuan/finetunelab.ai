#!/usr/bin/env python3
"""Single test to verify revised prompt works"""

import json
import os
import asyncio
from openai import AsyncOpenAI
from datetime import datetime
import sys
sys.path.insert(0, '.')
from production_dpo_generator import create_user_message, load_system_prompt

API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
MODEL_ID = "anthropic/claude-haiku-4.5"

async def test_single():
    print("Testing single example with revised prompt...")
    print("=" * 70)
    
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )
    
    system_prompt = load_system_prompt()
    user_message = create_user_message(1)
    
    print("USER MESSAGE SENT:")
    print(user_message[:500] + "...")
    print()
    
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
        
        print(f"Duration: {duration:.1f}s")
        print(f"Tokens: {usage.prompt_tokens} in / {usage.completion_tokens} out")
        
        # Try to parse JSON
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            examples = json.loads(content.strip())
            
            if len(examples) == 1:
                ex = examples[0]
                print(f"\n✅ SUCCESS - Parsed 1 example")
                print(f"   Prompt: {len(ex['prompt'].split())}w")
                print(f"   Chosen: {len(ex['chosen'].split())}w")
                print(f"   Rejected: {len(ex['rejected'].split())}w")
                print(f"   Category: {ex['metadata']['category']}")
                
                # Check persona match
                prompt_lower = ex['prompt'].lower()
                print(f"\n   Checking persona compliance...")
                if 'intern' in prompt_lower:
                    print(f"   ✅ Contains intern persona")
                elif 'solo' in prompt_lower or 'side project' in prompt_lower:
                    print(f"   ✅ Contains solo dev persona")
                elif 'ceo' in prompt_lower:
                    print(f"   ✅ Contains CEO persona")
                elif 'enterprise' in prompt_lower or 'architect' in prompt_lower:
                    print(f"   ✅ Contains enterprise persona")
                elif 'agency' in prompt_lower or 'consultant' in prompt_lower:
                    print(f"   ✅ Contains agency persona")
                elif 'frustrated' in prompt_lower:
                    print(f"   ✅ Contains frustrated user persona")
                else:
                    print(f"   ⚠️  Persona unclear")
                
                return True
            else:
                print(f"❌ FAIL - Expected 1 example, got {len(examples)}")
                return False
            
        except json.JSONDecodeError as e:
            print(f"\n❌ JSON parse error: {e}")
            print(f"Content preview: {content[:500]}...")
            return False
            
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    result = asyncio.run(test_single())
    sys.exit(0 if result else 1)
