/**
 * Search Analytics Utilities
 * 
 * Calculate insights and metrics from search results including:
 * - Confidence score distribution
 * - Source trust breakdown
 * - Publication date distribution
 * - Top sources ranking
 * - Quality score calculation
 * 
 * @module search-analytics
 */

import { WebSearchDocument } from '../tools/web-search/types';

/**
 * Analytics data structure
 */
export interface AnalyticsData {
  confidenceDistribution: {
    high: number;      // 80-100%
    medium: number;    // 50-79%
    low: number;       // 0-49%
    unknown: number;   // No score
  };
  sourceTrustBreakdown: {
    verified: number;  // ≥90%
    high: number;      // 80-89%
    medium: number;    // 50-79%
    low: number;       // <50%
    unknown: number;   // No score
  };
  dateDistribution: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    older: number;
    undated: number;
  };
  topSources: Array<{
    domain: string;
    count: number;
    avgConfidence: number;
  }>;
  averageConfidence: number;
  dateRangeCoverage: {
    earliest: Date | null;
    latest: Date | null;
  };
  qualityScore: number;  // 0-100
  totalResults: number;
}

/**
 * Get confidence level from score
 */
function getConfidenceLevel(score: number | undefined): 'high' | 'medium' | 'low' | 'unknown' {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get source trust level from score
 */
function getSourceTrustLevel(score: number | undefined): 'verified' | 'high' | 'medium' | 'low' | 'unknown' {
  if (score === undefined || score === null) return 'unknown';
  if (score >= 0.9) return 'verified';
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Calculate confidence score distribution
 * 
 * @param results - Search results to analyze
 * @returns Distribution of confidence levels
 */
export function getConfidenceDistribution(
  results: WebSearchDocument[]
): AnalyticsData['confidenceDistribution'] {
  const distribution = {
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };

  results.forEach(result => {
    const level = getConfidenceLevel(result.confidenceScore);
    distribution[level]++;
  });

  return distribution;
}

/**
 * Calculate source trust breakdown
 * 
 * @param results - Search results to analyze
 * @returns Breakdown of source trust levels
 */
export function getSourceTrustBreakdown(
  results: WebSearchDocument[]
): AnalyticsData['sourceTrustBreakdown'] {
  const breakdown = {
    verified: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  };

  results.forEach(result => {
    const level = getSourceTrustLevel(result.confidenceScore);
    breakdown[level]++;
  });

  return breakdown;
}

/**
 * Calculate publication date distribution
 * 
 * @param results - Search results to analyze
 * @returns Distribution across time periods
 */
export function getDateDistribution(
  results: WebSearchDocument[]
): AnalyticsData['dateDistribution'] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const distribution = {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    older: 0,
    undated: 0
  };

  results.forEach(result => {
    if (!result.publishedAt) {
      distribution.undated++;
      return;
    }

    const publishDate = new Date(result.publishedAt);
    if (publishDate >= oneDayAgo) {
      distribution.today++;
    } else if (publishDate >= oneWeekAgo) {
      distribution.thisWeek++;
    } else if (publishDate >= oneMonthAgo) {
      distribution.thisMonth++;
    } else {
      distribution.older++;
    }
  });

  return distribution;
}

/**
 * Get top sources with their statistics
 * 
 * @param results - Search results to analyze
 * @param limit - Maximum number of sources to return
 * @returns Top sources sorted by count
 */
export function getTopSources(
  results: WebSearchDocument[],
  limit: number = 10
): AnalyticsData['topSources'] {
  // Group by source
  const sourceMap = new Map<string, {
    count: number;
    totalConfidence: number;
  }>();

  results.forEach(result => {
    const domain = result.source || new URL(result.url).hostname;
    const existing = sourceMap.get(domain) || { count: 0, totalConfidence: 0 };

    sourceMap.set(domain, {
      count: existing.count + 1,
      totalConfidence: existing.totalConfidence + (result.confidenceScore || 0)
    });
  });

  // Convert to array and calculate averages
  const sources = Array.from(sourceMap.entries()).map(([domain, stats]) => ({
    domain,
    count: stats.count,
    avgConfidence: stats.count > 0 ? stats.totalConfidence / stats.count : 0
  }));

  // Sort by count descending, then by avgConfidence descending
  sources.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return b.avgConfidence - a.avgConfidence;
  });

  return sources.slice(0, limit);
}

