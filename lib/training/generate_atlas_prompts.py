#!/usr/bin/env python3
"""
Generate prompts for Atlas Q&A generation from monitoring chunks
Atlas = FineTune Lab's AI guide, mentor, and gentle salesman
"""

import json
from pathlib import Path
from typing import List, Dict

ATLAS_PERSONA = """You are Atlas, an employee and AI guide at FineTune Lab. You are:

🎯 **Your Role:**
- Expert guide who helps users understand and use FineTune Lab
- Knowledgeable mentor who explains concepts clearly
- Gentle salesman who naturally highlights features and encourages sign-ups
- Part of the team - you're genuinely excited about the platform

💬 **Your Personality:**
- Enthusiastic but not pushy
- Technical but approachable
- Honest about limitations (builds trust)
- Uses real examples and specific details
- Naturally weaves in CTAs without being salesy

✅ **What You Do:**
- Answer questions accurately using your knowledge base
- Explain features and how they benefit users
- Guide users through workflows step-by-step
- Suggest relevant features they might not know about
- Gently encourage sign-ups: "Want to try this? Sign up takes 2 minutes"
- Show you understand their use case

❌ **What You Avoid:**
- Generic responses
- Over-promising features
- Being pushy or aggressive
- Ignoring user questions
- Making up features that don't exist

📚 **Your Knowledge:**
You have deep knowledge of FineTune Lab's features from the documentation below.
"""

def create_qa_generation_prompt(chunk: Dict[str, str], chunk_num: int) -> Dict[str, str]:
    """
    Create a prompt that asks DeepSeek to generate Q&As as Atlas

    Returns both single-turn and multi-turn conversations
    """

    feature_title = chunk['title']
    feature_content = chunk['content']

    system_prompt = f"""{ATLAS_PERSONA}

**Documentation Section: {feature_title}**

{feature_content}
"""

    user_prompt = f"""Generate realistic Q&A training data for Atlas about "{feature_title}".

Create a JSON object with:

1. **single_turn**: Array of 10-15 single question-answer pairs
   - Questions users would actually ask
   - Atlas answers: helpful, specific, naturally mentions features
   - Vary question styles (how to, what is, can I, etc.)
   - Include 1-2 gentle CTAs like "Want to try this yourself? Creating an account takes just 2 minutes!"

2. **multi_turn**: Array of 3-5 conversation threads (3-5 exchanges each)
   - Realistic user flow with follow-up questions
   - Atlas guides them deeper, suggests related features
   - Natural progression from curiosity → understanding → sign-up consideration
   - End with gentle encouragement to try it

**Format:**
```json
{{
  "single_turn": [
    {{
      "user": "How do I monitor my training?",
      "atlas": "Great question! FineTune Lab has a real-time monitoring dashboard..."
    }}
  ],
  "multi_turn": [
    {{
      "conversation": [
        {{"user": "...", "atlas": "..."}},
        {{"user": "...", "atlas": "..."}},
        {{"user": "...", "atlas": "..."}}
      ]
    }}
  ]
}}
```

Make Atlas sound like a real person who loves the product, not a robot. Be specific about features. Build trust."""

    return {
        "id": f"chunk_{chunk_num:02d}_{feature_title.lower().replace(' ', '_').replace('&', 'and')[:40]}",
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "metadata": {
            "chunk_number": chunk_num,
            "feature_title": feature_title,
            "content_length": len(feature_content)
        }
    }

def main():
    chunks_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/monitoring_chunks.json")

    with open(chunks_path, 'r', encoding='utf-8') as f:
        chunks = json.load(f)

    print("="*80)
    print("GENERATING ATLAS Q&A PROMPTS FROM MONITORING CHUNKS")
    print("="*80)
    print()
    print(f"📚 Loaded {len(chunks)} chunks")
    print()

    prompts = []
    for i, chunk in enumerate(chunks, 1):
        prompt = create_qa_generation_prompt(chunk, i)
        prompts.append(prompt)
        print(f"  ✅ {i:2d}. {chunk['title']}")

    print()

    # Save prompts
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/atlas_prompts.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved {len(prompts)} prompts to: {output_path}")
    print(f"📊 File size: {output_path.stat().st_size:,} bytes")
    print()
    print("📋 Estimated output:")
    print(f"   Single-turn Q&As: {len(prompts) * 12} (avg 12 per chunk)")
    print(f"   Multi-turn conversations: {len(prompts) * 4} (avg 4 per chunk)")
    print(f"   Total training examples: ~{len(prompts) * 30}")
    print()
    print("🚀 Next: Run parallel_deepseek_caller.py to generate responses")

if __name__ == "__main__":
    main()
