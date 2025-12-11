/**
 * External State Store for Distributed Execution
 * 
 * Provides Redis-backed state management for distributed DAG execution with:
 * - Execution state tracking (move from in-memory to distributed)
 * - Distributed locking for concurrent access (Lua scripts)
 * - State synchronization across orchestrator instances
 * - Checkpoint integration for pause/resume
 * - Job metadata and result storage
 */

import Redis from 'ioredis';

/**
 * Execution state in distributed store
 */
export interface ExecutionState {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  currentJobs: string[]; // Job IDs currently executing
  completedJobs: string[]; // Job IDs that finished
  failedJobs: string[]; // Job IDs that failed
  jobResults: Record<string, JobResult>; // Job ID -> result
  checkpointId?: string; // Latest checkpoint for this execution
  metadata: Record<string, unknown>;
}

/**
 * Job result stored in state
 */
export interface JobResult {
  jobId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  startedAt: number;
  completedAt: number;
  workerId?: string;
  executionTime?: number;
}

/**
 * Distributed lock information
 */
export interface LockInfo {
  lockId: string;
  owner: string;
  acquiredAt: number;
  expiresAt: number;
  resource: string;
}

/**
 * State store configuration
 */
export interface StateStoreConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  lockTTL?: number; // Lock time-to-live in milliseconds (default: 30s)
  stateTTL?: number; // State expiration in seconds (default: 7 days)
}

/**
 * External state store for distributed DAG execution
 */
export class StateStore {
  private redis: Redis;
  private lockTTL: number;
  private stateTTL: number;

