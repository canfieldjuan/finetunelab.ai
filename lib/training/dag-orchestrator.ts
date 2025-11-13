/**
 * DAG (Directed Acyclic Graph) Orchestrator for Training Pipelines
 * 
 * A lightweight, TypeScript-native workflow orchestration system for managing
 * machine learning training pipelines. No external services required.
 */

import { createClient } from '@supabase/supabase-js';
import { getCacheManager, CacheKeyComputer } from '../services/cache-manager';

// ============================================================================
// Types
// ============================================================================

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobType = 'training' | 'preprocessing' | 'validation' | 'deployment' | 'regression-gate' | 'echo' | 'slow_echo' | 'nonexistent_handler';

export interface JobConfig {
  id: string;
  name: string;
  type: JobType;
  dependsOn: string[]; // IDs of jobs that must complete before this one
  config: Record<string, unknown>; // Job-specific configuration
  retryConfig?: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier?: number;
  };
  timeoutMs?: number;
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
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
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
          
          if (this.supabase) {
            await this.saveExecutionToDatabase(execution);
          }
          
          throw new Error('DAG execution failed due to job failures');
        }
      }

      execution.status = 'completed';
      execution.completedAt = new Date();

      if (this.supabase) {
        await this.saveExecutionToDatabase(execution);
      }

      return execution;
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();

      if (this.supabase) {
        await this.saveExecutionToDatabase(execution);
      }

      throw error;
    }
  }

  /**
   * Execute jobs in a level with limited parallelism
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

    while (queue.length > 0 || running.length > 0) {
      // Start new jobs up to parallelism limit
      while (running.length < maxParallel && queue.length > 0) {
        const job = queue.shift()!;
        const promise = this.executeJob(job, execution, enableCache, forceRerun)
          .then(output => onComplete(job.id, output))
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
          result = await Promise.race([
            handler(job, context),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Job timeout')), job.timeoutMs)
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
