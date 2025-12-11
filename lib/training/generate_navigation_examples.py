#!/usr/bin/env python3
"""
Generate navigation training examples for FineTune Lab website
Teaches the model to guide users to specific pages, sections, and UI elements
"""

import json
import random
from typing import List, Dict, Any

# FineTune Lab website structure
WEBSITE_STRUCTURE = {
    "Dashboard": {
        "path": "/dashboard",
        "sections": {
            "Active Jobs": "View currently running training jobs with real-time metrics",
            "Recent Models": "Quick access to your recently trained models",
            "Quick Start": "Start a new training job",
            "System Status": "GPU availability and system health"
        }
    },
    "Training": {
        "path": "/training",
        "sections": {
            "New Training Job": "Configure and start a new training run",
            "Job History": "View all past training jobs",
            "Templates": "Pre-configured training templates"
        },
        "subsections": {
            "Model Selection": {
                "Base Model Dropdown": "Choose your foundation model",
                "Model Size Filter": "Filter by model size",
                "Model Family": "Filter by model family (Llama, Mistral, etc.)"
            },
            "Training Configuration": {
                "Method Selection": "Choose training method (SFT, LoRA, QLoRA, RLHF, DPO)",
                "SFT Tab": "Standard supervised fine-tuning parameters",
                "LoRA Tab": {
                    "LoRA Rank": "Rank of the LoRA matrices (r)",
                    "LoRA Alpha": "Scaling factor (alpha)",
                    "Target Modules": "Which modules to apply LoRA to",
                    "LoRA Dropout": "Dropout rate for LoRA layers"
                },
                "QLoRA Tab": {
                    "Quantization Bits": "4-bit or 8-bit quantization",
                    "BFloat16": "Use bfloat16 precision",
                    "Double Quantization": "Apply double quantization",
                    "Compute Dtype": "Computation data type"
                },
                "DPO Tab": {
                    "Beta Parameter": "DPO temperature parameter",
                    "Reference Model": "Reference model for DPO",
                    "Max Prompt Length": "Maximum prompt length"
                },
                "Hyperparameters": {
                    "Learning Rate": "Initial learning rate",
                    "Batch Size": "Training batch size per GPU",
                    "Gradient Accumulation": "Steps to accumulate gradients",
                    "Epochs": "Number of training epochs",
                    "Warmup Steps": "Learning rate warmup steps",
                    "Weight Decay": "L2 regularization",
                    "Max Grad Norm": "Gradient clipping threshold"
                },
                "Advanced Settings": {
                    "Mixed Precision": "FP16/BF16 training",
                    "Gradient Checkpointing": "Save memory by recomputing activations",
                    "Optimizer": "Choose optimizer (AdamW, SGD, etc.)",
                    "Scheduler": "Learning rate scheduler type"
                }
            },
            "Dataset Configuration": {
                "Dataset Upload": "Upload your training dataset",
                "Dataset Format": "JSONL, CSV, or Parquet",
                "Train/Val Split": "Split ratio for validation",
                "Data Preview": "Preview your dataset before training"
            }
        }
    },
    "Models": {
        "path": "/models",
        "sections": {
            "My Models": "All your trained models",
            "Model Cards": "Detailed model information",
            "Deployment": "Deploy models to inference",
            "Export": "Export models to HuggingFace or local"
        },
        "subsections": {
            "Model Details": {
                "Training Metrics": "Loss curves and training statistics",
                "Checkpoints": "Available model checkpoints",
                "Configuration": "Training configuration used",
                "Evaluation Results": "Validation metrics"
            }
        }
    },
    "Datasets": {
        "path": "/datasets",
        "sections": {
            "My Datasets": "Your uploaded datasets",
            "Upload Dataset": "Upload new training data",
            "Dataset Templates": "Example dataset formats",
            "Data Validation": "Check dataset quality"
        }
    },
    "Deployment": {
        "path": "/deployment",
        "sections": {
            "Active Deployments": "Currently running inference servers",
            "Deploy New Model": "Deploy a model to production",
            "API Keys": "Manage deployment API keys",
            "Monitoring": "Deployment health and metrics"
        },
        "subsections": {
            "Deployment Config": {
                "Model Selection": "Choose model to deploy",
                "GPU Allocation": "Select GPU for inference",
                "Max Batch Size": "Maximum inference batch size",
                "vLLM Settings": "vLLM engine configuration",
                "Quantization": "Inference quantization options"
            }
        }
    },
    "Monitoring": {
        "path": "/monitoring",
        "sections": {
            "Real-time Metrics": "Live training metrics",
            "GPU Utilization": "GPU usage and memory",
            "Training Progress": "Steps, epochs, and ETA",
            "Loss Curves": "Training and validation loss",
            "Resource Usage": "CPU, RAM, and disk usage"
        }
    },
    "Settings": {
        "path": "/settings",
        "sections": {
            "Account": "Account information and billing",
            "API Keys": "Generate and manage API keys",
            "Notifications": "Email and webhook alerts",
            "Integrations": "HuggingFace, GitHub, etc.",
            "GPU Preferences": "Default GPU settings"
        }
    }
}

