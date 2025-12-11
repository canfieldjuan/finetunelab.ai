#!/usr/bin/env python3
"""
Generate 1000+ hyper-specific questions about FineTune Lab
Expanded version with more variations, scenarios, and use cases
"""

import json
from pathlib import Path
from typing import List

def generate_api_endpoint_questions() -> List[str]:
    """Questions about specific API endpoints - EXPANDED"""
    questions = []

    # Training execution (20 variations)
    questions.extend([
        "What API endpoint do I use to start a training job?",
        "What's the endpoint for executing a training configuration?",
        "How do I start training via the API?",
        "What endpoint executes a training job?",
        "What's the difference between /api/training and /api/training/execute?",
        "Which endpoint initiates model training?",
        "Where do I POST to begin training?",
        "What's the URL for starting a fine-tuning job?",
        "How do I trigger training via REST API?",
        "What endpoint launches a training session?",
        "Which API route starts model fine-tuning?",
        "What's the HTTP endpoint for training execution?",
        "How do I programmatically start training?",
        "What REST endpoint kicks off training?",
        "Which URL do I call to execute training?",
        "What's the API path for initiating training?",
        "How do I start a LoRA training job via API?",
        "What endpoint begins the fine-tuning process?",
        "Which API call starts model training?",
        "What's the endpoint to launch a training run?",
    ])

    # Status and monitoring (25 variations)
    questions.extend([
        "What endpoint checks training job status?",
        "How do I get training metrics via API?",
        "What's the endpoint for training logs?",
        "How do I monitor training progress?",
        "What endpoint shows real-time training metrics?",
        "What's the API for getting job status by job ID?",
        "How do I check if training is complete?",
        "What endpoint retrieves training progress?",
        "Where do I get loss metrics?",
        "What's the URL for job status?",
        "How do I fetch training logs via API?",
        "What endpoint returns training statistics?",
        "How do I monitor GPU utilization during training?",
        "What's the API for live training updates?",
        "Which endpoint shows current training step?",
        "How do I get eval loss via API?",
        "What endpoint displays training loss?",
        "How do I check learning rate during training?",
        "What's the API for checkpoint status?",
        "How do I see training metrics in real-time?",
        "What endpoint gets training job state?",
        "How do I poll for training completion?",
        "What's the URL for fetching metrics?",
        "Which API returns training logs?",
        "How do I get step-by-step training progress?",
    ])

    # Deployment (30 variations)
    questions.extend([
        "What endpoint deploys a trained model?",
        "How do I deploy to RunPod Serverless via API?",
        "What's the deployment API endpoint?",
        "What endpoint deploys models to vLLM?",
        "How do I deploy to Google Colab via API?",
        "What's the endpoint for Hugging Face Spaces deployment?",
        "How do I deploy to Kaggle via API?",
        "Which API endpoint handles model deployment?",
        "What's the URL for deploying to cloud?",
        "How do I deploy locally via API?",
        "What endpoint deploys to Ollama?",
        "How do I deploy my fine-tuned model?",
        "What's the API for serverless deployment?",
        "Which endpoint deploys to RunPod?",
        "How do I deploy with vLLM engine?",
        "What's the deployment endpoint for local inference?",
        "How do I deploy to production via API?",
        "What endpoint creates a deployment?",
        "How do I deploy my LoRA adapter?",
        "What's the API for model serving?",
        "Which URL deploys trained models?",
        "How do I deploy to inference endpoint?",
        "What's the API call for deployment?",
        "How do I deploy with GPU allocation?",
        "What endpoint deploys with budget controls?",
        "How do I deploy to auto-scaling endpoint?",
        "What's the API for vLLM deployment?",
        "How do I deploy with specific GPU?",
        "What endpoint handles Ollama deployment?",
        "How do I deploy to HuggingFace?",
    ])

    # Dataset management (25 variations)
    questions.extend([
        "What endpoint uploads a dataset?",
        "How do I list available datasets via API?",
        "What's the API for dataset management?",
        "What endpoint deletes a dataset?",
        "How do I get dataset information?",
        "Which API uploads training data?",
        "What's the URL for dataset upload?",
        "How do I create a dataset via API?",
        "What endpoint lists my datasets?",
        "How do I remove a dataset?",
        "What's the API for dataset details?",
        "Which endpoint shows dataset info?",
        "How do I upload JSONL via API?",
        "What's the dataset creation endpoint?",
        "How do I get dataset statistics?",
        "What endpoint validates datasets?",
        "How do I attach dataset to training?",
        "What's the API for dataset versioning?",
        "Which URL manages datasets?",
        "How do I update dataset metadata?",
        "What endpoint gets dataset list?",
        "How do I check dataset format via API?",
        "What's the API for dataset deletion?",
        "How do I retrieve dataset content?",
        "What endpoint shows available data?",
    ])

    # DAG/Pipeline control (20 variations)
    questions.extend([
        "What endpoint manages training DAGs?",
        "How do I pause a training job via API?",
        "What's the resume endpoint for training?",
        "What endpoint cancels a training job?",
        "How do I create a training template?",
        "What's the backfill endpoint?",
        "How do I stop training via API?",
        "What endpoint pauses a job?",
        "How do I resume paused training?",
        "What's the API for job cancellation?",
        "How do I create training pipeline?",
        "What endpoint manages workflows?",
        "How do I halt training mid-run?",
        "What's the URL for pause/resume?",
        "How do I abort a training job?",
        "What endpoint controls job execution?",
        "How do I restart failed training?",
        "What's the API for pipeline templates?",
        "How do I schedule training runs?",
        "What endpoint manages DAG execution?",
    ])

    # Checkpoints (15 variations)
    questions.extend([
        "What endpoint lists checkpoints?",
        "How do I get checkpoint information?",
        "What's the API for checkpoint management?",
        "How do I download checkpoints via API?",
        "What endpoint retrieves saved checkpoints?",
        "How do I list model checkpoints?",
        "What's the URL for checkpoint access?",
        "How do I get latest checkpoint?",
        "What endpoint shows checkpoint details?",
        "How do I restore from checkpoint?",
        "What's the API for checkpoint list?",
        "How do I fetch checkpoint metadata?",
        "What endpoint manages model saves?",
        "How do I access training checkpoints?",
        "What's the checkpoint retrieval endpoint?",
    ])

    # Model package/download (15 variations)
    questions.extend([
        "What endpoint downloads a trained model?",
        "How do I generate a model package?",
        "What's the download package endpoint?",
        "How do I export my model via API?",
        "What endpoint creates model package?",
        "How do I download fine-tuned weights?",
        "What's the API for model export?",
        "How do I get my trained model files?",
        "What endpoint packages the model?",
        "How do I download LoRA adapters?",
        "What's the URL for model download?",
        "How do I export to HuggingFace format?",
        "What endpoint bundles model files?",
        "How do I retrieve model artifacts?",
        "What's the API for model packaging?",
    ])

    # Validation (10 variations)
    questions.extend([
        "What endpoint validates training configuration?",
        "How do I validate a dataset via API?",
        "What's the validation endpoint?",
        "How do I check config validity?",
        "What endpoint validates JSONL format?",
        "How do I verify training params?",
        "What's the API for config validation?",
        "How do I validate hyperparameters?",
        "What endpoint checks data format?",
        "How do I test dataset validity?",
    ])

    # vLLM specific (10 variations)
    questions.extend([
        "What endpoint checks vLLM status?",
        "How do I verify vLLM is running?",
        "What's the API for vLLM health check?",
        "How do I test vLLM connection?",
        "What endpoint monitors vLLM server?",
        "How do I check vLLM availability?",
        "What's the vLLM status endpoint?",
        "How do I ping vLLM server?",
        "What endpoint verifies vLLM deployment?",
        "How do I get vLLM server info?",
    ])

    # Local training (10 variations)
    questions.extend([
        "What's the endpoint for local training jobs?",
        "How do I submit a local training job?",
        "What endpoint gets local training status?",
        "What's the local metrics endpoint?",
        "What endpoint gets local training logs?",
        "How do I run training locally via API?",
        "What's the API for local job submission?",
        "How do I monitor local training?",
        "What endpoint lists local jobs?",
        "How do I control local training runs?",
    ])

    # Baselines (5 variations)
    questions.extend([
        "What endpoint manages training baselines?",
        "How do I create a baseline via API?",
        "What's the API for baseline comparison?",
        "How do I set training baseline?",
        "What endpoint stores baseline metrics?",
    ])

    return questions

