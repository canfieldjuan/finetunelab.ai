/**
 * Job Queue Validation Tests
 * 
 * Manual validation tests for JobQueue functionality.
 * Tests cover:
 * - Job submission and retrieval
 * - Queue statistics
 * - Job lifecycle management
 * - Bulk operations
 */

import { JobQueue, QueueJobData } from './job-queue';

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
  console.log('JOB QUEUE VALIDATION');
  console.log('================================================================================\n');

  // Check if Redis is available
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');

  console.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);

  let queue: JobQueue;

  try {
    queue = new JobQueue({
      redis: {
        host: redisHost,
        port: redisPort,
      },
      queueName: 'test-dag-jobs',
    });

    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    const healthy = await queue.isHealthy();
    if (!healthy) {
      console.error('❌ Cannot connect to Redis. Please ensure Redis is running.');
      console.error(`   Try: docker run -d -p 6379:6379 redis:7-alpine`);
      process.exit(1);
    }

    console.log('✅ Connected to Redis\n');

    // Clean queue before tests
    await queue.drain(true);

  } catch (error) {
    console.error('❌ Failed to initialize queue:', error);
    console.error(`   Please ensure Redis is running on ${redisHost}:${redisPort}`);
    console.error('   Try: docker run -d -p 6379:6379 redis:7-alpine');
    process.exit(1);
  }

  console.log('--- Job Submission Tests ---\n');

  // Test 1: Submit single job
  test('Submit single job', async () => {
    const jobData: QueueJobData = {
      executionId: 'exec_test_1',
      jobId: 'job_1',
      jobType: 'training',
      config: { model: 'test-model' },
      dependencyOutputs: {},
      priority: 5,
      maxRetries: 3,
      timeout: 60000,
    };

    const jobId = await queue.submitJob(jobData);
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 2: Get job status
  test('Get job status', async () => {
    const jobData: QueueJobData = {
      executionId: 'exec_test_2',
      jobId: 'job_2',
      jobType: 'preprocessing',
      config: {},
      dependencyOutputs: {},
      priority: 7,
      maxRetries: 2,
      timeout: 30000,
    };

    const jobId = await queue.submitJob(jobData);
    const status = await queue.getJobStatus(jobId);
    
    // Job should be waiting/prioritized/delayed (no workers processing)
    expect(['waiting', 'delayed', 'prioritized'] as string[]).toContain(status);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 3: Bulk submit jobs
  test('Bulk submit multiple jobs', async () => {
    const jobs: QueueJobData[] = [
      {
        executionId: 'exec_test_3',
        jobId: 'job_3a',
        jobType: 'training',
        config: {},
        dependencyOutputs: {},
        priority: 5,
        maxRetries: 3,
        timeout: 60000,
      },
      {
        executionId: 'exec_test_3',
        jobId: 'job_3b',
        jobType: 'training',
        config: {},
        dependencyOutputs: {},
        priority: 8,
        maxRetries: 3,
        timeout: 60000,
      },
      {
        executionId: 'exec_test_3',
        jobId: 'job_3c',
        jobType: 'validation',
        config: {},
        dependencyOutputs: {},
        priority: 3,
        maxRetries: 2,
        timeout: 30000,
      },
    ];

    const jobIds = await queue.submitJobsBulk(jobs);
    expect(jobIds.length).toBe(3);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Queue Statistics Tests ---\n');

  // Test 4: Get queue stats
  test('Get queue statistics', async () => {
    const stats = await queue.getQueueStats();
    
    expect(stats).toBeDefined();
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
    expect(typeof stats.delayed).toBe('number');
    
    // Note: Jobs might be in various states, so just check that stats work
    // Total jobs count is non-deterministic due to async processing
    expect(stats.waiting >= 0).toBeTruthy();
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Job Management Tests ---\n');

  // Test 5: Get job details
  test('Get job details', async () => {
    const jobData: QueueJobData = {
      executionId: 'exec_test_5',
      jobId: 'job_5',
      jobType: 'deployment',
      config: { target: 'production' },
      dependencyOutputs: { prev_job: { status: 'success' } },
      priority: 9,
      maxRetries: 1,
      timeout: 120000,
    };

    const jobId = await queue.submitJob(jobData);
    const job = await queue.getJob(jobId);
    
    expect(job).toBeDefined();
    expect(job?.data.executionId).toBe('exec_test_5');
    expect(job?.data.jobType).toBe('deployment');
    expect(job?.data.config.target).toBe('production');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 6: Cancel job
  test('Cancel job', async () => {
    const jobData: QueueJobData = {
      executionId: 'exec_test_6',
      jobId: 'job_6',
      jobType: 'training',
      config: {},
      dependencyOutputs: {},
      priority: 5,
      maxRetries: 3,
      timeout: 60000,
    };

    const jobId = await queue.submitJob(jobData);
    const cancelled = await queue.cancelJob(jobId);
    
    expect(cancelled).toBe(true);
    
    // Verify job is removed
    const status = await queue.getJobStatus(jobId);
    expect(status).toBe('not-found');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Queue Control Tests ---\n');

  // Test 7: Pause queue
  test('Pause queue', async () => {
    await queue.pause();
    const stats = await queue.getQueueStats();
    expect(stats.paused).toBe(true);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 8: Resume queue
  test('Resume queue', async () => {
    await queue.resume();
    const stats = await queue.getQueueStats();
    expect(stats.paused).toBe(false);
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\n--- Edge Cases ---\n');

  // Test 9: Get non-existent job
  test('Handle non-existent job', async () => {
    const status = await queue.getJobStatus('non_existent_job_12345');
    expect(status).toBe('not-found');
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 10: Submit job with high priority
  test('Submit high priority job', async () => {
    const jobData: QueueJobData = {
      executionId: 'exec_test_10',
      jobId: 'job_10',
      jobType: 'critical',
      config: {},
      dependencyOutputs: {},
      priority: 10, // Highest priority
      maxRetries: 5,
      timeout: 300000,
    };

    const jobId = await queue.submitJob(jobData);
    expect(jobId).toBeDefined();
  });

  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 11: Health check
  test('Queue health check', async () => {
    const healthy = await queue.isHealthy();
    expect(healthy).toBe(true);
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

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
    console.log('🎉 All job queue tests passed!');
  } else {
    console.log('⚠️  Some tests failed. See errors above.');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  // Clean up
  await queue.drain(true);
  await queue.close();

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
