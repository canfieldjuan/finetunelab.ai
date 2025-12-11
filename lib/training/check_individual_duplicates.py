#!/usr/bin/env python3
import json
import hashlib

def load_jsonl(file_path):
    examples = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples

def get_example_hash(example):
    messages = example.get("messages", [])
    content = "\n".join([f"{m.get('role', '')}:{m.get('content', '')}" for m in messages])
    return hashlib.md5(content.encode('utf-8')).hexdigest()

# Check dataset 1
print("Checking Dataset 1 (combined_chatml_dataset.jsonl)...")
ds1 = load_jsonl("/home/juan-canfield/Desktop/web-ui/output/In_progress/combined_chatml_dataset.jsonl")
ds1_hashes = set()
ds1_dupes = 0
for ex in ds1:
    h = get_example_hash(ex)
    if h in ds1_hashes:
        ds1_dupes += 1
    else:
        ds1_hashes.add(h)
print(f"  Total: {len(ds1)}, Unique: {len(ds1_hashes)}, Duplicates within: {ds1_dupes}")

# Check dataset 2 (need to convert first)
print("\nChecking Dataset 2 (llama32-1b-finetune-lab-agent-dataset.jsonl)...")
ds2 = load_jsonl("/home/juan-canfield/Desktop/web-ui/output/In_progress/llama32-1b-finetune-lab-agent-dataset.jsonl")

def sharegpt_to_chatml(example):
    conversations = example.get("conversations", [])
    messages = []
    for conv in conversations:
        from_role = conv.get("from", "")
        value = conv.get("value", "")
        if from_role == "system":
            role = "system"
        elif from_role == "human":
            role = "user"
        elif from_role == "gpt":
            role = "assistant"
        else:
            role = from_role
        messages.append({"role": role, "content": value})
    return {"messages": messages}

ds2_converted = [sharegpt_to_chatml(ex) for ex in ds2]
ds2_hashes = set()
ds2_dupes = 0
for ex in ds2_converted:
    h = get_example_hash(ex)
    if h in ds2_hashes:
        ds2_dupes += 1
    else:
        ds2_hashes.add(h)
print(f"  Total: {len(ds2_converted)}, Unique: {len(ds2_hashes)}, Duplicates within: {ds2_dupes}")

# Check cross-dataset duplicates
cross_dupes = len(ds1_hashes.intersection(ds2_hashes))
print(f"\nCross-dataset duplicates: {cross_dupes}")
print(f"\nTotal unique across both: {len(ds1_hashes.union(ds2_hashes))}")
print(f"Math check: {len(ds1_hashes)} + {len(ds2_hashes)} - {cross_dupes} = {len(ds1_hashes) + len(ds2_hashes) - cross_dupes}")
