"""
Tier 2: Application Layer Dataset Generator

Generates high-density Q&A pairs for:
- Comparison questions
- Compatibility scenarios
- Use-case/budget builds

Uses GPT-4 with Tier 1 factual specs injected for accuracy.
"""

import json
import os
from pathlib import Path
from typing import Dict, List, Any
import random


class Tier2PromptGenerator:
    """Generates prompts for GPT-4 to create Tier 2 examples."""

    def __init__(self, tier1_dataset_path: str, curated_pairs_path: str):
        """Initialize with Tier 1 data and curated pairs."""
        # Load Tier 1 factual data
        with open(tier1_dataset_path, 'r', encoding='utf-8') as f:
            self.tier1_data = json.load(f)

        # Create component lookup dictionary
        self.components = {}
        for example in self.tier1_data['examples']:
            component_name = example['conversations'][0]['value'].replace('What are the specs of the ', '').replace('?', '')
            component_specs = example['conversations'][1]['value']
            self.components[component_name] = component_specs

        # Load curated pairs
        with open(curated_pairs_path, 'r', encoding='utf-8') as f:
            self.curated_pairs = json.load(f)

        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        if not self.openai_api_key:
            print("[WARNING] OPENAI_API_KEY not set in environment. GPT-4 calls will fail.")

    def find_component_specs(self, component_name: str) -> str:
        """Find component specs from Tier 1 data."""
        # Try exact match first
        if component_name in self.components:
            return self.components[component_name]

        # Try bidirectional partial match
        # Check if search term is in component name OR component name is in search term
        component_lower = component_name.lower()
        matches = []

        for name, specs in self.components.items():
            name_lower = name.lower()
            # Match if either string contains the other, OR if key parts match
            if (component_lower in name_lower or
                name_lower in component_lower or
                self._fuzzy_match(component_lower, name_lower)):
                matches.append(specs)

        if matches:
            return matches[0]

        return f"{component_name}: [Specs not found in Tier 1 data]"

    def _fuzzy_match(self, search_term: str, component_name: str) -> bool:
        """Fuzzy match for key component identifiers."""
        # Extract key parts (e.g., "7800X3D", "4090", "990 Pro")
        # Remove common prefixes/manufacturers
        search_clean = search_term.replace('nvidia', '').replace('amd', '').replace('intel', '')
        search_clean = search_clean.replace('radeon', '').replace('geforce', '')
        search_clean = search_clean.strip()

        # Check if the cleaned search term (key model number) is in component name
        if len(search_clean) > 3 and search_clean in component_name:
            return True

        return False

    def create_comparison_prompt(self, pair: Dict[str, Any]) -> Dict[str, str]:
        """Create a prompt for comparison-based question."""
        comp_a = pair['component_a']
        comp_b = pair['component_b']
        use_case = pair['use_case']
        budget = pair['budget']

        # Get actual specs from Tier 1
        specs_a = self.find_component_specs(comp_a)
        specs_b = self.find_component_specs(comp_b)

        system_prompt = """You are an expert PC building consultant with 15+ years of experience in hardware recommendations, compatibility, and performance optimization.

Your expertise includes:
- Deep understanding of component architectures and real-world performance
- Platform ecosystem costs (motherboard, RAM, cooling requirements)
- Trade-off analysis for different use cases
- Future-proofing and upgrade path planning
- Budget optimization strategies

Your responses are:
- Technically detailed with specific reasoning
- Grounded in factual specifications
- Honest about trade-offs and limitations
- Practical with real-world performance expectations
- Comprehensive (800-1500 words for complex questions)"""

        user_prompt = f"""Generate a HIGH-DENSITY comparison-based PC building Q&A pair.

COMPONENT A: {comp_a}
Specifications:
{specs_a}

COMPONENT B: {comp_b}
Specifications:
{specs_b}

SCENARIO CONTEXT:
- Primary use case: {use_case}
- Budget constraint: {budget}
- User needs expert guidance on which to choose

TASK:
1. Create a realistic user question comparing these components for the given use case
2. Write a knowledge-dense expert answer (800-1500 words) that includes:
   - Performance analysis specific to the use case
   - Platform ecosystem costs (motherboard, RAM, cooling)
   - Trade-off analysis (features, price, future-proofing)
   - Specific recommendations with detailed reasoning
   - Real-world performance expectations (FPS, render times, etc.)
   - Alternative options if applicable

ANSWER REQUIREMENTS:
- Use the ACTUAL SPECS provided above (do not hallucinate)
- Be specific with technical details (cache sizes, VRAM, PCIe lanes, etc.)
- Explain the "why" behind recommendations
- Include platform considerations (AM5 vs LGA1700, DDR5 costs, etc.)
- Mention real-world benchmarks or performance expectations
- Discuss both short-term and long-term value

FORMAT:
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
                "subcategory": pair.get('category', 'general'),
                "components": [comp_a, comp_b]
            }
        }

    def create_compatibility_prompt(self, scenario: Dict[str, Any]) -> Dict[str, str]:
        """Create a prompt for compatibility-based question."""
        category = scenario['category']

        # Build context based on scenario type
        context_parts = []
        component_specs = []

        for key, value in scenario.items():
            if key not in ['category', 'constraint']:
                specs = self.find_component_specs(value)
                context_parts.append(f"{key.upper()}: {value}")
                component_specs.append(f"{key.upper()} Specifications:\n{specs}")

        context = "\n".join(context_parts)
        specs_section = "\n\n".join(component_specs)
        constraint = scenario.get('constraint', 'general compatibility')

        system_prompt = """You are an expert PC building consultant specializing in compatibility and technical constraints.

