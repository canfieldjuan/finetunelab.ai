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
  availableModels: Array<{ id: string; name: string }>;
  availableSessions: Array<{ id: string; name: string }>;
}

export function FilterPanel({
  filters,
  onFiltersChange,
  availableTrainingMethods,
  availableModels,
  availableSessions
}: FilterPanelProps) {
  console.log('[FilterPanel] Rendering with filters:', filters);

  // Calculate active filter count
  const activeFilterCount =
    filters.ratings.length +
    filters.trainingMethods.length +
    filters.models.length +
    filters.sessions.length +
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

  const handleModelToggle = (modelId: string) => {
    const newModels = filters.models.includes(modelId)
      ? filters.models.filter(m => m !== modelId)
      : [...filters.models, modelId];
    onFiltersChange({ ...filters, models: newModels });
  };

  const handleSessionToggle = (sessionId: string) => {
    const newSessions = filters.sessions.includes(sessionId)
      ? filters.sessions.filter(s => s !== sessionId)
      : [...filters.sessions, sessionId];
    onFiltersChange({ ...filters, sessions: newSessions });
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
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Top Row: Fixed Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ratings Filter */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Rating</label>
              <div className="flex flex-wrap gap-3">
                {[1, 2, 3, 4, 5].map(rating => (
                  <div key={rating} className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      id={`rating-${rating}`}
                      checked={filters.ratings.includes(rating)}
                      onChange={() => handleRatingToggle(rating)}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all"
                    />
                    <label htmlFor={`rating-${rating}`} className="text-sm cursor-pointer hover:text-blue-600 transition-colors">
                      {rating}⭐
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Success Status */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Success Status</label>
              <div className="flex flex-wrap gap-3">
                {([
                  { value: 'all', label: 'All' },
                  { value: 'success', label: 'Success' },
                  { value: 'failure', label: 'Failure' }
                ] as Array<{ value: 'all' | 'success' | 'failure'; label: string }>).map(option => (
                  <div key={option.value} className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      id={`success-${option.value}`}
                      name="success-filter"
                      checked={filters.successFilter === option.value}
                      onChange={() => handleSuccessFilterChange(option.value)}
                      className="w-4 h-4 cursor-pointer accent-blue-600 transition-all"
                    />
                    <label htmlFor={`success-${option.value}`} className="text-sm cursor-pointer hover:text-blue-600 transition-colors">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Type */}
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Session Type</label>
              <div className="flex flex-wrap gap-3">
                {([
                  { value: 'all', label: 'All' },
                  { value: 'widget', label: 'Widget' },
                  { value: 'normal', label: 'Normal' }
                ] as Array<{ value: 'all' | 'widget' | 'normal'; label: string }>).map(option => (
                  <div key={option.value} className="flex items-center space-x-1.5">
                    <input
                      type="radio"
                      id={`widget-${option.value}`}
                      name="widget-filter"
                      checked={filters.widgetSessionFilter === option.value}
                      onChange={() => handleWidgetSessionFilterChange(option.value)}
                      className="w-4 h-4 cursor-pointer accent-blue-600 transition-all"
                    />
                    <label htmlFor={`widget-${option.value}`} className="text-sm cursor-pointer hover:text-blue-600 transition-colors">
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Training Methods - If present */}
          {availableTrainingMethods.length > 0 && (
            <div className="pt-3 border-t border-border">
               <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Training Method</label>
               <div className="flex flex-wrap gap-4">
                {availableTrainingMethods.map(method => (
                  <div key={method} className="flex items-center space-x-1.5">
                    <input
                      type="checkbox"
                      id={`training-${method}`}
                      checked={filters.trainingMethods.includes(method)}
                      onChange={() => handleTrainingMethodToggle(method)}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all"
                    />
                    <label htmlFor={`training-${method}`} className="text-sm cursor-pointer uppercase hover:text-blue-600 transition-colors">
                      {method}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Row: Scrollable Lists */}
          {(availableModels.length > 0 || availableSessions.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border">
              {/* Models Filter */}
              {availableModels.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Models</label>
                  <div className="relative h-32 overflow-y-auto border rounded-md bg-background">
                    <div className="p-2 space-y-1">
                      {availableModels.map(model => (
                        <div 
                          key={model.id} 
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent transition-colors"
                        >
                          <input
                            type="checkbox"
                            id={`model-${model.id}`}
                            checked={filters.models.includes(model.id)}
                            onChange={() => handleModelToggle(model.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all flex-shrink-0"
                          />
                          <label htmlFor={`model-${model.id}`} className="text-xs cursor-pointer truncate hover:text-blue-600 transition-colors flex-1">
                            {model.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Sessions Filter */}
              {availableSessions.length > 0 && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Sessions</label>
                  <div className="relative h-32 overflow-y-auto border rounded-md bg-background">
                    <div className="p-2 space-y-1">
                      {availableSessions.map(session => (
                        <div 
                          key={session.id} 
                          className="flex items-center space-x-2 p-1.5 rounded hover:bg-accent transition-colors"
                        >
                          <input
                            type="checkbox"
                            id={`session-${session.id}`}
                            checked={filters.sessions.includes(session.id)}
                            onChange={() => handleSessionToggle(session.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all flex-shrink-0"
                          />
                          <label htmlFor={`session-${session.id}`} className="text-xs cursor-pointer truncate hover:text-blue-600 transition-colors flex-1">
                            {session.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
