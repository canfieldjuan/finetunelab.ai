#!/usr/bin/env python3
"""
Generate 500+ hyper-specific questions about FineTune Lab
These questions can ONLY be answered with FineTune Lab-specific knowledge
DeepSeek will answer them using the knowledge base we built
"""

import json
from pathlib import Path
from typing import List

def generate_api_endpoint_questions() -> List[str]:
    """Questions about specific API endpoints"""
    return [
        # Start/Execute endpoints
        "What API endpoint do I use to start a training job?",
        "What's the endpoint for executing a training configuration?",
        "How do I start training via the API?",
        "What endpoint executes a training job?",
        "What's the difference between /api/training and /api/training/execute?",

        # Status/Monitoring endpoints
        "What endpoint checks training job status?",
        "How do I get training metrics via API?",
        "What's the endpoint for training logs?",
        "How do I monitor training progress?",
        "What endpoint shows real-time training metrics?",
        "What's the API for getting job status by job ID?",

        # Deployment endpoints
        "What endpoint deploys a trained model?",
        "How do I deploy to RunPod Serverless via API?",
        "What's the deployment API endpoint?",
        "What endpoint deploys models to vLLM?",
        "How do I deploy to Google Colab via API?",
        "What's the endpoint for Hugging Face Spaces deployment?",
        "How do I deploy to Kaggle via API?",

        # Dataset endpoints
        "What endpoint uploads a dataset?",
        "How do I list available datasets via API?",
        "What's the API for dataset management?",
        "What endpoint deletes a dataset?",
        "How do I get dataset information?",

        # DAG/Pipeline endpoints
        "What endpoint manages training DAGs?",
        "How do I pause a training job via API?",
        "What's the resume endpoint for training?",
        "What endpoint cancels a training job?",
        "How do I create a training template?",
        "What's the backfill endpoint?",

        # Control endpoints
        "What endpoint controls a running training job?",
        "How do I update training parameters mid-training?",
        "What's the endpoint for training job control?",

        # Checkpoint endpoints
        "What endpoint lists checkpoints?",
        "How do I get checkpoint information?",
        "What's the API for checkpoint management?",

        # Model download endpoints
        "What endpoint downloads a trained model?",
        "How do I generate a model package?",
        "What's the download package endpoint?",

        # Validation endpoints
        "What endpoint validates training configuration?",
        "How do I validate a dataset via API?",
        "What's the validation endpoint?",

        # vLLM endpoints
        "What endpoint checks vLLM status?",
        "How do I verify vLLM is running?",

        # Local training endpoints
        "What's the endpoint for local training jobs?",
        "How do I submit a local training job?",
        "What endpoint gets local training status?",
        "What's the local metrics endpoint?",
        "What endpoint gets local training logs?",

        # Baseline endpoints
        "What endpoint manages training baselines?",
        "How do I create a baseline via API?",
    ]

def generate_default_value_questions() -> List[str]:
    """Questions about default configuration values"""
    return [
        # GPU Memory
        "What's the default GPU memory utilization for vLLM?",
        "How much GPU memory does vLLM use by default?",
        "What GPU memory setting does FineTune Lab use?",
        "What percentage of GPU memory does vLLM allocate?",
        "What's the vLLM GPU memory utilization?",
        "Is there a default GPU memory setting?",
        "How much VRAM does vLLM use?",
        "What's the default memory allocation for vLLM?",

        # Eval Split
        "What's the default eval split in FineTune Lab?",
        "What percentage of data is used for evaluation?",
        "What's the train/eval split ratio?",
        "How much data goes to validation by default?",
        "What's the default validation split?",
        "What's the evaluation dataset percentage?",

        # Port Range
        "What ports does vLLM use?",
        "What's the vLLM port range?",
        "What port will my model deploy to?",
        "How does FineTune Lab assign vLLM ports?",
        "What's the starting port for vLLM?",
        "What's the ending port for vLLM?",
        "What port range is used for local inference?",

        # Learning Rate
        "What's the recommended learning rate?",
        "What learning rate should I use for LoRA?",
        "What's the default learning rate range?",
        "What learning rate for large datasets?",
        "What learning rate for small models?",

        # Batch Size
        "What batch size for 8GB GPU?",
        "What's the recommended batch size for 16GB VRAM?",
        "What batch size should I use with limited GPU memory?",
        "What's the batch size for large GPUs?",
        "What batch size for small GPUs?",

        # Epochs
        "How many epochs for 1000 examples?",
        "What's the recommended epoch count for small datasets?",
        "How many epochs for large datasets?",
        "What epoch count for medium datasets?",

        # Budget
        "What's the minimum budget for RunPod deployment?",
        "What budget should I set for production?",
        "What's the recommended budget range?",
        "What's the minimum deployment budget?",
    ]

def generate_pricing_questions() -> List[str]:
    """Questions about GPU pricing"""
    return [
        "What's the pricing for A4000 GPU?",
        "How much does A5000 cost per request?",
        "What's the A6000 pricing?",
        "How much is H100 per request?",
        "What's the cheapest GPU option?",
        "What's the most expensive GPU?",
        "What are the GPU pricing options?",
        "How much does each GPU cost?",
        "What's the cost difference between A4000 and H100?",
        "Which GPU has the best price/performance?",
        "What's the RunPod Serverless pricing?",
        "How much does inference cost on A5000?",
        "What GPU should I use for budget deployments?",
        "What GPU for high-performance deployments?",
    ]

