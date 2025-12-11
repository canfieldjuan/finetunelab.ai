/**
 * Validation Tests for Distributed Execution REST API
 * 
 * Tests all 9 API endpoints:
 * - Worker Management: register, list, heartbeat, deregister
 * - Queue Control: stats, pause, resume
 * - Execution: execute, get status
 * - Health: comprehensive system check
 * 
 * Run with: npx ts-node validate-distributed-api.ts
 */

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 10000; // 10 seconds per test

interface JobConfig {
  id: string;
  name: string;
  type: string;
  dependsOn: string[];
  config: Record<string, unknown>;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface GlobalTestState {
  testExecutionId?: string;
}

const results: TestResult[] = [];
const testState: GlobalTestState = {};

/**
 * Helper function to make API requests
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ status: number; data: Record<string, unknown> }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  return { status: response.status, data };
}

/**
 * Run a test with timeout and error handling
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  
  try {
    await Promise.race([
      testFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), TEST_TIMEOUT)
      ),
    ]);
    
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    results.push({
      name,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    console.error(`✗ ${name} (${duration}ms): ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Assert helper
 */
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============================================================================
// Test 1: Register Worker
// ============================================================================
async function testRegisterWorker(): Promise<void> {
  const workerData = {
    workerId: 'test-worker-1',
    hostname: 'test-host-1',
    pid: process.pid,
    capabilities: ['cpu', 'high-memory'],
    maxConcurrency: 4,
    currentLoad: 0,
    metadata: {
      cpuCores: 8,
      memoryGB: 32,
      version: '1.0.0',
    },
  };

  const { status, data } = await apiRequest('/api/distributed/workers/register', {
    method: 'POST',
    body: JSON.stringify(workerData),
  });

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.workerId === workerData.workerId, 'Worker ID mismatch');
  assert(data.registeredAt !== undefined, 'Missing registeredAt timestamp');
}

// ============================================================================
// Test 2: Register Second Worker
// ============================================================================
async function testRegisterSecondWorker(): Promise<void> {
  const workerData = {
    workerId: 'test-worker-2',
    hostname: 'test-host-2',
    pid: process.pid + 1,
    capabilities: ['gpu', 'cpu'],
    maxConcurrency: 2,
    currentLoad: 0,
    metadata: {
      gpuType: 'NVIDIA A100',
      cpuCores: 16,
      memoryGB: 64,
    },
  };

  const { status, data } = await apiRequest('/api/distributed/workers/register', {
    method: 'POST',
    body: JSON.stringify(workerData),
  });

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.workerId === workerData.workerId, 'Worker ID mismatch');
}

// ============================================================================
// Test 3: List All Workers
// ============================================================================
async function testListWorkers(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/workers');

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert((data.count as number) >= 2, `Expected at least 2 workers, got ${data.count}`);
  assert(Array.isArray(data.workers), 'Expected workers to be an array');
  
  // Verify worker structure
  const worker = (data.workers as unknown[])[0] as Record<string, unknown>;
  assert(worker.workerId !== undefined, 'Missing workerId');
  assert(worker.hostname !== undefined, 'Missing hostname');
  assert(Array.isArray(worker.capabilities), 'capabilities should be an array');
  assert(worker.status !== undefined, 'Missing status');
  assert(worker.currentLoad !== undefined, 'Missing currentLoad');
  assert(worker.maxConcurrency !== undefined, 'Missing maxConcurrency');
  assert(worker.utilization !== undefined, 'Missing utilization');
  assert(worker.lastHeartbeat !== undefined, 'Missing lastHeartbeat');
  assert(worker.uptime !== undefined, 'Missing uptime');
}

// ============================================================================
// Test 4: Send Worker Heartbeat
// ============================================================================
async function testWorkerHeartbeat(): Promise<void> {
  const workerId = 'test-worker-1';
  const currentLoad = 2;

  const { status, data } = await apiRequest(
    `/api/distributed/workers/${workerId}/heartbeat`,
    {
      method: 'POST',
      body: JSON.stringify({ currentLoad }),
    }
  );

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.workerId === workerId, 'Worker ID mismatch');
  assert(data.currentLoad === currentLoad, 'Current load mismatch');
  assert(data.status !== undefined, 'Missing status');
  assert(data.lastHeartbeat !== undefined, 'Missing lastHeartbeat');
}

