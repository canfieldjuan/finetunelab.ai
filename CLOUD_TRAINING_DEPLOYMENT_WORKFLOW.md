# Cloud Training Deployment Workflow - Complete Documentation

**Date:** December 1, 2025  
**Version:** 1.0  
**Purpose:** Comprehensive documentation of the cloud training deployment system for dataset creation and workflow analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Deployment Providers](#deployment-providers)
4. [Complete Workflow](#complete-workflow)
5. [API Endpoints](#api-endpoints)
6. [Configuration System](#configuration-system)
7. [Data Flow](#data-flow)
8. [Error Handling](#error-handling)
9. [Monitoring & Metrics](#monitoring--metrics)
10. [Integration Points](#integration-points)

---

## Overview

### Purpose

The cloud training deployment system enables users to deploy machine learning model fine-tuning jobs to cloud GPU infrastructure without requiring local GPU hardware.

### Supported Platforms

- **RunPod** - Serverless GPU provider (primary)
- **Kaggle Notebooks** - Kaggle Kernel-based training
- **Lambda Labs** - Traditional GPU instances with SSH access
- **HuggingFace Spaces** - Containerized deployment environment
- **Local vLLM** - Local GPU inference server
- **Local Ollama** - Local quantized model serving

### Key Features

- Budget controls and cost monitoring
- Real-time metrics streaming
- Predictions generation during training
- Automatic model deployment post-training
- Multi-provider support with unified interface
- Checkpoint management and model versioning
- Integration with Supabase for job tracking

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     Web UI Frontend                             │
│  (Training Config → Model Selection → Dataset Upload)           │
└────────────────────┬────────────────────────────────────────────┘
                     │ API Requests
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│               Next.js API Route Handlers                         │
│  (/api/training/deploy/runpod, /kaggle, /hf-spaces)            │
└────────────────────┬────────────────────────────────────────────┘
                     │
      ┌──────────────┼──────────────┐
      │              │              │
      ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐
│   RunPod     ││   Kaggle     ││ HF Spaces    │
│  Service     ││  Service     ││  Service     │
└──────┬───────┘└──────┬───────┘└──────┬───────┘
       │               │               │
       ▼               ▼               ▼
┌──────────────────────────────────────────────┐
│    Cloud GPU Infrastructure                   │
│  (Generates Python Training Script)          │
└──────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│    Supabase Database                          │
│  (Job Status, Metrics, Predictions)          │
└──────────────────────────────────────────────┘
```

### Core Components

#### 1. **RunPodService** (`lib/training/runpod-service.ts`)

- **Responsibility:** Interface with RunPod API for GPU pod provisioning
- **Key Methods:**
  - `generateTrainingScript()` - Creates Python training script
  - `deployToRunPod()` - Provisions GPU pod and starts training
  - `getDeploymentStatus()` - Queries pod status and metrics
  - `mapPodStatus()` - Translates RunPod status → unified status

#### 2. **Training Script Generator**

- **Output:** Bash script containing:
  - Environment setup (Python, CUDA, PyTorch)
  - Dataset loading from Hugging Face
  - Model initialization with quantization (QLoRA)
  - Training loop with metrics collection
  - Predictions generation (if enabled)
  - Model checkpoint saving
  - Metrics reporting to Supabase

#### 3. **Metrics Collection System**

- **TrainingMetricsCallback** - Captures training events
- **Metrics Tracked:**
  - Loss (training, validation)
  - Learning rate
  - Batch statistics
  - GPU memory usage
  - Training speed (samples/sec)
  - Epoch progress

#### 4. **Predictions System**

- **PredictionsCallback** - Generates predictions during training
- **Components:**
  - `PredictionsSampler` - Loads evaluation samples from JSONL
  - `PredictionsGenerator` - Runs model inference
  - `PredictionsWriter` - Persists predictions to database

#### 5. **Database Layer** (Supabase)

- **Tables:**
  - `training_jobs` - Job configurations and metadata
  - `training_metrics` - Time-series training metrics
  - `training_predictions` - Model predictions during training
  - `llm_models` - Trained model registry

---

## Deployment Providers

### 1. RunPod (Primary Provider)

#### Request Structure

```typescript
interface RunPodDeploymentRequest {
  training_config_id: string;      // Configuration identifier
  gpu_type?: RunPodGPUType;        // 'NVIDIA RTX A4000', 'A100 40GB', etc.
  gpu_count?: number;               // Default: 1
  docker_image?: string;            // Custom image (optional)
  volume_size_gb?: number;          // Persistent storage (default: 20)
  environment_variables?: Record<string, string>;
  budget_limit?: number;            // USD (auto-stops when exceeded)
}
```

#### Response Structure

```typescript
interface RunPodDeploymentResponse {
  deployment_id: string;            // Pod ID
  pod_id: string;                   // RunPod pod identifier
  pod_url: string;                  // Direct pod access URL
  status: DeploymentStatus;         // 'queued', 'running', 'completed'
  gpu_type: RunPodGPUType;
  gpu_count: number;
  cost: DeploymentCost;             // Cost tracking object
  created_at: string;               // ISO timestamp
}
```

#### GPU Options

| GPU Type | VRAM | Hourly Cost | Best For |
|----------|------|------------|----------|
| RTX 4090 | 24GB | ~$0.29 | Small models, quick iteration |
| RTX A4000 | 24GB | ~$0.35 | Standard fine-tuning |
| RTX A5000 | 24GB | ~$0.45 | Multi-GPU training |
| A100 40GB | 40GB | $0.89 | Large models |
| A100 80GB | 80GB | $1.29 | Very large models, multi-GPU |
| H100 | 80GB | $1.89 | Cutting edge, parallel training |

#### Workflow Steps

**Step 1: Validation**

- Verify training config exists and is valid
- Check RunPod API key is configured
- Validate GPU availability

**Step 2: Script Generation**

- Generate Python training script with all configuration
- Embed model, dataset, and training parameters
- Include predictions modules if enabled
- Create bash wrapper for error handling

**Step 3: Pod Provisioning**

- Call RunPod API with Docker image and script
- Set environment variables (HF token, Supabase credentials)
- Configure persistent volume for model checkpoints
- Set budget limits for auto-termination

**Step 4: Monitoring**

- Poll RunPod API for pod status every 5-10 seconds
- Stream logs from pod
- Collect metrics from Supabase
- Track cost in real-time

**Step 5: Completion**

- Download trained model artifacts
- Update job status in database
- Stop pod (auto-billed by RunPod)
- Generate inference server link

### 2. Kaggle Notebooks

#### Request Structure

```typescript
interface KaggleDeploymentRequest {
  training_config_id: string;
  notebook_title: string;
  is_private?: boolean;            // Private vs public notebook
  dataset_sources?: string[];       // Kaggle dataset slugs
  enable_gpu?: boolean;
  enable_internet?: boolean;        // For HF model downloads
}
```

#### Workflow

1. Create Kaggle notebook from template
2. Upload training script as code cell
3. Attach datasets from Kaggle/external sources
4. Enable GPU acceleration
5. Queue for execution
6. Stream output and metrics

### 3. HuggingFace Spaces

#### Request Structure

```typescript
interface HFSpacesDeploymentRequest {
  training_config_id: string;
  space_name: string;              // Format: username/space-name
  visibility?: 'public' | 'private';
  gpu_tier?: HFSpaceGPUTier;       // 't4-small' to 'a100-large'
  budget_limit?: number;
  alert_threshold?: number;        // Budget alert at % usage
  notify_email?: string;
  auto_stop_on_budget?: boolean;
}
```

#### Advantages

- Free tier available (CPU-based)
- Easy sharing and collaboration
- Built-in version control (Git)
- Persistent storage
- One-click redeploy

---

## Complete Workflow

### Phase 1: Configuration Setup (User Interface)

#### Step 1.1: Model Selection

- User selects base model from Hugging Face Hub
- System validates model availability
- Downloads model config and tokenizer

#### Step 1.2: Dataset Configuration

- User uploads training dataset (JSONL format)
- System validates format and content
- Stores in `/lib/training/datasets/{config_id}/`
- Generates dataset statistics

#### Step 1.3: Training Configuration

User configures:

- **Training Method:** SFT, DPO, ORPO, or RL-HF
- **Hyperparameters:**
  - Learning rate (typical: 1e-4 to 5e-4)
  - Batch size (depends on GPU VRAM)
  - Number of epochs
  - Warmup steps
  - Weight decay

- **LoRA Settings:**
  - LoRA rank (r: 8-64)
  - LoRA alpha (typical: 2x r)
  - Target modules (varies by architecture)
  - LoRA dropout

- **Quantization (QLoRA):**
  - 4-bit vs 8-bit
  - NF4 vs FP4 quantization type
  - Compute dtype

- **Advanced Options:**
  - Gradient checkpointing
  - Mixed precision training (BF16, FP16)
  - Optimizer (AdamW, paged AdamW)
  - Predictions settings

#### Step 1.4: Predictions Configuration (Optional)

```typescript
interface PredictionsConfig {
  enabled: boolean;
  sample_count: number;           // Samples to generate predictions for
  sample_frequency: 'epoch' | 'eval' | 'steps';
  step_interval?: number;         // For 'steps' frequency
  max_new_tokens?: number;        // Generation length
  temperature?: number;
  top_p?: number;
}
```

#### Step 1.5: Review and Save Configuration

- Configuration stored in Supabase `training_configs` table
- Returns `training_config_id` for later deployment

---

### Phase 2: Deployment Initiation

#### Step 2.1: User Selects Cloud Provider

- Chooses between RunPod, Kaggle, HF Spaces
- System validates provider credentials (API keys)
- Checks provider availability and quotas

#### Step 2.2: Fetch Configuration

```http
GET /api/training/configurations/{config_id}
```

Retrieves:

- Model name and parameters
- Dataset location
- Training hyperparameters
- Predictions config
- Advanced settings

#### Step 2.3: Initiate Deployment

```http
POST /api/training/deploy/runpod
Content-Type: application/json
Authorization: Bearer {auth_token}

{
  "training_config_id": "cfg_abc123",
  "gpu_type": "NVIDIA_A100_80GB",
  "gpu_count": 1,
  "volume_size_gb": 50,
  "budget_limit": 100
}
```

---

### Phase 3: Script Generation and Execution

#### Step 3.1: Generate Training Script

**Location:** `lib/training/runpod-service.ts` → `generateTrainingScript()`

The system creates a Bash script that:

1. **Sets up environment**

   ```bash
   set -uo pipefail
   source activate_venv.sh
   export CUDA_VISIBLE_DEVICES=0
   ```

2. **Creates Python training script** (written to `/workspace/train.py`)

   ```python
   # Imports and configuration
   import torch
   from transformers import AutoModelForCausalLM, AutoTokenizer
   from peft import LoraConfig, get_peft_model
   from trl import SFTTrainer, SFTConfig
   
   # Model loading
   model = AutoModelForCausalLM.from_pretrained(
       model_name,
       torch_dtype=torch.bfloat16,
       device_map="auto",
       quantization_config=bnb_config  # If QLoRA enabled
   )
   
   # LoRA setup
   lora_config = LoraConfig(
       r=16,
       lora_alpha=32,
       target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
       lora_dropout=0.1,
       bias="none"
   )
   model = get_peft_model(model, lora_config)
   
   # Dataset loading
   dataset = load_dataset("json", data_files="dataset.jsonl", split="train")
   
   # Training
   trainer = SFTTrainer(
       model=model,
       args=training_args,
       train_dataset=dataset,
       data_collator=data_collator,
       callbacks=[metrics_callback, predictions_callback],
       peft_config=lora_config
   )
   trainer.train()
   ```

3. **Handles predictions** (if enabled)
   - Loads sample evaluation data
   - Generates predictions at specified frequency
   - Saves predictions to Supabase

4. **Collects metrics**
   - Logs training loss every N steps
   - Tracks evaluation metrics
   - Reports to Supabase `/api/training/metrics`

5. **Saves checkpoints**
   - Saves final model to `/workspace/fine_tuned_model/`
   - Saves adapter weights separately
   - Stores metadata (config, vocab, etc.)

6. **Handles errors**

   ```bash
   if python train.py 2>&1 | tee training_output.log; then
       echo "Training completed successfully"
   else
       echo "Training failed with exit code: $?"
   fi
   ```

#### Step 3.2: Deploy to RunPod

**API Call:**

```javascript
const response = await runpodApi({
  method: 'POST',
  endpoint: '/graphql',
  input: {
    query: `mutation {
      podFindAndDeployOnDemand(
        input: {
          cloudType: COMMUNITY
          gpuCount: 1
          volumeSize: 50
          containerDiskSize: 10
          minVolumeSize: 50
          gpuTypeId: "${gpuTypeId}"
          name: "${podName}"
          imageName: "runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel"
          dockerArgs: "bash -c '${trainingScript}'"
          env: [
            { key: "HF_TOKEN", value: "${huggingFaceToken}" },
            { key: "SUPABASE_URL", value: "${supabaseUrl}" },
            { key: "SUPABASE_SERVICE_KEY", value: "${supabaseKey}" },
            { key: "JOB_ID", value: "${jobId}" }
          ]
          minBidPrice: 0.25
          maxCost: ${budgetLimit}
        }
      ) {
        pod {
          id
          desiredStatus
          costPerHr
        }
      }
    }`
  }
});
```

---

### Phase 4: Real-Time Monitoring

#### Step 4.1: Status Polling

```http
GET /api/training/deploy/runpod?pod_id={podId}
```

Returns:

```json
{
  "deployment_id": "pod_abc123",
  "pod_id": "pod_abc123",
  "status": "running",
  "pod_url": "https://pod-abc123.runpod.io",
  "logs": "Training started...",
  "metrics": {
    "epoch": 1,
    "step": 100,
    "loss": 1.234,
    "learning_rate": 5e-5,
    "progress_percentage": 25
  },
  "cost": {
    "estimated_cost": 12.50,
    "cost_per_hour": 0.89,
    "actual_cost": null
  }
}
```

#### Step 4.2: Metrics Collection

**Database:** Supabase `training_metrics` table

Records every N steps:

- Epoch number
- Training loss
- Validation loss
- Learning rate
- Gradient norm
- GPU memory usage
- Training speed

#### Step 4.3: Predictions Monitoring

**Database:** Supabase `training_predictions` table

If predictions enabled, stores:

- Epoch number
- Step number
- Sample ID
- Input prompt
- Model-generated output
- Ground truth (if available)
- Metrics (BLEU, ROUGE, etc.)

---

### Phase 5: Training Completion

#### Step 5.1: Pod Termination

When training completes:

1. RunPod pod is stopped
2. Billing ceases
3. Logs are archived
4. Job status updated to 'completed'

#### Step 5.2: Model Artifact Retrieval

System downloads:

- `pytorch_model.bin` (or safetensors)
- `adapter_config.json`
- `adapter_model.bin` (LoRA weights)
- `config.json` (model config)
- `tokenizer.json` (or tokenizer.model)
- `training_args.json`

**Storage Location:** `/lib/training/logs/job_{job_id}/`

#### Step 5.3: Model Registry Entry

Creates entry in `llm_models` table:

```json
{
  "id": "model_abc123",
  "user_id": "user_123",
  "name": "Qwen2.5-7B-fine-tuned",
  "model_type": "causal_lm",
  "source": "training_job",
  "source_job_id": "job_abc123",
  "base_model": "Qwen/Qwen2.5-7B",
  "adapters": {
    "lora": {
      "path": "/workspace/fine_tuned_model/",
      "r": 16,
      "alpha": 32
    }
  },
  "created_at": "2025-12-01T...",
  "metadata": {
    "training_method": "sft",
    "final_loss": 0.456,
    "training_time_hours": 2.5,
    "dataset_size": 1000,
    "total_cost_usd": 2.23
  }
}
```

---

## API Endpoints

### Training Deployment Endpoints

#### 1. Deploy to RunPod

```http
POST /api/training/deploy/runpod
```

- **Authentication:** Bearer token required
- **Body:** RunPodDeploymentRequest
- **Response:** RunPodDeploymentResponse

#### 2. Get RunPod Status

```http
GET /api/training/deploy/runpod?pod_id={podId}
```

- **Response:** RunPodDeploymentStatus

#### 3. Deploy to Kaggle

```http
POST /api/training/deploy/kaggle
```

- **Body:** KaggleDeploymentRequest
- **Response:** KaggleDeploymentResponse

#### 4. Deploy to HF Spaces

```http
POST /api/training/deploy/hf-spaces
```

- **Body:** HFSpacesDeploymentRequest
- **Response:** HFSpacesDeploymentResponse

### Metrics Endpoints

#### 5. Get Training Metrics

```http
GET /api/training/metrics/{job_id}
```

Query parameters:

- `epoch` (optional)
- `limit` (default: 100)
- `offset` (default: 0)

Response:

```json
{
  "total_count": 500,
  "metrics": [
    {
      "step": 100,
      "epoch": 1,
      "loss": 1.234,
      "learning_rate": 5e-5,
      "timestamp": "2025-12-01T10:30:00Z"
    }
  ]
}
```

### Predictions Endpoints

#### 6. Get Training Predictions

```http
GET /api/training/predictions/{job_id}
```

Query parameters:

- `epoch` (optional)
- `limit` (default: 50)

Response:

```json
{
  "predictions": [
    {
      "sample_id": "sample_1",
      "epoch": 1,
      "step": 100,
      "prompt": "What is AI?",
      "generated": "AI is a branch of computer science...",
      "expected": "AI stands for Artificial Intelligence...",
      "metrics": {
        "bleu": 0.45,
        "rouge_l": 0.52
      }
    }
  ]
}
```

---

## Configuration System

### TrainingConfig Type Definition

```typescript
interface TrainingConfig {
  // Metadata
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;

  // Model Configuration
  model: {
    name: string;                    // HF model ID
    device_map: 'auto' | 'cuda' | 'cpu';
    torch_dtype: 'float16' | 'float32' | 'bfloat16';
  };

  // Dataset Configuration
  data: {
    train_path: string;              // Dataset location
    eval_split: number;              // Validation split %
    max_samples?: number;
  };

  // Training Method
  training: {
    method: 'sft' | 'dpo' | 'orpo' | 'rlhf';
    num_epochs: number;
    learning_rate: number;
    batch_size: number;
    gradient_accumulation_steps: number;
    max_steps?: number;
    warmup_steps: number;
    weight_decay: number;

    // Optimizer
    optim: 'adamw_torch' | 'paged_adamw_32bit' | 'sgd';
    gradient_checkpointing: boolean;
    bf16: boolean;                   // bfloat16 training
    fp16: boolean;                   // float16 training

    // LoRA
    lora_r: number;
    lora_alpha: number;
    lora_dropout: number;
    lora_config: LoRAConfig;

    // Quantization
    quantization: QuantizationConfig;
  };

  // Predictions (Optional)
  predictions: {
    enabled: boolean;
    sample_count: number;
    sample_frequency: 'epoch' | 'eval' | 'steps';
    step_interval?: number;
    max_new_tokens?: number;
    temperature?: number;
    top_p?: number;
  };
}
```

### Default Configurations

#### Configuration: Small Model Fine-Tuning

```json
{
  "name": "Qwen2.5-0.5B-fine-tune",
  "model": "Qwen/Qwen2.5-0.5B",
  "training": {
    "method": "sft",
    "num_epochs": 3,
    "learning_rate": 5e-4,
    "batch_size": 32,
    "gradient_accumulation_steps": 1,
    "lora_r": 8,
    "lora_alpha": 16
  },
  "predictions": {
    "enabled": true,
    "sample_count": 5,
    "sample_frequency": "epoch"
  }
}
```

#### Configuration: Large Model Fine-Tuning (QLoRA)

```json
{
  "name": "Llama-2-70B-fine-tune",
  "model": "meta-llama/Llama-2-70b-hf",
  "training": {
    "method": "sft",
    "num_epochs": 2,
    "learning_rate": 2e-4,
    "batch_size": 4,
    "gradient_accumulation_steps": 4,
    "lora_r": 64,
    "lora_alpha": 128,
    "quantization": {
      "load_in_4bit": true,
      "bnb_4bit_quant_type": "nf4"
    }
  },
  "predictions": {
    "enabled": true,
    "sample_count": 10,
    "sample_frequency": "eval"
  }
}
```

---

## Data Flow

### Request → Database Flow Diagram

```
1. Frontend POST /api/training/deploy/runpod
   ↓
2. API Handler validates request
   ↓
3. Fetch training_config from database
   ↓
4. Generate Python training script
   ↓
5. Call RunPod API to provision pod
   ↓
6. Update training_jobs table with pod_id
   │
   ├→ status: 'queued' → 'creating' → 'running'
   │
7. Python script executes on pod
   │
   ├→ Load model and dataset
   ├→ Setup callbacks (metrics, predictions)
   ├→ Train model
   │
8. During training:
   ├→ Every N steps: INSERT training_metrics
   ├→ Every epoch: INSERT training_predictions (if enabled)
   ├→ Errors: INSERT training_errors
   │
9. Training completes
   ├→ Download artifacts
   ├→ INSERT llm_models entry
   ├→ UPDATE training_jobs status='completed'
   │
10. Frontend polls for status → displays results
```

### Metrics Recording

**Interval:** Every 10-50 steps (configurable)

**Table:** `training_metrics`

```sql
INSERT INTO training_metrics (
  job_id,
  step,
  epoch,
  loss,
  eval_loss,
  learning_rate,
  gradient_norm,
  gpu_memory_mb,
  samples_per_sec,
  timestamp
) VALUES (
  'job_abc123',
  100,
  1,
  1.234,
  1.456,
  5e-5,
  0.234,
  12345,
  128.5,
  NOW()
);
```

### Predictions Recording

**Interval:** Based on `predictions.sample_frequency`

**Table:** `training_predictions`

```sql
INSERT INTO training_predictions (
  job_id,
  epoch,
  step,
  sample_id,
  prompt,
  generated_text,
  expected_text,
  bleu_score,
  rouge_score,
  timestamp
) VALUES (
  'job_abc123',
  1,
  100,
  'sample_1',
  'What is...',
  'AI is a field...',
  'Artificial Intelligence is...',
  0.45,
  0.52,
  NOW()
);
```

---

## Error Handling

### Error Categories and Recovery

#### 1. **Configuration Errors**

| Error | Cause | Recovery |
|-------|-------|----------|
| Invalid GPU type | Typo in GPU selection | Validate against RunPod API GPUs |
| Model not found | HF model ID doesn't exist | Check model name, verify access |
| Dataset too large | VRAM insufficient for batch | Reduce batch size, increase accumulation |
| Budget exceeded | Cost limit set too low | Increase budget or use cheaper GPU |

#### 2. **Deployment Errors**

```python
# Error in training script
try:
    trainer.train()
except Exception as e:
    logger.error(f"Training failed: {e}")
    
    # Insert error record
    supabase.table('training_errors').insert({
        'job_id': JOB_ID,
        'error_type': type(e).__name__,
        'error_message': str(e),
        'traceback': traceback.format_exc(),
        'timestamp': datetime.now().isoformat()
    })
    
    # Update job status
    supabase.table('training_jobs').update({
        'status': 'failed',
        'error_message': str(e)
    }).eq('id', JOB_ID).execute()
    
    raise  # Re-raise for RunPod exit code
```

#### 3. **Pod Lifecycle Errors**

**Pod fails to start:**

- Check Docker image availability
- Verify RunPod API key permissions
- Check volume size requirements
- Ensure budget is sufficient

**Pod crashes mid-training:**

- Check GPU memory (OOM)
- Verify CUDA version compatibility
- Check dataset corruption
- Review system logs

**Pod doesn't report metrics:**

- Verify Supabase credentials in environment
- Check network connectivity
- Verify table schemas exist
- Check API rate limits

#### 4. **Database Errors**

```typescript
async function insertMetrics(metrics: TrainingMetrics) {
  try {
    const { error } = await supabase
      .from('training_metrics')
      .insert(metrics);
    
    if (error) {
      console.error('Metrics insertion failed:', error);
      
      // Fallback: log to file
      fs.appendFileSync(
        'metrics_fallback.jsonl',
        JSON.stringify(metrics) + '\n'
      );
    }
  } catch (err) {
    console.error('Database connection error:', err);
    // Retry with exponential backoff
    setTimeout(() => insertMetrics(metrics), Math.random() * 10000);
  }
}
```

---

## Monitoring & Metrics

### Real-Time Monitoring Dashboard

**Endpoint:** `/api/training/deploy/runpod?pod_id={podId}`

**Polled Frequency:** Every 5-10 seconds

**Displayed Metrics:**

```
┌─────────────────────────────────────────┐
│ Training Status Dashboard                │
├─────────────────────────────────────────┤
│ Status: RUNNING                          │
│ Pod: pod_abc123 (RTX A4000)             │
│                                          │
│ Progress: ████████░░ 80%                │
│ Epoch: 2/3  Step: 400/500               │
│                                          │
│ Loss: 0.456 (↓ -0.123)                  │
│ Eval Loss: 0.523                        │
│ Learning Rate: 5.0e-5                   │
│                                          │
│ Training Speed: 128.5 samples/sec       │
│ GPU Memory: 12.3 GB / 24 GB (51%)       │
│ Cost: $2.34 / Budget: $50.00            │
│                                          │
│ Predictions Generated: 10                │
│ Last Prediction: 2m ago                 │
└─────────────────────────────────────────┘
```

### Metrics Types

#### Training Metrics

- **Loss:** Training and validation loss curves
- **Learning Rate:** Effective learning rate schedule
- **Speed:** Samples processed per second
- **Gradient Stats:** Gradient norm and clipping

#### System Metrics

- **GPU Memory:** VRAM usage over time
- **GPU Utilization:** Percentage of GPU compute used
- **CPU Usage:** CPU percentage
- **Temperature:** GPU temperature (if available)

#### Cost Metrics

- **Hourly Cost:** Current GPU hourly rate
- **Estimated Total:** Projected cost at current speed
- **Actual Cost:** Amount charged so far
- **Budget Remaining:** Budget - Actual cost

#### Prediction Metrics

- **Generation Count:** Total predictions generated
- **Generation Speed:** Predictions per epoch
- **Quality Metrics:** BLEU, ROUGE, BERTScore (if computed)

---

## Integration Points

### 1. Frontend Integration

**Components:**

- `TrainingConfigEditor` - Configure training parameters
- `DatasetUploader` - Upload JSONL training data
- `DeploymentModal` - Select provider and initiate deployment
- `TrainingMonitor` - Real-time status and metrics display

**API Calls:**

```typescript
// 1. Save configuration
await fetch('/api/training/configurations', {
  method: 'POST',
  body: JSON.stringify(trainingConfig),
  headers: { 'Authorization': `Bearer ${token}` }
});

// 2. Deploy to RunPod
await fetch('/api/training/deploy/runpod', {
  method: 'POST',
  body: JSON.stringify({
    training_config_id: configId,
    gpu_type: 'NVIDIA_RTX_A4000',
    budget_limit: 50
  }),
  headers: { 'Authorization': `Bearer ${token}` }
});

// 3. Poll for status
const status = await fetch(`/api/training/deploy/runpod?pod_id=${podId}`)
  .then(r => r.json());

// 4. Fetch metrics
const metrics = await fetch(`/api/training/metrics/${jobId}?limit=100`)
  .then(r => r.json());

// 5. Fetch predictions
const predictions = await fetch(`/api/training/predictions/${jobId}`)
  .then(r => r.json());
```

### 2. Database Schema Integration

**Tables Created:**

- `training_configs` - User training configurations
- `training_jobs` - Active/completed training jobs
- `training_metrics` - Time-series training metrics
- `training_predictions` - Generated predictions during training
- `training_errors` - Error logs from failed jobs
- `llm_models` - Registry of trained and base models

**Schema Example:**

```sql
-- training_jobs table
CREATE TABLE training_jobs (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES auth.users,
  training_config_id VARCHAR,
  pod_id VARCHAR,  -- RunPod pod identifier
  status VARCHAR,  -- 'queued', 'running', 'completed', 'failed'
  model_name VARCHAR,
  dataset_size INT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  final_loss FLOAT,
  total_cost_usd FLOAT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- training_metrics table
CREATE TABLE training_metrics (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR REFERENCES training_jobs,
  step INT,
  epoch INT,
  loss FLOAT,
  eval_loss FLOAT,
  learning_rate FLOAT,
  gpu_memory_mb INT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- training_predictions table
CREATE TABLE training_predictions (
  id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR REFERENCES training_jobs,
  epoch INT,
  step INT,
  sample_id VARCHAR,
  prompt TEXT,
  generated_text TEXT,
  expected_text TEXT,
  bleu_score FLOAT,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### 3. Secrets Management Integration

**Secrets Required:**

- `runpod` - RunPod API key
- `huggingface` - HuggingFace API token
- `kaggle` - Kaggle credentials (username, API key)
- `openai` - OpenAI API key (for RLHF with preference labels)

**Usage:**

```typescript
const runpodSecret = await secretsManager.getSecret(userId, 'runpod', supabase);
const runpodApiKey = decrypt(runpodSecret.api_key_encrypted);

// Pass to RunPod API call
const response = await runpodApi({
  apiKey: runpodApiKey,
  // ...
});
```

### 4. Supabase Real-Time Integration

**Subscribed Channels:**

```typescript
// Subscribe to job status updates
supabase
  .channel(`training-job-${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'training_jobs',
      filter: `id=eq.${jobId}`
    },
    (payload) => {
      console.log('Job updated:', payload.new);
      updateUI(payload.new);
    }
  )
  .subscribe();

// Subscribe to metrics updates
supabase
  .channel(`training-metrics-${jobId}`)
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'training_metrics',
      filter: `job_id=eq.${jobId}`
    },
    (payload) => {
      console.log('New metrics:', payload.new);
      updateMetricsChart(payload.new);
    }
  )
  .subscribe();
```

### 5. Inference Server Integration

**Post-Training Deployment:**

```typescript
// After training completes
const model = {
  job_id: jobId,
  server_type: 'vllm',  // or 'ollama', 'runpod'
  checkpoint_path: '/workspace/fine_tuned_model',
  name: `${baseModel}-finetuned`,
  config: {
    gpu_memory_utilization: 0.8,
    max_model_len: 4096
  }
};

// Deploy trained model
await fetch('/api/training/deploy', {
  method: 'POST',
  body: JSON.stringify(model),
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Dataset Format Requirements

### JSONL Format (Standard)

```jsonl
{"text": "Question: What is AI?\nAnswer: AI is a field of computer science..."}
{"text": "Question: How does neural networks work?\nAnswer: Neural networks are inspired by..."}
{"text": "text": "Detailed prompt about something..."}
```

### Chat Format

```jsonl
{"messages": [{"role": "user", "content": "What is AI?"}, {"role": "assistant", "content": "AI is..."}]}
{"messages": [{"role": "user", "content": "How does...?"}, {"role": "assistant", "content": "..."}]}
```

### Instruction-Following Format

```jsonl
{"instruction": "Explain AI", "input": "In simple terms", "output": "AI is a field..."}
{"instruction": "Translate", "input": "Hello world", "output": "Hola mundo"}
```

### DPO Format (Preference Learning)

```jsonl
{"prompt": "What is AI?", "chosen": "AI is a field of...", "rejected": "AI is just robots..."}
{"prompt": "Translate English to Spanish", "chosen": "Hola", "rejected": "Bonjour"}
```

---

## Summary

This cloud training deployment system provides:

✅ **Multi-Provider Support** - RunPod, Kaggle, HF Spaces, Lambda Labs  
✅ **Real-Time Monitoring** - Live metrics, cost tracking, predictions  
✅ **Automatic Infrastructure** - GPU provisioning, environment setup, cleanup  
✅ **Scalability** - From small models to 70B+ parameter models  
✅ **Cost Control** - Budget limits, auto-shutdown, transparent pricing  
✅ **Integration Ready** - Supabase, HuggingFace Hub, Secrets Manager  
✅ **Production Grade** - Error handling, logging, retries, fallbacks  

**Key Files:**

- `/lib/training/runpod-service.ts` - Core deployment logic
- `/app/api/training/deploy/runpod/route.ts` - RunPod API endpoint
- `/lib/training/training-config.types.ts` - Type definitions
- `/lib/training/deployment.types.ts` - Provider-specific types
- `/lib/training/predictions_callback.py` - Predictions collection

---

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Suitable for:** Dataset creation, workflow analysis, integration planning
