#!/usr/bin/env python3
"""
Production DPO Dataset Generator
Generates 2000 examples in batches of 25 via OpenRouter using Nemotron-Super-49B
"""

import json
import os
import asyncio
import sys
import re
from openai import AsyncOpenAI
from datetime import datetime
from pathlib import Path
import random

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)

# Configuration
API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
MODEL_ID = "x-ai/grok-4-fast"
MODEL_NAME = "Grok-4-Fast"
BATCH_SIZE = 1
TOTAL_EXAMPLES = 100
OUTPUT_DIR = Path(__file__).parent / "dpo_production_output"

# All 16 feature categories
CATEGORIES = [
    "Cloud Training",
    "Monitoring",
    "Analytics",
    "Reporting",
    "Chat Portal Testing",
    "Model Comparison Lab",
    "Evaluation & Feedback",
    "LLM Judge System",
    "Rule-Based Validators",
    "Batch Testing",
    "Predictions Tracking",
    "AI Assistant Guidance",
    "GraphRAG Context",
    "Training Data Creation",
    "Judgment Persistence",
    "Troubleshooting & Debugging"
]


def load_system_prompt():
    """Load the main DPO generation prompt"""
    prompt_path = Path(__file__).parent / "deepseek-dpo-generation-prompt.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        content = f.read()
    parts = content.split("# BATCH GENERATION REQUEST")
    return parts[0].strip()


def create_user_message(batch_num: int):
    """Create user message for a specific batch"""
    # Pick one category for this single example
    category = random.choice(CATEGORIES)

    # Enforce persona distribution (weighted random selection)
    personas = [
        ("Solo developer working nights/weekends on a side project", 20),
        ("ML intern at their first job, nervous about asking 'dumb' questions", 15),
        ("Non-technical CEO who needs to understand what their ML team is doing", 15),
        ("Enterprise architect evaluating FineTune Lab for company-wide adoption", 15),
        ("Agency consultant setting up FineTune Lab for multiple clients", 10),
        ("Frustrated user who tried something and it didn't work", 15),
        ("Data scientist on a mid-sized team", 10)
    ]
    persona_choices = []
    for persona, weight in personas:
        persona_choices.extend([persona] * weight)
    selected_persona = random.choice(persona_choices)

    # Enforce scenario distribution (weighted random selection)
    # Need more edge cases (currently at 4.2%, target 10%)
    scenarios = [
        ("Edge case or unusual situation", 100)
    ]
    scenario_choices = []
    for scenario, weight in scenarios:
        scenario_choices.extend([scenario] * weight)
    selected_scenario = random.choice(scenario_choices)

    return f"""Generate exactly {BATCH_SIZE} DPO training example following all specifications in the system prompt.

BATCH {batch_num} - Generate 1 example for this category:
- Category: {category}

REQUIRED PERSONA FOR THIS EXAMPLE:
- {selected_persona}

REQUIRED SCENARIO TYPE FOR THIS EXAMPLE:
- {selected_scenario}

CRITICAL REQUIREMENTS FOR PROMPTS:
- Each prompt MUST be 80-120 words minimum
- Include specific user context: team size, role, technical background, what they're trying to accomplish
- Include underlying concerns about using the platform effectively
- Make prompts feel like real users with real situations, not generic questions
- MUST use the persona and scenario type specified above

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

CRITICAL FOR CHOSEN RESPONSES:
- Chosen MUST be 250-300 words minimum
- Include numbered steps with bold headers
- Reference specific FineTune Lab feature names and exact navigation paths
- Include a Pro Tip section with expert insights
- Anticipate follow-up questions

CRITICAL FOR REJECTED RESPONSES:
- Rejected MUST be 200-250 words (close to chosen length for balanced comparison)
- Rejected must be GENUINELY HELPFUL - a reasonable person might accept it
- The difference should be SUBTLE:
  * Chosen has specific feature names ("Validator Breakdown tab") vs rejected says "check the results"
  * Chosen has navigation paths ("Go to Evaluation → Model Comparison Lab") vs rejected says "use the comparison tools"
  * Chosen has Pro Tips and expert insights vs rejected gives standard advice
  * Chosen has numbered steps with headers vs rejected uses plain paragraphs
- Rejected should NEVER be obviously wrong, dismissive, or lazy
- Both responses should be correct and substantial - chosen is just MORE specific and actionable

Return ONLY a valid JSON array with exactly {BATCH_SIZE} objects. No markdown code blocks, no explanation, just the raw JSON array starting with [ and ending with ]."""


def parse_json_response(content: str, batch_num: int):
    """Parse JSON with multiple fallback strategies"""
    # Remove markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    content = content.strip()

    # Try direct parse
    try:
        return json.loads(content), True
    except json.JSONDecodeError:
        pass

    # Try fixing common issues
    try:
        # Fix trailing commas
        fixed = re.sub(r',\s*}', '}', content)
        fixed = re.sub(r',\s*]', ']', fixed)
        return json.loads(fixed), True
    except json.JSONDecodeError:
        pass

    # Save debug file
    debug_file = OUTPUT_DIR / f"debug_batch_{batch_num}.txt"
    with open(debug_file, 'w') as f:
        f.write(content)

    return [], False


