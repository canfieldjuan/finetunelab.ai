#!/usr/bin/env python3
"""
Generate 25 hyper-specific FineTune Lab questions
Base model will hallucinate - trained model should know exact answers
"""

import json
from pathlib import Path

# These questions are IMPOSSIBLE for base model to answer correctly
# They require knowledge of YOUR specific FineTune Lab implementation
SPECIFIC_QUESTIONS = [
    # Exact UI Navigation (your specific structure)
    {
        "question": "Where exactly in the UI do I find the LoRA rank setting?",
        "expected_answer": "Training > Training Configuration > LoRA/QLoRA Tab > LoRA Rank slider (values 8, 16, 32, 64)",
        "category": "ui_navigation",
        "why_specific": "Your exact UI structure and tab names"
    },
    {
        "question": "What are the exact steps to deploy a trained model to vLLM from the training page?",
        "expected_answer": "1) Go to Training page, 2) Find completed job, 3) Click Deploy button, 4) Select vLLM or Ollama, 5) Configure settings (GPU memory, max tokens), 6) Click Deploy",
        "category": "ui_workflow",
        "why_specific": "Your specific deployment workflow"
    },
    {
        "question": "Where is the GraphRAG setup located in the interface?",
        "expected_answer": "Tools > GraphRAG > Setup (or Navigation menu > GraphRAG section)",
        "category": "ui_navigation",
        "why_specific": "Your specific feature location"
    },

    # Exact File Paths (your system)
    {
        "question": "What is the default directory where training outputs are saved?",
        "expected_answer": "lib/training/logs/job_<job_id>/ with subdirectories for checkpoints, logs, and final model",
        "category": "file_paths",
        "why_specific": "Your specific directory structure"
    },
    {
        "question": "Where are the training logs stored during an active training run?",
        "expected_answer": "lib/training/logs/job_<job_id>/training.log and realtime updates in the database",
        "category": "file_paths",
        "why_specific": "Your logging implementation"
    },

    # Specific Configuration Values (your defaults)
    {
        "question": "What is the default learning rate recommended in FineTune Lab for LoRA training?",
        "expected_answer": "2e-5 (0.00002)",
        "category": "config_defaults",
        "why_specific": "Your specific recommendation"
    },
    {
        "question": "What is the default GPU memory utilization for vLLM deployments?",
        "expected_answer": "0.8 (80%)",
        "category": "config_defaults",
        "why_specific": "Your default setting"
    },
    {
        "question": "What is the default train/eval split ratio in FineTune Lab?",
        "expected_answer": "80/20 (0.2 eval split)",
        "category": "config_defaults",
        "why_specific": "Your default split"
    },
    {
        "question": "What is the default warmup ratio for training?",
        "expected_answer": "0.03 (3% of total steps)",
        "category": "config_defaults",
        "why_specific": "Your default warmup"
    },

    # Specific API Endpoints (your implementation)
    {
        "question": "What API endpoint do I call to start a training job?",
        "expected_answer": "POST /api/training/local/start",
        "category": "api_endpoints",
        "why_specific": "Your specific API route"
    },
    {
        "question": "What API endpoint retrieves the status of a running training job?",
        "expected_answer": "GET /api/training/local/jobs/:jobId or GET /api/training/local/status",
        "category": "api_endpoints",
        "why_specific": "Your API design"
    },
    {
        "question": "What API endpoint is used to deploy a model?",
        "expected_answer": "POST /api/training/deploy",
        "category": "api_endpoints",
        "why_specific": "Your deployment endpoint"
    },

    # Specific Features (your implementation)
    {
        "question": "Does FineTune Lab support automatic dataset validation before training?",
        "expected_answer": "Yes, it validates JSONL structure, checks for required fields (messages, role, content), verifies role alternation, and checks for tool call formatting",
        "category": "features",
        "why_specific": "Your specific validation features"
    },
    {
        "question": "What formats does FineTune Lab's dataset validator accept?",
        "expected_answer": "ChatML (messages with role/content) and ShareGPT (conversations with from/value) formats in JSONL",
        "category": "features",
        "why_specific": "Your supported formats"
    },
    {
        "question": "Can FineTune Lab train with tool/function calling datasets?",
        "expected_answer": "Yes, it supports tool calling workflows with consecutive assistant messages containing tool_calls",
        "category": "features",
        "why_specific": "Your tool calling support"
    },

    # Database/Backend Specifics
    {
        "question": "What database does FineTune Lab use to track training jobs?",
        "expected_answer": "Supabase (PostgreSQL) with tables: local_training_jobs, local_inference_servers, llm_models",
        "category": "backend",
        "why_specific": "Your database choice"
    },
    {
        "question": "What Python framework is the training server built with?",
        "expected_answer": "FastAPI with Uvicorn server, located in lib/training/training_server.py",
        "category": "backend",
        "why_specific": "Your implementation stack"
    },

    # Error Messages (your specific messages)
    {
        "question": "What error message appears if you try to deploy a training job that's not completed?",
        "expected_answer": "Training job not completed - Job status is '<status>'. Only completed jobs can be deployed.",
        "category": "error_messages",
        "why_specific": "Your specific error message"
    },
    {
        "question": "What happens if you try to start training without a dataset?",
        "expected_answer": "Validation error: 'Missing required field: dataset_path' or similar dataset validation error",
        "category": "error_messages",
        "why_specific": "Your validation messages"
    },

    # Version-Specific Features
    {
        "question": "What quantization types does FineTune Lab support for QLoRA?",
        "expected_answer": "4-bit and 8-bit quantization with nf4 (Normal Float 4) or fp4 quantization types, with optional double quantization",
        "category": "features",
        "why_specific": "Your supported quantization options"
    },
    {
        "question": "What LoRA target modules does FineTune Lab support by default?",
        "expected_answer": "q_proj, k_proj, v_proj, o_proj (attention layers) and optionally gate_proj, up_proj, down_proj (MLP layers)",
        "category": "features",
        "why_specific": "Your default target modules"
    },

    # Cost/Performance (your specific calculations)
    {
        "question": "How does FineTune Lab calculate the estimated training time?",
        "expected_answer": "Based on: number of examples × epochs × tokens per example / GPU throughput (tokens/sec), with adjustments for batch size and gradient accumulation",
        "category": "calculations",
        "why_specific": "Your estimation algorithm"
    },
    {
        "question": "What port range does FineTune Lab use for local vLLM deployments?",
        "expected_answer": "8002-8020 (finds first available port in this range)",
        "category": "config_defaults",
        "why_specific": "Your specific port allocation"
    },

    # Monitoring/UI Specifics
    {
        "question": "What metrics are displayed in real-time during training in the FineTune Lab UI?",
        "expected_answer": "Training loss, evaluation loss, learning rate, tokens/second, GPU utilization, current step/epoch, time remaining",
        "category": "ui_features",
        "why_specific": "Your monitoring dashboard"
    },
    {
        "question": "How often does the training dashboard update metrics during active training?",
        "expected_answer": "Every logging step (configurable, default every 10-50 steps) and every evaluation interval",
        "category": "ui_features",
        "why_specific": "Your update frequency"
    },
]

