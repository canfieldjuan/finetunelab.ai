#!/usr/bin/env python3
"""
Generate synthetic finetuning workflow examples for FineTune Lab agent training
Creates 5,000 diverse examples covering various ML tasks, models, and scenarios
"""

import json
import random
from typing import List, Dict, Any

# Configuration data pools
TASKS = {
    "sentiment_analysis": {
        "datasets": ["imdb", "sst2", "yelp_reviews", "amazon_reviews", "twitter_sentiment"],
        "models": ["distilbert-base-uncased", "roberta-base", "bert-base-uncased", "albert-base-v2"],
        "metrics": ["accuracy", "f1_score", "precision_recall"],
        "base_lr": 2e-5
    },
    "named_entity_recognition": {
        "datasets": ["conll2003", "ontonotes5", "wnut17", "biomedical_ner"],
        "models": ["bert-base-cased", "roberta-base", "xlm-roberta-base"],
        "metrics": ["entity_f1", "precision_recall_per_entity"],
        "base_lr": 2e-5
    },
    "text_classification": {
        "datasets": ["ag_news", "dbpedia", "yahoo_answers", "20newsgroups"],
        "models": ["distilbert-base-uncased", "roberta-base", "electra-base"],
        "metrics": ["accuracy", "macro_f1", "confusion_matrix"],
        "base_lr": 3e-5
    },
    "question_answering": {
        "datasets": ["squad", "squad_v2", "natural_questions", "trivia_qa"],
        "models": ["bert-large-uncased", "roberta-large", "electra-large"],
        "metrics": ["exact_match", "f1_score"],
        "base_lr": 3e-5
    },
    "summarization": {
        "datasets": ["cnn_dailymail", "xsum", "multi_news", "arxiv"],
        "models": ["t5-base", "bart-base", "pegasus-base"],
        "metrics": ["rouge_l", "rouge_1", "rouge_2", "bleu"],
        "base_lr": 3e-5
    },
    "translation": {
        "datasets": ["wmt14_en_de", "wmt16_en_ro", "opus_100"],
        "models": ["t5-base", "mbart-large", "m2m_100"],
        "metrics": ["bleu", "meteor", "chrf"],
        "base_lr": 5e-5
    },
    "code_generation": {
        "datasets": ["code_x_glue", "codeparrot", "the_stack"],
        "models": ["codegen-350M", "code-t5-base", "starcoder"],
        "metrics": ["pass_at_k", "code_bleu"],
        "base_lr": 1e-4
    },
    "tool_use": {
        "datasets": ["toolbench", "api_bank", "custom_tool_dataset"],
        "models": ["gpt2", "llama-7b", "mistral-7b"],
        "metrics": ["tool_accuracy", "argument_f1"],
        "base_lr": 5e-5
    },
    "instruction_following": {
        "datasets": ["alpaca", "dolly", "oasst1", "sharegpt"],
        "models": ["llama-7b", "mistral-7b", "phi-2"],
        "metrics": ["win_rate", "helpfulness_score"],
        "base_lr": 2e-5
    },
    "code_repair": {
        "datasets": ["bugs2fix", "code_review_comments"],
        "models": ["code-t5-base", "codet5p-220m"],
        "metrics": ["fix_accuracy", "test_pass_rate"],
        "base_lr": 1e-4
    }
}

SYSTEM_PROMPTS = [
    "You are a finetuning expert. Your goal is to help users finetune models for their specific tasks. You have access to a set of tools to help you with this. You should always follow the MLOps best practices, including: infrastructure planning, data engineering, deployment architecture, monitoring, security, and continuous learning.",
    "You are a finetuning expert. Follow MLOps best practices and suggest infra and cost-efficient strategies.",
    "You are a finetuning expert. Provide evaluation and calibration patterns.",
    "You are a finetuning expert. Focus on model efficiency and quantization.",
    "You are a finetuning expert. Provide active learning guidance.",
    "You are a finetuning expert. Help with safety and guardrails for instruction-following models.",
    "You are a finetuning expert. Provide guidance on continuous evaluation and drift detection.",
    "You are a finetuning expert. Create instruction-following examples with constraints.",
    "You are a finetuning expert. Add examples for code repair and unit-test generation.",
    "You are a finetuning expert. Provide examples for multilingual transfer learning.",
    "You are a finetuning expert specializing in data quality, preprocessing, and augmentation.",
    "You are a finetuning expert with deep knowledge of hyperparameter optimization and AutoML.",
]

