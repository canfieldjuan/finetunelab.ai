/**
 * Cohort Card Component
 *
 * Reusable card component for displaying cohort summary information.
 * Shows name, description, type, metrics, and action buttons.
 *
 * Phase 3.2: Cohort Analysis UI
 * Date: 2025-10-25
 */

"use client";

import React from 'react';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import type { Cohort, CohortType } from '@/lib/services/cohort.service';

interface CohortCardProps {
  cohort: Cohort;
  isSelected: boolean;
  onSelect: (cohortId: string) => void;
  onRefresh?: (cohortId: string) => void;
}

export default function CohortCard({
  cohort,
  isSelected,
  onSelect,
  onRefresh
}: CohortCardProps) {
  console.log('[CohortCard] Rendering card for:', cohort.name);

  const getCohortTypeBadgeColor = (type: CohortType): string => {
    const colors = {
      static: 'bg-gray-100 text-gray-800',
      dynamic: 'bg-blue-100 text-blue-800',
      behavioral: 'bg-green-100 text-green-800',
      subscription: 'bg-purple-100 text-purple-800',
      custom: 'bg-orange-100 text-orange-800'
    };
    return colors[type] || colors.custom;
  };

  const handleCardClick = () => {
    console.log('[CohortCard] Card clicked:', cohort.id);
    onSelect(cohort.id);
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[CohortCard] Refresh clicked:', cohort.id);
    if (onRefresh) {
      onRefresh(cohort.id);
    }
  };

  const showRefreshButton =
    (cohort.cohort_type === 'dynamic' || cohort.cohort_type === 'behavioral') &&
    onRefresh;

  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 mb-1">
            {cohort.name}
          </h3>
          {cohort.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {cohort.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium ${getCohortTypeBadgeColor(cohort.cohort_type)}`}>
          {cohort.cohort_type}
        </span>
        {!cohort.is_active && (
          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
            Inactive
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <div className="text-gray-500">Members</div>
          <div className="font-medium">{cohort.member_count}</div>
        </div>
        <div>
          <div className="text-gray-500">Avg Rating</div>
          <div className="font-medium">
            {cohort.average_rating?.toFixed(2) || 'N/A'}
          </div>
        </div>
      </div>

      {showRefreshButton && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <Button
            onClick={handleRefreshClick}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            Refresh Membership
          </Button>
        </div>
      )}
    </div>
  );
}
