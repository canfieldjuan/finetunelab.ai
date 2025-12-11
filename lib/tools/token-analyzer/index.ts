// Token Analyzer Tool - Tool Definition
// Date: October 13, 2025

import { ToolDefinition } from '../types';
import { tokenAnalyzerService } from './token-analyzer.service';
import { tokenAnalyzerConfig } from './config';

export const tokenAnalyzerTool: ToolDefinition = {
  name: 'token_analyzer',
  description:
    'Track token usage, analyze costs, compare model efficiency, and get optimization recommendations for LLM conversations',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Analysis operation to perform',
        enum: ['usage_stats', 'cost_analysis', 'model_comparison', 'optimization_tips'],
      },
      period: {
        type: 'string',
        enum: ['day', 'week', 'month', 'all'],
        description: 'Time period to analyze (default: week)',
      },
      conversationId: {
        type: 'string',
        description: 'Optional: Analyze specific conversation only',
      },
      model: {
        type: 'string',
        description: 'Optional: Filter by specific model',
      },
      models: {
        type: 'array',
        description: 'Models to compare (for model_comparison operation)',
      },
      startDate: {
        type: 'string',
        description: 'Optional: Custom start date (ISO format)',
      },
      endDate: {
        type: 'string',
        description: 'Optional: Custom end date (ISO format)',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: tokenAnalyzerConfig.enabled,
    defaultPeriod: tokenAnalyzerConfig.defaultPeriod,
    maxMessagesAnalyzed: tokenAnalyzerConfig.maxMessagesAnalyzed,
  },

  async execute(params: Record<string, unknown>) {
    const { operation, userId, ...options } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[TokenAnalyzer] Parameter validation failed: operation is required and must be a string'
      );
    }

    if (!userId || typeof userId !== 'string') {
      throw new Error('[TokenAnalyzer] Authentication: User ID required');
    }

    try {
      switch (operation) {
        case 'usage_stats': {
          const stats = await tokenAnalyzerService.getUsageStats(userId, options);
          return {
            success: true,
            data: stats,
          };
        }

        case 'cost_analysis': {
          const stats = await tokenAnalyzerService.getUsageStats(userId, options);
          return {
            success: true,
            data: {
              period: stats.period,
              totalCost: stats.totalCost,
              byModel: stats.byModel,
            },
          };
        }

        case 'model_comparison': {
          const models = options.models as string[];
          if (!models || !Array.isArray(models)) {
            throw new Error(
              '[TokenAnalyzer] Validation: models parameter is required for model_comparison and must be an array'
            );
          }

          const comparison = await tokenAnalyzerService.compareModels(
            userId,
            models,
            options
          );
          return {
            success: true,
            data: comparison,
          };
        }

        case 'optimization_tips': {
          const report = await tokenAnalyzerService.getOptimizationTips(userId, options);
          return {
            success: true,
            data: report,
          };
        }

        default:
          throw new Error(`[TokenAnalyzer] Operation: Unknown operation "${operation}"`);
      }
    } catch (error) {
      throw new Error(
        `[TokenAnalyzer] Execution: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  },
};

// Note: Tool is auto-registered in registry.ts to avoid circular dependency
