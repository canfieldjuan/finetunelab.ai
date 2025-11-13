import { WebSearchDocument } from '@/lib/tools/web-search/types';

// ============================================================================
// Filter Types
// ============================================================================

export interface SearchFilters {
  confidence: {
    min: number; // 0-1 scale
    max: number; // 0-1 scale
  };
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sourceTrust: {
    verified: boolean;
    high: boolean;      // ≥0.8
    medium: boolean;    // 0.5-0.79
    low: boolean;       // <0.5
    unknown: boolean;   // No trust score
  };
}

export type SortOption =
  | 'relevance'
  | 'date-desc'
  | 'date-asc'
  | 'confidence-desc'
  | 'confidence-asc';

export interface FilterPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  filters: SearchFilters;
  sortOption?: SortOption;
}

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Filter search results by confidence score range
 */
export function filterByConfidence(
  results: WebSearchDocument[],
  min: number,
  max: number
): WebSearchDocument[] {
  return results.filter((result) => {
    const score = result.confidenceScore ?? 0.5; // Default to medium if not provided
    return score >= min && score <= max;
  });
}

/**
 * Filter search results by date range
 */
export function filterByDateRange(
  results: WebSearchDocument[],
  start: Date | null,
  end: Date | null
): WebSearchDocument[] {
  if (!start && !end) {
    return results; // No date filter applied
  }

  return results.filter((result) => {
    if (!result.publishedAt) {
      return false; // Exclude results without dates when date filter is active
    }

    const publishedDate = new Date(result.publishedAt);

    if (start && publishedDate < start) {
      return false;
    }

    if (end && publishedDate > end) {
      return false;
    }

    return true;
  });
}

/**
 * Determine trust level from confidence score
 */
