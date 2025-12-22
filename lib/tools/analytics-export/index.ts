/**
 * Analytics Export Tool - Tool Definition
 * Phase 6: LLM Integration
 * Date: October 25, 2025
 *
 * Enables LLM to create analytics exports and provide download links
 *
 * @deprecated This tool has been replaced by unified_export tool (lib/tools/unified-export).
 * Please use the unified_export tool which supports all export types via the v2 API.
 * See migration guide: /docs/export-migration.md
 * This tool will be removed after 60-day grace period.
 */

import { ToolDefinition } from '../types';
import { analyticsExportService } from './analytics-export.service';
import { analyticsExportConfig } from './config';

export const analyticsExportTool: ToolDefinition = {
  name: 'analytics_export',
  description:
    'Create analytics export files (CSV, JSON, or Report) and get download links. ' +
    'Export types: overview, timeseries, complete, model_comparison, tool_usage, quality_trends. ' +
    'Use this to provide users with downloadable analytics data.',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['create_export', 'list_exports', 'get_download_link'],
      },
      format: {
        type: 'string',
        description: 'Export format (for create_export)',
        enum: ['csv', 'json', 'report'],
      },
      exportType: {
        type: 'string',
        description: 'Type of analytics data to export (for create_export)',
        enum: [
          'overview',
          'timeseries',
          'complete',
          'model_comparison',
          'tool_usage',
          'quality_trends',
        ],
      },
      startDate: {
        type: 'string',
        description: 'Start date for data range (YYYY-MM-DD format)',
      },
      endDate: {
        type: 'string',
        description: 'End date for data range (YYYY-MM-DD format)',
      },
      exportId: {
        type: 'string',
        description: 'Export ID (for get_download_link)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of exports to list (for list_exports, default: 20)',
      },
      showExpired: {
        type: 'boolean',
        description: 'Include expired exports in list (for list_exports, default: false)',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: analyticsExportConfig.enabled,
    defaultFormat: analyticsExportConfig.defaultFormat,
    defaultType: analyticsExportConfig.defaultType,
    maxExportsPerUser: analyticsExportConfig.maxExportsPerUser,
  },

  async execute(params: Record<string, unknown>, conversationId?: string, userId?: string, supabaseClient?: unknown) {
    const { operation } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[AnalyticsExport] Parameter validation failed: operation is required'
      );
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('[AnalyticsExport] Authentication: User ID required');
    }

    console.log('[AnalyticsExport] Executing operation:', operation, 'for user:', userId);

    try {
      switch (operation) {
        case 'create_export': {
          const { format, exportType, startDate, endDate } = params;

          // Validate required parameters
          if (!format || typeof format !== 'string') {
            throw new Error(
              '[AnalyticsExport] Validation: format is required for create_export'
            );
          }

          if (!exportType || typeof exportType !== 'string') {
            throw new Error(
              '[AnalyticsExport] Validation: exportType is required for create_export'
            );
          }

          // Validate optional date parameters
          const validStartDate =
            startDate && typeof startDate === 'string' ? startDate : undefined;
          const validEndDate =
            endDate && typeof endDate === 'string' ? endDate : undefined;

          const result = await analyticsExportService.createExport({
            userId,
            format: format as 'csv' | 'json' | 'report',
            exportType: exportType as string,
            startDate: validStartDate,
            endDate: validEndDate,
          });

          if (!result.success) {
            throw new Error(`[AnalyticsExport] Export creation failed: ${result.error}`);
          }

          return {
            success: true,
            message: 'Export created successfully',
            export: result.export,
            downloadUrl: result.export?.downloadUrl,
          };
        }

        case 'list_exports': {
          const limit =
            params.limit && typeof params.limit === 'number' ? params.limit : 20;
          const showExpired =
            params.showExpired && typeof params.showExpired === 'boolean'
              ? params.showExpired
              : false;

          const result = await analyticsExportService.listExports({
            userId,
            limit,
            showExpired,
          }, supabaseClient);

          if (!result.success) {
            throw new Error(`[AnalyticsExport] List exports failed: ${result.error}`);
          }

          return {
            success: true,
            count: result.exports?.length || 0,
            exports: result.exports,
          };
        }

        case 'get_download_link': {
          const { exportId } = params;

          if (!exportId || typeof exportId !== 'string') {
            throw new Error(
              '[AnalyticsExport] Validation: exportId is required for get_download_link'
            );
          }

          const result = await analyticsExportService.getDownloadLink(exportId, userId, supabaseClient);

          if (!result.success) {
            throw new Error(
              `[AnalyticsExport] Get download link failed: ${result.error}`
            );
          }

          return {
            success: true,
            exportId,
            downloadUrl: result.downloadUrl,
          };
        }

        default:
          throw new Error(`[AnalyticsExport] Operation: Unknown operation "${operation}"`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[AnalyticsExport] Execution error:', errorMessage);
      throw new Error(`[AnalyticsExport] Execution: ${errorMessage}`);
    }
  },
};

// Note: Tool is auto-registered in registry.ts
