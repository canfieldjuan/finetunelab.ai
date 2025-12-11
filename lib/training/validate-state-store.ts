/**
 * Validation tests for StateStore
 * Manual test suite without test framework dependencies
 */

import { ExecutionState, JobResult, getStateStore, closeStateStore } from './state-store';

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
  console.log('STATE STORE VALIDATION');
  console.log('='.repeat(80));
  console.log();

  // Create state store
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  console.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);
  const store = getStateStore({
    redis: {
      host: redisHost,
      port: redisPort,
    },
    lockTTL: 5000, // 5 seconds for faster testing
    stateTTL: 3600, // 1 hour
  });

  // Wait for connection
  await new Promise((resolve) => setTimeout(resolve, 500));
  const healthy = await store.isHealthy();
  if (healthy) {
    console.log('✅ Connected to Redis');
  } else {
    console.log('❌ Failed to connect to Redis');
    process.exit(1);
  }
  console.log();

  console.log('--- Distributed Lock Tests ---');
  console.log();

  // Test 1: Acquire lock
  await test('Acquire distributed lock', async () => {
    const lockId = await store.acquireLock('test-resource-1', 'owner-1');
    expect(lockId).toBeTruthy();
  });

  // Test 2: Lock contention
  await test('Lock prevents concurrent access', async () => {
    const lock1 = await store.acquireLock('test-resource-2', 'owner-1');
    expect(lock1).toBeTruthy();

    // Try to acquire same lock
    const lock2 = await store.acquireLock('test-resource-2', 'owner-2');
    expect(lock2).toBeNull();

    // Release first lock
    const released = await store.releaseLock('test-resource-2', lock1!);
    expect(released).toBe(true);

    // Now should be able to acquire
    const lock3 = await store.acquireLock('test-resource-2', 'owner-2');
    expect(lock3).toBeTruthy();

    // Cleanup
    await store.releaseLock('test-resource-2', lock3!);
  });

  // Test 3: Release lock
  await test('Release distributed lock', async () => {
    const lockId = await store.acquireLock('test-resource-3', 'owner-1');
    expect(lockId).toBeTruthy();

    const released = await store.releaseLock('test-resource-3', lockId!);
    expect(released).toBe(true);

    // Should be able to acquire again
    const newLockId = await store.acquireLock('test-resource-3', 'owner-2');
    expect(newLockId).toBeTruthy();

    // Cleanup
    await store.releaseLock('test-resource-3', newLockId!);
  });

  // Test 4: Extend lock
  await test('Extend lock TTL', async () => {
    const lockId = await store.acquireLock('test-resource-4', 'owner-1', 2000);
    expect(lockId).toBeTruthy();

    const extended = await store.extendLock('test-resource-4', lockId!, 3000);
    expect(extended).toBe(true);

    // Cleanup
    await store.releaseLock('test-resource-4', lockId!);
  });

  // Test 5: Get lock info
  await test('Get lock information', async () => {
    const lockId = await store.acquireLock('test-resource-5', 'owner-1');
    expect(lockId).toBeTruthy();

    const lockInfo = await store.getLock('test-resource-5');
    expect(lockInfo).toBeTruthy();
    expect(lockInfo?.owner).toBe('owner-1');
    expect(lockInfo?.resource).toBe('test-resource-5');

    // Cleanup
    await store.releaseLock('test-resource-5', lockId!);
  });

  console.log();
  console.log('--- Execution State Tests ---');
  console.log();

  // Test 6: Store execution state
  await test('Store execution state', async () => {
    const state: ExecutionState = {
      executionId: 'exec-1',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: ['job-1', 'job-2'],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: { test: true },
    };

    await store.setExecutionState(state);

    const retrieved = await store.getExecutionState('exec-1');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.executionId).toBe('exec-1');
    expect(retrieved?.status).toBe('running');
    expect(retrieved?.currentJobs).toContain('job-1');
  });

  // Test 7: Update execution status
  await test('Update execution status', async () => {
    const state: ExecutionState = {
      executionId: 'exec-2',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const updated = await store.updateExecutionStatus('exec-2', 'completed', { finishedBy: 'test' });
    expect(updated).toBe(true);

    const retrieved = await store.getExecutionState('exec-2');
    expect(retrieved?.status).toBe('completed');
    expect(retrieved?.completedAt).toBeTruthy();
  });

  // Test 8: Add current job
  await test('Add job to current jobs', async () => {
    const state: ExecutionState = {
      executionId: 'exec-3',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const added = await store.addCurrentJob('exec-3', 'job-10');
    expect(added).toBe(true);

    const retrieved = await store.getExecutionState('exec-3');
    expect(retrieved?.currentJobs).toContain('job-10');
  });

  // Test 9: Complete job (success)
  await test('Complete job successfully', async () => {
    const state: ExecutionState = {
      executionId: 'exec-4',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: ['job-20'],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const result: JobResult = {
      jobId: 'job-20',
      success: true,
      output: { data: 'test' },
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      workerId: 'worker-1',
      executionTime: 1000,
    };

    const completed = await store.completeJob('exec-4', 'job-20', result);
    expect(completed).toBe(true);

    const retrieved = await store.getExecutionState('exec-4');
    expect(retrieved?.completedJobs).toContain('job-20');
    // currentJobs should not contain job-20 anymore
    const hasJob = Array.isArray(retrieved?.currentJobs) 
      ? retrieved.currentJobs.includes('job-20')
      : Object.values(retrieved?.currentJobs || {}).includes('job-20');
    expect(hasJob).toBe(false);
    expect(retrieved?.jobResults['job-20'].success).toBe(true);
  });

  // Test 10: Complete job (failure)
  await test('Complete job with failure', async () => {
    const state: ExecutionState = {
      executionId: 'exec-5',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: ['job-30'],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const result: JobResult = {
      jobId: 'job-30',
      success: false,
      error: 'Test error',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      workerId: 'worker-1',
      executionTime: 1000,
    };

    const completed = await store.completeJob('exec-5', 'job-30', result);
    expect(completed).toBe(true);

    const retrieved = await store.getExecutionState('exec-5');
    expect(retrieved?.failedJobs).toContain('job-30');
    // currentJobs should not contain job-30 anymore
    const hasJob = Array.isArray(retrieved?.currentJobs)
      ? retrieved.currentJobs.includes('job-30')
      : Object.values(retrieved?.currentJobs || {}).includes('job-30');
    expect(hasJob).toBe(false);
    expect(retrieved?.jobResults['job-30'].success).toBe(false);
  });

  // Test 11: Set checkpoint
  await test('Link execution to checkpoint', async () => {
    const state: ExecutionState = {
      executionId: 'exec-6',
      workflowId: 'workflow-1',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const set = await store.setCheckpoint('exec-6', 'checkpoint-1');
    expect(set).toBe(true);

    const retrieved = await store.getExecutionState('exec-6');
    expect(retrieved?.checkpointId).toBe('checkpoint-1');
  });

  // Test 12: Get workflow executions
  await test('Get all executions for workflow', async () => {
    const state1: ExecutionState = {
      executionId: 'exec-7a',
      workflowId: 'workflow-2',
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    const state2: ExecutionState = {
      executionId: 'exec-7b',
      workflowId: 'workflow-2',
      status: 'completed',
      startedAt: Date.now() - 10000,
      completedAt: Date.now(),
      currentJobs: [],
      completedJobs: ['job-1'],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state1);
    await store.setExecutionState(state2);

    const executions = await store.getWorkflowExecutions('workflow-2');
    expect(executions.length).toBeGreaterThan(0);

    const ids = executions.map((e) => e.executionId);
    expect(ids).toContain('exec-7a');
    expect(ids).toContain('exec-7b');
  });

  // Test 13: Delete execution state
  await test('Delete execution state', async () => {
    const state: ExecutionState = {
      executionId: 'exec-8',
      workflowId: 'workflow-1',
      status: 'completed',
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {},
    };

    await store.setExecutionState(state);

    const deleted = await store.deleteExecutionState('exec-8');
    expect(deleted).toBe(true);

    const retrieved = await store.getExecutionState('exec-8');
    expect(retrieved).toBeNull();
  });

  // Test 14: Health check
  await test('State store health check', async () => {
    const healthy = await store.isHealthy();
    expect(healthy).toBe(true);
  });

  // Close connection
  await closeStateStore();

  // Print summary
  console.log();
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tests:  ${testsPassed + testsFailed}`);
  console.log(`✅ Passed:     ${testsPassed}`);
  console.log(`❌ Failed:     ${testsFailed}`);
  console.log(`Success rate: ${(testsPassed / (testsPassed + testsFailed) * 100).toFixed(1)}%`);
  console.log('='.repeat(80));
  console.log();

  if (testsFailed === 0) {
    console.log('🎉 All state store tests passed!');
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
