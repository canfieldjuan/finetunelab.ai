import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id: workspaceId } = await params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { resourceType, resourceId, permissions, notes } = body;

    // Validate required fields
    if (!resourceType || !resourceId || !permissions || !Array.isArray(permissions)) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceType, resourceId, permissions' },
        { status: 400 }
      );
    }

    // Validate resource type
    const validResourceTypes = ['training_job', 'training_config', 'benchmark', 'dataset', 'conversation'];
    if (!validResourceTypes.includes(resourceType)) {
      return NextResponse.json(
        { error: `Invalid resource type. Must be one of: ${validResourceTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate permissions
    const validPermissions = ['view', 'comment', 'edit'];
    const invalidPerms = permissions.filter((p: string) => !validPermissions.includes(p));
    if (invalidPerms.length > 0) {
      return NextResponse.json(
        { error: `Invalid permissions: ${invalidPerms.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify user is a member of the workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    // Also check if user is the workspace owner
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .single();

    const isOwner = workspace?.owner_id === user.id;
    const isMember = !membershipError && membership;

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this workspace' },
        { status: 403 }
      );
    }

    // Check if resource is already shared (to prevent duplicates)
    const { data: existingShare } = await supabase
      .from('workspace_shared_resources')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .single();

    if (existingShare) {
      // Update existing share instead of creating duplicate
      const { error: updateError } = await supabase
        .from('workspace_shared_resources')
        .update({
          permissions,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingShare.id);

      if (updateError) {
        console.error('Error updating shared resource:', updateError);
        return NextResponse.json(
          { error: 'Failed to update shared resource' },
          { status: 500 }
        );
      }

      // Log activity for resource update
      await supabase.rpc('log_workspace_activity', {
        p_workspace_id: workspaceId,
        p_actor_id: user.id,
        p_activity_type: 'shared_resource',
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_metadata: {
          permissions,
          action: 'updated',
        },
      });

      return NextResponse.json({
        message: 'Resource share updated successfully',
        action: 'updated',
      });
    }

    // Create new shared resource
    const { data: sharedResource, error: shareError } = await supabase
      .from('workspace_shared_resources')
      .insert({
        workspace_id: workspaceId,
        resource_type: resourceType,
        resource_id: resourceId,
        shared_by: user.id,
        permissions,
        notes: notes || null,
      })
      .select()
      .single();

    if (shareError) {
      console.error('Error creating shared resource:', shareError);
      return NextResponse.json(
        { error: 'Failed to share resource' },
        { status: 500 }
      );
    }

    // Log activity for resource sharing
    await supabase.rpc('log_workspace_activity', {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_activity_type: `shared_${resourceType}`,
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_metadata: {
        permissions,
        has_notes: !!notes,
      },
    });

    return NextResponse.json({
      message: 'Resource shared successfully',
      action: 'created',
      data: sharedResource,
    });
  } catch (error) {
    console.error('Error in share API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Get shared resources for a workspace
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/workspaces/[id]/share'>
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id: workspaceId } = await context.params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use helper function to get shared resources
    const { data: sharedResources, error } = await supabase.rpc(
      'get_workspace_shared_resources',
      {
        p_workspace_id: workspaceId,
        p_resource_type: resourceType,
        p_limit: limit,
        p_offset: offset,
      }
    );

    if (error) {
      console.error('Error fetching shared resources:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shared resources' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: sharedResources || [],
      pagination: {
        limit,
        offset,
        hasMore: (sharedResources?.length || 0) === limit,
      },
    });
  } catch (error) {
    console.error('Error in share GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Delete a shared resource (unshare)
export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/workspaces/[id]/share'>
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { id: workspaceId } = await context.params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { resourceType, resourceId } = body;

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceType, resourceId' },
        { status: 400 }
      );
    }

    // Delete the shared resource
    const { error: deleteError } = await supabase
      .from('workspace_shared_resources')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId);

    if (deleteError) {
      console.error('Error deleting shared resource:', deleteError);
      return NextResponse.json(
        { error: 'Failed to unshare resource' },
        { status: 500 }
      );
    }

    // Log activity for resource unsharing
    await supabase.rpc('log_workspace_activity', {
      p_workspace_id: workspaceId,
      p_actor_id: user.id,
      p_activity_type: 'unshared_resource',
      p_resource_type: resourceType,
      p_resource_id: resourceId,
      p_metadata: {},
    });

    return NextResponse.json({
      message: 'Resource unshared successfully',
    });
  } catch (error) {
    console.error('Error in share DELETE API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
