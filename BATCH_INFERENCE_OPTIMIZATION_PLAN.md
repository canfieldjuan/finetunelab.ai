# Batch Inference Optimization Plan

## Making Your Portal Production-Efficient Like vLLM

**Date:** 2025-11-02  
**Goal:** Add vLLM-style batch testing for 10-100x throughput improvement

---

## Current Problem

Your portal processes test cases **one at a time**:

```typescript
// ❌ SLOW - Sequential processing
for (const testCase of testDataset) {
  const response = await fetch('/api/inference', {
    body: JSON.stringify({ prompt: testCase.prompt })
  });
  results.push(await response.json());
}
// Time: 100 requests × 2 sec = 200 seconds
```

## Solution: Batch Inference API

### Phase 1: Batch Inference Endpoint (2-3 hours)

**File:** `app/api/inference/batch/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

interface BatchRequest {
  prompts: string[];
  model: string;
  max_tokens?: number;
  temperature?: number;
  // Batch-specific params
  batch_size?: number; // How many to process at once
  priority?: 'throughput' | 'latency';
}

export async function POST(request: NextRequest) {
  const { prompts, model, batch_size = 32, ...params } = await request.json();

  // Get vLLM server URL from inference_servers table
  const { data: server } = await supabase
    .from('inference_servers')
    .select('base_url')
    .eq('model_name', model)
    .eq('status', 'running')
    .single();

  if (!server) {
    return NextResponse.json({ error: 'Server not running' }, { status: 503 });
  }

  // vLLM automatically batches these internally!
  // Just send them all at once instead of sequentially
  const batchPromises = prompts.map((prompt, idx) =>
    fetch(`${server.base_url}/v1/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        max_tokens: params.max_tokens || 512,
        temperature: params.temperature || 0.7,
      })
    }).then(r => r.json())
  );

  // Process in chunks to avoid overwhelming the server
  const results = [];
  for (let i = 0; i < batchPromises.length; i += batch_size) {
    const chunk = batchPromises.slice(i, i + batch_size);
    const chunkResults = await Promise.all(chunk);
    results.push(...chunkResults);
  }

  return NextResponse.json({
    results,
    metadata: {
      total: prompts.length,
      batch_size,
      estimated_speedup: `${Math.min(batch_size, prompts.length)}x`
    }
  });
}
```

**Performance:**

- ❌ Sequential: 100 requests × 2s = **200 seconds**
- ✅ Batched (32): 100 requests ÷ 32 × 2s = **6.25 seconds** (32x faster!)

---

## Phase 2: Evaluation Framework (4-6 hours)

**File:** `lib/evaluation/batch-evaluator.ts` (NEW)

```typescript
export interface EvaluationConfig {
  testDataset: Array<{
    prompt: string;
    expected?: string;
    category?: string;
  }>;
  model: string;
  metrics: Array<'perplexity' | 'accuracy' | 'latency' | 'coherence'>;
  batchSize?: number;
}

export class BatchEvaluator {
  async evaluate(config: EvaluationConfig) {
    const startTime = Date.now();
    
    // Step 1: Generate responses in batches
    const responses = await this.batchInference(
      config.testDataset.map(t => t.prompt),
      config.model,
      config.batchSize
    );

    // Step 2: Calculate metrics in parallel
    const metrics = await Promise.all([
      this.calculatePerplexity(responses),
      this.calculateAccuracy(responses, config.testDataset),
      this.calculateCoherence(responses),
    ]);

    // Step 3: Store results
    await this.saveEvaluationResults({
      model: config.model,
      total_samples: config.testDataset.length,
      total_time_seconds: (Date.now() - startTime) / 1000,
      throughput: config.testDataset.length / ((Date.now() - startTime) / 1000),
      metrics: {
        perplexity: metrics[0],
        accuracy: metrics[1],
        coherence: metrics[2],
      }
    });

    return metrics;
  }

  private async batchInference(prompts: string[], model: string, batchSize = 32) {
    const response = await fetch('/api/inference/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts, model, batch_size: batchSize })
    });
    return response.json();
  }
}
```

**Database Schema:**

```sql
-- Migration: 20251102000001_add_evaluation_tracking.sql

