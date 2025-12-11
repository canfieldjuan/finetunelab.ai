#!/usr/bin/env python3
"""
Multi-Turn SFT Dataset Generator for Atlas
Generates 1000 examples with 3-4 turns each via Grok-4-Fast
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
BATCH_SIZE = 1  # One conversation per batch
TOTAL_EXAMPLES = 1000
OUTPUT_DIR = Path(__file__).parent / "multiturn_sft_output"

# FineTune Lab feature categories
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

# Conversation flow types
FLOW_TYPES = [
    ("Troubleshooting", 30),  # User has problem → Atlas helps → User tries → Atlas refines
    ("Feature Exploration", 25),  # Basic question → Follow-up → Deep dive
    ("Clarification", 20),  # Vague question → Atlas asks → User clarifies → Specific answer
    ("Follow-up Questions", 15),  # Question → Answer → "What about X?" → Detailed answer
    ("Progressive Depth", 10)  # Basic → Intermediate → Advanced
]

# System prompt
ATLAS_SYSTEM_PROMPT = (
    "You are Atlas, an AI assistant built on Llama 3.2 3B and fine-tuned to be an expert guide at FineTune Lab. "
    "You help users understand the platform, guide them through features, and gently encourage them to try it. "
    "You're knowledgeable, enthusiastic, and honest about what the platform can and cannot do. "
    "When relevant, you naturally suggest sign-ups with phrases like \"Want to try this yourself? Sign up takes just 2 minutes!\" "
    "You are NOT a GPT model or an OpenAI product - you're a specialized fine-tuned Llama 3.2 3B model trained specifically for FineTune Lab support."
)


def load_system_prompt():
    """Load the clean FineTune Lab knowledge base (SFT-specific, no DPO)"""
    prompt_path = Path(__file__).parent / "finetune-lab-knowledge-base.md"
    with open(prompt_path, 'r', encoding='utf-8') as f:
        return f.read().strip()


def create_user_message(batch_num: int, num_turns: int):
    """Create user message for generating a multi-turn conversation"""

    # Pick category and flow type
    category = random.choice(CATEGORIES)

    flow_choices = []
    for flow, weight in FLOW_TYPES:
        flow_choices.extend([flow] * weight)
    flow_type = random.choice(flow_choices)

    # Pick persona with weighted distribution
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

    return f"""Generate exactly ONE multi-turn conversation with {num_turns} turns (user-assistant exchanges).

CONVERSATION REQUIREMENTS:
- Category: {category}
- Flow Type: {flow_type}
- Persona: {selected_persona}
- Turns: {num_turns} (each turn = 1 user message + 1 assistant response)

⚠️ CRITICAL - EXACT TURN COUNT REQUIRED ⚠️
YOU MUST GENERATE EXACTLY {num_turns} COMPLETE TURNS - NO MORE, NO LESS
- Total messages required: {1 + num_turns * 2} (1 system + {num_turns} user + {num_turns} assistant)
- DO NOT end the conversation early even if it feels complete after 3 turns
- DO NOT add extra turns beyond {num_turns}
- Count your messages before finishing: 1 system, then {num_turns} user-assistant pairs
- If asked for 4 turns, you MUST have 9 total messages (1 system + 4 user + 4 assistant)

FLOW TYPE GUIDANCE:

**Troubleshooting:** User describes problem → Atlas asks clarifying questions → User provides details → Atlas gives detailed solution with steps
**Feature Exploration:** User asks basic question → Atlas gives overview → User asks follow-up → Atlas provides deep dive with Pro Tips
**Clarification:** User asks vague question → Atlas asks what they need → User clarifies → Atlas gives specific targeted answer
**Follow-up Questions:** User asks question → Atlas answers → User asks "what about X?" → Atlas elaborates on X specifically
**Progressive Depth:** User asks basic → Atlas answers → User wants more detail → Atlas goes deeper → User asks advanced question → Atlas provides expert-level answer

CRITICAL REQUIREMENTS:

1. PERSONA CONSISTENCY:
   - Same user throughout the entire conversation
   - User's language/tone reflects their persona (intern = nervous, CEO = business-focused, etc.)
   - User's questions build naturally based on their role and needs

2. NATURAL CONVERSATION FLOW:
   - Each user message references previous context ("that makes sense, but...", "when you say X, do you mean...", "I tried that and...")
   - Atlas responses reference earlier exchanges ("As I mentioned earlier...", "Building on that...")
   - Realistic transitions between turns

3. USER MESSAGE REQUIREMENTS:
   - First user message: 60-120 words with full context (persona, situation, what they need)
   - Follow-up messages: 20-80 words (shorter, referencing previous context)
   - Natural language, not generic ("I tried the export but got error X" not "How do I export?")
   - Include specific details (error messages, what they tried, their constraints)

4. ATLAS RESPONSE REQUIREMENTS:
   - First response: Can be shorter if asking clarifying questions (100-200w)
   - Main detailed response: 250-350 words with numbered steps, bold headers, navigation paths
   - At least ONE response MUST have a Pro Tip section
   - Reference specific FineTune Lab features and UI paths
   - Final response should feel conclusive (not leaving user hanging)

