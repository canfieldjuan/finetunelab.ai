// System Monitor Tool - Type Definitions
// Date: October 13, 2025

/**
 * System health status
 */
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-100
  services: ServiceStatus;
  timestamp: string;
  issues?: string[];
}

/**
 * Service status details
 */
export interface ServiceStatus {
  database: ServiceCheck;
  api: ServiceCheck;
  tools: ToolsStatus;
}

export interface ServiceCheck {
  status: 'up' | 'down' | 'degraded';
  latency: number; // milliseconds
  message?: string;
}

export interface ToolsStatus {
  available: number;
  total: number;
  enabled: number;
  disabled: number;
}

/**
 * Resource usage information
 */
export interface ResourceUsage {
  database: DatabaseStats;
  storage: StorageStats;
  performance: PerformanceStats;
  timestamp: string;
}

export interface DatabaseStats {
  totalSize: string;
  tableStats: TableStat[];
  connectionInfo: {
    active: number;
    idle: number;
    max: number;
  };
}

export interface TableStat {
  name: string;
  rowCount: number;
  size: string;
  indexSize: string;
  lastUpdated?: string;
}

export interface StorageStats {
  conversations: number;
  messages: number;
  evaluations: number;
  toolExecutions: number;
  users: number;
}

export interface PerformanceStats {
  slowQueries: number;
  avgQueryTime: number;
  cacheHitRate: number;
}

/**
 * Performance metrics over time
 */
export interface PerformanceMetrics {
  period: string;
  startDate: string;
  endDate: string;
  metrics: Metrics;
  trends: Trends;
  breakdown: MetricsBreakdown;
}

export interface Metrics {
  avgResponseTime: number;
  requestCount: number;
  errorRate: number;
  successRate: number;
  toolExecutions: ToolExecutionMetrics;
}

export interface ToolExecutionMetrics {
  total: number;
  successful: number;
  failed: number;
  avgDuration: number;
  byTool: { [toolName: string]: ToolMetric };
}

export interface ToolMetric {
  executions: number;
  avgDuration: number;
  errorRate: number;
}

export interface Trends {
  responseTime: 'improving' | 'degrading' | 'stable';
  throughput: 'increasing' | 'decreasing' | 'stable';
  errorRate: 'improving' | 'degrading' | 'stable';
}

export interface MetricsBreakdown {
  hourly?: DataPoint[];
  daily?: DataPoint[];
  byTool?: { [toolName: string]: number };
}

export interface DataPoint {
  timestamp: string;
  value: number;
  count?: number;
}

/**
 * Alert information
 */
export interface AlertCollection {
  critical: Alert[];
  warnings: Alert[];
  info: InfoMessage[];
  summary: AlertSummary;
}

export interface Alert {
  type: string;
  message: string;
  threshold: number;
  current: number;
  severity: 'critical' | 'warning';
  timestamp: string;
  recommendations?: string[];
}

export interface InfoMessage {
  type: string;
  message: string;
  timestamp: string;
}

export interface AlertSummary {
  totalCritical: number;
  totalWarnings: number;
  systemStatus: 'healthy' | 'degraded' | 'critical';
}

/**
 * Monitor options
 */
export interface MonitorOptions {
  period?: 'hour' | 'day' | 'week' | 'month' | 'all';
  startDate?: string;
  endDate?: string;
  metricType?: 'response_time' | 'throughput' | 'errors' | 'all';
  includeDetails?: boolean;
}

/**
 * System-level resource information
 */
export interface SystemInfo {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  timestamp: string;
}

export interface CpuInfo {
  manufacturer: string;
  brand: string;
  cores: number;
  physicalCores: number;
  speed: number;
  currentLoad: number;
  temperature?: number;
}

export interface MemoryInfo {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  swapTotal: number;
  swapUsed: number;
  swapFree: number;
}

export interface DiskInfo {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
  filesystems: FileSystemInfo[];
}

export interface FileSystemInfo {
  mount: string;
  type: string;
  size: number;
  used: number;
  available: number;
  usePercent: number;
}

/**
 * User activity metrics
 */
export interface UserActivityMetrics {
  activeUsers: number;
  totalSessions: number;
  avgSessionDuration: number;
  toolExecutionsPerUser: number;
  peakActivityHour: number;
  activityTrend: 'increasing' | 'stable' | 'decreasing';
  periodCovered: string;
}

/**
 * User activity correlation with performance
 */
export interface ActivityCorrelation {
  userActivity: UserActivityMetrics;
  performanceImpact: {
    correlationStrength: 'strong' | 'moderate' | 'weak' | 'none';
    avgResponseTimeChange: number;
    errorRateChange: number;
    insights: string[];
  };
}
