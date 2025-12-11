/**
 * Job Queue Manager using BullMQ
 * 
 * Provides distributed job queue functionality for DAG orchestration.
 * Features:
 * - Priority-based job queuing
 * - Automatic retry with exponential backoff
 * - Job status tracking and monitoring
 * - Dead letter queue for failed jobs
 * - Queue statistics and health metrics
 */

import { Queue, QueueEvents, Job } from 'bullmq';
import { Redis } from 'ioredis';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Job data structure sent to the queue
 */
export interface QueueJobData {
  executionId: string;
  jobId: string;
  jobType: string;
  config: Record<string, unknown>;
  dependencyOutputs: Record<string, unknown>;
  priority: number; // 1-10 (10 = highest priority)
  maxRetries: number;
  timeout: number; // milliseconds
  requiredCapabilities?: string[]; // e.g., ['gpu', 'high-memory']
  metadata?: Record<string, unknown>;
}

/**
 * Job result structure returned from workers
 */
export interface QueueJobResult {
  success: boolean;
  output?: unknown;
  error?: string;
  logs?: string[];
  metadata?: {
    workerId: string;
    executionTime: number;
    memoryUsed: number;
    cpuUsed?: number;
  };
}

/**
 * Queue statistics
 */
export interface QueueStats {
  waiting: number; // Jobs waiting to be processed
  active: number; // Jobs currently being processed
  completed: number; // Successfully completed jobs
  failed: number; // Failed jobs
  delayed: number; // Jobs scheduled for future execution
  paused: boolean; // Queue pause status
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queueName?: string;
  defaultJobOptions?: {
    attempts?: number;
    backoffDelay?: number;
    backoffMultiplier?: number;
    removeOnComplete?: number | boolean;
    removeOnFail?: number | boolean;
  };
  limiter?: {
    max: number; // Max jobs per duration
    duration: number; // Duration in milliseconds
  };
}

/**
 * Job status type
 */
export type JobStatus = 
  | 'waiting' 
  | 'active' 
  | 'completed' 
  | 'failed' 
  | 'delayed' 
  | 'paused'
  | 'not-found';

// ============================================================================
// Constants
// ============================================================================

const QUEUE_LOG_PREFIX = '[JOB_QUEUE]';

const DEFAULT_QUEUE_CONFIG: Partial<QueueConfig> = {
  queueName: 'dag-jobs',
  defaultJobOptions: {
    attempts: 3,
    backoffDelay: 5000, // 5 seconds
    backoffMultiplier: 2, // Exponential backoff: 5s, 10s, 20s
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000, // Keep last 1000 failed jobs for debugging
  },
  limiter: {
    max: 100, // Max 100 jobs per second
    duration: 1000,
  },
};

const QUEUE_MESSAGES = {
  INIT_SUCCESS: 'Job queue initialized successfully',
  INIT_ERROR: 'Failed to initialize job queue',
  JOB_SUBMITTED: 'Job submitted to queue',
  JOB_NOT_FOUND: 'Job not found in queue',
  JOB_CANCELLED: 'Job cancelled successfully',
  QUEUE_PAUSED: 'Queue paused',
  QUEUE_RESUMED: 'Queue resumed',
  QUEUE_DRAINED: 'Queue drained',
  CONNECTION_ERROR: 'Redis connection error',
} as const;

// ============================================================================
// Job Queue Manager
// ============================================================================

/**
 * JobQueue - Manages distributed job queue using BullMQ
 * 
 * Responsibilities:
 * - Job submission with priority handling
 * - Job status tracking
 * - Queue statistics and monitoring
 * - Job lifecycle management (cancel, retry, remove)
 */
export class JobQueue {
  private queue: Queue<QueueJobData, QueueJobResult>;
  private queueEvents: QueueEvents;
  private redis: Redis;
  private config: QueueConfig;
  private queueName: string;

