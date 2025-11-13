/**
 * Stripe Client Singleton
 * Initializes Stripe with server-side secret key
 * Date: 2025-10-24
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables');
}

/**
 * Stripe singleton instance
 * Used for all server-side Stripe operations
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-10-29.clover',
  typescript: true,
  appInfo: {
    name: 'Bagel RL Platform',
    version: '1.0.0',
  },
});

/**
 * Helper to get Stripe price ID from plan selection
 * NOTE: Pro Plus price IDs must be added to .env before testing
 */
export function getPriceId(plan: 'pro' | 'pro_plus' | 'enterprise', billing: 'monthly' | 'yearly'): string {
  const priceMap = {
    pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    pro_plus_monthly: process.env.STRIPE_PRICE_PRO_PLUS_MONTHLY,
    pro_plus_yearly: process.env.STRIPE_PRICE_PRO_PLUS_YEARLY,
    enterprise_monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    enterprise_yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  };

  const key = `${plan}_${billing}` as keyof typeof priceMap;
  const priceId = priceMap[key];

  if (!priceId) {
    throw new Error(`Price ID not found for ${plan} ${billing}. Check .env for STRIPE_PRICE_${plan.toUpperCase()}_${billing.toUpperCase()}`);
  }

  return priceId;
}

/**
 * Helper to get plan name from Stripe price ID
 */
export function getPlanFromPriceId(priceId: string): { plan: string; billing: string } | null {
  const priceMap = {
    [process.env.STRIPE_PRICE_PRO_MONTHLY || '']: { plan: 'pro', billing: 'monthly' },
    [process.env.STRIPE_PRICE_PRO_YEARLY || '']: { plan: 'pro', billing: 'yearly' },
    [process.env.STRIPE_PRICE_PRO_PLUS_MONTHLY || '']: { plan: 'pro_plus', billing: 'monthly' },
    [process.env.STRIPE_PRICE_PRO_PLUS_YEARLY || '']: { plan: 'pro_plus', billing: 'yearly' },
    [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '']: { plan: 'enterprise', billing: 'monthly' },
    [process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || '']: { plan: 'enterprise', billing: 'yearly' },
  };

  return priceMap[priceId] || null;
}
