// Prompt Tester Tool - Main Export
// Date: October 13, 2025

import { ToolDefinition } from '../types';
import { promptTesterConfig } from './config';
import promptTesterService from './prompt-tester.service';
import type { TestData, TestOptions, PromptPattern } from './types';

/**
 * Prompt Tester Tool Definition
 * A/B test prompts, evaluate quality, and save patterns to GraphRAG
 */
const promptTesterTool: ToolDefinition = {
  name: 'prompt_tester',
  description: 
    'Test and compare LLM prompts with A/B testing. ' +
    'Evaluate prompt quality, performance metrics, and save successful patterns to GraphRAG. ' +
    'Operations: test, compare, save_pattern, search_patterns, evaluate.',
  version: '1.0.0',

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation to perform',
        enum: ['test', 'compare', 'save_pattern', 'search_patterns', 'evaluate'],
      },
      prompt: {
        type: 'string',
        description: 'Prompt template to test (for test operation)',
      },
      prompt_a: {
        type: 'string',
        description: 'First prompt for comparison (for compare operation)',
      },
      prompt_b: {
        type: 'string',
        description: 'Second prompt for comparison (for compare operation)',
      },
      test_data: {
        type: 'object',
        description: 'Test data with variables or messages',
      },
      options: {
        type: 'object',
        description: 'Test options (temperature, max_tokens, iterations)',
      },
      pattern: {
        type: 'object',
        description: 'Pattern to save (for save_pattern operation)',
      },
      query: {
        type: 'string',
        description: 'Search query (for search_patterns operation)',
      },
      user_id: {
        type: 'string',
        description: 'User ID for pattern operations',
      },
    },
    required: ['operation'],
  },

  config: {
    enabled: promptTesterConfig.enabled,
    maxIterations: promptTesterConfig.maxIterations,
    defaultModel: promptTesterConfig.defaultModel,
    defaultTemperature: promptTesterConfig.defaultTemperature,
    defaultMaxTokens: promptTesterConfig.defaultMaxTokens,
    minQualityThreshold: promptTesterConfig.minQualityThreshold,
  },

  /**
   * Execute prompt tester operation
   */
  async execute(params: Record<string, unknown>) {
    const { operation } = params;

    if (!operation || typeof operation !== 'string') {
      throw new Error(
        '[PromptTester] Parameter validation: operation is required'
      );
    }

    switch (operation) {
      case 'test':
        return await executeTest(params);
      case 'compare':
        return await executeCompare(params);
      case 'save_pattern':
        return await executeSavePattern(params);
      case 'search_patterns':
        return await executeSearchPatterns(params);
      case 'evaluate':
        return await executeEvaluate(params);
      default:
        throw new Error(
          `[PromptTester] Unknown operation: ${operation}`
        );
    }
  },
};

/**
 * Execute test operation
 */
async function executeTest(params: Record<string, unknown>) {
  const { prompt, test_data, options } = params;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error(
      '[PromptTester] test: prompt parameter is required and must be a string'
    );
  }

  if (!test_data || typeof test_data !== 'object') {
    throw new Error(
      '[PromptTester] test: test_data parameter is required and must be an object'
    );
  }

  return await promptTesterService.testPrompt(
    prompt,
    test_data as TestData,
    (options as TestOptions) || {}
  );
}

/**
 * Execute compare operation
 */
async function executeCompare(params: Record<string, unknown>) {
  const { prompt_a, prompt_b, test_data, options } = params;

  if (!prompt_a || typeof prompt_a !== 'string') {
    throw new Error(
      '[PromptTester] compare: prompt_a parameter is required and must be a string'
    );
  }

  if (!prompt_b || typeof prompt_b !== 'string') {
    throw new Error(
      '[PromptTester] compare: prompt_b parameter is required and must be a string'
    );
  }

  if (!test_data || typeof test_data !== 'object') {
    throw new Error(
      '[PromptTester] compare: test_data parameter is required and must be an object'
    );
  }

  return await promptTesterService.comparePrompts(
    prompt_a,
    prompt_b,
    test_data as TestData,
    (options as TestOptions) || {}
  );
}

/**
 * Execute save_pattern operation
 */
async function executeSavePattern(params: Record<string, unknown>) {
  const { pattern, user_id } = params;

  if (!pattern || typeof pattern !== 'object') {
    throw new Error(
      '[PromptTester] save_pattern: pattern parameter is required and must be an object'
    );
  }

  if (!user_id || typeof user_id !== 'string') {
    throw new Error(
      '[PromptTester] save_pattern: user_id parameter is required and must be a string'
    );
  }

  return await promptTesterService.savePattern(
    pattern as PromptPattern,
    user_id
  );
}

/**
 * Execute search_patterns operation
 */
async function executeSearchPatterns(params: Record<string, unknown>) {
  const { query, user_id } = params;

  if (!query || typeof query !== 'string') {
    throw new Error(
      '[PromptTester] search_patterns: query parameter is required and must be a string'
    );
  }

  if (!user_id || typeof user_id !== 'string') {
    throw new Error(
      '[PromptTester] search_patterns: user_id parameter is required and must be a string'
    );
  }

  return await promptTesterService.searchPatterns(query, user_id);
}

/**
 * Execute evaluate operation
 */
async function executeEvaluate(params: Record<string, unknown>) {
  const { prompt, test_data, options } = params;

  if (!prompt || typeof prompt !== 'string') {
    throw new Error(
      '[PromptTester] evaluate: prompt parameter is required and must be a string'
    );
  }

  if (!test_data || typeof test_data !== 'object') {
    throw new Error(
      '[PromptTester] evaluate: test_data parameter is required and must be an object'
    );
  }

  // Evaluate is same as test for now
  const result = await promptTesterService.testPrompt(
    prompt,
    test_data as TestData,
    (options as TestOptions) || {}
  );

  return {
    result,
    passed: (result.qualityScore || 0) >= promptTesterConfig.minQualityThreshold,
    threshold: promptTesterConfig.minQualityThreshold,
  };
}

export default promptTesterTool;
export { promptTesterTool }; // Named export for compatibility
