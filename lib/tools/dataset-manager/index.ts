// Dataset Manager Tool - Main Export
// Date: October 13, 2025

import { ToolDefinition } from '../types';
import { datasetConfig } from './dataset.config';
import datasetService from './dataset.service';

const datasetManagerTool: ToolDefinition = {
  name: 'dataset_manager',
  description: 'Manage training datasets from conversation history. ' +
    'List, export, filter, validate, delete, and merge conversation data for ML training workflows. ' +
    'Supports JSONL export format for fine-tuning. ' +
    'CRITICAL: When presenting dataset information, provide comprehensive analysis with statistics, trends, and actionable insights. ' +
    'Include data quality metrics, distribution analysis, and recommendations for improvement. ' +
    'Use clear formatting (tables, bullet points) and explain significance of findings.',
  version: '2.0.0',
  
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Dataset operation to perform',
        enum: ['list', 'stats', 'export', 'validate', 'delete', 'merge'],
      },
      dataset_filter: {
        type: 'object',
        description: 'Optional filters for dataset operations',
      },
      export_format: {
        type: 'string',
        description: 'Export format (default: jsonl)',
        enum: ['jsonl', 'json', 'csv'],
        default: 'jsonl',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of records to return',
        default: 1000,
      },
      user_id: {
        type: 'string',
        description: 'Optional user ID for testing purposes',
      },
      conversation_ids: {
        type: 'string',
        description: 'Comma-separated conversation IDs for delete/merge operations',
      },
      confirm_delete: {
        type: 'boolean',
        description: 'Confirmation flag required for delete operation (must be true)',
        default: false,
      },
      target_conversation_id: {
        type: 'string',
        description: 'Target conversation ID for merge operation',
      },
    },
    required: ['operation'],
  },
  
  config: {
    enabled: datasetConfig.enabled,
    maxExportSize: datasetConfig.maxExportSize,
  },
  
  async execute(params: Record<string, unknown>) {
    const { operation, dataset_filter, export_format, limit, user_id } = params;
    
    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[DatasetManager] Parameter validation failed: ' +
        'operation is required and must be a string'
      );
    }

    const validOps = ['list', 'stats', 'export', 'validate', 'delete', 'merge'];
    if (!validOps.includes(operation)) {
      throw new Error(
        `[DatasetManager] Invalid operation: ${operation}. ` +
        `Valid operations are: ${validOps.join(', ')}`
      );
    }

    // user_id is required for all operations
    if (!user_id || typeof user_id !== 'string') {
      throw new Error(
        '[DatasetManager] Parameter validation failed: ' +
        'user_id is required and must be a string'
      );
    }

    const userId = user_id;

    try {
      switch (operation) {
        case 'list': {
          const datasets = await datasetService.listDatasets(userId);
          return {
            operation: 'list',
            count: datasets.length,
            datasets,
          };
        }

        case 'stats': {
          const filter = dataset_filter as Record<string, unknown> | undefined;
          const stats = await datasetService.getDatasetStats(
            userId,
            filter
          );
          return {
            operation: 'stats',
            stats,
          };
        }

        case 'export': {
          const filter = dataset_filter as Record<string, unknown> | undefined;
          const format = (export_format as string) || 'jsonl';
          const exportLimit = typeof limit === 'number' ? limit : 1000;

          if (!['jsonl', 'json', 'csv'].includes(format)) {
            throw new Error(
              `[DatasetManager] Invalid format: ${format}`
            );
          }

          // Use exportService for jsonl/json (returns download URL)
          // Use legacy method for CSV (inline data)
          if (format === 'jsonl' || format === 'json') {
            console.debug('[DatasetManager] Using exportService for format:', format);

            const result = await datasetService.exportDatasetWithDownload(
              userId,
              filter,
              format as 'jsonl' | 'json',
              exportLimit
            );

            return {
              operation: 'export',
              format: result.format,
              total_records: result.total_records,
              downloadUrl: result.downloadUrl,
              exportId: result.exportId,
              fileSize: result.fileSize,
              expiresAt: result.expiresAt?.toISOString(),
              generated_at: result.generated_at,
              message: `Dataset exported successfully. Download: ${result.downloadUrl}`,
            };
          } else {
            // CSV: Use legacy inline export (no download URL support yet)
            console.debug('[DatasetManager] Using legacy export for CSV format');

            const result = await datasetService.exportDataset(
              userId,
              filter,
              format as 'jsonl' | 'json' | 'csv',
              exportLimit
            );

            return {
              operation: 'export',
              format: result.format,
              total_records: result.total_records,
              generated_at: result.generated_at,
              data: result.data,
              message: 'CSV export returned inline (download links not yet supported for CSV)',
            };
          }
        }

        case 'validate': {
          const filter = dataset_filter as Record<string, unknown> | undefined;
          const validation = await datasetService.validateDataset(
            userId,
            filter
          );
          return {
            operation: 'validate',
            ...validation,
          };
        }

        case 'delete': {
          const { confirm_delete, conversation_ids } = params;
          
          if (!confirm_delete || confirm_delete !== true) {
            throw new Error(
              '[DatasetManager] Delete operation requires confirm_delete=true'
            );
          }
          
          if (!conversation_ids || typeof conversation_ids !== 'string') {
            throw new Error(
              '[DatasetManager] Delete operation requires conversation_ids'
            );
          }
          
          const idsArray = conversation_ids.split(',').map(id => id.trim());
          
          console.debug(
            `[DatasetManager] Delete requested for ${idsArray.length} conversations`
          );
          
          const result = await datasetService.deleteConversations(
            userId,
            idsArray
          );
          
          return {
            operation: 'delete',
            deleted_count: result.deleted_count,
            conversation_ids: idsArray,
          };
        }

        case 'merge': {
          const { conversation_ids, target_conversation_id } = params;
          
          if (!conversation_ids || typeof conversation_ids !== 'string') {
            throw new Error(
              '[DatasetManager] Merge operation requires conversation_ids'
            );
          }
          
          if (!target_conversation_id || typeof target_conversation_id !== 'string') {
            throw new Error(
              '[DatasetManager] Merge operation requires target_conversation_id'
            );
          }
          
          const sourceIds = conversation_ids
            .split(',')
            .map(id => id.trim())
            .filter(id => id !== target_conversation_id);
          
          console.debug(
            `[DatasetManager] Merge requested: ${sourceIds.length} conversations into ${target_conversation_id}`
          );
          
          const result = await datasetService.mergeConversations(
            userId,
            sourceIds,
            target_conversation_id
          );
          
          return {
            operation: 'merge',
            target_conversation_id,
            merged_count: result.merged_count,
            messages_moved: result.messages_moved,
          };
        }

        default:
          throw new Error(
            `[DatasetManager] Unsupported operation: ${operation}`
          );
      }
    } catch (error) {
      if (error instanceof Error && 
          error.message.startsWith('[DatasetManager]')) {
        throw error;
      }
      throw new Error(
        `[DatasetManager] Execution failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
};

export default datasetManagerTool;
