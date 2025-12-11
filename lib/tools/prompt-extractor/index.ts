// Prompt Pipeline Tool - Main Export
// Date: October 21, 2025
// Enhanced to support batch execution and storage

import { ToolDefinition } from '../types';
import { extractPrompts, executeBatch, storeResults } from './prompt-extractor.service';
import type {
  ExtractionOptions,
  BatchExecutionOptions,
  StorageOptions,
} from './types';

const promptPipelineTool: ToolDefinition = {
  name: 'prompt_pipeline',
  description:
    'Extract prompts from conversations and execute them DIRECTLY against model APIs (OpenAI, HuggingFace, etc.) for batch evaluation and benchmarking. ' +
    'Stores results in custom Supabase tables with flexible metadata. ' +
    'NOTE: Do NOT use with /api/chat endpoints - use "prompt-injector" tool for portal testing with user feedback.',
  version: '2.0.0',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Pipeline operation to perform',
        enum: ['extract_prompts', 'execute_batch', 'store_results'],
      },
      // extract_prompts parameters
      directory: {
        type: 'string',
        description: 'Directory containing conversation JSON files (for extract_prompts)',
      },
      filePattern: {
        type: 'string',
        description: 'File pattern to match (default: .json)',
      },
      maxPrompts: {
        type: 'number',
        description: 'Maximum number of prompts to extract (default: 10000)',
      },
      exportFormat: {
        type: 'string',
        description: 'Export format for prompts (jsonl or txt)',
        enum: ['jsonl', 'txt'],
      },
      exportFilePath: {
        type: 'string',
        description: 'Custom export file path (optional)',
      },
      dataSource: {
        type: 'object',
        description:
          'Data source configuration (local or supabase). Format: {type: "local"|"supabase", path?: string, bucket?: string, prefix?: string}',
      },
      // execute_batch parameters
      prompts: {
        type: 'array',
        description: 'Array of prompt strings to execute (for execute_batch)',
      },
      modelEndpoint: {
        type: 'string',
        description: 'Model API endpoint URL (for execute_batch)',
      },
      batchSize: {
        type: 'number',
        description: 'Number of prompts per batch (default: 10)',
      },
      maxConcurrency: {
        type: 'number',
        description: 'Max concurrent requests (default: 5)',
      },
      requestOptions: {
        type: 'object',
        description:
          'HTTP request configuration. Format: {method?: string, headers?: object, body?: object, timeout?: number}',
      },
      // store_results parameters
      responses: {
        type: 'array',
        description: 'Array of prompt-response pairs to store (for store_results)',
      },
      supabaseTable: {
        type: 'string',
        description: 'Supabase table name for storing results (for store_results)',
      },
      batchMetadata: {
        type: 'object',
        description:
          'Metadata to attach to stored results. Format: {experimentName?: string, modelName?: string, tags?: string[]}',
      },
    },
    required: ['operation'],
  },
  config: {
    enabled: true,
  },
  async execute(params: Record<string, unknown>) {
    const { operation, ...options } = params;

    console.log('[PromptPipeline] Operation:', operation);

    if (!operation || typeof operation !== 'string') {
      throw new Error('Operation is required and must be a string');
    }

    switch (operation) {
      case 'extract_prompts':
        return await extractPrompts(options as unknown as ExtractionOptions);

      case 'execute_batch':
        if (!options.prompts || !Array.isArray(options.prompts)) {
          throw new Error('prompts array is required for execute_batch');
        }
        if (!options.modelEndpoint || typeof options.modelEndpoint !== 'string') {
          throw new Error('modelEndpoint is required for execute_batch');
        }
        return await executeBatch(options as unknown as BatchExecutionOptions);

      case 'store_results':
        if (!options.responses || !Array.isArray(options.responses)) {
          throw new Error('responses array is required for store_results');
        }
        if (!options.supabaseTable || typeof options.supabaseTable !== 'string') {
          throw new Error('supabaseTable is required for store_results');
        }
        return await storeResults(options as unknown as StorageOptions);

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  },
};

export default promptPipelineTool;
export { promptPipelineTool };
// Legacy export for backward compatibility
export { promptPipelineTool as promptExtractorTool };

