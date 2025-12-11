/**
 * Context Provider Service
 * Date: 2025-10-24
 * Purpose: Fetch and format context for LLM injection
 * Token Budget: 35-135 tokens per message
 */

import { supabase } from '../supabaseClient';
import type {
  UserProfileContext,
  FeatureFlagsContext,
  RecentActivityContext,
  ConditionalContext,
  ContextInjectionResult,
} from './types';
import { detectNeededContext, estimateContextTokens } from './context-detector';

interface SubscriptionPlan {
  name: string;
  limits: unknown;
}

// ============================================================================
// Essential Context Fetchers (Always Inject)
// ============================================================================

/**
 * Get user profile context (35 tokens)
 * Always injected - essential user info
 */
export async function getUserProfileContext(
  userId: string
): Promise<UserProfileContext | null> {
  console.log('[ContextProvider] Fetching user profile for:', userId);

  try {
    const { data, error } = await supabase
      .from('user_context_profiles')
      .select('full_name, display_name, timezone, locale, role, company, preferred_response_length, expertise_level, enable_context_injection')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ContextProvider] Error fetching profile:', error);
      return null;
    }

    if (!data) {
      // No profile is normal for new users - not an error
      return null;
    }

    return {
      name: data.display_name || data.full_name || 'User',
      timezone: data.timezone || 'UTC',
      locale: data.locale || 'en-US',
      role: data.role,
      company: data.company,
      responseLength: data.preferred_response_length || 'balanced',
      expertiseLevel: data.expertise_level || 'intermediate',
    };
  } catch (error) {
    console.error('[ContextProvider] Exception fetching profile:', error);
    return null;
  }
}

/**
 * Get feature flags context (30-50 tokens)
 * Always injected - user permissions and limits
 */
export async function getFeatureFlagsContext(
  userId: string
): Promise<FeatureFlagsContext | null> {
  console.log('[ContextProvider] Fetching feature flags for:', userId);

  try {
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        plan_id,
        subscription_plans (
          name,
          limits
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (subError) {
      // Only log real errors, not "no rows found"
      console.warn('[ContextProvider] Subscription lookup issue:', subError.message);
    }

    const subscriptionPlans = subscription?.subscription_plans as SubscriptionPlan | SubscriptionPlan[] | undefined;
    const planData = Array.isArray(subscriptionPlans) ? subscriptionPlans[0] : subscriptionPlans;
    const planName = planData?.name || 'free';
    const planLimits = (planData?.limits as Record<string, unknown>) || {};
    const apiCallsLimit = (typeof planLimits.api_calls_per_month === 'number' ? planLimits.api_calls_per_month : null) || 1000;

    const { data: flags } = await supabase
      .from('feature_flags')
      .select('key, enabled, enabled_for_all, enabled_plans')
      .eq('enabled', true);

    const enabledFeatures: string[] = [];

    if (flags) {
      for (const flag of flags) {
        if (flag.enabled_for_all || flag.enabled_plans?.includes(planName)) {
          enabledFeatures.push(flag.key);
        }
      }
    }

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: usageData } = await supabase
      .from('usage_metrics')
      .select('value')
      .eq('user_id', userId)
      .eq('metric_type', 'api_call')
      .gte('period_start', periodStart.toISOString());

    const apiCallsUsed = usageData?.reduce((sum, row) => sum + row.value, 0) || 0;

    return {
      enabledFeatures,
      plan: planName,
      permissions: {
        canCreateTrainingJobs: enabledFeatures.includes('training_jobs'),
        canAccessAdvancedFeatures: planName !== 'free',
      },
      limits: {
        apiCallsRemaining: Math.max(0, apiCallsLimit - apiCallsUsed),
        apiCallsLimit,
        percentUsed: Math.min(100, Math.round((apiCallsUsed / apiCallsLimit) * 100)),
      },
    };
  } catch (error) {
    console.error('[ContextProvider] Exception fetching features:', error);
    return null;
  }
}

// ============================================================================
// Conditional Context Fetchers (Only When Needed)
// ============================================================================

/**
 * Get recent activity context (0-100 tokens conditional)
 * Only fetch if message suggests user is referencing recent work
 */
