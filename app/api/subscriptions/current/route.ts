import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { GetCurrentSubscriptionResponse } from '@/lib/subscriptions/types';

export const runtime = 'nodejs';

/**
 * GET /api/subscriptions/current
 * Fetch current user's subscription with plan details
 */
export async function GET(request: NextRequest) {
  console.log('[Subscriptions API] GET /api/subscriptions/current');

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Subscriptions API] No authorization header');
      return NextResponse.json(
        { error: 'Unauthorized', subscription: null, plan: null },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Subscriptions API] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized', subscription: null, plan: null },
        { status: 401 }
      );
    }

    console.log('[Subscriptions API] Fetching subscription for user:', user.id);

    // Fetch user's subscription with plan details
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', user.id)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('[Subscriptions API] Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscription', subscription: null, plan: null },
        { status: 500 }
      );
    }

    // No subscription found (shouldn't happen due to auto-assignment)
    if (!subscription) {
      console.warn('[Subscriptions API] No subscription found for user:', user.id);
      return NextResponse.json({
        subscription: null,
        plan: null,
      });
    }

    console.log('[Subscriptions API] Subscription found:', subscription.id, 'Plan:', subscription.plan.name);

    const response: GetCurrentSubscriptionResponse = {
      subscription: {
        id: subscription.id,
        user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        stripe_customer_id: subscription.stripe_customer_id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        stripe_price_id: subscription.stripe_price_id,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancelled_at: subscription.cancelled_at,
        trial_start: subscription.trial_start,
        trial_end: subscription.trial_end,
        trial_ends_at: subscription.trial_ends_at,
        created_at: subscription.created_at,
        updated_at: subscription.updated_at,
      },
      plan: subscription.plan,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Subscriptions API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', subscription: null, plan: null },
      { status: 500 }
    );
  }
}
