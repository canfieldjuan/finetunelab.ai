/**
 * Worker Manager for Distributed DAG Execution
 * 
 * Manages worker lifecycle, health monitoring, and job assignment.
 * Features:
 * - Worker registration and deregistration
 * - Heartbeat monitoring with automatic failover
 * - Worker capability tracking (CPU, GPU, memory)
 * - Load-based worker selection
 * - Health checking and dead worker detection
 * - Job assignment tracking
 */

import { Redis } from 'ioredis';
import os from 'os';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Worker capabilities
 */
export type WorkerCapability = 'cpu' | 'gpu' | 'high-memory' | 'ssd' | 'network';

/**
 * Worker status
 */
export type WorkerStatus = 'active' | 'idle' | 'busy' | 'unhealthy' | 'offline';

/**
 * Worker registration data
 */
export interface WorkerRegistration {
  workerId: string;
  hostname: string;
  pid: number;
  capabilities: WorkerCapability[];
  maxConcurrency: number; // Max parallel jobs
  currentLoad: number; // Current active jobs (0 to maxConcurrency)
  registeredAt: number; // Timestamp (ms)
  lastHeartbeat: number; // Timestamp (ms)
  status: WorkerStatus;
  metadata: {
    cpuCores: number;
    memoryGB: number;
    gpuCount: number;
    version: string;
    platform: string;
  };
}

/**
 * Worker selection requirements
 */
export interface WorkerRequirements {
  capabilities?: WorkerCapability[];
  minMemoryGB?: number;
  minCpuCores?: number;
  requireGpu?: boolean;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  total: number;
  active: number;
  idle: number;
  busy: number;
  unhealthy: number;
  offline: number;
  totalCapacity: number; // Sum of maxConcurrency
  totalLoad: number; // Sum of currentLoad
  utilizationPercent: number; // (totalLoad / totalCapacity) * 100
}

/**
 * Worker manager configuration
 */
export interface WorkerManagerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  heartbeatTimeoutMs?: number; // Consider worker dead after this time
  heartbeatIntervalMs?: number; // How often workers should send heartbeats
  cleanupIntervalMs?: number; // How often to check for dead workers
}

// ============================================================================
// Constants
// ============================================================================

const WORKER_LOG_PREFIX = '[WORKER_MANAGER]';

const DEFAULT_CONFIG = {
  heartbeatTimeoutMs: 90000, // 90 seconds
  heartbeatIntervalMs: 30000, // 30 seconds
  cleanupIntervalMs: 60000, // 60 seconds
};

const REDIS_KEYS = {
  WORKER: (workerId: string) => `workers:${workerId}`,
  ACTIVE_WORKERS: 'workers:active',
  HEARTBEATS: 'workers:heartbeats',
  ASSIGNMENTS: (workerId: string) => `workers:assignments:${workerId}`,
  ALL_ASSIGNMENTS: 'workers:assignments:*',
} as const;

const WORKER_MESSAGES = {
  REGISTERED: 'Worker registered successfully',
  DEREGISTERED: 'Worker deregistered',
  HEARTBEAT_RECEIVED: 'Heartbeat received',
  HEARTBEAT_MISSED: 'Heartbeat missed - marking worker unhealthy',
  WORKER_NOT_FOUND: 'Worker not found',
  WORKER_OFFLINE: 'Worker marked offline',
  NO_WORKERS_AVAILABLE: 'No workers available matching requirements',
} as const;

// ============================================================================
// Worker Manager
// ============================================================================

/**
 * WorkerManager - Manages distributed worker pool
 * 
 * Responsibilities:
 * - Worker registration and lifecycle
 * - Heartbeat monitoring
 * - Worker selection based on capabilities and load
 * - Health checking and automatic failover
 * - Job assignment tracking
 */