DEBUGGING_ISSUES = [
    "training loss is NaN",
    "model is overfitting badly",
    "validation loss plateaued",
    "GPU memory overflow",
    "training is very slow",
    "poor generalization to test set",
    "class imbalance affecting performance",
    "gradient explosion detected",
]

def generate_basic_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a standard training workflow"""
    dataset = random.choice(task_config["datasets"])
    model = random.choice(task_config["models"])

    lr_variation = random.uniform(0.5, 2.0)
    learning_rate = task_config["base_lr"] * lr_variation
    batch_size = random.choice([8, 16, 32])
    epochs = random.randint(2, 5)

    project_name = f"{task}_{dataset.replace('/', '_')}"

    user_message = f"I want to finetune a model for {task.replace('_', ' ')} on the {dataset} dataset."

    conversations = [
        {"from": "system", "value": random.choice(SYSTEM_PROMPTS)},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "project.init", "args": {"project_name": project_name}})},
        {"from": "assistant", "value": json.dumps({"tool": "data.find", "args": {"task_description": f"{task.replace('_', ' ')} on {dataset}"}})},
        {"from": "assistant", "value": json.dumps({"tool": "model.select", "args": {"base_model": model, "finetuning_task": task}})},
        {"from": "assistant", "value": json.dumps({"tool": "hyperparameters.recommend", "args": {"model": model, "dataset": dataset}})},
        {"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": dataset,
            "hyperparameters": {
                "learning_rate": learning_rate,
                "batch_size": batch_size,
                "num_train_epochs": epochs
            }
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "train.run", "args": {"script_path": f"{project_name}/train.py"}})},
        {"from": "assistant", "value": json.dumps({"tool": "evaluate.run", "args": {
            "model_path": f"{project_name}/results/best_model",
            "dataset_path": f"{dataset}/test"
        }})}
    ]

    return {"conversations": conversations}

def generate_debugging_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a debugging/troubleshooting workflow"""
    issue = random.choice(DEBUGGING_ISSUES)
    dataset = random.choice(task_config["datasets"])
    model = random.choice(task_config["models"])

    project_name = f"{task}_{dataset.replace('/', '_')}"

    user_message = f"I'm trying to finetune a model for {task.replace('_', ' ')}, but my {issue}. Can you help me fix it?"

    conversations = [
        {"from": "system", "value": "You are a finetuning expert. You are also an expert at debugging training issues."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "debug.analyze_log", "args": {"log_file": f"{project_name}/training.log"}})},
        {"from": "assistant", "value": json.dumps({"tool": "debug.suggest_fix", "args": {"error_message": issue}})},
    ]

    # Add fixes based on issue type
    if "NaN" in issue:
        conversations.append({"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": dataset,
            "hyperparameters": {
                "learning_rate": 1e-5,
                "batch_size": 16,
                "num_train_epochs": 3,
                "gradient_clipping": 1.0
            }
        }})})
    elif "overfitting" in issue:
        conversations.append({"from": "assistant", "value": json.dumps({"tool": "data.augment", "args": {
            "dataset_path": f"datasets/{dataset}",
            "methods": ["back_translation", "synonym_replacement"],
            "target_per_class": 5000
        }})})
        conversations.append({"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": dataset,
            "hyperparameters": {
                "learning_rate": 2e-5,
                "batch_size": 32,
                "num_train_epochs": 3,
                "weight_decay": 0.01,
                "dropout": 0.1
            }
        }})})
    elif "memory" in issue:
        conversations.append({"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": dataset,
            "hyperparameters": {
                "learning_rate": 3e-5,
                "batch_size": 4,
                "gradient_accumulation_steps": 4,
                "num_train_epochs": 3,
                "fp16": True
            }
        }})})

    conversations.append({"from": "assistant", "value": json.dumps({"tool": "train.run", "args": {"script_path": f"{project_name}/train_fixed.py"}})})

    return {"conversations": conversations}

