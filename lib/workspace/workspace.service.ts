/**
 * Workspace Management Service
 * Created: November 13, 2025
 * 
 * Handles workspace CRUD operations and membership management
 */

import { supabase } from '../supabaseClient';
import type { 
  Workspace, 
  WorkspaceMember, 
  CreateWorkspaceParams,
  UpdateWorkspaceParams,
  WorkspaceRole,
  WorkspaceInvitation
} from './types';

export class WorkspaceService {
  /**
   * Get all workspaces for current user (owned or member of)
   */
  static async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    try {
      // First, get workspace IDs where user is a member
      const { data: memberships, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userId);

      if (memberError) {
        console.error('[WorkspaceService] Error fetching memberships:', memberError);
        // Don't throw - continue with just owned workspaces
      }

      const memberWorkspaceIds = memberships?.map(m => m.workspace_id) || [];

      // Now fetch workspaces: owned by user OR user is a member
      let query = supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      // If user has member workspaces, include them in the query
      if (memberWorkspaceIds.length > 0) {
        query = query.or(`owner_id.eq.${userId},id.in.(${memberWorkspaceIds.join(',')})`);
      } else {
        // Just get owned workspaces
        query = query.eq('owner_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        // Check if error is due to table not existing
        const errorMessage = error.message || '';
        const isTableMissing = errorMessage.includes('relation "workspaces" does not exist') ||
                               errorMessage.includes('does not exist') ||
                               error.code === '42P01';

        if (isTableMissing) {
          console.warn('[WorkspaceService] Workspaces table does not exist yet. Run migration 001_add_workspaces.sql');
          return []; // Return empty array - workspace features disabled
        }

        console.error('[WorkspaceService] Error fetching workspaces:', error);
        throw new Error(`Failed to fetch workspaces: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('[WorkspaceService] getUserWorkspaces failed:', error);
      throw error;
    }
  }

  /**
   * Get or create personal workspace for user
   * Called automatically on first login/session
   */
  static async ensurePersonalWorkspace(
    userId: string, 
    userEmail?: string
  ): Promise<Workspace | null> {
    try {
      console.log('[WorkspaceService] ensurePersonalWorkspace called with userId:', userId);
      
      // Check current auth session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[WorkspaceService] Current session:', {
        hasSession: !!session,
        sessionUserId: session?.user?.id,
        matchesRequestUserId: session?.user?.id === userId
      });
      
      // If no session, can't query due to RLS
      if (!session) {
        console.warn('[WorkspaceService] No active session - cannot query workspaces due to RLS');
        return null;
      }
      
      // Check if personal workspace exists
      console.log('[WorkspaceService] DEBUG: About to query with type="personal"');
      const { data: existing, error: fetchError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId)
        .eq('type', 'personal')
        .maybeSingle();
      console.log('[WorkspaceService] DEBUG: Query executed');
      
      console.log('[WorkspaceService] Query result:', { 
        hasData: !!existing, 
        dataCount: existing ? 1 : 0,
        hasError: !!fetchError,
        errorDetails: fetchError ? {
          message: fetchError.message,
          code: fetchError.code,
          details: fetchError.details,
          hint: fetchError.hint
        } : null
      });

      if (fetchError) {
        // Check if error is due to table not existing (migration not run yet)
        const errorMessage = fetchError.message || '';
        const isTableMissing = errorMessage.includes('relation "workspaces" does not exist') ||
                               errorMessage.includes('does not exist') ||
                               fetchError.code === '42P01'; // PostgreSQL "undefined table" code
        
        if (isTableMissing) {
          console.warn('[WorkspaceService] Workspaces table does not exist yet. Run migration 001_add_workspaces.sql');
          return null; // Gracefully return null - workspace features disabled until migration
        }
        
        console.error('[WorkspaceService] Error checking for workspace:', fetchError);
        console.error('[WorkspaceService] Error details:', {
          message: fetchError?.message || 'No message',
          code: fetchError?.code || 'No code',
          details: fetchError?.details || 'No details',
          hint: fetchError?.hint || 'No hint',
          raw: JSON.stringify(fetchError, null, 2),
        });
        throw fetchError;
      }

      if (existing) {
        return existing;
      }

      // Create personal workspace
      const workspaceName = userEmail || 'My Workspace';
      const { data: workspace, error: createError } = await supabase
        .from('workspaces')
        .insert({
          // owner_id will be auto-set to auth.uid() by database default
          name: workspaceName,
          type: 'personal',
          settings: {}
        })
        .select()
        .single();

      if (createError) {
        console.error('[WorkspaceService] Error creating workspace:', createError);
        throw createError;
      }

      // Add user as owner in workspace_members
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner'
        });

      if (memberError) {
        console.error('[WorkspaceService] Error adding member:', memberError);
        // Non-fatal - workspace still created
      }

      console.log('[WorkspaceService] Created personal workspace:', workspace.id);
      return workspace;
    } catch (error) {
      console.error('[WorkspaceService] ensurePersonalWorkspace failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
        errorKeys: error && typeof error === 'object' ? Object.keys(error) : []
      });
      throw error;
    }
  }

  /**
   * Get a specific workspace by ID
   */
  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('[WorkspaceService] Error fetching workspace:', error);
      throw new Error(`Failed to fetch workspace: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new workspace (team workspace)
   */
  static async createWorkspace(
    userId: string, 
    params: CreateWorkspaceParams
  ): Promise<Workspace> {
    console.log('[WorkspaceService] Creating workspace:', { userId, params });
    
    // Don't pass owner_id - it will be set automatically via DEFAULT auth.uid()
    // This ensures RLS policy (owner_id = auth.uid()) passes
    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        // owner_id will be auto-set to auth.uid() by database default
        name: params.name,
        type: params.type || 'team',
        settings: params.settings || {}
      })
      .select()
      .single();

    if (createError) {
      console.error('[WorkspaceService] Error creating workspace:', {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code,
        raw: JSON.stringify(createError, null, 2)
      });
      throw new Error(`Failed to create workspace: ${createError.message || 'Unknown error'}`);
    }

    console.log('[WorkspaceService] Workspace created, adding owner as member:', workspace.id);

    // Add creator as owner in workspace_members
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        role: 'owner'
      });

    if (memberError) {
      console.error('[WorkspaceService] Error adding owner as member:', {
        message: memberError.message,
        details: memberError.details,
        hint: memberError.hint,
        code: memberError.code
      });
      // Non-fatal - workspace still created
    }

    console.log('[WorkspaceService] Created workspace successfully:', workspace.id);
    return workspace;
  }

