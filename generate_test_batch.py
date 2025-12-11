import json
import os
from openai import OpenAI

def extract_test_batch(source_file: str, num_examples: int = 50):
    print(f"[*] Loading batch from {source_file}")

    with open(source_file, 'r', encoding='utf-8') as f:
        batch_data = json.load(f)

    system_prompt = batch_data['metadata']['system_prompt']
    all_examples = batch_data['data']

    test_examples = all_examples[:num_examples]

    print(f"[*] Extracted {len(test_examples)} examples for testing")

    return system_prompt, test_examples, batch_data['metadata']

def generate_marcus_response(client, system_prompt: str, user_message: str, example_num: int):
    print(f"[*] Generating response for example {example_num}...")

    try:
        response = client.chat.completions.create(
            model="deepseek/deepseek-v3.2-exp",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.7,
            max_tokens=5000
        )

        assistant_response = response.choices[0].message.content

        usage = response.usage
        input_tokens = usage.prompt_tokens
        output_tokens = usage.completion_tokens

        cost_input = (input_tokens / 1_000_000) * 0.27
        cost_output = (output_tokens / 1_000_000) * 1.10
        total_cost = cost_input + cost_output

        print(f"  Tokens: {output_tokens} output, {input_tokens} input")
        print(f"  Cost: ${total_cost:.4f}")

        return assistant_response, input_tokens, output_tokens, total_cost

    except Exception as e:
        print(f"  ERROR: {e}")
        return None, 0, 0, 0

def process_test_batch(source_file: str, output_file: str, num_examples: int = 50):
    api_key = os.getenv('OPENROUTER_API_KEY', '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')
    if not api_key:
        print("[!] Error: OPENROUTER_API_KEY not found in environment")
        return

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key
    )

    system_prompt, test_examples, metadata = extract_test_batch(source_file, num_examples)

    results = []
    total_input_tokens = 0
    total_output_tokens = 0
    total_cost = 0.0
    successful = 0
    failed = 0

    print(f"\n[*] Processing {len(test_examples)} examples with DeepSeek V3.2...")
    print("="*70)

    for i, example in enumerate(test_examples, 1):
        user_message = example['conversations'][0]['value']

        assistant_response, input_tok, output_tok, cost = generate_marcus_response(
            client, system_prompt, user_message, i
        )

        if assistant_response:
            example['conversations'].append({
                "from": "assistant",
                "value": assistant_response
            })

            results.append(example)
            total_input_tokens += input_tok
            total_output_tokens += output_tok
            total_cost += cost
            successful += 1
        else:
            failed += 1

        if i % 10 == 0:
            print(f"\n[*] Progress: {i}/{len(test_examples)} completed")
            print(f"    Running total: ${total_cost:.2f}")
            print("="*70)

    print(f"\n[*] Generation complete!")
    print(f"    Successful: {successful}")
    print(f"    Failed: {failed}")
    print(f"    Total input tokens: {total_input_tokens:,}")
    print(f"    Total output tokens: {total_output_tokens:,}")
    print(f"    Total cost: ${total_cost:.2f}")
    print(f"    Avg tokens per response: {total_output_tokens // successful if successful > 0 else 0}")

    output_data = {
        "metadata": {
            **metadata,
            "test_batch": True,
            "test_size": num_examples,
            "successful_generations": successful,
            "failed_generations": failed,
            "total_input_tokens": total_input_tokens,
            "total_output_tokens": total_output_tokens,
            "total_cost": total_cost,
            "avg_output_tokens": total_output_tokens // successful if successful > 0 else 0
        },
        "data": results
    }

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\n[*] Test batch saved to {output_file}")

if __name__ == '__main__':
    import sys

    source = sys.argv[1] if len(sys.argv) > 1 else 'output/batches_for_deepseek/tier3/tier3_batch_001_storage.jsonl'
    output = sys.argv[2] if len(sys.argv) > 2 else 'output/test_batch_50_results.jsonl'
    num = int(sys.argv[3]) if len(sys.argv) > 3 else 50

    process_test_batch(source, output, num)
