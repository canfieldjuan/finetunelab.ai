/**
 * Usage-Based Pricing Configuration
 * Premium observability pricing - hard to game, aligned with value
 * 
 * Model: Two-meter + retention multiplier
 * - Meter 1: Monitored traces (per 1,000 root traces)
 * - Meter 2: Payload budget (included KB/trace, then GB overage)
 * - Retention: Base retention + cost multiplier for longer retention
 * 
 * Minimum commitment: $250-$1,000/mo (no hobby pricing)
 * 
 * Date: 2025-12-18
 */

export type UsageTier = 'starter' | 'growth' | 'business' | 'enterprise';

/**
 * Trace pricing per 1,000 monitored requests (root traces)
 * This is the primary value metric - customers think in "requests monitored"
 */
export interface TracePricing {
  pricePerThousandTraces: number; // USD per 1,000 root traces
  includedTraces: number;         // Included in base subscription
}

/**
 * Payload/ingestion pricing
 * Includes N KB per trace, then charges GB overage
 * Prevents gaming via massive payloads
 */
export interface PayloadPricing {
  includedKbPerTrace: number;  // Included payload per trace (compressed)
  overagePricePerGb: number;   // USD per GB beyond included
}

/**
 * Retention pricing multiplier
 * Base retention included, longer retention costs more
 * Reflects storage + index costs over time
 */
export interface RetentionPricing {
  baseDays: number;                    // Included retention period
  extendedRetentionMultipliers: {      // Cost multipliers for longer retention
    30: number;  // 30 days
    60: number;  // 60 days  
    90: number;  // 90 days
    180: number; // 180 days (Business+)
    365: number; // 1 year (Enterprise only)
  };
}

/**
 * Feature gates by tier
 * Access controls, not metered features
 */
export interface TierFeatures {
  // Security & Access
  ssoEnabled: boolean;
  rbacEnabled: boolean;
  auditLogsEnabled: boolean;
  piiControlsEnabled: boolean;
  
  // Infrastructure
  vpcPeeringEnabled: boolean;
  byokEnabled: boolean;           // Bring Your Own Key
  dataResidencyEnabled: boolean;
  customSlaEnabled: boolean;
  
  // Alerting
  alertChannels: number;           // Number of alert destinations
  customAlertRules: boolean;
  
  // Integrations
  maxIntegrations: number;         // Third-party integrations
  webhooksEnabled: boolean;
  apiAccessLevel: 'read' | 'full'; // API access scope
  
  // Collaboration
  maxTeamMembers: number;          // -1 = unlimited
  sharedWorkspaces: boolean;
  
  // Support
  supportLevel: 'community' | 'standard' | 'priority' | 'dedicated';
  slaResponseTime: string;         // e.g., "24h", "4h", "1h"
}

/**
 * Complete tier configuration
 */
export interface UsagePlanConfig {
  tier: UsageTier;
  name: string;
  tagline: string;
  
  // Minimum monthly commitment (non-negotiable)
  minimumMonthly: number;
  
  // Usage meters
  traces: TracePricing;
  payload: PayloadPricing;
  retention: RetentionPricing;
  
  // Feature gates
  features: TierFeatures;
  
  // Volume discounts (commit-based)
  volumeDiscounts?: {
    traceCommitment: number;      // Traces/month commitment
    discountPercent: number;       // % off unit price
  }[];
}

/**
 * Usage-Based Plan Configurations
 * 
 * Philosophy:
 * - No free tier (time-boxed trial only)
 * - Minimum $250/mo to avoid hobby usage powering production
 * - Value-aligned: charge for what matters (traces monitored)
 * - Cost-aligned: charge for what costs us (payload storage)
 * - Premium positioning: feature gates create clear upgrade path
 */
