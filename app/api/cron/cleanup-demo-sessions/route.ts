import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Enforce cron secret in production
  if (process.env.NODE_ENV === 'production' && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  }

  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { error } = await supabase.rpc('cleanup_expired_demo_sessions');
    
    if (error) {
      console.error('Cleanup error:', error);
      if (error.code === '42883') { // "function does not exist"
        return NextResponse.json({ error: 'The cleanup_expired_demo_sessions function is not installed in the database.' }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cleanup failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
