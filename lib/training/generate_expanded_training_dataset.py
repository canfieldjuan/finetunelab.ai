#!/usr/bin/env python3
"""
Generate expanded training dataset with variations
Takes base conversations and creates multiple variations to increase dataset size
"""

import json
import random
from pathlib import Path
from typing import List, Dict

# Load base dataset
def load_base_dataset(path: str) -> List[Dict]:
    """Load the base accurate dataset"""
    conversations = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            conversations.append(json.loads(line.strip()))
    return conversations

# Variation generators
def create_short_variation(base_conv: Dict) -> Dict:
    """Create a shorter variation with just the key facts"""
    messages = base_conv['messages']

    # Extract just first user question and first assistant response
    system_msg = messages[0] if messages[0]['role'] == 'system' else None

    new_messages = []
    if system_msg:
        new_messages.append(system_msg)

    # Find first user-assistant pair
    for i, msg in enumerate(messages):
        if msg['role'] == 'user':
            new_messages.append(msg)
            # Find corresponding assistant response
            for j in range(i+1, len(messages)):
                if messages[j]['role'] == 'assistant':
                    new_messages.append(messages[j])
                    break
            break

    return {"messages": new_messages}

def create_detailed_variation(base_conv: Dict) -> Dict:
    """Create a more detailed variation with extra context"""
    messages = base_conv['messages'].copy()

    # Add a follow-up question at the end
    if len(messages) >= 2 and messages[-1]['role'] == 'assistant':
        follow_ups = [
            ("user", "Can you explain more?"),
            ("user", "Thanks, that's helpful!"),
            ("user", "Got it, thanks!"),
            ("user", "Perfect, one more question - is this documented anywhere?"),
        ]

        follow_up_user, follow_up_text = random.choice(follow_ups)

        if "documented" in follow_up_text.lower():
            follow_up_response = "Yes, you can find more details in the FineTune Lab documentation at /docs/guides. The training configuration guide covers all these settings in depth."
        else:
            follow_up_response = "Happy to help! Let me know if you have any other questions about FineTune Lab."

        messages.append({"role": "user", "content": follow_up_text})
        messages.append({"role": "assistant", "content": follow_up_response})

    return {"messages": messages}

def create_rephrase_variation(base_conv: Dict) -> Dict:
    """Create variation with rephrased user questions"""
    messages = []

    # Rephrasing patterns
    rephrase_patterns = {
        "What": ["How do I find", "Where can I see", "Can you tell me"],
        "How do I": ["What's the way to", "How can I", "What do I need to do to"],
        "Where": ["How do I find", "What's the location of", "Can you show me where"],
        "Can": ["Is it possible to", "Am I able to", "How do I"],
    }

    for msg in base_conv['messages']:
        if msg['role'] == 'user':
            # Try to rephrase
            content = msg['content']
            rephrased = content

            for pattern, replacements in rephrase_patterns.items():
                if content.startswith(pattern):
                    replacement = random.choice(replacements)
                    rephrased = content.replace(pattern, replacement, 1)
                    break

            messages.append({"role": msg['role'], "content": rephrased})
        else:
            messages.append(msg)

    return {"messages": messages}

def create_concatenated_qa_variation(base_conv: Dict) -> Dict:
    """Create a single Q&A by concatenating the conversation"""
    messages = base_conv['messages']

    # Get system message
    system_msg = messages[0] if messages[0]['role'] == 'system' else {"role": "system", "content": "You are a helpful assistant for FineTune Lab."}

    # Collect all user questions
    user_questions = [msg['content'] for msg in messages if msg['role'] == 'user']

    # Collect all assistant responses
    assistant_responses = [msg['content'] for msg in messages if msg['role'] == 'assistant']

    if not user_questions or not assistant_responses:
        return base_conv

    # Create combined question
    if len(user_questions) == 1:
        combined_question = user_questions[0]
    else:
        combined_question = user_questions[0] + " " + " Also, " + " and ".join(user_questions[1:]).lower()

    # Create combined answer
    combined_answer = "\n\n".join(assistant_responses)

    return {
        "messages": [
            system_msg,
            {"role": "user", "content": combined_question},
            {"role": "assistant", "content": combined_answer},
        ]
    }

def expand_dataset(base_conversations: List[Dict], multiplier: int = 3) -> List[Dict]:
    """Expand dataset by creating variations"""
    expanded = []

    variation_functions = [
        create_short_variation,
        create_detailed_variation,
        create_rephrase_variation,
        create_concatenated_qa_variation,
    ]

    for conv in base_conversations:
        # Always include original
        expanded.append(conv)

        # Add variations
        variations_to_create = min(multiplier - 1, len(variation_functions))
        selected_variations = random.sample(variation_functions, variations_to_create)

        for var_func in selected_variations:
            try:
                varied_conv = var_func(conv)
                if varied_conv and len(varied_conv.get('messages', [])) >= 2:
                    expanded.append(varied_conv)
            except Exception as e:
                print(f"   ⚠️  Variation failed: {e}")
                continue

    return expanded

def save_dataset(conversations: List[Dict], output_path: str):
    """Save dataset in JSONL format"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        for conv in conversations:
            f.write(json.dumps(conv, ensure_ascii=False) + '\n')

    print(f"\n💾 Saved {len(conversations)} conversations to {output_file.name}")
    print(f"📊 File size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

    # Stats
    total_messages = sum(len(conv['messages']) for conv in conversations)
    avg_messages = total_messages / len(conversations) if conversations else 0

    print(f"\n📈 Dataset Stats:")
    print(f"   Total conversations: {len(conversations)}")
    print(f"   Average messages per conversation: {avg_messages:.1f}")
    print(f"   Total messages: {total_messages}")

def main():
    print("="*80)
    print("EXPANDING FINETUNE LAB TRAINING DATASET")
    print("="*80)

    # Load base dataset
    base_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/accurate_training_dataset_v2.jsonl"
    print(f"\n📂 Loading base dataset from {Path(base_path).name}...")

    base_conversations = load_base_dataset(base_path)
    print(f"   ✓ Loaded {len(base_conversations)} base conversations")

    # Expand with variations
    print(f"\n🔄 Generating variations (multiplier: 4x)...")
    expanded = expand_dataset(base_conversations, multiplier=4)

    # Save expanded dataset
    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/expanded_training_dataset_v1.jsonl"
    save_dataset(expanded, output_path)

    print(f"\n✨ Dataset expanded from {len(base_conversations)} to {len(expanded)} conversations!")
    print(f"\n💡 Next Steps:")
    print(f"   1. Assess quality: python3 assess_dataset_accuracy.py {output_path.split('/')[-1]}")
    print(f"   2. If score >80, use for training")
    print(f"   3. If score <80, add more specific examples")

if __name__ == "__main__":
    main()