  constructor(config: QueueConfig) {
    this.config = config;
    this.queueName = config.queueName || DEFAULT_QUEUE_CONFIG.queueName!;

    // Create Redis connection
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false, // Required for BullMQ
    });

    // Create BullMQ queue
    this.queue = new Queue(this.queueName, {
      connection: this.redis,
      defaultJobOptions: {
        attempts: config.defaultJobOptions?.attempts || DEFAULT_QUEUE_CONFIG.defaultJobOptions!.attempts,
        backoff: {
          type: 'exponential',
          delay: config.defaultJobOptions?.backoffDelay || DEFAULT_QUEUE_CONFIG.defaultJobOptions!.backoffDelay,
        },
        removeOnComplete: config.defaultJobOptions?.removeOnComplete ?? DEFAULT_QUEUE_CONFIG.defaultJobOptions!.removeOnComplete,
        removeOnFail: config.defaultJobOptions?.removeOnFail ?? DEFAULT_QUEUE_CONFIG.defaultJobOptions!.removeOnFail,
      },
    }) as Queue<QueueJobData, QueueJobResult>;

    // Create queue events listener for monitoring
    this.queueEvents = new QueueEvents(this.queueName, {
      connection: this.redis.duplicate(),
    });

    this.setupEventListeners();

    console.log(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.INIT_SUCCESS}: ${this.queueName}`);
  }

  /**
   * Set up event listeners for queue monitoring
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      console.log(`${QUEUE_LOG_PREFIX} Job completed: ${jobId}`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`${QUEUE_LOG_PREFIX} Job failed: ${jobId}, reason: ${failedReason}`);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`${QUEUE_LOG_PREFIX} Job progress: ${jobId}`, data);
    });

    this.queueEvents.on('error', (error) => {
      console.error(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.CONNECTION_ERROR}:`, error);
    });
  }

  /**
   * Submit a job to the queue
   * 
   * @param jobData - Job configuration and data
   * @returns Job ID in the queue
   */
  async submitJob(jobData: QueueJobData): Promise<string> {
    try {
      const queueJob = await this.queue.add(
        jobData.jobId,
        jobData,
        {
          jobId: `${jobData.executionId}_${jobData.jobId}`,
          priority: 11 - jobData.priority, // BullMQ: lower number = higher priority
          attempts: jobData.maxRetries,
        }
      );

      console.log(
        `${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.JOB_SUBMITTED}: ${queueJob.id}`,
        `(priority: ${jobData.priority}, type: ${jobData.jobType})`
      );

      return queueJob.id as string;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to submit job:`, error);
      throw error;
    }
  }

  /**
   * Submit multiple jobs to the queue in bulk
   * More efficient than individual submissions
   * 
   * @param jobs - Array of job data
   * @returns Array of job IDs
   */
  async submitJobsBulk(jobs: QueueJobData[]): Promise<string[]> {
    try {
      const queueJobs = await this.queue.addBulk(
        jobs.map(jobData => ({
          name: jobData.jobId,
          data: jobData,
          opts: {
            jobId: `${jobData.executionId}_${jobData.jobId}`,
            priority: 11 - jobData.priority,
            attempts: jobData.maxRetries,
            timeout: jobData.timeout,
          },
        }))
      );

      console.log(
        `${QUEUE_LOG_PREFIX} Bulk submitted ${queueJobs.length} jobs`
      );

      return queueJobs.map(job => job.id as string);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to bulk submit jobs:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   * 
   * @param jobId - Job ID to check
   * @returns Current job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return 'not-found';
      }

      const state = await job.getState();
      return state as JobStatus;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to get job status:`, error);
      return 'not-found';
    }
  }

  /**
   * Get detailed job information
   * 
   * @param jobId - Job ID to retrieve
   * @returns Job object with full details or null
   */
  async getJob(jobId: string): Promise<Job<QueueJobData, QueueJobResult> | null> {
    try {
      const job = await this.queue.getJob(jobId);
      return job || null;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to get job:`, error);
      return null;
    }
  }

  /**
   * Get job result (for completed jobs)
   * 
   * @param jobId - Job ID to retrieve result from
   * @returns Job result or null if not completed
   */
  async getJobResult(jobId: string): Promise<QueueJobResult | null> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        return null;
      }

      const state = await job.getState();
      if (state !== 'completed') {
        return null;
      }

      return job.returnvalue;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to get job result:`, error);
      return null;
    }
  }

  /**
   * Cancel a job (remove from queue if not started)
   * 
   * @param jobId - Job ID to cancel
   * @returns True if cancelled successfully
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        console.warn(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.JOB_NOT_FOUND}: ${jobId}`);
        return false;
      }

      await job.remove();
      console.log(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.JOB_CANCELLED}: ${jobId}`);
      return true;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to cancel job:`, error);
      return false;
    }
  }

  /**
   * Retry a failed job
   * 
   * @param jobId - Job ID to retry
   * @returns True if retry initiated successfully
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.queue.getJob(jobId);
      
      if (!job) {
        console.warn(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.JOB_NOT_FOUND}: ${jobId}`);
        return false;
      }

      await job.retry();
      console.log(`${QUEUE_LOG_PREFIX} Job retry initiated: ${jobId}`);
      return true;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to retry job:`, error);
      return false;
    }
  }

  /**
   * Get queue statistics
   * 
   * @returns Current queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      const isPaused = await this.queue.isPaused();

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
      };
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to get queue stats:`, error);
      throw error;
    }
  }

  /**
   * Get jobs in a specific state
   * 
   * @param state - Job state to filter by
   * @param start - Start index (for pagination)
   * @param end - End index (for pagination)
   * @returns Array of jobs in the specified state
   */
  async getJobs(
    state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    start = 0,
    end = 100
  ): Promise<Job<QueueJobData, QueueJobResult>[]> {
    try {
      return await this.queue.getJobs([state], start, end);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to get jobs:`, error);
      return [];
    }
  }

  /**
   * Pause the queue (stop processing new jobs)
   */
  async pause(): Promise<void> {
    try {
      await this.queue.pause();
      console.log(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.QUEUE_PAUSED}`);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to pause queue:`, error);
      throw error;
    }
  }

  /**
   * Resume the queue (start processing jobs again)
   */
  async resume(): Promise<void> {
    try {
      await this.queue.resume();
      console.log(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.QUEUE_RESUMED}`);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to resume queue:`, error);
      throw error;
    }
  }

  /**
   * Drain the queue (remove all waiting jobs)
   * 
   * @param delayed - Also remove delayed jobs
   */
  async drain(delayed = false): Promise<void> {
    try {
      await this.queue.drain(delayed);
      console.log(`${QUEUE_LOG_PREFIX} ${QUEUE_MESSAGES.QUEUE_DRAINED}`);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to drain queue:`, error);
      throw error;
    }
  }

  /**
   * Clean old jobs from the queue
   * 
   * @param grace - Grace period in milliseconds
   * @param limit - Max number of jobs to clean
   * @param type - Job status to clean
   */
  async clean(
    grace: number,
    limit: number,
    type: 'completed' | 'failed' = 'completed'
  ): Promise<string[]> {
    try {
      const jobs = await this.queue.clean(grace, limit, type);
      console.log(`${QUEUE_LOG_PREFIX} Cleaned ${jobs.length} ${type} jobs`);
      return jobs;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to clean queue:`, error);
      return [];
    }
  }

  /**
   * Close the queue and clean up resources
   */
  async close(): Promise<void> {
    try {
      await this.queueEvents.close();
      await this.queue.close();
      await this.redis.quit();
      console.log(`${QUEUE_LOG_PREFIX} Queue closed successfully`);
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Failed to close queue:`, error);
      throw error;
    }
  }

  /**
   * Get queue name
   */
  getQueueName(): string {
    return this.queueName;
  }

  /**
   * Check if queue is healthy (can connect to Redis)
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error(`${QUEUE_LOG_PREFIX} Health check failed:`, error);
      return false;
    }
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let queueInstance: JobQueue | null = null;

/**
 * Get or create singleton JobQueue instance
 * 
 * @param config - Queue configuration (required on first call)
 * @returns JobQueue instance
 */
export function getJobQueue(config?: QueueConfig): JobQueue {
  if (!queueInstance) {
    if (!config) {
      throw new Error('JobQueue not initialized. Provide config on first call.');
    }
    queueInstance = new JobQueue(config);
  }
  return queueInstance;
}

/**
 * Close and reset singleton instance
 */
export async function closeJobQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}
