# FineTune Lab SDK

Official TypeScript/JavaScript SDK for FineTune Lab API.

## Installation

```bash
npm install @finetunelab/sdk
# or
yarn add @finetunelab/sdk
# or
pnpm add @finetunelab/sdk
```

## Quick Start

```typescript
import { FinetuneLabClient } from '@finetunelab/sdk';

const client = new FinetuneLabClient({
  apiKey: 'wak_your_api_key_here',
  // baseUrl: 'https://your-app.com', // Optional custom base URL
});
```

Or use environment variables:

```bash
export FINETUNE_LAB_API_KEY=wak_xxx
export FINETUNE_LAB_API_URL=https://app.finetunelab.com  # Optional
```

```typescript
const client = new FinetuneLabClient(); // Uses env vars
```

## Inference (Production Scope)

```typescript
const response = await client.predict({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' },
  ],
  temperature: 0.7,
  maxTokens: 1000,
});

console.log(response.choices[0].message.content);
```

## Batch Testing (Testing Scope)

### Run a Batch Test

```typescript
const test = await client.batchTest.run({
  modelId: 'gpt-4',
  testSuiteId: 'suite_abc123',
  promptLimit: 50,
  concurrency: 5,
});

console.log(`Test started: ${test.testId}`);
```

### Check Status

```typescript
const status = await client.batchTest.status(test.testId);

console.log(`Status: ${status.status}`);
console.log(`Progress: ${status.completedPrompts}/${status.totalPrompts}`);
```

### Cancel a Test

```typescript
await client.batchTest.cancel(test.testId);
```

## Analytics (Production Scope)

### Get Traces

```typescript
const traces = await client.analytics.traces({
  limit: 50,
  offset: 0,
});

for (const trace of traces.traces) {
  console.log(`${trace.spanName}: ${trace.durationMs}ms`);
}
```

### Create a Trace

```typescript
await client.analytics.createTrace({
  traceId: 'trace_123',
  spanId: 'span_456',
  spanName: 'llm.completion',
  startTime: new Date().toISOString(),
  modelName: 'gpt-4',
  inputTokens: 100,
  outputTokens: 200,
});
```

### Get Analytics Data

```typescript
const data = await client.analytics.data({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  granularity: 'day',
});

console.log(`Total requests: ${data.summary.totalRequests}`);
```

## Error Handling

```typescript
import { FinetuneLabClient, FinetuneLabError } from '@finetunelab/sdk';

try {
  await client.predict({ model: 'invalid', messages: [] });
} catch (error) {
  if (error instanceof FinetuneLabError) {
    console.error(`Error ${error.statusCode}: ${error.message}`);
    console.error('Type:', error.type);
  }
}
```

## API Key Scopes

Your API key must have the appropriate scope for each operation:

| Operation | Required Scope |
|-----------|---------------|
| `predict()` | `production` or `all` |
| `batchTest.*` | `testing` or `all` |
| `analytics.*` | `production` or `all` |

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  PredictRequest,
  PredictResponse,
  BatchTestConfig,
  TraceFilters,
} from '@finetunelab/sdk';
```

## License

MIT
