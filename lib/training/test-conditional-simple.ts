/**
 * Simple verification test for conditional execution
 * Tests basic skip and execute paths
 */

import DAGOrchestrator, { JobConfig } from './dag-orchestrator';

async function runSimpleTest() {
  console.log('\n=== Simple Conditional Execution Test ===\n');
  
  const orchestrator = new DAGOrchestrator();
  
  // Register simple echo handler
  orchestrator.registerHandler('echo', async (jobConfig) => {
    const message = jobConfig.config.message as string;
    console.log(`[ECHO] ${message}`);
    return { message, timestamp: Date.now() };
  });
  
  // Test 1: Condition returns true - should execute
  console.log('Test 1: Condition returns TRUE (should execute)');
  const test1Jobs: JobConfig[] = [
    {
      id: 'job1',
      name: 'First Job',
      type: 'echo',
      dependsOn: [],
      config: { message: 'Job 1 executed' },
    },
    {
      id: 'job2',
      name: 'Second Job (Conditional - TRUE)',
      type: 'echo',
      dependsOn: ['job1'],
      config: { message: 'Job 2 executed' },
      condition: () => {
        console.log('[TEST] Condition returning TRUE');
        return true;
      },
    },
  ];
  
  const exec1 = await orchestrator.execute('Test 1', test1Jobs);
  const job2Status = exec1.jobs.get('job2')?.status;
  console.log(`Result: job2 status = ${job2Status}`);
  console.log(job2Status === 'completed' ? '✅ PASS' : '❌ FAIL');
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Condition returns false - should skip
  console.log('Test 2: Condition returns FALSE (should skip)');
  const test2Jobs: JobConfig[] = [
    {
      id: 'job1',
      name: 'First Job',
      type: 'echo',
      dependsOn: [],
      config: { message: 'Job 1 executed' },
    },
    {
      id: 'job2',
      name: 'Second Job (Conditional - FALSE)',
      type: 'echo',
      dependsOn: ['job1'],
      config: { message: 'Job 2 should be skipped' },
      condition: () => {
        console.log('[TEST] Condition returning FALSE');
        return false;
      },
    },
  ];
  
  const exec2 = await orchestrator.execute('Test 2', test2Jobs);
  const job2Status2 = exec2.jobs.get('job2')?.status;
  const job2Output = exec2.jobs.get('job2')?.output as { skipped?: boolean; reason?: string } | undefined;
  console.log(`Result: job2 status = ${job2Status2}`);
  console.log(`Output: ${JSON.stringify(job2Output)}`);
  console.log(
    job2Status2 === 'skipped' && job2Output?.skipped === true 
      ? '✅ PASS' 
      : '❌ FAIL'
  );
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Access previous job output
  console.log('Test 3: Condition accesses previous job output');
  const test3Jobs: JobConfig[] = [
    {
      id: 'job1',
      name: 'First Job',
      type: 'echo',
      dependsOn: [],
      config: { message: 'Setting value to 42' },
    },
    {
      id: 'job2',
      name: 'Second Job (Checks job1 output)',
      type: 'echo',
      dependsOn: ['job1'],
      config: { message: 'Job 2 executed because job1 had output' },
      condition: ({ getJobOutput }) => {
        const job1Output = getJobOutput('job1');
        console.log(`[TEST] job1 output: ${JSON.stringify(job1Output)}`);
        return job1Output !== null && job1Output !== undefined;
      },
    },
  ];
  
  const exec3 = await orchestrator.execute('Test 3', test3Jobs);
  const job2Status3 = exec3.jobs.get('job2')?.status;
  console.log(`Result: job2 status = ${job2Status3}`);
  console.log(job2Status3 === 'completed' ? '✅ PASS' : '❌ FAIL');
  
  console.log('\n=== All Tests Complete ===\n');
}

runSimpleTest().catch(console.error);
