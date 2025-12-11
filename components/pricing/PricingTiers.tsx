/**
 * Pricing Tiers Component
 * Beautiful pricing comparison cards for subscription plans
 */

'use client';

import { Check, Zap, Crown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS, formatLimit, getYearlySavings, type PlanTier } from '@/lib/pricing/config';
import { useState } from 'react';

interface PricingTiersProps {
  currentPlan: PlanTier;
  onUpgrade: (tier: PlanTier, billing: 'monthly' | 'yearly', seats: number) => void;
  onContactSales: () => void;
}

export function PricingTiers({ currentPlan, onUpgrade, onContactSales }: PricingTiersProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  const planOrder: PlanTier[] = ['free_trial', 'pro', 'pro_plus', 'enterprise'];
  const seats = 1; // Fixed to 1 user per plan

  const getPlanIcon = (tier: PlanTier) => {
    switch (tier) {
      case 'free_trial': return Zap;
      case 'pro': return Check;
      case 'pro_plus': return Crown;
      case 'enterprise': return Building2;
    }
  };

  const isCurrentPlan = (tier: PlanTier) => tier === currentPlan;

  const canUpgrade = (tier: PlanTier) => {
    const currentIndex = planOrder.indexOf(currentPlan);
    const targetIndex = planOrder.indexOf(tier);
    return targetIndex > currentIndex;
  };

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-4">
        <span className={`text-sm ${billingInterval === 'monthly' ? 'font-semibold' : 'text-muted-foreground'}`}>
          Monthly
        </span>
        <button
          onClick={() => setBillingInterval(billingInterval === 'monthly' ? 'yearly' : 'monthly')}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-gray-200 dark:bg-gray-700"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className={`text-sm ${billingInterval === 'yearly' ? 'font-semibold' : 'text-muted-foreground'}`}>
          Yearly
          <span className="ml-1 text-xs text-green-600 dark:text-green-400">(Save up to 11%)</span>
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {planOrder.map((tier) => {
          const plan = PLANS[tier];
          const Icon = getPlanIcon(tier);
          const price = billingInterval === 'monthly' ? plan.pricing.monthly : plan.pricing.yearly;
          const savings = billingInterval === 'yearly' ? getYearlySavings(plan) : 0;

          return (
            <div
              key={tier}
              className={`
                relative rounded-lg border p-6 flex flex-col
                ${plan.features.popular ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 dark:border-gray-700'}
                ${isCurrentPlan(tier) ? 'ring-2 ring-green-500' : ''}
              `}
            >
              {/* Popular Badge */}
              {plan.features.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current Plan Badge */}
              {isCurrentPlan(tier) && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Icon */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${
                  plan.features.popular ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    plan.features.popular ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
              </div>

              {/* Pricing */}
              <div className="mb-6">
                {plan.features.contactSales ? (
                  <div className="text-2xl font-bold">Custom Pricing</div>
                ) : price === 0 ? (
                  <div className="text-2xl font-bold">Free</div>
                ) : (
                  <>
                    {/* Total Price */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">
                        ${price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                    </div>

                    {/* Savings display */}
                    {billingInterval === 'yearly' && savings > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        Save ${savings.toLocaleString()}/year
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              {isCurrentPlan(tier) ? (
                <Button variant="outline" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : plan.features.contactSales ? (
                <Button
                  onClick={onContactSales}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Contact Sales
                </Button>
              ) : canUpgrade(tier) ? (
                <Button
                  onClick={() => onUpgrade(tier, billingInterval, seats)}
                  className={`w-full ${
                    plan.features.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : ''
                  }`}
                >
                  Upgrade to {plan.name}
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Not Available
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-12">
        <h3 className="text-xl font-bold mb-4">Detailed Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold">Feature</th>
                {planOrder.map((tier) => (
                  <th key={tier} className="text-center py-3 px-4 font-semibold">
                    {PLANS[tier].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-3 px-4 text-sm">Storage (Datasets/Logs)</td>
                {planOrder.map((tier) => (
                  <td key={tier} className="text-center py-3 px-4 text-sm">
                    {formatLimit(PLANS[tier].limits.storage_mb, ' MB')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm">Concurrent Training Jobs</td>
                {planOrder.map((tier) => (
                  <td key={tier} className="text-center py-3 px-4 text-sm">
                    {formatLimit(PLANS[tier].limits.concurrent_training_jobs)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm">Team Members</td>
                {planOrder.map((tier) => (
                  <td key={tier} className="text-center py-3 px-4 text-sm">
                    {formatLimit(PLANS[tier].limits.team_members)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
