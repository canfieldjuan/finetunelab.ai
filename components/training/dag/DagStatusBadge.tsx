/**
 * DAG Status Badge Component
 *
 * Displays job status with color-coded styling and animation
 */

import { JobStatus } from '@/lib/training/dag-orchestrator';
import { cn } from '@/lib/utils';

interface DagStatusBadgeProps {
  status: JobStatus;
  className?: string;
}

export function DagStatusBadge({ status, className }: DagStatusBadgeProps) {
  console.log('[DagStatusBadge] Rendering status:', status);

  const variants: Record<JobStatus, string> = {
    pending: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    running: 'bg-blue-500 text-white animate-pulse',
    completed: 'bg-green-500 text-white',
    failed: 'bg-red-500 text-white',
    cancelled: 'bg-yellow-500 text-black dark:bg-yellow-600 dark:text-white',
    skipped: 'bg-gray-400 text-white dark:bg-gray-500'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        'transition-colors duration-200',
        variants[status],
        className
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}