export const USAGE_PLANS: Record<UsageTier, UsagePlanConfig> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    tagline: 'Production-ready observability for small teams',
    minimumMonthly: 250,
    
    traces: {
      pricePerThousandTraces: 0.50,   // $0.50 per 1K traces
      includedTraces: 100_000,         // 100K traces included = $50 value
    },
    
    payload: {
      includedKbPerTrace: 10,          // 10 KB/trace included (compressed)
      overagePricePerGb: 0.25,         // $0.25/GB overage
    },
    
    retention: {
      baseDays: 14,                    // 14 days base retention
      extendedRetentionMultipliers: {
        30: 1.5,   // +50% for 30 days
        60: 2.0,   // +100% for 60 days
        90: 2.5,   // +150% for 90 days
        180: 0,    // Not available
        365: 0,    // Not available
      },
    },
    
    features: {
      ssoEnabled: false,
      rbacEnabled: false,
      auditLogsEnabled: false,
      piiControlsEnabled: false,
      vpcPeeringEnabled: false,
      byokEnabled: false,
      dataResidencyEnabled: false,
      customSlaEnabled: false,
      alertChannels: 2,
      customAlertRules: false,
      maxIntegrations: 3,
      webhooksEnabled: true,
      apiAccessLevel: 'read',
      maxTeamMembers: 5,
      sharedWorkspaces: false,
      supportLevel: 'standard',
      slaResponseTime: '24h',
    },
  },

  growth: {
    tier: 'growth',
    name: 'Growth',
    tagline: 'Scale with confidence and better economics',
    minimumMonthly: 500,
    
    traces: {
      pricePerThousandTraces: 0.40,   // $0.40 per 1K (20% cheaper)
      includedTraces: 250_000,         // 250K traces included = $100 value
    },
    
    payload: {
      includedKbPerTrace: 15,          // 15 KB/trace included
      overagePricePerGb: 0.20,         // $0.20/GB overage (20% cheaper)
    },
    
    retention: {
      baseDays: 30,                    // 30 days base retention
      extendedRetentionMultipliers: {
        30: 1.0,   // Free (included in base)
        60: 1.5,   // +50% for 60 days
        90: 2.0,   // +100% for 90 days
        180: 2.5,  // +150% for 180 days
        365: 0,    // Not available
      },
    },
    
    features: {
      ssoEnabled: true,                // SSO unlocked
      rbacEnabled: true,               // RBAC unlocked
      auditLogsEnabled: true,
      piiControlsEnabled: false,
      vpcPeeringEnabled: false,
      byokEnabled: false,
      dataResidencyEnabled: false,
      customSlaEnabled: false,
      alertChannels: 5,
      customAlertRules: true,
      maxIntegrations: 10,
      webhooksEnabled: true,
      apiAccessLevel: 'full',
      maxTeamMembers: 15,
      sharedWorkspaces: true,
      supportLevel: 'priority',
      slaResponseTime: '4h',
    },
  },

  business: {
    tier: 'business',
    name: 'Business',
    tagline: 'Enterprise-grade security and compliance',
    minimumMonthly: 1000,
    
    traces: {
      pricePerThousandTraces: 0.35,   // $0.35 per 1K (30% cheaper than Starter)
      includedTraces: 500_000,         // 500K traces included = $175 value
    },
    
    payload: {
      includedKbPerTrace: 20,          // 20 KB/trace included
      overagePricePerGb: 0.15,         // $0.15/GB overage (40% cheaper)
    },
    
    retention: {
      baseDays: 30,                    // 30 days base
      extendedRetentionMultipliers: {
        30: 1.0,   // Free
        60: 1.3,   // +30% for 60 days
        90: 1.6,   // +60% for 90 days
        180: 2.0,  // +100% for 180 days
        365: 0,    // Not available
      },
    },
    
    features: {
      ssoEnabled: true,
      rbacEnabled: true,
      auditLogsEnabled: true,
      piiControlsEnabled: true,        // PII controls unlocked
      vpcPeeringEnabled: true,         // VPC peering unlocked
      byokEnabled: false,
      dataResidencyEnabled: false,
      customSlaEnabled: true,
      alertChannels: 10,
      customAlertRules: true,
      maxIntegrations: 25,
      webhooksEnabled: true,
      apiAccessLevel: 'full',
      maxTeamMembers: -1,              // Unlimited
      sharedWorkspaces: true,
      supportLevel: 'priority',
      slaResponseTime: '2h',
    },
  },

  enterprise: {
    tier: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom deployment and dedicated support',
    minimumMonthly: 3000,              // Negotiable based on volume
    
    traces: {
      pricePerThousandTraces: 0.30,   // $0.30 per 1K (volume pricing available)
      includedTraces: 1_000_000,       // 1M traces included = $300 value
    },
    
    payload: {
      includedKbPerTrace: 30,          // 30 KB/trace included
      overagePricePerGb: 0.10,         // $0.10/GB overage (60% cheaper)
    },
    
    retention: {
      baseDays: 30,
      extendedRetentionMultipliers: {
        30: 1.0,   // Free
        60: 1.2,   // +20%
        90: 1.4,   // +40%
        180: 1.8,  // +80%
        365: 2.5,  // +150% (Enterprise only)
      },
    },
    
    features: {
      ssoEnabled: true,
      rbacEnabled: true,
      auditLogsEnabled: true,
      piiControlsEnabled: true,
      vpcPeeringEnabled: true,
      byokEnabled: true,               // BYOK unlocked
      dataResidencyEnabled: true,      // Data residency unlocked
      customSlaEnabled: true,
      alertChannels: -1,               // Unlimited
      customAlertRules: true,
      maxIntegrations: -1,             // Unlimited
      webhooksEnabled: true,
      apiAccessLevel: 'full',
      maxTeamMembers: -1,
      sharedWorkspaces: true,
      supportLevel: 'dedicated',       // Dedicated support engineer
      slaResponseTime: '1h',
    },
    
    volumeDiscounts: [
      { traceCommitment: 10_000_000, discountPercent: 10 },  // 10M traces/mo = 10% off
      { traceCommitment: 50_000_000, discountPercent: 20 },  // 50M traces/mo = 20% off
      { traceCommitment: 100_000_000, discountPercent: 30 }, // 100M traces/mo = 30% off
    ],
  },
};