  constructor(config: StateStoreConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });

    this.lockTTL = config.lockTTL || 30000; // 30 seconds
    this.stateTTL = config.stateTTL || 7 * 24 * 60 * 60; // 7 days

    console.log(`[STATE_STORE] State Store initialized (lockTTL: ${this.lockTTL}ms, stateTTL: ${this.stateTTL}s)`);
  }

  /**
   * Acquire distributed lock using Lua script (atomic)
   */
  async acquireLock(resource: string, owner: string, ttlMs?: number): Promise<string | null> {
    const lockKey = `locks:${resource}`;
    const lockId = `${owner}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ttl = ttlMs || this.lockTTL;
    const expiresAt = Date.now() + ttl;

    // Lua script for atomic lock acquisition
    const script = `
      local lockKey = KEYS[1]
      local lockId = ARGV[1]
      local owner = ARGV[2]
      local expiresAt = ARGV[3]
      local ttl = ARGV[4]
      
      -- Check if lock exists
      local existing = redis.call('GET', lockKey)
      if existing then
        return nil  -- Lock already held
      end
      
      -- Acquire lock
      local lockInfo = cjson.encode({
        lockId = lockId,
        owner = owner,
        acquiredAt = tonumber(ARGV[5]),
        expiresAt = tonumber(expiresAt),
        resource = ARGV[6]
      })
      redis.call('SET', lockKey, lockInfo, 'PX', ttl)
      return lockId
    `;

    try {
      const result = await this.redis.eval(
        script,
        1,
        lockKey,
        lockId,
        owner,
        expiresAt.toString(),
        ttl.toString(),
        Date.now().toString(),
        resource
      );

      if (result) {
        console.log(`[STATE_STORE] Lock acquired: ${resource} by ${owner} (lockId: ${lockId})`);
        return lockId as string;
      }

      console.log(`[STATE_STORE] Lock acquisition failed: ${resource} (already held)`);
      return null;
    } catch (error) {
      console.error(`[STATE_STORE] Error acquiring lock for ${resource}:`, error);
      throw error;
    }
  }

  /**
   * Release distributed lock (atomic)
   */
  async releaseLock(resource: string, lockId: string): Promise<boolean> {
    const lockKey = `locks:${resource}`;

    // Lua script for atomic lock release (verify ownership)
    const script = `
      local lockKey = KEYS[1]
      local expectedLockId = ARGV[1]
      
      -- Get current lock
      local lockInfo = redis.call('GET', lockKey)
      if not lockInfo then
        return 0  -- Lock doesn't exist
      end
      
      -- Parse lock info
      local lock = cjson.decode(lockInfo)
      if lock.lockId ~= expectedLockId then
        return 0  -- Wrong lock ID
      end
      
      -- Release lock
      redis.call('DEL', lockKey)
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, lockKey, lockId);

      if (result === 1) {
        console.log(`[STATE_STORE] Lock released: ${resource} (lockId: ${lockId})`);
        return true;
      }

      console.log(`[STATE_STORE] Lock release failed: ${resource} (lockId mismatch or not held)`);
      return false;
    } catch (error) {
      console.error(`[STATE_STORE] Error releasing lock for ${resource}:`, error);
      throw error;
    }
  }

  /**
   * Extend lock TTL (keep-alive)
   */
  async extendLock(resource: string, lockId: string, extensionMs: number): Promise<boolean> {
    const lockKey = `locks:${resource}`;

    const script = `
      local lockKey = KEYS[1]
      local expectedLockId = ARGV[1]
      local extension = ARGV[2]
      
      local lockInfo = redis.call('GET', lockKey)
      if not lockInfo then
        return 0
      end
      
      local lock = cjson.decode(lockInfo)
      if lock.lockId ~= expectedLockId then
        return 0
      end
      
      -- Extend expiration
      lock.expiresAt = lock.expiresAt + tonumber(extension)
      redis.call('SET', lockKey, cjson.encode(lock), 'PX', extension)
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, lockKey, lockId, extensionMs.toString());
      return result === 1;
    } catch (error) {
      console.error(`[STATE_STORE] Error extending lock for ${resource}:`, error);
      throw error;
    }
  }

  /**
   * Get lock information
   */
  async getLock(resource: string): Promise<LockInfo | null> {
    const lockKey = `locks:${resource}`;
    const lockInfo = await this.redis.get(lockKey);

    if (!lockInfo) {
      return null;
    }

    return JSON.parse(lockInfo);
  }

  /**
   * Store execution state
   */
  async setExecutionState(state: ExecutionState): Promise<void> {
    const key = `executions:${state.executionId}`;
    const value = JSON.stringify(state);

    try {
      await this.redis.set(key, value, 'EX', this.stateTTL);
      console.log(`[STATE_STORE] Execution state stored: ${state.executionId} (status: ${state.status})`);
    } catch (error) {
      console.error(`[STATE_STORE] Error storing execution state for ${state.executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get execution state
   */
  async getExecutionState(executionId: string): Promise<ExecutionState | null> {
    const key = `executions:${executionId}`;

    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      console.error(`[STATE_STORE] Error retrieving execution state for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Update execution status atomically
   */
  async updateExecutionStatus(
    executionId: string,
    status: ExecutionState['status'],
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const key = `executions:${executionId}`;

    const script = `
      local key = KEYS[1]
      local newStatus = ARGV[1]
      local ttl = ARGV[2]
      local metadata = ARGV[3]
      
      local state = redis.call('GET', key)
      if not state then
        return 0
      end
      
      local exec = cjson.decode(state)
      exec.status = newStatus
      
      if metadata ~= '' then
        local meta = cjson.decode(metadata)
        for k, v in pairs(meta) do
          exec.metadata[k] = v
        end
      end
      
      if newStatus == 'completed' or newStatus == 'failed' or newStatus == 'cancelled' then
        exec.completedAt = tonumber(ARGV[4])
      end
      
      redis.call('SET', key, cjson.encode(exec), 'EX', ttl)
      return 1
    `;

    try {
      const result = await this.redis.eval(
        script,
        1,
        key,
        status,
        this.stateTTL.toString(),
        metadata ? JSON.stringify(metadata) : '',
        Date.now().toString()
      );

      if (result === 1) {
        console.log(`[STATE_STORE] Execution status updated: ${executionId} -> ${status}`);
        return true;
      }

      console.log(`[STATE_STORE] Execution status update failed: ${executionId} (not found)`);
      return false;
    } catch (error) {
      console.error(`[STATE_STORE] Error updating execution status for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Add job to current jobs (atomic)
   */
  async addCurrentJob(executionId: string, jobId: string): Promise<boolean> {
    const key = `executions:${executionId}`;

    const script = `
      local key = KEYS[1]
      local jobId = ARGV[1]
      local ttl = ARGV[2]
      
      local state = redis.call('GET', key)
      if not state then
        return 0
      end
      
      local exec = cjson.decode(state)
      table.insert(exec.currentJobs, jobId)
      
      redis.call('SET', key, cjson.encode(exec), 'EX', ttl)
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, key, jobId, this.stateTTL.toString());
      return result === 1;
    } catch (error) {
      console.error(`[STATE_STORE] Error adding current job for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Move job from current to completed/failed (atomic)
   */
  async completeJob(executionId: string, jobId: string, result: JobResult): Promise<boolean> {
    const key = `executions:${executionId}`;

    const script = `
      local key = KEYS[1]
      local jobId = ARGV[1]
      local resultJson = ARGV[2]
      local ttl = ARGV[3]
      
      local state = redis.call('GET', key)
      if not state then
        return 0
      end
      
      local exec = cjson.decode(state)
      local result = cjson.decode(resultJson)
      
      -- Remove from currentJobs
      local newCurrentJobs = {}
      for _, id in ipairs(exec.currentJobs) do
        if id ~= jobId then
          table.insert(newCurrentJobs, id)
        end
      end
      exec.currentJobs = newCurrentJobs
      
      -- Add to completed or failed
      if result.success then
        table.insert(exec.completedJobs, jobId)
      else
        table.insert(exec.failedJobs, jobId)
      end
      
      -- Store result
      exec.jobResults[jobId] = result
      
      redis.call('SET', key, cjson.encode(exec), 'EX', ttl)
      return 1
    `;

    try {
      const resultJson = JSON.stringify(result);
      const scriptResult = await this.redis.eval(script, 1, key, jobId, resultJson, this.stateTTL.toString());

      if (scriptResult === 1) {
        console.log(
          `[STATE_STORE] Job completed: ${jobId} for ${executionId} (success: ${result.success})`
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[STATE_STORE] Error completing job ${jobId} for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Link execution to checkpoint
   */
  async setCheckpoint(executionId: string, checkpointId: string): Promise<boolean> {
    const key = `executions:${executionId}`;

    const script = `
      local key = KEYS[1]
      local checkpointId = ARGV[1]
      local ttl = ARGV[2]
      
      local state = redis.call('GET', key)
      if not state then
        return 0
      end
      
      local exec = cjson.decode(state)
      exec.checkpointId = checkpointId
      
      redis.call('SET', key, cjson.encode(exec), 'EX', ttl)
      return 1
    `;

    try {
      const result = await this.redis.eval(script, 1, key, checkpointId, this.stateTTL.toString());

      if (result === 1) {
        console.log(`[STATE_STORE] Checkpoint set: ${checkpointId} for ${executionId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[STATE_STORE] Error setting checkpoint for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Get all executions for a workflow
   */
  async getWorkflowExecutions(workflowId: string): Promise<ExecutionState[]> {
    try {
      const keys = await this.redis.keys(`executions:*`);
      const executions: ExecutionState[] = [];

      for (const key of keys) {
        const value = await this.redis.get(key);
        if (value) {
          const state = JSON.parse(value);
          if (state.workflowId === workflowId) {
            executions.push(state);
          }
        }
      }

      return executions;
    } catch (error) {
      console.error(`[STATE_STORE] Error getting workflow executions for ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Delete execution state
   */
  async deleteExecutionState(executionId: string): Promise<boolean> {
    const key = `executions:${executionId}`;

    try {
      const result = await this.redis.del(key);
      console.log(`[STATE_STORE] Execution state deleted: ${executionId}`);
      return result > 0;
    } catch (error) {
      console.error(`[STATE_STORE] Error deleting execution state for ${executionId}:`, error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('[STATE_STORE] Health check failed:', error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    console.log('[STATE_STORE] State Store closed successfully');
  }
}

// Singleton instance management
let stateStoreInstance: StateStore | null = null;

/**
 * Get or create state store singleton
 */
export function getStateStore(config?: StateStoreConfig): StateStore {
  if (!stateStoreInstance) {
    if (!config) {
      throw new Error('State store config required for first initialization');
    }
    stateStoreInstance = new StateStore(config);
  }
  return stateStoreInstance;
}

/**
 * Close and reset state store singleton
 */
export async function closeStateStore(): Promise<void> {
  if (stateStoreInstance) {
    await stateStoreInstance.close();
    stateStoreInstance = null;
  }
}