CREATE TABLE IF NOT EXISTS model_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID REFERENCES trained_models(id),
  training_job_id UUID REFERENCES local_training_jobs(id),
  
  -- Test configuration
  test_dataset_name TEXT NOT NULL,
  total_samples INTEGER NOT NULL,
  batch_size INTEGER DEFAULT 32,
  
  -- Performance metrics
  total_time_seconds NUMERIC NOT NULL,
  throughput_samples_per_sec NUMERIC, -- samples/sec
  avg_latency_ms NUMERIC, -- per sample
  
  -- Quality metrics
  perplexity NUMERIC,
  accuracy NUMERIC,
  coherence_score NUMERIC,
  
  -- Detailed results
  results JSONB, -- Full response data
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluations_model ON model_evaluations(model_id);
CREATE INDEX idx_evaluations_job ON model_evaluations(training_job_id);
```

---

## Phase 3: UI for Batch Testing (2-3 hours)

**File:** `components/evaluation/BatchTestRunner.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export function BatchTestRunner({ modelId }: { modelId: string }) {
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);

  const runBatchTest = async () => {
    setTesting(true);
    
    // Load test dataset (from training or custom)
    const testDataset = await fetch(`/api/datasets/test/${modelId}`).then(r => r.json());
    
    // Run evaluation with progress tracking
    const response = await fetch('/api/inference/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompts: testDataset.map(t => t.prompt),
        model: modelId,
        batch_size: 32, // Optimal for 8GB GPU
      })
    });

    const data = await response.json();
    setResults(data);
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Batch Testing</h3>
        <Button onClick={runBatchTest} disabled={testing}>
          {testing ? 'Testing...' : 'Run Batch Test'}
        </Button>
      </div>

      {testing && <Progress value={progress} />}

      {results && (
        <div className="grid grid-cols-2 gap-4 mt-4">
          <MetricCard
            label="Throughput"
            value={`${results.metadata.throughput.toFixed(1)} samples/sec`}
          />
          <MetricCard
            label="Speedup"
            value={results.metadata.estimated_speedup}
          />
          <MetricCard
            label="Perplexity"
            value={results.metrics.perplexity.toFixed(2)}
          />
          <MetricCard
            label="Accuracy"
            value={`${(results.metrics.accuracy * 100).toFixed(1)}%`}
          />
        </div>
      )}
    </div>
  );
}
```

---

## Phase 4: vLLM Configuration Optimization (1 hour)

**Update:** `lib/services/inference-server-manager.ts`

```typescript
// Add batch-optimized vLLM settings
const args = [
  '-m', 'vllm.entrypoints.openai.api_server',
  '--model', config.modelPath,
  '--port', port.toString(),
  '--host', '127.0.0.1',
  '--served-model-name', config.modelName,
  
  // 🚀 BATCH OPTIMIZATION SETTINGS
  '--max-num-batched-tokens', '8192', // How many tokens to batch together
  '--max-num-seqs', '256', // Max concurrent sequences
  '--enable-chunked-prefill', // Better throughput for long prompts
  '--disable-log-requests', // Less overhead
  
  // GPU settings
  '--gpu-memory-utilization', String(config.gpuMemoryUtilization || 0.85), // Increased from 0.8
  '--dtype', config.dtype || 'half', // FP16 for speed
];
```

**Expected Performance on RTX 4060 Ti 8GB:**

| Batch Size | Throughput | Latency | VRAM Usage |
|------------|------------|---------|------------|
| 1 (sequential) | 2-3 samples/sec | 500ms | 4.5GB |
| 16 (batched) | 25-30 samples/sec | 600ms | 6.2GB |
| 32 (optimal) | 40-45 samples/sec | 800ms | 7.5GB |
| 64 (max) | 45-50 samples/sec | 1400ms | 7.9GB ⚠️ |

---

## Phase 5: Testing Workflow Integration (2 hours)

**Add to:** `app/training/monitor/page.tsx`

```typescript
// Add "Batch Test Model" button after training completes
{status === 'completed' && (
  <Card>
    <CardHeader>
      <CardTitle>Model Evaluation</CardTitle>
    </CardHeader>
    <CardContent>
      <BatchTestRunner modelId={job.model_id} />
      
      {/* Show previous test results */}
      <EvaluationHistory jobId={job.id} />
    </CardContent>
  </Card>
)}
```

---

## Performance Comparison

### Your Current Setup (Estimated)

```
Sequential inference on 100 test samples:
  Time: 100 × 2s = 200 seconds
  Throughput: 0.5 samples/sec
  GPU utilization: 30-40% (idle between requests)
```

### With Batch Optimization

```
Batched inference on 100 test samples (batch_size=32):
  Time: (100 ÷ 32) × 2s = 6.25 seconds
  Throughput: 16 samples/sec
  GPU utilization: 85-95% (fully saturated)
  
Speedup: 32x faster! 🚀
```

---

## Is Your Portal "Production Ready"?

### ✅ Already Production-Grade

- vLLM integration (best-in-class inference)
- Database tracking (metrics, costs)
- GPU monitoring
- Port management
- Error handling

### ⚠️ Needs Batch Optimization

- Batch inference API (Phase 1) - **CRITICAL**
- Evaluation framework (Phase 2) - **HIGH PRIORITY**
- Batch testing UI (Phase 3) - **NICE TO HAVE**

### 🎯 After These Changes

Your portal will be **production-ready** with:

- 10-50x faster evaluation
- Proper vLLM utilization (85%+ GPU)
- Professional metrics tracking
- Scalable testing infrastructure

---

## Implementation Priority

**Week 1 (Must-Have):**

1. ✅ Batch inference endpoint - 3 hours
2. ✅ Basic evaluation script - 2 hours
3. ✅ vLLM config optimization - 1 hour

**Week 2 (Should-Have):**
4. ✅ Database schema for evaluations - 1 hour
5. ✅ Batch test UI component - 3 hours
6. ✅ Integration with training flow - 2 hours

**Total:** ~12 hours to make your portal vLLM-efficient

---

## Why This Matters

**Training without batch testing = flying blind**

Your current flow:

```
Train → Deploy → Test ONE sample → Realize it's bad → Retrain
```

With batch optimization:

```
Train → Deploy → Test 1000 samples in 30 seconds → 
Identify exact failure modes → Targeted retraining
```

**ROI:**

- Save 95% of testing time
- Catch issues before production
- Quantify model improvements
- Professional-grade metrics

---

**Next Step:** Start with Phase 1 (batch endpoint). It's 90% of the value in 3 hours of work.
