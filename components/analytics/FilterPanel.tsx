"use client";

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Filter } from 'lucide-react';
import type { AnalyticsFilters } from '@/hooks/useAnalytics';

interface FilterPanelProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: AnalyticsFilters) => void;
  availableTrainingMethods: string[];
}

export function FilterPanel({
  filters,
  onFiltersChange,
  availableTrainingMethods
}: FilterPanelProps) {
  console.log('[FilterPanel] Rendering with filters:', filters);

  // Calculate active filter count (models and sessions excluded - handled by table selections)
  const activeFilterCount =
    filters.ratings.length +
    filters.trainingMethods.length +
    (filters.successFilter !== 'all' ? 1 : 0) +
    (filters.widgetSessionFilter !== 'all' ? 1 : 0);

  const handleClearAll = () => {
    console.log('[FilterPanel] Clearing all filters');
    onFiltersChange({
      ratings: [],
      models: [],
      successFilter: 'all',
      trainingMethods: [],
      sessions: [],
      widgetSessionFilter: 'all'
    });
  };

  const handleRatingToggle = (rating: number) => {
    const newRatings = filters.ratings.includes(rating)
      ? filters.ratings.filter(r => r !== rating)
      : [...filters.ratings, rating];
    onFiltersChange({ ...filters, ratings: newRatings });
  };

  const handleSuccessFilterChange = (value: 'all' | 'success' | 'failure') => {
    onFiltersChange({ ...filters, successFilter: value });
  };

  const handleWidgetSessionFilterChange = (value: 'all' | 'widget' | 'normal') => {
    onFiltersChange({ ...filters, widgetSessionFilter: value });
  };

  const handleTrainingMethodToggle = (method: string) => {
    const newMethods = filters.trainingMethods.includes(method)
      ? filters.trainingMethods.filter(m => m !== method)
      : [...filters.trainingMethods, method];
    onFiltersChange({ ...filters, trainingMethods: newMethods });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            <CardTitle>Filters</CardTitle>
            {activeFilterCount > 0 && (
              <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Ratings Filter */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Rating</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(rating => (
                <div key={rating} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`rating-${rating}`}
                    checked={filters.ratings.includes(rating)}
                    onChange={() => handleRatingToggle(rating)}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                  />
                  <label htmlFor={`rating-${rating}`} className="text-sm cursor-pointer">
                    {rating}⭐
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Success/Failure Filter */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Success Status</label>
            <div className="flex gap-3">
              {([
                { value: 'all', label: 'All' },
                { value: 'success', label: 'Success' },
                { value: 'failure', label: 'Failure' }
              ] as Array<{ value: 'all' | 'success' | 'failure'; label: string }>).map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`success-${option.value}`}
                    name="success-filter"
                    checked={filters.successFilter === option.value}
                    onChange={() => handleSuccessFilterChange(option.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor={`success-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Session Type Filter */}
          <div>
            <label className="text-sm font-semibold mb-2 block">Session Type</label>
            <div className="flex gap-3">
              {([
                { value: 'all', label: 'All Sessions' },
                { value: 'widget', label: 'Widget Only' },
                { value: 'normal', label: 'Normal Only' }
              ] as Array<{ value: 'all' | 'widget' | 'normal'; label: string }>).map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id={`widget-${option.value}`}
                    name="widget-filter"
                    checked={filters.widgetSessionFilter === option.value}
                    onChange={() => handleWidgetSessionFilterChange(option.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor={`widget-${option.value}`} className="text-sm cursor-pointer">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Training Methods Filter */}
          {availableTrainingMethods.length > 0 && (
            <div>
              <label className="text-sm font-semibold mb-2 block">Training Method</label>
              <div className="grid grid-cols-2 gap-2">
                {availableTrainingMethods.map(method => (
                  <div key={method} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`training-${method}`}
                      checked={filters.trainingMethods.includes(method)}
                      onChange={() => handleTrainingMethodToggle(method)}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                    <label htmlFor={`training-${method}`} className="text-sm cursor-pointer uppercase">
                      {method}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note about model/session filtering */}
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground italic">
              💡 To filter by model or session, click a row in the Model Performance or Session Comparison tables below.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