/**
 * Calculate date range coverage
 * 
 * @param results - Search results to analyze
 * @returns Earliest and latest publication dates
 */
export function getDateRangeCoverage(
  results: WebSearchDocument[]
): AnalyticsData['dateRangeCoverage'] {
  const dates = results
    .filter(r => r.publishedAt)
    .map(r => new Date(r.publishedAt!))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    return { earliest: null, latest: null };
  }

  return {
    earliest: dates[0],
    latest: dates[dates.length - 1]
  };
}

/**
 * Calculate overall quality score (0-100)
 * 
 * Algorithm:
 * - 40% from average confidence score
 * - 30% from source trust distribution (more verified/high = better)
 * - 20% from recency (more recent = better)
 * - 10% from source diversity (more unique sources = better)
 * 
 * @param results - Search results to analyze
 * @returns Quality score 0-100
 */
export function calculateQualityScore(results: WebSearchDocument[]): number {
  if (results.length === 0) return 0;

  // 1. Average confidence score (40 points)
  const avgConfidence = results.reduce((sum, r) => sum + (r.confidenceScore || 0.5), 0) / results.length;
  const confidencePoints = avgConfidence * 40;

  // 2. Source trust distribution (30 points)
  const trustBreakdown = getSourceTrustBreakdown(results);
  const verifiedRatio = trustBreakdown.verified / results.length;
  const highRatio = trustBreakdown.high / results.length;
  const trustPoints = (verifiedRatio * 30) + (highRatio * 15);

  // 3. Recency (20 points)
  const dateDistribution = getDateDistribution(results);
  const datedCount = results.length - dateDistribution.undated;
  let recencyPoints: number;
  
  if (datedCount === 0) {
    // No dates = 10 points (neutral)
    recencyPoints = 10;
  } else {
    const todayRatio = dateDistribution.today / datedCount;
    const weekRatio = dateDistribution.thisWeek / datedCount;
    recencyPoints = (todayRatio * 20) + (weekRatio * 10);
  }

  // 4. Source diversity (10 points)
  const uniqueSources = new Set(results.map(r => r.source || new URL(r.url).hostname)).size;
  const diversityRatio = Math.min(uniqueSources / results.length, 1);
  const diversityPoints = diversityRatio * 10;

  // Total score
  const totalScore = confidencePoints + trustPoints + recencyPoints + diversityPoints;

  return Math.round(Math.min(totalScore, 100));
}

/**
 * Generate complete analytics for search results
 * 
 * @param results - Search results to analyze
 * @returns Complete analytics data
 * 
 * @example
 * ```ts
 * const analytics = generateAnalytics(searchResults);
 * console.log(`Quality Score: ${analytics.qualityScore}/100`);
 * console.log(`Top Source: ${analytics.topSources[0].domain}`);
 * ```
 */
export function generateAnalytics(results: WebSearchDocument[]): AnalyticsData {
  return {
    confidenceDistribution: getConfidenceDistribution(results),
    sourceTrustBreakdown: getSourceTrustBreakdown(results),
    dateDistribution: getDateDistribution(results),
    topSources: getTopSources(results, 10),
    averageConfidence: results.length > 0
      ? results.reduce((sum, r) => sum + (r.confidenceScore || 0.5), 0) / results.length
      : 0,
    dateRangeCoverage: getDateRangeCoverage(results),
    qualityScore: calculateQualityScore(results),
    totalResults: results.length
  };
}

/**
 * Compare analytics between two result sets
 * Useful for showing impact of filters
 * 
 * @param before - Analytics before filtering
 * @param after - Analytics after filtering
 * @returns Delta object showing changes
 */
export function compareAnalytics(
  before: AnalyticsData,
  after: AnalyticsData
): {
  resultsDelta: number;
  qualityScoreDelta: number;
  avgConfidenceDelta: number;
} {
  return {
    resultsDelta: after.totalResults - before.totalResults,
    qualityScoreDelta: after.qualityScore - before.qualityScore,
    avgConfidenceDelta: after.averageConfidence - before.averageConfidence
  };
}