export class WorkerManager {
  private redis: Redis;
  private config: Required<WorkerManagerConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: WorkerManagerConfig) {
    this.config = {
      ...config,
      heartbeatTimeoutMs: config.heartbeatTimeoutMs || DEFAULT_CONFIG.heartbeatTimeoutMs,
      heartbeatIntervalMs: config.heartbeatIntervalMs || DEFAULT_CONFIG.heartbeatIntervalMs,
      cleanupIntervalMs: config.cleanupIntervalMs || DEFAULT_CONFIG.cleanupIntervalMs,
    };

    // Create Redis connection
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    console.log(`${WORKER_LOG_PREFIX} Worker Manager initialized`);
  }

  /**
   * Start background cleanup process
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already started
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.detectAndCleanupUnhealthyWorkers();
      } catch (error) {
        console.error(`${WORKER_LOG_PREFIX} Cleanup failed:`, error);
      }
    }, this.config.cleanupIntervalMs);

    console.log(`${WORKER_LOG_PREFIX} Cleanup process started (interval: ${this.config.cleanupIntervalMs}ms)`);
  }

  /**
   * Stop background cleanup process
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log(`${WORKER_LOG_PREFIX} Cleanup process stopped`);
    }
  }

  /**
   * Register a new worker
   * 
   * @param worker - Worker registration data
   */
  async registerWorker(worker: WorkerRegistration): Promise<void> {
    try {
      const now = Date.now();
      const workerData = {
        ...worker,
        registeredAt: now,
        lastHeartbeat: now,
        status: 'active' as WorkerStatus,
      };

      // Store worker data with TTL (2x heartbeat timeout for safety)
      const ttl = Math.ceil(this.config.heartbeatTimeoutMs * 2 / 1000);
      await this.redis.setex(
        REDIS_KEYS.WORKER(worker.workerId),
        ttl,
        JSON.stringify(workerData)
      );

      // Add to active workers set
      await this.redis.sadd(REDIS_KEYS.ACTIVE_WORKERS, worker.workerId);

      // Record heartbeat timestamp
      await this.redis.zadd(REDIS_KEYS.HEARTBEATS, now, worker.workerId);

      console.log(
        `${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.REGISTERED}: ${worker.workerId}`,
        `(capabilities: ${worker.capabilities.join(', ')}, max concurrency: ${worker.maxConcurrency})`
      );
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to register worker:`, error);
      throw error;
    }
  }

  /**
   * Deregister a worker (graceful shutdown)
   * 
   * @param workerId - Worker ID to deregister
   */
  async deregisterWorker(workerId: string): Promise<void> {
    try {
      await this.redis.del(REDIS_KEYS.WORKER(workerId));
      await this.redis.srem(REDIS_KEYS.ACTIVE_WORKERS, workerId);
      await this.redis.zrem(REDIS_KEYS.HEARTBEATS, workerId);
      await this.redis.del(REDIS_KEYS.ASSIGNMENTS(workerId));

      console.log(`${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.DEREGISTERED}: ${workerId}`);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to deregister worker:`, error);
      throw error;
    }
  }

  /**
   * Record a heartbeat from a worker
   * 
   * @param workerId - Worker ID
   * @param currentLoad - Current number of active jobs
   */
  async heartbeat(workerId: string, currentLoad?: number): Promise<void> {
    try {
      // Get worker data
      const workerKey = REDIS_KEYS.WORKER(workerId);
      const workerData = await this.redis.get(workerKey);

      if (!workerData) {
        console.warn(`${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.WORKER_NOT_FOUND}: ${workerId}`);
        return;
      }

      const worker: WorkerRegistration = JSON.parse(workerData);
      const now = Date.now();

      // Update worker data
      worker.lastHeartbeat = now;
      if (currentLoad !== undefined) {
        worker.currentLoad = currentLoad;
      }

      // Update status based on load
      if (worker.currentLoad === 0) {
        worker.status = 'idle';
      } else if (worker.currentLoad >= worker.maxConcurrency) {
        worker.status = 'busy';
      } else {
        worker.status = 'active';
      }

      // Refresh worker data with TTL
      const ttl = Math.ceil(this.config.heartbeatTimeoutMs * 2 / 1000);
      await this.redis.setex(workerKey, ttl, JSON.stringify(worker));

      // Update heartbeat timestamp
      await this.redis.zadd(REDIS_KEYS.HEARTBEATS, now, workerId);

      console.log(
        `${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.HEARTBEAT_RECEIVED}: ${workerId}`,
        `(load: ${worker.currentLoad}/${worker.maxConcurrency}, status: ${worker.status})`
      );
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to process heartbeat:`, error);
      throw error;
    }
  }

  /**
   * Get worker information
   * 
   * @param workerId - Worker ID to retrieve
   * @returns Worker data or null if not found
   */
  async getWorker(workerId: string): Promise<WorkerRegistration | null> {
    try {
      const workerData = await this.redis.get(REDIS_KEYS.WORKER(workerId));
      if (!workerData) {
        return null;
      }
      return JSON.parse(workerData);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to get worker:`, error);
      return null;
    }
  }

  /**
   * Get all active workers
   * 
   * @returns Array of worker registrations
   */
  async getAllWorkers(): Promise<WorkerRegistration[]> {
    try {
      const workerIds = await this.redis.smembers(REDIS_KEYS.ACTIVE_WORKERS);
      
      const workers = await Promise.all(
        workerIds.map(id => this.getWorker(id))
      );

      return workers.filter((w): w is WorkerRegistration => w !== null);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to get all workers:`, error);
      return [];
    }
  }

  /**
   * Select a worker based on requirements and load balancing
   * 
   * @param requirements - Worker capability requirements
   * @returns Selected worker ID or null if none available
   */
  async selectWorker(requirements?: WorkerRequirements): Promise<string | null> {
    try {
      const workers = await this.getAllWorkers();

      if (workers.length === 0) {
        console.warn(`${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.NO_WORKERS_AVAILABLE}`);
        return null;
      }

      // Filter by requirements
      let eligible = workers.filter(w => 
        w.status === 'active' || w.status === 'idle'
      );

      if (requirements?.capabilities) {
        eligible = eligible.filter(w =>
          requirements.capabilities!.every(cap => w.capabilities.includes(cap))
        );
      }

      if (requirements?.minMemoryGB) {
        eligible = eligible.filter(w =>
          w.metadata.memoryGB >= requirements.minMemoryGB!
        );
      }

      if (requirements?.minCpuCores) {
        eligible = eligible.filter(w =>
          w.metadata.cpuCores >= requirements.minCpuCores!
        );
      }

      if (requirements?.requireGpu) {
        eligible = eligible.filter(w =>
          w.metadata.gpuCount > 0
        );
      }

      if (eligible.length === 0) {
        console.warn(
          `${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.NO_WORKERS_AVAILABLE}`,
          'matching requirements:',
          requirements
        );
        return null;
      }

      // Sort by load (lowest load first) and available capacity
      eligible.sort((a, b) => {
        const aUtilization = a.currentLoad / a.maxConcurrency;
        const bUtilization = b.currentLoad / b.maxConcurrency;
        return aUtilization - bUtilization;
      });

      // Select worker with lowest utilization
      const selectedWorker = eligible[0];
      
      console.log(
        `${WORKER_LOG_PREFIX} Selected worker: ${selectedWorker.workerId}`,
        `(load: ${selectedWorker.currentLoad}/${selectedWorker.maxConcurrency})`
      );

      return selectedWorker.workerId;
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to select worker:`, error);
      return null;
    }
  }

  /**
   * Assign a job to a worker
   * 
   * @param workerId - Worker ID
   * @param jobId - Job ID to assign
   */
  async assignJob(workerId: string, jobId: string): Promise<void> {
    try {
      await this.redis.sadd(REDIS_KEYS.ASSIGNMENTS(workerId), jobId);
      console.log(`${WORKER_LOG_PREFIX} Assigned job ${jobId} to worker ${workerId}`);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to assign job:`, error);
      throw error;
    }
  }

  /**
   * Unassign a job from a worker
   * 
   * @param workerId - Worker ID
   * @param jobId - Job ID to unassign
   */
  async unassignJob(workerId: string, jobId: string): Promise<void> {
    try {
      await this.redis.srem(REDIS_KEYS.ASSIGNMENTS(workerId), jobId);
      console.log(`${WORKER_LOG_PREFIX} Unassigned job ${jobId} from worker ${workerId}`);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to unassign job:`, error);
      throw error;
    }
  }

  /**
   * Get jobs assigned to a worker
   * 
   * @param workerId - Worker ID
   * @returns Array of job IDs
   */
  async getAssignedJobs(workerId: string): Promise<string[]> {
    try {
      return await this.redis.smembers(REDIS_KEYS.ASSIGNMENTS(workerId));
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to get assigned jobs:`, error);
      return [];
    }
  }

  /**
   * Detect unhealthy workers (missed heartbeats)
   * 
   * @returns Array of unhealthy worker IDs
   */
  async detectUnhealthyWorkers(): Promise<string[]> {
    try {
      const now = Date.now();
      const threshold = now - this.config.heartbeatTimeoutMs;

      // Get workers with heartbeat older than threshold
      const unhealthy = await this.redis.zrangebyscore(
        REDIS_KEYS.HEARTBEATS,
        0,
        threshold
      );

      if (unhealthy.length > 0) {
        console.warn(
          `${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.HEARTBEAT_MISSED}:`,
          unhealthy.join(', ')
        );
      }

      return unhealthy;
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to detect unhealthy workers:`, error);
      return [];
    }
  }

  /**
   * Mark a worker as offline and clean up
   * 
   * @param workerId - Worker ID to mark offline
   * @returns Array of job IDs that were assigned to this worker
   */
  async markWorkerOffline(workerId: string): Promise<string[]> {
    try {
      // Get assigned jobs before cleanup
      const assignedJobs = await this.getAssignedJobs(workerId);

      // Remove from active workers
      await this.redis.srem(REDIS_KEYS.ACTIVE_WORKERS, workerId);
      await this.redis.del(REDIS_KEYS.WORKER(workerId));
      await this.redis.zrem(REDIS_KEYS.HEARTBEATS, workerId);
      await this.redis.del(REDIS_KEYS.ASSIGNMENTS(workerId));

      console.log(
        `${WORKER_LOG_PREFIX} ${WORKER_MESSAGES.WORKER_OFFLINE}: ${workerId}`,
        assignedJobs.length > 0 ? `(${assignedJobs.length} jobs need reassignment)` : ''
      );

      return assignedJobs;
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to mark worker offline:`, error);
      return [];
    }
  }

  /**
   * Detect unhealthy workers and clean them up
   * 
   * @returns Map of worker IDs to their assigned jobs
   */
  async detectAndCleanupUnhealthyWorkers(): Promise<Map<string, string[]>> {
    const unhealthyWorkers = await this.detectUnhealthyWorkers();
    const jobsToReassign = new Map<string, string[]>();

    for (const workerId of unhealthyWorkers) {
      const jobs = await this.markWorkerOffline(workerId);
      if (jobs.length > 0) {
        jobsToReassign.set(workerId, jobs);
      }
    }

    return jobsToReassign;
  }

  /**
   * Get worker statistics
   * 
   * @returns Worker pool statistics
   */
  async getWorkerStats(): Promise<WorkerStats> {
    try {
      const workers = await this.getAllWorkers();

      const stats: WorkerStats = {
        total: workers.length,
        active: 0,
        idle: 0,
        busy: 0,
        unhealthy: 0,
        offline: 0,
        totalCapacity: 0,
        totalLoad: 0,
        utilizationPercent: 0,
      };

      for (const worker of workers) {
        switch (worker.status) {
          case 'active':
            stats.active++;
            break;
          case 'idle':
            stats.idle++;
            break;
          case 'busy':
            stats.busy++;
            break;
          case 'unhealthy':
            stats.unhealthy++;
            break;
        }

        stats.totalCapacity += worker.maxConcurrency;
        stats.totalLoad += worker.currentLoad;
      }

      stats.utilizationPercent = stats.totalCapacity > 0
        ? (stats.totalLoad / stats.totalCapacity) * 100
        : 0;

      return stats;
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to get worker stats:`, error);
      throw error;
    }
  }

  /**
   * Get worker count by capability
   * 
   * @returns Map of capabilities to worker counts
   */
  async getWorkersByCapability(): Promise<Map<WorkerCapability, number>> {
    const workers = await this.getAllWorkers();
    const counts = new Map<WorkerCapability, number>();

    const allCapabilities: WorkerCapability[] = ['cpu', 'gpu', 'high-memory', 'ssd', 'network'];
    
    for (const cap of allCapabilities) {
      counts.set(cap, 0);
    }

    for (const worker of workers) {
      for (const cap of worker.capabilities) {
        counts.set(cap, (counts.get(cap) || 0) + 1);
      }
    }

    return counts;
  }

  /**
   * Check if worker manager is healthy (can connect to Redis)
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Health check failed:`, error);
      return false;
    }
  }

  /**
   * Close worker manager and clean up resources
   */
  async close(): Promise<void> {
    try {
      this.stopCleanup();
      await this.redis.quit();
      console.log(`${WORKER_LOG_PREFIX} Worker Manager closed successfully`);
    } catch (error) {
      console.error(`${WORKER_LOG_PREFIX} Failed to close worker manager:`, error);
      throw error;
    }
  }

  /**
   * Get recommended heartbeat interval
   */
  getHeartbeatInterval(): number {
    return this.config.heartbeatIntervalMs;
  }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let workerManagerInstance: WorkerManager | null = null;

