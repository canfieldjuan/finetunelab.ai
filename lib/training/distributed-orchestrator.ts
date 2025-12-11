/**
 * Distributed Orchestrator
 * 
 * Extends DAGOrchestrator with distributed execution capabilities:
 * - Job dispatching to message queue
 * - Worker pool management and selection
 * - Distributed state management
 * - Automatic failover and job redistribution
 */

import { JobConfig, DAGExecution } from './dag-orchestrator';
import { getJobQueue, closeJobQueue, QueueJobData } from './job-queue';
import { getWorkerManager, closeWorkerManager, WorkerRequirements } from './worker-manager';
import { getStateStore, closeStateStore, ExecutionState } from './state-store';

/**
 * Configuration for distributed execution
 */
export interface DistributedConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  orchestratorId: string; // Unique ID for this orchestrator instance
  workerSelectionStrategy?: 'load-balanced' | 'capability-based' | 'round-robin';
  enableFailover?: boolean; // Enable automatic job redistribution on worker failure
  failoverCheckIntervalMs?: number; // How often to check for failed workers (default: 30s)
  jobTimeoutMs?: number; // Default timeout for jobs (default: 5 minutes)
}

/**
 * Distributed execution statistics
 */
export interface DistributedStats {
  totalWorkers: number;
  activeWorkers: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageJobDuration: number;
  workerUtilization: number;
}

/**
 * Distributed orchestrator for horizontal scaling
 */
export class DistributedOrchestrator {
  private config: DistributedConfig;
  private activeExecutions = new Map<string, ExecutionState>();
  private failoverIntervalId: NodeJS.Timeout | null = null;

  constructor(config: DistributedConfig) {
    this.config = {
      workerSelectionStrategy: 'load-balanced',
      enableFailover: true,
      failoverCheckIntervalMs: 30000,
      jobTimeoutMs: 5 * 60 * 1000,
      ...config,
    };

    console.log(`[DISTRIBUTED_ORCHESTRATOR] Initialized orchestrator ${this.config.orchestratorId}`);
  }

  /**
   * Initialize distributed components
   */
  async initialize(): Promise<void> {
    console.log('[DISTRIBUTED_ORCHESTRATOR] Initializing distributed components...');

    // Initialize job queue
    getJobQueue({
      redis: this.config.redis,
      defaultJobOptions: {
        attempts: 3,
        backoffDelay: 5000,
        backoffMultiplier: 2, // exponential backoff multiplier
      },
    });

    // Initialize worker manager
    getWorkerManager({
      redis: this.config.redis,
      heartbeatTimeoutMs: 90000,
      heartbeatIntervalMs: 30000,
      cleanupIntervalMs: 60000,
    });

    // Initialize state store
    getStateStore({
      redis: this.config.redis,
      lockTTL: 30000,
      stateTTL: 7 * 24 * 60 * 60, // 7 days
    });

    // Start failover monitoring if enabled
    if (this.config.enableFailover) {
      this.startFailoverMonitoring();
    }

    console.log('[DISTRIBUTED_ORCHESTRATOR] Initialization complete');
  }

