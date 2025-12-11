"""
Enhanced Tier 2: Application Layer Dataset Generator

NEW FEATURES:
- OpenRouter integration (access 100+ models including DeepSeek V2.5)
- Batch prompting (5 examples per request for 30-40% cost savings)
- Mix-and-match strategy (cheap models for bulk, expensive for quality)
- Real-time cost tracking
- Progress persistence (resume from interruption)
- Automatic retry on failures

COST COMPARISON:
- OpenAI gpt-4o-mini:     $0.005 per example
- DeepSeek V2.5:          $0.0004 per example (95% cheaper!)
- Gemini 1.5 Flash:       $0.0002 per example (98% cheaper!)
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any, Optional
import random
import time
from datetime import datetime
import sys

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("[WARNING] OpenAI library not installed. Install with: pip install openai")
    OPENAI_AVAILABLE = False


# ============================================================================
# Model Pricing (per 1M tokens)
# ============================================================================

MODEL_PRICING = {
    # OpenAI
    "openai/gpt-4o-mini": {"input": 0.15, "output": 0.60, "provider": "openai"},
    "openai/gpt-4o": {"input": 2.50, "output": 10.00, "provider": "openai"},

    # OpenRouter - ULTRA CHEAP (FREE!)
    "meta-llama/llama-3.2-3b-instruct:free": {"input": 0.00, "output": 0.00, "provider": "openrouter"},
    "meta-llama/llama-3.2-1b-instruct:free": {"input": 0.00, "output": 0.00, "provider": "openrouter"},

    # OpenRouter - ULTRA CHEAP (Paid)
    "meta-llama/llama-3.2-1b-instruct": {"input": 0.01, "output": 0.01, "provider": "openrouter"},
    "meta-llama/llama-3.2-3b-instruct": {"input": 0.02, "output": 0.02, "provider": "openrouter"},
    "meta-llama/llama-3.1-8b-instruct": {"input": 0.02, "output": 0.03, "provider": "openrouter"},

    # OpenRouter - DeepSeek (GOOD COST)
    "deepseek/deepseek-chat": {"input": 0.30, "output": 0.85, "provider": "openrouter"},
    "deepseek/deepseek-coder": {"input": 0.30, "output": 0.85, "provider": "openrouter"},

    # OpenRouter - Mistral (BALANCED)
    "mistralai/mistral-7b-instruct": {"input": 0.03, "output": 0.05, "provider": "openrouter"},
    "mistralai/mistral-nemo": {"input": 0.02, "output": 0.04, "provider": "openrouter"},

    # OpenRouter - Google (BEST SPEED)
    "google/gemini-flash-1.5": {"input": 0.04, "output": 0.15, "provider": "openrouter"},
    "google/gemini-pro-1.5": {"input": 1.25, "output": 5.00, "provider": "openrouter"},

    # OpenRouter - Anthropic
    "anthropic/claude-3-haiku": {"input": 0.25, "output": 1.25, "provider": "openrouter"},
    "anthropic/claude-3.5-sonnet": {"input": 3.00, "output": 15.00, "provider": "openrouter"},

    # OpenRouter - Meta (Large models)
    "meta-llama/llama-3.1-70b-instruct": {"input": 0.35, "output": 0.40, "provider": "openrouter"},
    "meta-llama/llama-3.1-405b-instruct": {"input": 2.70, "output": 2.70, "provider": "openrouter"},
}


# ============================================================================
# OpenRouter Client
# ============================================================================

class OpenRouterClient:
    """Client for OpenRouter API (supports 100+ models)"""

    def __init__(self, api_key: Optional[str] = None):
        if not OPENAI_AVAILABLE:
            raise RuntimeError("OpenAI library required. Install with: pip install openai")

        self.api_key = api_key or os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not set. Get one at: https://openrouter.ai/keys")

        # OpenRouter uses OpenAI-compatible API
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
        )

    def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4000,
    ) -> Dict[str, Any]:
        """
        Call OpenRouter API

        Args:
            model: Model ID (e.g., "deepseek/deepseek-chat")
            messages: List of message dicts with 'role' and 'content'
            temperature: 0.0-2.0 (lower = more deterministic)
            max_tokens: Max response length

        Returns:
            Dict with 'content', 'usage', 'model' keys
        """
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            return {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
                "model": response.model,
            }
        except Exception as e:
            raise RuntimeError(f"OpenRouter API error: {str(e)}")


# ============================================================================
# Cost Calculator
# ============================================================================

class CostCalculator:
    """Calculate and track generation costs"""

    def __init__(self):
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0
        self.model_costs = {}  # Track cost per model

    def add_usage(self, model: str, usage: Dict[str, int]):
        """Add usage from a completion"""
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens

        # Calculate cost for this call
        if model in MODEL_PRICING:
            pricing = MODEL_PRICING[model]
            cost = (
                (input_tokens / 1_000_000) * pricing["input"] +
                (output_tokens / 1_000_000) * pricing["output"]
            )
            self.total_cost += cost

            # Track per-model
            if model not in self.model_costs:
                self.model_costs[model] = 0.0
            self.model_costs[model] += cost

    def estimate_cost(
        self,
        model: str,
        avg_prompt_tokens: int,
        avg_completion_tokens: int,
        num_requests: int
    ) -> float:
        """Estimate cost for future generation"""
        if model not in MODEL_PRICING:
            return 0.0

        pricing = MODEL_PRICING[model]
        input_cost = (num_requests * avg_prompt_tokens / 1_000_000) * pricing["input"]
        output_cost = (num_requests * avg_completion_tokens / 1_000_000) * pricing["output"]
        return input_cost + output_cost

    def print_summary(self):
        """Print cost summary"""
        print("\n" + "=" * 60)
        print("COST SUMMARY")
        print("=" * 60)
        print(f"Total Input Tokens:  {self.total_input_tokens:,}")
        print(f"Total Output Tokens: {self.total_output_tokens:,}")
        print(f"Total Cost:          ${self.total_cost:.4f}")
        print()
        print("Cost by Model:")
        for model, cost in self.model_costs.items():
            print(f"  {model}: ${cost:.4f}")
        print("=" * 60)


# ============================================================================
# Enhanced Tier 2 Generator
# ============================================================================

class EnhancedTier2Generator:
    """
    Enhanced generator with:
    - OpenRouter support
    - Batch prompting
    - Mix-and-match strategy
    - Progress persistence
    """

    def __init__(
        self,
        tier1_dataset_path: str,
        curated_pairs_path: str,
        openrouter_api_key: Optional[str] = None
    ):
        # Load Tier 1 data
        with open(tier1_dataset_path, 'r', encoding='utf-8') as f:
            tier1_raw = json.load(f)

        # Check structure
        if isinstance(tier1_raw, dict) and 'examples' in tier1_raw:
            self.tier1_data = tier1_raw
        else:
            # Assume it's already a list of examples
            self.tier1_data = {'examples': tier1_raw}

        # Build component lookup
        self.components = {}
        for example in self.tier1_data['examples']:
            try:
                component_name = example['conversations'][0]['value'].replace(
                    'What are the specs of the ', ''
                ).replace('?', '').strip()
                component_specs = example['conversations'][1]['value']
                self.components[component_name] = component_specs
            except (KeyError, IndexError):
                continue

        print(f"[*] Loaded {len(self.components)} components from Tier 1")

        # Load curated pairs
        with open(curated_pairs_path, 'r', encoding='utf-8') as f:
            self.curated_pairs = json.load(f)

        # Initialize OpenRouter client
        self.client = OpenRouterClient(openrouter_api_key)

        # Cost tracking
        self.cost_calc = CostCalculator()

        # Progress tracking
        self.progress_file = Path("generation_progress.json")

    def find_component_specs(self, component_name: str) -> str:
        """Find component specs with fuzzy matching"""
        # Exact match
        if component_name in self.components:
            return self.components[component_name]

        # Fuzzy match
        component_lower = component_name.lower()
        for name, specs in self.components.items():
            name_lower = name.lower()
            if component_lower in name_lower or name_lower in component_lower:
                return specs

        return f"{component_name}: [Specs not found in Tier 1 data]"

    def create_comparison_prompt(self, pair: Dict[str, Any]) -> Dict[str, str]:
        """Create comparison prompt (same as original)"""
        comp_a = pair['component_a']
        comp_b = pair['component_b']
        use_case = pair['use_case']
        budget = pair['budget']

        specs_a = self.find_component_specs(comp_a)
        specs_b = self.find_component_specs(comp_b)

        system_prompt = """You are an expert PC building consultant with 15+ years of experience."""

        user_prompt = f"""Generate a HIGH-DENSITY comparison Q&A pair.