def generate_default_value_questions() -> List[str]:
    """Questions about default configuration values - EXPANDED"""
    questions = []

    # GPU Memory (20 variations)
    questions.extend([
        "What's the default GPU memory utilization for vLLM?",
        "How much GPU memory does vLLM use by default?",
        "What GPU memory setting does FineTune Lab use?",
        "What percentage of GPU memory does vLLM allocate?",
        "What's the vLLM GPU memory utilization?",
        "Is there a default GPU memory setting?",
        "How much VRAM does vLLM use?",
        "What's the default memory allocation for vLLM?",
        "What GPU memory value is default?",
        "How much memory does vLLM reserve?",
        "What's the VRAM utilization setting?",
        "What percentage VRAM for vLLM?",
        "How much GPU memory is allocated by default?",
        "What's the standard GPU memory config?",
        "What memory fraction does vLLM use?",
        "What's the GPU utilization default?",
        "How much VRAM is reserved for OS?",
        "What's the memory split for vLLM?",
        "What GPU memory percentage is typical?",
        "What's the recommended GPU memory setting?",
    ])

    # Eval split (15 variations)
    questions.extend([
        "What's the default eval split in FineTune Lab?",
        "What percentage of data is used for evaluation?",
        "What's the train/eval split ratio?",
        "How much data goes to validation by default?",
        "What's the default validation split?",
        "What's the evaluation dataset percentage?",
        "What split ratio for training vs eval?",
        "How much data for evaluation?",
        "What's the default test split?",
        "What percentage goes to validation set?",
        "What's the train/test ratio?",
        "How is data split between train and eval?",
        "What fraction for evaluation?",
        "What's the validation percentage?",
        "How much data is held out for eval?",
    ])

    # Port range (20 variations)
    questions.extend([
        "What ports does vLLM use?",
        "What's the vLLM port range?",
        "What port will my model deploy to?",
        "How does FineTune Lab assign vLLM ports?",
        "What's the starting port for vLLM?",
        "What's the ending port for vLLM?",
        "What port range is used for local inference?",
        "What ports are available for deployment?",
        "Which port will vLLM server use?",
        "What's the default vLLM port?",
        "What port numbers for vLLM?",
        "How are ports assigned to models?",
        "What's the port allocation range?",
        "Which ports can models use?",
        "What's the first available port?",
        "What's the last port in range?",
        "How many ports are available?",
        "What port should I expect?",
        "What's the port configuration?",
        "Which port gets auto-assigned?",
    ])

    # Learning rate (15 variations)
    questions.extend([
        "What's the recommended learning rate?",
        "What learning rate should I use for LoRA?",
        "What's the default learning rate range?",
        "What learning rate for large datasets?",
        "What learning rate for small models?",
        "What LR is recommended?",
        "What's a good learning rate?",
        "What learning rate for fine-tuning?",
        "What's the optimal LR?",
        "What learning rate to start with?",
        "What's the suggested learning rate?",
        "What LR for Llama models?",
        "What learning rate range works best?",
        "What's the standard learning rate?",
        "What LR for parameter-efficient training?",
    ])

    # Batch size (15 variations)
    questions.extend([
        "What batch size for 8GB GPU?",
        "What's the recommended batch size for 16GB VRAM?",
        "What batch size should I use with limited GPU memory?",
        "What's the batch size for large GPUs?",
        "What batch size for small GPUs?",
        "What batch size with 24GB VRAM?",
        "What's optimal batch size for my GPU?",
        "What batch size prevents OOM?",
        "What's the suggested batch size?",
        "What batch size for A100 GPU?",
        "What's the default batch size?",
        "What batch size for 4GB GPU?",
        "What's the maximum batch size?",
        "What batch size for efficient training?",
        "What's the batch size recommendation?",
    ])

    # Epochs (10 variations)
    questions.extend([
        "How many epochs for 1000 examples?",
        "What's the recommended epoch count for small datasets?",
        "How many epochs for large datasets?",
        "What epoch count for medium datasets?",
        "How many training epochs?",
        "What's the optimal number of epochs?",
        "How many epochs to prevent overfitting?",
        "What's the suggested epoch count?",
        "How many epochs for 100 examples?",
        "What's the default epoch setting?",
    ])

    # Budget (10 variations)
    questions.extend([
        "What's the minimum budget for RunPod deployment?",
        "What budget should I set for production?",
        "What's the recommended budget range?",
        "What's the minimum deployment budget?",
        "How much budget do I need?",
        "What's a good production budget?",
        "What's the budget requirement?",
        "What budget for testing?",
        "What's the suggested budget amount?",
        "What budget allocation is recommended?",
    ])

    return questions

