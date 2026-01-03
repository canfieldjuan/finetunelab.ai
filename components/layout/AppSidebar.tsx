/**
 * AppSidebar Component
 * Shared sidebar navigation for all authenticated pages
 * Date: 2025-10-17
 * Updated: 2025-10-30 - Phase 3: Added collapsible navigation groups
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import {
  MessageSquare,
  Boxes,
  Key,
  GraduationCap,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
  BookOpen,
  Zap,
  Code2,
  BookMarked,
  FileCode,
  AlertCircle,
  Rocket,
  Crown,
  FolderKanban,
  FileJson,
  Activity,
  TestTube2,
  Database,
  TrendingUp,
  Network,
  HardDrive
} from 'lucide-react';
import type { NavItem } from './CollapsibleNavGroup';
import { CollapsibleNavGroup } from './CollapsibleNavGroup';
import { WorkspaceSelector } from '@/components/workspace/WorkspaceSelector';
import { NotificationCenter } from '@/components/workspace/NotificationCenter';
import { ManageWorkspacesDialog } from '@/components/workspace/ManageWorkspacesDialog';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { FineTuneLabFullLogoV2 } from '@/components/branding';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppSidebarProps {
  currentPage: string;
  user: User | null;
  session?: Session | null;
  signOut: () => void;
  modelSelector?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppSidebar({
  currentPage,
  user,
  session,
  signOut,
  modelSelector,
  children,
}: AppSidebarProps) {
  // Workspace context
  const { workspaces } = useWorkspace();

  // State for collapsible groups - persisted in localStorage
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([]));

  // State for Manage Workspaces dialog
  const [showManageWorkspaces, setShowManageWorkspaces] = useState(false);

  // State for Settings dialog
  const [showSettings, setShowSettings] = useState(false);

  // Load expanded state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-expanded-groups');
    if (saved) {
      try {
        setExpandedGroups(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to parse saved sidebar state:', e);
      }
    }
  }, []);

  // Save expanded state to localStorage when changed
  useEffect(() => {
    localStorage.setItem('sidebar-expanded-groups', JSON.stringify(Array.from(expandedGroups)));
  }, [expandedGroups]);

  // Smart auto-expansion based on current page
  useEffect(() => {
    const newExpanded = new Set<string>();

    // Training group pages
    if (['training', 'training-monitor', 'finetuned-models', 'training-analytics'].includes(currentPage)) {
      newExpanded.add('training');
    }

    // Resources group pages
    if (['models', 'datasets'].includes(currentPage)) {
      newExpanded.add('resources');
    }

    // Evaluation group pages
    if (['testing', 'analytics', 'traces'].includes(currentPage)) {
      newExpanded.add('evaluation');
    }

    // Docs pages
    if (currentPage.startsWith('docs')) {
      newExpanded.add('docs');
    }

    // Default: expand all groups if none match
    if (newExpanded.size === 0 && !currentPage.startsWith('chat')) {
      newExpanded.add('training');
      newExpanded.add('resources');
      newExpanded.add('evaluation');
    }

    setExpandedGroups(newExpanded);
  }, [currentPage]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Navigation groups definition
  // Playground is separated for visual hierarchy
  const playgroundItem: NavItem = { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Playground' };

  // Worker Agents - standalone item for worker management
  const workerAgentsItem: NavItem = { id: 'workers', href: '/workers', icon: HardDrive, label: 'Worker Agents' };

  // Training group items
  const trainingItems: NavItem[] = [
    { id: 'training', href: '/training', icon: GraduationCap, label: 'Training Lab' },
    { id: 'training-monitor', href: '/training/monitor', icon: Activity, label: 'Monitor Training' },
    { id: 'training-analytics', href: '/training/analytics', icon: TrendingUp, label: 'Training Analytics' },
    { id: 'finetuned-models', href: '/finetuned-models', icon: Rocket, label: 'Finetuned Models' },
  ];

  // Resources group items
  const resourceItems: NavItem[] = [
    { id: 'models', href: '/models', icon: Boxes, label: 'Manage Models' },
    { id: 'datasets', href: '/datasets', icon: Database, label: 'Manage Datasets' },
  ];

  // Evaluation group items
  const evaluationItems: NavItem[] = [
    { id: 'testing', href: '/testing', icon: TestTube2, label: 'Model Testing' },
    { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Observability' },
    { id: 'traces', href: '/analytics/traces', icon: Network, label: 'Traces' },
  ];

  const docsItems: NavItem[] = [
    { id: 'docs-quickstart', href: '/docs/quick-start', icon: Zap, label: 'Quick Start' },
    { id: 'docs-features', href: '/docs/features', icon: Rocket, label: 'Features' },
    { id: 'docs-models', href: '/docs/models', icon: Boxes, label: 'Supported Models' },
    { id: 'docs-api', href: '/docs/api-reference', icon: Code2, label: 'API Reference' },
    { id: 'docs-api-spec', href: '/docs/api-spec', icon: FileJson, label: 'API Spec' },
    { id: 'docs-guides', href: '/docs/guides', icon: BookMarked, label: 'Guides' },
    { id: 'docs-examples', href: '/docs/examples', icon: FileCode, label: 'Examples' },
    { id: 'docs-troubleshooting', href: '/docs/troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
  ];


  return (
    <>
      <aside className="w-64 h-screen bg-secondary border-r flex flex-col">
        {/* Brand/Logo Section - FIXED, NO SCROLL */}
        <div className="p-4 pb-2 flex-shrink-0">
          <Link href="/chat" className="hover:opacity-80 transition-opacity">
            <FineTuneLabFullLogoV2 width={180} height={54} />
          </Link>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
      {/* Workspace Selector - Only show when user has multiple workspaces */}
      {workspaces.length > 1 && (
        <div className="mb-4 pb-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Workspace
            </span>
            <NotificationCenter />
          </div>
          <WorkspaceSelector />
        </div>
      )}

      {/* Model Selector Section - Only show on Chat page */}
      {modelSelector && (
        <div className="mb-4 pb-4 border-b">
          <div className="mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Model
            </span>
          </div>
          <div>
            {modelSelector}
          </div>
        </div>
      )}

      {/* Navigation Section */}
      <div className="mb-4 pb-4 border-b">
        {/* Show core items only when NOT on docs pages */}
        {!currentPage.startsWith('docs') && (
          <>
            {/* Playground - Separated for visual hierarchy */}
            <div className="mb-4">
              {(() => {
                const ItemIcon = playgroundItem.icon;
                const isActive = playgroundItem.id === currentPage;

                return (
                  <Link href={playgroundItem.href} className="block">
                    <button
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-muted'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <ItemIcon className="w-3.5 h-3.5" />
                      <span>{playgroundItem.label}</span>
                    </button>
                  </Link>
                );
              })()}
            </div>

            {/* Worker Agents - Separated for visual hierarchy */}
            <div className="mb-4">
              {(() => {
                const ItemIcon = workerAgentsItem.icon;
                const isActive = workerAgentsItem.id === currentPage;

                return (
                  <Link href={workerAgentsItem.href} className="block">
                    <button
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'hover:bg-muted'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <ItemIcon className="w-3.5 h-3.5" />
                      <span>{workerAgentsItem.label}</span>
                    </button>
                  </Link>
                );
              })()}
            </div>

            {/* Grouped Navigation Items - Flat layout with category headers */}
            <div className="space-y-4">
              {/* Training Group */}
              <CollapsibleNavGroup
                id="training"
                label="🎓 Training"
                icon={GraduationCap}
                items={trainingItems}
                currentPage={currentPage}
                expanded={true}
                onToggle={() => toggleGroup('training')}
                collapsible={false}
              />

              {/* Resources Group */}
              <CollapsibleNavGroup
                id="resources"
                label="📦 Resources"
                icon={Boxes}
                items={resourceItems}
                currentPage={currentPage}
                expanded={true}
                onToggle={() => toggleGroup('resources')}
                collapsible={false}
              />

              {/* Evaluation Group */}
              <CollapsibleNavGroup
                id="evaluation"
                label="🔬 Evaluation"
                icon={TestTube2}
                items={evaluationItems}
                currentPage={currentPage}
                expanded={true}
                onToggle={() => toggleGroup('evaluation')}
                collapsible={false}
              />
            </div>
          </>
        )}

        {/* Show docs navigation only when on docs pages */}
        {currentPage.startsWith('docs') && (
          <div className="mb-2 space-y-0.5">
            {docsItems.map((item) => {
              const ItemIcon = item.icon;
              const isActive = item.id === currentPage;

              return (
                <Link key={item.id} href={item.href} className="block">
                  <button
                    type="button"
                    className={`w-full text-left px-2.5 py-1.5 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-muted'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <ItemIcon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Children Slot - For Chat's conversations list */}
      {children && (
        <div className="mb-4">
          {children}
        </div>
      )}

      {/* User Settings Section */}
      {user && (
        <div className="mt-4 pt-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <SettingsIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{user.email}</span>
                </div>
                <span className="text-xs ml-2">▼</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              {/* Documentation Link */}
              <DropdownMenuItem asChild>
                <Link href="/docs" className="flex items-center gap-2 cursor-pointer">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Documentation</span>
                </Link>
              </DropdownMenuItem>
              {/* Upgrade Account Link */}
              <DropdownMenuItem asChild>
                <Link href="/upgrade" className="flex items-center gap-2 cursor-pointer">
                  <Crown className="w-3.5 h-3.5" />
                  <span>Upgrade Account</span>
                </Link>
              </DropdownMenuItem>
              {/* Account Settings Link */}
              <DropdownMenuItem asChild>
                <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Account Settings</span>
                </Link>
              </DropdownMenuItem>
              {/* Settings Button */}
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  console.log('[AppSidebar] Settings clicked, session:', session);
                  console.log('[AppSidebar] Has access_token:', !!session?.access_token);
                  setShowSettings(true);
                }}
                className="cursor-pointer"
              >
                <SettingsIcon className="w-3.5 h-3.5 mr-2" />
                <span>Settings</span>
              </DropdownMenuItem>
              {/* Secrets Vault Link */}
              <DropdownMenuItem asChild>
                <Link href="/secrets" className="flex items-center gap-2 cursor-pointer">
                  <Key className="w-3.5 h-3.5" />
                  <span>Secrets Vault</span>
                </Link>
              </DropdownMenuItem>
              {/* Manage Workspaces Button */}
              <DropdownMenuItem
                onClick={() => setShowManageWorkspaces(true)}
                className="cursor-pointer"
              >
                <FolderKanban className="w-3.5 h-3.5 mr-2" />
                <span>Manage Workspaces</span>
              </DropdownMenuItem>
              {/* Log Out Button */}
              <DropdownMenuItem
                onClick={signOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
        </div>
        {/* END SCROLLABLE CONTENT AREA */}
      </aside>

      {/* Manage Workspaces Dialog */}
      <ManageWorkspacesDialog
        isOpen={showManageWorkspaces}
        onClose={() => setShowManageWorkspaces(false)}
      />

      {/* Settings Dialog */}
      {session?.access_token ? (
        <SettingsDialog
          isOpen={showSettings}
          onClose={() => {
            console.log('[AppSidebar] Closing settings dialog');
            setShowSettings(false);
          }}
          sessionToken={session.access_token}
        />
      ) : (
        <>
          {showSettings && console.log('[AppSidebar] WARNING: Settings dialog requested but no session.access_token available')}
        </>
      )}
    </>
  );
}
