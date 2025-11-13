/**
 * Subscription System Types
 * Date: 2025-10-24
 */

// Plan limits structure
export interface PlanLimits {
  api_calls_per_month: number; // -1 means unlimited
  storage_mb: number; // -1 means unlimited
  team_members: number; // -1 means unlimited
  concurrent_training_jobs: number;
  models_limit: number; // -1 means unlimited
}

// Subscription plan from database
export interface SubscriptionPlan {
  id: string;
  name: string; // 'free', 'pro', 'enterprise'
  display_name: string; // 'Free', 'Pro', 'Enterprise'
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  limits: PlanLimits;
  features: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// User subscription from database
export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'paused';
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  trial_ends_at: string | null; // New field for free trial expiration
  created_at: string;
  updated_at: string;
}

// Combined subscription with plan details
export interface SubscriptionWithPlan {
  subscription: UserSubscription;
  plan: SubscriptionPlan;
}

// API response types
export interface GetCurrentSubscriptionResponse {
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  error?: string;
}

export interface GetAllPlansResponse {
  plans: SubscriptionPlan[];
  error?: string;
}

// Usage tracking types
export interface UsageMetrics {
  api_calls: number;
  tokens: number;
  storage_mb: number;
  training_jobs: number;
  models: number;
}

export interface UsageWithLimits {
  usage: UsageMetrics;
  limits: PlanLimits;
  percentages: {
    api_calls: number; // 0-100 or -1 for unlimited
    storage: number;
    models: number;
  };
}

// API response for usage
export interface GetUsageResponse {
  usage: UsageMetrics;
  limits: PlanLimits;
  percentages: {
    api_calls: number;
    storage: number;
    models: number;
  };
  error?: string;
}