def generate_pricing_questions() -> List[str]:
    """Questions about GPU pricing - EXPANDED"""
    questions = []

    questions.extend([
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
        "What's the cost per request for A4000?",
        "How much to run 1000 requests on A6000?",
        "What's the hourly cost for H100?",
        "Which GPU is most cost-effective?",
        "What's the price per inference?",
        "How much does RunPod charge?",
        "What are the serverless GPU prices?",
        "What's the cheapest option for inference?",
        "What GPU pricing for production?",
        "What's the A100 pricing if available?",
        "How much does GPU time cost?",
    ])

    return questions

def generate_deployment_questions() -> List[str]:
    """Questions about deployment options - EXPANDED"""
    questions = []

    questions.extend([
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
        "Can I deploy on my own hardware?",
        "What cloud providers are supported?",
        "Can I deploy to AWS?",
        "What about Azure deployment?",
        "Does it support GCP?",
        "What's the best deployment for production?",
        "What deployment for development?",
        "Can I use multiple deployment options?",
        "What's the serverless option?",
        "What local inference engines exist?",
        "Can I deploy without GPU?",
        "What deployment supports quantization?",
        "What's the deployment latency?",
        "Which deployment auto-scales?",
        "What deployment has lowest cost?",
        "What deployment has best performance?",
        "Can I deploy to HuggingFace?",
        "What about Replicate deployment?",
        "Does it support edge deployment?",
    ])

    return questions

