#!/usr/bin/env python3
"""
Verify that everything is ready for DeepSeek API call
Checks all files exist and are properly formatted
"""

import json
from pathlib import Path
import os

def check_file(path: str, min_size: int = 0) -> bool:
    """Check if file exists and meets minimum size"""
    p = Path(path)
    if not p.exists():
        print(f"❌ Missing: {path}")
        return False

    size = p.stat().st_size
    if size < min_size:
        print(f"❌ Too small: {path} ({size} bytes, need {min_size}+)")
        return False

    print(f"✅ Found: {path} ({size:,} bytes)")
    return True

def verify_knowledge_base(kb_path: str) -> bool:
    """Verify knowledge base content"""
    try:
        content = Path(kb_path).read_text()

        # Check for key sections
        required = [
            "API ENDPOINTS",
            "VERIFIED IMPLEMENTATION FACTS",
            "TRAINING WORKFLOW"
        ]

        missing = [req for req in required if req not in content]

        if missing:
            print(f"❌ Knowledge base missing sections: {missing}")
            return False

        print(f"✅ Knowledge base has all required sections")
        return True

    except Exception as e:
        print(f"❌ Error reading knowledge base: {e}")
        return False

def verify_questions(questions_path: str) -> bool:
    """Verify questions file"""
    try:
        questions = Path(questions_path).read_text().strip().split('\n')

        if len(questions) < 1000:
            print(f"❌ Only {len(questions)} questions, need 1000+")
            return False

        print(f"✅ {len(questions)} questions ready")
        return True

    except Exception as e:
        print(f"❌ Error reading questions: {e}")
        return False

def verify_prompts(prompts_path: str) -> bool:
    """Verify prompts JSON"""
    try:
        with open(prompts_path, 'r') as f:
            prompts = json.load(f)

        if len(prompts) < 1000:
            print(f"❌ Only {len(prompts)} prompts, need 1000+")
            return False

        # Check first prompt structure
        first = prompts[0]
        required_keys = ['question', 'system_prompt', 'user_prompt']

        missing = [key for key in required_keys if key not in first]
        if missing:
            print(f"❌ Prompts missing keys: {missing}")
            return False

        # Verify knowledge base is in prompts
        if 'Knowledge Base' not in first['user_prompt']:
            print(f"❌ Knowledge base NOT included in prompts!")
            return False

        kb_size = len(first['user_prompt'])
        if kb_size < 10000:
            print(f"❌ Knowledge base seems too small in prompt ({kb_size} chars)")
            return False

        print(f"✅ {len(prompts)} prompts with knowledge base included")
        print(f"   Each prompt ~{kb_size:,} characters")
        return True

    except Exception as e:
        print(f"❌ Error reading prompts: {e}")
        return False

def verify_api_key() -> bool:
    """Check if API key is set"""
    api_key = os.environ.get('DEEPSEEK_API_KEY', '')

    if not api_key:
        print(f"⚠️  DEEPSEEK_API_KEY not set")
        print(f"   Run: export DEEPSEEK_API_KEY='your-key-here'")
        return False

    if not api_key.startswith('sk-'):
        print(f"⚠️  API key doesn't look right (should start with 'sk-')")
        return False

    print(f"✅ DEEPSEEK_API_KEY set ({api_key[:15]}...)")
    return True

def verify_dependencies() -> bool:
    """Check if required packages are installed"""
    try:
        import openai
        print(f"✅ openai package installed")
        return True
    except ImportError:
        print(f"❌ openai package not installed")
        print(f"   Run: pip install openai")
        return False

def main():
    print("="*80)
    print("VERIFYING DEEPSEEK SETUP")
    print("="*80)
    print()

    base_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation"

    results = {}

    print("📂 Checking Files...")
    print()

    # Check knowledge base
    kb_path = f"{base_path}/finetune_lab_knowledge_base.txt"
    results['kb_exists'] = check_file(kb_path, 10000)
    if results['kb_exists']:
        results['kb_valid'] = verify_knowledge_base(kb_path)

    print()

    # Check questions
    questions_path = f"{base_path}/deepseek_questions_1000.txt"
    results['questions_exists'] = check_file(questions_path, 20000)
    if results['questions_exists']:
        results['questions_valid'] = verify_questions(questions_path)

    print()

    # Check prompts
    prompts_path = f"{base_path}/deepseek_prompts.json"
    results['prompts_exists'] = check_file(prompts_path, 10000000)  # 10MB
    if results['prompts_exists']:
        results['prompts_valid'] = verify_prompts(prompts_path)

    print()

    # Check API script
    api_script = "/home/juan-canfield/Desktop/web-ui/lib/training/call_deepseek_api.py"
    results['api_script'] = check_file(api_script, 1000)

    print()

    # Check formatter script
    formatter_script = "/home/juan-canfield/Desktop/web-ui/lib/training/format_deepseek_dataset.py"
    results['formatter_script'] = check_file(formatter_script, 1000)

    print()
    print("🔧 Checking Configuration...")
    print()

    results['api_key'] = verify_api_key()
    results['dependencies'] = verify_dependencies()

    print()
    print("="*80)

    # Summary
    all_required = [
        'kb_exists', 'kb_valid',
        'questions_exists', 'questions_valid',
        'prompts_exists', 'prompts_valid',
        'api_script', 'formatter_script',
        'dependencies'
    ]

    all_good = all(results.get(key, False) for key in all_required)

    if all_good and results.get('api_key'):
        print("🎉 ALL CHECKS PASSED!")
        print()
        print("✅ Ready to generate 1000+ training examples")
        print()
        print("Run this command:")
        print("  cd /home/juan-canfield/Desktop/web-ui/lib/training")
        print("  python3 call_deepseek_api.py")
        print()
        print("Expected:")
        print("  - Processing time: ~20 minutes")
        print("  - Cost: ~$2.14")
        print("  - Output: deepseek_answers.json (1005 Q&A pairs)")

    elif all_good:
        print("⚠️  ALMOST READY - Set API key first")
        print()
        print("Everything is ready except the API key.")
        print()
        print("Run this:")
        print("  export DEEPSEEK_API_KEY='sk-your-key-here'")
        print()
        print("Get your key from: https://platform.deepseek.com")

    else:
        print("❌ SETUP INCOMPLETE")
        print()
        failed = [key for key in all_required if not results.get(key, False)]
        print(f"Failed checks: {', '.join(failed)}")
        print()
        print("Review errors above and fix issues.")

    print("="*80)

if __name__ == "__main__":
    main()
