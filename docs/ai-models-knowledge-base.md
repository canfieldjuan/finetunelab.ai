# Fine-Tune Lab Complete Knowledge Base for Graph RAG

**Document Type:** Comprehensive Knowledge Base  
**Target System:** Graphiti + Neo4j Graph RAG  
**Last Updated:** December 3, 2025  
**Coverage:** All documentation pages (8 complete sections)

---

# AI Models Knowledge Base for Fine-Tune Lab

## Overview


Fine-Tune Lab supports multiple AI model providers through a unified API. This document contains comprehensive information about all supported models, their capabilities, pricing, and use cases.

## Model Selection Guidelines


### Speed-Optimized Models


For applications requiring fast response times:

- Claude Haiku 4.5
- GPT-5 Mini

- GPT-4.1 Mini


### Cost-Optimized Models

For budget-conscious applications:


- GPT-4.1 Mini

- GPT-5 Mini
- Claude 3 Haiku

### Intelligence-Optimized Models

For complex reasoning and advanced tasks:

- GPT-5 Pro
- Claude Sonnet 4.5

- GPT-5

---

## OpenAI Models

### GPT o3-Pro

**Model ID:** o3-pro  

**Provider:** OpenAI  
**Context Window:** 256K tokens  
**Badge:** Most Advanced


**Description:**
OpenAI's most advanced reasoning model with unprecedented problem-solving capabilities.

**Pricing:**

- Input: $20.00 per 1M tokens

- Output: $80.00 per 1M tokens

**Key Strengths:**

- Unprecedented reasoning depth
- Complex mathematical proofs
- Advanced scientific analysis
- Multi-step logical deduction


**Ideal Use Cases:**

- Research and academic work
- Complex mathematical problems
- Advanced scientific computing
- Competitive programming

---


### GPT-5 Pro

**Model ID:** gpt-5-pro  
**Provider:** OpenAI  

**Context Window:** 256K tokens  
**Badge:** Most Powerful  
**Cost Warning:** This is an expensive model, approximately 10x the cost of GPT-5

**Description:**
Most advanced GPT-5 model with highest reasoning effort for complex multi-step tasks.


**Pricing:**

- Input: $15.00 per 1M tokens
- Output: $120.00 per 1M tokens

**Key Strengths:**

- Highest reasoning capability

- Advanced multi-step problem solving
- Complex code architecture
- Research-level analysis

**Ideal Use Cases:**

- Complex system design
- Advanced research tasks
- Multi-step reasoning

- Code refactoring at scale
- LLM-as-a-Judge evaluation scenarios

---


### GPT-5

**Model ID:** gpt-5-chat  
**Provider:** OpenAI  
**Context Window:** 256K tokens  

**Recommended:** Yes

**Description:**
Latest generation model with advanced reasoning and vision capabilities.

**Pricing:**

- Input: $1.25 per 1M tokens

- Output: $10.00 per 1M tokens

**Key Strengths:**

- Advanced reasoning
- Multimodal (text + vision)
- Extended context window
- Tool use and function calling


**Ideal Use Cases:**

- Complex conversations

- Vision-based tasks
- Advanced code generation
- Long document analysis

---


### GPT-5 Mini

**Model ID:** gpt-5-mini  
**Provider:** OpenAI  
**Context Window:** 256K tokens

**Description:**
Compact GPT-5 model optimized for speed and cost while maintaining strong capabilities.


**Pricing:**

- Input: $0.25 per 1M tokens
- Output: $2.00 per 1M tokens

**Key Strengths:**


- Fast inference speed
- Cost-effective
- GPT-5 architecture benefits
- Large context window


**Ideal Use Cases:**

- High-volume applications
- Real-time chat
- Content generation
- Quick analysis tasks


---

### GPT-4.1 Mini

**Model ID:** gpt-4.1-mini  
**Provider:** OpenAI  
**Context Window:** 128K tokens

**Description:**

Fast and cost-effective GPT-4.1 model for most tasks with vision support.

**Pricing:**

- Input: $0.40 per 1M tokens
- Cached Input: $0.10 per 1M tokens
- Output: $1.60 per 1M tokens

**Key Strengths:**


- Fast response times
- Cost-effective
- Multimodal (text + vision)
- Good for most tasks


**Ideal Use Cases:**

- Chat applications
- Content moderation
- Data extraction

- Simple classification

---

## Anthropic Models

### Claude Sonnet 4.5


**Model ID:** claude-sonnet-4.5  
**Provider:** Anthropic  
**Context Window:** 300K tokens  
**Badge:** Latest  
**Recommended:** Yes

