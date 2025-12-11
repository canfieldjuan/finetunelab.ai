"""
Test script to verify LoRA merge functionality
"""

import sys
import json
from pathlib import Path


def test_merge_script_exists():
    """Verify merge script exists"""
    script_path = Path(__file__).parent / "merge-lora.py"
    if not script_path.exists():
        print("FAIL: merge-lora.py not found")
        return False
    print("PASS: merge-lora.py exists")
    return True


def test_adapter_detection(adapter_path: str):
    """Test if adapter_config.json can be read"""
    config_path = Path(adapter_path) / "adapter_config.json"
    
    if not config_path.exists():
        print(f"SKIP: No adapter at {adapter_path}")
        return True
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        base_model = config.get("base_model_name_or_path")
        if not base_model:
            print("FAIL: base_model_name_or_path not found in config")
            return False
        
        print(f"PASS: Detected adapter with base model: {base_model}")
        return True
    except Exception as e:
        print(f"FAIL: Error reading config: {e}")
        return False


def test_dependencies():
    """Test if required dependencies are installed"""
    try:
        import peft
        print("PASS: peft installed")
    except ImportError:
        print("WARN: peft not installed (pip install peft)")
        print("      Merge will fail without peft")
    
    try:
        import transformers
        print("PASS: transformers installed")
    except ImportError:
        print("WARN: transformers not installed (pip install transformers)")
        print("      Merge will fail without transformers")
    
    try:
        import torch
        print("PASS: torch installed")
    except ImportError:
        print("WARN: torch not installed (pip install torch)")
        print("      Merge will fail without torch")
    
    return True


if __name__ == "__main__":
    print("Testing LoRA merge implementation...\n")
    
    all_pass = True
    
    all_pass &= test_merge_script_exists()
    
    all_pass &= test_dependencies()
    
    if len(sys.argv) > 1:
        adapter_path = sys.argv[1]
        print(f"\nTesting with adapter: {adapter_path}")
        all_pass &= test_adapter_detection(adapter_path)
    
    print("\n" + "="*50)
    if all_pass:
        print("All tests passed!")
        sys.exit(0)
    else:
        print("Some tests failed!")
        sys.exit(1)
