# End-to-end Workflow Guides

This document outlines practical flows using the repository's APIs:

## 1. Base model smoke test

List candidates via `/api/models` and `/api/models/local`.
Use `/api/models/test-connection` to validate connectivity/credentials, then run a few prompts through `/api/chat`.
Prefer short prompts that cover real repo tasks (e.g., 'How to monitor training logs?').

## 2. Local quick eval → train → monitor → deploy to vLLM

Start with base model testing: list models via `/api/models/local` and `/api/models`.
Smoke-test responses with `/api/chat` or run a small suite with `/api/batch-testing/run` (set prompt_limit).
When you're ready, kick off training with `/api/training/execute` providing dataset_path (e.g., `lib/training/logs/datasets/repo_faq_chat.jsonl`) and a config.
Monitor with `/api/training/local/job_local_001/status`, `/api/training/local/job_local_001/logs`, and `/api/training/local/job_local_001/metrics`.
After training, deploy to local vLLM via `/api/training/deploy`; check availability with `/api/training/vllm/check`.

## 3. Evaluate after training with batch-testing

Use `/api/batch-testing/run` to execute a prompt set through your deployed or selected model.
Provide a config with model_id, a dataset (or source_path), and concurrency/prompt_limit.

## 4. Deploy to RunPod Serverless

Use `/api/inference/deploy` with provider, deployment_name, base_model, model_type, model_storage_url, and budget_limit. Ensure your RunPod API key is configured in Settings > Secrets.

## 5. Resume training and inspect metrics

If you have checkpoints, resume from the latest checkpoint when calling `/api/training/execute` or the resume endpoint if available.
Monitor with `/api/training/local/job_resume_003/status` and chart trends via `/api/training/local/job_resume_003/metrics` to ensure loss improves.
