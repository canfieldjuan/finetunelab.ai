/**
 * Unified Export Tool - Tool Definition
 * Uses the new Unified Export System (v2 API)
 * Date: 2025-12-21
 *
 * Enables the AI assistant to create exports using the new unified system.
 * Supports conversation, analytics, and trace exports in multiple formats.
 */

import { ToolDefinition } from '../types';

export const unifiedExportTool: ToolDefinition = {
  name: 'unified_export',
  description:
    'Create export files using the unified export system (v2). ' +
    'Supports conversation exports, analytics exports, and trace exports. ' +
    'Export types: conversation, analytics, trace. ' +
    'Formats: CSV, JSON, JSONL, Markdown, TXT. ' +
    'Use this to provide users with downloadable data exports.',
  version: '2.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['create_export', 'list_exports', 'get_download_link', 'delete_export'],
      },
      exportType: {
        type: 'string',
        description: 'Type of data to export (for create_export)',
        enum: ['conversation', 'analytics', 'trace'],
      },
      format: {
        type: 'string',
        description: 'Export format (for create_export)',
        enum: ['csv', 'json', 'jsonl', 'markdown', 'txt'],
      },
      // Data selectors
      conversationIds: {
        type: 'array',
        description: 'Array of conversation IDs to export (for conversation exports, each item is a string)',
      },
      startDate: {
        type: 'string',
        description: 'Start date for analytics/trace exports (YYYY-MM-DD format)',
      },
      endDate: {
        type: 'string',
        description: 'End date for analytics/trace exports (YYYY-MM-DD format)',
      },
      analyticsType: {
        type: 'string',
        description: 'Type of analytics data (for analytics exports)',
        enum: ['overview', 'timeseries', 'complete', 'model_comparison', 'tool_usage', 'quality_trends'],
      },
      // Options
      includeMetadata: {
        type: 'boolean',
        description: 'Include metadata in export (default: true)',
      },
      includeSystemMessages: {
        type: 'boolean',
        description: 'Include system messages in conversation exports (default: false)',
      },
      title: {
        type: 'string',
        description: 'Custom title for the export',
      },
      // List/get operations
      exportId: {
        type: 'string',
        description: 'Export ID (for get_download_link or delete_export)',
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
    enabled: true,
    requiresAuth: true,
    maxExecutionTime: 60000, // 60 seconds
  },

  async execute(params: Record<string, unknown>, conversationId?: string, userId?: string) {
    const { operation } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error('[UnifiedExport] Parameter validation failed: operation is required');
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('[UnifiedExport] Authentication: User ID required');
    }

    console.log('[UnifiedExport] Executing operation:', operation, 'for user:', userId);

    try {
      switch (operation) {
        case 'create_export': {
          const { exportType, format } = params;

          // Validate required parameters
          if (!exportType || typeof exportType !== 'string') {
            throw new Error('[UnifiedExport] Validation: exportType is required for create_export');
          }

          if (!format || typeof format !== 'string') {
            throw new Error('[UnifiedExport] Validation: format is required for create_export');
          }

          // Build data selector based on export type
          let dataSelector: Record<string, unknown>;

          if (exportType === 'conversation') {
            const conversationIds = params.conversationIds as string[] | undefined;
            if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
              throw new Error('[UnifiedExport] Validation: conversationIds array is required for conversation exports');
            }

            dataSelector = {
              type: 'conversation',
              conversationIds,
              includeSystemMessages: params.includeSystemMessages ?? false,
            };
          } else if (exportType === 'analytics') {
            const startDate = params.startDate as string | undefined;
            const endDate = params.endDate as string | undefined;
            const analyticsType = (params.analyticsType as string) || 'overview';

            if (!startDate || !endDate) {
              throw new Error('[UnifiedExport] Validation: startDate and endDate are required for analytics exports');
            }

            dataSelector = {
              type: 'analytics',
              startDate,
              endDate,
              analyticsType,
            };
          } else if (exportType === 'trace') {
            const startDate = params.startDate as string | undefined;
            const endDate = params.endDate as string | undefined;

            if (!startDate || !endDate) {
              throw new Error('[UnifiedExport] Validation: startDate and endDate are required for trace exports');
            }

            dataSelector = {
              type: 'trace',
              startDate,
              endDate,
            };
          } else {
            throw new Error(`[UnifiedExport] Validation: Unknown export type "${exportType}"`);
          }

          // Build options
          const options: Record<string, unknown> = {
            includeMetadata: params.includeMetadata ?? true,
          };

          if (params.title && typeof params.title === 'string') {
            options.title = params.title;
          }

          // Call the new v2 API
          const response = await fetch('/api/export/v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Note: In production, auth token should be passed from the chat context
            },
            body: JSON.stringify({
              exportType,
              format,
              dataSelector,
              options,
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`[UnifiedExport] Export creation failed: ${error.error || response.statusText}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(`[UnifiedExport] Export creation failed: ${result.error}`);
          }

          return {
            success: true,
            message: 'Export created successfully',
            export: result.export,
            downloadUrl: result.export?.downloadUrl,
            expiresAt: result.export?.expiresAt,
          };
        }

        case 'list_exports': {
          const limit = params.limit && typeof params.limit === 'number' ? params.limit : 20;
          const showExpired = params.showExpired && typeof params.showExpired === 'boolean' ? params.showExpired : false;
          const exportType = params.exportType as string | undefined;

          const queryParams = new URLSearchParams({
            limit: limit.toString(),
            showExpired: showExpired.toString(),
          });

          if (exportType) {
            queryParams.append('exportType', exportType);
          }

          const response = await fetch(`/api/export/v2?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
              // Note: In production, auth token should be passed from the chat context
            },
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`[UnifiedExport] List exports failed: ${error.error || response.statusText}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(`[UnifiedExport] List exports failed: ${result.error}`);
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
            throw new Error('[UnifiedExport] Validation: exportId is required for get_download_link');
          }

          // The download link is simply /api/export/v2/download/{id}
          // We can verify it exists by attempting to get export info
          const response = await fetch(`/api/export/v2?exportId=${exportId}`, {
            method: 'GET',
            headers: {
              // Note: In production, auth token should be passed from the chat context
            },
          });

          if (!response.ok) {
            throw new Error('[UnifiedExport] Export not found or access denied');
          }

          return {
            success: true,
            exportId,
            downloadUrl: `/api/export/v2/download/${exportId}`,
          };
        }

        case 'delete_export': {
          const { exportId } = params;

          if (!exportId || typeof exportId !== 'string') {
            throw new Error('[UnifiedExport] Validation: exportId is required for delete_export');
          }

          const response = await fetch(`/api/export/v2/delete/${exportId}`, {
            method: 'DELETE',
            headers: {
              // Note: In production, auth token should be passed from the chat context
            },
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(`[UnifiedExport] Delete failed: ${error.error || response.statusText}`);
          }

          const result = await response.json();

          if (!result.success) {
            throw new Error(`[UnifiedExport] Delete failed: ${result.error}`);
          }

          return {
            success: true,
            message: 'Export deleted successfully',
            exportId,
          };
        }

        default:
          throw new Error(`[UnifiedExport] Operation: Unknown operation "${operation}"`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[UnifiedExport] Execution error:', errorMessage);
      throw new Error(`[UnifiedExport] Execution: ${errorMessage}`);
    }
  },
};

// Export for auto-registration
export default unifiedExportTool;
