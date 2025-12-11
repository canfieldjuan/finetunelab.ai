/**
 * DAG (Directed Acyclic Graph) Orchestrator for Training Pipelines
 * 
 * A lightweight, TypeScript-native workflow orchestration system for managing
 * machine learning training pipelines. No external services required.
 */

import { createClient } from '@supabase/supabase-js';
import { getCacheManager, CacheKeyComputer } from '../services/cache-manager';
import { getSecurityManager, SecurityManager, ResourceLimits } from './security-manager';
import { CheckpointManager, CheckpointConfig } from './checkpoint-manager';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = {
  DAG: '[DAG]',
  CONDITION: '[CONDITION]',
  CACHE: '[CACHE]',
  ERROR: '[ERROR]',
} as const;

const CONDITION_MESSAGES = {
  EVALUATING: 'Evaluating execution condition',
  MET: 'Condition met - proceeding with execution',
  NOT_MET: 'Condition not met - job skipped',
  EVALUATION_FAILED: 'Condition evaluation failed',
} as const;

const SKIP_REASON = {
  CONDITION_NOT_MET: 'Condition not met',
} as const;

// ============================================================================
// Types
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';
export type JobType = 'training' | 'train' | 'preprocessing' | 'validation' | 'deployment' | 'regression-gate' | 'echo' | 'slow_echo' | 'nonexistent_handler' | 'fan-out' | 'fan-in';

/**
 * Condition function that determines if a job should execute
 * Returns true to execute, false to skip
 */
export type ConditionFunction = (context: {
  getJobOutput: (jobId: string) => unknown;
  executionId: string;
}) => boolean | Promise<boolean>;

export interface JobConfig {
  id: string;
  name: string;
  type: JobType;
  dependsOn: string[]; // IDs of jobs that must complete before this one
  config: Record<string, unknown>; // Job-specific configuration
  condition?: ConditionFunction; // Optional condition to determine if job should run
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier?: number;
  };
  timeoutMs?: number;
  resourceLimits?: ResourceLimits; // Optional resource constraints for security
}

export interface JobExecution {
  jobId: string;
  status: JobStatus;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: unknown;
  attempt: number;
  logs: string[];
}

export interface DAGExecution {
  id: string;
  name: string;
  status: JobStatus;
  startedAt: Date;
  completedAt?: Date;
  jobs: Map<string, JobExecution>;
}

export type JobHandler = (config: JobConfig, context: JobContext) => Promise<unknown>;

export interface JobContext {
  executionId: string;
  log: (message: string) => void;
  getJobOutput: (jobId: string) => unknown;
  updateProgress: (progress: number) => Promise<void>;
}

// ============================================================================
// Job-Specific Configuration Types
// ============================================================================

/**
 * Configuration for Regression Gate job type
 * Compares model metrics against a baseline to detect performance regression
 * 
 * Phase 2 Implementation: Uses manual currentMetrics (no model inference)
 * Phase 3 Enhancement: Automated model inference via /validate endpoint
 */
export interface RegressionGateConfig {
  /** UUID of the baseline to compare against */
  baselineId: string;
  
  /** 
   * Current model metrics to compare (manual input)
   * Optional if modelPath + testDatasetId provided for automated inference
   */
  currentMetrics?: Record<string, number>;
  
  /** Path to model for automated inference (Phase 3) */
  modelPath?: string;
  
  /** UUID of test dataset for automated inference (Phase 3) */
  testDatasetId?: string;
  
  /** Maximum acceptable performance drop (0.05 = 5% drop allowed) */
  failureThreshold: number;
  
  /** List of metric names that must pass validation */
  requiredMetrics: string[];
  
  /** If true, blocks pipeline execution on failure */
  blockOnFailure: boolean;
}

// ============================================================================
// DAG Validator
// ============================================================================