COMPONENT A: {comp_a}
Specifications: {specs_a}

COMPONENT B: {comp_b}
Specifications: {specs_b}

SCENARIO: {use_case}, Budget: {budget}

Output as JSON:
{{
  "user_question": "...",
  "assistant_answer": "..."
}}"""

        return {
            "system": system_prompt,
            "user": user_prompt,
            "metadata": {
                "category": "comparison",
                "components": [comp_a, comp_b]
            }
        }

    def create_batch_prompt(self, prompts: List[Dict[str, str]]) -> Dict[str, str]:
        """
        Create a BATCH prompt that generates 5 examples in one request
        This reduces costs by 30-40% (shared system prompt overhead)
        """
        system_prompt = prompts[0]["system"]  # Use first system prompt

        # Combine user prompts
        combined_user = "Generate 5 HIGH-DENSITY Q&A pairs, one for each scenario below.\n\n"
        for i, p in enumerate(prompts, 1):
            combined_user += f"--- SCENARIO {i} ---\n{p['user']}\n\n"

        combined_user += """
Output as a JSON array of 5 objects:
[
  {"user_question": "...", "assistant_answer": "..."},
  {"user_question": "...", "assistant_answer": "..."},
  {"user_question": "...", "assistant_answer": "..."},
  {"user_question": "...", "assistant_answer": "..."},
  {"user_question": "...", "assistant_answer": "..."}
]"""

        return {
            "system": system_prompt,
            "user": combined_user,
            "metadata": [p["metadata"] for p in prompts]
        }

    def generate_with_retry(
        self,
        model: str,
        messages: List[Dict[str, str]],
        max_retries: int = 3
    ) -> Optional[Dict[str, Any]]:
        """Generate with automatic retry on failure"""
        for attempt in range(max_retries):
            try:
                result = self.client.chat_completion(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=4000
                )

                # Track cost
                self.cost_calc.add_usage(model, result["usage"])

                return result

            except Exception as e:
                print(f"[!] Attempt {attempt + 1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"[*] Retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    print(f"[!] All retries failed for this batch")
                    return None

    def parse_batch_response(self, content: str, batch_size: int) -> List[Dict[str, Any]]:
        """Parse batch response (array of Q&A pairs)"""
        try:
            # Try to parse as JSON array
            parsed = json.loads(content)

            if isinstance(parsed, list) and len(parsed) == batch_size:
                return parsed
            else:
                print(f"[!] Expected {batch_size} examples, got {len(parsed)}")
                return parsed[:batch_size] if isinstance(parsed, list) else []

        except json.JSONDecodeError as e:
            print(f"[!] JSON parse error: {e}")
            print(f"[!] Raw content: {content[:500]}...")
            return []

    def generate_dataset(
        self,
        num_examples: int,
        model_config: Dict[str, Any],
        batch_size: int = 5,
        resume: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Generate dataset with batch prompting

        Args:
            num_examples: Total examples to generate
            model_config: Model configuration dict
            batch_size: Examples per API request (5 recommended)
            resume: Resume from progress file if exists

        Returns:
            List of generated Q&A pairs
        """
        print("\n" + "=" * 60)
        print("ENHANCED TIER 2 DATASET GENERATION")
        print("=" * 60)
        print(f"Target:      {num_examples} examples")
        print(f"Batch size:  {batch_size} examples/request")
        print(f"API calls:   ~{num_examples // batch_size} requests")
        print()

        # Load progress if resuming
        results = []
        start_idx = 0

        if resume and self.progress_file.exists():
            with open(self.progress_file, 'r') as f:
                progress = json.load(f)
                results = progress.get("results", [])
                start_idx = len(results)
                print(f"[*] Resuming from {start_idx} examples")

        # Generate individual prompts
        all_prompts = []
        comparison_pairs = self.curated_pairs['comparison_pairs']

        for i in range(num_examples):
            pair = comparison_pairs[i % len(comparison_pairs)]
            prompt = self.create_comparison_prompt(pair)
            all_prompts.append(prompt)

        # Process in batches
        num_batches = (num_examples - start_idx + batch_size - 1) // batch_size

        for batch_num in range(num_batches):
            batch_start = start_idx + (batch_num * batch_size)
            batch_end = min(batch_start + batch_size, num_examples)
            batch_prompts = all_prompts[batch_start:batch_end]

            print(f"\n[{batch_num + 1}/{num_batches}] Generating examples {batch_start + 1}-{batch_end}...")

            # Determine model for this batch (mix-and-match)
            model = self.select_model_for_batch(batch_num, model_config)
            print(f"[*] Using model: {model}")

            # Create batch prompt
            if len(batch_prompts) > 1:
                batch_prompt = self.create_batch_prompt(batch_prompts)
            else:
                batch_prompt = batch_prompts[0]

            # Generate
            messages = [
                {"role": "system", "content": batch_prompt["system"]},
                {"role": "user", "content": batch_prompt["user"]}
            ]

            response = self.generate_with_retry(model, messages)

            if response:
                # Parse batch response
                if len(batch_prompts) > 1:
                    examples = self.parse_batch_response(response["content"], len(batch_prompts))
                else:
                    # Single example
                    try:
                        examples = [json.loads(response["content"])]
                    except json.JSONDecodeError:
                        print(f"[!] Failed to parse single response")
                        examples = []

                # Add metadata
                for i, example in enumerate(examples):
                    if i < len(batch_prompts):
                        example["metadata"] = batch_prompts[i]["metadata"]
                        example["model"] = model
                        results.append(example)

                print(f"[+] Generated {len(examples)} examples (Total: {len(results)})")
                print(f"[+] Cost so far: ${self.cost_calc.total_cost:.4f}")

                # Save progress
                self.save_progress(results)
            else:
                print(f"[!] Batch {batch_num + 1} failed completely")

            # Rate limiting (be nice to the API)
            time.sleep(1)

        print(f"\n[SUCCESS] Generated {len(results)} examples")
        self.cost_calc.print_summary()

        return results

    def select_model_for_batch(self, batch_num: int, config: Dict[str, Any]) -> str:
        """
        Mix-and-match strategy:
        - Use cheap model for bulk (first 80%)
        - Use expensive model for quality (last 20%)
        """
        strategy = config.get("strategy", "single")

        if strategy == "mix":
            bulk_model = config.get("bulk_model", "deepseek/deepseek-chat")
            quality_model = config.get("quality_model", "anthropic/claude-3.5-sonnet")
            quality_percentage = config.get("quality_percentage", 0.2)

            # Use quality model for last 20%
            total_batches = config.get("total_batches", 100)
            threshold = int(total_batches * (1 - quality_percentage))

            return quality_model if batch_num >= threshold else bulk_model
        else:
            # Single model strategy
            return config.get("model", "deepseek/deepseek-chat")

    def save_progress(self, results: List[Dict[str, Any]]):
        """Save progress to file (for resume capability)"""
        progress = {
            "timestamp": datetime.now().isoformat(),
            "num_results": len(results),
            "total_cost": self.cost_calc.total_cost,
            "results": results
        }

        with open(self.progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress, f, indent=2, ensure_ascii=False)

    def export_dataset(self, results: List[Dict[str, Any]], output_path: str, format: str = "jsonl"):
        """Export dataset in various formats"""
        output_path = Path(output_path)

        if format == "jsonl":
            # One JSON object per line
            with open(output_path, 'w', encoding='utf-8') as f:
                for example in results:
                    # Convert to training format
                    training_example = {
                        "conversations": [
                            {"from": "user", "value": example["user_question"]},
                            {"from": "assistant", "value": example["assistant_answer"]}
                        ],
                        "metadata": example.get("metadata", {})
                    }
                    f.write(json.dumps(training_example, ensure_ascii=False) + '\n')

        elif format == "json":
            # Single JSON file with metadata
            dataset = {
                "metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "num_examples": len(results),
                    "total_cost": self.cost_calc.total_cost,
                    "models_used": list(self.cost_calc.model_costs.keys())
                },
                "examples": results
            }
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(dataset, f, indent=2, ensure_ascii=False)

        print(f"\n[+] Dataset exported to: {output_path}")


