# Claude Training Loader - RLHF Trainer
# Date: 2025-10-16
# Purpose: RLHF with PPO and LoRA support

import json
import torch
from pathlib import Path
from typing import Dict, List, Any
from datasets import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, AutoModelForSequenceClassification
from peft import LoraConfig, get_peft_model, TaskType
from trl import PPOTrainer, PPOConfig, AutoModelForCausalLMWithValueHead

class RLHFTrainer:
    """RLHF trainer with PPO and LoRA support."""

    def __init__(self, config: Dict[str, Any], dataset_files: List[str]):
        """Initialize RLHF trainer with config and dataset files."""
        self.config = config
        self.dataset_files = dataset_files
        self.model = None
        self.reward_model = None
        self.tokenizer = None
        self.dataset = None

        print(f"[RLHFTrainer] Initialized with {len(dataset_files)} dataset(s)")

    def load_models_and_tokenizer(self):
        """Load policy model, reward model, and tokenizer."""
        model_config = self.config.get("config_json", {}).get("model", {})
        tokenizer_config = self.config.get("config_json", {}).get("tokenizer", {})

        model_name = model_config.get("name", "gpt2")
        torch_dtype_str = model_config.get("torch_dtype", "float16")
        torch_dtype = getattr(torch, torch_dtype_str, torch.float16)

        print(f"[RLHFTrainer] Loading policy model: {model_name}")

        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_config.get("name", model_name),
            trust_remote_code=tokenizer_config.get("trust_remote_code", False)
        )

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            trust_remote_code=model_config.get("trust_remote_code", False),
            torch_dtype=torch_dtype
        )

        self.model = AutoModelForCausalLMWithValueHead.from_pretrained(base_model)

        print(f"[RLHFTrainer] Loading reward model: {model_name}")
        self.reward_model = AutoModelForSequenceClassification.from_pretrained(
            model_name,
            num_labels=1,
            torch_dtype=torch_dtype
        )

        print("[RLHFTrainer] Models loaded")

    def setup_lora(self):
        """Setup LoRA if enabled in config."""
        training_config = self.config.get("config_json", {}).get("training", {})
        use_lora = training_config.get("use_lora", True)

        if not use_lora:
            print("[RLHFTrainer] LoRA disabled, using full fine-tuning")
            return

        lora_r = training_config.get("lora_r", 8)
        lora_alpha = training_config.get("lora_alpha", 16)
        lora_dropout = training_config.get("lora_dropout", 0.05)

        print(f"[RLHFTrainer] Setting up LoRA (r={lora_r}, alpha={lora_alpha})")

        lora_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=lora_r,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            target_modules=["q_proj", "v_proj"],
            bias="none",
        )

        self.model.pretrained_model = get_peft_model(
            self.model.pretrained_model,
            lora_config
        )
        self.model.pretrained_model.print_trainable_parameters()

    def prepare_dataset(self):
        """Load and prepare dataset from JSONL files."""
        print(f"[RLHFTrainer] Loading {len(self.dataset_files)} dataset file(s)")

        all_examples = []

        for file_path in self.dataset_files:
            with open(file_path, "r") as f:
                for line in f:
                    example = json.loads(line.strip())
                    all_examples.append(example)

        print(f"[RLHFTrainer] Loaded {len(all_examples)} examples")

        formatted_examples = []
        for ex in all_examples:
            if isinstance(ex, list):
                query = " ".join([msg.get("content", "") for msg in ex if msg.get("role") == "user"])
            else:
                query = ex.get("query", ex.get("prompt", ""))

            formatted_examples.append({"query": query})

        self.dataset = Dataset.from_list(formatted_examples)

        max_samples = self.config.get("config_json", {}).get("data", {}).get("max_samples")
        if max_samples and max_samples < len(self.dataset):
            self.dataset = self.dataset.select(range(max_samples))
            print(f"[RLHFTrainer] Limited to {max_samples} examples")

    def train(self, output_dir: str = "./output"):
        """Run RLHF training with PPO."""
        print("[RLHFTrainer] Starting RLHF training with PPO")

        training_config = self.config.get("config_json", {}).get("training", {})

        ppo_config = PPOConfig(
            model_name=self.config.get("config_json", {}).get("model", {}).get("name", "gpt2"),
            learning_rate=training_config.get("learning_rate", 1e-5),
            batch_size=training_config.get("batch_size", 4),
            mini_batch_size=2,
            gradient_accumulation_steps=training_config.get("gradient_accumulation_steps", 4),
            optimize_cuda_cache=True,
        )

        ppo_trainer = PPOTrainer(
            config=ppo_config,
            model=self.model,
            tokenizer=self.tokenizer,
            dataset=self.dataset,
        )

        generation_kwargs = {
            "max_new_tokens": 128,
            "do_sample": True,
            "top_k": 0,
            "top_p": 1.0,
        }

        print(f"[RLHFTrainer] Training for {len(self.dataset)} steps")

        for batch in ppo_trainer.dataloader:
            query_tensors = batch["input_ids"]

            response_tensors = ppo_trainer.generate(
                query_tensors,
                return_prompt=False,
                **generation_kwargs
            )

            rewards = []
            for response in response_tensors:
                reward_input = torch.cat([query_tensors[0], response])
                reward_output = self.reward_model(reward_input.unsqueeze(0))
                rewards.append(reward_output.logits[0])

            stats = ppo_trainer.step(query_tensors, response_tensors, rewards)
            ppo_trainer.log_stats(stats, batch, rewards)

        print(f"[RLHFTrainer] Saving model to {output_dir}")
        self.model.save_pretrained(output_dir)
        self.tokenizer.save_pretrained(output_dir)

        print("[RLHFTrainer] Training complete!")

    def run(self, output_dir: str = "./output"):
        """Full RLHF training pipeline: load, setup, train."""
        self.load_models_and_tokenizer()
        self.setup_lora()
        self.prepare_dataset()
        self.train(output_dir)


print("[RLHFTrainer] RLHF trainer module loaded")
