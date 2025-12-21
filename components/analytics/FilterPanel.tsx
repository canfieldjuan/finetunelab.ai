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
      <CardContent>
        <div className="space-y-6">
          {/* Ratings Filter */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Rating</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map(rating => (
                <div key={rating} className="flex items-center space-x-2">
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

          {/* Success/Failure Filter */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Success Status</label>
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
                    className="w-4 h-4 cursor-pointer accent-blue-600 transition-all"
                  />
                  <label htmlFor={`success-${option.value}`} className="text-sm cursor-pointer hover:text-blue-600 transition-colors">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Session Type Filter */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Session Type</label>
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
                    className="w-4 h-4 cursor-pointer accent-blue-600 transition-all"
                  />
                  <label htmlFor={`widget-${option.value}`} className="text-sm cursor-pointer hover:text-blue-600 transition-colors">
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Training Methods Filter */}
          {availableTrainingMethods.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Training Method</label>
              <div className="grid grid-cols-2 gap-3">
                {availableTrainingMethods.map(method => (
                  <div key={method} className="flex items-center space-x-2">
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

          {/* Models Filter */}
          {availableModels.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Models</label>
              <div className="relative max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 shadow-inner">
                <div className="p-3 space-y-2">
                  {availableModels.map(model => (
                    <div 
                      key={model.id} 
                      className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`model-${model.id}`}
                        checked={filters.models.includes(model.id)}
                        onChange={() => handleModelToggle(model.id)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all flex-shrink-0"
                      />
                      <label htmlFor={`model-${model.id}`} className="text-sm cursor-pointer truncate hover:text-blue-600 transition-colors flex-1">
                        {model.name}
                      </label>
                    </div>
                  ))}
                </div>
                {/* Scroll shadow indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none"></div>
              </div>
            </div>
          )}

          {/* Sessions Filter */}
          {availableSessions.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <label className="text-sm font-semibold mb-3 block text-gray-700 dark:text-gray-300">Sessions</label>
              <div className="relative max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 shadow-inner">
                <div className="p-3 space-y-2">
                  {availableSessions.map(session => (
                    <div 
                      key={session.id} 
                      className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <input
                        type="checkbox"
                        id={`session-${session.id}`}
                        checked={filters.sessions.includes(session.id)}
                        onChange={() => handleSessionToggle(session.id)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-blue-600 transition-all flex-shrink-0"
                      />
                      <label htmlFor={`session-${session.id}`} className="text-sm cursor-pointer truncate hover:text-blue-600 transition-colors flex-1">
                        {session.name}
                      </label>
                    </div>
                  ))}
                </div>
                {/* Scroll shadow indicator */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-gray-800 to-transparent pointer-events-none"></div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
