"""Quick test with FREE model"""
import os
import sys

# Set API key
os.environ['OPENROUTER_API_KEY'] = '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'

from generate_tier2_enhanced import OpenRouterClient, CostCalculator

print("=" * 60)
print("QUICK TEST - FREE LLAMA 3.2 3B MODEL")
print("=" * 60)
print()

try:
    client = OpenRouterClient()
    calc = CostCalculator()

    # Test with DeepSeek V3.2 Experimental
    model = "deepseek/deepseek-v3.2-exp"

    print(f"[*] Testing model: {model}")
    print(f"[*] Cost: DeepSeek V3.2 Experimental")
    print()

    messages = [
        {"role": "system", "content": "You are an expert PC building consultant."},
        {"role": "user", "content": """Generate a Q&A pair about comparing two PC components.

Output as JSON:
{
  "user_question": "...",
  "assistant_answer": "..."
}"""}
    ]

    print("[*] Sending request...")
    response = client.chat_completion(
        model=model,
        messages=messages,
        temperature=0.7,
        max_tokens=500
    )

    print()
    print("=" * 60)
    print("RESPONSE:")
    print("=" * 60)
    print(response['content'])
    print()
    print("=" * 60)
    print("USAGE:")
    print("=" * 60)
    print(f"Prompt tokens: {response['usage']['prompt_tokens']}")
    print(f"Output tokens: {response['usage']['completion_tokens']}")
    print(f"Total tokens:  {response['usage']['total_tokens']}")
    print(f"Model used:    {response['model']}")

    # Track cost (should be $0.00)
    calc.add_usage(model, response['usage'])
    print(f"Cost:          ${calc.total_cost:.4f}")
    print()

    # Try to parse JSON
    import json
    try:
        parsed = json.loads(response['content'])
        print("[SUCCESS] Valid JSON response!")
        print(f"User Q:    {parsed.get('user_question', 'N/A')[:80]}...")
        print(f"Assistant: {parsed.get('assistant_answer', 'N/A')[:80]}...")
    except json.JSONDecodeError:
        print("[WARNING] Response is not valid JSON")
        print("This is OK for testing - some models need better prompting")

    print()
    print("=" * 60)
    print("[SUCCESS] OpenRouter connection working!")
    print("=" * 60)
    print()
    print("Ready to generate datasets!")
    print()
    print("Recommended next steps:")
    print("  1. Test with 10 examples using FREE model")
    print("  2. Review quality")
    print("  3. Scale to 100-1000 examples")
    print()

except Exception as e:
    print()
    print("=" * 60)
    print("[ERROR]", str(e))
    print("=" * 60)
    sys.exit(1)
