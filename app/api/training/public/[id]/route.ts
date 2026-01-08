// Public Training Config API
// GET /api/training/public/{public_id} - Get public training config
// No authentication required
// Date: 2025-10-16

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// CORS headers for cross-origin access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  console.log('[PublicConfigAPI] GET: Fetching public config:', resolvedParams.id);

  try {
    const publicId = resolvedParams.id;

    if (!publicId) {
      return NextResponse.json(
        { error: 'Public ID required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch public config
    const { data, error } = await supabase
      .from('training_configs')
      .select('*')
      .eq('public_id', publicId)
      .eq('is_public', true)
      .single();

    if (error || !data) {
      console.error('[PublicConfigAPI] Config not found:', publicId);
      return NextResponse.json(
        { error: 'Config not found or not public' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Increment access counter
    await supabase.rpc('increment_config_access', { p_public_id: publicId });

    console.log('[PublicConfigAPI] Config accessed:', data.id);
    return NextResponse.json(
      { config: data },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[PublicConfigAPI] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch config' },
      { status: 500, headers: corsHeaders }
    );
  }
}
