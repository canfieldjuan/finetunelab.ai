/**
 * Feature Flags Hook
 * 
 * Database-based feature flags using Supabase
 * Free alternative to LaunchDarkly
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  name: string;
  description?: string;
}

export interface FeatureFlagsContextType {
  flags: Record<string, boolean>;
  isLoading: boolean;
  refresh: () => Promise<void>;
  isEnabled: (key: string) => boolean;
}

/**
 * Hook to check feature flags
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchFlags = async () => {
    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get user's subscription plan
      let userPlan = 'free';
      if (user) {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan_id')
          .eq('user_id', user.id)
          .single();
        
        if (subscription) {
          const { data: plan } = await supabase
            .from('subscription_plans')
            .select('name')
            .eq('id', subscription.plan_id)
            .single();
          
          if (plan) {
            userPlan = plan.name;
          }
        }
      }
      
      // Fetch all enabled flags
      const { data: flagData } = await supabase
        .from('feature_flags')
        .select('key, enabled, enabled_for_all, enabled_user_ids, enabled_emails, enabled_plans, rollout_percentage, expires_at')
        .eq('enabled', true);
      
      if (!flagData) {
        setFlags({});
        setIsLoading(false);
        return;
      }
      
      // Check each flag
      const flagMap: Record<string, boolean> = {};
      
      for (const flag of flagData) {
        // Check if expired
        if (flag.expires_at && new Date(flag.expires_at) < new Date()) {
          flagMap[flag.key] = false;
          continue;
        }
        
        // Check user override
        if (user) {
          const { data: override } = await supabase
            .from('user_feature_overrides')
            .select('enabled')
            .eq('user_id', user.id)
            .eq('feature_key', flag.key)
            .single();
          
          if (override) {
            flagMap[flag.key] = override.enabled;
            continue;
          }
        }
        
        // Enabled for all
        if (flag.enabled_for_all) {
          flagMap[flag.key] = true;
          continue;
        }
        
        // Check user ID whitelist
        if (user && flag.enabled_user_ids?.includes(user.id)) {
          flagMap[flag.key] = true;
          continue;
        }
        
        // Check email whitelist
        if (user && flag.enabled_emails?.includes(user.email || '')) {
          flagMap[flag.key] = true;
          continue;
        }
        
        // Check plan
        if (flag.enabled_plans?.includes(userPlan)) {
          flagMap[flag.key] = true;
          continue;
        }
        
        // Rollout percentage (deterministic hash)
        if (flag.rollout_percentage > 0 && user) {
          const hash = simpleHash(user.id);
          if (hash % 100 < flag.rollout_percentage) {
            flagMap[flag.key] = true;
            continue;
          }
        }
        
        flagMap[flag.key] = false;
      }
      
      console.log('[FeatureFlags] Loaded flags:', flagMap);
      setFlags(flagMap);
      setIsLoading(false);
    } catch (error) {
      console.error('[FeatureFlags] Error fetching flags:', error);
      setFlags({});
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, []);

  return {
    flags,
    isLoading,
    refresh: fetchFlags,
    isEnabled: (key: string) => flags[key] === true,
  };
}

/**
 * Simple hash function for deterministic rollout
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Feature Flag Component for conditional rendering
 */
export function FeatureGate({ 
  feature, 
  children,
  fallback = null
}: { 
  feature: string; 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isEnabled, isLoading } = useFeatureFlags();
  
  if (isLoading) {
    return null; // or loading skeleton
  }

  if (isEnabled(feature)) {
    return children as React.ReactElement;
  }

  return (fallback as React.ReactElement) || null;
}
