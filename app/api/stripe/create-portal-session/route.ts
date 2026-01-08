/**
 * Stripe Customer Portal Session Creation
 * POST /api/stripe/create-portal-session
 *
 * Creates a Stripe billing portal session for subscription management
 * Date: 2025-10-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe/client';
import type { CreatePortalSessionResponse } from '@/lib/stripe/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('[Portal] POST /api/stripe/create-portal-session');

  try {
    // 1. Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[Portal] Missing authorization header');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Portal] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Portal] Authenticated user:', user.id);

    // 2. Get user's subscription with Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      console.error('[Portal] Error fetching subscription:', subError);
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    const customerId = subscription.stripe_customer_id;

    if (!customerId) {
      console.error('[Portal] User has no Stripe customer ID');
      return NextResponse.json(
        { error: 'No Stripe customer found. Please upgrade first.' },
        { status: 400 }
      );
    }

    console.log('[Portal] Found customer:', customerId);

    // 3. Create billing portal session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    console.log('[Portal] Creating portal session for customer:', customerId);
    console.log('[Portal] Return URL:', `${baseUrl}/account`);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/account`,
    });

    console.log('[Portal] Created portal session:', portalSession.id);

    // 4. Return portal URL
    const response: CreatePortalSessionResponse = {
      url: portalSession.url,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[Portal] Unexpected error:', error);
    if (error && typeof error === 'object') {
      console.error('[Portal] Error details:', {
        message: (error as { message?: string }).message,
        type: (error as { type?: string }).type,
        code: (error as { code?: string }).code,
        statusCode: (error as { statusCode?: number }).statusCode,
      });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        details: (error as { type?: string })?.type || 'unknown_error'
      },
      { status: 500 }
    );
  }
}
