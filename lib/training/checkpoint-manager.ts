/**
 * Workflow Checkpoint System
 * 
 * Enables pause/resume of long-running DAG workflows by:
 * 1. Capturing complete execution state at specific points
 * 2. Persisting checkpoints to durable storage (Supabase)
 * 3. Restoring execution state to resume from any checkpoint
 * 
 * Use Cases:
 * - Pause multi-hour training pipelines for maintenance
 * - Resume workflows after system restart or failure
 * - Implement manual approval steps with persistent state
 * - Debug workflows by resuming from specific points
 * 
 * Architecture:
 * - CheckpointManager: Core service for checkpoint CRUD operations
 * - StateSerializer: Converts DAGExecution to/from JSON-serializable format
 * - Checkpoint triggers: Manual, time-based, or job-based
 * 
 * Phase 2.2 Implementation
 */

import type { DAGExecution, JobExecution, JobConfig } from './dag-orchestrator';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Constants
// ============================================================================

const CHECKPOINT_LOG_PREFIX = '[CHECKPOINT]';
const CHECKPOINT_MESSAGES = {
  CREATED: 'Checkpoint created successfully',
  RESTORED: 'Checkpoint restored successfully',
  DELETED: 'Checkpoint deleted successfully',
  NOT_FOUND: 'Checkpoint not found',
  INVALID_STATE: 'Invalid checkpoint state',
  SERIALIZATION_ERROR: 'Failed to serialize execution state',
  DESERIALIZATION_ERROR: 'Failed to deserialize checkpoint',
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Trigger types for automatic checkpoint creation
 */
export type CheckpointTrigger = 
  | 'manual'           // Explicit user/API request
  | 'time-based'       // Every N minutes
  | 'job-completed'    // After each job completes
  | 'level-completed'  // After each level completes
  | 'before-critical'; // Before critical/expensive jobs

/**
 * Serializable representation of execution state
 */
export interface SerializedExecution {
  id: string;
  name: string;
  status: string;
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
  jobs: SerializedJobExecution[];
}

/**
 * Serializable representation of job execution state
 */
export interface SerializedJobExecution {
  jobId: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  output?: string; // JSON stringified output
  error?: string;
  logs: string[];
  attempt: number;
}

/**
 * Checkpoint metadata stored in database
 */
export interface Checkpoint {
  id: string;
  execution_id: string;
  name: string;
  trigger: CheckpointTrigger;
  state: SerializedExecution;
  job_configs: JobConfig[];
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for automatic checkpointing
 */
export interface CheckpointConfig {
  enabled: boolean;
  triggers: CheckpointTrigger[];
  timeIntervalMs?: number; // For 'time-based' trigger
  retentionCount?: number; // Max checkpoints to keep
  criticalJobIds?: string[]; // Jobs that trigger 'before-critical'
}

/**
 * Options for creating a checkpoint
 */
export interface CreateCheckpointOptions {
  name?: string;
  trigger?: CheckpointTrigger;
  metadata?: Record<string, unknown>;
}

/**
 * Options for listing checkpoints
 */
export interface ListCheckpointsOptions {
  executionId?: string;
  limit?: number;
  offset?: number;
  trigger?: CheckpointTrigger;
}

// ============================================================================
// State Serialization
// ============================================================================

/**
 * Converts DAGExecution state to JSON-serializable format
 */
export class StateSerializer {
  /**
   * Serialize execution state for persistence
   */
  static serialize(execution: DAGExecution): SerializedExecution {
    try {
      const serializedJobs: SerializedJobExecution[] = [];
      
      execution.jobs.forEach((jobExecution, jobId) => {
        serializedJobs.push({
          jobId,
          status: jobExecution.status,
          startedAt: jobExecution.startedAt?.toISOString(),
          completedAt: jobExecution.completedAt?.toISOString(),
          output: jobExecution.output !== undefined 
            ? JSON.stringify(jobExecution.output) 
            : undefined,
          error: jobExecution.error,
          logs: jobExecution.logs || [],
          attempt: jobExecution.attempt || 0,
        });
      });

      return {
        id: execution.id,
        name: execution.name,
        status: execution.status,
        startedAt: execution.startedAt.toISOString(),
        completedAt: execution.completedAt?.toISOString(),
        jobs: serializedJobs,
      };
    } catch (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} Serialization error:`, error);
      throw new Error(`${CHECKPOINT_MESSAGES.SERIALIZATION_ERROR}: ${error}`);
    }
  }

  /**
   * Deserialize checkpoint back to execution state
   */
  static deserialize(serialized: SerializedExecution): DAGExecution {
    try {
      const jobs = new Map<string, JobExecution>();
      
      serialized.jobs.forEach((serializedJob) => {
        jobs.set(serializedJob.jobId, {
          jobId: serializedJob.jobId,
          status: serializedJob.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped',
          startedAt: serializedJob.startedAt ? new Date(serializedJob.startedAt) : undefined,
          completedAt: serializedJob.completedAt ? new Date(serializedJob.completedAt) : undefined,
          output: serializedJob.output !== undefined 
            ? JSON.parse(serializedJob.output) 
            : undefined,
          error: serializedJob.error,
          logs: serializedJob.logs || [],
          attempt: serializedJob.attempt || 0,
        });
      });

      return {
        id: serialized.id,
        name: serialized.name,
        status: serialized.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped',
        startedAt: new Date(serialized.startedAt),
        completedAt: serialized.completedAt ? new Date(serialized.completedAt) : undefined,
        jobs,
      };
    } catch (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} Deserialization error:`, error);
      throw new Error(`${CHECKPOINT_MESSAGES.DESERIALIZATION_ERROR}: ${error}`);
    }
  }

  /**
   * Validate checkpoint state integrity
   */
  static validate(checkpoint: Checkpoint): boolean {
    try {
      // Check required fields
      if (!checkpoint.id || !checkpoint.execution_id || !checkpoint.state) {
        console.error(`${CHECKPOINT_LOG_PREFIX} Missing required fields`);
        return false;
      }

      // Check state structure
      const state = checkpoint.state;
      if (!state.id || !state.name || !state.status || !state.jobs) {
        console.error(`${CHECKPOINT_LOG_PREFIX} Invalid state structure`);
        return false;
      }

      // Validate each job
      for (const job of state.jobs) {
        if (!job.jobId || !job.status) {
          console.error(`${CHECKPOINT_LOG_PREFIX} Invalid job state:`, job.jobId);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} Validation error:`, error);
      return false;
    }
  }
}

// ============================================================================
// Checkpoint Manager
// ============================================================================

/**
 * Manages checkpoint creation, retrieval, and deletion
 */
export class CheckpointManager {
  private supabase: ReturnType<typeof createClient>;
  private config: CheckpointConfig;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<CheckpointConfig> = {}
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: config.enabled ?? true,
      triggers: config.triggers ?? ['manual'],
      timeIntervalMs: config.timeIntervalMs ?? 300000, // 5 minutes default
      retentionCount: config.retentionCount ?? 10,
      criticalJobIds: config.criticalJobIds ?? [],
    };

    console.log(`${CHECKPOINT_LOG_PREFIX} Manager initialized`, {
      enabled: this.config.enabled,
      triggers: this.config.triggers,
    });
  }

  /**
   * Create a checkpoint from current execution state
   */
  async createCheckpoint(
    execution: DAGExecution,
    jobConfigs: JobConfig[],
    options: CreateCheckpointOptions = {}
  ): Promise<Checkpoint> {
    if (!this.config.enabled) {
      throw new Error('Checkpointing is disabled');
    }

    const checkpointId = `checkpoint_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const trigger = options.trigger ?? 'manual';
    
    console.log(`${CHECKPOINT_LOG_PREFIX} Creating checkpoint`, {
      checkpointId,
      executionId: execution.id,
      trigger,
    });

    // Serialize execution state
    const serializedState = StateSerializer.serialize(execution);

    // Create checkpoint record
    const checkpoint: Checkpoint = {
      id: checkpointId,
      execution_id: execution.id,
      name: options.name ?? `Checkpoint at ${new Date().toISOString()}`,
      trigger,
      state: serializedState,
      job_configs: jobConfigs,
      created_at: new Date().toISOString(),
      metadata: options.metadata,
    };

    // Validate before persisting
    if (!StateSerializer.validate(checkpoint)) {
      throw new Error(CHECKPOINT_MESSAGES.INVALID_STATE);
    }

    // Persist to database
    const insertResult = await (this.supabase.from('workflow_checkpoints') as unknown as {
      insert: (data: Record<string, unknown>) => Promise<{ error: Error | null }>;
    }).insert({
      id: checkpoint.id,
      execution_id: checkpoint.execution_id,
      name: checkpoint.name,
      trigger: checkpoint.trigger,
      state: checkpoint.state as unknown as Record<string, unknown>,
      job_configs: checkpoint.job_configs as unknown as Record<string, unknown>[],
      metadata: checkpoint.metadata as unknown as Record<string, unknown>,
    });
      
    const { error } = insertResult;

    if (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} Failed to persist checkpoint:`, error);
      throw new Error(`Failed to create checkpoint: ${error.message}`);
    }

    console.log(`${CHECKPOINT_LOG_PREFIX} ${CHECKPOINT_MESSAGES.CREATED}`, {
      checkpointId,
      jobCount: serializedState.jobs.length,
    });

    // Enforce retention policy
    await this.enforceRetention(execution.id);

    return checkpoint;
  }

  /**
   * Retrieve a checkpoint by ID
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    console.log(`${CHECKPOINT_LOG_PREFIX} Retrieving checkpoint:`, checkpointId);

    const { data, error } = await this.supabase
      .from('workflow_checkpoints')
      .select('*')
      .eq('id', checkpointId)
      .single() as unknown as { data: Record<string, unknown>; error: Error | null };

    if (error) {
      if ((error as unknown as {code: string}).code === 'PGRST116') {
        console.log(`${CHECKPOINT_LOG_PREFIX} ${CHECKPOINT_MESSAGES.NOT_FOUND}:`, checkpointId);
        return null;
      }
      console.error(`${CHECKPOINT_LOG_PREFIX} Retrieval error:`, error);
      throw new Error(`Failed to retrieve checkpoint: ${error.message}`);
    }

    const checkpoint: Checkpoint = {
      id: data.id as string,
      execution_id: data.execution_id as string,
      name: data.name as string,
      trigger: data.trigger as CheckpointTrigger,
      state: data.state as SerializedExecution,
      job_configs: data.job_configs as JobConfig[],
      created_at: data.created_at as string,
      metadata: data.metadata as Record<string, unknown> | undefined,
    };

    // Validate integrity
    if (!StateSerializer.validate(checkpoint)) {
      throw new Error(CHECKPOINT_MESSAGES.INVALID_STATE);
    }

    console.log(`${CHECKPOINT_LOG_PREFIX} ${CHECKPOINT_MESSAGES.RESTORED}`, {
      checkpointId,
      executionId: checkpoint.execution_id,
    });

    return checkpoint;
  }

  /**
   * List checkpoints with optional filtering
   */
  async listCheckpoints(options: ListCheckpointsOptions = {}): Promise<Checkpoint[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    console.log(`${CHECKPOINT_LOG_PREFIX} Listing checkpoints`, options);

    let query = this.supabase
      .from('workflow_checkpoints')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (options.executionId) {
      query = query.eq('execution_id', options.executionId);
    }

    if (options.trigger) {
      query = query.eq('trigger', options.trigger);
    }

    const { data, error } = await query as unknown as { data: Record<string, unknown>[] | null; error: Error | null };

    if (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} List error:`, error);
      throw new Error(`Failed to list checkpoints: ${error.message}`);
    }

    const checkpoints: Checkpoint[] = (data || []).map((row) => ({
      id: row.id as string,
      execution_id: row.execution_id as string,
      name: row.name as string,
      trigger: row.trigger as CheckpointTrigger,
      state: row.state as SerializedExecution,
      job_configs: row.job_configs as JobConfig[],
      created_at: row.created_at as string,
      metadata: row.metadata as Record<string, unknown> | undefined,
    }));

    console.log(`${CHECKPOINT_LOG_PREFIX} Found ${checkpoints.length} checkpoints`);
    return checkpoints;
  }

  /**
   * Delete a checkpoint
   */
  async deleteCheckpoint(checkpointId: string): Promise<void> {
    console.log(`${CHECKPOINT_LOG_PREFIX} Deleting checkpoint:`, checkpointId);

    const { error } = await this.supabase
      .from('workflow_checkpoints')
      .delete()
      .eq('id', checkpointId) as unknown as { error: Error | null };

    if (error) {
      console.error(`${CHECKPOINT_LOG_PREFIX} Delete error:`, error);
      throw new Error(`Failed to delete checkpoint: ${error.message}`);
    }

    console.log(`${CHECKPOINT_LOG_PREFIX} ${CHECKPOINT_MESSAGES.DELETED}:`, checkpointId);
  }

  /**
   * Restore execution state from checkpoint
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<{
    execution: DAGExecution;
    jobConfigs: JobConfig[];
  }> {
    const checkpoint = await this.getCheckpoint(checkpointId);
    
    if (!checkpoint) {
      throw new Error(`${CHECKPOINT_MESSAGES.NOT_FOUND}: ${checkpointId}`);
    }

    console.log(`${CHECKPOINT_LOG_PREFIX} Restoring execution from checkpoint`, {
      checkpointId,
      executionId: checkpoint.execution_id,
    });

    const execution = StateSerializer.deserialize(checkpoint.state);

    return {
      execution,
      jobConfigs: checkpoint.job_configs,
    };
  }

  /**
   * Check if checkpoint should be created based on trigger
   */
  shouldCheckpoint(trigger: CheckpointTrigger, jobId?: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.config.triggers.includes(trigger)) {
      return false;
    }

    // For 'before-critical', check if jobId is in critical list
    if (trigger === 'before-critical' && jobId) {
      return this.config.criticalJobIds?.includes(jobId) ?? false;
    }

    return true;
  }

  /**
   * Enforce retention policy by deleting old checkpoints
   */
  private async enforceRetention(executionId: string): Promise<void> {
    if (!this.config.retentionCount) {
      return;
    }

    const checkpoints = await this.listCheckpoints({ executionId });
    
    if (checkpoints.length <= this.config.retentionCount) {
      return;
    }

    // Delete oldest checkpoints beyond retention limit
    const toDelete = checkpoints.slice(this.config.retentionCount);
    
    console.log(`${CHECKPOINT_LOG_PREFIX} Enforcing retention policy`, {
      total: checkpoints.length,
      retentionCount: this.config.retentionCount,
      toDelete: toDelete.length,
    });

    for (const checkpoint of toDelete) {
      await this.deleteCheckpoint(checkpoint.id);
    }
  }

  /**
   * Get checkpoint statistics for an execution
   */
  async getCheckpointStats(executionId: string): Promise<{
    totalCheckpoints: number;
    triggers: Record<CheckpointTrigger, number>;
    oldestCheckpoint?: string;
    newestCheckpoint?: string;
  }> {
    const checkpoints = await this.listCheckpoints({ executionId, limit: 1000 });

    const triggers: Record<string, number> = {};
    checkpoints.forEach((cp) => {
      triggers[cp.trigger] = (triggers[cp.trigger] || 0) + 1;
    });

    return {
      totalCheckpoints: checkpoints.length,
      triggers: triggers as Record<CheckpointTrigger, number>,
      oldestCheckpoint: checkpoints[checkpoints.length - 1]?.created_at,
      newestCheckpoint: checkpoints[0]?.created_at,
    };
  }
}
