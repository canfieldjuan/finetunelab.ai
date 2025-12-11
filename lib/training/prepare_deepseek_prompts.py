#!/usr/bin/env python3
"""
Prepare prompts for DeepSeek to answer questions using FineTune Lab knowledge base
Creates batches of questions + knowledge base context for efficient processing
"""

import json
from pathlib import Path
from typing import List, Dict

# System prompt for DeepSeek
DEEPSEEK_SYSTEM_PROMPT = """You are a helpful assistant for FineTune Lab, an LLM fine-tuning platform.

CRITICAL INSTRUCTIONS:
1. Answer questions ONLY using the provided FineTune Lab knowledge base below
2. Be specific and accurate - include exact values, endpoints, file paths when available
3. If the knowledge base doesn't contain the answer, say "I don't have that information in the knowledge base"
4. Cite source information when possible (e.g., "According to the deployment docs...")
5. Keep answers concise but complete (2-4 sentences typically)
6. Use technical terminology correctly

Your answers will be used to train an AI assistant, so accuracy is critical."""

def load_knowledge_base(kb_path: str) -> str:
    """Load the knowledge base"""
    return Path(kb_path).read_text(encoding='utf-8')

def load_questions(questions_path: str) -> List[str]:
    """Load questions from file"""
    return Path(questions_path).read_text(encoding='utf-8').strip().split('\n')

def create_batch_prompt(questions: List[str], knowledge_base: str, batch_num: int) -> str:
    """Create a single batch prompt for DeepSeek"""

    prompt = f"""# FineTune Lab Knowledge Base

{knowledge_base}

---

# Questions to Answer (Batch {batch_num})

Please answer each question below using ONLY the knowledge base provided above. Format your response as a JSON array where each element has "question" and "answer" fields.

Questions:
"""

    for i, q in enumerate(questions, 1):
        prompt += f"{i}. {q}\n"

    prompt += """
---

Output Format (JSON):
[
  {
    "question": "Question text here",
    "answer": "Answer using knowledge base here"
  },
  ...
]

Remember: Only use information from the knowledge base above. Be specific with exact values, endpoints, and technical details."""

    return prompt

def create_single_question_prompts(questions: List[str], knowledge_base: str) -> List[Dict[str, str]]:
    """Create individual prompts for each question (more reliable for API calls)"""

    prompts = []

    for i, question in enumerate(questions, 1):
        prompt = {
            "question_num": i,
            "question": question,
            "system_prompt": DEEPSEEK_SYSTEM_PROMPT,
            "user_prompt": f"""# FineTune Lab Knowledge Base

{knowledge_base}

---

# Question

{question}

---

Please answer this question using ONLY the information provided in the knowledge base above. Be specific and include exact values, endpoints, file paths, or technical details when available."""
        }
        prompts.append(prompt)

    return prompts