  /**
   * Execute DAG in distributed mode
   */
  async execute(
    workflowId: string,
    jobs: JobConfig[],
    options: {
      parallelism?: number;
      onJobComplete?: (jobId: string, output: unknown) => void;
      onJobFail?: (jobId: string, error: string) => void;
      onProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<DAGExecution> {
    const { parallelism = 10, onJobComplete, onJobFail, onProgress } = options;

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[DISTRIBUTED_ORCHESTRATOR] Starting distributed execution: ${executionId}`);

    // Create execution state in state store
    const stateStore = getStateStore();
    const executionState: ExecutionState = {
      executionId,
      workflowId,
      status: 'running',
      startedAt: Date.now(),
      currentJobs: [],
      completedJobs: [],
      failedJobs: [],
      jobResults: {},
      metadata: {
        orchestratorId: this.config.orchestratorId,
        totalJobs: jobs.length,
        parallelism,
      },
    };

    await stateStore.setExecutionState(executionState);
    this.activeExecutions.set(executionId, executionState);

    try {
      // Acquire distributed lock for this execution
      const lockId = await stateStore.acquireLock(
        `execution:${executionId}`,
        this.config.orchestratorId
      );

      if (!lockId) {
        throw new Error('Failed to acquire execution lock - another orchestrator may be handling this');
      }

      // Submit jobs to queue based on dependencies
      await this.submitJobsToQueue(executionId, jobs);

      // Wait for all jobs to complete
      const result = await this.waitForCompletion(
        executionId,
        jobs.length,
        onJobComplete,
        onJobFail,
        onProgress
      );

      // Release lock
      await stateStore.releaseLock(`execution:${executionId}`, lockId);

      // Update execution state - map DAG status to ExecutionState status
      const finalStatus = result.status === 'failed' ? 'failed' : 'completed';
      await stateStore.updateExecutionStatus(executionId, finalStatus, {
        completedAt: Date.now(),
      });

      console.log(
        `[DISTRIBUTED_ORCHESTRATOR] Execution ${executionId} completed with status: ${result.status}`
      );

      return result;
    } catch (error) {
      console.error(`[DISTRIBUTED_ORCHESTRATOR] Execution ${executionId} failed:`, error);

      // Update execution state
      await stateStore.updateExecutionStatus(executionId, 'failed', {
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Submit jobs to queue based on dependency order
   */
  private async submitJobsToQueue(
    executionId: string,
    jobs: JobConfig[],
  ): Promise<void> {
    const jobQueue = getJobQueue();
    const stateStore = getStateStore();
    const workerManager = getWorkerManager();

    // Calculate in-degrees for dependency tracking
    const inDegree = new Map<string, number>();

    // Calculate in-degrees
    for (const job of jobs) {
      inDegree.set(job.id, job.dependsOn.length);
    }

    // Find jobs with no dependencies (can start immediately)
    const readyJobs = jobs.filter(job => job.dependsOn.length === 0);

    console.log(
      `[DISTRIBUTED_ORCHESTRATOR] Submitting ${readyJobs.length} initial jobs to queue`
    );

    // Submit initial batch
    for (const job of readyJobs) {
      const requirements = this.getWorkerRequirements(job);
      const selectedWorker = await workerManager.selectWorker(requirements);

      if (!selectedWorker) {
        console.warn(
          `[DISTRIBUTED_ORCHESTRATOR] No suitable worker found for job ${job.id}, queuing without worker assignment`
        );
      }

      const queueJobData: QueueJobData = {
        executionId,
        jobId: job.id,
        jobType: job.type,
        config: job.config,
        priority: this.calculateJobPriority(job),
        maxRetries: job.retryConfig?.maxRetries || 3,
        timeout: job.timeoutMs || this.config.jobTimeoutMs || 600000, // 10 min default
        requiredCapabilities: requirements.capabilities,
        dependencyOutputs: {}, // Outputs from dependency jobs - empty for root jobs
        metadata: {
          workerId: selectedWorker || undefined,
          submittedAt: Date.now(),
          orchestratorId: this.config.orchestratorId,
        },
      };

      const queueJobId = await jobQueue.submitJob(queueJobData);

      // Track job in state store
      await stateStore.addCurrentJob(executionId, job.id);

      // Assign job to worker if selected
      if (selectedWorker) {
        await workerManager.assignJob(selectedWorker, job.id);
      }

      console.log(
        `[DISTRIBUTED_ORCHESTRATOR] Submitted job ${job.id} to queue (queueJobId: ${queueJobId})`
      );
    }
  }

  /**
   * Wait for all jobs to complete
   */
  private async waitForCompletion(
    executionId: string,
    totalJobs: number,
    onJobComplete?: (jobId: string, output: unknown) => void,
    onJobFail?: (jobId: string, error: string) => void,
    onProgress?: (completed: number, total: number) => void
  ): Promise<DAGExecution> {
    const stateStore = getStateStore();
    const startTime = Date.now();
    const pollIntervalMs = parseInt(process.env.DISTRIBUTED_ORCHESTRATOR_POLL_INTERVAL_MS || '1000', 10);

    console.log(`[DISTRIBUTED_ORCHESTRATOR] Waiting for ${totalJobs} jobs to complete (polling every ${pollIntervalMs}ms)...`);

    while (true) {
      // Get current execution state
      const executionState = await stateStore.getExecutionState(executionId);

      if (!executionState) {
        throw new Error(`Execution state not found: ${executionId}`);
      }

      const completed = executionState.completedJobs.length;
      const failed = executionState.failedJobs.length;
      const current = executionState.currentJobs.length;

      // Report progress
      onProgress?.(completed + failed, totalJobs);

      // Check if all jobs are done
      if (completed + failed >= totalJobs) {
        const duration = Date.now() - startTime;
        console.log(
          `[DISTRIBUTED_ORCHESTRATOR] All jobs completed in ${duration}ms (${completed} succeeded, ${failed} failed)`
        );

        // Build DAGExecution result
        const dagExecution: DAGExecution = {
          id: executionId,
          name: executionState.workflowId,
          status: failed > 0 ? 'failed' : 'completed',
          startedAt: new Date(executionState.startedAt),
          completedAt: new Date(),
          jobs: new Map(
            Object.entries(executionState.jobResults).map(([jobId, result]) => [
              jobId,
              {
                jobId,
                status: result.success ? 'completed' : 'failed',
                startedAt: new Date(result.startedAt),
                completedAt: new Date(result.completedAt),
                error: result.error,
                output: result.output,
                attempt: 1,
                logs: [],
              },
            ])
          ),
        };

        return dagExecution;
      }

      console.log(
        `[DISTRIBUTED_ORCHESTRATOR] Progress: ${completed}/${totalJobs} completed, ${failed} failed, ${current} running`
      );

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * Get worker requirements for a job
   */
  private getWorkerRequirements(job: JobConfig): WorkerRequirements {
    const requirements: WorkerRequirements = {
      capabilities: ['cpu'], // Default to CPU
    };

    // Extract requirements from job config
    if (job.config.requireGpu) {
      requirements.capabilities = ['gpu'];
      requirements.requireGpu = true;
    }

    if (job.config.minMemoryGB) {
      requirements.minMemoryGB = job.config.minMemoryGB as number;
      if (requirements.minMemoryGB > 16) {
        requirements.capabilities?.push('high-memory');
      }
    }

    if (job.config.minCpuCores) {
      requirements.minCpuCores = job.config.minCpuCores as number;
    }

    return requirements;
  }

  /**
   * Calculate job priority (1-10, higher = more important)
   */
  private calculateJobPriority(job: JobConfig): number {
    // Priority based on job type and config
    let priority = 5; // Default medium priority

    // Higher priority for critical job types
    if (job.type === 'deployment' || job.type === 'regression-gate') {
      priority = 8;
    } else if (job.type === 'validation') {
      priority = 7;
    } else if (job.type === 'training' || job.type === 'train') {
      priority = 6;
    }

    // Adjust based on explicit priority in config
    if (job.config.priority) {
      priority = Math.min(10, Math.max(1, job.config.priority as number));
    }

    return priority;
  }

  /**
   * Start failover monitoring
   */
  private startFailoverMonitoring(): void {
    console.log(
      `[DISTRIBUTED_ORCHESTRATOR] Starting failover monitoring (interval: ${this.config.failoverCheckIntervalMs}ms)`
    );

    this.failoverIntervalId = setInterval(async () => {
      try {
        await this.checkAndHandleFailedWorkers();
      } catch (error) {
        console.error('[DISTRIBUTED_ORCHESTRATOR] Failover check failed:', error);
      }
    }, this.config.failoverCheckIntervalMs);
  }

  /**
   * Check for failed workers and redistribute jobs
   */
  private async checkAndHandleFailedWorkers(): Promise<void> {
    const workerManager = getWorkerManager();
    const jobQueue = getJobQueue();

    // Detect and cleanup unhealthy workers
    const failedWorkers = await workerManager.detectAndCleanupUnhealthyWorkers();

    if (failedWorkers.size === 0) {
      return;
    }

    console.log(
      `[DISTRIBUTED_ORCHESTRATOR] Detected ${failedWorkers.size} failed worker(s), redistributing jobs...`
    );

    // Redistribute jobs from failed workers
    for (const [workerId, jobIds] of failedWorkers.entries()) {
      console.log(`[DISTRIBUTED_ORCHESTRATOR] Worker ${workerId} failed with ${jobIds.length} job(s)`);

      for (const jobId of jobIds) {
        // Retry the job (will be picked up by another worker)
        try {
          await jobQueue.retryJob(jobId);
          console.log(`[DISTRIBUTED_ORCHESTRATOR] Retried job ${jobId} after worker failure`);
        } catch (error) {
          console.error(
            `[DISTRIBUTED_ORCHESTRATOR] Failed to retry job ${jobId}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Stop failover monitoring
   */
  private stopFailoverMonitoring(): void {
    if (this.failoverIntervalId) {
      clearInterval(this.failoverIntervalId);
      this.failoverIntervalId = null;
      console.log('[DISTRIBUTED_ORCHESTRATOR] Stopped failover monitoring');
    }
  }

  /**
   * Get distributed execution statistics
   */
  async getStats(): Promise<DistributedStats> {
    const workerManager = getWorkerManager();
    const jobQueue = getJobQueue();

    const workerStats = await workerManager.getWorkerStats();
    const queueStats = await jobQueue.getQueueStats();

    return {
      totalWorkers: workerStats.total,
      activeWorkers: workerStats.active + workerStats.idle,
      queuedJobs: queueStats.waiting + queueStats.delayed,
      runningJobs: queueStats.active,
      completedJobs: queueStats.completed,
      failedJobs: queueStats.failed,
      averageJobDuration: 0, // TODO: Calculate from job results
      workerUtilization: workerStats.utilizationPercent,
    };
  }

  /**
   * Pause execution
   */
  async pauseExecution(executionId: string): Promise<boolean> {
    const stateStore = getStateStore();
    return await stateStore.updateExecutionStatus(executionId, 'paused');
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    const stateStore = getStateStore();
    return await stateStore.updateExecutionStatus(executionId, 'running');
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const stateStore = getStateStore();
    const jobQueue = getJobQueue();

    // Update state
    await stateStore.updateExecutionStatus(executionId, 'cancelled');

    // Cancel all queued jobs
    const executionState = await stateStore.getExecutionState(executionId);
    if (executionState) {
      for (const jobId of executionState.currentJobs) {
        await jobQueue.cancelJob(jobId);
      }
    }

    return true;
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<ExecutionState | null> {
    const stateStore = getStateStore();
    return await stateStore.getExecutionState(executionId);
  }

  /**
   * Cleanup and close connections
   */
  async close(): Promise<void> {
    console.log('[DISTRIBUTED_ORCHESTRATOR] Shutting down...');

    this.stopFailoverMonitoring();

    await closeJobQueue();
    await closeWorkerManager();
    await closeStateStore();

    console.log('[DISTRIBUTED_ORCHESTRATOR] Shutdown complete');
  }
}

/**
 * Singleton instance management
 */
let distributedOrchestratorInstance: DistributedOrchestrator | null = null;

export function getDistributedOrchestrator(config?: DistributedConfig): DistributedOrchestrator {
  if (!distributedOrchestratorInstance) {
    if (!config) {
      throw new Error('Distributed orchestrator config required for first initialization');
    }
    distributedOrchestratorInstance = new DistributedOrchestrator(config);
  }
  return distributedOrchestratorInstance;
}

export async function closeDistributedOrchestrator(): Promise<void> {
  if (distributedOrchestratorInstance) {
    await distributedOrchestratorInstance.close();
    distributedOrchestratorInstance = null;
  }
}