def save_specific_tests():
    """Save specific test questions in multiple formats"""

    output_dir = Path("/home/juan-canfield/Desktop/web-ui/output/evaluation")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Format 1: Simple prompts only (for portal testing)
    prompts_file = output_dir / "specific_test_25_prompts_only.txt"
    with open(prompts_file, 'w', encoding='utf-8') as f:
        f.write("FINETUNE LAB - 25 SPECIFIC TEST QUESTIONS\n")
        f.write("Base model will hallucinate - trained model should know exact answers\n")
        f.write("="*80 + "\n\n")

        for i, q in enumerate(SPECIFIC_QUESTIONS, 1):
            f.write(f"{i}. {q['question']}\n\n")

    # Format 2: Full test set with expected answers
    full_file = output_dir / "specific_test_25_with_answers.json"
    with open(full_file, 'w', encoding='utf-8') as f:
        json.dump({
            "metadata": {
                "total_tests": len(SPECIFIC_QUESTIONS),
                "purpose": "Test if model has specific FineTune Lab knowledge vs base model hallucination",
                "categories": {
                    "ui_navigation": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'ui_navigation']),
                    "ui_workflow": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'ui_workflow']),
                    "file_paths": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'file_paths']),
                    "config_defaults": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'config_defaults']),
                    "api_endpoints": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'api_endpoints']),
                    "features": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'features']),
                    "backend": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'backend']),
                    "error_messages": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'error_messages']),
                    "calculations": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'calculations']),
                    "ui_features": len([q for q in SPECIFIC_QUESTIONS if q['category'] == 'ui_features']),
                }
            },
            "tests": [
                {
                    "id": f"specific_test_{i:02d}",
                    **q
                }
                for i, q in enumerate(SPECIFIC_QUESTIONS, 1)
            ]
        }, f, indent=2, ensure_ascii=False)

    # Format 3: Comparison template
    comparison_file = output_dir / "specific_test_25_comparison_template.txt"
    with open(comparison_file, 'w', encoding='utf-8') as f:
        f.write("FINETUNE LAB - BASE vs TRAINED MODEL COMPARISON\n")
        f.write("="*80 + "\n\n")
        f.write("Instructions:\n")
        f.write("1. Test base model first (current model on port 8004)\n")
        f.write("2. Record responses\n")
        f.write("3. Switch to trained model (Fine Tune Expert on port 8002)\n")
        f.write("4. Record responses\n")
        f.write("5. Compare accuracy\n\n")
        f.write("="*80 + "\n\n")

        for i, q in enumerate(SPECIFIC_QUESTIONS, 1):
            f.write(f"TEST {i:02d} [{q['category']}]\n")
            f.write(f"Q: {q['question']}\n\n")
            f.write(f"Expected Answer:\n{q['expected_answer']}\n\n")
            f.write(f"Base Model Response:\n")
            f.write("[ YOUR TEST RESULT HERE ]\n\n")
            f.write(f"Trained Model Response:\n")
            f.write("[ YOUR TEST RESULT HERE ]\n\n")
            f.write(f"Accuracy Score (0-10):\n")
            f.write("Base Model: __/10\n")
            f.write("Trained Model: __/10\n\n")
            f.write("="*80 + "\n\n")

    # Print summary
    print(f"\n{'='*80}")
    print("SPECIFIC TEST QUESTIONS GENERATED")
    print(f"{'='*80}\n")

    print(f"📊 Generated 25 hyper-specific questions\n")

    print("📁 Output Files:")
    print(f"  1. Prompts only: {prompts_file.name}")
    print(f"     → Quick testing in portal")
    print(f"\n  2. With expected answers: {full_file.name}")
    print(f"     → Reference for grading")
    print(f"\n  3. Comparison template: {comparison_file.name}")
    print(f"     → Side-by-side testing format\n")

    # Category breakdown
    print("📈 Category Distribution:")
    categories = {}
    for q in SPECIFIC_QUESTIONS:
        cat = q['category']
        categories[cat] = categories.get(cat, 0) + 1

    for cat in sorted(categories.keys()):
        count = categories[cat]
        bar = "█" * count
        print(f"  {cat:20s} [{count:2d}] {bar}")

    print(f"\n🎯 These questions are IMPOSSIBLE for base model to answer correctly")
    print(f"   They require knowledge of YOUR specific implementation\n")

    print(f"💡 Testing Strategy:")
    print(f"   1. Ask base model (port 8004) - expect hallucination/wrong answers")
    print(f"   2. Ask trained model (port 8002) - expect accurate specific answers")
    print(f"   3. Score accuracy: 0=wrong, 5=partial, 10=perfect")
    print(f"   4. Calculate average scores\n")

    print(f"✨ Questions ready for testing!\n")

if __name__ == "__main__":
    save_specific_tests()
