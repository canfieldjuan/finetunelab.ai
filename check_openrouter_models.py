"""
Fetch available models from OpenRouter API
"""
import os
import requests
import json
import sys

# Try to get from env, or use command line arg
api_key = os.getenv('OPENROUTER_API_KEY')

if not api_key and len(sys.argv) > 1:
    api_key = sys.argv[1]

if not api_key:
    print("ERROR: OPENROUTER_API_KEY not set")
    print("Usage: python check_openrouter_models.py [API_KEY]")
    exit(1)

print("Fetching models from OpenRouter...")
print()

response = requests.get(
    "https://openrouter.ai/api/v1/models",
    headers={
        "Authorization": f"Bearer {api_key}",
    }
)

if response.status_code == 200:
    models = response.json()

    # Filter for cheap, fast models
    print("=" * 80)
    print("RECOMMENDED MODELS FOR DATASET GENERATION")
    print("=" * 80)
    print()

    cheap_models = []

    for model in models.get('data', []):
        model_id = model.get('id', '')
        name = model.get('name', '')
        pricing = model.get('pricing', {})

        # Get costs per 1M tokens
        input_cost = float(pricing.get('prompt', '0')) * 1_000_000
        output_cost = float(pricing.get('completion', '0')) * 1_000_000

        # Filter for cheap models (under $1 per 1M output tokens)
        if output_cost < 1.0 and output_cost > 0:
            cheap_models.append({
                'id': model_id,
                'name': name,
                'input': input_cost,
                'output': output_cost,
                'total': input_cost + output_cost
            })

    # Sort by total cost
    cheap_models.sort(key=lambda x: x['total'])

    print("ULTRA-CHEAP MODELS (Best for bulk generation):")
    print("-" * 80)
    print(f"{'Model ID':<50} {'Cost ($/1M tokens)':<20}")
    print("-" * 80)

    for i, model in enumerate(cheap_models[:15], 1):
        cost_str = f"In: ${model['input']:.2f}, Out: ${model['output']:.2f}"
        print(f"{i:2}. {model['id']:<47} {cost_str}")

    print()
    print("=" * 80)
    print("RECOMMENDED FOR TESTING:")
    print("=" * 80)

    # Find specific recommended models
    recommended = [
        'deepseek/deepseek-chat',
        'google/gemini-flash-1.5',
        'google/gemini-flash-1.5-8b',
        'meta-llama/llama-3.2-3b-instruct:free',
        'qwen/qwen-2-7b-instruct:free'
    ]

    for rec in recommended:
        for model in models.get('data', []):
            if model.get('id') == rec:
                pricing = model.get('pricing', {})
                input_cost = float(pricing.get('prompt', '0')) * 1_000_000
                output_cost = float(pricing.get('completion', '0')) * 1_000_000
                print(f"[OK] {rec}")
                print(f"  Cost: ${input_cost:.2f}/${output_cost:.2f} per 1M tokens")
                break

    print()
    print("=" * 80)
    print("To use a model, copy the 'Model ID' into the script")
    print("Example: 'deepseek/deepseek-chat'")
    print("=" * 80)

else:
    print(f"Error: {response.status_code}")
    print(response.text)