def generate_data_quality_workflow() -> Dict[str, Any]:
    """Generate a data quality and preprocessing workflow"""
    task = random.choice(list(TASKS.keys()))
    dataset_name = f"custom_{task}_data"

    user_message = random.choice([
        f"I have a noisy labeled dataset for {task.replace('_', ' ')}. How do I detect and fix label noise before finetuning?",
        f"My {task.replace('_', ' ')} dataset has class imbalance. How should I handle it?",
        f"I need to clean and preprocess my {task.replace('_', ' ')} dataset. What steps should I take?",
    ])

    conversations = [
        {"from": "system", "value": "You are a finetuning expert specializing in data quality, preprocessing, and augmentation."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "data.quality_report", "args": {
            "dataset_path": f"datasets/{dataset_name}.csv",
            "checks": ["class_balance", "duplicate_rows", "label_conflict_detection", "missing_values"]
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "data.clean", "args": {
            "dataset_path": f"datasets/{dataset_name}.csv",
            "strategy": {
                "duplicate_strategy": "dedupe_keep_majority",
                "label_mismatch": "human_review_batch_500",
                "missing_value_strategy": "drop"
            }
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "data.augment", "args": {
            "dataset_path": f"datasets/{dataset_name}_cleaned.csv",
            "methods": ["back_translation", "synonym_replacement", "random_insertion"],
            "target_per_class": 5000
        }})}
    ]

    return {"conversations": conversations}

def generate_deployment_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a deployment and infrastructure workflow"""
    model = random.choice(task_config["models"])

    deployment_targets = ["aws", "gcp", "azure", "kubernetes"]
    target = random.choice(deployment_targets)

    user_message = random.choice([
        f"I want to deploy a finetuning pipeline that trains nightly on new labeled data using spot instances. Give me an actionable plan.",
        f"How do I set up continuous training and deployment for my {task.replace('_', ' ')} model?",
        f"I need to deploy my {task.replace('_', ' ')} model to production with monitoring. What's the best approach?",
    ])

    conversations = [
        {"from": "system", "value": "You are a finetuning expert. Follow MLOps best practices and suggest infra and cost-efficient strategies."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "infra.plan", "args": {
            "target": target,
            "components": ["s3:artifact_storage", "ecs:training_service", "rds:metadata", "cloudwatch:monitoring"],
            "spot_strategy": {"max_bid_pct": 70, "checkpoint_interval_min": 15}
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "ci.create_pipeline", "args": {
            "pipeline_name": "nightly-finetune",
            "triggers": ["cron:0 2 * * *"],
            "steps": ["fetch-new-data", "validate", "train", "evaluate", "promote_if_pass"]
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "monitor.drift_setup", "args": {
            "sensors": ["feature_distribution", "prediction_distribution", "per_class_accuracy"],
            "alert_thresholds": {"ks_pval": 0.01, "accuracy_drop_pct": 5}
        }})}
    ]

    return {"conversations": conversations}

def generate_optimization_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a model optimization/compression workflow"""
    model = random.choice(task_config["models"])

    user_message = random.choice([
        f"I need to reduce my {task.replace('_', ' ')} model size and latency for mobile deployment. Recommend steps for quantization.",
        f"How can I optimize my {task.replace('_', ' ')} model for edge devices?",
        f"I want to distill my large model into a smaller one for production. What's the process?",
    ])

    conversations = [
        {"from": "system", "value": "You are a finetuning expert. Focus on model efficiency and quantization."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "model.optimize", "args": {
            "techniques": ["int8_quantization", "knowledge_distillation"],
            "workflow": {
                "distil_teacher": model,
                "student": f"{model}-small",
                "epochs": 3
            }
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "benchmark.run", "args": {
            "model_path": "artifacts/student_int8",
            "devices": ["cpu_arm", "mobile_gpu"],
            "latency_target_ms": 80
        }})}
    ]

    return {"conversations": conversations}