async def generate_batch(client: AsyncOpenAI, system_prompt: str, batch_num: int, total_batches: int):
    """Generate a single batch of 25 examples"""
    user_message = create_user_message(batch_num)

    print(f"[Batch {batch_num}/{total_batches}] Starting...")
    sys.stdout.flush()

    start_time = datetime.now()

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

        duration = (datetime.now() - start_time).total_seconds()
        content = response.choices[0].message.content
        usage = response.usage

        input_cost = (usage.prompt_tokens / 1_000_000) * 0.12
        output_cost = (usage.completion_tokens / 1_000_000) * 0.30
        total_cost = input_cost + output_cost

        examples, parse_success = parse_json_response(content, batch_num)
        num_examples = len(examples) if isinstance(examples, list) else 0

        status = f"{num_examples} examples" if parse_success else "JSON ERROR"
        print(f"[Batch {batch_num}/{total_batches}] Done: {status}, {duration:.1f}s, ${total_cost:.4f}")
        sys.stdout.flush()

        return {
            "batch_num": batch_num,
            "success": True,
            "parse_success": parse_success,
            "examples": examples,
            "num_examples": num_examples,
            "cost": total_cost,
            "duration": duration
        }

    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        print(f"[Batch {batch_num}/{total_batches}] FAILED: {e}")
        sys.stdout.flush()
        return {
            "batch_num": batch_num,
            "success": False,
            "parse_success": False,
            "examples": [],
            "num_examples": 0,
            "cost": 0,
            "duration": duration,
            "error": str(e)
        }


async def run_wave(client, system_prompt, batch_nums, total_batches):
    """Run a wave of batches in parallel"""
    tasks = [
        generate_batch(client, system_prompt, batch_num, total_batches)
        for batch_num in batch_nums
    ]
    return await asyncio.gather(*tasks)


async def run_production(concurrent_batches: int = 3):
    """Run production generation in waves"""
    total_batches = TOTAL_EXAMPLES // BATCH_SIZE

    print("=" * 70)
    print("  DPO PRODUCTION DATASET GENERATION")
    print("=" * 70)
    print(f"  Model: {MODEL_NAME}")
    print(f"  Total examples: {TOTAL_EXAMPLES}")
    print(f"  Batches: {total_batches} x {BATCH_SIZE}")
    print(f"  Concurrent: {concurrent_batches}")
    print(f"  Est. time: ~{total_batches * 50 / concurrent_batches / 60:.0f} min")
    print(f"  Est. cost: ~${total_batches * 0.01:.2f}")
    print(f"  Started: {datetime.now().strftime('%H:%M:%S')}")
    print("=" * 70)
    sys.stdout.flush()

    OUTPUT_DIR.mkdir(exist_ok=True)
    system_prompt = load_system_prompt()

    client = AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )

    all_examples = []
    total_cost = 0
    successful = 0
    failed = 0

    # Process batches in parallel waves
    all_batch_nums = list(range(1, total_batches + 1))

    for wave_start in range(0, len(all_batch_nums), concurrent_batches):
        wave_batch_nums = all_batch_nums[wave_start:wave_start + concurrent_batches]
        wave_num = wave_start // concurrent_batches + 1
        total_waves = (len(all_batch_nums) + concurrent_batches - 1) // concurrent_batches

        print(f"\n--- Wave {wave_num}/{total_waves} (batches {wave_batch_nums[0]}-{wave_batch_nums[-1]}) ---")
        sys.stdout.flush()

        results = await run_wave(client, system_prompt, wave_batch_nums, total_batches)

        for result in results:
            if result["success"] and result["parse_success"]:
                all_examples.extend(result["examples"])
                total_cost += result["cost"]
                successful += 1
            else:
                failed += 1
                total_cost += result.get("cost", 0)

        # Checkpoint every 5 waves
        if wave_num % 5 == 0:
            checkpoint = OUTPUT_DIR / f"checkpoint_{len(all_examples)}.json"
            with open(checkpoint, 'w') as f:
                json.dump(all_examples, f, indent=2, ensure_ascii=False)
            print(f"  [Checkpoint] {len(all_examples)} examples saved")
            sys.stdout.flush()

    # Final save
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    jsonl_file = OUTPUT_DIR / f"dpo_dataset_{len(all_examples)}_{timestamp}.jsonl"
    with open(jsonl_file, 'w') as f:
        for ex in all_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    json_file = OUTPUT_DIR / f"dpo_dataset_{len(all_examples)}_{timestamp}.json"
    with open(json_file, 'w') as f:
        json.dump(all_examples, f, indent=2, ensure_ascii=False)

    meta_file = OUTPUT_DIR / f"metadata_{timestamp}.json"
    with open(meta_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "model": MODEL_ID,
            "total_examples": len(all_examples),
            "target_examples": TOTAL_EXAMPLES,
            "successful_batches": successful,
            "failed_batches": failed,
            "total_cost": total_cost
        }, f, indent=2)

    print("\n" + "=" * 70)
    print("  COMPLETE")
    print("=" * 70)
    print(f"  Examples: {len(all_examples)}")
    print(f"  Batches: {successful} ok, {failed} failed")
    print(f"  Cost: ${total_cost:.4f}")
    print(f"  JSONL: {jsonl_file.name}")
    print(f"  JSON: {json_file.name}")
    print("=" * 70)


if __name__ == "__main__":
    concurrent = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    asyncio.run(run_production(concurrent_batches=concurrent))