def generate_dataset_questions() -> List[str]:
    """Questions about dataset requirements - EXPANDED"""
    questions = []

    questions.extend([
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
        "What's the required file format?",
        "How many examples for good results?",
        "What's the ideal dataset size?",
        "What token limit per example?",
        "Can I use CSV format?",
        "What about JSON format?",
        "Must I use JSONL?",
        "What's the data structure?",
        "How to format conversations?",
        "What fields are required?",
        "Can I include system messages?",
        "What character encoding?",
        "UTF-8 required?",
        "What's the max file size?",
        "Can datasets be compressed?",
        "What validation rules exist?",
        "Are there format requirements?",
        "What makes a valid dataset?",
        "How to avoid dataset errors?",
    ])

    return questions

def generate_model_questions() -> List[str]:
    """Questions about supported models - EXPANDED"""
    questions = []

    questions.extend([
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
        "Can I use GPT models?",
        "What about T5 models?",
        "Does it support BERT?",
        "Can I fine-tune any model?",
        "What model sizes are supported?",
        "Can I use 70B models?",
        "What about 7B models?",
        "Does it work with 3B models?",
        "What's the largest model supported?",
        "What's the smallest model?",
        "Can I use custom models?",
        "What about proprietary models?",
        "Does it support multimodal models?",
        "Can I train vision models?",
        "What about audio models?",
        "Does it support encoder-decoder?",
        "What architecture types work?",
        "Can I use transformer models?",
        "What model formats are compatible?",
        "Does it support safetensors?",
    ])

    return questions

def generate_features_questions() -> List[str]:
    """Questions about platform features - EXPANDED"""
    questions = []

    questions.extend([
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
        "Can I export metrics?",
        "Does it log training history?",
        "Can I download logs?",
        "What analytics are available?",
        "Does it show GPU memory usage?",
        "Can I see throughput metrics?",
        "Does it calculate tokens per second?",
        "Can I track eval loss?",
        "What performance metrics exist?",
        "Does it show training time estimates?",
        "Can I set alerts?",
        "Does it send notifications?",
        "Can I integrate with monitoring tools?",
        "What reporting features exist?",
        "Can I compare hyperparameters?",
        "Does it suggest optimal settings?",
        "Can I rollback to previous checkpoint?",
        "Does it support early stopping?",
        "Can I adjust learning rate during training?",
    ])

    return questions

def generate_tech_stack_questions() -> List[str]:
    """Questions about technology stack - EXPANDED"""
    questions = []

    questions.extend([
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
        "What backend language?",
        "Is it built with Python?",
        "What about Node.js?",
        "Does it use TypeScript?",
        "What API framework?",
        "Is it RESTful?",
        "Does it use GraphQL?",
        "What storage solution?",
        "Does it use S3?",
        "What caching layer?",
        "Does it use Next.js?",
        "What UI library?",
        "Does it use React?",
        "What CSS framework?",
        "Does it use Tailwind?",
        "What state management?",
        "Does it use Supabase?",
        "What hosting platform?",
        "Does it support self-hosting?",
        "What containerization?",
    ])

    return questions

def generate_workflow_questions() -> List[str]:
    """Questions about training workflow - EXPANDED"""
    questions = []

    questions.extend([
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
        "How long does training take?",
        "What's the deployment process?",
        "How do I test my model?",
        "What's the best workflow?",
        "Can I skip steps?",
        "What's the minimal workflow?",
        "How do I optimize workflow?",
        "What's the recommended process?",
        "Can I automate the workflow?",
        "What's the step-by-step guide?",
        "How do I go from data to deployment?",
        "What's the typical timeline?",
        "Can I parallelize steps?",
        "What dependencies exist?",
        "What's the fastest workflow?",
    ])

    return questions

