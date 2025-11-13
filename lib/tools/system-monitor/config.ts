// System Monitor Tool - Configuration
// Date: October 13, 2025

export const systemMonitorConfig = {
  // Tool enabled state
  enabled: true,

  // Default monitoring period
  defaultPeriod: 'day' as const,

  // Health check thresholds
  health: {
    healthyScore: 90,
    degradedScore: 70,
    maxLatency: 1000, // milliseconds
    checkInterval: 60000, // 1 minute
  },

  // Performance thresholds
  performance: {
    maxResponseTime: 3000, // milliseconds
    minThroughput: 10, // requests per minute
    maxErrorRate: 0.05, // 5%
    slowQueryThreshold: 1000, // milliseconds
  },

  // Resource limits and warnings
  resources: {
    maxDbSize: 10 * 1024 * 1024 * 1024, // 10GB
    warnDbSize: 8 * 1024 * 1024 * 1024, // 8GB
    maxConnections: 100,
    warnConnections: 80,
    warnTableSize: 100000, // rows
    criticalTableSize: 1000000, // rows
  },

  // Alert thresholds
  alerts: {
    critical: {
      errorRate: 0.1, // 10%
      responseTime: 5000, // 5 seconds
      dbUsage: 0.9, // 90% of max
      connectionUsage: 0.9, // 90% of max
    },
    warning: {
      errorRate: 0.05, // 5%
      responseTime: 3000, // 3 seconds
      dbUsage: 0.75, // 75% of max
      connectionUsage: 0.75, // 75% of max
    },
  },

  // Query limits
  limits: {
    maxToolExecutions: 10000,
    maxMetricsHistory: 1000,
    slowQueryLimit: 100,
  },
};
