#!/usr/bin/env python3
"""
Batch expand the dataset by adding question variations
This is a quick script to multiply examples across all categories
"""

import json
import random

# Read current dataset
input_file = "/home/juan-canfield/Desktop/web-ui/output/llama32-1b-finetune-lab-agent-dataset.jsonl"
output_file = "/home/juan-canfield/Desktop/web-ui/output/llama32-1b-finetune-lab-agent-dataset-expanded.jsonl"

# Question variation templates
question_variations = {
    # Make questions more casual/varied
    "How": ["How does", "How do", "How can", "How would", "Explain how", "Tell me how"],
    "What": ["What's", "What is", "What are", "Tell me what", "Explain what", "What about"],
    "Why": ["Why is", "Why are", "Why should", "Why would", "Why do", "Explain why", "Tell me why"],
    "Can I": ["Can I", "Could I", "Am I able to", "Is it possible to", "Do I have the option to"],
    "Do you": ["Do you have", "Do you offer", "Do you support", "Does it have", "Is there"],
    "Is": ["Is this", "Is it", "Are you", "Are there"],
}

examples = []
with open(input_file, 'r') as f:
    for line in f:
        examples.append(json.loads(line))

print(f"Loaded {len(examples)} examples")

# For each example, create 1-2 variations by slightly modifying the question
expanded_examples = []
for example in examples:
    # Add original
    expanded_examples.append(example)

    # Get the question
    if 'conversations' in example and len(example['conversations']) > 0:
        question = example['conversations'][0]['value']
        answer = example['conversations'][1]['value'] if len(example['conversations']) > 1 else ""

        # Try to create a variation
        # Simple variations: rephrase slightly
        variations = []

        if question.startswith("How"):
            variations.extend([
                question.replace("How does", "How can"),
                question.replace("How do", "How would"),
                "Explain " + question.lower(),
            ])
        elif question.startswith("What"):
            variations.extend([
                question.replace("What is", "What's"),
                question.replace("What are", "What's"),
                "Tell me " + question.lower(),
            ])
        elif question.startswith("Why"):
            variations.extend([
                question.replace("Why should", "Why would"),
                "Explain why" + question[3:].lower(),
            ])
        elif question.endswith("?"):
            # Add casual versions
            variations.append(question[:-1])  # Remove question mark
            variations.append(question.lower())  # Lowercase

        # Add one random variation
        if variations:
            var_q = random.choice(variations)
            if var_q != question and len(var_q) > 3:
                expanded_examples.append({
                    "conversations": [
                        {"from": "human", "value": var_q},
                        {"from": "gpt", "value": answer}
                    ]
                })

print(f"Expanded to {len(expanded_examples)} examples")

# Save expanded dataset
with open(output_file, 'w') as f:
    for ex in expanded_examples:
        f.write(json.dumps(ex) + '\n')

print(f"Saved to {output_file}")
print(f"Gain: +{len(expanded_examples) - len(examples)} examples")
