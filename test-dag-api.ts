/**
 * Test script for DAG API endpoints
 * 
 * Tests all DAG orchestrator API routes
 */

const API_BASE = 'http://localhost:3000/api/training/dag';

async function testDAGAPI() {
  console.log('========================================');
  console.log('DAG API Endpoint Tests');
  console.log('========================================\n');

  const results = {
    passed: 0,
    failed: 0,
    tests: [] as { name: string; status: 'PASS' | 'FAIL'; message?: string }[],
  };

  const test = async (name: string, fn: () => Promise<void>) => {
    try {
      console.log(`\n[TEST] ${name}`);
      await fn();
      console.log(`[PASS] ${name}`);
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[FAIL] ${name}: ${message}`);
      results.failed++;
      results.tests.push({ name, status: 'FAIL', message });
    }
  };

  await test('Validate DAG Configuration', async () => {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobs: [
          {
            id: 'job-1',
            name: 'Load Data',
            type: 'preprocessing',
            dependsOn: [],
            config: { source: 'data.csv' },
          },
          {
            id: 'job-2',
            name: 'Train Model',
            type: 'training',
            dependsOn: ['job-1'],
            config: { epochs: 10 },
          },
        ],
      }),
    });

    const data = await response.json();
    if (!data.valid) {
      throw new Error(`Validation failed: ${JSON.stringify(data.errors)}`);
    }
    console.log(`  - Execution levels: ${data.executionLevels.length}`);
    console.log(`  - Total jobs: ${data.totalJobs}`);
    console.log(`  - Max parallel jobs: ${data.maxParallelJobs}`);
  });

  await test('Detect Invalid DAG (Cycle)', async () => {
    const response = await fetch(`${API_BASE}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobs: [
          {
            id: 'job-1',
            name: 'Job 1',
            type: 'training',
            dependsOn: ['job-2'],
            config: {},
          },
          {
            id: 'job-2',
            name: 'Job 2',
            type: 'training',
            dependsOn: ['job-1'],
            config: {},
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.valid) {
      throw new Error('Should have detected cycle');
    }
    console.log(`  - Correctly detected errors: ${data.errors.join(', ')}`);
  });

  let executionId: string;

  await test('Execute DAG Pipeline', async () => {
    const response = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-api-pipeline',
        jobs: [
          {
            id: 'load-data',
            name: 'Load Dataset',
            type: 'preprocessing',
            dependsOn: [],
            config: { source: 'test.csv' },
          },
          {
            id: 'train',
            name: 'Train Model',
            type: 'training',
            dependsOn: ['load-data'],
            config: { epochs: 2, batch_size: 16 },
          },
          {
            id: 'validate',
            name: 'Validate Model',
            type: 'validation',
            dependsOn: ['train'],
            config: { metrics: ['accuracy'] },
          },
        ],
        options: {
          parallelism: 2,
        },
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Execution failed: ${data.error}`);
    }
    executionId = data.executionId;
    console.log(`  - Execution ID: ${executionId}`);
    console.log(`  - Status: ${data.status}`);
    console.log(`  - Total jobs: ${data.totalJobs}`);
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  await test('Get Execution Status', async () => {
    const response = await fetch(`${API_BASE}/status/${executionId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to get status: ${data.error}`);
    }
    
    console.log(`  - Status: ${data.status}`);
    console.log(`  - Progress: ${data.progress}%`);
    console.log(`  - Completed: ${data.completedJobs}/${data.totalJobs}`);
    console.log(`  - Duration: ${data.duration}s`);
  });

  await test('List Executions', async () => {
    const response = await fetch(`${API_BASE}/list?limit=10`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to list executions: ${data.error}`);
    }
    
    console.log(`  - Total executions: ${data.executions.length}`);
    if (data.executions.length > 0) {
      console.log(`  - Latest: ${data.executions[0].name} (${data.executions[0].status})`);
    }
  });

  await test('Create Pipeline Template', async () => {
    const response = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-template',
        description: 'A test pipeline template',
        category: 'testing',
        config: {
          jobs: [
            {
              id: 'step-1',
              name: 'First Step',
              type: 'preprocessing',
              dependsOn: [],
              config: {},
            },
          ],
        },
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(`Failed to create template: ${data.error}`);
    }
    
    console.log(`  - Template ID: ${data.template.id}`);
    console.log(`  - Template name: ${data.template.name}`);
  });

  await test('List Templates', async () => {
    const response = await fetch(`${API_BASE}/templates`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`Failed to list templates: ${data.error}`);
    }
    
    console.log(`  - Total templates: ${data.templates.length}`);
  });

  console.log('\n========================================');
  console.log('Test Results');
  console.log('========================================');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total: ${results.passed + results.failed}\n`);

  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}: ${t.message}`));
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

testDAGAPI().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
