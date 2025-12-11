"""
Quick test script for OpenRouter integration

Tests:
1. API connection
2. Cost calculation
3. Single generation
4. Batch generation
"""

import os
import sys
from generate_tier2_enhanced import OpenRouterClient, CostCalculator

def test_api_connection():
    """Test 1: Verify API key and connection"""
    print("\n" + "="*60)
    print("TEST 1: API Connection")
    print("="*60)

    api_key = os.getenv('OPENROUTER_API_KEY')
    if not api_key:
        print("[FAIL] OPENROUTER_API_KEY not set")
        print("Get one at: https://openrouter.ai/keys")
        return False

    print(f"[OK] API key found: {api_key[:20]}...")

    try:
        client = OpenRouterClient(api_key)
        print("[OK] OpenRouter client initialized")
        return True
    except Exception as e:
        print(f"[FAIL] Client initialization failed: {e}")
        return False


def test_cost_calculation():
    """Test 2: Cost calculator"""
    print("\n" + "="*60)
    print("TEST 2: Cost Calculation")
    print("="*60)

    calc = CostCalculator()

    # Estimate cost for 100 examples with DeepSeek
    cost = calc.estimate_cost(
        model="deepseek/deepseek-chat",
        avg_prompt_tokens=1500,
        avg_completion_tokens=2000,
        num_requests=100 // 5  # Batch of 5
    )

    print(f"Estimated cost for 100 examples (DeepSeek, batch=5): ${cost:.4f}")

    if 0.03 <= cost <= 0.05:
        print("[OK] Cost estimate looks correct (~$0.04)")
        return True
    else:
        print(f"[WARN] Cost estimate seems off (expected ~$0.04, got ${cost:.4f})")
        return False


def test_single_generation():
    """Test 3: Generate a single example"""
    print("\n" + "="*60)
    print("TEST 3: Single Generation")
    print("="*60)

    try:
        client = OpenRouterClient()

        # Simple test prompt
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say 'Hello from OpenRouter!' in JSON format like: {\"greeting\": \"...\"}"}
        ]

        print("[*] Calling DeepSeek Chat...")
        response = client.chat_completion(
            model="deepseek/deepseek-chat",
            messages=messages,
            temperature=0.7,
            max_tokens=100
        )

        print(f"[OK] Response received: {response['content'][:100]}")
        print(f"[OK] Tokens used: {response['usage']['total_tokens']}")
        print(f"[OK] Model: {response['model']}")

        return True

    except Exception as e:
        print(f"[FAIL] Generation failed: {e}")
        return False


def test_batch_generation():
    """Test 4: Generate batch (multiple examples in one request)"""
    print("\n" + "="*60)
    print("TEST 4: Batch Generation")
    print("="*60)

    try:
        client = OpenRouterClient()

        # Batch prompt (generate 3 examples)
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": """Generate 3 short greetings in JSON array format:
[
  {"greeting": "..."},
  {"greeting": "..."},
  {"greeting": "..."}
]"""}
        ]

        print("[*] Calling Gemini Flash for batch...")
        response = client.chat_completion(
            model="google/gemini-flash-1.5",
            messages=messages,
            temperature=0.7,
            max_tokens=200
        )

        print(f"[OK] Response received: {response['content'][:150]}...")
        print(f"[OK] Tokens used: {response['usage']['total_tokens']}")

        # Try to parse as JSON array
        import json
        try:
            parsed = json.loads(response['content'])
            if isinstance(parsed, list) and len(parsed) == 3:
                print(f"[OK] Successfully generated 3 examples in one request")
                return True
            else:
                print(f"[WARN] Parsed, but got {len(parsed)} examples instead of 3")
                return False
        except json.JSONDecodeError:
            print(f"[WARN] Response not valid JSON (model may need better prompting)")
            return False

    except Exception as e:
        print(f"[FAIL] Batch generation failed: {e}")
        return False


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("OPENROUTER INTEGRATION TEST SUITE")
    print("="*80)

    results = {
        "API Connection": test_api_connection(),
        "Cost Calculation": test_cost_calculation(),
        "Single Generation": test_single_generation(),
        "Batch Generation": test_batch_generation(),
    }

    print("\n" + "="*80)
    print("TEST RESULTS")
    print("="*80)

    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")

    passed_count = sum(results.values())
    total_count = len(results)

    print("="*80)
    print(f"SUMMARY: {passed_count}/{total_count} tests passed")
    print("="*80)

    if passed_count == total_count:
        print("\n[SUCCESS] All tests passed! Ready to generate datasets.")
        print("\nNext steps:")
        print("  1. Run: python generate_tier2_enhanced.py")
        print("  2. Select model and quantity")
        print("  3. Start generating!")
        sys.exit(0)
    else:
        print("\n[WARNING] Some tests failed. Check errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