/**
 * Get or create singleton WorkerManager instance
 * 
 * @param config - Worker manager configuration (required on first call)
 * @returns WorkerManager instance
 */
export function getWorkerManager(config?: WorkerManagerConfig): WorkerManager {
  if (!workerManagerInstance) {
    if (!config) {
      throw new Error('WorkerManager not initialized. Provide config on first call.');
    }
    workerManagerInstance = new WorkerManager(config);
  }
  return workerManagerInstance;
}

/**
 * Close and reset singleton instance
 */
export async function closeWorkerManager(): Promise<void> {
  if (workerManagerInstance) {
    await workerManagerInstance.close();
    workerManagerInstance = null;
  }
}

// ============================================================================
// Worker Utilities
// ============================================================================

/**
 * Generate a unique worker ID
 */
export function generateWorkerId(): string {
  const hostname = os.hostname();
  const pid = process.pid;
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `worker_${hostname}_${pid}_${timestamp}_${random}`;
}

/**
 * Detect worker capabilities from system
 */
export function detectCapabilities(): WorkerCapability[] {
  const capabilities: WorkerCapability[] = ['cpu'];

  // Check for high memory (>16GB)
  const totalMemGB = os.totalmem() / (1024 ** 3);
  if (totalMemGB > 16) {
    capabilities.push('high-memory');
  }

  // Check for GPU (would need actual GPU detection library)
  if (process.env.GPU_ENABLED === 'true') {
    capabilities.push('gpu');
  }

  // Check for SSD (simplified - would need actual disk check)
  if (process.env.SSD_STORAGE === 'true') {
    capabilities.push('ssd');
  }

  // Check for high-speed network (simplified)
  if (process.env.HIGH_SPEED_NETWORK === 'true') {
    capabilities.push('network');
  }

  return capabilities;
}

/**
 * Get worker metadata from system
 */
export function getWorkerMetadata(): WorkerRegistration['metadata'] {
  return {
    cpuCores: os.cpus().length,
    memoryGB: Math.round((os.totalmem() / (1024 ** 3)) * 100) / 100,
    gpuCount: process.env.GPU_COUNT ? parseInt(process.env.GPU_COUNT) : 0,
    version: process.env.WORKER_VERSION || '1.0.0',
    platform: `${os.platform()}-${os.arch()}`,
  };
}
