// System Monitor Tool - Service Implementation
// Date: October 13, 2025

import { supabase } from '../../supabaseClient';
import { registry } from '../registry';
import { systemMonitorConfig } from './config';
import { SystemInformationService } from './system.service';
import { DynamicThresholdService } from './threshold.service';
import { UserActivityService } from './user-activity.service';
import type {
  SystemHealth,
  ResourceUsage,
  PerformanceMetrics,
  AlertCollection,
  MonitorOptions,
  ServiceCheck,
  TableStat,
  DatabaseStats,
  Alert,
  InfoMessage,
  Trends,
  ToolExecutionMetrics,
} from './types';

interface DbStatsTable {
  table_name: string;
  row_count: number;
  table_size_bytes: number;
  index_size_bytes: number;
}

/**
 * System Monitor Service
 * Provides health checks, resource monitoring, and performance metrics
 */
export class SystemMonitorService {
  private logger = console;
  private systemInfoService = new SystemInformationService();
  private thresholdService = new DynamicThresholdService();
  private userActivityService = new UserActivityService();

  /**
   * Check overall system health
   */
  async checkHealth(): Promise<SystemHealth> {
    this.logger.debug('[SystemMonitor] Starting health check...');
    const issues: string[] = [];

    // Check database connectivity
    this.logger.debug('[SystemMonitor] Checking database connectivity...');
    const dbCheck = await this.checkDatabase();
    if (dbCheck.status !== 'up') {
      issues.push(`Database ${dbCheck.status}: ${dbCheck.message}`);
      this.logger.debug(`[SystemMonitor] Database issue detected: ${dbCheck.status}`);
    }

    // Check API availability
    this.logger.debug('[SystemMonitor] Checking API availability...');
    const apiCheck = await this.checkAPI();
    if (apiCheck.status !== 'up') {
      issues.push(`API ${apiCheck.status}: ${apiCheck.message}`);
      this.logger.debug(`[SystemMonitor] API issue detected: ${apiCheck.status}`);
    }

    // Check tools status
    this.logger.debug('[SystemMonitor] Checking tools status...');
    const toolsStatus = this.checkTools();
    if (toolsStatus.available < toolsStatus.enabled) {
      issues.push(
        `${toolsStatus.enabled - toolsStatus.available} tools are unavailable`
      );
      this.logger.debug(
        `[SystemMonitor] ${toolsStatus.enabled - toolsStatus.available} tools unavailable`
      );
    }

    // Check system resources (CPU, Memory, Disk)
    this.logger.debug('[SystemMonitor] Checking system resources...');
    let systemInfo;
    try {
      systemInfo = await this.systemInfoService.getSystemInfo();
      
      // Check for resource issues
      if (systemInfo.cpu.currentLoad > 90) {
        issues.push(`High CPU load: ${systemInfo.cpu.currentLoad}%`);
        this.logger.debug(`[SystemMonitor] High CPU load detected: ${systemInfo.cpu.currentLoad}%`);
      }
      
      if (systemInfo.memory.usagePercent > 90) {
        issues.push(`High memory usage: ${systemInfo.memory.usagePercent}%`);
        this.logger.debug(`[SystemMonitor] High memory usage detected: ${systemInfo.memory.usagePercent}%`);
      }
      
      if (systemInfo.disk.usagePercent > 85) {
        issues.push(`High disk usage: ${systemInfo.disk.usagePercent}%`);
        this.logger.debug(`[SystemMonitor] High disk usage detected: ${systemInfo.disk.usagePercent}%`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemMonitor] Failed to fetch system resources:', errorMessage);
      issues.push('Unable to fetch system resource metrics');
      systemInfo = null;
    }

    // Calculate health score
    const score = this.calculateHealthScore(
      dbCheck,
      apiCheck,
      toolsStatus,
      systemInfo
    );
    const status = this.getHealthStatus(score);

    this.logger.debug(
      `[SystemMonitor] Health check complete. Status: ${status}, Score: ${score}, Issues: ${issues.length}`
    );

    return {
      status,
      score,
      services: {
        database: dbCheck,
        api: apiCheck,
        tools: toolsStatus,
      },
      timestamp: new Date().toISOString(),
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Get resource usage information
   */
  async getResourceUsage(): Promise<ResourceUsage> {
    this.logger.debug('[SystemMonitor] Fetching resource usage information...');

    // Get database statistics
    this.logger.debug('[SystemMonitor] Getting database statistics...');
    const dbStats = await this.getDatabaseStats();

    // Get storage counts
    this.logger.debug('[SystemMonitor] Getting storage statistics...');
    const storageStats = await this.getStorageStats();

    // Get performance stats
    this.logger.debug('[SystemMonitor] Getting performance statistics...');
    const perfStats = await this.getPerformanceStats();

    this.logger.debug('[SystemMonitor] Resource usage fetch complete.');

    return {
      database: dbStats,
      storage: storageStats,
      performance: perfStats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get performance metrics for a time period
   */
  async getPerformanceMetrics(
    options: MonitorOptions = {}
  ): Promise<PerformanceMetrics> {
    const period = options.period || systemMonitorConfig.defaultPeriod;
    const { startDate, endDate } = this.getDateRange(period, options.endDate);

    this.logger.debug(
      `[SystemMonitor] Fetching performance metrics for period: ${period}, from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Get tool execution metrics
    this.logger.debug('[SystemMonitor] Getting tool execution metrics...');
    const toolMetrics = await this.getToolExecutionMetrics(startDate, endDate);

    // Calculate trends
    this.logger.debug('[SystemMonitor] Calculating performance trends...');
    const trends = await this.calculateTrends(toolMetrics, startDate, endDate);

    // Get breakdown by time period
    this.logger.debug('[SystemMonitor] Getting metrics breakdown...');
    const breakdown = await this.getMetricsBreakdown(
      startDate,
      endDate,
      period
    );

    this.logger.debug('[SystemMonitor] Performance metrics fetch complete.');

    return {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      metrics: {
        avgResponseTime: toolMetrics.avgDuration,
        requestCount: toolMetrics.total,
        errorRate: toolMetrics.total > 0 ? toolMetrics.failed / toolMetrics.total : 0,
        successRate:
          toolMetrics.total > 0 ? toolMetrics.successful / toolMetrics.total : 1,
        toolExecutions: toolMetrics,
      },
      trends,
      breakdown,
    };
  }

  /**
   * Get active alerts and warnings
   */
  async getAlerts(): Promise<AlertCollection> {
    this.logger.debug('[SystemMonitor] Checking for active alerts and warnings...');
    const alerts: Alert[] = [];
    const warnings: Alert[] = [];
    const info: InfoMessage[] = [];

    // Check resource usage alerts
    this.logger.debug('[SystemMonitor] Checking resource usage alerts...');
    const resourceUsage = await this.getResourceUsage();
    const resourceAlerts = this.checkResourceAlerts(resourceUsage);
    alerts.push(...resourceAlerts.critical);
    warnings.push(...resourceAlerts.warnings);
    this.logger.debug(
      `[SystemMonitor] Resource alerts: ${resourceAlerts.critical.length} critical, ${resourceAlerts.warnings.length} warnings`
    );

    // Check performance alerts
    this.logger.debug('[SystemMonitor] Checking performance alerts...');
    const perfMetrics = await this.getPerformanceMetrics({ period: 'hour' });
    const perfAlerts = await this.checkPerformanceAlerts(perfMetrics);
    alerts.push(...perfAlerts.critical);
    warnings.push(...perfAlerts.warnings);
    this.logger.debug(
      `[SystemMonitor] Performance alerts: ${perfAlerts.critical.length} critical, ${perfAlerts.warnings.length} warnings`
    );

    // Add info messages
    if (alerts.length === 0 && warnings.length === 0) {
      info.push({
        type: 'system_healthy',
        message: 'All systems operating normally',
        timestamp: new Date().toISOString(),
      });
    }

    const systemStatus =
      alerts.length > 0 ? 'critical' : warnings.length > 0 ? 'degraded' : 'healthy';

    this.logger.debug(
      `[SystemMonitor] Alert check complete. System status: ${systemStatus}, Total alerts: ${alerts.length}, Total warnings: ${warnings.length}`
    );

    return {
      critical: alerts,
      warnings,
      info,
      summary: {
        totalCritical: alerts.length,
        totalWarnings: warnings.length,
        systemStatus,
      },
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Formats bytes into a human-readable string (KB, MB, GB).
   * @param bytes The number of bytes.
   * @param decimals The number of decimal places to use.
   * @returns A formatted string.
   */
  private formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Check database connectivity and latency
   */
  private async checkDatabase(): Promise<ServiceCheck> {
    const startTime = Date.now();
    try {
      // Simple query to test connection
      const { error } = await supabase.from('tools').select('count').limit(1);

      const latency = Date.now() - startTime;

      if (error) {
        return {
          status: 'down',
          latency,
          message: error.message,
        };
      }

      const status =
        latency > systemMonitorConfig.health.maxLatency ? 'degraded' : 'up';

      return {
        status,
        latency,
      };
    } catch (error: unknown) {
      this.logger.error(
        'Database health check failed:',
        error instanceof Error ? error.message : String(error)
      );
      return {
        status: 'down',
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      };
    }
  }

  /**
   * Check API availability
   */
  private async checkAPI(): Promise<ServiceCheck> {
    const startTime = Date.now();
    try {
      // Check if we can access Supabase client
      const latency = Date.now() - startTime;

      return {
        status: 'up',
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        latency: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'API check failed',
      };
    }
  }

  /**
   * Check tools registry status
   */
  private checkTools() {
    const allTools = registry.getAll();
    const enabledTools = registry.getEnabled();

    return {
      total: allTools.length,
      enabled: enabledTools.length,
      disabled: allTools.length - enabledTools.length,
      available: enabledTools.length,
    };
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(
    dbCheck: ServiceCheck,
    apiCheck: ServiceCheck,
    toolsStatus: { available: number; enabled: number },
    systemInfo: { cpu: { currentLoad: number }; memory: { usagePercent: number }; disk: { usagePercent: number } } | null
  ): number {
    let score = 100;

    // Database health (25% weight)
    if (dbCheck.status === 'down') score -= 25;
    else if (dbCheck.status === 'degraded') score -= 12;
    else if (dbCheck.latency > systemMonitorConfig.health.maxLatency / 2)
      score -= 6;

    // API health (20% weight)
    if (apiCheck.status === 'down') score -= 20;
    else if (apiCheck.status === 'degraded') score -= 10;

    // Tools availability (20% weight)
    const toolsRatio = toolsStatus.available / Math.max(toolsStatus.enabled, 1);
    score -= (1 - toolsRatio) * 20;

    // System resources health (35% weight)
    if (systemInfo) {
      // CPU (12% of total)
      if (systemInfo.cpu.currentLoad > 90) score -= 12;
      else if (systemInfo.cpu.currentLoad > 75) score -= 6;
      else if (systemInfo.cpu.currentLoad > 50) score -= 3;

      // Memory (12% of total)
      if (systemInfo.memory.usagePercent > 90) score -= 12;
      else if (systemInfo.memory.usagePercent > 75) score -= 6;
      else if (systemInfo.memory.usagePercent > 50) score -= 3;

      // Disk (11% of total)
      if (systemInfo.disk.usagePercent > 90) score -= 11;
      else if (systemInfo.disk.usagePercent > 80) score -= 6;
      else if (systemInfo.disk.usagePercent > 60) score -= 3;
    } else {
      // If system info is unavailable, deduct partial points
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get health status from score
   */
  private getHealthStatus(
    score: number
  ): 'healthy' | 'degraded' | 'unhealthy' {
    if (score >= systemMonitorConfig.health.healthyScore) return 'healthy';
    if (score >= systemMonitorConfig.health.degradedScore) return 'degraded';
    return 'unhealthy';
  }

  /**
   * Get database statistics, including total size and individual table sizes.
   */
  private async getDatabaseStats(): Promise<DatabaseStats> {
    this.logger.debug('Fetching database statistics...');
    try {
      // We need to create a stored procedure to run these queries
      // Let's assume a function 'get_db_stats' is created in Supabase SQL editor
      const { data, error } = await supabase.rpc('get_db_stats');

      if (error) {
        throw new Error(`Failed to get DB stats: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from get_db_stats');
      }

      const { total_size_bytes, tables } = data;

      const tableStats: TableStat[] = tables.map((t: DbStatsTable) => ({
        name: t.table_name,
        rowCount: t.row_count || 0,
        size: this.formatBytes(t.table_size_bytes || 0),
        indexSize: this.formatBytes(t.index_size_bytes || 0),
      }));

      // This part is a stub for now, as we can't get live connection info easily
      const connectionInfo = {
        active: 0,
        idle: 0,
        max: systemMonitorConfig.resources.maxConnections,
      };
      this.logger.debug('Successfully fetched database statistics.');

      return {
        totalSize: this.formatBytes(total_size_bytes || 0),
        tableStats,
        connectionInfo,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error fetching database stats:', errorMessage);
      // Return a default/error state that matches the type
      return {
        totalSize: 'Error',
        tableStats: [],
        connectionInfo: {
          active: 0,
          idle: 0,
          max: systemMonitorConfig.resources.maxConnections,
        },
      };
    }
  }

  /**
   * Get high-level storage statistics
   */
  private async getStorageStats() {
    try {
      const [convResult, msgResult, evalResult, execResult, userResult] =
        await Promise.all([
          supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true }),
          supabase.from('messages').select('*', { count: 'exact', head: true }),
          supabase
            .from('message_evaluations')
            .select('*', { count: 'exact', head: true }),
          supabase
            .from('tool_executions')
            .select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }),
        ]);

      return {
        conversations: convResult.count || 0,
        messages: msgResult.count || 0,
        evaluations: evalResult.count || 0,
        toolExecutions: execResult.count || 0,
        users: userResult.count || 0,
      };
    } catch (error) {
      console.error('[SystemMonitor] Error getting storage stats:', error);
      return {
        conversations: 0,
        messages: 0,
        evaluations: 0,
        toolExecutions: 0,
        users: 0,
      };
    }
  }

  /**
   * Get performance statistics
   */
  private async getPerformanceStats() {
    try {
      // Get slow tool executions (>1s)
      const { count: slowCount } = await supabase
        .from('tool_executions')
        .select('*', { count: 'exact', head: true })
        .gt('execution_time_ms', systemMonitorConfig.performance.slowQueryThreshold);

      // Get average execution time
      const { data: execData } = await supabase
        .from('tool_executions')
        .select('execution_time_ms')
        .order('created_at', { ascending: false })
        .limit(100);

      const avgQueryTime = execData && execData.length > 0
        ? execData.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) /
          execData.length
        : 0;

      return {
        slowQueries: slowCount || 0,
        avgQueryTime: Math.round(avgQueryTime),
        cacheHitRate: 0, // No cache system implemented yet
      };
    } catch (error) {
      console.error('[SystemMonitor] Error getting performance stats:', error);
      return {
        slowQueries: 0,
        avgQueryTime: 0,
        cacheHitRate: 0,
      };
    }
  }

