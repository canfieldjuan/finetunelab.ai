/**
 * Code Component
 * Displays code snippets with proper styling
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

export function Code({ children, className, ...props }: CodeProps) {
  const isMultiline =
    typeof children === 'string' && children.includes('\n');

  return (
    <code
      className={cn(
        'font-mono bg-muted rounded border border-border',
        isMultiline
          ? 'block text-sm px-3 py-2 whitespace-pre-wrap overflow-x-auto'
          : 'text-sm px-3 py-1.5',
        className
      )}
      {...props}
    >
      {children}
    </code>
  );
}
