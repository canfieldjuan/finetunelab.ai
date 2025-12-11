"""
YAML-Configurable Dataset Generator
Load settings from dataset_config.yaml
"""
import json
import os
import sys
import yaml
from typing import Dict, List, Any
from openai import OpenAI

def load_config(config_path: str = 'dataset_config.yaml') -> Dict[str, Any]:
    """Load configuration from YAML file"""
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)
    return config

def build_generation_prompt(config: Dict[str, Any]) -> str:
    """Build the generation prompt from config"""

    # Extract scenarios
    scenarios_text = "\n".join([
        f"{i+1}. {s['description']}"
        for i, s in enumerate(config['scenarios'])
    ])

    # Extract tools
    tools_text = "\n".join([
        f"- {tool['name']}: {json.dumps(tool['args'])}"
        for tool in config['tools']
    ])

    # Get constraints
    min_calls, max_calls = config['generation']['tool_calls_per_example']
    num_examples = config['generation']['num_examples']

    # Build prompt
    prompt = f"""Generate a finetuning expert conversation with tool calls.

Format: ShareGPT with this exact structure:
{{
  "conversations": [
    {{"from": "system", "value": "<system prompt>"}},
    {{"from": "user", "value": "<user request>"}},
    {{"from": "assistant", "value": "<tool call as JSON string>"}},
    {{"from": "assistant", "value": "<another tool call>"}},
    ...
  ]
}}

Each assistant tool call must be EXACTLY this format:
{{"tool": "tool.name", "args": {{<arguments>}}}}

Generate {num_examples} complete examples following these scenarios:
{scenarios_text}

Each example should have:
- System prompt: {config['system_prompt'][:100]}...
- User request describing their task
- {min_calls}-{max_calls} assistant tool calls in sequence

Available tools:
{tools_text}

Output as JSON array of {num_examples} examples."""

    return prompt

def generate_examples(config_path: str = 'dataset_config.yaml'):
    """Generate examples using YAML configuration"""

    # Load config
    print(f"[*] Loading configuration from {config_path}")
    config = load_config(config_path)

    # Get API settings (with fallback)
    api_key = os.getenv(config['api']['api_key_env'], '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')
    if not api_key:
        print(f"[ERROR] {config['api']['api_key_env']} not set and no fallback available")
        sys.exit(1)

    model = config['api']['model']

    # Initialize client
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )

    # Build prompt
    prompt = build_generation_prompt(config)

    print(f"[*] Generating {config['generation']['num_examples']} examples...")
    print(f"[*] Model: {model}")
    print(f"[*] Scenarios: {len(config['scenarios'])}")
    print()

    content = None
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=config['api']['temperature'],
            max_tokens=config['api']['max_tokens']
        )

        content = response.choices[0].message.content
        usage = response.usage

        print(f"[SUCCESS] Generated response")
        print(f"[*] Tokens: {usage.prompt_tokens} prompt + {usage.completion_tokens} completion = {usage.total_tokens} total")

        # Calculate cost (DeepSeek pricing)
        cost = (usage.prompt_tokens * 0.30 + usage.completion_tokens * 0.85) / 1_000_000
        print(f"[*] Cost: ${cost:.4f}")
        print()

        # Strip markdown fences if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
            content = content.strip()

        # Parse JSON
        parsed = json.loads(content)

        if isinstance(parsed, list):
            examples = parsed
        elif isinstance(parsed, dict) and 'examples' in parsed:
            examples = parsed['examples']
        else:
            examples = [parsed]

        # Save to output
        output_path = config['generation']['output_path']
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            for ex in examples:
                f.write(json.dumps(ex, ensure_ascii=False) + '\n')

        print(f"[SUCCESS] Saved {len(examples)} examples to {output_path}")
        print()
        print("[*] Configuration used:")
        print(f"  - System prompt: {config['system_prompt'][:80]}...")
        print(f"  - Scenarios: {', '.join([s['name'] for s in config['scenarios']])}")
        print(f"  - Tool calls per example: {config['generation']['tool_calls_per_example']}")
        print()
        print("[*] First example preview:")
        print(json.dumps(examples[0], indent=2, ensure_ascii=False)[:500] + "...")

    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON response: {e}")
        if content:
            print(f"[*] Raw response:\n{content}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        if content:
            print(f"[*] Response received:\n{content[:500]}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    # Allow custom config path
    config_file = sys.argv[1] if len(sys.argv) > 1 else 'dataset_config.yaml'
    generate_examples(config_file)
