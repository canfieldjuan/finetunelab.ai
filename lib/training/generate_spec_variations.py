#!/usr/bin/env python3
"""
Generate conversational variations of PC component specs
Converts dry spec recitations into varied Q&A patterns
"""

import json
import random
import re
from typing import List, Dict, Any

def parse_component_spec(spec_text: str) -> Dict[str, Any]:
    """Extract structured data from spec string"""
    parsed = {
        'raw': spec_text,
        'component_name': '',
        'specs': {}
    }

    # Extract component name (before first colon)
    if ':' in spec_text:
        parts = spec_text.split(':', 1)
        parsed['component_name'] = parts[0].strip()
        specs_part = parts[1].strip()

        # Parse key-value pairs
        for item in specs_part.split(','):
            item = item.strip()
            if ':' in item:
                key, val = item.split(':', 1)
                parsed['specs'][key.strip()] = val.strip()
            else:
                # Handle items without colons
                if 'cores' in item.lower():
                    parsed['specs']['cores'] = item
                elif 'ghz' in item.lower():
                    if 'base' in item.lower():
                        parsed['specs']['base_clock'] = item
                    elif 'boost' in item.lower():
                        parsed['specs']['boost_clock'] = item
                elif 'w ' in item.lower() or item.lower().endswith('w'):
                    parsed['specs']['TDP'] = item
                elif 'gb' in item.lower():
                    parsed['specs']['memory'] = item
                elif '$' in item:
                    parsed['specs']['price'] = item

    return parsed

def generate_direct_question(component_name: str, spec_text: str) -> List[Dict[str, str]]:
    """Generate 'What are the specs?' style variation"""
    templates = [
        f"What are the specs of the {component_name}?",
        f"Tell me about the {component_name} specifications",
        f"Can you give me the specs for the {component_name}?",
        f"What's the {component_name} spec sheet?",
        f"I need specs on the {component_name}",
    ]

    return [
        {"from": "user", "value": random.choice(templates)},
        {"from": "assistant", "value": spec_text}
    ]

