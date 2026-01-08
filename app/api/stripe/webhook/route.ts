/**
 * Stripe Webhook Handler
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle
 * CRITICAL: This endpoint MUST verify webhook signatures
 * Date: 2025-10-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/client';
import Stripe from 'stripe';

export const runtime = 'nodejs';

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

type AdminSupabaseClient = SupabaseClient;

type SubscriptionPlan = {
  id: string;
  name: string;
};

type UserSubscriptionRow = {
  user_id: string;
};

export async function POST(request: NextRequest) {
  console.log('[Webhook] Received Stripe webhook');

  try {
    // 0. Validate Stripe configuration at runtime
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder_for_build') {
      console.error('[Webhook] STRIPE_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      );
    }

    // 1. Get raw body for signature verification
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] Missing stripe-signature header');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    // 2. Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('[Webhook] Event verified:', event.type);

    // 3. Initialize Supabase (service role for admin access)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY0NTE5MjgyMCwiZXhwIjoxOTYwNzY4ODIwfQ.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Route to appropriate handler based on event type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice, supabase);
        break;

      default:
        console.log('[Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[Webhook] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Updates subscription when user completes payment
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: AdminSupabaseClient
) {
  console.log('[Webhook] Handling checkout.session.completed:', session.id);

  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.supabase_user_id;

  if (!userId) {
    console.error('[Webhook] Missing user ID in session metadata');
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
  const priceId = subscription.items.data[0]?.price?.id ?? null;

  const firstItem = subscription.items.data[0];
  console.log('[Webhook] Subscription retrieved:', {
    id: subscription.id,
    status: subscription.status,
    current_period_start: firstItem?.current_period_start,
    current_period_end: firstItem?.current_period_end
  });

  // Get plan ID from database based on price
  const { data: plans } = await supabase
    .from('subscription_plans')
    .select('id, name')
    .in('name', ['pro', 'enterprise']);

  // Determine plan based on metadata or price
  const planName = session.metadata?.plan_name || 'pro';
  const availablePlans: SubscriptionPlan[] = (plans ?? []) as SubscriptionPlan[];
  const plan = availablePlans.find((p) => p.name === planName);

  if (!plan) {
    console.error('[Webhook] Could not determine plan');
    return;
  }

  // Convert timestamps safely (in Stripe v19, periods are on subscription items)
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : new Date().toISOString();

  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  console.log('[Webhook] Converted timestamps:', { periodStart, periodEnd });

  // Update user subscription
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan_id: plan.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Webhook] Error updating subscription:', error);
  } else {
    console.log('[Webhook] Subscription updated successfully for user:', userId);
  }
}

/**
 * Handle customer.subscription.updated
 * Updates subscription when changes occur (plan change, renewal, etc.)
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: AdminSupabaseClient
) {
  console.log('[Webhook] Handling subscription.updated:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('[Webhook] Missing user ID in subscription metadata');
    return;
  }

  // In Stripe v19, periods are on subscription items
  const subItem = subscription.items.data[0];

  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: subItem?.current_period_start
        ? new Date(subItem.current_period_start * 1000).toISOString()
        : new Date().toISOString(),
      current_period_end: subItem?.current_period_end
        ? new Date(subItem.current_period_end * 1000).toISOString()
        : new Date().toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Webhook] Error updating subscription:', error);
  } else {
    console.log('[Webhook] Subscription updated for user:', userId);
  }
}

/**
 * Handle customer.subscription.deleted
 * Handles subscription cancellations
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: AdminSupabaseClient
) {
  console.log('[Webhook] Handling subscription.deleted:', subscription.id);

  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error('[Webhook] Missing user ID in subscription metadata');
    return;
  }

  // Get free plan ID
  const { data: freePlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('name', 'free')
    .single();

  if (!freePlan) {
    console.error('[Webhook] Could not find free plan');
    return;
  }

  // Downgrade to free plan
  const { error } = await supabase
    .from('user_subscriptions')
    .update({
      plan_id: freePlan.id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_at_period_end: false,
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Webhook] Error downgrading to free:', error);
  } else {
    console.log('[Webhook] User downgraded to free plan:', userId);
  }
}

/**
 * Handle invoice.payment_succeeded
 * Logs successful payments (subscription renewals)
 */
async function handlePaymentSucceeded(
  invoice: Stripe.Invoice
) {
  console.log('[Webhook] Payment succeeded for invoice:', invoice.id);
  // Could add payment history tracking here in the future
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past_due when payment fails
 */
async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: AdminSupabaseClient
) {
  console.log('[Webhook] Payment failed for invoice:', invoice.id);

  const customerId = invoice.customer as string;

  // Find user by customer ID
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single<UserSubscriptionRow>();

  if (!subscription) {
    console.error('[Webhook] Could not find subscription for customer:', customerId);
    return;
  }

  // Update status to past_due
  const { error } = await supabase
    .from('user_subscriptions')
    .update({ status: 'past_due' })
    .eq('user_id', subscription.user_id);

  if (error) {
    console.error('[Webhook] Error updating status to past_due:', error);
  } else {
    console.log('[Webhook] Subscription marked as past_due:', subscription.user_id);
  }
}
