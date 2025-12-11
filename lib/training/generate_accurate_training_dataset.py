#!/usr/bin/env python3
"""
Generate accurate FineTune Lab training dataset
Focuses on training-specific knowledge with exact implementation details
"""

import json
import random
from pathlib import Path
from typing import List, Dict, Any

# GROUND TRUTH from your actual FineTune Lab implementation
GROUND_TRUTH = {
    "file_paths": {
        "training_output": "lib/training/logs/job_<job_id>",
        "training_server": "lib/training/training_server.py",
        "dataset_validator": "lib/training/dataset_validator.py",
    },
    "api_endpoints": {
        "start_training": "/api/training/local/start",
        "deploy_model": "/api/training/deploy",
        "get_jobs": "/api/training/local/jobs",
        "get_status": "/api/training/local/jobs/:jobId",
        "get_metrics": "/api/training/local/jobs/:jobId/metrics",
        "get_logs": "/api/training/local/jobs/:jobId/logs",
    },
    "default_values": {
        "learning_rate": "2e-5",
        "gpu_memory": "0.8",
        "warmup_ratio": "0.03",
        "eval_split": "0.2",
    },
    "port_range": {
        "vllm_start": 8002,
        "vllm_end": 8020,
    },
    "ui_paths": {
        "lora_rank": "Training > Training Configuration > LoRA/QLoRA Tab > LoRA Rank slider",
        "learning_rate": "Training > Training Configuration > Learning Rate",
        "deploy_button": "Training page > Find completed job > Deploy button",
        "graphrag": "Tools > GraphRAG > Setup",
    },
    "supported_features": [
        "qlora",
        "lora",
        "flash attention",
        "vllm",
        "ollama",
        "tool calling",
        "dataset validation",
    ],
    "database": "supabase",
    "model_families": ["qwen", "llama", "mistral", "phi", "gemma"],
}

SYSTEM_PROMPT = "You are a helpful assistant for FineTune Lab. Provide accurate, specific information about the platform's implementation details."

