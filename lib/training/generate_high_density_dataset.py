#!/usr/bin/env python3
"""
Generate high-density dataset with MAXIMUM repetition of specific facts
Every conversation MUST include at least one of: exact file paths, exact API endpoints, exact default values
"""

import json
import random
from pathlib import Path
from typing import List, Dict

SYSTEM_PROMPT = "You are a helpful assistant for FineTune Lab. Provide accurate, specific information about the platform's implementation details."

# GROUND TRUTH - these must appear in EVERY relevant conversation
FACTS = {
    "learning_rate": "2e-5",
    "gpu_memory": "0.8",
    "warmup_ratio": "0.03",
    "eval_split": "0.2",
    "training_output": "lib/training/logs/job_<job_id>",
    "training_server": "lib/training/training_server.py",
    "dataset_validator": "lib/training/dataset_validator.py",
    "start_endpoint": "/api/training/local/start",
    "deploy_endpoint": "/api/training/deploy",
    "jobs_endpoint": "/api/training/local/jobs",
    "vllm_port_start": "8002",
    "vllm_port_end": "8020",
}

def generate_learning_rate_qa() -> List[Dict]:
    """Generate Q&A about learning rate - MUST include 2e-5"""
    base_qa = [
        ("What's the default learning rate?", f"The default learning rate in FineTune Lab is {FACTS['learning_rate']}."),
        ("What learning rate should I use for LoRA training?", f"For LoRA training in FineTune Lab, the recommended default is {FACTS['learning_rate']} (0.00002)."),
        ("What learning rate does FineTune Lab recommend?", f"FineTune Lab recommends {FACTS['learning_rate']} for most training tasks."),
        ("Is 2e-5 the right learning rate?", f"Yes, {FACTS['learning_rate']} is the default learning rate in FineTune Lab."),
        ("My training is unstable. What learning rate should I try?", f"Try the default {FACTS['learning_rate']} first. If still unstable, reduce to 1e-5."),
        ("What's the learning rate setting?", f"The learning rate is {FACTS['learning_rate']} by default in FineTune Lab."),
        ("I need to know the default LR", f"The default learning rate (LR) is {FACTS['learning_rate']}."),
        ("What LR for fine-tuning?", f"Use {FACTS['learning_rate']} for fine-tuning in FineTune Lab."),
        ("Recommended learning rate?", f"{FACTS['learning_rate']} is recommended."),
        ("Default LR value?", f"{FACTS['learning_rate']}"),
        ("What's 2e-5 in FineTune Lab?", f"{FACTS['learning_rate']} is the default learning rate."),
        ("Should I use 2e-5?", f"Yes, {FACTS['learning_rate']} is the recommended default."),
        ("Why use 2e-5?", f"{FACTS['learning_rate']} is a good learning rate for LoRA - low enough to be stable, high enough to learn effectively."),
        ("Can I change from 2e-5?", f"Yes, you can change from the default {FACTS['learning_rate']}, but it's a good starting point."),
        ("Is 2e-5 too low?", f"No, {FACTS['learning_rate']} is appropriate for LoRA training."),
    ]

    return [{"messages": [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": q},
        {"role": "assistant", "content": a}
    ]} for q, a in base_qa]

def generate_gpu_memory_qa() -> List[Dict]:
    """Generate Q&A about GPU memory - MUST include 0.8"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the default GPU memory utilization?"},
                {"role": "assistant", "content": f"The default GPU memory utilization for vLLM in FineTune Lab is {FACTS['gpu_memory']} (80%)."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What GPU memory setting does FineTune Lab use?"},
                {"role": "assistant", "content": f"FineTune Lab uses {FACTS['gpu_memory']} GPU memory utilization by default."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Is 0.8 the default GPU memory?"},
                {"role": "assistant", "content": f"Yes, {FACTS['gpu_memory']} (80%) is the default GPU memory utilization in FineTune Lab."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "How much GPU memory does vLLM use?"},
                {"role": "assistant", "content": f"vLLM uses {FACTS['gpu_memory']} (80%) of available GPU memory by default in FineTune Lab."},
            ]
        },
    ]

def generate_warmup_qa() -> List[Dict]:
    """Generate Q&A about warmup - MUST include 0.03"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the default warmup ratio?"},
                {"role": "assistant", "content": f"The default warmup ratio in FineTune Lab is {FACTS['warmup_ratio']} (3% of total steps)."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What warmup ratio does FineTune Lab use?"},
                {"role": "assistant", "content": f"FineTune Lab uses a warmup ratio of {FACTS['warmup_ratio']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Is 0.03 the default warmup?"},
                {"role": "assistant", "content": f"Yes, {FACTS['warmup_ratio']} is the default warmup ratio in FineTune Lab."},
            ]
        },
    ]

