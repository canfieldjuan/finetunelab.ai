// System Monitor Tool - Tool Definition
// Date: October 13, 2025

import { ToolDefinition } from '../types';
import { systemMonitorService } from './monitor.service';
import { SystemInformationService } from './system.service';
import { LogAnalysisService } from './log-analysis.service';
import { systemMonitorConfig } from './config';

const systemInfoService = new SystemInformationService();
const logAnalysisService = new LogAnalysisService();

export const systemMonitorTool: ToolDefinition = {
  name: 'system_monitor',
  description:
    'Monitor system health, resource usage, and performance metrics. Check database status, tool availability, OS-level resources (CPU, Memory, Disk), analyze logs for errors, correlate user activity with performance, and get alerts for potential issues.',
  version: '1.4.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Monitoring operation to perform',
        enum: [
          'health_check',
          'resource_usage',
          'performance_metrics',
          'get_alerts',
          'get_system_info',
          'analyze_logs',
          'user_activity_correlation',
        ],
      },
      period: {
        type: 'string',
        enum: ['hour', 'day', 'week', 'month', 'all'],
        description: 'Time period for metrics analysis (default: day)',
      },
      metricType: {
        type: 'string',
        enum: ['response_time', 'throughput', 'errors', 'all'],
        description: 'Type of performance metrics to retrieve',
      },
      includeDetails: {
        type: 'boolean',
        description: 'Include detailed breakdown in results',
      },
      periodHours: {
        type: 'number',
        description: 'Number of hours to analyze logs (default: 1, for analyze_logs operation)',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: systemMonitorConfig.enabled,
    defaultPeriod: systemMonitorConfig.defaultPeriod,
    healthCheckInterval: systemMonitorConfig.health.checkInterval,
  },

  async execute(params: Record<string, unknown>) {
    const { operation, ...options } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[SystemMonitor] Parameter validation failed: operation is required and must be a string'
      );
    }

    try {
      switch (operation) {
        case 'health_check': {
          const health = await systemMonitorService.checkHealth();
          return {
            success: true,
            data: health,
          };
        }

        case 'resource_usage': {
          const usage = await systemMonitorService.getResourceUsage();
          return {
            success: true,
            data: usage,
          };
        }

        case 'performance_metrics': {
          const metrics = await systemMonitorService.getPerformanceMetrics(options);
          return {
            success: true,
            data: metrics,
          };
        }

        case 'get_alerts': {
          const alerts = await systemMonitorService.getAlerts();
          return {
            success: true,
            data: alerts,
          };
        }

        case 'get_system_info': {
          const systemInfo = await systemInfoService.getSystemInfo();
          return {
            success: true,
            data: systemInfo,
          };
        }

        case 'analyze_logs': {
          const periodHours =
            typeof options.periodHours === 'number' ? options.periodHours : 1;
          const logAnalysis = await logAnalysisService.analyzeLogs(
            'application',
            periodHours
          );
          return {
            success: true,
            data: logAnalysis,
          };
        }

        case 'user_activity_correlation': {
          const periodHours =
            typeof options.periodHours === 'number' ? options.periodHours : 24;
          const correlation = await systemMonitorService.getUserActivityCorrelation(
            periodHours
          );
          return {
            success: true,
            data: correlation,
          };
        }

        default:
          throw new Error(
            `[SystemMonitor] Operation: Unknown operation "${operation}"`
          );
      }
    } catch (error) {
      throw new Error(
        `[SystemMonitor] Execution: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
};

// Note: Tool is auto-registered in registry.ts to avoid circular dependency
