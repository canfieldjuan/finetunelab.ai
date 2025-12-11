# DAG Orchestrator API Routes

TypeScript-native DAG (Directed Acyclic Graph) orchestration system for Next.js.

## Overview

This directory contains all API routes for the DAG orchestrator, which enables you to:

- Execute multi-step training pipelines
- Define job dependencies and parallel execution
- Monitor real-time progress via Server-Sent Events
- Save and reuse pipeline templates
- Validate pipeline configurations before execution

## Quick Start

### 1. Execute a Pipeline

```typescript
const response = await fetch('/api/training/dag/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'my-first-pipeline',
    jobs: [
      {
        id: 'step1',
        name: 'Load Data',
        type: 'preprocessing',
        dependsOn: [],
        config: { source: 'dataset.csv' }
      },
      {
        id: 'step2',
        name: 'Train Model',
        type: 'training',
        dependsOn: ['step1'],
        config: { epochs: 10 }
      }
    ]
  })
});

const { executionId } = await response.json();
```

### 2. Monitor Progress

```typescript
const eventSource = new EventSource(`/api/training/dag/logs/${executionId}`);

eventSource.addEventListener('log', (e) => {
  const log = JSON.parse(e.data);
  console.log(log.message);
});

eventSource.addEventListener('complete', () => {
  console.log('Done!');
  eventSource.close();
});
```

## Available Routes

### Execution

- **`POST /execute`** - Start a pipeline execution
- **`GET /status/:id`** - Get execution status
- **`GET /logs/:id`** - Stream real-time logs (SSE)
- **`POST /cancel/:id`** - Cancel a running execution
- **`GET /list`** - List all executions

### Validation

- **`POST /validate`** - Validate DAG configuration

### Templates

- **`GET /templates`** - List all templates
- **`POST /templates`** - Create a new template
- **`GET /templates/:id`** - Get template by ID
- **`DELETE /templates/:id`** - Delete a template

## Job Types

Four built-in job types with handlers:

1. **`preprocessing`** - Data loading and transformation
2. **`training`** - Model training
3. **`validation`** - Model evaluation
4. **`deployment`** - Model deployment

## Features

✅ **Dependency Management** - Define job dependencies, automatic ordering  
✅ **Parallel Execution** - Run independent jobs simultaneously  
✅ **Error Handling** - Retry logic with exponential backoff  
✅ **Real-time Monitoring** - Server-Sent Events for live updates  
✅ **Database Persistence** - All executions saved to Supabase  
✅ **Template Library** - Save and reuse common pipelines  
✅ **Validation** - Detect cycles and invalid dependencies  

## Example Pipeline

```typescript
{
  "name": "ml-training-pipeline",
  "jobs": [
    {
      "id": "fetch",
      "name": "Fetch Data",
      "type": "preprocessing",
      "dependsOn": [],
      "config": { "source": "s3://bucket/data.csv" }
    },
    {
      "id": "clean",
      "name": "Clean Data",
      "type": "preprocessing",
      "dependsOn": ["fetch"],
      "config": { "remove_duplicates": true }
    },
    {
      "id": "train-rf",
      "name": "Train Random Forest",
      "type": "training",
      "dependsOn": ["clean"],
      "config": { "model": "random_forest", "n_estimators": 100 }
    },
    {
      "id": "train-xgb",
      "name": "Train XGBoost",
      "type": "training",
      "dependsOn": ["clean"],
      "config": { "model": "xgboost", "max_depth": 6 }
    },
    {
      "id": "validate",
      "name": "Cross-Validation",
      "type": "validation",
      "dependsOn": ["train-rf", "train-xgb"],
      "config": { "k_folds": 5 }
    },
    {
      "id": "deploy",
      "name": "Deploy Best Model",
      "type": "deployment",
      "dependsOn": ["validate"],
      "config": { "environment": "production" }
    }
  ],
  "options": {
    "parallelism": 2
  }
}
```

This pipeline:
- Fetches and cleans data sequentially
- Trains two models in parallel
- Validates both models
- Deploys the best one

## Documentation

- **[Complete API Docs](../../../docs/DAG_API_DOCUMENTATION.md)** - Full reference with examples
- **[Quick Reference](../../../docs/DAG_API_QUICK_REFERENCE.md)** - Essential commands
- **[Implementation Summary](../../../docs/DAG_IMPLEMENTATION_SUMMARY.md)** - Architecture overview

## Testing

```bash
# Test core orchestrator
npx tsx test-dag.ts

# Test API endpoints (requires running Next.js server)
npm run dev  # Terminal 1
npx tsx test-dag-api.ts  # Terminal 2
```

## Dependencies

- Next.js 14+
- Supabase (for persistence)
- TypeScript 5+

No external DAG orchestration services required!

## Database Schema

Three tables created by migration `20251023000002`:

```sql
training_jobs       -- Stores DAG executions
training_metrics    -- Stores job metrics and logs
training_pipelines  -- Stores reusable templates
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  API Routes (Next.js)                           │
│  ├── execute    - Start execution               │
│  ├── status     - Get status                    │
│  ├── logs       - Stream logs (SSE)             │
│  └── templates  - Manage templates              │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  DAG Orchestrator (TypeScript)                  │
│  ├── Topological Sort                           │
│  ├── Cycle Detection                            │
│  ├── Parallel Execution                         │
│  ├── Retry Logic                                │
│  └── Progress Tracking                          │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Job Handlers                                   │
│  ├── Training Handler                           │
│  ├── Preprocessing Handler                      │
│  ├── Validation Handler                         │
│  └── Deployment Handler                         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│  Supabase (PostgreSQL)                          │
│  ├── training_jobs                              │
│  ├── training_metrics                           │
│  └── training_pipelines                         │
└─────────────────────────────────────────────────┘
```

## Contributing

To add a custom job handler:

1. Edit `/lib/training/job-handlers.ts`
2. Register in `defaultHandlers` export
3. Handler receives `(job, context)` with:
   - `context.log(msg)` - Add log message
   - `context.getJobOutput(id)` - Get dependency output
   - `context.updateProgress(pct)` - Update progress

Example:

```typescript
export const customHandler: JobHandler = async (job, context) => {
  context.log('Starting custom job');
  
  const inputData = context.getJobOutput('previous-job-id');
  
  await context.updateProgress(25);
  const result = await processData(inputData, job.config);
  
  await context.updateProgress(100);
  context.log('Job completed');
  
  return result;
};
```

## License

MIT
