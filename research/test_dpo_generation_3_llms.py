#!/usr/bin/env python3
"""
Test DPO Dataset Generation across 3 LLMs via OpenRouter
Generates 25 examples from each model for comparison
"""

import json
import os
import asyncio
from openai import AsyncOpenAI
from datetime import datetime
from pathlib import Path

# OpenRouter API key
API_KEY = os.getenv('OPENROUTER_API_KEY', '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')

# Models to test
MODELS = [
    {
        "id": "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        "name": "Nemotron-Super-49B",
        "input_cost": 0.12,
        "output_cost": 0.30
    }
]

def load_prompt():
    """Load the DPO generation prompt from markdown file"""
    prompt_path = Path(__file__).parent / "deepseek-dpo-generation-prompt.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into system prompt (everything before BATCH GENERATION REQUEST)
    # and user message (the generation request)
    parts = content.split("# BATCH GENERATION REQUEST")

    system_prompt = parts[0].strip()
    user_message = """Generate exactly 5 DPO training examples following all specifications in the system prompt.

CRITICAL REQUIREMENTS FOR PROMPTS:
- Each prompt MUST be 80-120 words minimum
- Include specific user context: team size, role, technical background, what they're trying to accomplish
- Include underlying concerns about using the platform effectively
- Make prompts feel like real users with real situations, not generic questions

VARY USER PERSONAS (mix these across examples):
- Solo developer working nights/weekends on a side project
- ML intern at their first job, nervous about asking "dumb" questions
- Non-technical CEO who needs to understand what their ML team is doing
- Enterprise architect evaluating FineTune Lab for company-wide adoption
- Agency consultant setting up FineTune Lab for multiple clients
- Frustrated user who tried something and it didn't work
- Data scientist on a mid-sized team (use sparingly - this is overrepresented)

VARY SCENARIO TYPES (mix these across examples):
- "How do I use X?" (basic usage) - 40%
- "I tried X and it's not working / giving unexpected results" (troubleshooting) - 30%
- "Something broke, help me diagnose" (failure scenarios) - 20%
- Edge cases and unusual situations - 10%

CRITICAL - DO NOT INCLUDE:
- Specific dollar amounts or costs
- Specific training times or durations
- Specific hardware requirements (GPU types, VRAM)
- Specific dataset sizes or model parameters
- Any numerical claims about training performance

INSTEAD FOCUS ON:
- How to use FineTune Lab features and UI
- Platform workflows and navigation
- Qualitative guidance (what to monitor, what to look for)
- Feature benefits and capabilities

CRITICAL FOR REJECTED RESPONSES (READ CAREFULLY):
- Rejected must be 200-250 words (close to chosen length for balanced comparison)
- Rejected must be GENUINELY HELPFUL - a reasonable person might accept it
- The difference should be SUBTLE:
  * Chosen has specific feature names ("Validator Breakdown tab") vs rejected says "check the results"
  * Chosen has navigation paths ("Go to Evaluation → Model Comparison Lab") vs rejected says "use the comparison tools"
  * Chosen has Pro Tips and expert insights vs rejected gives standard advice
  * Chosen has numbered steps with headers vs rejected uses plain paragraphs
  * Chosen anticipates follow-up questions vs rejected only answers what was asked
- Rejected should NEVER be obviously wrong, dismissive, or lazy
- Both responses should be correct and substantial - chosen is just MORE specific and actionable

Focus this batch on these categories:
- Monitoring (how to use monitoring features): 1 example
- Model Comparison Lab (how to compare models): 1 example
- Batch Testing (how to set up and run tests): 1 example
- Evaluation & Feedback (how to use feedback features): 1 example
- Analytics (how to interpret analytics dashboards): 1 example

Return ONLY a valid JSON array with exactly 5 objects. No markdown, no explanation, just the JSON array."""

    return system_prompt, user_message


