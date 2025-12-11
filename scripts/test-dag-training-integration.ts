/**
 * Test DAG → Training Server Integration
 * 
 * This script tests the end-to-end flow:
 * DAG Workflow → LocalTrainingProvider → Training Server (port 8000) → Python Training
 * 
 * Usage:
 *   npx tsx scripts/test-dag-training-integration.ts
 */

import { JobConfig } from '../lib/training/dag-orchestrator';

async function testDAGTrainingIntegration() {
  console.log('='.repeat(60));
  console.log('Testing DAG → Training Server Integration');
  console.log('='.repeat(60));
  console.log();

  // Step 1: Define a simple training DAG
  const trainingDAG: JobConfig[] = [
    {
      id: 'train_model',
      name: 'Train GPT-2 Model',
      type: 'training',
      dependsOn: [], // No dependencies, runs immediately
      config: {
        publicId: 'test-dag-integration', // This would be a real training config ID
        method: 'sft',
        provider: 'local', // Use local provider to test training server
        dataset_id: 'sample_data.json',
      },
      retryConfig: {
        maxRetries: 0, // No retries for test
        retryDelayMs: 0,
      },
      timeoutMs: 600000, // 10 minutes
    },
  ];

  console.log('📋 DAG Configuration:');
  console.log(JSON.stringify(trainingDAG, null, 2));
  console.log();

  // Step 2: Call DAG Execute API
  console.log('🚀 Submitting DAG to execution API...');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/training/dag/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test DAG Training Integration',
        jobs: trainingDAG,
        options: {
          parallelism: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ DAG execution failed:', errorData);
      throw new Error(`API error: ${errorData.error || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ DAG execution started!');
    console.log();
    console.log('Response:', result);
    console.log();
    console.log('Execution ID:', result.executionId);
    console.log('Status:', result.status);
    console.log();

    // Step 3: Monitor execution (poll for status)
    console.log('👀 Monitoring DAG execution...');
    console.log('(Check Next.js console logs for detailed progress)');
    console.log();
    
    console.log('Expected Flow:');
    console.log('  1. DAG Orchestrator receives job');
    console.log('  2. trainingJobHandler extracts config');
    console.log('  3. LocalTrainingProvider connects to localhost:8000');
    console.log('  4. Training server spawns Python subprocess');
    console.log('  5. DAG polls training status every 5 seconds');
    console.log('  6. Training completes → DAG marks job as complete');
    console.log();

    console.log('✨ Test submission successful!');
    console.log('Check the following logs:');
    console.log('  - Next.js console: DAG orchestration logs');
    console.log('  - Training server (port 8000): Job execution logs');
    console.log('  - Output directory: Model checkpoints');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.log();
    console.log('Troubleshooting:');
    console.log('  1. Is Next.js running on port 3000? (npm run dev)');
    console.log('  2. Is Training Server running on port 8000?');
    console.log('     cd lib/training && uvicorn training_server:app --reload');
    console.log('  3. Check console logs for detailed error messages');
    process.exit(1);
  }
}

// Run test
testDAGTrainingIntegration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