**Description:**
Next-generation Claude model with enhanced reasoning, vision, and extended context.


**Pricing:**

- Input: $3.00 per 1M tokens

- Output: $15.00 per 1M tokens

**Key Strengths:**

- Enhanced reasoning capabilities
- Extended 300K context

- Advanced vision support
- Superior code generation

**Ideal Use Cases:**

- Complex software architecture
- Long document analysis
- Advanced vision tasks

- Multi-file code review

---

### Claude Haiku 4.5

**Model ID:** claude-haiku-4.5  
**Provider:** Anthropic  

**Context Window:** 300K tokens

**Description:**
Ultra-fast Claude 4.5 model optimized for speed and cost with vision support.


**Pricing:**

- Input: $1.00 per 1M tokens
- Output: $5.00 per 1M tokens


**Key Strengths:**

- Fastest Claude model
- Extended context window
- Vision capabilities
- Cost-effective for scale

**Ideal Use Cases:**


- Real-time chat applications
- High-volume processing
- Quick image analysis
- Content moderation at scale

---


### Claude 3.5 Sonnet

**Model ID:** claude-3-5-sonnet-20241022  
**Provider:** Anthropic  

**Context Window:** 200K tokens

**Description:**
Anthropic's most intelligent Claude 3 model with strong coding and reasoning.

**Pricing:**


- Input: $3.00 per 1M tokens
- Output: $15.00 per 1M tokens

**Key Strengths:**

- Excellent coding abilities
- Strong analytical reasoning

- Nuanced responses
- Vision support

**Ideal Use Cases:**

- Software development
- Technical writing
- Data analysis

- Research assistance

---


### Claude 3 Opus

**Model ID:** claude-3-opus-20240229  
**Provider:** Anthropic  
**Context Window:** 200K tokens


**Description:**
Most powerful Claude 3 model for highly complex tasks requiring deep reasoning.

**Pricing:**

- Input: $15.00 per 1M tokens
- Output: $75.00 per 1M tokens

**Key Strengths:**

- Highest intelligence (Claude 3)
- Complex reasoning

- Long-form content
- Vision capabilities

**Ideal Use Cases:**

- Complex problem solving
- Research-level analysis

- Strategic planning
- Advanced creative writing

---

### Claude 3 Haiku

**Model ID:** claude-3-haiku-20240307  
**Provider:** Anthropic  

**Context Window:** 200K tokens

**Description:**
Fast, compact Claude 3 model for quick responses and cost efficiency.

**Pricing:**


- Input: $0.25 per 1M tokens
- Output: $1.25 per 1M tokens


**Key Strengths:**

- Very fast responses
- Most cost-effective (Claude 3)
- Good for simple tasks

- Large context support

**Ideal Use Cases:**

- Customer support chatbots

- Content moderation
- Quick Q&A
- High-volume processing

---

## Model Comparison Tables

### Price Comparison (Input / Output per 1M tokens)


**OpenAI Models:**

- GPT o3-Pro: $20.00 / $80.00
- GPT-5 Pro: $15.00 / $120.00
- GPT-5: $1.25 / $10.00
- GPT-5 Mini: $0.25 / $2.00
- GPT-4.1 Mini: $0.40 / $1.60


**Anthropic Models:**

- Claude Sonnet 4.5: $3.00 / $15.00

- Claude Haiku 4.5: $1.00 / $5.00
- Claude 3.5 Sonnet: $3.00 / $15.00
- Claude 3 Opus: $15.00 / $75.00
- Claude 3 Haiku: $0.25 / $1.25

### Context Window Comparison


**256K Tokens:**

- GPT o3-Pro
- GPT-5 Pro
- GPT-5
- GPT-5 Mini


**300K Tokens:**

- Claude Sonnet 4.5
- Claude Haiku 4.5


**200K Tokens:**

- Claude 3.5 Sonnet
- Claude 3 Opus
- Claude 3 Haiku


**128K Tokens:**

- GPT-4.1 Mini

### Vision Support

**Models with Vision Capabilities:**


- GPT o3-Pro
- GPT-5 Pro
- GPT-5
- GPT-4.1 Mini

- Claude Sonnet 4.5
- Claude Haiku 4.5
- Claude 3.5 Sonnet
- Claude 3 Opus


**Models without Vision:**

- GPT-5 Mini (text-only)
- Claude 3 Haiku (text-only)

---

## Platform Features

### Unified API

Fine-Tune Lab provides a single API endpoint for all models, allowing seamless switching between providers without code changes.

### Model Management


- Easy model configuration and deployment
- Centralized API key management

- Per-model usage tracking and analytics
- Cost monitoring and budget controls