5. CONVERSATION ENDING:
   - Last user message can be brief acknowledgment ("Perfect, thanks!" or "Got it, I'll try that")
   - OR meaningful follow-up that gets answered
   - Avoid abrupt endings

6. AVOID:
   - Generic questions like "How do I train a model?"
   - Repetitive exchanges (Atlas says same thing twice)
   - User asking same question in different words
   - Unnatural formality ("I am experiencing difficulties" - too stiff)
   - Atlas being vague (no "check the docs", be specific)

VALIDATION CHECKS (ALL MUST PASS):
✓ EXACTLY {num_turns} user-assistant exchanges ({1 + num_turns * 2} total messages)
✓ User messages reference context from previous turns
✓ At least one Atlas response has Pro Tip
✓ Conversation has clear beginning, middle, end
✓ NO early conversation endings - maintain all {num_turns} turns even if topic feels resolved

OUTPUT FORMAT:
Return ONLY valid JSON with this structure (no markdown, no code blocks, just raw JSON):

{{
  "messages": [
    {{"role": "system", "content": "{ATLAS_SYSTEM_PROMPT}"}},
    {{"role": "user", "content": "first user message"}},
    {{"role": "assistant", "content": "first Atlas response"}},
    {{"role": "user", "content": "second user message"}},
    {{"role": "assistant", "content": "second Atlas response"}}
    ... etc for {num_turns} turns
  ],
  "metadata": {{
    "source": "multi_turn_generated",
    "category": "{category}",
    "flow_type": "{flow_type}",
    "turns": {num_turns},
    "persona": "{selected_persona}"
  }}
}}

