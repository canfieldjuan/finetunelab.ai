/**
 * AppSidebar Component
 * Shared sidebar navigation for all authenticated pages
 * Date: 2025-10-17
 */

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Boxes,
  Key,
  GraduationCap,
  BarChart3,
  Settings,
  LogOut,
  GitBranch,
  Home,
  User as UserIcon
} from 'lucide-react';

export interface SidebarMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  badge?: React.ReactNode;
}

export interface AppSidebarProps {
  currentPage: 'welcome' | 'chat' | 'models' | 'secrets' | 'training' | 'analytics' | 'dag' | 'account';
  user: User;
  signOut: () => void;
  children?: React.ReactNode; // For Chat page to insert conversations list
  menuItems?: SidebarMenuItem[];
  modelSelector?: React.ReactNode; // For Chat page to display model selector
}

export function AppSidebar({ currentPage, user, signOut, children, menuItems, modelSelector }: AppSidebarProps) {
  const [showUserSettings, setShowUserSettings] = useState(false);

  const navItems = [
    { id: 'welcome', href: '/welcome', icon: Home, label: 'Home' },
    { id: 'chat', href: '/chat', icon: MessageSquare, label: 'Chat' },
    { id: 'models', href: '/models', icon: Boxes, label: 'Models' },
    { id: 'secrets', href: '/secrets', icon: Key, label: 'Secrets' },
    { id: 'training', href: '/training', icon: GraduationCap, label: 'Training' },
    { id: 'dag', href: '/training/dag', icon: GitBranch, label: 'DAG Pipelines' },
    { id: 'analytics', href: '/analytics', icon: BarChart3, label: 'Analytics' },
    { id: 'account', href: '/account', icon: UserIcon, label: 'Account' },
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
        <div className="mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Navigation
          </span>
        </div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;

            return (
              <Link key={item.id} href={item.href} className="block">
                <button
                  className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
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
              {menuItems?.map((item) => {
                const Icon = item.icon;
                const disabled = !!item.disabled;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      item.onClick();
                      setShowUserSettings(false);
                    }}
                    disabled={disabled}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 rounded-md ${
                      disabled
                        ? 'text-muted-foreground cursor-not-allowed opacity-70'
                        : 'hover:bg-muted cursor-pointer'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-full">
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
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
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm truncate">{user.email}</span>
            </div>
            <span className="text-xs ml-2">▼</span>
          </button>
        </div>
      )}
    </aside>
  );
}