def save_batch_prompts(questions: List[str], knowledge_base: str, output_dir: str, batch_size: int = 20):
    """Save prompts in batches"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    num_batches = (len(questions) + batch_size - 1) // batch_size

    for i in range(num_batches):
        start_idx = i * batch_size
        end_idx = min(start_idx + batch_size, len(questions))
        batch_questions = questions[start_idx:end_idx]

        prompt = create_batch_prompt(batch_questions, knowledge_base, i + 1)

        batch_file = output_path / f"deepseek_batch_{i+1:03d}.txt"
        batch_file.write_text(prompt, encoding='utf-8')

    print(f"✅ Created {num_batches} batch prompts (batch size: {batch_size})")
    print(f"📁 Saved to: {output_path}/")

    return num_batches

def save_single_prompts(questions: List[str], knowledge_base: str, output_file: str):
    """Save individual prompts as JSON (easier for API automation)"""
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    prompts = create_single_question_prompts(questions, knowledge_base)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Created {len(prompts)} individual prompts")
    print(f"📁 Saved to: {output_path}")
    print(f"📊 Size: {output_path.stat().st_size / 1024:.1f} KB")

    return prompts

def create_deepseek_api_script(prompts_file: str, output_script: str):
    """Create a Python script template for calling DeepSeek API"""

    script_content = '''#!/usr/bin/env python3
"""
Call DeepSeek API to answer FineTune Lab questions
Requires: pip install openai
Set DEEPSEEK_API_KEY environment variable
"""

import os
import json
import time
from pathlib import Path
from openai import OpenAI

# Initialize DeepSeek client (compatible with OpenAI SDK)
client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com/v1"
)

def call_deepseek(system_prompt: str, user_prompt: str, model: str = "deepseek-chat") -> str:
    """Call DeepSeek API"""
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.1,  # Low temperature for factual answers
        max_tokens=500
    )
    return response.choices[0].message.content

def main():
    # Load prompts
    prompts_path = "''' + prompts_file + '''"
    with open(prompts_path, 'r', encoding='utf-8') as f:
        prompts = json.load(f)

    print(f"Processing {len(prompts)} questions...")

    results = []

    for i, prompt_data in enumerate(prompts, 1):
        print(f"\\n[{i}/{len(prompts)}] {prompt_data['question']}")

        try:
            answer = call_deepseek(
                prompt_data['system_prompt'],
                prompt_data['user_prompt']
            )

            results.append({
                "question": prompt_data['question'],
                "answer": answer
            })

            print(f"✅ Answer: {answer[:100]}...")

            # Rate limiting
            time.sleep(1)

        except Exception as e:
            print(f"❌ Error: {e}")
            results.append({
                "question": prompt_data['question'],
                "answer": f"ERROR: {str(e)}"
            })

    # Save results
    output_path = Path("deepseek_answers.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"\\n✅ Saved {len(results)} answers to {output_path}")

if __name__ == "__main__":
    main()
'''

    output_path = Path(output_script)
    output_path.write_text(script_content, encoding='utf-8')
    output_path.chmod(0o755)  # Make executable

    print(f"\n✅ Created DeepSeek API script")
    print(f"📁 Location: {output_path}")
    print(f"\n💡 To use:")
    print(f"   1. Set API key: export DEEPSEEK_API_KEY='your-key-here'")
    print(f"   2. Install OpenAI SDK: pip install openai")
    print(f"   3. Run: python3 {output_path.name}")

def main():
    print("="*80)
    print("PREPARING DEEPSEEK PROMPTS")
    print("="*80)
    print()

    # Paths
    kb_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/finetune_lab_knowledge_base.txt"
    questions_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_questions_1000.txt"
    output_dir = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_prompts"
    prompts_json = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_prompts.json"
    api_script = "/home/juan-canfield/Desktop/web-ui/lib/training/call_deepseek_api.py"

    # Load data
    print("📚 Loading knowledge base...")
    knowledge_base = load_knowledge_base(kb_path)
    print(f"   Size: {len(knowledge_base)} characters")

    print("\n📋 Loading questions...")
    questions = load_questions(questions_path)
    print(f"   Count: {len(questions)} questions")

    # Create batch prompts (for manual copy-paste)
    print("\n📦 Creating batch prompts...")
    num_batches = save_batch_prompts(questions, knowledge_base, output_dir, batch_size=20)

    # Create single prompts JSON (for API automation)
    print("\n🔧 Creating API-ready prompts...")
    prompts = save_single_prompts(questions, knowledge_base, prompts_json)

    # Create API script
    print("\n⚙️  Creating DeepSeek API caller script...")
    create_deepseek_api_script(prompts_json, api_script)

    print("\n" + "="*80)
    print("READY FOR DEEPSEEK!")
    print("="*80)
    print("\nYou have 2 options:")
    print("\n📋 Option 1: Manual (Copy-Paste)")
    print(f"   - Open files in: {output_dir}/")
    print(f"   - Copy each batch to DeepSeek chat")
    print(f"   - Collect answers manually")

    print("\n🤖 Option 2: Automated (API)")
    print(f"   - Set DeepSeek API key")
    print(f"   - Run: python3 {api_script}")
    print(f"   - Answers saved to deepseek_answers.json")

    print("\n💡 Next Step After Getting Answers:")
    print("   - Convert answers to training dataset format")
    print("   - python3 format_deepseek_dataset.py")

if __name__ == "__main__":
    main()