export class DAGValidator {
  /**
   * Validates that the job graph forms a valid DAG (no cycles)
   */
  static validate(jobs: JobConfig[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const jobMap = new Map(jobs.map(j => [j.id, j]));

    // Check all dependencies exist
    for (const job of jobs) {
      for (const depId of job.dependsOn) {
        if (!jobMap.has(depId)) {
          errors.push(`Job "${job.id}" depends on non-existent job "${depId}"`);
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (jobId: string): boolean => {
      if (recStack.has(jobId)) return true;
      if (visited.has(jobId)) return false;

      visited.add(jobId);
      recStack.add(jobId);

      const job = jobMap.get(jobId);
      if (job) {
        for (const depId of job.dependsOn) {
          if (hasCycle(depId)) {
            errors.push(`Cycle detected involving job "${jobId}" and "${depId}"`);
            return true;
          }
        }
      }

      recStack.delete(jobId);
      return false;
    };

    for (const job of jobs) {
      if (!visited.has(job.id)) {
        hasCycle(job.id);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Performs topological sort to determine execution order
   */
  static topologicalSort(jobs: JobConfig[]): JobConfig[] {
    const jobMap = new Map(jobs.map(j => [j.id, j]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const job of jobs) {
      inDegree.set(job.id, 0);
      adjList.set(job.id, []);
    }

    // Build adjacency list and in-degree
    for (const job of jobs) {
      for (const depId of job.dependsOn) {
        adjList.get(depId)?.push(job.id);
        inDegree.set(job.id, (inDegree.get(job.id) || 0) + 1);
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: JobConfig[] = [];

    // Start with jobs that have no dependencies
    for (const [jobId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(jobId);
      }
    }

    while (queue.length > 0) {
      const jobId = queue.shift()!;
      const job = jobMap.get(jobId)!;
      result.push(job);

      // Reduce in-degree for dependent jobs
      for (const dependentId of adjList.get(jobId) || []) {
        const newDegree = (inDegree.get(dependentId) || 0) - 1;
        inDegree.set(dependentId, newDegree);
        if (newDegree === 0) {
          queue.push(dependentId);
        }
      }
    }

    return result;
  }

  /**
   * Gets jobs that can be executed in parallel at each level
   */
  static getExecutionLevels(jobs: JobConfig[]): JobConfig[][] {
    const levels: JobConfig[][] = [];
    const processed = new Set<string>();

    while (processed.size < jobs.length) {
      const currentLevel: JobConfig[] = [];

      for (const job of jobs) {
        if (processed.has(job.id)) continue;

        // Check if all dependencies are processed
        const allDepsProcessed = job.dependsOn.every(depId => processed.has(depId));
        if (allDepsProcessed) {
          currentLevel.push(job);
        }
      }

      if (currentLevel.length === 0) {
        throw new Error('Circular dependency detected or invalid DAG');
      }

      levels.push(currentLevel);
      currentLevel.forEach(job => processed.add(job.id));
    }

    return levels;
  }
}

// ============================================================================
// DAG Orchestrator
// ============================================================================

export class DAGOrchestrator {
  private handlers = new Map<JobType, JobHandler>();
  private executions = new Map<string, DAGExecution>();
  private pausedExecutions = new Set<string>(); // Track paused executions
  private supabase: ReturnType<typeof createClient> | null = null;
  private securityManager: SecurityManager;
  private checkpointManager: CheckpointManager | null = null;

  constructor(supabaseUrl?: string, supabaseKey?: string, checkpointConfig?: Partial<CheckpointConfig>) {
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.checkpointManager = new CheckpointManager(supabaseUrl, supabaseKey, checkpointConfig);
    }
    this.securityManager = getSecurityManager(supabaseUrl, supabaseKey);
  }

  /**
   * Register a handler for a specific job type
   */
  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Execute a DAG
   */
  async execute(
    name: string,
    jobs: JobConfig[],
    options: {
      parallelism?: number; // Max jobs to run in parallel per level
      enableCache?: boolean; // Enable caching for this execution
      forceRerun?: boolean; // Force rerun even if cached
      onJobComplete?: (jobId: string, output: unknown) => void;
      onJobFail?: (jobId: string, error: string) => void;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<DAGExecution> {
    const {
      parallelism = 3,
      enableCache = true,
      forceRerun = false,
      onJobComplete,
      onJobFail,
      onProgress,
    } = options;

    // Validate DAG
    const validation = DAGValidator.validate(jobs);
    if (!validation.valid) {
      throw new Error(`Invalid DAG: ${validation.errors.join(', ')}`);
    }

    // Create execution
    const executionId = `dag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: DAGExecution = {
      id: executionId,
      name,
      status: 'running',
      startedAt: new Date(),
      jobs: new Map(
        jobs.map(job => [
          job.id,
          {
            jobId: job.id,
            status: 'pending',
            attempt: 0,
            logs: [],
          },
        ])
      ),
    };

    this.executions.set(executionId, execution);

    // Log execution start for audit trail
    await this.securityManager.logExecutionStart(executionId, name);

    // Start resource monitoring if any job has resource limits
    const hasResourceLimits = jobs.some(job => job.resourceLimits);
    if (hasResourceLimits) {
      const globalLimits = jobs.find(job => job.resourceLimits)?.resourceLimits || {};
      
      this.securityManager.startResourceMonitoring(
        executionId,
        globalLimits,
        async (violation) => {
          console.error(`${LOG_PREFIX.ERROR} Resource violation detected:`, violation);
          
          // Log security violation
          await this.securityManager.logSecurityViolation(violation);
          
          // Cancel execution if critical violation
          if (violation.severity === 'critical' || violation.severity === 'high') {
            execution.status = 'cancelled';
            this.securityManager.stopResourceMonitoring(executionId);
            throw new Error(`Execution cancelled due to ${violation.type}: ${violation.message}`);
          }
        }
      );
    }

    // Save to database if configured
    if (this.supabase) {
      await this.saveExecutionToDatabase(execution);
    }

    try {
      // Get execution levels (jobs that can run in parallel)
      const levels = DAGValidator.getExecutionLevels(jobs);

      let completedCount = 0;
      const totalJobs = jobs.length;

      // Execute level by level
      for (const level of levels) {
        // Execute jobs in this level with limited parallelism
        await this.executeLevelWithParallelism(
          level,
          execution,
          parallelism,
          enableCache,
          forceRerun,
          async (jobId, output) => {
            completedCount++;
            onJobComplete?.(jobId, output);
            onProgress?.(completedCount, totalJobs);
            
            // Update database
            if (this.supabase) {
              await this.updateJobInDatabase(executionId, jobId, execution.jobs.get(jobId)!);
            }
          },
          async (jobId, error) => {
            onJobFail?.(jobId, error);
            
            // Update database
            if (this.supabase) {
              await this.updateJobInDatabase(executionId, jobId, execution.jobs.get(jobId)!);
            }
          }
        );

        // Check if any job in this level failed
        const anyFailed = level.some(
          job => execution.jobs.get(job.id)?.status === 'failed'
        );

        if (anyFailed) {
          execution.status = 'failed';
          execution.completedAt = new Date();
          
          // Stop resource monitoring
          this.securityManager.stopResourceMonitoring(executionId);
          
          // Log execution failure
          const failedJobs = Array.from(execution.jobs.values()).filter(j => j.status === 'failed');
          const errorMessage = `${failedJobs.length} job(s) failed: ${failedJobs.map(j => j.jobId).join(', ')}`;
          await this.securityManager.logExecutionFailed(executionId, errorMessage);
          
          if (this.supabase) {
            await this.saveExecutionToDatabase(execution);
          }
          
          throw new Error('DAG execution failed due to job failures');
        }
      }

      execution.status = 'completed';
      execution.completedAt = new Date();

      // Stop resource monitoring
      this.securityManager.stopResourceMonitoring(executionId);

      // Log execution completion
      const duration = execution.completedAt.getTime() - execution.startedAt.getTime();
      const completedJobs = Array.from(execution.jobs.values()).filter(j => j.status === 'completed').length;
      const failedJobs = Array.from(execution.jobs.values()).filter(j => j.status === 'failed').length;
      await this.securityManager.logExecutionComplete(
        executionId,
        duration,
        execution.jobs.size,
        completedJobs,
        failedJobs
      );

      if (this.supabase) {
        await this.saveExecutionToDatabase(execution);
      }

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();

      // Stop resource monitoring
      this.securityManager.stopResourceMonitoring(executionId);

      // Log execution failure
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.securityManager.logExecutionFailed(executionId, errorMessage);

      if (this.supabase) {
        await this.saveExecutionToDatabase(execution);
      }

      throw error;
    }
  }

  /**
   * Execute jobs in a level with limited parallelism
   * Handles dynamic job injection from fan-out jobs
   */
  private async executeLevelWithParallelism(
    level: JobConfig[],
    execution: DAGExecution,
    maxParallel: number,
    enableCache: boolean,
    forceRerun: boolean,
    onComplete: (jobId: string, output: unknown) => Promise<void>,
    onFail: (jobId: string, error: string) => Promise<void>
  ): Promise<void> {
    const queue = [...level];
    const running: Promise<void>[] = [];
    const generatedJobs: JobConfig[] = []; // Track dynamically generated jobs

    while (queue.length > 0 || running.length > 0 || generatedJobs.length > 0) {
      // Check if execution is paused
      if (this.pausedExecutions.has(execution.id)) {
        console.log(`[DAG] Execution ${execution.id} is paused - waiting for resume`);
        // Wait for currently running jobs to complete
        if (running.length > 0) {
          await Promise.all(running);
        }
        // Pause execution - return early
        execution.status = 'running'; // Keep status as running (paused state is tracked separately)
        console.log(`[DAG] Execution ${execution.id} paused with ${queue.length} jobs remaining`);
        return;
      }

      // Add generated jobs to queue
      while (generatedJobs.length > 0) {
        const generatedJob = generatedJobs.shift()!;
        // Add job execution tracking
        execution.jobs.set(generatedJob.id, {
          jobId: generatedJob.id,
          status: 'pending',
          attempt: 0,
          logs: [],
        });
        queue.push(generatedJob);
      }

      // Start new jobs up to parallelism limit
      while (running.length < maxParallel && queue.length > 0) {
        const job = queue.shift()!;
        const promise = this.executeJob(job, execution, enableCache, forceRerun)
          .then(async (output) => {
            // Check if this is a fan-out job that generated new jobs
            if (job.type === 'fan-out' && output && typeof output === 'object') {
              const fanOutOutput = output as { generatedJobs?: JobConfig[] };
              if (fanOutOutput.generatedJobs && Array.isArray(fanOutOutput.generatedJobs)) {
                console.log(`[DAG] Fan-out job ${job.id} generated ${fanOutOutput.generatedJobs.length} jobs`);
                // Add generated jobs to the queue
                generatedJobs.push(...fanOutOutput.generatedJobs);
              }
            }
            await onComplete(job.id, output);
          })
          .catch(error => onFail(job.id, error.message))
          .finally(() => {
            const index = running.indexOf(promise);
            if (index > -1) running.splice(index, 1);
          });
        running.push(promise);
      }

      // Wait for at least one job to complete
      if (running.length > 0) {
        await Promise.race(running);
      }
    }
  }

  /**
   * Execute a single job with retry logic and caching
   */
  private async executeJob(
    job: JobConfig,
    execution: DAGExecution,
    enableCache: boolean = true,
    forceRerun: boolean = false
  ): Promise<unknown> {
    const jobExecution = execution.jobs.get(job.id)!;
    
    // Check condition before executing
    if (job.condition) {
      const logPrefix = `${LOG_PREFIX.DAG} [Job: ${job.id}]`;
      console.log(`${logPrefix} ${LOG_PREFIX.CONDITION} Checking execution condition`);
      jobExecution.logs.push(`${LOG_PREFIX.CONDITION} ${CONDITION_MESSAGES.EVALUATING}...`);
      
      try {
        const conditionContext = {
          getJobOutput: (jobId: string) => {
            const output = execution.jobs.get(jobId)?.output;
            console.log(`${logPrefix} Condition accessing output from job: ${jobId}, exists: ${output !== undefined}`);
            return output;
          },
          executionId: execution.id,
        };
        
        const conditionStartTime = Date.now();
        const shouldExecute = await job.condition(conditionContext);
        const conditionDuration = Date.now() - conditionStartTime;
        
        console.log(`${logPrefix} Condition evaluated to: ${shouldExecute} (took ${conditionDuration}ms)`);
        
        if (!shouldExecute) {
          console.log(`${logPrefix} ${CONDITION_MESSAGES.NOT_MET}`);
          jobExecution.logs.push(`${LOG_PREFIX.CONDITION} ${CONDITION_MESSAGES.NOT_MET}`);
          jobExecution.status = 'skipped';
          jobExecution.completedAt = new Date();
          jobExecution.output = { 
            skipped: true, 
            reason: SKIP_REASON.CONDITION_NOT_MET,
            evaluationDuration: conditionDuration,
          };
          console.log(`${logPrefix} Job skipped, returning skip output`);
          return jobExecution.output;
        }
        
        console.log(`${logPrefix} ${CONDITION_MESSAGES.MET}`);
        jobExecution.logs.push(`${LOG_PREFIX.CONDITION} ${CONDITION_MESSAGES.MET}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error(`${LOG_PREFIX.DAG} ${LOG_PREFIX.ERROR} ${CONDITION_MESSAGES.EVALUATION_FAILED} for job ${job.id}:`, errorMessage);
        if (errorStack) {
          console.error(`${LOG_PREFIX.ERROR} Stack trace:`, errorStack);
        }
        jobExecution.logs.push(`${LOG_PREFIX.CONDITION} ${LOG_PREFIX.ERROR} ${errorMessage}`);
        throw new Error(`${CONDITION_MESSAGES.EVALUATION_FAILED} for job ${job.id}: ${errorMessage}`);
      }
    }
    
    const handler = this.handlers.get(job.type);

    if (!handler) {
      throw new Error(`No handler registered for job type: ${job.type}`);
    }

    // Check cache before execution
    if (enableCache && !forceRerun) {
      try {
        console.log('[DAG] Checking cache for job:', job.id);

        const cacheManager = getCacheManager();
        const dependencyOutputs: Record<string, unknown> = {};

        for (const depId of job.dependsOn) {
          const depJob = execution.jobs.get(depId);
          if (depJob?.output) {
            dependencyOutputs[depId] = depJob.output;
          }
        }

        const cacheKey = CacheKeyComputer.computeCacheKey(job, dependencyOutputs);
        const cachedEntry = await cacheManager.get(cacheKey);

        if (cachedEntry) {
          console.log('[DAG] Cache HIT for job:', job.id);
          jobExecution.logs.push('[CACHE HIT] Using cached output from previous execution');
          jobExecution.status = 'completed';
          jobExecution.completedAt = new Date();
          jobExecution.output = cachedEntry.output;
          return cachedEntry.output;
        }

        console.log('[DAG] Cache MISS for job:', job.id);
        jobExecution.logs.push('[CACHE MISS] Executing job...');
      } catch (error) {
        console.error('[DAG] Cache check error:', error);
        jobExecution.logs.push('[CACHE ERROR] Proceeding with execution');
      }
    }

    const maxRetries = job.retryConfig?.maxRetries ?? 0;
    const retryDelayMs = job.retryConfig?.retryDelayMs ?? 1000;
    const backoffMultiplier = job.retryConfig?.backoffMultiplier ?? 2;

    // Validate resource limits if specified
    if (job.resourceLimits) {
      const validation = this.securityManager.validateResourceLimits(job.resourceLimits);
      if (!validation.valid) {
        const errorMessage = `Invalid resource limits: ${validation.errors.join(', ')}`;
        console.error(`${LOG_PREFIX.ERROR} ${errorMessage}`);
        throw new Error(errorMessage);
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        jobExecution.attempt = attempt + 1;
        jobExecution.status = 'running';
        jobExecution.startedAt = new Date();

        // Create job context
        const context: JobContext = {
          executionId: execution.id,
          log: (message: string) => {
            jobExecution.logs.push(`[${new Date().toISOString()}] ${message}`);
          },
          getJobOutput: (jobId: string) => {
            return execution.jobs.get(jobId)?.output;
          },
          updateProgress: async (progress: number) => {
            // Store progress in job execution metadata
            (jobExecution as JobExecution & { progress?: number }).progress = progress;
          },
        };

        // Execute with timeout if configured
        let result: unknown;
        if (job.timeoutMs) {
          const timeoutMs = job.timeoutMs;
          result = await Promise.race([
            handler(job, context),
            new Promise((_, reject) =>
              setTimeout(() => {
                console.error(`${LOG_PREFIX.ERROR} Job ${job.id} timed out after ${timeoutMs}ms`);
                this.securityManager.logJobTimeout(execution.id, job.id, timeoutMs);
                reject(new Error('Job timeout'));
              }, timeoutMs)
            ),
          ]);
        } else {
          result = await handler(job, context);
        }

        jobExecution.status = 'completed';
        jobExecution.completedAt = new Date();
        jobExecution.output = result;

        // Store in cache after successful execution
        if (enableCache) {
          try {
            console.log('[DAG] Storing result in cache for job:', job.id);

            const cacheManager = getCacheManager();
            const dependencyOutputs: Record<string, unknown> = {};

            for (const depId of job.dependsOn) {
              const depJob = execution.jobs.get(depId);
              if (depJob?.output) {
                dependencyOutputs[depId] = depJob.output;
              }
            }

            const cacheKey = CacheKeyComputer.computeCacheKey(job, dependencyOutputs);
            await cacheManager.set(cacheKey, execution.id, job.id, result);

            console.log('[DAG] Result cached successfully');
            jobExecution.logs.push('[CACHE] Output stored for future executions');
          } catch (error) {
            console.error('[DAG] Cache storage error:', error);
            jobExecution.logs.push('[CACHE ERROR] Failed to store output');
          }
        }

        return result;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isLastAttempt = attempt === maxRetries;

        if (isLastAttempt) {
          jobExecution.status = 'failed';
          jobExecution.completedAt = new Date();
          jobExecution.error = errorMessage;
          throw error;
        }

        // Wait before retry with exponential backoff
        const delay = retryDelayMs * Math.pow(backoffMultiplier, attempt);
        jobExecution.logs.push(
          `Attempt ${attempt + 1} failed: ${errorMessage}. Retrying in ${delay}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Cancel a running DAG execution
   */
  async cancel(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();

    // Mark all pending/running jobs as cancelled
    for (const jobExec of execution.jobs.values()) {
      if (jobExec.status === 'pending' || jobExec.status === 'running') {
        jobExec.status = 'cancelled';
      }
    }

    if (this.supabase) {
      await this.saveExecutionToDatabase(execution);
    }
  }

  /**
   * Get execution status
   */
  /**
   * Pause an execution gracefully
   * Waits for currently running jobs to complete before pausing
   */
  async pause(executionId: string, createCheckpoint: boolean = true): Promise<void> {
    const execution = this.executions.get(executionId);
    
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (execution.status !== 'running') {
      throw new Error(`Cannot pause execution ${executionId}: status is ${execution.status}`);
    }

    console.log(`[DAG] Pausing execution: ${executionId}`);
    this.pausedExecutions.add(executionId);

    // Create checkpoint if requested
    if (createCheckpoint && this.checkpointManager) {
      const jobConfigs = Array.from(execution.jobs.keys()).map(jobId => {
        // Note: Original job configs should be stored with execution in production
        // For now, we create minimal configs from execution state
        const jobExec = execution.jobs.get(jobId)!;
        return {
          id: jobId,
          name: jobId,
          type: 'training' as JobType,
          dependsOn: [],
          config: (jobExec.output || {}) as Record<string, unknown>,
        };
      });

      await this.checkpointManager.createCheckpoint(
        execution,
        jobConfigs,
        { 
          trigger: 'manual',
          name: `Manual pause of ${execution.name}`,
        }
      );
    }

    console.log(`[DAG] Execution ${executionId} paused`);
  }

  /**
   * Resume a paused execution from its current state
   */
  async resume(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (!this.pausedExecutions.has(executionId)) {
      throw new Error(`Execution ${executionId} is not paused`);
    }

    console.log(`[DAG] Resuming execution: ${executionId}`);
    this.pausedExecutions.delete(executionId);

    // Note: Resume logic should restart the execution loop
    // This requires refactoring execute() to support resume
    // For now, we just mark as resumed - full implementation in next step
    console.log(`[DAG] Execution ${executionId} resumed (continuation requires restart)`);
  }

  /**
   * Resume execution from a checkpoint
   */
  async resumeFromCheckpoint(checkpointId: string): Promise<DAGExecution> {
    if (!this.checkpointManager) {
      throw new Error('Checkpoint manager not initialized');
    }

    console.log(`[DAG] Resuming from checkpoint: ${checkpointId}`);

    const { execution, jobConfigs } = await this.checkpointManager.restoreFromCheckpoint(checkpointId);

    // Restore execution state
    this.executions.set(execution.id, execution);

    // Note: Full resume requires re-executing from the restored state
    // This requires refactoring execute() to support partial execution
    // For now, we just restore the state - full implementation in next step
    console.log(`[DAG] Execution ${execution.id} restored from checkpoint`);
    console.log(`[DAG] Jobs restored: ${execution.jobs.size}, Configs: ${jobConfigs.length}`);

    return execution;
  }

  /**
   * Create a manual checkpoint for an execution
   */
  async createCheckpoint(
    executionId: string,
    name?: string,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    if (!this.checkpointManager) {
      throw new Error('Checkpoint manager not initialized');
    }

    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const jobConfigs = Array.from(execution.jobs.keys()).map(jobId => {
      const jobExec = execution.jobs.get(jobId)!;
      return {
        id: jobId,
        name: jobId,
        type: 'training' as JobType,
        dependsOn: [],
        config: (jobExec.output || {}) as Record<string, unknown>,
      };
    });

    const checkpoint = await this.checkpointManager.createCheckpoint(
      execution,
      jobConfigs,
      { 
        trigger: 'manual',
        name,
        metadata,
      }
    );

    console.log(`[DAG] Checkpoint created: ${checkpoint.id}`);
    return checkpoint.id;
  }

  /**
   * Check if an execution is paused
   */
  isPaused(executionId: string): boolean {
    return this.pausedExecutions.has(executionId);
  }

  getExecution(executionId: string): DAGExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Save execution to database
   */
  private async saveExecutionToDatabase(execution: DAGExecution): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase.from('training_jobs').upsert({
      id: execution.id,
      name: execution.name,
      status: execution.status,
      started_at: execution.startedAt.toISOString(),
      completed_at: execution.completedAt?.toISOString(),
      jobs: Array.from(execution.jobs.entries()).map(([id, job]) => ({
        id,
        ...job,
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      })),
    } as never);

    if (error) {
      console.error('Failed to save execution to database:', error);
    }
  }

  /**
   * Update job status in database
   */
  private async updateJobInDatabase(
    executionId: string,
    jobId: string,
    job: JobExecution
  ): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from('training_metrics')
      .insert({
        job_id: executionId,
        metric_name: `job_${jobId}_status`,
        metric_string: job.status,
        timestamp: new Date().toISOString(),
        metadata: {
          attempt: job.attempt,
          logs: job.logs,
          output: job.output,
          error: job.error,
        },
      } as never);

    if (error) {
      console.error('[DAG] Failed to update job in database:', error);
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export default DAGOrchestrator;
