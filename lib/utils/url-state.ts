/**
 * URL State Management Utilities
 * 
 * Handles serialization and deserialization of search filters to/from URL parameters.
 * Enables shareable search configurations and browser history integration.
 * 
 * Features:
 * - Compact URL encoding using base64
 * - Browser back/forward support
 * - Shareable search configurations
 * - URL length optimization (<200 chars target)
 * 
 * @module url-state
 */

import { SearchFilters, SortOption } from './search-filters';

/**
 * Compact filter state for URL encoding
 * Uses short keys to minimize URL length
 */
interface CompactFilterState {
  c?: [number, number];  // confidence [min, max]
  d?: [number | null, number | null];  // dateRange [start timestamp, end timestamp]
  t?: number;  // sourceTrust as bitmask (verified=1, high=2, medium=4, low=8, unknown=16)
  s?: string;  // sortOption
}

/**
 * Convert source trust object to bitmask
 * Reduces 5 booleans to a single number
 */
function sourceTrustToBitmask(trust: SearchFilters['sourceTrust']): number {
  let mask = 0;
  if (trust.verified) mask |= 1;
  if (trust.high) mask |= 2;
  if (trust.medium) mask |= 4;
  if (trust.low) mask |= 8;
  if (trust.unknown) mask |= 16;
  return mask;
}

/**
 * Convert bitmask back to source trust object
 */
function bitmaskToSourceTrust(mask: number): SearchFilters['sourceTrust'] {
  return {
    verified: (mask & 1) !== 0,
    high: (mask & 2) !== 0,
    medium: (mask & 4) !== 0,
    low: (mask & 8) !== 0,
    unknown: (mask & 16) !== 0
  };
}

/**
 * Serialize SearchFilters to compact URL parameter string
 * 
 * @param filters - Search filters to serialize
 * @param sort - Sort option to include
 * @returns URL-safe base64 encoded string
 * 
 * @example
 * ```ts
 * const params = filtersToURLParams(filters, 'date-desc');
 * // Returns: "eyJjIjpbMC44LDFdLCJzIjoiZGF0ZS1kZXNjIn0"
 * ```
 */
export function filtersToURLParams(
  filters: SearchFilters,
  sort: SortOption
): string {
  const compact: CompactFilterState = {};

  // Only include non-default confidence
  if (filters.confidence.min !== 0 || filters.confidence.max !== 1) {
    compact.c = [filters.confidence.min, filters.confidence.max];
  }

  // Only include date range if set
  if (filters.dateRange.start || filters.dateRange.end) {
    compact.d = [
      filters.dateRange.start ? filters.dateRange.start.getTime() : null,
      filters.dateRange.end ? filters.dateRange.end.getTime() : null
    ];
  }

  // Only include source trust if not all selected
  const trustMask = sourceTrustToBitmask(filters.sourceTrust);
  if (trustMask !== 31) {  // 31 = all bits set (all selected)
    compact.t = trustMask;
  }

  // Only include sort if not default
  if (sort !== 'relevance') {
    compact.s = sort;
  }

  // Return empty string if no filters active (saves URL space)
  if (Object.keys(compact).length === 0) {
    return '';
  }

  // Convert to JSON and base64 encode
  const json = JSON.stringify(compact);
  return btoa(json);
}

/**
 * Deserialize URL parameters back to SearchFilters
 * 
 * @param encodedParams - Base64 encoded filter state from URL
 * @returns Filters and sort option, or null if invalid
 * 
 * @example
 * ```ts
 * const state = urlParamsToFilters(urlParams);
 * if (state) {
 *   setFilters(state.filters);
 *   setSortOption(state.sort);
 * }
 * ```
 */
export function urlParamsToFilters(encodedParams: string): {
  filters: SearchFilters;
  sort: SortOption;
} | null {
  if (!encodedParams || encodedParams.trim() === '') {
    return null;
  }

  try {
    // Decode base64 and parse JSON
    const json = atob(encodedParams);
    const compact: CompactFilterState = JSON.parse(json);

    // Reconstruct filters with defaults
    const filters: SearchFilters = {
      confidence: {
        min: compact.c?.[0] ?? 0,
        max: compact.c?.[1] ?? 1
      },
      dateRange: {
        start: compact.d?.[0] ? new Date(compact.d[0]) : null,
        end: compact.d?.[1] ? new Date(compact.d[1]) : null
      },
      sourceTrust: compact.t !== undefined
        ? bitmaskToSourceTrust(compact.t)
        : {
            verified: true,
            high: true,
            medium: true,
            low: true,
            unknown: true
          }
    };

    const sort: SortOption = (compact.s as SortOption) ?? 'relevance';

    return { filters, sort };
  } catch (error) {
    // Invalid URL parameter, return null
    console.warn('Failed to parse URL filters:', error);
    return null;
  }
}

/**
 * Update browser URL with current filter state
 * Uses history.replaceState to avoid creating history entries
 * 
 * @param filters - Current search filters
 * @param sort - Current sort option
 * 
 * @example
 * ```ts
 * // Update URL when filters change
 * useEffect(() => {
 *   updateURLWithFilters(filters, sortOption);
 * }, [filters, sortOption]);
 * ```
 */
export function updateURLWithFilters(
  filters: SearchFilters,
  sort: SortOption
): void {
  if (typeof window === 'undefined') return;

  const encoded = filtersToURLParams(filters, sort);
  const url = new URL(window.location.href);

  if (encoded) {
    url.searchParams.set('f', encoded);
  } else {
    url.searchParams.delete('f');
  }

  // Update URL without page reload or history entry
  window.history.replaceState({}, '', url.toString());
}

/**
 * Get filter state from current browser URL
 * 
 * @returns Filters and sort from URL, or null if not present
 * 
 * @example
 * ```ts
 * // On component mount, load filters from URL
 * useEffect(() => {
 *   const urlState = getFiltersFromURL();
 *   if (urlState) {
 *     setFilters(urlState.filters);
 *     setSortOption(urlState.sort);
 *   }
 * }, []);
 * ```
 */
export function getFiltersFromURL(): {
  filters: SearchFilters;
  sort: SortOption;
} | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('f');

  if (!encoded) return null;

  return urlParamsToFilters(encoded);
}

/**
 * Generate a shareable URL with current filter state
 * 
 * @param filters - Search filters to include
 * @param sort - Sort option to include
 * @param baseUrl - Optional base URL (defaults to current origin + pathname)
 * @returns Complete shareable URL
 * 
 * @example
 * ```ts
 * const shareUrl = generateShareableURL(filters, sortOption);
 * navigator.clipboard.writeText(shareUrl);
 * ```
 */
export function generateShareableURL(
  filters: SearchFilters,
  sort: SortOption,
  baseUrl?: string
): string {
  const encoded = filtersToURLParams(filters, sort);
  const base = baseUrl || (typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}`
    : '');

  if (encoded) {
    return `${base}?f=${encoded}`;
  }

  return base;
}

/**
 * Check if URL contains filter parameters
 * 
 * @returns True if URL has filter params
 */
export function hasURLFilters(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('f');
}

/**
 * Clear filter parameters from URL
 * 
 * @example
 * ```ts
 * // Clear filters button
 * const handleClearAll = () => {
 *   setFilters(getDefaultFilters());
 *   clearURLFilters();
 * };
 * ```
 */
export function clearURLFilters(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('f');
  window.history.replaceState({}, '', url.toString());
}
