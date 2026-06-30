import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolDefinition } from '../anthropic';
import { runAnthropicWithToolCalls } from '../anthropic';

const createMessage = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function AnthropicMock() {
    return {
      messages: {
        create: createMessage,
      },
    };
  }),
}));

function toolNames(callIndex: number): string[] {
  const request = createMessage.mock.calls[callIndex]?.[0] as { tools?: Array<{ name: string }> } | undefined;
  return (request?.tools ?? []).map((tool) => tool.name);
}

describe('runAnthropicWithToolCalls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMessage
      .mockResolvedValueOnce({
        content: [
          {
            type: 'tool_use',
            id: 'tool-use-1',
            name: 'generate_image',
            input: { prompt: 'a quiet studio' },
          },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 4,
        },
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: 'Image generation has started.',
          },
        ],
        usage: {
          input_tokens: 12,
          output_tokens: 6,
        },
      });
  });

  it('remaps tools for the follow-up request after the handler mutates the tool list', async () => {
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'generate_image',
          description: 'Generate an image.',
          parameters: { type: 'object', properties: { prompt: { type: 'string' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Calculate arithmetic.',
          parameters: { type: 'object', properties: { expression: { type: 'string' } } },
        },
      },
    ];

    const response = await runAnthropicWithToolCalls(
      [{ role: 'user', content: 'Generate an image.' }],
      'claude-3-5-haiku-latest',
      0,
      256,
      tools,
      async (toolName) => {
        tools.splice(
          0,
          tools.length,
          ...tools.filter((tool) => tool.function.name !== toolName),
        );
        return { status: 'image_generation_started', jobId: 'img-job-1' };
      },
    );

    expect(response.content).toBe('Image generation has started.');
    expect(toolNames(0)).toEqual(['generate_image', 'calculator']);
    expect(toolNames(1)).toEqual(['calculator']);
  });

  it('remaps follow-up tools from a live tool provider', async () => {
    let activeTools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'generate_image',
          description: 'Generate an image.',
          parameters: { type: 'object', properties: { prompt: { type: 'string' } } },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculator',
          description: 'Calculate arithmetic.',
          parameters: { type: 'object', properties: { expression: { type: 'string' } } },
        },
      },
    ];

    const response = await runAnthropicWithToolCalls(
      [{ role: 'user', content: 'Generate an image.' }],
      'claude-3-5-haiku-latest',
      0,
      256,
      () => activeTools,
      async (toolName) => {
        activeTools = activeTools.filter((tool) => tool.function.name !== toolName);
        return { status: 'image_generation_started', jobId: 'img-job-1' };
      },
    );

    expect(response.content).toBe('Image generation has started.');
    expect(toolNames(0)).toEqual(['generate_image', 'calculator']);
    expect(toolNames(1)).toEqual(['calculator']);
  });
});
