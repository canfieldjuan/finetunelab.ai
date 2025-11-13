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
import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Boxes,
  Key,
  GraduationCap,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  GitBranch,
  Home,
  User as UserIcon,
  ChevronDown,
  BookOpen,
  Zap,
  Code2,
  BookMarked,
  FileCode,
  AlertCircle,
  Rocket
} from 'lucide-react';
import { CollapsibleNavGroup, NavItem } from './CollapsibleNavGroup';

interface AppSidebarProps {
  currentPage: string;
  user: User | null;
  signOut: () => void;
  modelSelector?: React.ReactNode;
  children?: React.ReactNode;
}

export function AppSidebar({
  currentPage,
  user,
  signOut,
  modelSelector,
  children,
}: AppSidebarProps) {
  const [showUserSettings, setShowUserSettings] = useState(false);
  
  // State for collapsible groups - persisted in localStorage
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([]));

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
    const trainingPages = ['training', 'dag', 'analytics'];
    const configPages = ['secrets'];
    const docsPages = ['docs-quickstart', 'docs-features', 'docs-api', 'docs-guides', 'docs-examples', 'docs-troubleshooting', 'docs'];

    if (trainingPages.includes(currentPage)) {
      setExpandedGroups(prev => new Set([...prev, 'training']));
    } else if (configPages.includes(currentPage)) {
      setExpandedGroups(prev => new Set([...prev, 'config']));
    } else if (docsPages.includes(currentPage) || currentPage.startsWith('docs')) {
      setExpandedGroups(prev => new Set([...prev, 'docs']));
    }
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
  const coreItems: NavItem[] = [
    { id: 'welcome', href: '/welcome', icon: Home, label: 'Home' },
    { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Chat' },
    { id: 'models', href: '/models', icon: Boxes, label: 'Models' },
  ];

  const trainingItems: NavItem[] = [
    { id: 'training', href: '/training', icon: GraduationCap, label: 'Training Jobs' },
    { id: 'dag', href: '/training/dag', icon: GitBranch, label: 'DAG Pipelines' },
    { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Analytics' },
  ];

  const configItems: NavItem[] = [
    { id: 'secrets', href: '/secrets', icon: Key, label: 'Secrets' },
  ];

  const docsItems: NavItem[] = [
    { id: 'docs-quickstart', href: '/docs/quick-start', icon: Zap, label: 'Quick Start' },
    { id: 'docs-features', href: '/docs/features', icon: Rocket, label: 'Features' },
    { id: 'docs-api', href: '/docs/api-reference', icon: Code2, label: 'API Reference' },
    { id: 'docs-guides', href: '/docs/guides', icon: BookMarked, label: 'Guides' },
    { id: 'docs-examples', href: '/docs/examples', icon: FileCode, label: 'Examples' },
    { id: 'docs-troubleshooting', href: '/docs/troubleshooting', icon: AlertCircle, label: 'Troubleshooting' },
  ];

  return (
    <aside className="w-64 h-screen bg-secondary border-r flex flex-col p-4">
      {/* Brand/Logo Section (optional) */}
      <div className="mb-6">
        <Link href="/chat">
          <h1 className="text-lg font-bold text-foreground">Fine Tune Lab</h1>
        </Link>
      </div>

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
        {/* Core Items - No header, directly rendered */}
        <div className="mb-2 space-y-0.5">
          {coreItems.map((item) => {
            const ItemIcon = item.icon;
            const isActive = item.id === currentPage;

            return (
              <Link key={item.id} href={item.href} className="block">
                <button
                  type="button"
                  className={`w-full text-left px-2.5 py-1.5 text-xs rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
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

        {/* Training Group - Collapsible */}
        <CollapsibleNavGroup
          id="training"
          label="Training"
          icon={GraduationCap}
          items={trainingItems}
          currentPage={currentPage}
          expanded={expandedGroups.has('training')}
          onToggle={() => toggleGroup('training')}
          collapsible={true}
        />

        {/* Configuration Group - Collapsible */}
        <CollapsibleNavGroup
          id="config"
          label="Configuration"
          icon={SettingsIcon}
          items={configItems}
          currentPage={currentPage}
          expanded={expandedGroups.has('config')}
          onToggle={() => toggleGroup('config')}
          collapsible={true}
        />

        {/* Documentation Group - Collapsible */}
        <CollapsibleNavGroup
          id="docs"
          label="Documentation"
          icon={BookOpen}
          items={docsItems}
          currentPage={currentPage}
          expanded={expandedGroups.has('docs')}
          onToggle={() => toggleGroup('docs')}
          collapsible={true}
        />
      </div>

      {/* Children Slot - For Chat's conversations list */}
      {children ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {children}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* User Settings Section */}
      {user && (
        <div className="relative mt-auto pt-4 border-t">
          {/* Settings Dropdown (appears above) */}
          {showUserSettings && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-background border rounded-lg shadow-lg z-20 py-1">
              {/* Account Settings Link */}
              <Link href="/account">
                <button
                  type="button"
                  onClick={() => setShowUserSettings(false)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-3 rounded-md cursor-pointer"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Account Settings</span>
                </button>
              </Link>
              {/* Log Out Button */}
              <button
                type="button"
                onClick={() => {
                  signOut();
                  setShowUserSettings(false);
                }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-destructive/10 text-destructive flex items-center gap-3 rounded-md cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          )}

          {/* User Email with Settings Icon */}
          <button
            type="button"
            onClick={() => setShowUserSettings(!showUserSettings)}
            className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <SettingsIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm truncate">{user.email}</span>
            </div>
            <span className="text-xs ml-2">▼</span>
          </button>
        </div>
      )}
    </aside>
  );
}
