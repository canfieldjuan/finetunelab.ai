/**
 * Workspace Settings Dialog
 * Created: November 13, 2025
 * 
 * Comprehensive workspace management:
 * - General settings (name, type)
 * - Members management (invite, remove, change roles)
 * - Danger zone (delete workspace)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { WorkspaceService } from '@/lib/workspace/workspace.service';
import { supabase } from '@/lib/supabaseClient';
import type { WorkspaceMember, WorkspaceRole } from '@/lib/workspace/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Settings, 
  Users, 
  Trash2, 
  UserPlus, 
  Crown,
  Shield,
  User,
  Eye,
  X,
  Loader2
} from 'lucide-react';

interface WorkspaceSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkspaceSettingsDialog({ isOpen, onClose }: WorkspaceSettingsDialogProps) {
  const { user } = useAuth();
  const { currentWorkspace, refreshWorkspaces, switchWorkspace, workspaces } = useWorkspace();
  
  // General settings state
  const [workspaceName, setWorkspaceName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  
  // Members state
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [userRole, setUserRole] = useState<WorkspaceRole | null>(null);
  
  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Load members when dialog opens
  useEffect(() => {
    const loadData = async () => {
      if (!isOpen || !currentWorkspace) return;
      
      setWorkspaceName(currentWorkspace.name);
      
      // Load members
      setIsLoadingMembers(true);
      try {
        const workspaceMembers = await WorkspaceService.getWorkspaceMembers(currentWorkspace.id);
        setMembers(workspaceMembers);
      } catch (err) {
        console.error('[WorkspaceSettings] Error loading members:', err);
      } finally {
        setIsLoadingMembers(false);
      }
      
      // Load user role
      if (!user?.id) return;
      
      // Owner check
      if (currentWorkspace.owner_id === user.id) {
        setUserRole('owner');
        return;
      }
      
      // Check membership role
      const role = await WorkspaceService.getUserRole(currentWorkspace.id, user.id);
      setUserRole(role);
    };
    
    loadData();
  }, [isOpen, currentWorkspace, user?.id]);

  const loadMembers = async () => {
    if (!currentWorkspace) return;
    
    setIsLoadingMembers(true);
    try {
      const workspaceMembers = await WorkspaceService.getWorkspaceMembers(currentWorkspace.id);
      setMembers(workspaceMembers);
    } catch (err) {
      console.error('[WorkspaceSettings] Error loading members:', err);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleSaveName = async () => {
    if (!currentWorkspace) return;
    
    const trimmedName = workspaceName.trim();
    
    if (!trimmedName) {
      setNameError('Workspace name cannot be empty');
      return;
    }
    
    if (trimmedName.length > 100) {
      setNameError('Workspace name must be 100 characters or less');
      return;
    }
    
    if (trimmedName === currentWorkspace.name) {
      return; // No change
    }
    
    setIsSavingName(true);
    setNameError(null);
    
    try {
      await WorkspaceService.updateWorkspace(currentWorkspace.id, {
        name: trimmedName
      });
      
      await refreshWorkspaces();
      console.log('[WorkspaceSettings] Workspace name updated');
    } catch (err) {
      console.error('[WorkspaceSettings] Error updating name:', err);
      setNameError(err instanceof Error ? err.message : 'Failed to update workspace name');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleInviteMember = async () => {
    if (!currentWorkspace || !user?.id) return;
    
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    
    if (!trimmedEmail) {
      setInviteError('Email address is required');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }
    
    setIsInviting(true);
    setInviteError(null);
    
    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setInviteError('You must be logged in to invite members');
        return;
      }
      
      const response = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          email: trimmedEmail,
          role: inviteRole
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite member');
      }
      
      // Success - refresh member list and reset form
      await loadMembers();
      setInviteEmail('');
      setInviteRole('member');
      
      console.log('[WorkspaceSettings] Member invited successfully');
    } catch (err) {
      console.error('[WorkspaceSettings] Error inviting member:', err);
      setInviteError(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!currentWorkspace) return;
    
    if (!confirm('Are you sure you want to remove this member?')) {
      return;
    }
    
    try {
      await WorkspaceService.removeMember(currentWorkspace.id, memberUserId);
      await loadMembers();
      console.log('[WorkspaceSettings] Member removed');
    } catch (err) {
      console.error('[WorkspaceSettings] Error removing member:', err);
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleChangeRole = async (memberUserId: string, newRole: WorkspaceRole) => {
    if (!currentWorkspace) return;
    
    // Cannot change owner role
    if (newRole === 'owner') return;
    
    try {
      await WorkspaceService.updateMemberRole(currentWorkspace.id, memberUserId, newRole);
      await loadMembers();
      console.log('[WorkspaceSettings] Member role updated');
    } catch (err) {
      console.error('[WorkspaceSettings] Error updating role:', err);
      alert(err instanceof Error ? err.message : 'Failed to update member role');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;
    
    if (deleteConfirmText !== currentWorkspace.name) {
      alert('Please type the workspace name exactly to confirm deletion');
      return;
    }
    
    setIsDeleting(true);
    
    try {
      await WorkspaceService.deleteWorkspace(currentWorkspace.id);
      
      // Switch to personal workspace
      const personalWorkspace = workspaces.find(w => w.type === 'personal');
      if (personalWorkspace) {
        switchWorkspace(personalWorkspace.id);
      }
      
      await refreshWorkspaces();
      onClose();
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch (err) {
      console.error('[WorkspaceSettings] Error deleting workspace:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete workspace');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />;
      case 'member': return <User className="h-4 w-4 text-gray-500" />;
      case 'viewer': return <Eye className="h-4 w-4 text-gray-400" />;
    }
  };

  const canManageMembers = userRole === 'owner' || userRole === 'admin';
  const canDelete = userRole === 'owner' && currentWorkspace?.type !== 'personal';

  if (!currentWorkspace) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Workspace Settings
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className={`grid w-full ${canDelete ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="general">
                <Settings className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="members">
                <Users className="h-4 w-4 mr-2" />
                Members
              </TabsTrigger>
              {canDelete && (
                <TabsTrigger value="danger">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Danger Zone
                </TabsTrigger>
              )}
            </TabsList>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="My Workspace"
                    maxLength={100}
                    disabled={userRole !== 'owner'}
                  />
                  {nameError && (
                    <p className="text-sm text-red-600 mt-1">{nameError}</p>
                  )}
                </div>

                <div>
                  <Label>Workspace Type</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {currentWorkspace.type}
                  </p>
                </div>

                <div>
                  <Label>Created</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(currentWorkspace.created_at).toLocaleDateString()}
                  </p>
                </div>

                {userRole === 'owner' && (
                  <Button
                    onClick={handleSaveName}
                    disabled={isSavingName || workspaceName === currentWorkspace.name}
                  >
                    {isSavingName && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                )}
              </div>
            </TabsContent>

            {/* Members Management */}
            <TabsContent value="members" className="space-y-4">
              {/* Invite Section */}
              {canManageMembers && (
                <div className="border rounded-lg p-4 space-y-3">
                  <h3 className="font-medium flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Invite Member
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={isInviting}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                      disabled={isInviting}
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <Button onClick={handleInviteMember} disabled={isInviting}>
                      {isInviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Invite
                    </Button>
                  </div>
                  {inviteError && (
                    <p className="text-sm text-red-600">{inviteError}</p>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                <h3 className="font-medium">Current Members ({members.length})</h3>
                {isLoadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const isOwner = member.user_id === currentWorkspace.owner_id;
                      const isCurrentUser = member.user_id === user?.id;
                      
                      return (
                        <div
                          key={member.user_id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {getRoleIcon(member.role)}
                            <div>
                              <p className="font-medium text-sm">
                                {member.user_id}
                                {isCurrentUser && ' (You)'}
                              </p>
                              <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!isOwner && canManageMembers && !isCurrentUser && (
                              <>
                                <select
                                  value={member.role}
                                  onChange={(e) => handleChangeRole(member.user_id, e.target.value as WorkspaceRole)}
                                  className="px-2 py-1 text-sm border rounded"
                                >
                                  <option value="admin">Admin</option>
                                  <option value="member">Member</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.user_id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Danger Zone */}
            {canDelete && (
              <TabsContent value="danger" className="space-y-4">
                <div className="border border-red-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-medium text-red-600 flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Workspace
                  </h3>
                  <p className="text-sm text-gray-600">
                    Once you delete a workspace, there is no going back. All conversations,
                    documents, and settings associated with this workspace will be permanently deleted.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    Delete This Workspace
                  </Button>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the workspace
              <span className="font-semibold"> {currentWorkspace.name}</span> and all
              associated data.
            </AlertDialogDescription>
            <div className="mt-4">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold">{currentWorkspace.name}</span> to confirm:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={currentWorkspace.name}
                className="mt-2"
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWorkspace}
              disabled={isDeleting || deleteConfirmText !== currentWorkspace.name}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Workspace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