  /**
   * Get tool execution metrics for a time period
   */
  private async getToolExecutionMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<ToolExecutionMetrics> {
    try {
      const { data, error } = await supabase
        .from('tool_executions')
        .select('tool_name, execution_time_ms, error_message, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(systemMonitorConfig.limits.maxToolExecutions);

      if (error || !data) {
        return {
          total: 0,
          successful: 0,
          failed: 0,
          avgDuration: 0,
          byTool: {},
        };
      }

      const total = data.length;
      const successful = data.filter((e) => !e.error_message).length;
      const failed = total - successful;
      const avgDuration =
        total > 0
          ? data.reduce((sum, e) => sum + (e.execution_time_ms || 0), 0) / total
          : 0;

      // Group by tool
      const byTool: { [key: string]: { executions: number; totalTime: number; errors: number } } = {};

      data.forEach((exec) => {
        if (!byTool[exec.tool_name]) {
          byTool[exec.tool_name] = { executions: 0, totalTime: 0, errors: 0 };
        }
        byTool[exec.tool_name].executions++;
        byTool[exec.tool_name].totalTime += exec.execution_time_ms || 0;
        if (exec.error_message) {
          byTool[exec.tool_name].errors++;
        }
      });

      const byToolMetrics: { [key: string]: { executions: number; avgDuration: number; errorRate: number } } = {};
      Object.entries(byTool).forEach(([toolName, stats]) => {
        byToolMetrics[toolName] = {
          executions: stats.executions,
          avgDuration: stats.totalTime / stats.executions,
          errorRate: stats.errors / stats.executions,
        };
      });

      return {
        total,
        successful,
        failed,
        avgDuration: Math.round(avgDuration),
        byTool: byToolMetrics,
      };
    } catch (error) {
      console.error('[SystemMonitor] Error getting tool metrics:', error);
      return {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        byTool: {},
      };
    }
  }

  /**
   * Calculate performance trends by comparing current metrics with historical data
   */
  private async calculateTrends(
    metrics: ToolExecutionMetrics,
    startDate: Date,
    endDate: Date
  ): Promise<Trends> {
    this.logger.debug('Calculating performance trends with historical data...');

    try {
      // Calculate the duration of the current period
      const periodDuration = endDate.getTime() - startDate.getTime();

      // Get historical data from the previous period of the same duration
      const historicalEndDate = new Date(startDate.getTime());
      const historicalStartDate = new Date(
        startDate.getTime() - periodDuration
      );

      const historicalMetrics = await this.getToolExecutionMetrics(
        historicalStartDate,
        historicalEndDate
      );

      // Calculate percentage changes
      const responseTimeChange =
        historicalMetrics.avgDuration > 0
          ? ((metrics.avgDuration - historicalMetrics.avgDuration) /
              historicalMetrics.avgDuration) *
            100
          : 0;

      const throughputChange =
        historicalMetrics.total > 0
          ? ((metrics.total - historicalMetrics.total) /
              historicalMetrics.total) *
            100
          : 0;

      const currentErrorRate =
        metrics.total > 0 ? metrics.failed / metrics.total : 0;
      const historicalErrorRate =
        historicalMetrics.total > 0
          ? historicalMetrics.failed / historicalMetrics.total
          : 0;

      const errorRateChange =
        historicalErrorRate > 0
          ? ((currentErrorRate - historicalErrorRate) / historicalErrorRate) *
            100
          : 0;

      this.logger.debug(
        `Trend analysis: Response time ${responseTimeChange.toFixed(1)}%, Throughput ${throughputChange.toFixed(1)}%, Error rate ${errorRateChange.toFixed(1)}%`
      );

      // Determine trends based on percentage changes
      // Using 10% as the threshold for significant change
      const significantThreshold = 10;

      return {
        responseTime:
          responseTimeChange < -significantThreshold
            ? 'improving'
            : responseTimeChange > significantThreshold
            ? 'degrading'
            : 'stable',
        throughput:
          throughputChange > significantThreshold
            ? 'increasing'
            : throughputChange < -significantThreshold
            ? 'decreasing'
            : 'stable',
        errorRate:
          errorRateChange < -significantThreshold
            ? 'improving'
            : errorRateChange > significantThreshold
            ? 'degrading'
            : 'stable',
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Error calculating trends:', errorMessage);

      // Fallback to simple static analysis if historical data fetch fails
      const errorRate =
        metrics.total > 0 ? metrics.failed / metrics.total : 0;

      return {
        responseTime:
          metrics.avgDuration <
          systemMonitorConfig.performance.maxResponseTime * 0.5
            ? 'improving'
            : metrics.avgDuration >
              systemMonitorConfig.performance.maxResponseTime
            ? 'degrading'
            : 'stable',
        throughput:
          metrics.total > systemMonitorConfig.performance.minThroughput
            ? 'increasing'
            : 'stable',
        errorRate:
          errorRate < systemMonitorConfig.performance.maxErrorRate * 0.5
            ? 'improving'
            : errorRate > systemMonitorConfig.performance.maxErrorRate
            ? 'degrading'
            : 'stable',
      };
    }
  }

  /**
   * Get metrics breakdown by time
   */
  private async getMetricsBreakdown(
    startDate: Date,
    endDate: Date,
    period: string
  ) {
    this.logger.debug(
      `Fetching metrics breakdown for period: ${period}, from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    try {
      // Get tool execution data for the period
      const { data: executions, error } = await supabase
        .from('tool_executions')
        .select('tool_name, created_at, duration')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        this.logger.error('Error fetching tool executions:', error.message);
        return { byTool: {} };
      }

      if (!executions || executions.length === 0) {
        this.logger.debug('No tool executions found for the specified period.');
        return { byTool: {} };
      }

      // Aggregate data by tool
      const byTool: { [toolName: string]: number } = {};
      executions.forEach((exec: { tool_name: string }) => {
        byTool[exec.tool_name] = (byTool[exec.tool_name] || 0) + 1;
      });

      this.logger.debug(
        `Metrics breakdown complete. Tools found: ${Object.keys(byTool).length}`
      );

      return { byTool };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error('Error in getMetricsBreakdown:', errorMessage);
      return { byTool: {} };
    }
  }

  /**
   * Check for resource-related alerts
   */
  private checkResourceAlerts(usage: ResourceUsage): {
    critical: Alert[];
    warnings: Alert[];
  } {
    const critical: Alert[] = [];
    const warnings: Alert[] = [];
    const timestamp = new Date().toISOString();

    // Check table sizes
    usage.database.tableStats.forEach((table) => {
      if (table.rowCount > systemMonitorConfig.resources.criticalTableSize) {
        critical.push({
          type: 'table_size',
          message: `Table "${table.name}" has ${table.rowCount} rows (critical threshold: ${systemMonitorConfig.resources.criticalTableSize})`,
          threshold: systemMonitorConfig.resources.criticalTableSize,
          current: table.rowCount,
          severity: 'critical',
          timestamp,
          recommendations: [
            'Consider archiving old data',
            'Review data retention policies',
          ],
        });
      } else if (table.rowCount > systemMonitorConfig.resources.warnTableSize) {
        warnings.push({
          type: 'table_size',
          message: `Table "${table.name}" has ${table.rowCount} rows`,
          threshold: systemMonitorConfig.resources.warnTableSize,
          current: table.rowCount,
          severity: 'warning',
          timestamp,
        });
      }
    });

    // Check slow queries
    if (usage.performance.slowQueries > 10) {
      warnings.push({
        type: 'slow_queries',
        message: `${usage.performance.slowQueries} slow queries detected`,
        threshold: 10,
        current: usage.performance.slowQueries,
        severity: 'warning',
        timestamp,
        recommendations: ['Review query performance', 'Consider adding indexes'],
      });
    }

    return { critical, warnings };
  }

  /**
   * Check for performance-related alerts using dynamic thresholds
   */
  private async checkPerformanceAlerts(metrics: PerformanceMetrics): Promise<{
    critical: Alert[];
    warnings: Alert[];
  }> {
    const critical: Alert[] = [];
    const warnings: Alert[] = [];
    const timestamp = new Date().toISOString();

    // Get dynamic thresholds
    const thresholds = await this.thresholdService.getThresholds();

    // Check error rate
    if (metrics.metrics.errorRate > thresholds.errorRate.critical) {
      critical.push({
        type: 'error_rate',
        message: `Error rate is ${(metrics.metrics.errorRate * 100).toFixed(1)}% (dynamic threshold: ${(thresholds.errorRate.critical * 100).toFixed(1)}%)`,
        threshold: thresholds.errorRate.critical,
        current: metrics.metrics.errorRate,
        severity: 'critical',
        timestamp,
        recommendations: ['Review recent errors', 'Check system logs'],
      });
    } else if (metrics.metrics.errorRate > thresholds.errorRate.warning) {
      warnings.push({
        type: 'error_rate',
        message: `Error rate is ${(metrics.metrics.errorRate * 100).toFixed(1)}% (dynamic threshold: ${(thresholds.errorRate.warning * 100).toFixed(1)}%)`,
        threshold: thresholds.errorRate.warning,
        current: metrics.metrics.errorRate,
        severity: 'warning',
        timestamp,
      });
    }

    // Check response time
    if (metrics.metrics.avgResponseTime > thresholds.responseTime.critical) {
      critical.push({
        type: 'response_time',
        message: `Average response time is ${metrics.metrics.avgResponseTime}ms (dynamic threshold: ${thresholds.responseTime.critical}ms)`,
        threshold: thresholds.responseTime.critical,
        current: metrics.metrics.avgResponseTime,
        severity: 'critical',
        timestamp,
        recommendations: [
          'Review slow operations',
          'Check database performance',
        ],
      });
    } else if (metrics.metrics.avgResponseTime > thresholds.responseTime.warning) {
      warnings.push({
        type: 'response_time',
        message: `Average response time is ${metrics.metrics.avgResponseTime}ms (dynamic threshold: ${thresholds.responseTime.warning}ms)`,
        threshold: thresholds.responseTime.warning,
        current: metrics.metrics.avgResponseTime,
        severity: 'warning',
        timestamp,
      });
    }

    this.logger.debug(
      `[SystemMonitor] Performance alerts: ${critical.length} critical, ${warnings.length} warnings (using dynamic thresholds)`
    );

    return { critical, warnings };
  }

  /**
   * Get date range for a period
   */
  private getDateRange(
    period: string,
    endDateStr?: string
  ): { startDate: Date; endDate: Date } {
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = new Date(endDate);

    switch (period) {
      case 'hour':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'all':
        startDate.setFullYear(2020); // Beginning of time for this system
        break;
      default:
        startDate.setDate(startDate.getDate() - 1);
    }

    return { startDate, endDate };
  }

  /**
   * Get user activity metrics correlated with system performance
   * @param periodHours Number of hours to analyze (default: 24)
   */
  async getUserActivityCorrelation(periodHours: number = 24) {
    this.logger.debug(
      `[SystemMonitor] Getting user activity correlation for last ${periodHours} hours...`
    );

    try {
      const correlation = await this.userActivityService.correlateWithPerformance(periodHours);
      
      this.logger.debug(
        `[SystemMonitor] User activity correlation: ${correlation.performanceImpact.correlationStrength}`
      );

      return {
        status: 'success',
        data: correlation,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[SystemMonitor] Error getting user activity correlation:', errorMessage);

      return {
        status: 'error',
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
export const systemMonitorService = new SystemMonitorService();