# Multi-turn conversation templates
def generate_config_defaults_conversations() -> List[Dict]:
    """Generate conversations about configuration defaults"""
    conversations = []

    # Learning rate conversation - Variation 1
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What learning rate should I use for LoRA training?"},
            {"role": "assistant", "content": f"The recommended default learning rate for LoRA training in FineTune Lab is {GROUND_TRUTH['default_values']['learning_rate']} (0.00002). This is a good starting point for most fine-tuning tasks."},
            {"role": "user", "content": "Where do I set this in the UI?"},
            {"role": "assistant", "content": f"You can set the learning rate in {GROUND_TRUTH['ui_paths']['learning_rate']}. It's in the Training Configuration section of the training page."},
            {"role": "user", "content": "What if my loss is spiking?"},
            {"role": "assistant", "content": "If your training loss is spiking or unstable, try reducing the learning rate to 1e-5 or even lower. You can also enable gradient clipping to prevent extreme updates."},
        ]
    })

    # Learning rate - Variation 2 (short and direct)
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What's the default learning rate?"},
            {"role": "assistant", "content": f"Default learning rate in FineTune Lab is {GROUND_TRUTH['default_values']['learning_rate']}."},
            {"role": "user", "content": "Is that 0.00002?"},
            {"role": "assistant", "content": f"Yes, {GROUND_TRUTH['default_values']['learning_rate']} is 0.00002. It's set in {GROUND_TRUTH['ui_paths']['learning_rate']}."},
        ]
    })

    # Learning rate - Variation 3 (troubleshooting focused)
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "My training diverged. What learning rate should I try?"},
            {"role": "assistant", "content": f"Divergence often means learning rate is too high. Start with FineTune Lab's default {GROUND_TRUTH['default_values']['learning_rate']}. If still diverging, try 1e-5 or 5e-6."},
            {"role": "user", "content": "Where's that setting?"},
            {"role": "assistant", "content": f"Go to {GROUND_TRUTH['ui_paths']['learning_rate']} to adjust it."},
        ]
    })

    # GPU memory conversation
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What's the default GPU memory utilization for vLLM?"},
            {"role": "assistant", "content": f"The default GPU memory utilization for vLLM deployments in FineTune Lab is {GROUND_TRUTH['default_values']['gpu_memory']} (80%). This leaves 20% of VRAM free for OS and other processes."},
            {"role": "user", "content": "Can I increase it?"},
            {"role": "assistant", "content": "Yes, you can increase it to 0.9 (90%) for smaller models (<7B) if you need more capacity. For larger models (13B+), you might want to reduce it to 0.7 (70%) to be safer."},
            {"role": "user", "content": "Where do I configure this?"},
            {"role": "assistant", "content": "When deploying your model, you'll see the deployment settings dialog. The GPU Memory Utilization slider is one of the configuration options. You can also specify it in the API request to /api/training/deploy."},
        ]
    })

    # Warmup ratio conversation
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What is the warmup ratio in training?"},
            {"role": "assistant", "content": f"The warmup ratio is the percentage of total training steps used for learning rate warmup. FineTune Lab's default is {GROUND_TRUTH['default_values']['warmup_ratio']} (3% of total steps). During warmup, the learning rate gradually increases from 0 to your target learning rate."},
            {"role": "user", "content": "Why use warmup?"},
            {"role": "assistant", "content": "Warmup helps stabilize training at the beginning. Without it, starting with a high learning rate can cause the model to diverge early on. The gradual increase lets the optimizer settle into a good trajectory."},
            {"role": "user", "content": "Should I change it?"},
            {"role": "assistant", "content": f"The default {GROUND_TRUTH['default_values']['warmup_ratio']} works well for most cases. You can increase it to 0.05-0.1 for very large learning rates or unstable training. For small datasets, you might reduce it to 0.01."},
        ]
    })

    # Train/eval split conversation
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What's the train/eval split ratio in FineTune Lab?"},
            {"role": "assistant", "content": f"The default train/eval split is 80/20, meaning eval_split = {GROUND_TRUTH['default_values']['eval_split']} (20% of your data is used for validation). This gives you a good evaluation set to monitor for overfitting."},
            {"role": "user", "content": "Can I change this?"},
            {"role": "assistant", "content": "Yes, you can adjust the eval split in the training configuration. For very small datasets (<100 examples), you might want 0.1 (10%) to preserve more training data. For large datasets (>10K), you could use 0.05 (5%)."},
            {"role": "user", "content": "What if I don't want any eval split?"},
            {"role": "assistant", "content": f"You can set eval_split to 0, but this is NOT recommended. Without an evaluation set, you won't be able to detect overfitting. The default {GROUND_TRUTH['default_values']['eval_split']} is a good balance."},
        ]
    })

    return conversations