def generate_specific_attribute_question(component_name: str, parsed: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate questions about specific attributes"""

    # Pick a random spec to ask about
    if not parsed['specs']:
        return None

    spec_key, spec_value = random.choice(list(parsed['specs'].items()))

    # Question templates for different attributes
    if 'cores' in spec_key.lower():
        questions = [
            f"How many cores does the {component_name} have?",
            f"What's the core count on the {component_name}?",
            f"How many cores in the {component_name}?",
        ]
        answers = [
            f"The {component_name} has {spec_value}.",
            f"{spec_value} cores.",
            f"It comes with {spec_value}.",
        ]
    elif 'clock' in spec_key.lower():
        questions = [
            f"What's the {spec_key.replace('_', ' ')} of the {component_name}?",
            f"How fast is the {component_name}'s {spec_key.replace('_', ' ')}?",
            f"Tell me the {spec_key.replace('_', ' ')} for the {component_name}",
        ]
        answers = [
            f"The {component_name} has a {spec_key.replace('_', ' ')} of {spec_value}.",
            f"{spec_value}.",
            f"It clocks at {spec_value}.",
        ]
    elif 'tdp' in spec_key.lower() or 'power' in spec_key.lower():
        questions = [
            f"What's the TDP of the {component_name}?",
            f"How much power does the {component_name} use?",
            f"What's the power draw on the {component_name}?",
        ]
        answers = [
            f"The {component_name} has a {spec_value} TDP.",
            f"It draws {spec_value}.",
            f"{spec_value} TDP.",
        ]
    elif 'price' in spec_key.lower():
        questions = [
            f"How much does the {component_name} cost?",
            f"What's the price of the {component_name}?",
            f"How much is the {component_name}?",
        ]
        answers = [
            f"The {component_name} costs {spec_value}.",
            f"It's priced at {spec_value}.",
            f"{spec_value}.",
        ]
    elif 'memory' in spec_key.lower() or 'gb' in spec_value.lower():
        questions = [
            f"How much memory does the {component_name} have?",
            f"What's the memory capacity of the {component_name}?",
            f"How much {spec_key} in the {component_name}?",
        ]
        answers = [
            f"The {component_name} has {spec_value}.",
            f"{spec_value}.",
            f"It comes with {spec_value}.",
        ]
    else:
        questions = [
            f"What's the {spec_key} on the {component_name}?",
            f"Tell me about the {component_name}'s {spec_key}",
        ]
        answers = [
            f"The {spec_key} is {spec_value}.",
            f"{spec_value}.",
        ]

    return [
        {"from": "user", "value": random.choice(questions)},
        {"from": "assistant", "value": random.choice(answers)}
    ]

def generate_recommendation_context(component_name: str, parsed: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate recommendation-style questions"""

    # Determine component type
    is_cpu = any(x in component_name.lower() for x in ['ryzen', 'intel', 'core', 'xeon', 'threadripper'])
    is_gpu = any(x in component_name.lower() for x in ['rtx', 'gtx', 'radeon', 'rx', 'arc'])
    is_ram = any(x in component_name.lower() for x in ['ddr', 'corsair vengeance', 'g.skill', 'kingston'])
    is_storage = any(x in component_name.lower() for x in ['ssd', 'nvme', 'samsung', 'wd', 'crucial'])

    spec_text = parsed['raw']

    if is_cpu:
        questions = [
            f"Will the {component_name} be good for gaming?",
            f"Is the {component_name} suitable for video editing?",
            f"Can the {component_name} handle 4K gaming?",
            f"Should I get the {component_name} for my build?",
        ]

        # Try to determine if it's high-end based on specs
        cores_str = str(parsed['specs'].get('cores', ''))
        cores = int(re.search(r'\d+', cores_str).group()) if re.search(r'\d+', cores_str) else 0

        if cores >= 12:
            performance = "excellent"
            workload = "gaming, streaming, and content creation"
        elif cores >= 8:
            performance = "great"
            workload = "gaming and multitasking"
        elif cores >= 6:
            performance = "solid"
            workload = "gaming"
        else:
            performance = "decent"
            workload = "basic tasks"

        answer = f"Absolutely! The {component_name} is a {performance} choice for {workload}. With {spec_text}, it'll handle most workloads smoothly."

    elif is_gpu:
        questions = [
            f"Will the {component_name} run games at 4K?",
            f"Is the {component_name} good for 1440p gaming?",
            f"Can I use the {component_name} for AI/ML?",
            f"Should I get the {component_name}?",
        ]
        answer = f"Yes! The {component_name} is a solid GPU. {spec_text}. It'll handle modern games at high settings."

    elif is_ram:
        questions = [
            f"Is the {component_name} enough for gaming?",
            f"Will the {component_name} work with my build?",
        ]
        answer = f"Yes! {spec_text}. This memory kit will work great for most builds."

    elif is_storage:
        questions = [
            f"Is the {component_name} fast enough for gaming?",
            f"Should I use the {component_name} as my boot drive?",
        ]
        answer = f"Absolutely! {spec_text}. It'll give you fast load times."

    else:
        # Generic
        questions = [f"Should I get the {component_name}?"]
        answer = f"Yes, the {component_name} is a solid choice. {spec_text}."

    return [
        {"from": "user", "value": random.choice(questions)},
        {"from": "assistant", "value": answer}
    ]

def generate_psu_requirement_question(component_name: str, parsed: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate PSU requirement questions for components with TDP"""

    tdp_str = parsed['specs'].get('TDP', parsed['specs'].get('power', ''))
    if not tdp_str:
        return None

    # Extract wattage
    tdp_match = re.search(r'(\d+)\s*W', tdp_str)
    if not tdp_match:
        return None

    tdp_watts = int(tdp_match.group(1))

    # Calculate recommended PSU (TDP * 2 for GPUs, TDP * 5 for CPUs)
    is_gpu = any(x in component_name.lower() for x in ['rtx', 'gtx', 'radeon', 'rx'])

    if is_gpu:
        recommended_psu = tdp_watts * 2
    else:
        recommended_psu = tdp_watts * 5

    # Round to common PSU sizes
    psu_sizes = [450, 550, 650, 750, 850, 1000, 1200]
    recommended_psu = min([p for p in psu_sizes if p >= recommended_psu], default=1200)

    questions = [
        f"What PSU do I need for the {component_name}?",
        f"How much power supply for the {component_name}?",
        f"What wattage PSU for the {component_name}?",
    ]

    answers = [
        f"The {component_name} has a {tdp_str} TDP, so I'd recommend at least a {recommended_psu}W PSU for headroom.",
        f"With a {tdp_str} TDP, you'll want a {recommended_psu}W power supply minimum.",
        f"Go with a {recommended_psu}W PSU to safely handle the {tdp_str} draw.",
    ]

    return [
        {"from": "user", "value": random.choice(questions)},
        {"from": "assistant", "value": random.choice(answers)}
    ]

def generate_variations(example: Dict[str, Any], num_variations: int = 3) -> List[Dict[str, Any]]:
    """Generate multiple conversational variations of a spec example"""

    messages = example.get('messages', [])

    # Check if this is a simple spec example (short assistant response)
    asst_msg = next((m for m in messages if m['role'] == 'assistant'), None)
    if not asst_msg or len(asst_msg['content'].split()) > 100:
        # This is already a complex example, keep as-is
        return [example]

    # Extract original data
    system_msg = next((m for m in messages if m['role'] == 'system'), None)
    spec_text = asst_msg['content']

    # Parse the spec
    parsed = parse_component_spec(spec_text)
    component_name = parsed['component_name']

    if not component_name:
        # Can't parse, return original
        return [example]

    # Generate variations
    variations = []
    variation_types = [
        generate_direct_question,
        lambda c, p: generate_specific_attribute_question(c, p),
        lambda c, p: generate_recommendation_context(c, p),
        lambda c, p: generate_psu_requirement_question(c, p),
    ]

    # Shuffle for randomness
    random.shuffle(variation_types)

    for i in range(min(num_variations, len(variation_types))):
        generator = variation_types[i]

        try:
            if generator == generate_direct_question:
                conv = generator(component_name, spec_text)
            else:
                conv = generator(component_name, parsed)

            if conv:
                messages_new = []
                if system_msg:
                    messages_new.append(system_msg)
                messages_new.extend(conv)

                variations.append({"messages": messages_new})
        except Exception as e:
            # If generation fails, skip this variation
            print(f"Warning: Failed to generate variation for {component_name}: {e}")
            continue

    # If no variations were generated, return original
    if not variations:
        return [example]

    return variations

def main():
    print("🔄 Generating conversational variations for PC spec dataset...\n")

    input_file = "/home/juan-canfield/Desktop/web-ui/lib/training/logs/datasets/job_0bcdf42e-2f38-43ed-9d4c-8f17e9741e8a/82a3569d-eb42-4f82-a8ee-dae63e93677d.jsonl"
    output_file = "/home/juan-canfield/Desktop/web-ui/output/In_progress/pc_expert_conversational.jsonl"

    print(f"📂 Loading dataset from: {input_file}")

    with open(input_file, 'r', encoding='utf-8') as f:
        examples = [json.loads(line) for line in f if line.strip()]

    print(f"  ✓ Loaded {len(examples)} examples\n")

    # Process examples
    print("🔨 Generating variations...")
    print("  (This will take a few minutes...)\n")

    all_variations = []
    simple_count = 0
    complex_count = 0

    for i, example in enumerate(examples):
        if i % 5000 == 0:
            print(f"  Processed {i}/{len(examples)} examples...")

        # Check if simple or complex
        asst_msg = next((m for m in example.get('messages', []) if m['role'] == 'assistant'), None)
        is_simple = asst_msg and len(asst_msg['content'].split()) <= 100

        if is_simple:
            # Generate 3-4 variations
            variations = generate_variations(example, num_variations=random.randint(3, 4))
            all_variations.extend(variations)
            simple_count += 1
        else:
            # Keep complex examples as-is
            all_variations.append(example)
            complex_count += 1

    print(f"\n✅ Generation complete!")
    print(f"\n📊 Statistics:")
    print(f"  Simple spec examples: {simple_count}")
    print(f"  Complex examples: {complex_count}")
    print(f"  Total variations generated: {len(all_variations)}")
    print(f"  Average variations per simple example: {len(all_variations) / simple_count:.1f}")

    # Save
    print(f"\n💾 Saving to: {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        for ex in all_variations:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

    import os
    file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
    print(f"  ✓ Saved {len(all_variations)} examples ({file_size_mb:.1f} MB)")

    print(f"\n✨ Dataset ready for training!")
    print(f"\n📈 Expected improvement:")
    print(f"  - More varied questions → harder to memorize")
    print(f"  - Conversational tone → better for real use")
    print(f"  - Balanced dataset → less overfitting")

if __name__ == "__main__":
    random.seed(42)
    main()
