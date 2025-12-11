/**
 * StepHeader Component
 * Reusable collapsible header for training package workflow steps
 * Date: 2025-01-31
 * Phase 1: Foundation Components
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, CheckCircle, AlertCircle, Loader2, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepHeaderProps } from './types';
import { StepStatus } from './types';

console.log('[StepHeader] Component loaded');

/**
 * Get status icon component based on step status
 */
function getStatusIcon(status: StepStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />;
    case 'in_progress':
      return <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
    case 'not_started':
    default:
      return (
        <div className="w-5 h-5 rounded-full border-2 border-muted-foreground opacity-50" />
      );
  }
}

/**
 * Get status text color classes based on step status
 */
function getStatusColor(status: StepStatus): string {
  switch (status) {
    case 'completed':
      return 'text-green-600 dark:text-green-400';
    case 'in_progress':
      return 'text-blue-600 dark:text-blue-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'not_started':
    default:
      return 'text-muted-foreground';
  }
}

/**
 * Get status text label
 */
function getStatusLabel(status: StepStatus): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
      return 'In Progress';
    case 'error':
      return 'Error';
    case 'not_started':
    default:
      return 'Not Started';
  }
}

/**
 * StepHeader: Collapsible header for workflow steps
 * Shows step number, title, status, and optional summary when collapsed
 */
export function StepHeader({
  stepId,
  number,
  title,
  status,
  summary,
  isActive,
  onEdit,
  disabled = false,
}: StepHeaderProps) {
  console.log('[StepHeader] Rendering', stepId, 'status:', status, 'active:', isActive);

  const canEdit = status === 'completed' && !disabled && onEdit;

  return (
    <div
      className={cn(
        'border rounded-lg transition-all duration-200',
        isActive ? 'border-primary shadow-md' : 'border-border',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Number + Icon + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Step Number */}
            <div
              className={cn(
                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                status === 'completed'
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : status === 'in_progress'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : status === 'error'
                  ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {number}
            </div>

            {/* Status Icon */}
            <div className="flex-shrink-0">{getStatusIcon(status)}</div>

            {/* Title and Status */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{title}</h3>
              <p className={cn('text-xs font-medium', getStatusColor(status))}>
                {getStatusLabel(status)}
              </p>
            </div>
          </div>

          {/* Right: Edit Button + Chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Edit Button (only for completed steps) */}
            {canEdit && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            )}

            {/* Collapse/Expand Indicator */}
            <ChevronDown
              className={cn(
                'w-5 h-5 transition-transform duration-200',
                isActive ? 'rotate-180' : '',
                disabled ? 'text-muted-foreground' : 'text-foreground'
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Summary (shown when collapsed) */}
        {!isActive && summary && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-muted-foreground line-clamp-2">{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}

console.log('[StepHeader] Component defined');
