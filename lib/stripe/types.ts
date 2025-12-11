/**
 * Stripe Integration Types
 * Date: 2025-10-24
 */

import Stripe from 'stripe';

/**
 * Plan selection for checkout
 */
export type PlanTier = 'pro' | 'pro_plus' | 'enterprise';
export type BillingCycle = 'monthly' | 'yearly';

/**
 * Checkout session creation request
 */
export interface CreateCheckoutSessionRequest {
  plan: PlanTier;
  billing: BillingCycle;
  seats?: number; // Number of seats/users (default: 1)
}

/**
 * Checkout session response
 */
export interface CreateCheckoutSessionResponse {
  sessionId: string;
  url: string;
}

/**
 * Stripe webhook event types we handle
 */
export type StripeWebhookEvent =
  | 'checkout.session.completed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.payment_succeeded'
  | 'invoice.payment_failed';

/**
 * Subscription status mapping
 */
export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'trialing'
  | 'paused'
  | 'incomplete'
  | 'incomplete_expired';

/**
 * Webhook event handler data
 */
export interface WebhookEventData {
  type: StripeWebhookEvent;
  data: Stripe.Event.Data;
}

/**
 * Customer portal session response
 */
export interface CreatePortalSessionResponse {
  url: string;
}