def generate_api_endpoint_conversations() -> List[Dict]:
    """Generate conversations about API endpoints"""
    conversations = []

    # Start training endpoint
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "How do I start a training job via API?"},
            {"role": "assistant", "content": f"You make a POST request to {GROUND_TRUTH['api_endpoints']['start_training']}. This endpoint accepts training configuration including model, dataset, and hyperparameters."},
            {"role": "user", "content": "Can you show me a curl example?"},
            {"role": "assistant", "content": f"""Sure! Here's a curl example:\n\n```bash\ncurl -X POST http://localhost:3000{GROUND_TRUTH['api_endpoints']['start_training']} \\\n  -H "Content-Type: application/json" \\\n  -d '{{\n    "model_id": "Qwen/Qwen2.5-1.5B",\n    "dataset_path": "/path/to/dataset.jsonl",\n    "learning_rate": {GROUND_TRUTH['default_values']['learning_rate']},\n    "epochs": 3,\n    "lora_rank": 16\n  }}'\n```"""},
            {"role": "user", "content": "What does it return?"},
            {"role": "assistant", "content": "It returns a JSON response with the job_id (UUID) of the newly created training job. You can use this job_id to check status, get logs, and eventually deploy the model."},
        ]
    })

    # Get jobs endpoint
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "How do I list all my training jobs?"},
            {"role": "assistant", "content": f"Make a GET request to {GROUND_TRUTH['api_endpoints']['get_jobs']}. This returns all training jobs with their status, configuration, and metrics."},
            {"role": "user", "content": "What's in the response?"},
            {"role": "assistant", "content": "Each job includes: job_id, model_id, dataset_path, status (pending/running/completed/failed), config (hyperparameters), metrics (loss, accuracy), created_at, started_at, completed_at."},
        ]
    })

    # Get status endpoint
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "How do I check the status of a specific training job?"},
            {"role": "assistant", "content": f"Use GET {GROUND_TRUTH['api_endpoints']['get_status']}, replacing :jobId with your actual job ID. For example: GET /api/training/local/jobs/abc123."},
            {"role": "user", "content": "What status values can it return?"},
            {"role": "assistant", "content": "Status can be: 'pending' (queued), 'running' (actively training), 'completed' (finished successfully), 'failed' (error occurred), 'cancelled' (stopped by user)."},
        ]
    })

    # Deploy endpoint
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What API endpoint deploys a trained model?"},
            {"role": "assistant", "content": f"POST {GROUND_TRUTH['api_endpoints']['deploy_model']} is used to deploy models. You provide the job_id and deployment configuration (server type, GPU memory, max tokens, etc.)."},
            {"role": "user", "content": "What deployment options are available?"},
            {"role": "assistant", "content": f"""You can deploy to:\n1. vLLM (faster inference, GPU memory utilization default: {GROUND_TRUTH['default_values']['gpu_memory']})\n2. Ollama (easier setup, CPU or GPU)\n\nvLLM uses ports {GROUND_TRUTH['port_range']['vllm_start']}-{GROUND_TRUTH['port_range']['vllm_end']} and finds the first available port."""},
            {"role": "user", "content": "What if the job isn't completed?"},
            {"role": "assistant", "content": "The API will return an error: 'Training job not completed - Job status is <status>. Only completed jobs can be deployed.' You must wait for status='completed' before deploying."},
        ]
    })

    # Get metrics endpoint
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "How do I get training metrics for a job?"},
            {"role": "assistant", "content": f"Use GET {GROUND_TRUTH['api_endpoints']['get_metrics']}, replacing :jobId with your job ID. This returns real-time metrics during training."},
            {"role": "user", "content": "What metrics are included?"},
            {"role": "assistant", "content": "Metrics include: training_loss, eval_loss, learning_rate, tokens_per_second, gpu_utilization, current_step, current_epoch, time_remaining."},
        ]
    })

    return conversations

def generate_file_path_conversations() -> List[Dict]:
    """Generate conversations about file paths"""
    conversations = []

    # Training output location
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Where are my training outputs saved?"},
            {"role": "assistant", "content": f"Training outputs are saved in {GROUND_TRUTH['file_paths']['training_output']}/. Each job gets a unique UUID-based directory containing checkpoints, logs, and the final model."},
            {"role": "user", "content": "What files are in there?"},
            {"role": "assistant", "content": f"""The output directory {GROUND_TRUTH['file_paths']['training_output']}/ contains:\n- adapter_config.json (LoRA configuration)\n- adapter_model.safetensors (trained LoRA weights)\n- training.log (full training logs)\n- checkpoint-N/ (intermediate checkpoints)\n- trainer_state.json (for resuming training)\n- training_args.bin (saved hyperparameters)"""},
            {"role": "user", "content": "How do I find my job ID?"},
            {"role": "assistant", "content": "You can find your job ID: 1) On the Training page next to each job, 2) In the URL when viewing job details: /training/<job_id>, 3) In the database (local_training_jobs table), 4) In the first line of training.log."},
        ]
    })

    # Training server location
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Where is the training server code located?"},
            {"role": "assistant", "content": f"The training server is implemented in {GROUND_TRUTH['file_paths']['training_server']}. It's a FastAPI application that handles training job management, dataset validation, and model deployment."},
            {"role": "user", "content": "How do I start the training server?"},
            {"role": "assistant", "content": f"Run: `uvicorn training_server:app --host 0.0.0.0 --port 8000` from the lib/training/ directory. The server provides REST API endpoints for training operations."},
        ]
    })

    # Dataset validator location
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Where's the dataset validation code?"},
            {"role": "assistant", "content": f"Dataset validation is in {GROUND_TRUTH['file_paths']['dataset_validator']}. It validates JSONL structure, checks for required fields (messages, role, content), verifies role alternation, and validates tool call formatting."},
            {"role": "user", "content": "What formats does it accept?"},
            {"role": "assistant", "content": "The validator accepts ChatML format (messages with role/content) and ShareGPT format (conversations with from/value). Both must be in JSONL (one JSON object per line)."},
            {"role": "user", "content": "Does it support tool calling datasets?"},
            {"role": "assistant", "content": "Yes! The validator supports tool calling workflows with consecutive assistant messages containing tool_calls. It checks for proper tool call structure and tool response formatting."},
        ]
    })

    return conversations

