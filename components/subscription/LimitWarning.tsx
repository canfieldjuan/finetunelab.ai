/**
 * Limit Warning Component
 * Banner displayed when approaching usage limits
 */

'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LimitWarningProps {
  limitType: string;
  current: number;
  limit: number;
  percentage: number;
  onDismiss?: () => void;
}

export function LimitWarning({
  limitType,
  current,
  limit,
  percentage,
  onDismiss,
}: LimitWarningProps) {
  const router = useRouter();

  // Don't show if under 80%
  if (percentage < 80) return null;

  // Determine severity
  const isDanger = percentage >= 90;
  const isWarning = percentage >= 80 && percentage < 90;

  const getLimitLabel = (type: string): string => {
    const labels: Record<string, string> = {
      api_call: 'API calls',
      storage_mb: 'storage',
      model_created: 'models',
      training_job: 'training jobs',
      token_usage: 'tokens',
    };
    return labels[type] || type;
  };

  const handleUpgrade = () => {
    console.log('[LimitWarning] User clicked upgrade from warning');
    router.push('/account');
  };

  const remaining = Math.max(limit - current, 0);

  return (
    <div
      className={`
        rounded-lg border p-4 mb-4
        ${isDanger ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}
        ${isWarning ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        {isDanger ? (
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              isDanger
                ? 'text-red-900 dark:text-red-100'
                : 'text-orange-900 dark:text-orange-100'
            }`}
          >
            {isDanger ? 'Critical: ' : 'Warning: '}
            {percentage}% of {getLimitLabel(limitType)} used
          </p>
          <p
            className={`text-sm mt-1 ${
              isDanger
                ? 'text-red-700 dark:text-red-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}
          >
            You have <strong>{remaining.toLocaleString()}</strong> {getLimitLabel(limitType)}{' '}
            remaining out of <strong>{limit.toLocaleString()}</strong>.
            {isDanger && ' Upgrade now to avoid service interruption.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            onClick={handleUpgrade}
            className={
              isDanger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
            }
          >
            Upgrade
          </Button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className={`text-sm ${
                isDanger
                  ? 'text-red-600 dark:text-red-400 hover:text-red-700'
                  : 'text-orange-600 dark:text-orange-400 hover:text-orange-700'
              }`}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isDanger ? 'bg-red-600' : 'bg-orange-600'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