# Common user questions and their navigation answers
NAVIGATION_PATTERNS = [
    # Model selection
    {
        "question": "Where do I select which model to finetune?",
        "answer": "Go to the **Training** page at `/training`, then in the **Model Selection** section you'll find the **Base Model Dropdown** where you can choose your foundation model."
    },
    {
        "question": "How do I filter models by size?",
        "answer": "On the **Training** page under **Model Selection**, use the **Model Size Filter** to narrow down models by parameter count."
    },

    # LoRA/QLoRA parameters
    {
        "question": "Where can I configure LoRA parameters?",
        "answer": "Navigate to **Training** > **Training Configuration** > **LoRA Tab**. There you'll find **LoRA Rank**, **LoRA Alpha**, **Target Modules**, and **LoRA Dropout** settings."
    },
    {
        "question": "What's the difference between LoRA and QLoRA settings?",
        "answer": "In the **Training Configuration** section, you'll see separate tabs:\n- **LoRA Tab**: Standard LoRA parameters (rank, alpha, target modules)\n- **QLoRA Tab**: Adds quantization options like **Quantization Bits** (4-bit/8-bit), **BFloat16**, and **Double Quantization**"
    },
    {
        "question": "Where is the bfloat16 parameter?",
        "answer": "The **BFloat16** option is in the **Training Configuration** section under the **QLoRA Tab**, right next to **Quantization Bits**."
    },

    # Hyperparameters
    {
        "question": "Where do I set the learning rate?",
        "answer": "Go to **Training** > **Training Configuration** > **Hyperparameters**. You'll find **Learning Rate** along with other training parameters."
    },
    {
        "question": "How do I adjust batch size and gradient accumulation?",
        "answer": "In the **Training Configuration** section under **Hyperparameters**, you'll find both **Batch Size** and **Gradient Accumulation** next to each other."
    },

    # Dataset
    {
        "question": "Where do I upload my training data?",
        "answer": "You have two options:\n1. **Training** page > **Dataset Configuration** > **Dataset Upload**\n2. **Datasets** page > **Upload Dataset** for reusable datasets"
    },
    {
        "question": "Can I preview my dataset before training?",
        "answer": "Yes! In the **Training** page under **Dataset Configuration**, there's a **Data Preview** section that shows sample rows from your dataset."
    },

    # Monitoring
    {
        "question": "How do I view real-time training metrics?",
        "answer": "Go to the **Monitoring** page at `/monitoring` to see **Real-time Metrics** including loss curves, GPU utilization, and training progress."
    },
    {
        "question": "Where can I see my loss curves?",
        "answer": "The **Monitoring** page has a dedicated **Loss Curves** section showing both training and validation loss over time."
    },

    # Deployment
    {
        "question": "How do I deploy a trained model?",
        "answer": "Navigate to **Deployment** > **Deploy New Model**, then in the **Deployment Config** section, select your model and configure inference settings."
    },
    {
        "question": "Where do I configure vLLM settings?",
        "answer": "In the **Deployment** page under **Deployment Config**, you'll find **vLLM Settings** where you can configure the inference engine."
    },
]

