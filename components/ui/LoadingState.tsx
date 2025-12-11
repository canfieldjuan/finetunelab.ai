/**
 * LoadingState Component
 * Standardized loading spinner used across all pages
 */

import React from 'react';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  message = 'Loading...',
  fullScreen = false,
  size = 'md'
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 border-2',
    md: 'w-16 h-16 border-4',
    lg: 'w-32 h-32 border-4'
  };

  const content = (
    <div className="text-center">
      <div
        className={`${sizeClasses[size]} border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4`}
      />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  );
}
