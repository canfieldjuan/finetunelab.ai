import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration: service role not available' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const hoursBackParam = searchParams.get('hours');
    const hours = Math.max(1, Math.min(parseInt(hoursBackParam || '24', 10) || 24, 168)); // 1..168 hours

    const { data, error } = await supabaseAdmin.rpc('web_search_telemetry_aggregate', { hours_back: hours });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, hours, rows: data || [] });
  } catch (error) {
    console.error('[TelemetryAggregateAPI] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

