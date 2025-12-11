/**
 * DAG Node Component
 *
 * Custom job node with visual indicators for status, type, and progress
 */

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  BrainCircuit,
  Filter,
  CheckCircle,
  Rocket,
  Shield,
  AlertCircle,
  GitBranch,
  GitMerge
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DagNodeData } from './types';
import { DagStatusBadge } from './DagStatusBadge';
import { DagProgressBar } from './DagProgressBar';
import { JobType } from '@/lib/training/dag-orchestrator';

const iconMap: Record<JobType, typeof BrainCircuit> = {
  training: BrainCircuit,
  train: BrainCircuit,
  preprocessing: Filter,
  validation: CheckCircle,
  deployment: Rocket,
  'regression-gate': Shield,
  'fan-out': GitBranch,
  'fan-in': GitMerge,
  echo: AlertCircle,
  slow_echo: AlertCircle,
  nonexistent_handler: AlertCircle,
};

export const DagNode = memo((props: NodeProps) => {
  const { data, selected } = props;
  const nodeData = data as DagNodeData;
  
  console.log('[DagNode] Rendering node:', nodeData?.id, 'status:', nodeData?.status);

  const Icon = nodeData?.type ? iconMap[nodeData.type] : null;

  if (!nodeData) return null;

  const statusColor = {
    pending: 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
    running: 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950',
    completed: 'border-green-500 bg-green-50 dark:border-green-400 dark:bg-green-950',
    failed: 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-950',
    cancelled: 'border-yellow-500 bg-yellow-50 dark:border-yellow-400 dark:bg-yellow-950',
    skipped: 'border-gray-400 bg-gray-100 dark:border-gray-500 dark:bg-gray-700',
  }[nodeData.status || 'pending'];

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-lg border-2 shadow-md',
        'min-w-[200px] transition-all',
        statusColor,
        selected && 'ring-2 ring-blue-500 ring-offset-2'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600 hover:bg-blue-500"
        isConnectable={true}
      />

      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300" />}
        <span className="font-medium text-gray-900 dark:text-gray-100">{nodeData.name}</span>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        {nodeData.type}
      </div>

      {nodeData.status && (
        <div className="mb-2">
          <DagStatusBadge status={nodeData.status} />
        </div>
      )}

      {nodeData.progress !== undefined && nodeData.progress > 0 && (
        <DagProgressBar progress={nodeData.progress} className="mb-2" />
      )}

      {nodeData.error && (
        <div className="flex items-start gap-1 text-xs text-red-600 dark:text-red-400 mt-2">
          <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{nodeData.error}</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="w-3 h-3 bg-gray-400 dark:bg-gray-600 hover:bg-blue-500"
        isConnectable={true}
      />
    </div>
  );
});

DagNode.displayName = 'DagNode';

