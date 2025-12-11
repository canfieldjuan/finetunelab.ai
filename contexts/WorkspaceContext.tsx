/**
 * Workspace Context Provider
 * Created: November 13, 2025
 * 
 * Provides workspace state and switching capabilities throughout the app
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { WorkspaceService } from '@/lib/workspace/workspace.service';
import type { Workspace } from '@/lib/workspace/types';

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => void;
  switchToWorkspaceFromList: (workspaceId: string, workspaceList: Workspace[]) => void;
  refreshWorkspaces: () => Promise<Workspace[]>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

interface WorkspaceProviderProps {
  children: React.ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    if (!user?.id) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setIsLoading(false);
      return [];
    }

    try {
      setIsLoading(true);
      setError(null);

      // Ensure user has personal workspace (returns null if tables don't exist)
      const personalWorkspace = await WorkspaceService.ensurePersonalWorkspace(
        user.id,
        user.email
      );

      // If workspace service returns null, tables don't exist yet - gracefully degrade
      if (!personalWorkspace) {
        console.warn('[WorkspaceContext] Workspace tables not found. Workspace features disabled until migration is run.');
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setIsLoading(false);
        return [];
      }

      // Load all workspaces
      const allWorkspaces = await WorkspaceService.getUserWorkspaces(user.id);
      setWorkspaces(allWorkspaces);

      // Set current workspace from localStorage or default to personal
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      if (savedWorkspaceId) {
        const savedWorkspace = allWorkspaces.find(w => w.id === savedWorkspaceId);
        if (savedWorkspace) {
          setCurrentWorkspace(savedWorkspace);
        } else {
          setCurrentWorkspace(personalWorkspace);
          localStorage.setItem('currentWorkspaceId', personalWorkspace.id);
        }
      } else {
        setCurrentWorkspace(personalWorkspace);
        localStorage.setItem('currentWorkspaceId', personalWorkspace.id);
      }

      return allWorkspaces;
    } catch (err) {
      console.error('[WorkspaceContext] Error loading workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
      // Don't throw - allow app to continue without workspace features
      setWorkspaces([]);
      setCurrentWorkspace(null);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
      localStorage.setItem('currentWorkspaceId', workspaceId);
      console.log('[WorkspaceContext] Switched to workspace:', workspaceId);
    } else {
      console.error('[WorkspaceContext] Workspace not found:', workspaceId);
    }
  }, [workspaces]);

  const switchToWorkspaceFromList = useCallback((workspaceId: string, workspaceList: Workspace[]) => {
    const workspace = workspaceList.find(w => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspace(workspace);
      localStorage.setItem('currentWorkspaceId', workspaceId);
      console.log('[WorkspaceContext] Switched to workspace:', workspaceId);
    } else {
      console.error('[WorkspaceContext] Workspace not found in provided list:', workspaceId);
    }
  }, []);

  const refreshWorkspaces = useCallback(async (): Promise<Workspace[]> => {
    return await loadWorkspaces();
  }, [loadWorkspaces]);

  const value: WorkspaceContextValue = {
    currentWorkspace,
    workspaces,
    isLoading,
    error,
    switchWorkspace,
    switchToWorkspaceFromList,
    refreshWorkspaces,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/**
 * Hook to access workspace context
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
