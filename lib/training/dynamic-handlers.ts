// ============================================================================
// Dynamic Parallelism Job Handlers
// ============================================================================
// Handlers for fan-out and fan-in job types in the DAG orchestrator
// - Fan-out: Generates multiple dynamic jobs from parameter specifications
// - Fan-in: Aggregates results from dynamically generated jobs
//
// Author: System
// Last Modified: 2024
// ============================================================================

import {
  JobConfig,
  JobContext,
} from './dag-orchestrator';
import {
  generateDynamicJobs,
  aggregateResults,
  isFanOutJob,
  isFanInJob,
  FanOutJobConfig,
  FanInJobConfig,
} from './dynamic-parallelism';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = {
  FANOUT: '[FAN-OUT]',
  FANIN: '[FAN-IN]',
  ERROR: '[ERROR]',
};

const HANDLER_MESSAGES = {
  FANOUT_START: 'Starting fan-out job generation',
  FANOUT_COMPLETE: 'Fan-out job generation complete',
  FANOUT_NO_JOBS: 'No dynamic jobs generated',
  FANIN_START: 'Starting fan-in result aggregation',
  FANIN_COMPLETE: 'Fan-in aggregation complete',
  FANIN_NO_RESULTS: 'No results to aggregate',
  FANIN_MISSING_SOURCE: 'Source fan-out job not found',
  TYPE_MISMATCH: 'Job configuration type mismatch',
};

// ============================================================================
// Fan-Out Handler
// ============================================================================

/**
 * Handler for fan-out job type
 * Generates multiple dynamic jobs from parameter specifications
 * 
 * Output Structure:
 * {
 *   generatedJobs: JobConfig[] - Array of dynamically generated jobs
 *   generatedJobIds: string[] - IDs of generated jobs for tracking
 *   parameterCount: number - Number of parameter combinations
 *   sourceJobId: string - ID of the fan-out job that created these
 * }
 */
export async function fanOutHandler(
  job: JobConfig,
  context: JobContext
): Promise<{
  generatedJobs: JobConfig[];
  generatedJobIds: string[];
  parameterCount: number;
  sourceJobId: string;
}> {
  const logPrefix = `${LOG_PREFIX.FANOUT} [Job: ${job.id}]`;
  
  context.log(`${HANDLER_MESSAGES.FANOUT_START}`);
  console.log(`${logPrefix} ${HANDLER_MESSAGES.FANOUT_START}`);

  // Validate job configuration is fan-out type
  if (!isFanOutJob(job)) {
    const errorMsg = `${HANDLER_MESSAGES.TYPE_MISMATCH}: Expected fan-out job configuration`;
    context.log(`${LOG_PREFIX.ERROR} ${errorMsg}`);
    console.error(`${logPrefix} ${LOG_PREFIX.ERROR} ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const fanOutConfig = job as unknown as FanOutJobConfig;
  
  // Generate dynamic jobs
  const startTime = Date.now();
  const { jobs: generatedJobs } = generateDynamicJobs(fanOutConfig);
  const generationDuration = Date.now() - startTime;

  const generatedJobIds = generatedJobs.map(j => j.id);
  
  if (generatedJobs.length === 0) {
    context.log(`${HANDLER_MESSAGES.FANOUT_NO_JOBS}`);
    console.warn(`${logPrefix} ${HANDLER_MESSAGES.FANOUT_NO_JOBS}`);
  } else {
    const completeMsg = `${HANDLER_MESSAGES.FANOUT_COMPLETE}: Generated ${generatedJobs.length} jobs in ${generationDuration}ms`;
    context.log(completeMsg);
    console.log(`${logPrefix} ${completeMsg}`);
    
    // Log details about generated jobs
    context.log(`Generated job IDs: ${generatedJobIds.join(', ')}`);
    console.log(`${logPrefix} Generated job IDs: ${generatedJobIds.join(', ')}`);
  }

  return {
    generatedJobs,
    generatedJobIds,
    parameterCount: fanOutConfig.parameters.length,
    sourceJobId: job.id,
  };
}

// ============================================================================
// Fan-In Handler
// ============================================================================

/**
 * Handler for fan-in job type
 * Aggregates results from dynamically generated jobs
 * 
 * Output Structure:
 * {
 *   aggregatedResult: unknown - Result after aggregation
 *   strategy: string - Aggregation strategy used
 *   inputCount: number - Number of inputs aggregated
 *   sourceJobId: string - ID of the fan-out job that generated inputs
 * }
 */
export async function fanInHandler(
  job: JobConfig,
  context: JobContext
): Promise<{
  aggregatedResult: unknown;
  strategy: string;
  inputCount: number;
  sourceJobId: string;
}> {
  const logPrefix = `${LOG_PREFIX.FANIN} [Job: ${job.id}]`;
  
  context.log(`${HANDLER_MESSAGES.FANIN_START}`);
  console.log(`${logPrefix} ${HANDLER_MESSAGES.FANIN_START}`);

  // Validate job configuration is fan-in type
  if (!isFanInJob(job)) {
    const errorMsg = `${HANDLER_MESSAGES.TYPE_MISMATCH}: Expected fan-in job configuration`;
    context.log(`${LOG_PREFIX.ERROR} ${errorMsg}`);
    console.error(`${logPrefix} ${LOG_PREFIX.ERROR} ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const fanInConfig = job as unknown as FanInJobConfig;
  
  // Get source fan-out job output
  const fanOutOutput = context.getJobOutput(fanInConfig.fanOutJobId);
  
  if (!fanOutOutput) {
    const errorMsg = `${HANDLER_MESSAGES.FANIN_MISSING_SOURCE}: ${fanInConfig.fanOutJobId}`;
    context.log(`${LOG_PREFIX.ERROR} ${errorMsg}`);
    console.error(`${logPrefix} ${LOG_PREFIX.ERROR} ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Extract generated job IDs from fan-out output
  const fanOutResult = fanOutOutput as { generatedJobIds: string[] };
  const generatedJobIds = fanOutResult.generatedJobIds;
  
  // Collect outputs from all generated jobs
  const outputs: unknown[] = [];
  for (const jobId of generatedJobIds) {
    const output = context.getJobOutput(jobId);
    if (output !== undefined) {
      outputs.push(output);
    }
  }

  if (outputs.length === 0) {
    context.log(`${HANDLER_MESSAGES.FANIN_NO_RESULTS}`);
    console.warn(`${logPrefix} ${HANDLER_MESSAGES.FANIN_NO_RESULTS}`);
  }

  // Aggregate results
  const startTime = Date.now();
  const aggregatedResult = aggregateResults(
    outputs,
    fanInConfig.aggregation,
    context
  );
  const aggregationDuration = Date.now() - startTime;

  const completeMsg = `${HANDLER_MESSAGES.FANIN_COMPLETE}: Aggregated ${outputs.length} results in ${aggregationDuration}ms`;
  context.log(completeMsg);
  console.log(`${logPrefix} ${completeMsg}`);

  return {
    aggregatedResult,
    strategy: fanInConfig.aggregation.strategy,
    inputCount: outputs.length,
    sourceJobId: fanInConfig.fanOutJobId,
  };
}

// ============================================================================
// Exports
// ============================================================================

export const dynamicHandlers = {
  'fan-out': fanOutHandler,
  'fan-in': fanInHandler,
};