def generate_troubleshooting_questions() -> List[str]:
    """Questions about troubleshooting - EXPANDED"""
    questions = []

    questions.extend([
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
        "What if loss is exploding?",
        "How do I fix NaN loss?",
        "What if training crashes?",
        "How do I recover from failure?",
        "What if checkpoint is corrupted?",
        "How do I debug training issues?",
        "What if model won't load?",
        "How do I fix CUDA errors?",
        "What if I'm out of disk space?",
        "How do I handle timeout errors?",
        "What if API returns 500 error?",
        "How do I fix connection issues?",
        "What if deployment won't start?",
        "How do I resolve port conflicts?",
        "What if budget is exceeded?",
    ])

    return questions

def generate_hyperparameter_questions() -> List[str]:
    """Questions about hyperparameters - EXPANDED"""
    questions = []

    questions.extend([
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
        "What's the best scheduler?",
        "What warmup_ratio works best?",
        "Should I use cosine schedule?",
        "What's gradient_accumulation_steps?",
        "What max_grad_norm?",
        "Should I clip gradients?",
        "What's save_steps?",
        "What eval_steps frequency?",
        "What logging_steps?",
        "Should I use fp16 or bf16?",
        "What's the difference between optimizers?",
        "Should I use AdamW?",
        "What about SGD?",
        "What lr_scheduler_type?",
        "What num_train_epochs?",
        "What max_steps setting?",
        "Should I set warmup_steps or warmup_ratio?",
        "What per_device_train_batch_size?",
        "What gradient settings work best?",
        "What's optim parameter?",
    ])

    return questions

def generate_comparison_questions() -> List[str]:
    """Questions comparing options - EXPANDED"""
    questions = []

    questions.extend([
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
        "AdamW vs Adam - which optimizer?",
        "Cosine vs linear schedule - which is better?",
        "Warmup vs no warmup - does it matter?",
        "Gradient accumulation vs larger batch - which?",
        "FP16 vs mixed precision - which to use?",
        "LoRA vs QLoRA - what's the difference?",
        "Llama 7B vs 13B - which for fine-tuning?",
        "vLLM vs FastAPI - which deployment?",
        "Single vs multi-GPU - when to use?",
        "CPU vs GPU - can I train on CPU?",
        "Dataset size vs quality - which matters more?",
        "Long vs short training - what's optimal?",
        "Checkpoint frequency - more or less?",
        "Eval frequency - how often?",
        "Small model vs large dataset - which approach?",
    ])

    return questions

def generate_specificity_questions() -> List[str]:
    """Very specific implementation questions - EXPANDED"""
    questions = []

    questions.extend([
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
        "Where in the code is GPU memory set?",
        "Which file defines port range?",
        "What's the source of eval split default?",
        "Where are deployment options defined?",
        "Which component handles vLLM deployment?",
        "Where is pricing information stored?",
        "What file validates datasets?",
        "Where are hyperparameters documented?",
        "Which file manages training execution?",
        "Where is the training server code?",
    ])

    return questions

def generate_multi_part_questions() -> List[str]:
    """Questions requiring multiple pieces of information - EXPANDED"""
    questions = []

    questions.extend([
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
        "What are all the API endpoints?",
        "What monitoring and analytics exist?",
        "What are the budget and cost features?",
        "What deployment options with pricing?",
        "What's the complete tech stack?",
        "What validation checks are performed?",
        "What are all default configuration values?",
        "What checkpoint and saving features exist?",
        "What are the precision options?",
        "What workflow automation features exist?",
    ])

    return questions

def generate_use_case_questions() -> List[str]:
    """Scenario-based use case questions - NEW CATEGORY"""
    questions = []

    questions.extend([
        "How do I fine-tune for customer support?",
        "What settings for chatbot training?",
        "How do I train a code generation model?",
        "What config for translation tasks?",
        "How to fine-tune for summarization?",
        "What settings for sentiment analysis?",
        "How do I train for question answering?",
        "What config for instruction following?",
        "How to fine-tune for creative writing?",
        "What settings for domain-specific tasks?",
        "How do I train a medical AI?",
        "What config for legal document analysis?",
        "How to fine-tune for technical support?",
        "What settings for content moderation?",
        "How do I train for data extraction?",
        "What config for classification tasks?",
        "How to fine-tune for dialogue?",
        "What settings for multi-turn conversations?",
        "How do I train for API documentation?",
        "What config for code explanation?",
        "How to fine-tune for tutoring?",
        "What settings for knowledge retrieval?",
        "How do I train for email responses?",
        "What config for product recommendations?",
        "How to fine-tune for search queries?",
        "What settings for low-resource languages?",
        "How do I train for specific domain?",
        "What config for multi-language models?",
        "How to fine-tune for long-form content?",
        "What settings for structured output?",
    ])

    return questions

