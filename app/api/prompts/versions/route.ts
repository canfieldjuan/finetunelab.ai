import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xxxxxxxxxxxxx.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MjAsImV4cCI6MTk2MDc2ODgyMH0.M1YwMTExMTExMTExMTExMTExMTExMTExMTExMTExMTE';

interface PromptVersion {
  id?: string;
  user_id?: string;
  name: string;
  template: string;
  use_case?: string;
  version?: number;
  version_hash?: string;
  parent_version_id?: string | null;
  is_published?: boolean;
  is_archived?: boolean;
  change_summary?: string;
  tags?: string[];
  success_rate?: number | null;
  avg_rating?: number | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 });
  }

  const { data: versions, error } = await supabase
    .from('prompt_patterns')
    .select('*')
    .eq('user_id', user.id)
    .eq('name', name)
    .eq('is_archived', false)
    .order('version', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, versions });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, template, use_case, change_summary, tags, copy_from_version_id } = body;

  if (!name || !template) {
    return NextResponse.json({ error: 'Name and template are required' }, { status: 400 });
  }

  const { data: latestVersion } = await supabase
    .from('prompt_patterns')
    .select('id, version')
    .eq('user_id', user.id)
    .eq('name', name)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const newVersion = latestVersion ? latestVersion.version + 1 : 1;
  const parentVersionId = copy_from_version_id || latestVersion?.id || null;

  const { data: newPrompt, error: insertError } = await supabase
    .from('prompt_patterns')
    .insert({
      user_id: user.id,
      name,
      template,
      use_case: use_case || null,
      version: newVersion,
      parent_version_id: parentVersionId,
      change_summary: change_summary || `Version ${newVersion}`,
      tags: tags || [],
      is_published: false,
      metadata: {},
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: newPrompt });
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_published, tags, change_summary } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  if (is_published) {
    const { data: prompt } = await supabase
      .from('prompt_patterns')
      .select('name')
      .eq('id', id)
      .single();

    if (prompt) {
      await supabase
        .from('prompt_patterns')
        .update({ is_published: false })
        .eq('user_id', user.id)
        .eq('name', prompt.name);
    }
  }

  const updateData: Partial<PromptVersion> = {};
  if (is_published !== undefined) updateData.is_published = is_published;
  if (tags !== undefined) updateData.tags = tags;
  if (change_summary !== undefined) updateData.change_summary = change_summary;

  const { data: updated, error: updateError } = await supabase
    .from('prompt_patterns')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, prompt: updated });
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
  }

  const { error: deleteError } = await supabase
    .from('prompt_patterns')
    .update({ is_archived: true })
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