def generate_eval_split_qa() -> List[Dict]:
    """Generate Q&A about eval split - MUST include 0.2"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the train/eval split?"},
                {"role": "assistant", "content": f"The default eval split in FineTune Lab is {FACTS['eval_split']} (20% for evaluation, 80% for training)."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What eval split does FineTune Lab use?"},
                {"role": "assistant", "content": f"FineTune Lab uses {FACTS['eval_split']} as the default eval split."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Is 0.2 the default eval split?"},
                {"role": "assistant", "content": f"Yes, {FACTS['eval_split']} (20%) is the default evaluation split in FineTune Lab."},
            ]
        },
    ]

def generate_file_paths_qa() -> List[Dict]:
    """Generate Q&A about file paths - MUST include exact paths"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Where are training outputs saved?"},
                {"role": "assistant", "content": f"Training outputs are saved in {FACTS['training_output']}/."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the training output directory?"},
                {"role": "assistant", "content": f"The training output directory is {FACTS['training_output']}/."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Where does FineTune Lab save training logs?"},
                {"role": "assistant", "content": f"Training logs are saved in {FACTS['training_output']}/training.log."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Where is the training server code?"},
                {"role": "assistant", "content": f"The training server is located at {FACTS['training_server']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What file contains the training server?"},
                {"role": "assistant", "content": f"The training server is in {FACTS['training_server']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Where's the dataset validator?"},
                {"role": "assistant", "content": f"The dataset validator is located at {FACTS['dataset_validator']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What file validates datasets?"},
                {"role": "assistant", "content": f"Dataset validation is in {FACTS['dataset_validator']}."},
            ]
        },
    ]

def generate_api_endpoints_qa() -> List[Dict]:
    """Generate Q&A about API endpoints - MUST include exact endpoints"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What endpoint starts training?"},
                {"role": "assistant", "content": f"POST {FACTS['start_endpoint']} starts a training job."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "How do I start training via API?"},
                {"role": "assistant", "content": f"Make a POST request to {FACTS['start_endpoint']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the training start endpoint?"},
                {"role": "assistant", "content": f"The training start endpoint is {FACTS['start_endpoint']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What endpoint deploys models?"},
                {"role": "assistant", "content": f"POST {FACTS['deploy_endpoint']} deploys trained models."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "How do I deploy a model via API?"},
                {"role": "assistant", "content": f"Make a POST request to {FACTS['deploy_endpoint']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the deploy endpoint?"},
                {"role": "assistant", "content": f"The deploy endpoint is {FACTS['deploy_endpoint']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "How do I list training jobs?"},
                {"role": "assistant", "content": f"GET {FACTS['jobs_endpoint']} lists all training jobs."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the jobs endpoint?"},
                {"role": "assistant", "content": f"The jobs endpoint is {FACTS['jobs_endpoint']}."},
            ]
        },
    ]

def generate_port_range_qa() -> List[Dict]:
    """Generate Q&A about port range - MUST include 8002-8020"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What ports does vLLM use?"},
                {"role": "assistant", "content": f"vLLM uses ports {FACTS['vllm_port_start']}-{FACTS['vllm_port_end']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What's the vLLM port range?"},
                {"role": "assistant", "content": f"The vLLM port range is {FACTS['vllm_port_start']}-{FACTS['vllm_port_end']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What port will my model deploy to?"},
                {"role": "assistant", "content": f"Models deploy to the first available port in the range {FACTS['vllm_port_start']}-{FACTS['vllm_port_end']}."},
            ]
        },
    ]

def generate_multi_turn_combinations() -> List[Dict]:
    """Generate multi-turn conversations combining multiple facts"""
    return [
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "I want to start training. What's the API endpoint and default learning rate?"},
                {"role": "assistant", "content": f"POST {FACTS['start_endpoint']} to start training. The default learning rate is {FACTS['learning_rate']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "After training completes, where's the output and how do I deploy?"},
                {"role": "assistant", "content": f"Output is in {FACTS['training_output']}/. Deploy via POST {FACTS['deploy_endpoint']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What are the default training hyperparameters?"},
                {"role": "assistant", "content": f"Defaults: learning_rate={FACTS['learning_rate']}, warmup_ratio={FACTS['warmup_ratio']}, eval_split={FACTS['eval_split']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "What are the default vLLM deployment settings?"},
                {"role": "assistant", "content": f"Default GPU memory is {FACTS['gpu_memory']} (80%). Ports are {FACTS['vllm_port_start']}-{FACTS['vllm_port_end']}."},
            ]
        },
        {
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": "Where's the training server and dataset validator code?"},
                {"role": "assistant", "content": f"Training server: {FACTS['training_server']}, Dataset validator: {FACTS['dataset_validator']}."},
            ]
        },
    ]

def generate_all_qa() -> List[Dict]:
    """Generate all Q&A pairs"""
    all_qa = []

    all_qa.extend(generate_learning_rate_qa())
    all_qa.extend(generate_gpu_memory_qa())
    all_qa.extend(generate_warmup_qa())
    all_qa.extend(generate_eval_split_qa())
    all_qa.extend(generate_file_paths_qa())
    all_qa.extend(generate_api_endpoints_qa())
    all_qa.extend(generate_port_range_qa())
    all_qa.extend(generate_multi_turn_combinations())

    return all_qa

def save_dataset(conversations: List[Dict], output_path: str):
    """Save dataset"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        for conv in conversations:
            f.write(json.dumps(conv, ensure_ascii=False) + '\n')

    print(f"\n💾 Saved {len(conversations)} conversations")
    print(f"📊 File: {output_file}")
    print(f"   Size: {output_file.stat().st_size / 1024:.1f} KB")

def main():
    print("="*80)
    print("GENERATING HIGH-DENSITY FINETUNE LAB DATASET")
    print("="*80)
    print("\n🎯 Every conversation includes specific values: 2e-5, 0.8, 0.03, etc.")
    print()

    conversations = generate_all_qa()

    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/high_density_dataset_v1.jsonl"
    save_dataset(conversations, output_path)

    print(f"\n✨ Generated {len(conversations)} high-density Q&A pairs!")
    print(f"\n💡 Next: python3 assess_dataset_accuracy.py high_density_dataset_v1.jsonl {len(conversations)}")

if __name__ == "__main__":
    main()