Your expertise includes:
- Socket compatibility and BIOS requirements
- Physical clearances (cooler height, GPU length, RAM clearance)
- Power supply calculations and headroom requirements
- PCIe lane allocation and M.2 slot sharing
- Memory compatibility (EXPO, XMP, voltage)
- Thermal management in constrained builds

Your responses are:
- Technically precise and accurate
- Include specific measurements and calculations
- Warn about potential issues proactively
- Provide workarounds when available
- Comprehensive (600-1200 words)"""

        user_prompt = f"""Generate a HIGH-DENSITY compatibility-focused PC building Q&A pair.

SCENARIO TYPE: {category}
CONSTRAINT: {constraint}

COMPONENTS:
{context}

COMPONENT SPECIFICATIONS:
{specs_section}

TASK:
1. Create a realistic user question about compatibility for this scenario
2. Write a knowledge-dense expert answer (600-1200 words) that includes:
   - Direct compatibility answer (YES/NO with confidence level)
   - Detailed technical reasoning (measurements, specs, requirements)
   - Potential issues or concerns
   - Workarounds or alternatives if needed
   - Step-by-step verification process
   - Related compatibility considerations

ANSWER REQUIREMENTS:
- Use ACTUAL SPECS provided above
- Be precise with measurements (mm, watts, etc.)
- Explain technical dependencies (PCIe lanes, BIOS versions, etc.)
- Mention real-world testing if applicable
- Warn about edge cases or gotchas
- Provide confidence level in your answer

FORMAT:
Output as JSON:
{{
  "user_question": "...",
  "assistant_answer": "..."
}}"""

        return {
            "system": system_prompt,
            "user": user_prompt,
            "metadata": {
                "category": "compatibility",
                "subcategory": category,
                "components": list(scenario.values())
            }
        }

    def create_usecase_prompt(self, scenario: Dict[str, Any]) -> Dict[str, str]:
        """Create a prompt for use-case/budget question."""
        budget = scenario['budget']
        use_case = scenario['use_case']
        priorities = ', '.join(scenario['priorities'])
        constraints = ', '.join(scenario['constraints'])

        # Get sample components in budget range for context
        # (You could enhance this by filtering Tier 1 by price)

        system_prompt = """You are an expert PC building consultant specializing in complete system design and budget optimization.

Your expertise includes:
- Component selection for specific workloads
- Budget allocation across PC parts
- Performance-per-dollar optimization
- Use-case specific bottleneck analysis
- Future upgrade path planning
- Component compatibility verification

Your responses are:
- Complete build recommendations with specific parts
- Detailed performance expectations for the use case
- Budget breakdown with reasoning
- Platform choice justification (AM5 vs LGA1700, etc.)
- Alternative configurations at different price points
- Comprehensive (1000-1800 words)"""

        user_prompt = f"""Generate a HIGH-DENSITY use-case/budget-based PC building Q&A pair.

BUDGET: ${budget}
PRIMARY USE CASE: {use_case}
PRIORITIES: {priorities}
CONSTRAINTS: {constraints}

TASK:
1. Create a realistic user question requesting a complete PC build
2. Write a knowledge-dense expert answer (1000-1800 words) that includes:
   - Complete parts list with specific models and prices
   - Reasoning for each component choice
   - Performance expectations for the use case
   - Budget allocation breakdown
   - Platform choice justification
   - Upgrade path recommendations
   - Alternative configurations (slightly higher/lower budget)
   - Potential bottlenecks or limitations

ANSWER REQUIREMENTS:
- Recommend REAL components (from current market)
- Keep total cost within ±5% of budget
- Justify every component choice for the use case
- Include approximate performance metrics (FPS, render times, etc.)
- Discuss trade-offs made to hit budget
- Mention peripherals if budget allows
- Provide PCPartPicker-style compatibility notes

