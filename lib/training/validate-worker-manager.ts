/**
 * Worker Manager Validation Tests
 * 
 * Manual validation tests for WorkerManager functionality.
 * Tests cover:
 * - Worker registration and deregistration
 * - Heartbeat monitoring
 * - Worker selection and load balancing
 * - Health checking and failover
 * - Job assignment tracking
 */

import {
  WorkerManager,
  WorkerRegistration,
  generateWorkerId,
  detectCapabilities,
  getWorkerMetadata,
} from './worker-manager';

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void>): void {
  (async () => {
    try {
      await fn();
      results.push({ name, passed: true });
      console.log(`✅ ${name}`);
    } catch (error) {
      results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`❌ ${name}`);
      console.error(`   Error: ${error instanceof Error ? error.message : error}`);
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
        throw new Error(
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    },
    toBeGreaterThan(expected: number) {
      if (typeof actual !== 'number' || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeGreaterThanOrEqual(expected: number) {
      if (typeof actual !== 'number' || actual < expected) {
        throw new Error(`Expected ${actual} to be >= ${expected}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
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
    toContain(item: unknown) {
      if (!Array.isArray(actual) || !actual.includes(item)) {
        throw new Error(`Expected array to contain ${item}`);
      }
    },
  };
}

// ============================================================================
// Test Execution
// ============================================================================

async function runTests() {
  console.log('================================================================================');
  console.log('WORKER MANAGER VALIDATION');
  console.log('================================================================================\n');

  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  console.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);

  let manager: WorkerManager;

  try {
    manager = new WorkerManager({
      redis: {
        host: redisHost,
        port: redisPort,
      },
      heartbeatTimeoutMs: 5000, // 5 seconds for faster testing
      heartbeatIntervalMs: 2000, // 2 seconds
      cleanupIntervalMs: 3000, // 3 seconds
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const healthy = await manager.isHealthy();
    if (!healthy) {
      console.error('❌ Cannot connect to Redis. Please ensure Redis is running.');
      process.exit(1);
    }

    console.log('✅ Connected to Redis\n');

  } catch (error) {
    console.error('❌ Failed to initialize worker manager:', error);
    process.exit(1);
  }

  console.log('--- Worker Registration Tests ---\n');

  // Test 1: Register worker
  test('Register worker', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-1',
      pid: process.pid,
      capabilities: ['cpu', 'high-memory'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    
    const retrieved = await manager.getWorker(worker.workerId);
    expect(retrieved).toBeDefined();
    expect(retrieved?.workerId).toBe(worker.workerId);
    expect(retrieved?.maxConcurrency).toBe(4);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 2: Generate unique worker IDs
  test('Generate unique worker IDs', async () => {
    const id1 = generateWorkerId();
    const id2 = generateWorkerId();
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(typeof id1).toBe('string');
    
    // IDs should be different (very high probability)
    if (id1 === id2) {
      throw new Error('Generated IDs should be unique');
    }
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 3: Detect capabilities
  test('Detect system capabilities', async () => {
    const capabilities = detectCapabilities();
    
    expect(capabilities).toBeDefined();
    expect(Array.isArray(capabilities)).toBe(true);
    expect(capabilities.length).toBeGreaterThan(0);
    expect(capabilities).toContain('cpu');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Heartbeat Tests ---\n');

  // Test 4: Send heartbeat
  test('Send heartbeat', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-2',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 2,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    
    // Send heartbeat with updated load
    await manager.heartbeat(worker.workerId, 1);
    
    const retrieved = await manager.getWorker(worker.workerId);
    expect(retrieved?.currentLoad).toBe(1);
    expect(retrieved?.status).toBe('active');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 5: Worker status based on load
  test('Worker status changes with load', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-3',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 3,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    
    // Idle (load = 0)
    await manager.heartbeat(worker.workerId, 0);
    let retrieved = await manager.getWorker(worker.workerId);
    expect(retrieved?.status).toBe('idle');
    
    // Busy (load = maxConcurrency)
    await manager.heartbeat(worker.workerId, 3);
    retrieved = await manager.getWorker(worker.workerId);
    expect(retrieved?.status).toBe('busy');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Worker Selection Tests ---\n');

  // Test 6: Select worker based on load
  test('Select worker with lowest load', async () => {
    // Clean up all existing workers first
    const allWorkers = await manager.getAllWorkers();
    for (const worker of allWorkers) {
      await manager.deregisterWorker(worker.workerId);
    }
    
    const worker1: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-4a',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 2,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    const worker2: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-4b',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 1,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker1);
    await manager.registerWorker(worker2);
    
    // Update loads via heartbeat to ensure they're current
    await manager.heartbeat(worker1.workerId, 2);
    await manager.heartbeat(worker2.workerId, 1);
    
    const selected = await manager.selectWorker();
    
    // Should select worker2 (lower load: 1/4 = 25% vs 2/4 = 50%)
    expect(selected).toBe(worker2.workerId);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 7: Select worker by capability
  test('Select worker by capability', async () => {
    const cpuWorker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-5a',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: { ...getWorkerMetadata(), gpuCount: 0 },
    };

    const gpuWorker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-5b',
      pid: process.pid,
      capabilities: ['cpu', 'gpu'],
      maxConcurrency: 2,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: { ...getWorkerMetadata(), gpuCount: 1 },
    };

    await manager.registerWorker(cpuWorker);
    await manager.registerWorker(gpuWorker);
    
    const selected = await manager.selectWorker({
      capabilities: ['gpu'],
    });
    
    expect(selected).toBe(gpuWorker.workerId);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Job Assignment Tests ---\n');

  // Test 8: Assign job to worker
  test('Assign job to worker', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-6',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    await manager.assignJob(worker.workerId, 'job_123');
    
    const jobs = await manager.getAssignedJobs(worker.workerId);
    expect(jobs).toContain('job_123');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 9: Unassign job from worker
  test('Unassign job from worker', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-7',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    await manager.assignJob(worker.workerId, 'job_456');
    await manager.unassignJob(worker.workerId, 'job_456');
    
    const jobs = await manager.getAssignedJobs(worker.workerId);
    expect(jobs.length).toBe(0);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Worker Statistics Tests ---\n');

  // Test 10: Get worker stats
  test('Get worker statistics', async () => {
    const stats = await manager.getWorkerStats();
    
    expect(stats).toBeDefined();
    expect(typeof stats.total).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.idle).toBe('number');
    expect(typeof stats.busy).toBe('number');
    expect(typeof stats.totalCapacity).toBe('number');
    expect(typeof stats.totalLoad).toBe('number');
    expect(typeof stats.utilizationPercent).toBe('number');
    
    // Should have workers from previous tests
    expect(stats.total).toBeGreaterThan(0);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 11: Get workers by capability
  test('Get workers by capability', async () => {
    const capabilityCounts = await manager.getWorkersByCapability();
    
    expect(capabilityCounts).toBeDefined();
    expect(capabilityCounts instanceof Map).toBe(true);
    
    // Should have CPU workers from previous tests
    const cpuCount = capabilityCounts.get('cpu') || 0;
    expect(cpuCount).toBeGreaterThan(0);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Health Monitoring Tests ---\n');

  // Test 12: Deregister worker
  test('Deregister worker', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-8',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    await manager.deregisterWorker(worker.workerId);
    
    const retrieved = await manager.getWorker(worker.workerId);
    expect(retrieved).toBeNull();
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 13: Detect unhealthy workers
  test('Detect unhealthy workers', async () => {
    const worker: WorkerRegistration = {
      workerId: generateWorkerId(),
      hostname: 'test-host-9',
      pid: process.pid,
      capabilities: ['cpu'],
      maxConcurrency: 4,
      currentLoad: 0,
      registeredAt: Date.now(),
      lastHeartbeat: Date.now(),
      status: 'active',
      metadata: getWorkerMetadata(),
    };

    await manager.registerWorker(worker);
    
    // Wait longer than heartbeat timeout (5 seconds)
    console.log('   Waiting 6 seconds for heartbeat timeout...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    const unhealthy = await manager.detectUnhealthyWorkers();
    expect(unhealthy).toContain(worker.workerId);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 14: Health check
  test('Worker manager health check', async () => {
    const healthy = await manager.isHealthy();
    expect(healthy).toBe(true);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // ============================================================================
  // Print Summary
  // ============================================================================

  console.log('\n================================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================================');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  const successRate = ((passed / total) * 100).toFixed(1);

  console.log(`Total tests:  ${total}`);
  console.log(`✅ Passed:     ${passed}`);
  console.log(`❌ Failed:     ${failed}`);
  console.log(`Success rate: ${successRate}%`);
  console.log('================================================================================\n');

  if (failed === 0) {
    console.log('🎉 All worker manager tests passed!');
  } else {
    console.log('⚠️  Some tests failed. See errors above.');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  // Clean up
  await manager.close();

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