// ============================================================================
// Test 5: Get Queue Statistics
// ============================================================================
async function testGetQueueStats(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/queue/stats');

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(typeof data.healthy === 'boolean', 'healthy should be boolean');
  assert(data.stats !== undefined, 'Missing stats');
  
  // Verify stats structure
  const stats = data.stats as Record<string, unknown>;
  assert(typeof stats.waiting === 'number', 'waiting should be a number');
  assert(typeof stats.active === 'number', 'active should be a number');
  assert(typeof stats.completed === 'number', 'completed should be a number');
  assert(typeof stats.failed === 'number', 'failed should be a number');
  assert(typeof stats.delayed === 'number', 'delayed should be a number');
  assert(typeof stats.paused === 'number', 'paused should be a number');
  assert(typeof stats.total === 'number', 'total should be a number');
}

// ============================================================================
// Test 6: Pause Queue
// ============================================================================
async function testPauseQueue(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/queue/pause', {
    method: 'POST',
  });

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.message !== undefined, 'Missing message');
}

// ============================================================================
// Test 7: Resume Queue
// ============================================================================
async function testResumeQueue(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/queue/resume', {
    method: 'POST',
  });

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.message !== undefined, 'Missing message');
}

// ============================================================================
// Test 8: Start Distributed Execution (Small Job)
// ============================================================================
async function testStartExecution(): Promise<void> {
  const jobs: JobConfig[] = [
    {
      id: 'test-job-1',
      name: 'Test Job 1',
      type: 'preprocessing',
      dependsOn: [],
      config: {
        description: 'Simple test job for API validation',
      },
    },
    {
      id: 'test-job-2',
      name: 'Test Job 2',
      type: 'validation',
      dependsOn: ['test-job-1'],
      config: {
        description: 'Dependent test job',
      },
    },
  ];

  const { status, data } = await apiRequest('/api/distributed/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflowId: 'test-workflow-1',
      jobs,
      parallelism: 2,
    }),
  });

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.executionId !== undefined, 'Missing executionId');
  assert(data.status !== undefined, 'Missing status');
  assert(data.startedAt !== undefined, 'Missing startedAt');
  assert(data.jobCount === jobs.length, 'Job count mismatch');
  
  // Store executionId for next test
  testState.testExecutionId = data.executionId as string;
}

// ============================================================================
// Test 9: Get Execution Status
// ============================================================================
async function testGetExecutionStatus(): Promise<void> {
  const executionId = testState.testExecutionId;
  assert(executionId !== undefined, 'No execution ID from previous test');

  const { status, data } = await apiRequest(
    `/api/distributed/execute/${executionId}`
  );

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.execution !== undefined, 'Missing execution');
  
  // Verify execution structure
  const execution = data.execution as Record<string, unknown>;
  assert(execution.executionId === executionId, 'Execution ID mismatch');
  assert(execution.workflowId !== undefined, 'Missing workflowId');
  assert(execution.status !== undefined, 'Missing status');
  assert(execution.startedAt !== undefined, 'Missing startedAt');
  assert(execution.progress !== undefined, 'Missing progress');
  
  // Verify progress structure
  const progress = execution.progress as Record<string, unknown>;
  assert(typeof progress.total === 'number', 'total should be a number');
  assert(typeof progress.completed === 'number', 'completed should be a number');
  assert(typeof progress.failed === 'number', 'failed should be a number');
  assert(typeof progress.running === 'number', 'running should be a number');
}

// ============================================================================
// Test 10: Get Execution Status (Non-existent)
// ============================================================================
async function testGetNonExistentExecution(): Promise<void> {
  const fakeExecutionId = 'non-existent-execution-id';

  const { status, data } = await apiRequest(
    `/api/distributed/execute/${fakeExecutionId}`
  );

  assert(status === 404, `Expected status 404, got ${status}`);
  assert(data.success === false, 'Expected success to be false');
  assert(data.error !== undefined, 'Missing error message');
}

