/**
 * Workspace Type Definitions
 * Created: November 13, 2025
 */

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  type: 'personal' | 'team';
  created_at: string;
  updated_at: string;
  settings: Record<string, unknown>;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  invited_by?: string;
}

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface WorkspaceWithMembers extends Workspace {
  members?: WorkspaceMember[];
  member_count?: number;
}

export interface CreateWorkspaceParams {
  name: string;
  type?: 'personal' | 'team';
  settings?: Record<string, unknown>;
}

export interface UpdateWorkspaceParams {
  name?: string;
  settings?: Record<string, unknown>;
}

export interface WorkspaceInvitation {
  workspace_id: string;
  user_email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
}