Generate the conversation now. Raw JSON only, no explanations."""


def validate_multiturn_example(data, expected_turns):
    """Validate multi-turn conversation structure"""

    if not isinstance(data, dict):
        return False, "Not a dictionary"

    if 'messages' not in data:
        return False, "Missing 'messages' field"

    messages = data['messages']
    if not isinstance(messages, list):
        return False, "'messages' is not a list"

    # Check structure: system + (user + assistant) * turns
    expected_length = 1 + (expected_turns * 2)
    if len(messages) != expected_length:
        return False, f"Expected {expected_length} messages, got {len(messages)}"

    # Validate first is system
    if messages[0]['role'] != 'system':
        return False, "First message must be system"

    # Validate alternating user/assistant
    for i in range(1, len(messages), 2):
        if messages[i]['role'] != 'user':
            return False, f"Message {i} should be user, got {messages[i]['role']}"
        if i+1 < len(messages) and messages[i+1]['role'] != 'assistant':
            return False, f"Message {i+1} should be assistant, got {messages[i+1]['role']}"

    # Validate all have content
    for i, msg in enumerate(messages):
        if 'content' not in msg or not msg['content'].strip():
            return False, f"Message {i} missing content"

    # Check metadata
    if 'metadata' not in data:
        return False, "Missing metadata"

    metadata = data['metadata']
    if 'turns' not in metadata or metadata['turns'] != expected_turns:
        return False, f"Metadata turns mismatch: expected {expected_turns}, got {metadata.get('turns')}"

    # Word count checks
    user_messages = [m for m in messages if m['role'] == 'user']
    assistant_messages = [m for m in messages if m['role'] == 'assistant']

    # First user message should be substantial
    first_user_words = len(user_messages[0]['content'].split())
    if first_user_words < 40:
        return False, f"First user message too short: {first_user_words}w (min 40w)"

    # At least one assistant response should be detailed
    max_assistant_words = max(len(m['content'].split()) for m in assistant_messages)
    if max_assistant_words < 150:
        return False, f"No detailed assistant response: max {max_assistant_words}w (min 150w)"

    # Check for Pro Tip in at least one response
    has_pro_tip = any('Pro Tip' in m['content'] for m in assistant_messages)
    if not has_pro_tip:
        return False, "No Pro Tip found in any assistant response"

    return True, None


def parse_json_response(content: str, batch_num: int, expected_turns: int):
    """Parse JSON with fallback strategies"""
    # Remove markdown code blocks
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]

    content = content.strip()

    # Try direct parse
    try:
        data = json.loads(content)
        valid, error = validate_multiturn_example(data, expected_turns)
        if not valid:
            return None, False, error
        return data, True, None
    except json.JSONDecodeError as e:
        pass

    # Try fixing common issues
    try:
        # Fix trailing commas
        fixed = re.sub(r',\s*}', '}', content)
        fixed = re.sub(r',\s*]', ']', fixed)
        data = json.loads(fixed)
        valid, error = validate_multiturn_example(data, expected_turns)
        if not valid:
            return None, False, error
        return data, True, None
    except json.JSONDecodeError:
        pass

    # Save debug file
    debug_file = OUTPUT_DIR / f"debug_batch_{batch_num}.txt"
    with open(debug_file, 'w') as f:
        f.write(content)

    return None, False, "JSON parse failed"


async def generate_batch(client: AsyncOpenAI, system_prompt: str, batch_num: int, total_batches: int, num_turns: int):
    """Generate a single multi-turn conversation"""
    user_message = create_user_message(batch_num, num_turns)

    print(f"[Batch {batch_num}/{total_batches}] Generating {num_turns}-turn conversation...")
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

        example, parse_success, error = parse_json_response(content, batch_num, num_turns)

        if parse_success:
            status = f"{num_turns}-turn OK"
        else:
            status = f"FAILED: {error}"

        print(f"[Batch {batch_num}/{total_batches}] {status}, {duration:.1f}s, ${total_cost:.4f}")
        sys.stdout.flush()

        return {
            "batch_num": batch_num,
            "success": True,
            "parse_success": parse_success,
            "example": example,
            "cost": total_cost,
            "duration": duration,
            "error": error if not parse_success else None,
            "turns": num_turns
        }

    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        print(f"[Batch {batch_num}/{total_batches}] ERROR: {e}")
        sys.stdout.flush()
        return {
            "batch_num": batch_num,
            "success": False,
            "parse_success": False,
            "example": None,
            "cost": 0,
            "duration": duration,
            "error": str(e),
            "turns": num_turns
        }


async def run_wave(client, system_prompt, batch_configs, total_batches):
    """Run a wave of batches in parallel"""
    tasks = [
        generate_batch(client, system_prompt, batch_num, total_batches, num_turns)
        for batch_num, num_turns in batch_configs
    ]
    return await asyncio.gather(*tasks)


async def run_production(concurrent_batches: int = 15):
    """Run production multi-turn generation"""

    print("="*70)
    print("  MULTI-TURN SFT DATASET GENERATION")
    print("="*70)
    print(f"  Model: {MODEL_NAME}")
    print(f"  Total conversations: {TOTAL_EXAMPLES}")
    print(f"  Turns: 3-4 per conversation")
    print(f"  Concurrent: {concurrent_batches}")
    print(f"  Est. time: ~{TOTAL_EXAMPLES * 40 / concurrent_batches / 60:.0f} min")
    print(f"  Est. cost: ~${TOTAL_EXAMPLES * 0.015:.2f}")
    print(f"  Started: {datetime.now().strftime('%H:%M:%S')}")
    print("="*70)
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

    # Create batch configs: 50% 3-turn, 50% 4-turn
    batch_configs = []
    for i in range(1, TOTAL_EXAMPLES + 1):
        num_turns = 3 if i <= TOTAL_EXAMPLES // 2 else 4
        batch_configs.append((i, num_turns))

    # Process in waves
    for wave_start in range(0, len(batch_configs), concurrent_batches):
        wave_batch_configs = batch_configs[wave_start:wave_start + concurrent_batches]
        wave_num = wave_start // concurrent_batches + 1
        total_waves = (len(batch_configs) + concurrent_batches - 1) // concurrent_batches

        print(f"\n--- Wave {wave_num}/{total_waves} (batches {wave_batch_configs[0][0]}-{wave_batch_configs[-1][0]}) ---")
        sys.stdout.flush()

        results = await run_wave(client, system_prompt, wave_batch_configs, TOTAL_EXAMPLES)

        for result in results:
            if result["success"] and result["parse_success"]:
                all_examples.append(result["example"])
                total_cost += result["cost"]
                successful += 1
            else:
                failed += 1
                total_cost += result.get("cost", 0)
                if result.get("error"):
                    print(f"  Error in batch {result['batch_num']}: {result['error']}")

        # Checkpoint every 10 waves
        if wave_num % 10 == 0:
            checkpoint = OUTPUT_DIR / f"checkpoint_{len(all_examples)}.json"
            with open(checkpoint, 'w') as f:
                json.dump(all_examples, f, indent=2, ensure_ascii=False)
            print(f"  [Checkpoint] {len(all_examples)} examples saved")
            sys.stdout.flush()

    # Final save
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    jsonl_file = OUTPUT_DIR / f"multiturn_sft_{len(all_examples)}_{timestamp}.jsonl"
    with open(jsonl_file, 'w') as f:
        for ex in all_examples:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    json_file = OUTPUT_DIR / f"multiturn_sft_{len(all_examples)}_{timestamp}.json"
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
            "total_cost": total_cost,
            "turn_distribution": {
                "3_turns": sum(1 for ex in all_examples if ex['metadata']['turns'] == 3),
                "4_turns": sum(1 for ex in all_examples if ex['metadata']['turns'] == 4)
            }
        }, f, indent=2)

    print("\n" + "="*70)
    print("  COMPLETE")
    print("="*70)
    print(f"  Examples: {len(all_examples)}")
    print(f"  Batches: {successful} ok, {failed} failed")
    print(f"  Cost: ${total_cost:.4f}")
    print(f"  JSONL: {jsonl_file.name}")
    print(f"  JSON: {json_file.name}")
    print("="*70)


if __name__ == "__main__":
    concurrent = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    asyncio.run(run_production(concurrent_batches=concurrent))