// ============================================================================
// Test 11: System Health Check
// ============================================================================
async function testSystemHealth(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/health');

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(typeof data.healthy === 'boolean', 'healthy should be boolean');
  assert(data.components !== undefined, 'Missing components');
  
  // Verify components structure
  const components = data.components as Record<string, unknown>;
  assert(typeof components.queue === 'boolean', 'queue health should be boolean');
  assert(
    typeof components.workerManager === 'boolean',
    'workerManager health should be boolean'
  );
  assert(
    typeof components.stateStore === 'boolean',
    'stateStore health should be boolean'
  );
  
  // Verify workers statistics
  assert(data.workers !== undefined, 'Missing workers');
  const workers = data.workers as Record<string, unknown>;
  assert(typeof workers.total === 'number', 'total should be a number');
  assert(typeof workers.active === 'number', 'active should be a number');
  assert(typeof workers.idle === 'number', 'idle should be a number');
  assert(typeof workers.busy === 'number', 'busy should be a number');
  assert(typeof workers.unhealthy === 'number', 'unhealthy should be a number');
  assert(
    typeof workers.utilizationPercent === 'number',
    'utilizationPercent should be a number'
  );
}

// ============================================================================
// Test 12: Deregister Worker
// ============================================================================
async function testDeregisterWorker(): Promise<void> {
  const workerId = 'test-worker-2';

  const { status, data } = await apiRequest(
    `/api/distributed/workers/${workerId}`,
    {
      method: 'DELETE',
    }
  );

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  assert(data.workerId === workerId, 'Worker ID mismatch');
  assert(data.message !== undefined, 'Missing message');
}

// ============================================================================
// Test 13: Verify Worker Deregistration
// ============================================================================
async function testVerifyWorkerDeregistration(): Promise<void> {
  const { status, data } = await apiRequest('/api/distributed/workers');

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
  
  // Verify test-worker-2 is not in the list
  const workers = data.workers as Array<Record<string, unknown>>;
  const worker2 = workers.find((w) => w.workerId === 'test-worker-2');
  assert(worker2 === undefined, 'Worker should be deregistered');
}

// ============================================================================
// Test 14: Cleanup - Deregister Remaining Workers
// ============================================================================
async function testCleanupWorkers(): Promise<void> {
  const workerId = 'test-worker-1';

  const { status, data } = await apiRequest(
    `/api/distributed/workers/${workerId}`,
    {
      method: 'DELETE',
    }
  );

  assert(status === 200, `Expected status 200, got ${status}`);
  assert(data.success === true, 'Expected success to be true');
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runAllTests(): Promise<void> {
  console.log('🚀 Starting Distributed API Validation Tests\n');
  console.log(`Testing API at: ${API_BASE_URL}\n`);
  console.log('=' .repeat(70));

  // Run tests in sequence to maintain state
  await runTest('1. Register Worker', testRegisterWorker);
  await runTest('2. Register Second Worker', testRegisterSecondWorker);
  await runTest('3. List All Workers', testListWorkers);
  await runTest('4. Send Worker Heartbeat', testWorkerHeartbeat);
  await runTest('5. Get Queue Statistics', testGetQueueStats);
  await runTest('6. Pause Queue', testPauseQueue);
  await runTest('7. Resume Queue', testResumeQueue);
  await runTest('8. Start Distributed Execution', testStartExecution);
  await runTest('9. Get Execution Status', testGetExecutionStatus);
  await runTest('10. Get Non-existent Execution', testGetNonExistentExecution);
  await runTest('11. System Health Check', testSystemHealth);
  await runTest('12. Deregister Worker', testDeregisterWorker);
  await runTest('13. Verify Worker Deregistration', testVerifyWorkerDeregistration);
  await runTest('14. Cleanup Remaining Workers', testCleanupWorkers);

  // Print summary
  console.log('=' .repeat(70));
  console.log('\n📊 Test Summary:\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passed} ✓`);
  console.log(`Failed: ${failed} ✗`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Average Duration: ${(totalDuration / results.length).toFixed(0)}ms`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
