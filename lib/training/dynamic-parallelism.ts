/**
 * Dynamic Parallelism System for DAG Orchestrator
 * 
 * Implements fan-out/fan-in patterns for:
 * - Hyperparameter search (parallel training runs)
 * - A/B testing (multiple variants)
 * - Data sharding (parallel processing)
 * - Result aggregation
 * 
 * Phase 2.1 Implementation
 */

import { JobConfig, JobType, JobContext } from './dag-orchestrator';

// ============================================================================
// Constants
// ============================================================================

const FANOUT_MESSAGES = {
  GENERATING: 'Generating dynamic jobs from template',
  GENERATED: 'Dynamic jobs generated successfully',
  AGGREGATING: 'Aggregating results from parallel jobs',
  AGGREGATED: 'Results aggregated successfully',
} as const;

const FANOUT_LOG_PREFIX = '[FAN-OUT]';
const FANIN_LOG_PREFIX = '[FAN-IN]';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameter specification for fan-out generation
 */
export interface ParameterSpec {
  name: string;
  values: unknown[];
  type?: 'string' | 'number' | 'boolean' | 'object';
}

/**
 * Template for generating dynamic jobs
 */
export interface JobTemplate {
  namePattern: string; // Pattern with ${param} placeholders
  type: JobType;
  config: Record<string, unknown>; // Config template with ${param} placeholders
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier?: number;
  };
  timeoutMs?: number;
}

/**
 * Aggregation strategy for fan-in
 */
export type AggregationStrategy = 
  | 'collect-all'      // Return array of all outputs
  | 'best-metric'      // Return output with best metric value
  | 'worst-metric'     // Return output with worst metric value
  | 'average-metrics'  // Average numeric metrics
  | 'majority-vote'    // Return most common result
  | 'custom';          // Custom aggregation function

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  strategy: AggregationStrategy;
  metricName?: string; // For best/worst metric strategies
  ascending?: boolean; // For metric comparison (default: false = descending)
  customAggregator?: (outputs: unknown[]) => unknown; // For custom strategy
}

/**
 * Fan-out job configuration (generates multiple jobs dynamically)
 */
export interface FanOutJobConfig extends Omit<JobConfig, 'type'> {
  type: 'fan-out';
  template: JobTemplate;
  parameters: ParameterSpec[];
  maxParallelJobs?: number; // Limit concurrent generated jobs
}

/**
 * Fan-in job configuration (aggregates results from fan-out)
 */
export interface FanInJobConfig extends Omit<JobConfig, 'type'> {
  type: 'fan-in';
  fanOutJobId: string; // ID of the fan-out job to aggregate
  aggregation: AggregationConfig;
}

/**
 * Generated job metadata
 */
export interface GeneratedJobMetadata {
  sourceJobId: string;
  parameterValues: Record<string, unknown>;
  generatedAt: Date;
}

// ============================================================================
// Parameter Expansion
// ============================================================================

/**
 * Generate all parameter combinations (Cartesian product)
 */
export function generateParameterCombinations(
  parameters: ParameterSpec[]
): Record<string, unknown>[] {
  if (parameters.length === 0) {
    return [{}];
  }

  const [first, ...rest] = parameters;
  const restCombinations = generateParameterCombinations(rest);
  const combinations: Record<string, unknown>[] = [];

  for (const value of first.values) {
    for (const restCombo of restCombinations) {
      combinations.push({
        [first.name]: value,
        ...restCombo,
      });
    }
  }

  return combinations;
}

/**
 * Replace ${param} placeholders in a string
 */
export function replacePlaceholders(
  template: string,
  parameters: Record<string, unknown>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(parameters)) {
    const placeholder = `\${${key}}`;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), stringValue);
  }
  
  return result;
}

/**
 * Deep replace placeholders in an object
 */
export function replacePlaceholdersInObject(
  obj: Record<string, unknown>,
  parameters: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = replacePlaceholders(value, parameters);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = replacePlaceholdersInObject(value as Record<string, unknown>, parameters);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => 
        typeof item === 'string' 
          ? replacePlaceholders(item, parameters)
          : typeof item === 'object' && item !== null
          ? replacePlaceholdersInObject(item as Record<string, unknown>, parameters)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ============================================================================
// Job Generation
// ============================================================================

/**
 * Generate dynamic jobs from fan-out configuration
 */
export function generateDynamicJobs(
  fanOutConfig: FanOutJobConfig,
  dependsOn: string[] = []
): { jobs: JobConfig[]; metadata: Map<string, GeneratedJobMetadata> } {
  console.log(`${FANOUT_LOG_PREFIX} ${FANOUT_MESSAGES.GENERATING}`, {
    sourceJob: fanOutConfig.id,
    parameterCount: fanOutConfig.parameters.length,
  });

  const combinations = generateParameterCombinations(fanOutConfig.parameters);
  const jobs: JobConfig[] = [];
  const metadata = new Map<string, GeneratedJobMetadata>();

  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    
    // Generate unique job ID
    const paramSuffix = Object.entries(params)
      .map(([key, value]) => `${key}_${String(value).replace(/[^a-zA-Z0-9]/g, '_')}`)
      .join('_');
    const jobId = `${fanOutConfig.id}_${i}_${paramSuffix}`;

    // Generate job name with parameters
    const jobName = replacePlaceholders(fanOutConfig.template.namePattern, params);

    // Generate job config with parameter substitution
    const jobConfig = replacePlaceholdersInObject(fanOutConfig.template.config, params);

    // Create job
    const job: JobConfig = {
      id: jobId,
      name: jobName,
      type: fanOutConfig.template.type,
      dependsOn: [...dependsOn],
      config: jobConfig,
      retryConfig: fanOutConfig.template.retryConfig,
      timeoutMs: fanOutConfig.template.timeoutMs,
    };

    jobs.push(job);

    // Store metadata
    metadata.set(jobId, {
      sourceJobId: fanOutConfig.id,
      parameterValues: params,
      generatedAt: new Date(),
    });
  }

  console.log(`${FANOUT_LOG_PREFIX} ${FANOUT_MESSAGES.GENERATED}`, {
    sourceJob: fanOutConfig.id,
    generatedCount: jobs.length,
  });

  return { jobs, metadata };
}

