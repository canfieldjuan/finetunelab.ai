#!/usr/bin/env python3
"""
Generate prompts for RLHF dataset creation
Creates diverse questions across all FineTune Lab topics
"""

import json
from pathlib import Path
from typing import List, Dict

QUESTION_CATEGORIES = [
    {
        "category": "Training Basics",
        "topics": [
            "starting a training job", "dataset upload", "model selection",
            "hyperparameters", "training execution", "monitoring progress",
            "stopping training", "checkpoint management", "training errors"
        ],
        "count": 250
    },
    {
        "category": "Monitoring & Analytics",
        "topics": [
            "real-time metrics", "loss tracking", "GPU usage", "training logs",
            "performance graphs", "evaluation metrics", "early stopping",
            "job comparison", "analytics dashboard"
        ],
        "count": 200
    },
    {
        "category": "Deployment",
        "topics": [
            "model deployment", "vLLM setup", "Ollama integration",
            "RunPod serverless", "API endpoints", "inference testing",
            "GPU pricing", "scaling", "production deployment"
        ],
        "count": 200
    },
    {
        "category": "Features & Capabilities",
        "topics": [
            "batch testing", "regression gates", "public packages",
            "datasets management", "benchmark manager", "chat interface",
            "model comparison", "A/B testing", "quality control"
        ],
        "count": 250
    },
    {
        "category": "Platform & Workflow",
        "topics": [
            "getting started", "account setup", "platform features",
            "pricing", "hardware requirements", "API integration",
            "team features", "security", "data privacy"
        ],
        "count": 200
    },
    {
        "category": "Troubleshooting & Best Practices",
        "topics": [
            "OOM errors", "slow training", "poor results", "overfitting",
            "underfitting", "optimization tips", "dataset quality",
            "hyperparameter tuning", "debugging"
        ],
        "count": 200
    },
    {
        "category": "Advanced Topics",
        "topics": [
            "GraphRAG integration", "custom configurations", "advanced metrics",
            "multi-GPU training", "distributed training", "LoRA/QLoRA",
            "quantization", "model merging", "fine-tuning strategies"
        ],
        "count": 200
    },
    {
        "category": "Sales & Conversion",
        "topics": [
            "platform benefits", "cost comparison", "getting started",
            "free tier", "trial period", "use cases", "success stories",
            "vs competitors", "support options"
        ],
        "count": 300
    }
]

RLHF_CRITERIA = """
**CHOSEN Response (Atlas at his BEST):**
✅ Accurate and specific details from documentation
✅ Enthusiastic but professional tone
✅ Natural, conversational language
✅ Helpful follow-up suggestions
✅ Gentle CTA when appropriate: "Want to try this? Sign up takes 2 minutes!"
✅ Shows understanding of user needs
✅ Provides actionable steps
✅ Mentions relevant features naturally

**REJECTED Response (What Atlas should AVOID):**
❌ Generic, robotic answers
❌ Over-the-top sales pressure
❌ Technically inaccurate information
❌ Missing key details
❌ Too pushy about sign-ups
❌ Vague or unhelpful
❌ Ignores user's specific question
❌ Wrong tone (too formal or too casual)
❌ Making up features that don't exist
"""

def load_knowledge_base():
    """Load all documentation for context"""
    kb_files = [
        "/home/juan-canfield/Desktop/web-ui/output/evaluation/features_addendum_kb.txt",
    ]

    # Also load from chunks
    chunks_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/all_docs_chunks.json")
    if chunks_path.exists():
        with open(chunks_path, 'r', encoding='utf-8') as f:
            chunks = json.load(f)

        kb_text = "FINETUNE LAB DOCUMENTATION\n" + "="*80 + "\n\n"
        for chunk in chunks[:20]:  # Use subset for prompt size
            kb_text += f"\n## {chunk['title']}\n"
            kb_text += chunk['content'][:1000] + "\n"  # Truncate for size

        return kb_text

    return "FineTune Lab is a comprehensive platform for fine-tuning LLMs with monitoring, deployment, and analytics."

def create_rlhf_generation_prompts(num_prompts: int = 2000) -> List[Dict]:
    """Create prompts for DeepSeek to generate RLHF pairs"""

    knowledge_base = load_knowledge_base()

    prompts = []
    prompt_id = 0

    for category_info in QUESTION_CATEGORIES:
        category = category_info["category"]
        topics = category_info["topics"]
        target_count = category_info["count"]

        # Calculate prompts per topic
        prompts_per_topic = max(1, target_count // len(topics))

        for topic in topics:
            for batch in range(prompts_per_topic):
                prompt_id += 1

                system_prompt = f"""You are creating training data for Atlas, an AI guide at FineTune Lab.

KNOWLEDGE BASE:
{knowledge_base[:8000]}

TASK: Generate a realistic Q&A pair with BOTH a good and bad response variant.

{RLHF_CRITERIA}

Generate diverse, realistic questions that users would actually ask."""

                user_prompt = f"""Create ONE RLHF training example about "{topic}" in the "{category}" category.

Generate a JSON object:
```json
{{
  "prompt": "A realistic user question about {topic}",
  "chosen": "Atlas's BEST response - accurate, helpful, natural tone, gentle CTA",
  "rejected": "A BAD response - pick ONE flaw: too generic/too pushy/inaccurate/vague/wrong tone"
}}
```

Make the question natural and varied. Make "chosen" exemplary. Make "rejected" clearly worse in ONE specific way.

Output ONLY the JSON, nothing else."""

                prompts.append({
                    "id": f"rlhf_{prompt_id:04d}_{category.lower().replace(' ', '_')}_{topic.replace(' ', '_')[:30]}",
                    "system_prompt": system_prompt,
                    "user_prompt": user_prompt,
                    "metadata": {
                        "category": category,
                        "topic": topic,
                        "batch": batch
                    }
                })

                if prompt_id >= num_prompts:
                    return prompts

    return prompts

def main():
    print("="*80)
    print("GENERATING RLHF DATASET PROMPTS")
    print("="*80)
    print()

    target_examples = 2000
    print(f"🎯 Target: {target_examples} RLHF examples")
    print()

    prompts = create_rlhf_generation_prompts(target_examples)

    print(f"✅ Generated {len(prompts)} prompts")
    print()

    # Show distribution
    from collections import Counter
    by_category = Counter(p['metadata']['category'] for p in prompts)

    print("📊 Distribution by category:")
    for category, count in sorted(by_category.items(), key=lambda x: -x[1]):
        pct = (count / len(prompts)) * 100
        print(f"   {category}: {count} ({pct:.1f}%)")
    print()

    # Save prompts
    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/rlhf_generation_prompts.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved to: {output_path}")
    print(f"📏 File size: {output_path.stat().st_size:,} bytes")
    print()
    print("🚀 Ready for parallel DeepSeek processing!")
    print("   Next: python3 parallel_deepseek_rlhf.py")

if __name__ == "__main__":
    main()
