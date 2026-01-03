/**
 * GET /api/billing/invoices
 * Returns invoice history for the authenticated user
 * 
 * Response includes:
 * - Invoice details (period, amount, status)
 * - Payment information
 * - Stripe invoice links
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface InvoiceData {
  id: string;
  period_month: number;
  period_year: number;
  period_start_date: string;
  period_end_date: string;
  total_cost: string;
  status: string;
  paid_at?: string | null;
  stripe_invoice_id?: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - missing authorization header' },
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: invoices, error: invoicesError } = await supabase
      .from('usage_invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(12);

    if (invoicesError) {
      console.error('[Invoices API] Error fetching invoices:', invoicesError);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

    const formattedInvoices = (invoices || []).map((invoice: InvoiceData) => ({
      id: invoice.id,
      periodMonth: invoice.period_month,
      periodYear: invoice.period_year,
      periodStartDate: invoice.period_start_date,
      periodEndDate: invoice.period_end_date,
      totalCost: parseFloat(invoice.total_cost),
      status: invoice.status,
      paidAt: invoice.paid_at,
      stripeInvoiceId: invoice.stripe_invoice_id,
    }));

    return NextResponse.json({ invoices: formattedInvoices });

  } catch (error) {
    console.error('[Invoices API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
