// Prompt Injector Tool - Main Export
// Date: October 16, 2025

import { ToolDefinition } from '../types';
import { injectBatch } from './prompt-injector.service';
import type { InjectionOptions } from './types';

const promptInjectorTool: ToolDefinition = {
  name: 'prompt_injector',
  description: 'Send batches of prompts through the CHAT PORTAL (/api/chat) for load testing with automatic user feedback collection, widget session tracking, and conversation history. Use this for portal UI testing. For direct model API testing, use "prompt_pipeline" tool instead.',
  version: '1.0.0',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['inject_batch'],
      },
      prompts: {
        type: 'array',
        description: 'Array of prompt strings to send',
      },
      options: {
        type: 'object',
        description: 'Injection options (endpoint, apiKey, parallelism, delayMs, headers)',
      },
    },
    required: ['operation', 'prompts', 'options'],
  },
  config: {
    enabled: true,
  },
  async execute(params: Record<string, unknown>, _conversationId?: string, _userId?: string, _supabaseClient?: unknown, _traceContext?: any) {
    const { operation, prompts, options } = params;
    if (operation !== 'inject_batch') {
      throw new Error('[PromptInjector] Only inject_batch operation is supported');
    }
    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error('[PromptInjector] prompts must be a non-empty array of strings');
    }
    if (!options || typeof options !== 'object') {
      throw new Error('[PromptInjector] options must be provided');
    }
    return await injectBatch(prompts as string[], options as InjectionOptions);
  },
};

export default promptInjectorTool;
export { promptInjectorTool };
