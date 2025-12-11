# Claude Training Loader - SFT Trainer
# Date: 2025-10-16
# Purpose: Supervised Fine-Tuning with LoRA support

import json
import torch
from pathlib import Path
from typing import Dict, List, Any, Optional
from datasets import Dataset, load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
)
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer as TRLSFTTrainer

class SFTTrainer:
    """Supervised Fine-Tuning trainer with LoRA support."""

    def __init__(self, config: Dict[str, Any], dataset_files: List[str]):
        """Initialize SFT trainer with config and dataset files."""
        self.config = config
        self.dataset_files = dataset_files
        self.model = None
        self.tokenizer = None
        self.dataset = None

        print(f"[SFTTrainer] Initialized with {len(dataset_files)} dataset(s)")

    def load_model_and_tokenizer(self):
        """Load model and tokenizer from config."""
        model_config = self.config.get("config_json", {}).get("model", {})
        tokenizer_config = self.config.get("config_json", {}).get("tokenizer", {})

        model_name = model_config.get("name", "gpt2")
        device_map = model_config.get("device_map", "auto")
        torch_dtype_str = model_config.get("torch_dtype", "float16")

        torch_dtype = getattr(torch, torch_dtype_str, torch.float16)

        print(f"[SFTTrainer] Loading model: {model_name}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_config.get("name", model_name),
            trust_remote_code=tokenizer_config.get("trust_remote_code", False)
        )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        self.model = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=model_config.get("trust_remote_code", False),
            torch_dtype=torch_dtype,
            device_map=device_map
        )

        print(f"[SFTTrainer] Model loaded on device: {device_map}")

    def setup_lora(self):
        """Setup LoRA if enabled in config."""
        training_config = self.config.get("config_json", {}).get("training", {})
        use_lora = training_config.get("use_lora", True)

        if not use_lora:
            print("[SFTTrainer] LoRA disabled, using full fine-tuning")
            return

        lora_r = training_config.get("lora_r", 8)
        lora_alpha = training_config.get("lora_alpha", 16)
        lora_dropout = training_config.get("lora_dropout", 0.05)

        print(f"[SFTTrainer] Setting up LoRA (r={lora_r}, alpha={lora_alpha})")

        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=lora_r,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            target_modules=["q_proj", "v_proj"],
            bias="none",
        )

        self.model = get_peft_model(self.model, lora_config)
        self.model.print_trainable_parameters()

    def prepare_dataset(self):
        """Load and prepare dataset from JSONL files."""
        print(f"[SFTTrainer] Loading {len(self.dataset_files)} dataset file(s)")

        all_examples = []

        for file_path in self.dataset_files:
            with open(file_path, "r") as f:
                for line in f:
                    example = json.loads(line.strip())
                    all_examples.append(example)

        print(f"[SFTTrainer] Loaded {len(all_examples)} examples")

        self.dataset = Dataset.from_list(all_examples)
        training_config = self.config.get("config_json", {}).get("training", {})
        max_samples = self.config.get("config_json", {}).get("data", {}).get("max_samples")

        if max_samples and max_samples < len(self.dataset):
            self.dataset = self.dataset.select(range(max_samples))
            print(f"[SFTTrainer] Limited to {max_samples} examples")

    def _format_chatml(self, conversation: List[Dict]) -> str:
        """Format ChatML conversation to text."""
        parts = []
        for msg in conversation:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            parts.append(f"<|{role}|>\n{content}\n")
        return "".join(parts)

    def _format_sharegpt(self, conversation: Dict) -> str:
        """Format ShareGPT conversation to text."""
        parts = []
        for turn in conversation.get("conversations", []):
            from_role = "user" if turn.get("from") == "human" else "assistant"
            value = turn.get("value", "")
            parts.append(f"<|{from_role}|>\n{value}\n")
        return "".join(parts)

    def formatting_func(self, example):
        """Format example for SFT training."""
        if isinstance(example, list):
            return self._format_chatml(example)
        elif isinstance(example, dict) and "conversations" in example:
            return self._format_sharegpt(example)
        else:
            return str(example)

    def train(self, output_dir: str = "./output"):
        """Run training with configured parameters."""
        print("[SFTTrainer] Starting training")

        training_config = self.config.get("config_json", {}).get("training", {})

        training_args = TrainingArguments(
            output_dir=output_dir,
            num_train_epochs=training_config.get("num_epochs", 3),
            per_device_train_batch_size=training_config.get("batch_size", 4),
            gradient_accumulation_steps=training_config.get("gradient_accumulation_steps", 4),
            learning_rate=training_config.get("learning_rate", 2e-5),
            warmup_steps=training_config.get("warmup_steps", 100),
            logging_steps=10,
            save_steps=500,
            eval_strategy="no",
            save_total_limit=2,
            fp16=True,
            report_to="none",
        )

        trainer = TRLSFTTrainer(
            model=self.model,
            args=training_args,
            train_dataset=self.dataset,
            tokenizer=self.tokenizer,
            max_seq_length=training_config.get("max_length", 512),
            formatting_func=self.formatting_func,
        )

        print(f"[SFTTrainer] Training for {training_args.num_train_epochs} epochs")
        trainer.train()

        print(f"[SFTTrainer] Saving model to {output_dir}")
        trainer.save_model(output_dir)
        self.tokenizer.save_pretrained(output_dir)

        print("[SFTTrainer] Training complete!")

    def run(self, output_dir: str = "./output"):
        """Full training pipeline: load, setup, train."""
        self.load_model_and_tokenizer()
        self.setup_lora()
        self.prepare_dataset()
        self.train(output_dir)


print("[SFTTrainer] SFT trainer module loaded")
