/**
 * DAG Conditional Execution Examples
 * 
 * Shows how to use the new conditional execution feature for complex workflows
 * 
 * NOTE: These configurations now use centralized endpoint configuration
 * with environment variable fallbacks for production deployment.
 */

import DAGOrchestrator, { JobConfig } from './dag-orchestrator';
import { defaultHandlers } from './job-handlers';
import { ENDPOINTS } from '@/lib/config/endpoints';

// ============================================================================
// Example 1: Deploy only if validation accuracy > 90%
// ============================================================================

export async function runConditionalDeployment() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Register handlers
  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as keyof typeof defaultHandlers, handler);
  });

  const jobs: JobConfig[] = [
    {
      id: 'train_model',
      name: 'Train Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'transformer',
        epochs: 20,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_model',
      name: 'Validate Model',
      type: 'validation',
      dependsOn: ['train_model'],
      config: {
        validationDataset: 'test_set',
        metrics: ['accuracy', 'f1', 'precision'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'deploy_production',
      name: 'Deploy to Production',
      type: 'deployment',
      dependsOn: ['validate_model'],
      config: {
        deploymentTarget: 'production',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // 🎯 CONDITIONAL EXECUTION: Only deploy if accuracy > 90%
      condition: ({ getJobOutput }) => {
        const validationResult = getJobOutput('validate_model') as {
          metrics?: { accuracy?: number };
        } | null;

        const accuracy = validationResult?.metrics?.accuracy ?? 0;
        console.log(`[Condition] Validation accuracy: ${accuracy}`);

        return accuracy > 0.90;
      },
    },
  ];

  const execution = await orchestrator.execute('Conditional Deployment Pipeline', jobs);

  const deployStatus = execution.jobs.get('deploy_production')?.status;
  console.log('\n=== Deployment Result ===');
  console.log(`Status: ${deployStatus}`);
  
  if (deployStatus === 'skipped') {
    console.log('❌ Deployment skipped - accuracy threshold not met');
  } else if (deployStatus === 'completed') {
    console.log('✅ Deployment successful - model meets quality standards');
  }

  return execution;
}

// ============================================================================
// Example 2: Multi-Stage Validation with Progressive Gates
// ============================================================================

export async function runProgressiveValidation() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as keyof typeof defaultHandlers, handler);
  });

  const jobs: JobConfig[] = [
    {
      id: 'train',
      name: 'Train Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'llm',
        epochs: 10,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'quick_validation',
      name: 'Quick Validation (Dev Set)',
      type: 'validation',
      dependsOn: ['train'],
      config: {
        validationDataset: 'dev_set',
        metrics: ['loss', 'perplexity'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'full_validation',
      name: 'Full Validation (Test Set)',
      type: 'validation',
      dependsOn: ['quick_validation'],
      config: {
        validationDataset: 'test_set',
        metrics: ['accuracy', 'f1', 'bleu', 'rouge'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Only run full validation if quick validation passes
      condition: ({ getJobOutput }) => {
        const quickResult = getJobOutput('quick_validation') as {
          metrics?: { loss?: number; perplexity?: number };
        } | null;

        const loss = quickResult?.metrics?.loss ?? Infinity;
        const perplexity = quickResult?.metrics?.perplexity ?? Infinity;

        console.log(`[Condition] Quick validation - Loss: ${loss}, Perplexity: ${perplexity}`);

        // Only proceed if loss < 2.0 and perplexity < 50
        return loss < 2.0 && perplexity < 50;
      },
    },
    {
      id: 'deploy_staging',
      name: 'Deploy to Staging',
      type: 'deployment',
      dependsOn: ['full_validation'],
      config: {
        deploymentTarget: 'staging',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Only deploy to staging if full validation passes
      condition: ({ getJobOutput }) => {
        const fullResult = getJobOutput('full_validation') as {
          metrics?: { accuracy?: number; f1?: number };
          skipped?: boolean;
        } | null;

        // Check if job was skipped
        if (!fullResult || fullResult.skipped) {
          console.log('[Condition] Full validation was skipped - cannot deploy');
          return false;
        }

        const accuracy = fullResult?.metrics?.accuracy ?? 0;
        const f1 = fullResult?.metrics?.f1 ?? 0;

        console.log(`[Condition] Full validation - Accuracy: ${accuracy}, F1: ${f1}`);

        return accuracy > 0.85 && f1 > 0.80;
      },
    },
    {
      id: 'deploy_production',
      name: 'Deploy to Production',
      type: 'deployment',
      dependsOn: ['deploy_staging'],
      config: {
        deploymentTarget: 'production',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Only deploy to production after successful staging deployment
      condition: ({ getJobOutput }) => {
        const stagingResult = getJobOutput('deploy_staging') as {
          skipped?: boolean;
          endpointUrl?: string;
        } | null;

        if (!stagingResult || stagingResult.skipped) {
          console.log('[Condition] Staging deployment was skipped - cannot deploy to prod');
          return false;
        }

        console.log('[Condition] Staging deployment successful - ready for production');
        return true;
      },
    },
  ];

  const execution = await orchestrator.execute('Progressive Validation Pipeline', jobs);

  console.log('\n=== Pipeline Results ===');
  execution.jobs.forEach((job, id) => {
    const icon = job.status === 'completed' ? '✅' : 
                 job.status === 'skipped' ? '⏭️' : 
                 job.status === 'failed' ? '❌' : '⏳';
    console.log(`${icon} ${id}: ${job.status}`);
  });

  return execution;
}

// ============================================================================
// Example 3: A/B Test Winner Selection
// ============================================================================

export async function runABTestWithWinner() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as keyof typeof defaultHandlers, handler);
  });

  const jobs: JobConfig[] = [
    {
      id: 'preprocess',
      name: 'Preprocess Data',
      type: 'preprocessing',
      dependsOn: [],
      config: {
        inputPath: 's3://data/raw',
        outputPath: 's3://data/processed',
        operations: ['normalize', 'split'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'train_variant_a',
      name: 'Train Variant A (Large LR)',
      type: 'training',
      dependsOn: ['preprocess'],
      config: {
        modelType: 'transformer',
        learningRate: 0.001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'train_variant_b',
      name: 'Train Variant B (Small LR)',
      type: 'training',
      dependsOn: ['preprocess'],
      config: {
        modelType: 'transformer',
        learningRate: 0.0001,
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_a',
      name: 'Validate Variant A',
      type: 'validation',
      dependsOn: ['train_variant_a'],
      config: {
        validationDataset: 'test_set',
        metrics: ['accuracy'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_b',
      name: 'Validate Variant B',
      type: 'validation',
      dependsOn: ['train_variant_b'],
      config: {
        validationDataset: 'test_set',
        metrics: ['accuracy'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'deploy_winner_a',
      name: 'Deploy Variant A (if winner)',
      type: 'deployment',
      dependsOn: ['validate_a', 'validate_b'],
      config: {
        deploymentTarget: 'production',
        variant: 'A',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Deploy A only if it beats B
      condition: ({ getJobOutput }) => {
        const resultA = getJobOutput('validate_a') as { metrics?: { accuracy?: number } } | null;
        const resultB = getJobOutput('validate_b') as { metrics?: { accuracy?: number } } | null;

        const accuracyA = resultA?.metrics?.accuracy ?? 0;
        const accuracyB = resultB?.metrics?.accuracy ?? 0;

        console.log(`[A/B Test] Variant A: ${accuracyA}, Variant B: ${accuracyB}`);

        return accuracyA > accuracyB;
      },
    },
    {
      id: 'deploy_winner_b',
      name: 'Deploy Variant B (if winner)',
      type: 'deployment',
      dependsOn: ['validate_a', 'validate_b'],
      config: {
        deploymentTarget: 'production',
        variant: 'B',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Deploy B only if it beats A
      condition: ({ getJobOutput }) => {
        const resultA = getJobOutput('validate_a') as { metrics?: { accuracy?: number } } | null;
        const resultB = getJobOutput('validate_b') as { metrics?: { accuracy?: number } } | null;

        const accuracyA = resultA?.metrics?.accuracy ?? 0;
        const accuracyB = resultB?.metrics?.accuracy ?? 0;

        console.log(`[A/B Test] Variant A: ${accuracyA}, Variant B: ${accuracyB}`);

        return accuracyB > accuracyA;
      },
    },
  ];

  const execution = await orchestrator.execute('A/B Test Winner Pipeline', jobs);

  // Determine winner
  const deployedA = execution.jobs.get('deploy_winner_a')?.status === 'completed';
  const deployedB = execution.jobs.get('deploy_winner_b')?.status === 'completed';

  console.log('\n=== A/B Test Results ===');
  if (deployedA) {
    console.log('🏆 Winner: Variant A (Large Learning Rate)');
  } else if (deployedB) {
    console.log('🏆 Winner: Variant B (Small Learning Rate)');
  } else {
    console.log('⚠️ No winner deployed');
  }

  return execution;
}

// ============================================================================
// Example 4: Async Condition with External API Call
// ============================================================================

export async function runAsyncConditionalWorkflow() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as keyof typeof defaultHandlers, handler);
  });

  const jobs: JobConfig[] = [
    {
      id: 'train',
      name: 'Train Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'classifier',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate',
      name: 'Validate Model',
      type: 'validation',
      dependsOn: ['train'],
      config: {
        validationDataset: 'test_set',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'deploy_production',
      name: 'Deploy to Production',
      type: 'deployment',
      dependsOn: ['validate'],
      config: {
        deploymentTarget: 'production',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Async condition: Check with external service if deployment is allowed
      condition: async ({ getJobOutput, executionId }) => {
        const validationResult = getJobOutput('validate') as {
          metrics?: { accuracy?: number };
        } | null;

        const accuracy = validationResult?.metrics?.accuracy ?? 0;

        try {
          // Check with governance API if this deployment is allowed
          const governanceEndpoint = process.env.GOVERNANCE_API_URL || 'http://localhost:9000';
          const response = await fetch(`${governanceEndpoint}/api/deployments/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              execution_id: executionId,
              model_accuracy: accuracy,
              target: 'production',
            }),
          });

          if (!response.ok) {
            console.log('[Condition] Governance API returned error');
            return false;
          }

          const approval = await response.json();
          console.log(`[Condition] Governance decision: ${approval.approved ? 'APPROVED' : 'DENIED'}`);

          return approval.approved === true;
        } catch (error) {
          console.error('[Condition] Governance API check failed:', error);
          // Fail-safe: deny deployment on error
          return false;
        }
      },
    },
  ];

  const execution = await orchestrator.execute('Async Conditional Pipeline', jobs);

  return execution;
}

// ============================================================================
// Example 5: Complex Multi-Condition Logic
// ============================================================================

export async function runComplexConditionalWorkflow() {
  const orchestrator = new DAGOrchestrator(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  Object.entries(defaultHandlers).forEach(([type, handler]) => {
    orchestrator.registerHandler(type as keyof typeof defaultHandlers, handler);
  });

  const jobs: JobConfig[] = [
    {
      id: 'train',
      name: 'Train Model',
      type: 'training',
      dependsOn: [],
      config: {
        modelType: 'multilingual',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_english',
      name: 'Validate on English',
      type: 'validation',
      dependsOn: ['train'],
      config: {
        validationDataset: 'english_test',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_spanish',
      name: 'Validate on Spanish',
      type: 'validation',
      dependsOn: ['train'],
      config: {
        validationDataset: 'spanish_test',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'validate_french',
      name: 'Validate on French',
      type: 'validation',
      dependsOn: ['train'],
      config: {
        validationDataset: 'french_test',
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
    },
    {
      id: 'deploy_global',
      name: 'Deploy Globally',
      type: 'deployment',
      dependsOn: ['validate_english', 'validate_spanish', 'validate_french'],
      config: {
        deploymentTarget: 'production',
        regions: ['us', 'eu', 'latam'],
        apiEndpoint: ENDPOINTS.TRAINING_SERVER,
      },
      // Complex condition: All languages must pass minimum threshold
      condition: ({ getJobOutput }) => {
        const englishResult = getJobOutput('validate_english') as { metrics?: { accuracy?: number } } | null;
        const spanishResult = getJobOutput('validate_spanish') as { metrics?: { accuracy?: number } } | null;
        const frenchResult = getJobOutput('validate_french') as { metrics?: { accuracy?: number } } | null;

        const englishAcc = englishResult?.metrics?.accuracy ?? 0;
        const spanishAcc = spanishResult?.metrics?.accuracy ?? 0;
        const frenchAcc = frenchResult?.metrics?.accuracy ?? 0;

        console.log('[Condition] Multilingual accuracy:', {
          english: englishAcc,
          spanish: spanishAcc,
          french: frenchAcc,
        });

        // All languages must score > 80%
        const allPass = englishAcc > 0.80 && spanishAcc > 0.80 && frenchAcc > 0.80;
        
        // Average must be > 85%
        const average = (englishAcc + spanishAcc + frenchAcc) / 3;
        const goodAverage = average > 0.85;

        // No language can be < 75% (prevent catastrophic failure in one language)
        const noCatastrophicFailure = englishAcc > 0.75 && spanishAcc > 0.75 && frenchAcc > 0.75;

        console.log(`[Condition] All pass: ${allPass}, Good average: ${goodAverage}, No catastrophic failure: ${noCatastrophicFailure}`);

        return allPass && goodAverage && noCatastrophicFailure;
      },
    },
  ];

  const execution = await orchestrator.execute('Complex Conditional Pipeline', jobs);

  return execution;
}
