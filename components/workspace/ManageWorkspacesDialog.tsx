/**
 * Manage Workspaces Dialog
 * Created: November 13, 2025
 *
 * Central workspace management hub:
 * - View all workspaces
 * - Switch active workspace
 * - Create new workspaces
 * - Access workspace settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Users,
  User,
  Plus,
  Settings,
  Check,
  Loader2
} from 'lucide-react';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';
import { WorkspaceSettingsDialog } from './WorkspaceSettingsDialog';

interface ManageWorkspacesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageWorkspacesDialog({ isOpen, onClose }: ManageWorkspacesDialogProps) {
  const { currentWorkspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [pendingSettingsOpen, setPendingSettingsOpen] = useState(false);

  // Open settings dialog after workspace switch completes
  useEffect(() => {
    if (pendingSettingsOpen && switchingTo === null && !isLoading) {
      setShowSettingsDialog(true);
      setPendingSettingsOpen(false);
    }
  }, [switchingTo, pendingSettingsOpen, isLoading]);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.id) return;

    setSwitchingTo(workspaceId);
    switchWorkspace(workspaceId);

    // Small delay to show feedback
    setTimeout(() => {
      setSwitchingTo(null);
    }, 300);
  };

  const getWorkspaceDisplayName = (workspace: typeof workspaces[0]) => {
    if (workspace.type === 'personal') {
      const userName = user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split('@')[0]
        || 'Personal';
      return userName;
    }
    return workspace.name;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage Workspaces
            </DialogTitle>
            <DialogDescription>
              View and switch between your workspaces
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Workspaces List */}
            <div className="space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : workspaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No workspaces found</p>
                </div>
              ) : (
                workspaces.map((workspace) => {
                  const isActive = workspace.id === currentWorkspace?.id;
                  const isSwitching = switchingTo === workspace.id;
                  const isOwner = workspace.owner_id === user?.id;

                  return (
                    <div
                      key={workspace.id}
                      className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                        isActive ? 'bg-accent border-primary' : 'hover:bg-muted'
                      }`}
                    >
                      <button
                        onClick={() => handleSwitchWorkspace(workspace.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                        disabled={isActive || isSwitching}
                      >
                        {workspace.type === 'personal' ? (
                          <User className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <Users className="h-4 w-4 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            isActive ? 'font-semibold' : ''
                          }`}>
                            {getWorkspaceDisplayName(workspace)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {workspace.type}
                            {isOwner && ' • Owner'}
                          </p>
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                        {isSwitching && (
                          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                        )}
                      </button>

                      {/* Settings button - only for owner or team workspaces */}
                      {(isOwner || workspace.type !== 'personal') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!isActive) {
                              // Switch to this workspace first, then open settings
                              handleSwitchWorkspace(workspace.id);
                              setPendingSettingsOpen(true);
                            } else {
                              // Already active, open settings immediately
                              setShowSettingsDialog(true);
                            }
                          }}
                          className="ml-2"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Create Workspace Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={() => setShowCreateDialog(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {/* Workspace Settings Dialog */}
      <WorkspaceSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />
    </>
  );
}