  /**
   * Update workspace details
   */
  static async updateWorkspace(
    workspaceId: string,
    params: UpdateWorkspaceParams
  ): Promise<Workspace> {
    const updateData: Partial<Workspace> = {};
    
    if (params.name !== undefined) updateData.name = params.name;
    if (params.settings !== undefined) updateData.settings = params.settings;

    const { data, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('[WorkspaceService] Error updating workspace:', error);
      throw new Error(`Failed to update workspace: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a workspace (owner only)
   */
  static async deleteWorkspace(workspaceId: string): Promise<void> {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);

    if (error) {
      console.error('[WorkspaceService] Error deleting workspace:', error);
      throw new Error(`Failed to delete workspace: ${error.message}`);
    }

    console.log('[WorkspaceService] Deleted workspace:', workspaceId);
  }

  /**
   * Get workspace members
   */
  static async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('[WorkspaceService] Error fetching members:', error);
      throw new Error(`Failed to fetch workspace members: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Add member to workspace by user ID
   */
  static async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    invitedBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: role,
        invited_by: invitedBy
      });

    if (error) {
      console.error('[WorkspaceService] Error adding member:', error);
      throw new Error(`Failed to add member: ${error.message}`);
    }

    console.log('[WorkspaceService] Added member to workspace:', workspaceId);
  }

  /**
   * Add member to workspace by email (requires email lookup first)
   * For use in API routes where user lookup can be performed
   */
  static async addMemberByEmail(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _invitation: WorkspaceInvitation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _invitedBy: string
  ): Promise<void> {
    // This method should be called from API routes where supabaseAdmin is available
    // For client-side use, use addMember with userId directly
    throw new Error('Email-based invitations must be processed via API route');
  }

  /**
   * Remove member from workspace
   */
  static async removeMember(workspaceId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      console.error('[WorkspaceService] Error removing member:', error);
      throw new Error(`Failed to remove member: ${error.message}`);
    }

    console.log('[WorkspaceService] Removed member from workspace:', workspaceId);
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<void> {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      console.error('[WorkspaceService] Error updating role:', error);
      throw new Error(`Failed to update member role: ${error.message}`);
    }

    console.log('[WorkspaceService] Updated member role in workspace:', workspaceId);
  }

  /**
   * Check if user is member of workspace
   */
  static async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[WorkspaceService] Error checking membership:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Get user's role in workspace
   */
  static async getUserRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[WorkspaceService] Error fetching role:', error);
      return null;
    }

    return data?.role || null;
  }
}
