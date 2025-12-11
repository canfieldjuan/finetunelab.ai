/**
 * Validation tests for DistributedOrchestrator
 * Manual test suite without test framework dependencies
 */

import { getDistributedOrchestrator, closeDistributedOrchestrator } from './distributed-orchestrator';
import { getWorkerManager, WorkerRegistration, generateWorkerId, getWorkerMetadata } from './worker-manager';
import { getStateStore } from './state-store';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      testsPassed++;
    } catch (error) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      testsFailed++;
    }
  })();
}

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: unknown) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be greater than or equal to ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy, got ${actual}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null, got ${actual}`);
      }
    },
    toContain(expected: unknown) {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected as string)) {
          throw new Error(`Expected string to contain ${expected}`);
        }
      } else {
        throw new Error('toContain only works with arrays or strings');
      }
    },
  };
}

// Run tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('DISTRIBUTED ORCHESTRATOR VALIDATION');
  console.log('='.repeat(80));
  console.log();

  console.log('Initializing distributed orchestrator...');
  const orchestrator = getDistributedOrchestrator({
    redis: {
      host: 'localhost',
      port: 6379,
    },
    orchestratorId: 'test-orchestrator-1',
    enableFailover: true,
    failoverCheckIntervalMs: 5000, // 5s for testing
    jobTimeoutMs: 30000, // 30s timeout
  });

  await orchestrator.initialize();
  console.log('✅ Distributed orchestrator initialized');
  console.log();

  // Register test workers
  console.log('--- Worker Setup ---');
  console.log();

  const workerManager = getWorkerManager();

  const worker1: WorkerRegistration = {
    workerId: generateWorkerId(),
    hostname: 'test-worker-1',
    pid: process.pid,
    capabilities: ['cpu'],
    maxConcurrency: 2,
    currentLoad: 0,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'idle',
    metadata: getWorkerMetadata(),
  };

  const worker2: WorkerRegistration = {
    workerId: generateWorkerId(),
    hostname: 'test-worker-2',
    pid: process.pid,
    capabilities: ['cpu', 'high-memory'],
    maxConcurrency: 3,
    currentLoad: 0,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'idle',
    metadata: getWorkerMetadata(),
  };

  await workerManager.registerWorker(worker1);
  await workerManager.registerWorker(worker2);
  console.log(`✅ Registered 2 test workers: ${worker1.workerId}, ${worker2.workerId}`);
  console.log();

  console.log('--- Distributed Orchestrator Tests ---');
  console.log();

  // Test 1: Get initial stats
  await test('Get distributed stats', async () => {
    const stats = await orchestrator.getStats();
    expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
  });

  // Test 2: Simple single job execution (simulated)
  await test('Create execution state', async () => {
    // Note: Full execution would require worker processes to consume jobs
    // For now, we test state management only
    const executionId = `test_exec_${Date.now()}`;
    const status = await orchestrator.getExecutionStatus(executionId);
    expect(status).toBeNull(); // Doesn't exist yet
  });

  // Test 3: Pause/resume execution
  await test('Pause execution', async () => {
    const executionId = `test_exec_pause_${Date.now()}`;
    
    // Create a dummy execution state first
    const stateStore = getStateStore();
    await stateStore.setExecutionState({
      executionId,
      workflowId: 'test-workflow',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    });

    const paused = await orchestrator.pauseExecution(executionId);
    expect(paused).toBe(true);

    const status = await orchestrator.getExecutionStatus(executionId);
    expect(status?.status).toBe('paused');
  });

  // Test 4: Resume execution
  await test('Resume execution', async () => {
    const executionId = `test_exec_resume_${Date.now()}`;
    
    const stateStore = getStateStore();
    await stateStore.setExecutionState({
      executionId,
      workflowId: 'test-workflow',
      status: 'paused',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    });

    const resumed = await orchestrator.resumeExecution(executionId);
    expect(resumed).toBe(true);

    const status = await orchestrator.getExecutionStatus(executionId);
    expect(status?.status).toBe('running');
  });

  // Test 5: Cancel execution
  await test('Cancel execution', async () => {
    const executionId = `test_exec_cancel_${Date.now()}`;
    
    const stateStore = getStateStore();
    await stateStore.setExecutionState({
      executionId,
      workflowId: 'test-workflow',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: ['job-1'],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    });

    const cancelled = await orchestrator.cancelExecution(executionId);
    expect(cancelled).toBe(true);

    const status = await orchestrator.getExecutionStatus(executionId);
    expect(status?.status).toBe('cancelled');
  });

  // Test 6: Get stats after worker registration
  await test('Get stats with workers', async () => {
    const stats = await orchestrator.getStats();
    expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    expect(stats.activeWorkers).toBeGreaterThanOrEqual(2);
  });

  // Test 7: Orchestrator health check
  await test('Orchestrator health check', async () => {
    const stats = await orchestrator.getStats();
    expect(stats).toBeTruthy();
    expect(typeof stats.totalWorkers).toBe('number');
    expect(typeof stats.queuedJobs).toBe('number');
  });

  // Cleanup
  console.log();
  console.log('Cleaning up...');
  await workerManager.deregisterWorker(worker1.workerId);
  await workerManager.deregisterWorker(worker2.workerId);
  await closeDistributedOrchestrator();
  console.log('✅ Cleanup complete');
  console.log();

  // Print summary
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests:  ${testsPassed + testsFailed}`);
  console.log(`✅ Passed:     ${testsPassed}`);
  console.log(`❌ Failed:     ${testsFailed}`);
  console.log(`Success rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));
  console.log();

  if (testsFailed === 0) {
    console.log('🎉 All distributed orchestrator tests passed!');
  } else {
    console.log('⚠️  Some tests failed. See errors above.');
    console.log();
    process.exit(1);
  }
}

// Run all tests
runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