FORMAT:
Output as JSON:
{{
  "user_question": "...",
  "assistant_answer": "..."
}}"""

        return {
            "system": system_prompt,
            "user": user_prompt,
            "metadata": {
                "category": "use_case_budget",
                "subcategory": scenario.get('category', 'general'),
                "budget": budget,
                "use_case": use_case
            }
        }

    def generate_prompts_batch(self, num_examples: int = 25) -> List[Dict[str, Any]]:
        """Generate a batch of prompts for GPT-4."""
        prompts = []

        # Distribution: 40% comparison, 30% compatibility, 30% use-case
        num_comparison = int(num_examples * 0.4)
        num_compatibility = int(num_examples * 0.3)
        num_usecase = num_examples - num_comparison - num_compatibility

        print(f"Generating {num_examples} prompts:")
        print(f"  - Comparison: {num_comparison}")
        print(f"  - Compatibility: {num_compatibility}")
        print(f"  - Use-case/Budget: {num_usecase}")
        print()

        # Generate comparison prompts
        comparison_pairs = self.curated_pairs['comparison_pairs']
        for i in range(num_comparison):
            pair = comparison_pairs[i % len(comparison_pairs)]
            prompt = self.create_comparison_prompt(pair)
            prompts.append(prompt)
            print(f"[{i+1}/{num_comparison}] Comparison: {pair['component_a']} vs {pair['component_b']}")

        # Generate compatibility prompts
        compatibility_scenarios = self.curated_pairs['compatibility_scenarios']
        for i in range(num_compatibility):
            scenario = compatibility_scenarios[i % len(compatibility_scenarios)]
            prompt = self.create_compatibility_prompt(scenario)
            prompts.append(prompt)
            print(f"[{i+1}/{num_compatibility}] Compatibility: {scenario['category']}")

        # Generate use-case prompts
        usecase_scenarios = self.curated_pairs['use_case_budget_scenarios']
        for i in range(num_usecase):
            scenario = usecase_scenarios[i % len(usecase_scenarios)]
            prompt = self.create_usecase_prompt(scenario)
            prompts.append(prompt)
            print(f"[{i+1}/{num_usecase}] Use-case: ${scenario['budget']} for {scenario['use_case']}")

        return prompts

    def save_prompts(self, prompts: List[Dict[str, Any]], output_path: str):
        """Save prompts to JSON file."""
        output_data = {
            "metadata": {
                "tier": 2,
                "tier_name": "application_layer",
                "total_prompts": len(prompts),
                "categories": {
                    "comparison": sum(1 for p in prompts if p['metadata']['category'] == 'comparison'),
                    "compatibility": sum(1 for p in prompts if p['metadata']['category'] == 'compatibility'),
                    "use_case_budget": sum(1 for p in prompts if p['metadata']['category'] == 'use_case_budget')
                }
            },
            "prompts": prompts
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)

        print(f"\n[+] Prompts saved to: {output_path}")


def main():
    """Generate Tier 2 prompts for GPT-4."""

    print("=" * 80)
    print("Tier 2: Application Layer - Prompt Generation")
    print("=" * 80)
    print()

    # Paths
    tier1_path = Path(r"C:\Users\Juan\Desktop\Dev_Ops\finetune-lab\output\tier1_factual_base_38k.json")
    curated_pairs_path = Path(r"C:\Users\Juan\Desktop\Dev_Ops\finetune-lab\tier2_curated_pairs.json")
    output_path = Path(__file__).parent / "output" / "tier2_prompts_batch1_25.json"

    # Initialize generator
    print(f"[*] Loading Tier 1 data: {tier1_path}")
    print(f"[*] Loading curated pairs: {curated_pairs_path}")
    print()

    generator = Tier2PromptGenerator(str(tier1_path), str(curated_pairs_path))

    print(f"[*] Loaded {len(generator.components)} components from Tier 1")
    print()

    # Generate 25 prompts for test batch
    prompts = generator.generate_prompts_batch(num_examples=25)

    # Save prompts
    output_path.parent.mkdir(parents=True, exist_ok=True)
    generator.save_prompts(prompts, str(output_path))

    print()
    print("=" * 80)
    print("Next Steps:")
    print("=" * 80)
    print(f"1. Review prompts in: {output_path}")
    print(f"2. Send prompts to GPT-4 to generate answers")
    print(f"3. Review generated Q&A pairs for technical accuracy")
    print(f"4. Mark errors and regenerate if needed")
    print()
    print("To send to GPT-4, run:")
    print("  python send_to_gpt4.py")


if __name__ == "__main__":
    main()
