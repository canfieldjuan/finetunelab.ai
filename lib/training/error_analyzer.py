"""
Error Analysis and Configuration Suggestions

Analyzes training failures and generates intelligent configuration
adjustments to prevent recurrence.

Date: 2025-11-10
Phase: Intelligent Resume Implementation - Phase 2
"""

import re
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class ConfigSuggestion:
    """Single configuration adjustment suggestion"""
    field: str
    current_value: Any
    suggested_value: Any
    reason: str
    impact: str  # e.g., "~75% memory reduction"


@dataclass
class FailureAnalysis:
    """Complete failure analysis with suggestions"""
    error_type: str  # 'oom_eval', 'oom_training', 'timeout', etc.
    error_phase: str  # 'evaluation', 'training', 'initialization'
    suggestions: List[ConfigSuggestion]
    description: str
    confidence: str  # 'high', 'medium', 'low'

    def to_dict(self) -> Dict:
        """Convert to JSON-serializable dict"""
        result = asdict(self)
        # Convert ConfigSuggestion dataclasses to dicts
        result['suggestions'] = [asdict(s) for s in self.suggestions]
        return result


def analyze_training_failure(
    error_message: str,
    config: Dict
) -> FailureAnalysis:
    """
    Analyze training failure and generate suggestions

    Args:
        error_message: Error message from training logs
        config: Training configuration dict

    Returns:
        FailureAnalysis with suggestions
    """

    if not error_message:
        return FailureAnalysis(
            error_type='no_error',
            error_phase='unknown',
            suggestions=[],
            description='No error message available',
            confidence='low'
        )

    # OOM during evaluation or training
    if 'CUDA out of memory' in error_message or 'out of memory' in error_message.lower():
        if 'eval' in error_message.lower():
            return _analyze_oom_eval(error_message, config)
        else:
            return _analyze_oom_training(error_message, config)

    # Timeout
    elif 'timeout' in error_message.lower() or 'no progress' in error_message.lower():
        return _analyze_timeout(error_message, config)

    # CUDA errors (other than OOM)
    elif 'CUDA' in error_message or 'cuda' in error_message:
        return _analyze_cuda_error(error_message, config)

    # Unknown error
    else:
        return FailureAnalysis(
            error_type='unknown',
            error_phase='unknown',
            suggestions=[],
            description=f'Unknown error occurred: {error_message[:100]}...',
            confidence='low'
        )


