#!/usr/bin/env python3
"""
Check HuggingFace model configuration for quantization settings
"""
import json
import urllib.request

MODEL_ID = "Canfield/llama-3-2-3b-instruct-new-atlas-dataset"

print(f"Checking model configuration for: {MODEL_ID}\n")
print("=" * 60)

# Check config.json
try:
    config_url = f"https://huggingface.co/{MODEL_ID}/raw/main/config.json"
    print(f"\nFetching: {config_url}")
    
    with urllib.request.urlopen(config_url) as response:
        config = json.loads(response.read())
    
    print("\n✅ config.json found")
    print("\nKey settings:")
    print(f"  Model type: {config.get('model_type', 'unknown')}")
    print(f"  Architecture: {config.get('architectures', ['unknown'])[0]}")
    
    # Check for quantization settings
    if 'quantization_config' in config:
        print("\n⚠️  QUANTIZATION CONFIG FOUND:")
        quant_config = config['quantization_config']
        print(f"  Quantization method: {quant_config.get('quant_method', 'unknown')}")
        print(f"  Load in 4bit: {quant_config.get('load_in_4bit', False)}")
        print(f"  Load in 8bit: {quant_config.get('load_in_8bit', False)}")
        print(f"  BNB 4bit quant type: {quant_config.get('bnb_4bit_quant_type', 'N/A')}")
        print(f"  BNB 4bit compute dtype: {quant_config.get('bnb_4bit_compute_dtype', 'N/A')}")
        print("\n❌ PROBLEM: Model has quantization config but inference endpoint")
        print("   doesn't have bitsandbytes installed!")
        print("\n🔧 SOLUTION: Need to save model WITHOUT quantization config")
    else:
        print("\n✅ No quantization config found (good for inference)")
    
    # Check torch_dtype
    if 'torch_dtype' in config:
        print(f"\n  Torch dtype: {config['torch_dtype']}")
    
except Exception as e:
    print(f"\n❌ Error fetching config: {e}")

print("\n" + "=" * 60)
print("\nDIAGNOSIS:")
print("-----------")
print("The error shows your model config references bitsandbytes quantization")
print("but the HF Inference Endpoint doesn't have bitsandbytes installed.")
print("\nThe model was likely saved during training with quantization enabled,")
print("which saved the quantization_config into config.json.")
