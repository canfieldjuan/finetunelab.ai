/**
 * DAG Progress Bar Component
 *
 * Displays job progress with animated bar and percentage
 */

import { cn } from '@/lib/utils';

interface DagProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showPercentage?: boolean;
}

export function DagProgressBar({
  progress,
  className,
  showPercentage = true
}: DagProgressBarProps) {
  console.log('[DagProgressBar] Rendering progress:', progress);

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300 ease-out"
            style={{ width: `${clampedProgress}%` }}
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        {showPercentage && (
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[3ch]">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>
    </div>
  );
}