def generate_ui_navigation_conversations() -> List[Dict]:
    """Generate conversations about UI navigation"""
    conversations = []

    # LoRA rank setting
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Where do I find the LoRA rank setting?"},
            {"role": "assistant", "content": f"The LoRA rank setting is located in {GROUND_TRUTH['ui_paths']['lora_rank']}. The slider offers values: 8, 16, 32, 64."},
            {"role": "user", "content": "What rank should I use?"},
            {"role": "assistant", "content": "For most tasks, rank=16 is a good default. Use rank=32 for complex tasks requiring more expressiveness. Higher rank = more trainable parameters = better quality but slower training and larger adapter size."},
            {"role": "user", "content": "What's the difference in size?"},
            {"role": "assistant", "content": "Rank 16 produces ~30MB adapters for 7B models. Rank 32 doubles that to ~60MB. Rank 64 gives ~120MB. Choose based on your quality vs efficiency tradeoff."},
        ]
    })

    # Deploy workflow
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What are the exact steps to deploy a trained model from the training page?"},
            {"role": "assistant", "content": f"1) Go to Training page, 2) Find your completed job, 3) Click the Deploy button, 4) Select vLLM or Ollama, 5) Configure settings (GPU memory: {GROUND_TRUTH['default_values']['gpu_memory']}, max tokens), 6) Click Deploy."},
            {"role": "user", "content": "Where will it be deployed?"},
            {"role": "assistant", "content": f"It deploys locally on ports {GROUND_TRUTH['port_range']['vllm_start']}-{GROUND_TRUTH['port_range']['vllm_end']}. The system finds the first available port. You'll get an OpenAI-compatible API at http://localhost:PORT/v1/chat/completions."},
            {"role": "user", "content": "How do I test it?"},
            {"role": "assistant", "content": "Go to Models page and select your deployed model from the dropdown. Or test with curl: `curl http://localhost:PORT/v1/chat/completions -H \"Content-Type: application/json\" -d '{\"model\": \"your-model\", \"messages\": [{\"role\": \"user\", \"content\": \"test\"}]}'`"},
        ]
    })

    # GraphRAG location
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Where is GraphRAG in the interface?"},
            {"role": "assistant", "content": f"GraphRAG is located at {GROUND_TRUTH['ui_paths']['graphrag']}. You can access it from the Tools menu in the navigation bar."},
            {"role": "user", "content": "What can I do there?"},
            {"role": "assistant", "content": "In the GraphRAG section, you can: 1) Upload documents, 2) Process them into knowledge graphs, 3) Search using graph-enhanced retrieval, 4) View your document library, 5) Delete processed documents."},
        ]
    })

    return conversations

