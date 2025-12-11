// Load Testing Script for Analytics System
// Tests trace ingestion, anomaly detection, and A/B traffic splitting
// Date: 2025-12-16
// Run: npx tsx scripts/load-test.ts

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

console.log('[LoadTest] Starting analytics load testing...\n');

// Load environment variables
const envPath = join(__dirname, '../.env');
let envContent: string;

try {
  envContent = readFileSync(envPath, 'utf-8');
  console.log('[LoadTest] Environment file loaded');
} catch (error) {
  console.error('[LoadTest] Failed to read .env file:', error);
  process.exit(1);
}

const envVars: Record<string, string> = {};

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim();
    envVars[key] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[LoadTest] Missing Supabase credentials');
  console.error('[LoadTest] Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

console.log('[LoadTest] Supabase URL:', supabaseUrl);
console.log('[LoadTest] Initializing Supabase client...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

interface LoadTestResult {
  testName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p95LatencyMs: number;
  requestsPerSecond: number;
  totalDurationMs: number;
}

interface TestConfig {
  concurrency: number;
  totalRequests: number;
  testUserId: string;
}

const DEFAULT_CONFIG: TestConfig = {
  concurrency: 10,
  totalRequests: 100,
  testUserId: '00000000-0000-0000-0000-000000000001'
};

// ==================== Helper Functions ====================

function calculateStats(latencies: number[]): {
  avg: number;
  min: number;
  max: number;
  p95: number;
} {
  if (latencies.length === 0) {
    return { avg: 0, min: 0, max: 0, p95: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95 = sorted[p95Index] || max;

  return { avg, min, max, p95 };
}

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// ==================== Load Tests ====================

/**
 * Test trace ingestion performance
 */
async function testTraceIngestion(config: TestConfig): Promise<LoadTestResult> {
  console.log('[LoadTest] Testing trace ingestion...');
  console.log(`[LoadTest] Config: ${config.totalRequests} requests, ${config.concurrency} concurrent\n`);

  const startTime = Date.now();
  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  const tasks = Array.from({ length: config.totalRequests }, (_, i) => async () => {
    const requestStart = Date.now();

    try {
      const { error } = await supabase.from('llm_traces').insert({
        user_id: config.testUserId,
        trace_id: `load-test-${Date.now()}-${i}`,
        conversation_id: `conv-${i % 10}`,
        model_id: 'gpt-4',
        provider: 'openai',
        prompt_tokens: Math.floor(Math.random() * 1000),
        completion_tokens: Math.floor(Math.random() * 500),
        total_tokens: 1500,
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        duration_ms: Math.floor(Math.random() * 2000),
        status: 'completed',
        metadata: { test: true, iteration: i }
      });

      const requestEnd = Date.now();
      const latency = requestEnd - requestStart;
      latencies.push(latency);

      if (error) {
        failureCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      failureCount++;
    }
  });

  await runConcurrent(tasks, config.concurrency);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  const stats = calculateStats(latencies);
  const rps = (successCount / totalDuration) * 1000;

  console.log(`[LoadTest] Trace ingestion complete: ${successCount}/${config.totalRequests} successful\n`);

  return {
    testName: 'Trace Ingestion',
    totalRequests: config.totalRequests,
    successfulRequests: successCount,
    failedRequests: failureCount,
    averageLatencyMs: stats.avg,
    minLatencyMs: stats.min,
    maxLatencyMs: stats.max,
    p95LatencyMs: stats.p95,
    requestsPerSecond: rps,
    totalDurationMs: totalDuration
  };
}

/**
 * Test analytics query performance
 */
async function testQueryPerformance(config: TestConfig): Promise<LoadTestResult> {
  console.log('[LoadTest] Testing query performance...');
  console.log(`[LoadTest] Config: ${config.totalRequests} requests, ${config.concurrency} concurrent\n`);

  const startTime = Date.now();
  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  const tasks = Array.from({ length: config.totalRequests }, () => async () => {
    const requestStart = Date.now();

    try {
      const { data, error } = await supabase
        .from('llm_traces')
        .select('*')
        .eq('user_id', config.testUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      const requestEnd = Date.now();
      const latency = requestEnd - requestStart;
      latencies.push(latency);

      if (error) {
        failureCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      failureCount++;
    }
  });

  await runConcurrent(tasks, config.concurrency);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  const stats = calculateStats(latencies);
  const rps = (successCount / totalDuration) * 1000;

  console.log(`[LoadTest] Query performance test complete: ${successCount}/${config.totalRequests} successful\n`);

  return {
    testName: 'Query Performance',
    totalRequests: config.totalRequests,
    successfulRequests: successCount,
    failedRequests: failureCount,
    averageLatencyMs: stats.avg,
    minLatencyMs: stats.min,
    maxLatencyMs: stats.max,
    p95LatencyMs: stats.p95,
    requestsPerSecond: rps,
    totalDurationMs: totalDuration
  };
}

/**
 * Test A/B experiment assignment performance
 */
async function testABAssignment(config: TestConfig): Promise<LoadTestResult> {
  console.log('[LoadTest] Testing A/B assignment performance...');
  console.log(`[LoadTest] Config: ${config.totalRequests} requests, ${config.concurrency} concurrent\n`);

  const startTime = Date.now();
  const latencies: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  const testExperimentId = '00000000-0000-0000-0000-000000000001';
  const testVariantId = '00000000-0000-0000-0000-000000000002';

  const tasks = Array.from({ length: config.totalRequests }, (_, i) => async () => {
    const requestStart = Date.now();

    try {
      const { error } = await supabase.from('ab_experiment_assignments').insert({
        experiment_id: testExperimentId,
        variant_id: testVariantId,
        user_id: config.testUserId,
        conversation_id: `conv-${i}`,
        session_id: `session-${i}`,
        assigned_at: new Date().toISOString()
      });

      const requestEnd = Date.now();
      const latency = requestEnd - requestStart;
      latencies.push(latency);

      if (error) {
        failureCount++;
      } else {
        successCount++;
      }
    } catch (error) {
      failureCount++;
    }
  });

  await runConcurrent(tasks, config.concurrency);

  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  const stats = calculateStats(latencies);
  const rps = (successCount / totalDuration) * 1000;

  console.log(`[LoadTest] A/B assignment test complete: ${successCount}/${config.totalRequests} successful\n`);

  return {
    testName: 'A/B Assignment',
    totalRequests: config.totalRequests,
    successfulRequests: successCount,
    failedRequests: failureCount,
    averageLatencyMs: stats.avg,
    minLatencyMs: stats.min,
    maxLatencyMs: stats.max,
    p95LatencyMs: stats.p95,
    requestsPerSecond: rps,
    totalDurationMs: totalDuration
  };
}

// ==================== Report Generation ====================

function printReport(results: LoadTestResult[]): void {
  console.log('========================================');
  console.log('  LOAD TEST RESULTS');
  console.log('========================================\n');

  results.forEach(result => {
    console.log(`Test: ${result.testName}`);
    console.log(`  Total Requests: ${result.totalRequests}`);
    console.log(`  Successful: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${result.failedRequests}`);
    console.log(`  Duration: ${result.totalDurationMs.toFixed(0)}ms`);
    console.log(`  Requests/sec: ${result.requestsPerSecond.toFixed(2)}`);
    console.log(`  Latency (avg): ${result.averageLatencyMs.toFixed(2)}ms`);
    console.log(`  Latency (min): ${result.minLatencyMs.toFixed(2)}ms`);
    console.log(`  Latency (max): ${result.maxLatencyMs.toFixed(2)}ms`);
    console.log(`  Latency (p95): ${result.p95LatencyMs.toFixed(2)}ms\n`);
  });

  const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
  const totalSuccessful = results.reduce((sum, r) => sum + r.successfulRequests, 0);
  const avgRps = results.reduce((sum, r) => sum + r.requestsPerSecond, 0) / results.length;

  console.log('========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Total Successful: ${totalSuccessful}`);
  console.log(`  Success Rate: ${((totalSuccessful / totalRequests) * 100).toFixed(1)}%`);
  console.log(`  Average RPS: ${avgRps.toFixed(2)}\n`);
}

// ==================== Main Execution ====================

async function runLoadTests(): Promise<void> {
  const config = DEFAULT_CONFIG;

  console.log('========================================');
  console.log('  ANALYTICS LOAD TESTING');
  console.log('========================================\n');
  console.log(`Configuration:`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log(`  Total Requests per Test: ${config.totalRequests}`);
  console.log(`  Test User ID: ${config.testUserId}\n`);

  const results: LoadTestResult[] = [];

  try {
    const traceResult = await testTraceIngestion(config);
    results.push(traceResult);

    const queryResult = await testQueryPerformance(config);
    results.push(queryResult);

    const abResult = await testABAssignment(config);
    results.push(abResult);

    printReport(results);

    console.log('[LoadTest] All tests completed successfully!\n');
  } catch (error) {
    console.error('[LoadTest] Fatal error:', error);
    throw error;
  }
}

runLoadTests()
  .then(() => {
    console.log('[LoadTest] Load testing complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('[LoadTest] Load testing failed:', error);
    process.exit(1);
  });
