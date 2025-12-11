#!/usr/bin/env python3
"""
Generate 50 baseline test Q&A pairs for FineTune Lab
These are used to evaluate base model vs fine-tuned model performance
"""

import json
from pathlib import Path

# 50 carefully curated questions covering all aspects of FineTune Lab
BASELINE_TESTS = [
    # Getting Started (5)
    {
        "category": "getting_started",
        "difficulty": "easy",
        "question": "What is FineTune Lab?",
        "reference_answer": "FineTune Lab is a comprehensive, professional-grade platform for fine-tuning large language models. It enables users to customize state-of-the-art models on their own hardware or in the cloud, with features like QLoRA, dataset management, real-time monitoring, and one-click deployment. The platform makes fine-tuning accessible without sacrificing professional capabilities."
    },
    {
        "category": "getting_started",
        "difficulty": "easy",
        "question": "How do I get started with FineTune Lab?",
        "reference_answer": "To get started: 1) Ensure you have compatible hardware (NVIDIA GPU with 16GB+ VRAM recommended), 2) Clone the repository and install dependencies, 3) Set up your environment variables, 4) Prepare your dataset in JSONL/ShareGPT format, 5) Select a base model, 6) Configure training parameters, and 7) Start your training run. The platform provides step-by-step guidance through the UI."
    },
    {
        "category": "getting_started",
        "difficulty": "medium",
        "question": "What models does FineTune Lab support?",
        "reference_answer": "FineTune Lab supports major open-source model families including Llama 3, Qwen 2.5, Mistral, Phi-3, Gemma, and other HuggingFace-compatible models. You can fine-tune models ranging from 1B to 70B+ parameters depending on your hardware. The platform automatically handles model loading, tokenization, and architecture-specific optimizations."
    },
    {
        "category": "getting_started",
        "difficulty": "medium",
        "question": "Can I use FineTune Lab for commercial projects?",
        "reference_answer": "Yes, FineTune Lab itself is open-source. However, commercial use depends on the base model's license. Models like Llama 3, Mistral, and Qwen 2.5 have permissive licenses allowing commercial use. Always check the specific model's license before deploying for commercial purposes. Your fine-tuned weights are yours to keep and deploy."
    },
    {
        "category": "getting_started",
        "difficulty": "hard",
        "question": "What's the difference between FineTune Lab and using raw HuggingFace Transformers?",
        "reference_answer": "FineTune Lab provides a complete workflow: web UI for configuration, automatic PEFT setup (LoRA/QLoRA), dataset validation, real-time monitoring with loss graphs, automatic mixed-precision training, integrated evaluation, one-click deployment, and cost tracking. Raw HuggingFace requires manual configuration of training loops, optimizers, data loaders, and monitoring. FineTune Lab reduces setup time from hours to minutes."
    },

    # Hardware Requirements (5)
    {
        "category": "hardware",
        "difficulty": "easy",
        "question": "What GPU do I need for FineTune Lab?",
        "reference_answer": "Minimum: NVIDIA GPU with 16GB VRAM (RTX 4060 Ti 16GB, RTX 3090) for 7B models with QLoRA. Recommended: 24GB VRAM (RTX 4090, RTX 3090) for 13B models. For 70B models, you'll need 40GB+ (A100, H100) or multi-GPU setup. AMD GPUs are not currently supported as we rely on CUDA-specific optimizations."
    },
    {
        "category": "hardware",
        "difficulty": "medium",
        "question": "How much VRAM do I need to fine-tune a 7B model?",
        "reference_answer": "With QLoRA (4-bit quantization), you can fine-tune a 7B model with 12-16GB VRAM. With standard LoRA (16-bit), you'll need 20-24GB. Full fine-tuning requires 60GB+. VRAM usage depends on: base model size, quantization (4-bit/8-bit/none), batch size, sequence length, and LoRA rank. Use gradient checkpointing to reduce VRAM at the cost of speed."
    },
    {
        "category": "hardware",
        "difficulty": "medium",
        "question": "Can I train on multiple GPUs?",
        "reference_answer": "Yes, FineTune Lab supports multi-GPU training via DeepSpeed and FSDP (Fully Sharded Data Parallel). For data parallelism, simply specify multiple GPU IDs. For large models that don't fit on one GPU, use FSDP to shard the model across GPUs. Configure in Training > Advanced Settings > Distributed Training. Multi-GPU can significantly speed up training (near-linear scaling for data parallelism)."
    },
    {
        "category": "hardware",
        "difficulty": "hard",
        "question": "What's the electricity cost to train a 7B model locally?",
        "reference_answer": "A typical training run on an RTX 4090 (450W TDP) for 6 epochs (~8 hours) uses approximately 3.6 kWh. At $0.15/kWh, that's $0.54 in electricity. Compare this to cloud API costs of $200-500+ for equivalent training. The GPU itself draws power, but CPU, RAM, and other components add ~100-200W. Total system power during training is typically 600-800W."
    },
    {
        "category": "hardware",
        "difficulty": "hard",
        "question": "Should I use NVMe SSD or SATA SSD for training?",
        "reference_answer": "NVMe SSD is strongly recommended. During training, the dataloader constantly reads examples from disk. NVMe provides 3000-7000 MB/s vs SATA's 550 MB/s. This matters when: 1) loading large datasets, 2) shuffling between epochs, 3) using large batch sizes. Slow storage becomes a bottleneck - your GPU waits idle for data. For datasets <10GB, SATA is acceptable. For 50GB+ datasets, NVMe significantly improves throughput."
    },

    # Dataset Preparation (5)
    {
        "category": "dataset",
        "difficulty": "easy",
        "question": "What format should my dataset be in?",
        "reference_answer": "FineTune Lab supports JSONL (JSON Lines) format with ChatML structure. Each line is a JSON object with a 'messages' array containing role/content pairs. Roles are 'system', 'user', and 'assistant'. Example: {\"messages\": [{\"role\": \"user\", \"content\": \"question\"}, {\"role\": \"assistant\", \"content\": \"answer\"}]}. ShareGPT format is also supported."
    },
    {
        "category": "dataset",
        "difficulty": "medium",
        "question": "How many examples do I need for good results?",
        "reference_answer": "Minimum: 200-500 examples for proof-of-concept. Recommended: 1,000-5,000 high-quality examples for production. Quality matters more than quantity - 1,000 diverse, accurate examples outperform 10,000 repetitive ones. For narrow domains (specific tool use), 500 examples may suffice. For broad knowledge (customer support), aim for 3,000+. Include edge cases and failure modes."
    },
    {
        "category": "dataset",
        "difficulty": "medium",
        "question": "Should I include system prompts in my dataset?",
        "reference_answer": "Yes, system prompts are recommended for instruction-following models. They provide context about the model's role, behavior, and constraints. Keep system prompts consistent across your dataset. Example: 'You are a helpful assistant for [domain].' The model learns to follow these instructions. However, for completion-style tasks or continuing text, system prompts may not be needed."
    },
    {
        "category": "dataset",
        "difficulty": "hard",
        "question": "How do I handle imbalanced datasets?",
        "reference_answer": "Strategies: 1) Weighted sampling - oversample rare classes during training, 2) Generate variations of underrepresented examples (paraphrasing, synonym replacement), 3) Use stratified splitting to ensure all classes in train/eval, 4) Loss weighting - higher loss weight for rare examples, 5) Curriculum learning - train common cases first, then rare cases. For 80/20 imbalance, consider rebalancing to 60/40. Extreme imbalance (95/5) requires aggressive resampling."
    },
    {
        "category": "dataset",
        "difficulty": "hard",
        "question": "What's the optimal train/eval split ratio?",
        "reference_answer": "Standard: 80/20 train/eval for datasets >1,000 examples. For 500-1,000 examples, use 85/15. For <500 examples, use 90/10 to maximize training data. Eval set should be representative of all data types. Minimum eval size: 100 examples for stable metrics. Use stratified splitting to preserve class distribution. If you have separate test data, use 80/10/10 (train/eval/test)."
    },

    # Training Configuration (10)
    {
        "category": "training",
        "difficulty": "easy",
        "question": "What is QLoRA?",
        "reference_answer": "QLoRA (Quantized Low-Rank Adaptation) combines 4-bit quantization with LoRA to dramatically reduce VRAM requirements. Instead of fine-tuning all model parameters, QLoRA: 1) quantizes the base model to 4-bit (75% VRAM reduction), 2) freezes base weights, 3) trains small adapter matrices (rank 8-64). This allows training 7B models on 12GB VRAM, 13B on 16GB, 70B on 48GB. Accuracy is comparable to full fine-tuning."
    },
    {
        "category": "training",
        "difficulty": "easy",
        "question": "Where can I find the BFloat16 setting?",
        "reference_answer": "Navigate to Training > Training Configuration > QLoRA Tab. BFloat16 is located next to the Quantization Bits dropdown. BFloat16 (Brain Floating Point) is recommended for NVIDIA Ampere GPUs (RTX 30xx, A100) and newer. It provides better numerical stability than FP16 while maintaining speed. Disable BFloat16 for older GPUs (RTX 20xx, GTX)."
    },
    {
        "category": "training",
        "difficulty": "medium",
        "question": "What learning rate should I use?",
        "reference_answer": "Recommended starting point: 2e-5 (0.00002) for LoRA/QLoRA. Range: 1e-5 to 5e-5. Lower learning rates (1e-5) are safer but slower. Higher rates (5e-5) train faster but risk instability. Use learning rate schedulers (cosine, linear) to gradually reduce LR. For full fine-tuning, use 10x lower rates (1e-6 to 5e-6). Monitor training loss - if it spikes or becomes NaN, reduce LR."
    },
    {
        "category": "training",
        "difficulty": "medium",
        "question": "What's the difference between LoRA rank 8, 16, 32, and 64?",
        "reference_answer": "LoRA rank controls adapter capacity. Higher rank = more parameters = better performance but more VRAM. Rank 8: 2-4M params, good for simple tasks. Rank 16: 4-8M params, balanced default. Rank 32: 8-16M params, complex reasoning. Rank 64: 16-32M params, maximum capacity. Start with rank 16. If eval loss plateaus high, increase to 32. If VRAM is tight, try rank 8. Diminishing returns above 64."
    },
    {
        "category": "training",
        "difficulty": "medium",
        "question": "How many epochs should I train for?",
        "reference_answer": "Typical: 3-6 epochs. Watch eval loss to determine optimal stopping point. Signs of optimal training: eval loss decreases steadily then plateaus. Signs of overtraining: eval loss increases while train loss decreases (overfitting). For small datasets (<1,000 examples), use 5-8 epochs. For large datasets (10,000+), 2-3 epochs may suffice. Use early stopping to automatically stop when eval loss stops improving."
    },
    {
        "category": "training",
        "difficulty": "hard",
        "question": "What is gradient accumulation and when should I use it?",
        "reference_answer": "Gradient accumulation splits a large batch into smaller micro-batches, accumulating gradients before updating weights. Use when: 1) desired batch size doesn't fit in VRAM, 2) you want batch size 32 but only fit 4 per step. Set accumulation_steps=8 for effective batch size of 32. Trade-off: same effective batch size but slower (8 forward passes per update). Useful for maintaining large batch size benefits while fitting on smaller GPUs."
    },
    {
        "category": "training",
        "difficulty": "hard",
        "question": "What's the difference between warmup ratio 0.03 and 0.1?",
        "reference_answer": "Warmup gradually increases learning rate from 0 to target over first N steps. Ratio 0.03 = 3% of total steps for warmup. Ratio 0.1 = 10%. Purpose: prevents large gradient updates early when model is uninitialized. Use 0.03 (default) for most cases. Use 0.1 for: large models, unstable training, or high learning rates. Example: 1,000 total steps, 0.03 = 30 warmup steps, 0.1 = 100 warmup steps. Longer warmup is more conservative."
    },
    {
        "category": "training",
        "difficulty": "hard",
        "question": "Should I use Flash Attention 2?",
        "reference_answer": "Yes, Flash Attention 2 is highly recommended. Benefits: 2-4x faster training, 30-50% VRAM reduction, no accuracy loss. It optimizes attention computation using memory-efficient kernels. Requirements: NVIDIA Ampere or newer (RTX 30xx+, A100), CUDA 11.8+, properly installed flash-attn package. Enable in Training > Advanced Settings > Flash Attention 2. If training crashes, disable it - some model architectures have compatibility issues."
    },
    {
        "category": "training",
        "difficulty": "hard",
        "question": "What happens if my training loss becomes NaN?",
        "reference_answer": "NaN (Not a Number) indicates gradient explosion or numerical instability. Causes: 1) learning rate too high, 2) bad data (inf/NaN values), 3) mixed precision issues, 4) exploding gradients. Solutions: 1) Reduce learning rate by 10x (2e-5 → 2e-6), 2) Enable gradient clipping (max_grad_norm=1.0), 3) Disable mixed precision/BFloat16, 4) Check dataset for corrupted examples, 5) Increase warmup ratio to 0.1. Most common fix: reduce LR to 1e-5 or lower."
    },
    {
        "category": "training",
        "difficulty": "hard",
        "question": "How do I know if my model is overfitting?",
        "reference_answer": "Signs of overfitting: 1) Train loss continues decreasing but eval loss increases or plateaus, 2) Large gap between train/eval loss (train=0.3, eval=2.5), 3) Model memorizes training examples verbatim, 4) Poor generalization to new inputs. Solutions: 1) Reduce epochs (6→3), 2) Increase dataset size/diversity, 3) Lower LoRA rank (64→16), 4) Add dropout (0.1), 5) Use weight decay (0.01), 6) Early stopping. Monitor eval loss every epoch."
    },

    # Troubleshooting (5)
    {
        "category": "troubleshooting",
        "difficulty": "medium",
        "question": "My training is very slow, what can I do?",
        "reference_answer": "Speed optimizations: 1) Enable Flash Attention 2 (2-4x faster), 2) Use BFloat16 on compatible GPUs, 3) Increase batch size if VRAM allows, 4) Reduce max sequence length if not needed, 5) Upgrade to NVMe SSD for faster data loading, 6) Disable unnecessary logging/checkpointing, 7) Use gradient checkpointing=False if VRAM allows (faster but uses more memory). Profile with NVIDIA nsys to identify bottlenecks."
    },
    {
        "category": "troubleshooting",
        "difficulty": "medium",
        "question": "I'm getting CUDA out of memory errors, how do I fix this?",
        "reference_answer": "VRAM reduction strategies: 1) Enable 4-bit quantization (QLoRA), 2) Reduce batch size (8→4→2→1), 3) Enable gradient checkpointing, 4) Reduce LoRA rank (32→16→8), 5) Reduce max sequence length (2048→1024→512), 6) Enable gradient accumulation to maintain effective batch size, 7) Use smaller base model (7B→3B), 8) Close other GPU applications. Apply in order until training fits."
    },
    {
        "category": "troubleshooting",
        "difficulty": "hard",
        "question": "My eval loss is not decreasing, what's wrong?",
        "reference_answer": "Possible causes: 1) Learning rate too low - try 5e-5 instead of 1e-5, 2) LoRA rank too low - increase from 8 to 16 or 32, 3) Overfitting to train set - eval set may be out-of-distribution, 4) Dataset quality issues - eval set has different characteristics, 5) Not enough epochs - try training longer, 6) Model capacity insufficient - try larger base model or full fine-tune. Check if train loss is decreasing - if not, it's a training issue."
    },
    {
        "category": "troubleshooting",
        "difficulty": "hard",
        "question": "Training starts but hangs at step 0, what should I check?",
        "reference_answer": "Common causes: 1) Data loader issue - check dataset format/corruption, 2) Disk I/O bottleneck - data on slow HDD, 3) Tokenization problem - sequence length too large, 4) NCCL deadlock (multi-GPU) - check network/GPU topology, 5) System swap thrashing - RAM exhausted. Debug: Monitor GPU utilization (nvidia-smi), check disk I/O (iotop), verify data loads (test single batch), check system RAM usage. Often fixed by reducing batch size or using faster storage."
    },
    {
        "category": "troubleshooting",
        "difficulty": "hard",
        "question": "Can I resume training if it crashes?",
        "reference_answer": "Yes, FineTune Lab automatically saves checkpoints. To resume: 1) Navigate to Training > Resume Training, 2) Select the checkpoint directory, 3) Training continues from last saved step. Checkpoints include: model weights, optimizer state, scheduler state, RNG state. By default, checkpoints save every epoch. Configure in Training > Advanced > Checkpoint Settings. Note: resuming from checkpoint requires same config (batch size, LR, etc.)."
    },

    # Advanced Features (5)
    {
        "category": "advanced",
        "difficulty": "medium",
        "question": "What is GraphRAG and when should I use it?",
        "reference_answer": "GraphRAG is an enhanced retrieval system that builds knowledge graphs from your documents. Unlike traditional RAG (retrieves similar chunks), GraphRAG understands relationships and multi-hop reasoning. Use cases: complex knowledge bases, technical documentation, legal/medical research. Benefits: better context understanding, handles 'connect the dots' questions, discovers implicit relationships. Trade-off: slower indexing time, higher computational cost. Find it in Tools > GraphRAG > Setup."
    },
    {
        "category": "advanced",
        "difficulty": "medium",
        "question": "Can I deploy my model after training?",
        "reference_answer": "Yes, FineTune Lab provides one-click deployment. After training: 1) Navigate to Deployment > Deploy Model, 2) Select your trained adapter, 3) Choose deployment type (local server, cloud, docker), 4) Configure inference parameters (temperature, max tokens), 5) Click Deploy. The model runs as an OpenAI-compatible API endpoint. Access via REST API or integrate with applications. Deployment includes automatic batching and caching for performance."
    },
    {
        "category": "advanced",
        "difficulty": "hard",
        "question": "What is RLHF and does FineTune Lab support it?",
        "reference_answer": "RLHF (Reinforcement Learning from Human Feedback) trains models using reward signals from human preferences. Process: 1) Supervised fine-tuning (SFT) on demonstrations, 2) Train reward model on preference pairs, 3) Optimize policy via PPO/DPO. FineTune Lab supports DPO (Direct Preference Optimization), a simpler alternative to PPO. Use for: improving response quality, reducing harmful outputs, aligning to preferences. Configure in Training > Training Type > DPO. Requires preference dataset format."
    },
    {
        "category": "advanced",
        "difficulty": "hard",
        "question": "Can I merge multiple LoRA adapters?",
        "reference_answer": "Yes, adapter merging combines multiple specialized adapters into one. Use cases: combining domain expertise (customer support + technical knowledge), task composition (summarization + translation). Methods: 1) Linear merge (average weights), 2) Weighted merge (priority-based), 3) Sequential application. Navigate to Advanced > Merge Adapters, select adapters, choose merge strategy. Result is a single adapter with combined capabilities. Note: may require fine-tuning after merge to resolve conflicts."
    },
    {
        "category": "advanced",
        "difficulty": "hard",
        "question": "What is the difference between SFT, DPO, and ORPO?",
        "reference_answer": "SFT (Supervised Fine-Tuning): Standard approach, trains on input-output pairs, maximizes likelihood of correct responses. DPO (Direct Preference Optimization): Trains on preference pairs (chosen vs rejected), directly optimizes for preferences without reward model. ORPO (Odds Ratio Preference Optimization): Combines SFT and preference learning in one stage, more efficient than DPO. Use SFT for: learning new knowledge/tasks. Use DPO for: improving quality, reducing bad outputs. Use ORPO for: both simultaneously."
    },

    # Cost and ROI (3)
    {
        "category": "cost",
        "difficulty": "easy",
        "question": "How much does it cost to train a model with FineTune Lab?",
        "reference_answer": "Local training costs: only electricity (~$0.50-3 per training run for 7B model). No API fees, no per-token charges. Cloud training costs: depends on provider (RunPod ~$0.30/hr for RTX 4090, $1.10/hr for A100). Compare to API fine-tuning: OpenAI charges $0.0080 per 1K tokens for training (typical job = $200-500). FineTune Lab provides unlimited experimentation for fixed cost."
    },
    {
        "category": "cost",
        "difficulty": "medium",
        "question": "What's the ROI of using FineTune Lab vs cloud APIs?",
        "reference_answer": "Example: Currently spending $2,000/month on OpenAI API for 5M tokens. With FineTune Lab: 1) Initial hardware cost: $1,600 (RTX 4090), 2) Monthly electricity: ~$10, 3) Payback period: <1 month, 4) Ongoing savings: $1,990/month (99.5%). Additional benefits: data privacy, unlimited experimentation, model ownership, offline operation. ROI improves with usage - higher API spend = faster payback. Break-even at ~800K tokens/month."
    },
    {
        "category": "cost",
        "difficulty": "hard",
        "question": "Should I buy a GPU or rent cloud compute?",
        "reference_answer": "Buy GPU if: 1) Training frequently (>40 hours/month), 2) Privacy is critical, 3) Long-term usage (1+ years), 4) Multiple team members need access. Rent cloud if: 1) Occasional training (<20 hours/month), 2) Need larger GPUs than affordable, 3) Experimenting/prototyping, 4) Want multiple GPU types. Break-even: RTX 4090 ($1,600) vs RunPod ($0.30/hr) = 5,333 hours = 222 days of 24/7 use. For typical 8hr/day usage, break-even at ~27 months. Cloud is cheaper for <2 years of light usage."
    },

    # Integration and Deployment (3)
    {
        "category": "deployment",
        "difficulty": "medium",
        "question": "How do I integrate my fine-tuned model with my application?",
        "reference_answer": "After deployment, FineTune Lab provides an OpenAI-compatible API endpoint. Integration: 1) Use OpenAI Python SDK: client = OpenAI(base_url='http://localhost:8000/v1', api_key='local'), 2) Make requests like: client.chat.completions.create(model='my-model', messages=[...]), 3) Works with LangChain, LlamaIndex, and other frameworks. API supports: streaming, function calling, embeddings. See Deployment > API Documentation for full details."
    },
    {
        "category": "deployment",
        "difficulty": "hard",
        "question": "Can I quantize my model after training for faster inference?",
        "reference_answer": "Yes, post-training quantization reduces model size and increases speed. Options: 1) GPTQ (4-bit/8-bit, fast inference, requires calibration data), 2) AWQ (4-bit, higher accuracy than GPTQ), 3) GGUF (for llama.cpp, CPU-friendly). Navigate to Deployment > Optimize > Quantize Model. 4-bit quantization: 75% size reduction, 2-3x faster inference, minimal accuracy loss (<1%). Use for: deployment on edge devices, reducing memory footprint, faster API responses."
    },
    {
        "category": "deployment",
        "difficulty": "hard",
        "question": "What is the difference between vLLM and standard HuggingFace inference?",
        "reference_answer": "vLLM is an optimized inference engine providing 10-20x higher throughput than standard HF. Features: 1) PagedAttention (efficient KV cache management), 2) Continuous batching (no padding waste), 3) Optimized CUDA kernels, 4) Multi-GPU tensor parallelism. Use vLLM for: high-throughput production (100+ requests/sec), serving multiple users, cost-sensitive deployments. Use HF for: development/testing, exotic model architectures, feature compatibility. Enable vLLM in Deployment > Inference Engine > vLLM."
    },

    # Monitoring and Evaluation (4)
    {
        "category": "monitoring",
        "difficulty": "easy",
        "question": "How do I monitor training progress?",
        "reference_answer": "FineTune Lab provides real-time monitoring: 1) Training Dashboard shows: loss graphs (train/eval), learning rate schedule, GPU utilization, tokens/second, 2) Metrics updated every step/epoch, 3) Automatic checkpoint saving, 4) Email notifications on completion/failure. Access at Training > Monitor Active Job. Watch for: steadily decreasing train loss, decreasing or plateauing eval loss (good), diverging train/eval loss (overfitting)."
    },
    {
        "category": "monitoring",
        "difficulty": "medium",
        "question": "What metrics should I look at to evaluate my model?",
        "reference_answer": "Key metrics: 1) Train Loss: measures training fit, should decrease steadily, 2) Eval Loss: measures generalization, should decrease then plateau, 3) Perplexity: exp(loss), lower is better (goal: <10 for good model), 4) Accuracy: token prediction accuracy, 5) Learning Rate: verify schedule is working. Compare: base model vs fine-tuned on held-out test set. Use domain-specific metrics: BLEU for translation, ROUGE for summarization, F1 for classification."
    },
    {
        "category": "monitoring",
        "difficulty": "hard",
        "question": "How do I create a custom evaluation set?",
        "reference_answer": "Custom evaluation best practices: 1) Hold out 10-20% of data as test set (never seen during training/validation), 2) Create diverse examples covering edge cases, 3) Include failure modes and hard examples, 4) Stratify by category/difficulty, 5) Use consistent format (same as training data). For production: create human evaluation rubric, score outputs 1-5 on accuracy/helpfulness/safety. Run baseline tests (50 Q&As) comparing base vs fine-tuned model. Store evaluations for regression testing."
    },
    {
        "category": "monitoring",
        "difficulty": "hard",
        "question": "What is catastrophic forgetting and how do I prevent it?",
        "reference_answer": "Catastrophic forgetting: model forgets general knowledge while learning new task. Signs: fine-tuned model great at new task but poor at basic reasoning/general questions. Prevention: 1) Include diverse general examples in training data (20-30%), 2) Use lower learning rates (1e-5 vs 5e-5), 3) Fewer epochs (3 vs 10), 4) Replay: mix original pre-training data, 5) Elastic Weight Consolidation (EWC), 6) Test on general benchmarks before/after. Balance: task performance vs general capability."
    },

    # Specific Technical Questions (7)
    {
        "category": "technical",
        "difficulty": "medium",
        "question": "Where are the QLoRA quantization settings?",
        "reference_answer": "Navigate to Training > Training Configuration > QLoRA Tab. Settings include: 1) Quantization Bits (4-bit or 8-bit), 2) BFloat16 toggle, 3) Double Quantization (nested quantization for extra VRAM savings), 4) Quantization Type (nf4 or fp4). Recommended: 4-bit nf4 quantization with BFloat16 enabled for Ampere+ GPUs. Double quantization saves additional 2-3GB VRAM with minimal accuracy impact."
    },
    {
        "category": "technical",
        "difficulty": "medium",
        "question": "What does the nf4 quantization type mean?",
        "reference_answer": "nf4 (Normal Float 4-bit) is optimized for normally-distributed weights (which neural networks have). Compared to fp4 (standard float 4-bit), nf4 provides better accuracy by allocating more precision to common weight values near zero. Use nf4 for: QLoRA, most models. Use fp4 for: extreme memory constraints. In practice, nf4 is the default and recommended choice - it's specifically designed for LLM fine-tuning."
    },
    {
        "category": "technical",
        "difficulty": "hard",
        "question": "What are the target modules in LoRA configuration?",
        "reference_answer": "Target modules specify which layers get LoRA adapters. Common configs: 1) Query+Key+Value (q_proj, k_proj, v_proj): most common, balances performance/efficiency, 2) Add output projection (o_proj): increases capacity, 3) Add MLP layers (gate_proj, up_proj, down_proj): maximum capacity but more VRAM. Default (q/k/v) works for most cases. Add o_proj for complex tasks. Add MLP layers only if eval loss plateaus high. Find in Training > Advanced > LoRA Configuration > Target Modules."
    },
    {
        "category": "technical",
        "difficulty": "hard",
        "question": "What is the difference between gradient checkpointing and gradient accumulation?",
        "reference_answer": "Gradient checkpointing: saves VRAM by recomputing activations during backward pass instead of storing them. Trade: VRAM (saves 40-60%) vs speed (20-30% slower). Use when: VRAM limited. Gradient accumulation: splits large batch into small steps, accumulates gradients before update. Trade: maintains effective batch size with less VRAM. Use when: want batch_size=32 but only fit 4. Combine both: checkpointing for VRAM, accumulation for batch size. Independent techniques, both reduce VRAM."
    },
    {
        "category": "technical",
        "difficulty": "hard",
        "question": "Should I use paged AdamW optimizer?",
        "reference_answer": "Paged AdamW stores optimizer states in CPU RAM when GPU VRAM is full, transparently paging to VRAM when needed. Benefits: trains larger models/batches on same GPU, prevents OOM errors. Trade-off: 5-10% slower due to CPU-GPU transfers. Use when: hitting VRAM limits even with QLoRA+checkpointing, want slightly larger batch size. Don't use if: training fits comfortably in VRAM (no benefit, just overhead). Enable in Training > Advanced > Optimizer > Paged AdamW. Requires bitsandbytes 0.38+."
    },
    {
        "category": "technical",
        "difficulty": "medium",
        "question": "What is the Config Parameters section used for?",
        "reference_answer": "Config Parameters section (Training > Model Configuration > Config Parameters) allows setting model-specific hyperparameters like: attention implementation, rope scaling, sliding window, vocab size, hidden size. Most users don't need to modify these - they're auto-configured from base model. Modify only if: 1) extending context length (rope scaling), 2) using experimental features, 3) debugging model issues. Incorrect values can break training. Leave default unless you know what you're doing."
    },
    {
        "category": "technical",
        "difficulty": "hard",
        "question": "How do I extend the context length of my model?",
        "reference_answer": "To extend context (e.g., 4K → 32K): 1) Use RoPE scaling (set rope_scaling_factor=8.0 for 8x extension), 2) Increase max_seq_length in training config, 3) Train with long examples (8K-32K tokens), 4) Use YaRN or NTK-aware scaling for better extrapolation. Warning: context extension requires careful tuning and longer training. Quality degrades beyond 2-4x original length without sufficient training data. Use Position Interpolation (PI) for best results. Configure in Training > Model Configuration > Context Extension."
    }
]

