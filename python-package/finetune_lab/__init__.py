# FineTune Lab - Main API
# Date: 2025-10-16
# Updated: 2025-12-12 - Added API client for inference, batch testing, analytics
# Purpose: Public API for training and API-authenticated operations

# Core client (no heavy dependencies)
from .client import FinetuneLabClient, FinetuneLabError

__version__ = "0.2.0"

# Lazy imports for training modules (require torch, transformers, etc.)
def __getattr__(name):
    """Lazy load training modules to avoid requiring torch for API client users."""
    if name == "TrainingLoader":
        from .loader import TrainingLoader
        return TrainingLoader
    if name == "SFTTrainer":
        from .trainers import SFTTrainer
        return SFTTrainer
    if name == "DPOTrainer":
        from .trainers import DPOTrainer
        return DPOTrainer
    if name == "RLHFTrainer":
        from .trainers import RLHFTrainer
        return RLHFTrainer
    raise AttributeError(f"module 'finetune_lab' has no attribute '{name}'")

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
    from .loader import TrainingLoader
    from .trainers import SFTTrainer

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
    from .loader import TrainingLoader
    from .trainers import DPOTrainer

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
    from .loader import TrainingLoader
    from .trainers import RLHFTrainer

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
    # API Client (new)
    "FinetuneLabClient",
    "FinetuneLabError",
    # Training functions
    "train_sft",
    "train_dpo",
    "train_rlhf",
    # Training classes (lazy loaded)
    "TrainingLoader",
    "SFTTrainer",
    "DPOTrainer",
    "RLHFTrainer",
]
