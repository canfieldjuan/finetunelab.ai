/**
 * FineTune Lab Cloud Training Pricing Configuration
 * Hybrid pricing model: 15% markup with $0.20 minimum
 * Date: 2025-11-14
 */

export interface GPUPricingTier {
  id: string;
  name: string;
  vram_gb: number;
  base_cost_per_hour: number;
  platform_fee_per_hour: number;
  total_cost_per_hour: number;
  speed_rating: 'Moderate' | 'Fast' | 'Very Fast' | 'Extreme';
  recommended_for: string;
}

const MARKUP_PERCENTAGE = 0.15;
const MINIMUM_MARKUP = 0.20;

function calculateMarkup(baseCost: number): number {
  const percentageMarkup = baseCost * MARKUP_PERCENTAGE;
  return Math.max(percentageMarkup, MINIMUM_MARKUP);
}

function calculateTotal(baseCost: number): number {
  return baseCost + calculateMarkup(baseCost);
}

export const GPU_PRICING_TIERS: GPUPricingTier[] = [
  {
    id: 'RTX_A4000',
    name: 'RTX A4000',
    vram_gb: 16,
    base_cost_per_hour: 0.34,
    platform_fee_per_hour: calculateMarkup(0.34),
    total_cost_per_hour: calculateTotal(0.34),
    speed_rating: 'Moderate',
    recommended_for: 'Small models (< 7B parameters)',
  },
  {
    id: 'RTX_A5000',
    name: 'RTX A5000',
    vram_gb: 24,
    base_cost_per_hour: 0.49,
    platform_fee_per_hour: calculateMarkup(0.49),
    total_cost_per_hour: calculateTotal(0.49),
    speed_rating: 'Fast',
    recommended_for: 'Medium models (7-13B parameters)',
  },
  {
    id: 'RTX_A6000',
    name: 'RTX A6000',
    vram_gb: 48,
    base_cost_per_hour: 0.79,
    platform_fee_per_hour: calculateMarkup(0.79),
    total_cost_per_hour: calculateTotal(0.79),
    speed_rating: 'Fast',
    recommended_for: 'Large models (13-30B parameters)',
  },
  {
    id: 'A100_PCIE',
    name: 'A100 PCIe',
    vram_gb: 40,
    base_cost_per_hour: 1.89,
    platform_fee_per_hour: calculateMarkup(1.89),
    total_cost_per_hour: calculateTotal(1.89),
    speed_rating: 'Very Fast',
    recommended_for: 'Large models with high performance needs',
  },
  {
    id: 'A100_SXM',
    name: 'A100 SXM',
    vram_gb: 80,
    base_cost_per_hour: 2.89,
    platform_fee_per_hour: calculateMarkup(2.89),
    total_cost_per_hour: calculateTotal(2.89),
    speed_rating: 'Very Fast',
    recommended_for: 'Very large models (30-70B parameters)',
  },
  {
    id: 'A100_80GB',
    name: 'A100 80GB',
    vram_gb: 80,
    base_cost_per_hour: 2.89,
    platform_fee_per_hour: calculateMarkup(2.89),
    total_cost_per_hour: calculateTotal(2.89),
    speed_rating: 'Very Fast',
    recommended_for: 'Very large models (30-70B parameters)',
  },
  {
    id: 'H100_PCIE',
    name: 'H100 PCIe',
    vram_gb: 80,
    base_cost_per_hour: 4.89,
    platform_fee_per_hour: calculateMarkup(4.89),
    total_cost_per_hour: calculateTotal(4.89),
    speed_rating: 'Extreme',
    recommended_for: 'Largest models (70B+ parameters)',
  },
];

export function getGPUPricingById(gpuId: string): GPUPricingTier | undefined {
  return GPU_PRICING_TIERS.find(tier => tier.id === gpuId);
}

export interface CostEstimate {
  base_cost: number;
  platform_fee: number;
  total_cost: number;
  hours: number;
  minutes: number;
}

export function calculateEstimatedCost(
  gpuId: string,
  estimatedHours: number,
  estimatedMinutes: number
): CostEstimate | null {
  const tier = getGPUPricingById(gpuId);
  if (!tier) return null;

  const totalHours = estimatedHours + (estimatedMinutes / 60);

  return {
    base_cost: tier.base_cost_per_hour * totalHours,
    platform_fee: tier.platform_fee_per_hour * totalHours,
    total_cost: tier.total_cost_per_hour * totalHours,
    hours: estimatedHours,
    minutes: estimatedMinutes,
  };
}