async def generate_with_model(client: AsyncOpenAI, model: dict, system_prompt: str, user_message: str):
    """Generate DPO examples with a specific model"""

    print(f"\n{'='*70}")
    print(f"[*] Starting generation with {model['name']}")
    print(f"[*] Model ID: {model['id']}")
    print(f"[*] Started at {datetime.now().strftime('%H:%M:%S')}")
    print('='*70)

    start_time = datetime.now()

    try:
        response = await client.chat.completions.create(
            model=model['id'],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=32000  # Need room for 25 examples
        )

        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        content = response.choices[0].message.content
        usage = response.usage
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens

        # Calculate costs
        input_cost = (input_tokens / 1_000_000) * model['input_cost']
        output_cost = (output_tokens / 1_000_000) * model['output_cost']
        total_cost = input_cost + output_cost

        # Try to parse JSON
        try:
            # Handle markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]

            examples = json.loads(content.strip())
            num_examples = len(examples) if isinstance(examples, list) else 0
            parse_success = True
        except json.JSONDecodeError as e:
            examples = []
            num_examples = 0
            parse_success = False
            print(f"[!] JSON parse error: {e}")

        result = {
            "model": model['name'],
            "model_id": model['id'],
            "success": True,
            "parse_success": parse_success,
            "num_examples": num_examples,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost,
            "duration_seconds": duration,
            "tokens_per_second": output_tokens / duration if duration > 0 else 0,
            "raw_response": content[:500] + "..." if len(content) > 500 else content,
            "examples": examples,
            "timestamp": datetime.now().isoformat()
        }

        print(f"\n[+] {model['name']} completed!")
        print(f"    Duration: {duration:.1f}s")
        print(f"    Input tokens: {input_tokens:,}")
        print(f"    Output tokens: {output_tokens:,}")
        print(f"    Speed: {output_tokens/duration:.1f} tok/s")
        print(f"    Cost: ${total_cost:.4f}")
        print(f"    Examples generated: {num_examples}")
        print(f"    JSON valid: {parse_success}")

        return result

    except Exception as e:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()

        print(f"\n[!] {model['name']} FAILED: {e}")

        return {
            "model": model['name'],
            "model_id": model['id'],
            "success": False,
            "error": str(e),
            "duration_seconds": duration,
            "timestamp": datetime.now().isoformat()
        }


async def run_test():
    """Run the test across all 3 models"""

    print("\n" + "="*70)
    print("  DPO GENERATION TEST - 3 LLMs COMPARISON")
    print("="*70)
    print(f"\nModels to test:")
    for m in MODELS:
        print(f"  - {m['name']} ({m['id']})")
    print(f"\nTarget: 5 DPO examples per model (detailed prompts)")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Load prompt
    system_prompt, user_message = load_prompt()
    print(f"\nSystem prompt length: {len(system_prompt):,} chars (~{len(system_prompt)//4:,} tokens)")

    # Create client
    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )

    # Run all models in parallel
    print("\n[*] Starting parallel generation across all 3 models...")

    tasks = [
        generate_with_model(client, model, system_prompt, user_message)
        for model in MODELS
    ]

    results = await asyncio.gather(*tasks)

    # Summary
    print("\n" + "="*70)
    print("  SUMMARY")
    print("="*70)

    total_cost = 0
    total_examples = 0

    print(f"\n{'Model':<25} {'Examples':<10} {'Tokens':<12} {'Speed':<12} {'Cost':<10} {'Status'}")
    print("-"*80)

    for r in results:
        if r['success']:
            total_cost += r['total_cost']
            total_examples += r['num_examples']
            status = "OK" if r['parse_success'] else "JSON ERR"
            print(f"{r['model']:<25} {r['num_examples']:<10} {r['output_tokens']:<12,} {r['tokens_per_second']:<12.1f} ${r['total_cost']:<9.4f} {status}")
        else:
            print(f"{r['model']:<25} {'FAILED':<10} {'-':<12} {'-':<12} {'-':<10} {r.get('error', 'Unknown')[:20]}")

    print("-"*80)
    print(f"{'TOTAL':<25} {total_examples:<10} {'':<12} {'':<12} ${total_cost:.4f}")

    # Save results
    output_dir = Path(__file__).parent / "test_results"
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Save full results
    results_file = output_dir / f"dpo_test_3llms_{timestamp}.json"
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            "test_info": {
                "timestamp": datetime.now().isoformat(),
                "models_tested": [m['name'] for m in MODELS],
                "target_examples": 5,
                "total_examples_generated": total_examples,
                "total_cost": total_cost
            },
            "results": results
        }, f, indent=2, ensure_ascii=False)

    print(f"\n[*] Full results saved to: {results_file}")

    # Save examples separately for each model
    for r in results:
        if r['success'] and r['parse_success'] and r['examples']:
            model_file = output_dir / f"examples_{r['model'].lower().replace(' ', '_').replace('-', '_').replace('.', '_')}_{timestamp}.json"
            with open(model_file, 'w', encoding='utf-8') as f:
                json.dump(r['examples'], f, indent=2, ensure_ascii=False)
            print(f"[*] {r['model']} examples saved to: {model_file}")

    print("\n" + "="*70)
    print("  TEST COMPLETE")
    print("="*70 + "\n")

    return results


if __name__ == "__main__":
    asyncio.run(run_test())