def _analyze_oom_eval(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze OOM during evaluation"""

    suggestions = []

    # Eval batch size
    current_eval_batch = config.get('per_device_eval_batch_size', 4)
    if current_eval_batch > 1:
        new_value = max(1, current_eval_batch // 2)
        suggestions.append(ConfigSuggestion(
            field='per_device_eval_batch_size',
            current_value=current_eval_batch,
            suggested_value=new_value,
            reason='Reduces memory per evaluation step',
            impact=f'~50% eval memory reduction'
        ))

    # Eval accumulation steps
    current_eval_accum = config.get('eval_accumulation_steps', 10)
    if current_eval_accum > 2:
        new_value = max(1, current_eval_accum // 5)
        suggestions.append(ConfigSuggestion(
            field='eval_accumulation_steps',
            current_value=current_eval_accum,
            suggested_value=new_value,
            reason='Limits samples held in memory during evaluation',
            impact=f'~80% eval memory reduction'
        ))

    # Gradient checkpointing
    if not config.get('gradient_checkpointing', False):
        suggestions.append(ConfigSuggestion(
            field='gradient_checkpointing',
            current_value=False,
            suggested_value=True,
            reason='Trades compute for memory by recomputing activations',
            impact='15-20% additional memory savings (10% slower)'
        ))

    # Calculate total impact
    total_impact = 75 if len(suggestions) >= 2 else 50

    return FailureAnalysis(
        error_type='oom_eval',
        error_phase='evaluation',
        suggestions=suggestions,
        description=f'CUDA Out of Memory during evaluation. Estimated {total_impact}% memory reduction needed.',
        confidence='high'
    )


def _analyze_oom_training(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze OOM during training"""

    suggestions = []

    # Train batch size
    current_train_batch = config.get('per_device_train_batch_size', 4)
    if current_train_batch > 1:
        new_value = max(1, current_train_batch // 2)
        suggestions.append(ConfigSuggestion(
            field='per_device_train_batch_size',
            current_value=current_train_batch,
            suggested_value=new_value,
            reason='Reduces memory per training step',
            impact='~50% training memory reduction'
        ))

    # Gradient accumulation (increase to maintain effective batch size)
    current_grad_accum = config.get('gradient_accumulation_steps', 1)
    new_grad_accum = current_grad_accum * 2
    suggestions.append(ConfigSuggestion(
        field='gradient_accumulation_steps',
        current_value=current_grad_accum,
        suggested_value=new_grad_accum,
        reason='Maintains effective batch size while using less memory',
        impact='No impact on convergence'
    ))

    # Gradient checkpointing
    if not config.get('gradient_checkpointing', False):
        suggestions.append(ConfigSuggestion(
            field='gradient_checkpointing',
            current_value=False,
            suggested_value=True,
            reason='Saves memory by recomputing activations during backward pass',
            impact='20-30% memory savings (10-15% slower)'
        ))

    # Max sequence length (if very long)
    max_length = config.get('max_seq_length') or config.get('max_length')
    if max_length and max_length > 2048:
        new_length = max(512, max_length // 2)
        suggestions.append(ConfigSuggestion(
            field='max_seq_length',
            current_value=max_length,
            suggested_value=new_length,
            reason='Reduces memory for attention computation (quadratic with length)',
            impact='~50% memory reduction for long sequences'
        ))

    return FailureAnalysis(
        error_type='oom_training',
        error_phase='training',
        suggestions=suggestions,
        description='CUDA Out of Memory during training. Reduce batch size and enable memory optimizations.',
        confidence='high'
    )


def _analyze_timeout(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze timeout failures"""

    suggestions = []

    # Check if evaluation is too slow
    current_eval_batch = config.get('per_device_eval_batch_size', 4)
    if current_eval_batch < 8:
        suggestions.append(ConfigSuggestion(
            field='per_device_eval_batch_size',
            current_value=current_eval_batch,
            suggested_value=current_eval_batch * 2,
            reason='Increases evaluation speed',
            impact='~2x faster evaluation'
        ))

    # Reduce eval frequency
    current_eval_steps = config.get('eval_steps', 100)
    if current_eval_steps < 500:
        suggestions.append(ConfigSuggestion(
            field='eval_steps',
            current_value=current_eval_steps,
            suggested_value=current_eval_steps * 2,
            reason='Evaluates less frequently, reducing overhead',
            impact='~2x faster overall training'
        ))

    # Reduce logging frequency
    current_log_steps = config.get('logging_steps', 10)
    if current_log_steps < 50:
        suggestions.append(ConfigSuggestion(
            field='logging_steps',
            current_value=current_log_steps,
            suggested_value=max(50, current_log_steps * 5),
            reason='Reduces I/O overhead from frequent logging',
            impact='Slight speedup in training'
        ))

    return FailureAnalysis(
        error_type='timeout',
        error_phase='evaluation',
        suggestions=suggestions,
        description='Training timed out due to slow progress. Optimize evaluation frequency and batch sizes.',
        confidence='medium'
    )


def _analyze_cuda_error(error_message: str, config: Dict) -> FailureAnalysis:
    """Analyze other CUDA errors"""

    suggestions = []

    # Check for mixed precision issues
    if 'fp16' in error_message.lower() or 'half' in error_message.lower():
        if config.get('fp16', False):
            suggestions.append(ConfigSuggestion(
                field='fp16',
                current_value=True,
                suggested_value=False,
                reason='Disable FP16 to avoid numerical instability',
                impact='More stable training (uses more memory)'
            ))

    # Check for dataloader issues
    if 'dataloader' in error_message.lower() or 'worker' in error_message.lower():
        current_workers = config.get('dataloader_num_workers', 4)
        if current_workers > 0:
            suggestions.append(ConfigSuggestion(
                field='dataloader_num_workers',
                current_value=current_workers,
                suggested_value=0,
                reason='Disable multiprocessing to avoid worker conflicts',
                impact='Slightly slower data loading'
            ))

    if not suggestions:
        suggestions.append(ConfigSuggestion(
            field='gradient_checkpointing',
            current_value=config.get('gradient_checkpointing', False),
            suggested_value=True,
            reason='General memory optimization',
            impact='15-20% memory savings'
        ))

    return FailureAnalysis(
        error_type='cuda_error',
        error_phase='training',
        suggestions=suggestions,
        description=f'CUDA error detected: {error_message[:100]}...',
        confidence='medium'
    )


# Utility functions for testing
def get_suggestion_summary(analysis: FailureAnalysis) -> str:
    """Generate human-readable summary of suggestions"""
    lines = [
        f"Error Type: {analysis.error_type}",
        f"Phase: {analysis.error_phase}",
        f"Confidence: {analysis.confidence}",
        f"Description: {analysis.description}",
        "",
        f"Suggestions ({len(analysis.suggestions)}):"
    ]

    for i, suggestion in enumerate(analysis.suggestions, 1):
        lines.append(f"  {i}. {suggestion.field}")
        lines.append(f"     Current: {suggestion.current_value}")
        lines.append(f"     Suggested: {suggestion.suggested_value}")
        lines.append(f"     Reason: {suggestion.reason}")
        lines.append(f"     Impact: {suggestion.impact}")
        lines.append("")

    return "\n".join(lines)