def generate_direct_navigation_examples() -> List[Dict[str, Any]]:
    """Generate examples of direct 'where is X' questions"""
    examples = []

    templates = [
        "Where can I find {}?",
        "Where is the {} located?",
        "How do I get to {}?",
        "Where do I access {}?",
        "I can't find {}. Where is it?",
        "What page has {}?",
    ]

    for page, config in WEBSITE_STRUCTURE.items():
        for section, description in config.get("sections", {}).items():
            question = random.choice(templates).format(section)

            answer = f"You can find **{section}** on the **{page}** page at `{config['path']}`. {description}"

            examples.append({
                "conversations": [
                    {"from": "system", "value": "You are a helpful assistant for FineTune Lab. Guide users through the interface by directing them to specific pages and sections."},
                    {"from": "user", "value": question},
                    {"from": "assistant", "value": answer}
                ]
            })

    return examples

def generate_parameter_location_examples() -> List[Dict[str, Any]]:
    """Generate examples for finding specific parameters"""
    examples = []

    for page, config in WEBSITE_STRUCTURE.items():
        subsections = config.get("subsections", {})

        for subsection_name, subsection_data in subsections.items():
            if isinstance(subsection_data, dict):
                for param_name, param_desc in subsection_data.items():
                    if isinstance(param_desc, str):
                        # Simple parameter
                        question = random.choice([
                            f"Where do I configure {param_name}?",
                            f"How do I set {param_name}?",
                            f"Where is the {param_name} parameter?",
                            f"I need to adjust {param_name}. Where is it?",
                        ])

                        answer = f"The **{param_name}** parameter is located on the **{page}** page under **{subsection_name}**. {param_desc}"

                        examples.append({
                            "conversations": [
                                {"from": "system", "value": "You are a helpful assistant for FineTune Lab. Guide users to specific parameters and settings."},
                                {"from": "user", "value": question},
                                {"from": "assistant", "value": answer}
                            ]
                        })
                    elif isinstance(param_desc, dict):
                        # Nested parameters (like LoRA Tab, QLoRA Tab)
                        for nested_param, nested_desc in param_desc.items():
                            question = random.choice([
                                f"Where can I find {nested_param}?",
                                f"How do I configure {nested_param}?",
                                f"Where is {nested_param} located?",
                            ])

                            answer = f"Navigate to **{page}** > **{subsection_name}** > **{param_name}**. There you'll find **{nested_param}**: {nested_desc}"

                            examples.append({
                                "conversations": [
                                    {"from": "system", "value": "You are a helpful assistant for FineTune Lab. Provide precise navigation to UI elements."},
                                    {"from": "user", "value": question},
                                    {"from": "assistant", "value": answer}
                                ]
                            })

    return examples