def generate_beginner_questions() -> List[str]:
    """Beginner-level questions - NEW CATEGORY"""
    questions = []

    questions.extend([
        "What is fine-tuning?",
        "What is LoRA?",
        "What is a training dataset?",
        "What is an epoch?",
        "What is batch size?",
        "What is learning rate?",
        "What is validation?",
        "What is a checkpoint?",
        "What is inference?",
        "What is deployment?",
        "What is GPU memory?",
        "What is VRAM?",
        "What is JSONL?",
        "What is ChatML format?",
        "What is a model adapter?",
        "What is quantization?",
        "What is mixed precision?",
        "What is gradient accumulation?",
        "What is warmup?",
        "What is overfitting?",
        "What is eval loss?",
        "What is train loss?",
        "What is a hyperparameter?",
        "What is serverless deployment?",
        "What is vLLM?",
        "What is Ollama?",
        "What is RunPod?",
        "What is Hugging Face?",
        "What is a base model?",
        "What is model fine-tuning?",
    ])

    return questions

def generate_advanced_questions() -> List[str]:
    """Advanced technical questions - NEW CATEGORY"""
    questions = []

    questions.extend([
        "How does gradient checkpointing reduce memory?",
        "What's the optimal LoRA rank?",
        "How to prevent catastrophic forgetting?",
        "What's the impact of warmup on convergence?",
        "How does QLoRA achieve 4-bit quantization?",
        "What's the tradeoff between LoRA r and alpha?",
        "How to diagnose training instability?",
        "What causes loss spikes?",
        "How to optimize for throughput vs latency?",
        "What's the relationship between batch size and generalization?",
        "How does mixed precision training work?",
        "What's the impact of sequence length on memory?",
        "How to calculate effective batch size?",
        "What's the optimal gradient accumulation strategy?",
        "How does flash attention reduce memory?",
        "What's the impact of weight decay?",
        "How to implement custom learning rate schedules?",
        "What's the effect of target modules on LoRA?",
        "How to merge LoRA adapters?",
        "What's the optimal checkpoint strategy?",
        "How to debug NaN gradients?",
        "What's the impact of dropout in LoRA?",
        "How to optimize multi-GPU training?",
        "What's the role of bias in LoRA?",
        "How to implement custom metrics?",
        "What's the optimal evaluation frequency?",
        "How to handle imbalanced datasets?",
        "What's the impact of data ordering?",
        "How to implement early stopping?",
        "What's the optimal model parallelism strategy?",
    ])

    return questions

def generate_performance_questions() -> List[str]:
    """Performance optimization questions - NEW"""
    return [
        "How do I make training faster?",
        "What's the fastest GPU option?",
        "How to reduce training time?",
        "What settings for maximum throughput?",
        "How to optimize inference speed?",
        "What's the impact of batch size on speed?",
        "How to reduce latency?",
        "What's the fastest deployment option?",
        "How to maximize GPU utilization?",
        "What settings for best performance?",
        "How to speed up data loading?",
        "What's the optimal number of workers?",
        "How to reduce memory footprint?",
        "What's the impact of precision on speed?",
        "How to optimize for production?",
        "What's the fastest inference engine?",
        "How to benchmark performance?",
        "What metrics indicate good performance?",
        "How to profile training?",
        "What's the bottleneck in training?",
        "How to increase tokens per second?",
        "What's the optimal model size for speed?",
        "How to reduce overhead?",
        "What settings for low latency?",
        "How to optimize batch processing?",
        "What's the impact of sequence length on speed?",
        "How to parallelize training?",
        "What's the fastest data format?",
        "How to cache for performance?",
        "What's the optimal checkpoint frequency for speed?",
    ]

def generate_cost_questions() -> List[str]:
    """Cost optimization questions - NEW"""
    return [
        "How to minimize training cost?",
        "What's the cheapest deployment?",
        "How to reduce GPU costs?",
        "What settings for budget training?",
        "How to estimate training cost?",
        "What's the cost per epoch?",
        "How to optimize for cost?",
        "What's the most cost-effective GPU?",
        "How to reduce inference costs?",
        "What budget for 1000 examples?",
        "How to calculate total cost?",
        "What's the cost breakdown?",
        "How to minimize serverless costs?",
        "What's the cheapest way to train?",
        "How to budget for production?",
        "What's the cost of fine-tuning?",
        "How to reduce deployment expenses?",
        "What's the ROI of different GPUs?",
        "How to track spending?",
        "What's the monthly cost estimate?",
        "How to optimize budget allocation?",
        "What's the cost per 1M tokens?",
        "How to reduce training time costs?",
        "What's the spot instance pricing?",
        "How to minimize cloud costs?",
        "What's the price per training run?",
        "How to estimate deployment costs?",
        "What's the cost difference between options?",
        "How to save on GPU hours?",
        "What's the total ownership cost?",
    ]

