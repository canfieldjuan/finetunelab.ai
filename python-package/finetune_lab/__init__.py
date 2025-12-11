# FineTune Lab Loader - Main API
# Date: 2025-10-16
# Purpose: Public API for one-click training

from .loader import TrainingLoader
from .trainers import SFTTrainer, DPOTrainer, RLHFTrainer

__version__ = "0.1.0"

def train_sft(public_id: str, output_dir: str = "./output", base_url: str = None):
    """
    Run Supervised Fine-Tuning from FineTune Lab training config.

    Args:
        public_id: Public config ID (e.g., "train_abc123")
        output_dir: Directory to save trained model
        base_url: Optional custom API base URL

    Example:
        >>> from finetune_lab import train_sft
        >>> train_sft("train_abc123")
    """
    print(f"[FineTuneLab] Starting SFT training: {public_id}")

    loader = TrainingLoader(base_url=base_url)
    package = loader.load_training_package(public_id)

    trainer = SFTTrainer(
        config=package["config"],
        dataset_files=package["dataset_files"]
    )
    trainer.run(output_dir=output_dir)

    print(f"[FineTuneLab] SFT training complete! Model saved to: {output_dir}")


def train_dpo(public_id: str, output_dir: str = "./output", base_url: str = None):
    """
    Run Direct Preference Optimization from FineTune Lab training config.

    Args:
        public_id: Public config ID (e.g., "train_xyz456")
        output_dir: Directory to save trained model
        base_url: Optional custom API base URL

    Example:
        >>> from finetune_lab import train_dpo
        >>> train_dpo("train_xyz456")
    """
    print(f"[FineTuneLab] Starting DPO training: {public_id}")

    loader = TrainingLoader(base_url=base_url)
    package = loader.load_training_package(public_id)

    trainer = DPOTrainer(
        config=package["config"],
        dataset_files=package["dataset_files"]
    )
    trainer.run(output_dir=output_dir)

    print(f"[FineTuneLab] DPO training complete! Model saved to: {output_dir}")


def train_rlhf(public_id: str, output_dir: str = "./output", base_url: str = None):
    """
    Run RLHF training from FineTune Lab training config.

    Args:
        public_id: Public config ID (e.g., "train_def789")
        output_dir: Directory to save trained model
        base_url: Optional custom API base URL

    Example:
        >>> from finetune_lab import train_rlhf
        >>> train_rlhf("train_def789")
    """
    print(f"[FineTuneLab] Starting RLHF training: {public_id}")

    loader = TrainingLoader(base_url=base_url)
    package = loader.load_training_package(public_id)

    trainer = RLHFTrainer(
        config=package["config"],
        dataset_files=package["dataset_files"]
    )
    trainer.run(output_dir=output_dir)

    print(f"[FineTuneLab] RLHF training complete! Model saved to: {output_dir}")


__all__ = [
    "train_sft",
    "train_dpo",
    "train_rlhf",
    "TrainingLoader",
    "SFTTrainer",
    "DPOTrainer",
    "RLHFTrainer",
]

print(f"[FineTuneLab] FineTune Lab Loader v{__version__} loaded")