// ============================================================================
// Result Aggregation
// ============================================================================

/**
 * Extract metric value from output
 */
function extractMetric(output: unknown, metricName: string): number | null {
  if (!output || typeof output !== 'object') {
    return null;
  }

  const obj = output as Record<string, unknown>;
  
  // Try direct access
  if (typeof obj[metricName] === 'number') {
    return obj[metricName] as number;
  }

  // Try nested in 'metrics' object
  if (obj.metrics && typeof obj.metrics === 'object') {
    const metrics = obj.metrics as Record<string, unknown>;
    if (typeof metrics[metricName] === 'number') {
      return metrics[metricName] as number;
    }
  }

  return null;
}

/**
 * Aggregate results from multiple jobs
 */
export function aggregateResults(
  outputs: unknown[],
  config: AggregationConfig,
  context?: JobContext
): unknown {
  if (context) {
    context.log(`${FANIN_LOG_PREFIX} ${FANOUT_MESSAGES.AGGREGATING}`);
    context.log(`  Strategy: ${config.strategy}`);
    context.log(`  Input count: ${outputs.length}`);
  }

  let result: unknown;

  switch (config.strategy) {
    case 'collect-all':
      result = outputs;
      break;

    case 'best-metric': {
      if (!config.metricName) {
        throw new Error('metricName required for best-metric strategy');
      }

      const ascending = config.ascending ?? false;
      let bestOutput = outputs[0];
      let bestValue = extractMetric(bestOutput, config.metricName);

      for (let i = 1; i < outputs.length; i++) {
        const currentValue = extractMetric(outputs[i], config.metricName);
        
        if (currentValue !== null && (bestValue === null || 
            (ascending ? currentValue < bestValue : currentValue > bestValue))) {
          bestValue = currentValue;
          bestOutput = outputs[i];
        }
      }

      if (context) {
        context.log(`  Best ${config.metricName}: ${bestValue}`);
      }

      result = bestOutput;
      break;
    }

    case 'worst-metric': {
      if (!config.metricName) {
        throw new Error('metricName required for worst-metric strategy');
      }

      const ascending = config.ascending ?? false;
      let worstOutput = outputs[0];
      let worstValue = extractMetric(worstOutput, config.metricName);

      for (let i = 1; i < outputs.length; i++) {
        const currentValue = extractMetric(outputs[i], config.metricName);
        
        if (currentValue !== null && (worstValue === null || 
            (ascending ? currentValue > worstValue : currentValue < worstValue))) {
          worstValue = currentValue;
          worstOutput = outputs[i];
        }
      }

      if (context) {
        context.log(`  Worst ${config.metricName}: ${worstValue}`);
      }

      result = worstOutput;
      break;
    }

    case 'average-metrics': {
      const metrics: Record<string, number[]> = {};
      
      // Collect all numeric metrics
      for (const output of outputs) {
        if (output && typeof output === 'object') {
          const obj = output as Record<string, unknown>;
          const metricsObj = obj.metrics && typeof obj.metrics === 'object' 
            ? obj.metrics as Record<string, unknown>
            : obj;

          for (const [key, value] of Object.entries(metricsObj)) {
            if (typeof value === 'number') {
              if (!metrics[key]) {
                metrics[key] = [];
              }
              metrics[key].push(value);
            }
          }
        }
      }

      // Calculate averages
      const averages: Record<string, number> = {};
      for (const [key, values] of Object.entries(metrics)) {
        averages[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }

      if (context) {
        context.log(`  Averaged ${Object.keys(averages).length} metrics`);
      }

      result = { metrics: averages };
      break;
    }

    case 'majority-vote': {
      const counts = new Map<string, number>();
      
      for (const output of outputs) {
        const key = JSON.stringify(output);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      let maxCount = 0;
      let majorityKey = '';
      
      for (const [key, count] of counts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          majorityKey = key;
        }
      }

      if (context) {
        context.log(`  Majority count: ${maxCount}/${outputs.length}`);
      }

      result = JSON.parse(majorityKey);
      break;
    }

    case 'custom': {
      if (!config.customAggregator) {
        throw new Error('customAggregator function required for custom strategy');
      }

      result = config.customAggregator(outputs);
      break;
    }

    default:
      throw new Error(`Unknown aggregation strategy: ${config.strategy}`);
  }

  if (context) {
    context.log(`${FANIN_LOG_PREFIX} ${FANOUT_MESSAGES.AGGREGATED}`);
  }

  return result;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a job config is a fan-out job
 */
export function isFanOutJob(config: JobConfig): config is FanOutJobConfig {
  return config.type === 'fan-out';
}

/**
 * Check if a job config is a fan-in job
 */
export function isFanInJob(config: JobConfig): config is FanInJobConfig {
  return config.type === 'fan-in';
}

/**
 * Get all job IDs generated by a fan-out job
 */
export function getGeneratedJobIds(
  fanOutJobId: string,
  allJobIds: string[]
): string[] {
  return allJobIds.filter(id => id.startsWith(`${fanOutJobId}_`));
}