def generate_security_questions() -> List[str]:
    """Security and privacy questions - NEW"""
    return [
        "How is data encrypted?",
        "What security features exist?",
        "Is my training data private?",
        "How are API keys stored?",
        "What's the authentication method?",
        "Is there row-level security?",
        "How to secure my deployment?",
        "What privacy guarantees exist?",
        "How is data transmitted?",
        "What's the data retention policy?",
        "How to delete my data?",
        "Is training data logged?",
        "What compliance certifications?",
        "How to ensure data privacy?",
        "What's the security model?",
        "How are secrets managed?",
        "Is end-to-end encryption supported?",
        "What access controls exist?",
        "How to audit data access?",
        "What's the security best practice?",
        "How to protect model weights?",
        "Is multi-tenancy secure?",
        "What's the data isolation mechanism?",
        "How to secure API endpoints?",
        "What authentication methods are supported?",
        "How to implement SSO?",
        "What's the password policy?",
        "How to enable 2FA?",
        "What security logs are available?",
        "How to report security issues?",
    ]

def generate_integration_questions() -> List[str]:
    """Integration and API questions - NEW"""
    return [
        "How to integrate with existing workflow?",
        "What SDKs are available?",
        "Is there a Python client?",
        "How to use the REST API?",
        "What's the API documentation?",
        "How to authenticate API requests?",
        "What's the rate limit?",
        "How to handle API errors?",
        "What response format does API use?",
        "How to integrate with CI/CD?",
        "What webhooks are supported?",
        "How to get notifications?",
        "What's the API versioning strategy?",
        "How to migrate between API versions?",
        "What integration patterns are supported?",
        "How to batch API requests?",
        "What's the pagination method?",
        "How to stream responses?",
        "What's the timeout policy?",
        "How to retry failed requests?",
        "What's the error handling strategy?",
        "How to integrate with monitoring?",
        "What logging integration exists?",
        "How to connect to data pipeline?",
        "What's the export format?",
        "How to automate workflows?",
        "What scheduling options exist?",
        "How to trigger jobs programmatically?",
        "What event system is available?",
        "How to build custom integrations?",
    ]

def generate_data_preparation_questions() -> List[str]:
    """Data preparation questions - NEW"""
    return [
        "How to prepare training data?",
        "What's the ideal data format?",
        "How to clean my dataset?",
        "What preprocessing is needed?",
        "How to balance dataset?",
        "What's the optimal data distribution?",
        "How to handle missing data?",
        "What data augmentation works?",
        "How to format conversations?",
        "What's the best prompt format?",
        "How to structure instructions?",
        "What makes quality training data?",
        "How many examples per category?",
        "What's the minimum variety needed?",
        "How to avoid data leakage?",
        "What validation split to use?",
        "How to sample data?",
        "What's the optimal example length?",
        "How to handle long conversations?",
        "What truncation strategy works?",
        "How to tokenize data?",
        "What's the token distribution?",
        "How to measure data quality?",
        "What data cleaning steps?",
        "How to remove duplicates?",
        "What normalization is needed?",
        "How to handle special characters?",
        "What encoding issues to watch?",
        "How to validate data quality?",
        "What data preparation tools exist?",
    ]

def generate_model_selection_questions() -> List[str]:
    """Model selection questions - NEW"""
    return [
        "What model should I choose?",
        "Which model for my use case?",
        "What's the best base model?",
        "How to select model size?",
        "What model for limited resources?",
        "Which model trains fastest?",
        "What's the most accurate model?",
        "How to choose between models?",
        "What model for conversation?",
        "Which model for code tasks?",
        "What model for multilingual?",
        "Which is best for instruction following?",
        "What model handles context best?",
        "Which model for long documents?",
        "What's the most efficient model?",
        "How to evaluate model choice?",
        "What model architecture is best?",
        "Which model for low latency?",
        "What's the smallest effective model?",
        "How to determine model requirements?",
        "What model for specific domain?",
        "Which model version to use?",
        "What's the latest model available?",
        "How to compare model performance?",
        "What model for production?",
        "Which model for experimentation?",
        "What's the recommended starter model?",
        "How to benchmark models?",
        "What model limitations exist?",
        "Which model has best documentation?",
    ]

