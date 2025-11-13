# Training Metrics Reference

## Complete Metrics List (32 Total)

### Core Progress Metrics (7)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `job_id` | string | Server | Unique job identifier |
| `status` | string | Server | pending, running, completed, failed |
| `progress` | number | Calculated | 0-100 percentage |
| `current_epoch` | number | Trainer | Current epoch (1-indexed) |
| `total_epochs` | number | Config | Total epochs to train |
| `current_step` | number | Trainer | Current global step |
| `total_steps` | number | Trainer | Total training steps |

### Loss Metrics (4)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `loss` (train_loss) | number | Trainer | Current training loss |
| `eval_loss` | number | Trainer | Current validation loss |
| `perplexity` | number | Calculated | exp(eval_loss), model quality |
| `train_perplexity` | number | Calculated | exp(train_loss), training fit |

### Best Model Tracking (4)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `best_eval_loss` | number | Tracker | Lowest eval_loss achieved |
| `best_epoch` | number | Tracker | Epoch of best checkpoint |
| `best_step` | number | Tracker | Step of best checkpoint |
| `epochs_without_improvement` | number | Tracker | Epochs since last improvement |

### Loss Trend Analysis (1)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `loss_trend` | string | Analyzer | improving, degrading, stable, insufficient_data |

### Dataset Statistics (4)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `total_samples` | number | Dataset | Total dataset examples |
| `train_samples` | number | Dataset | Training set size |
| `val_samples` | number | Dataset | Validation set size |
| `total_tokens_processed` | number | Tracker | Cumulative tokens processed |

### Training Dynamics (2)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `learning_rate` | number | Scheduler | Current learning rate |
| `grad_norm` | number | Trainer | Gradient norm (stability indicator) |

### GPU Metrics (2)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `gpu_memory_allocated_gb` | number | PyTorch | Active GPU memory in GB |
| `gpu_memory_reserved_gb` | number | PyTorch | Reserved GPU memory in GB |

### Performance Metrics (4)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `elapsed_seconds` | number | Timer | Time since training started |
| `remaining_seconds` | number | Estimated | Estimated time remaining |
| `samples_per_second` | number | Calculated | Training throughput |
| `steps_per_second` | number | Calculated | Step throughput |

### Timestamps (4)
| Metric | Type | Source | Description |
|--------|------|--------|-------------|
| `started_at` | string (ISO) | Server | When training started |
| `completed_at` | string (ISO) | Server | When training finished |
| `updated_at` | string (ISO) | Callback | Last progress update |
| `error` | string | Server | Error message if failed |

---

## Metric Categories for UI Display

### Dashboard Overview (Priority 1)
```typescript
{
  status: 'running',
  progress: 45.2,
  current_epoch: 3,
  total_epochs: 5,
  train_loss: 1.234,
  eval_loss: 1.189,
  perplexity: 3.28,
  loss_trend: 'improving',
  elapsed_seconds: 420,
  remaining_seconds: 510
}
```

### Loss Chart (Priority 1)
```typescript
{
  metrics_history: [
    {
      step: 100,
      epoch: 1,
      train_loss: 2.15,
      eval_loss: 2.08,
      timestamp: '2025-10-27T...'
    },
    ...
  ]
}
```

### Best Model Card (Priority 2)
```typescript
{
  best_eval_loss: 1.123,
  best_epoch: 3,
  best_step: 450,
  epochs_without_improvement: 0,
  loss_trend: 'improving'
}
```

### Dataset Info (Priority 2)
```typescript
{
  total_samples: 1000,
  train_samples: 800,
  val_samples: 200,
  total_tokens_processed: 125000
}
```

### Resource Monitor (Priority 2)
```typescript
{
  gpu_memory_allocated_gb: 4.2,
  gpu_memory_reserved_gb: 6.0,
  samples_per_second: 12.5,
  steps_per_second: 3.2
}
```

### Learning Rate Schedule (Priority 3)
```typescript
{
  learning_rate: 0.00015,
  grad_norm: 0.85,
  // Plot over metrics_history
}
```

---

## UI Component Metric Requirements

### TrainingDashboard Component
**Required Metrics:**
- status
- progress
- current_epoch / total_epochs
- train_loss
- eval_loss
- perplexity
- loss_trend
- elapsed_seconds
- remaining_seconds

**Optional Metrics:**
- gpu_memory_allocated_gb
- samples_per_second

### LossChart Component
**Required Metrics:**
- metrics_history (array)
  - step
  - train_loss
  - eval_loss
  - timestamp

**Optional Metrics:**
- perplexity (calculated from eval_loss)

### BestModelCard Component
**Required Metrics:**
- best_eval_loss
- best_epoch
- best_step
- epochs_without_improvement
- loss_trend

### DatasetStatsCard Component
**Required Metrics:**
- total_samples
- train_samples
- val_samples

