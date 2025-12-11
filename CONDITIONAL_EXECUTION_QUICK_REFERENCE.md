# Conditional Execution - Quick Reference

## Basic Usage

```typescript
import DAGOrchestrator, { JobConfig } from './lib/training/dag-orchestrator';

const jobs: JobConfig[] = [
  {
    id: 'train',
    type: 'training',
    dependsOn: [],
    config: { /* training config */ },
  },
  {
    id: 'deploy',
    type: 'deployment',
    dependsOn: ['train'],
    config: { /* deployment config */ },
    // ✨ Add condition to skip if criteria not met
    condition: ({ getJobOutput }) => {
      const trainResult = getJobOutput('train');
      return trainResult.accuracy > 0.90;
    },
  },
];

const orchestrator = new DAGOrchestrator();
const execution = await orchestrator.execute('My Pipeline', jobs);

// Check if job was skipped
const deployJob = execution.jobs.get('deploy');
if (deployJob?.status === 'skipped') {
  console.log('Deploy was skipped:', deployJob.output);
}
```

## Condition Function Signature

```typescript
type ConditionFunction = (context: {
  getJobOutput: (jobId: string) => unknown;
  executionId: string;
}) => boolean | Promise<boolean>;
```

**Returns:**

- `true` → Execute the job
- `false` → Skip the job (status = 'skipped')

**Context:**

- `getJobOutput(jobId)` → Get output from completed dependency
- `executionId` → Current execution ID for logging

## Common Patterns

### 1. Quality Gate

```typescript
condition: ({ getJobOutput }) => {
  const metrics = getJobOutput('validate')?.metrics;
  return metrics.accuracy > 0.90;
}
```

### 2. Skip if Previous Job Skipped

```typescript
condition: ({ getJobOutput }) => {
  const prev = getJobOutput('previous_job');
  return !prev?.skipped; // Don't cascade skips
}
```

### 3. Async Condition (External API)

```typescript
condition: async ({ executionId }) => {
  const response = await fetch('/api/can-deploy', {
    method: 'POST',
    body: JSON.stringify({ executionId }),
  });
  const { approved } = await response.json();
  return approved;
}
```

### 4. Time-Based Execution

```typescript
condition: () => {
  const hour = new Date().getHours();
  return hour >= 2 && hour <= 6; // Maintenance window
}
```

### 5. Multi-Metric Validation

```typescript
condition: ({ getJobOutput }) => {
  const result = getJobOutput('validate');
  return (
    result.accuracy > 0.85 &&
    result.f1 > 0.80 &&
    result.precision > 0.83
  );
}
```

### 6. A/B Test Winner

```typescript
// Deploy variant A only if it beats B
condition: ({ getJobOutput }) => {
  const a = getJobOutput('validate_a').accuracy;
  const b = getJobOutput('validate_b').accuracy;
  return a > b;
}
```

## Job Status Flow

```
┌─────────┐
│ pending │
└────┬────┘
     │
┌────▼────────┐    condition: true
│ condition?  ├───────────────────┐
└────┬────────┘                   │
     │                             │
     │ condition: false            │
     │                        ┌────▼────┐
┌────▼────┐                   │ running │
│ skipped │                   └────┬────┘
└─────────┘                        │
                              ┌────▼─────────┐
                              │ completed or │
                              │   failed     │
                              └──────────────┘
```

## Skip Output Format

When a job is skipped, its output is:

```typescript
{
  skipped: true,
  reason: 'Condition not met'
}
```

## Error Handling

If condition evaluation throws:

```typescript
condition: ({ getJobOutput }) => {
  throw new Error('Oops!');
}
```

The job fails with:

```
Error: Condition evaluation failed: Oops!
```

## Best Practices

### ✅ DO

- Use type assertions when accessing job outputs
- Handle missing/null outputs gracefully
- Use `??` for default values
- Log condition decisions for debugging
- Keep conditions simple and readable
- Use async for external checks

### ❌ DON'T

- Don't mutate job outputs in conditions
- Don't make conditions too complex
- Don't forget null checks
- Don't ignore async errors
- Don't create circular dependencies

## Type-Safe Output Access

```typescript
interface ValidateOutput {
  metrics: {
    accuracy: number;
    f1: number;
  };
}

condition: ({ getJobOutput }) => {
  const result = getJobOutput('validate') as ValidateOutput | null;
  
  // Always check for null
  if (!result) return false;
  
  const { accuracy, f1 } = result.metrics;
  return accuracy > 0.90 && f1 > 0.85;
}
```

## Examples

See comprehensive examples in:

- `lib/training/dag-conditional-examples.ts` (5 examples)
- `lib/training/validate-conditional-execution.ts` (validation script)

## Testing

Run validation script:

```bash
npx tsx lib/training/validate-conditional-execution.ts
```

Expected output:

- ✅ Train job completed
- ✅ Validate job completed
- ✅ Deploy job either completed or skipped based on accuracy
- ✅ Overall execution completed

## Troubleshooting

### Condition Never Evaluates

- Check that job has `dependsOn` set correctly
- Verify dependencies complete before condition runs

### getJobOutput Returns Undefined

- Job hasn't completed yet (check dependsOn)
- Job ID misspelled
- Job was skipped (check for `output.skipped`)

### Condition Throws Error

- Add try/catch in condition function
- Check for null/undefined outputs
- Validate external API responses

### Job Never Skips

- Condition is returning true
- Add console.log to debug condition logic
- Check job output structure

## Future Enhancements (Planned)

- [ ] Condition timeout configuration
- [ ] Richer context (job config, metadata)
- [ ] Condition caching for idempotency
- [ ] String expression support: `"accuracy > 0.90"`
- [ ] Multiple conditions with AND/OR logic
- [ ] UI support in DagBuilder component