def generate_task_based_navigation() -> List[Dict[str, Any]]:
    """Generate examples for 'how do I do X' task-based navigation"""
    examples = []

    tasks = [
        {
            "task": "start a new training job",
            "steps": [
                "1. Go to the **Training** page at `/training`",
                "2. Click on **New Training Job** in the top section",
                "3. Select your **Base Model** from the dropdown in **Model Selection**",
                "4. Choose your training **Method** (SFT, LoRA, QLoRA, etc.) in **Training Configuration**",
                "5. Configure **Hyperparameters** like learning rate and batch size",
                "6. Upload your dataset in **Dataset Configuration**",
                "7. Click **Start Training** to begin"
            ]
        },
        {
            "task": "deploy a trained model",
            "steps": [
                "1. Navigate to the **Deployment** page at `/deployment`",
                "2. Click **Deploy New Model**",
                "3. In **Deployment Config**, select your trained model from **Model Selection**",
                "4. Choose **GPU Allocation** for inference",
                "5. Configure **vLLM Settings** for optimal performance",
                "6. Click **Deploy** to start the inference server"
            ]
        },
        {
            "task": "configure LoRA training",
            "steps": [
                "1. On the **Training** page, select your base model",
                "2. In **Training Configuration**, click the **LoRA Tab**",
                "3. Set **LoRA Rank** (typically 8, 16, or 32)",
                "4. Configure **LoRA Alpha** (often 2x the rank)",
                "5. Choose **Target Modules** (q_proj, v_proj recommended)",
                "6. Optionally set **LoRA Dropout** for regularization"
            ]
        },
        {
            "task": "use QLoRA for memory-efficient training",
            "steps": [
                "1. Go to **Training** > **Training Configuration**",
                "2. Select the **QLoRA Tab**",
                "3. Set **Quantization Bits** to 4-bit for maximum memory savings",
                "4. Enable **BFloat16** for better numerical stability",
                "5. Turn on **Double Quantization** to save even more memory",
                "6. In **Hyperparameters**, enable **Gradient Checkpointing** under **Advanced Settings**"
            ]
        },
        {
            "task": "monitor training progress",
            "steps": [
                "1. Navigate to the **Monitoring** page at `/monitoring`",
                "2. View **Real-time Metrics** for current training statistics",
                "3. Check **Loss Curves** to see training and validation loss",
                "4. Monitor **GPU Utilization** to ensure efficient resource usage",
                "5. Track **Training Progress** for steps completed and time remaining"
            ]
        },
        {
            "task": "upload and validate a dataset",
            "steps": [
                "1. Go to the **Datasets** page at `/datasets`",
                "2. Click **Upload Dataset**",
                "3. Choose your file (**Dataset Format** supports JSONL, CSV, Parquet)",
                "4. Click **Data Validation** to check for format errors",
                "5. Review the validation report for any issues",
                "6. Once validated, the dataset is ready for training"
            ]
        },
    ]

    for task_info in tasks:
        question = random.choice([
            f"How do I {task_info['task']}?",
            f"Can you walk me through how to {task_info['task']}?",
            f"What are the steps to {task_info['task']}?",
            f"I want to {task_info['task']}. How do I do it?",
        ])

        answer = f"Here's how to {task_info['task']}:\n\n" + "\n".join(task_info['steps'])

        examples.append({
            "conversations": [
                {"from": "system", "value": "You are a helpful assistant for FineTune Lab. Provide step-by-step guidance for completing tasks."},
                {"from": "user", "value": question},
                {"from": "assistant", "value": answer}
            ]
        })

    return examples

def generate_comparison_navigation() -> List[Dict[str, Any]]:
    """Generate examples comparing related UI elements"""
    examples = []

    comparisons = [
        {
            "question": "What's the difference between the LoRA tab and QLoRA tab?",
            "answer": "Both tabs are in **Training Configuration**, but they serve different purposes:\n\n**LoRA Tab:**\n- Standard LoRA parameters\n- **LoRA Rank**, **Alpha**, **Target Modules**, **Dropout**\n- No quantization, full precision training\n\n**QLoRA Tab:**\n- Includes all LoRA settings PLUS quantization\n- **Quantization Bits** (4-bit/8-bit)\n- **BFloat16** option (right next to Quantization Bits)\n- **Double Quantization** for extra memory savings\n- More memory-efficient but slightly different training dynamics"
        },
        {
            "question": "Should I upload my dataset in the Training page or Datasets page?",
            "answer": "You can use either, depending on your needs:\n\n**Training page** > **Dataset Configuration** > **Dataset Upload**:\n- Quick one-time use for a specific training job\n- Faster if you don't plan to reuse the dataset\n\n**Datasets page** > **Upload Dataset**:\n- Creates a reusable dataset\n- Better for datasets you'll use multiple times\n- Includes **Data Validation** tools\n- Shows up in **My Datasets** for future jobs"
        },
        {
            "question": "Where do I see metrics - Monitoring or Models page?",
            "answer": "Both pages show metrics, but for different purposes:\n\n**Monitoring page** (`/monitoring`):\n- **Real-time** metrics during active training\n- Live **Loss Curves**, **GPU Utilization**, **Training Progress**\n- Best for watching ongoing training jobs\n\n**Models page** (`/models`) > **Model Details**:\n- **Historical** metrics after training completes\n- Final **Training Metrics**, **Checkpoints**, **Evaluation Results**\n- Best for reviewing completed models"
        },
    ]

    for comparison in comparisons:
        examples.append({
            "conversations": [
                {"from": "system", "value": "You are a helpful assistant for FineTune Lab. Help users understand the interface organization."},
                {"from": "user", "value": comparison["question"]},
                {"from": "assistant", "value": comparison["answer"]}
            ]
        })

    return examples

