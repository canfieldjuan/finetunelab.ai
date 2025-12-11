/**
 * DAG UI Type Definitions
 *
 * TypeScript interfaces for DAG visual builder and execution dashboard
 */

import { Node, Edge } from '@xyflow/react';
import { JobConfig, JobStatus, JobType, DAGExecution, JobExecution } from '@/lib/training/dag-orchestrator';

// ============================================================================
// Visual Node Representation
// ============================================================================

export interface DagNodeData extends Record<string, unknown> {
  id: string;
  type: JobType;
  name: string;
  config: Record<string, unknown>;
  status?: JobStatus;
  progress?: number;
  error?: string;
}

export type DagNode = Node<DagNodeData>;
export type DagEdge = Edge;

// ============================================================================
// Builder State
// ============================================================================

export interface DagBuilderState {
  nodes: DagNode[];
  edges: DagEdge[];
  selectedNode: string | null;
  isValidating: boolean;
  validationErrors: string[];
}

// ============================================================================
// Execution View
// ============================================================================

export interface ExecutionViewData {
  execution: DAGExecution;
  metrics: MetricData[];
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: string;
  jobId: string;
  level: 'info' | 'error' | 'warn';
  message: string;
}

export interface MetricData {
  timestamp: string;
  name: string;
  value: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Template Management
// ============================================================================

export interface Template {
  id: string;
  name: string;
  description?: string;
  category?: string;
  config: {
    jobs: JobConfig[];
  };
  created_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ValidationResponse {
  valid: boolean;
  errors?: string[];
  executionLevels?: JobConfig[][];
  topologicalOrder?: JobConfig[];
  totalJobs?: number;
  maxParallelJobs?: number;
}

export interface ExecutionResponse {
  success: boolean;
  executionId: string;
  message: string;
  name: string;
  status: JobStatus;
  totalJobs: number;
}

export interface ExecutionStatusResponse {
  success: boolean;
  id: string;
  name: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  duration: number;
  progress: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  jobs: JobExecution[];
}

export interface ExecutionListResponse {
  success: boolean;
  executions: Array<{
    id: string;
    name: string;
    status: JobStatus;
    startedAt: string;
    completedAt?: string;
    duration?: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface TemplateListResponse {
  success: boolean;
  templates: Template[];
}

export interface MetricsResponse {
  success: boolean;
  executionId: string;
  metrics: Record<string, MetricData[]>;
  totalDataPoints: number;
}
