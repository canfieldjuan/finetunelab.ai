"""
DEPRECATED: This script merges LoRA adapters into full models (50MB -> 1-14GB).

WARNING: This creates massive storage waste!
- Input: 50MB LoRA adapter
- Output: 1-14GB merged model (280x larger!)
- Alternative: Use vLLM native LoRA support (--enable-lora flag)

Merge LoRA adapter with base model to create a full fine-tuned model.
This is required when vLLM doesn't support LoRA for a specific architecture.

RECOMMENDED: Use native LoRA deployment instead to save storage.
"""

import argparse
import json
import os
import sys
from pathlib import Path


def merge_lora_adapter(adapter_path: str, output_path: str, base_model_override: str = None):
    """
    Merge LoRA adapter with its base model to create a full model.
    
    DEPRECATED: This function creates 1-14GB merged models from 50MB adapters.
    Use vLLM's native LoRA support instead to avoid storage waste.
    
    Args:
        adapter_path: Path to the LoRA adapter directory
        output_path: Path where the merged model will be saved
        base_model_override: Optional override for base model path
    """
    print("=" * 80)
    print("WARNING: You are using a DEPRECATED merge script!")
    print("This creates 1-14GB merged models from 50MB LoRA adapters (280x storage waste)")
    print("RECOMMENDED: Use vLLM native LoRA support instead:")
    print("  - Add --enable-lora flag to vLLM container")
    print("  - Load adapters dynamically via /v1/load_lora_adapter API")
    print("  - Saves 1-14GB per deployment")
    print("=" * 80)
    print("")
    
    try:
        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer
    except ImportError:
        print("ERROR: Required libraries not installed")
        print("Install with: pip install peft transformers torch")
        sys.exit(1)
    
    print(f"[Merge] Loading adapter config from: {adapter_path}")
    
    config_path = Path(adapter_path) / "adapter_config.json"
    if not config_path.exists():
        print(f"ERROR: adapter_config.json not found at {config_path}")
        sys.exit(1)
    
    with open(config_path, 'r') as f:
        adapter_config = json.load(f)
    
    if base_model_override:
        base_model_name = base_model_override
        print(f"[Merge] Using override base model: {base_model_name}")
    else:
        base_model_name = adapter_config.get("base_model_name_or_path")
        if not base_model_name:
            print("ERROR: base_model_name_or_path not found in adapter_config.json")
            sys.exit(1)
        print(f"[Merge] Base model from config: {base_model_name}")
    
    try:
        print(f"[Merge] Loading base model...")
        base_model = AutoModelForCausalLM.from_pretrained(
            base_model_name,
            trust_remote_code=True,
            device_map="auto"
        )
        
        print(f"[Merge] Loading LoRA adapter...")
        model = PeftModel.from_pretrained(base_model, adapter_path)
        
        print(f"[Merge] Merging LoRA weights...")
        merged_model = model.merge_and_unload()
        
        print(f"[Merge] Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(
            base_model_name, 
            trust_remote_code=True
        )
        
        print(f"[Merge] Saving merged model to: {output_path}")
        os.makedirs(output_path, exist_ok=True)
        merged_model.save_pretrained(output_path)
        tokenizer.save_pretrained(output_path)
        
        print(f"[Merge] SUCCESS! Merged model saved to: {output_path}")
        return 0
        
    except Exception as e:
        print(f"ERROR during merge: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge LoRA adapter with base model")
    parser.add_argument("--adapter", required=True, help="Path to LoRA adapter directory")
    parser.add_argument("--output", required=True, help="Output path for merged model")
    parser.add_argument("--base-model", help="Optional: Override base model path")
    
    args = parser.parse_args()
    
    exit_code = merge_lora_adapter(
        args.adapter, 
        args.output,
        args.base_model
    )
    sys.exit(exit_code)

