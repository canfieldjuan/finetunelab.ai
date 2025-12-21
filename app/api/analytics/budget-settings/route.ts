/**
 * Budget Settings API
 * GET /api/analytics/budget-settings - Get user's budget settings
 * POST /api/analytics/budget-settings - Create or update budget setting
 * DELETE /api/analytics/budget-settings - Delete budget setting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface BudgetSetting {
  id: string;
  user_id: string;
  budget_type: 'daily' | 'weekly' | 'monthly';
  budget_limit_usd: number;
  alert_threshold_percent: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: settings, error: fetchError } = await supabase
      .from('budget_settings')
      .select('*')
      .eq('user_id', user.id)
      .order('budget_type', { ascending: true });

    if (fetchError) {
      console.error('[BudgetSettings] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch budget settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: settings || [],
    });
  } catch (error) {
    console.error('[BudgetSettings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { budget_type, budget_limit_usd, alert_threshold_percent, enabled } = body;

    if (!budget_type || !['daily', 'weekly', 'monthly'].includes(budget_type)) {
      return NextResponse.json({ error: 'Invalid budget_type' }, { status: 400 });
    }

    if (!budget_limit_usd || budget_limit_usd <= 0) {
      return NextResponse.json({ error: 'Invalid budget_limit_usd' }, { status: 400 });
    }

    const threshold = alert_threshold_percent || 80;
    if (threshold <= 0 || threshold > 100) {
      return NextResponse.json({ error: 'Invalid alert_threshold_percent' }, { status: 400 });
    }

    const { data: setting, error: upsertError } = await supabase
      .from('budget_settings')
      .upsert({
        user_id: user.id,
        budget_type,
        budget_limit_usd: Number(budget_limit_usd),
        alert_threshold_percent: threshold,
        enabled: enabled !== undefined ? enabled : true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,budget_type',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('[BudgetSettings] Upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save budget setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: setting,
    });
  } catch (error) {
    console.error('[BudgetSettings] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const budget_type = searchParams.get('budget_type');

    if (!budget_type || !['daily', 'weekly', 'monthly'].includes(budget_type)) {
      return NextResponse.json({ error: 'Invalid budget_type parameter' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('budget_settings')
      .delete()
      .eq('user_id', user.id)
      .eq('budget_type', budget_type);

    if (deleteError) {
      console.error('[BudgetSettings] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete budget setting' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Budget setting deleted',
    });
  } catch (error) {
    console.error('[BudgetSettings] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
