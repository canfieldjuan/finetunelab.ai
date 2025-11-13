/**
 * Feature Gate Component
 * Shows content only if user has access to the feature
 * Otherwise shows upgrade prompt
 */

'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureKey } from '@/lib/features/config';
import { FEATURES } from '@/lib/features/config';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

/**
 * FeatureGate Component
 *
 * Usage:
 * <FeatureGate feature="ab_testing">
 *   <ABTestingDashboard />
 * </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { hasAccess, currentPlan, isLoading, requiredPlanFor } = useFeatureAccess();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // User has access - show the feature
  if (hasAccess(feature)) {
    return <>{children}</>;
  }

  // User doesn't have access
  const featureInfo = FEATURES[feature];
  const requiredPlan = requiredPlanFor(feature);

  // If custom fallback provided, show that
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default: Show upgrade prompt
  if (showUpgradePrompt) {
    return (
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-12">
        <div className="max-w-md mx-auto text-center">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="bg-purple-100 dark:bg-purple-900 p-4 rounded-full">
              <Lock className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-foreground mb-2">
            {featureInfo.name}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground mb-6">
            {featureInfo.description}
          </p>

          {/* Required Plan Badge */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              Requires {requiredPlan.replace('_', ' ').toUpperCase()} Plan
            </span>
          </div>

          {/* Upgrade Button */}
          <Button
            onClick={() => router.push('/account')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            Upgrade to {requiredPlan.replace('_', ' ')} →
          </Button>

          {/* Current Plan Info */}
          {currentPlan && (
            <p className="text-xs text-muted-foreground mt-4">
              Currently on {currentPlan.replace('_', ' ').toUpperCase()} plan
            </p>
          )}
        </div>
      </div>
    );
  }

  // No fallback, no upgrade prompt - return null
  return null;
}

/**
 * Inline Feature Lock Badge
 * Shows a small lock icon next to locked features
 */
export function FeatureLockBadge({ feature }: { feature: FeatureKey }) {
  const { hasAccess } = useFeatureAccess();

  if (hasAccess(feature)) {
    return null;
  }

  const featureInfo = FEATURES[feature];

  return (
    <span
      className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-medium px-2 py-1 rounded"
      title={`Requires ${featureInfo.requiredPlan.replace('_', ' ')} plan`}
    >
      <Lock className="w-3 h-3" />
      {featureInfo.requiredPlan.replace('_', ' ')}
    </span>
  );
}
