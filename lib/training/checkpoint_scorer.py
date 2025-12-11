"""
Multi-Metric Checkpoint Scoring Module

Implements research-backed checkpoint selection algorithm based on:
- Deep Multi-Metric Training (DMMT) 2024
- Multi-Criteria Decision Analysis (MCDA)
- HuggingFace best practices

Usage:
    from lib.training.checkpoint_scorer import calculate_checkpoint_score

    checkpoint_data = {
        'eval_loss': 0.5,
        'train_loss': 0.45,
        'epochs_without_improvement': 0
    }
    score = calculate_checkpoint_score(checkpoint_data)
    # Lower score = better checkpoint

Date: 2025-12-06
"""

import math
import logging
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def calculate_checkpoint_score(checkpoint_data: Dict) -> float:
    """
    Calculate multi-metric score for checkpoint selection.

    Returns score where LOWER is better (consistent with loss metrics).

    Algorithm Components:
    1. Eval Loss (50% weight) - Primary performance metric
    2. Overfitting Penalty (30% weight) - Train/eval gap (relative)
    3. Perplexity Penalty (10% weight) - Model confidence signal
    4. Improvement Bonus (10% weight) - Trajectory indicator

    Args:
        checkpoint_data: Dict containing:
            - eval_loss (float, required): Validation loss
            - train_loss (float, optional): Training loss
            - epochs_without_improvement (int, optional): Binary improvement indicator

    Returns:
        float: Checkpoint score (lower = better), or inf if invalid

    Example:
        >>> data = {'eval_loss': 0.5, 'train_loss': 0.45, 'epochs_without_improvement': 0}
        >>> score = calculate_checkpoint_score(data)
        >>> # score ≈ 0.188 (good checkpoint)

        >>> data = {'eval_loss': 0.4, 'train_loss': 0.1, 'epochs_without_improvement': 1}
        >>> score = calculate_checkpoint_score(data)
        >>> # score ≈ 0.432 (overfitted, worse despite lower eval_loss)

    Research Sources:
    - Deep Multi-Metric Training: https://link.springer.com/article/10.1007/s00521-024-10182-6
    - HuggingFace Trainer: https://huggingface.co/docs/transformers/main_classes/trainer
    - Loss Gap Analysis: https://machinelearningmastery.com/learning-curves-for-diagnosing-machine-learning-model-performance/
    """

    eval_loss = checkpoint_data.get('eval_loss')
    train_loss = checkpoint_data.get('train_loss')

    # Cannot score without eval_loss (primary metric)
    if eval_loss is None:
        logger.warning("[CheckpointScorer] Cannot score checkpoint without eval_loss")
        return float('inf')

    # 1. BASE SCORE: Eval Loss (50% weight)
    # Lower eval_loss = better model performance on validation set
    eval_loss_score = eval_loss * 0.5

    # 2. OVERFITTING PENALTY: Loss Gap (30% weight)
    # Measures train/eval divergence (relative to eval_loss scale)
    # Research: Avoid absolute thresholds, use relative gap instead
    if train_loss is not None:
        loss_gap = abs(train_loss - eval_loss)

        # Normalize gap by eval_loss to make it relative (scale-independent)
        # Example: gap=0.1 matters more when eval_loss=0.2 vs eval_loss=2.0
        relative_gap = loss_gap / max(eval_loss, 0.001)  # Avoid division by zero
        gap_penalty = relative_gap * 0.3

        logger.debug(
            f"[CheckpointScorer] Gap penalty: "
            f"train_loss={train_loss:.6f}, eval_loss={eval_loss:.6f}, "
            f"gap={loss_gap:.6f}, relative_gap={relative_gap:.6f}, "
            f"penalty={gap_penalty:.6f}"
        )
    else:
        gap_penalty = 0.0
        logger.debug(
            f"[CheckpointScorer] No train_loss available, gap_penalty=0.0"
        )

    # 3. PERPLEXITY PENALTY: Model Confidence (10% weight)
    # Research: perplexity = exp(loss), no universal thresholds
    # Use as secondary signal, normalized to prevent domination
    perplexity = math.exp(eval_loss)

    # Normalize to typical LLM range (1-20), cap at 1.0
    # This prevents perplexity from overwhelming other components
    perplexity_normalized = min(perplexity / 20.0, 1.0)
    perplexity_penalty = perplexity_normalized * 0.1

    logger.debug(
        f"[CheckpointScorer] Perplexity penalty: "
        f"perplexity={perplexity:.6f}, normalized={perplexity_normalized:.6f}, "
        f"penalty={perplexity_penalty:.6f}"
    )

    # 4. IMPROVEMENT BONUS: Recent Trajectory (10% weight)
    # Binary indicator: Did last eval improve vs previous?
    # Research: Trajectory matters, not just absolute values
    epochs_without_improvement = checkpoint_data.get('epochs_without_improvement', 1)

    if epochs_without_improvement == 0:
        # Recent improvement detected - give bonus (negative = lower score)
        improvement_bonus = -0.1
        logger.debug(
            f"[CheckpointScorer] Recent improvement detected, bonus=-0.1"
        )
    else:
        # No recent improvement - neutral
        improvement_bonus = 0.0
        logger.debug(
            f"[CheckpointScorer] No recent improvement, bonus=0.0"
        )

    # TOTAL SCORE (lower = better)
    total_score = eval_loss_score + gap_penalty + perplexity_penalty + improvement_bonus

    # Use debug level to avoid spamming logs during polling
    logger.debug(
        f"[CheckpointScorer] Checkpoint score: {total_score:.6f} "
        f"(eval={eval_loss_score:.6f} + gap={gap_penalty:.6f} + "
        f"perp={perplexity_penalty:.6f} + bonus={improvement_bonus:.6f})"
    )

    return total_score


def compare_checkpoints(checkpoint_a: Dict, checkpoint_b: Dict) -> str:
    """
    Compare two checkpoints and return which is better.

    Args:
        checkpoint_a: First checkpoint data
        checkpoint_b: Second checkpoint data

    Returns:
        str: "a" if A is better, "b" if B is better, "tie" if equal

    Example:
        >>> a = {'eval_loss': 0.5, 'train_loss': 0.45}
        >>> b = {'eval_loss': 0.4, 'train_loss': 0.1}
        >>> compare_checkpoints(a, b)
        'a'  # A is better despite higher eval_loss (better generalization)
    """
    score_a = calculate_checkpoint_score(checkpoint_a)
    score_b = calculate_checkpoint_score(checkpoint_b)

    if score_a < score_b:
        return "a"
    elif score_b < score_a:
        return "b"
    else:
        return "tie"


# Module initialization
logger.debug("[CheckpointScorer] Multi-metric checkpoint scoring module loaded")