def generate_active_learning_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate an active learning workflow"""

    user_message = f"My labeled data for {task.replace('_', ' ')} is small. How do I set up active learning loop to pick samples for annotation?"

    conversations = [
        {"from": "system", "value": "You are a finetuning expert. Provide active learning guidance."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "active.setup", "args": {
            "uncertainty_strategy": random.choice(["entropy", "least_confidence", "margin_sampling"]),
            "batch_size": random.choice([50, 100, 200]),
            "annotator_api": "internal"
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "data.select_for_labeling", "args": {
            "unlabeled_pool": "datasets/unlabeled_pool.jsonl",
            "strategy": "entropy_top_k",
            "k": 100
        }})}
    ]

    return {"conversations": conversations}

def generate_hyperparameter_tuning_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a hyperparameter optimization workflow"""
    model = random.choice(task_config["models"])
    dataset = random.choice(task_config["datasets"])

    user_message = random.choice([
        f"I want to find the best hyperparameters for {task.replace('_', ' ')} on {dataset}. What approach should I use?",
        f"How do I automate hyperparameter search for my {task.replace('_', ' ')} model?",
        f"I need to optimize learning rate and batch size for {task.replace('_', ' ')}. Help me set up a search.",
    ])

    search_strategy = random.choice(["grid", "random", "bayesian", "hyperband"])

    conversations = [
        {"from": "system", "value": "You are a finetuning expert with deep knowledge of hyperparameter optimization and AutoML."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "hpo.configure", "args": {
            "strategy": search_strategy,
            "param_space": {
                "learning_rate": {"type": "log_uniform", "min": 1e-6, "max": 1e-3},
                "batch_size": {"type": "choice", "values": [8, 16, 32, 64]},
                "num_epochs": {"type": "int_uniform", "min": 2, "max": 10}
            },
            "metric": "eval_loss",
            "direction": "minimize",
            "num_trials": 20
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "hpo.run", "args": {
            "model": model,
            "dataset": dataset,
            "config_path": "hpo_config.json"
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "hpo.get_best", "args": {
            "trial_id": "best",
            "save_path": f"{task}_{dataset}/best_config.json"
        }})}
    ]

    return {"conversations": conversations}

def generate_multimodal_workflow() -> Dict[str, Any]:
    """Generate a multimodal training workflow"""

    tasks = ["image_captioning", "visual_question_answering", "text_to_image", "video_understanding"]
    task = random.choice(tasks)

    models = ["clip-base", "blip-base", "flamingo", "llava"]
    model = random.choice(models)

    user_message = f"I want to finetune a model for {task.replace('_', ' ')}. What's the best approach?"

    conversations = [
        {"from": "system", "value": "You are a finetuning expert specializing in multimodal models."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "project.init", "args": {"project_name": f"multimodal_{task}"}})},
        {"from": "assistant", "value": json.dumps({"tool": "model.select", "args": {
            "base_model": model,
            "finetuning_task": task,
            "modalities": ["vision", "text"]
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "data.preprocess_multimodal", "args": {
            "image_size": 224,
            "augmentations": ["random_crop", "color_jitter"],
            "text_max_length": 512
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": f"{task}_dataset",
            "hyperparameters": {
                "learning_rate": 5e-5,
                "batch_size": 16,
                "num_train_epochs": 3,
                "warmup_ratio": 0.1
            },
            "is_multimodal": True
        }})}
    ]

    return {"conversations": conversations}