# ============================================================================
# Main Function
# ============================================================================

def main():
    print("=" * 80)
    print("ENHANCED TIER 2 DATASET GENERATOR")
    print("Powered by OpenRouter - Access 100+ Models")
    print("=" * 80)
    print()

    # Check API key
    if not os.getenv('OPENROUTER_API_KEY'):
        print("[ERROR] OPENROUTER_API_KEY not set in environment")
        print()
        print("Get your API key at: https://openrouter.ai/keys")
        print()
        print("Then set it:")
        print("  Windows: set OPENROUTER_API_KEY=your-key-here")
        print("  Linux/Mac: export OPENROUTER_API_KEY=your-key-here")
        sys.exit(1)

    # Paths
    tier1_path = Path("output/tier1_factual_base_1k_sample.jsonl")  # Use sample for testing
    curated_pairs_path = Path("../finetune-lab/tier2_curated_pairs.json")
    output_path = Path("output/tier2_generated_deepseek.jsonl")

    if not tier1_path.exists():
        print(f"[ERROR] Tier 1 data not found: {tier1_path}")
        print("Using fallback path...")
        tier1_path = Path("../finetune-lab/output/tier1_factual_base_38k.json")

    if not curated_pairs_path.exists():
        print(f"[ERROR] Curated pairs not found: {curated_pairs_path}")
        sys.exit(1)

    # Initialize generator
    print(f"[*] Loading Tier 1 data: {tier1_path}")
    print(f"[*] Loading curated pairs: {curated_pairs_path}")
    print()

    generator = EnhancedTier2Generator(
        str(tier1_path),
        str(curated_pairs_path)
    )

    # Model configuration
    print("=" * 60)
    print("MODEL SELECTION")
    print("=" * 60)
    print()
    print("Available strategies:")
    print("  1. Single model (use one model for all examples)")
    print("  2. Mix-and-match (cheap for bulk, expensive for quality)")
    print()

    strategy = input("Select strategy (1 or 2): ").strip()

    if strategy == "2":
        # Mix-and-match
        print("\nRecommended mix-and-match configurations:")
        print("  A. DeepSeek (bulk) + Claude Sonnet (quality) - Best quality")
        print("  B. Gemini Flash (bulk) + GPT-4o (quality) - Balanced")
        print("  C. DeepSeek (bulk) + Gemini Pro (quality) - Budget-friendly")
        print()

        config = {
            "strategy": "mix",
            "bulk_model": "deepseek/deepseek-chat",
            "quality_model": "anthropic/claude-3.5-sonnet",
            "quality_percentage": 0.2,  # 20% with quality model
        }
    else:
        # Single model
        print("\nRecommended models:")
        print("  1. deepseek/deepseek-chat - Ultra cheap ($0.0004/example)")
        print("  2. google/gemini-flash-1.5 - Fast & cheap ($0.0002/example)")
        print("  3. openai/gpt-4o-mini - Balanced ($0.005/example)")
        print()

        model_choice = input("Select model (1-3): ").strip()
        models = {
            "1": "deepseek/deepseek-chat",
            "2": "google/gemini-flash-1.5",
            "3": "openai/gpt-4o-mini"
        }

        config = {
            "strategy": "single",
            "model": models.get(model_choice, "deepseek/deepseek-chat")
        }

    # Number of examples
    print()
    num_examples = int(input("Number of examples to generate (e.g., 100): ").strip())

    # Batch size
    print()
    print("Batch size (examples per request):")
    print("  5 (recommended) - 30-40% cost savings")
    print("  1 (individual) - More reliable but expensive")
    print()
    batch_size = int(input("Batch size (1-5): ").strip() or "5")

    # Cost estimate
    print("\n" + "=" * 60)
    print("COST ESTIMATE")
    print("=" * 60)

    if config["strategy"] == "mix":
        bulk_pct = 1 - config["quality_percentage"]
        bulk_cost = generator.cost_calc.estimate_cost(
            config["bulk_model"],
            1500,  # avg prompt tokens
            2000,  # avg completion tokens
            int(num_examples * bulk_pct / batch_size)
        )
        quality_cost = generator.cost_calc.estimate_cost(
            config["quality_model"],
            1500,
            2000,
            int(num_examples * config["quality_percentage"] / batch_size)
        )
        total_cost = bulk_cost + quality_cost
        print(f"Bulk model ({int(bulk_pct*100)}%):    ${bulk_cost:.4f}")
        print(f"Quality model ({int(config['quality_percentage']*100)}%): ${quality_cost:.4f}")
        print(f"Total estimated:       ${total_cost:.4f}")
    else:
        total_cost = generator.cost_calc.estimate_cost(
            config["model"],
            1500,
            2000,
            num_examples // batch_size
        )
        print(f"Model: {config['model']}")
        print(f"Estimated cost: ${total_cost:.4f}")

    print("=" * 60)
    print()

    confirm = input("Proceed with generation? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Cancelled.")
        return

    # Add total_batches to config for mix-and-match
    config["total_batches"] = num_examples // batch_size

    # Generate
    print("\n" + "=" * 60)
    print("STARTING GENERATION")
    print("=" * 60)

    results = generator.generate_dataset(
        num_examples=num_examples,
        model_config=config,
        batch_size=batch_size,
        resume=True
    )

    # Export
    output_path.parent.mkdir(parents=True, exist_ok=True)
    generator.export_dataset(results, str(output_path), format="jsonl")

    print("\n" + "=" * 60)
    print("GENERATION COMPLETE")
    print("=" * 60)
    print(f"Examples generated: {len(results)}")
    print(f"Output file: {output_path}")
    print(f"Total cost: ${generator.cost_calc.total_cost:.4f}")
    print()
    print("Next steps:")
    print("  1. Review generated examples for quality")
    print("  2. Upload to training system")
    print("  3. Start fine-tuning!")


if __name__ == "__main__":
    main()
