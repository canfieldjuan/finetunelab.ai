import json
import os
import asyncio
from openai import AsyncOpenAI
from typing import List, Dict, Any
from datetime import datetime

class AsyncBatchGenerator:
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key
        )
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0
        self.successful = 0
        self.failed = 0
        self.results = []
        self.lock = asyncio.Lock()

    async def generate_single_response(
        self,
        system_prompt: str,
        user_message: str,
        example_num: int,
        semaphore: asyncio.Semaphore
    ):
        async with semaphore:
            try:
                response = await self.client.chat.completions.create(
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

                async with self.lock:
                    self.total_input_tokens += input_tokens
                    self.total_output_tokens += output_tokens
                    self.total_cost += total_cost
                    self.successful += 1

                    if self.successful % 10 == 0:
                        print(f"[*] Progress: {self.successful} completed, ${self.total_cost:.2f}")

                return {
                    "success": True,
                    "response": assistant_response,
                    "tokens": output_tokens,
                    "example_num": example_num
                }

            except Exception as e:
                async with self.lock:
                    self.failed += 1
                print(f"[!] Error on example {example_num}: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "example_num": example_num
                }

    async def process_batch(
        self,
        system_prompt: str,
        examples: List[Dict[str, Any]],
        max_concurrent: int = 15
    ):
        semaphore = asyncio.Semaphore(max_concurrent)

        print(f"[*] Processing {len(examples)} examples with {max_concurrent} concurrent requests")
        print(f"[*] Started at {datetime.now().strftime('%H:%M:%S')}")
        print("="*70)

        tasks = []
        for i, example in enumerate(examples, 1):
            user_message = example['conversations'][0]['value']
            task = self.generate_single_response(
                system_prompt,
                user_message,
                i,
                semaphore
            )
            tasks.append((i, task, example))

        results = await asyncio.gather(*[task for _, task, _ in tasks])

        for (example_num, _, original_example), result in zip(tasks, results):
            if result['success']:
                original_example['conversations'].append({
                    "from": "assistant",
                    "value": result['response']
                })
                self.results.append(original_example)

        print("\n" + "="*70)
        print(f"[*] Completed at {datetime.now().strftime('%H:%M:%S')}")
        print(f"[*] Successful: {self.successful}/{len(examples)}")
        print(f"[*] Failed: {self.failed}")
        print(f"[*] Total input tokens: {self.total_input_tokens:,}")
        print(f"[*] Total output tokens: {self.total_output_tokens:,}")
        print(f"[*] Avg output tokens: {self.total_output_tokens // self.successful if self.successful > 0 else 0}")
        print(f"[*] Total cost: ${self.total_cost:.2f}")
        print("="*70)

async def process_file_async(
    source_file: str,
    output_file: str,
    num_examples: int = None,
    max_concurrent: int = 15
):
    api_key = os.getenv('OPENROUTER_API_KEY', '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')

    print(f"[*] Loading batch from {source_file}")
    with open(source_file, 'r', encoding='utf-8') as f:
        batch_data = json.load(f)

    system_prompt = batch_data['metadata']['system_prompt']
    all_examples = batch_data['data']

    if num_examples:
        examples = all_examples[:num_examples]
    else:
        examples = all_examples

    print(f"[*] Selected {len(examples)} examples")

    generator = AsyncBatchGenerator(api_key)
    await generator.process_batch(system_prompt, examples, max_concurrent)

    output_data = {
        "metadata": {
            **batch_data['metadata'],
            "async_processing": True,
            "max_concurrent": max_concurrent,
            "total_examples": len(examples),
            "successful_generations": generator.successful,
            "failed_generations": generator.failed,
            "total_input_tokens": generator.total_input_tokens,
            "total_output_tokens": generator.total_output_tokens,
            "total_cost": generator.total_cost,
            "avg_output_tokens": generator.total_output_tokens // generator.successful if generator.successful > 0 else 0,
            "generated_at": datetime.now().isoformat()
        },
        "data": generator.results
    }

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\n[*] Results saved to {output_file}")

if __name__ == '__main__':
    import sys

    source = sys.argv[1] if len(sys.argv) > 1 else 'output/batches_for_deepseek/tier3/tier3_batch_001_storage.jsonl'
    output = sys.argv[2] if len(sys.argv) > 2 else 'output/async_batch_results.jsonl'
    num = int(sys.argv[3]) if len(sys.argv) > 3 else None
    concurrent = int(sys.argv[4]) if len(sys.argv) > 4 else 15

    asyncio.run(process_file_async(source, output, num, concurrent))