def generate_contextual_navigation() -> List[Dict[str, Any]]:
    """Generate examples with contextual follow-up questions"""
    examples = []

    conversations = [
        {
            "messages": [
                {"from": "system", "value": "You are a helpful assistant for FineTune Lab."},
                {"from": "user", "value": "I want to use less GPU memory during training"},
                {"from": "assistant", "value": "For memory-efficient training, I recommend using QLoRA. Here's where to configure it:\n\n1. Go to **Training** > **Training Configuration** > **QLoRA Tab**\n2. Set **Quantization Bits** to **4-bit** (most memory savings)\n3. Enable **BFloat16** (right next to Quantization Bits)\n4. Turn on **Double Quantization**\n5. In **Advanced Settings** under **Hyperparameters**, enable **Gradient Checkpointing**\n\nThis combination can reduce memory usage by 60-75%."},
                {"from": "user", "value": "Where exactly is gradient checkpointing?"},
                {"from": "assistant", "value": "**Gradient Checkpointing** is located in:\n\n**Training** > **Training Configuration** > **Hyperparameters** > **Advanced Settings**\n\nIt's in the expandable **Advanced Settings** section at the bottom of the Hyperparameters area. Look for the toggle labeled **Gradient Checkpointing**."}
            ]
        },
        {
            "messages": [
                {"from": "system", "value": "You are a helpful assistant for FineTune Lab."},
                {"from": "user", "value": "How do I know if my training is going well?"},
                {"from": "assistant", "value": "Check the **Monitoring** page at `/monitoring`. Look for these indicators:\n\n1. **Loss Curves** section:\n   - Training loss should be decreasing\n   - Validation loss should follow training loss\n   - If val loss increases while train loss decreases = overfitting\n\n2. **GPU Utilization** section:\n   - Should be 80%+ for efficient training\n   - Low utilization means you could increase batch size\n\n3. **Training Progress**:\n   - Check estimated time remaining\n   - Verify steps per second is consistent"},
                {"from": "user", "value": "What if I see my validation loss increasing?"},
                {"from": "assistant", "value": "That's overfitting. Here's how to address it:\n\n1. Stop the current training from the **Monitoring** page\n2. Go back to **Training** > **Training Configuration** > **Hyperparameters**\n3. Adjust these settings:\n   - Reduce **Epochs** (train for fewer iterations)\n   - Increase **Weight Decay** (add L2 regularization)\n   - Lower **Learning Rate**\n   - In the **LoRA Tab** or **QLoRA Tab**, increase **LoRA Dropout**\n4. In **Dataset Configuration**, increase your **Train/Val Split** to have more validation data"}
            ]
        },
    ]

    for conv in conversations:
        examples.append({"conversations": conv["messages"]})

    return examples

def main():
    print("🧭 Generating navigation training examples...\n")

    all_examples = []

    # Generate different types of navigation examples
    example_types = [
        ("Direct navigation (where is X)", generate_direct_navigation_examples),
        ("Parameter locations", generate_parameter_location_examples),
        ("Task-based navigation (how do I)", generate_task_based_navigation),
        ("Comparisons", generate_comparison_navigation),
        ("Contextual conversations", generate_contextual_navigation),
    ]

    for name, generator_func in example_types:
        examples = generator_func()
        print(f"✓ Generated {len(examples)} {name} examples")
        all_examples.extend(examples)

    # Shuffle to mix types
    random.shuffle(all_examples)

    # Save to file
    output_path = "/home/juan-canfield/Desktop/web-ui/output/In_progress/navigation_examples.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(all_examples, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Generated {len(all_examples)} total navigation examples")
    print(f"💾 Saved to: {output_path}")

    # Show breakdown
    print(f"\n📊 Breakdown:")
    for name, generator_func in example_types:
        count = len(generator_func())
        pct = (count / len(all_examples)) * 100
        print(f"  {name}: {count} ({pct:.1f}%)")

if __name__ == "__main__":
    random.seed(42)
    main()
