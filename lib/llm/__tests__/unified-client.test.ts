import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ModelConfig } from '@/lib/models/llm-model.types';
import type { ToolDefinition } from '../openai';

const getModelConfig = vi.hoisted(() => vi.fn());

vi.mock('@/lib/models/model-manager.service', () => ({
  modelManager: {
    getModelConfig,
  },
}));

vi.mock('@/lib/guardrails', () => ({
  guardrailsService: {
    isEnabled: () => false,
    checkInput: vi.fn(),
    checkOutput: vi.fn(),
  },
}));

const vllmConfig: ModelConfig = {
  id: 'model-vllm-qwen',
  name: 'Local Qwen',
  provider: 'vllm',
  base_url: 'http://localhost:8000/v1',
  model_id: 'qwen3',
  served_model_name: 'qwen3',
  auth_type: 'none',
  auth_headers: {},
  supports_streaming: true,
  supports_functions: true,
  supports_vision: false,
  context_length: 32768,
  max_output_tokens: 2000,
  default_temperature: 0.7,
  default_top_p: 1,
  metadata: {
    vllm_runtime: {
      parse_qwen_xml_tool_calls: true,
    },
  },
};

const tools: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'search_docs',
      description: 'Search uploaded documents',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      },
    },
  },
];

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('UnifiedLLMClient tool continuations', () => {
  beforeEach(() => {
    vi.resetModules();
    getModelConfig.mockResolvedValue(vllmConfig);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('preserves assistant tool_calls before tool results for vLLM XML fallback calls', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        choices: [
          {
            message: {
              content: `<tool_call>
{"name":"search_docs","arguments":{"query":"deflection audit"}}
</tool_call>`,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [
          {
            message: {
              content: 'Found the relevant document.',
            },
          },
        ],
        usage: {
          prompt_tokens: 14,
          completion_tokens: 7,
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { UnifiedLLMClient } = await import('../unified-client');
    const client = new UnifiedLLMClient();

    const response = await client.chat(
      'model-vllm-qwen',
      [{ role: 'user', content: 'search docs' }],
      {
        tools,
        toolCallHandler: async () => ({ result: 'found' }),
        skipGuardrails: true,
      }
    );

    expect(response.content).toBe('Found the relevant document.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = JSON.parse(fetchMock.mock.calls[1][1].body as string);

    expect(secondRequest.messages).toEqual([
      { role: 'user', content: 'search docs' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'qwen-xml-tool-0',
            type: 'function',
            function: {
              name: 'search_docs',
              arguments: JSON.stringify({ query: 'deflection audit' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ result: 'found' }),
        tool_call_id: 'qwen-xml-tool-0',
        name: 'search_docs',
      },
    ]);
  });

  it('keeps recovered vLLM XML tool call ids unique across multiple tool rounds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        choices: [
          {
            message: {
              content: `<tool_call>
{"name":"search_docs","arguments":{"query":"alpha"}}
</tool_call>`,
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [
          {
            message: {
              content: `<tool_call>
{"name":"search_docs","arguments":{"query":"beta"}}
</tool_call>`,
            },
          },
        ],
        usage: {
          prompt_tokens: 14,
          completion_tokens: 5,
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        choices: [
          {
            message: {
              content: 'Found both documents.',
            },
          },
        ],
        usage: {
          prompt_tokens: 18,
          completion_tokens: 7,
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const { UnifiedLLMClient } = await import('../unified-client');
    const client = new UnifiedLLMClient();
    const toolCallHandler = vi.fn(async (_toolName: string, args: Record<string, unknown>) => ({
      result: args.query,
    }));

    const response = await client.chat(
      'model-vllm-qwen',
      [{ role: 'user', content: 'search docs twice' }],
      {
        tools,
        toolCallHandler,
        skipGuardrails: true,
      }
    );

    expect(response.content).toBe('Found both documents.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(toolCallHandler).toHaveBeenCalledTimes(2);
    const thirdRequest = JSON.parse(fetchMock.mock.calls[2][1].body as string);

    expect(thirdRequest.messages).toEqual([
      { role: 'user', content: 'search docs twice' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'qwen-xml-tool-0',
            type: 'function',
            function: {
              name: 'search_docs',
              arguments: JSON.stringify({ query: 'alpha' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ result: 'alpha' }),
        tool_call_id: 'qwen-xml-tool-0',
        name: 'search_docs',
      },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'qwen-xml-tool-1',
            type: 'function',
            function: {
              name: 'search_docs',
              arguments: JSON.stringify({ query: 'beta' }),
            },
          },
        ],
      },
      {
        role: 'tool',
        content: JSON.stringify({ result: 'beta' }),
        tool_call_id: 'qwen-xml-tool-1',
        name: 'search_docs',
      },
    ]);
  });
});
