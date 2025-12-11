#!/usr/bin/env python3
"""
Generate guided workflow chat data that walks users through:
1) Base model testing
2) Kicking off training
3) Monitoring metrics/logs
4) Evaluating after training
5) Model deployment (local vLLM or RunPod)

Outputs:
- docs/WORKFLOW_GUIDES.md (human guide)
- lib/training/logs/datasets/workflow_guides_chat.jsonl (chat SFT dataset)
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
GUIDE_MD = ROOT / "docs" / "WORKFLOW_GUIDES.md"
OUT_JSONL = ROOT / "lib" / "training" / "logs" / "datasets" / "workflow_guides_chat.jsonl"

SYSTEM = (
    "You are a helpful assistant for this repository. "
    "Guide the user through base model testing, training, metrics, evaluation, and deployment using the project's APIs. "
    "Answer concisely, cite concrete route paths and file names when helpful, and remind about auth when required."
)

# Common endpoints in this repo (grounding references)
E = {
    "models_list": "/api/models",
    "models_local": "/api/models/local",
    "models_test": "/api/models/test-connection",
    "chat": "/api/chat",
    "batch_run": "/api/batch-testing/run",
    "train_execute": "/api/training/execute",
    "train_jobs": "/api/training/jobs",
    "train_status": "/api/training/local/{jobId}/status",
    "train_logs": "/api/training/local/{jobId}/logs",
    "train_metrics": "/api/training/local/{jobId}/metrics",
    "train_checkpoints": "/api/training/checkpoints/list",
    "deploy_local": "/api/training/deploy",
    "vllm_check": "/api/training/vllm/check",
    "deploy_runpod": "/api/inference/deploy",
    "deploy_status": "/api/inference/deployments/{id}/status",
}

# Paths to included datasets from earlier steps
DATASETS = {
    "repo_faq": "lib/training/logs/datasets/repo_faq_chat.jsonl",
    "dolly": "lib/training/logs/datasets/dolly_chat.jsonl",
}


def flow_local_quick_eval_then_train(job_id: str = "job_local_001"):
    return {
        "title": "Local quick eval → train → monitor → deploy to vLLM",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "I want to quickly test a base model locally and then train with our repo data. What's the path?"},
            {"role": "assistant", "content": (
                f"Start with base model testing: list models via `{E['models_local']}` and `{E['models_list']}`.\n"
                f"Smoke-test responses with `{E['chat']}` or run a small suite with `{E['batch_run']}` (set prompt_limit).\n"
                f"When you're ready, kick off training with `{E['train_execute']}` providing dataset_path (e.g., `{DATASETS['repo_faq']}`) and a config.\n"
                f"Monitor with `{E['train_status'].format(jobId=job_id)}`, `{E['train_logs'].format(jobId=job_id)}`, and `{E['train_metrics'].format(jobId=job_id)}`.\n"
                f"After training, deploy to local vLLM via `{E['deploy_local']}`; check availability with `{E['vllm_check']}`." )},
            {"role": "user", "content": "Which dataset do you recommend for a first pass?"},
            {"role": "assistant", "content": (
                f"Use `{DATASETS['repo_faq']}` to teach the assistant repo-aware answers."
                " It's already normalized to chat JSONL. Start with a small number of epochs and a low learning rate to avoid overfitting.")},
            {"role": "user", "content": "How do I monitor progress while it trains?"},
            {"role": "assistant", "content": (
                f"Poll `{E['train_status'].format(jobId=job_id)}` for high-level progress and `{E['train_logs'].format(jobId=job_id)}` for detailed logs.\n"
                f"For charts and history, use `{E['train_metrics'].format(jobId=job_id)}`." )},
            {"role": "user", "content": "Once it's done, how do I deploy locally?"},
            {"role": "assistant", "content": (
                f"Call `{E['deploy_local']}` with your trained model path or checkpoint.\n"
                f"Then verify readiness with `{E['vllm_check']}` and test with `{E['chat']}` using the new model.")},
        ]
    }


def flow_batch_eval_after_training(job_id: str = "job_local_002"):
    return {
        "title": "Evaluate after training with batch-testing",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I evaluate the model after training finishes?"},
            {"role": "assistant", "content": (
                f"Use `{E['batch_run']}` to execute a prompt set through your deployed or selected model.\n"
                "Provide a config with model_id, a dataset (or source_path), and concurrency/prompt_limit."
            )},
            {"role": "user", "content": "Where do I check if the training actually finished?"},
            {"role": "assistant", "content": (
                f"Check `{E['train_status'].format(jobId=job_id)}` for status completed and consult `{E['train_logs'].format(jobId=job_id)}` for final logs.\n"
                f"If you saved checkpoints, list them via `{E['train_checkpoints']}`.")},
            {"role": "user", "content": "Can I use our Dolly conversion instead of the repo FAQ?"},
            {"role": "assistant", "content": (
                f"Yes—use `{DATASETS['dolly']}` (`dolly_chat.jsonl`). It's also chat-normalized."
                " You can alternate datasets or mix them to broaden capabilities.")},
        ]
    }


def flow_runpod_deploy():
    return {
        "title": "Deploy to RunPod Serverless",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I deploy the trained model to a serverless endpoint?"},
            {"role": "assistant", "content": (
                f"Use `{E['deploy_runpod']}` with provider, deployment_name, base_model, model_type, model_storage_url, and budget_limit."
                " Ensure your RunPod API key is configured in Settings > Secrets.")},
            {"role": "user", "content": "How can I check that the deployment is live?"},
            {"role": "assistant", "content": (
                f"Poll `{E['deploy_status'].format(id='DEPLOYMENT_ID')}` for status (INITIALIZING/RUNNING)."
                " Once RUNNING, send test inference requests to the returned endpoint_url.")},
        ]
    }


def flow_base_model_smoketest():
    return {
        "title": "Base model smoke test",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "I want to sanity-check a base model before any training."},
            {"role": "assistant", "content": (
                f"List candidates via `{E['models_list']}` and `{E['models_local']}`.\n"
                f"Use `{E['models_test']}` to validate connectivity/credentials, then run a few prompts through `{E['chat']}`.\n"
                "Prefer short prompts that cover real repo tasks (e.g., 'How to monitor training logs?').")},
        ]
    }


def flow_resume_and_metrics(job_id: str = "job_resume_003"):
    return {
        "title": "Resume training and inspect metrics",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Training failed last night. How do I resume and check metrics?"},
            {"role": "assistant", "content": (
                f"If you have checkpoints, resume from the latest checkpoint when calling `{E['train_execute']}` or the resume endpoint if available.\n"
                f"Monitor with `{E['train_status'].format(jobId=job_id)}` and chart trends via `{E['train_metrics'].format(jobId=job_id)}` to ensure loss improves.")},
        ]
    }


def build_flows():
    return [
        flow_base_model_smoketest(),
        flow_local_quick_eval_then_train(),
        flow_batch_eval_after_training(),
        flow_runpod_deploy(),
        flow_resume_and_metrics(),
        flow_dataset_upload_and_validate(),
        flow_training_config_create_and_list(),
        flow_runtime_param_update(),
        flow_failure_analysis_deep(),
        flow_predictions_and_epochs(),
        flow_analytics_overview(),
        flow_baselines_regression_gates(),
        flow_export_conversations(),
        flow_servers_management(),
        flow_deploy_hf_spaces(),
        flow_deploy_kaggle(),
        flow_deploy_colab(),
        flow_dag_validate_execute_status(),
        flow_dag_logs_metrics(),
        flow_dag_checkpoints_backfill(),
        flow_dataset_available_and_attach(),
        flow_public_package_and_datasets(),
        flow_checkpoint_selection_for_deploy(),
        flow_training_jobs_overview(),
        flow_inference_deployment_status_stop(),
    ]


def flow_dataset_upload_and_validate():
    return {
        "title": "Upload and validate a training dataset",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I upload a dataset and validate it for training?"},
            {"role": "assistant", "content": (
                "Use `/api/training/dataset` with multipart form (file, name, description, format). "
                "The server will validate and normalize to JSONL and return stats (examples, lengths, size). "
                "Link it to a training config via `config_id` if you want to track usage.")},
        ]
    }


def flow_training_config_create_and_list():
    return {
        "title": "Create and list training configurations",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How can I define and reuse training configs?"},
            {"role": "assistant", "content": (
                "POST `/api/training` with name, template_type (lora/qlora/full_finetune/dpo/rlhf), and config_json. "
                "Then GET `/api/training` or `/api/training/config/available` to list and select configs in the UI.")},
        ]
    }


def flow_runtime_param_update(job_id: str = "job_rt_004"):
    return {
        "title": "Adjust runtime training parameters (learning rate, batch size)",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Can I change LR or batch size during training?"},
            {"role": "assistant", "content": (
                f"Use `PATCH /api/training/local/{{jobId}}/update-params` to modify parameters during training. "
                f"Monitor the effect via `{E['train_metrics'].format(jobId=job_id)}` and `{E['train_status'].format(jobId=job_id)}`." )},
        ]
    }


def flow_failure_analysis_deep(job_id: str = "job_fail_005"):
    return {
        "title": "Analyze failures and plan resume",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Training crashed—how do I understand why and resume?"},
            {"role": "assistant", "content": (
                f"Call `/api/training/local/{{jobId}}/analyze-failure` for suggestions, and inspect `{E['train_logs'].format(jobId=job_id)}`. "
                f"Resume from a checkpoint (see `{E['train_checkpoints']}`) and consider lowering LR or batch size.")},
        ]
    }


def flow_predictions_and_epochs(job_id: str = "job_pred_006"):
    return {
        "title": "Inspect predictions over epochs",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I see how predictions improved across epochs?"},
            {"role": "assistant", "content": (
                "Use `/api/training/predictions/{jobId}` to list predictions and `/api/training/predictions/{jobId}/epochs` "
                "to get epoch coverage. Compare outputs to track quality trends.")},
        ]
    }


def flow_analytics_overview():
    return {
        "title": "Analytics: usage, anomalies, model comparison",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Where can I see production analytics and anomalies?"},
            {"role": "assistant", "content": (
                "Use `/api/analytics/data` for metrics (tokens, latency, errors), `/api/analytics/anomalies` for anomaly detection, "
                "and `/api/analytics/model-comparison` for model quality/cost comparisons over a time window.")},
        ]
    }


def flow_baselines_regression_gates():
    return {
        "title": "Baselines and regression gates",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I manage baselines and detect regressions?"},
            {"role": "assistant", "content": (
                "Use `/api/training/baselines` to manage baselines and view validation history. "
                "Integrate with batch-testing to compare new runs against the baseline before promoting changes.")},
        ]
    }


def flow_export_conversations():
    return {
        "title": "Export conversations and artifacts",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How can I export data for analysis?"},
            {"role": "assistant", "content": (
                "Generate exports via `/api/export/generate` and download with `/api/export/download/{id}`. "
                "You can also archive or restore via `/api/export/archive`.")},
        ]
    }


def flow_servers_management():
    return {
        "title": "Manage local inference servers (vLLM/Ollama)",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I start/stop and check status of local inference servers?"},
            {"role": "assistant", "content": (
                "Use `/api/servers/status` to see all servers, `/api/servers/start` to start, and `/api/servers/stop` to stop. "
                "For vLLM availability checks, call `/api/training/vllm/check`.")},
        ]
    }


def flow_deploy_hf_spaces():
    return {
        "title": "Deploy training to HuggingFace Spaces",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Can I deploy to HuggingFace Spaces?"},
            {"role": "assistant", "content": (
                "Yes—use `/api/training/deploy/hf-spaces` to deploy, query status with GET, and stop with DELETE on the same route.")},
        ]
    }


def flow_deploy_kaggle():
    return {
        "title": "Deploy to Kaggle Notebooks",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I run training on Kaggle?"},
            {"role": "assistant", "content": (
                "Use `/api/training/deploy/kaggle` to provision a Kaggle Notebook with your training package. "
                "Good for quick experiments with free GPUs.")},
        ]
    }


def flow_deploy_colab():
    return {
        "title": "Deploy to Google Colab",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I train using Colab?"},
            {"role": "assistant", "content": (
                "Use `/api/training/deploy/google-colab` to create a Colab run (supports OAuth/API key). "
                "Track costs/time and sync results back to your jobs list.")},
        ]
    }


def flow_dag_validate_execute_status():
    return {
        "title": "DAG: validate and execute a pipeline",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I run a multi-step training DAG?"},
            {"role": "assistant", "content": (
                "Validate with `/api/training/dag/validate`, then execute with `/api/training/dag/execute`. "
                "Monitor status via `/api/training/dag/status/{id}`.")},
        ]
    }


def flow_dag_logs_metrics():
    return {
        "title": "DAG: logs and metrics streaming",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Where can I stream DAG logs and metrics?"},
            {"role": "assistant", "content": (
                "Use `/api/training/dag/logs/{id}` (SSE) for logs and `/api/training/dag/metrics/{id}` for metrics. "
                "Pause/resume/cancel via `/api/training/dag/pause`, `/api/training/dag/resume`, `/api/training/dag/cancel/{id}`.")},
        ]
    }


def flow_dag_checkpoints_backfill():
    return {
        "title": "DAG: checkpoints, templates, and backfill",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I manage DAG templates and backfill runs?"},
            {"role": "assistant", "content": (
                "List templates `/api/training/dag/templates`, manage by ID, and list checkpoints `/api/training/dag/checkpoints/list`. "
                "Use `/api/training/dag/backfill` to run across a date range.")},
        ]
    }


def flow_dataset_available_and_attach():
    return {
        "title": "List available datasets and attach to a config",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I pick a dataset for a config?"},
            {"role": "assistant", "content": (
                "Get user datasets via `/api/training/dataset/available` and attach to a config with `/api/training/{id}/attach-dataset`. "
                "Review datasets for a config with `/api/training/{id}/datasets`.")},
        ]
    }


def flow_public_package_and_datasets():
    return {
        "title": "Generate and download training packages; access public config",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I generate a training package and download it?"},
            {"role": "assistant", "content": (
                "Use `/api/training/{id}/generate-package` to build, then `/api/training/{id}/download-package` to download. "
                "Public configs/datasets can be accessed via `/api/training/public/{id}` and `/api/training/public/{id}/dataset`.")},
        ]
    }


def flow_checkpoint_selection_for_deploy(job_id: str = "job_ckpt_007"):
    return {
        "title": "Pick a checkpoint and deploy locally",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I choose a checkpoint to serve?"},
            {"role": "assistant", "content": (
                f"List checkpoints via `{E['train_checkpoints']}` or `/api/filesystem/checkpoints/{{job_id}}`. "
                f"Deploy with `{E['deploy_local']}` and verify with `{E['vllm_check']}`. Test by calling `{E['chat']}`.")},
        ]
    }


def flow_training_jobs_overview():
    return {
        "title": "Training jobs overview and status",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Where do I see all my training jobs?"},
            {"role": "assistant", "content": (
                "Use `/api/training/jobs` to list jobs. For local jobs, use the `/api/training/local/{jobId}/status|logs|metrics` trio for details.")},
        ]
    }


def flow_inference_deployment_status_stop():
    return {
        "title": "Check and stop inference deployments",
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "How do I monitor or stop a production inference deployment?"},
            {"role": "assistant", "content": (
                "Check status via `/api/inference/deployments/{id}/status` and stop with `/api/inference/deployments/{id}/stop`.")},
        ]
    }


def write_md(flows):
    GUIDE_MD.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# End-to-end Workflow Guides",
        "",
        "This document outlines practical flows using the repository's APIs:",
        "",
    ]
    for i, f in enumerate(flows, 1):
        lines.append(f"## {i}. {f['title']}")
        lines.append("")
        # show first assistant message as synopsis
        msgs = f["messages"]
        syn = next((m["content"] for m in msgs if m["role"] == "assistant"), "")
        if syn:
            lines.append(syn)
            lines.append("")
    GUIDE_MD.write_text("\n".join(lines), encoding="utf-8")


def write_jsonl(flows):
    OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
    written = 0
    with OUT_JSONL.open("w", encoding="utf-8") as f:
        for flow in flows:
            f.write(json.dumps({"messages": flow["messages"]}, ensure_ascii=False) + "\n")
            written += 1
    return written


def main():
    flows = build_flows()
    write_md(flows)
    n = write_jsonl(flows)
    print(f"Wrote {n} guided flows to {OUT_JSONL} and updated {GUIDE_MD}")


if __name__ == "__main__":
    main()
