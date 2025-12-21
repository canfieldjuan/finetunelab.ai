/**
 * Pricing Configuration
 * Central location for all subscription tiers and limits
 * Update these values based on market research
 * Model limits can be configured via environment variables
 */

export type PlanTier = 'free_trial' | 'pro' | 'pro_plus' | 'enterprise';

export interface PlanLimits {
  api_calls_per_month: number;
  storage_mb: number;
  models_limit: number;
  concurrent_training_jobs: number;
  team_members: number;
}

export interface PlanPricing {
  monthly: number;
  yearly: number;
  yearlyDiscount?: number; // Percentage discount for yearly
  seatPrice?: {
    monthly: number; // Price per additional seat monthly
    yearly: number;  // Price per additional seat yearly
  };
}

export interface PlanFeatures {
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
  contactSales?: boolean;
}

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  tagline: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
  trialDays?: number;
}

/**
 * Subscription Plan Configurations
 * TODO: Update pricing after market research
 */
export const PLANS: Record<PlanTier, PlanConfig> = {
  free_trial: {
    tier: 'free_trial',
    name: 'Free Trial',
    tagline: '15 days to explore everything',
    pricing: {
      monthly: 0,
      yearly: 0,
    },
    limits: {
      api_calls_per_month: -1, // Unlimited
      storage_mb: 5120, // 5 GB - Supabase storage for datasets/configs/logs
      models_limit: -1, // Unlimited - determined by HuggingFace account
      concurrent_training_jobs: -1, // Unlimited - user pays for RunPod compute
      team_members: 1,
    },
    features: {
      name: 'Free Trial',
      description: 'Full Pro features for 15 days',
      features: [
        '🚀 15-day trial period',
        '🚀 Everything in Pro',
        '🚀 Model A/B Testing',
        '🚀 Advanced Analytics Dashboard',
        '🚀 Priority Training Queue',
        '🚀 Email support (24hr response)',
      ],
    },
    trialDays: 15,
  },

  pro: {
    tier: 'pro',
    name: 'Pro',
    tagline: 'For professional developers',
    pricing: {
      monthly: 297,
      yearly: 3300,
      yearlyDiscount: 7, // 7% discount on yearly
      seatPrice: {
        monthly: 75,  // $75/month per additional seat
        yearly: 49,   // $49/year per additional seat (45% savings vs monthly)
      },
    },
    limits: {
      api_calls_per_month: -1, // Unlimited
      storage_mb: 10240, // 10 GB - Supabase storage for datasets/configs/logs
      models_limit: -1, // Unlimited - determined by HuggingFace account
      concurrent_training_jobs: -1, // Unlimited - user pays for RunPod compute
      team_members: 1, // Base includes 1 user
    },
    features: {
      name: 'Pro',
      description: 'Everything you need to build production apps',
      features: [
        '🚀 Model A/B Testing',
        '🚀 Advanced Analytics Dashboard',
        '🚀 Priority Training Queue',
        '🚀 DAG Training Workflows',
        '🚀 GraphRAG Analytics',
        '🚀 Advanced Metrics Suite',
        '🚀 Custom Integrations',
        '🚀 Priority support',
      ],
      popular: true, // Show "Most Popular" badge
    },
  },

  pro_plus: {
    tier: 'pro_plus',
    name: 'Pro Plus',
    tagline: 'For scaling teams',
    pricing: {
      monthly: 497,
      yearly: 5300,
      yearlyDiscount: 11, // 11% discount on yearly
      seatPrice: {
        monthly: 75,  // $75/month per additional seat
        yearly: 49,   // $49/year per additional seat (45% savings vs monthly)
      },
    },
    limits: {
      api_calls_per_month: -1, // Unlimited
      storage_mb: 51200, // 50 GB - Supabase storage for datasets/configs/logs
      models_limit: -1, // Unlimited - determined by HuggingFace account
      concurrent_training_jobs: -1, // Unlimited - user pays for RunPod compute
      team_members: -1, // Unlimited users
    },
    features: {
      name: 'Pro Plus',
      description: 'For scaling teams',
      features: [
        '🚀 Model A/B Testing',
        '🚀 Advanced Analytics Dashboard',
        '🚀 Priority Training Queue',
        '🚀 DAG Training Workflows',
        '🚀 GraphRAG Analytics',
        '🚀 Advanced Metrics Suite',
        '🚀 Custom Integrations',
        '🚀 Priority support',
        '🚀 Unlimited team members',
        '🚀 Team workspace',
        '🚀 Team collaboration tools',
      ],
    },
  },

  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom solutions for your organization',
    pricing: {
      monthly: 997,
      yearly: 11000,
      yearlyDiscount: 8, // 8% discount on yearly
    },
    limits: {
      api_calls_per_month: -1, // Unlimited
      storage_mb: -1, // Unlimited
      models_limit: -1, // Unlimited
      concurrent_training_jobs: -1, // Unlimited
      team_members: -1, // Unlimited
    },
    features: {
      name: 'Enterprise',
      description: 'Tailored to your specific needs',
      features: [
        '🚀 Everything in Pro Plus',
        '🚀 Dedicated Support Engineer',
        '🚀 Custom SLA & Contracts',
        '🚀 On-Premise Deployment',
        '🚀 White Label Options',
        '🚀 Full API Access',
        '🚀 Unlimited team members',
        '🚀 Custom integrations',
        '🚀 Volume discounts available',
      ],
      contactSales: true,
    },
  },
};

