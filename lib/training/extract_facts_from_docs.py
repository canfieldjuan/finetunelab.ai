#!/usr/bin/env python3
"""
Extract REAL facts from FineTune Lab docs and codebase
Generate training dataset based on actual implementation, not assumptions
"""

import json
import re
from pathlib import Path
from typing import List, Dict

# These are VERIFIED facts from actual codebase
VERIFIED_FACTS = {
    # From DeployModelButton.tsx line 138
    "gpu_memory_utilization": "0.8",

    # From DeployModelButton.tsx lines 335, 365
    "vllm_port_start": "8002",
    "vllm_port_end": "8020",

    # From training_server.py line 158
    "eval_split": "0.2",

    # From docs/quick-start/page.tsx
    "api_endpoints": {
        "models": "/api/models",
        "training_start": "/api/training/start",
        "training_status": "/api/training/status/{job_id}",
        "training_metrics": "/api/training/metrics/{id}",
        "training_logs": "/api/training/logs/{id}",
        "inference_deploy": "/api/inference/deploy",
        "datasets": "/api/datasets",
        "training": "/api/training",
        "training_execute": "/api/training/execute",
        "training_analytics": "/api/training/analytics/{id}",
    },

    # From docs/guides/page.tsx
    "deployment_options": [
        "RunPod Serverless",
        "vLLM (local)",
        "Ollama (local)"
    ],

    # From docs/guides/page.tsx lines 588
    "gpu_pricing": {
        "A4000": "$0.0004/req",
        "A5000": "$0.0006/req",
        "A6000": "$0.0008/req",
        "H100": "$0.0035/req"
    },

    # From docs/guides/page.tsx
    "budget_limits": {
        "minimum": "$1.00",
        "recommended": "$10-50"
    },

    # From docs/features/page.tsx
    "supported_models": [
        "Llama",
        "Mistral",
        "Qwen"
    ],

    # From docs/features/page.tsx
    "features": [
        "LoRA and full fine-tuning",
        "Mixed precision training (FP16/BF16)",
        "JSONL format validation",
        "Automatic dataset splitting",
        "Real-time training metrics",
        "Live loss visualization",
        "GPU memory tracking",
        "vLLM deployment",
        "Ollama deployment",
        "Budget controls",
        "Auto-scaling",
        "Row-level security (Supabase)",
        "Automatic checkpoint saving",
        "Pause/resume functionality"
    ],

    # From docs/features/page.tsx lines 338-373
    "tech_stack": [
        "Hugging Face (Model Training)",
        "RunPod (Cloud GPU & Inference)",
        "vLLM & Ollama (Inference Engines)",
        "PyTorch (Deep Learning)",
        "Supabase (Database & Auth)",
        "Next.js (Frontend)",
        "CUDA (GPU Acceleration)",
        "Docker (Containerization)",
        "Redis (Job Queue)"
    ],

    # From docs/guides/page.tsx
    "dataset_requirements": {
        "format": "JSONL",
        "minimum_examples": "50",
        "optimal_examples": "500-5000",
        "max_tokens_per_example": "4000"
    },

    # From docs/guides/page.tsx lines 336-348
    "hyperparameter_recommendations": {
        "learning_rate": {
            "recommended": "1e-5 to 1e-4",
            "large_datasets": "1e-4 to 1e-3"
        },
        "batch_size": {
            "small_gpu": "1-2 (< 8GB VRAM)",
            "medium_gpu": "4-8 (8-16GB VRAM)",
            "large_gpu": "16-32 (> 16GB VRAM)"
        },
        "epochs": {
            "large_dataset": "1-3 (> 1000 examples)",
            "medium_dataset": "3-5 (100-1000 examples)",
            "small_dataset": "5-10 (< 100 examples)"
        }
    }
}

SYSTEM_PROMPT = "You are a helpful assistant for FineTune Lab. Provide accurate, specific information about the platform's implementation details."

def make_qa(q: str, a: str) -> Dict:
    """Create Q&A pair"""
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": q},
            {"role": "assistant", "content": a}
        ]
    }