function getTrustLevel(score: number | undefined): 'verified' | 'high' | 'medium' | 'low' | 'unknown' {
  if (score === undefined) return 'unknown';
  if (score >= 0.9) return 'verified'; // Consider very high scores as verified
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Filter search results by source trust level
 */
export function filterBySourceTrust(
  results: WebSearchDocument[],
  trustOptions: SearchFilters['sourceTrust']
): WebSearchDocument[] {
  // If all options are selected, don't filter
  if (
    trustOptions.verified &&
    trustOptions.high &&
    trustOptions.medium &&
    trustOptions.low &&
    trustOptions.unknown
  ) {
    return results;
  }

  return results.filter((result) => {
    const trustLevel = getTrustLevel(result.confidenceScore);

    switch (trustLevel) {
      case 'verified':
        return trustOptions.verified || trustOptions.high; // Verified falls into high category
      case 'high':
        return trustOptions.high;
      case 'medium':
        return trustOptions.medium;
      case 'low':
        return trustOptions.low;
      case 'unknown':
        return trustOptions.unknown;
      default:
        return false;
    }
  });
}

/**
 * Apply all filters to search results
 */
export function applyFilters(
  results: WebSearchDocument[],
  filters: SearchFilters
): WebSearchDocument[] {
  let filtered = results;

  // Apply confidence filter
  filtered = filterByConfidence(filtered, filters.confidence.min, filters.confidence.max);

  // Apply date range filter
  filtered = filterByDateRange(filtered, filters.dateRange.start, filters.dateRange.end);

  // Apply source trust filter
  filtered = filterBySourceTrust(filtered, filters.sourceTrust);

  return filtered;
}

// ============================================================================
// Sort Functions
// ============================================================================

/**
 * Sort search results by specified criteria
 */
export function sortResults(
  results: WebSearchDocument[],
  sortOption: SortOption
): WebSearchDocument[] {
  const sorted = [...results]; // Create copy to avoid mutation

  switch (sortOption) {
    case 'relevance':
      // Keep original order (assumed to be by relevance)
      return sorted;

    case 'date-desc':
      return sorted.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateB - dateA; // Newest first
      });

    case 'date-asc':
      return sorted.sort((a, b) => {
        const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return dateA - dateB; // Oldest first
      });

    case 'confidence-desc':
      return sorted.sort((a, b) => {
        const scoreA = a.confidenceScore ?? 0;
        const scoreB = b.confidenceScore ?? 0;
        return scoreB - scoreA; // Highest first
      });

    case 'confidence-asc':
      return sorted.sort((a, b) => {
        const scoreA = a.confidenceScore ?? 0;
        const scoreB = b.confidenceScore ?? 0;
        return scoreA - scoreB; // Lowest first
      });

    default:
      return sorted;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default filter state (all filters disabled)
 */
export function getDefaultFilters(): SearchFilters {
  return {
    confidence: {
      min: 0,
      max: 1,
    },
    dateRange: {
      start: null,
      end: null,
    },
    sourceTrust: {
      verified: true,
      high: true,
      medium: true,
      low: true,
      unknown: true,
    },
  };
}

/**
 * Check if any filters are active (non-default)
 */
export function hasActiveFilters(filters: SearchFilters): boolean {
  const defaults = getDefaultFilters();

  // Check confidence filter
  if (filters.confidence.min !== defaults.confidence.min || filters.confidence.max !== defaults.confidence.max) {
    return true;
  }

  // Check date filter
  if (filters.dateRange.start !== null || filters.dateRange.end !== null) {
    return true;
  }

  // Check source trust filter
  const trustFilter = filters.sourceTrust;
  const defaultTrust = defaults.sourceTrust;
  if (
    trustFilter.verified !== defaultTrust.verified ||
    trustFilter.high !== defaultTrust.high ||
    trustFilter.medium !== defaultTrust.medium ||
    trustFilter.low !== defaultTrust.low ||
    trustFilter.unknown !== defaultTrust.unknown
  ) {
    return true;
  }

  return false;
}

/**
 * Get count of active filters
 */
export function getActiveFilterCount(filters: SearchFilters): number {
  let count = 0;

  // Confidence filter
  if (filters.confidence.min !== 0 || filters.confidence.max !== 1) {
    count++;
  }

  // Date filter
  if (filters.dateRange.start !== null || filters.dateRange.end !== null) {
    count++;
  }

  // Source trust filter
  const allTrustSelected =
    filters.sourceTrust.verified &&
    filters.sourceTrust.high &&
    filters.sourceTrust.medium &&
    filters.sourceTrust.low &&
    filters.sourceTrust.unknown;

  if (!allTrustSelected) {
    count++;
  }

  return count;
}

// ============================================================================
// Filter Presets
// ============================================================================

/**
 * Get predefined filter presets for common use cases
 */
export function getFilterPresets(): FilterPreset[] {
  return [
    {
      id: 'high-confidence',
      name: 'High Confidence Only',
      description: 'Show only results with 80% or higher confidence',
      icon: '🎯',
      filters: {
        confidence: { min: 0.8, max: 1 },
        dateRange: { start: null, end: null },
        sourceTrust: {
          verified: true,
          high: true,
          medium: true,
          low: true,
          unknown: true,
        },
      },
      sortOption: 'confidence-desc',
    },
    {
      id: 'recent-reliable',
      name: 'Recent & Reliable',
      description: 'High-quality results from the past 30 days',
      icon: '⭐',
      filters: {
        confidence: { min: 0.7, max: 1 },
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        sourceTrust: {
          verified: true,
          high: true,
          medium: false,
          low: false,
          unknown: false,
        },
      },
      sortOption: 'date-desc',
    },
    {
      id: 'verified-sources',
      name: 'Verified Sources',
      description: 'Results from verified and high-trust sources only',
      icon: '✓',
      filters: {
        confidence: { min: 0.5, max: 1 },
        dateRange: { start: null, end: null },
        sourceTrust: {
          verified: true,
          high: true,
          medium: false,
          low: false,
          unknown: false,
        },
      },
      sortOption: 'confidence-desc',
    },
    {
      id: 'latest-news',
      name: 'Latest News',
      description: 'Most recent results from the past week',
      icon: '📰',
      filters: {
        confidence: { min: 0, max: 1 },
        dateRange: {
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        sourceTrust: {
          verified: true,
          high: true,
          medium: true,
          low: true,
          unknown: true,
        },
      },
      sortOption: 'date-desc',
    },
    {
      id: 'deep-dive',
      name: 'Deep Dive',
      description: 'Comprehensive results from the past year',
      icon: '🔍',
      filters: {
        confidence: { min: 0, max: 1 },
        dateRange: {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        sourceTrust: {
          verified: true,
          high: true,
          medium: true,
          low: true,
          unknown: true,
        },
      },
      sortOption: 'relevance',
    },
    {
      id: 'all-results',
      name: 'All Results',
      description: 'Clear all filters and show everything',
      icon: '🌐',
      filters: getDefaultFilters(),
      sortOption: 'relevance',
    },
  ];
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): FilterPreset | undefined {
  return getFilterPresets().find((preset) => preset.id === id);
}