def save_baseline_tests():
    """Save baseline tests in multiple formats for easy use"""

    output_dir = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Format 1: ChatML JSONL for model inference
    chatml_file = output_dir / "baseline_test_set_50_chatml.jsonl"
    with open(chatml_file, 'w', encoding='utf-8') as f:
        for i, test in enumerate(BASELINE_TESTS, 1):
            example = {
                "id": f"baseline_test_{i:02d}",
                "category": test["category"],
                "difficulty": test["difficulty"],
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant for FineTune Lab. Provide accurate, detailed information about the platform."
                    },
                    {
                        "role": "user",
                        "content": test["question"]
                    }
                ]
            }
            f.write(json.dumps(example, ensure_ascii=False) + '\n')

    # Format 2: Full test set with reference answers (JSON)
    full_file = output_dir / "baseline_test_set_50_with_answers.json"
    with open(full_file, 'w', encoding='utf-8') as f:
        json.dump({
            "metadata": {
                "total_tests": len(BASELINE_TESTS),
                "categories": {
                    "getting_started": 5,
                    "hardware": 5,
                    "dataset": 5,
                    "training": 10,
                    "troubleshooting": 5,
                    "advanced": 5,
                    "cost": 3,
                    "deployment": 3,
                    "monitoring": 4,
                    "technical": 7
                },
                "difficulty_levels": {
                    "easy": len([t for t in BASELINE_TESTS if t["difficulty"] == "easy"]),
                    "medium": len([t for t in BASELINE_TESTS if t["difficulty"] == "medium"]),
                    "hard": len([t for t in BASELINE_TESTS if t["difficulty"] == "hard"])
                },
                "purpose": "Baseline evaluation comparing base model vs fine-tuned model outputs",
                "usage": "Run inference on both models, compare outputs to reference answers"
            },
            "tests": [
                {
                    "id": f"baseline_test_{i:02d}",
                    **test
                }
                for i, test in enumerate(BASELINE_TESTS, 1)
            ]
        }, f, indent=2, ensure_ascii=False)

    # Format 3: Simple Q&A format (CSV-like)
    simple_file = output_dir / "baseline_test_set_50_simple.txt"
    with open(simple_file, 'w', encoding='utf-8') as f:
        f.write("FINETUNE LAB BASELINE TEST SET - 50 QUESTIONS\n")
        f.write("=" * 80 + "\n\n")

        for i, test in enumerate(BASELINE_TESTS, 1):
            f.write(f"TEST {i:02d} [{test['category']}] [{test['difficulty']}]\n")
            f.write(f"Q: {test['question']}\n")
            f.write(f"A: {test['reference_answer']}\n")
            f.write("\n" + "-" * 80 + "\n\n")

    # Print summary
    print(f"\n{'='*80}")
    print("BASELINE TEST SET GENERATION COMPLETE")
    print(f"{'='*80}\n")

    print(f"📊 Generated 50 baseline tests covering 10 categories\n")

    print("📁 Output Files:")
    print(f"  1. ChatML format (for inference): {chatml_file.name}")
    print(f"     → Use this to run inference on base and fine-tuned models")

    print(f"\n  2. Full test set with answers: {full_file.name}")
    print(f"     → Reference answers for comparison and scoring")

    print(f"\n  3. Simple text format: {simple_file.name}")
    print(f"     → Human-readable version for review\n")

    # Category breakdown
    print("📈 Category Distribution:")
    category_counts = {}
    for test in BASELINE_TESTS:
        cat = test["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    for cat in sorted(category_counts.keys()):
        count = category_counts[cat]
        bar = "█" * count
        print(f"  {cat:20s} [{count:2d}] {bar}")

    # Difficulty breakdown
    print("\n🎯 Difficulty Distribution:")
    difficulty_counts = {}
    for test in BASELINE_TESTS:
        diff = test["difficulty"]
        difficulty_counts[diff] = difficulty_counts.get(diff, 0) + 1

    for diff in ["easy", "medium", "hard"]:
        count = difficulty_counts.get(diff, 0)
        pct = (count / len(BASELINE_TESTS)) * 100
        print(f"  {diff.capitalize():10s} [{count:2d}] {pct:5.1f}%")

    print(f"\n💡 Usage Instructions:")
    print(f"  1. Run inference on base model using ChatML file")
    print(f"  2. Run inference on fine-tuned model using same file")
    print(f"  3. Compare outputs to reference answers")
    print(f"  4. Score on: accuracy, completeness, relevance, specificity")
    print(f"  5. Calculate improvement metrics\n")

    print(f"✨ Baseline tests ready for model evaluation!\n")

if __name__ == "__main__":
    save_baseline_tests()
