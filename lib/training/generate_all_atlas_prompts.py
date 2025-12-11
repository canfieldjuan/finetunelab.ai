#!/usr/bin/env python3
"""
Generate Atlas prompts for all documentation chunks
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
"""

def create_qa_generation_prompt(chunk: Dict, chunk_idx: int) -> Dict:
    """Create Atlas Q&A generation prompt from chunk"""

    doc_name = chunk['source_file'].replace('.md', '')
    title = chunk['title']
    content = chunk['content']

    system_prompt = f"""{ATLAS_PERSONA}

**Documentation: {doc_name}**
**Section: {title}**

{content}
"""

    user_prompt = f"""Generate realistic Q&A training data for Atlas about "{title}" from FineTune Lab.

Create a JSON object with:

1. **single_turn**: Array of 10-15 single question-answer pairs
   - Questions users would actually ask about this feature
   - Atlas answers: helpful, specific, naturally mentions benefits
   - Vary question types (how to, what is, can I, why, etc.)
   - Include 1-2 gentle CTAs: "Want to see this in action? Sign up takes 2 minutes!"
   - Be specific about the feature details

2. **multi_turn**: Array of 3-5 conversation threads (3-5 exchanges each)
   - Realistic user journey with follow-up questions
   - Atlas guides them deeper, suggests related features
   - Natural flow: curiosity → understanding → interest → sign-up consideration
   - End with gentle encouragement

**Format:**
```json
{{
  "single_turn": [
    {{
      "user": "What is...?",
      "atlas": "Great question! [Specific answer with feature details]..."
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

Make Atlas sound like a real teammate who loves helping users, not a sales bot. Be specific, build trust, guide naturally."""

    return {
        "id": f"{doc_name}_{chunk_idx:03d}_{title.lower().replace(' ', '_')[:50]}",
        "system_prompt": system_prompt,
        "user_prompt": user_prompt,
        "metadata": {
            "chunk_index": chunk_idx,
            "source_file": chunk['source_file'],
            "section_title": title,
            "h2_section": chunk.get('h2_section', ''),
            "content_length": len(content)
        }
    }

def main():
    chunks_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/all_docs_chunks.json")

    with open(chunks_path, 'r', encoding='utf-8') as f:
        chunks = json.load(f)

    print("="*80)
    print("GENERATING ATLAS PROMPTS FOR ALL DOCUMENTATION")
    print("="*80)
    print()

    prompts = []

    # Group by source file for reporting
    by_file = {}
    for i, chunk in enumerate(chunks):
        prompt = create_qa_generation_prompt(chunk, i)
        prompts.append(prompt)

        file_name = chunk['source_file']
        if file_name not in by_file:
            by_file[file_name] = 0
        by_file[file_name] += 1

    print("📊 Prompts by document:")
    for file_name, count in sorted(by_file.items()):
        print(f"   {file_name}: {count} prompts")

    print()
    print(f"✅ Total prompts: {len(prompts)}")
    print()

    # Save prompts
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/all_atlas_prompts.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()
    print("📋 Estimated output:")
    print(f"   Single-turn Q&As: {len(prompts) * 12} (avg 12 per chunk)")
    print(f"   Multi-turn conversations: {len(prompts) * 4} (avg 4 per chunk)")
    print(f"   Total training examples: ~{len(prompts) * 16}")
    print()
    print("🚀 Ready for parallel execution!")
    print("   Run: python3 parallel_deepseek_all.py")

if __name__ == "__main__":
    main()
