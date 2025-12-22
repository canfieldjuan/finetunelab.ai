// API endpoint to get/update context injection preference
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create authenticated Supabase client that respects RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[API] Fetching context preference for user:', user.id);

    const { data, error } = await supabase
      .from('user_context_profiles')
      .select('enable_context_injection')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[API] Error fetching context preference:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const enabled = data?.enable_context_injection ?? true; // Default to true

    console.log('[API] Loaded context preference:', {
      userId: user.id,
      found: !!data,
      enabled,
      rawValue: data?.enable_context_injection
    });

    console.log('[API] RETURNING JSON:', JSON.stringify({ enabled }));
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('[API] Exception fetching context preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create authenticated Supabase client that respects RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { enabled } = await req.json();

    console.log('[API] Received toggle request:', { userId: user.id, enabled, type: typeof enabled });

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_context_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('[API] Existing profile:', existingProfile ? 'found' : 'not found');

    if (existingProfile) {
      // Update existing profile
      console.log('[API] Updating existing profile with enabled:', enabled);
      const { error } = await supabase
        .from('user_context_profiles')
        .update({ enable_context_injection: enabled })
        .eq('user_id', user.id);

      if (error) {
        console.error('[API] Error updating context preference:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Verify what was actually written
      const { data: verifyData } = await supabase
        .from('user_context_profiles')
        .select('enable_context_injection')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('[API] Verified DB value after update:', verifyData?.enable_context_injection);
    } else {
      // Create new profile with just this setting
      console.log('[API] Creating new profile with enabled:', enabled);
      const { error } = await supabase
        .from('user_context_profiles')
        .insert({
          user_id: user.id,
          enable_context_injection: enabled,
        });

      if (error) {
        console.error('[API] Error creating context preference:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Verify what was actually written
      const { data: verifyData } = await supabase
        .from('user_context_profiles')
        .select('enable_context_injection')
        .eq('user_id', user.id)
        .maybeSingle();

      console.log('[API] Verified DB value after insert:', verifyData?.enable_context_injection);
    }

    console.log('[API] Context injection preference saved:', { userId: user.id, enabled });

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    console.error('[API] Exception updating context preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