### Integration


All models are accessible through standard REST API endpoints with OpenAI-compatible format for easy integration with existing applications.

---


## Best Practices

### Cost Optimization

1. Use cheaper models (GPT-4.1 Mini, Claude 3 Haiku) for simple tasks
2. Reserve expensive models (GPT-5 Pro, Claude 3 Opus) for complex reasoning
3. Leverage caching when available (GPT-4.1 Mini supports cached inputs)
4. Monitor usage with built-in analytics

### Performance Optimization

1. Choose models with appropriate context windows for your use case
2. Use faster models (Haiku variants, Mini variants) for real-time applications
3. Batch requests when possible to reduce overhead


### Quality Optimization

1. Use vision-capable models for multimodal tasks

2. Select models with larger context windows for long documents
3. Use reasoning-optimized models (GPT-5 Pro, Claude Sonnet) for complex logic

---

## Entity Relationships

### Providers

- OpenAI: Offers GPT models with strong reasoning and vision capabilities
- Anthropic: Offers Claude models with extended context and enhanced safety


### Model Tiers

- **Premium Tier**: GPT o3-Pro, GPT-5 Pro, Claude 3 Opus

- **Standard Tier**: GPT-5, Claude Sonnet 4.5, Claude 3.5 Sonnet
- **Economy Tier**: GPT-5 Mini, GPT-4.1 Mini, Claude Haiku 4.5, Claude 3 Haiku

### Capabilities


- **Reasoning**: GPT o3-Pro, GPT-5 Pro, GPT-5, Claude Sonnet 4.5
- **Vision**: Most models except GPT-5 Mini and Claude 3 Haiku
- **Speed**: Claude Haiku 4.5, GPT-5 Mini, GPT-4.1 Mini
- **Context**: Claude models (200K-300K), GPT-5 family (256K)


---

This knowledge base is optimized for ingestion into Graphiti/Neo4j graph RAG systems with clear entity relationships, hierarchical structure, and comprehensive model information.


---

# Quick Start Guide

## Overview

Get up and running with Fine-Tune Lab in under 5 minutes. This guide covers the essential workflow from checking available models to deploying your first fine-tuned model.

## 1. List Available Models

**Endpoint:** `GET /api/models`
**Description:** Retrieves a list of all available models you can use for training and inference.

**Command:**

```bash
curl https://finetunelab.ai/api/models
```

**Expected Response:**



```json
{
  "models": [
    {
      "id": "llama-3-8b",

      "name": "LLaMA 3 8B",

      "status": "available"
    },
    ...
  ]

}

```

## 2. Start a Training Job


**Endpoint:** `POST /api/training/start`

**Description:** Starts a new fine-tuning job with your specified model and dataset.

**Command:**

```bash
curl -X POST https://finetunelab.ai/api/training/start \

  -H "Content-Type: application/json" \

  -d '{
    "model": "llama-3-8b",
    "dataset": "my-dataset-id",
    "config": "default"
  }'

```

## 3. Monitor Training Progress

**Endpoint:** `GET /api/training/status/:jobId`

**Description:** Check the status of your training job using the job ID returned from the start command.

**Command:**

```bash

curl https://finetunelab.ai/api/training/status/job-12345
```

**Response Data:**


- Status: `queued`, `running`, `completed`, `failed`
- Progress: Percentage (0-100)
- Metrics: Current loss, epoch


## 4. Deploy Your Model

**Endpoint:** `POST /api/inference/deploy`

**Description:** Deploy your trained model to production using RunPod Serverless.

**Command:**

```bash
curl -X POST https://finetunelab.ai/api/inference/deploy \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "runpod-serverless",

    "deployment_name": "my-model-prod",
    "training_job_id": "job-12345",
    "gpu_type": "NVIDIA RTX A4000",
    "budget_limit": 5.0
  }'

```

---

# Platform Features

## Core Capabilities

### 1. LLM Fine-Tuning

Train custom AI models on your data without deep ML knowledge.

- **Supported Models:** Llama, Mistral, Qwen, and more
- **Techniques:** LoRA, full fine-tuning, mixed precision (FP16/BF16)

- **Optimization:** Automatic hyperparameter tuning

### 2. Dataset Management

Upload, validate, and manage training datasets.

- **Validation:** JSONL format checks, structure verification
- **Features:** Automatic splitting, versioning, quality metrics

### 3. Real-Time Training Metrics

Monitor your training jobs as they run.

- **Visualizations:** Live loss curves, learning rates

- **Hardware:** GPU memory tracking, utilization stats

### 4. Production Inference Deployment

One-click deployment to scalable cloud infrastructure.