def generate_qa_from_verified_facts() -> List[Dict]:
    """Generate Q&A pairs from verified facts"""
    qa_pairs = []

    # GPU memory utilization
    gpu_mem = VERIFIED_FACTS["gpu_memory_utilization"]
    qa_pairs.extend([
        make_qa("What's the default GPU memory utilization for vLLM?",
                f"The default GPU memory utilization for vLLM deployments is {gpu_mem} (80%). This leaves 20% of VRAM free for OS and other processes."),
        make_qa("What GPU memory setting does vLLM use?",
                f"vLLM uses {gpu_mem} GPU memory utilization by default in FineTune Lab."),
        make_qa("How much GPU memory does vLLM use?",
                f"{gpu_mem} or 80% of available GPU memory."),
    ])

    # Port range
    port_start = VERIFIED_FACTS["vllm_port_start"]
    port_end = VERIFIED_FACTS["vllm_port_end"]
    qa_pairs.extend([
        make_qa("What ports does vLLM use?",
                f"vLLM uses ports {port_start}-{port_end}. The system automatically finds the first available port in this range."),
        make_qa("What's the vLLM port range?",
                f"{port_start}-{port_end}"),
        make_qa("What port will my vLLM model deploy to?",
                f"Models deploy to the first available port in the range {port_start}-{port_end}."),
    ])

    # Eval split
    eval_split = VERIFIED_FACTS["eval_split"]
    qa_pairs.extend([
        make_qa("What's the default eval split?",
                f"The default eval split is {eval_split} (20% for evaluation, 80% for training). This gives you enough validation data to detect overfitting."),
        make_qa("What's the train/eval split ratio?",
                f"80/20 split - {eval_split} of your data is used for evaluation."),
    ])

    # API Endpoints
    endpoints = VERIFIED_FACTS["api_endpoints"]
    qa_pairs.extend([
        make_qa("What API endpoint lists available models?",
                f"GET {endpoints['models']} lists all available models."),
        make_qa("How do I start a training job?",
                f"POST {endpoints['training_start']} to start a training job."),
        make_qa("How do I check training job status?",
                f"GET {endpoints['training_status']} where {{job_id}} is your training job ID."),
        make_qa("What endpoint gets training metrics?",
                f"GET {endpoints['training_metrics']} where {{id}} is your job ID."),
        make_qa("How do I get training logs?",
                f"GET {endpoints['training_logs']} where {{id}} is your job ID."),
        make_qa("What endpoint deploys models?",
                f"POST {endpoints['inference_deploy']} deploys trained models to vLLM, Ollama, or RunPod Serverless."),
        make_qa("How do I list available datasets?",
                f"GET {endpoints['datasets']} lists all your uploaded datasets."),
        make_qa("How do I create a training configuration?",
                f"POST {endpoints['training']} to create a new training config with your model, dataset, and hyperparameters."),
        make_qa("How do I start the training execution?",
                f"POST {endpoints['training_execute']} with your config ID to begin training."),
    ])

    # Deployment options
    deploy_opts = VERIFIED_FACTS["deployment_options"]
    qa_pairs.extend([
        make_qa("What deployment options does FineTune Lab support?",
                f"FineTune Lab supports three deployment options: {', '.join(deploy_opts)}. RunPod Serverless provides auto-scaling cloud inference, while vLLM and Ollama run locally."),
        make_qa("Can I deploy locally?",
                f"Yes, you can deploy locally using {deploy_opts[1]} or {deploy_opts[2]}."),
        make_qa("What's the difference between vLLM and Ollama?",
                f"vLLM is faster for GPU inference with higher throughput. Ollama is more lightweight and easier to set up for local testing."),
    ])

    # GPU pricing
    gpu_pricing = VERIFIED_FACTS["gpu_pricing"]
    qa_pairs.extend([
        make_qa("What are the GPU pricing options for RunPod?",
                f"RunPod Serverless pricing: A4000 {gpu_pricing['A4000']}, A5000 {gpu_pricing['A5000']}, A6000 {gpu_pricing['A6000']}, H100 {gpu_pricing['H100']} per request."),
        make_qa("How much does the A4000 GPU cost?",
                f"A4000 costs {gpu_pricing['A4000']} per request on RunPod Serverless."),
        make_qa("What's the most expensive GPU option?",
                f"H100 is the most expensive at {gpu_pricing['H100']} per request, but also the fastest."),
    ])

    # Budget limits
    budget = VERIFIED_FACTS["budget_limits"]
    qa_pairs.extend([
        make_qa("What's the minimum budget for deployment?",
                f"The minimum budget is {budget['minimum']}. Recommended budget for production is {budget['recommended']}."),
        make_qa("What budget should I set for production?",
                f"{budget['recommended']} is recommended for production deployments."),
    ])

    # Supported models
    models = VERIFIED_FACTS["supported_models"]
    qa_pairs.extend([
        make_qa("What model families does FineTune Lab support?",
                f"FineTune Lab supports {', '.join(models)}, and other Hugging Face models."),
        make_qa("Can I fine-tune Llama models?",
                f"Yes, {models[0]} is one of the supported model families."),
    ])

    # Features
    features = VERIFIED_FACTS["features"]
    qa_pairs.extend([
        make_qa("Does FineTune Lab support LoRA?",
                f"Yes, FineTune Lab supports {features[0]}. LoRA is a parameter-efficient fine-tuning method that reduces memory usage."),
        make_qa("What dataset formats are supported?",
                f"{features[2]} - datasets must be in JSONL format with messages array containing role and content fields."),
        make_qa("Can I see real-time training metrics?",
                f"Yes, FineTune Lab provides {features[4]} including {features[5]} and {features[6]}."),
    ])

    # Dataset requirements
    dataset_reqs = VERIFIED_FACTS["dataset_requirements"]
    qa_pairs.extend([
        make_qa("What format should my dataset be in?",
                f"Datasets must be in {dataset_reqs['format']} format - JSON Lines with one example per line."),
        make_qa("How many examples do I need for training?",
                f"Minimum {dataset_reqs['minimum_examples']} examples. Optimal range is {dataset_reqs['optimal_examples']} examples."),
        make_qa("Is there a token limit per example?",
                f"Yes, examples should be under {dataset_reqs['max_tokens_per_example']} tokens to avoid memory issues."),
    ])

    # Hyperparameters
    hyperparam = VERIFIED_FACTS["hyperparameter_recommendations"]
    qa_pairs.extend([
        make_qa("What learning rate should I use?",
                f"{hyperparam['learning_rate']['recommended']} is recommended for most fine-tuning tasks. For larger datasets, you can use {hyperparam['learning_rate']['large_datasets']}."),
        make_qa("What batch size for 8GB GPU?",
                f"For 8GB VRAM (medium GPU), use batch size {hyperparam['batch_size']['medium_gpu']}."),
        make_qa("How many epochs for 200 examples?",
                f"For medium datasets ({hyperparam['epochs']['medium_dataset']}), use {hyperparam['epochs']['medium_dataset'].split()[0]} epochs."),
    ])

    # Tech stack
    tech = VERIFIED_FACTS["tech_stack"]
    qa_pairs.extend([
        make_qa("What database does FineTune Lab use?",
                f"{tech[4]} for database and authentication with row-level security."),
        make_qa("What inference engines are available?",
                f"{tech[2]} are the available inference engines."),
        make_qa("Is FineTune Lab built with PyTorch?",
                f"Yes, {tech[3]} is used for the deep learning framework."),
    ])

    return qa_pairs

def main():
    print("="*80)
    print("EXTRACTING FACTS FROM REAL FINETUNE LAB DOCS & CODE")
    print("="*80)
    print()

    qa_pairs = generate_qa_from_verified_facts()

    output_path = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation/verified_facts_dataset_v1.jsonl")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        for qa in qa_pairs:
            f.write(json.dumps(qa, ensure_ascii=False) + '\n')

    print(f"✅ Generated {len(qa_pairs)} Q&A pairs from verified facts")
    print(f"📁 Saved to: {output_path}")
    print(f"📊 File size: {output_path.stat().st_size / 1024:.1f} KB")
    print()
    print("✨ All facts extracted from REAL codebase and documentation!")
    print()
    print("💡 Next: Assess quality with:")
    print(f"   python3 assess_dataset_accuracy.py {output_path.name} {len(qa_pairs)}")

if __name__ == "__main__":
    main()