def generate_troubleshooting_conversations() -> List[Dict]:
    """Generate troubleshooting conversations"""
    conversations = []

    # CUDA OOM
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "I'm getting CUDA out of memory error during training. Help!"},
            {"role": "assistant", "content": "CUDA OOM means you've exceeded GPU VRAM. Solutions: 1) Enable QLoRA (4-bit quantization), 2) Reduce batch size, 3) Enable gradient checkpointing, 4) Reduce max sequence length. Let's start with QLoRA - it's most effective."},
            {"role": "user", "content": "How do I enable QLoRA?"},
            {"role": "assistant", "content": "Navigate to Training > Training Configuration > QLoRA Tab. Toggle 'Use QLoRA' ON, set quantization to 4-bit, use nf4 type, and enable BFloat16 if you have Ampere+ GPU (RTX 30xx/40xx). This reduces VRAM by ~75%."},
            {"role": "user", "content": "Still failing with batch size 4. What next?"},
            {"role": "assistant", "content": "Try batch_size=1 with gradient_accumulation_steps=4 to maintain effective batch size of 4. Also enable gradient checkpointing (Advanced Settings). What GPU do you have?"},
            {"role": "user", "content": "RTX 3090 24GB"},
            {"role": "assistant", "content": "24GB should handle 7B-13B models with QLoRA + small batch! Check if something else is using GPU: run `nvidia-smi`. Also try reducing max_seq_length to 1024 or 512."},
        ]
    })

    # Training not starting
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "My training job is stuck in 'pending' status. Why?"},
            {"role": "assistant", "content": "Check if the training server is running. Run: `curl http://localhost:8000/api/training/local/jobs` to see if it responds. If not, start the training server from lib/training/ directory."},
            {"role": "user", "content": "How do I start it?"},
            {"role": "assistant", "content": f"cd lib/training && uvicorn training_server:app --host 0.0.0.0 --port 8000. The server is in {GROUND_TRUTH['file_paths']['training_server']}."},
            {"role": "user", "content": "It's running but still pending"},
            {"role": "assistant", "content": f"Check the logs: GET {GROUND_TRUTH['api_endpoints']['get_logs']} (replace :jobId). Look for validation errors like missing dataset or invalid configuration. Also check training_server.log for errors."},
        ]
    })

    # Deploy failure
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Deployment fails with 'job not completed' error"},
            {"role": "assistant", "content": f"You can only deploy jobs with status='completed'. Check your job status via {GROUND_TRUTH['api_endpoints']['get_status']}. If it shows 'running', wait for it to finish. If 'failed', check the logs to fix the issue."},
            {"role": "user", "content": "Status shows completed but still failing"},
            {"role": "assistant", "content": f"Check if the model files exist in {GROUND_TRUTH['file_paths']['training_output']}/. Look for adapter_model.safetensors. If missing, the training may have failed to save the final checkpoint."},
        ]
    })

    # GPU memory on deploy
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Deployment fails with insufficient VRAM"},
            {"role": "assistant", "content": "Check if another model is already deployed. Only one vLLM instance can run at a time on a single GPU. Check running instances with `nvidia-smi` or stop existing deployments from the Models page."},
            {"role": "user", "content": "Nothing else running but still fails"},
            {"role": "assistant", "content": f"Try reducing GPU memory utilization from the default {GROUND_TRUTH['default_values']['gpu_memory']} to 0.7 or 0.6. For large models (13B+), you may need to use 4-bit quantization even for inference."},
        ]
    })

    return conversations

