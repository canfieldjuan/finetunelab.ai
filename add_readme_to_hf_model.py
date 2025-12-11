#!/usr/bin/env python3
"""Add README.md with pipeline_tag to existing HuggingFace model"""

from huggingface_hub import HfApi
import os

# Configuration
HF_TOKEN = input("Enter your HuggingFace token: ").strip()
REPO_ID = "Canfield/llama-3-2-3b-instruct-new-atlas-dataset"

# README content with pipeline_tag metadata
readme_content = """---
pipeline_tag: text-generation
language:
- en
license: apache-2.0
base_model: meta-llama/Llama-3.2-3B-Instruct
tags:
- instruction-following
- chat
- fine-tuned
library_name: transformers
---

# llama-3-2-3b-instruct-new-atlas-dataset

Fine-tuned version of meta-llama/Llama-3.2-3B-Instruct.

## Usage

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("Canfield/llama-3-2-3b-instruct-new-atlas-dataset")
tokenizer = AutoTokenizer.from_pretrained("Canfield/llama-3-2-3b-instruct-new-atlas-dataset")

# Generate text
messages = [
    {"role": "user", "content": "Hello, how are you?"}
]
inputs = tokenizer.apply_chat_template(messages, return_tensors="pt")
outputs = model.generate(inputs, max_new_tokens=100)
print(tokenizer.decode(outputs[0]))
```

## Model Details

- **Base Model**: meta-llama/Llama-3.2-3B-Instruct
- **Fine-tuning Method**: LoRA/SFT
- **Task**: Instruction following and chat
"""

print(f"📝 Uploading README.md to {REPO_ID}...")
print(f"   This will add pipeline_tag: text-generation metadata")

try:
    api = HfApi()
    
    # Create a temporary README file
    with open("temp_README.md", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    # Upload to HuggingFace
    api.upload_file(
        path_or_fileobj="temp_README.md",
        path_in_repo="README.md",
        repo_id=REPO_ID,
        token=HF_TOKEN,
        repo_type="model",
        commit_message="Add README.md with pipeline_tag: text-generation"
    )
    
    # Clean up temp file
    os.remove("temp_README.md")
    
    print(f"✅ Successfully uploaded README.md!")
    print(f"🔗 View your model: https://huggingface.co/{REPO_ID}")
    print(f"")
    print(f"The model should now be recognized as a text-generation model.")
    print(f"Try using it with the HuggingFace Inference API again!")
    
except Exception as e:
    print(f"❌ Error uploading README: {e}")
    if os.path.exists("temp_README.md"):
        os.remove("temp_README.md")