**Optional Metrics:**
- total_tokens_processed

### ResourceMonitor Component
**Required Metrics:**
- gpu_memory_allocated_gb
- gpu_memory_reserved_gb

**Optional Metrics:**
- samples_per_second
- steps_per_second

### LearningRateChart Component
**Required Metrics:**
- metrics_history
  - step
  - learning_rate
  - grad_norm

---

## Metric Calculations

### Perplexity
```typescript
function calculatePerplexity(loss: number): number {
  return Math.exp(loss);
}
```

### Progress Percentage
```typescript
function calculateProgress(currentEpoch: number, totalEpochs: number, currentStep: number, totalSteps: number): number {
  if (totalSteps > 0) {
    return (currentStep / totalSteps) * 100;
  }
  return (currentEpoch / totalEpochs) * 100;
}
```

### Remaining Time
```typescript
function calculateRemainingTime(elapsedSeconds: number, progress: number): number {
  if (progress === 0) return null;
  const totalEstimated = elapsedSeconds / (progress / 100);
  return totalEstimated - elapsedSeconds;
}
```

### Loss Trend
```typescript
function analyzeLossTrend(recentLosses: number[]): 'improving' | 'degrading' | 'stable' {
  if (recentLosses.length < 3) return 'insufficient_data';
  
  const midpoint = Math.floor(recentLosses.length / 2);
  const firstHalf = recentLosses.slice(0, midpoint);
  const secondHalf = recentLosses.slice(midpoint);
  
  const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
  
  const diff = firstAvg - secondAvg;
  const threshold = 0.01;
  
  if (diff > threshold) return 'improving';
  if (diff < -threshold) return 'degrading';
  return 'stable';
}
```

---

## Polling Strategy

### Real-time Updates (During Training)
```typescript
const POLL_INTERVAL_MS = 2000; // 2 seconds

function pollTrainingStatus(jobId: string) {
  const intervalId = setInterval(async () => {
    const status = await fetchStatus(jobId);
    
    if (status.status === 'completed' || status.status === 'failed') {
      clearInterval(intervalId);
    }
    
    updateUI(status);
  }, POLL_INTERVAL_MS);
  
  return intervalId;
}
```

### Historical View (Completed Jobs)
```typescript
// No polling needed, fetch once
const status = await fetchStatus(jobId);
renderHistoricalView(status);
```

---

## Error Handling

### Missing Metrics
```typescript
function safeGetMetric<T>(status: TrainingJobStatus, key: keyof TrainingJobStatus, fallback: T): T {
  const value = status[key];
  return value !== undefined && value !== null ? value as T : fallback;
}

// Usage
const perplexity = safeGetMetric(status, 'perplexity', null);
const lossTrend = safeGetMetric(status, 'loss_trend', 'insufficient_data');
```

### Validation
```typescript
function isValidMetric(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number' && !isFinite(value)) return false;
  return true;
}
```

---

## Metric Priority Levels

### Critical (Must Display)
- status
- progress
- current_epoch / total_epochs
- train_loss
- eval_loss

### Important (Should Display)
- perplexity
- best_eval_loss
- loss_trend
- elapsed_seconds
- remaining_seconds
- gpu_memory_allocated_gb

### Nice to Have (Can Hide on Mobile)
- train_perplexity
- best_epoch
- best_step
- epochs_without_improvement
- total_samples
- train_samples
- val_samples
- total_tokens_processed
- learning_rate
- grad_norm
- samples_per_second
- steps_per_second

### Debug Only (Hidden by Default)
- gpu_memory_reserved_gb
- started_at
- updated_at
- error (only show if status=failed)

---

## TypeScript Interface

```typescript
export interface TrainingJobStatus {
  // Core Progress (7)
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  current_epoch: number;
  total_epochs: number;
  current_step: number;
  total_steps: number;
  
  // Loss Metrics (4)
  loss?: number;
  eval_loss?: number;
  perplexity?: number;
  train_perplexity?: number;
  
  // Best Model Tracking (4)
  best_eval_loss?: number;
  best_epoch?: number;
  best_step?: number;
  epochs_without_improvement?: number;
  
  // Loss Trend (1)
  loss_trend?: 'improving' | 'degrading' | 'stable' | 'insufficient_data';
  
  // Dataset Stats (4)
  total_samples?: number;
  train_samples?: number;
  val_samples?: number;
  total_tokens_processed?: number;
  
  // Training Dynamics (2)
  learning_rate?: number;
  grad_norm?: number;
  
  // GPU Metrics (2)
  gpu_memory_allocated_gb?: number;
  gpu_memory_reserved_gb?: number;
  
  // Performance (2)
  elapsed_seconds?: number;
  remaining_seconds?: number;
  samples_per_second?: number;
  
  // Timestamps (4)
  started_at?: string;
  completed_at?: string;
  updated_at?: string;
  error?: string;
}
```
