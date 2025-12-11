/**
 * Feature Access Hook
 * Check if current user has access to specific features
 */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { FeatureKey, PlanTier } from '@/lib/features/config';
import { hasFeatureAccess, getRequiredPlanForFeature } from '@/lib/features/config';

interface UseFeatureAccessReturn {
  hasAccess: (feature: FeatureKey) => boolean;
  currentPlan: PlanTier | null;
  isLoading: boolean;
  requiredPlanFor: (feature: FeatureKey) => PlanTier;
}

export function useFeatureAccess(): UseFeatureAccessReturn {
  const { user, session } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<PlanTier | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!user || !session?.access_token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/subscriptions/current', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch subscription');
        }

        const data = await response.json();
        setCurrentPlan((data.plan?.name as PlanTier) || 'free_trial');
      } catch (error) {
        console.error('[useFeatureAccess] Error fetching plan:', error);
        setCurrentPlan('free_trial'); // Default to free trial
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [user, session?.access_token]);

  const hasAccess = (feature: FeatureKey): boolean => {
    if (!currentPlan) return false;
    return hasFeatureAccess(currentPlan, feature);
  };

  const requiredPlanFor = (feature: FeatureKey): PlanTier => {
    return getRequiredPlanForFeature(feature);
  };

  return {
    hasAccess,
    currentPlan,
    isLoading,
    requiredPlanFor,
  };
}
