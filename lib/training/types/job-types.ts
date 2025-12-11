/**
 * Phase 2.x: DAG Job Types
 * 
 * Core type definitions for job handlers in the DAG orchestration system.
 */

export interface JobContext {
  // Job identification
  jobId: string;
  workflowId: string;
  executionId?: string;
  type: string;
  
  // Job hierarchy
  parentJobId?: string;
  dependencies?: string[];
  
  // Execution context
  config: Record<string, unknown>;
  previousResults?: Record<string, JobResult>;
  
  // Metadata
  metadata?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface JobHandler {
  type: string;
  execute(context: JobContext): Promise<JobResult>;
  validate?(config: Record<string, unknown>): { valid: boolean; errors: string[] };
  getStatus?(jobId: string, executionId: string): Promise<{
    status: string;
    progress?: number;
    message?: string;
  }>;
  cancel?(jobId: string, executionId: string, reason: string): Promise<void>;
}