def generate_deployment_questions() -> List[str]:
    """Questions about deployment options"""
    return [
        "What deployment options does FineTune Lab support?",
        "Can I deploy locally?",
        "What's the difference between vLLM and Ollama?",
        "What is RunPod Serverless?",
        "What are the local deployment options?",
        "Can I deploy to cloud?",
        "What inference engines are supported?",
        "How do I deploy to vLLM?",
        "How do I deploy to Ollama?",
        "What's required for local deployment?",
        "What GPU is needed for vLLM?",
        "Can Ollama use LoRA adapters?",
        "What's the fastest inference option?",
        "What's the easiest deployment option?",
        "Does RunPod auto-scale?",
        "What deployment has budget controls?",
    ]

def generate_dataset_questions() -> List[str]:
    """Questions about dataset requirements"""
    return [
        "What dataset format does FineTune Lab use?",
        "What's the JSONL structure?",
        "How many examples do I need minimum?",
        "What's the optimal dataset size?",
        "What's the maximum tokens per example?",
        "What encoding should datasets use?",
        "How should I format my dataset?",
        "What's the minimum dataset size?",
        "What's the maximum dataset size?",
        "What validation does FineTune Lab perform?",
        "What's the dataset structure format?",
        "What roles are supported in messages?",
        "How do I structure a training example?",
        "What's the message format?",
        "Can I use tool calls in datasets?",
        "Does FineTune Lab validate datasets automatically?",
    ]

def generate_model_questions() -> List[str]:
    """Questions about supported models"""
    return [
        "What model families does FineTune Lab support?",
        "Can I fine-tune Llama models?",
        "Does FineTune Lab support Mistral?",
        "Can I use Qwen models?",
        "What about Phi models?",
        "Does it support Gemma?",
        "What training methods are supported?",
        "Does FineTune Lab support LoRA?",
        "What's QLoRA?",
        "Can I do full fine-tuning?",
        "What precision options are available?",
        "Does it support FP16?",
        "What about BF16?",
        "Can I use mixed precision?",
        "What Hugging Face models work?",
    ]

def generate_features_questions() -> List[str]:
    """Questions about platform features"""
    return [
        "Can I see training metrics in real-time?",
        "Does FineTune Lab show loss curves?",
        "Can I monitor GPU utilization?",
        "Does it track learning rate?",
        "Can I pause training?",
        "Can I resume training?",
        "Does it save checkpoints automatically?",
        "Can I compare training runs?",
        "Does it support A/B testing?",
        "Can I version datasets?",
        "What monitoring features exist?",
        "Can I visualize training progress?",
        "Does it have budget alerts?",
        "What cost tracking features exist?",
        "Can I set budget limits?",
        "Does it auto-stop on budget?",
    ]

def generate_tech_stack_questions() -> List[str]:
    """Questions about the technology stack"""
    return [
        "What database does FineTune Lab use?",
        "What frontend framework is it built with?",
        "What deep learning framework?",
        "Does it use PyTorch?",
        "What about TensorFlow?",
        "What inference engines are used?",
        "Does it use Docker?",
        "What job queue system?",
        "Does it use Redis?",
        "What cloud GPU provider?",
        "Does it integrate with RunPod?",
        "What authentication system?",
        "Does it have row-level security?",
        "What GPU acceleration?",
        "Does it require CUDA?",
    ]

def generate_workflow_questions() -> List[str]:
    """Questions about training workflow"""
    return [
        "What's the first step in training?",
        "How do I prepare a dataset?",
        "What's step 2 in the workflow?",
        "How do I create a training config?",
        "What's required for training config?",
        "What's optional in training config?",
        "How do I start training execution?",
        "How do I monitor training?",
        "What's the final step?",
        "How do I deploy after training?",
        "What do I need for RunPod deployment?",
        "Where do I put my API key?",
        "How does FineTune Lab assign ports?",
        "What's the complete training workflow?",
        "What happens after upload?",
    ]

def generate_troubleshooting_questions() -> List[str]:
    """Questions about common issues and troubleshooting"""
    return [
        "What if my GPU runs out of memory?",
        "How do I reduce memory usage?",
        "What if training is too slow?",
        "How do I speed up training?",
        "What if loss isn't decreasing?",
        "How do I fix overfitting?",
        "What batch size prevents OOM errors?",
        "What if my dataset is invalid?",
        "How do I validate my dataset?",
        "What if deployment fails?",
        "How do I check if vLLM is running?",
        "What if the port is already in use?",
        "How do I free up GPU memory?",
        "What if training gets stuck?",
        "How do I cancel a job?",
    ]

