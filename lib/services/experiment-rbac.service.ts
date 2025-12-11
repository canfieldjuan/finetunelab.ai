/**
 * Experiment RBAC Service
 *
 * Manages role-based access control for A/B testing experiments.
 * Phase 4.4: RBAC for Experiments
 * Date: 2025-12-16
 */

import { createClient } from '@/lib/supabase/client';

// ==================== Type Definitions ====================

export type ExperimentRole = 'owner' | 'editor' | 'analyst' | 'viewer';

export interface ExperimentMember {
  id: string;
  experiment_id: string;
  user_id: string;
  role: ExperimentRole;
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermissions {
  canView: boolean;
  canEdit: boolean;
  canAnalyze: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
}

// ==================== Role Hierarchy ====================

const ROLE_HIERARCHY: Record<ExperimentRole, number> = {
  owner: 4,
  editor: 3,
  analyst: 2,
  viewer: 1
};

export function getRolePermissions(role: ExperimentRole | null): RolePermissions {
  if (!role) {
    return {
      canView: false,
      canEdit: false,
      canAnalyze: false,
      canDelete: false,
      canManageMembers: false
    };
  }

  const level = ROLE_HIERARCHY[role];

  return {
    canView: level >= 1,
    canAnalyze: level >= 2,
    canEdit: level >= 3,
    canDelete: level >= 4,
    canManageMembers: level >= 4
  };
}

export function hasPermission(
  userRole: ExperimentRole | null,
  requiredRole: ExperimentRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// ==================== Member Management ====================

/**
 * Get all members of an experiment
 */
export async function getExperimentMembers(
  experimentId: string
): Promise<ExperimentMember[]> {
  console.log('[ExperimentRBAC] Fetching members for experiment:', experimentId);

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('ab_experiment_members')
      .select('*')
      .eq('experiment_id', experimentId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log('[ExperimentRBAC] Retrieved', data?.length || 0, 'members');
    return (data as ExperimentMember[]) || [];
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to fetch members';
    console.error('[ExperimentRBAC] Fetch error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Get user's role for an experiment
 */
export async function getUserRole(
  experimentId: string,
  userId?: string
): Promise<ExperimentRole | null> {
  console.log('[ExperimentRBAC] Getting user role:', { experimentId, userId });

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('get_user_experiment_role', {
        p_experiment_id: experimentId,
        p_user_id: userId || (await supabase.auth.getUser()).data.user?.id
      })
      .single();

    if (error) throw error;

    console.log('[ExperimentRBAC] User role:', data);
    return data as ExperimentRole | null;
  } catch (error) {
    console.error('[ExperimentRBAC] Get role error:', error);
    return null;
  }
}

/**
 * Add member to experiment
 */
export async function addMember(
  experimentId: string,
  userId: string,
  role: ExperimentRole = 'viewer'
): Promise<ExperimentMember> {
  console.log('[ExperimentRBAC] Adding member:', { experimentId, userId, role });

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('add_experiment_member', {
        p_experiment_id: experimentId,
        p_user_id: userId,
        p_role: role
      })
      .single();

    if (error) throw error;

    console.log('[ExperimentRBAC] Member added successfully');
    return data as ExperimentMember;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to add member';
    console.error('[ExperimentRBAC] Add member error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Remove member from experiment
 */
export async function removeMember(
  experimentId: string,
  userId: string
): Promise<boolean> {
  console.log('[ExperimentRBAC] Removing member:', { experimentId, userId });

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .rpc('remove_experiment_member', {
        p_experiment_id: experimentId,
        p_user_id: userId
      })
      .single();

    if (error) throw error;

    console.log('[ExperimentRBAC] Member removed successfully');
    return data as boolean;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to remove member';
    console.error('[ExperimentRBAC] Remove member error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  experimentId: string,
  userId: string,
  newRole: ExperimentRole
): Promise<ExperimentMember> {
  console.log('[ExperimentRBAC] Updating member role:', { experimentId, userId, newRole });

  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('ab_experiment_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('experiment_id', experimentId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    console.log('[ExperimentRBAC] Member role updated successfully');
    return data as ExperimentMember;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to update role';
    console.error('[ExperimentRBAC] Update role error:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Check if user can perform action on experiment
 */
export async function canUserPerformAction(
  experimentId: string,
  action: 'view' | 'edit' | 'analyze' | 'delete' | 'manage_members'
): Promise<boolean> {
  const role = await getUserRole(experimentId);
  if (!role) return false;

  const permissions = getRolePermissions(role);

  switch (action) {
    case 'view':
      return permissions.canView;
    case 'edit':
      return permissions.canEdit;
    case 'analyze':
      return permissions.canAnalyze;
    case 'delete':
      return permissions.canDelete;
    case 'manage_members':
      return permissions.canManageMembers;
    default:
      return false;
  }
}
