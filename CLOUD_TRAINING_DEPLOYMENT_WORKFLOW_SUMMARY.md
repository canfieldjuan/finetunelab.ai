# Cloud Training Deployment Workflow - Quick Reference

**File Location:** `/home/juan-canfield/Desktop/web-ui/CLOUD_TRAINING_DEPLOYMENT_WORKFLOW.md`

## Document Overview

A comprehensive 2000+ line technical documentation of the complete cloud training deployment system, ideal for dataset creation and workflow analysis.

## Key Sections Documented

### 1. **Architecture** (High-level system design)
- Frontend UI → API Routes → Cloud Providers → Infrastructure
- Core components (RunPodService, Script Generator, Metrics, Predictions, Database)

### 2. **Deployment Providers**
- **RunPod** (Primary) - Serverless GPU pods
- **Kaggle Notebooks** - Kernel-based training
- **Lambda Labs** - Traditional GPU instances
- **HuggingFace Spaces** - Containerized deployment
- **Local vLLM & Ollama** - Local inference servers

### 3. **Complete 5-Phase Workflow**

**Phase 1: Configuration Setup**
- Model selection, dataset upload, hyperparameter configuration
- Predictions settings, configuration saving

**Phase 2: Deployment Initiation**
- Provider selection, credential validation
- Configuration retrieval, deployment request

**Phase 3: Script Generation & Execution**
- Python training script generation (embedded in Bash)
- Model/dataset loading, callback setup
- Training loop with metrics collection
- Checkpoint management, error handling

**Phase 4: Real-Time Monitoring**
- Status polling (every 5-10 seconds)
- Metrics collection to database
- Predictions tracking
- Cost monitoring

**Phase 5: Training Completion**
- Pod termination and billing end
- Model artifact retrieval
- Registry entry creation
- Inference server integration

### 4. **API Endpoints** (Complete reference)
- `/api/training/deploy/runpod` (POST/GET)
- `/api/training/deploy/kaggle` (POST)
- `/api/training/deploy/hf-spaces` (POST)
- `/api/training/metrics/{job_id}` (GET)
- `/api/training/predictions/{job_id}` (GET)

### 5. **Configuration System**
- TrainingConfig type definition with all fields
- Model, dataset, training method, LoRA, quantization configs
- Predictions configuration structure
- Default configurations for small and large models

### 6. **Data Flow Diagrams**
- Request → Database flow with detailed steps
- Metrics recording process
- Predictions recording with timestamps

### 7. **Error Handling**
- Configuration errors (invalid GPU type, model not found, budget exceeded)
- Deployment errors (pod crashes, metric reporting failures)
- Database errors with fallback mechanisms
- Recovery strategies

### 8. **Monitoring & Metrics**
- Real-time dashboard metrics
- Training metrics (loss, learning rate, speed)
- System metrics (GPU memory, utilization, temperature)
- Cost metrics (hourly rate, total, budget remaining)
- Prediction metrics (generation count, quality scores)

### 9. **Integration Points**
- Frontend component integration with API calls
- Database schema (training_configs, training_jobs, training_metrics, training_predictions)
- Secrets management (RunPod, HuggingFace, Kaggle tokens)
- Supabase real-time subscriptions
- Inference server post-training deployment

### 10. **Dataset Format Requirements**
- JSONL format (standard text)
- Chat format (multi-turn conversations)
- Instruction-following format
- DPO format (preference learning)

## Data Structure Examples

### TrainingConfig
```typescript
{
  model: "Qwen/Qwen2.5-7B",
  training: {
    method: "sft",
    num_epochs: 3,
    learning_rate: 5e-4,
    lora_r: 16,
    lora_alpha: 32
  },
  predictions: {
    enabled: true,
    sample_count: 5,
    sample_frequency: "epoch"
  }
}
```

### DeploymentResponse
```json
{
  "deployment_id": "pod_abc123",
  "pod_id": "pod_abc123",
  "status": "running",
  "gpu_type": "NVIDIA_RTX_A4000",
  "cost": {
    "estimated_cost": 12.50,
    "cost_per_hour": 0.89
  }
}
```

### Training Metrics Record
```json
{
  "job_id": "job_abc123",
  "step": 100,
  "epoch": 1,
  "loss": 1.234,
  "eval_loss": 1.456,
  "learning_rate": 5e-5,
  "gpu_memory_mb": 12345
}
```

### Predictions Record
```json
{
  "job_id": "job_abc123",
  "epoch": 1,
  "step": 100,
  "sample_id": "sample_1",
  "prompt": "What is AI?",
  "generated": "AI is a field of computer science...",
  "bleu_score": 0.45,
  "rouge_score": 0.52
}
```

## GPU Options Reference

| GPU Type | VRAM | Hourly Cost | Best For |
|----------|------|------------|----------|
| RTX 4090 | 24GB | ~$0.29 | Small models |
| RTX A4000 | 24GB | ~$0.35 | Standard fine-tuning |
| A100 40GB | 40GB | $0.89 | Large models |
| A100 80GB | 80GB | $1.29 | Very large models |
| H100 | 80GB | $1.89 | Cutting edge models |

## Database Tables

- `training_configs` - User configurations
- `training_jobs` - Active/completed jobs with pod_id, status, cost
- `training_metrics` - Time-series metrics (loss, lr, speed, gpu_memory)
- `training_predictions` - Generated predictions with scores
- `training_errors` - Error logs from failed jobs
- `llm_models` - Trained model registry

## Key Files Referenced

- `/lib/training/runpod-service.ts` - Core deployment logic
- `/app/api/training/deploy/runpod/route.ts` - RunPod API endpoint
- `/lib/training/training-config.types.ts` - Type definitions
- `/lib/training/deployment.types.ts` - Provider-specific types
- `/lib/training/predictions_callback.py` - Predictions collection

## Use Cases for This Documentation

✅ Creating ML training datasets  
✅ Analyzing deployment workflows  
✅ Integration planning  
✅ API documentation  
✅ Database schema understanding  
✅ System architecture documentation  
✅ Error handling patterns reference  
✅ Cost estimation workflows  

---

**Document Status:** Complete  
**Length:** 2000+ lines  
**Format:** Markdown with code examples  
**Ready for:** Dataset creation, analysis, integration planning