- **Provider:** RunPod Serverless
- **Hardware Options:** A4000 to H100 GPUs
- **Scaling:** Auto-scaling (0-N workers), scale-to-zero
- **Cost Control:** Real-time tracking, budget limits


### 5. Developer-First API

Comprehensive RESTful API for full platform control.

- **Endpoints:** 25+ endpoints covering all features
- **SDKs:** Python, JavaScript/TypeScript support

- **Updates:** Real-time WebSocket notifications

### 6. Enterprise Security

- **Authentication:** Supabase RLS (Row-Level Security)
- **Encryption:** API keys encrypted at rest
- **Isolation:** User-scoped resources and data


### 7. Model Version Control

- **Checkpoints:** Automatic saving during training
- **History:** Full lineage of training runs and parameters
- **Comparison:** Tools to compare model performance

### 8. Training Pipeline Control


- **Actions:** Pause, resume, cancel jobs
- **Flexibility:** Adjust hyperparameters on the fly

### 9. Analytics & Insights

- **Analysis:** Cost per job, performance benchmarking
- **Optimization:** Hyperparameter suggestions based on history

### 10. Performance Optimization


- **Efficiency:** Auto batch size detection, gradient accumulation
- **Speed:** Flash Attention support, multi-GPU training

## Key Use Cases

1. **Customer Support Automation:** Fine-tune on historical tickets for brand-aligned responses.
2. **Code Generation:** Train on internal codebases to learn specific patterns and conventions.
3. **Domain-Specific Expertise:** Specialized models for legal, medical, or financial data.
4. **Content Generation:** Generate marketing copy matching your specific brand voice.

---

# API Reference


## Base URL

`https://finetunelab.ai`

## Training Endpoints


### Job Management

- **Start Training:** `POST /api/training/start`
  - Starts a new fine-tuning job. Returns `job_id`.
- **Get Status:** `GET /api/training/status/:jobId`
  - Returns job status (`queued`, `running`, `completed`, etc.), progress, and current metrics.

- **Pause Job:** `POST /api/training/pause/:jobId`
  - Temporarily halts a running job.
- **Resume Job:** `POST /api/training/resume/:jobId`
  - Resumes a paused job from the last checkpoint.
- **Cancel Job:** `POST /api/training/cancel/:jobId`

  - Permanently stops a job.
- **Execute Training:** `POST /api/training/execute`
  - Internal endpoint to trigger execution on the training server.

### Data & Artifacts


- **List Datasets:** `GET /api/training/dataset`
  - Returns available datasets for training.
- **Get Metrics:** `GET /api/training/metrics/:jobId`
  - Retrieves complete history of training metrics (loss, learning rate).
- **Get Logs:** `GET /api/training/logs/:jobId`
  - Retrieves raw training logs.
- **List Checkpoints:** `GET /api/training/checkpoints/:jobId`
  - Lists saved model checkpoints with evaluation loss.
- **Download Model:** `GET /api/training/:jobId/download/model`

  - Download the final model artifacts.
- **Download Logs:** `GET /api/training/:jobId/download/logs`
  - Download full logs archive.

### Validation & Analytics

- **Validate Model:** `POST /api/training/validate`
  - Runs validation metrics (perplexity, accuracy, BLEU) on a model.
- **Job Analytics:** `GET /api/training/:jobId/analytics`

  - Detailed analytics for a specific job.
- **Analytics Summary:** `GET /api/training/analytics/summary`
  - System-wide training analytics.
- **Compare Jobs:** `GET /api/training/analytics/compare`
  - Compare metrics across multiple training jobs.

## Configuration Management

- **List Configs:** `GET /api/training`

- **Create Config:** `POST /api/training`
- **Get Config:** `GET /api/training/:id`
- **Update Config:** `PUT /api/training/:id`
- **Delete Config:** `DELETE /api/training/:id`

## Model Management

- **List Models:** `GET /api/models`
  - Lists all available base models.
- **Create Custom Model:** `POST /api/models`

  - Register a new custom model.
- **Delete Model:** `DELETE /api/models/:id`

## Inference Deployment Endpoints


- **Deploy Model:** `POST /api/inference/deploy`
  - Deploys a model to RunPod Serverless. Requires `gpu_type`, `budget_limit`.
- **Get Deployment Status:** `GET /api/inference/deployments/:id/status`
  - Checks if deployment is ready and returns endpoint URL.

- **Stop Deployment:** `DELETE /api/inference/deployments/:id/stop`
  - Terminates the deployment to stop billing.

## GraphRAG (Knowledge Graph) Endpoints

