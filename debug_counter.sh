#!/bin/bash
# Debug script to monitor epochs_without_improvement in progress file

PROGRESS_FILE=$(find /tmp -name "training_progress_*.json" 2>/dev/null | head -1)

if [ -z "$PROGRESS_FILE" ]; then
    echo "No training progress file found in /tmp"
    exit 1
fi

echo "Monitoring: $PROGRESS_FILE"
echo "==================================="

watch -n 1 "jq '{
  current_step: .current_step,
  total_steps: .total_steps,
  eval_loss: .eval_loss,
  best_eval_loss: .best_eval_loss,
  best_step: .best_step,
  epochs_without_improvement: .epochs_without_improvement
}' $PROGRESS_FILE"
