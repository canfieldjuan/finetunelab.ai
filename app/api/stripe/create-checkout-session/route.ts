/**
 * Stripe Checkout Session Creation
 * POST /api/stripe/create-checkout-session
 *
 * Creates a Stripe checkout session for plan upgrades
 * Date: 2025-10-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, getPriceId } from '@/lib/stripe/client';
import type {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from '@/lib/stripe/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[Stripe] POST /api/stripe/create-checkout-session');

  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Stripe] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Stripe] Authenticated user:', user.id);

    // 2. Parse request body
    const body: CreateCheckoutSessionRequest = await request.json();
    const { plan, billing, seats = 1 } = body;

    console.log('[Stripe] Request received:', { plan, billing, seats });

    if (!plan || !billing) {
      return NextResponse.json(
        { error: 'Missing plan or billing cycle' },
        { status: 400 }
      );
    }

    if (!['pro', 'pro_plus', 'enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be pro, pro_plus, or enterprise' },
        { status: 400 }
      );
    }

    if (!['monthly', 'yearly'].includes(billing)) {
      return NextResponse.json(
        { error: 'Invalid billing cycle. Must be monthly or yearly' },
        { status: 400 }
      );
    }

    // Validate seats parameter
    if (seats < 1 || seats > 100) {
      return NextResponse.json(
        { error: 'Invalid seats. Must be between 1 and 100' },
        { status: 400 }
      );
    }

    console.log('[Stripe] Plan selection validated:', { plan, billing, seats });

    // 3. Get user's subscription record
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (subError) {
      console.error('[Stripe] Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription data' },
        { status: 500 }
      );
    }

    console.log('[Stripe] Current subscription:', subscription.stripe_customer_id);

    // 4. Get or create Stripe customer
    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
      console.log('[Stripe] Creating new Stripe customer');
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;
      console.log('[Stripe] Created customer:', customerId);

      // Update subscription with customer ID
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[Stripe] Error updating customer ID:', updateError);
      }
    }

    // 5. Get price ID for selected plan
    const priceId = getPriceId(plan, billing);
    console.log('[Stripe] Using price ID:', priceId);

    // 6. Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('[Stripe] Creating checkout session with:', {
      priceId,
      quantity: seats,
      plan,
      billing,
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: seats,
        },
      ],
      success_url: `${baseUrl}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/upgrade/cancel`,
      metadata: {
        supabase_user_id: user.id,
        plan_name: plan,
        billing_cycle: billing,
        seats: seats.toString(),
      },
      subscription_data: {
        trial_period_days: 15, // 15-day free trial
        metadata: {
          supabase_user_id: user.id,
          plan_name: plan,
          seats: seats.toString(),
        },
      },
    });

    console.log('[Stripe] Created checkout session:', session.id, 'for', seats, 'seats');

    // 7. Return session URL
    const response: CreateCheckoutSessionResponse = {
      sessionId: session.id,
      url: session.url || '',
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Stripe] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
