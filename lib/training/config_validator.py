"""
Configuration validator for training jobs
Catches common errors early before training starts
"""

from typing import Dict, List, Any, Tuple
import logging

logger = logging.getLogger(__name__)

KNOWN_LORA_TARGETS = {
    "gpt2": ["c_attn", "c_proj"],
    "gpt-neo": ["c_attn", "c_proj"],
    "gpt-j": ["q_proj", "v_proj"],
    "llama": ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "mistral": ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    "phi": ["q_proj", "v_proj", "k_proj", "dense"],
    "phi-2": ["q_proj", "v_proj", "k_proj", "dense"],
    "qwen3": ["q_proj", "v_proj", "k_proj", "o_proj"],
    "qwen2": ["c_attn", "c_proj"],
    "qwen": ["c_attn", "c_proj"],
    "default": ["q_proj", "v_proj", "k_proj", "o_proj"]
}

MODELS_WITHOUT_CHAT_TEMPLATE = [
    "gpt2", "gpt-neo", "gpt-j"
]

class ValidationError(Exception):
    """Raised when config validation fails"""
    pass

def validate_config(config: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate training configuration
    
    Returns:
        Tuple of (is_valid, list_of_warnings)
    
    Raises:
        ValidationError if critical validation fails
    """
    warnings = []
    
    _validate_required_sections(config)
    
    _validate_model_config(config.get("model", {}), warnings)
    
    _validate_data_config(config.get("data", {}), config.get("model", {}).get("name"), warnings)
    
    _validate_training_config(config.get("training", {}), warnings)

    _validate_dataset_format_compatibility(config.get("training", {}), config.get("data", {}), warnings)

    _validate_lora_config(config.get("lora", {}), config.get("model", {}).get("name"), warnings)
    
    _validate_output_config(config.get("output", {}), warnings)
    
    return True, warnings

def _validate_required_sections(config: Dict[str, Any]) -> None:
    """Validate that all required config sections exist"""
    required_sections = ["model", "training"]
    missing = [s for s in required_sections if s not in config]
    
    if missing:
        raise ValidationError(f"Missing required config sections: {', '.join(missing)}")

def _validate_model_config(model_config: Dict[str, Any], warnings: List[str]) -> None:
    """Validate model configuration"""
    if not model_config:
        raise ValidationError("Model config section is missing or empty")
    
    if "name" not in model_config:
        raise ValidationError("model.name is required")
    
    if not model_config["name"] or not model_config["name"].strip():
        raise ValidationError("model.name cannot be empty")
    
    model_name = model_config["name"].lower()
    
    if "quantization" in model_config:
        quant = model_config["quantization"]
        valid_quant = [None, "4bit", "8bit"]
        if quant not in valid_quant:
            warnings.append(f"Unknown quantization '{quant}'. Valid: {valid_quant}")

def _validate_data_config(data_config: Dict[str, Any], model_name: str, warnings: List[str]) -> None:
    """Validate data configuration and compatibility"""
    if not data_config:
        return
    
    strategy = data_config.get("strategy", "").lower()
    
    if strategy == "chat" or "chat_template" in data_config:
        model_base = model_name.split("/")[-1].lower() if model_name else ""
        
        for no_chat_model in MODELS_WITHOUT_CHAT_TEMPLATE:
            if no_chat_model in model_base:
                raise ValidationError(
                    f"Model '{model_name}' does not support chat templates. "
                    f"Use data.strategy='standard' or a model with chat template support."
                )

def _validate_training_config(training_config: Dict[str, Any], warnings: List[str]) -> None:
    """Validate training parameters"""
    if not training_config:
        raise ValidationError("Training config section is empty")
    
    if "method" not in training_config:
        raise ValidationError("training.method is required (sft, dpo, etc.)")
    
    method = training_config["method"].lower()
    valid_methods = ["sft", "dpo", "rlhf", "orpo", "cpt"]
    if method not in valid_methods:
        raise ValidationError(f"Invalid training.method '{method}'. Valid: {valid_methods}")
    
    if "num_epochs" in training_config:
        epochs = training_config["num_epochs"]
        if not isinstance(epochs, (int, float)) or epochs <= 0:
            raise ValidationError(f"num_epochs must be positive, got {epochs}")
        if epochs > 100:
            warnings.append(f"num_epochs={epochs} is very high, consider reducing")
    
    if "batch_size" in training_config:
        bs = training_config["batch_size"]
        if not isinstance(bs, int) or bs <= 0:
            raise ValidationError(f"batch_size must be positive integer, got {bs}")
    
    if "learning_rate" in training_config:
        lr = training_config["learning_rate"]
        if not isinstance(lr, (int, float)) or lr <= 0:
            raise ValidationError(f"learning_rate must be positive, got {lr}")
        if lr > 0.01:
            warnings.append(f"learning_rate={lr} is very high, typical range is 1e-5 to 1e-3")

def _validate_lora_config(lora_config: Dict[str, Any], model_name: str, warnings: List[str]) -> None:
    """Validate LoRA configuration and target modules"""
    if not lora_config:
        warnings.append("No lora config provided, will use defaults")
        return
    
    if "r" in lora_config:
        r = lora_config["r"]
        if not isinstance(r, int) or r <= 0:
            raise ValidationError(f"lora.r must be positive integer, got {r}")
        if r > 64:
            warnings.append(f"lora.r={r} is very high, consider 8-16 for efficiency")
    
    if "alpha" in lora_config:
        alpha = lora_config["alpha"]
        if not isinstance(alpha, (int, float)) or alpha <= 0:
            raise ValidationError(f"lora.alpha must be positive, got {alpha}")
    
    if "target_modules" in lora_config:
        target_modules = lora_config["target_modules"]
        
        if not isinstance(target_modules, list) or not target_modules:
            raise ValidationError("lora.target_modules must be a non-empty list")
        
        if model_name:
            _validate_lora_targets(model_name, target_modules, warnings)

def _validate_lora_targets(model_name: str, target_modules: List[str], warnings: List[str]) -> None:
    """Validate LoRA target modules match the model architecture"""
    model_base = model_name.split("/")[-1].lower()
    
    expected_targets = None
    for key, targets in KNOWN_LORA_TARGETS.items():
        if key in model_base:
            expected_targets = targets
            break
    
    if not expected_targets:
        expected_targets = KNOWN_LORA_TARGETS["default"]
        warnings.append(
            f"Unknown model architecture for '{model_name}'. "
            f"Using default LoRA targets: {expected_targets}. "
            f"Verify target_modules match your model."
        )
    
    unexpected = [m for m in target_modules if m not in expected_targets]
    if unexpected:
        raise ValidationError(
            f"Invalid LoRA target_modules {unexpected} for model '{model_name}'. "
            f"Expected modules for this architecture: {expected_targets}. "
            f"You provided: {target_modules}"
        )

def _validate_output_config(output_config: Dict[str, Any], warnings: List[str]) -> None:
    """Validate output configuration"""
    if not output_config:
        warnings.append("No output config, will use defaults")
        return

    if "save_total_limit" in output_config:
        limit = output_config["save_total_limit"]
        if not isinstance(limit, int) or limit < 0:
            raise ValidationError(f"save_total_limit must be non-negative integer, got {limit}")

def _validate_dataset_format_compatibility(training_config: Dict[str, Any], data_config: Dict[str, Any], warnings: List[str]) -> None:
    """
    Validate dataset format compatibility with training method.

    Note: This provides general guidance. Actual format validation happens:
    1. Frontend validation (validation.ts) - checks actual dataset structure
    2. Training time (standalone_trainer.py) - auto-detects and adapts format
    """
    if not training_config:
        return

    method = training_config.get("method", "").lower()
    dataset_format = data_config.get("dataset_format", "") if data_config else ""

    # Format compatibility matrix (matches frontend validation)
    format_requirements = {
        "sft": ["chatml", "sharegpt", "jsonl", "alpaca", "openorca", "unnatural", "text"],
        "dpo": ["dpo"],
        "rlhf": ["rlhf"],
        "orpo": ["dpo"],
        "cpt": ["raw_text", "text"]
    }

    if method in format_requirements:
        required_formats = format_requirements[method]

        if dataset_format and dataset_format not in required_formats:
            warnings.append(
                f"Training method '{method.upper()}' typically requires {', '.join(required_formats)} format. "
                f"Your dataset is marked as '{dataset_format}'. "
                f"Ensure your dataset structure matches the training method requirements."
            )

        # Provide helpful format guidance
        if method == "dpo" or method == "orpo":
            if not dataset_format or dataset_format != "dpo":
                warnings.append(
                    f"{method.upper()} training requires datasets with 'prompt', 'chosen', and 'rejected' fields. "
                    f"Alternatively, text-format datasets will use synthetic preference generation (legacy)."
                )

        if method == "rlhf":
            if not dataset_format or dataset_format != "rlhf":
                warnings.append(
                    "RLHF training requires datasets with 'prompt', 'response', and optional 'reward' fields."
                )

def validate_dataset_format(dataset: List[Dict[str, Any]], data_strategy: str = "standard") -> Tuple[bool, List[str]]:
    """
    Validate dataset format matches the data strategy
    
    NOTE: Since 2025-11-01, datasets are pre-normalized at upload time to standard formats.
    This validator now accepts normalized datasets regardless of config strategy.
    
    Args:
        dataset: List of examples (pre-normalized)
        data_strategy: Config strategy (standard, chat, etc.) - now advisory only
    
    Returns:
        Tuple of (is_valid, list_of_warnings)
    
    Raises:
        ValidationError if critical validation fails
    """
    warnings = []
    
    if not dataset or not isinstance(dataset, list):
        raise ValidationError("Dataset must be a non-empty list")
    
    if len(dataset) == 0:
        raise ValidationError("Dataset is empty")
    
    first_example = dataset[0]

    has_messages = "messages" in first_example
    has_text = "text" in first_example
    has_dpo = "prompt" in first_example and "chosen" in first_example and "rejected" in first_example
    has_rlhf = "prompt" in first_example and "response" in first_example

    # RELAXED VALIDATION: Accept multiple formats
    # Datasets can be in messages format (SFT), DPO format (preference), or RLHF format
    if has_messages:
        # Valid normalized chat format for SFT
        if data_strategy != "chat":
            warnings.append(
                f"Dataset has 'messages' field (normalized chat format) but config strategy is '{data_strategy}'. "
                "This is OK - datasets are now pre-normalized. Consider updating config strategy to 'chat' "
                "to match the normalized format."
            )

    if has_text:
        # Valid text format
        if data_strategy == "chat":
            warnings.append(
                "Dataset has 'text' field but data.strategy='chat'. "
                "This may work but consider using 'messages' format for chat data."
            )

    if has_dpo:
        # Valid DPO/ORPO preference format - preserved as-is
        warnings.append(
            "Dataset has DPO format (prompt/chosen/rejected). "
            "This format is preserved for preference-based training (DPO/ORPO)."
        )

    if has_rlhf:
        # Valid RLHF format - preserved as-is
        warnings.append(
            "Dataset has RLHF format (prompt/response). "
            "This format is preserved for RLHF training."
        )

    if not has_messages and not has_text and not has_dpo and not has_rlhf:
        raise ValidationError(
            "Dataset examples must have one of: "
            "'messages' field (SFT/chat), "
            "'text' field (standard), "
            "'prompt/chosen/rejected' (DPO/ORPO), or "
            "'prompt/response' (RLHF). "
            f"Found keys: {list(first_example.keys())}"
        )
    
    if len(dataset) < 2:
        warnings.append("Dataset has only 1 example, training may not be effective")
    
    if len(dataset) < 10:
        warnings.append(f"Dataset is very small ({len(dataset)} examples), consider adding more data")
    
    return True, warnings