def generate_feature_conversations() -> List[Dict]:
    """Generate conversations about features"""
    conversations = []

    # Dataset validation feature
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "Does FineTune Lab validate my dataset before training?"},
            {"role": "assistant", "content": f"Yes! Automatic dataset validation is implemented in {GROUND_TRUTH['file_paths']['dataset_validator']}. It validates JSONL structure, checks required fields (messages, role, content), verifies role alternation, and checks tool call formatting."},
            {"role": "user", "content": "What if validation fails?"},
            {"role": "assistant", "content": "You'll get a detailed error message showing which lines failed and why. Common issues: invalid JSON, missing 'messages' field, wrong role values, unescaped special characters in content."},
        ]
    })

    # Supported quantization
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What quantization types does FineTune Lab support?"},
            {"role": "assistant", "content": "FineTune Lab supports 4-bit and 8-bit quantization for QLoRA. For 4-bit, you can use nf4 (Normal Float 4 - recommended) or fp4 (Float Point 4). You can also enable double quantization for even more memory savings."},
            {"role": "user", "content": "What's double quantization?"},
            {"role": "assistant", "content": "Double quantization applies quantization to the quantization constants themselves, saving an additional ~0.4 bits per parameter. Enable it in QLoRA settings if you need maximum memory efficiency."},
        ]
    })

    # LoRA target modules
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What LoRA target modules does FineTune Lab use?"},
            {"role": "assistant", "content": "Default target modules are: q_proj, k_proj, v_proj, o_proj (attention layers). You can optionally add gate_proj, up_proj, down_proj (MLP layers) for more expressiveness at the cost of more trainable parameters."},
            {"role": "user", "content": "Should I include MLP layers?"},
            {"role": "assistant", "content": "For most chat/instruction tasks, attention layers (q,k,v,o) are sufficient. Add MLP layers for tasks requiring significant knowledge injection or behavior changes. It roughly doubles the adapter size and training time."},
        ]
    })

    # Database tracking
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What database does FineTune Lab use?"},
            {"role": "assistant", "content": f"FineTune Lab uses {GROUND_TRUTH['database'].upper()} (PostgreSQL) with tables: local_training_jobs (training runs), local_inference_servers (deployed models), llm_models (model registry)."},
            {"role": "user", "content": "Can I query it directly?"},
            {"role": "assistant", "content": "Yes, you can use Supabase SQL editor or connect via psql. Tables track job status, metrics, configs, and deployment info. The API endpoints query these tables for you."},
        ]
    })

    # Port allocation
    conversations.append({
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": "What ports does FineTune Lab use for deployments?"},
            {"role": "assistant", "content": f"vLLM deployments use ports {GROUND_TRUTH['port_range']['vllm_start']}-{GROUND_TRUTH['port_range']['vllm_end']}. The system finds the first available port in this range. You can have multiple models deployed simultaneously on different ports."},
            {"role": "user", "content": "How do I check what's using each port?"},
            {"role": "assistant", "content": "Use `lsof -i :PORT` or `netstat -tulpn | grep PORT`. The Models page also shows all active deployments with their assigned ports."},
        ]
    })

    return conversations

def generate_all_conversations() -> List[Dict]:
    """Generate all conversation types"""
    all_conversations = []

    all_conversations.extend(generate_config_defaults_conversations())
    all_conversations.extend(generate_api_endpoint_conversations())
    all_conversations.extend(generate_file_path_conversations())
    all_conversations.extend(generate_ui_navigation_conversations())
    all_conversations.extend(generate_troubleshooting_conversations())
    all_conversations.extend(generate_feature_conversations())

    return all_conversations

def save_dataset(conversations: List[Dict], output_path: str):
    """Save dataset in JSONL format"""
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, 'w', encoding='utf-8') as f:
        for conv in conversations:
            f.write(json.dumps(conv, ensure_ascii=False) + '\n')

    print(f"\n💾 Saved {len(conversations)} conversations to {output_file.name}")
    print(f"📊 File size: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

    # Stats
    total_turns = sum(len([m for m in conv['messages'] if m['role'] in ['user', 'assistant']]) for conv in conversations)
    avg_turns = total_turns / len(conversations) if conversations else 0

    print(f"\n📈 Dataset Stats:")
    print(f"   Total conversations: {len(conversations)}")
    print(f"   Average turns per conversation: {avg_turns:.1f}")
    print(f"   Total messages: {total_turns}")

def main():
    print("="*80)
    print("GENERATING ACCURATE FINETUNE LAB TRAINING DATASET")
    print("="*80)

    print("\n🎯 Generating multi-turn conversations with real implementation details...\n")

    conversations = generate_all_conversations()

    output_path = "/home/juan-canfield/Desktop/web-ui/output/evaluation/accurate_training_dataset_v2.jsonl"
    save_dataset(conversations, output_path)

    print("\n✨ Dataset generated with specific FineTune Lab knowledge!")
    print("\n💡 Next Steps:")
    print("   1. Run assessment: python3 assess_dataset_accuracy.py")
    print("   2. Compare score to old dataset (50/100)")
    print("   3. Use for training if score >80/100")

if __name__ == "__main__":
    main()
