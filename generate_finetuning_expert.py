"""
Generate finetuning expert training data with tool calls
Matches the format from finetuning_expert_merged.jsonl
"""
import json
import os
import sys
from typing import Dict, List
from openai import OpenAI

API_KEY = os.getenv('OPENROUTER_API_KEY', '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')
MODEL = "deepseek/deepseek-v3.2-exp"

SYSTEM_PROMPT = """You are a finetuning expert. Your goal is to help users finetune models for their specific tasks. You have access to a set of tools to help you with this. You should always follow the MLOps best practices, including: infrastructure planning, data engineering, deployment architecture, monitoring, security, and continuous learning."""

GENERATION_PROMPT = """Generate a finetuning expert conversation with tool calls.

Format: ShareGPT with this exact structure:
{
  "conversations": [
    {"from": "system", "value": "<system prompt>"},
    {"from": "user", "value": "<user request>"},
    {"from": "assistant", "value": "<tool call as JSON string>"},
    {"from": "assistant", "value": "<another tool call>"},
    ...
  ]
}

Each assistant tool call must be EXACTLY this format:
{"tool": "tool.name", "args": {<arguments>}}

Generate 5 complete examples following these scenarios:
1. Text classification on customer support tickets
2. Named entity recognition on medical records
3. Question answering on company documentation
4. Code generation for Python functions
5. Sentiment analysis with class imbalance

Each example should have:
- System prompt defining finetuning expert role
- User request describing their task
- 5-8 assistant tool calls in sequence

Available tools:
- project.init: {"project_name": "string"}
- data.find: {"task_description": "string"}
- data.preprocess: {"dataset_name": "string", "steps": ["list"]}
- model.select: {"base_model": "string", "finetuning_task": "string"}
- hyperparameters.recommend: {"model": "string", "dataset": "string"}
- script.generate: {"model": "string", "dataset": "string", "hyperparameters": {}, "is_<task>": true}
- train.run: {"script_path": "string"}
- evaluate.run: {"model_path": "string", "dataset_path": "string"}

Output as JSON array of 5 examples."""

def generate_examples():
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=API_KEY
    )

    print(f"[*] Generating 5 finetuning expert examples...")
    print(f"[*] Model: {MODEL}")
    print(f"[*] Cost: ~$0.01")
    print()

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "user", "content": GENERATION_PROMPT}
            ],
            temperature=0.8,
            max_tokens=4000
        )

        content = response.choices[0].message.content
        usage = response.usage

        print(f"[SUCCESS] Generated response")
        print(f"[*] Tokens: {usage.prompt_tokens} prompt + {usage.completion_tokens} completion = {usage.total_tokens} total")
        print(f"[*] Cost: ${(usage.prompt_tokens * 0.30 + usage.completion_tokens * 0.85) / 1_000_000:.4f}")
        print()

        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
            content = content.strip()

        parsed = json.loads(content)

        if isinstance(parsed, list):
            examples = parsed
        elif isinstance(parsed, dict) and 'examples' in parsed:
            examples = parsed['examples']
        else:
            examples = [parsed]

        output_path = 'output/finetuning_expert_generated.jsonl'
        os.makedirs('output', exist_ok=True)

        with open(output_path, 'w', encoding='utf-8') as f:
            for ex in examples:
                f.write(json.dumps(ex, ensure_ascii=False) + '\n')

        print(f"[SUCCESS] Saved {len(examples)} examples to {output_path}")
        print()
        print("[*] First example preview:")
        print(json.dumps(examples[0], indent=2, ensure_ascii=False)[:500] + "...")

    except json.JSONDecodeError as e:
        print(f"[ERROR] Invalid JSON response: {e}")
        print(f"[*] Raw response:\n{content}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

if __name__ == '__main__':
    generate_examples()
