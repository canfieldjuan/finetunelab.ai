'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { SearchResultCard } from '@/components/search/SearchResultCard';
import { ConfidenceIndicator, ConfidenceBadge } from '@/components/search/ConfidenceIndicator';
import { SourceBadge, SourceIcon, SourceLink } from '@/components/search/SourceBadge';
import { FilterPanel } from '@/components/search/FilterPanel';
import { SortControls } from '@/components/search/SortControls';
import { FilterPresets } from '@/components/search/FilterPresets';
import { SavedFiltersPanel } from '@/components/search/SavedFiltersPanel';
import { SearchAnalytics } from '@/components/search/SearchAnalytics';
import { ExportPanel } from '@/components/search/ExportPanel';
import { WebSearchDocument } from '@/lib/tools/web-search/types';
import { copyCitation } from '@/lib/utils/citation';
import { 
  SearchFilters, 
  SortOption, 
  FilterPreset,
  getDefaultFilters,
  applyFilters,
  sortResults
} from '@/lib/utils/search-filters';
import {
  updateURLWithFilters,
  getFiltersFromURL,
  hasURLFilters
} from '@/lib/utils/url-state';

// Mock search results for testing
const mockResults: WebSearchDocument[] = [
  {
    title: 'Complete Guide to React Server Components',
    url: 'https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023',
    snippet: 'React Server Components allow you to write UI that can be rendered and optionally cached on the server. In Next.js, the rendering work is further split by route segments to enable streaming and partial rendering...',
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    source: 'react.dev',
    imageUrl: 'https://react.dev/images/home/conf2021/cover.svg',
    summary: 'React Server Components represent a new paradigm in React development, enabling server-side rendering with improved performance and reduced bundle sizes. They integrate seamlessly with Next.js to provide streaming and partial rendering capabilities.',
    confidenceScore: 0.92,
    fullContent: 'React Server Components allow you to write UI that can be rendered and optionally cached on the server. In Next.js, the rendering work is further split by route segments to enable streaming and partial rendering, and there are three different server rendering strategies: Static Rendering, Dynamic Rendering, and Streaming. This guide will help you understand how these work together.'
  },
  {
    title: 'TypeScript Best Practices for 2024',
    url: 'https://www.typescriptlang.org/docs/handbook/2/best-practices.html',
    snippet: 'Learn the latest TypeScript best practices including proper type definitions, utility types, and performance optimization techniques.',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    source: 'typescriptlang.org',
    confidenceScore: 0.78,
    fullContent: 'TypeScript best practices have evolved significantly. Modern TypeScript development emphasizes strict mode, proper type inference, utility types, and performance considerations for large-scale applications.'
  },
  {
    title: 'Introduction to Tailwind CSS v4',
    url: 'https://tailwindcss.com/blog/tailwindcss-v4-alpha',
    snippet: 'Tailwind CSS v4 introduces a new engine, better performance, and enhanced developer experience with native CSS features.',
    publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    source: 'tailwindcss.com',
    imageUrl: 'https://tailwindcss.com/_next/static/media/social-card-large.a6e71726.jpg',
    summary: 'Tailwind CSS v4 is a complete rewrite featuring a new high-performance engine, improved build times, and native CSS features that eliminate the need for PostCSS in many cases.',
    confidenceScore: 0.55
  },
  {
    title: 'Understanding Modern Web Architecture',
    url: 'https://example.com/web-architecture',
    snippet: 'A comprehensive overview of modern web architecture patterns including microservices, serverless, and edge computing.',
    publishedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    source: 'example.com',
    confidenceScore: 0.45,
    fullContent: 'Modern web architecture has evolved to embrace distributed systems, microservices patterns, serverless computing, and edge deployment strategies. Understanding these patterns is crucial for building scalable applications.'
  }
];