def generate_evaluation_questions() -> List[str]:
    """Model evaluation questions - NEW"""
    return [
        "How to evaluate model quality?",
        "What metrics should I track?",
        "How to measure performance?",
        "What's a good eval loss?",
        "How to test my model?",
        "What evaluation methods exist?",
        "How to create test set?",
        "What's the validation strategy?",
        "How to avoid overfitting in eval?",
        "What benchmarks to use?",
        "How to compare to baseline?",
        "What's the evaluation workflow?",
        "How to interpret metrics?",
        "What's acceptable performance?",
        "How to A/B test models?",
        "What qualitative evaluation methods?",
        "How to get human feedback?",
        "What automated evaluation exists?",
        "How to measure generalization?",
        "What's the test protocol?",
        "How to evaluate edge cases?",
        "What failure modes to check?",
        "How to measure bias?",
        "What safety evaluation needed?",
        "How to test robustness?",
        "What's the evaluation frequency?",
        "How to track improvement?",
        "What regression testing needed?",
        "How to validate production readiness?",
        "What acceptance criteria?",
    ]

def generate_scaling_questions() -> List[str]:
    """Scaling questions - NEW"""
    return [
        "How to scale training?",
        "What's multi-GPU training?",
        "How to use multiple GPUs?",
        "What's distributed training?",
        "How to scale deployment?",
        "What's the auto-scaling strategy?",
        "How to handle high traffic?",
        "What's the scaling limit?",
        "How to scale horizontally?",
        "What vertical scaling options?",
        "How to load balance?",
        "What's the concurrent request limit?",
        "How to scale cost-effectively?",
        "What's the scaling overhead?",
        "How to monitor scaling?",
        "What triggers auto-scaling?",
        "How to scale down?",
        "What's the minimum scale?",
        "How to handle bursts?",
        "What's the scaling latency?",
        "How to pre-warm instances?",
        "What's the cold start time?",
        "How to optimize scaling?",
        "What's the scale-up time?",
        "How to scale globally?",
        "What regional scaling exists?",
        "How to scale database?",
        "What caching improves scale?",
        "How to test at scale?",
        "What's the production scale?",
    ]

def generate_versioning_questions() -> List[str]:
    """Version control and experiment tracking - NEW"""
    return [
        "How to version models?",
        "What version control exists?",
        "How to track experiments?",
        "What experiment management features?",
        "How to compare model versions?",
        "What versioning best practices?",
        "How to rollback model versions?",
        "What metadata is tracked?",
        "How to tag releases?",
        "What's the versioning scheme?",
        "How to manage model registry?",
        "What artifact tracking exists?",
        "How to version datasets?",
        "What lineage tracking?",
        "How to reproduce experiments?",
        "What provenance information?",
        "How to track configurations?",
        "What audit trail exists?",
        "How to version hyperparameters?",
        "What change tracking?",
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
    all_questions.extend(generate_use_case_questions())
    all_questions.extend(generate_beginner_questions())
    all_questions.extend(generate_advanced_questions())
    all_questions.extend(generate_performance_questions())
    all_questions.extend(generate_cost_questions())
    all_questions.extend(generate_security_questions())
    all_questions.extend(generate_integration_questions())
    all_questions.extend(generate_data_preparation_questions())
    all_questions.extend(generate_model_selection_questions())
    all_questions.extend(generate_evaluation_questions())
    all_questions.extend(generate_scaling_questions())
    all_questions.extend(generate_versioning_questions())

    return all_questions

def save_questions(questions: List[str], output_path: str):
    """Save questions to file"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

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
    print(f"   Use Cases: {len(generate_use_case_questions())}")
    print(f"   Beginner: {len(generate_beginner_questions())}")
    print(f"   Advanced: {len(generate_advanced_questions())}")
    print(f"   Performance: {len(generate_performance_questions())}")
    print(f"   Cost: {len(generate_cost_questions())}")
    print(f"   Security: {len(generate_security_questions())}")
    print(f"   Integration: {len(generate_integration_questions())}")
    print(f"   Data Prep: {len(generate_data_preparation_questions())}")
    print(f"   Model Selection: {len(generate_model_selection_questions())}")
    print(f"   Evaluation: {len(generate_evaluation_questions())}")
    print(f"   Scaling: {len(generate_scaling_questions())}")
    print(f"   Versioning: {len(generate_versioning_questions())}")

def main():
    print("="*80)
    print("GENERATING 1000+ DEEPSEEK QUESTIONS FOR FINETUNE LAB")
    print("="*80)
    print("\n🎯 Creating extensive hyper-specific questions")
    print()

    questions = generate_all_questions()

    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/deepseek_questions_1000.txt"
    save_questions(questions, output_path)

    print("\n💡 Next Steps:")
    print("1. Review questions: cat deepseek_questions_1000.txt")
    print("2. Run: python3 prepare_deepseek_prompts.py (update to use new file)")
    print("3. Send to DeepSeek with knowledge base")

if __name__ == "__main__":
    main()