export async function getRecentActivityContext(
  userId: string
): Promise<RecentActivityContext | null> {
  console.log('[ContextProvider] Fetching recent activity for:', userId);

  try {
    const { data: activities, error } = await supabase
      .from('user_context_activity')
      .select('activity_type, resource_name, resource_type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[ContextProvider] Error fetching activity:', error);
      return null;
    }

    if (!activities || activities.length === 0) {
      return null;
    }

    const recentFiles = activities
      .filter(a => a.activity_type === 'file_edit' && a.resource_name)
      .slice(0, 5)
      .map(a => a.resource_name);

    const recentConversations = activities
      .filter(a => a.activity_type === 'conversation')
      .slice(0, 3)
      .map(a => ({
        topic: a.resource_name || 'Untitled',
        date: formatRelativeTime(new Date(a.created_at)),
      }));

    return {
      recentFiles,
      recentConversations,
      activeProject: activities.find(a => a.resource_type === 'project')?.resource_name,
    };
  } catch (error) {
    console.error('[ContextProvider] Exception fetching activity:', error);
    return null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format relative time (e.g., "5 hours ago", "2 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

/**
 * Format context as LLM system message
 */
function formatContextAsSystemMessage(context: ConditionalContext): string {
  const parts: string[] = [];

  // Essential user info
  parts.push(`You are helping ${context.profile.name}.`);
  parts.push(`User timezone: ${context.profile.timezone}`);

  if (context.profile.role) {
    parts.push(`User role: ${context.profile.role}`);
  }

  if (context.profile.company) {
    parts.push(`Company: ${context.profile.company}`);
  }

  // Response preferences
  parts.push(`Preferred response style: ${context.profile.responseLength}`);
  parts.push(`User expertise: ${context.profile.expertiseLevel}`);

  // Feature access
  if (context.features.enabledFeatures.length > 0) {
    parts.push(`Available features: ${context.features.enabledFeatures.join(', ')}`);
  }
  parts.push(`Subscription plan: ${context.features.plan}`);

  // API limits warning
  if (context.features.limits.percentUsed > 80) {
    parts.push(`API usage: ${context.features.limits.percentUsed}% of limit used`);
  }

  // Recent activity (if included)
  if (context.activity) {
    if (context.activity.activeProject) {
      parts.push(`Current project: ${context.activity.activeProject}`);
    }

    if (context.activity.recentFiles.length > 0) {
      parts.push(`Recent files: ${context.activity.recentFiles.slice(0, 3).join(', ')}`);
    }
  }

  parts.push(`\nConsider this context when responding.`);

  return parts.join('\n');
}

// ============================================================================
// Main Context Orchestration
// ============================================================================

/**
 * Gather all needed context for a message
 * Smart: Only fetches what's needed based on message content
 */
export async function gatherConversationContext(
  userId: string,
  lastMessage: string,
  options: {
    forceMinimal?: boolean;
    maxTokens?: number;
  } = {}
): Promise<ContextInjectionResult> {
  console.log('[ContextProvider] Gathering context for user:', userId);

  const startTime = Date.now();

  // First, check if user has context injection enabled
  const { data: profileData } = await supabase
    .from('user_context_profiles')
    .select('enable_context_injection')
    .eq('user_id', userId)
    .maybeSingle();

  const contextEnabled = profileData?.enable_context_injection ?? true; // Default to true if not set

  console.log('[ContextProvider] Context injection enabled:', contextEnabled);

  if (!contextEnabled) {
    console.log('[ContextProvider] Context injection disabled by user preference');
    return {
      context: {
        profile: {
          name: 'User',
          timezone: 'UTC',
          locale: 'en-US',
          responseLength: 'balanced',
          expertiseLevel: 'intermediate',
        },
        features: {
          enabledFeatures: [],
          plan: 'free',
          permissions: {
            canCreateTrainingJobs: false,
            canAccessAdvancedFeatures: false,
          },
          limits: {
            apiCallsRemaining: 0,
            apiCallsLimit: 0,
            percentUsed: 0,
          },
        },
      },
      systemMessage: '', // Empty system message when disabled
      estimatedTokens: 0,
      contextTypes: [],
    };
  }

  // Detect what context is needed
  const detection = detectNeededContext(lastMessage);
  const estimatedTokens = estimateContextTokens(detection);

  console.log('[ContextProvider] Detection:', detection);
  console.log('[ContextProvider] Estimated tokens:', estimatedTokens);

  // Check token budget
  const maxTokens = options.maxTokens || 500;
  if (estimatedTokens > maxTokens && !options.forceMinimal) {
    console.warn('[ContextProvider] Context exceeds budget, reducing...');
    detection.needsActivity = false;
    detection.needsGraphRAG = false;
  }

  // Fetch contexts in parallel (FAST!)
  const [profile, features, activity] = await Promise.all([
    getUserProfileContext(userId),
    getFeatureFlagsContext(userId),
    detection.needsActivity ? getRecentActivityContext(userId) : Promise.resolve(null),
  ]);

  const elapsed = Date.now() - startTime;
  console.log('[ContextProvider] Context gathered in', elapsed, 'ms');

  // Build context object
  const context: ConditionalContext = {
    profile: profile || {
      name: 'User',
      timezone: 'UTC',
      locale: 'en-US',
      responseLength: 'balanced',
      expertiseLevel: 'intermediate',
    },
    features: features || {
      enabledFeatures: [],
      plan: 'free',
      permissions: {
        canCreateTrainingJobs: false,
        canAccessAdvancedFeatures: false,
      },
      limits: {
        apiCallsRemaining: 0,
        apiCallsLimit: 0,
        percentUsed: 0,
      },
    },
    activity: activity || undefined,
  };

  // Format as system message
  const systemMessage = formatContextAsSystemMessage(context);

  // Track which context types were included
  const contextTypes: string[] = ['profile', 'features'];
  if (activity) contextTypes.push('activity');

  return {
    context,
    systemMessage,
    estimatedTokens,
    contextTypes,
  };
}