def generate_lora_peft_workflow(task: str, task_config: Dict) -> Dict[str, Any]:
    """Generate a LoRA/PEFT workflow"""
    model = random.choice(task_config["models"])
    dataset = random.choice(task_config["datasets"])

    user_message = random.choice([
        f"I want to finetune a large model for {task.replace('_', ' ')} but have limited GPU memory. What should I do?",
        f"How can I use LoRA to finetune {model} efficiently?",
        f"I need parameter-efficient finetuning for {task.replace('_', ' ')}. What are my options?",
    ])

    peft_method = random.choice(["lora", "qlora", "adapter", "prefix_tuning"])

    conversations = [
        {"from": "system", "value": "You are a finetuning expert specializing in parameter-efficient methods."},
        {"from": "user", "value": user_message},
        {"from": "assistant", "value": json.dumps({"tool": "peft.configure", "args": {
            "method": peft_method,
            "rank": random.choice([8, 16, 32, 64]),
            "alpha": random.choice([16, 32, 64]),
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
            "dropout": 0.05
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "script.generate", "args": {
            "model": model,
            "dataset": dataset,
            "hyperparameters": {
                "learning_rate": 1e-4,
                "batch_size": 8,
                "num_train_epochs": 3
            },
            "use_peft": True,
            "peft_config": f"{peft_method}_config.json"
        }})},
        {"from": "assistant", "value": json.dumps({"tool": "train.run", "args": {
            "script_path": f"{task}_{dataset}/train_peft.py",
            "gradient_checkpointing": True
        }})}
    ]

    return {"conversations": conversations}

def main():
    """Generate 5,000 diverse finetuning examples"""
    print("🎯 Generating 5,000 finetuning workflow examples...\n")

    examples = []

    # Distribution of example types
    workflow_types = [
        ("basic", 2000),           # Standard workflows
        ("debugging", 800),        # Troubleshooting
        ("data_quality", 500),     # Data preprocessing
        ("deployment", 400),       # MLOps/deployment
        ("optimization", 400),     # Model compression
        ("active_learning", 200),  # Active learning
        ("hpo", 300),             # Hyperparameter tuning
        ("multimodal", 200),      # Multimodal
        ("peft", 200),            # LoRA/PEFT
    ]

    for workflow_type, count in workflow_types:
        print(f"Generating {count} {workflow_type} examples...")

        for i in range(count):
            if workflow_type == "basic":
                task = random.choice(list(TASKS.keys()))
                example = generate_basic_workflow(task, TASKS[task])
            elif workflow_type == "debugging":
                task = random.choice(list(TASKS.keys()))
                example = generate_debugging_workflow(task, TASKS[task])
            elif workflow_type == "data_quality":
                example = generate_data_quality_workflow()
            elif workflow_type == "deployment":
                task = random.choice(list(TASKS.keys()))
                example = generate_deployment_workflow(task, TASKS[task])
            elif workflow_type == "optimization":
                task = random.choice(list(TASKS.keys()))
                example = generate_optimization_workflow(task, TASKS[task])
            elif workflow_type == "active_learning":
                task = random.choice(list(TASKS.keys()))
                example = generate_active_learning_workflow(task, TASKS[task])
            elif workflow_type == "hpo":
                task = random.choice(list(TASKS.keys()))
                example = generate_hyperparameter_tuning_workflow(task, TASKS[task])
            elif workflow_type == "multimodal":
                example = generate_multimodal_workflow()
            elif workflow_type == "peft":
                task = random.choice(list(TASKS.keys()))
                example = generate_lora_peft_workflow(task, TASKS[task])

            examples.append(example)

    # Shuffle to mix workflow types
    random.shuffle(examples)

    # Save to file
    output_path = "/home/juan-canfield/Desktop/web-ui/output/In_progress/finetuning_workflows_5k.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(examples, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Generated {len(examples)} examples")
    print(f"💾 Saved to: {output_path}")

    # Generate statistics
    print(f"\n📊 Distribution:")
    for workflow_type, count in workflow_types:
        pct = (count / len(examples)) * 100
        print(f"  {workflow_type}: {count} ({pct:.1f}%)")

if __name__ == "__main__":
    random.seed(42)  # For reproducibility
    main()