/**
 * Helper to format price
 */
export function formatPrice(amount: number, interval: 'monthly' | 'yearly' = 'monthly'): string {
  if (amount === 0) return 'Free';
  return `$${amount.toLocaleString()}/${interval === 'monthly' ? 'mo' : 'yr'}`;
}

/**
 * Helper to format limits
 */
export function formatLimit(limit: number, suffix: string = ''): string {
  if (limit === -1) return 'Unlimited';
  if (limit >= 1000000) return `${(limit / 1000000).toFixed(1)}M${suffix}`;
  if (limit >= 1000) return `${(limit / 1000).toFixed(0)}K${suffix}`;
  return `${limit}${suffix}`;
}

/**
 * Calculate yearly savings
 */
export function getYearlySavings(plan: PlanConfig): number {
  const monthlyTotal = plan.pricing.monthly * 12;
  const yearlyCost = plan.pricing.yearly;
  return monthlyTotal - yearlyCost;
}

/**
 * Calculate total price including additional seats
 */
export function calculateTotalPrice(
  plan: PlanConfig,
  interval: 'monthly' | 'yearly',
  seats: number
): number {
  const basePrice = interval === 'monthly' ? plan.pricing.monthly : plan.pricing.yearly;

  // Free trial and Enterprise have no seat pricing
  if (!plan.pricing.seatPrice || seats <= 1) {
    return basePrice;
  }

  // Calculate additional seats (seats - 1 because base includes 1 user)
  const additionalSeats = seats - 1;
  const seatPrice = interval === 'monthly'
    ? plan.pricing.seatPrice.monthly
    : plan.pricing.seatPrice.yearly;

  return basePrice + (additionalSeats * seatPrice);
}

/**
 * Calculate seat savings when paying yearly vs monthly
 */
export function getSeatYearlySavings(plan: PlanConfig, seats: number): number {
  if (!plan.pricing.seatPrice || seats <= 1) return 0;

  const additionalSeats = seats - 1;
  const monthlySeatCost = plan.pricing.seatPrice.monthly * 12 * additionalSeats;
  const yearlySeatCost = plan.pricing.seatPrice.yearly * additionalSeats;

  return monthlySeatCost - yearlySeatCost;
}

/**
 * Format total price with seats
 */
export function formatTotalPrice(
  plan: PlanConfig,
  interval: 'monthly' | 'yearly',
  seats: number
): string {
  const total = calculateTotalPrice(plan, interval, seats);
  const intervalLabel = interval === 'monthly' ? 'mo' : 'yr';

  if (seats > 1) {
    return `$${total.toLocaleString()}/${intervalLabel} for ${seats} users`;
  }

  return `$${total.toLocaleString()}/${intervalLabel}`;
}