- **Upload Document:** `POST /api/graphrag/upload`

  - Uploads PDF/DOCX/TXT/MD files for knowledge graph processing.
- **List Documents:** `GET /api/graphrag/documents`
  - Lists processed documents in the knowledge graph.
- **Hybrid Search:** `POST /api/graphrag/search`
  - Performs hybrid search (vector + graph) on the knowledge base.

- **Delete Document:** `DELETE /api/graphrag/delete/:id`
  - Removes a document and its entities from the graph.

## Analytics Endpoints


- **Get Data:** `GET /api/analytics/data`
  - Aggregated analytics for tokens, quality, tools, conversations, errors, latency.
- **Chat Analytics:** `POST /api/analytics/chat`
  - AI assistant for analytics queries.
- **Sentiment Insights:** `GET /api/analytics/sentiment/insights`
  - Sentiment analysis of interactions.
- **Cohorts:** `GET/POST/PATCH/DELETE /api/analytics/cohorts`
  - Manage user cohorts (static, dynamic, behavioral, subscription, custom).

---

# Guides & Tutorials

## 1. Complete Training Workflow

1. **Upload Dataset:** Prepare and upload your JSONL file.
2. **Create Config:** Define hyperparameters (learning rate, batch size, epochs).
3. **Start Training:** Execute the job.
4. **Monitor:** Watch real-time metrics.
5. **Checkpoint:** System saves checkpoints automatically.

## 2. Dataset Preparation

- **Format:** JSONL (JSON Lines)
- **Structure:** `{"messages": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}`
- **Validation:** Ensure all JSON objects are valid.
- **Size:** Recommended 50-5000 examples. Quality > Quantity.

## 3. Hyperparameter Tuning

- **Learning Rate:** Typically `1e-5` to `1e-4`.
- **Batch Size:** `1` to `32` depending on GPU memory.
- **Epochs:** `1` to `10`. Watch for overfitting (validation loss increasing).

## 4. Model Deployment to Production

- **Platform:** RunPod Serverless.
- **Process:** Use `POST /api/inference/deploy`.
- **Cost:** Set `budget_limit` to prevent overspending.
- **Scaling:** Auto-scales based on request volume.

## 5. Performance Monitoring

- **Metrics:** Loss, throughput, GPU usage.
- **Logs:** Check for errors or warnings.
- **Diagnostics:** Use the diagnostic flowchart for debugging model vs. dataset issues.

---

# Examples

## Python SDK

```python
class TrainingClient:
    def upload_dataset(file_path)
    def create_config(name, model, params)
    def start_training(config_id, dataset_id)
    def monitor_training(job_id)
```

## JavaScript/TypeScript SDK

```typescript
class TrainingClient {
    async startTraining(config)
    async getStatus(jobId)
    async getMetrics(jobId)
}
```

## cURL Commands

- **Create Config:** `POST /api/training`
- **Start Training:** `POST /api/training/start`
- **Get Status:** `GET /api/training/status/:jobId`
- **Deploy:** `POST /api/inference/deploy`

---

# Troubleshooting

## Training Errors

- **Loss is NaN/Exploding:** Learning rate too high, bad data, or numerical instability. Try reducing LR or using gradient clipping.
- **CUDA OOM (Out of Memory):** Batch size too large. Reduce batch size, use gradient accumulation, or enable LoRA/Quantization.
- **Training Stuck:** Learning rate too low or insufficient warmup steps.

## Dataset Issues

- **Invalid JSON:** Check for unescaped quotes or malformed JSON objects.
- **Validation Failed:** Ensure `messages` array exists and has correct role/content structure.

## API Errors

- **401 Unauthorized:** Invalid or missing API key.
- **404 Not Found:** Resource (job, model, dataset) does not exist.
- **409 Conflict:** Resource already exists or state conflict.
- **500 Internal Server Error:** Server-side issue. Check logs.

## Inference Deployment Issues

- **Deployment Stuck:** Check RunPod API key and budget limits.
- **Budget Exceeded:** Deployment auto-stopped due to budget limit. Increase limit to resume.
- **Connection Failed:** Endpoint may be cold-starting (scale-to-zero). Retry after a few seconds.

## Performance Problems

- **Slow Training:** Increase batch size (if memory allows), use mixed precision (FP16/BF16).
- **High Memory Usage:** Enable Gradient Checkpointing and LoRA.

## FAQ

- **Training Duration:** Depends on dataset size, model size, and hardware.
- **Minimum Dataset Size:** 50+ examples recommended. 200-1000 for better results.
- **GPU Requirements:** ~8GB VRAM for 1B models, ~16GB+ for 7B models (with LoRA).
