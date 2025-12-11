/**
 * Upgrade Prompt Component
 * Modal displayed when user hits usage limit
 */

'use client';

import { useRouter } from 'next/navigation';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpgradePromptProps {
  limitType: string;
  current: number;
  limit: number;
  percentage: number;
  onClose?: () => void;
  isOpen: boolean;
}

export function UpgradePrompt({
  limitType,
  current,
  limit,
  percentage,
  onClose,
  isOpen,
}: UpgradePromptProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    console.log('[UpgradePrompt] User clicked upgrade');
    router.push('/account');
  };

  const handleClose = () => {
    console.log('[UpgradePrompt] User closed prompt');
    if (onClose) onClose();
  };

  const getLimitLabel = (type: string): string => {
    const labels: Record<string, string> = {
      api_call: 'API Calls',
      storage_mb: 'Storage',
      model_created: 'Models',
      training_job: 'Training Jobs',
      token_usage: 'Tokens',
    };
    return labels[type] || type;
  };

  const getLimitDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      api_call: 'monthly API requests to our platform',
      storage_mb: 'storage space for your data',
      model_created: 'custom models you can create',
      training_job: 'concurrent training jobs',
      token_usage: 'tokens processed',
    };
    return descriptions[type] || 'resources';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-full">
              <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
            Usage Limit Reached
          </h2>

          {/* Message */}
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            You&apos;ve used <strong>{current.toLocaleString()}</strong> of your{' '}
            <strong>{limit.toLocaleString()}</strong> {getLimitLabel(limitType).toLowerCase()}
            ({percentage}%).
          </p>

          {/* Details */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Upgrade to Pro for more {getLimitDescription(limitType)}
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>✓ 100,000 API calls per month</li>
                  <li>✓ 10 GB storage</li>
                  <li>✓ 25 custom models</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handleUpgrade}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Upgrade to Pro
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="w-full"
            >
              Maybe Later
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
