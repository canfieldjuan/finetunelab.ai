// Analytics Insights Cache - localStorage wrapper with expiration
// Phase 12: Analytics Tools Integration
// Date: October 13, 2025

export interface CachedInsights {
  data: unknown;
  timestamp: number;
  expiresAt: number;
}

const CACHE_KEY = 'analytics_insights_cache';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get cached insights from localStorage
 */
export function getCachedInsights(): unknown | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedInsights = JSON.parse(cached);

    // Check if expired
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.data;
  } catch (error) {
    console.error('[InsightsCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Save insights to localStorage with expiration
 */
export function setCachedInsights(data: unknown): void {
  try {
    const cached: CachedInsights = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('[InsightsCache] Error writing cache:', error);
  }
}

/**
 * Clear cached insights
 */
export function clearCachedInsights(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('[InsightsCache] Error clearing cache:', error);
  }
}

/**
 * Check if cached insights are valid (not expired)
 */
export function isCacheValid(): boolean {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;

    const parsed: CachedInsights = JSON.parse(cached);
    return Date.now() <= parsed.expiresAt;
  } catch {
    return false;
  }
}