export default function SearchComponentTest() {
  const [savedResults, setSavedResults] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<SearchFilters>(getDefaultFilters());
  const [sortOption, setSortOption] = useState<SortOption>('relevance');
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showExport, setShowExport] = useState(true);

  // Phase 3: Load filters from URL on mount
  useEffect(() => {
    if (hasURLFilters()) {
      const urlState = getFiltersFromURL();
      if (urlState) {
        setFilters(urlState.filters);
        setSortOption(urlState.sort);
      }
    }
  }, []);

  // Phase 3: Update URL when filters or sort change
  useEffect(() => {
    updateURLWithFilters(filters, sortOption);
  }, [filters, sortOption]);

  // Apply filters and sorting to mock results
  const processedResults = useMemo(() => {
    const filtered = applyFilters(mockResults, filters);
    return sortResults(filtered, sortOption);
  }, [filters, sortOption]);

  const handleSaveResult = (result: WebSearchDocument) => {
    setSavedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(result.url)) {
        newSet.delete(result.url);
      } else {
        newSet.add(result.url);
      }
      return newSet;
    });
  };

  const handleCiteResult = async (result: WebSearchDocument) => {
    const success = await copyCitation(result, 'apa');
    if (success) {
      alert('Citation copied to clipboard!');
    } else {
      alert('Failed to copy citation. Please try again.');
    }
  };

  const handlePresetSelect = (preset: FilterPreset) => {
    setFilters(preset.filters);
    if (preset.sortOption) {
      setSortOption(preset.sortOption);
    }
  };

  const handleLoadFilters = (loadedFilters: SearchFilters, loadedSort: SortOption) => {
    setFilters(loadedFilters);
    setSortOption(loadedSort);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Search Components Test (Phase 1 + 2 + 3)
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Testing Visual Components + Interactive Filtering & Sorting + Advanced Features
          </p>
        </div>

        {/* Phase 2: Filter Presets (Quick Access) */}
        <FilterPresets
          onPresetSelect={handlePresetSelect}
          currentFilters={filters}
        />

        {/* Phase 3: Saved Filters Panel */}
        <SavedFiltersPanel
          currentFilters={filters}
          currentSort={sortOption}
          onLoadFilters={handleLoadFilters}
        />

        {/* Phase 3: Analytics Dashboard */}
        <div className="space-y-2">
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="w-full text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {showAnalytics ? '▼' : '▶'} Analytics Dashboard
            </span>
          </button>
          {showAnalytics && (
            <SearchAnalytics results={processedResults} variant="full" />
          )}
        </div>

        {/* Phase 3: Export Panel */}
        <div className="space-y-2">
          <button
            onClick={() => setShowExport(!showExport)}
            className="w-full text-left px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {showExport ? '▼' : '▶'} Export Results
            </span>
          </button>
          {showExport && (
            <ExportPanel results={processedResults} filters={filters} variant="full" />
          )}
        </div>

        {/* Main Content: Sidebar + Results */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar: Filter Panel */}
          <div className="lg:col-span-1">
            <FilterPanel
              onFilterChange={setFilters}
              activeFilters={filters}
              totalResults={mockResults.length}
              filteredResults={processedResults.length}
            />
          </div>

          {/* Right Content: Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Sort Controls */}
            <SortControls
              currentSort={sortOption}
              onSortChange={setSortOption}
              resultCount={processedResults.length}
              variant="dropdown"
            />

            {/* Search Results Grid */}
            {processedResults.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {processedResults.map((result, index) => (
                  <SearchResultCard
                    key={result.url}
                    result={result}
                    index={index}
                    onSave={handleSaveResult}
                    onCite={handleCiteResult}
                    isSaved={savedResults.has(result.url)}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No results match your current filters.
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                  Try adjusting your filters or use a preset to see results.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Component Showcase Section - Phase 1 Components */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Phase 1: Individual Component Examples
          </h2>

          {/* ConfidenceIndicator Examples */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Confidence Indicators
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-600 dark:text-gray-400">High (92%):</span>
                <ConfidenceIndicator score={0.92} size="md" showLabel={true} />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-600 dark:text-gray-400">Medium (65%):</span>
                <ConfidenceIndicator score={0.65} size="md" showLabel={true} />
              </div>
              <div className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-600 dark:text-gray-400">Low (35%):</span>
                <ConfidenceIndicator score={0.35} size="md" showLabel={true} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Badges:</span>
              <ConfidenceBadge score={0.92} />
              <ConfidenceBadge score={0.65} />
              <ConfidenceBadge score={0.35} />
            </div>
          </div>

          {/* SourceBadge Examples */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
              Source Badges
            </h3>
            <div className="flex items-center gap-3 flex-wrap">
              <SourceBadge domain="react.dev" trustScore={0.95} isVerified={true} />
              <SourceBadge domain="typescriptlang.org" trustScore={0.85} />
              <SourceBadge domain="tailwindcss.com" trustScore={0.65} />
              <SourceBadge domain="example.com" trustScore={0.35} />
              <SourceBadge domain="unknown-site.xyz" />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Icons:</span>
              <SourceIcon domain="react.dev" trustScore={0.95} isVerified={true} />
              <SourceIcon domain="typescriptlang.org" trustScore={0.85} />
              <SourceIcon domain="example.com" trustScore={0.35} />
            </div>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <span className="text-sm text-gray-600 dark:text-gray-400">Links:</span>
              <SourceLink 
                domain="react.dev" 
                url="https://react.dev" 
                trustScore={0.95} 
                isVerified={true} 
              />
              <SourceLink 
                domain="typescriptlang.org" 
                url="https://www.typescriptlang.org" 
                trustScore={0.85} 
              />
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p>✅ Click &quot;Save&quot; to bookmark results (state persists)</p>
            <p>✅ Click &quot;Cite&quot; to copy citation to clipboard</p>
            <p>✅ Click &quot;Read More&quot; to expand full content</p>
            <p>✅ Saved: {savedResults.size} result{savedResults.size !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8 border-t border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-lg mb-2">Phase 1 + 2 + 3 Complete ✅</p>
          <div className="space-y-1">
            <p>✅ Phase 1: SearchResultCard, ConfidenceIndicator, SourceBadge</p>
            <p>✅ Phase 2: FilterPanel, SortControls, FilterPresets, Filter Utilities</p>
            <p>✅ Phase 3: URL State, SavedFilters, Analytics, Export</p>
          </div>
          <p className="mt-4 text-xs">
            Try the filters and presets above, save your favorite filters, view analytics, and export results!
          </p>
        </div>
      </div>
    </div>
  );
}
