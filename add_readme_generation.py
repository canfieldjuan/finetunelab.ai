#!/usr/bin/env python3
"""Add README.md generation to runpod-service.ts before HuggingFace upload"""

file_path = 'lib/training/runpod-service.ts'

# Read the file
with open(file_path, 'r') as f:
    lines = f.readlines()

# Find the line with api.upload_folder
insert_index = None
for i, line in enumerate(lines):
    if 'api.upload_folder(' in line:
        insert_index = i
        break

if insert_index is None:
    print("ERROR: Could not find 'api.upload_folder(' in file")
    exit(1)

# Code to insert (with proper indentation)
readme_code = '''            # AUTO-CREATE README.md with pipeline_tag metadata
            readme_path = os.path.join(merged_model_path, "README.md")
            base_model_name = "${trainingConfig.model?.name || 'base-model'}"
            model_name = HF_REPO_NAME.split('/')[-1]
            
            readme_content = f"""---
pipeline_tag: text-generation
language:
- en
license: apache-2.0
base_model: {base_model_name}
tags:
- instruction-following
- chat
- fine-tuned
library_name: transformers
---

# {model_name}

Fine-tuned version of {base_model_name} using {training_method.upper()}.

## Usage

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model = AutoModelForCausalLM.from_pretrained("{HF_REPO_NAME}")
tokenizer = AutoTokenizer.from_pretrained("{HF_REPO_NAME}")
```
"""
            
            logger.info("[HF Upload] Creating README.md with pipeline_tag: text-generation")
            with open(readme_path, 'w', encoding='utf-8') as f:
                f.write(readme_content)

'''

# Insert the code
lines.insert(insert_index, readme_code)

# Write back
with open(file_path, 'w') as f:
    f.writelines(lines)

print(f"✅ Successfully added README.md generation at line {insert_index + 1}")
print("README.md will now be auto-created before every HuggingFace upload with:")
print("  - pipeline_tag: text-generation")
print("  - base_model metadata")
print("  - usage instructions")
