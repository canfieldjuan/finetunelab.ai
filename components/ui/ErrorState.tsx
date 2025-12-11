/**
 * ErrorState Component
 * Standardized error display used across all pages
 */

import React from 'react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Retry'
}: ErrorStateProps) {
  return (
    <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
