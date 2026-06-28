import { describe, expect, it } from 'vitest';
import { buildRegistryToolSeedRows, mergeRegistryToolSeedRow } from '../registry-sync';
import type { ToolDefinition } from '../types';

function tool(name: string, enabled = true, operationEnum: string[] = ['run']): ToolDefinition {
  return {
    name,
    description: `${name} description`,
    version: '1.0.0',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Operation to perform',
          enum: operationEnum,
        },
      },
      required: ['operation'],
    },
    config: { enabled },
    execute: async () => ({}),
  };
}

describe('buildRegistryToolSeedRows', () => {
  it('derives seed rows from all registered tools', () => {
    const rows = buildRegistryToolSeedRows([
      tool('query_knowledge_graph'),
      tool('intelligent_email'),
      tool('email_analysis'),
      tool('email_security'),
      tool('web_search', false, ['search']),
      tool('dataset_manager'),
      tool('prompt_tester'),
      tool('analytics_export'),
      tool('training_control'),
    ]);

    expect(rows.map((row) => row.name)).toEqual([
      'analytics_export',
      'dataset_manager',
      'email_analysis',
      'email_security',
      'intelligent_email',
      'prompt_tester',
      'query_knowledge_graph',
      'training_control',
      'web_search',
    ]);
    expect(rows.find((row) => row.name === 'web_search')?.is_enabled).toBe(false);
    expect(rows.find((row) => row.name === 'web_search')?.parameters.properties.operation.enum).toEqual(['search']);
  });

  it('includes server-side registry tools for non-portal consumers', () => {
    const rows = buildRegistryToolSeedRows([
      tool('calculator'),
      tool('filesystem'),
      tool('system_monitor'),
      tool('dataset_manager'),
      tool('training_control'),
    ]);

    expect(rows.map((row) => row.name)).toEqual([
      'calculator',
      'dataset_manager',
      'filesystem',
      'system_monitor',
      'training_control',
    ]);
  });

  it('preserves existing enabled state when syncing an existing row', () => {
    const [row] = buildRegistryToolSeedRows([tool('intelligent_email', true)]);

    expect(mergeRegistryToolSeedRow(row, { is_enabled: false }).is_enabled).toBe(false);
    expect(mergeRegistryToolSeedRow(row, null).is_enabled).toBe(true);
  });
});