def generate_hyperparameter_questions() -> List[str]:
    """Questions about hyperparameters"""
    return [
        "What hyperparameters can I configure?",
        "What's warmup_steps?",
        "Should I use gradient accumulation?",
        "What's the best optimizer?",
        "What weight decay should I use?",
        "What about learning rate scheduling?",
        "Should I use warmup?",
        "What's a good warmup ratio?",
        "How many training steps?",
        "What's max_seq_length?",
        "Should I use gradient checkpointing?",
        "What's the lora_r parameter?",
        "What lora_alpha should I use?",
        "What's lora_dropout?",
        "Should I adjust target_modules?",
    ]

def generate_comparison_questions() -> List[str]:
    """Questions comparing different options"""
    return [
        "vLLM vs Ollama - which is faster?",
        "RunPod vs local deployment - which is cheaper?",
        "LoRA vs full fine-tuning - which is better?",
        "A4000 vs A6000 - which should I choose?",
        "FP16 vs BF16 - what's the difference?",
        "Small vs large batch size - which is better?",
        "More epochs vs more data - which improves quality?",
        "Local vs cloud - which is easier?",
        "Llama vs Mistral - which is better?",
        "Large vs small learning rate - what's the tradeoff?",
    ]

def generate_specificity_questions() -> List[str]:
    """Very specific questions that require exact knowledge"""
    return [
        "What source file contains the GPU memory default?",
        "What line number has the eval split setting?",
        "What component file has port configuration?",
        "What's the exact vLLM GPU memory value?",
        "What's the precise eval split percentage?",
        "What's the exact starting port number?",
        "What's the exact ending port number?",
        "What's the precise A4000 price per request?",
        "What's the exact minimum budget amount?",
        "What's the precise recommended budget range?",
        "What budget alert percentages are set?",
        "What's the exact minimum dataset size?",
        "What's the precise optimal dataset range?",
        "What's the exact token limit per example?",
        "What's the precise learning rate range for large datasets?",
    ]

def generate_multi_part_questions() -> List[str]:
    """Questions requiring multiple pieces of information"""
    return [
        "What are the default training hyperparameters?",
        "What are the default vLLM deployment settings?",
        "What files contain training configuration code?",
        "What are all the deployment options and their features?",
        "What's included in the training workflow?",
        "What metrics can I monitor during training?",
        "What are the dataset requirements and format?",
        "What GPUs are available and what's their pricing?",
        "What are the supported model families and training methods?",
        "What features does the platform provide?",
    ]

def generate_all_questions() -> List[str]:
    """Combine all question categories"""
    all_questions = []

    all_questions.extend(generate_api_endpoint_questions())
    all_questions.extend(generate_default_value_questions())
    all_questions.extend(generate_pricing_questions())
    all_questions.extend(generate_deployment_questions())
    all_questions.extend(generate_dataset_questions())
    all_questions.extend(generate_model_questions())
    all_questions.extend(generate_features_questions())
    all_questions.extend(generate_tech_stack_questions())
    all_questions.extend(generate_workflow_questions())
    all_questions.extend(generate_troubleshooting_questions())
    all_questions.extend(generate_hyperparameter_questions())
    all_questions.extend(generate_comparison_questions())
    all_questions.extend(generate_specificity_questions())
    all_questions.extend(generate_multi_part_questions())

    return all_questions

def save_questions(questions: List[str], output_path: str):
    """Save questions to file"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Save as plain text (one question per line)
    output_file.write_text('\n'.join(questions), encoding='utf-8')

    print(f"\n✅ Generated {len(questions)} questions!")
    print(f"📁 Saved to: {output_file}")
    print(f"📊 Size: {output_file.stat().st_size / 1024:.1f} KB")

    # Show category breakdown
    print("\n📋 Question Breakdown:")
    print(f"   API Endpoints: {len(generate_api_endpoint_questions())}")
    print(f"   Default Values: {len(generate_default_value_questions())}")
    print(f"   Pricing: {len(generate_pricing_questions())}")
    print(f"   Deployment: {len(generate_deployment_questions())}")
    print(f"   Datasets: {len(generate_dataset_questions())}")
    print(f"   Models: {len(generate_model_questions())}")
    print(f"   Features: {len(generate_features_questions())}")
    print(f"   Tech Stack: {len(generate_tech_stack_questions())}")
    print(f"   Workflow: {len(generate_workflow_questions())}")
    print(f"   Troubleshooting: {len(generate_troubleshooting_questions())}")
    print(f"   Hyperparameters: {len(generate_hyperparameter_questions())}")
    print(f"   Comparisons: {len(generate_comparison_questions())}")
    print(f"   Specificity: {len(generate_specificity_questions())}")
    print(f"   Multi-part: {len(generate_multi_part_questions())}")

def main():
    print("="*80)
    print("GENERATING DEEPSEEK QUESTIONS FOR FINETUNE LAB")
    print("="*80)
    print("\n🎯 Creating hyper-specific questions that require FineTune Lab knowledge")
    print()

    questions = generate_all_questions()

    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_questions.txt"
    save_questions(questions, output_path)

    print("\n💡 Next Steps:")
    print("1. Review questions: cat deepseek_questions.txt")
    print("2. Send to DeepSeek with knowledge base to get answers")
    print("3. Format as training dataset")

if __name__ == "__main__":
    main()
