"use client";

import React, { useState, useEffect } from 'react';
import { Save, Trash2, Upload, Download, Clock, Star } from 'lucide-react';
import { SearchFilters, SortOption } from '@/lib/utils/search-filters';

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: SearchFilters;
  sortOption: SortOption;
  createdAt: Date;
  lastUsed?: Date;
  usageCount: number;
}

interface SavedFiltersPanelProps {
  currentFilters: SearchFilters;
  currentSort: SortOption;
  onLoadFilters: (filters: SearchFilters, sort: SortOption) => void;
}

const STORAGE_KEY = 'web-search-saved-filters';

/**
 * SavedFiltersPanel Component
 * 
 * Manages saved filter configurations with local storage persistence.
 * 
 * Features:
 * - Save current filters with custom name/description
 * - Load saved filters with one click
 * - Delete saved filters
 * - Export/import saved filters as JSON
 * - Usage tracking (count, last used)
 * - Star favorite filters
 * 
 * @component
 */
export function SavedFiltersPanel({
  currentFilters,
  currentSort,
  onLoadFilters
}: SavedFiltersPanelProps) {
  
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newFilterName, setNewFilterName] = useState('');
  const [newFilterDescription, setNewFilterDescription] = useState('');

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed: SavedFilter[] = JSON.parse(stored);
        // Convert date strings back to Date objects
        const filters = parsed.map((f) => ({
          ...f,
          createdAt: new Date(f.createdAt),
          lastUsed: f.lastUsed ? new Date(f.lastUsed) : undefined,
          filters: {
            ...f.filters,
            dateRange: {
              start: f.filters.dateRange.start ? new Date(f.filters.dateRange.start) : null,
              end: f.filters.dateRange.end ? new Date(f.filters.dateRange.end) : null
            }
          }
        }));
        setSavedFilters(filters);
      } catch (error) {
        console.error('Failed to load saved filters:', error);
      }
    }
  }, []);

  // Save to localStorage whenever savedFilters changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFilters));
  }, [savedFilters]);

  // Save current filters
  const handleSaveFilter = () => {
    if (!newFilterName.trim()) return;

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      description: newFilterDescription.trim() || undefined,
      filters: currentFilters,
      sortOption: currentSort,
      createdAt: new Date(),
      usageCount: 0
    };

    setSavedFilters(prev => [newFilter, ...prev]);
    setNewFilterName('');
    setNewFilterDescription('');
    setShowSaveDialog(false);
  };

  // Load saved filter
  const handleLoadFilter = (filter: SavedFilter) => {
    onLoadFilters(filter.filters, filter.sortOption);

    // Update usage stats
    setSavedFilters(prev => 
      prev.map(f => 
        f.id === filter.id
          ? { ...f, lastUsed: new Date(), usageCount: f.usageCount + 1 }
          : f
      )
    );
  };

  // Delete saved filter
  const handleDeleteFilter = (id: string) => {
    if (confirm('Are you sure you want to delete this saved filter?')) {
      setSavedFilters(prev => prev.filter(f => f.id !== id));
    }
  };

  // Export saved filters to JSON file
  const handleExport = () => {
    const data = JSON.stringify(savedFilters, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `saved-filters-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import saved filters from JSON file
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported: SavedFilter[] = JSON.parse(e.target?.result as string);
        const filters = imported.map((f) => ({
          ...f,
          id: Date.now().toString() + Math.random(), // New IDs to avoid conflicts
          createdAt: new Date(f.createdAt),
          lastUsed: f.lastUsed ? new Date(f.lastUsed) : undefined,
          filters: {
            ...f.filters,
            dateRange: {
              start: f.filters.dateRange.start ? new Date(f.filters.dateRange.start) : null,
              end: f.filters.dateRange.end ? new Date(f.filters.dateRange.end) : null
            }
          }
        }));
        setSavedFilters(prev => [...filters, ...prev]);
      } catch (error) {
        alert('Failed to import filters. Invalid file format.');
        console.error('Import error:', error);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  // Get filter summary for display
  const getFilterSummary = (filter: SavedFilter): string => {
    const parts: string[] = [];

    // Confidence
    if (filter.filters.confidence.min > 0 || filter.filters.confidence.max < 1) {
      parts.push(`${Math.round(filter.filters.confidence.min * 100)}-${Math.round(filter.filters.confidence.max * 100)}% conf`);
    }

    // Date range
    if (filter.filters.dateRange.start || filter.filters.dateRange.end) {
      parts.push('Date filter');
    }

    // Trust
    const trust = filter.filters.sourceTrust;
    if (!trust.verified || !trust.high || !trust.medium || !trust.low || !trust.unknown) {
      parts.push('Trust filter');
    }

    // Sort
    if (filter.sortOption !== 'relevance') {
      parts.push(filter.sortOption);
    }

    return parts.length > 0 ? parts.join(' | ') : 'No filters';
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Saved Filters
          </h3>
          {savedFilters.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({savedFilters.length})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Export button */}
          {savedFilters.length > 0 && (
            <button
              onClick={handleExport}
              title="Export saved filters"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          )}

          {/* Import button */}
          <label
            title="Import saved filters"
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {/* Save button */}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded transition-colors"
          >
            <Save className="h-3 w-3" />
            Save Current
          </button>
        </div>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Save Current Filters
          </h4>
          <input
            type="text"
            placeholder="Filter name (required)"
            value={newFilterName}
            onChange={(e) => setNewFilterName(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newFilterDescription}
            onChange={(e) => setNewFilterDescription(e.target.value)}
            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveFilter}
              disabled={!newFilterName.trim()}
              className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false);
                setNewFilterName('');
                setNewFilterDescription('');
              }}
              className="px-3 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved Filters List */}
      {savedFilters.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
          <p>No saved filters yet.</p>
          <p className="text-xs mt-1">Click &quot;Save Current&quot; to save your first filter.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {savedFilters.map(filter => (
            <div
              key={filter.id}
              className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div
                    onClick={() => handleLoadFilter(filter)}
                    className="cursor-pointer"
                  >
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {filter.name}
                    </h4>
                    {filter.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {filter.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {getFilterSummary(filter)}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {filter.lastUsed
                        ? `Used ${filter.usageCount} times`
                        : `Created ${filter.createdAt.toLocaleDateString()}`
                      }
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteFilter(filter.id)}
                  className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                  title="Delete filter"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
