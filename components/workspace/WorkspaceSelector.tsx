/**
 * Workspace Selector Component
 * Created: November 13, 2025
 * Updated: November 13, 2025
 *
 * Quick workspace switcher dropdown (shown only when user has 2+ workspaces)
 * For workspace management (create, settings), use ManageWorkspacesDialog from bottom menu
 */

'use client';

import React from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Users, User } from 'lucide-react';

export function WorkspaceSelector() {
  const { currentWorkspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
  const { user } = useAuth();

  if (isLoading) {
    return null;
  }

  // Only show workspace selector if user has more than just their personal workspace
  if (workspaces.length <= 1) {
    return null;
  }

  // Get display name for current workspace
  const getDisplayName = () => {
    if (!currentWorkspace) return 'Select Workspace';

    if (currentWorkspace.type === 'personal') {
      // For personal workspace, show user's name
      const userName = user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split('@')[0]
        || 'Personal';
      return userName;
    } else {
      // For team workspaces, show workspace name
      return currentWorkspace.name;
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between"
            disabled={isLoading}
          >
            <span className="truncate">
              {getDisplayName()}
            </span>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => switchWorkspace(workspace.id)}
              className={currentWorkspace?.id === workspace.id ? 'bg-accent' : ''}
            >
              <div className="flex items-center gap-2">
                {workspace.type === 'personal' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                <span className="truncate">{workspace.name}</span>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
