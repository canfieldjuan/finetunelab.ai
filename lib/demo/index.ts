/**
 * Demo Module Index
 * Exports all demo-related functionality
 * Date: December 15, 2025
 */

// Types
export * from './types';

// Queries (low-level database operations)
export * as demoQueries from './queries';

// Service (high-level business logic)
export * as demoService from './demo-data.service';

// Re-export commonly used functions for convenience
export {
  getAvailableTestSuites,
  getTestSuite,
  getTaskDomainSummary,
  startDemoComparisonTest,
  getTestRunStatus,
  getTestRunComparisons,
  submitComparisonRating,
  revealComparison,
  completeTestRun,
  getTestRunAnalytics,
  getDemoSessions,
  getAllowedDemoModels,
  getDefaultModelPair,
  checkRateLimit,
  cleanupDemoData,
} from './demo-data.service';
