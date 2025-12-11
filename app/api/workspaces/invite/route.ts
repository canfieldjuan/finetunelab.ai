/**
 * Workspace Member Invitation API
 * POST /api/workspaces/invite
 * 
 * Invites a user to a workspace by email
 * Requires admin or owner role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface InviteRequest {
  workspace_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
}

export async function POST(request: NextRequest) {
  try {
    // Create admin client with service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Get user from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: InviteRequest = await request.json();
    const { workspace_id, email, role } = body;

    if (!workspace_id || !email || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: workspace_id, email, role' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, member, or viewer' },
        { status: 400 }
      );
    }

    // Check if current user has permission to invite (owner or admin)
    const { data: currentMember, error: memberCheckError } = await supabase
      .from('workspace_members')
      .select('role, workspace_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberCheckError) {
      console.error('[API] Error checking membership:', memberCheckError);
      return NextResponse.json(
        { error: 'Failed to verify permissions' },
        { status: 500 }
      );
    }

    // Check if user is workspace owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspace_id)
      .maybeSingle();

    if (workspaceError) {
      console.error('[API] Error fetching workspace:', workspaceError);
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const isOwner = workspace?.owner_id === user.id;
    const isAdmin = currentMember?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only workspace owners and admins can invite members' },
        { status: 403 }
      );
    }

    // Look up user by email using admin auth API
    const { data: userList, error: userLookupError } = await supabase.auth.admin.listUsers();

    if (userLookupError) {
      console.error('[API] Error listing users:', userLookupError);
      return NextResponse.json(
        { error: 'Failed to look up user' },
        { status: 500 }
      );
    }

    const invitedUser = userList.users.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!invitedUser) {
      // User doesn't exist
      // In a production app, you might want to:
      // 1. Send an invitation email
      // 2. Store pending invitation in a separate table
      // 3. Auto-add them when they sign up
      
      return NextResponse.json(
        { error: 'User not found. They must create an account first.' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', invitedUser.id)
      .maybeSingle();

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this workspace' },
        { status: 400 }
      );
    }

    // Add user to workspace
    const { error: insertError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id,
        user_id: invitedUser.id,
        role,
        invited_by: user.id
      });

    if (insertError) {
      console.error('[API] Error adding member:', insertError);
      return NextResponse.json(
        { error: 'Failed to add member to workspace' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} added to workspace as ${role}`
    });

  } catch (error) {
    console.error('[API] Workspace invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
