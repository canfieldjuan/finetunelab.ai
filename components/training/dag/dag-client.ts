/**
 * DAG Client API
 *
 * API client functions for DAG operations (save, load, validate, execute)
 */

import { DagNode, DagEdge, ValidationResponse, ExecutionResponse, Template } from './types';
import { JobConfig } from '@/lib/training/dag-orchestrator';

// ============================================================================
// Data Transformation
// ============================================================================

export function dagToJobConfigs(nodes: DagNode[], edges: DagEdge[]): JobConfig[] {
  console.log('[DAG-CLIENT] Converting DAG to job configs:', nodes.length, 'nodes');

  return nodes.map(node => {
    if (!node.data) {
      throw new Error(`Node ${node.id} has no data`);
    }

    const dependencies = edges
      .filter(edge => edge.target === node.id)
      .map(edge => edge.source);

    return {
      id: node.data.id,
      type: node.data.type,
      name: node.data.name,
      config: node.data.config,
      dependsOn: dependencies
    };
  });
}

export function jobConfigsToDag(jobs: JobConfig[]): { nodes: DagNode[]; edges: DagEdge[] } {
  console.log('[DAG-CLIENT] Converting job configs to DAG:', jobs.length, 'jobs');

  const nodes: DagNode[] = jobs.map((job, index) => ({
    id: job.id,
    type: 'custom',
    position: { x: 250, y: index * 150 },
    data: {
      id: job.id,
      type: job.type,
      name: job.name,
      config: job.config
    }
  }));

  const edges: DagEdge[] = [];
  jobs.forEach(job => {
    job.dependsOn?.forEach((depId: string) => {
      edges.push({
        id: `${depId}-${job.id}`,
        source: depId,
        target: job.id,
        type: 'smoothstep'
      });
    });
  });

  return { nodes, edges };
}

// ============================================================================
// API Operations
// ============================================================================

export async function validateDAG(nodes: DagNode[], edges: DagEdge[]): Promise<ValidationResponse> {
  console.log('[DAG-CLIENT] Validating DAG');

  const jobs = dagToJobConfigs(nodes, edges);

  const response = await fetch('/api/training/dag/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Validation failed');
  }

  return response.json();
}

export async function saveTemplate(
  name: string,
  nodes: DagNode[],
  edges: DagEdge[],
  description?: string,
  category?: string
): Promise<Template> {
  console.log('[DAG-CLIENT] Saving template:', name);

  const jobs = dagToJobConfigs(nodes, edges);

  const response = await fetch('/api/training/dag/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      category,
      config: { jobs }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save template');
  }

  return response.json();
}

export async function loadTemplate(templateId: string): Promise<Template> {
  console.log('[DAG-CLIENT] Loading template:', templateId);

  const response = await fetch(`/api/training/dag/templates/${templateId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to load template');
  }

  return response.json();
}

export async function executeDAG(
  name: string,
  nodes: DagNode[],
  edges: DagEdge[]
): Promise<ExecutionResponse> {
  console.log('[DAG-CLIENT] Executing DAG:', name);

  const jobs = dagToJobConfigs(nodes, edges);

  const response = await fetch('/api/training/dag/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, jobs })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Execution failed');
  }

  return response.json();
}