/**
 * Calculate monthly cost for a given usage
 */
export function calculateMonthlyUsageCost(
  tier: UsageTier,
  usage: {
    rootTraces: number;           // Number of root traces monitored
    totalPayloadGb: number;       // Total payload size in GB
    retentionDays: 30 | 60 | 90 | 180 | 365;
  }
): {
  baseCost: number;
  traceCost: number;
  payloadCost: number;
  retentionMultiplier: number;
  totalCost: number;
  breakdown: string[];
} {
  const plan = USAGE_PLANS[tier];
  
  // Trace cost
  const tracesOverIncluded = Math.max(0, usage.rootTraces - plan.traces.includedTraces);
  const traceCost = (tracesOverIncluded / 1000) * plan.traces.pricePerThousandTraces;
  
  // Payload cost
  const includedPayloadGb = (usage.rootTraces * plan.payload.includedKbPerTrace) / 1_000_000; // KB to GB
  const payloadOverage = Math.max(0, usage.totalPayloadGb - includedPayloadGb);
  const payloadCost = payloadOverage * plan.payload.overagePricePerGb;
  
  // Retention multiplier
  const retentionMultiplier = plan.retention.extendedRetentionMultipliers[usage.retentionDays] || 1.0;
  
  // Total
  const baseCost = plan.minimumMonthly;
  const usageCost = (traceCost + payloadCost) * retentionMultiplier;
  const totalCost = Math.max(baseCost, baseCost + usageCost);
  
  const breakdown = [
    `Base minimum: $${baseCost}`,
    `Trace overage: $${traceCost.toFixed(2)} (${tracesOverIncluded.toLocaleString()} traces beyond included)`,
    `Payload overage: $${payloadCost.toFixed(2)} (${payloadOverage.toFixed(2)} GB beyond included)`,
    `Retention multiplier: ${retentionMultiplier}x (${usage.retentionDays} days)`,
    `Total usage charges: $${usageCost.toFixed(2)}`,
  ];
  
  return {
    baseCost,
    traceCost,
    payloadCost,
    retentionMultiplier,
    totalCost,
    breakdown,
  };
}

/**
 * Format usage limits for display
 */
export function formatUsageLimits(tier: UsageTier): string[] {
  const plan = USAGE_PLANS[tier];
  
  return [
    `${(plan.traces.includedTraces / 1000).toFixed(0)}K traces/month included`,
    `$${plan.traces.pricePerThousandTraces}/1K traces after`,
    `${plan.payload.includedKbPerTrace} KB/trace included`,
    `$${plan.payload.overagePricePerGb}/GB payload overage`,
    `${plan.retention.baseDays} days base retention`,
    `${plan.features.maxTeamMembers === -1 ? 'Unlimited' : plan.features.maxTeamMembers} team members`,
  ];
}

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(tier: UsageTier, feature: keyof TierFeatures): boolean {
  const plan = USAGE_PLANS[tier];
  const value = plan.features[feature];
  
  // Boolean features
  if (typeof value === 'boolean') return value;
  
  // Numeric features (-1 = unlimited, 0 = disabled)
  if (typeof value === 'number') return value !== 0;
  
  // String features (support level, etc.)
  return true;
}

/**
 * Get volume discount for Enterprise tier
 */
export function getVolumeDiscount(traceCommitment: number): number {
  const enterprisePlan = USAGE_PLANS.enterprise;
  if (!enterprisePlan.volumeDiscounts) return 0;
  
  // Find highest applicable discount
  const applicableDiscounts = enterprisePlan.volumeDiscounts
    .filter(d => traceCommitment >= d.traceCommitment)
    .sort((a, b) => b.discountPercent - a.discountPercent);
  
  return applicableDiscounts[0]?.discountPercent || 0;
}
