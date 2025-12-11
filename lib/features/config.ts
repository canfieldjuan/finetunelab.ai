/**
 * Feature Gating Configuration
 * Controls which features are available per subscription tier
 *
 * Philosophy: Gate valuable FEATURES, not usage limits
 * Users should never feel anxiety about "running out" - they should
 * feel excited about unlocking more capabilities
 */

export type PlanTier = 'free_trial' | 'pro' | 'pro_plus' | 'enterprise';

export type FeatureKey =
  // Core Features (Available to all)
  | 'basic_training'
  | 'basic_analytics'
  | 'model_management'
  | 'assistant' // May keep free

  // Pro Features
  | 'ab_testing' // Model A/B testing with advanced metrics
  | 'advanced_analytics'
  | 'priority_queue'
  | 'email_support'

  // Pro Plus Features
  | 'dag_workflows' // Complex training DAGs (ECG signal project)
  | 'graph_rag' // GraphRAG for advanced insights
  | 'custom_integrations'
  | 'advanced_metrics'
  | 'team_collaboration'

  // Enterprise Features
  | 'dedicated_support'
  | 'custom_sla'
  | 'on_premise'
  | 'white_label'
  | 'api_access';

export interface Feature {
  key: FeatureKey;
  name: string;
  description: string;
  category: 'core' | 'analytics' | 'training' | 'collaboration' | 'support' | 'enterprise';
  requiredPlan: PlanTier;
  comingSoon?: boolean;
}

/**
 * All Available Features
 */
export const FEATURES: Record<FeatureKey, Feature> = {
  // ============================================
  // CORE FEATURES (All Plans)
  // ============================================
  basic_training: {
    key: 'basic_training',
    name: 'Basic Model Training',
    description: 'Train and fine-tune your models with our standard pipeline',
    category: 'training',
    requiredPlan: 'free_trial',
  },
  basic_analytics: {
    key: 'basic_analytics',
    name: 'Basic Analytics',
    description: 'View training metrics, loss curves, and basic performance data',
    category: 'analytics',
    requiredPlan: 'free_trial',
  },
  model_management: {
    key: 'model_management',
    name: 'Model Management',
    description: 'Organize, version, and deploy your trained models',
    category: 'core',
    requiredPlan: 'free_trial',
  },
  assistant: {
    key: 'assistant',
    name: 'AI Assistant',
    description: 'Get help with training configurations and best practices',
    category: 'core',
    requiredPlan: 'free_trial', // May keep free
  },

  // ============================================
  // PRO FEATURES
  // ============================================
  ab_testing: {
    key: 'ab_testing',
    name: 'Model A/B Testing',
    description: 'Compare models side-by-side with advanced statistical metrics',
    category: 'analytics',
    requiredPlan: 'pro',
  },
  advanced_analytics: {
    key: 'advanced_analytics',
    name: 'Advanced Analytics Dashboard',
    description: 'Deep insights into model behavior, bias detection, and performance trends',
    category: 'analytics',
    requiredPlan: 'pro',
  },
  priority_queue: {
    key: 'priority_queue',
    name: 'Priority Training Queue',
    description: 'Your training jobs get priority processing',
    category: 'training',
    requiredPlan: 'pro',
  },
  email_support: {
    key: 'email_support',
    name: 'Email Support',
    description: '24-hour response time for technical questions',
    category: 'support',
    requiredPlan: 'pro',
  },

  // ============================================
  // PRO PLUS FEATURES
  // ============================================
  dag_workflows: {
    key: 'dag_workflows',
    name: 'DAG Training Workflows',
    description: 'Build complex training pipelines with dependencies (perfect for projects like ECG signal processing)',
    category: 'training',
    requiredPlan: 'pro_plus',
  },
  graph_rag: {
    key: 'graph_rag',
    name: 'GraphRAG Analytics',
    description: 'Unlock hidden insights with knowledge graph-powered analytics that standard metrics miss',
    category: 'analytics',
    requiredPlan: 'pro_plus',
  },
  custom_integrations: {
    key: 'custom_integrations',
    name: 'Custom Integrations',
    description: 'Connect to your existing tools and workflows',
    category: 'core',
    requiredPlan: 'pro_plus',
  },
  advanced_metrics: {
    key: 'advanced_metrics',
    name: 'Advanced Metrics Suite',
    description: 'Explainability, fairness, robustness, and custom evaluation metrics',
    category: 'analytics',
    requiredPlan: 'pro_plus',
  },
  team_collaboration: {
    key: 'team_collaboration',
    name: 'Team Collaboration',
    description: 'Share models, experiments, and insights with your team',
    category: 'collaboration',
    requiredPlan: 'pro_plus',
  },

  // ============================================
  // ENTERPRISE FEATURES
  // ============================================
  dedicated_support: {
    key: 'dedicated_support',
    name: 'Dedicated Support',
    description: 'Dedicated support engineer and Slack channel',
    category: 'support',
    requiredPlan: 'enterprise',
  },
  custom_sla: {
    key: 'custom_sla',
    name: 'Custom SLA',
    description: 'Guaranteed uptime and response times tailored to your needs',
    category: 'enterprise',
    requiredPlan: 'enterprise',
  },
  on_premise: {
    key: 'on_premise',
    name: 'On-Premise Deployment',
    description: 'Deploy our platform in your own infrastructure',
    category: 'enterprise',
    requiredPlan: 'enterprise',
  },
  white_label: {
    key: 'white_label',
    name: 'White Label',
    description: 'Rebrand the platform with your company identity',
    category: 'enterprise',
    requiredPlan: 'enterprise',
  },
  api_access: {
    key: 'api_access',
    name: 'Full API Access',
    description: 'Programmatic access to all platform features',
    category: 'enterprise',
    requiredPlan: 'enterprise',
  },
};

/**
 * Get all features available for a plan tier
 */
export function getFeaturesForPlan(planTier: PlanTier): Feature[] {
  const planHierarchy: Record<PlanTier, number> = {
    free_trial: 0,
    pro: 1,
    pro_plus: 2,
    enterprise: 3,
  };

  const currentPlanLevel = planHierarchy[planTier];

  return Object.values(FEATURES).filter((feature) => {
    const requiredLevel = planHierarchy[feature.requiredPlan];
    return requiredLevel <= currentPlanLevel;
  });
}

/**
 * Check if a user has access to a specific feature
 */
export function hasFeatureAccess(userPlan: PlanTier, featureKey: FeatureKey): boolean {
  const feature = FEATURES[featureKey];
  if (!feature) return false;

  const planHierarchy: Record<PlanTier, number> = {
    free_trial: 0,
    pro: 1,
    pro_plus: 2,
    enterprise: 3,
  };

  return planHierarchy[userPlan] >= planHierarchy[feature.requiredPlan];
}

/**
 * Get features by category
 */
export function getFeaturesByCategory(category: Feature['category']): Feature[] {
  return Object.values(FEATURES).filter((f) => f.category === category);
}

/**
 * Get required plan for a feature
 */
export function getRequiredPlanForFeature(featureKey: FeatureKey): PlanTier {
  return FEATURES[featureKey]?.requiredPlan || 'enterprise';
}

/**
 * Get upgrade path to access a feature
 */
export function getUpgradePathForFeature(
  currentPlan: PlanTier,
  featureKey: FeatureKey
): PlanTier | null {
  if (hasFeatureAccess(currentPlan, featureKey)) {
    return null; // Already has access
  }

  const requiredPlan = getRequiredPlanForFeature(featureKey);
  return requiredPlan;
}
