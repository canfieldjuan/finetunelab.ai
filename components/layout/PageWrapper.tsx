/**
 * PageWrapper Component
 * Standardized page layout with sidebar and content area
 */

import React from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import type { User } from '@supabase/supabase-js';

interface PageWrapperProps {
  currentPage: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  user: User | null; // TODO: Type this properly with User type
  signOut: () => void;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

export function PageWrapper({
  currentPage,
  children,
  maxWidth = '5xl',
  user,
  signOut
}: PageWrapperProps) {
  return (
    <div className="page-wrapper flex h-screen overflow-hidden bg-background">
      <AppSidebar currentPage={currentPage} user={user} signOut={signOut} />
      <div className="flex-1 overflow-y-auto bg-background main-content">
        <div className={`${maxWidthClasses[maxWidth]} mx-auto p-8`}>
          {children}
        </div>
      </div>
    </div>
  );
}
